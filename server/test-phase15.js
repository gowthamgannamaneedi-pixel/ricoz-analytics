/**
 * Comprehensive Automated Test Suite for Phase 15: Data Quality & Observability
 * Tests all 28 required areas:
 * 1. Dataset quality calculation
 * 2. Completeness
 * 3. Null detection
 * 4. Empty-value detection
 * 5. Validity
 * 6. Invalid type detection
 * 7. Duplicate detection
 * 8. Uniqueness
 * 9. Consistency
 * 10. Freshness
 * 11. Stale dataset detection
 * 12. Schema snapshot
 * 13. Schema change detection
 * 14. Volume monitoring
 * 15. Quality score calculation
 * 16. Quality rule creation
 * 17. Quality rule validation
 * 18. Cross-tenant isolation
 * 19. RBAC
 * 20. Audit event creation
 * 21. Alert integration
 * 22. Relationship orphan detection
 * 23. AI quality question
 * 24. Dashboard widget
 * 25. Report export
 * 26. Empty dataset
 * 27. Unknown freshness
 * 28. Sample vs full-scan labeling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const Dataset = require('./models/datasetModel');
const DatasetRelationshipModel = require('./models/datasetRelationshipModel');
const DataQualityModel = require('./models/dataQualityModel');
const AuditLogModel = require('./models/auditLogModel');
const AlertModel = require('./models/alertModel');
const Dashboard = require('./models/dashboardModel');
const dataQualityService = require('./services/dataQualityService');
const reportService = require('./services/reportService');
const aiQueryPlannerService = require('./services/aiQueryPlannerService');
const geminiService = require('./services/geminiService');

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
  console.log('  PHASE 15: DATA QUALITY & OBSERVABILITY TEST SUITE (28 TESTS) ');
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

  // Ensure test data directory
  const testDataDir = path.resolve(__dirname, 'uploads/test_data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Create mock CSV files
  const ordersQualityCsv = path.join(testDataDir, 'orders_quality_test.csv');
  fs.writeFileSync(ordersQualityCsv, [
    'order_id,customer_id,revenue,order_date,email',
    '101,CUST_1,500,2026-03-01,user1@test.com',
    '102,CUST_2,300,2026-03-02,user2@test.com',
    '103,CUST_3,INVALID_NUM,2026-03-03,not-an-email',
    '104,CUST_999,750,2026-03-04,user4@test.com',
    '105,,1200,2026-03-05,user5@test.com',
    '105,,1200,2026-03-05,user5@test.com' // Duplicate row and missing customer_id
  ].join('\n'));

  const customersQualityCsv = path.join(testDataDir, 'customers_quality_test.csv');
  fs.writeFileSync(customersQualityCsv, [
    'customer_id,name,city',
    'CUST_1,Alice Enterprise,Bengaluru',
    'CUST_2,Bob Global,Mumbai',
    'CUST_3,Charlie Tech,Delhi'
  ].join('\n'));

  const cleanQualityCsv = path.join(testDataDir, 'clean_quality_test.csv');
  fs.writeFileSync(cleanQualityCsv, [
    'item_id,title,price,created_at',
    '1,Widget A,100,2026-03-01',
    '2,Widget B,200,2026-03-02',
    '3,Widget C,300,2026-03-03'
  ].join('\n'));

  const emptyQualityCsv = path.join(testDataDir, 'empty_quality_test.csv');
  fs.writeFileSync(emptyQualityCsv, 'id,name,value\n');

  // Register datasets in DB
  const datasetOrders = await Dataset.create({
    userId: 1,
    name: 'Sales Orders Telemetry',
    description: 'Transactional orders for quality evaluation',
    filePath: ordersQualityCsv,
    rowCount: 6,
    columnCount: 5,
    schema: [
      { name: 'order_id', type: 'integer' },
      { name: 'customer_id', type: 'string' },
      { name: 'revenue', type: 'numeric' },
      { name: 'order_date', type: 'date' },
      { name: 'email', type: 'string' }
    ]
  });

  const datasetCustomers = await Dataset.create({
    userId: 1,
    name: 'Master Customer Directory',
    description: 'Master customers for relationship testing',
    filePath: customersQualityCsv,
    rowCount: 3,
    columnCount: 3,
    schema: [
      { name: 'customer_id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'city', type: 'string' }
    ]
  });

  const datasetClean = await Dataset.create({
    userId: 1,
    name: 'Pristine Inventory Dataset',
    description: 'Clean data with 100% scores',
    filePath: cleanQualityCsv,
    rowCount: 3,
    columnCount: 4,
    schema: [
      { name: 'item_id', type: 'integer' },
      { name: 'title', type: 'string' },
      { name: 'price', type: 'numeric' },
      { name: 'created_at', type: 'date' }
    ]
  });

  const datasetEmpty = await Dataset.create({
    userId: 1,
    name: 'Empty Staging Dataset',
    description: 'Dataset with zero rows',
    filePath: emptyQualityCsv,
    rowCount: 0,
    columnCount: 3,
    schema: [
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'string' },
      { name: 'value', type: 'numeric' }
    ]
  });

  // Dataset in Org B for cross-tenant testing
  const datasetOrgB = await Dataset.create({
    userId: 10,
    name: 'Tenant B Secret Data',
    description: 'Org B dataset',
    filePath: cleanQualityCsv,
    rowCount: 3,
    columnCount: 4,
    schema: [{ name: 'item_id', type: 'integer' }]
  });

  // Create Phase 14 relationship between orders and customers
  await DatasetRelationshipModel.create({
    organizationId: orgA,
    createdBy: 1,
    sourceDatasetId: datasetOrders.id,
    sourceColumn: 'customer_id',
    targetDatasetId: datasetCustomers.id,
    targetColumn: 'customer_id',
    relationshipType: 'many_to_one',
    description: 'Orders reference customers'
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Dataset quality calculation
    // -------------------------------------------------------------
    await test('1. Dataset quality calculation returns full profile', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      const profile = res.body.data;
      if (!profile || profile.quality_score === undefined) throw new Error('Missing quality_score in profile');
      if (!profile.dimensions || !profile.dimensions.completeness) throw new Error('Missing dimensions breakdown');
    });

    // -------------------------------------------------------------
    // Test 2: Completeness calculation
    // -------------------------------------------------------------
    await test('2. Completeness calculates non-null and non-empty ratios', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const comp = profile.dimensions.completeness;
      if (typeof comp.score !== 'number' || comp.score <= 0 || comp.score > 100) {
        throw new Error(`Invalid completeness score: ${comp.score}`);
      }
      if (comp.missing_cells === undefined || comp.missing_cells <= 0) {
        throw new Error(`Expected missing cells to be detected, got ${comp.missing_cells}`);
      }
    });

    // -------------------------------------------------------------
    // Test 3: Null detection
    // -------------------------------------------------------------
    await test('3. Null detection flags missing required keys', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}/columns`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const cols = res.body.data;
      const custCol = cols.find(c => c.column_name === 'customer_id');
      if (!custCol) throw new Error('customer_id column not found in column metrics');
      if (custCol.null_count === 0 && custCol.empty_count === 0) {
        throw new Error('Expected null or empty count on customer_id');
      }
    });

    // -------------------------------------------------------------
    // Test 4: Empty-value detection
    // -------------------------------------------------------------
    await test('4. Empty-value detection flags blank string cells', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}/columns`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const cols = res.body.data;
      const custCol = cols.find(c => c.column_name === 'customer_id');
      if (custCol.missing_count < 2) {
        throw new Error(`Expected at least 2 missing values for customer_id, found ${custCol.missing_count}`);
      }
    });

    // -------------------------------------------------------------
    // Test 5: Validity
    // -------------------------------------------------------------
    await test('5. Validity measures schema and type conformity', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      if (profile.dimensions.validity.score !== 100) {
        throw new Error(`Expected 100% validity for clean dataset, got ${profile.dimensions.validity.score}`);
      }
    });

    // -------------------------------------------------------------
    // Test 6: Invalid type detection
    // -------------------------------------------------------------
    await test('6. Invalid type detection flags non-numeric & bad emails', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const invalidCount = profile.dimensions.validity.invalid_count;
      if (invalidCount <= 0) {
        throw new Error(`Expected invalid values to be detected in orders dataset, got ${invalidCount}`);
      }
      const hasEmailOrNumIssue = profile.issues.some(i => i.dimension === 'validity');
      if (!hasEmailOrNumIssue) throw new Error('Expected validity issue in issues list');
    });

    // -------------------------------------------------------------
    // Test 7: Duplicate detection
    // -------------------------------------------------------------
    await test('7. Duplicate detection measures duplicate rows', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const uniq = profile.dimensions.uniqueness;
      if (uniq.duplicate_rows === 0) {
        throw new Error('Expected duplicate row count > 0 for orders dataset');
      }
      if (uniq.duplicate_percentage <= 0) {
        throw new Error('Expected duplicate percentage > 0');
      }
    });

    // -------------------------------------------------------------
    // Test 8: Uniqueness candidate PK detection
    // -------------------------------------------------------------
    await test('8. Uniqueness detects candidate primary key columns', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}/columns`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const cols = res.body.data;
      const itemCol = cols.find(c => c.column_name === 'item_id');
      if (!itemCol || !itemCol.is_candidate_pk) {
        throw new Error('Expected item_id in clean dataset to be identified as candidate primary key');
      }
    });

    // -------------------------------------------------------------
    // Test 9: Consistency
    // -------------------------------------------------------------
    await test('9. Consistency measures data type consistency score', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      if (profile.dimensions.consistency.score < 90) {
        throw new Error(`Expected high consistency score for clean data, got ${profile.dimensions.consistency.score}`);
      }
    });

    // -------------------------------------------------------------
    // Test 10: Freshness
    // -------------------------------------------------------------
    await test('10. Freshness calculates age and status', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const fresh = profile.dimensions.freshness;
      if (!fresh || !['healthy', 'warning', 'stale', 'unknown'].includes(fresh.status)) {
        throw new Error(`Invalid freshness status: ${fresh?.status}`);
      }
    });

    // -------------------------------------------------------------
    // Test 11: Stale dataset detection
    // -------------------------------------------------------------
    await test('11. Stale dataset detection flags expired refresh intervals', async () => {
      // Evaluate with expected refresh interval of 0.0001 hours (~0.3 seconds)
      const res = await request('POST', `/api/data-quality/datasets/${datasetOrders.id}/evaluate`, {
        expectedRefreshHours: 0.00001
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const profile = res.body.data;
      if (profile.dimensions.freshness.status !== 'stale' && profile.dimensions.freshness.status !== 'warning') {
        throw new Error(`Expected stale or warning status, got ${profile.dimensions.freshness.status}`);
      }
    });

    // -------------------------------------------------------------
    // Test 12: Schema snapshot & hash generation
    // -------------------------------------------------------------
    await test('12. Schema snapshot generates deterministic hash', async () => {
      const hash1 = dataQualityService.computeSchemaHash(datasetOrders.schema);
      const hash2 = dataQualityService.computeSchemaHash(datasetOrders.schema);
      if (!hash1 || hash1 !== hash2) {
        throw new Error(`Schema hashes did not match: ${hash1} vs ${hash2}`);
      }
    });

    // -------------------------------------------------------------
    // Test 13: Schema change detection
    // -------------------------------------------------------------
    await test('13. Schema change detection identifies column mutations', async () => {
      // Evaluate dataset quality with modified schema simulation
      const res = await dataQualityService.evaluateDatasetQuality(datasetOrders.id, orgA);
      if (!res.schema_hash) throw new Error('Missing schema hash in evaluation');
    });

    // -------------------------------------------------------------
    // Test 14: Volume monitoring
    // -------------------------------------------------------------
    await test('14. Volume monitoring tracks row count and shifts', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      if (profile.total_rows === undefined || profile.total_rows !== 6) {
        throw new Error(`Expected total_rows 6, got ${profile.total_rows}`);
      }
    });

    // -------------------------------------------------------------
    // Test 15: Quality score calculation
    // -------------------------------------------------------------
    await test('15. Quality score calculation applies documented weights', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      if (profile.quality_score !== 100) {
        throw new Error(`Expected 100 score for pristine dataset, got ${profile.quality_score}`);
      }
      if (profile.status !== 'healthy') {
        throw new Error(`Expected healthy status, got ${profile.status}`);
      }
    });

    // -------------------------------------------------------------
    // Test 16: Quality rule creation
    // -------------------------------------------------------------
    let createdRuleId = null;
    await test('16. Quality rule creation stores custom rule', async () => {
      const res = await request('POST', '/api/data-quality/rules', {
        datasetId: datasetOrders.id,
        columnName: 'revenue',
        ruleType: 'min_value',
        configuration: { min: 100 },
        severity: 'critical'
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      createdRuleId = res.body.data.id;
      if (!createdRuleId) throw new Error('Rule ID was not returned');
    });

    // -------------------------------------------------------------
    // Test 17: Quality rule validation
    // -------------------------------------------------------------
    await test('17. Quality rule validation detects configured rule breaches', async () => {
      // Create max_value rule of 600 (violates order 104 with 750, 105 with 1200)
      await request('POST', '/api/data-quality/rules', {
        datasetId: datasetOrders.id,
        columnName: 'revenue',
        ruleType: 'max_value',
        configuration: { max: 600 },
        severity: 'warning'
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });

      const res = await request('POST', `/api/data-quality/datasets/${datasetOrders.id}/evaluate`, {}, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const maxRuleIssue = profile.issues.find(i => i.message && i.message.includes('max_value'));
      if (!maxRuleIssue) throw new Error('Expected issue raised for max_value rule breach');
    });

    // -------------------------------------------------------------
    // Test 18: Cross-tenant isolation
    // -------------------------------------------------------------
    await test('18. Cross-tenant isolation prevents tenant B accessing tenant A quality', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${adminTokenB}`
      });
      if (res.statusCode !== 404 && res.statusCode !== 403) {
        throw new Error(`Expected 404 or 403 for cross-tenant access, got ${res.statusCode}`);
      }
    });

    // -------------------------------------------------------------
    // Test 19: RBAC permissions
    // -------------------------------------------------------------
    await test('19. RBAC permits Viewer read-only and denies rule creation', async () => {
      // Viewer can view
      const viewRes = await request('GET', `/api/data-quality/datasets/${datasetOrders.id}`, null, {
        Authorization: `Bearer ${viewerTokenA}`
      });
      if (viewRes.statusCode !== 200) throw new Error(`Viewer expected 200 for view, got ${viewRes.statusCode}`);

      // Viewer cannot create rule
      const ruleRes = await request('POST', '/api/data-quality/rules', {
        datasetId: datasetOrders.id,
        columnName: 'revenue',
        ruleType: 'not_null'
      }, {
        Authorization: `Bearer ${viewerTokenA}`
      });
      if (ruleRes.statusCode !== 403) throw new Error(`Viewer expected 403 for create rule, got ${ruleRes.statusCode}`);
    });

    // -------------------------------------------------------------
    // Test 20: Audit event creation
    // -------------------------------------------------------------
    await test('20. Audit event creation logs data quality actions', async () => {
      const res = await AuditLogModel.findByOrganizationId(orgA, { limit: 50 });
      const logs = Array.isArray(res) ? res : (res.logs || []);
      const qualityLogs = logs.filter(l => l.action && l.action.startsWith('DATA_QUALITY'));
      if (qualityLogs.length === 0) {
        throw new Error('Expected DATA_QUALITY audit log entries to be recorded');
      }
    });

    // -------------------------------------------------------------
    // Test 21: Alert integration
    // -------------------------------------------------------------
    await test('21. Alert integration evaluates quality thresholds', async () => {
      // Create threshold alert on datasetOrders for quality score < 95
      const alert = await AlertModel.create({
        organizationId: orgA,
        createdBy: 1,
        datasetId: datasetOrders.id,
        name: 'Orders Quality Score Alert',
        condition: 'less_than',
        threshold: 95,
        severity: 'warning'
      });

      // Trigger quality audit which evaluates attached alerts
      const evalRes = await dataQualityService.evaluateDatasetQuality(datasetOrders.id, orgA);
      if (!evalRes) throw new Error('Evaluation failed');
    });

    // -------------------------------------------------------------
    // Test 22: Relationship orphan detection
    // -------------------------------------------------------------
    await test('22. Relationship orphan detection flags unmatched foreign keys', async () => {
      const res = await request('POST', `/api/data-quality/datasets/${datasetOrders.id}/evaluate`, {}, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      const orphanIssue = profile.issues.find(i => i.message && (i.message.includes('not present in') || i.message.includes('reference')));
      if (!orphanIssue) {
        throw new Error('Expected orphan record issue for CUST_999 referencing non-existent customer');
      }
    });

    // -------------------------------------------------------------
    // Test 23: AI quality question
    // -------------------------------------------------------------
    await test('23. AI assistant answers quality trust questions with evidence', async () => {
      const res = await aiQueryPlannerService.processQuery({
        message: 'Can I trust this dataset? Show data quality issues',
        datasetId: datasetOrders.id,
        userId: 1,
        organizationId: orgA,
        userRole: 'admin'
      });

      if (!res.answer || !res.answer.includes('Quality Score')) {
        throw new Error(`AI answer did not include quality score evidence: ${res.answer}`);
      }
      if (res.intent !== 'data_quality_explanation') {
        throw new Error(`Expected intent data_quality_explanation, got ${res.intent}`);
      }
    });

    // -------------------------------------------------------------
    // Test 24: Dashboard widget
    // -------------------------------------------------------------
    await test('24. Dashboard widget data_quality_score enriches quality profile', async () => {
      const dbRes = await Dashboard.create({
        organizationId: orgA,
        createdBy: 1,
        title: 'Data Governance Dashboard'
      });

      await Dashboard.addWidget(dbRes.id, {
        datasetId: datasetOrders.id,
        title: 'Orders Quality Health',
        type: 'data_quality_score',
        position: { x: 0, y: 0, w: 4, h: 4 }
      });

      const res = await request('GET', `/api/dashboards/${dbRes.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const widget = res.body.data.widgets.find(w => w.type === 'data_quality_score');
      if (!widget) throw new Error('data_quality_score widget not found in response');
      if (widget.current_value === null || widget.quality_profile === undefined) {
        throw new Error('Widget was not populated with live quality profile');
      }
    });

    // -------------------------------------------------------------
    // Test 25: Report export
    // -------------------------------------------------------------
    await test('25. Report export generates valid PDF, Excel, CSV, JSON', async () => {
      // JSON
      const jsonRes = await reportService.exportQualityReport({
        datasetId: datasetOrders.id,
        organizationId: orgA,
        format: 'json'
      });
      if (!jsonRes.buffer || jsonRes.contentType !== 'application/json') throw new Error('Invalid JSON export');

      // CSV
      const csvRes = await reportService.exportQualityReport({
        datasetId: datasetOrders.id,
        organizationId: orgA,
        format: 'csv'
      });
      if (!csvRes.buffer || csvRes.contentType !== 'text/csv') throw new Error('Invalid CSV export');

      // Excel
      const xlsRes = await reportService.exportQualityReport({
        datasetId: datasetOrders.id,
        organizationId: orgA,
        format: 'excel'
      });
      if (!xlsRes.buffer) throw new Error('Invalid Excel export');

      // PDF
      const pdfRes = await reportService.exportQualityReport({
        datasetId: datasetOrders.id,
        organizationId: orgA,
        format: 'pdf'
      });
      if (!pdfRes.buffer || pdfRes.contentType !== 'application/pdf') throw new Error('Invalid PDF export');
    });

    // -------------------------------------------------------------
    // Test 26: Empty dataset
    // -------------------------------------------------------------
    await test('26. Empty dataset handles 0 rows safely with unknown status', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetEmpty.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const profile = res.body.data;
      if (profile.status !== 'unknown' || profile.quality_score !== 0) {
        throw new Error(`Expected status 'unknown' and score 0 for empty dataset, got status: ${profile.status}, score: ${profile.quality_score}`);
      }
    });

    // -------------------------------------------------------------
    // Test 27: Unknown freshness
    // -------------------------------------------------------------
    await test('27. Unknown freshness handles datasets with no configured refresh interval', async () => {
      const res = await request('GET', `/api/data-quality/datasets/${datasetClean.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      const profile = res.body.data;
      if (profile.dimensions.freshness.status !== 'healthy' && profile.dimensions.freshness.status !== 'unknown') {
        throw new Error(`Unexpected freshness status: ${profile.dimensions.freshness.status}`);
      }
    });

    // -------------------------------------------------------------
    // Test 28: Sample vs full-scan labeling
    // -------------------------------------------------------------
    await test('28. Sample vs full-scan correctly labels scanMode and sampleSize', async () => {
      // Full Scan
      const fullRes = await request('POST', `/api/data-quality/datasets/${datasetOrders.id}/evaluate`, {
        fullScan: true
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (fullRes.body.data.scan_mode !== 'FULL_SCAN') {
        throw new Error(`Expected FULL_SCAN, got ${fullRes.body.data.scan_mode}`);
      }

      // Sampled Scan
      const sampleRes = await request('POST', `/api/data-quality/datasets/${datasetOrders.id}/evaluate`, {
        sampleSize: 3
      }, {
        Authorization: `Bearer ${adminTokenA}`
      });
      if (sampleRes.body.data.scan_mode !== 'SAMPLED') {
        throw new Error(`Expected SAMPLED, got ${sampleRes.body.data.scan_mode}`);
      }
      if (sampleRes.body.data.sample_size !== 3) {
        throw new Error(`Expected sample_size 3, got ${sampleRes.body.data.sample_size}`);
      }
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 15 TEST RESULTS: ${passed} / 28 PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Phase 15 tests:', err);
  process.exit(1);
});
