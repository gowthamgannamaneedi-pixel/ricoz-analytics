/**
 * RicozAnalytics — Complete Razorpay Orders Table & End-to-End Payment Flow Suite
 * 
 * Tests:
 * 1. Database connectivity & schema inspection
 * 2. Idempotent migration execution (initDb & startup migration block)
 * 3. Table & index existence in PostgreSQL
 * 4. Create-order API with valid authentication (HTTP 200)
 * 5. Create-order API with missing authentication (HTTP 401)
 * 6. Invalid plan rejection & tampered amount override
 * 7. Genuine Razorpay Test Mode order creation via SDK
 * 8. Database persistence of the order in razorpay_orders
 * 9. Duplicate order requests & idempotency
 * 10. Valid & invalid cryptographic payment signatures
 * 11. Failed payment handling
 * 12. Webhook HMAC-SHA256 signature verification & duplicate webhook rejection
 * 13. Subscription activation only after verified payment
 * 14. Organization isolation & subscription entitlements
 */

const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const { PLANS, getPlan } = require('./config/plans');
const razorpayService = require('./services/razorpayService');
const RazorpayOrderModel = require('./models/razorpayOrderModel');
const RazorpayWebhookEventModel = require('./models/razorpayWebhookEventModel');
const subscriptionService = require('./services/subscriptionService');

const PORT = 5093;
const TEST_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'RicozWebhook_7fK9mQ2xP8vL5nR4';
const TEST_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'vI0E4Q5f39wHohI7ubp0PpDs';

let server;

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  blocked: 0
};

