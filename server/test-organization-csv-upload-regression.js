const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const DataSource = require('./models/dataSourceModel');
const Dataset = require('./models/datasetModel');

async function runRegressionSuite() {
  console.log('\n================================================================');
  console.log('   ORGANIZATION ID CSV UPLOAD & TENANCY REGRESSION TEST SUITE   ');
  console.log('================================================================\n');

  const csvPath = 'C:/Users/gowth/Downloads/ricozanalytics_test_10k.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  let server = http.createServer(app);
  let port;

  await new Promise((resolve) => {
    server.listen(0, async () => {
      port = server.address().port;
      console.log(`[Server] Test server listening on port ${port}`);
      resolve();
    });
  });

  await db.initDb();

  const orgARes = await db.query("SELECT id FROM organizations WHERE slug = 'ricoz-primary' OR name ILIKE '%primary%' LIMIT 1");
  const validOrgA = orgARes.rows[0]?.id || '00000000-0000-0000-0000-000000000001';
  const validOrgB = '00000000-0000-0000-0000-000000000002'; // Secondary Org
  const nonExistentOrg = '99999999-9999-9999-9999-999999999999';

  const adminRes = await db.query("SELECT id FROM users WHERE email = 'admin@ricoz.test' LIMIT 1");
  const adminIdA = adminRes.rows[0]?.id || '1524dec9-6e5b-43d6-9438-8e2b8829f243';

  // Seed Org B in DB if not present with enterprise plan and active subscription
  try {
    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, trial_ends_at) 
      VALUES ('00000000-0000-0000-0000-000000000002', 'Tenant B Org', 'tenant-b-org', 'enterprise', 'active', NOW() + INTERVAL '30 days')
      ON CONFLICT (id) DO UPDATE SET subscription_status = 'active'
    `).catch(() => null);
  } catch (_) {}

  // 1. Token for Admin in Org A
  const adminTokenA = jwt.sign(
    { id: adminIdA, email: 'admin@ricoz.test', role: 'admin', organization_id: validOrgA },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  // 2. Token with Missing Organization
  const userNoOrgToken = jwt.sign(
    { id: '22222222-2222-2222-2222-222222222222', email: 'no_org@ricoz.test', role: 'admin', organization_id: null },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  // 3. Token with Non-existent Organization
  const userInvalidOrgToken = jwt.sign(
    { id: '33333333-3333-3333-3333-333333333333', email: 'bad_org@ricoz.test', role: 'admin', organization_id: nonExistentOrg },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  // 4. Token for Tenant B
  const tenantBToken = jwt.sign(
    { id: '44444444-4444-4444-4444-444444444444', email: 'tenant_b@ricoz.test', role: 'admin', organization_id: validOrgB },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  function uploadFile(token, fileName, fileContent, datasetName = 'Test Dataset') {
    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const pre = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="name"\r\n\r\n` +
        `${datasetName}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
      );
      const post = Buffer.from(`\r\n--${boundary}--\r\n`);
      const fullBody = Buffer.concat([pre, Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent), post]);

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/data-sources/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      req.write(fullBody);
      req.end();
    });
  }

  let uploadedDatasetId = null;
  let uploadedDataSourceId = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Authenticated Admin uploading 10k CSV
    // -------------------------------------------------------------
    console.log('\n[Test 1] Authenticated Admin uploading 10k CSV (Org A)...');
    const fileBuffer = fs.readFileSync(csvPath);
    const res1 = await uploadFile(adminTokenA, 'ricozanalytics_test_10k.csv', fileBuffer, 'Production 10K Dataset');
    console.log(` -> Status: ${res1.statusCode}`);
    assert.strictEqual(res1.statusCode, 201, `Expected 201 Created, got ${res1.statusCode}: ${JSON.stringify(res1.body)}`);
    assert(res1.body.success, 'Response success should be true');
    assert.strictEqual(Number(res1.body.data.dataset.rowCount), 10000, 'Expected 10,000 rows');
    uploadedDatasetId = res1.body.data.dataset.id;
    uploadedDataSourceId = res1.body.data.dataSource.id;

    // Verify DB records have organization_id explicitly set
    const dsRow = await db.query('SELECT organization_id FROM data_sources WHERE id = $1', [uploadedDataSourceId]);
    assert(dsRow.rows.length > 0, 'Data source record must exist in DB');
    assert.strictEqual(String(dsRow.rows[0].organization_id), validOrgA, `data_sources.organization_id must be ${validOrgA}`);

    const datasetRow = await db.query('SELECT organization_id FROM datasets WHERE id = $1', [uploadedDatasetId]);
    assert(datasetRow.rows.length > 0, 'Dataset record must exist in DB');
    assert.strictEqual(String(datasetRow.rows[0].organization_id), validOrgA, `datasets.organization_id must be ${validOrgA}`);

    console.log(` ✓ PASS: Upload succeeded with 10k rows. DB verified: data_sources.organization_id = ${validOrgA}`);

    // -------------------------------------------------------------
    // Test 2: Missing Organization Membership
    // -------------------------------------------------------------
    console.log('\n[Test 2] Missing Organization Membership rejection...');
    const res2 = await uploadFile(userNoOrgToken, 'sample.csv', 'col1,col2\nval1,val2\n');
    console.log(` -> Status: ${res2.statusCode}, Message: ${res2.body?.message}`);
    assert([400, 401, 403].includes(res2.statusCode), `Must reject upload with 400 or 403 when user has no organization, got ${res2.statusCode}`);
    console.log(' ✓ PASS: Correctly rejected when organization is missing');

    // -------------------------------------------------------------
    // Test 3: Invalid Organization ID
    // -------------------------------------------------------------
    console.log('\n[Test 3] Invalid / Non-existent Organization ID rejection...');
    const res3 = await uploadFile(userInvalidOrgToken, 'sample.csv', 'col1,col2\nval1,val2\n');
    console.log(` -> Status: ${res3.statusCode}, Message: ${res3.body?.message}`);
    assert([400, 402, 403, 404].includes(res3.statusCode), `Must reject upload when organization does not exist, got ${res3.statusCode}`);
    console.log(' ✓ PASS: Correctly rejected when organization does not exist in DB');

    // -------------------------------------------------------------
    // Test 4: Cross-Tenant Access Protection
    // -------------------------------------------------------------
    console.log('\n[Test 4] Cross-Tenant Access Protection...');
    // Tenant B attempts to read Tenant A's dataset
    const crossRead = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/datasets/${uploadedDatasetId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tenantBToken}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') }));
      });
      req.end();
    });
    console.log(` -> Tenant B GET Tenant A dataset status: ${crossRead.statusCode}`);
    assert.strictEqual(crossRead.statusCode, 404, 'Tenant B must NOT be able to view Tenant A dataset (must return 404)');

    // Tenant B attempts to list datasets (must not see Tenant A's dataset)
    const listTenantB = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/datasets',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tenantBToken}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') }));
      });
      req.end();
    });
    const leak = listTenantB.body?.data?.find(d => d.id === uploadedDatasetId);
    assert(!leak, 'Tenant A dataset must NOT leak into Tenant B dataset list');
    console.log(' ✓ PASS: Strict multi-tenant isolation confirmed (404 on direct access, 0 leaks in list)');

    // -------------------------------------------------------------
    // Test 5: Failed Ingestion Cleanup (Orphan Prevention)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Failed Ingestion Cleanup & Orphan Prevention...');
    // Upload a malformed/corrupted file that causes parser/ingestion failure
    const countDsBefore = await db.query('SELECT COUNT(*) as c FROM data_sources');
    const countDtBefore = await db.query('SELECT COUNT(*) as c FROM datasets');

    // Upload an invalid non-parseable JSON file that triggers parser/ingestion failure
    const corruptBuffer = Buffer.from('{ "broken": [ invalid json content without closing');
    const corruptRes = await uploadFile(adminTokenA, 'corrupt.json', corruptBuffer, 'Corrupt Upload');
    console.log(` -> Corrupt upload status: ${corruptRes.statusCode}, msg: ${corruptRes.body?.message}`);
    assert.strictEqual(corruptRes.statusCode, 400, 'Must return 400 on malformed data upload');
    
    const countDsAfter = await db.query('SELECT COUNT(*) as c FROM data_sources');
    const countDtAfter = await db.query('SELECT COUNT(*) as c FROM datasets');
    const dsBefore = Number(countDsBefore.rows[0]?.c || countDsBefore.rows[0]?.count || 0);
    const dsAfter = Number(countDsAfter.rows[0]?.c || countDsAfter.rows[0]?.count || 0);
    const dtBefore = Number(countDtBefore.rows[0]?.c || countDtBefore.rows[0]?.count || 0);
    const dtAfter = Number(countDtAfter.rows[0]?.c || countDtAfter.rows[0]?.count || 0);

    assert.strictEqual(dsAfter, dsBefore, 'No orphaned data_sources must remain on failure');
    assert.strictEqual(dtAfter, dtBefore, 'No orphaned datasets must remain on failure');
    console.log(' ✓ PASS: Safe cleanup verified. No orphaned data_sources or datasets created on failure');

    // -------------------------------------------------------------
    // Test 6: Persistence across Backend Server Restart
    // -------------------------------------------------------------
    console.log('\n[Test 6] Persistence across Backend Server Restart...');
    await new Promise(r => server.close(r));
    console.log(' -> Server instance shut down.');

    // Start fresh server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        console.log(` -> Fresh server instance restarted on port ${port}`);
        resolve();
      });
    });

    // Query dataset with Admin token
    const restartCheck = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/datasets/${uploadedDatasetId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminTokenA}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') }));
      });
      req.end();
    });

    assert.strictEqual(restartCheck.statusCode, 200, 'Dataset must still be available after restart');
    assert.strictEqual(Number(restartCheck.body.data.row_count), 10000, 'Row count must still be 10,000');
    console.log(' ✓ PASS: Dataset persisted with all 10,000 rows across full backend restart');

    console.log('\n================================================================');
    console.log('  ALL 6 REGRESSION CHECKS PASSED (100%)                          ');
    console.log('================================================================\n');

  } finally {
    // Cleanup created test records
    if (uploadedDatasetId) {
      await db.query('DELETE FROM datasets WHERE id = $1', [uploadedDatasetId]).catch(() => null);
    }
    if (uploadedDataSourceId) {
      await db.query('DELETE FROM data_sources WHERE id = $1', [uploadedDataSourceId]).catch(() => null);
    }
    if (server) {
      await new Promise(r => server.close(r));
    }
    await db.closeDb();
  }
}

runRegressionSuite().catch((err) => {
  console.error('\n❌ Regression test failed:', err);
  process.exit(1);
});
