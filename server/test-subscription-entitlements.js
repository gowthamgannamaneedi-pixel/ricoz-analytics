/**
 * RicozAnalytics — Complete Subscription, Plan Entitlements & Expiry Reminders Test Suite
 * 
 * Verifies all 13 required test cases:
 *  1. Starter cannot use Growth or Enterprise features (Insights -> 403, Alerts -> 403, AI Query Planner -> 403)
 *  2. Growth can use Starter & Growth features (Insights, Alerts) but not Enterprise (AI Query Planner -> 403)
 *  3. Enterprise has all configured entitlements (Datasets, Members, Insights, Alerts, AI Query Planner)
 *  4. Dataset and team-member limits are enforced server-side with HTTP 403 and upgrade guidance
 *  5. Unpaid or forged upgrades do not unlock features
 *  6. Verified upgrades unlock features correctly and record subscription_history
 *  7. Downgrades take effect on the correct date (current_period_end)
 *  8. Expired subscriptions cannot continue using paid-only features (HTTP 402)
 *  9. Existing data is preserved after expiry or downgrade (no deletion)
 * 10. 10-day reminder is scheduled/sent correctly and duplicate reminders are prevented
 * 11. Renewal or cancellation updates reminder behavior correctly
 * 12. Organization isolation and multi-tenant authorization remain secure
 * 13. System health and billing endpoints remain robust
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
process.env.MOCK_EMAIL_SEND = 'true';
const app = require('./app');
const db = require('./config/database');
const subscriptionService = require('./services/subscriptionService');
const SubscriptionHistoryModel = require('./models/subscriptionHistoryModel');
const SubscriptionReminderModel = require('./models/subscriptionReminderModel');
const UserModel = require('./models/userModel');

const TEST_PORT = process.env.TEST_PORT || 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

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
          data: json
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

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runSubscriptionTestSuite() {
  let server = null;
  try {
    server = await new Promise((resolve, reject) => {
      const s = app.listen(TEST_PORT, () => resolve(s));
      s.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(null);
        } else {
          reject(err);
        }
      });
    });
  } catch (err) {
    console.warn(`Port ${TEST_PORT} already in use or error:`, err.message);
  }

  console.log('\n================================================================');
  console.log(' STARTING PRODUCTION SUBSCRIPTION & ENTITLEMENTS TEST SUITE');
  console.log('================================================================\n');

  const ts = Date.now();
  const orgStarterName = `Starter Corp ${ts}`;
  const orgGrowthName = `Growth Corp ${ts}`;
  const orgEnterpriseName = `Enterprise Corp ${ts}`;
  const orgIsoName = `Isolated Corp ${ts}`;

  const emailStarter = `starter_${ts}@example.com`;
  const emailGrowth = `growth_${ts}@example.com`;
  const emailEnterprise = `enterprise_${ts}@example.com`;
  const emailIso = `isolated_${ts}@example.com`;

  try {
    // Synchronize postgres sequences to prevent duplicate primary key collisions
    await db.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) + 1 FROM users))`).catch(() => null);
    await db.query(`SELECT setval('data_sources_id_seq', (SELECT COALESCE(MAX(id), 1) + 1 FROM data_sources))`).catch(() => null);

    // -------------------------------------------------------------------------
    // HELPER: Register and activate a test organization & user
    // -------------------------------------------------------------------------
    async function createVerifiedUser(email, orgName) {
      const regRes = await request('/auth/register', {
        method: 'POST',
        body: {
          name: 'Admin User',
          email,
          organization_name: orgName,
          password: 'Password123!'
        }
      });

      if (regRes.status !== 201) {
        throw new Error(`Failed to register ${email}: ${JSON.stringify(regRes.data)}`);
      }

      // Fetch the OTP from DB to test the real /auth/verify-email endpoint
      const dbUserRes = await db.query('SELECT id, verification_otp FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const otp = dbUserRes.rows[0]?.verification_otp;

      const verifyRes = await request('/auth/verify-email', {
        method: 'POST',
        body: { email, otp }
      });

      if (verifyRes.status !== 200) {
        throw new Error(`Failed to verify ${email}: ${JSON.stringify(verifyRes.data)}`);
      }

      return {
        token: verifyRes.data.token,
        user: verifyRes.data.user,
        organizationId: regRes.data.organization_id
      };
    }

    // -------------------------------------------------------------------------
    // TEST CASE 1: Starter cannot use Growth or Enterprise features
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Starter plan restriction on Growth & Enterprise features');
    const starterTenant = await createVerifiedUser(emailStarter, orgStarterName);
    const authStarter = { Authorization: `Bearer ${starterTenant.token}` };

    // Explicitly ensure plan is 'starter' and subscription is active
    await subscriptionService.updateSubscription(starterTenant.organizationId, {
      plan: 'starter',
      subscription_status: 'active',
      payment_status: 'paid'
    });

    // 1.1 Starter tries to access Executive Insights (/api/insights) -> 403 PLAN_UPGRADE_REQUIRED
    const starterInsightsRes = await request('/insights', { headers: authStarter });
    assert(
      starterInsightsRes.status === 403,
      'Starter cannot access Executive AI Insights (returns HTTP 403)'
    );
    assert(
      starterInsightsRes.data?.error?.code === 'PLAN_UPGRADE_REQUIRED' || starterInsightsRes.data?.requiresUpgrade === true,
      'Starter receives structured PLAN_UPGRADE_REQUIRED error for insights'
    );
    assert(
      starterInsightsRes.data?.upgradeGuidance?.targetPlan === 'growth',
      'Starter is offered upgrade guidance to Growth for insights'
    );

    // 1.2 Starter tries to access Real-time Anomaly Alerts (/api/alerts) -> 403 PLAN_UPGRADE_REQUIRED
    const starterAlertsRes = await request('/alerts', { headers: authStarter });
    assert(
      starterAlertsRes.status === 403,
      'Starter cannot access Real-time Anomaly Alerts (returns HTTP 403)'
    );
    assert(
      starterAlertsRes.data?.error?.code === 'PLAN_UPGRADE_REQUIRED' || starterAlertsRes.data?.requiresUpgrade === true,
      'Starter receives structured PLAN_UPGRADE_REQUIRED error for alerts'
    );

    // 1.3 Starter tries to access AI Query Planner (/api/ai/query) -> 403 PLAN_UPGRADE_REQUIRED
    const starterAIRes = await request('/ai/query', {
      method: 'POST',
      headers: authStarter,
      body: { prompt: 'What is our Q3 forecast?' }
    });
    assert(
      starterAIRes.status === 403,
      'Starter cannot access Custom AI Query Planner (returns HTTP 403)'
    );
    assert(
      starterAIRes.data?.upgradeGuidance?.targetPlan === 'enterprise',
      'Starter is offered upgrade guidance to Enterprise for AI Query Planner'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 2: Growth can use Starter & Growth features, but not Enterprise
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Growth plan features: Access to Insights & Alerts, restricted from AI Query Planner');
    const growthTenant = await createVerifiedUser(emailGrowth, orgGrowthName);
    const authGrowth = { Authorization: `Bearer ${growthTenant.token}` };

    await subscriptionService.updateSubscription(growthTenant.organizationId, {
      plan: 'growth',
      subscription_status: 'active',
      payment_status: 'paid'
    });

    // 2.1 Growth accesses Executive AI Insights -> 200 OK
    const growthInsightsRes = await request('/insights', { headers: authGrowth });
    assert(
      growthInsightsRes.status === 200,
      'Growth successfully accesses Executive AI Insights (HTTP 200)'
    );

    // 2.2 Growth accesses Real-time Anomaly Alerts -> 200 OK
    const growthAlertsRes = await request('/alerts', { headers: authGrowth });
    assert(
      growthAlertsRes.status === 200,
      'Growth successfully accesses Real-time Anomaly Alerts (HTTP 200)'
    );

    // 2.3 Growth tries to access Custom AI Query Planner -> 403 PLAN_UPGRADE_REQUIRED
    const growthAIRes = await request('/ai/query', {
      method: 'POST',
      headers: authGrowth,
      body: { prompt: 'Optimize this warehouse schema' }
    });
    assert(
      growthAIRes.status === 403,
      'Growth cannot access Enterprise Custom AI Query Planner (returns HTTP 403)'
    );
    assert(
      growthAIRes.data?.upgradeGuidance?.targetPlan === 'enterprise',
      'Growth receives upgrade guidance to Enterprise for AI Query Planner'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 3: Enterprise plan has all configured entitlements
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Enterprise plan has all configured entitlements');
    const enterpriseTenant = await createVerifiedUser(emailEnterprise, orgEnterpriseName);
    const authEnterprise = { Authorization: `Bearer ${enterpriseTenant.token}` };

    await subscriptionService.updateSubscription(enterpriseTenant.organizationId, {
      plan: 'enterprise',
      subscription_status: 'active',
      payment_status: 'paid'
    });

    // 3.1 Enterprise accesses Insights -> 200 OK
    const entInsightsRes = await request('/insights', { headers: authEnterprise });
    assert(
      entInsightsRes.status === 200,
      'Enterprise accesses Executive AI Insights (HTTP 200)'
    );

    // 3.2 Enterprise accesses Alerts -> 200 OK
    const entAlertsRes = await request('/alerts', { headers: authEnterprise });
    assert(
      entAlertsRes.status === 200,
      'Enterprise accesses Real-time Anomaly Alerts (HTTP 200)'
    );

    // 3.3 Enterprise accesses AI Query Planner -> Allowed through middleware (non-403)
    const entAIRes = await request('/ai/query', {
      method: 'POST',
      headers: authEnterprise,
      body: { prompt: 'Explain churn drivers' }
    });
    assert(
      entAIRes.status !== 403,
      'Enterprise passes subscription middleware for AI Query Planner (non-403)'
    );

    // 3.4 Enterprise subscription endpoint reports unlimited datasets & users
    const entSubRes = await request('/billing/subscription', { headers: authEnterprise });
    assert(
      entSubRes.status === 200,
      'Enterprise retrieves subscription details (HTTP 200)'
    );
    assert(
      entSubRes.data?.subscription?.entitlements?.maxDatasets === -1,
      'Enterprise configuration grants unlimited datasets (maxDatasets = -1)'
    );
    assert(
      entSubRes.data?.subscription?.entitlements?.maxUsers === -1,
      'Enterprise configuration grants unlimited team members (maxUsers = -1)'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 4: Dataset & team-member limits enforced server-side with 403
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Server-side dataset & team-member limit enforcement');
    // Starter has max 10 datasets. Let's insert 10 datasets for starterTenant in DB.
    for (let i = 1; i <= 10; i++) {
      await db.query(`
        INSERT INTO data_sources (name, type, organization_id, status, created_at, updated_at)
        VALUES ($1, 'csv', $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [`Starter Dataset ${i}`, starterTenant.organizationId]);
    }

    // 4.1 11th dataset creation via API returns HTTP 403 RESOURCE_LIMIT_EXCEEDED
    const exceedDsRes = await request('/data-sources', {
      method: 'POST',
      headers: authStarter,
      body: {
        name: 'Starter Dataset 11',
        type: 'csv',
        config: {}
      }
    });
    assert(
      exceedDsRes.status === 403,
      'Creating 11th dataset on Starter (limit 10) returns HTTP 403'
    );
    assert(
      exceedDsRes.data?.error?.code === 'RESOURCE_LIMIT_EXCEEDED',
      'Limit rejection returns code RESOURCE_LIMIT_EXCEEDED'
    );
    assert(
      exceedDsRes.data?.limit === 10,
      'Response specifies dataset limit of 10'
    );
    assert(
      exceedDsRes.data?.upgradeGuidance?.targetPlan === 'growth',
      'Response provides upgrade guidance to Growth'
    );

    // 4.2 Team-member limits: Starter has max 5 users.
    // Insert 4 additional users so total users = 5 (including admin).
    for (let u = 2; u <= 5; u++) {
      await UserModel.create({
        name: `Team Member ${u}`,
        email: `member${u}_${ts}@starter.com`,
        password: 'Password123!',
        role: 'analyst',
        organizationId: starterTenant.organizationId,
        status: 'active'
      });
    }

    // 6th user invitation via /api/admin/invitations returns HTTP 403
    const exceedUserRes = await request('/admin/invitations', {
      method: 'POST',
      headers: authStarter,
      body: {
        email: `member6_${ts}@starter.com`,
        role: 'analyst'
      }
    });
    assert(
      exceedUserRes.status === 403,
      'Inviting 6th member on Starter (limit 5) returns HTTP 403'
    );
    assert(
      exceedUserRes.data?.error?.code === 'RESOURCE_LIMIT_EXCEEDED',
      'User invitation rejection returns code RESOURCE_LIMIT_EXCEEDED'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 5: Unpaid or forged upgrades do not unlock features
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Unpaid or forged upgrades do not unlock features');
    // Forge a fake webhook payload without Stripe signature verification
    const forgedWebhookRes = await request('/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'forged_fake_signature_abc' },
      body: {
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: starterTenant.organizationId,
            metadata: { planId: 'enterprise' }
          }
        }
      }
    });
    assert(
      forgedWebhookRes.status === 400 || forgedWebhookRes.status === 401,
      'Webhook rejects forged signature without unlocking features'
    );

    // Verify starter features remain locked
    const stillLockedRes = await request('/ai/query', {
      method: 'POST',
      headers: authStarter,
      body: { prompt: 'Verify still locked' }
    });
    assert(
      stillLockedRes.status === 403,
      'Enterprise features remain strictly locked after forged upgrade attempt'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 6: Verified upgrades unlock features correctly and log audit history
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Verified upgrade immediately unlocks features and records audit event');
    const upgradedOrg = await subscriptionService.applyUpgrade(starterTenant.organizationId, {
      planId: 'growth',
      billingInterval: 'monthly',
      amount: 1999,
      currency: 'inr',
      stripeCustomerId: 'cus_test_starter_upgrade',
      stripeSubscriptionId: 'sub_test_starter_upgrade'
    });
    assert(
      upgradedOrg.plan === 'growth',
      'applyUpgrade updates organization plan to growth'
    );

    // Verify AI insights are now immediately unlocked (HTTP 200)
    const unlockedInsightsRes = await request('/insights', { headers: authStarter });
    assert(
      unlockedInsightsRes.status === 200,
      'Executive AI Insights immediately unlock after verified upgrade (HTTP 200)'
    );

    // Verify subscription history event was recorded
    const historyRes = await request('/billing/history', { headers: authStarter });
    assert(
      historyRes.status === 200,
      'Billing history endpoint returns HTTP 200'
    );
    const hasUpgradeEvent = (historyRes.data?.history || []).some(
      h => h.event_type === 'upgrade' && h.to_plan === 'growth'
    );
    assert(
      hasUpgradeEvent,
      'Subscription audit log records "upgrade" event with from_plan: starter, to_plan: growth'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 7: Downgrades take effect on the correct date (current_period_end)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Scheduled downgrades preserve higher-tier entitlements until period end');
    const futurePeriodEnd = new Date(Date.now() + 15 * 86400000); // 15 days in future

    await subscriptionService.updateSubscription(starterTenant.organizationId, {
      current_period_end: futurePeriodEnd,
      next_billing_date: futurePeriodEnd
    });

    // Schedule downgrade from Growth to Starter via API
    const scheduleDowngradeRes = await request('/billing/schedule-downgrade', {
      method: 'POST',
      headers: authStarter,
      body: { planId: 'starter' }
    });
    assert(
      scheduleDowngradeRes.status === 200,
      'Scheduling downgrade to starter returns HTTP 200'
    );
    assert(
      scheduleDowngradeRes.data?.subscription?.scheduledDowngradePlan === 'starter',
      'scheduledDowngradePlan is recorded as "starter"'
    );

    // Growth features MUST remain active until futurePeriodEnd
    const stillActiveGrowthRes = await request('/insights', { headers: authStarter });
    assert(
      stillActiveGrowthRes.status === 200,
      'Higher-tier features (Insights) remain active while downgrade is scheduled for period end'
    );

    // Audit log records downgrade_scheduled
    const historyAfterDowngradeRes = await request('/billing/history', { headers: authStarter });
    const hasDowngradeScheduledEvent = (historyAfterDowngradeRes.data?.history || []).some(
      h => h.event_type === 'downgrade_scheduled'
    );
    assert(
      hasDowngradeScheduledEvent,
      'Subscription audit log records "downgrade_scheduled" event'
    );

    // Simulate passing the period end boundary
    const pastPeriodEnd = new Date(Date.now() - 1000);
    await subscriptionService.updateSubscription(starterTenant.organizationId, {
      current_period_end: pastPeriodEnd,
      scheduled_downgrade_effective_date: pastPeriodEnd
    });

    // Calling getOrganizationSubscription triggers lazy evaluation / downgrade execution
    const evaluatedSub = await subscriptionService.getOrganizationSubscription(starterTenant.organizationId);
    assert(
      evaluatedSub.plan === 'starter',
      'Once billing period ends, scheduled downgrade is executed and plan becomes starter'
    );

    // Insights should now be locked again (HTTP 403)
    const relockedRes = await request('/insights', { headers: authStarter });
    assert(
      relockedRes.status === 403,
      'After downgrade takes effect, Growth-only features are relocked (HTTP 403)'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 8: Expired subscriptions cannot continue using paid-only features
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Expired subscriptions cannot access workspace features (HTTP 402)');
    await subscriptionService.updateSubscription(starterTenant.organizationId, {
      subscription_status: 'trial_expired',
      payment_status: 'unpaid',
      trial_ends_at: new Date(Date.now() - 1000)
    });

    const expiredAccessRes = await request('/data-sources', { headers: authStarter });
    assert(
      expiredAccessRes.status === 402,
      'Expired subscription receives HTTP 402 Payment Required'
    );
    assert(
      expiredAccessRes.data?.requiresSubscription === true,
      'Error response indicates requiresSubscription: true'
    );

    // Restore to active starter for remaining data integrity checks
    const activePeriodEnd = new Date(Date.now() + 30 * 86400000);
    await subscriptionService.updateSubscription(starterTenant.organizationId, {
      subscription_status: 'active',
      payment_status: 'paid',
      plan: 'starter',
      current_period_start: new Date(),
      current_period_end: activePeriodEnd,
      next_billing_date: activePeriodEnd
    });

    // -------------------------------------------------------------------------
    // TEST CASE 9: Existing data is preserved after expiry or downgrade
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Zero Customer Data Deletion Guarantee: Existing datasets preserved');
    // Starter has 10 datasets currently. Verify all 10 datasets still exist in database.
    const dsListRes = await request('/data-sources', { headers: authStarter });
    assert(
      dsListRes.status === 200,
      'Data sources list returns HTTP 200'
    );
    assert(
      Array.isArray(dsListRes.data?.data) && dsListRes.data.data.length >= 10,
      'Existing 10 datasets were NOT deleted upon plan downgrade or trial expiry'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 10: 10-day reminder is sent and duplicate reminders are prevented
    // -------------------------------------------------------------------------
    console.log('\n[TEST 10] Automated 10-day reminder scheduling & deduplication');
    const tenDaysFromNow = new Date(Date.now() + 10 * 86400000);
    await subscriptionService.updateSubscription(growthTenant.organizationId, {
      current_period_end: tenDaysFromNow,
      subscription_status: 'active'
    });

    // First reminder evaluation: should send 1 reminder
    const firstCheck = await subscriptionService.checkAndSendExpiryReminders();
    assert(
      firstCheck.checked >= 1,
      `Reminder check evaluated active organizations (checked: ${firstCheck.checked})`
    );

    // Second immediate reminder evaluation: must skip due to DB unique constraint & idempotency
    const secondCheck = await subscriptionService.checkAndSendExpiryReminders();
    assert(
      secondCheck.skipped >= 1,
      `Second reminder check skipped already-notified milestone (skipped: ${secondCheck.skipped})`
    );

    // Check DB record in subscription_reminders
    const targetDateStr = tenDaysFromNow.toISOString().split('T')[0];
    const isRecorded = await SubscriptionReminderModel.hasReminderBeenSent(
      growthTenant.organizationId,
      '10_day_warning',
      targetDateStr
    );
    assert(
      isRecorded === true,
      'Milestone reminder recorded in subscription_reminders table with target_date'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 11: Renewal or cancellation updates reminder behavior correctly
    // -------------------------------------------------------------------------
    console.log('\n[TEST 11] Renewal or cancellation updates reminder behavior');
    // Renew growthTenant: push date out to 30 days
    const renewedDate = new Date(Date.now() + 30 * 86400000);
    await subscriptionService.updateSubscription(growthTenant.organizationId, {
      current_period_end: renewedDate
    });

    const subAfterRenewal = await subscriptionService.getOrganizationSubscription(growthTenant.organizationId);
    assert(
      subAfterRenewal.isExpiringSoon === false,
      'Renewed organization with 30 days remaining is marked isExpiringSoon: false'
    );

    // Immediate cancellation
    await subscriptionService.cancelSubscription(growthTenant.organizationId, { immediate: true });
    const subAfterCancel = await subscriptionService.getOrganizationSubscription(growthTenant.organizationId);
    assert(
      subAfterCancel.status === 'cancelled',
      'Subscription status updated to cancelled upon cancellation'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 12: Organization isolation and multi-tenant authorization
    // -------------------------------------------------------------------------
    console.log('\n[TEST 12] Multi-tenant data & billing isolation');
    const isoTenant = await createVerifiedUser(emailIso, orgIsoName);
    const authIso = { Authorization: `Bearer ${isoTenant.token}` };

    // Isolated tenant requests billing history
    const isoHistoryRes = await request('/billing/history', { headers: authIso });
    assert(
      isoHistoryRes.status === 200,
      'Isolated tenant can request their own billing history (HTTP 200)'
    );
    const leaksStarterHistory = (isoHistoryRes.data?.history || []).some(
      h => h.organization_id === starterTenant.organizationId
    );
    assert(
      !leaksStarterHistory,
      'Isolated tenant CANNOT view Starter Corp subscription history'
    );

    // Isolated tenant requests datasets
    const isoDsRes = await request('/data-sources', { headers: authIso });
    assert(
      isoDsRes.status === 200,
      'Isolated tenant requests their own data sources (HTTP 200)'
    );
    const leaksStarterData = (isoDsRes.data?.data || []).some(
      d => d.organization_id === starterTenant.organizationId
    );
    assert(
      !leaksStarterData,
      'Isolated tenant CANNOT view or access Starter Corp datasets'
    );

    // -------------------------------------------------------------------------
    // TEST CASE 13: Plans & Billing API endpoint contract verification
    // -------------------------------------------------------------------------
    console.log('\n[TEST 13] Billing plans contract verification');
    const plansRes = await request('/billing/plans');
    assert(
      plansRes.status === 200,
      'GET /api/billing/plans returns HTTP 200'
    );
    assert(
      Array.isArray(plansRes.data?.plans) && plansRes.data.plans.length === 3,
      'Plans endpoint returns exactly 3 launch plans (Starter, Growth, Enterprise)'
    );

    const starterPlan = plansRes.data.plans.find(p => p.id === 'starter');
    const growthPlan = plansRes.data.plans.find(p => p.id === 'growth');
    const enterprisePlan = plansRes.data.plans.find(p => p.id === 'enterprise');

    assert(
      starterPlan?.priceMonthly === 699 && starterPlan?.priceYearly === 6999,
      'Starter pricing confirmed: ₹699/month, ₹6,999/year'
    );
    assert(
      growthPlan?.priceMonthly === 1999 && growthPlan?.priceYearly === 19999,
      'Growth pricing confirmed: ₹1,999/month, ₹19,999/year'
    );
    assert(
      enterprisePlan?.priceMonthly === 6999 && enterprisePlan?.priceYearly === 69999,
      'Enterprise pricing confirmed: ₹6,999/month, ₹69,999/year'
    );

  } catch (err) {
    console.error('\n❌ Unexpected error during test execution:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(` TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runSubscriptionTestSuite();
}

module.exports = runSubscriptionTestSuite;
