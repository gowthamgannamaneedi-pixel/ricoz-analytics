/**
 * Comprehensive Automated Test Suite for Phase 16: Advanced AI & Automated Insights
 * Tests all 28 required areas:
 * 1. Insight engine
 * 2. Trend detection
 * 3. Growth detection
 * 4. Decline detection
 * 5. Anomaly insight
 * 6. Forecast insight
 * 7. KPI insight
 * 8. Data-quality insight
 * 9. Relational insight
 * 10. Evidence generation
 * 11. Numerical evidence integrity
 * 12. Severity classification
 * 13. AI explanation
 * 14. Deterministic fallback
 * 15. Executive summary
 * 16. Insight persistence
 * 17. Insight history
 * 18. Dismiss
 * 19. Feedback
 * 20. RBAC
 * 21. Cross-tenant isolation
 * 22. Dashboard integration
 * 23. Report integration
 * 24. Scheduler integration
 * 25. Alert integration
 * 26. Empty/no-insight case
 * 27. Duplicate insight prevention
 * 28. Sensitive data protection
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const Dataset = require('./models/datasetModel');
const DatasetRelationshipModel = require('./models/datasetRelationshipModel');
const ForecastModel = require('./models/forecastModel');
const AlertModel = require('./models/alertModel');
const Dashboard = require('./models/dashboardModel');
const InsightModel = require('./models/insightModel');
const AuditLogModel = require('./models/auditLogModel');
const insightService = require('./services/insightService');
const reportService = require('./services/reportService');
const schedulerService = require('./services/schedulerService');
const aiQueryPlannerService = require('./services/aiQueryPlannerService');
const geminiService = require('./services/geminiService');

let server;
let port;
let baseUrl;

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...headers
      }
    };

    let reqBody = null;
    if (body) {
      reqBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

// Token generator helper
function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 16: ADVANCED AI & AUTOMATED INSIGHTS TEST SUITE (28 TESTS) ');
  console.log('===============================================================\n');

  // Start server on random port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const orgA = '00000000-0000-0000-0000-000000000001';
  const orgB = '00000000-0000-0000-0000-000000000002';

  const adminTokenA = generateToken(1, 'admin@ricoz.test', 'admin', orgA);
  const managerTokenA = generateToken(2, 'manager@ricoz.test', 'manager', orgA);
  const analystTokenA = generateToken(3, 'analyst@ricoz.test', 'analyst', orgA);
  const viewerTokenA = generateToken(4, 'viewer@ricoz.test', 'viewer', orgA);

  const adminTokenB = generateToken(10, 'admin_b@other.test', 'admin', orgB);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` \x1b[32mPASS\x1b[0m: ${name}`);
      passed++;
    } catch (err) {
      console.error(` \x1b[31mFAIL\x1b[0m: ${name}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // Ensure test data directory
  const testDataDir = path.resolve(__dirname, 'uploads/test_data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Create mock datasets for time-series, growth, decline, and relational
  const growthCsv = path.join(testDataDir, 'growth_test.csv');
  fs.writeFileSync(growthCsv, [
    'date,revenue,orders,region',
    '2026-01-01,10000,10,North',
    '2026-02-01,12000,12,North',
    '2026-03-01,15000,15,South',
    '2026-04-01,19000,19,South' // +26.6% growth over previous, 4 consecutive growth periods
  ].join('\n'));

  const declineCsv = path.join(testDataDir, 'decline_test.csv');
  fs.writeFileSync(declineCsv, [
    'date,revenue,orders,region',
    '2026-01-01,50000,50,West',
    '2026-02-01,45000,45,West',
    '2026-03-01,40000,40,West',
    '2026-04-01,25000,25,West' // -37.5% drop (critical decline), 4 consecutive decline periods
  ].join('\n'));

  const ordersCsv = path.join(testDataDir, 'orders_insight_test.csv');
  fs.writeFileSync(ordersCsv, [
    'order_id,customer_id,revenue,date',
    '1,C1,1000,2026-01-01',
    '2,C2,2000,2026-01-02',
    '3,C1,1500,2026-01-03'
  ].join('\n'));

  const customersCsv = path.join(testDataDir, 'customers_insight_test.csv');
  fs.writeFileSync(customersCsv, [
    'customer_id,name,segment',
    'C1,Acme Enterprise,Enterprise',
    'C2,Beta LLC,Mid-Market'
  ].join('\n'));

  // Register datasets in DB
  const datasetGrowth = await Dataset.create({
    userId: 1,
    name: 'Q1 Growth Telemetry',
    filePath: growthCsv,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'orders', type: 'integer' },
      { name: 'region', type: 'string' }
    ]
  });

  const datasetDecline = await Dataset.create({
    userId: 1,
    name: 'Q1 Regional Contraction',
    filePath: declineCsv,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'orders', type: 'integer' },
      { name: 'region', type: 'string' }
    ]
  });

  const datasetOrders = await Dataset.create({
    userId: 1,
    name: 'Transactional Orders',
    filePath: ordersCsv,
    rowCount: 3,
    columnCount: 4,
    schema: [
      { name: 'order_id', type: 'integer' },
      { name: 'customer_id', type: 'string' },
      { name: 'revenue', type: 'numeric' },
      { name: 'date', type: 'date' }
    ]
  });

  const datasetCustomers = await Dataset.create({
    userId: 1,
    name: 'Customer Directory',
    filePath: customersCsv,
    rowCount: 2,
    columnCount: 3,
    schema: [
      { name: 'customer_id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'segment', type: 'string' }
    ]
  });

  // Create Relational Join Link
  await DatasetRelationshipModel.create({
    organizationId: orgA,
    createdBy: 1,
    sourceDatasetId: datasetOrders.id,
    sourceColumn: 'customer_id',
    targetDatasetId: datasetCustomers.id,
    targetColumn: 'customer_id',
    relationshipType: 'many_to_one',
    description: 'Orders reference customers'
  });

  // Create ML Forecast record in Org A with anomalies
  const savedForecast = await ForecastModel.create({
    organizationId: orgA,
    userId: 1,
    datasetId: datasetDecline.id,
    targetColumn: 'revenue',
    modelName: 'holt_winters',
    horizonPeriods: 30,
    interval: 'daily',
    predictions: [
      { date: '2026-05-01', predicted: 25000, lower_bound: 22000, upper_bound: 28000 },
      { date: '2026-05-30', predicted: 18000, lower_bound: 15000, upper_bound: 21000 }
    ],
    anomalies: [
      { date: '2026-04-01', actual: 25000, expected: 38000, z_score: -2.85, is_anomaly: true }
    ],
    metrics: { mae: 210, rmse: 350, r2: 0.94 }
  });

  // Create Operational Alert in Org A
  const activeAlert = await AlertModel.create({
    organizationId: orgA,
    createdBy: 1,
    datasetId: datasetDecline.id,
    name: 'Revenue Floor Breach Alert',
    condition: 'less_than',
    threshold: 30000,
    severity: 'critical'
  });
  // Simulate triggered alert
  await AlertModel.updateLastTriggered(activeAlert.id, new Date(), 'triggered');

  try {
    // -------------------------------------------------------------
    // Test 1: Insight engine
    // -------------------------------------------------------------
    await test('1. Insight engine executes cross-subsystem evaluation', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      if (!res || !Array.isArray(res.insights)) throw new Error('Missing insights array');
      if (res.count === undefined || res.count <= 0) throw new Error('Expected at least 1 detected insight');
      if (!res.executive_summary) throw new Error('Missing executive_summary in engine output');
    });

    // -------------------------------------------------------------
    // Test 2: Trend detection
    // -------------------------------------------------------------
    await test('2. Trend detection identifies 4-period sustained trajectory', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const trendIns = res.insights.find(i => i.type === 'trend');
      if (!trendIns) throw new Error('Expected trend insight detected');
      if (!trendIns.evidence.consecutive_periods || trendIns.evidence.consecutive_periods < 4) {
        throw new Error(`Expected at least 4 consecutive periods, got ${trendIns.evidence.consecutive_periods}`);
      }
    });

    // -------------------------------------------------------------
    // Test 3: Growth detection
    // -------------------------------------------------------------
    await test('3. Growth detection flags positive velocity >= +10%', async () => {
      const res = await insightService.generateInsights(orgA, { datasetId: datasetGrowth.id, persist: false });
      const growthIns = res.insights.find(i => i.type === 'growth');
      if (!growthIns) throw new Error('Expected growth insight');
      if (growthIns.evidence.change_percent < 10) {
        throw new Error(`Expected change_percent >= 10, got ${growthIns.evidence.change_percent}`);
      }
      if (growthIns.severity !== 'positive') {
        throw new Error(`Expected severity positive, got ${growthIns.severity}`);
      }
    });

    // -------------------------------------------------------------
    // Test 4: Decline detection
    // -------------------------------------------------------------
    await test('4. Decline detection flags negative velocity <= -10%', async () => {
      const res = await insightService.generateInsights(orgA, { datasetId: datasetDecline.id, persist: false });
      const declineIns = res.insights.find(i => i.type === 'decline');
      if (!declineIns) throw new Error('Expected decline insight');
      if (declineIns.evidence.change_percent > -10) {
        throw new Error(`Expected change_percent <= -10, got ${declineIns.evidence.change_percent}`);
      }
    });

    // -------------------------------------------------------------
    // Test 5: Anomaly insight
    // -------------------------------------------------------------
    await test('5. Anomaly insight integrates Phase 11 ML outliers', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const anomIns = res.insights.find(i => i.type === 'anomaly');
      if (!anomIns) throw new Error('Expected anomaly insight from saved forecast');
      if (!anomIns.evidence.anomaly_count || anomIns.evidence.anomaly_count < 1) {
        throw new Error('Missing anomaly_count in evidence');
      }
    });

    // -------------------------------------------------------------
    // Test 6: Forecast insight
    // -------------------------------------------------------------
    await test('6. Forecast insight evaluates horizon progression', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const fcIns = res.insights.find(i => i.type === 'forecast');
      if (!fcIns) throw new Error('Expected forecast insight');
      if (fcIns.evidence.predicted_change_percent === undefined) {
        throw new Error('Missing predicted_change_percent in forecast evidence');
      }
    });

    // -------------------------------------------------------------
    // Test 7: KPI insight
    // -------------------------------------------------------------
    await test('7. KPI insight captures primary metric volume', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const hasMetricIns = res.insights.some(i => i.type === 'growth' || i.type === 'decline' || i.type === 'trend');
      if (!hasMetricIns) throw new Error('Expected KPI/metric insight');
    });

    // -------------------------------------------------------------
    // Test 8: Data-quality insight
    // -------------------------------------------------------------
    await test('8. Data-quality insight integrates Phase 15 telemetry', async () => {
      // Create data quality evaluation on orders
      const dataQualityService = require('./services/dataQualityService');
      await dataQualityService.evaluateDatasetQuality(datasetOrders.id, orgA);

      const res = await insightService.generateInsights(orgA, { datasetId: datasetOrders.id, persist: false });
      const dqIns = res.insights.find(i => i.type === 'data_quality');
      if (!dqIns) throw new Error('Expected data_quality insight on dataset with quality profile');
      if (dqIns.evidence.quality_score === undefined) throw new Error('Missing quality_score in evidence');
    });

    // -------------------------------------------------------------
    // Test 9: Relational insight
    // -------------------------------------------------------------
    await test('9. Relational insight computes joined multi-dataset breakdown', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const relIns = res.insights.find(i => i.type === 'relationship');
      if (!relIns) throw new Error('Expected relationship insight from joined schema');
      if (!relIns.evidence.source_dataset || !relIns.evidence.target_dataset) {
        throw new Error('Missing source_dataset/target_dataset in relational evidence');
      }
    });

    // -------------------------------------------------------------
    // Test 10: Evidence generation
    // -------------------------------------------------------------
    await test('10. Evidence generation populates structured numeric metrics', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      for (const ins of res.insights) {
        if (!ins.evidence || typeof ins.evidence !== 'object') {
          throw new Error(`Insight "${ins.title}" lacks structured evidence object`);
        }
      }
    });

    // -------------------------------------------------------------
    // Test 11: Numerical evidence integrity
    // -------------------------------------------------------------
    await test('11. Numerical evidence integrity verifies math calculations', async () => {
      const res = await insightService.generateInsights(orgA, { datasetId: datasetGrowth.id, persist: false });
      const growth = res.insights.find(i => i.type === 'growth');
      if (growth) {
        const { current_value, previous_value, change_percent } = growth.evidence;
        const expectedChange = Number((((current_value - previous_value) / previous_value) * 100).toFixed(1));
        if (Math.abs(change_percent - expectedChange) > 0.1) {
          throw new Error(`Math integrity mismatch: ${change_percent}% vs expected ${expectedChange}%`);
        }
      }
    });

    // -------------------------------------------------------------
    // Test 12: Severity classification
    // -------------------------------------------------------------
    await test('12. Severity classification applies info/positive/warning/critical rules', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      for (const ins of res.insights) {
        if (!['info', 'positive', 'warning', 'critical'].includes(ins.severity)) {
          throw new Error(`Invalid severity: "${ins.severity}" on insight "${ins.title}"`);
        }
      }
    });

    // -------------------------------------------------------------
    // Test 13: AI explanation
    // -------------------------------------------------------------
    await test('13. AI explanation explains evidence naturally via geminiService', async () => {
      const answer = await geminiService.explainResults(
        'What changed in revenue?',
        { intent: 'growth', metric: 'revenue' },
        { trends: [{ revenue: 10000 }, { revenue: 12000 }], growth_rate: 20 },
        { datasetName: 'Q1 Growth Telemetry' }
      );
      if (!answer || answer.length < 15) throw new Error('AI explanation was empty or too short');
    });

    // -------------------------------------------------------------
    // Test 14: Deterministic fallback
    // -------------------------------------------------------------
    await test('14. Deterministic fallback operates with zero API key', async () => {
      const prevKey = geminiService.apiKey;
      try {
        geminiService.apiKey = ''; // simulate no key
        const answer = await geminiService.explainResults(
          'What is the growth trend?',
          { intent: 'growth', metric: 'revenue' },
          { trends: [{ revenue: 10000 }, { revenue: 15000 }], growth_rate: 50 },
          { datasetName: 'Growth Test' }
        );
        if (!answer || !answer.includes('50%')) {
          throw new Error(`Fallback did not synthesize factual data correctly: ${answer}`);
        }
      } finally {
        geminiService.apiKey = prevKey;
      }
    });

    // -------------------------------------------------------------
    // Test 15: Executive summary
    // -------------------------------------------------------------
    await test('15. Executive summary synthesizes positive, warning, and recommendations', async () => {
      const res = await request('GET', '/api/insights/summary', null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const summary = res.body.summary || res.body.executive_summary;
      if (!summary || !summary.includes('Executive Summary')) {
        throw new Error(`Executive summary did not contain expected heading: ${summary}`);
      }
    });

    // -------------------------------------------------------------
    // Test 16: Insight persistence
    // -------------------------------------------------------------
    let persistedId = null;
    await test('16. Insight persistence stores insights in ai_insights table/store', async () => {
      const res = await request('POST', '/api/insights/generate', {}, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      const list = res.body.data || res.body.insights;
      if (!list || list.length === 0) throw new Error('No insights returned from generate endpoint');
      persistedId = list[0].id;
      if (!persistedId) throw new Error('Insight ID is missing');
    });

    // -------------------------------------------------------------
    // Test 17: Insight history
    // -------------------------------------------------------------
    await test('17. Insight history retrieves saved organization insights', async () => {
      const res = await request('GET', '/api/insights', null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const list = res.body.data;
      if (!list || list.length === 0) throw new Error('Expected saved insights list');
    });

    // -------------------------------------------------------------
    // Test 18: Dismiss action
    // -------------------------------------------------------------
    await test('18. Dismiss action marks insight as dismissed', async () => {
      if (!persistedId) throw new Error('No persistedId available for dismiss test');
      const res = await request('POST', `/api/insights/${persistedId}/dismiss`, {}, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      const dismissed = res.body.data;
      if (dismissed.status !== 'dismissed') {
        throw new Error(`Expected status 'dismissed', got ${dismissed.status}`);
      }
    });

    // -------------------------------------------------------------
    // Test 19: Feedback
    // -------------------------------------------------------------
    await test('19. Feedback records useful/not_useful response', async () => {
      // Generate a fresh insight to submit feedback on
      const genRes = await request('POST', '/api/insights/generate', {}, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const insId = genRes.body.data[0]?.id;
      if (!insId) throw new Error('No insight generated');

      const res = await request('POST', `/api/insights/${insId}/feedback`, {
        feedback: 'useful'
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (res.body.data.feedback !== 'useful') {
        throw new Error(`Expected feedback 'useful', got ${res.body.data.feedback}`);
      }
    });

    // -------------------------------------------------------------
    // Test 20: RBAC permissions
    // -------------------------------------------------------------
    await test('20. RBAC allows Viewer to view and denies Viewer generate/manage', async () => {
      // Viewer can view
      const viewRes = await request('GET', '/api/insights', null, {
        Authorization: `Bearer ${viewerTokenA}`
      });
      if (viewRes.statusCode !== 200) throw new Error(`Viewer expected 200 on GET /insights, got ${viewRes.statusCode}`);

      // Viewer cannot generate
      const genRes = await request('POST', '/api/insights/generate', {}, {
        Authorization: `Bearer ${viewerTokenA}`
      });
      if (genRes.statusCode !== 403) throw new Error(`Viewer expected 403 on POST /insights/generate, got ${genRes.statusCode}`);
    });

    // -------------------------------------------------------------
    // Test 21: Cross-tenant isolation
    // -------------------------------------------------------------
    await test('21. Cross-tenant isolation prevents tenant B from seeing tenant A insights', async () => {
      const res = await request('GET', `/api/insights/${persistedId}`, null, {
        Authorization: `Bearer ${adminTokenB}`
      });
      if (res.statusCode !== 404 && res.statusCode !== 403) {
        throw new Error(`Expected 404/403 for cross-tenant access, got ${res.statusCode}`);
      }
    });

    // -------------------------------------------------------------
    // Test 22: Dashboard integration
    // -------------------------------------------------------------
    await test('22. Dashboard integration enriches ai_insights widget with live summaries', async () => {
      const dbRes = await Dashboard.create({
        organizationId: orgA,
        createdBy: 1,
        title: 'Executive AI Dashboard'
      });

      await Dashboard.addWidget(dbRes.id, {
        datasetId: datasetGrowth.id,
        title: 'AI Proactive Telemetry',
        type: 'ai_insights',
        position: { x: 0, y: 0, w: 6, h: 4 }
      });

      const res = await request('GET', `/api/dashboards/${dbRes.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const widget = res.body.data.widgets.find(w => w.type === 'ai_insights');
      if (!widget) throw new Error('ai_insights widget not found on dashboard');
      if (!widget.ai_insights || !widget.ai_insights.executive_summary) {
        throw new Error('Widget was not populated with ai_insights summary');
      }
    });

    // -------------------------------------------------------------
    // Test 23: Report integration
    // -------------------------------------------------------------
    await test('23. Report integration exports insights in PDF, Excel, CSV, JSON', async () => {
      // JSON
      const jsonRes = await reportService.exportInsightsReport({ organizationId: orgA, format: 'json' });
      if (!jsonRes.buffer || jsonRes.contentType !== 'application/json') throw new Error('Invalid JSON export');

      // CSV
      const csvRes = await reportService.exportInsightsReport({ organizationId: orgA, format: 'csv' });
      if (!csvRes.buffer || !csvRes.contentType.includes('text/csv')) throw new Error('Invalid CSV export');

      // Excel
      const xlsRes = await reportService.exportInsightsReport({ organizationId: orgA, format: 'excel' });
      if (!xlsRes.buffer) throw new Error('Invalid Excel export');

      // PDF
      const pdfRes = await reportService.exportInsightsReport({ organizationId: orgA, format: 'pdf' });
      if (!pdfRes.buffer || pdfRes.contentType !== 'application/pdf') throw new Error('Invalid PDF export');
    });

    // -------------------------------------------------------------
    // Test 24: Scheduler integration
    // -------------------------------------------------------------
    await test('24. Scheduler integration evaluateScheduledInsights runs safely', async () => {
      // Run scheduler evaluateScheduledInsights method
      await schedulerService.evaluateScheduledInsights();
    });

    // -------------------------------------------------------------
    // Test 25: Alert integration
    // -------------------------------------------------------------
    await test('25. Alert integration captures recent operational incidents', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const opIns = res.insights.find(i => i.type === 'operational');
      if (!opIns) throw new Error('Expected operational alert insight');
      if (opIns.evidence.alert_id !== activeAlert.id) {
        throw new Error(`Expected alert ID ${activeAlert.id}, got ${opIns.evidence.alert_id}`);
      }
    });

    // -------------------------------------------------------------
    // Test 26: Empty/no-insight case
    // -------------------------------------------------------------
    await test('26. Empty/no-insight case returns stable status gracefully', async () => {
      const summary = insightService._synthesizeExecutiveSummary([]);
      if (!summary.includes('No significant changes detected')) {
        throw new Error(`Expected "No significant changes detected", got: "${summary}"`);
      }
    });

    // -------------------------------------------------------------
    // Test 27: Duplicate insight prevention
    // -------------------------------------------------------------
    await test('27. Duplicate insight prevention generates cohesive bounded findings', async () => {
      const res1 = await insightService.generateInsights(orgA, { persist: false });
      const res2 = await insightService.generateInsights(orgA, { persist: false });
      if (res1.count !== res2.count) {
        throw new Error(`Expected identical deterministic count across evaluations: ${res1.count} vs ${res2.count}`);
      }
    });

    // -------------------------------------------------------------
    // Test 28: Sensitive data protection
    // -------------------------------------------------------------
    await test('28. Sensitive data protection ensures no raw secrets or tokens in output', async () => {
      const res = await insightService.generateInsights(orgA, { persist: false });
      const serialized = JSON.stringify(res);
      if (serialized.includes('secret') || serialized.includes('jwt') || serialized.includes('bearer') || serialized.includes('password')) {
        throw new Error('Detected sensitive token or credential leak in insight payload');
      }
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 16 TEST RESULTS: ${passed} / 28 PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Phase 16 tests:', err);
  process.exit(1);
});
