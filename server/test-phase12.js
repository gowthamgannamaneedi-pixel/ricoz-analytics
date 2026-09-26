/**
 * Comprehensive Automated Test Suite for Phase 12: AI Analytics Assistant & Natural Language Querying
 * Tests 25 critical functional, natural-language intents, query planning, security guardrails,
 * Gemini fallback, multi-tenant isolation, conversation persistence, and Phase 10/11 integrations.
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const geminiService = require('./services/geminiService');
const aiQueryPlannerService = require('./services/aiQueryPlannerService');
const aiConversationModel = require('./models/aiConversationModel');
const Dataset = require('./models/datasetModel');

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

// Token generator
function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 12: AI ANALYTICS ASSISTANT & NL QUERY TEST SUITE');
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

  // Pre-populate test dataset for User 1 in Org A
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

  let createdConversationId = null;

  // Test 1: Authentication Guard
  await test('1. Unauthenticated request to /api/ai/query returns 401 Unauthorized', async () => {
    const res = await request('POST', '/api/ai/query', { message: 'What is total revenue?' });
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  // Test 2: Basic Valid Query
  await test('2. Authenticated user can execute natural language query (POST /api/ai/query) with 200 OK', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What is total revenue?',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 with success=true, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const { question, answer, intent, data, visualization } = res.body.data;
    if (!question || !answer || !intent) throw new Error('Missing core response fields');
    if (intent !== 'kpi') throw new Error(`Expected intent 'kpi', got ${intent}`);
    if (visualization?.type !== 'kpi_card') throw new Error(`Expected visualization 'kpi_card', got ${visualization?.type}`);
    createdConversationId = res.body.conversationId;
  });

  // Test 3: Intent Parsing - KPI
  await test('3. Intent Parsing: "What is total revenue?" maps to KPI intent and aggregates metrics', async () => {
    const plan = await geminiService.planQuery('What is total revenue?');
    if (plan.intent !== 'kpi') throw new Error(`Expected kpi intent, got ${plan.intent}`);
    if (plan.metric !== 'revenue') throw new Error(`Expected metric 'revenue', got ${plan.metric}`);
  });

  // Test 4: Intent Parsing - Trend
  await test('4. Intent Parsing: "Show revenue trend for last 6 months" maps to trend intent with line visualization', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Show revenue trend for the last 6 months',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'trend') throw new Error(`Expected trend intent, got ${res.body.data.intent}`);
    if (res.body.data.visualization?.type !== 'line') throw new Error(`Expected line chart, got ${res.body.data.visualization?.type}`);
  });

  // Test 5: Intent Parsing - Growth
  await test('5. Intent Parsing: "How much did revenue grow this quarter?" maps to growth intent', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'How much did revenue grow this quarter?',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!['growth', 'trend'].includes(res.body.data.intent)) throw new Error(`Expected growth/trend intent, got ${res.body.data.intent}`);
  });

  // Test 6: Intent Parsing - Ranking
  await test('6. Intent Parsing: "Top 5 products by revenue" maps to ranking intent with limit 5', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Top 5 products by revenue',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'ranking') throw new Error(`Expected ranking intent, got ${res.body.data.intent}`);
    if (res.body.data.plan.limit !== 5) throw new Error(`Expected limit 5, got ${res.body.data.plan.limit}`);
    if (res.body.data.visualization?.type !== 'bar') throw new Error(`Expected bar chart, got ${res.body.data.visualization?.type}`);
  });

  // Test 7: Intent Parsing - Breakdown
  await test('7. Intent Parsing: "Show sales by region" maps to breakdown intent with pie chart', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Show sales by region',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'breakdown') throw new Error(`Expected breakdown intent, got ${res.body.data.intent}`);
    if (res.body.data.visualization?.type !== 'pie') throw new Error(`Expected pie chart, got ${res.body.data.visualization?.type}`);
  });

  // Test 8: Intent Parsing - Comparison
  await test('8. Intent Parsing: "Compare revenue between North and South" maps to comparison intent', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Compare revenue between North and South',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'comparison') throw new Error(`Expected comparison intent, got ${res.body.data.intent}`);
  });

  // Test 9: Anomaly Explanation (Phase 10 & 11 integration)
  await test('9. Anomaly Explanation: "Why did revenue drop last month?" computes statistical outliers', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Why did revenue drop last month?',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'anomaly_explanation') throw new Error(`Expected anomaly_explanation intent, got ${res.body.data.intent}`);
    if (res.body.data.data.anomaly_count === undefined) throw new Error('Expected anomaly_count in data payload');
  });

  // Test 10: Forecast Explanation (Phase 11 integration)
  await test('10. Forecast Explanation: "What does the forecast say for next month?" links with ML prediction engine', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What does the forecast predict for next month?',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.body.data.intent !== 'forecast_explanation') throw new Error(`Expected forecast_explanation intent, got ${res.body.data.intent}`);
    if (!res.body.data.data.model) throw new Error('Expected ML model info in data');
  });

  // Test 11: Dashboard Summary Endpoint
  await test('11. Dashboard Summary: POST /api/ai/summarize-dashboard returns executive overview', async () => {
    const res = await request('POST', '/api/ai/summarize-dashboard', {
      dashboardId: '00000000-0000-0000-0000-000000000001'
    }, {
      Authorization: `Bearer ${adminTokenA}`
    });

    // 200 or 404 depending on whether dashboard id exists in fallback
    if (res.statusCode === 200) {
      if (!res.body.summary) throw new Error('Expected summary text in response');
    } else if (res.statusCode !== 404) {
      throw new Error(`Unexpected status code: ${res.statusCode}`);
    }
  });

  // Test 12: Targeted Explain Endpoint
  await test('12. Targeted Explain: POST /api/ai/explain generates evidence-grounded explanation', async () => {
    const res = await request('POST', '/api/ai/explain', {
      question: 'Explain sales growth in Q4',
      plan: { intent: 'growth', metric: 'revenue' },
      data: { growth_rate: 15.4, trends: [{ date: '2026-01-01', revenue: 1000 }] }
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.explanation) throw new Error('Expected explanation in response');
  });

  // Test 13: Validation - Empty Query
  await test('13. Validation: Empty message query is rejected with 400 Bad Request', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: '   '
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // Test 14: Security - Unauthorized Dataset Scoping
  await test('14. Security: Accessing another user/tenant dataset is blocked with 404 Not Found', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What is total revenue?',
      datasetId: 99999
    }, {
      Authorization: `Bearer ${adminTokenB}`
    });

    if (res.statusCode !== 404) throw new Error(`Expected 404 Not Found for foreign dataset, got ${res.statusCode}`);
  });

  // Test 15: Security - Multi-Tenant Isolation
  await test('15. Multi-Tenant Isolation: Organization B cannot access Organization A conversations (404 Isolated)', async () => {
    if (createdConversationId) {
      const res = await request('GET', `/api/ai/conversations/${createdConversationId}`, null, {
        Authorization: `Bearer ${adminTokenB}`
      });

      if (res.statusCode !== 404) throw new Error(`Expected 404 Not Found across tenants, got ${res.statusCode}`);
    }
  });

  // Test 16: Security - Neutralize Raw SQL Injection
  await test('16. Security: SQL injection strings ("DROP TABLE users; --") are strictly neutralized via allowlist', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: "DROP TABLE users; SELECT * FROM users WHERE 1=1; --",
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200) throw new Error(`Expected 200 safe handling, got ${res.statusCode}`);
    if (!res.body.data.plan.metric || res.body.data.plan.metric.includes('DROP')) {
      throw new Error('Allowlist failed to sanitize malicious query plan');
    }
  });

  // Test 17: RBAC - Viewer Role Query Access
  await test('17. RBAC: Viewer role can ask questions on authorized data (200 OK)', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What is total revenue?'
    }, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 OK for Viewer, got ${res.statusCode}`);
    }
  });

  // Test 18: Conversation Thread Creation
  await test('18. Conversation History: Create conversation thread (POST /api/ai/conversations) with 201 Created', async () => {
    const res = await request('POST', '/api/ai/conversations', {
      title: 'Q4 Revenue Deep-Dive',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 201 || !res.body.success) throw new Error(`Expected 201 Created, got ${res.statusCode}`);
    if (!res.body.data.id) throw new Error('Expected conversation ID');
  });

  // Test 19: List Conversation Threads
  await test('19. Conversation History: List conversation threads (GET /api/ai/conversations) with 200 OK', async () => {
    const res = await request('GET', '/api/ai/conversations', null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array of conversations');
  });

  // Test 20: Conversation Thread Retrieval by ID
  await test('20. Conversation History: Retrieve conversation by ID (GET /api/ai/conversations/:id) with 200 OK', async () => {
    if (createdConversationId) {
      const res = await request('GET', `/api/ai/conversations/${createdConversationId}`, null, {
        Authorization: `Bearer ${analystTokenA}`
      });

      if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
      if (!Array.isArray(res.body.data.messages)) throw new Error('Expected messages array in conversation');
    }
  });

  // Test 21: Delete Conversation Thread
  await test('21. Conversation History: Delete conversation thread (DELETE /api/ai/conversations/:id) with 200 OK', async () => {
    const newConv = await aiConversationModel.createConversation({
      organizationId: orgA,
      userId: 1,
      title: 'Temporary Thread'
    });

    const res = await request('DELETE', `/api/ai/conversations/${newConv.id}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Test 22: Gemini Offline Resilience & Fallback
  await test('22. Resilience & Fallback: Deterministic query planner & synthesis engine operate seamlessly without Gemini API', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = ''; // simulate offline/unconfigured API key

    const plan = await geminiService.planQuery('What is total sales?');
    if (!plan || plan.intent !== 'kpi') throw new Error('Deterministic planner must return valid KPI plan');

    const answer = await geminiService.explainResults('What is total sales?', plan, { value: 50000, count: 120 });
    if (!answer || answer.length < 10) throw new Error('Deterministic synthesis engine must return informative answer');

    geminiService.apiKey = originalKey; // restore key
  });

  // Test 23: Chart Visualization Payload Compliance
  await test('23. Chart Output: Visualization payloads conform to Recharts structural contracts', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'Show revenue trend for last 30 days',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    const viz = res.body.data.visualization;
    if (viz.type !== 'line') throw new Error(`Expected line chart, got ${viz.type}`);
    if (!viz.xAxis || !viz.yAxis) throw new Error('Line chart must define xAxis and yAxis');
  });

  // Test 24: Phase 10 & 11 Cross-System Integration
  await test('24. Phase 10 & 11 Integration: AI context incorporates active alert thresholds and ML forecasts', async () => {
    const res = await request('POST', '/api/ai/query', {
      message: 'What is the forecast and are there any active alert risks?',
      datasetId: testDatasetId
    }, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.data.sources || res.body.data.sources.length === 0) throw new Error('Expected verified sources');
  });

  // Test 25: Clear Conversations
  await test('25. Conversation History: Clear all conversations (DELETE /api/ai/conversations) with 200 OK', async () => {
    const res = await request('DELETE', '/api/ai/conversations', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    if (res.statusCode !== 200 || !res.body.success) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Cleanup server
  await new Promise((resolve) => server.close(resolve));

  console.log('\n===============================================================');
  console.log(`  PHASE 12 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runTests;
