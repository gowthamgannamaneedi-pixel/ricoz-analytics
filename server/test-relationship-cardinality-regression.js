/**
 * Regression Test Suite: Dataset Relationship Type Checking, Cardinality & Persistence
 * Verifies safe comparison logic, physical type checking, cardinality enforcement,
 * and UUID dataset IDs without PostgreSQL character varying = integer errors.
 */
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const Dataset = require('./models/datasetModel');
const DatasetRelationshipModel = require('./models/datasetRelationshipModel');

let server;
let port;
let adminToken;
const testOrgId = '00000000-0000-0000-0000-000000000001';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (data) {
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            parsed = raw;
          }
          resolve({ statusCode: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Dataset Relationship Cardinality & Type Regression Tests ---');
  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(`      ${err.message}`);
      failed++;
    }
  }

  // Generate Admin Auth Token
  adminToken = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: testOrgId },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  let dsStringA, dsStringB, dsIntA, dsIntB, dsIncompatible;
  let createdRelationshipIds = [];

  try {
    // 1. Setup mock datasets in memory / database
    dsStringA = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Products Catalog Test',
      description: 'Master list of products',
      filePath: 'test/products_catalog.csv',
      rowCount: 3,
      columnCount: 2,
      schema: [
        { name: 'product_id', type: 'string' },
        { name: 'product_name', type: 'string' }
      ]
    });

    dsStringB = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Order Items Test',
      description: 'Order line items with products',
      filePath: 'test/order_items.csv',
      rowCount: 5,
      columnCount: 3,
      schema: [
        { name: 'item_id', type: 'string' },
        { name: 'product_id', type: 'string' },
        { name: 'quantity', type: 'integer' }
      ]
    });

    dsIntA = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Department Registry Test',
      description: 'Departments with numeric ID',
      filePath: 'test/departments.csv',
      rowCount: 4,
      columnCount: 2,
      schema: [
        { name: 'dept_id', type: 'integer' },
        { name: 'dept_name', type: 'string' }
      ]
    });

    dsIntB = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Employee Roster Test',
      description: 'Employees mapped to dept_id',
      filePath: 'test/employees.csv',
      rowCount: 10,
      columnCount: 3,
      schema: [
        { name: 'emp_id', type: 'integer' },
        { name: 'dept_id', type: 'integer' },
        { name: 'emp_name', type: 'string' }
      ]
    });

    dsIncompatible = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Metrics Summary Test',
      description: 'Summary metrics table',
      filePath: 'test/metrics_summary.csv',
      rowCount: 3,
      columnCount: 2,
      schema: [
        { name: 'metric_code', type: 'string' },
        { name: 'metric_value', type: 'float' }
      ]
    });

    // TEST 1: Valid string-to-string relationship persistence (201 Created)
    await assertTest('1. Valid string-to-string relationship saves successfully (201 Created)', async () => {
      const res = await request(
        'POST',
        '/api/dataset-relationships',
        {
          source_dataset_id: String(dsStringB.id),
          source_column: 'product_id',
          target_dataset_id: String(dsStringA.id),
          target_column: 'product_id',
          relationship_type: 'many_to_one',
          description: 'Order items to Product Catalog'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      if (res.statusCode !== 201) {
        throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!res.body.data || !res.body.data.id) {
        throw new Error('Response did not contain created relationship data ID');
      }
      createdRelationshipIds.push(res.body.data.id);
    });

    // TEST 2: Valid integer-to-integer relationship persistence (201 Created)
    await assertTest('2. Valid integer-to-integer relationship saves successfully (201 Created)', async () => {
      const res = await request(
        'POST',
        '/api/dataset-relationships',
        {
          source_dataset_id: String(dsIntB.id),
          source_column: 'dept_id',
          target_dataset_id: String(dsIntA.id),
          target_column: 'dept_id',
          relationship_type: 'many_to_one',
          description: 'Employees to Departments'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      if (res.statusCode !== 201) {
        throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!res.body.data || !res.body.data.id) {
        throw new Error('Response did not contain created relationship data ID');
      }
      createdRelationshipIds.push(res.body.data.id);
    });

    // TEST 3: Incompatible types rejection (400 Bad Request)
    await assertTest('3. Incompatible column types rejected with clean validation error (400)', async () => {
      const res = await request(
        'POST',
        '/api/dataset-relationships',
        {
          source_dataset_id: String(dsIntB.id),
          source_column: 'dept_id', // integer
          target_dataset_id: String(dsIncompatible.id),
          target_column: 'metric_code', // string
          relationship_type: 'many_to_one',
          description: 'Mismatched types test'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      if (res.statusCode !== 400) {
        throw new Error(`Expected 400 for incompatible types, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!res.body.message || !res.body.message.toLowerCase().includes('compatible')) {
        throw new Error(`Expected error message to mention compatibility, got: ${res.body.message}`);
      }
    });

    // TEST 4: Verification of GET /api/dataset-relationships (No character varying = integer error)
    await assertTest('4. GET /api/dataset-relationships joins metadata cleanly without SQL operator error', async () => {
      const res = await request(
        'GET',
        '/api/dataset-relationships',
        null,
        { Authorization: `Bearer ${adminToken}` }
      );

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!Array.isArray(res.body.data)) {
        throw new Error('Expected data to be an array of relationships');
      }
      const found = res.body.data.find(r => createdRelationshipIds.includes(r.id));
      if (!found) {
        throw new Error('Created relationship was not found in listing');
      }
      if (!found.source_dataset_name || !found.target_dataset_name) {
        throw new Error('Dataset names were not joined properly in query');
      }
    });

    // TEST 5: Cardinality enforcement - Many-to-One rejected when target dataset column has duplicate keys
    let dsReproSrc, dsReproTgt;
    try {
      dsReproSrc = await Dataset.create({
        userId: 1,
        organizationId: testOrgId,
        name: 'ricozanalytics_test_10k_repro',
        description: 'Reproduction Source Dataset',
        filePath: 'C:/Users/gowth/Downloads/ricozanalytics_test_10k.csv',
        rowCount: 10000,
        columnCount: 17,
        schema: [
          { name: 'product', type: 'string' },
          { name: 'revenue', type: 'number' }
        ]
      });

      dsReproTgt = await Dataset.create({
        userId: 1,
        organizationId: testOrgId,
        name: 'sample_3_data_quality_repro',
        description: 'Reproduction Target Dataset',
        filePath: 'C:/Users/gowth/Downloads/sample_3_data_quality_test.csv',
        rowCount: 250,
        columnCount: 8,
        schema: [
          { name: 'product', type: 'string' },
          { name: 'status', type: 'string' }
        ]
      });

      await assertTest('5. Cardinality: Many-to-One rejected when target has duplicate keys (400 Bad Request)', async () => {
        const res = await request(
          'POST',
          '/api/dataset-relationships',
          {
            source_dataset_id: String(dsReproSrc.id),
            source_column: 'product',
            target_dataset_id: String(dsReproTgt.id),
            target_column: 'product',
            relationship_type: 'many_to_one',
            description: 'Reproduction scenario many-to-one'
          },
          { Authorization: `Bearer ${adminToken}` }
        );

        if (res.statusCode !== 400) {
          throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
        if (!res.body.message || !res.body.message.includes('duplicate keys')) {
          throw new Error(`Expected error to mention duplicate keys, got: ${res.body.message}`);
        }
      });

      await assertTest('6. Cardinality: Many-to-Many accepted between same datasets and product columns (201 Created)', async () => {
        const res = await request(
          'POST',
          '/api/dataset-relationships',
          {
            source_dataset_id: String(dsReproSrc.id),
            source_column: 'product',
            target_dataset_id: String(dsReproTgt.id),
            target_column: 'product',
            relationship_type: 'many_to_many',
            description: 'Reproduction scenario many-to-many'
          },
          { Authorization: `Bearer ${adminToken}` }
        );

        if (res.statusCode !== 201) {
          throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
        if (!res.body.data || !res.body.data.id) {
          throw new Error('Expected created relationship data ID');
        }
        createdRelationshipIds.push(res.body.data.id);
      });
    } finally {
      if (dsReproSrc) await Dataset.deleteByIdAndOrgId(dsReproSrc.id, testOrgId).catch(() => null);
      if (dsReproTgt) await Dataset.deleteByIdAndOrgId(dsReproTgt.id, testOrgId).catch(() => null);
    }

    // TEST 7: Clean cleanup of created test relationships
    await assertTest('7. Cleanup test relationships via DELETE', async () => {
      for (const id of createdRelationshipIds) {
        const res = await request(
          'DELETE',
          `/api/dataset-relationships/${id}`,
          null,
          { Authorization: `Bearer ${adminToken}` }
        );
        if (res.statusCode !== 200) {
          throw new Error(`Failed to delete relationship ${id}, got ${res.statusCode}`);
        }
      }
      createdRelationshipIds = [];
    });

  } finally {
    // Cleanup datasets
    const cleanupDatasets = [dsStringA, dsStringB, dsIntA, dsIntB, dsIncompatible].filter(Boolean);
    for (const d of cleanupDatasets) {
      await Dataset.deleteByIdAndOrgId(d.id, testOrgId).catch(() => null);
    }
  }

  console.log(`\nRegression Test Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

server = http.createServer(app);
server.listen(0, () => {
  port = server.address().port;
  runTests()
    .then(() => {
      server.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Test runner encountered fatal error:', err);
      server.close();
      process.exit(1);
    });
});
