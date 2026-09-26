/**
 * Local Controlled Performance & Stress Benchmark for RicozAnalytics
 * Measures throughput, success rate, and latency distributions across core endpoints.
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, `http://127.0.0.1:${port}`);
    const start = Date.now();
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
        const duration = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          duration,
          body: parsed
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        duration: Date.now() - start,
        error: err.message
      });
    });

    if (reqBody) req.write(reqBody);
    req.end();
  });
}

let server;
let port;

async function runBenchmark() {
  console.log('\n===============================================================');
  console.log('  RICOZANALYTICS: PRODUCTION PERFORMANCE & LOAD BENCHMARK  ');
  console.log('===============================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  const orgId = '00000000-0000-0000-0000-000000000001';
  const token = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const scenarios = [
    { name: 'Health & Liveness (GET /api/health)', method: 'GET', path: '/api/health', body: null, headers: {} },
    { name: 'Readiness Probe (GET /api/ready)', method: 'GET', path: '/api/ready', body: null, headers: {} },
    { name: 'Dashboards List (GET /api/dashboards)', method: 'GET', path: '/api/dashboards', body: null, headers: authHeaders },
    { name: 'Reports List (GET /api/reports)', method: 'GET', path: '/api/reports', body: null, headers: authHeaders },
    { name: 'AI Insights (GET /api/insights)', method: 'GET', path: '/api/insights', body: null, headers: authHeaders },
    { name: 'Collaboration Notifications (GET /api/collaboration/notifications)', method: 'GET', path: '/api/collaboration/notifications', body: null, headers: authHeaders },
    { name: 'Collaboration Favorites (GET /api/collaboration/favorites)', method: 'GET', path: '/api/collaboration/favorites', body: null, headers: authHeaders },
    { name: 'Audit Logs Feed (GET /api/admin/audit-logs?limit=20)', method: 'GET', path: '/api/admin/audit-logs?limit=20', body: null, headers: authHeaders }
  ];

  const concurrency = 10;
  const requestsPerScenario = 25; // 200 total requests

  const allLatencies = [];
  let totalRequests = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const scenario of scenarios) {
    process.stdout.write(`Benchmarking ${scenario.name.padEnd(50)} ... `);
    const scenarioLatencies = [];

    for (let batch = 0; batch < requestsPerScenario / concurrency; batch++) {
      const promises = Array.from({ length: concurrency }).map(() =>
        request(scenario.method, scenario.path, scenario.body, scenario.headers)
      );

      const results = await Promise.all(promises);
      for (const r of results) {
        totalRequests++;
        allLatencies.push(r.duration);
        scenarioLatencies.push(r.duration);
        if (r.statusCode >= 200 && r.statusCode < 400) {
          successCount++;
        } else {
          errorCount++;
        }
      }
    }

    const sortedScenario = [...scenarioLatencies].sort((a, b) => a - b);
    const scenAvg = (sortedScenario.reduce((a, b) => a + b, 0) / sortedScenario.length).toFixed(1);
    const scenP95 = sortedScenario[Math.floor(sortedScenario.length * 0.95)];
    console.log(`[Avg: ${scenAvg}ms, p95: ${scenP95}ms]`);
  }

  const sortedAll = [...allLatencies].sort((a, b) => a - b);
  const avgLatency = (sortedAll.reduce((a, b) => a + b, 0) / sortedAll.length).toFixed(2);
  const p50 = sortedAll[Math.floor(sortedAll.length * 0.50)];
  const p90 = sortedAll[Math.floor(sortedAll.length * 0.90)];
  const p95 = sortedAll[Math.floor(sortedAll.length * 0.95)];
  const p99 = sortedAll[Math.floor(sortedAll.length * 0.99)];
  const successRate = ((successCount / totalRequests) * 100).toFixed(2);

  console.log('\n===============================================================');
  console.log('  LOAD BENCHMARK SUMMARY RESULTS');
  console.log('===============================================================');
  console.log(`Total Requests Processed : ${totalRequests}`);
  console.log(`Successful Responses     : ${successCount} (${successRate}%)`);
  console.log(`Failed Responses         : ${errorCount}`);
  console.log(`Average Latency          : ${avgLatency} ms`);
  console.log(`p50 Latency (Median)     : ${p50} ms`);
  console.log(`p90 Latency              : ${p90} ms`);
  console.log(`p95 Latency              : ${p95} ms`);
  console.log(`p99 Latency              : ${p99} ms`);
  console.log('===============================================================\n');

  if (server) server.close();
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  if (server) server.close();
  process.exit(1);
});
