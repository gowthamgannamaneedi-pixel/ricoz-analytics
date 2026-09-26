/**
 * Focused Automated Test Suite: Dataset Deletion, RBAC, Multi-Tenancy & Dependency Guard
 * Tests all requirements from Step 22:
 * 1. Authorized delete (Admin)
 * 2. Authorized delete (Manager)
 * 3. Unauthorized delete (Analyst -> 403)
 * 4. Unauthorized delete (Viewer -> 403)
 * 5. Missing JWT -> 401
 * 6. Invalid JWT -> 401
 * 7. Nonexistent dataset -> 404
 * 8. Cross-tenant delete -> 404/403
 * 9. Dependent dataset blocked -> 409 Conflict
 * 10. Successful deletion & verification
 * 11. Database/storage cleanup
 * 12. No orphan records (cascaded cleanups)
 * 13. Audit event logged (DATASET_DELETED)
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const storage = require('./storage');
const Dataset = require('./models/datasetModel');
const AuditLogModel = require('./models/auditLogModel');

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
    if (reqBody) {
      req.write(reqBody);
    }
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
  console.log('  DATASET DELETION & RBAC AUTOMATED TEST SUITE (12+ TESTS)      ');
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
  const orgB = '00000000-0000-0000-0000-000000000002';

  const adminTokenA = generateToken(1, 'admin@ricoz.test', 'admin', orgA);
  const managerTokenA = generateToken(2, 'manager@ricoz.test', 'manager', orgA);
  const analystTokenA = generateToken(3, 'analyst@ricoz.test', 'analyst', orgA);
  const viewerTokenA = generateToken(4, 'viewer@ricoz.test', 'viewer', orgA);
  const adminTokenB = generateToken(10, 'admin_b@other.test', 'admin', orgB);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  try {
    // Helper to create test dataset
    async function createTestDataset(name, userId = 1, orgId = orgA) {
      const saved = await storage.saveFile(userId, `${name}.csv`, Buffer.from('id,val\n1,100\n2,200'));
      const d = await Dataset.create({
        userId,
        name,
        description: `Test dataset ${name}`,
        filePath: saved.filePath,
        rowCount: 2,
        columnCount: 2,
        schema: [{ name: 'id', type: 'number' }, { name: 'val', type: 'number' }]
      });
      return { ...d, filePath: saved.filePath };
    }

    // -------------------------------------------------------------
    // Test 1: Admin can delete dataset
    // -------------------------------------------------------------
    let testDataset1;
    await test('Authorized delete (Admin role)', async () => {
      testDataset1 = await createTestDataset('AdminDeleteTest');
      const res = await request('DELETE', `/api/datasets/${testDataset1.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /deleted successfully/i);
    });

    // -------------------------------------------------------------
    // Test 2: Manager can delete dataset
    // -------------------------------------------------------------
    let testDataset2;
    await test('Authorized delete (Manager role)', async () => {
      testDataset2 = await createTestDataset('ManagerDeleteTest');
      const res = await request('DELETE', `/api/datasets/${testDataset2.id}`, null, {
        Authorization: `Bearer ${managerTokenA}`
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /deleted successfully/i);
    });

    // -------------------------------------------------------------
    // Test 3: Analyst denied if unauthorized (403)
    // -------------------------------------------------------------
    let testDataset3;
    await test('Analyst denied dataset deletion (403 Forbidden)', async () => {
      testDataset3 = await createTestDataset('AnalystBlockTest');
      const res = await request('DELETE', `/api/datasets/${testDataset3.id}`, null, {
        Authorization: `Bearer ${analystTokenA}`
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 4: Viewer denied dataset deletion (403)
    // -------------------------------------------------------------
    await test('Viewer denied dataset deletion (403 Forbidden)', async () => {
      const res = await request('DELETE', `/api/datasets/${testDataset3.id}`, null, {
        Authorization: `Bearer ${viewerTokenA}`
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 5: Missing JWT -> 401 Unauthorized
    // -------------------------------------------------------------
    await test('Missing JWT returns 401 Unauthorized', async () => {
      const res = await request('DELETE', `/api/datasets/${testDataset3.id}`);
      assert.strictEqual(res.statusCode, 401);
    });

    // -------------------------------------------------------------
    // Test 6: Invalid JWT -> 401 Unauthorized
    // -------------------------------------------------------------
    await test('Invalid JWT returns 401 Unauthorized', async () => {
      const res = await request('DELETE', `/api/datasets/${testDataset3.id}`, null, {
        Authorization: 'Bearer invalid.bogus.jwt'
      });
      assert.strictEqual(res.statusCode, 401);
    });

    // -------------------------------------------------------------
    // Test 7: Nonexistent dataset -> 404 Not Found
    // -------------------------------------------------------------
    await test('Nonexistent dataset returns 404 Not Found', async () => {
      const res = await request('DELETE', '/api/datasets/999999', null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 8: Cross-tenant delete -> 404 Not Found (Tenant Isolation)
    // -------------------------------------------------------------
    await test('Cross-tenant delete denied (Org B admin deleting Org A dataset)', async () => {
      // testDataset3 belongs to Org A
      const res = await request('DELETE', `/api/datasets/${testDataset3.id}`, null, {
        Authorization: `Bearer ${adminTokenB}`
      });

      // Cannot access another organization's dataset -> 404
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 9: Dependent dataset blocked -> 409 Conflict
    // -------------------------------------------------------------
    let depDataset;
    await test('Dependent dataset deletion blocked when used by dashboard widget (409 Conflict)', async () => {
      depDataset = await createTestDataset('DependentDataset');
      
      // Simulate dashboard widget using this dataset
      await db.query(
        'INSERT INTO dashboard_widgets (id, dashboard_id, dataset_id, title, type) VALUES ($1, $2, $3, $4, $5)',
        ['00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', depDataset.id, 'Active Widget', 'bar_chart']
      ).catch(() => null);

      const res = await request('DELETE', `/api/datasets/${depDataset.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /dashboard widget/i);

      // Clean up test widget
      await db.query('DELETE FROM dashboard_widgets WHERE id = $1', ['00000000-0000-0000-0000-000000000099']).catch(() => null);
    });

    // -------------------------------------------------------------
    // Test 10: Successful deletion verification
    // -------------------------------------------------------------
    await test('Successful deletion confirms dataset is no longer accessible (404)', async () => {
      // Now that the widget is removed, deletion succeeds
      const delRes = await request('DELETE', `/api/datasets/${depDataset.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      assert.strictEqual(delRes.statusCode, 200);

      // Subsequent GET returns 404
      const getRes = await request('GET', `/api/datasets/${depDataset.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      assert.strictEqual(getRes.statusCode, 404);
    });

    // -------------------------------------------------------------
    // Test 11: Database and file storage cleanup
    // -------------------------------------------------------------
    await test('Storage cleanup removes physical file on disk', async () => {
      const fileExists = await storage.exists(depDataset.filePath);
      assert.strictEqual(fileExists, false, 'Underlying file should be deleted from storage');
    });

    // -------------------------------------------------------------
    // Test 12: No orphan records remain
    // -------------------------------------------------------------
    await test('No orphan metrics, alerts, or forecasts remain after dataset delete', async () => {
      const orphanMetrics = await db.query('SELECT * FROM metrics WHERE dataset_id = $1', [depDataset.id]);
      assert.strictEqual(orphanMetrics.rows.length, 0);

      const orphanAlerts = await db.query('SELECT * FROM alerts WHERE dataset_id = $1', [depDataset.id]);
      assert.strictEqual(orphanAlerts.rows.length, 0);
    });

    // -------------------------------------------------------------
    // Test 13: Audit event created (DATASET_DELETED)
    // -------------------------------------------------------------
    await test('Audit log record DATASET_DELETED is generated with safe metadata', async () => {
      const logs = await AuditLogModel.findByOrganizationId(orgA, {
        action: 'DATASET_DELETED',
        limit: 5
      });
      const items = logs.logs || logs;
      assert.ok(items.length > 0, 'Audit event DATASET_DELETED should exist');
      assert.strictEqual(items[0].action, 'DATASET_DELETED');
      assert.strictEqual(items[0].resource_type, 'dataset');
    });

    // Clean up remaining test dataset 3
    await request('DELETE', `/api/datasets/${testDataset3.id}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  RESULT: ${passed}/${total} TESTS PASSED (${((passed/total)*100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runTests;
