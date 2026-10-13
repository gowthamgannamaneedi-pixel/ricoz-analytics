/**
 * Regression Test Suite: Dataset Relationship Creation & Validation
 * Verifies data-flow bugfix from dropdowns/payload to backend validation & DB persistence.
 */
const http = require('http');
const app = require('./app');
const config = require('./config');
const Dataset = require('./models/datasetModel');
const DatasetRelationshipModel = require('./models/datasetRelationshipModel');
const jwt = require('jsonwebtoken');

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
  console.log('--- Starting Dataset Relationship Creation Regression Tests ---');
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

  // Generate Admin Auth Token using server's configured jwtSecret
  adminToken = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: testOrgId },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  let datasetA;
  let datasetB;
  let datasetIncompatible;

  try {
    datasetA = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Customers Master Registry Test',
      description: 'Customer profiles and demographics',
      filePath: 'test/customers.csv',
      rowCount: 5,
      columnCount: 3,
      schema: [
        { name: 'customer_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'region', type: 'string' }
      ]
    });

    datasetB = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Orders Raw Stream Test',
      description: 'Transactional order records',
      filePath: 'test/orders.csv',
      rowCount: 10,
      columnCount: 4,
      schema: [
        { name: 'order_id', type: 'integer' },
        { name: 'customer_id', type: 'string' },
        { name: 'revenue', type: 'number' },
        { name: 'order_date', type: 'date' }
      ]
    });

    datasetIncompatible = await Dataset.create({
      userId: 1,
      organizationId: testOrgId,
      name: 'Incompatible Types Dataset',
      description: 'Dataset with incompatible column types',
      filePath: 'test/incompatible.csv',
      rowCount: 2,
      columnCount: 2,
      schema: [
        { name: 'customer_id', type: 'integer' },
        { name: 'code', type: 'boolean' }
      ]
    });
  } catch (err) {
    console.error('Setup dataset error:', err);
    throw err;
  }

  const idA = String(datasetA.id);
  const idB = String(datasetB.id);
  const idIncomp = String(datasetIncompatible.id);

  // 1. Missing source_dataset_id
  await assertTest('1. Reject when source_dataset_id is missing or null', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: null,
      source_column: 'customer_id',
      target_dataset_id: idB,
      target_column: 'customer_id',
      relationship_type: 'one_to_many'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('source_dataset_id, source_column, target_dataset_id, and target_column are required')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 2. Missing source_column
  await assertTest('2. Reject when source_column is whitespace or empty', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: '   ',
      target_dataset_id: idB,
      target_column: 'customer_id',
      relationship_type: 'one_to_many'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('source_dataset_id, source_column, target_dataset_id, and target_column are required')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 3. Missing target_dataset_id
  await assertTest('3. Reject when target_dataset_id is undefined', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_column: 'customer_id',
      relationship_type: 'one_to_many'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('source_dataset_id, source_column, target_dataset_id, and target_column are required')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 4. Missing target_column
  await assertTest('4. Reject when target_column is empty string', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_dataset_id: idB,
      target_column: '',
      relationship_type: 'one_to_many'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('source_dataset_id, source_column, target_dataset_id, and target_column are required')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 5. Self-join on same column
  await assertTest('5. Reject linking dataset to itself on exact same column', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_dataset_id: idA,
      target_column: 'customer_id',
      relationship_type: 'one_to_one'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('Cannot link a dataset to itself on the exact same column')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 6. Incompatible column types
  await assertTest('6. Reject incompatible column data types', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_dataset_id: idIncomp,
      target_column: 'customer_id',
      relationship_type: 'many_to_one'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('Column data types must be compatible')) {
      throw new Error(`Unexpected message: ${res.body.message}`);
    }
  });

  // 7. Successful creation with string UUID dataset IDs
  let createdRelId = null;
  await assertTest('7. Successfully create dataset relationship with valid dropdown payload (201 Created)', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_dataset_id: idB,
      target_column: 'customer_id',
      relationship_type: 'one_to_many',
      description: 'Links customer master registry to sales order stream'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 201) throw new Error(`Expected 201 Created, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.success) throw new Error('Response success is false');
    const rel = res.body.data || res.body.relationship;
    if (!rel || !rel.id) throw new Error('Missing relationship id in response');
    if (String(rel.source_dataset_id) !== idA) throw new Error(`Mismatched source_dataset_id: ${rel.source_dataset_id}`);
    if (String(rel.target_dataset_id) !== idB) throw new Error(`Mismatched target_dataset_id: ${rel.target_dataset_id}`);
    if (rel.source_column !== 'customer_id' || rel.target_column !== 'customer_id') {
      throw new Error('Mismatched column names');
    }
    createdRelId = rel.id;
  });

  // 8. Retrieval via GET /api/dataset-relationships with joined metadata
  await assertTest('8. Verify relationship listing includes created relationship with joined dataset names', async () => {
    const res = await request('GET', '/api/dataset-relationships', null, {
      Authorization: `Bearer ${adminToken}`
    });

    if (res.statusCode !== 200) throw new Error(`Expected 200 OK, got ${res.statusCode}`);
    const rels = res.body.data || res.body.relationships || [];
    const found = rels.find(r => r.id === createdRelId);
    if (!found) throw new Error(`Created relationship ${createdRelId} not found in listing`);
    if (!found.source_dataset_name || !found.target_dataset_name) {
      throw new Error('Missing joined dataset names on relationship record');
    }
  });

  // 9. Prevent duplicate relationship
  await assertTest('9. Reject duplicate relationship creation (409 Conflict)', async () => {
    const res = await request('POST', '/api/dataset-relationships', {
      source_dataset_id: idA,
      source_column: 'customer_id',
      target_dataset_id: idB,
      target_column: 'customer_id',
      relationship_type: 'one_to_many'
    }, { Authorization: `Bearer ${adminToken}` });

    if (res.statusCode !== 409) throw new Error(`Expected 409 Conflict, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (!res.body.message.includes('already exists')) {
      throw new Error(`Unexpected duplicate message: ${res.body.message}`);
    }
  });

  // 10. Clean up
  if (createdRelId) {
    await assertTest('10. Clean up relationship via DELETE /api/dataset-relationships/:id', async () => {
      const res = await request('DELETE', `/api/dataset-relationships/${createdRelId}`, null, {
        Authorization: `Bearer ${adminToken}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200 OK, got ${res.statusCode}`);
    });
  }

  console.log(`\nRegression Test Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

server = http.createServer(app);
server.listen(0, async () => {
  port = server.address().port;
  console.log(`Test server running on port ${port}`);
  try {
    await runTests();
  } catch (e) {
    console.error('Fatal test error:', e);
    process.exit(1);
  } finally {
    server.close(() => process.exit(0));
  }
});
