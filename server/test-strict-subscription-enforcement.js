/**
 * Enterprise Strict Subscription Enforcement & Pricing Acceptance Test Suite
 * RicozAnalytics — Production Readiness Verification
 * 
 * Verifies:
 * 1. Authoritative subscription states across all mutations (active, trialing, expired, past_due, pending, suspended, on_hold).
 * 2. Admin & Manager role bypass prevention on expired accounts.
 * 3. Preserved read-only customer data access on expired accounts.
 * 4. Mathematical 44% annual discount verification across all tiers.
 * 5. Webhook cryptographic verification and persistent deduplication / idempotency.
 */

const http = require('http');
const crypto = require('crypto');
const app = require('./app');
const db = require('./config/database');
const { PLANS } = require('./config/plans');
const subscriptionService = require('./services/subscriptionService');
const razorpayService = require('./services/razorpayService');
const jwt = require('jsonwebtoken');
const config = require('./config');

const TEST_SECRET = config.jwtSecret || 'test_jwt_secret_ricoz_2026';
const TEST_PORT = process.env.TEST_PORT || 5092;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function makeRequest(path, options = {}) {
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

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id
    },
    TEST_SECRET,
    { expiresIn: '2h' }
  );
}

async function runAcceptanceTests() {
  console.log('\n================================================================');
  console.log('🚀 RICOZANALYTICS STRICT SUBSCRIPTION & PRICING VERIFICATION');
  console.log('================================================================\n');

  // Start in-process HTTP test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`📡 In-process test server listening on port ${TEST_PORT}`);

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

  try {
    // -------------------------------------------------------------
    // PART 1: PRICING CONFIGURATION & MATHEMATICAL 44% DISCOUNT MATH
    // -------------------------------------------------------------
    console.log('\n--- PART 1: PRICING MATHEMATICAL DISCOUNT VERIFICATION ---');

    const tiers = ['starter', 'growth', 'enterprise'];
    const expectedMath = {
      starter: { monthly: 699, annual: 4697, savings: 3691, discount: 44 },
      growth: { monthly: 1999, annual: 13433, savings: 10555, discount: 44 },
      enterprise: { monthly: 6999, annual: 47033, savings: 36955, discount: 44 }
    };

    for (const tierKey of tiers) {
      const plan = PLANS[tierKey];
      const exp = expectedMath[tierKey];

      assert(plan.priceMonthly === exp.monthly, `${plan.name} monthly price is ₹${exp.monthly}`);
      assert(plan.priceYearly === exp.annual, `${plan.name} yearly price is ₹${exp.annual}`);
      assert(plan.priceAnnual === exp.annual, `${plan.name} annual price alias is ₹${exp.annual}`);

      const fullAnnualMonthly = plan.priceMonthly * 12;
      const computedSavings = fullAnnualMonthly - plan.priceYearly;
      const computedDiscount = Math.round((computedSavings / fullAnnualMonthly) * 100);

      assert(computedSavings === exp.savings, `${plan.name} annual savings is exactly ₹${exp.savings}`);
      assert(computedDiscount === 44, `${plan.name} annual discount evaluates to exactly 44% (got ${computedDiscount}%)`);
      assert(plan.discountPercentYearly === 44, `${plan.name} discountPercentYearly config is 44%`);
    }

    // Verify GET /api/billing/plans API endpoint returns authoritative plans
    const plansRes = await makeRequest('/billing/plans');
    assert(plansRes.status === 200, 'GET /api/billing/plans returns HTTP 200');
    const returnedPlans = plansRes.body.plans || [];
    const returnedGrowth = returnedPlans.find(p => p.id === 'growth');
    assert(returnedGrowth && returnedGrowth.priceYearly === 13433, 'API returns Growth annual price as ₹13,433');
    assert(returnedGrowth && returnedGrowth.discountPercentYearly === 44, 'API returns Growth annual discount as 44%');

    // -------------------------------------------------------------
    // PART 2: TEST TENANT PROVISIONING ACROSS ALL SUBSCRIPTION STATES
    // -------------------------------------------------------------
    console.log('\n--- PART 2: PROVISIONING TEST TENANTS ACROSS SUBSCRIPTION STATES ---');

    const now = new Date();
    const pastDate = new Date(now.getTime() - 15 * 86400000); // 15 days ago (expired)
    const futureDate = new Date(now.getTime() + 14 * 86400000); // 14 days in future

    // Ensure test organizations exist with exact subscription states
    const testOrgs = [
      {
        id: '11111111-1111-1111-1111-111111111101',
        name: 'Test Tenant Active Paid',
        plan: 'growth',
        status: 'active',
        start: pastDate,
        end: futureDate,
        trialEnd: pastDate
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        name: 'Test Tenant Trialing',
        plan: 'starter',
        status: 'trial',
        start: now,
        end: null,
        trialEnd: futureDate
      },
      {
        id: '11111111-1111-1111-1111-111111111103',
        name: 'Test Tenant Trial Expired',
        plan: 'starter',
        status: 'trial_expired',
        start: pastDate,
        end: null,
        trialEnd: pastDate
      },
      {
        id: '11111111-1111-1111-1111-111111111104',
        name: 'Test Tenant Enterprise Expired',
        plan: 'enterprise',
        status: 'expired',
        start: pastDate,
        end: pastDate,
        trialEnd: pastDate
      },
      {
        id: '11111111-1111-1111-1111-111111111105',
        name: 'Test Tenant Past Due',
        plan: 'growth',
        status: 'past_due',
        start: pastDate,
        end: pastDate,
        trialEnd: pastDate
      },
      {
        id: '11111111-1111-1111-1111-111111111106',
        name: 'Test Tenant Suspended',
        plan: 'starter',
        status: 'suspended',
        start: pastDate,
        end: pastDate,
        trialEnd: pastDate
      },
      {
        id: '11111111-1111-1111-1111-111111111107',
        name: 'Test Tenant Payment Pending',
        plan: 'starter',
        status: 'payment_pending',
        start: pastDate,
        end: pastDate,
        trialEnd: pastDate
      }
    ];

    for (const org of testOrgs) {
      await db.query(
        `INSERT INTO organizations (id, name, slug, plan, subscription_status, current_period_start, current_period_end, trial_started_at, trial_ends_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           plan = EXCLUDED.plan,
           subscription_status = EXCLUDED.subscription_status,
           current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end,
           trial_started_at = EXCLUDED.trial_started_at,
           trial_ends_at = EXCLUDED.trial_ends_at,
           updated_at = CURRENT_TIMESTAMP`,
        [
          org.id,
          org.name,
          `slug-${org.id.replace(/-/g, '').slice(-12)}`,
          org.plan,
          org.status,
          org.start ? org.start.toISOString() : null,
          org.end ? org.end.toISOString() : null,
          org.start ? org.start.toISOString() : null,
          org.trialEnd ? org.trialEnd.toISOString() : null
        ]
      );

      subscriptionService.clearOrganizationCache(org.id);
    }

    // Create test users for test tenants
    const testUsers = [
      { id: 9801, name: 'Active Admin', email: 'active_admin@test.local', role: 'admin', orgId: testOrgs[0].id },
      { id: 9802, name: 'Trial Admin', email: 'trial_admin@test.local', role: 'admin', orgId: testOrgs[1].id },
      { id: 9803, name: 'Expired Admin', email: 'expired_admin@test.local', role: 'admin', orgId: testOrgs[2].id },
      { id: 9804, name: 'Enterprise Expired Admin', email: 'enterprise_expired_admin@test.local', role: 'admin', orgId: testOrgs[3].id },
      { id: 9805, name: 'PastDue Admin', email: 'pastdue_admin@test.local', role: 'admin', orgId: testOrgs[4].id },
      { id: 9806, name: 'Suspended Admin', email: 'suspended_admin@test.local', role: 'admin', orgId: testOrgs[5].id },
      { id: 9807, name: 'Pending Admin', email: 'pending_admin@test.local', role: 'admin', orgId: testOrgs[6].id }
    ];

    for (const u of testUsers) {
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role, organization_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'hash123', $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           organization_id = EXCLUDED.organization_id,
           status = 'active',
           updated_at = CURRENT_TIMESTAMP`,
        [u.id, u.name, u.email, u.role, u.orgId]
      );
    }

    const activeToken = generateTestToken(testUsers[0]);
    const trialToken = generateTestToken(testUsers[1]);
    const expiredToken = generateTestToken(testUsers[2]);
    const enterpriseExpiredToken = generateTestToken(testUsers[3]);
    const pastDueToken = generateTestToken(testUsers[4]);
    const suspendedToken = generateTestToken(testUsers[5]);
    const pendingToken = generateTestToken(testUsers[6]);

    console.log('  ✅ 7 Test Tenants and Authenticated Sessions Provisioned');

    // -------------------------------------------------------------
    // PART 3: MUTATION LOCKOUT ON EXPIRED / RESTRICTED TENANTS
    // -------------------------------------------------------------
    console.log('\n--- PART 3: STRICT MUTATION LOCKOUT (ZERO WRITES/AI ON EXPIRED ACCOUNTS) ---');

    // 1. Data Source Upload / Connection Lockout
    const uploadRes = await makeRequest('/data-sources/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { type: 'postgresql', config: {} }
    });

    assert(
      uploadRes.status === 402,
      `Expired account connection test blocked with HTTP 402 (got ${uploadRes.status})`
    );
    assert(
      uploadRes.body.code === 'TRIAL_EXPIRED' || uploadRes.body.code === 'SUBSCRIPTION_EXPIRED',
      `Returns authoritative error code (got ${uploadRes.body.code})`
    );

    // 2. Enterprise Tier with Expired Status CANNOT bypass mutation block
    const entUploadRes = await makeRequest('/data-sources/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${enterpriseExpiredToken}` },
      body: { type: 'postgresql', config: {} }
    });

    assert(
      entUploadRes.status === 402,
      `Enterprise tier with expired status is strictly blocked with HTTP 402 (got ${entUploadRes.status})`
    );

    // 3. Metric / KPI Creation Lockout
    const metricRes = await makeRequest('/metrics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { name: 'Gross Profit Test', formula: 'revenue - cogs' }
    });

    assert(
      metricRes.status === 402,
      `Expired account KPI creation blocked with HTTP 402 (got ${metricRes.status})`
    );

    // 4. Forecast Generation Lockout
    const forecastRes = await makeRequest('/forecasts/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { datasetId: 1, targetColumn: 'revenue' }
    });

    assert(
      forecastRes.status === 402,
      `Expired account Forecast generation blocked with HTTP 402 (got ${forecastRes.status})`
    );

    // 5. AI Insights Generation Lockout
    const insightGenRes = await makeRequest('/insights/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { datasetId: 1 }
    });

    assert(
      insightGenRes.status === 402,
      `Expired account AI Insight generation blocked with HTTP 402 (got ${insightGenRes.status})`
    );

    // 6. AI Assistant Query Lockout
    const aiQueryRes = await makeRequest('/ai/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${enterpriseExpiredToken}` },
      body: { query: 'how to increase sales' }
    });

    assert(
      aiQueryRes.status === 402,
      `Expired account AI assistant chat blocked with HTTP 402 (got ${aiQueryRes.status})`
    );

    // 7. Dashboard Creation Lockout
    const dashRes = await makeRequest('/dashboards', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { name: 'Executive Dashboard Test' }
    });

    assert(
      dashRes.status === 402,
      `Expired account Dashboard creation blocked with HTTP 402 (got ${dashRes.status})`
    );

    // 8. Report Creation Lockout
    const reportRes = await makeRequest('/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { name: 'Quarterly Summary Test' }
    });

    assert(
      reportRes.status === 402,
      `Expired account Report creation blocked with HTTP 402 (got ${reportRes.status})`
    );

    // 9. Admin Member Invitation Lockout
    const inviteRes = await makeRequest('/admin/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { email: 'newmember@test.local', role: 'analyst' }
    });

    assert(
      inviteRes.status === 402,
      `Expired account Team member invitation blocked with HTTP 402 (got ${inviteRes.status})`
    );

    // 10. Admin User Role Mutation Lockout
    const roleRes = await makeRequest('/admin/users/9801/role', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${expiredToken}` },
      body: { role: 'manager' }
    });

    assert(
      roleRes.status === 402,
      `Expired account User role update blocked with HTTP 402 (got ${roleRes.status})`
    );

    // 11. Past Due Account Lockout
    const pastDueRes = await makeRequest('/data-sources/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pastDueToken}` },
      body: { type: 'postgresql', config: {} }
    });

    assert(
      pastDueRes.status === 402,
      `Past-due account connection test blocked with HTTP 402 (got ${pastDueRes.status})`
    );

    // 12. Payment Pending Account Lockout
    const pendingRes = await makeRequest('/data-sources/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pendingToken}` },
      body: { type: 'postgresql', config: {} }
    });

    assert(
      pendingRes.status === 402,
      `Payment-pending account connection test blocked with HTTP 402 (got ${pendingRes.status})`
    );

    // -------------------------------------------------------------
    // PART 4: PRESERVED READ-ONLY ACCESS TO EXISTING CUSTOMER DATA
    // -------------------------------------------------------------
    console.log('\n--- PART 4: PRESERVED READ-ONLY ACCESS (SAFE DATA RETENTION) ---');

    // 1. Expired account can READ existing datasets
    const getDatasetsRes = await makeRequest('/datasets', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert(
      getDatasetsRes.status === 200,
      `Expired account can READ existing datasets (HTTP 200, got ${getDatasetsRes.status})`
    );

    // 2. Expired account can READ existing data sources
    const getDataSourcesRes = await makeRequest('/data-sources', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert(
      getDataSourcesRes.status === 200,
      `Expired account can READ existing data sources (HTTP 200, got ${getDataSourcesRes.status})`
    );

    // 3. Expired account can READ existing dashboards
    const getDashboardsRes = await makeRequest('/dashboards', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert(
      getDashboardsRes.status === 200,
      `Expired account can READ existing dashboards (HTTP 200, got ${getDashboardsRes.status})`
    );

    // 4. Expired account can READ existing reports
    const getReportsRes = await makeRequest('/reports', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert(
      getReportsRes.status === 200,
      `Expired account can READ existing reports (HTTP 200, got ${getReportsRes.status})`
    );

    // 5. Expired account can READ existing metrics
    const getMetricsRes = await makeRequest('/metrics', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert(
      getMetricsRes.status === 200,
      `Expired account can READ existing metrics (HTTP 200, got ${getMetricsRes.status})`
    );

    // 6. Suspended Account has ZERO access (HTTP 403)
    const suspendedGetRes = await makeRequest('/data-sources/test-connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${suspendedToken}` },
      body: { type: 'postgresql', config: {} }
    });

    assert(
      suspendedGetRes.status === 403,
      `Suspended account is blocked from workspace with HTTP 403 (got ${suspendedGetRes.status})`
    );

    // -------------------------------------------------------------
    // PART 5: AUTHORITATIVE STATUS DISPLAY STRING (PRIORITY 4)
    // -------------------------------------------------------------
    console.log('\n--- PART 5: GLOBAL SUBSCRIPTION STATUS FORMAT CONSISTENCY ---');

    const subActive = await subscriptionService.getOrganizationSubscription(testOrgs[0].id, { forceFresh: true });
    assert(subActive.displayPlanStatus === 'Growth — Active', `Active plan formats as "Growth — Active" (got "${subActive.displayPlanStatus}")`);

    const subTrial = await subscriptionService.getOrganizationSubscription(testOrgs[1].id, { forceFresh: true });
    assert(subTrial.displayPlanStatus.startsWith('Starter — Trial'), `Trial plan formats as "Starter — Trial (...)" (got "${subTrial.displayPlanStatus}")`);

    const subExpired = await subscriptionService.getOrganizationSubscription(testOrgs[2].id, { forceFresh: true });
    assert(subExpired.displayPlanStatus === 'Starter — Trial Expired', `Trial expired formats as "Starter — Trial Expired" (got "${subExpired.displayPlanStatus}")`);

    const subEntExpired = await subscriptionService.getOrganizationSubscription(testOrgs[3].id, { forceFresh: true });
    assert(subEntExpired.displayPlanStatus === 'Enterprise — Expired', `Enterprise expired formats as "Enterprise — Expired" (got "${subEntExpired.displayPlanStatus}")`);

    const subPastDue = await subscriptionService.getOrganizationSubscription(testOrgs[4].id, { forceFresh: true });
    assert(subPastDue.displayPlanStatus === 'Growth — Past Due', `Past due formats as "Growth — Past Due" (got "${subPastDue.displayPlanStatus}")`);

    const subPending = await subscriptionService.getOrganizationSubscription(testOrgs[6].id, { forceFresh: true });
    assert(subPending.displayPlanStatus === 'Starter — Payment Pending', `Payment pending formats as "Starter — Payment Pending" (got "${subPending.displayPlanStatus}")`);

    // -------------------------------------------------------------
    // PART 6: WEBHOOK SIGNATURE VERIFICATION & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- PART 6: WEBHOOK SIGNATURE & IDEMPOTENCY VERIFICATION ---');

    // Test 1: Reject missing / invalid signature
    const badWebhookRes = await makeRequest('/billing/razorpay-webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'invalid_fake_sig' },
      body: { event: 'order.paid' }
    });

    assert(
      badWebhookRes.status === 400,
      `Invalid webhook signature returns HTTP 400 (got ${badWebhookRes.status})`
    );

    // Test 2: Cryptographically signed webhook
    const secret = razorpayService.webhookSecret || 'test_webhook_secret_placeholder';
    const eventPayload = {
      event: 'order.paid',
      id: `evt_test_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: `pay_test_${Date.now()}`,
            order_id: `order_test_${Date.now()}`,
            amount: 1343300, // ₹13,433 in paise
            currency: 'INR',
            status: 'captured',
            notes: {
              organization_id: testOrgs[2].id,
              plan_id: 'growth',
              billing_interval: 'yearly'
            }
          }
        }
      }
    };

    const payloadString = JSON.stringify(eventPayload);
    const validSignature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    const RazorpayOrderModel = require('./models/razorpayOrderModel');
    // Create order record so webhook has target to reconcile
    await RazorpayOrderModel.createOrder({
      orderId: eventPayload.payload.payment.entity.order_id,
      organizationId: testOrgs[2].id,
      userId: 9801,
      planId: 'growth',
      billingInterval: 'yearly',
      amountPaise: 1343300
    });

    const goodWebhookRes = await makeRequest('/billing/razorpay-webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': validSignature },
      body: payloadString
    });

    assert(
      goodWebhookRes.status === 200,
      `Valid HMAC-SHA256 signed webhook returns HTTP 200 (got ${goodWebhookRes.status})`
    );

    // Test 3: Deduplication / Idempotent replay of identical webhook event
    const duplicateWebhookRes = await makeRequest('/billing/razorpay-webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': validSignature },
      body: payloadString
    });

    assert(
      duplicateWebhookRes.status === 200 && duplicateWebhookRes.body.duplicate === true,
      `Duplicate webhook delivery safely detected and acknowledged (duplicate: true)`
    );

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAcceptanceTests().catch(err => {
  console.error('\n❌ Unhandled error in acceptance test:', err);
  process.exit(1);
});
