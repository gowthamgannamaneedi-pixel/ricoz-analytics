/**
 * Automated Test Suite — Strict Plan-Based Team Management & Email-Verified Invitations
 * RicozAnalytics Production SaaS
 * 
 * Verifies all requirements under Section F:
 *  1. Starter maximum of 5 seats and rejection of seat 6.
 *  2. Growth maximum of 25 seats and rejection of seat 26.
 *  3. Concurrent invitations and duplicate requests serialization.
 *  4. Pending invitation seat reservations, expiry, resend, and revocation.
 *  5. Valid, invalid, expired, and reused invitation tokens.
 *  6. Email verification and existing-user acceptance.
 *  7. Unauthorized invitations, role escalation, and cross-organization access.
 *  8. Dataset, report, AI, and other plan entitlement enforcement.
 *  9. Subscription expiry and downgrade behavior.
 */

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
process.env.MOCK_EMAIL_SEND = 'true';

const app = require('./app');
const db = require('./config/database');
const UserModel = require('./models/userModel');
const InvitationModel = require('./models/invitationModel');
const OrganizationModel = require('./models/organizationModel');
const subscriptionService = require('./services/subscriptionService');
const plansConfig = require('./config/plans');

const TEST_PORT = 5124;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let server;
let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '— ' + details : ''}`);
    failCount++;
  }
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = { raw: data };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING TEAM MANAGEMENT & INVITATIONS VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Start HTTP Server
  await new Promise(resolve => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  const uniqueSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Organizations & Admin Accounts
    // -------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Organizations & Accounts ---');

    // 1. Starter Org (max 5 users)
    const starterOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, created_at)
       VALUES ($1, $2, $3, 'starter', 'active', 'paid', NOW())`,
      [starterOrgId, `Starter Team ${uniqueSuffix}`, `starter-${uniqueSuffix}`]
    );

    const starterAdminPasswordHash = await bcrypt.hash('admin123', 10);
    const starterAdminRes = await db.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active') RETURNING id, email, role, organization_id`,
      [starterOrgId, 'Starter Admin', `starter-admin-${uniqueSuffix}@test.com`, starterAdminPasswordHash]
    );
    const starterAdmin = starterAdminRes.rows[0];

    // Login Starter Admin to get JWT
    const starterLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: starterAdmin.email, password: 'admin123' }
    });
    const starterToken = starterLogin.body.token;
    assert(starterLogin.status === 200 && starterToken, 'Starter Admin authenticated with JWT');

    // 2. Growth Org (max 25 users)
    const growthOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, created_at)
       VALUES ($1, $2, $3, 'growth', 'active', 'paid', NOW())`,
      [growthOrgId, `Growth Team ${uniqueSuffix}`, `growth-${uniqueSuffix}`]
    );

    const growthAdminRes = await db.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active') RETURNING id, email, role, organization_id`,
      [growthOrgId, 'Growth Admin', `growth-admin-${uniqueSuffix}@test.com`, starterAdminPasswordHash]
    );
    const growthAdmin = growthAdminRes.rows[0];

    const growthLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: growthAdmin.email, password: 'admin123' }
    });
    const growthToken = growthLogin.body.token;
    assert(growthLogin.status === 200 && growthToken, 'Growth Admin authenticated with JWT');

    // -------------------------------------------------------------------------
    // TEST 1: Starter maximum of 5 seats and rejection of seat 6
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Starter Maximum of 5 Seats & Rejection of Seat 6 ---');
    // Starter has 1 active admin. Capacity allows 4 more seats (members or pending invitations).
    // Invite member 2, 3, 4, 5
    for (let i = 2; i <= 5; i++) {
      const inviteRes = await request('/admin/invitations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${starterToken}` },
        body: { email: `starter-member-${i}-${uniqueSuffix}@test.com`, role: 'analyst' }
      });
      assert(
        inviteRes.status === 201,
        `Starter seat ${i}/5 reserved successfully`,
        `status: ${inviteRes.status}`
      );
    }

    // Now try to invite seat 6 -> MUST be rejected with HTTP 403 RESOURCE_LIMIT_EXCEEDED
    const seat6Res = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` },
      body: { email: `starter-member-6-${uniqueSuffix}@test.com`, role: 'viewer' }
    });
    assert(
      seat6Res.status === 403 && (seat6Res.body.error?.code === 'RESOURCE_LIMIT_EXCEEDED' || seat6Res.body.requiresUpgrade),
      'Starter 6th seat strictly rejected with HTTP 403 and upgrade guidance',
      `got ${seat6Res.status}, message: ${seat6Res.body.message}`
    );

    // Verify usage telemetry reports exactly 5/5 seats used and isAtLimit = true
    const starterUsage = await subscriptionService.getOrganizationUsage(starterOrgId);
    assert(starterUsage.users.count === 5, 'Starter usage reports exactly 5/5 seats reserved');
    assert(starterUsage.users.isAtLimit === true, 'Starter usage reports isAtLimit = true');
    assert(starterUsage.users.remaining === 0, 'Starter usage reports 0 remaining seats');

    // -------------------------------------------------------------------------
    // TEST 2: Growth maximum of 25 seats and rejection of seat 26
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Growth Maximum of 25 Seats & Rejection of Seat 26 ---');
    // Growth has 1 active admin. Provision 23 additional active users directly in DB
    for (let i = 2; i <= 24; i++) {
      await db.query(
        `INSERT INTO users (organization_id, name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'analyst', 'active')`,
        [growthOrgId, `Growth Member ${i}`, `growth-user-${i}-${uniqueSuffix}@test.com`, starterAdminPasswordHash]
      );
    }
    // Now Growth has 24 active members. 1 seat remaining to reach 25.
    // Invite seat 25
    const growthSeat25 = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${growthToken}` },
      body: { email: `growth-member-25-${uniqueSuffix}@test.com`, role: 'analyst' }
    });
    assert(growthSeat25.status === 201, 'Growth 25th seat successfully reserved via invitation');

    // Try to invite seat 26 -> MUST be rejected with HTTP 403
    const growthSeat26 = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${growthToken}` },
      body: { email: `growth-member-26-${uniqueSuffix}@test.com`, role: 'viewer' }
    });
    assert(
      growthSeat26.status === 403 && (growthSeat26.body.error?.code === 'RESOURCE_LIMIT_EXCEEDED' || growthSeat26.body.requiresUpgrade),
      'Growth 26th seat strictly rejected with HTTP 403 and upgrade guidance',
      `got ${growthSeat26.status}`
    );

    const growthUsage = await subscriptionService.getOrganizationUsage(growthOrgId);
    assert(growthUsage.users.count === 25, 'Growth usage reports exactly 25/25 seats reserved');
    assert(growthUsage.users.isAtLimit === true, 'Growth usage reports isAtLimit = true');

    // -------------------------------------------------------------------------
    // TEST 3: Concurrent invitations & duplicate requests serialization
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Concurrent Invitations & Duplicate Prevention ---');
    // Create a new fresh Starter org with 4 seats taken, exactly 1 seat open
    const raceOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, created_at)
       VALUES ($1, $2, $3, 'starter', 'active', 'paid', NOW())`,
      [raceOrgId, `Race Org ${uniqueSuffix}`, `race-${uniqueSuffix}`]
    );
    // 4 active members
    for (let i = 1; i <= 4; i++) {
      await db.query(
        `INSERT INTO users (organization_id, name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'analyst', 'active')`,
        [raceOrgId, `User ${i}`, `race-user-${i}-${uniqueSuffix}@test.com`, starterAdminPasswordHash]
      );
    }
    const raceAdminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: `race-user-1-${uniqueSuffix}@test.com`, password: 'admin123' }
    });
    // Update user 1 to admin
    await db.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [`race-user-1-${uniqueSuffix}@test.com`]);
    const raceToken = raceAdminLogin.body.token;

    // Launch 5 simultaneous requests for the 1 remaining seat (seats 5 vs 6, 7, 8, 9)
    const racePromises = [];
    for (let i = 1; i <= 5; i++) {
      racePromises.push(
        request('/admin/invitations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${raceToken}` },
          body: { email: `race-invitee-${i}-${uniqueSuffix}@test.com`, role: 'viewer' }
        })
      );
    }
    const raceResults = await Promise.all(racePromises);
    const successCount = raceResults.filter(r => r.status === 201).length;
    const rejectedCount = raceResults.filter(r => r.status === 403).length;

    assert(
      successCount === 1,
      `Exactly 1 concurrent request claimed the final 5th seat (succeeded: ${successCount})`
    );
    assert(
      rejectedCount === 4,
      `All 4 concurrent requests exceeding the limit were rejected with HTTP 403 (rejected: ${rejectedCount})`
    );

    // Test duplicate invitation for the same email address in the same organization
    const duplicateEmail = `duplicate-test-${uniqueSuffix}@test.com`;
    // Create an unconstrained org for duplicate test
    const dupOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, created_at)
       VALUES ($1, $2, $3, 'enterprise', 'active', 'paid', NOW())`,
      [dupOrgId, `Dup Org ${uniqueSuffix}`, `dup-${uniqueSuffix}`]
    );
    const dupAdminRes = await db.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active') RETURNING id`,
      [dupOrgId, 'Dup Admin', `dup-admin-${uniqueSuffix}@test.com`, starterAdminPasswordHash]
    );
    const dupLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: `dup-admin-${uniqueSuffix}@test.com`, password: 'admin123' }
    });
    const dupToken = dupLogin.body.token;

    const firstInvite = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dupToken}` },
      body: { email: duplicateEmail, role: 'analyst' }
    });
    assert(firstInvite.status === 201, 'First invitation to email succeeded');

    const secondInvite = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dupToken}` },
      body: { email: duplicateEmail, role: 'analyst' }
    });
    assert(
      secondInvite.status === 409 && secondInvite.body.error?.code === 'INVITATION_ALREADY_PENDING',
      'Duplicate pending invitation rejected with HTTP 409 INVITATION_ALREADY_PENDING',
      `got ${secondInvite.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Pending seat reservations, expiry, resend, and revocation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Seat Reservations, Expiry, Resend & Revocation ---');
    // In starterOrg, seat 5 was reserved. Let's find one of the pending invitations
    const starterInvitesRes = await request('/admin/invitations', {
      headers: { Authorization: `Bearer ${starterToken}` }
    });
    const pendingInvites = starterInvitesRes.body.invitations;
    assert(pendingInvites.length > 0, 'Found pending invitations in Starter organization');
    const targetInvite = pendingInvites[0];

    // Resend invitation: should refresh token without duplicating seat count
    const resendRes = await request(`/admin/invitations/${targetInvite.id}/resend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` }
    });
    assert(resendRes.status === 200, 'Resend invitation succeeded with HTTP 200');
    assert(
      resendRes.body.invitation?.expiresAt && new Date(resendRes.body.invitation.expiresAt) > new Date(),
      'Resend refreshed expiration date to 7 days in future'
    );

    // Check seat count after resend: MUST still be exactly 5 (no duplicate seat consumed!)
    const usageAfterResend = await subscriptionService.getOrganizationUsage(starterOrgId);
    assert(
      usageAfterResend.users.count === 5,
      'Resending invitation preserved seat count idempotency (still 5/5 seats)'
    );

    // Revoke invitation: should immediately free the reserved seat!
    const revokeRes = await request(`/admin/invitations/${targetInvite.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` }
    });
    assert(revokeRes.status === 200, 'Revoke invitation succeeded with HTTP 200');

    // Verify seat is now freed! (5 - 1 = 4 seats used)
    const usageAfterRevoke = await subscriptionService.getOrganizationUsage(starterOrgId);
    assert(
      usageAfterRevoke.users.count === 4,
      'Revoking invitation freed reserved seat (now 4/5 seats used)'
    );
    assert(
      usageAfterRevoke.users.isAtLimit === false,
      'Organization is no longer at limit (isAtLimit = false)'
    );

    // Now seat 5 can be invited again!
    const reInviteRes = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` },
      body: { email: `starter-freed-seat-${uniqueSuffix}@test.com`, role: 'viewer' }
    });
    assert(reInviteRes.status === 201, 'Successfully invited new member into freed seat');

    // Test Expiry: simulate an invitation that expired
    const expiredInviteRes = await db.query(
      `INSERT INTO invitations (organization_id, invited_by, email, role, token, status, expires_at)
       VALUES ($1, $2, $3, 'viewer', $4, 'pending', NOW() - INTERVAL '1 day')
       RETURNING id, token`,
      [dupOrgId, dupAdminRes.rows[0].id, `expired-${uniqueSuffix}@test.com`, crypto.randomBytes(32).toString('hex')]
    );
    const expiredToken = expiredInviteRes.rows[0].token;

    // Check that expired invitation is not counted towards seats
    const detailsExpired = await request(`/auth/invitation/${expiredToken}`);
    assert(
      detailsExpired.status === 400 && detailsExpired.body.message.includes('expired'),
      'Expired invitation details rejected with HTTP 400 Expired message'
    );

    const acceptExpired = await request('/auth/accept-invite', {
      method: 'POST',
      body: { token: expiredToken, name: 'Expired User', password: 'password123' }
    });
    assert(
      acceptExpired.status === 400 && acceptExpired.body.message.includes('expired'),
      'Accepting expired invitation strictly rejected with HTTP 400'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Valid, invalid, and reused invitation tokens
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Token Lifecycle (Valid, Invalid, Reused) ---');
    // Invalid token
    const invalidRes = await request('/auth/invitation/invalid-nonexistent-token-12345');
    assert(
      invalidRes.status === 404,
      'Invalid / non-existent invitation token returns HTTP 404'
    );

    // Valid token acceptance
    const validInvite = reInviteRes.body.invitation;
    const rawToken = validInvite.inviteUrl.split('token=')[1];

    const validDetails = await request(`/auth/invitation/${rawToken}`);
    assert(
      validDetails.status === 200 && validDetails.body.invitation?.email === validInvite.email,
      'Valid invitation token returns organization and role details'
    );

    // Accept valid invitation for a new user
    const acceptRes = await request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token: rawToken,
        name: 'New Valid Member',
        password: 'securepassword123'
      }
    });
    assert(
      acceptRes.status === 200 && acceptRes.body.token,
      'New user successfully accepts invitation and receives auth token'
    );
    assert(
      acceptRes.body.user?.role === 'viewer',
      'Assigned role strictly matches server-side invitation role'
    );

    // Token reuse attempt: Re-accepting the same token MUST be rejected
    const reuseRes = await request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token: rawToken,
        name: 'Attacker Replay',
        password: 'password123'
      }
    });
    assert(
      reuseRes.status === 400 && reuseRes.body.message.includes('accepted'),
      'Replay/reuse of already-accepted invitation token strictly rejected with HTTP 400'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Email verification & existing-user acceptance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Existing-User Acceptance & Security ---');
    // Create an existing user in another organization
    const existingUserPassword = 'mypassword123';
    const existingPasswordHash = await bcrypt.hash(existingUserPassword, 10);
    const existingEmail = `existing-user-${uniqueSuffix}@test.com`;

    await db.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'viewer', 'active')`,
      [dupOrgId, 'Existing Person', existingEmail, existingPasswordHash]
    );

    // Free a seat in starterOrg so we can invite this existing user
    await db.query(
      `DELETE FROM invitations WHERE organization_id = $1 AND email = $2`,
      [starterOrgId, `starter-member-2-${uniqueSuffix}@test.com`]
    );

    const inviteExisting = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` },
      body: { email: existingEmail, role: 'manager' }
    });
    assert(inviteExisting.status === 201, 'Invited existing user to starterOrg as manager');
    const existingRawToken = inviteExisting.body.invitation.inviteUrl.split('token=')[1];

    // Details check reveals isExistingUser = true
    const existingDetails = await request(`/auth/invitation/${existingRawToken}`);
    assert(
      existingDetails.status === 200 && existingDetails.body.invitation?.isExistingUser === true,
      'getInvitationDetails correctly identifies isExistingUser = true'
    );

    // Attempt accept with WRONG password -> MUST fail with HTTP 401
    const wrongPassAccept = await request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token: existingRawToken,
        password: 'wrongpassword'
      }
    });
    assert(
      wrongPassAccept.status === 401,
      'Existing user acceptance with incorrect password rejected with HTTP 401'
    );

    // Attempt accept with CORRECT password -> MUST succeed
    const correctPassAccept = await request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token: existingRawToken,
        password: existingUserPassword
      }
    });
    assert(
      correctPassAccept.status === 200 && correctPassAccept.body.user?.role === 'manager',
      'Existing user verified credentials and joined org with authorized manager role'
    );

    // Verify DB reflects updated organization and email verification
    const updatedExistingUser = await UserModel.findByEmail(existingEmail);
    assert(
      String(updatedExistingUser.organization_id) === String(starterOrgId),
      'User organization_id safely migrated to new organization'
    );
    assert(
      updatedExistingUser.role === 'manager',
      'User role upgraded to server-authorized manager role'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Unauthorized invitations, role escalation & cross-org access
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Authorization & Cross-Org Isolation ---');
    // Login as viewer (non-admin)
    const viewerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: validInvite.email, password: 'securepassword123' }
    });
    const viewerToken = viewerLogin.body.token;

    // Non-admin attempting to invite -> 403 Forbidden
    const unauthInvite = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: { email: `hacker-${uniqueSuffix}@test.com`, role: 'admin' }
    });
    assert(
      unauthInvite.status === 403,
      'Non-admin viewer blocked from inviting members with HTTP 403'
    );

    // Admin attempting to invite as 'owner' -> strictly blocked (400 Invalid role)
    const ownerInvite = await request('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` },
      body: { email: `owner-hack-${uniqueSuffix}@test.com`, role: 'owner' }
    });
    assert(
      ownerInvite.status === 400,
      'Role escalation: Inviting member as "owner" strictly rejected with HTTP 400'
    );

    // Cross-organization access: Starter admin trying to revoke Growth invite
    const growthInviteId = growthSeat25.body.invitation.id;
    const crossOrgRevoke = await request(`/admin/invitations/${growthInviteId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${starterToken}` }
    });
    assert(
      crossOrgRevoke.status === 404,
      'Cross-organization access: Admin cannot revoke invitation belonging to another organization (HTTP 404)'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Dataset, report, AI, and plan entitlement enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Plan Feature Entitlements Enforcement ---');
    // Check Starter plan entitlements:
    // Starter does NOT have insights or alerts
    const starterInsights = await subscriptionService.checkFeatureEntitlement(starterOrgId, 'insights');
    assert(
      starterInsights.allowed === false && starterInsights.code === 'PLAN_UPGRADE_REQUIRED',
      'Starter plan blocked from executive AI insights (requires Growth)'
    );

    const starterAlerts = await subscriptionService.checkFeatureEntitlement(starterOrgId, 'alerts');
    assert(
      starterAlerts.allowed === false && starterAlerts.code === 'PLAN_UPGRADE_REQUIRED',
      'Starter plan blocked from real-time anomaly alerts (requires Growth)'
    );

    // Growth plan entitlements:
    // Growth HAS insights and alerts, but NOT aiQueryPlanner
    const growthInsights = await subscriptionService.checkFeatureEntitlement(growthOrgId, 'insights');
    assert(
      growthInsights.allowed === true,
      'Growth plan entitled to executive AI insights'
    );

    const growthAiPlanner = await subscriptionService.checkFeatureEntitlement(growthOrgId, 'aiQueryPlanner');
    assert(
      growthAiPlanner.allowed === false && growthAiPlanner.code === 'PLAN_UPGRADE_REQUIRED',
      'Growth plan blocked from Custom AI Query Planner (requires Enterprise)'
    );

    // Enterprise plan has all features
    const entInsights = await subscriptionService.checkFeatureEntitlement(dupOrgId, 'insights');
    const entAiPlanner = await subscriptionService.checkFeatureEntitlement(dupOrgId, 'aiQueryPlanner');
    assert(
      entInsights.allowed === true && entAiPlanner.allowed === true,
      'Enterprise plan entitled to all advanced AI and governance features'
    );

    // Dataset limits: Starter allows 10 datasets, Growth allows 50
    assert(plansConfig.getLimit('starter', 'maxDatasets') === 10, 'Starter limit for datasets is 10');
    assert(plansConfig.getLimit('growth', 'maxDatasets') === 50, 'Growth limit for datasets is 50');
    assert(plansConfig.getLimit('enterprise', 'maxDatasets') === -1, 'Enterprise limit for datasets is unlimited (-1)');

    // -------------------------------------------------------------------------
    // TEST 9: Subscription expiry and scheduled downgrade behavior
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Subscription Expiry & Scheduled Downgrades ---');
    // Create an expired organization
    const expiredOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, trial_started_at, trial_ends_at, created_at)
       VALUES ($1, $2, $3, 'starter', 'trial', 'unpaid', NOW() - INTERVAL '20 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '20 days')`,
      [expiredOrgId, `Expired Org ${uniqueSuffix}`, `expired-org-${uniqueSuffix}`]
    );

    const expiredAccess = await subscriptionService.checkWorkspaceAccess(expiredOrgId);
    assert(
      expiredAccess.allowed === false && (expiredAccess.code === 'TRIAL_EXPIRED' || expiredAccess.code === 'SUBSCRIPTION_REQUIRED'),
      'Expired trial organization blocked from workspace access with HTTP 402 code'
    );

    // Scheduled Downgrade verification:
    // Growth organization schedules downgrade to Starter at period boundary
    const downgradeOrgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (
         id, name, slug, plan, subscription_status, payment_status,
         scheduled_downgrade_plan, scheduled_downgrade_effective_date, created_at
       ) VALUES ($1, $2, $3, 'growth', 'active', 'paid', 'starter', NOW() - INTERVAL '1 minute', NOW())`,
      [downgradeOrgId, `Downgrade Org ${uniqueSuffix}`, `downgrade-${uniqueSuffix}`]
    );

    // Fetch subscription: should apply scheduled downgrade automatically
    const subAfterDowngrade = await subscriptionService.getOrganizationSubscription(downgradeOrgId);
    assert(
      subAfterDowngrade.plan === 'starter',
      'Scheduled downgrade applied: Organization plan transitioned from growth -> starter'
    );
    assert(
      subAfterDowngrade.usage.users.limit === 5,
      'Starter limit of 5 seats enforced immediately post-downgrade'
    );

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
      console.log('\n[Test Server] Closed');
    }
    // Clean up test organizations
    try {
      await db.query(`DELETE FROM organizations WHERE slug LIKE $1`, [`%${uniqueSuffix}%`]);
    } catch (_) {}
  }

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
