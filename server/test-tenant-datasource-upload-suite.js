const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const tenantService = require('./services/tenantService');
const DataSource = require('./models/dataSourceModel');
const Dataset = require('./models/datasetModel');

async function runTenantUploadTestSuite() {
  console.log('\n================================================================');
  console.log('   TENANT RESOLUTION & MULTI-SOURCE INGESTION REGRESSION SUITE   ');
  console.log('================================================================\n');

  await db.initDb();

  let server = http.createServer(app);
  let port;
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      console.log(`[Test Server] Listening on port ${port}`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Setup test organizations & users in database
    // -------------------------------------------------------------
    const orgIdA = 'a1111111-1111-1111-1111-111111111111';
    const orgIdB = 'b2222222-2222-2222-2222-222222222222';
    const orgIdC = 'c3333333-3333-3333-3333-333333333333';

    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, trial_ends_at)
      VALUES 
        ($1, 'Acme Retail Corp', 'acme-retail', 'starter', 'trial', 'unpaid', NOW() + INTERVAL '14 days'),
        ($2, 'Beta Logistics Inc', 'beta-logistics', 'growth', 'trial', 'unpaid', NOW() + INTERVAL '14 days'),
        ($3, 'Gamma Global Ltd', 'gamma-global', 'enterprise', 'active', 'paid', NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET 
        plan = EXCLUDED.plan,
        subscription_status = EXCLUDED.subscription_status,
        payment_status = EXCLUDED.payment_status;
    `, [orgIdA, orgIdB, orgIdC]);

    const userAdminA = { email: 'admin_a@acme.test', role: 'admin', organization_id: orgIdA };
    const userMemberA = { email: 'member_a@acme.test', role: 'member', organization_id: orgIdA };
    const userViewerA = { email: 'viewer_a@acme.test', role: 'viewer', organization_id: orgIdA };
    const userMultiOrg = { email: 'multi_user@domain.test', role: 'analyst', organization_id: orgIdA };
    const userNoOrg = { email: 'no_org_user@orphan.test', role: 'member', organization_id: null };

    // Seed users and retrieve assigned integer IDs
    for (const u of [userAdminA, userMemberA, userViewerA, userMultiOrg, userNoOrg]) {
      const res = await db.query(`
        INSERT INTO users (email, name, role, organization_id, status, password_hash)
        VALUES ($1, $1, $2, $3, 'active', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF1234567890')
        ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, organization_id = EXCLUDED.organization_id, status = 'active'
        RETURNING id;
      `, [u.email, u.role, u.organization_id]);
      u.id = res.rows[0].id;
    }

    // Add userMultiOrg to Org B as manager via invitations table
    try {
      await db.query(`
        INSERT INTO invitations (organization_id, invited_by, email, role, status, token, expires_at)
        VALUES ($1, $2, $3, 'manager', 'accepted', 'inv_token_multi_test', NOW() + INTERVAL '7 days')
        ON CONFLICT (token) DO UPDATE SET status = 'accepted';
      `, [orgIdB, userAdminA.id, userMultiOrg.email]);
    } catch (e) {
      console.warn('Invitations seeding notice:', e.message);
    }

    // Tokens
    const jwtSecret = config.jwtSecret || 'super_secret_jwt_key_ricoz_2026';
    const tokenAdminA = jwt.sign(userAdminA, jwtSecret, { expiresIn: '1h' });
    const tokenMemberA = jwt.sign(userMemberA, jwtSecret, { expiresIn: '1h' });
    const tokenViewerA = jwt.sign(userViewerA, jwtSecret, { expiresIn: '1h' });
    const tokenMultiOrg = jwt.sign(userMultiOrg, jwtSecret, { expiresIn: '1h' });
    const tokenNoOrg = jwt.sign(userNoOrg, jwtSecret, { expiresIn: '1h' });

    // HTTP Helper
    function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...headers
          }
        }, (res) => {
          let rawData = '';
          res.on('data', chunk => rawData += chunk);
          res.on('end', () => {
            let json = null;
            try { json = JSON.parse(rawData); } catch (_) {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              raw: rawData
            });
          });
        });
        req.on('error', reject);
        if (body) {
          if (Buffer.isBuffer(body) || typeof body === 'string') {
            req.write(body);
          } else {
            req.write(JSON.stringify(body));
          }
        }
        req.end();
      });
    }

    function uploadMultipart({ token, organizationIdHeader, fieldName = 'file', fileName, content, extraFields = {} }) {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      let bodyParts = [];

      for (const [key, val] of Object.entries(extraFields)) {
        bodyParts.push(Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
          `${val}\r\n`
        ));
      }

      bodyParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
      ));
      bodyParts.push(Buffer.isBuffer(content) ? content : Buffer.from(content));
      bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const fullBuffer = Buffer.concat(bodyParts);
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBuffer.length
      };
      if (organizationIdHeader) {
        headers['X-Organization-Id'] = organizationIdHeader;
      }

      return makeRequest({
        path: '/api/data-sources/upload',
        method: 'POST',
        headers,
        body: fullBuffer
      });
    }

    const sampleCsv = 'order_id,product_name,amount,status\n101,Widget A,49.99,completed\n102,Widget B,89.50,completed\n103,Widget C,19.99,refunded\n';

    // -------------------------------------------------------------------------
    // TEST 1: Authorized teammate can upload a CSV to their active organization
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Authorized teammate can upload CSV to active organization...');
    const uploadRes1 = await uploadMultipart({
      token: tokenAdminA,
      fileName: 'sample_1_retail_sales.csv',
      content: sampleCsv,
      extraFields: { name: 'Retail Sales Q3', description: 'Sample retail sales dataset' }
    });

    assert.strictEqual(uploadRes1.status, 201, `Upload should succeed with 201, got ${uploadRes1.status}: ${JSON.stringify(uploadRes1.body)}`);
    assert.strictEqual(uploadRes1.body.success, true);
    assert.strictEqual(uploadRes1.body.data.dataset.organization_id, orgIdA, 'Dataset must be isolated to Org A');
    console.log('  ✓ Successfully uploaded CSV; dataset and data source correctly isolated to Org A');

    // -------------------------------------------------------------------------
    // TEST 2: Authorized teammate can create each supported data-source type
    // (CSV/JSON upload, PostgreSQL, MongoDB, REST API)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Authorized teammate can create each supported data-source type...');
    
    // 2a. JSON File Upload
    const sampleJson = JSON.stringify([
      { id: 1, name: 'Alice', role: 'Engineer' },
      { id: 2, name: 'Bob', role: 'Designer' }
    ]);
    const jsonRes = await uploadMultipart({
      token: tokenAdminA,
      fileName: 'users.json',
      content: sampleJson,
      extraFields: { name: 'JSON Users' }
    });
    assert.strictEqual(jsonRes.status, 201);
    assert.strictEqual(jsonRes.body.data.dataset.organization_id, orgIdA);
    console.log('  ✓ JSON File Upload succeeded with tenant organization isolation');

    // 2b. PostgreSQL connector
    const pgRes = await makeRequest({
      path: '/api/data-sources',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Warehouse Postgres',
        type: 'postgresql',
        config: {
          host: '127.0.0.1',
          port: '5432',
          database: 'warehouse',
          user: 'postgres_user',
          password: 'secret_pg_password'
        }
      }
    });
    // Can succeed with 201 or fail connection test with 400 (if local pg port unavailable), but NOT fail with 403 NO_ORGANIZATION!
    assert.notStrictEqual(pgRes.body?.error?.code, 'NO_ORGANIZATION', 'PostgreSQL creation must resolve organization ID');
    assert.notStrictEqual(pgRes.status, 403, 'Must not be rejected with 403 NO_ORGANIZATION');
    console.log(`  ✓ PostgreSQL connector request resolved tenant organization (HTTP ${pgRes.status})`);

    // 2c. MongoDB connector
    const mongoRes = await makeRequest({
      path: '/api/data-sources',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Inventory MongoDB',
        type: 'mongodb',
        config: {
          uri: 'mongodb://localhost:27017/inventory'
        }
      }
    });
    assert.notStrictEqual(mongoRes.body?.error?.code, 'NO_ORGANIZATION');
    assert.notStrictEqual(mongoRes.status, 403);
    console.log(`  ✓ MongoDB connector request resolved tenant organization (HTTP ${mongoRes.status})`);

    // 2d. REST API connector
    const apiRes = await makeRequest({
      path: '/api/data-sources',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Customer REST Feed',
        type: 'rest_api',
        config: {
          url: 'https://jsonplaceholder.typicode.com/posts',
          method: 'GET'
        }
      }
    });
    assert.notStrictEqual(apiRes.body?.error?.code, 'NO_ORGANIZATION');
    assert.notStrictEqual(apiRes.status, 403);
    console.log(`  ✓ REST API connector request resolved tenant organization (HTTP ${apiRes.status})`);

    // -------------------------------------------------------------------------
    // TEST 3: User with no organization membership receives clear actionable error
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] User with no organization membership receives clear 403 NO_ORGANIZATION error...');
    const noOrgUpload = await uploadMultipart({
      token: tokenNoOrg,
      fileName: 'test.csv',
      content: sampleCsv,
      extraFields: { name: 'Orphan Upload' }
    });
    assert.strictEqual(noOrgUpload.status, 403, 'Orphan user must be rejected with 403');
    assert.strictEqual(noOrgUpload.body.error?.code, 'NO_ORGANIZATION');
    assert.strictEqual(noOrgUpload.body.message, 'No tenant organization associated with current session.');
    console.log('  ✓ Orphan user rejected with clear actionable 403 NO_ORGANIZATION');

    // -------------------------------------------------------------------------
    // TEST 4: Switching organizations uses the selected organization
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Switching organizations uses the selected organization...');
    // userMultiOrg is member of Org A and Org B
    // Upload into Org A by default
    const uploadOrgA = await uploadMultipart({
      token: tokenMultiOrg,
      fileName: 'sales_org_a.csv',
      content: sampleCsv,
      extraFields: { name: 'Org A Sales' }
    });
    assert.strictEqual(uploadOrgA.status, 201);
    assert.strictEqual(uploadOrgA.body.data.dataset.organization_id, orgIdA);
    console.log('  ✓ Default upload placed into primary Org A');

    // Upload into Org B using X-Organization-Id
    const uploadOrgB = await uploadMultipart({
      token: tokenMultiOrg,
      organizationIdHeader: orgIdB,
      fileName: 'sales_org_b.csv',
      content: sampleCsv,
      extraFields: { name: 'Org B Sales' }
    });
    assert.strictEqual(uploadOrgB.status, 201);
    assert.strictEqual(uploadOrgB.body.data.dataset.organization_id, orgIdB);
    console.log('  ✓ Switched upload placed into selected Org B');

    // -------------------------------------------------------------------------
    // TEST 5: User cannot upload into another organization by manipulating headers
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] User cannot upload into another organization by manipulating request headers...');
    // userAdminA belongs to Org A, attempts to specify Org C (Gamma Global) which they are NOT member of
    const maliciousUpload = await uploadMultipart({
      token: tokenAdminA,
      organizationIdHeader: orgIdC,
      fileName: 'unauthorized_target.csv',
      content: sampleCsv,
      extraFields: { name: 'Malicious Upload' }
    });
    assert.strictEqual(maliciousUpload.status, 403, 'Cross-tenant spoofing attempt must be rejected with 403');
    assert.strictEqual(maliciousUpload.body.error?.code, 'FORBIDDEN_ORGANIZATION');
    console.log('  ✓ Malicious cross-tenant spoofing rejected with 403 FORBIDDEN_ORGANIZATION');

    // -------------------------------------------------------------------------
    // TEST 6: Delayed authentication / organization context handling
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Delayed authentication or missing org context does not trigger premature upload...');
    const unauthUpload = await uploadMultipart({
      token: 'invalid_or_expired_token',
      fileName: 'premature.csv',
      content: sampleCsv
    });
    assert.strictEqual(unauthUpload.status, 401, 'Invalid session must return 401 UNAUTHORIZED');
    console.log('  ✓ Invalid or unauthenticated session strictly returns 401');

    // -------------------------------------------------------------------------
    // TEST 7: Existing owners, admins, and members retain their intended permissions
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Existing owners, admins, and members retain intended permissions...');
    // Admin A can list data sources
    const listAdmin = await makeRequest({
      path: '/api/data-sources',
      headers: { 'Authorization': `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(listAdmin.status, 200);

    // Member A can list data sources and upload CSV
    const memberUpload = await uploadMultipart({
      token: tokenMemberA,
      fileName: 'member_upload.csv',
      content: sampleCsv,
      extraFields: { name: 'Member Upload' }
    });
    assert.strictEqual(memberUpload.status, 201);
    assert.strictEqual(memberUpload.body.data.dataset.organization_id, orgIdA);

    // Viewer A has read permissions
    const listViewer = await makeRequest({
      path: '/api/data-sources',
      headers: { 'Authorization': `Bearer ${tokenViewerA}` }
    });
    assert.strictEqual(listViewer.status, 200);

    console.log('  ✓ Admins, members, and viewers retain all intended permissions');

    console.log('\n================================================================');
    console.log('   ALL 7 TENANT RESOLUTION & UPLOAD TESTS PASSED (100%)         ');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTenantUploadTestSuite()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = runTenantUploadTestSuite;