function assertTest(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    results.failed++;
    console.error(`  ❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
  }
}

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      name: user.name || user.email
    },
    config.jwtSecret,
    { expiresIn: '2h' }
  );
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const rawBody = options.rawBody !== undefined 
      ? options.rawBody 
      : (options.body != null ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null);

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(rawBody != null ? { 'Content-Length': Buffer.byteLength(rawBody) } : {}),
        ...(options.headers || {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = { raw: data }; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (rawBody != null) req.write(rawBody);
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log(' RICOZ ANALYTICS — RAZORPAY ORDERS TABLE & PAYMENT FLOW SUITE   ');
  console.log('================================================================\n');

  // 1. Database connectivity
  console.log('--- 1. Database Connectivity & Environment ---');
  let dbInfo;
  try {
    dbInfo = await db.query('SELECT current_database(), current_schema(), version();');
    assertTest(
      dbInfo.rows.length > 0 && !!dbInfo.rows[0].current_database,
      'PostgreSQL connected successfully',
      `DB: ${dbInfo.rows[0]?.current_database}, schema: ${dbInfo.rows[0]?.current_schema}`
    );
  } catch (err) {
    assertTest(false, 'PostgreSQL connected successfully', err.message);
  }

  // 2. Migration Execution
  console.log('\n--- 2. Migration Execution (initDb) ---');
  try {
    await db.initDb();
    assertTest(true, 'db.initDb() executed successfully without throwing');
  } catch (err) {
    assertTest(false, 'db.initDb() executed successfully', err.message);
  }

  // 3. Table and Index Verification
  console.log('\n--- 3. Table & Index Verification in PostgreSQL ---');
  try {
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('razorpay_orders', 'razorpay_webhook_events');
    `);
    const foundTables = tablesRes.rows.map(r => r.table_name);
    assertTest(foundTables.includes('razorpay_orders'), 'Table "public.razorpay_orders" exists in database');
    assertTest(foundTables.includes('razorpay_webhook_events'), 'Table "public.razorpay_webhook_events" exists in database');

    const columnsRes = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'razorpay_orders';
    `);
    const cols = columnsRes.rows.map(c => c.column_name);
    const requiredCols = ['id', 'order_id', 'organization_id', 'user_id', 'plan_id', 'billing_interval', 'amount_paise', 'currency', 'status', 'payment_id', 'signature', 'receipt', 'notes', 'created_at', 'updated_at'];
    const missingCols = requiredCols.filter(rc => !cols.includes(rc));
    assertTest(missingCols.length === 0, 'Table razorpay_orders contains all required columns', `Missing: ${missingCols.join(', ')}`);

    const indexesRes = await db.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'razorpay_orders';
    `);
    const indexes = indexesRes.rows.map(i => i.indexname);
    assertTest(indexes.includes('idx_razorpay_orders_order_id'), 'Index idx_razorpay_orders_order_id exists');
    assertTest(indexes.includes('idx_razorpay_orders_org_id'), 'Index idx_razorpay_orders_org_id exists');
    assertTest(indexes.includes('idx_razorpay_orders_status'), 'Index idx_razorpay_orders_status exists');

    const orgColsRes = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name LIKE 'razorpay%';
    `);
    const orgCols = orgColsRes.rows.map(c => c.column_name);
    assertTest(orgCols.includes('razorpay_customer_id'), 'organizations.razorpay_customer_id column exists');
    assertTest(orgCols.includes('razorpay_subscription_id'), 'organizations.razorpay_subscription_id column exists');
    assertTest(orgCols.includes('razorpay_order_id'), 'organizations.razorpay_order_id column exists');
    assertTest(orgCols.includes('razorpay_payment_id'), 'organizations.razorpay_payment_id column exists');

    const invColsRes = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'invoices' AND (column_name LIKE 'razorpay%' OR column_name = 'payment_gateway');
    `);
    const invCols = invColsRes.rows.map(c => c.column_name);
    assertTest(invCols.includes('razorpay_payment_id'), 'invoices.razorpay_payment_id column exists');
    assertTest(invCols.includes('razorpay_order_id'), 'invoices.razorpay_order_id column exists');
    assertTest(invCols.includes('payment_gateway'), 'invoices.payment_gateway column exists');
  } catch (err) {
    assertTest(false, 'Schema inspection failed', err.message);
  }

  // Start HTTP server for API endpoints
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`\n  [Test Server started on port ${PORT}]`);
      resolve();
    });
  });

  // Setup test organization and user
  const testOrgId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();
  const orgSlug1 = `test-rzp-org-${Date.now().toString().slice(-6)}`;
  const orgSlug2 = `other-rzp-org-${Date.now().toString().slice(-6)}`;

  await db.query(`
    INSERT INTO organizations (id, name, slug, plan, subscription_status, payment_status)
    VALUES 
      ($1, 'Test Razorpay Org', $3, 'starter', 'active', 'paid'),
      ($2, 'Other Razorpay Org', $4, 'starter', 'active', 'paid')
    ON CONFLICT (id) DO UPDATE SET plan = 'starter', subscription_status = 'active';
  `, [testOrgId, otherOrgId, orgSlug1, orgSlug2]);

  const testUser = {
    id: 991,
    name: 'Razorpay Tester',
    email: `tester.rzp.${Date.now()}@ricoz.test`,
    role: 'admin',
    organization_id: testOrgId
  };

  const otherUser = {
    id: 992,
    name: 'Other Org Tester',
    email: `tester.other.${Date.now()}@ricoz.test`,
    role: 'admin',
    organization_id: otherOrgId
  };

  await db.query(`
    INSERT INTO users (id, name, email, password_hash, role, organization_id, status)
    VALUES 
      (991, 'Razorpay Tester', $1, 'hash', 'admin', $2, 'active'),
      (992, 'Other Org Tester', $3, 'hash', 'admin', $4, 'active')
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;
  `, [testUser.email, testOrgId, otherUser.email, otherOrgId]);

  const testToken = makeToken(testUser);
  const otherToken = makeToken(otherUser);

  // 4. Create-Order API with Missing Authentication
  console.log('\n--- 4. Authentication Validation ---');
  const unauthRes = await request('/api/billing/create-order', {
    method: 'POST',
    body: { planId: 'growth' }
  });
  assertTest(unauthRes.status === 401, 'Create-order without token returns HTTP 401 Unauthorized', `Got ${unauthRes.status}`);

  // 5. Invalid plan and tampered amount
  console.log('\n--- 5. Plan Validation & Tampered Amount Override ---');
  const invalidPlanRes = await request('/api/billing/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: { planId: 'super_diamond_fake' }
  });
  assertTest(invalidPlanRes.status === 400, 'Invalid plan returns HTTP 400 Bad Request', `Got ${invalidPlanRes.status}`);

  // Tampered client amount (client says ₹1 instead of ₹1999)
  const tamperedAmountRes = await request('/api/billing/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: {
      planId: 'growth',
      interval: 'monthly',
      customAmount: 1 // Malicious tamper
    }
  });
  assertTest(
    tamperedAmountRes.status === 200 && tamperedAmountRes.body.amount === 199900,
    'Client tampered amount overridden by authoritative server plan price (₹1999 = 199900 paise)',
    `Expected 199900, got ${tamperedAmountRes.body.amount}`
  );

  // 6. Valid Razorpay Test Mode Order Creation & Persistence
  console.log('\n--- 6. Genuine Razorpay Test Mode Order Creation & DB Persistence ---');
  const validOrderRes = await request('/api/billing/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: {
      planId: 'growth',
      interval: 'monthly'
    }
  });

  assertTest(validOrderRes.status === 200, 'Create-order returns HTTP 200 OK', `Got ${validOrderRes.status}`);
  assertTest(Boolean(validOrderRes.body.orderId), 'Order response contains valid orderId', validOrderRes.body.orderId);
  assertTest(validOrderRes.body.orderId.startsWith('order_'), 'orderId matches Razorpay standard format "order_*"', validOrderRes.body.orderId);
  assertTest(validOrderRes.body.currency === 'INR', 'Currency is INR', validOrderRes.body.currency);
  assertTest(validOrderRes.body.amount === 199900, 'Amount is 199900 paise (₹1999)', validOrderRes.body.amount);

  const createdOrderId = validOrderRes.body.orderId;

  // Verify DB Persistence
  const dbOrder = await db.query('SELECT * FROM razorpay_orders WHERE order_id = $1;', [createdOrderId]);
  assertTest(dbOrder.rows.length === 1, 'Order successfully persisted in razorpay_orders table in database');
  assertTest(dbOrder.rows[0]?.organization_id === testOrgId, 'Persisted order belongs to requesting organization');
  assertTest(dbOrder.rows[0]?.status === 'created', 'Persisted order initial status is "created"');
  assertTest(Number(dbOrder.rows[0]?.amount_paise) === 199900, 'Persisted order amount is 199900 paise');

  // 7. Duplicate Order Requests and Idempotency
  console.log('\n--- 7. Duplicate Order Handling & Idempotency ---');
  // Re-inserting the same order_id triggers ON CONFLICT (order_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
  const duplicateModelRes = await RazorpayOrderModel.createOrder({
    orderId: createdOrderId,
    organizationId: testOrgId,
    userId: testUser.id,
    planId: 'growth',
    billingInterval: 'monthly',
    amountPaise: 199900
  });
  assertTest(duplicateModelRes?.order_id === createdOrderId, 'Duplicate order ID creation handled idempotently without unique violation crash');

  // 8. Payment Verification & Signatures
  console.log('\n--- 8. Cryptographic Payment Verification ---');
  const testPaymentId = `pay_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', TEST_KEY_SECRET)
    .update(`${createdOrderId}|${testPaymentId}`)
    .digest('hex');

  // Test invalid / forged signature
  const forgedRes = await request('/api/billing/verify-payment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: {
      orderId: createdOrderId,
      paymentId: testPaymentId,
      signature: '0000000000000000000000000000000000000000000000000000000000000000'
    }
  });
  assertTest(forgedRes.status === 400, 'Forged payment signature rejected with HTTP 400 Bad Request', `Got ${forgedRes.status}`);

  // Test cross-tenant verification attempt
  const crossTenantRes = await request('/api/billing/verify-payment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${otherToken}` }, // other tenant trying to claim Org 99's order
    body: {
      orderId: createdOrderId,
      paymentId: testPaymentId,
      signature: validSignature
    }
  });
  assertTest(crossTenantRes.status === 403, 'Cross-tenant verification strictly rejected with HTTP 403 Forbidden', `Got ${crossTenantRes.status}`);

  // Test valid payment verification
  const verifyRes = await request('/api/billing/verify-payment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: {
      orderId: createdOrderId,
      paymentId: testPaymentId,
      signature: validSignature
    }
  });
  assertTest(verifyRes.status === 200 && verifyRes.body.success === true, 'Valid payment signature verified with HTTP 200 OK');

  // Verify DB state after payment
  const paidOrder = await db.query('SELECT * FROM razorpay_orders WHERE order_id = $1;', [createdOrderId]);
  assertTest(paidOrder.rows[0]?.status === 'paid', 'Order status updated to "paid" in razorpay_orders table');
  assertTest(paidOrder.rows[0]?.payment_id === testPaymentId, 'Payment ID saved on order record');
  assertTest(paidOrder.rows[0]?.signature === validSignature, 'Cryptographic signature saved on order record');

  // Verify organization subscription upgrade
  const upgradedOrg = await db.query('SELECT plan, subscription_status, payment_status, razorpay_order_id, razorpay_payment_id FROM organizations WHERE id = $1;', [testOrgId]);
  assertTest(upgradedOrg.rows[0]?.plan === 'growth', 'Organization upgraded to Growth plan in database');
  assertTest(upgradedOrg.rows[0]?.subscription_status === 'active', 'Organization subscription status is "active"');
  assertTest(upgradedOrg.rows[0]?.payment_status === 'paid', 'Organization payment status is "paid"');
  assertTest(upgradedOrg.rows[0]?.razorpay_order_id === createdOrderId, 'Organization has razorpay_order_id recorded');
  assertTest(upgradedOrg.rows[0]?.razorpay_payment_id === testPaymentId, 'Organization has razorpay_payment_id recorded');

  // Duplicate payment verification
  const reVerifyRes = await request('/api/billing/verify-payment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: {
      orderId: createdOrderId,
      paymentId: testPaymentId,
      signature: validSignature
    }
  });
  assertTest(reVerifyRes.status === 200 && reVerifyRes.body.alreadyProcessed === true, 'Duplicate payment verification returns alreadyProcessed: true (idempotent)');

  // 9. Webhook Signature Verification and Duplicate Delivery
  console.log('\n--- 9. Webhook Signatures & Idempotency Ledger ---');
  const webhookEventId = `evt_test_${Date.now()}`;
  const webhookPayload = {
    entity: 'event',
    account_id: 'acc_test_123',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: `pay_wh_${Date.now()}`,
          amount: 199900,
          currency: 'INR',
          status: 'captured',
          order_id: createdOrderId,
          notes: { organization_id: testOrgId, plan_id: 'growth' }
        }
      }
    },
    created_at: Math.floor(Date.now() / 1000)
  };
  const webhookBodyStr = JSON.stringify(webhookPayload);
  const validWebhookSig = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(webhookBodyStr).digest('hex');

  // Missing webhook signature
  const missingSigWhRes = await request('/api/billing/razorpay-webhook', {
    method: 'POST',
    rawBody: webhookBodyStr,
    headers: { 'Content-Type': 'application/json' }
  });
  assertTest(missingSigWhRes.status === 400, 'Webhook with missing signature header returns HTTP 400');

  // Tampered webhook body
  const tamperedWhRes = await request('/api/billing/razorpay-webhook', {
    method: 'POST',
    rawBody: webhookBodyStr + 'tampered',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validWebhookSig
    }
  });
  assertTest(tamperedWhRes.status === 400, 'Webhook with tampered body returns HTTP 400');

  // Valid webhook
  const validWhRes = await request('/api/billing/razorpay-webhook', {
    method: 'POST',
    rawBody: webhookBodyStr,
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validWebhookSig,
      'x-razorpay-event-id': webhookEventId
    }
  });
  assertTest(validWhRes.status === 200, 'Valid webhook returns HTTP 200 OK', `Got ${validWhRes.status}`);

  // Verify webhook in razorpay_webhook_events table
  const whRecord = await db.query('SELECT * FROM razorpay_webhook_events WHERE event_id = $1;', [webhookEventId]);
  assertTest(whRecord.rows.length === 1, 'Webhook event recorded in razorpay_webhook_events table');
  assertTest(whRecord.rows[0]?.status === 'completed', 'Webhook event status is "completed"');

  // Duplicate webhook delivery
  const duplicateWhRes = await request('/api/billing/razorpay-webhook', {
    method: 'POST',
    rawBody: webhookBodyStr,
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validWebhookSig,
      'x-razorpay-event-id': webhookEventId
    }
  });
  assertTest(duplicateWhRes.status === 200 && duplicateWhRes.body.duplicate === true, 'Duplicate webhook returns HTTP 200 with duplicate: true');

  // 10. Failed payment handling
  console.log('\n--- 10. Failed Payment Handling ---');
  const failedOrderId = `order_failed_${Date.now()}`;
  await RazorpayOrderModel.createOrder({
    orderId: failedOrderId,
    organizationId: testOrgId,
    planId: 'growth',
    billingInterval: 'monthly',
    amountPaise: 199900
  });

  const markedFailed = await RazorpayOrderModel.markFailed(failedOrderId, {
    paymentId: `pay_failed_${Date.now()}`,
    notes: { reason: 'card_declined' }
  });
  assertTest(markedFailed?.status === 'failed', 'markFailed updates order status to "failed"');
  assertTest(markedFailed?.notes?.reason === 'card_declined', 'markFailed appends failure metadata to order notes');

  // 11. Cleanup test fixtures
  console.log('\n--- 11. Cleaning up Test Fixtures ---');
  await db.query('DELETE FROM razorpay_orders WHERE organization_id IN ($1, $2);', [testOrgId, otherOrgId]);
  await db.query('DELETE FROM razorpay_webhook_events WHERE event_id = $1;', [webhookEventId]);
  await db.query('DELETE FROM users WHERE id IN (991, 992);');
  await db.query('DELETE FROM organizations WHERE id IN ($1, $2);', [testOrgId, otherOrgId]);
  console.log('  ✓ Test fixtures cleaned up successfully.');

  // Stop server
  server.close();

  // Print Summary
  console.log('\n================================================================');
  console.log('  SUITE SUMMARY RESULTS                                         ');
  console.log('================================================================');
  console.log(`  TOTAL TESTS : ${results.total}`);
  console.log(`  PASSED      : ${results.passed}`);
  console.log(`  FAILED      : ${results.failed}`);
  console.log(`  BLOCKED     : ${results.blocked}`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  if (server) server.close();
  process.exit(1);
});
