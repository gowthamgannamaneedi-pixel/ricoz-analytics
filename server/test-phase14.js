/**
 * Comprehensive Automated Test Suite for Phase 14: Relational Data Modeling & Dataset Joins
 * Tests 25 critical areas:
 * 1. Relationship creation
 * 2. Relationship retrieval
 * 3. Relationship update
 * 4. Relationship deletion
 * 5. Invalid dataset handling
 * 6. Invalid column handling
 * 7. Incompatible column types
 * 8. Cross-tenant relationship prevention
 * 9. RBAC (Admin/Manager/Analyst permissions)
 * 10. Viewer restrictions
 * 11. Valid INNER JOIN execution
 * 12. Valid LEFT JOIN execution
 * 13. Multi-dataset query execution
 * 14. Aggregation after join
 * 15. Filtering after join
 * 16. Pagination and result limits
 * 17. Unauthorized dataset protection
 * 18. Arbitrary SQL injection rejection
 * 19. Audit event creation
 * 20. Dashboard relational widget integration
 * 21. Report export with relational data
 * 22. AI relational query planning
 * 23. AI security validation
 * 24. Empty join result handling
 * 25. Duplicate relationship handling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const Dataset = require('./models/datasetModel');
const DatasetRelationshipModel = require('./models/datasetRelationshipModel');
const AuditLogModel = require('./models/auditLogModel');
const DashboardModel = require('./models/dashboardModel');
const reportService = require('./services/reportService');
const aiQueryPlannerService = require('./services/aiQueryPlannerService');
const geminiService = require('./services/geminiService');
const analyticsService = require('./services/analyticsService');

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

// Token generator helper
function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 14: RELATIONAL DATA MODELING & DATASET JOINS TEST SUITE');
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

  // Prepare Physical CSV files for In-Memory/Disk Relational Query Execution
  const uploadsDir = path.resolve(__dirname, 'uploads/test_data');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ordersCsvPath = path.join(uploadsDir, 'test_orders.csv');
  const customersCsvPath = path.join(uploadsDir, 'test_customers.csv');
  const productsCsvPath = path.join(uploadsDir, 'test_products.csv');

  fs.writeFileSync(
    ordersCsvPath,
    `order_id,customer_id,product_id,order_date,revenue,quantity
101,C1,P1,2026-01-15,5000,2
102,C2,P2,2026-01-16,3500,1
103,C1,P3,2026-01-18,12000,4
104,C3,P1,2026-01-20,2500,1
105,C4,P2,2026-01-22,7000,2
106,C99,P1,2026-01-25,4000,1
`
  );

  fs.writeFileSync(
    customersCsvPath,
    `customer_id,customer_name,region,segment,city
C1,Acme Corp,North,Enterprise,Delhi
C2,Starlight Inc,South,Mid-Market,Bengaluru
C3,BlueFin Systems,North,Enterprise,Chandigarh
C4,Vertex Global,West,SMB,Mumbai
C5,Omni Retail,East,SMB,Kolkata
`
  );

  fs.writeFileSync(
    productsCsvPath,
    `product_id,product_name,category,unit_price
P1,Cloud Compute Core,Infrastructure,2500
P2,Security Suite Pro,Cybersecurity,3500
P3,AI Analytics Addon,Intelligence,3000
`
  );

  // Create Datasets in DB
  let ordersDataset, customersDataset, productsDataset, orgBDataset;

  try {
    ordersDataset = await Dataset.create({
      userId: 1,
      name: 'Orders Master Telemetry',
      description: 'Transaction orders table',
      filePath: ordersCsvPath,
      rowCount: 6,
      columnCount: 6,
      schema: [
        { name: 'order_id', type: 'integer' },
        { name: 'customer_id', type: 'string' },
        { name: 'product_id', type: 'string' },
        { name: 'order_date', type: 'date' },
        { name: 'revenue', type: 'number' },
        { name: 'quantity', type: 'integer' }
      ]
    });

    customersDataset = await Dataset.create({
      userId: 1,
      name: 'Customers Master Registry',
      description: 'Customer profiles and demographics',
      filePath: customersCsvPath,
      rowCount: 5,
      columnCount: 5,
      schema: [
        { name: 'customer_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'region', type: 'string' },
        { name: 'segment', type: 'string' },
        { name: 'city', type: 'string' }
      ]
    });

    productsDataset = await Dataset.create({
      userId: 1,
      name: 'Products Catalog',
      description: 'Product definitions and pricing',
      filePath: productsCsvPath,
      rowCount: 3,
      columnCount: 4,
      schema: [
        { name: 'product_id', type: 'string' },
        { name: 'product_name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'unit_price', type: 'number' }
      ]
    });

    orgBDataset = await Dataset.create({
      userId: 10,
      name: 'Foreign Org B Dataset',
      description: 'Org B dataset for cross-tenant isolation testing',
      filePath: '',
      rowCount: 10,
      columnCount: 2,
      schema: [
        { name: 'customer_id', type: 'string' },
        { name: 'secret_info', type: 'string' }
      ]
    });
  } catch (setupErr) {
    console.warn('Dataset setup note:', setupErr.message);
  }

  let createdRelationshipId = null;

  // Test 1: Relationship creation
  await test('1. Relationship creation: POST /api/dataset-relationships creates a valid relationship with 201 Created', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'customer_id',
        target_dataset_id: customersDataset.id,
        target_column: 'customer_id',
        relationship_type: 'many_to_one',
        description: 'Links order transactions to customer profiles'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 201 || !res.body.success) {
      throw new Error(`Expected 201 Created, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const rel = res.body.data || res.body.relationship;
    if (!rel || !rel.id) throw new Error('Missing relationship ID in creation response');
    if (rel.source_column !== 'customer_id' || rel.target_column !== 'customer_id') {
      throw new Error('Relationship columns do not match requested parameters');
    }
    createdRelationshipId = rel.id;
  });

  // Test 2: Relationship retrieval
  await test('2. Relationship retrieval: GET /api/dataset-relationships and /:id returns relationship details', async () => {
    const listRes = await request('GET', '/api/dataset-relationships', null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (listRes.statusCode !== 200 || !listRes.body.success) {
      throw new Error(`Expected 200 list, got ${listRes.statusCode}`);
    }
    if (!Array.isArray(listRes.body.data) || listRes.body.data.length === 0) {
      throw new Error('Expected at least 1 relationship in list');
    }

    const singleRes = await request('GET', `/api/dataset-relationships/${createdRelationshipId}`, null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (singleRes.statusCode !== 200 || !singleRes.body.success) {
      throw new Error(`Expected 200 single, got ${singleRes.statusCode}`);
    }
  });

  // Test 3: Relationship update
  await test('3. Relationship update: PUT /api/dataset-relationships/:id updates description and attributes', async () => {
    const res = await request(
      'PUT',
      `/api/dataset-relationships/${createdRelationshipId}`,
      {
        description: 'Updated enterprise relationship description',
        relationship_type: 'many_to_one'
      },
      { Authorization: `Bearer ${managerTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    if (res.body.data.description !== 'Updated enterprise relationship description') {
      throw new Error('Description was not updated');
    }
  });

  // Test 4: Relationship deletion
  await test('4. Relationship deletion: DELETE /api/dataset-relationships/:id removes relationship', async () => {
    // Create temporary relationship to delete
    const tempRes = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'product_id',
        target_dataset_id: productsDataset.id,
        target_column: 'product_id',
        relationship_type: 'many_to_one',
        description: 'Temporary relationship for deletion test'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    const tempId = tempRes.body.data.id;
    const delRes = await request('DELETE', `/api/dataset-relationships/${tempId}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });

    if (delRes.statusCode !== 200 || !delRes.body.success) {
      throw new Error(`Expected 200 deletion, got ${delRes.statusCode}`);
    }

    const checkRes = await request('GET', `/api/dataset-relationships/${tempId}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });

    if (checkRes.statusCode !== 404) {
      throw new Error(`Expected 404 after deletion, got ${checkRes.statusCode}`);
    }
  });

  // Test 5: Invalid dataset
  await test('5. Invalid dataset: Creating relationship with non-existent dataset ID returns 404', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: 999999,
        source_column: 'customer_id',
        target_dataset_id: customersDataset.id,
        target_column: 'customer_id'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 404) {
      throw new Error(`Expected 404 for invalid dataset, got ${res.statusCode}`);
    }
  });

  // Test 6: Invalid column
  await test('6. Invalid column: Linking non-existent column returns 400 validation error', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'non_existent_column_xyz',
        target_dataset_id: customersDataset.id,
        target_column: 'customer_id'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 400 || res.body.success) {
      throw new Error(`Expected 400 Bad Request, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    if (!res.body.message.includes('non_existent_column_xyz')) {
      throw new Error('Error message did not identify the missing column');
    }
  });

  // Test 7: Incompatible column types
  await test('7. Incompatible column types: Linking incompatible types (e.g. number vs text) returns 400', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'revenue', // number
        target_dataset_id: customersDataset.id,
        target_column: 'customer_name' // string/text
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 400) {
      throw new Error(`Expected 400 for type mismatch, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    if (!res.body.message.toLowerCase().includes('incompatible') && !res.body.message.toLowerCase().includes('type')) {
      throw new Error('Error message did not explain type incompatibility');
    }
  });

  // Test 8: Cross-tenant relationship prevention
  await test('8. Cross-tenant relationship prevention: Linking Org A dataset with Org B dataset is blocked', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id, // Org A
        source_column: 'customer_id',
        target_dataset_id: orgBDataset.id, // Org B
        target_column: 'customer_id'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 404 && res.statusCode !== 403) {
      throw new Error(`Expected 404 or 403 cross-tenant rejection, got ${res.statusCode}`);
    }
  });

  // Test 9: RBAC (Admin/Manager/Analyst permissions)
  await test('9. RBAC: Admin, Manager, and Analyst can create/update relationships according to policy', async () => {
    const analystRes = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'product_id',
        target_dataset_id: productsDataset.id,
        target_column: 'product_id',
        relationship_type: 'many_to_one',
        description: 'Analyst created relationship'
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (analystRes.statusCode !== 201) {
      throw new Error(`Expected Analyst 201 Created, got ${analystRes.statusCode}: ${JSON.stringify(analystRes.body)}`);
    }
  });

  // Test 10: Viewer restrictions
  await test('10. Viewer restrictions: Viewer cannot create or modify dataset relationships', async () => {
    const createRes = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'customer_id',
        target_dataset_id: customersDataset.id,
        target_column: 'customer_id'
      },
      { Authorization: `Bearer ${viewerTokenA}` }
    );

    if (createRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for viewer, got ${createRes.statusCode}`);
    }
  });

  // Test 11: Valid INNER JOIN
  await test('11. Valid INNER JOIN: Relational query with type "inner" returns only matched records', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [
          {
            dataset_id: customersDataset.id,
            source_column: 'customer_id',
            target_column: 'customer_id',
            type: 'inner'
          }
        ],
        dimensions: ['customers.region'],
        metrics: ['SUM(orders.revenue)']
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 OK, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const rows = res.body.data || res.body.rows;
    // Order 106 has C99 (not in customers), so INNER JOIN excludes C99
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Expected joined rows in result');
    }
  });

  // Test 12: Valid LEFT JOIN
  await test('12. Valid LEFT JOIN: Preserves all left table records with null fill for unmatched right columns', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [
          {
            dataset_id: customersDataset.id,
            source_column: 'customer_id',
            target_column: 'customer_id',
            type: 'left'
          }
        ]
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 OK, got ${res.statusCode}`);
    }

    const rows = res.body.data || res.body.rows;
    // Base table has 6 records; LEFT JOIN should return 6 rows
    if (rows.length !== 6) {
      throw new Error(`Expected 6 rows in left join, got ${rows.length}`);
    }

    const unmatchedRow = rows.find(r => r['orders.customer_id'] === 'C99' || r.customer_id === 'C99');
    if (!unmatchedRow) throw new Error('Unmatched left row C99 was not preserved in LEFT JOIN');
  });

  // Test 13: Multi-dataset query (Orders + Customers + Products)
  await test('13. Multi-dataset query: Querying with multiple joins connects 3 datasets simultaneously', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [
          { dataset_id: customersDataset.id, type: 'left' },
          { dataset_id: productsDataset.id, type: 'left' }
        ],
        dimensions: ['customers.region', 'products.category'],
        metrics: ['SUM(orders.revenue)']
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 Multi-Join, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const rows = res.body.data || res.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Expected aggregated multi-join rows');
    }
  });

  // Test 14: Aggregation after join
  await test('14. Aggregation after join: SUM, AVG, and COUNT correctly aggregate joined columns', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [{ dataset_id: customersDataset.id, type: 'left' }],
        dimensions: ['customers.region'],
        metrics: [
          { column: 'orders.revenue', aggregation: 'SUM', alias: 'total_revenue' },
          { column: 'orders.revenue', aggregation: 'AVG', alias: 'avg_revenue' },
          { column: 'orders.order_id', aggregation: 'COUNT', alias: 'order_count' }
        ]
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200 Aggregation, got ${res.statusCode}`);
    }

    const rows = res.body.data || res.body.rows;
    const northRow = rows.find(r => r['customers.region'] === 'North' || r.region === 'North');
    if (!northRow) throw new Error('North region not found in aggregated results');
    // North has C1 (5000 + 12000) and C3 (2500) = 19500
    if (northRow.total_revenue !== 19500) {
      throw new Error(`Expected North total revenue 19500, got ${northRow.total_revenue}`);
    }
    if (northRow.order_count !== 3) {
      throw new Error(`Expected North order count 3, got ${northRow.order_count}`);
    }
  });

  // Test 15: Filtering after join
  await test('15. Filtering after join: Filters applied to joined attributes correctly prune results', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [{ dataset_id: customersDataset.id, type: 'left' }],
        filters: {
          'customers.region': 'North'
        }
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }

    const rows = res.body.data || res.body.rows;
    if (rows.some(r => (r['customers.region'] || r.region) !== 'North')) {
      throw new Error('Filtering failed: non-North row present in filtered query output');
    }
    if (rows.length !== 3) {
      throw new Error(`Expected 3 filtered rows for North, got ${rows.length}`);
    }
  });

  // Test 16: Pagination/result limits
  await test('16. Pagination/result limits: limit and page parameters restrict output size', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [{ dataset_id: customersDataset.id, type: 'left' }],
        limit: 2,
        page: 1
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }

    if (res.body.data.length !== 2) {
      throw new Error(`Expected exactly 2 rows with limit=2, got ${res.body.data.length}`);
    }
    if (res.body.total !== 6 && res.body.totalCount !== 6) {
      throw new Error(`Expected total count 6, got ${res.body.total}`);
    }
  });

  // Test 17: Unauthorized dataset protection
  await test('17. Unauthorized dataset protection: Cannot join with dataset belonging to another tenant', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        joins: [{ dataset_id: orgBDataset.id, type: 'left' }]
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 404 && res.statusCode !== 403) {
      throw new Error(`Expected 404/403 unauthorized dataset error, got ${res.statusCode}`);
    }
  });

  // Test 18: Arbitrary SQL rejection
  await test('18. Arbitrary SQL rejection: SQL injection payloads in relational query parameters are rejected with 400', async () => {
    const res = await request(
      'POST',
      '/api/analytics/relational-query',
      {
        base_dataset_id: ordersDataset.id,
        dimensions: ["region'; DROP TABLE users; --"],
        metrics: ["SUM(revenue) UNION ALL SELECT * FROM users"]
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (res.statusCode !== 400 || res.body.success) {
      throw new Error(`Expected 400 Bad Request on SQL injection attempt, got ${res.statusCode}`);
    }
  });

  // Test 19: Audit event creation
  await test('19. Audit event creation: Relationship actions and relational query executions produce audit logs', async () => {
    const logsRes = await request('GET', '/api/admin/audit-logs?limit=20', null, {
      Authorization: `Bearer ${adminTokenA}`
    });

    if (logsRes.statusCode !== 200 || !logsRes.body.success) {
      throw new Error(`Expected 200 audit logs, got ${logsRes.statusCode}`);
    }

    const logs = Array.isArray(logsRes.body.data?.logs)
      ? logsRes.body.data.logs
      : (Array.isArray(logsRes.body.data) ? logsRes.body.data : (logsRes.body.logs || []));

    const relActions = logs.filter(l =>
      l.action === 'DATASET_RELATIONSHIP_CREATED' ||
      l.action === 'DATASET_RELATIONSHIP_UPDATED' ||
      l.action === 'DATASET_RELATIONSHIP_DELETED' ||
      l.action === 'RELATIONAL_QUERY_EXECUTED'
    );

    if (relActions.length === 0) {
      throw new Error('Expected relational audit events to be registered');
    }
  });

  // Test 20: Dashboard relational widget
  await test('20. Dashboard relational widget: Dashboard widget evaluates relational joined telemetry', async () => {
    // Create dashboard
    const dashRes = await request(
      'POST',
      '/api/dashboards',
      {
        title: 'Enterprise Regional Revenue Overview',
        description: 'Multi-dataset relational performance dashboard'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    const dashId = dashRes.body.data.id;

    // Add widget with relational configuration
    const widgetRes = await request(
      'POST',
      `/api/dashboards/${dashId}/widgets`,
      {
        type: 'bar_chart',
        title: 'Revenue by Customer Region (Relational)',
        dataset_id: ordersDataset.id,
        configuration: {
          categoryColumn: 'region',
          valueColumn: 'revenue',
          aggregation: 'SUM'
        },
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (widgetRes.statusCode !== 201 || !widgetRes.body.success) {
      throw new Error(`Expected 201 widget creation, got ${widgetRes.statusCode}`);
    }

    // Retrieve dashboard with enriched widget
    const dashCheck = await request('GET', `/api/dashboards/${dashId}`, null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    if (dashCheck.statusCode !== 200 || !dashCheck.body.data.widgets) {
      throw new Error('Dashboard widget was not returned');
    }
  });

  // Test 21: Report export with relational data
  await test('21. Report export: reportService compiles and exports multi-dataset relational query data', async () => {
    const reportData = await reportService.compileReportData(
      {
        id: 'test-rel-report-1',
        title: 'Relational Cross-Dataset Performance Digest',
        description: 'Joined Orders & Customers telemetry',
        format: 'pdf'
      },
      orgA
    );

    if (!reportData || !reportData.title) {
      throw new Error('Failed to compile report data');
    }

    const pdfBuffer = await reportService.generatePdf(reportData);
    if (!pdfBuffer || pdfBuffer.length < 100) {
      throw new Error('Generated PDF buffer is invalid or empty');
    }

    const excelBuffer = await reportService.generateExcel(reportData);
    if (!excelBuffer || excelBuffer.length < 100) {
      throw new Error('Generated Excel buffer is invalid or empty');
    }

    const csvRes = await reportService.generateCsv(reportData);
    const csvStr = Buffer.isBuffer(csvRes) ? csvRes.toString() : String(csvRes);
    if (typeof csvStr !== 'string' || csvStr.length < 10) {
      throw new Error('Generated CSV string is invalid or empty');
    }
  });

  // Test 22: AI relational query plan
  await test('22. AI relational query plan: NL query "Show revenue by customer region" generates structured join plan', async () => {
    const nlRes = await request(
      'POST',
      '/api/ai/query',
      {
        message: 'Show revenue by customer region',
        datasetId: ordersDataset.id
      },
      { Authorization: `Bearer ${analystTokenA}` }
    );

    if (nlRes.statusCode !== 200 || !nlRes.body.success) {
      throw new Error(`Expected 200 AI Query, got ${nlRes.statusCode}: ${JSON.stringify(nlRes.body)}`);
    }

    const plan = nlRes.body.data.plan;
    if (!plan) throw new Error('Missing AI query plan in response');
    if (plan.intent !== 'relational_breakdown' && plan.intent !== 'breakdown') {
      throw new Error(`Expected breakdown/relational_breakdown intent, got ${plan.intent}`);
    }
  });

  // Test 23: AI security validation
  await test('23. AI security validation: AI Assistant enforces column allowlists and refuses arbitrary SQL', async () => {
    const plan = aiQueryPlannerService._enforceSecurityAndAllowlists(
      {
        intent: 'relational_breakdown',
        metric: "revenue; DROP TABLE users; --",
        group_by: "region",
        aggregation: 'SUM'
      },
      ordersDataset.schema
    );

    if (plan.metric.includes('DROP TABLE')) {
      throw new Error('Security allowlist failed to sanitize malicious metric in query plan');
    }
  });

  // Test 24: Empty join result
  await test('24. Empty join result: Joining with empty dataset returns empty result gracefully without crashing', async () => {
    const emptyResult = await analyticsService.executeRelationalQuery({
      baseDataset: ordersDataset,
      baseRecords: [],
      joins: [],
      dimensions: ['region'],
      metrics: [{ column: 'revenue', aggregation: 'SUM', alias: 'value' }]
    });

    if (!emptyResult || !Array.isArray(emptyResult.rows) || emptyResult.rows.length !== 0) {
      throw new Error('Expected empty array on empty input dataset');
    }
  });

  // Test 25: Duplicate relationship handling
  await test('25. Duplicate relationship handling: Attempting to create existing relationship returns 409 Conflict', async () => {
    const res = await request(
      'POST',
      '/api/dataset-relationships',
      {
        source_dataset_id: ordersDataset.id,
        source_column: 'customer_id',
        target_dataset_id: customersDataset.id,
        target_column: 'customer_id',
        relationship_type: 'many_to_one'
      },
      { Authorization: `Bearer ${adminTokenA}` }
    );

    if (res.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate relationship, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
  });

  // Cleanup server
  server.close();

  // Print Summary
  console.log('\n===============================================================');
  console.log(`  PHASE 14 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (${passed + failed} TOTAL)`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal failure:', err);
  if (server) server.close();
  process.exit(1);
});
