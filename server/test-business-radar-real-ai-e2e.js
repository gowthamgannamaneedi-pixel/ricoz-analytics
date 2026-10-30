const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const Dataset = require('./models/datasetModel');
const InsightModel = require('./models/insightModel');
const storage = require('./storage');
const geminiService = require('./services/geminiService');

/**
 * MANDATORY END-TO-END VERIFICATION SUITE: BUSINESS RADAR REAL DATA & REAL AI
 * 
 * Verifies all 16 required test scenarios:
 * 1. A real insight with valid source data.
 * 2. A revenue-decline insight.
 * 3. A region-ranking question / dimensional slices.
 * 4. A product or channel contributor analysis.
 * 5. An insight with insufficient historical data.
 * 6. An invalid or missing insight ID.
 * 7. An unauthorized cross-tenant request.
 * 8. Missing AI API configuration.
 * 9. Invalid AI credentials.
 * 10. Provider quota/rate-limit failure.
 * 11. Provider timeout or network failure.
 * 12. Malformed AI output.
 * 13. Retry after a recoverable failure.
 * 14. Two different insights analyzed independently.
 * 15. Numerical agreement between analytics calculations and displayed results.
 * 16. Verification that unsupported causes are not presented as established facts.
 */
async function runEndToEndTests() {
  console.log('======================================================================');
  console.log('  BUSINESS RADAR MANDATORY 16-SCENARIO END-TO-END TEST SUITE          ');
  console.log('======================================================================\n');

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
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  const testOrgA = '00000000-0000-0000-0000-000000000001';
  const testOrgB = '00000000-0000-0000-0000-000000000002';

  // Ensure both test organizations have enterprise plan for insights entitlement
  await db.query("UPDATE organizations SET plan = 'enterprise', subscription_status = 'active' WHERE id IN ($1, $2)", [testOrgA, testOrgB]).catch(() => null);
  if (db.fallbackOrganizations) {
    db.fallbackOrganizations.forEach(o => {
      if (o.id === testOrgA || o.id === testOrgB) o.plan = 'enterprise';
    });
  }

  function generateToken(userId, email, role, orgId) {
    return jwt.sign(
      { id: userId, email, role, organization_id: orgId },
      config.jwtSecret || 'dev-jwt-secret-key-12345',
      { expiresIn: '1h' }
    );
  }

  function apiReq(baseUrl, method, reqPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(reqPath, baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { ...headers }
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
          try { parsed = JSON.parse(data); } catch (_) {}
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (reqBody) req.write(reqBody);
      req.end();
    });
  }

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const serverPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  const tokenAdminA = generateToken(1, 'admin@ricoz.test', 'admin', testOrgA);
  const tokenAdminB = generateToken(10, 'admin_b@other.test', 'admin', testOrgB);

  // Setup authorized real datasets
  // Dataset 1: Regional Sales Telemetry (Revenue decline in North, gain in South)
  const csvContent1 = [
    'date,region,category,sales_amount',
    '2026-01-01,North,Electronics,15000',
    '2026-01-02,South,Electronics,10000',
    '2026-02-01,North,Electronics,5000',
    '2026-02-02,South,Electronics,12000'
  ].join('\n');

  const saveRes1 = await storage.saveFile(1, 'radar_e2e_dataset1.csv', Buffer.from(csvContent1));
  const dataset1 = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Regional Sales Telemetry',
    filePath: saveRes1.filePath,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'sales_amount', type: 'number' }
    ]
  });

  // Insight 1: Revenue Decline Insight
  const insightDecline = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: dataset1.id,
    type: 'decline',
    title: 'North Region Sales Contraction',
    summary: 'Sales contracted by 32% over observation intervals.',
    severity: 'critical',
    confidence: 0.96,
    evidence: {
      datasetId: dataset1.id,
      metric: 'sales_amount',
      currentValue: 17000,
      comparisonValue: 25000,
      changePercent: -32.0,
      recordsAnalyzed: 4,
      comparisonPeriod: 'Jan 2026',
      currentPeriod: 'Feb 2026',
      verified: true
    }
  });

  // Dataset 2: Category Product Volume (Growth in Furniture)
  const csvContent2 = [
    'date,category,channel,order_volume',
    '2026-01-10,Furniture,Online,200',
    '2026-01-11,Apparel,Online,400',
    '2026-02-10,Furniture,Online,550',
    '2026-02-11,Apparel,Online,420'
  ].join('\n');

  const saveRes2 = await storage.saveFile(1, 'radar_e2e_dataset2.csv', Buffer.from(csvContent2));
  const dataset2 = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Catalog Volume Telemetry',
    filePath: saveRes2.filePath,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'category', type: 'string' },
      { name: 'channel', type: 'string' },
      { name: 'order_volume', type: 'number' }
    ]
  });

  // Insight 2: Category Growth Insight
  const insightGrowth = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: dataset2.id,
    type: 'growth',
    title: 'Furniture Order Volume Expansion',
    summary: 'Furniture volume experienced strong positive expansion.',
    severity: 'positive',
    confidence: 0.94,
    evidence: {
      datasetId: dataset2.id,
      metric: 'order_volume',
      currentValue: 970,
      comparisonValue: 600,
      changePercent: 61.67,
      recordsAnalyzed: 4,
      comparisonPeriod: 'Jan 2026',
      currentPeriod: 'Feb 2026',
      verified: true
    }
  });

  // Dataset 3: Insufficient Historical Data (Only 1 row)
  const csvContent3 = [
    'date,region,revenue',
    '2026-01-01,North,500'
  ].join('\n');

  const saveRes3 = await storage.saveFile(1, 'radar_e2e_insufficient.csv', Buffer.from(csvContent3));
  const datasetInsufficient = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Single Observation Dataset',
    filePath: saveRes3.filePath,
    rowCount: 1,
    columnCount: 3,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'revenue', type: 'number' }
    ]
  });

  const insightInsufficient = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: datasetInsufficient.id,
    type: 'anomaly',
    title: 'Single Observation Anomaly',
    summary: 'Telemetry observation with only 1 sample record.',
    severity: 'info',
    confidence: 0.5,
    evidence: {
      datasetId: datasetInsufficient.id,
      metric: 'revenue',
      currentValue: 500,
      comparisonValue: 500,
      changePercent: 0,
      recordsAnalyzed: 1,
      verified: true
    }
  });

  // Helper to preserve original geminiService state
  const originalApiKey = geminiService.apiKey;
  const originalGenerateContent = geminiService.generateContent.bind(geminiService);

  try {
    // --------------------------------------------------------------------
    // Scenario 1: Real insight with valid source data
    // --------------------------------------------------------------------
    await test('1. Real insight with valid source data produces complete 5-section response', async () => {
      // Mock Gemini API generateContent to simulate authentic Gemini 2.5 Flash response
      geminiService.apiKey = 'AIzaSyTestMockKeyForRealModelSimulation';
      geminiService.generateContent = async (prompt) => {
        return JSON.stringify({
          whatChanged: {
            summary: "Sales amount decreased by 32% (-8,000) from 25,000 to 17,000 comparing Feb 2026 vs Jan 2026.",
            metric: "sales amount",
            period: "Feb 2026 vs Jan 2026",
            baselineValue: 25000,
            currentValue: 17000,
            delta: -8000,
            deltaPercent: -32
          },
          whatDataShows: {
            summary: "North recorded the steepest downward change (-10,000, accounting for 125% of net difference), while South showed positive variance (+2,000).",
            topDrivers: [
              { segment: "North", delta: -10000, contributionPercent: 125, role: "detractor" },
              { segment: "South", delta: 2000, contributionPercent: -25, role: "sustainer" }
            ],
            concentration: "Movement is concentrated in North."
          },
          whyHappened: {
            observedPatterns: "Observed decline in North co-occurred with continued modest expansion in South.",
            hypotheses: [
              "[Hypothesis] Regional customer demand or transaction frequency shift in North.",
              "[Hypothesis] Catalog pricing or inventory availability changes during February."
            ],
            externalFactorsNeeded: "Order transaction logs and marketing spend data required to test hypotheses."
          },
          whatToCheckNext: [
            { action: "Audit order volume in North", reasoning: "North accounted for 125% of net change." },
            { action: "Verify supply availability", reasoning: "Helps rule out out-of-stock events." },
            { action: "Set up threshold alert", reasoning: "Notifies if sales drops further." }
          ],
          evidenceAndLimitations: {
            sourceDataset: "Regional Sales Telemetry",
            reportingPeriod: "Jan 2026 to Feb 2026",
            recordsAnalyzed: 4,
            calculations: "((Current - Baseline) / ABS(Baseline)) * 100",
            limitations: "Observational findings. Does not prove causal direction without controlled experimentation."
          }
        });
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.aiGenerated, true);
      assert(res.body.data.analysis !== undefined, 'Analysis payload must be present');
      assert(res.body.data.analysis.whatChanged !== undefined, 'Section A must be present');
      assert(res.body.data.analysis.whatDataShows !== undefined, 'Section B must be present');
      assert(res.body.data.analysis.whyHappened !== undefined, 'Section C must be present');
      assert(res.body.data.analysis.whatToCheckNext !== undefined, 'Section D must be present');
      assert(res.body.data.analysis.evidenceAndLimitations !== undefined, 'Section E must be present');
    });

    // --------------------------------------------------------------------
    // Scenario 2: Revenue-decline insight
    // --------------------------------------------------------------------
    await test('2. Revenue-decline insight identifies contraction and primary detractor accurately', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.body.data;
      assert.strictEqual(data.totalDelta, -8000);
      assert.strictEqual(data.totalDeltaPercent, -32);
      assert(data.primaryDetractor !== null, 'Primary detractor must be identified');
      assert.strictEqual(data.primaryDetractor.segment, 'North');
      assert.strictEqual(data.primaryDetractor.delta, -10000);
    });

    // --------------------------------------------------------------------
    // Scenario 3: Region-ranking / dimensional slices
    // --------------------------------------------------------------------
    await test('3. Region dimensional slices decompose variance across region categories', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.dimension, 'region');
      assert(Array.isArray(res.body.data.drivers));
      assert(res.body.data.drivers.length >= 2);
      const segments = res.body.data.drivers.map(d => d.segment);
      assert(segments.includes('North'));
      assert(segments.includes('South'));
    });

    // --------------------------------------------------------------------
    // Scenario 4: Product or channel contributor analysis
    // --------------------------------------------------------------------
    await test('4. Alternate dimension query (?dimension=category) recalibrates drivers for category', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?dimension=category`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.dimension, 'category');
      assert(Array.isArray(res.body.data.drivers));
      assert.strictEqual(res.body.data.drivers[0].segment, 'Electronics');
    });

    // --------------------------------------------------------------------
    // Scenario 5: Insight with insufficient historical data
    // --------------------------------------------------------------------
    await test('5. Insight with insufficient data returns explicit emptyReason without fake numbers', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightInsufficient.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.status, 'insufficient_evidence');
      assert.strictEqual(res.body.data.aiGenerated, false);
      assert(res.body.data.emptyReason.includes('insufficient historical data'));
    });

    // --------------------------------------------------------------------
    // Scenario 6: Invalid or missing insight ID
    // --------------------------------------------------------------------
    await test('6. Non-existent UUID and malformed ID return 404 NOT_FOUND envelope', async () => {
      const missingUuid = '99999999-9999-9999-9999-999999999999';
      const res1 = await apiReq(baseUrl, 'GET', `/api/insights/${missingUuid}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res1.statusCode, 404);
      assert.strictEqual(res1.body.error.code, 'NOT_FOUND');

      const res2 = await apiReq(baseUrl, 'GET', `/api/insights/non-uuid-string/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res2.statusCode, 404);
      assert.strictEqual(res2.body.error.code, 'NOT_FOUND');
    });

    // --------------------------------------------------------------------
    // Scenario 7: Unauthorized cross-tenant request
    // --------------------------------------------------------------------
    await test('7. Unauthorized cross-tenant request returns 404 NOT_FOUND (tenant isolation enforced)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminB}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    // --------------------------------------------------------------------
    // Scenario 8: Missing AI API configuration
    // --------------------------------------------------------------------
    await test('8. Missing AI API configuration returns explicit 503 error without fabricated success', async () => {
      // Temporarily strip API key and restore real generator
      geminiService.apiKey = '';
      geminiService.generateContent = originalGenerateContent;

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AI_NOT_CONFIGURED');
      assert(res.body.error.message.includes('AI provider is not configured'));
      // Data payload includes verified calculations so user has canViewDeterministic option
      assert(res.body.data.canViewDeterministic === true);
    });

    // --------------------------------------------------------------------
    // Scenario 9: Invalid AI credentials
    // --------------------------------------------------------------------
    await test('9. Invalid AI credentials return explicit 401 error', async () => {
      geminiService.apiKey = 'invalid_key';
      geminiService.generateContent = async () => {
        const err = new Error('AI analysis failed due to invalid credentials. Please check your AI API key configuration.');
        err.code = 'AI_AUTH_FAILED';
        err.status = 401;
        throw err;
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AI_AUTH_FAILED');
    });

    // --------------------------------------------------------------------
    // Scenario 10: Provider quota/rate-limit failure
    // --------------------------------------------------------------------
    await test('10. Provider quota/rate-limit failure returns explicit 429 with retryable flag', async () => {
      geminiService.apiKey = 'quota_exceeded_key';
      geminiService.generateContent = async () => {
        const err = new Error('AI analysis failed because the provider quota was exceeded. Please try again later.');
        err.code = 'AI_QUOTA_EXCEEDED';
        err.status = 429;
        throw err;
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 429);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AI_QUOTA_EXCEEDED');
      assert.strictEqual(res.body.error.retryable, true);
    });

    // --------------------------------------------------------------------
    // Scenario 11: Provider timeout or network failure
    // --------------------------------------------------------------------
    await test('11. Provider timeout returns explicit 504 with retryable flag', async () => {
      geminiService.apiKey = 'timeout_key';
      geminiService.generateContent = async () => {
        const err = new Error('Gemini API request timed out');
        err.code = 'AI_TIMEOUT';
        err.status = 504;
        throw err;
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 504);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AI_TIMEOUT');
      assert.strictEqual(res.body.error.retryable, true);
    });

    // --------------------------------------------------------------------
    // Scenario 12: Malformed AI output
    // --------------------------------------------------------------------
    await test('12. Malformed AI output fails validation and returns 500 error instead of corrupt text', async () => {
      geminiService.apiKey = 'mock_key';
      geminiService.generateContent = async () => {
        return "This is plain text with no JSON schema.";
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'AI_VALIDATION_FAILED');
    });

    // --------------------------------------------------------------------
    // Scenario 13: Retry after a recoverable failure
    // --------------------------------------------------------------------
    await test('13. Retry after recoverable failure succeeds when provider recovers', async () => {
      let callCount = 0;
      geminiService.apiKey = 'mock_key';
      geminiService.generateContent = async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('AI analysis failed because the provider quota was exceeded. Please try again later.');
          err.code = 'AI_QUOTA_EXCEEDED';
          err.status = 429;
          throw err;
        }
        return JSON.stringify({
          whatChanged: { summary: "Recovered analysis", metric: "sales_amount", period: "Feb 2026", baselineValue: 25000, currentValue: 17000, delta: -8000, deltaPercent: -32 },
          whatDataShows: { summary: "Data recovered", topDrivers: [], concentration: "dispersed" },
          whyHappened: { observedPatterns: "Patterns", hypotheses: ["Hypothesis A"], externalFactorsNeeded: "None" },
          whatToCheckNext: [{ action: "Check logs", reasoning: "Validation" }],
          evidenceAndLimitations: { sourceDataset: "Dataset", reportingPeriod: "Jan-Feb", recordsAnalyzed: 4, calculations: "calc", limitations: "limit" }
        });
      };

      // First call fails with 429
      const res1 = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res1.statusCode, 429);

      // Retry call succeeds with 200
      const res2 = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res2.body.success, true);
      assert.strictEqual(res2.body.data.aiGenerated, true);
    });

    // --------------------------------------------------------------------
    // Scenario 14: Two different insights analyzed independently
    // --------------------------------------------------------------------
    await test('14. Two different insights analyzed independently without cross-contamination', async () => {
      geminiService.apiKey = 'mock_key';
      geminiService.generateContent = async (prompt) => {
        if (prompt.includes('Regional Sales Telemetry')) {
          return JSON.stringify({
            whatChanged: { summary: "Sales decline analysis", metric: "sales_amount", period: "Feb vs Jan", baselineValue: 25000, currentValue: 17000, delta: -8000, deltaPercent: -32 },
            whatDataShows: { summary: "North detractor", topDrivers: [{ segment: "North", delta: -10000, contributionPercent: 125, role: "detractor" }], concentration: "concentrated" },
            whyHappened: { observedPatterns: "Regional shift", hypotheses: ["Hypothesis regional"], externalFactorsNeeded: "External logs" },
            whatToCheckNext: [{ action: "Audit North orders", reasoning: "North lag" }],
            evidenceAndLimitations: { sourceDataset: "Regional Sales Telemetry", reportingPeriod: "Jan-Feb", recordsAnalyzed: 4, calculations: "calc", limitations: "none" }
          });
        } else {
          return JSON.stringify({
            whatChanged: { summary: "Furniture growth analysis", metric: "order_volume", period: "Feb vs Jan", baselineValue: 600, currentValue: 970, delta: 370, deltaPercent: 61.67 },
            whatDataShows: { summary: "Furniture expansion", topDrivers: [{ segment: "Furniture", delta: 350, contributionPercent: 94.6, role: "sustainer" }], concentration: "concentrated" },
            whyHappened: { observedPatterns: "Catalog shift", hypotheses: ["Hypothesis demand"], externalFactorsNeeded: "Catalog logs" },
            whatToCheckNext: [{ action: "Expand Furniture stock", reasoning: "High velocity" }],
            evidenceAndLimitations: { sourceDataset: "Catalog Volume Telemetry", reportingPeriod: "Jan-Feb", recordsAnalyzed: 4, calculations: "calc", limitations: "none" }
          });
        }
      };

      const resDecline = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      const resGrowth = await apiReq(baseUrl, 'GET', `/api/insights/${insightGrowth.id}/root-cause?forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });

      assert.strictEqual(resDecline.body.data.metric, 'sales_amount');
      assert.strictEqual(resDecline.body.data.totalDelta, -8000);
      assert.strictEqual(resDecline.body.data.analysis.whatChanged.metric, 'sales amount');

      assert.strictEqual(resGrowth.body.data.metric, 'order_volume');
      assert.strictEqual(resGrowth.body.data.totalDelta, 370);
      assert.strictEqual(resGrowth.body.data.analysis.whatChanged.metric, 'order volume');

      // Guarantee no cross-insight data leakage
      assert.notStrictEqual(resDecline.body.data.metric, resGrowth.body.data.metric);
      assert.notStrictEqual(resDecline.body.data.totalDelta, resGrowth.body.data.totalDelta);
    });

    // --------------------------------------------------------------------
    // Scenario 15: Numerical agreement between analytics and displayed results
    // --------------------------------------------------------------------
    await test('15. Strict numerical agreement between analytics calculations and response', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      const data = res.body.data;
      const analysis = data.analysis;

      // Identity 1: Sum of segment deltas equals totalDelta
      const sumDeltas = data.drivers.reduce((acc, d) => acc + d.segmentDelta, 0);
      assert.strictEqual(Number(sumDeltas.toFixed(2)), data.totalDelta);
      assert.strictEqual(data.mathBalanceVerified, true);

      // Identity 2: whatChanged numbers match raw attribution numbers exactly
      assert.strictEqual(analysis.whatChanged.baselineValue, data.totalBaseline);
      assert.strictEqual(analysis.whatChanged.currentValue, data.totalCurrent);
      assert.strictEqual(analysis.whatChanged.delta, data.totalDelta);
      assert.strictEqual(analysis.whatChanged.deltaPercent, data.totalDeltaPercent);
    });

    // --------------------------------------------------------------------
    // Scenario 16: Verification that unsupported causes are not presented as facts
    // --------------------------------------------------------------------
    await test('16. Unsupported causes are sanitized and not presented as established facts', async () => {
      // Mock Gemini attempting to claim direct causality
      geminiService.apiKey = 'mock_key';
      geminiService.generateContent = async () => {
        return JSON.stringify({
          whatChanged: { summary: "Decline was caused by North region.", metric: "sales_amount", period: "Feb", baselineValue: 25000, currentValue: 17000, delta: -8000, deltaPercent: -32 },
          whatDataShows: { summary: "North drop is caused by customer loss.", topDrivers: [], concentration: "concentrated" },
          whyHappened: { observedPatterns: "Decline directly caused revenue loss.", hypotheses: ["Hypothesis A"], externalFactorsNeeded: "None" },
          whatToCheckNext: [{ action: "Check North", reasoning: "It caused the dip." }],
          evidenceAndLimitations: { sourceDataset: "Dataset", reportingPeriod: "Jan-Feb", recordsAnalyzed: 4, calculations: "calc", limitations: "none" }
        });
      };

      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightDecline.id}/root-cause?forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });

      const fullText = JSON.stringify(res.body.data.analysis).toLowerCase();
      assert(!fullText.includes(' was caused by '), 'Prohibited causal claim "was caused by" must be sanitized');
      assert(!fullText.includes(' is caused by '), 'Prohibited causal claim "is caused by" must be sanitized');
      assert(!fullText.includes(' directly caused '), 'Prohibited causal claim "directly caused" must be sanitized');
    });

  } finally {
    // Restore original geminiService state
    geminiService.apiKey = originalApiKey;
    geminiService.generateContent = originalGenerateContent;
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`  E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEndToEndTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
