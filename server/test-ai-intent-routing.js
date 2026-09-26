/**
 * Comprehensive Intent Routing & Non-Analytics Verification Suite
 * Verifies that casual conversational inputs and non-analytics inputs are never
 * coerced into arbitrary KPI queries, datasets are not queried for greetings,
 * and all analytics intents continue to function properly.
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const geminiService = require('./services/geminiService');
const Dataset = require('./models/datasetModel');

let server;
let port;
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
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  AI INTENT ROUTING & CONVERSATIONAL GUARDRAIL TEST SUITE');
  console.log('===============================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const orgA = '00000000-0000-0000-0000-000000000001';
  const token = generateToken(1, 'admin@ricoz.test', 'admin', orgA);

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

  // Create test dataset in Org A
  let testDatasetId = 1;
  try {
    const ds = await Dataset.create({
      userId: 1,
      name: 'Enterprise Indian Telemetry Q4',
      description: 'Q4 regional transaction telemetry',
      filePath: '',
      rowCount: 1000,
      columnCount: 6,
      schema: [
        { name: 'date', type: 'date' },
        { name: 'revenue', type: 'number' },
        { name: 'orders', type: 'number' },
        { name: 'region', type: 'string' },
        { name: 'product', type: 'string' },
        { name: 'channel', type: 'string' }
      ]
    });
    if (ds && ds.id) testDatasetId = ds.id;
  } catch (_) {}

  // --------------------------------------------------------------------------
  // STEP 13 & 14: The 20 Required Intent Tests
  // --------------------------------------------------------------------------

  // 1. hello → GREETING (Step 14: Most Important Test)
  await test('1. Input: "hello" → GREETING (No KPI, no dataset query, natural greeting)', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'hello',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const { intent, answer, plan, data, visualization, sources } = res.body.data;
    if (intent !== 'GREETING') throw new Error(`Expected intent 'GREETING', got '${intent}'`);
    if (plan.metric !== null) throw new Error(`Expected plan.metric to be null, got '${plan.metric}'`);
    if (visualization !== null) throw new Error(`Expected visualization to be null, got '${visualization}'`);
    if (sources && sources.length > 0) throw new Error(`Expected 0 sources, got ${sources.length}`);
    if (answer.toLowerCase().includes('55.00') || answer.toLowerCase().includes('customer id') || answer.toLowerCase().includes('customer_id')) {
      throw new Error(`CRITICAL: Response still contains KPI customer_id calculation: "${answer}"`);
    }
    if (answer !== 'Hello! How can I help you analyze your data?') {
      throw new Error(`Expected natural greeting, got: "${answer}"`);
    }
  });

  // 2. hi → GREETING
  await test('2. Input: "hi" → GREETING', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'hi',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'GREETING') throw new Error(`Expected GREETING, got ${res.body.data.intent}`);
    if (!res.body.data.answer.startsWith('Hi! I can help with KPIs')) {
      throw new Error(`Expected Hi greeting, got: "${res.body.data.answer}"`);
    }
  });

  // 3. hey → GREETING
  await test('3. Input: "hey" → GREETING', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'hey',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'GREETING') throw new Error(`Expected GREETING, got ${res.body.data.intent}`);
  });

  // 4. good morning → GREETING
  await test('4. Input: "good morning" → GREETING', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'good morning',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'GREETING') throw new Error(`Expected GREETING, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes('Good morning!')) throw new Error(`Expected good morning response, got: "${res.body.data.answer}"`);
  });

  // 5. thank you → THANKS
  await test('5. Input: "thank you" → THANKS', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'thank you',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'THANKS') throw new Error(`Expected THANKS, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes("welcome")) throw new Error(`Expected thanks response, got: "${res.body.data.answer}"`);
  });

  // 6. goodbye → FAREWELL
  await test('6. Input: "goodbye" → FAREWELL', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'goodbye',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'FAREWELL') throw new Error(`Expected FAREWELL, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes('Goodbye')) throw new Error(`Expected farewell response, got: "${res.body.data.answer}"`);
  });

  // 7. help → HELP
  await test('7. Input: "help" → HELP', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'help',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'HELP') throw new Error(`Expected HELP, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes('KPI Analysis') || !res.body.data.answer.includes('Trend Exploration')) {
      throw new Error(`Expected capability list in help response, got: "${res.body.data.answer}"`);
    }
  });

  // 8. what can you do → CAPABILITIES
  await test('8. Input: "what can you do" → CAPABILITIES', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'what can you do',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'CAPABILITIES') throw new Error(`Expected CAPABILITIES, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes('KPI Analysis') || !res.body.data.answer.includes('Anomaly Diagnostics')) {
      throw new Error(`Expected accurate capability list, got: "${res.body.data.answer}"`);
    }
  });

  // 9. random non-analytics question → NON_ANALYTICS
  await test('9. Input: "what is the weather?" → NON_ANALYTICS', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'what is the weather?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'NON_ANALYTICS') throw new Error(`Expected NON_ANALYTICS, got ${res.body.data.intent}`);
    if (!res.body.data.answer.includes('focused on RicozAnalytics data')) {
      throw new Error(`Expected non-analytics guidance, got: "${res.body.data.answer}"`);
    }
    if (res.body.data.sources && res.body.data.sources.length > 0) {
      throw new Error('Sources should be empty for non-analytics input');
    }
  });

  // 10. unknown input → NON_ANALYTICS (Never default to KPI)
  await test('10. Input: "xyz arbitrary nonsensical input" → NON_ANALYTICS (Never defaults to KPI)', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'xyz arbitrary nonsensical input',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    if (res.body.data.intent !== 'NON_ANALYTICS') throw new Error(`Expected NON_ANALYTICS, got ${res.body.data.intent}`);
    if (res.body.data.visualization !== null) throw new Error('Visualization must be null for non-analytics');
  });

  // 11. total revenue → KPI / KPI_LOOKUP
  await test('11. Input: "What is total revenue?" → KPI_LOOKUP (kpi)', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What is total revenue?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['kpi', 'KPI', 'KPI_LOOKUP'].includes(intent)) throw new Error(`Expected kpi intent, got ${intent}`);
    if (res.body.data.plan.metric !== 'revenue') throw new Error(`Expected metric 'revenue', got ${res.body.data.plan.metric}`);
  });

  // 12. revenue trend → TREND
  await test('12. Input: "Show revenue trend" → TREND', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Show revenue trend',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['trend', 'TREND'].includes(intent)) throw new Error(`Expected trend intent, got ${intent}`);
    if (res.body.data.visualization?.type !== 'line') throw new Error(`Expected line visualization, got ${res.body.data.visualization?.type}`);
  });

  // 13. revenue by region → BREAKDOWN
  await test('13. Input: "Show revenue by region" → BREAKDOWN', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Show revenue by region',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['breakdown', 'BREAKDOWN'].includes(intent)) throw new Error(`Expected breakdown intent, got ${intent}`);
  });

  // 14. highest revenue product → RANKING
  await test('14. Input: "Which product performed best?" → RANKING', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Which product performed best?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['ranking', 'RANKING'].includes(intent)) throw new Error(`Expected ranking intent, got ${intent}`);
  });

  // 15. compare regions → COMPARISON
  await test('15. Input: "Compare revenue between regions" → COMPARISON', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Compare revenue between regions',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['comparison', 'COMPARISON'].includes(intent)) throw new Error(`Expected comparison intent, got ${intent}`);
  });

  // 16. revenue growth → GROWTH
  await test('16. Input: "How has revenue grown?" → GROWTH', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'How has revenue grown?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['growth', 'GROWTH', 'trend'].includes(intent)) throw new Error(`Expected growth intent, got ${intent}`);
  });

  // 17. anomalies → ANOMALY_DIAGNOSTICS
  await test('17. Input: "What anomalies occurred?" → ANOMALY_DIAGNOSTICS', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What anomalies occurred?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['anomaly_explanation', 'ANOMALY_DIAGNOSTICS', 'ANOMALY_EXPLANATION'].includes(intent)) {
      throw new Error(`Expected anomaly intent, got ${intent}`);
    }
  });

  // 18. forecast revenue → FORECAST_EXPLANATION
  await test('18. Input: "What will revenue look like next month?" → FORECAST_EXPLANATION', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What will revenue look like next month?',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['forecast_explanation', 'FORECAST_EXPLANATION'].includes(intent)) {
      throw new Error(`Expected forecast intent, got ${intent}`);
    }
  });

  // 19. dashboard summary → DASHBOARD_SUMMARY
  await test('19. Input: "Summarize this dashboard" → DASHBOARD_SUMMARY', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Summarize this dashboard',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['dashboard_summary', 'DASHBOARD_SUMMARY'].includes(intent)) {
      throw new Error(`Expected dashboard_summary intent, got ${intent}`);
    }
  });

  // 20. metric explanation → METRIC_EXPLANATION
  await test('20. Input: "Explain this metric" → METRIC_EXPLANATION', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Explain this metric',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const intent = res.body.data.intent;
    if (!['metric_explanation', 'METRIC_EXPLANATION'].includes(intent)) {
      throw new Error(`Expected metric_explanation intent, got ${intent}`);
    }
  });

  // --------------------------------------------------------------------------
  // STEP 15: Casual inputs batch test - NONE of these should produce analytics
  // --------------------------------------------------------------------------
  await test('21. Batch Casual Inputs (hello, hi, hey, good morning, thanks, thank you, bye, what can you do?, help) produce NO KPI / dataset results', async () => {
    const casualInputs = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'thanks',
      'thank you',
      'bye',
      'what can you do?',
      'help'
    ];

    for (const msg of casualInputs) {
      const res = await request('POST', '/api/ai/query', {
        message: msg,
        datasetId: testDatasetId
      }, { Authorization: `Bearer ${token}` });

      const d = res.body.data;
      const forbidden = ['kpi', 'trend', 'ranking', 'forecast', 'breakdown', 'comparison'];
      if (forbidden.includes(d.intent)) {
        throw new Error(`Casual message "${msg}" improperly resolved to analytics intent '${d.intent}'!`);
      }
      if (d.plan.metric !== null) {
        throw new Error(`Casual message "${msg}" populated plan.metric: '${d.plan.metric}'!`);
      }
      if (d.sources && d.sources.length > 0) {
        throw new Error(`Casual message "${msg}" queried dataset sources: ${JSON.stringify(d.sources)}!`);
      }
      if (d.answer.includes('55.00') || d.answer.toLowerCase().includes('customer id') || d.answer.toLowerCase().includes('customer_id')) {
        throw new Error(`Casual message "${msg}" returned customer_id = 55.00!`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // STEP 17: Verify exact previous bug is eliminated
  // --------------------------------------------------------------------------
  await test('22. Verify previous erroneous output ("Based on customers, total customer id is 55.00 across 10 recorded entries.") is gone', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'hello',
      datasetId: testDatasetId
    }, { Authorization: `Bearer ${token}` });

    const answer = res.body.data.answer;
    if (answer.includes('customer id is 55.00') || answer.includes('total customer id')) {
      throw new Error(`Regression: wrong answer returned: ${answer}`);
    }
  });

  console.log('\n---------------------------------------------------------------');
  console.log(`Test Execution Complete. Passed: ${passed}, Failed: ${failed}`);
  console.log('---------------------------------------------------------------\n');

  server.close();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test execution error:', err);
  if (server) server.close();
  process.exit(1);
});
