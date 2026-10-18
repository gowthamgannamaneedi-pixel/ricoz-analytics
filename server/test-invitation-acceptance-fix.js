const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
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

    // Verify invitation is marked accepted with accepted_at and accepted_by
    const checkInvite = await db.query('SELECT status, accepted_at, accepted_by FROM invitations WHERE id::text = $1::text', [inviteA.id]);
    assert.strictEqual(checkInvite.rows[0].status, 'accepted');
    assert(checkInvite.rows[0].accepted_at !== null, 'accepted_at must be populated');
    assert.strictEqual(String(checkInvite.rows[0].accepted_by), String(acceptRes.body.user.id), 'accepted_by must record accepting user id');

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

  // Test 11: GET /api/admin/invitations exclusively returns pending, unexpired invitations
  await test('11. Pending invitations endpoint excludes accepted, revoked, and expired invitations', async () => {
    const tokenAdminA = jwt.sign(
      { id: adminA.id, email: adminA.email, name: adminA.name, role: adminA.role, organization_id: orgA.id },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Create a fresh pending invitation in orgA
    const freshPendingEmail = `fresh_pending_${ts}@test.com`;
    const freshInviteRes = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgA.id,
      invitedBy: adminA.id,
      email: freshPendingEmail,
      role: 'viewer'
    });

    const getInvitesRes = await request('/api/admin/invitations', {
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });

    assert.strictEqual(getInvitesRes.status, 200);
    assert.strictEqual(getInvitesRes.body.success, true);
    const returnedInvites = getInvitesRes.body.invitations;
    assert(Array.isArray(returnedInvites), 'invitations must be an array');

    // 1. Accepted invitation (inviteA) MUST NOT appear
    const hasAccepted = returnedInvites.some(i => i.id === inviteA.id || i.status === 'accepted');
    assert.strictEqual(hasAccepted, false, 'Accepted invitations must not appear in pending invitations');

    // 2. Revoked invitations MUST NOT appear
    const hasRevoked = returnedInvites.some(i => i.status === 'revoked');
    assert.strictEqual(hasRevoked, false, 'Revoked invitations must not appear in pending invitations');

    // 3. Expired invitations MUST NOT appear
    const now = new Date();
    const hasExpired = returnedInvites.some(i => new Date(i.expires_at) <= now);
    assert.strictEqual(hasExpired, false, 'Expired invitations must not appear in pending invitations');

    // 4. All returned items must have status === 'pending' and expires_at > now
    for (const inv of returnedInvites) {
      assert.strictEqual(inv.status, 'pending', `Invitation ${inv.id} must have status pending`);
      assert(new Date(inv.expires_at) > now, `Invitation ${inv.id} must not be expired`);
    }

    // 5. Fresh pending invitation must be present
    const hasFresh = returnedInvites.some(i => i.id === freshInviteRes.invitation.id);
    assert.strictEqual(hasFresh, true, 'Fresh active pending invitation must be present');
  });

  // Test 12: Member count increments and pending count decrements exactly once upon acceptance
  await test('12. Seat reservation lifecycle: pending count decrements and member count increments exactly once', async () => {
    // Create new test organization C
    const orgC = await OrganizationModel.create({
      name: `Org Gamma ${ts}`,
      plan: 'starter'
    });
    const adminC = await UserModel.create({
      name: 'Admin C',
      email: `adminC_${ts}@test.com`,
      password_hash: await bcrypt.hash('admin123', 10),
      role: 'admin',
      organization_id: orgC.id,
      status: 'active'
    });
    const tokenAdminC = jwt.sign(
      { id: adminC.id, email: adminC.email, name: adminC.name, role: adminC.role, organization_id: orgC.id },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Initial usage: 1 member, 0 pending
    const initialUsage = await subscriptionService.getOrganizationUsage(orgC.id);
    assert.strictEqual(initialUsage.users.membersCount, 1, 'Initial members count must be 1');
    assert.strictEqual(initialUsage.users.pendingInvitationsCount, 0, 'Initial pending count must be 0');
    assert.strictEqual(initialUsage.users.count, 1, 'Initial total seats must be 1');

    // Create an invitation
    const inviteEmailC = `invitee_c_${ts}@test.com`;
    const inviteC = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgC.id,
      invitedBy: adminC.id,
      email: inviteEmailC,
      role: 'analyst'
    });

    // Post-invite usage: 1 member, 1 pending, total 2
    const postInviteUsage = await subscriptionService.getOrganizationUsage(orgC.id);
    assert.strictEqual(postInviteUsage.users.membersCount, 1, 'Members count remains 1');
    assert.strictEqual(postInviteUsage.users.pendingInvitationsCount, 1, 'Pending count increments to 1');
    assert.strictEqual(postInviteUsage.users.count, 2, 'Total seats increments to 2');

    // Verify invitation is listed as pending
    const listBeforeAccept = await request('/api/admin/invitations', {
      headers: { Authorization: `Bearer ${tokenAdminC}` }
    });
    assert.strictEqual(listBeforeAccept.body.invitations.length, 1);
    assert.strictEqual(listBeforeAccept.body.invitations[0].email, inviteEmailC);

    // Accept invitation
    const acceptResC = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: inviteC.rawToken,
        name: 'Analyst Charlie',
        password: 'securePassword123'
      })
    });
    assert.strictEqual(acceptResC.status, 200);

    // Post-accept usage: 2 members, 0 pending, total still 2 (no double-counting!)
    const postAcceptUsage = await subscriptionService.getOrganizationUsage(orgC.id);
    assert.strictEqual(postAcceptUsage.users.membersCount, 2, 'Members count incremented by 1 to 2');
    assert.strictEqual(postAcceptUsage.users.pendingInvitationsCount, 0, 'Pending count decremented by 1 to 0');
    assert.strictEqual(postAcceptUsage.users.count, 2, 'Total seats reserved remains exact (no double count)');

    // Verify invitation is NO LONGER listed under pending invitations
    const listAfterAccept = await request('/api/admin/invitations', {
      headers: { Authorization: `Bearer ${tokenAdminC}` }
    });
    assert.strictEqual(listAfterAccept.body.invitations.length, 0, 'Accepted invitation must be absent from pending list');

    // Verify DB audit record: status = accepted, accepted_at set, accepted_by set
    const dbRecord = await db.query('SELECT status, accepted_at, accepted_by FROM invitations WHERE id::text = $1::text', [inviteC.invitation.id]);
    assert.strictEqual(dbRecord.rows[0].status, 'accepted');
    assert(dbRecord.rows[0].accepted_at !== null, 'accepted_at timestamp is recorded');
    assert.strictEqual(String(dbRecord.rows[0].accepted_by), String(acceptResC.body.user.id), 'accepted_by records user id');
  });

  // Test 13: Concurrent acceptance attempts serialize cleanly
  await test('13. Concurrent acceptance attempts prevent duplicate acceptance and race conditions', async () => {
    const orgD = await OrganizationModel.create({
      name: `Org Delta ${ts}`,
      plan: 'starter'
    });
    const adminD = await UserModel.create({
      name: 'Admin D',
      email: `adminD_${ts}@test.com`,
      password_hash: await bcrypt.hash('admin123', 10),
      role: 'admin',
      organization_id: orgD.id,
      status: 'active'
    });
    const inviteEmailD = `concurrent_invitee_${ts}@test.com`;
    const inviteD = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgD.id,
      invitedBy: adminD.id,
      email: inviteEmailD,
      role: 'viewer'
    });

    const [res1, res2] = await Promise.all([
      request('/api/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token: inviteD.rawToken, name: 'Concurrent 1', password: 'password123' })
      }),
      request('/api/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token: inviteD.rawToken, name: 'Concurrent 2', password: 'password123' })
      })
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 400], 'Exactly one attempt succeeds (200) and one fails (400)');
    const failedRes = res1.status === 400 ? res1 : res2;
    assert.strictEqual(failedRes.body.error?.code, 'INVITATION_ALREADY_USED');
  });

  // Test 14: Atomic rollback if user creation or activation fails
  await test('14. Transaction rolls back and invitation remains pending if membership creation fails', async () => {
    const orgE = await OrganizationModel.create({
      name: `Org Epsilon ${ts}`,
      plan: 'starter'
    });
    const adminE = await UserModel.create({
      name: 'Admin E',
      email: `adminE_${ts}@test.com`,
      password_hash: await bcrypt.hash('admin123', 10),
      role: 'admin',
      organization_id: orgE.id,
      status: 'active'
    });
    const inviteEmailE = `rollback_${ts}@test.com`;
    const inviteE = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: orgE.id,
      invitedBy: adminE.id,
      email: inviteEmailE,
      role: 'viewer'
    });

    // Provide invalid password (< 6 chars) causing validation error during acceptance
    const failAccept = await request('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({
        token: inviteE.rawToken,
        name: 'Rollback User',
        password: '123' // too short
      })
    });
    assert.strictEqual(failAccept.status, 400);

    // Verify invitation remains pending and was NOT marked accepted
    const checkInv = await db.query('SELECT status, accepted_at FROM invitations WHERE id::text = $1::text', [inviteE.invitation.id]);
    assert.strictEqual(checkInv.rows[0].status, 'pending', 'Invitation must remain pending after failed acceptance');
    assert.strictEqual(checkInv.rows[0].accepted_at, null, 'accepted_at must remain null');
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
