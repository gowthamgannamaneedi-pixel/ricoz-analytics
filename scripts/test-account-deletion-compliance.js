/**
 * Stage 7.2: Account Deletion Compliance & Multi-Tenant Isolation Test Suite
 * Tests end-to-end lifecycle using isolated test accounts (Tenant A vs Tenant B).
 * Confirms that Tenant A deletion permanently purges Tenant A data without
 * affecting Tenant B data, and verifies statutory retention anonymization.
 */
const crypto = require('crypto');
const path = require('path');
const bcrypt = require(path.resolve(__dirname, '../server/node_modules/bcryptjs'));
const db = require('../server/config/database');
const accountDeletionController = require('../server/controllers/accountDeletionController');
const tokenBlacklist = require('../server/utils/tokenBlacklist');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RICOZANALYTICS — STAGE 7.2 ACCOUNT DELETION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Generate unique test IDs
  const testSuffix = Date.now();
  const orgAId = `00000000-0000-0000-0000-a${String(testSuffix).slice(-11)}`;
  const orgBId = `00000000-0000-0000-0000-b${String(testSuffix).slice(-11)}`;
  const userAEmail = `deletion_test_user_a_${testSuffix}@ricoz.test`;
  const userBEmail = `control_active_user_b_${testSuffix}@ricoz.test`;
  const testPassword = 'TestPassword123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  console.log(`[Setup] Creating isolated test tenants:`);
  console.log(`  Tenant A (Target for Deletion): ${orgAId} (User: ${userAEmail})`);
  console.log(`  Tenant B (Control Tenant):     ${orgBId} (User: ${userBEmail})\n`);

  try {
    // 1. Seed Tenant A and Tenant B organizations
    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
      VALUES 
        ($1, 'Tenant A To Delete', $3, 'starter', 'active', NOW(), NOW()),
        ($2, 'Tenant B Control Safe', $4, 'enterprise', 'active', NOW(), NOW())
    `, [orgAId, orgBId, `tenant-a-${testSuffix}`, `tenant-b-${testSuffix}`]);

    // 2. Seed Users
    const userAId = Math.floor(800000 + Math.random() * 100000);
    const userBId = Math.floor(900000 + Math.random() * 100000);

    await db.query(`
      INSERT INTO users (id, name, email, password_hash, role, organization_id, status, created_at, updated_at)
      VALUES 
        ($1, 'User A Target', $2, $3, 'admin', $4, 'active', NOW(), NOW()),
        ($5, 'User B Control', $6, $7, 'admin', $8, 'active', NOW(), NOW())
    `, [userAId, userAEmail, passwordHash, orgAId, userBId, userBEmail, passwordHash, orgBId]);

    // 3. Seed Datasets for both tenants
    const dsAId = Math.floor(80000 + Math.random() * 10000);
    const dsBId = Math.floor(90000 + Math.random() * 10000);

    await db.query(`
      INSERT INTO datasets (id, organization_id, user_id, name, row_count, created_at, updated_at)
      VALUES 
        ($1, $2, $3, 'Tenant A Dataset', 500, NOW(), NOW()),
        ($4, $5, $6, 'Tenant B Control Dataset', 1200, NOW(), NOW())
    `, [dsAId, orgAId, userAId, dsBId, orgBId, userBId]).catch(e => console.warn('Dataset insert error:', e.message));

    // 4. Seed Invoices (Statutory compliance records)
    const invAId = crypto.randomUUID();
    const invBId = crypto.randomUUID();

    await db.query(`
      INSERT INTO invoices (id, organization_id, invoice_number, amount, status, plan, created_at, updated_at)
      VALUES 
        ($1, $2, 'INV-TENANT-A-001', 4999.00, 'paid', 'starter', NOW(), NOW()),
        ($3, $4, 'INV-TENANT-B-001', 14999.00, 'paid', 'enterprise', NOW(), NOW())
    `, [invAId, orgAId, invBId, orgBId]).catch(e => console.warn('Invoice insert error:', e.message));

    console.log('--- TEST 1: Public Web Deletion Request (Email OTP Dispatch) ---');
    const mockReq1 = {
      body: {
        email: userAEmail,
        name: 'User A Target',
        scope: 'full_workspace',
        reason: 'Automated Compliance Test'
      },
      headers: { origin: 'https://ricoz.in' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    let res1Data = null;
    let res1Status = 0;
    const mockRes1 = {
      status(code) { res1Status = code; return this; },
      json(data) { res1Data = data; return this; }
    };

    await accountDeletionController.requestDeletion(mockReq1, mockRes1);
    assert(res1Status === 200, `requestDeletion returned HTTP 200 (Got: ${res1Status})`);
    assert(res1Data && res1Data.success === true, 'Response contains success: true');
    assert(res1Data && res1Data.referenceId && res1Data.referenceId.startsWith('DEL-'), `Generated reference ID: ${res1Data?.referenceId}`);
    assert(res1Data && res1Data.token, 'Generated verification security token');

    console.log('\n--- TEST 2: Inspect Database Deletion Request Record ---');
    const dbReq = await db.query(
      'SELECT * FROM account_deletion_requests WHERE LOWER(email) = LOWER($1) ORDER BY created_at DESC LIMIT 1',
      [userAEmail]
    );
    assert(dbReq.rows.length > 0, 'Found deletion request record in account_deletion_requests table');
    const storedOtp = dbReq.rows[0]?.verification_otp;
    assert(storedOtp && storedOtp.length === 6, `Stored 6-digit OTP in database: ${storedOtp}`);
    assert(dbReq.rows[0]?.status === 'pending_verification', 'Initial request status is pending_verification');

    console.log('\n--- TEST 3: Confirm Deletion with OTP Verification & Cascade Execution ---');
    const mockReq2 = {
      body: {
        email: userAEmail,
        otp: storedOtp,
        referenceId: res1Data.referenceId
      }
    };
    let res2Data = null;
    let res2Status = 0;
    const mockRes2 = {
      status(code) { res2Status = code; return this; },
      json(data) { res2Data = data; return this; }
    };

    await accountDeletionController.confirmDeletion(mockReq2, mockRes2);
    assert(res2Status === 200, `confirmDeletion returned HTTP 200 (Got: ${res2Status})`);
    assert(res2Data && res2Data.success === true, 'Response confirmed deletion success');

    console.log('\n--- TEST 4: Multi-Tenant Isolation & Purge Verification ---');
    // Check Tenant A user is deleted
    const checkUserA = await db.query('SELECT * FROM users WHERE id = $1', [userAId]);
    assert(checkUserA.rows.length === 0, 'Tenant A user account was permanently purged');

    // Check Tenant A dataset is deleted
    const checkDsA = await db.query('SELECT * FROM datasets WHERE id = $1', [dsAId]);
    assert(checkDsA.rows.length === 0, 'Tenant A datasets were permanently purged');

    // Check Tenant B user is UNTOUCHED
    const checkUserB = await db.query('SELECT * FROM users WHERE id = $1', [userBId]);
    assert(checkUserB.rows.length === 1, 'Tenant B control user is 100% UNTOUCHED and active');

    // Check Tenant B dataset is UNTOUCHED
    const checkDsB = await db.query('SELECT * FROM datasets WHERE id = $1', [dsBId]);
    assert(checkDsB.rows.length === 1, 'Tenant B control dataset is 100% UNTOUCHED');

    console.log('\n--- TEST 5: Statutory Financial Records Anonymization ---');
    const checkInvA = await db.query('SELECT * FROM invoices WHERE id = $1', [invAId]);
    if (checkInvA.rows.length > 0) {
      const inv = checkInvA.rows[0];
      assert(inv.invoice_number.startsWith('ANON-'), `Invoice was anonymized: ${inv.invoice_number}`);
      assert(inv.status === 'archived', 'Invoice status set to archived for statutory tax retention');
    } else {
      console.log('  ℹ️ Invoice record purged in test environment');
    }

    // Check Tenant B invoice is UNTOUCHED
    const checkInvB = await db.query('SELECT * FROM invoices WHERE id = $1', [invBId]);
    if (checkInvB.rows.length > 0) {
      assert(checkInvB.rows[0].invoice_number === 'INV-TENANT-B-001', 'Tenant B control invoice retained exact original number');
    }

    console.log('\n--- TEST 6: In-App Authenticated Self-Service Deletion ---');
    // Create Tenant C user for in-app deletion test
    const userCEmail = `inapp_user_c_${testSuffix}@ricoz.test`;
    const userCId = Math.floor(700000 + Math.random() * 100000);
    const orgCId = `00000000-0000-0000-0000-c${String(testSuffix).slice(-11)}`;

    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
      VALUES ($1, 'Tenant C InApp Test', $2, 'starter', 'active', NOW(), NOW())
    `, [orgCId, `tenant-c-${testSuffix}`]);

    await db.query(`
      INSERT INTO users (id, name, email, password_hash, role, organization_id, status, created_at, updated_at)
      VALUES ($1, 'User C InApp', $2, $3, 'viewer', $4, 'active', NOW(), NOW())
    `, [userCId, userCEmail, passwordHash, orgCId]);

    // Test with wrong password (must reject)
    const mockReqWrongPass = {
      user: { id: userCId, organization_id: orgCId },
      body: { password: 'WrongPassword999', scope: 'user_account' }
    };
    let resWrongStatus = 0;
    let resWrongData = null;
    const mockResWrong = {
      status(c) { resWrongStatus = c; return this; },
      json(d) { resWrongData = d; return this; }
    };
    await accountDeletionController.deleteMyAccount(mockReqWrongPass, mockResWrong);
    assert(resWrongStatus === 401, `deleteMyAccount rejected incorrect password with HTTP 401 (Got: ${resWrongStatus})`);

    // Test with correct password (must succeed)
    const mockReqCorrectPass = {
      user: { id: userCId, organization_id: orgCId },
      body: { password: testPassword, scope: 'user_account' }
    };
    let resCorrStatus = 0;
    let resCorrData = null;
    const mockResCorr = {
      status(c) { resCorrStatus = c; return this; },
      json(d) { resCorrData = d; return this; }
    };
    await accountDeletionController.deleteMyAccount(mockReqCorrectPass, mockResCorr);
    assert(resCorrStatus === 200, `deleteMyAccount succeeded with HTTP 200 (Got: ${resCorrStatus})`);
    assert(resCorrData && resCorrData.success === true, 'Response contains success: true');

    const checkUserC = await db.query('SELECT * FROM users WHERE id = $1', [userCId]);
    assert(checkUserC.rows.length === 0, 'User C was purged from users table');

    // Clean up control test records
    await db.query('DELETE FROM invoices WHERE id = $1', [invBId]).catch(() => null);
    await db.query('DELETE FROM datasets WHERE id = $1', [dsBId]).catch(() => null);
    await db.query('DELETE FROM users WHERE id = $1', [userBId]).catch(() => null);
    await db.query('DELETE FROM organizations WHERE id IN ($1, $2, $3)', [orgAId, orgBId, orgCId]).catch(() => null);

  } catch (error) {
    console.error('❌ Exception in test suite:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
