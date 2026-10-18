const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./config/database');
const app = require('./app');
const InvitationModel = require('./models/invitationModel');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const subscriptionService = require('./services/subscriptionService');

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: data };
}

async function runTests() {
  console.log('--- STARTING INVITATION ACCEPTANCE TEST SUITE ---\n');
  await startServer();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // Setup test organizations
  const ts = Date.now();
  const orgA = await OrganizationModel.create({
    name: `Org Alpha ${ts}`,
    plan: 'starter'
  });
  const orgB = await OrganizationModel.create({
    name: `Org Beta ${ts}`,
    plan: 'growth'
  });

  const adminA = await UserModel.create({
    name: `Admin A`,
    email: `adminA_${ts}@test.com`,
    password_hash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    organization_id: orgA.id,
    status: 'active'
  });

  const adminB = await UserModel.create({
    name: `Admin B`,
    email: `adminB_${ts}@test.com`,
    password_hash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    organization_id: orgB.id,
    status: 'active'
  });

  // Test 1: UUID vs VARCHAR operator mismatch regression
  await test('1. UUID vs VARCHAR query does not throw operator does not exist: uuid = character varying', async () => {
    // Both with invalid token and valid token
    const res = await request('/api/auth/invite/non_existent_token_123');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error?.code, 'INVITATION_NOT_FOUND');
    // Ensure no raw SQL or operator error is leaked
    assert(!JSON.stringify(res.body).includes('operator does not exist'));
  });

  // Test 2: Valid invitation creation and inspection
  let inviteA;
  let rawTokenA;
  await test('2. Create valid pending invitation and retrieve details via /api/auth/invite/:token', async () => {
    const emailA = `invitee_a_${ts}@test.com`;
    const res = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgA.id,
      invitedBy: adminA.id,
      email: emailA,
      role: 'analyst'
    });
    inviteA = res.invitation;
    rawTokenA = res.rawToken;

    const detailsRes = await request(`/api/auth/invite/${rawTokenA}`);
    assert.strictEqual(detailsRes.status, 200);
    assert.strictEqual(detailsRes.body.success, true);
    assert.strictEqual(detailsRes.body.invitation.email, emailA.toLowerCase());
    assert.strictEqual(detailsRes.body.invitation.role, 'analyst');
    assert.strictEqual(detailsRes.body.invitation.organizationName, orgA.name);
    assert.strictEqual(detailsRes.body.invitation.organization_name, orgA.name);
    assert.strictEqual(detailsRes.body.invitation.isExistingUser, false);
  });

  // Test 3: Expired invitation returns structured INVITATION_EXPIRED
  await test('3. Expired invitation returns 400 with code INVITATION_EXPIRED', async () => {
    const expiredEmail = `expired_${ts}@test.com`;
    const res = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgA.id,
      invitedBy: adminA.id,
      email: expiredEmail,
      role: 'viewer'
    });
    // Manually expire in DB
    await db.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id::text = $1::text`, [res.invitation.id]);

    const detailsRes = await request(`/api/auth/invite/${res.rawToken}`);
    assert.strictEqual(detailsRes.status, 400);
    assert.strictEqual(detailsRes.body.error?.code, 'INVITATION_EXPIRED');

    const acceptRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token: res.rawToken, name: 'Expired User', password: 'password123' })
    });
    assert.strictEqual(acceptRes.status, 400);
    assert.strictEqual(acceptRes.body.error?.code, 'INVITATION_EXPIRED');
  });

  // Test 4: Revoked invitation returns structured INVITATION_REVOKED
  await test('4. Revoked invitation returns 400 with code INVITATION_REVOKED', async () => {
    const revokeEmail = `revoked_${ts}@test.com`;
    const res = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgA.id,
      invitedBy: adminA.id,
      email: revokeEmail,
      role: 'viewer'
    });
    await InvitationModel.revoke(res.invitation.id, orgA.id);

    const detailsRes = await request(`/api/auth/invite/${res.rawToken}`);
    assert.strictEqual(detailsRes.status, 400);
    assert.strictEqual(detailsRes.body.error?.code, 'INVITATION_REVOKED');

    const acceptRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token: res.rawToken, name: 'Revoked User', password: 'password123' })
    });
    assert.strictEqual(acceptRes.status, 400);
    assert.strictEqual(acceptRes.body.error?.code, 'INVITATION_REVOKED');
  });

  // Test 5: Successful new user acceptance and organization assignment
  await test('5. Successful new user acceptance assigns exact organization and role in transaction', async () => {
    const acceptRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: rawTokenA,
        name: 'Analyst Jane',
        password: 'securePassword123'
      })
    });

    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.success, true);
    assert(acceptRes.body.token, 'Must return signed auth token');
    assert.strictEqual(acceptRes.body.user.role, 'analyst');
    assert.strictEqual(String(acceptRes.body.user.organization_id), String(orgA.id));

    // Verify invitation is marked accepted
    const checkInvite = await db.query('SELECT status, accepted_at FROM invitations WHERE id::text = $1::text', [inviteA.id]);
    assert.strictEqual(checkInvite.rows[0].status, 'accepted');
    assert(checkInvite.rows[0].accepted_at !== null, 'accepted_at must be populated');

    // Verify user in DB has email_verified_at set and role analyst
    const checkUser = await UserModel.findByEmail(inviteA.email);
    assert(checkUser !== null, 'User must exist in users table');
    assert.strictEqual(checkUser.role, 'analyst');
    assert.strictEqual(String(checkUser.organization_id), String(orgA.id));
    assert(checkUser.email_verified_at !== null, 'Email must be marked verified');
  });

  // Test 6: Token Replay / Reuse prevention
  await test('6. Reused token returns 400 with code INVITATION_ALREADY_USED', async () => {
    const acceptRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: rawTokenA,
        name: 'Replay Attacker',
        password: 'securePassword123'
      })
    });

    assert.strictEqual(acceptRes.status, 400);
    assert.strictEqual(acceptRes.body.error?.code, 'INVITATION_ALREADY_USED');
  });

  // Test 7: Strict Organization Isolation & Immunity to Client Manipulation
  await test('7. Client cannot tamper with organization_id or role (invitation record is sole authority)', async () => {
    const emailB = `invitee_b_${ts}@test.com`;
    const resB = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgB.id,
      invitedBy: adminB.id,
      email: emailB,
      role: 'viewer'
    });

    // Malicious client attempts to pass role: 'admin' and organizationId: orgA.id
    const acceptTamper = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: resB.rawToken,
        name: 'Tamper Tester',
        password: 'password123',
        role: 'owner',
        organization_id: orgA.id,
        organizationId: orgA.id
      })
    });

    assert.strictEqual(acceptTamper.status, 200);
    // Must be assigned to orgB (NOT orgA) and role 'viewer' (NOT 'owner')
    assert.strictEqual(String(acceptTamper.body.user.organization_id), String(orgB.id));
    assert.strictEqual(acceptTamper.body.user.role, 'viewer');

    const dbUser = await UserModel.findByEmail(emailB);
    assert.strictEqual(String(dbUser.organization_id), String(orgB.id));
    assert.strictEqual(dbUser.role, 'viewer');
  });

  // Test 8: Existing user acceptance with password ownership verification
  await test('8. Existing user must verify password before joining new organization', async () => {
    // Create an existing standalone analyst in orgA
    const existingEmail = `existing_analyst_${ts}@test.com`;
    const existingUser = await UserModel.create({
      name: 'Existing Analyst',
      email: existingEmail,
      password_hash: await bcrypt.hash('secretPass456', 10),
      role: 'analyst',
      organization_id: orgA.id,
      status: 'active'
    });

    // Invite existing user to orgB
    const resMigrate = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgB.id,
      invitedBy: adminB.id,
      email: existingEmail,
      role: 'manager'
    });

    // 1. Wrong password fails with INVALID_CREDENTIALS
    const failRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: resMigrate.rawToken,
        password: 'wrongPassword'
      })
    });
    assert.strictEqual(failRes.status, 401);
    assert.strictEqual(failRes.body.error?.code, 'INVALID_CREDENTIALS');

    // 2. Correct password migrates user to orgB with manager role
    const okRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: resMigrate.rawToken,
        password: 'secretPass456'
      })
    });
    assert.strictEqual(okRes.status, 200);
    assert.strictEqual(String(okRes.body.user.organization_id), String(orgB.id));
    assert.strictEqual(okRes.body.user.role, 'manager');
  });

  // Test 9: Organization Owner preservation
  await test('9. An organization owner cannot be reassigned away from their organization via invite', async () => {
    const ownerEmail = `owner_locked_${ts}@test.com`;
    await UserModel.create({
      name: 'Owner Locked',
      email: ownerEmail,
      password_hash: await bcrypt.hash('ownerPass789', 10),
      role: 'owner',
      organization_id: orgA.id,
      status: 'active'
    });

    // OrgB attempts to invite OrgA's owner
    const resHijack = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgB.id,
      invitedBy: adminB.id,
      email: ownerEmail,
      role: 'analyst'
    });

    const hijackRes = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: resHijack.rawToken,
        password: 'ownerPass789'
      })
    });

    assert.strictEqual(hijackRes.status, 403);
    assert.strictEqual(hijackRes.body.error?.code, 'OWNER_CANNOT_TRANSFER');

    // Verify OrgA owner remains intact
    const verifyOwner = await UserModel.findByEmail(ownerEmail);
    assert.strictEqual(String(verifyOwner.organization_id), String(orgA.id));
    assert.strictEqual(verifyOwner.role, 'owner');
  });

  // Test 10: Seat calculation consistency
  await test('10. Seat calculation reflects accepted and pending counts accurately', async () => {
    const usageB = await subscriptionService.getOrganizationUsage(orgB.id);
    assert(usageB.users.count > 0, 'Total seats count must be > 0');
    assert(usageB.users.membersCount >= 2, 'Members count must include admin and accepted members');
  });

  // Cleanup test server
  server.close();

  console.log(`\n===========================================`);
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
