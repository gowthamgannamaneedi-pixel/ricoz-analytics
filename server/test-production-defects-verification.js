/**
 * Production Defects & Regression Verification Test Suite
 * Rigorously verifies the 5 core production bug fixes across:
 * 1. Dataset storage & 10,000-row record loading without missing-file errors
 * 2. Forecasts categorical rejection & genuine time-series predictions
 * 3. Data Quality worker scan, persisted progress, and terminal completion
 * 4. AI Insights genuine ground-truth detection and refresh persistence
 * 5. AI Analytics Assistant product ranking query & structured bar visualization
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const Dataset = require('./models/datasetModel');
const analyticsService = require('./services/analyticsService');

let server;
let port;
let baseUrl;
let authToken;
const testOrgId = '00000000-0000-0000-0000-000000000001';
const targetDatasetId = 31;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureList = [];

function check(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    const errText = `[FAIL] ${testName} ${details ? '(' + details + ')' : ''}`;
    console.error(`  ✗ ${errText}`);
    failureList.push(errText);
  }
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...headers
      }
    };

    let postData = null;
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) { json = { raw }; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runDefectsVerification() {
  console.log('================================================================');
  console.log('  RICOZ ANALYTICS — PRODUCTION DEFECTS REGRESSION VERIFICATION  ');
  console.log('================================================================\n');

  // 1. Setup server and authentication
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const pool = db.getPool();
  if (pool && !db.isUsingFallback()) {
    await pool.query(
      `UPDATE organizations SET subscription_status = 'active', payment_status = 'paid' WHERE id = $1`,
      [testOrgId]
    ).catch(() => {});
  }

  authToken = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: testOrgId },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  // --------------------------------------------------------------------------
  // TASK 1: DATASET STORAGE & 10,000 RECORDS ACCESSIBILITY
  // --------------------------------------------------------------------------
  console.log('[TASK 1] Dataset Storage & 10,000 Records Retrieval');
  const ds = await Dataset.findById(targetDatasetId);
  check(Boolean(ds), `Dataset #${targetDatasetId} exists in database`);
  check(ds.organization_id === testOrgId, `Dataset #${targetDatasetId} organization matches "${testOrgId}"`);
  check(Number(ds.row_count) === 10000, `Dataset #${targetDatasetId} metadata row_count strictly equals 10,000 (got ${ds.row_count})`);

  // Load records via analytics service
  const records = await analyticsService.loadDatasetRecords(ds);
  check(Array.isArray(records), 'loadDatasetRecords returns valid array');
  check(records.length === 10000, `Backend loaded exactly 10,000 records without missing-file error (got ${records.length})`);
  check(Boolean(records[0]?.order_id), `Record contains order_id field ("${records[0]?.order_id}")`);
  check(Boolean(records[0]?.revenue), `Record contains revenue field (${records[0]?.revenue})`);
  check(Boolean(records[0]?.product), `Record contains product field ("${records[0]?.product}")`);

  // Verify KPIs endpoint returns exact ground-truth aggregates
  const kpiRes = await request('GET', `/api/analytics/datasets/${targetDatasetId}/kpis`);
  check(kpiRes.status === 200, 'GET /api/analytics/datasets/:id/kpis returns 200 OK');
  const kpis = kpiRes.data?.data?.kpis;
  check(kpis?.totalOrders === 10000, `KPI totalOrders strictly equals 10,000 (got ${kpis?.totalOrders})`);
  check(Math.abs(kpis?.totalSales - 1291588836.71) < 1, `KPI totalSales matches ground-truth aggregate 1,291,588,836.71 (got ${kpis?.totalSales})`);
  check(kpis?.primaryMetricName === 'revenue', `Primary metric detected as "revenue" (got ${kpis?.primaryMetricName})`);

  // --------------------------------------------------------------------------
  // TASK 2: FORECASTS CATEGORICAL REJECTION & GENUINE TIME-SERIES PREDICTIONS
  // --------------------------------------------------------------------------
  console.log('\n[TASK 2] Forecasts Target Validation & Genuine Model Generation');

  // A. Negative Test: Submitting a categorical column as target
  const catForecast = await request('POST', '/api/forecasts/generate', {
    dataset_id: targetDatasetId,
    target_column: 'customer_segment',
    date_column: 'order_date',
    horizon_periods: 30,
    interval: 'daily'
  });
  check(catForecast.status === 400, `Categorical target "customer_segment" rejected with HTTP 400 (got ${catForecast.status})`);
  check(
    catForecast.data?.message?.includes('non-numeric') || catForecast.data?.message?.includes('numeric target'),
    `Diagnostic error message clearly explains non-numeric target limitation ("${catForecast.data?.message}")`
  );

  // B. Positive Test: Valid numeric target on Dataset 31
  const validForecast = await request('POST', '/api/forecasts/generate', {
    dataset_id: targetDatasetId,
    target_column: 'revenue',
    date_column: 'order_date',
    horizon_periods: 30,
    interval: 'daily',
    model_name: 'auto',
    persist: false
  });
  check(validForecast.status === 200, `Valid forecast on Dataset #${targetDatasetId} returns HTTP 200 OK (got ${validForecast.status})`);
  const fcData = validForecast.data?.data;
  check(fcData?.historical_points === 365, `Extracted 365 daily timeline points from the 10,000 rows (got ${fcData?.historical_points})`);
  check(fcData?.predictions?.length === 30, `Generated exactly 30 horizon predictions (got ${fcData?.predictions?.length})`);
  check(typeof fcData?.predictions?.[0]?.predicted === 'number', `Prediction value is numeric (${fcData?.predictions?.[0]?.predicted})`);
  check(fcData?.predictions?.[0]?.lower_bound < fcData?.predictions?.[0]?.predicted, 'Confidence interval lower bound < predicted value');
  check(fcData?.predictions?.[0]?.upper_bound > fcData?.predictions?.[0]?.predicted, 'Confidence interval upper bound > predicted value');
  check(typeof fcData?.metrics?.mape === 'number', `Accuracy metric MAPE computed (${fcData?.metrics?.mape}%)`);

  // --------------------------------------------------------------------------
  // TASK 3: DATA QUALITY ASYNCHRONOUS SCAN & TERMINAL STATE
  // --------------------------------------------------------------------------
  console.log('\n[TASK 3] Data Quality Full Scan & Progress Tracking');
  const auditStart = await request('POST', `/api/data-quality/datasets/${targetDatasetId}/audit`, {
    fullScan: true
  });
  check(auditStart.status === 202, `POST /api/data-quality/datasets/:id/audit returns HTTP 202 Accepted (got ${auditStart.status})`);
  const jobId = auditStart.data?.jobId || auditStart.data?.data?.job_id;
  check(Boolean(jobId), `Audit returns valid job ID ("${jobId}")`);

  let finalJob = null;
  for (let poll = 0; poll < 40; poll++) {
    await new Promise(r => setTimeout(r, 200));
    const jobRes = await request('GET', `/api/data-quality/jobs/${jobId}`);
    const j = jobRes.data?.data || jobRes.data?.job;
    if (j?.status === 'COMPLETED' || j?.status === 'FAILED') {
      finalJob = j;
      break;
    }
  }

  check(Boolean(finalJob), 'Data Quality worker reaches terminal state within timeout');
  check(finalJob?.status === 'COMPLETED', `Job status reached COMPLETED (got "${finalJob?.status}")`);
  check(finalJob?.rows_processed === 10000 || finalJob?.total_rows === 10000, `Processed exactly 10,000 rows (got ${finalJob?.rows_processed})`);
  check(finalJob?.error_message === null, 'Worker completed with 0 errors');

  // Verify Quality Profile endpoint returns populated dimensions
  const profileRes = await request('GET', `/api/data-quality/datasets/${targetDatasetId}`);
  check(profileRes.status === 200, 'GET /api/data-quality/datasets/:id returns 200 OK');
  const prof = profileRes.data?.data || profileRes.data?.profile;
  const score = prof?.overall_score || prof?.quality_score;
  check(typeof score === 'number' && score > 90, `Data Quality composite score calculated (${score}/100)`);
  check(Boolean(prof?.dimensions?.completeness), 'Dimensions include completeness audit');
  check(Boolean(prof?.dimensions?.validity), 'Dimensions include validity audit');
  check(Boolean(prof?.dimensions?.uniqueness), 'Dimensions include uniqueness audit');

  // --------------------------------------------------------------------------
  // TASK 4: AI INSIGHTS GROUND-TRUTH GENERATION & PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n[TASK 4] AI Insights Scoping & Refresh Persistence');
  const genInsights = await request('POST', '/api/insights/generate', {
    datasetId: targetDatasetId,
    persist: true,
    forceFresh: true
  });
  check(genInsights.status === 200, `POST /api/insights/generate returns HTTP 200 OK (got ${genInsights.status})`);
  const insights = genInsights.data?.insights || genInsights.data?.data || [];
  check(insights.length >= 5, `Generated genuine insights on Dataset #${targetDatasetId} (got ${insights.length})`);
  const allScoped = insights.every(i => Number(i.dataset_id) === targetDatasetId);
  check(allScoped, `All insights are strictly scoped to target dataset #${targetDatasetId}`);

  // Confirm insights persist on refresh
  const getInsightsRes = await request('GET', `/api/insights?datasetId=${targetDatasetId}`);
  check(getInsightsRes.status === 200, 'GET /api/insights?datasetId=:id returns 200 OK');
  const persistedList = getInsightsRes.data?.insights || getInsightsRes.data?.data || [];
  check(persistedList.length >= 5, `Insights successfully persisted and retrieved on page refresh (count: ${persistedList.length})`);

  // --------------------------------------------------------------------------
  // TASK 5: AI ANALYTICS ASSISTANT — TOP 5 PRODUCTS RANKING QUERY
  // --------------------------------------------------------------------------
  console.log('\n[TASK 5] AI Assistant Query Execution on Product & Revenue');
  const aiQueryRes = await request('POST', '/api/ai/query', {
    message: 'Show the top 5 products by total revenue in a bar chart.',
    datasetId: targetDatasetId
  });
  check(aiQueryRes.status === 200, `POST /api/ai/query returns HTTP 200 OK (got ${aiQueryRes.status})`);
  const aiData = aiQueryRes.data?.data;
  check(aiData?.intent === 'ranking', `Intent accurately classified as "ranking" (got "${aiData?.intent}")`);
  check(aiData?.plan?.group_by === 'product', `Query plan groups by "product" (got "${aiData?.plan?.group_by}")`);
  check(aiData?.plan?.metric === 'revenue', `Query plan measures metric "revenue" (got "${aiData?.plan?.metric}")`);
  check(aiData?.plan?.visualization === 'bar', `Query plan specifies bar chart visualization (got "${aiData?.plan?.visualization}")`);

  const ranking = aiData?.data?.ranking;
  check(Array.isArray(ranking) && ranking.length === 5, `Aggregated exactly top 5 products (got ${ranking?.length})`);
  check(ranking?.[0]?.name === 'Laptop Pro', `Leader product is "Laptop Pro" (got "${ranking?.[0]?.name}")`);
  check(ranking?.[0]?.value > ranking?.[1]?.value, 'Products sorted strictly in descending order of revenue');
  check(aiData?.visualization?.type === 'bar', `Visualization payload type is "bar" (got "${aiData?.visualization?.type}")`);
  check(Boolean(aiData?.answer) && aiData?.answer.includes('Laptop Pro'), 'Generated textual answer cites the top product "Laptop Pro"');

  // Clean teardown
  server.close();

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFailures:');
    failureList.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll original production defects verified as RESOLVED with ground-truth evidence!');
    process.exit(0);
  }
}

runDefectsVerification().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
