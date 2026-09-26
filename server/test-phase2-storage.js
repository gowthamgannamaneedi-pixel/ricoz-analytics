const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const storage = require('./storage');
const analyticsService = require('./services/analyticsService');
const insightService = require('./services/insightService');
const Dataset = require('./models/datasetModel');

function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('===============================================================');
  console.log('  PHASE 2: PERSISTENT DATASET STORAGE & RETRIEVAL TEST SUITE   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  let server = null;
  const testPort = 5992;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(`       Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  function makeRequest(method, reqPath, token, body = null, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
      const isBuffer = Buffer.isBuffer(body);
      const payload = isBuffer ? body : (body ? JSON.stringify(body) : null);
      const options = {
        hostname: '127.0.0.1',
        port: testPort,
        path: reqPath,
        method,
        headers: {
          'Content-Type': contentType,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    server = app.listen(testPort);
    await new Promise(r => setTimeout(r, 200));

    const testOrgId = '00000000-0000-0000-0000-000000000001';
    const adminToken = generateToken(1, 'admin@ricoz.test', 'admin', testOrgId);

    // -------------------------------------------------------------
    // Test 1: Bundled seed availability and verification
    // -------------------------------------------------------------
    await test('1. Bundled seed dataset 1/sample_sales_q4.csv is available in storage', async () => {
      const exists = await storage.exists('1/sample_sales_q4.csv');
      assert.strictEqual(exists, true, 'Seed dataset file should exist in storage');

      const buffer = await storage.readFile('1/sample_sales_q4.csv');
      assert(buffer && buffer.length > 0, 'Buffer should not be empty');

      const text = buffer.toString('utf8');
      assert(text.includes('order_id'), 'Seed dataset should contain header order_id');
      assert(text.includes('sales_amount'), 'Seed dataset should contain sales_amount');
      assert(text.includes('Bengaluru'), 'Seed dataset should contain Bengaluru records');
    });

    // -------------------------------------------------------------
    // Test 2: Analytics loading and schema parsing
    // -------------------------------------------------------------
    await test('2. AnalyticsService loads and aggregates seed records accurately', async () => {
      const records = await analyticsService.loadDatasetRecords('1/sample_sales_q4.csv');
      assert(Array.isArray(records), 'Expected array of parsed records');
      assert.strictEqual(records.length, 20, `Expected 20 seed rows, got ${records.length}`);

      // Verify numerical telemetry
      const totalSales = records.reduce((sum, r) => sum + Number(r.sales_amount || 0), 0);
      assert(totalSales > 1000000, `Expected total sales > 1M, got ${totalSales}`);
    });

    // -------------------------------------------------------------
    // Test 3: Upload persistence via StorageProvider
    // -------------------------------------------------------------
    let uploadedKey = null;
    await test('3. Upload persistence creates file in storage and returns relative key', async () => {
      const testContent = Buffer.from('order_id,region,product,sales_amount\nORD-999,North,Widget A,50000\nORD-998,South,Widget B,75000\n');
      const saved = await storage.saveFile(1, 'test_sales_data.csv', testContent);

      assert(saved.filePath, 'Should return relative filePath');
      assert(saved.size === testContent.length, 'Size should match buffer length');
      uploadedKey = saved.filePath;

      // Verify exists and read
      const exists = await storage.exists(uploadedKey);
      assert.strictEqual(exists, true, 'Uploaded file should exist in storage');

      const readBuf = await storage.readFile(uploadedKey);
      assert.strictEqual(readBuf.toString('utf8'), testContent.toString('utf8'));
    });

    // -------------------------------------------------------------
    // Test 4: Dataset preview endpoint with persistent storage
    // -------------------------------------------------------------
    await test('4. GET /api/datasets/:id/preview reads from storage and returns schema & preview', async () => {
      const res = await makeRequest('GET', '/api/datasets/1/preview', adminToken);
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert(res.body.success, 'Expected success: true');
      assert(Array.isArray(res.body.data.preview), 'Expected preview array');
      assert(res.body.data.preview.length > 0, 'Preview should contain rows');
      const schema = typeof res.body.data.schema === 'string' ? JSON.parse(res.body.data.schema) : res.body.data.schema;
      assert(Array.isArray(schema), 'Expected schema array');
    });

    // -------------------------------------------------------------
    // Test 5: AI Insights engine generates dataset-grounded insights
    // -------------------------------------------------------------
    await test('5. AI Insights engine loads seed dataset and generates grounded analytics insights', async () => {
      const result = await insightService.generateInsights(testOrgId, {
        datasetId: 1,
        persist: false
      });

      assert(result.count > 0, 'Expected insights to be generated from dataset');
      const datasetInsights = result.insights.filter(i => 
        i.type === 'growth' || i.type === 'decline' || i.type === 'trend' || i.type === 'data_quality'
      );
      assert(datasetInsights.length > 0, 'Expected at least 1 dataset-grounded insight (growth/decline/trend/quality)');

      // Verify that the insight has real numerical evidence
      const first = datasetInsights[0];
      assert(first.evidence, 'Insight should carry structured evidence');
      assert(first.title, 'Insight should carry a title');
    });

    // -------------------------------------------------------------
    // Test 6: Deletion cleanup
    // -------------------------------------------------------------
    await test('6. StorageProvider deleteFile cleanly purges file', async () => {
      if (!uploadedKey) throw new Error('No uploaded key from Test 3');
      const deleted = await storage.deleteFile(uploadedKey);
      assert.strictEqual(deleted, true, 'deleteFile should return true');

      const existsAfter = await storage.exists(uploadedKey);
      assert.strictEqual(existsAfter, false, 'File should no longer exist after deletion');
    });

    // -------------------------------------------------------------
    // Test 7: Path traversal protection
    // -------------------------------------------------------------
    await test('7. Path traversal attempts are strictly forbidden with security error', async () => {
      let trapped = false;
      try {
        await storage.readFile('../../../etc/passwd');
      } catch (secErr) {
        trapped = true;
        assert(secErr.message.includes('Security Alert') || secErr.message.includes('forbidden'), 
          `Expected security exception, got: ${secErr.message}`);
      }
      assert.strictEqual(trapped, true, 'Storage must reject path traversal attempt');
    });

    // -------------------------------------------------------------
    // Test 8: Offline LocalStorageProvider parity
    // -------------------------------------------------------------
    await test('8. LocalStorageProvider operates independently with bundled seed fallback', async () => {
      const localProvider = new storage.LocalStorageProvider();
      const exists = await localProvider.exists('1/sample_sales_q4.csv');
      assert.strictEqual(exists, true, 'LocalStorageProvider should resolve bundled seed dataset');

      const buffer = await localProvider.readFile('1/sample_sales_q4.csv');
      assert(buffer.length > 0, 'LocalStorageProvider should read bundled seed dataset');
    });

    // -------------------------------------------------------------
    // Test 9: Stream reading capability
    // -------------------------------------------------------------
    await test('9. StorageProvider getFileStream streams file data reliably', async () => {
      const fileStream = storage.getFileStream('1/sample_sales_q4.csv');
      let data = '';
      await new Promise((resolve, reject) => {
        fileStream.on('data', chunk => data += chunk);
        fileStream.on('end', resolve);
        fileStream.on('error', reject);
      });
      assert(data.includes('ORD-1001'), 'Stream should output CSV contents');
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Phase 2 test error:', err);
  process.exit(1);
});
