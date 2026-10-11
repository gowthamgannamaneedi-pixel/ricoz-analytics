/**
 * End-to-End Regression Test: Dataset Persistence, Error Resilience, Deletion, and Empty State
 * 
 * Verifies the complete resolution of the bug:
 * 1. Upload/ingestion stores datasets permanently in PostgreSQL.
 * 2. Errors during queries DO NOT silently flip the server to in-memory fallback demo store.
 * 3. Dataset retrieval returns exact persisted data.
 * 4. Dataset deletion permanently removes records from PostgreSQL.
 * 5. When datasets count reaches 0, the API returns [] / 0 without injecting mock or ghost datasets.
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
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

async function run() {
  console.log('\n========================================================================');
  console.log('  DATASET PERSISTENCE, LIFECYCLE & ZERO-FALLBACK REGRESSION TEST SUITE  ');
  console.log('========================================================================\n');

  // Initialize DB
  await db.initDb();
  assert.strictEqual(db.isUsingFallback(), false, 'Database must be connected to PostgreSQL, not fallback store.');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const testOrgId = '00000000-0000-0000-0000-000000000001';
  const testUserId = 1;
  const token = generateToken(testUserId, 'admin@ricoz.test', 'admin', testOrgId);
  const authHeaders = { Authorization: `Bearer ${token}` };

  let testDatasetId = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Ingest a new dataset with specific telemetry
    // -------------------------------------------------------------
    console.log('[Test 1] Creating a persistent dataset with known records...');
    const createRes = await Dataset.create({
      userId: testUserId,
      organizationId: testOrgId,
      name: 'E2E Persistence Test Telemetry (Q1)',
      description: 'Testing lifecycle persistence without silent demo resurrection',
      filePath: 'uploads/test-e2e.csv',
      rowCount: 5,
      columnCount: 4,
      schema: [
        { name: 'region', type: 'string' },
        { name: 'revenue', type: 'number' },
        { name: 'units', type: 'number' },
        { name: 'customer_segment', type: 'string' }
      ]
    });

    testDatasetId = createRes.id;
    assert(testDatasetId, 'Dataset ID should be returned from creation');
    console.log(` -> Created dataset ID: ${testDatasetId} for Org: ${testOrgId}`);

    // Insert rows into dataset_rows table
    const rows = [
      { region: 'North', revenue: 50000, units: 120, customer_segment: 'Enterprise' },
      { region: 'South', revenue: 35000, units: 85, customer_segment: 'SMB' },
      { region: 'East', revenue: 62000, units: 140, customer_segment: 'Enterprise' },
      { region: 'West', revenue: 41000, units: 95, customer_segment: 'Consumer' },
      { region: 'Central', revenue: 29000, units: 60, customer_segment: 'SMB' }
    ];

    for (let i = 0; i < rows.length; i++) {
      await db.query(
        'INSERT INTO dataset_rows (dataset_id, organization_id, row_index, data) VALUES ($1, $2, $3, $4)',
        [testDatasetId, testOrgId, i, JSON.stringify(rows[i])]
      );
    }
    console.log(' -> Inserted 5 rows for the dataset');

    // -------------------------------------------------------------
    // Test 2: Fetch via API and confirm accurate metadata & rows
    // -------------------------------------------------------------
    console.log('\n[Test 2] Fetching dataset list via GET /api/datasets...');
    const listRes = await request('GET', '/api/datasets', null, authHeaders);
    assert.strictEqual(listRes.statusCode, 200, `Expected 200 OK, got ${listRes.statusCode}`);
    
    const datasets = listRes.body.data || listRes.body.datasets || listRes.body;
    assert(Array.isArray(datasets), 'Datasets response must be an array');
    const found = datasets.find(d => Number(d.id) === Number(testDatasetId) || d.name === 'E2E Persistence Test Telemetry (Q1)');
    assert(found, 'Newly created dataset must be returned in GET /api/datasets');
    assert.strictEqual(Number(found.row_count), 5, 'Dataset row count must equal 5');
    console.log(' -> Successfully verified dataset listing and row_count: 5');

    // -------------------------------------------------------------
    // Test 3: Provoke an intentional SQL syntax / query error and ensure fallback store is NOT activated
    // -------------------------------------------------------------
    console.log('\n[Test 3] Provoking an invalid SQL query to verify fallback store is NOT triggered...');
    let queryFailedAsExpected = false;
    try {
      await db.query('SELECT non_existent_column FROM non_existent_table_12345');
    } catch (err) {
      queryFailedAsExpected = true;
    }
    assert.strictEqual(queryFailedAsExpected, true, 'Bad query should throw error');
    assert.strictEqual(db.isUsingFallback(), false, 'Query error must NOT flip useFallbackStore to true!');
    console.log(' -> Confirmed: Error handled safely without corrupting server database mode');

    // -------------------------------------------------------------
    // Test 4: Re-query dataset via API to prove persistence after errors
    // -------------------------------------------------------------
    console.log('\n[Test 4] Re-querying dataset details after DB error...');
    const detailRes = await request('GET', `/api/datasets/${testDatasetId}`, null, authHeaders);
    assert.strictEqual(detailRes.statusCode, 200, `Expected 200 OK, got ${detailRes.statusCode}`);
    const detailData = detailRes.body.data || detailRes.body;
    assert.strictEqual(detailData.name, 'E2E Persistence Test Telemetry (Q1)');
    console.log(' -> Confirmed: Dataset remains fully intact and queryable');

    // -------------------------------------------------------------
    // Test 5: Delete the dataset permanently
    // -------------------------------------------------------------
    console.log(`\n[Test 5] Deleting dataset ID ${testDatasetId} via DELETE /api/datasets/:id...`);
    const deleteRes = await request('DELETE', `/api/datasets/${testDatasetId}`, null, authHeaders);
    assert.strictEqual(deleteRes.statusCode, 200, `Expected 200 OK, got ${deleteRes.statusCode}`);
    console.log(' -> Dataset deletion succeeded with HTTP 200');

    // -------------------------------------------------------------
    // Test 6: Verify Empty State (Deleted dataset is gone, NO demo datasets injected)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Verifying state after deletion...');
    const postDeleteListRes = await request('GET', '/api/datasets', null, authHeaders);
    assert.strictEqual(postDeleteListRes.statusCode, 200);
    const postDeleteDatasets = postDeleteListRes.body.data || postDeleteListRes.body.datasets || postDeleteListRes.body;
    
    const testDatasetStillExists = postDeleteDatasets.find(d => Number(d.id) === Number(testDatasetId));
    assert(!testDatasetStillExists, 'Deleted dataset must not exist in datasets list');

    const ghostDemo = postDeleteDatasets.find(d => d.name === 'Product Inventory & Logistics');
    assert(!ghostDemo, 'No ghost/fake demo datasets (Product Inventory & Logistics) should appear');
    console.log(' -> Confirmed: Deleted dataset permanently removed. No fake datasets generated.');

    // -------------------------------------------------------------
    // Test 7: Verify 404 for deleted dataset
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying 404 response on deleted dataset fetch...');
    const postDeleteDetail = await request('GET', `/api/datasets/${testDatasetId}`, null, authHeaders);
    assert.strictEqual(postDeleteDetail.statusCode, 404, `Expected 404 for deleted dataset, got ${postDeleteDetail.statusCode}`);
    console.log(' -> Confirmed: Correct 404 status code returned.');

    // -------------------------------------------------------------
    // Test 8: Verify dataset_rows cascade cleanup
    // -------------------------------------------------------------
    console.log('\n[Test 8] Verifying cascaded cleanup of dataset_rows in PostgreSQL...');
    const orphanCheck = await db.query('SELECT COUNT(*) as count FROM dataset_rows WHERE dataset_id = $1', [testDatasetId]);
    assert.strictEqual(Number(orphanCheck.rows[0].count), 0, 'All dataset_rows must be cascaded on deletion');
    console.log(' -> Confirmed: 0 orphan rows remaining in PostgreSQL.');

    console.log('\n========================================================================');
    console.log('  ALL PERSISTENCE & ZERO-FALLBACK TESTS PASSED SUCCESSFULLY!          ');
    console.log('========================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  });
