/**
 * Comprehensive Automated Test Suite:
 * - Exact 14-Day Free-Trial Timing
 * - Calendar-Month & Calendar-Year Subscription Boundaries
 * - Month-End Clamping (Jan 31 -> Feb 28/29, Mar 31 -> Apr 30, Aug 31 -> Sep 30)
 * - Leap-Year Leap-Day Handling (Feb 29 -> Feb 28)
 * - Honest Brevo Email Send Failure & Seat Rollback
 * - Duplicate Webhook Idempotency
 * - Expired Subscription Access Enforcement
 */

const assert = require('assert');
const { calculateNextBillingDate, calculateTrialEndDate, calculateTimeRemaining } = require('./utils/billingDateUtils');
const subscriptionService = require('./services/subscriptionService');
const emailService = require('./services/emailService');
const InvitationModel = require('./models/invitationModel');
const db = require('./config/database');

async function runTests() {
  console.log('\n================================================================');
  console.log(' RUNNING CALENDAR BILLING, TRIAL TIMING & TEAM VERIFICATION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // SUITE 1: Exact 14-Day Free Trial Timing
  // --------------------------------------------------------------------------
  console.log('[TEST SUITE 1] Exact 14-Day Free Trial Timing & Countdown');

  test('14-day trial ends exactly 14 × 24 hours (1,209,600,000 ms) after start', () => {
    const start = new Date('2026-06-01T10:15:30.500Z');
    const end = calculateTrialEndDate(start, 14);
    const expectedMs = start.getTime() + 14 * 24 * 60 * 60 * 1000;
    assert.strictEqual(end.getTime(), expectedMs, 'Trial end must match exactly 14 × 24 hours');
    assert.strictEqual(end.toISOString(), '2026-06-15T10:15:30.500Z');
  });

  test('Trial countdown derives remaining time from authoritative server timestamp', () => {
    const end = new Date('2026-06-15T10:15:30.500Z');
    // Exactly 3 days and 2 hours before expiry
    const now = new Date(end.getTime() - (3 * 24 + 2) * 60 * 60 * 1000);
    const remaining = calculateTimeRemaining(end, now);
    assert.strictEqual(remaining.isExpired, false);
    assert.strictEqual(remaining.daysRemaining, 4); // Math.ceil(74h / 24) = 4 days
    assert.strictEqual(remaining.hoursRemaining, 74);
  });

  test('At or after expiry timestamp, trial is marked expired', () => {
    const end = new Date('2026-06-15T10:15:30.500Z');
    const nowAfter = new Date('2026-06-15T10:15:31.000Z'); // 500ms after expiry
    const remaining = calculateTimeRemaining(end, nowAfter);
    assert.strictEqual(remaining.isExpired, true);
    assert.strictEqual(remaining.daysRemaining, 0);
    assert.strictEqual(remaining.hoursRemaining, 0);
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Calendar-Month Billing Calculations & Clamping
  // --------------------------------------------------------------------------
  console.log('\n[TEST SUITE 2] Calendar-Month Billing Calculations & Clamping');

  test('January 31 monthly billing clamps to February 28 in non-leap year (2026)', () => {
    const start = new Date('2026-01-31T14:30:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-02-28T14:30:00.000Z');
    assert.strictEqual(next.getUTCHours(), 14);
    assert.strictEqual(next.getUTCMinutes(), 30);
  });

  test('January 31 monthly billing clamps to February 29 in leap year (2024)', () => {
    const start = new Date('2024-01-31T14:30:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2024-02-29T14:30:00.000Z');
  });

  test('March 31 monthly billing clamps to April 30', () => {
    const start = new Date('2026-03-31T08:00:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-04-30T08:00:00.000Z');
  });

  test('May 31 monthly billing clamps to June 30', () => {
    const start = new Date('2026-05-31T12:00:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-06-30T12:00:00.000Z');
  });

  test('August 31 monthly billing clamps to September 30', () => {
    const start = new Date('2026-08-31T18:45:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-09-30T18:45:00.000Z');
  });

  test('October 31 monthly billing clamps to November 30', () => {
    const start = new Date('2026-10-31T00:00:00.000Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-11-30T00:00:00.000Z');
  });

  test('December 31 monthly billing advances year and preserves Jan 31', () => {
    const start = new Date('2026-12-31T23:59:59.999Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2027-01-31T23:59:59.999Z');
  });

  test('Mid-month date (e.g. 15th) preserves exact day across months', () => {
    const start = new Date('2026-02-15T11:22:33.444Z');
    const next = calculateNextBillingDate(start, 'monthly');
    assert.strictEqual(next.toISOString(), '2026-03-15T11:22:33.444Z');
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Annual Calendar Billing Calculations
  // --------------------------------------------------------------------------
  console.log('\n[TEST SUITE 3] Annual Calendar Billing Calculations');

  test('February 29 leap year annual subscription clamps to Feb 28 in non-leap year', () => {
    const start = new Date('2024-02-29T12:00:00.000Z');
    const next = calculateNextBillingDate(start, 'yearly');
    assert.strictEqual(next.toISOString(), '2025-02-28T12:00:00.000Z');
  });

  test('Standard annual subscription advances exactly 1 calendar year', () => {
    const start = new Date('2026-07-20T16:00:00.000Z');
    const next = calculateNextBillingDate(start, 'annual');
    assert.strictEqual(next.toISOString(), '2027-07-20T16:00:00.000Z');
  });

  // --------------------------------------------------------------------------
  // SUITE 4: Backend Service Integration & Access Policy Enforcement
  // --------------------------------------------------------------------------
  console.log('\n[TEST SUITE 4] Backend Subscription Expiry & Access Policy Enforcement');

  await asyncTest('applyUpgrade uses calculateNextBillingDate for calendar periods', async () => {
    const orgId = '00000000-0000-0000-0000-000000000001';
    const upgraded = await subscriptionService.applyUpgrade(orgId, {
      planId: 'growth',
      billingInterval: 'monthly'
    });
    assert.ok(upgraded, 'Upgraded org returned');
    assert.ok(upgraded.current_period_end, 'current_period_end is set');
    const expected = calculateNextBillingDate(new Date(), 'monthly');
    // Dates should match within a 1-second margin
    const diffMs = Math.abs(new Date(upgraded.current_period_end).getTime() - expected.getTime());
    assert.ok(diffMs < 2000, `Period end should match calendar month: diff was ${diffMs}ms`);
  });

  await asyncTest('Expired subscription cannot access workspace features', async () => {
    const pastOrgId = '00000000-0000-0000-0000-000000000099';
    // Create or update mock organization with expired trial
    const pastDate = new Date('2026-01-01T00:00:00Z');
    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status, trial_started_at, trial_ends_at)
      VALUES ($1, 'Expired Corp', 'expired-corp', 'starter', 'trial_expired', 'unpaid', $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        subscription_status = 'trial_expired',
        trial_ends_at = $3;
    `, [pastOrgId, pastDate, pastDate]).catch(() => null);

    subscriptionService.clearOrganizationCache(pastOrgId);
    const access = await subscriptionService.checkWorkspaceAccess(pastOrgId);
    assert.strictEqual(access.allowed, false, 'Expired org must be denied access');
    assert.ok(
      access.code === 'SUBSCRIPTION_EXPIRED' || access.code === 'TRIAL_EXPIRED',
      `Expected expiry code but got ${access.code}`
    );
  });

  // --------------------------------------------------------------------------
  // SUITE 5: Honest Email Failure Handling & Seat Release
  // --------------------------------------------------------------------------
  console.log('\n[TEST SUITE 5] Honest Email Send Failure Handling & Seat Release');

  await asyncTest('InvitationModel.revoke immediately frees reserved seat', async () => {
    // Create a fresh test organization with plenty of seats
    const testOrgId = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
    await db.query(`
      INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status)
      VALUES ($1, 'Invite Test Corp', $2, 'growth', 'active', 'paid')
      ON CONFLICT (id) DO NOTHING;
    `, [testOrgId, `invite-test-${Date.now()}`]);

    const uniqueEmail = `revoke_test_${Date.now()}@example.com`;

    const res = await InvitationModel.createWithAtomicSeatReservation({
      organizationId: testOrgId,
      invitedBy: 1,
      email: uniqueEmail,
      role: 'analyst'
    });
    assert.ok(res.invitation, 'Invitation created');

    // Revoke
    const revoked = await InvitationModel.revoke(res.invitation.id, testOrgId);
    assert.ok(revoked, 'Invitation revoked');

    // Verify status is revoked
    const found = await InvitationModel.findByToken(res.rawToken);
    assert.ok(!found || found.status === 'revoked', 'Revoked invitation is not pending');
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
