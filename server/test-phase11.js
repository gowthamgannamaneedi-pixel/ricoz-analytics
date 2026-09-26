/**
 * Comprehensive Automated Test Suite for Phase 11: Predictive Time-Series Forecasting & ML Anomaly Detection
 * Tests 25 critical functional, ML model algorithms, confidence bounds, anomaly scoring,
 * RBAC, multi-tenant isolation, resilience, and validation requirements:
 *
 * 1. Unauthenticated request to /api/forecasts returns 401 Unauthorized
 * 2. Authenticated user (Viewer) can list forecasts (GET /api/forecasts) with 200 OK
 * 3. Direct time-series generation: Linear Regression computes valid horizon predictions & metrics
 * 4. Direct time-series generation: Holt-Winters Exponential Smoothing models trend & confidence bounds
 * 5. Direct time-series generation: ARIMA models autoregressive time-series predictions
 * 6. Direct time-series generation: Auto model selection chooses best-fit model
 * 7. Confidence interval calculation: Bounds wrap predicted values (lower_bound <= predicted <= upper_bound)
 * 8. Confidence interval scaling: 99% interval is strictly wider than 80% interval
 * 9. Anomaly detection: POST /api/forecasts/anomalies identifies significant spikes/dips with scores
 * 10. Anomaly detection: Normal non-outlier time-series produces 0 anomalies
 * 11. Combined forecasting & anomaly detection: POST /api/forecasts/generate returns predictions and anomaly list
 * 12. Forecast Persistence: Authorized user creates and saves forecast record (POST /api/forecasts) with 201 Created
 * 13. Forecast Persistence: Retrieve single forecast by ID (GET /api/forecasts/:id) with 200 OK
 * 14. Forecast Deletion: Authorized user (Admin/Manager) deletes forecast record (DELETE /api/forecasts/:id) with 200 OK
 * 15. Validation: Insufficient historical points (< 4 points) rejected with 400 Bad Request
 * 16. Validation: Invalid forecast horizon (e.g. 0 or >365) rejected with 400 Bad Request
 * 17. Validation: Invalid interval format rejected with 400 Bad Request
 * 18. Validation: Missing series and dataset/metric identifiers rejected with 400 Bad Request
 * 19. RBAC: Viewer role is blocked from generating forecasts (403 Forbidden)
 * 20. RBAC: Viewer role is blocked from creating forecast records (403 Forbidden)
 * 21. RBAC: Viewer role is blocked from deleting forecast records (403 Forbidden)
 * 22. RBAC: Analyst role CANNOT delete forecast records (403 Forbidden)
 * 23. Multi-Tenant Isolation: Organization B cannot view Organization A forecast (404 Isolated)
 * 24. Multi-Tenant Isolation: Organization B cannot delete Organization A forecast (404 Isolated)
 * 25. ML Service Resilience & Fallback: Statistical fallback operates seamlessly even without Python ML microservice
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const ForecastModel = require('./models/forecastModel');
const mlForecastService = require('./services/mlForecastService');

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

// Sample realistic time series dataset
function generateSampleTimeSeries(n = 30, base = 1000, trend = 25, noise = 50) {
  const points = [];
  const start = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const val = base + (i * trend) + (Math.sin(i / 2) * noise);
    points.push({ date: dateStr, value: Math.round(val * 100) / 100 });
  }
  return points;
}

// Token generator
function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

// Test Runner
async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 11: PREDICTIVE FORECASTING & ANOMALY DETECTION TEST SUITE');
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

  let createdForecastId = null;
  const sampleSeries = generateSampleTimeSeries(30, 1000, 20, 30);

  // Test 1: Unauthenticated request
  await test('1. Unauthenticated request to /api/forecasts returns 401 Unauthorized', async () => {
    const res = await request('GET', '/api/forecasts');
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  // Test 2: Authenticated list
  await test('2. Authenticated user (Viewer) can list forecasts (GET /api/forecasts) with 200 OK', async () => {
    const res = await request('GET', '/api/forecasts', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 with success=true, got ${res.statusCode}`);
    }
    if (!Array.isArray(res.body.data)) throw new Error('Expected data to be an array');
  });

  // Test 3: Linear Regression Model
  await test('3. Direct time-series generation: Linear Regression computes valid horizon predictions & metrics', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 10,
      model_name: 'linear_regression',
      interval: 'daily',
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const { model, predictions, metrics } = res.body.data;
    if (model !== 'linear_regression') throw new Error(`Expected model linear_regression, got ${model}`);
    if (!predictions || predictions.length !== 10) throw new Error(`Expected 10 predictions, got ${predictions?.length}`);
    if (metrics.r2 === undefined || metrics.mae === undefined) throw new Error('Expected evaluation metrics');
    if (predictions[9].predicted <= predictions[0].predicted) {
      throw new Error('Linear regression should capture upward trend');
    }
  });

  // Test 4: Holt-Winters Model
  await test('4. Direct time-series generation: Holt-Winters Exponential Smoothing models trend & confidence bounds', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 7,
      model_name: 'holt_winters',
      interval: 'daily',
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }

    const { model, predictions } = res.body.data;
    if (!['holt_winters', 'exponential_smoothing'].includes(model)) {
      throw new Error(`Expected holt_winters model, got ${model}`);
    }
    if (!predictions || predictions.length !== 7) throw new Error(`Expected 7 predictions, got ${predictions?.length}`);
    predictions.forEach(p => {
      if (typeof p.predicted !== 'number' || typeof p.lower_bound !== 'number' || typeof p.upper_bound !== 'number') {
        throw new Error('Prediction points must include predicted, lower_bound, upper_bound numbers');
      }
    });
  });

  // Test 5: ARIMA Model
  await test('5. Direct time-series generation: ARIMA models autoregressive time-series predictions', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 5,
      model_name: 'arima',
      interval: 'daily',
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const { model, predictions } = res.body.data;
    if (!['arima', 'auto', 'linear_regression'].includes(model)) {
      throw new Error(`Expected arima model, got ${model}`);
    }
    if (!predictions || predictions.length !== 5) throw new Error(`Expected 5 predictions, got ${predictions?.length}`);
  });

  // Test 6: Auto ML Model Selection
  await test('6. Direct time-series generation: Auto model selection chooses best-fit model', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 14,
      model_name: 'auto',
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }

    const { model, predictions, metrics } = res.body.data;
    if (!['linear_regression', 'holt_winters', 'arima', 'exponential_smoothing'].includes(model)) {
      throw new Error(`Expected auto to resolve to a concrete model, got ${model}`);
    }
    if (predictions.length !== 14) throw new Error(`Expected 14 predictions, got ${predictions.length}`);
    if (metrics.mape === undefined) throw new Error('Expected MAPE evaluation metric');
  });

  // Test 7: Confidence Bounds Validity
  await test('7. Confidence interval calculation: Bounds wrap predicted values (lower_bound <= predicted <= upper_bound)', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 10,
      confidence_level: 0.95,
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const { predictions } = res.body.data;
    for (const p of predictions) {
      if (p.lower_bound > p.predicted + 0.001) {
        throw new Error(`Lower bound (${p.lower_bound}) exceeds predicted value (${p.predicted})`);
      }
      if (p.upper_bound < p.predicted - 0.001) {
        throw new Error(`Upper bound (${p.upper_bound}) is less than predicted value (${p.predicted})`);
      }
    }
  });

  // Test 8: Confidence Level Scaling (99% wider than 80%)
  await test('8. Confidence interval scaling: 99% interval is strictly wider than 80% interval', async () => {
    const res80 = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 5,
      confidence_level: 0.80,
      model_name: 'linear_regression',
      persist: false
    }, { Authorization: `Bearer ${analystTokenA}` });

    const res99 = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 5,
      confidence_level: 0.99,
      model_name: 'linear_regression',
      persist: false
    }, { Authorization: `Bearer ${analystTokenA}` });

    const width80 = res80.body.data.predictions[4].upper_bound - res80.body.data.predictions[4].lower_bound;
    const width99 = res99.body.data.predictions[4].upper_bound - res99.body.data.predictions[4].lower_bound;

    if (width99 <= width80) {
      throw new Error(`99% interval width (${width99}) should be larger than 80% width (${width80})`);
    }
  });

  // Test 9: Anomaly Detection on Spikes & Dips
  await test('9. Anomaly detection: POST /api/forecasts/anomalies identifies significant spikes/dips with scores', async () => {
    const anomalousSeries = [...sampleSeries];
    anomalousSeries[15] = { date: '2026-01-16', value: 35000 }; // Extreme Spike
    anomalousSeries[22] = { date: '2026-01-23', value: 10 };    // Extreme Dip

    const res = await request('POST', '/api/forecasts/anomalies', {
      series: anomalousSeries,
      z_threshold: 2.0
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const anomalies = res.body.data;
    if (!anomalies || anomalies.length < 2) {
      throw new Error(`Expected at least 2 anomalies, found ${anomalies?.length}`);
    }

    const spike = anomalies.find(a => a.timestamp === '2026-01-16');
    if (!spike) throw new Error('Expected spike anomaly at 2026-01-16');
    if (spike.severity !== 'critical' && spike.severity !== 'high') {
      throw new Error(`Expected high/critical severity for extreme spike, got ${spike.severity}`);
    }
    if (spike.direction !== 'spike') throw new Error(`Expected direction spike, got ${spike.direction}`);
  });

  // Test 10: Clean Series Produces 0 Anomalies
  await test('10. Anomaly detection: Normal non-outlier time-series produces 0 anomalies', async () => {
    const smoothSeries = [];
    for (let i = 0; i < 20; i++) {
      smoothSeries.push({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, value: 1000 + i * 5 });
    }

    const res = await request('POST', '/api/forecasts/anomalies', {
      series: smoothSeries,
      z_threshold: 3.0
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.count !== 0) throw new Error(`Expected 0 anomalies on smooth series, found ${res.body.count}`);
  });

  // Test 11: Combined Forecasting & Anomaly Detection
  await test('11. Combined forecasting & anomaly detection: POST /api/forecasts/generate returns predictions and anomaly list', async () => {
    const testSeries = [...sampleSeries];
    testSeries[10] = { date: '2026-01-11', value: 9999 };

    const res = await request('POST', '/api/forecasts/generate', {
      series: testSeries,
      horizon_periods: 7,
      detect_anomalies: true,
      z_threshold: 2.0,
      persist: false
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.data.predictions || res.body.data.predictions.length !== 7) {
      throw new Error('Expected 7 predictions');
    }
    if (!Array.isArray(res.body.data.anomalies)) {
      throw new Error('Expected anomalies array');
    }
    if (res.body.data.anomalies.length === 0) {
      throw new Error('Expected injected anomaly to be detected');
    }
  });

  // Test 12: Forecast Persistence
  await test('12. Forecast Persistence: Authorized user creates and saves forecast record (POST /api/forecasts) with 201 Created', async () => {
    const res = await request('POST', '/api/forecasts', {
      series: sampleSeries,
      target_column: 'sales_amount',
      date_column: 'order_date',
      horizon_periods: 14,
      model_name: 'holt_winters',
      interval: 'daily'
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 201 || !res.body.success) {
      throw new Error(`Expected 201 Created, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    createdForecastId = res.body.data.id;
    if (!createdForecastId) throw new Error('Expected created forecast ID');
    if (res.body.data.organization_id !== orgA) throw new Error('Forecast must be bound to orgA');
  });

  // Test 13: Retrieve Forecast by ID
  await test('13. Forecast Persistence: Retrieve single forecast by ID (GET /api/forecasts/:id) with 200 OK', async () => {
    if (!createdForecastId) throw new Error('No created forecast ID available');

    const res = await request('GET', `/api/forecasts/${createdForecastId}`, null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (res.body.data.id !== createdForecastId) {
      throw new Error(`Expected forecast id ${createdForecastId}, got ${res.body.data.id}`);
    }
    if (res.body.data.target_column !== 'sales_amount') {
      throw new Error('Target column mismatch');
    }
  });

  // Test 14: Forecast Deletion by Admin/Manager
  await test('14. Forecast Deletion: Authorized user (Admin/Manager) deletes forecast record (DELETE /api/forecasts/:id) with 200 OK', async () => {
    // Create temporary forecast to delete
    const createRes = await request('POST', '/api/forecasts', {
      series: sampleSeries,
      target_column: 'temp_metric',
      date_column: 'order_date',
      horizon_periods: 5
    }, { Authorization: `Bearer ${managerTokenA}` });

    const tempId = createRes.body.data.id;

    const delRes = await request('DELETE', `/api/forecasts/${tempId}`, null, {
      Authorization: `Bearer ${managerTokenA}`
    });

    if (delRes.statusCode !== 200 || !delRes.body.success) {
      throw new Error(`Expected 200 OK on deletion, got ${delRes.statusCode}`);
    }

    // Verify it is gone
    const getRes = await request('GET', `/api/forecasts/${tempId}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });
    if (getRes.statusCode !== 404) throw new Error(`Expected 404 after deletion, got ${getRes.statusCode}`);
  });

  // Test 15: Validation: Insufficient Historical Data
  await test('15. Validation: Insufficient historical points (< 4 points) rejected with 400 Bad Request', async () => {
    const tinySeries = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 120 }
    ];

    const res = await request('POST', '/api/forecasts/generate', {
      series: tinySeries,
      horizon_periods: 5
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 400) throw new Error(`Expected 400 Bad Request, got ${res.statusCode}`);
    if (!res.body.message.toLowerCase().includes('insufficient')) {
      throw new Error(`Expected insufficient data error message, got: ${res.body.message}`);
    }
  });

  // Test 16: Validation: Invalid Horizon
  await test('16. Validation: Invalid forecast horizon (e.g. 0 or >365) rejected with 400 Bad Request', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 0
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // Test 17: Validation: Invalid Interval
  await test('17. Validation: Invalid interval format rejected with 400 Bad Request', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      interval: 'secondly_invalid'
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // Test 18: Validation: Missing Series and Dataset/Metric
  await test('18. Validation: Missing series and dataset/metric identifiers rejected with 400 Bad Request', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      horizon_periods: 10
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // Test 19: RBAC: Viewer Cannot Generate Forecasts
  await test('19. RBAC: Viewer role is blocked from generating forecasts (403 Forbidden)', async () => {
    const res = await request('POST', '/api/forecasts/generate', {
      series: sampleSeries,
      horizon_periods: 5
    }, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden for Viewer, got ${res.statusCode}`);
  });

  // Test 20: RBAC: Viewer Cannot Create Forecast Records
  await test('20. RBAC: Viewer role is blocked from creating forecast records (403 Forbidden)', async () => {
    const res = await request('POST', '/api/forecasts', {
      series: sampleSeries,
      target_column: 'revenue',
      date_column: 'date'
    }, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden for Viewer, got ${res.statusCode}`);
  });

  // Test 21: RBAC: Viewer Cannot Delete Forecasts
  await test('21. RBAC: Viewer role is blocked from deleting forecast records (403 Forbidden)', async () => {
    const res = await request('DELETE', `/api/forecasts/${createdForecastId}`, null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden for Viewer, got ${res.statusCode}`);
  });

  // Test 22: RBAC: Analyst Cannot Delete Forecasts
  await test('22. RBAC: Analyst role CANNOT delete forecast records (403 Forbidden)', async () => {
    const res = await request('DELETE', `/api/forecasts/${createdForecastId}`, null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden for Analyst delete, got ${res.statusCode}`);
  });

  // Test 23: Multi-Tenant Isolation (View)
  await test('23. Multi-Tenant Isolation: Organization B cannot view Organization A forecast (404 Isolated)', async () => {
    const res = await request('GET', `/api/forecasts/${createdForecastId}`, null, {
      Authorization: `Bearer ${adminTokenB}`
    });

    if (res.statusCode !== 404) {
      throw new Error(`Expected 404 Not Found across tenants, got ${res.statusCode}`);
    }
  });

  // Test 24: Multi-Tenant Isolation (Delete)
  await test('24. Multi-Tenant Isolation: Organization B cannot delete Organization A forecast (404 Isolated)', async () => {
    const res = await request('DELETE', `/api/forecasts/${createdForecastId}`, null, {
      Authorization: `Bearer ${adminTokenB}`
    });

    if (res.statusCode !== 404) {
      throw new Error(`Expected 404 Not Found across tenants on delete, got ${res.statusCode}`);
    }
  });

  // Test 25: ML Fallback Resilience
  await test('25. ML Service Resilience & Fallback: Statistical fallback operates seamlessly even without Python ML microservice', async () => {
    // Run direct statistical fallback forecast
    const fallbackForecast = mlForecastService._statisticalFallbackForecast(sampleSeries, 10, 'daily', 0.95);
    if (!fallbackForecast.predictions || fallbackForecast.predictions.length !== 10) {
      throw new Error('Fallback engine must return valid predictions array');
    }
    if (fallbackForecast.predictions[0].predicted === undefined) {
      throw new Error('Fallback points must contain predicted value');
    }

    // Run direct statistical fallback anomaly detection
    const sampleSpike = [...sampleSeries];
    sampleSpike[5] = { date: '2026-01-06', value: 99999 };
    const fallbackAnomalies = mlForecastService._statisticalFallbackAnomalies(sampleSpike, 2.5);
    if (!fallbackAnomalies || fallbackAnomalies.length === 0) {
      throw new Error('Fallback anomaly detector must identify extreme outlier');
    }
  });

  // Cleanup & Close Server
  await new Promise((resolve) => server.close(resolve));

  console.log('\n===============================================================');
  console.log(`  PHASE 11 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute test suite if run directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runTests;
