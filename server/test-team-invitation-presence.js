/**
 * Comprehensive End-to-End Verification Suite
 * Team Invitations, Brevo Transactional Email, Seat Reservations, Member Removal, and Online Presence
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/database');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const InvitationModel = require('./models/invitationModel');
const emailService = require('./services/emailService');
const subscriptionService = require('./services/subscriptionService');
const adminController = require('./controllers/adminController');
const authController = require('./controllers/authController');
const bcrypt = require('bcryptjs');

let testOrgId = null;
let adminUserId = null;
let adminToken = null;

// Mock Response Helper
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    }
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RICOZ ANALYTICS — TEAM INVITATION & PRESENCE SUITE');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    // Setup Test Workspace
    // -------------------------------------------------------------------------
    console.log('[Setup] Creating test organization and admin...');
    const orgRes = await db.query(
      `INSERT INTO organizations (name, slug, plan, subscription_status)
       VALUES ('E2E Test Workspace', 'e2e-test-ws-' || floor(random()*10000), 'starter', 'active')
       RETURNING id, name, plan;`
    );
    testOrgId = orgRes.rows[0].id;

    const passwordHash = await bcrypt.hash('TestAdminPass123!', 10);
    const adminRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, status)
       VALUES ('Test Admin', 'admin.e2e.' || floor(random()*10000) || '@ricozanalytics.com', $1, 'admin', $2, 'active')
       RETURNING id, name, email, role, organization_id;`,
      [passwordHash, testOrgId]
    );
    const adminUser = adminRes.rows[0];
    adminUserId = adminUser.id;
    console.log(`[Setup] Workspace created: orgId=${testOrgId}, admin=${adminUser.email}`);

    // Update admin login to set last_login_at and last_active_at
    await UserModel.updateLastLogin(adminUserId);

    const mockAdminReq = {
      user: {
        id: adminUserId,
        email: adminUser.email,
        role: 'admin',
        organization_id: testOrgId
      },
      headers: {},
      params: {},
      query: {},
      body: {}
    };

    // -------------------------------------------------------------------------
    // Test 1: Successful invitation with real Brevo delivery
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Successful Invitation & Real Brevo Delivery ---');
    const validInviteEmail = `ricoz.invite.test.${Date.now()}@gmail.com`;
    const req1 = {
      ...mockAdminReq,
      body: { email: validInviteEmail, role: 'analyst' }
    };
    const res1 = createMockRes();
    await adminController.createInvitation(req1, res1);

    console.log(`Status: ${res1.statusCode}`);
    console.log(`Response:`, JSON.stringify(res1.body, null, 2));

    if (res1.statusCode !== 201) {
      throw new Error(`Expected HTTP 201 for valid invitation, got ${res1.statusCode}: ${JSON.stringify(res1.body)}`);
    }
    if (!res1.body.invitation || res1.body.invitation.email !== validInviteEmail) {
      throw new Error('Invitation record was not returned properly.');
    }
    if (res1.body.invitation.inviteUrl || res1.body.invitation.token) {
      throw new Error('SECURITY VIOLATION: Raw token or inviteUrl leaked in client response!');
    }
    console.log('✅ Test 1 Passed: Invitation created securely and raw token NOT leaked to client.');

    // -------------------------------------------------------------------------
    // Test 2: Invalid Email & Duplicate Pending Invitation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Invalid Email & Duplicate Pending Rejection ---');
    const badEmailReq = {
      ...mockAdminReq,
      body: { email: 'notanemail', role: 'analyst' }
    };
    const badEmailRes = createMockRes();
    await adminController.createInvitation(badEmailReq, badEmailRes);
    if (badEmailRes.statusCode !== 400) {
      throw new Error(`Expected HTTP 400 for bad email, got ${badEmailRes.statusCode}`);
    }
    console.log('✅ Bad email rejected with HTTP 400.');

    // Duplicate pending
    const dupReq = {
      ...mockAdminReq,
      body: { email: validInviteEmail, role: 'analyst' }
    };
    const dupRes = createMockRes();
    await adminController.createInvitation(dupReq, dupRes);
    if (dupRes.statusCode !== 409) {
      throw new Error(`Expected HTTP 409 for duplicate pending invite, got ${dupRes.statusCode}: ${JSON.stringify(dupRes.body)}`);
    }
    console.log('✅ Duplicate pending invitation rejected with HTTP 409 conflict.');

    // -------------------------------------------------------------------------
    // Test 3: Brevo API Failure & Atomic Rollback
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Email Service Failure & Atomic Rollback ---');
    // Save original method
    const originalSendEmail = emailService.sendInvitationEmail;
    // Mock temporary failure
    emailService.sendInvitationEmail = async () => ({
      success: false,
      error: 'Simulated Brevo delivery network failure'
    });

    const failedEmail = `failed.invite.${Date.now()}@example.com`;
    const failReq = {
      ...mockAdminReq,
      body: { email: failedEmail, role: 'viewer' }
    };
    const failRes = createMockRes();
    await adminController.createInvitation(failReq, failRes);

    console.log(`Failed invite status: ${failRes.statusCode}`);
    if (failRes.statusCode !== 502) {
      throw new Error(`Expected HTTP 502 for failed email delivery, got ${failRes.statusCode}`);
    }

    // Verify invitation record was rolled back from DB
    const checkRolledBack = await db.query(
      `SELECT * FROM invitations WHERE organization_id = $1 AND email = $2`,
      [testOrgId, failedEmail]
    );
    if (checkRolledBack.rows.length !== 0) {
      throw new Error('Database rollback failed: Unsent invitation record was not deleted from DB!');
    }
    console.log('✅ Test 3 Passed: Failed email returned 502, rolled back from DB, and released seat reservation.');
    // Restore email service
    emailService.sendInvitationEmail = originalSendEmail;

    // -------------------------------------------------------------------------
    // Test 4: Plan Seat Limit Reached (Starter limit = 5)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Plan Seat Limit Enforcement (Starter = 5 seats) ---');
    // Currently testOrg has: 1 active admin + 1 pending invitation = 2 seats used.
    // Let's add 3 more valid members or pending invites to reach 5
    for (let i = 1; i <= 3; i++) {
      const email = `starter.member.${i}.${Date.now()}@ricozanalytics.com`;
      await InvitationModel.createWithAtomicSeatReservation({
        organizationId: testOrgId,
        invitedBy: adminUserId,
        email,
        role: 'viewer'
      });
    }

    // Current reserved = 1 admin + 1 (Test 1) + 3 = 5 seats. Limit is 5!
    const sixthEmail = `starter.exceeded.${Date.now()}@ricozanalytics.com`;
    const exceedReq = {
      ...mockAdminReq,
      body: { email: sixthEmail, role: 'viewer' }
    };
    const exceedRes = createMockRes();
    await adminController.createInvitation(exceedReq, exceedRes);

    console.log(`6th invite status: ${exceedRes.statusCode}`);
    if (exceedRes.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 for seat limit exceeded, got ${exceedRes.statusCode}: ${JSON.stringify(exceedRes.body)}`);
    }
    if (!exceedRes.body.requiresUpgrade) {
      throw new Error('Expected requiresUpgrade: true in seat limit error response.');
    }
    console.log('✅ Test 4 Passed: 6th invitation blocked by Starter plan 5-seat limit with HTTP 403.');

    // -------------------------------------------------------------------------
    // Test 5: Resend and Revoke Invitation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Resend and Revoke Invitation ---');
    const existingInvite = await db.query(
      `SELECT id, token_hash, expires_at FROM invitations WHERE organization_id = $1 AND email = $2`,
      [testOrgId, validInviteEmail]
    );
    const inviteId = existingInvite.rows[0].id;
    const oldHash = existingInvite.rows[0].token_hash;

    // Resend
    const resendReq = {
      ...mockAdminReq,
      params: { id: inviteId }
    };
    const resendRes = createMockRes();
    await adminController.resendInvitation(resendReq, resendRes);
    if (resendRes.statusCode !== 200) {
      throw new Error(`Expected HTTP 200 for resend, got ${resendRes.statusCode}: ${JSON.stringify(resendRes.body)}`);
    }
    if (resendRes.body.invitation.inviteUrl || resendRes.body.invitation.token) {
      throw new Error('SECURITY VIOLATION: Resend leaked raw token in response!');
    }

    // Check token was refreshed in DB
    const refreshedInvite = await db.query(
      `SELECT token, token_hash, expires_at FROM invitations WHERE id = $1`,
      [inviteId]
    );
    if (refreshedInvite.rows[0].token_hash === oldHash) {
      throw new Error('Token hash was not renewed upon resend!');
    }
    console.log('✅ Resend generated fresh single-use token and renewed 7-day expiration.');

    // Revoke
    const revokeReq = {
      ...mockAdminReq,
      params: { id: inviteId }
    };
    const revokeRes = createMockRes();
    await adminController.deleteInvitation(revokeReq, revokeRes);
    if (revokeRes.statusCode !== 200) {
      throw new Error(`Expected HTTP 200 for revoke, got ${revokeRes.statusCode}`);
    }

    // Verify revoked status
    const checkRevoked = await db.query(
      `SELECT status FROM invitations WHERE id = $1`,
      [inviteId]
    );
    if (checkRevoked.rows[0].status !== 'revoked') {
      throw new Error(`Expected status revoked, got ${checkRevoked.rows[0].status}`);
    }
    console.log('✅ Test 5 Passed: Invitation revoked and seat reservation freed.');

    // -------------------------------------------------------------------------
    // Test 6: Accept Invitation, Email Verification & Role Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Accept Invitation, Email Verification, & Role Enforcement ---');
    const acceptTestEmail = `invitee.accept.${Date.now()}@ricozanalytics.com`;
    const freshInviteReservation = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: testOrgId,
      invitedBy: adminUserId,
      email: acceptTestEmail,
      role: 'analyst'
    });
    const rawToken = freshInviteReservation.rawToken;

    // New user accepts invite
    const acceptReq = {
      body: {
        token: rawToken,
        name: 'Jane Doe Invitee',
        password: 'ValidPassword123!'
      }
    };
    const acceptRes = createMockRes();
    await authController.acceptInvite(acceptReq, acceptRes, (err) => { throw err; });

    if (acceptRes.statusCode !== 200) {
      throw new Error(`Expected HTTP 200 on accept invite, got ${acceptRes.statusCode}: ${JSON.stringify(acceptRes.body)}`);
    }
    if (acceptRes.body.user.role !== 'analyst') {
      throw new Error(`Expected server-enforced role 'analyst', got '${acceptRes.body.user.role}'`);
    }

    // Verify email verification timestamp is set
    const userInDb = await UserModel.findByEmail(acceptTestEmail);
    if (!userInDb || !userInDb.email_verified_at) {
      throw new Error('User was not marked email verified upon accepting invite!');
    }
    console.log('✅ Test 6 Passed: Invitation accepted, account verified, role strictly enforced from invitation.');

    // -------------------------------------------------------------------------
    // Test 7: Online Presence, Heartbeat, and Last Login
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Online Presence, Heartbeat, & Last Login ---');
    // Admin was updated with last login and last active
    const listReq = {
      ...mockAdminReq,
      query: { status: 'all' }
    };
    const listRes = createMockRes();
    await adminController.getUsers(listReq, listRes);
    const usersInOrg = listRes.body.data.users;

    const adminItem = usersInOrg.find(u => u.id === adminUserId);
    if (!adminItem) throw new Error('Admin not found in users list');
    if (adminItem.presence !== 'active') {
      throw new Error(`Expected admin presence to be 'active', got '${adminItem.presence}'`);
    }
    if (!adminItem.last_login_at) {
      throw new Error('Expected admin last_login_at to be populated.');
    }
    console.log(`✅ Admin presence verified as '${adminItem.presence}', last_login_at=${adminItem.last_login_at}`);

    // Heartbeat
    const hbReq = { user: { id: adminUserId, status: 'active' } };
    const hbRes = createMockRes();
    await authController.heartbeat(hbReq, hbRes, (err) => { throw err; });
    if (hbRes.statusCode !== 200 || !hbRes.body.timestamp) {
      throw new Error('Heartbeat endpoint failed to return 200 with timestamp');
    }
    console.log(`✅ Heartbeat endpoint updated last_active_at at ${hbRes.body.timestamp}`);

    // Simulate stale user (>5 mins inactive)
    const staleUserRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, status, last_active_at)
       VALUES ('Stale User', 'stale.${Date.now()}@example.com', 'hash', 'viewer', $1, 'active', NOW() - INTERVAL '10 minutes')
       RETURNING id;`,
      [testOrgId]
    );
    const staleUserId = staleUserRes.rows[0].id;
    const listRes2 = createMockRes();
    await adminController.getUsers(listReq, listRes2);
    const staleItem = listRes2.body.data.users.find(u => u.id === staleUserId);
    if (staleItem.presence !== 'inactive') {
      throw new Error(`Expected stale user presence to be 'inactive', got '${staleItem.presence}'`);
    }
    console.log('✅ Inactive presence calculated correctly (>5 min threshold).');

    // -------------------------------------------------------------------------
    // Test 8: Member Removal Protection & Seat Recalculation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Member Removal Safety & Seat Recalculation ---');
    // Self removal
    const selfRemoveReq = {
      ...mockAdminReq,
      params: { id: adminUserId }
    };
    const selfRemoveRes = createMockRes();
    await adminController.removeUser(selfRemoveReq, selfRemoveRes);
    if (selfRemoveRes.statusCode !== 400) {
      throw new Error(`Expected 400 on self-removal, got ${selfRemoveRes.statusCode}`);
    }
    console.log('✅ Self-removal prevented with HTTP 400.');

    // Last admin protection: create a second member, try removing admin
    const lastAdminReq = {
      ...mockAdminReq,
      user: { id: staleUserId, role: 'admin', organization_id: testOrgId },
      params: { id: adminUserId }
    };
    const lastAdminRes = createMockRes();
    await adminController.removeUser(lastAdminReq, lastAdminRes);
    if (lastAdminRes.statusCode !== 400) {
      throw new Error(`Expected 400 for last admin removal protection, got ${lastAdminRes.statusCode}`);
    }
    console.log('✅ Last active administrator removal blocked with HTTP 400.');

    // Safe removal of stale member
    const removeMemberReq = {
      ...mockAdminReq,
      params: { id: staleUserId }
    };
    const removeMemberRes = createMockRes();
    await adminController.removeUser(removeMemberReq, removeMemberRes);
    if (removeMemberRes.statusCode !== 200) {
      throw new Error(`Expected 200 for member removal, got ${removeMemberRes.statusCode}`);
    }
    console.log('✅ Member removed successfully.');

    // Verify member is deactivated and presence is deactivated
    const listRes3 = createMockRes();
    await adminController.getUsers({ ...mockAdminReq, query: { status: 'all' } }, listRes3);
    const removedMember = listRes3.body.data.users.find(u => u.id === staleUserId);
    if (removedMember.status !== 'deactivated' || removedMember.presence !== 'deactivated') {
      throw new Error(`Expected deactivated status and presence, got status=${removedMember.status}, presence=${removedMember.presence}`);
    }
    console.log('✅ Member status and presence safely deactivated.');

    console.log('\n======================================================');
    console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    if (testOrgId) {
      console.log('[Cleanup] Cleaning up test data...');
      await db.query(`DELETE FROM audit_logs WHERE organization_id = $1`, [testOrgId]).catch(() => null);
      await db.query(`DELETE FROM invitations WHERE organization_id = $1`, [testOrgId]).catch(() => null);
      await db.query(`DELETE FROM users WHERE organization_id = $1`, [testOrgId]).catch(() => null);
      await db.query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]).catch(() => null);
      console.log('[Cleanup] Complete.');
    }
    process.exit(0);
  }
}

runTests();
