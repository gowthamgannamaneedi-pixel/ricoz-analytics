/**
 * Comprehensive Automated Test Suite:
 * RicozAnalytics — SaaS Authentication, 14-Day Free Trial, Tenant Isolation & Stripe Billing
 */

const http = require('http');
const crypto = require('crypto');
const app = require('./app');

const TEST_PORT = process.env.TEST_PORT || 5098;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

// Helper to make HTTP requests
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

// Test assertions runner
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

async function runTests() {
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
    console.warn(`Port ${TEST_PORT} already running or error:`, err.message);
  }

  console.log('================================================================');
  console.log(' STARTING SAAS TRIAL, TENANT ISOLATION & PAYMENT TEST SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const orgAName = `Apex Dynamics ${timestamp}`;
  const userAEmail = `founder_${timestamp}@apexdynamics.com`;
  const orgBName = `Nexus Systems ${timestamp}`;
  const userBEmail = `cto_${timestamp}@nexussystems.com`;

  // --------------------------------------------------------------------------
  // 1. REGISTRATION TESTS
  // --------------------------------------------------------------------------
  console.log('[SUITE 1] SaaS User Registration & Tenant Provisioning');

  // 1.1 Missing organization validation
  const missingOrgRes = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Test User', email: userAEmail, password: 'password123' }
  });
  assert(missingOrgRes.status === 400, 'Registration rejects missing organization_name with HTTP 400');

  // 1.2 Weak password validation
  const weakPassRes = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Test User', email: userAEmail, organization_name: orgAName, password: '123' }
  });
  assert(weakPassRes.status === 400, 'Registration rejects password < 6 characters with HTTP 400');

  // 1.3 Successful registration of Org A (User A)
  const regARes = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Aarav Founder',
      email: userAEmail,
      organization_name: orgAName,
      password: 'SecurePassword123!'
    }
  });
  assert(regARes.status === 201, 'User A registered successfully with HTTP 201');
  assert(regARes.data?.requiresVerification === true, 'Registration flags requiresVerification: true');
  assert(regARes.data?.user?.role === 'admin', 'Account creator is assigned owner/admin role');
  assert(regARes.data?.user?.status === 'pending_verification', 'User status initialized as pending_verification');

  const otpA = regARes.data?._devVerificationOtp;
  const tokenVerifyA = regARes.data?._devVerificationToken;
  const orgAId = regARes.data?.organization_id;

  assert(Boolean(otpA), '6-digit verification OTP generated server-side');
  assert(Boolean(tokenVerifyA), 'Cryptographic verification link token generated server-side');
  assert(Boolean(orgAId), 'New isolated organization/tenant created');

  // 1.4 Duplicate email validation
  const dupEmailRes = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Duplicate Aarav',
      email: userAEmail,
      organization_name: 'Another Company',
      password: 'SecurePassword123!'
    }
  });
  assert(dupEmailRes.status === 409 || dupEmailRes.status === 400, 'Duplicate email registration rejected');

  // 1.5 Unverified user cannot login
  const unverifiedLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: userAEmail, password: 'SecurePassword123!' }
  });
  assert(unverifiedLoginRes.status === 403, 'Unverified user cannot log in (HTTP 403)');
  assert(unverifiedLoginRes.data?.requiresVerification === true, 'Login payload indicates email verification required');

  // --------------------------------------------------------------------------
  // 2. EMAIL VERIFICATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 2] Email Verification (Token & 6-Digit OTP)');

  // 2.1 Invalid OTP
  const invalidOtpRes = await request('/auth/verify-email', {
    method: 'POST',
    body: { email: userAEmail, otp: '000000' }
  });
  assert(invalidOtpRes.status === 400, 'Invalid OTP code rejected with HTTP 400');

  // 2.2 Valid OTP verification
  const validOtpRes = await request('/auth/verify-email', {
    method: 'POST',
    body: { email: userAEmail, otp: otpA }
  });
  assert(validOtpRes.status === 200, 'Email verified successfully with valid OTP');
  assert(Boolean(validOtpRes.data?.token), 'Auth token returned upon email verification');
  assert(validOtpRes.data?.user?.status === 'active', 'User status transitioned to "active"');

  const tokenA = validOtpRes.data.token;

  // 2.3 Resend verification on already verified account
  const resendVerifiedRes = await request('/auth/resend-verification', {
    method: 'POST',
    body: { email: userAEmail }
  });
  assert(resendVerifiedRes.status === 200 || resendVerifiedRes.status === 400, 'Resend flags account already verified');

  // --------------------------------------------------------------------------
  // 3. ZERO-DATA TENANT INITIALIZATION & ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 3] Zero-Data Workspace & Multi-Tenant Isolation');

  // 3.1 Verify Org A starts completely empty
  const orgADatasets = await request('/datasets', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(orgADatasets.status === 200, 'Org A datasets retrieved');
  const orgADatasetsList = orgADatasets.data?.data || orgADatasets.data?.datasets || [];
  assert(orgADatasetsList.length === 0, 'New Organization starts with 0 datasets (NO demo data inherited)');

  const orgADashboards = await request('/dashboards', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(orgADashboards.status === 200, 'Org A dashboards retrieved');
  const orgADashboardsList = orgADashboards.data?.data || orgADashboards.data?.dashboards || [];
  assert(orgADashboardsList.length === 0, 'New Organization starts with 0 dashboards (NO demo data inherited)');

  // 3.2 Register & Verify Organization B (User B)
  const regBRes = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Maya CTO',
      email: userBEmail,
      organization_name: orgBName,
      password: 'SecurePassword123!'
    }
  });
  assert(regBRes.status === 201, 'User B registered for Org B');
  const otpB = regBRes.data?._devVerificationOtp;
  const orgBId = regBRes.data?.organization_id;
  assert(orgAId !== orgBId, 'Organization A and Organization B have distinct, isolated IDs');

  const verifyBRes = await request('/auth/verify-email', {
    method: 'POST',
    body: { email: userBEmail, otp: otpB }
  });
  assert(verifyBRes.status === 200, 'User B verified email');
  const tokenB = verifyBRes.data.token;

  // 3.3 Create a dataset specifically for Org A via API
  const createDsRes = await request('/datasets/dev-create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: 'Apex Confidential Q4 Sales', rowCount: 500 }
  });
  assert(createDsRes.status === 201, 'Dataset created for Org A');
  const datasetAId = createDsRes.data?.dataset?.id;
  assert(Boolean(datasetAId), 'Dataset A has valid ID');

  // User A can see Dataset A
  const userADatasets = await request('/datasets', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const userADatasetItems = userADatasets.data?.data || userADatasets.data?.datasets || [];
  assert(userADatasetItems.some(d => String(d.id) === String(datasetAId)), 'User A can see Dataset A in Org A');

  // User B MUST NOT see Dataset A
  const userBDatasets = await request('/datasets', {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const userBDatasetItems = userBDatasets.data?.data || userBDatasets.data?.datasets || [];
  assert(!userBDatasetItems.some(d => String(d.id) === String(datasetAId)), 'User B (Org B) CANNOT see Dataset A');

  // User B attempting direct access to Dataset A -> DENIED (404/403)
  const directAccessRes = await request(`/datasets/${datasetAId}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(directAccessRes.status === 404 || directAccessRes.status === 403, 'Cross-tenant direct dataset access is DENIED (HTTP 404/403)');

  // --------------------------------------------------------------------------
  // 4. 14-DAY TRIAL LIFECYCLE & ACCESS CONTROL
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 4] 14-Day Free Trial & Subscription Lifecycle');

  // 4.1 Check active trial telemetry
  const subRes = await request('/billing/subscription', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(subRes.status === 200, 'Billing subscription telemetry retrieved');
  assert(subRes.data?.subscription?.status === 'trial', 'Subscription status is "trial"');
  assert(subRes.data?.subscription?.daysRemaining === 14, 'Days remaining in trial is exactly 14');
  assert(subRes.data?.subscription?.hasWorkspaceAccess === true, 'Workspace access is active during trial');

  // 4.2 Simulate trial expiration via backend endpoint
  const expireSimRes = await request('/billing/dev-simulate-trial-expiry', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(expireSimRes.status === 200, 'Trial expiration simulated on server');

  // 4.3 Attempting to access protected workspace endpoint when trial is expired -> HTTP 402 Payment Required
  const expiredAccessRes = await request('/datasets', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(expiredAccessRes.status === 402, 'Expired trial triggers HTTP 402 Payment Required');
  assert(expiredAccessRes.data?.requiresSubscription === true, 'Payload signals requiresSubscription: true');
  assert(expiredAccessRes.data?.subscription?.status === 'trial_expired', 'Subscription status marked trial_expired');

  // 4.4 Verify billing endpoints remain accessible to upgrade
  const billingPlansRes = await request('/billing/plans');
  assert(billingPlansRes.status === 200, 'Billing plans endpoint accessible when trial expired');

  const billingSubExpiredRes = await request('/billing/subscription', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(billingSubExpiredRes.status === 200, 'Billing subscription endpoint accessible to review plans');

  // --------------------------------------------------------------------------
  // 5. STRIPE PAYMENT & WEBHOOK VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 5] Stripe Payment & Cryptographic Webhook');

  // 5.1 Create checkout session
  const checkoutRes = await request('/billing/create-checkout-session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { planId: 'growth', interval: 'monthly' }
  });
  assert(checkoutRes.status === 200, 'Checkout session created successfully');
  assert(Boolean(checkoutRes.data?.checkoutUrl), 'Stripe checkout URL returned');

  // 5.2 Simulate Stripe Webhook: checkout.session.completed with signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_placeholder_ricoz_2026';
  const webhookPayload = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${timestamp}`,
        customer: `cus_test_${timestamp}`,
        subscription: `sub_test_${timestamp}`,
        amount_total: 14900,
        metadata: {
          organizationId: orgAId,
          planId: 'growth'
        }
      }
    }
  });

  const timestampHeader = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestampHeader}.${webhookPayload}`)
    .digest('hex');
  const stripeSignatureHeader = `t=${timestampHeader},v1=${signature}`;

  // 5.3 Test invalid signature rejection
  const invalidWebhookRes = await request('/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=12345,v1=invalid_signature_hash' },
    body: webhookPayload
  });
  assert(invalidWebhookRes.status === 400, 'Invalid webhook signature rejected with HTTP 400');

  // 5.4 Test valid webhook handling
  const validWebhookRes = await request('/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripeSignatureHeader },
    body: webhookPayload
  });
  assert(validWebhookRes.status === 200, 'Verified Stripe webhook processed successfully');

  // 5.5 Verify Org A workspace access is now unblocked
  const unblockedRes = await request('/datasets', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(unblockedRes.status === 200, 'Paid subscription unblocks workspace access (HTTP 200)');

  // 5.6 Verify data was preserved after trial expiration and payment
  const unblockedDatasets = unblockedRes.data?.data || unblockedRes.data?.datasets || [];
  assert(unblockedDatasets.some(d => String(d.id) === String(datasetAId)), 'Zero Data Loss: Dataset A is fully intact and accessible');

  // --------------------------------------------------------------------------
  // 6. TEAM INVITATIONS & RBAC CONTROLS
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 6] Team Member Invitations & RBAC Controls');

  const inviteeEmail = `analyst_${timestamp}@apexdynamics.com`;

  // 6.1 Admin creates invitation for analyst
  const inviteRes = await request('/admin/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { email: inviteeEmail, role: 'analyst' }
  });
  assert(inviteRes.status === 201, 'Admin invited new member with HTTP 201');
  const inviteToken = inviteRes.data?.invitation?.token;
  assert(Boolean(inviteToken), 'Single-use cryptographic invitation token generated');

  // 6.2 Admin lists invitations
  const listInvitesRes = await request('/admin/invitations', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(listInvitesRes.status === 200, 'Admin can list pending invitations');
  const invitesList = listInvitesRes.data?.invitations || [];
  assert(invitesList.some(i => i.email === inviteeEmail), 'Invited member appears in pending invitations list');

  // 6.3 Invitee inspects invitation
  const inspectInviteRes = await request(`/auth/invite/${inviteToken}`);
  assert(inspectInviteRes.status === 200, 'Invitee can fetch invitation details');
  assert(inspectInviteRes.data?.invitation?.role === 'analyst', 'Invitation preserves assigned role "analyst"');

  // 6.4 Invitee accepts invitation
  const acceptRes = await request('/auth/accept-invite', {
    method: 'POST',
    body: {
      token: inviteToken,
      name: 'Rohan Analyst',
      password: 'SecurePassword123!'
    }
  });
  assert(acceptRes.status === 200, 'Invitee accepted invitation and set password');
  assert(acceptRes.data?.user?.organization_id === orgAId, 'Invited member joined the SAME organization (Org A)');
  assert(acceptRes.data?.user?.role === 'analyst', 'Invited member has role "analyst"');

  // 6.5 Verify invitation token is single-use
  const reuseInviteRes = await request('/auth/accept-invite', {
    method: 'POST',
    body: {
      token: inviteToken,
      name: 'Hacker',
      password: 'SecurePassword123!'
    }
  });
  assert(reuseInviteRes.status === 400, 'Reusing an already-accepted invitation token is REJECTED');

  // 6.6 RBAC: Login as analyst and attempt an admin operation
  const analystLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: inviteeEmail, password: 'SecurePassword123!' }
  });
  assert(analystLoginRes.status === 200, 'Analyst logged in successfully');
  const tokenAnalyst = analystLoginRes.data?.token;

  const analystAdminAttempt = await request('/admin/organization', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenAnalyst}` },
    body: { name: 'Hacked Org Name' }
  });
  assert(analystAdminAttempt.status === 403, 'Analyst denied from admin organization modification with HTTP 403');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================');

  if (server) {
    await new Promise(r => server.close(r));
  }

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
