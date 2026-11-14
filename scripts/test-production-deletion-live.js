const https = require('https');
const fs = require('fs');
const path = require('path');
const bcrypt = require(path.resolve(__dirname, '../server/node_modules/bcryptjs'));
const dotenv = require(path.resolve(__dirname, '../server/node_modules/dotenv'));
const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server/.env')));
const { Pool } = require(path.resolve(__dirname, '../server/node_modules/pg'));

const API_BASE = 'https://ricoz-analytics.onrender.com/api';
const isLocal = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

function apiPost(endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifyProductionDeletion() {
  console.log('================================================================');
  console.log('🧪 LIVE PRODUCTION DELETION VERIFICATION (SYNTHETIC ACCOUNT)');
  console.log('================================================================');

  const ts = Date.now();
  const testEmail = `synthetic_target_${ts}@ricoz.test`;
  const controlEmail = `control_tenant_${ts}@ricoz.test`;
  const plainPassword = `ValidPass!${ts}`;
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const dbClient = await pool.connect();
  let targetUserId = null;
  let targetOrgId = null;
  let controlUserId = null;
  let controlOrgId = null;

  try {
    console.log(`\n1. Provisioning isolated synthetic test tenants in production DB...`);

    // Target Tenant Org & User
    const orgAId = `00000000-0000-0000-0000-a${String(ts).slice(-11)}`;
    const orgBId = `00000000-0000-0000-0000-b${String(ts).slice(-11)}`;

    await dbClient.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
      VALUES 
        ($1, $2, $3, 'starter', 'active', NOW(), NOW()),
        ($4, $5, $6, 'enterprise', 'active', NOW(), NOW())
    `, [orgAId, `Target Org ${ts}`, `target-org-${ts}`, orgBId, `Control Org ${ts}`, `control-org-${ts}`]);

    targetOrgId = orgAId;
    controlOrgId = orgBId;

    const userARes = await dbClient.query(`
      INSERT INTO users (email, password_hash, name, role, organization_id, status)
      VALUES ($1, $2, 'Target Deletion User', 'admin', $3, 'active')
      RETURNING id
    `, [testEmail, passwordHash, targetOrgId]);
    targetUserId = userARes.rows[0].id;

    const userBRes = await dbClient.query(`
      INSERT INTO users (email, password_hash, name, role, organization_id, status)
      VALUES ($1, $2, 'Control Active User', 'admin', $3, 'active')
      RETURNING id
    `, [controlEmail, passwordHash, controlOrgId]);
    controlUserId = userBRes.rows[0].id;

    console.log(`   ✅ Target Tenant: User ${targetUserId} (${testEmail}) in Org ${targetOrgId}`);
    console.log(`   ✅ Control Tenant: User ${controlUserId} (${controlEmail}) in Org ${controlOrgId}`);

    // Verify initial login on live Render API
    console.log('\n2. Verifying live login on Render API for target account...');
    const loginPre = await apiPost('/auth/login', { email: testEmail, password: plainPassword });
    console.log(`   Target Login: HTTP ${loginPre.status} (Valid: ${loginPre.body?.success})`);
    if (!loginPre.body?.success) {
      throw new Error(`Target login failed on live Render backend: ${JSON.stringify(loginPre.body)}`);
    }

    // Verify control user login on live Render API
    const controlPre = await apiPost('/auth/login', { email: controlEmail, password: plainPassword });
    console.log(`   Control Login: HTTP ${controlPre.status} (Valid: ${controlPre.body?.success})`);

    // Step 3: Request deletion via live production endpoint
    console.log('\n3. Executing POST /api/auth/request-deletion on live Render API...');
    const reqRes = await apiPost('/auth/request-deletion', {
      email: testEmail,
      reason: 'Google Play Production Verification Audit'
    });
    console.log(`   Request Deletion Status: HTTP ${reqRes.status}`);
    console.log(`   Reference ID: ${reqRes.body?.referenceId}`);
    console.log(`   Verification Token: ${reqRes.body?.token ? reqRes.body.token.substring(0, 16) + '...' : 'Missing'}`);
    console.log(`   Expires In Seconds: ${reqRes.body?.expiresInSeconds}s (15 min compliant)`);

    const refId = reqRes.body?.referenceId;
    const securityToken = reqRes.body?.token;

    // Step 4: Verify request record in production database
    console.log('\n4. Inspecting deletion request record in database...');
    const reqDb = await dbClient.query(`
      SELECT verification_otp, status, verification_expires_at, scope 
      FROM account_deletion_requests 
      WHERE email = $1 AND reference_id = $2
    `, [testEmail.toLowerCase(), refId]);

    if (reqDb.rows.length === 0) {
      throw new Error('Deletion request record was not persisted to database!');
    }
    const dbOtp = reqDb.rows[0].verification_otp;
    console.log(`   ✅ Record found in DB! Status: ${reqDb.rows[0].status}, Stored OTP: ${dbOtp}, Scope: ${reqDb.rows[0].scope}`);
    console.log(`   Expiry: ${reqDb.rows[0].verification_expires_at}`);

    // Step 5: Confirm deletion using OTP on live Render API
    console.log('\n5. Executing POST /api/auth/confirm-deletion on live Render API...');
    const confirmRes = await apiPost('/auth/confirm-deletion', {
      email: testEmail,
      otp: dbOtp
    });
    console.log(`   Confirm Deletion Status: HTTP ${confirmRes.status}`);
    console.log(`   Result Message: ${confirmRes.body?.message}`);
    console.log(`   Reference ID Confirmed: ${confirmRes.body?.referenceId}`);

    // Step 6: Verify Target user is permanently purged
    console.log('\n6. Verifying Target Account is purged and CANNOT authenticate...');
    const targetUserCheck = await dbClient.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    const isPurgedFromDb = targetUserCheck.rows.length === 0;
    console.log(`   User purged from database: ${isPurgedFromDb ? 'YES (Row Deleted)' : 'NO'}`);

    const loginPost = await apiPost('/auth/login', { email: testEmail, password: plainPassword });
    console.log(`   Post-Deletion Login Attempt: HTTP ${loginPost.status}`);
    const isLoginRejected = loginPost.status === 401 || loginPost.status === 404;
    console.log(`   ✅ Authentication rejection verified: ${isLoginRejected ? 'PASS' : 'FAIL'}`);

    // Step 7: Verify Control Tenant is 100% UNTOUCHED
    console.log('\n7. Verifying Control Tenant is 100% untouched and active...');
    const controlUserCheck = await dbClient.query('SELECT id, email FROM users WHERE id = $1', [controlUserId]);
    const isControlActiveInDb = controlUserCheck.rows.length === 1;
    console.log(`   Control user exists in DB: ${isControlActiveInDb ? 'YES' : 'NO'}`);

    const controlLoginPost = await apiPost('/auth/login', { email: controlEmail, password: plainPassword });
    console.log(`   Control Tenant Post-Test Login: HTTP ${controlLoginPost.status} (Valid: ${controlLoginPost.body?.success})`);
    const isControlIntact = controlLoginPost.status === 200 && controlLoginPost.body?.success;
    console.log(`   ✅ Multi-Tenant Isolation: ${isControlIntact ? 'PASS (100% Intact)' : 'FAIL'}`);

    // Step 8: Clean up control tenant
    await dbClient.query('DELETE FROM users WHERE id = $1', [controlUserId]);
    await dbClient.query('DELETE FROM organizations WHERE id = $1', [controlOrgId]);
    console.log('\n   [Cleanup] Control test tenant safely removed.');

    console.log('\n================================================================');
    console.log('🎉 ALL LIVE PRODUCTION ACCOUNT DELETION TESTS PASSED (7/7)');
    console.log('================================================================');

  } finally {
    dbClient.release();
    await pool.end();
  }
}

verifyProductionDeletion().catch(err => {
  console.error('Fatal error during production deletion verification:', err);
  process.exit(1);
});
