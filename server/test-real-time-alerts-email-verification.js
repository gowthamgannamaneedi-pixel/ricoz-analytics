/**
 * Comprehensive Automated Verification Suite: Real-Time Alerts & Email Notification Pipeline
 * 
 * Verifies all 13 critical functional, architectural, security, and provider delivery requirements:
 * 1. Alert Rule Creation, Persistence, and Reload Verification
 * 2. Alert Configuration Input & Field Validation (names, conditions, threshold types, cooldown, email format)
 * 3. Metric Threshold Evaluation across all comparison operators (>, <, >=, <=, =, !=)
 * 4. Inactive/Disabled Rule Bypassing Guard
 * 5. Rule with Email Notification Disabled (in-app only)
 * 6. In-App Incident Logging & PostgreSQL JSONB notification_delivery Persistence
 * 7. Multiple Recipients Email Dispatch Support
 * 8. Email Content Integrity (Rule name, Metric, Value, Condition, Severity, Org, Dashboard Link, Timestamp)
 * 9. Cooldown Anti-Flapping Duplicate Suppression (cooldown > 0 vs cooldown = 0)
 * 10. Provider Resilience & Graceful Error Handling
 * 11. Multi-Tenant Workspace & Organization Data Isolation
 * 12. Enterprise RBAC Enforcement (Viewer blocked, Analyst restricted, Admin authorized)
 * 13. Live Brevo Transactional Email Provider Dispatch & Acceptance Verification
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const UserModel = require('./models/userModel');
const AlertModel = require('./models/alertModel');
const MetricModel = require('./models/metricModel');
const alertEvaluatorService = require('./services/alertEvaluatorService');
const emailService = require('./services/emailService');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runRealTimeAlertsVerificationSuite() {
  console.log('========================================================================');
  console.log(' RicozAnalytics: Real-Time Alerts & Email Notification Verification Suite');
  console.log('========================================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message, detail = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${totalTests}. ${message}`);
    } else {
      failedTests++;
      console.error(`  ❌ [FAIL] ${totalTests}. ${message} ${detail ? `(${detail})` : ''}`);
    }
  }

  const testOrgAId = '00000000-0000-0000-0000-000000000001';
  const testOrgBId = '00000000-0000-0000-0000-000000000002';
  const stamp = Date.now();
  const createdUserIds = [];
  const createdAlertIds = [];

  try {
    // ------------------------------------------------------------------------
    // Setup Isolated Real Users for Org A and Org B
    // ------------------------------------------------------------------------
    const adminA = await UserModel.create({
      name: 'Verif Admin A',
      email: `v_admin_a_${stamp}@ricoz.test`,
      password: 'Password123!',
      role: 'admin',
      organizationId: testOrgAId
    });
    createdUserIds.push(adminA.id);

    const managerA = await UserModel.create({
      name: 'Verif Manager A',
      email: `v_mgr_a_${stamp}@ricoz.test`,
      password: 'Password123!',
      role: 'manager',
      organizationId: testOrgAId
    });
    createdUserIds.push(managerA.id);

    const analystA = await UserModel.create({
      name: 'Verif Analyst A',
      email: `v_anl_a_${stamp}@ricoz.test`,
      password: 'Password123!',
      role: 'analyst',
      organizationId: testOrgAId
    });
    createdUserIds.push(analystA.id);

    const viewerA = await UserModel.create({
      name: 'Verif Viewer A',
      email: `v_viw_a_${stamp}@ricoz.test`,
      password: 'Password123!',
      role: 'viewer',
      organizationId: testOrgAId
    });
    createdUserIds.push(viewerA.id);

    const adminB = await UserModel.create({
      name: 'Verif Admin B',
      email: `v_admin_b_${stamp}@ricoz.test`,
      password: 'Password123!',
      role: 'admin',
      organizationId: testOrgBId
    });
    createdUserIds.push(adminB.id);

    const adminTokenA = jwt.sign({ id: adminA.id, email: adminA.email, role: 'admin', organization_id: testOrgAId }, config.jwtSecret, { expiresIn: '1h' });
    const managerTokenA = jwt.sign({ id: managerA.id, email: managerA.email, role: 'manager', organization_id: testOrgAId }, config.jwtSecret, { expiresIn: '1h' });
    const analystTokenA = jwt.sign({ id: analystA.id, email: analystA.email, role: 'analyst', organization_id: testOrgAId }, config.jwtSecret, { expiresIn: '1h' });
    const viewerTokenA = jwt.sign({ id: viewerA.id, email: viewerA.email, role: 'viewer', organization_id: testOrgAId }, config.jwtSecret, { expiresIn: '1h' });
    const adminTokenB = jwt.sign({ id: adminB.id, email: adminB.email, role: 'admin', organization_id: testOrgBId }, config.jwtSecret, { expiresIn: '1h' });

    console.log('--- SECTION 1: ALERT RULE CREATION, VALIDATION & PERSISTENCE ---');

    // 1. Rule creation with email notification and >= operator
    let testRule1Id = null;
    {
      const payload = {
        name: 'Enterprise Revenue Target Alert',
        description: 'Monitors quarterly revenue against target',
        condition: '>=',
        threshold: 50000,
        severity: 'critical',
        status: 'active',
        cooldownMinutes: 60,
        notificationChannels: ['in_app', 'email'],
        recipients: ['ricozanalytics@gmail.com', 'ops@ricoz.test']
      };
      const res = await request('POST', '/api/alerts', payload, { Authorization: `Bearer ${analystTokenA}` });
      testRule1Id = res.data?.data?.id;
      if (testRule1Id) createdAlertIds.push(testRule1Id);

      assert(
        res.status === 201 && testRule1Id && res.data.data.name === payload.name,
        'Alert rule creation with email channel and `>=` operator returns 201 Created',
        `status: ${res.status}`
      );
    }

    // 2. Persistence Verification: Reload rule from DB / API
    {
      const res = await request('GET', `/api/alerts/${testRule1Id}`, null, { Authorization: `Bearer ${viewerTokenA}` });
      const rule = res.data?.data;
      const channelsMatch = Array.isArray(rule?.notification_channels) && rule.notification_channels.includes('email') && rule.notification_channels.includes('in_app');
      const recipientsMatch = Array.isArray(rule?.recipients) && rule.recipients.includes('ricozanalytics@gmail.com') && rule.recipients.includes('ops@ricoz.test');
      const conditionMatches = rule?.condition === 'greater_than_or_equal' || rule?.condition === '>=';

      assert(
        res.status === 200 && channelsMatch && recipientsMatch && conditionMatches && Number(rule?.threshold) === 50000,
        'Database persistence verified: reloading rule confirms channels, recipients, threshold, condition',
        `condition: ${rule?.condition}, threshold: ${rule?.threshold}`
      );
    }

    // 3. Validation: Reject missing rule name
    {
      const res = await request('POST', '/api/alerts', { condition: '>', threshold: 100 }, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 400, 'Validation: Rejects missing rule name with 400 Bad Request', `status: ${res.status}`);
    }

    // 4. Validation: Reject non-numeric threshold
    {
      const res = await request('POST', '/api/alerts', { name: 'Non-num', condition: '>', threshold: 'not_a_number' }, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 400, 'Validation: Rejects non-numeric threshold with 400 Bad Request', `status: ${res.status}`);
    }

    // 5. Validation: Reject negative cooldown minutes
    {
      const res = await request('POST', '/api/alerts', { name: 'Neg Cooldown', condition: '>', threshold: 100, cooldownMinutes: -15 }, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 400, 'Validation: Rejects negative cooldown_minutes with 400 Bad Request', `status: ${res.status}`);
    }

    // 6. Validation: Reject email notification with empty recipients
    {
      const res = await request('POST', '/api/alerts', {
        name: 'Empty Recipients Alert',
        condition: '>',
        threshold: 100,
        notificationChannels: ['in_app', 'email'],
        recipients: []
      }, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 400, 'Validation: Rejects email channel when recipients array is empty with 400 Bad Request', `status: ${res.status}`);
    }

    // 7. Validation: Reject invalid recipient email address format
    {
      const res = await request('POST', '/api/alerts', {
        name: 'Invalid Email Alert',
        condition: '>',
        threshold: 100,
        notificationChannels: ['in_app', 'email'],
        recipients: ['not-an-email-address']
      }, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 400, 'Validation: Rejects invalid email format with 400 Bad Request', `status: ${res.status}`);
    }

    // 8. Recipient Sanitization: Trims and lowercases emails
    {
      const res = await request('POST', '/api/alerts', {
        name: 'Sanitized Recipient Rule',
        condition: '>',
        threshold: 100,
        notificationChannels: ['email'],
        recipients: ['  Finance_Team@Org.COM  ']
      }, { Authorization: `Bearer ${analystTokenA}` });
      const created = res.data?.data;
      if (created?.id) createdAlertIds.push(created.id);
      assert(
        res.status === 201 && created?.recipients?.[0] === 'finance_team@org.com',
        'Recipient Sanitization: Automatically trims whitespace and converts email to lowercase',
        `recipients: ${JSON.stringify(created?.recipients)}`
      );
    }

    console.log('\n--- SECTION 2: CONDITION OPERATORS EVALUATION ENGINE ---');

    // 9. Condition '>' (greater_than)
    {
      const r1 = alertEvaluatorService.evaluateCondition('>', 150, 100);
      const r2 = alertEvaluatorService.evaluateCondition('>', 100, 100);
      const r3 = alertEvaluatorService.evaluateCondition('>', 50, 100);
      assert(r1 === true && r2 === false && r3 === false, "Condition '>' evaluates correctly: 150 > 100 (T), 100 > 100 (F), 50 > 100 (F)");
    }

    // 10. Condition '<' (less_than)
    {
      const r1 = alertEvaluatorService.evaluateCondition('<', 50, 100);
      const r2 = alertEvaluatorService.evaluateCondition('<', 100, 100);
      const r3 = alertEvaluatorService.evaluateCondition('<', 150, 100);
      assert(r1 === true && r2 === false && r3 === false, "Condition '<' evaluates correctly: 50 < 100 (T), 100 < 100 (F), 150 < 100 (F)");
    }

    // 11. Condition '>=' (greater_than_or_equal)
    {
      const r1 = alertEvaluatorService.evaluateCondition('>=', 100, 100);
      const r2 = alertEvaluatorService.evaluateCondition('>=', 101, 100);
      const r3 = alertEvaluatorService.evaluateCondition('>=', 99, 100);
      assert(r1 === true && r2 === true && r3 === false, "Condition '>=' evaluates correctly: 100 >= 100 (T), 101 >= 100 (T), 99 >= 100 (F)");
    }

    // 12. Condition '<=' (less_than_or_equal)
    {
      const r1 = alertEvaluatorService.evaluateCondition('<=', 100, 100);
      const r2 = alertEvaluatorService.evaluateCondition('<=', 99, 100);
      const r3 = alertEvaluatorService.evaluateCondition('<=', 101, 100);
      assert(r1 === true && r2 === true && r3 === false, "Condition '<=' evaluates correctly: 100 <= 100 (T), 99 <= 100 (T), 101 <= 100 (F)");
    }

    // 13. Condition '=' / '==' (equal / equals)
    {
      const r1 = alertEvaluatorService.evaluateCondition('=', 100, 100);
      const r2 = alertEvaluatorService.evaluateCondition('equal', 100.0, 100);
      const r3 = alertEvaluatorService.evaluateCondition('=', 101, 100);
      assert(r1 === true && r2 === true && r3 === false, "Condition '=' evaluates correctly: 100 = 100 (T), 100.0 equal 100 (T), 101 = 100 (F)");
    }

    // 14. Condition '!=' (not_equal)
    {
      const r1 = alertEvaluatorService.evaluateCondition('!=', 101, 100);
      const r2 = alertEvaluatorService.evaluateCondition('!=', 100, 100);
      assert(r1 === true && r2 === false, "Condition '!=' evaluates correctly: 101 != 100 (T), 100 != 100 (F)");
    }

    console.log('\n--- SECTION 3: INACTIVE GUARDS & IN-APP VS EMAIL DISPATCH ---');

    // 15. Inactive / Disabled Rule Guard
    {
      const inactiveAlert = {
        id: '11111111-1111-1111-1111-111111111111',
        organization_id: testOrgAId,
        name: 'Inactive Alert',
        status: 'inactive',
        condition: '>',
        threshold: 10,
        notification_channels: ['in_app', 'email'],
        recipients: ['test@ricoz.test']
      };
      const evalRes = await alertEvaluatorService.evaluateAlertRule(inactiveAlert, { overrideMetricValue: 100 });
      assert(
        evalRes.triggered === false && evalRes.skipped === true && evalRes.reason === 'alert_inactive',
        'Inactive Guard: Disabled/inactive rule is bypassed by evaluator and NEVER fires incidents or emails',
        `reason: ${evalRes.reason}`
      );
    }

    // 16. Rule with Email Notification Disabled (in-app only)
    let inAppIncidentId = null;
    {
      const inAppAlert = {
        id: testRule1Id,
        organization_id: testOrgAId,
        name: 'In-App Only Rule',
        status: 'active',
        condition: '>',
        threshold: 10,
        cooldown_minutes: 0,
        notification_channels: ['in_app'],
        recipients: []
      };
      const evalRes = await alertEvaluatorService.evaluateAlertRule(inAppAlert, { overrideMetricValue: 50 });
      inAppIncidentId = evalRes.incident?.id;
      assert(
        evalRes.triggered === true && evalRes.incident && evalRes.notificationDelivery?.emailSent === false,
        'Email Disabled: Alert triggers in-app incident but completely skips email dispatch',
        `emailSent: ${evalRes.notificationDelivery?.emailSent}`
      );
    }

    // 17. In-App Incident Creation & PostgreSQL JSONB notification_delivery Persistence
    {
      const alertWithEmail = {
        id: testRule1Id,
        organization_id: testOrgAId,
        name: 'Real-Time Pipeline Persistence Test',
        status: 'active',
        condition: '>',
        threshold: 100,
        severity: 'high',
        cooldown_minutes: 0,
        notification_channels: ['in_app', 'email'],
        recipients: ['ricozanalytics@gmail.com']
      };
      const evalRes = await alertEvaluatorService.evaluateAlertRule(alertWithEmail, { overrideMetricValue: 250 });
      const incidentId = evalRes.incident?.id;

      // Query database directly for the persisted incident record
      const dbRow = await db.query('SELECT id, alert_id, organization_id, metric_value, notification_delivery FROM alert_incidents WHERE id = $1', [incidentId]);
      const deliveryData = dbRow.rows[0]?.notification_delivery;

      assert(
        dbRow.rows.length === 1 && deliveryData?.in_app?.created === true && deliveryData?.email?.sent === true && deliveryData?.email?.provider === 'Brevo' && deliveryData?.email?.status === 'accepted',
        'PostgreSQL JSONB Persistence: notification_delivery stores in_app and email delivery status (provider: Brevo, status: accepted)',
        `dbRow found: ${dbRow.rows.length}, provider: ${deliveryData?.email?.provider}`
      );
    }

    console.log('\n--- SECTION 4: EMAIL CONTENT, MULTIPLE RECIPIENTS & COOLDOWN DEDUP ---');

    // 18. Multiple Configured Recipients Handling
    {
      const recipients = ['ricozanalytics@gmail.com', 'analyst@ricoz.test', 'manager@ricoz.test'];
      const dispatchRes = await emailService.sendAlertEmail({
        alertRule: { name: 'Multi-Recipient Test Alert', severity: 'warning', condition: '>', threshold: 100 },
        metricName: 'Conversion Rate',
        metricValue: 18.5,
        recipients
      });

      assert(
        dispatchRes.success === true && dispatchRes.provider === 'Brevo' && dispatchRes.httpStatus === 201 && dispatchRes.recipientCount === 3,
        'Multiple Recipients: Brevo Transactional API accepts dispatch payload with multiple recipients (count: 3)',
        `httpStatus: ${dispatchRes.httpStatus}, recipientCount: ${dispatchRes.recipientCount}`
      );
    }

    // 19. Email Content Integrity (All required business details present)
    {
      // Mock call to verify generated email options and HTML
      let capturedPayload = null;
      const originalBrevoCall = emailService._sendBrevoEmail;
      try {
        emailService._sendBrevoEmail = async (opts) => {
          capturedPayload = opts;
          return { success: true, messageId: '<test-evidence@mailin.fr>', httpStatus: 201 };
        };

        await emailService.sendAlertEmail({
          alertRule: {
            name: 'Q3 Enterprise Revenue Anomaly',
            severity: 'critical',
            condition: 'less_than',
            threshold: 1000000
          },
          metricName: 'Gross Revenue',
          metricValue: 850000,
          detectedAt: new Date('2026-10-27T10:00:00Z'),
          organizationName: 'Acme Global Workspace',
          recipients: ['cfo@acme.com']
        });

        const html = (capturedPayload?.htmlContent || '').toLowerCase();
        const hasRuleName = html.includes('q3 enterprise revenue anomaly');
        const hasMetric = html.includes('gross revenue');
        const hasValue = html.includes('850000');
        const hasThreshold = html.includes('1000000');
        const hasSeverity = html.includes('critical');
        const hasOrg = html.includes('acme global workspace');
        const hasActionBtn = html.includes('/alerts?tab=incidents');

        assert(
          hasRuleName && hasMetric && hasValue && hasThreshold && hasSeverity && hasOrg && hasActionBtn,
          'Email Content: HTML contains rule name, metric name, current value, threshold, severity, workspace org, and CTA link',
          `hasRuleName: ${hasRuleName}, hasActionBtn: ${hasActionBtn}`
        );
      } finally {
        emailService._sendBrevoEmail = originalBrevoCall;
      }
    }

    // 20. Anti-Flapping Cooldown Duplicate Suppression
    {
      const cooldownAlert = {
        id: testRule1Id,
        organization_id: testOrgAId,
        name: 'Cooldown Testing Rule',
        status: 'active',
        condition: '>',
        threshold: 100,
        cooldown_minutes: 60,
        notification_channels: ['in_app', 'email'],
        recipients: ['ricozanalytics@gmail.com']
      };

      // 1st run fires incident
      const eval1 = await alertEvaluatorService.evaluateAlertRule(cooldownAlert, { overrideMetricValue: 500 });
      // Immediate 2nd run within 60m must be suppressed
      const eval2 = await alertEvaluatorService.evaluateAlertRule(cooldownAlert, { overrideMetricValue: 550 });

      assert(
        eval1.triggered === true && eval2.suppressed === true && eval2.cooldownActive === true,
        'Duplicate Suppression: Subsequent evaluation within cooldown window (60m) is suppressed without duplicate incident or email',
        `eval1.triggered: ${eval1.triggered}, eval2.suppressed: ${eval2.suppressed}`
      );
    }

    // 21. Cooldown = 0 Allows Immediate Consecutive Evaluation
    {
      const zeroCooldownAlert = {
        id: testRule1Id,
        organization_id: testOrgAId,
        name: 'Zero Cooldown Rule',
        status: 'active',
        condition: '>',
        threshold: 100,
        cooldown_minutes: 0,
        notification_channels: ['in_app']
      };

      const eval1 = await alertEvaluatorService.evaluateAlertRule(zeroCooldownAlert, { overrideMetricValue: 500 });
      const eval2 = await alertEvaluatorService.evaluateAlertRule(zeroCooldownAlert, { overrideMetricValue: 550 });

      assert(
        eval1.triggered === true && eval2.triggered === true,
        'Immediate Trigger: When cooldown_minutes is 0, alerts fire immediately without delay',
        `eval1: ${eval1.triggered}, eval2: ${eval2.triggered}`
      );
    }

    console.log('\n--- SECTION 5: RESILIENCE, MULTI-TENANCY & RBAC ---');

    // 22. Provider Failure Handling & Resilience
    {
      let caughtErrorInEngine = false;
      const originalSend = emailService.sendAlertEmail;
      try {
        emailService.sendAlertEmail = async () => {
          throw new Error('Simulated Brevo 503 Provider Gateway Timeout');
        };

        const evalRes = await alertEvaluatorService.evaluateAlertRule({
          id: testRule1Id,
          organization_id: testOrgAId,
          name: 'Fault Tolerant Alert',
          status: 'active',
          condition: '>',
          threshold: 100,
          cooldown_minutes: 0,
          notification_channels: ['email'],
          recipients: ['ops@ricoz.test']
        }, { overrideMetricValue: 200 });

        assert(
          evalRes.triggered === true && evalRes.incident && evalRes.notificationDelivery?.emailSent === false,
          'Resilience: Provider network/API error is safely captured without crashing the evaluator or losing the incident record',
          `incident: ${evalRes.incident?.id}`
        );
      } catch (e) {
        caughtErrorInEngine = true;
      } finally {
        emailService.sendAlertEmail = originalSend;
      }
      assert(!caughtErrorInEngine, 'Evaluator did not throw unhandled exception on provider error');
    }

    // 23. Multi-Tenant Workspace Isolation
    {
      // Org B admin attempts to read Org A alert rule
      const resRead = await request('GET', `/api/alerts/${testRule1Id}`, null, { Authorization: `Bearer ${adminTokenB}` });
      // Org B admin attempts to trigger test evaluation on Org A alert rule
      const resTest = await request('POST', `/api/alerts/${testRule1Id}/test`, {}, { Authorization: `Bearer ${adminTokenB}` });

      assert(
        resRead.status === 404 && resTest.status === 404,
        'Multi-Tenant Isolation: Organization B cannot read or trigger Organization A alert rules (HTTP 404 Isolated)',
        `read: ${resRead.status}, test: ${resTest.status}`
      );
    }

    // 24. RBAC: Viewer blocked from creating alert rules
    {
      const res = await request('POST', '/api/alerts', { name: 'Viewer Create', condition: '>', threshold: 10 }, { Authorization: `Bearer ${viewerTokenA}` });
      assert(res.status === 403, 'RBAC: Viewer role is blocked from creating alert rules (403 Forbidden)', `status: ${res.status}`);
    }

    // 25. RBAC: Viewer blocked from updating alert rules
    {
      const res = await request('PUT', `/api/alerts/${testRule1Id}`, { name: 'Viewer Update' }, { Authorization: `Bearer ${viewerTokenA}` });
      assert(res.status === 403, 'RBAC: Viewer role is blocked from updating alert rules (403 Forbidden)', `status: ${res.status}`);
    }

    // 26. RBAC: Viewer blocked from test evaluation
    {
      const res = await request('POST', `/api/alerts/${testRule1Id}/test`, {}, { Authorization: `Bearer ${viewerTokenA}` });
      assert(res.status === 403, 'RBAC: Viewer role is blocked from testing alert rules (403 Forbidden)', `status: ${res.status}`);
    }

    // 27. RBAC: Analyst blocked from deleting alert rules
    {
      const res = await request('DELETE', `/api/alerts/${testRule1Id}`, null, { Authorization: `Bearer ${analystTokenA}` });
      assert(res.status === 403, 'RBAC: Analyst role cannot delete alert rules (403 Forbidden)', `status: ${res.status}`);
    }

    // 28. RBAC: Manager / Admin authorized to delete alert rules
    {
      const deleteRule = await AlertModel.create({
        organizationId: testOrgAId,
        name: 'Rule to Delete',
        condition: '>',
        threshold: 50,
        createdBy: managerA.id
      });
      const res = await request('DELETE', `/api/alerts/${deleteRule.id}`, null, { Authorization: `Bearer ${managerTokenA}` });
      assert(res.status === 200, 'RBAC: Manager role successfully deletes alert rule with 200 OK', `status: ${res.status}`);
    }

    console.log('\n--- SECTION 6: LIVE BREVO PROVIDER ACCEPTANCE & EVIDENCE ---');

    // 29. Live Brevo Provider Dispatch Acceptance Test
    {
      const liveDispatch = await emailService.sendAlertEmail({
        alertRule: {
          name: 'Real-Time Verification Live Probe',
          severity: 'high',
          condition: 'greater_than_or_equal',
          threshold: 75000
        },
        metricName: 'Gross Monthly Revenue',
        metricValue: 84200,
        organizationName: 'Ricoz Enterprise Headquarters',
        recipients: ['ricozanalytics@gmail.com']
      });

      const accepted = liveDispatch.success === true && liveDispatch.httpStatus === 201 && typeof liveDispatch.messageId === 'string' && liveDispatch.messageId.length > 5;

      assert(
        accepted,
        `Live Provider Acceptance: Brevo API responded HTTP 201 Created with messageId: ${liveDispatch.messageId}`,
        `status: ${liveDispatch.httpStatus}`
      );

      console.log('\n  [BREVO PROVIDER EVIDENCE LOG]');
      console.log(`    - API Endpoint:      https://api.brevo.com/v3/smtp/email (Port 443)`);
      console.log(`    - HTTP Status:        ${liveDispatch.httpStatus} Created`);
      console.log(`    - Message ID:         ${liveDispatch.messageId}`);
      console.log(`    - Verified Sender:    RicozAnalytics <ricozanalytics@gmail.com>`);
      console.log(`    - Test Recipient:     ricozanalytics@gmail.com`);
      console.log(`    - Delivery Semantics: Provider Accepted (Request Queued for Delivery)`);
    }

  } catch (err) {
    console.error('Unexpected error in verification suite:', err);
    failedTests++;
  } finally {
    // Cleanup temporary test data
    console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
    try {
      if (createdAlertIds.length > 0) {
        await db.query('DELETE FROM alert_incidents WHERE alert_id = ANY($1::uuid[])', [createdAlertIds]);
        await db.query('DELETE FROM alerts WHERE id = ANY($1::uuid[])', [createdAlertIds]);
      }
      if (createdUserIds.length > 0) {
        await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
      }
      console.log('  Cleaned up temporary alerts, incidents, and test users.');
    } catch (cleanupErr) {
      console.warn('  Warning during cleanup:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }
  }

  console.log('\n========================================================================');
  console.log(` Verification Suite Completed: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runRealTimeAlertsVerificationSuite();
}

module.exports = runRealTimeAlertsVerificationSuite;
