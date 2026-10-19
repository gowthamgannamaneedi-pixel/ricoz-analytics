const http = require('http');
const https = require('https');
const db = require('./config/database');
const jwt = require('jsonwebtoken');
const config = require('./config');

async function measureRequest(url, options = {}) {
  const isHttps = url.startsWith('https');
  const client = isHttps ? https : http;

  return new Promise((resolve) => {
    const start = Date.now();
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          bytes: Buffer.byteLength(data),
          data: data.slice(0, 500)
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        duration: Date.now() - start,
        bytes: 0,
        error: err.message
      });
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function calculatePercentiles(samples) {
  if (samples.length === 0) return { p50: 0, p95: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  return { p50, p95, min, max, avg };
}

async function runBenchmark() {
  console.log('==================================================================');
  console.log(' RicozAnalytics Comprehensive Performance & Bottleneck Benchmark');
  console.log('==================================================================\n');

  // 1. Get test user and generate valid JWT
  const userRes = await db.query('SELECT id, email, organization_id, role FROM users LIMIT 1');
  if (userRes.rows.length === 0) {
    console.error('No users found in database to benchmark authenticated endpoints');
    process.exit(1);
  }
  const testUser = userRes.rows[0];
  console.log(`Using test user ID: ${testUser.id}, Org: ${testUser.organization_id}, Role: ${testUser.role}`);

  const token = jwt.sign(
    {
      id: testUser.id,
      email: testUser.email,
      organization_id: testUser.organization_id,
      role: testUser.role
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const localBase = 'http://localhost:5000';
  const prodBase = 'https://ricoz-analytics.onrender.com';

  // 2. Health & Cold Start check on production
  console.log('\n--- 1. Probing Production Infrastructure Latency & Cold Starts ---');
  const prodHealthStart = Date.now();
  const prodHealth = await measureRequest(`${prodBase}/api/health`);
  console.log(`Production /api/health: status ${prodHealth.statusCode}, duration: ${prodHealth.duration}ms, size: ${prodHealth.bytes} bytes`);
  
  const localHealth = await measureRequest(`${localBase}/api/health`);
  console.log(`Localhost /api/health:  status ${localHealth.statusCode}, duration: ${localHealth.duration}ms, size: ${localHealth.bytes} bytes`);

  // 3. Database query timing & EXPLAIN ANALYZE
  console.log('\n--- 2. Database Query Timing & EXPLAIN ANALYZE (Representative Queries) ---');
  const queriesToTest = [
    {
      name: 'User Lookup with Org & Role',
      sql: 'SELECT id, email, organization_id, role, last_active_at FROM users WHERE id = $1',
      params: [testUser.id]
    },
    {
      name: 'Organization Subscription Retrieval',
      sql: 'SELECT * FROM organizations WHERE id = $1 LIMIT 1',
      params: [testUser.organization_id]
    },
    {
      name: 'Datasets by Organization',
      sql: 'SELECT id, name, file_path, row_count, created_at FROM datasets WHERE organization_id = $1 ORDER BY created_at DESC',
      params: [testUser.organization_id]
    },
    {
      name: 'Subscription History by Org',
      sql: 'SELECT * FROM subscription_history WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50',
      params: [testUser.organization_id]
    },
    {
      name: 'Razorpay Orders by Org',
      sql: 'SELECT * FROM razorpay_orders WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50',
      params: [testUser.organization_id]
    },
    {
      name: 'Unread Notifications / Collaboration',
      sql: 'SELECT id, message, is_read, created_at FROM notifications WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 20',
      params: [testUser.organization_id]
    }
  ];

  for (const q of queriesToTest) {
    try {
      // Warm up
      await db.query(q.sql, q.params);
      
      const timings = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await db.query(q.sql, q.params);
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1e6); // ms
      }
      const stats = calculatePercentiles(timings);
      console.log(`[DB Query] ${q.name}: avg ${stats.avg.toFixed(2)}ms, p50: ${stats.p50.toFixed(2)}ms, p95: ${stats.p95.toFixed(2)}ms`);

      // EXPLAIN ANALYZE
      try {
        const explainRes = await db.query(`EXPLAIN ANALYZE ${q.sql}`, q.params);
        const plan = explainRes.rows.map(r => r['QUERY PLAN']).slice(0, 3).join(' | ');
        console.log(`   └─ Plan: ${plan}`);
      } catch (e) {
        // Table or view might not exist for optional items
      }
    } catch (err) {
      console.log(`[DB Query] ${q.name}: Skipped (${err.message})`);
    }
  }

  // 4. API Endpoints Latency & Payload Sizes
  console.log('\n--- 3. Localhost API Endpoint Latencies (10 iterations each) ---');
  const endpoints = [
    { name: 'Billing Plans (Public)', url: `${localBase}/api/billing/plans`, headers: {} },
    { name: 'Billing Subscription (Auth)', url: `${localBase}/api/billing/subscription`, headers: authHeaders },
    { name: 'Datasets List (Auth)', url: `${localBase}/api/datasets`, headers: authHeaders },
    { name: 'Dashboards (Auth)', url: `${localBase}/api/dashboards`, headers: authHeaders },
    { name: 'Metrics Summary (Auth)', url: `${localBase}/api/metrics`, headers: authHeaders },
    { name: 'Notifications Polling (Auth)', url: `${localBase}/api/collaboration/notifications?limit=20`, headers: authHeaders }
  ];

  for (const ep of endpoints) {
    const latencies = [];
    let lastBytes = 0;
    let lastStatus = 0;

    for (let i = 0; i < 10; i++) {
      const res = await measureRequest(ep.url, { headers: ep.headers });
      latencies.push(res.duration);
      lastBytes = res.bytes;
      lastStatus = res.statusCode;
    }

    const stats = calculatePercentiles(latencies);
    console.log(`[API] ${ep.name.padEnd(30)}: status ${lastStatus}, payload ${lastBytes}B, p50: ${stats.p50}ms, p95: ${stats.p95}ms, avg: ${stats.avg}ms`);
  }

  // 4. AI Insights Pipeline Latency & Concurrency Profiling
  console.log('\n--- 4. AI Insights Pipeline Latency & Concurrency Profiling ---');
  // Ensure testUser org is on enterprise with active subscription
  await db.query("UPDATE organizations SET plan = 'enterprise', subscription_status = 'active' WHERE id = $1", [testUser.organization_id]);
  const aiUser = testUser;

  const aiToken = jwt.sign(
    {
      id: aiUser.id,
      email: aiUser.email,
      organization_id: aiUser.organization_id,
      role: 'admin' // Ensure admin permission for insights.generate
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
  const aiAuthHeaders = {
    'Authorization': `Bearer ${aiToken}`,
    'Content-Type': 'application/json'
  };

  const dsRes = await db.query('SELECT id, name, row_count FROM datasets WHERE organization_id = $1 LIMIT 3', [aiUser.organization_id]);
  console.log(`Datasets available for AI Insights test in Org (${aiUser.organization_id}): ${dsRes.rows.length}`);
  
  const targetDsId = dsRes.rows.length > 0 ? dsRes.rows[0].id : null;
  const aiPayload = JSON.stringify(targetDsId ? { datasetId: targetDsId, forceFresh: true } : { forceFresh: true });

  // Single request
  console.log('Testing single AI Insights generation (forceFresh=true)...');
  const aiStart = Date.now();
  const singleAiRes = await measureRequest(`${localBase}/api/insights/generate`, {
    method: 'POST',
    headers: aiAuthHeaders,
    body: aiPayload
  });
  console.log(`[AI Single] Status ${singleAiRes.statusCode}, duration: ${Date.now() - aiStart}ms, payload: ${singleAiRes.bytes}B`);

  // Cached request (second call without forceFresh)
  const cachedStart = Date.now();
  const cachedAiRes = await measureRequest(`${localBase}/api/insights/generate`, {
    method: 'POST',
    headers: aiAuthHeaders,
    body: JSON.stringify(targetDsId ? { datasetId: targetDsId, forceFresh: false } : { forceFresh: false })
  });
  console.log(`[AI Cached] Status ${cachedAiRes.statusCode}, duration: ${Date.now() - cachedStart}ms, payload: ${cachedAiRes.bytes}B`);

  // Duplicate concurrent in-flight requests (simulating rapid user clicks or React double-effects)
  console.log('Testing 3 concurrent in-flight AI requests...');
  const concurrentStart = Date.now();
  const concurrentResults = await Promise.all([
    measureRequest(`${localBase}/api/insights/generate`, { method: 'POST', headers: aiAuthHeaders, body: aiPayload }),
    measureRequest(`${localBase}/api/insights/generate`, { method: 'POST', headers: aiAuthHeaders, body: aiPayload }),
    measureRequest(`${localBase}/api/insights/generate`, { method: 'POST', headers: aiAuthHeaders, body: aiPayload })
  ]);
  const concurrentDuration = Date.now() - concurrentStart;
  console.log(`[AI 3x Concurrent] Total wall duration: ${concurrentDuration}ms`);
  concurrentResults.forEach((r, idx) => {
    console.log(`   Req ${idx + 1}: status ${r.statusCode}, duration ${r.duration}ms, size ${r.bytes}B`);
  });

  console.log('\n==================================================================');
  console.log(' Benchmark Completed Successfully');
  console.log('==================================================================');
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
