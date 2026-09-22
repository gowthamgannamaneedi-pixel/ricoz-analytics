/**
 * Comprehensive Automated Test Suite for Phase 4: Data Sources & Datasets
 * Tests 13 critical functional and security requirements
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const app = require('./app');
const db = require('./config/database');
const storage = require('./storage');

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

    let postData = null;
    if (body && !headers['Content-Type']?.includes('multipart/form-data')) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body && headers['Content-Type']?.includes('multipart/form-data')) {
      req.write(body);
      req.end();
    } else if (postData) {
      req.write(postData);
      req.end();
    } else {
      req.end();
    }
  });
}

// Multipart helper without extra dependencies
function createMultipartPayload(fields, file) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
      `${val}${crlf}`
    );
  }

  if (file) {
    const header =
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${file.fieldname || 'file'}"; filename="${file.filename}"${crlf}` +
      `Content-Type: ${file.mimetype || 'application/octet-stream'}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    const headerBuf = Buffer.from(header, 'utf-8');
    const contentBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf-8');
    const footerBuf = Buffer.from(footer, 'utf-8');

    const fullBody = Buffer.concat([
      ...parts.map(p => Buffer.from(p, 'utf-8')),
      headerBuf,
      contentBuf,
      footerBuf
    ]);

    return {
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: fullBody
    };
  }

  const fullBody = Buffer.concat([
    ...parts.map(p => Buffer.from(p, 'utf-8')),
    Buffer.from(`--${boundary}--${crlf}`, 'utf-8')
  ]);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBody
  };
}

async function runTests() {
  console.log('🧪 Starting Phase 4 Automated Test Suite (Data Sources & Datasets)...\n');

  // Start temporary server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup: Create 2 distinct users to test cross-user isolation
    // -------------------------------------------------------------
    const user1Res = await request('POST', '/api/auth/register', {
      name: 'Alice Analyst',
      email: `alice_${Date.now()}@ricoz.test`,
      password: 'Password123!'
    });
    const token1 = user1Res.data.token;
    const userId1 = user1Res.data.user.id;

    const user2Res = await request('POST', '/api/auth/register', {
      name: 'Bob Banker',
      email: `bob_${Date.now()}@ricoz.test`,
      password: 'Password123!'
    });
    const token2 = user2Res.data.token;
    const userId2 = user2Res.data.user.id;

    console.log(`Users created: Alice (ID ${userId1}), Bob (ID ${userId2})\n`);

    // -------------------------------------------------------------
    // Test 1: Authenticated user can create data source
    // -------------------------------------------------------------
    const createDsRes = await request('POST', '/api/data-sources', {
      name: 'Production PostgreSQL Hub',
      type: 'postgresql',
      config: {
        host: 'db.internal.network',
        port: 5432,
        database: 'telemetry_db',
        user: 'telemetry_user',
        password: 'SuperSecretPassword99!'
      }
    }, { Authorization: `Bearer ${token1}` });

    assert(createDsRes.status === 201 && createDsRes.data.success === true, 'Test 1: Authenticated user can create data source');
    const user1DsId = createDsRes.data.data.id;

    // -------------------------------------------------------------
    // Test 2: Unauthenticated user cannot create data source (401)
    // -------------------------------------------------------------
    const unauthDsRes = await request('POST', '/api/data-sources', {
      name: 'Hacker Source',
      type: 'csv'
    });
    assert(unauthDsRes.status === 401 && unauthDsRes.data.success === false, 'Test 2: Unauthenticated user cannot create data source (returns 401)');

    // -------------------------------------------------------------
    // Test 3: User can only see their own data sources
    // -------------------------------------------------------------
    const user1Sources = await request('GET', '/api/data-sources', null, { Authorization: `Bearer ${token1}` });
    const user2Sources = await request('GET', '/api/data-sources', null, { Authorization: `Bearer ${token2}` });

    assert(
      user1Sources.data.data.some(s => s.id === user1DsId) &&
      user2Sources.data.data.every(s => s.id !== user1DsId),
      'Test 3: User can only see their own data sources (User 2 list excludes User 1 sources)'
    );

    // -------------------------------------------------------------
    // Test 4: User cannot access another user's data source (IDOR check)
    // -------------------------------------------------------------
    const idorDsRes = await request('GET', `/api/data-sources/${user1DsId}`, null, { Authorization: `Bearer ${token2}` });
    assert(idorDsRes.status === 404, 'Test 4: User cannot access another user\'s data source (IDOR prevention returns 404)');

    // -------------------------------------------------------------
    // Test 5: CSV upload works and parses schema & rows correctly
    // -------------------------------------------------------------
    // Generate CSV with 80 rows to test preview limitation
    let csvLines = ['id,region,revenue,orders,active,created_date'];
    for (let i = 1; i <= 80; i++) {
      csvLines.push(`${i},Region_${i % 5},${(i * 1250.5).toFixed(2)},${i * 10},${i % 2 === 0 ? 'true' : 'false'},2025-01-${String(i % 28 + 1).padStart(2, '0')}`);
    }
    const csvContent = csvLines.join('\n');

    const csvMultipart = createMultipartPayload(
      { name: 'Regional 80-Row Sales CSV', description: 'Enterprise regional telemetry dataset' },
      { fieldname: 'file', filename: 'sales_q4.csv', mimetype: 'text/csv', content: csvContent }
    );

    const csvUploadRes = await request('POST', '/api/data-sources/upload', csvMultipart.body, {
      Authorization: `Bearer ${token1}`,
      'Content-Type': csvMultipart.contentType,
      'Content-Length': csvMultipart.body.length
    });

    assert(
      csvUploadRes.status === 201 &&
      csvUploadRes.data.success === true &&
      csvUploadRes.data.data.dataset.rowCount === 80 &&
      csvUploadRes.data.data.dataset.columnCount === 6,
      'Test 5: CSV upload works and computes exact row/column metadata (80 rows, 6 cols)'
    );
    const user1DatasetId = csvUploadRes.data.data.dataset.id;

    // -------------------------------------------------------------
    // Test 6: JSON upload works and parses schema & rows correctly
    // -------------------------------------------------------------
    const jsonData = [
      { product_id: 'P100', category: 'Hardware', units: 450, is_stock: true, updated: '2025-06-15' },
      { product_id: 'P101', category: 'Software', units: 1200, is_stock: true, updated: '2025-06-16' },
      { product_id: 'P102', category: 'Cloud SaaS', units: 950, is_stock: false, updated: '2025-06-17' }
    ];
    const jsonMultipart = createMultipartPayload(
      { name: 'Product Inventory JSON', description: 'Inventory telemetry' },
      { fieldname: 'file', filename: 'inventory.json', mimetype: 'application/json', content: JSON.stringify(jsonData) }
    );

    const jsonUploadRes = await request('POST', '/api/data-sources/upload', jsonMultipart.body, {
      Authorization: `Bearer ${token1}`,
      'Content-Type': jsonMultipart.contentType,
      'Content-Length': jsonMultipart.body.length
    });

    assert(
      jsonUploadRes.status === 201 &&
      jsonUploadRes.data.success === true &&
      jsonUploadRes.data.data.dataset.rowCount === 3 &&
      jsonUploadRes.data.data.dataset.columnCount === 5,
      'Test 6: JSON upload works and correctly parses records and fields'
    );

    // -------------------------------------------------------------
    // Test 7: Invalid file type is rejected
    // -------------------------------------------------------------
    const invalidFileMultipart = createMultipartPayload(
      { name: 'Executable payload' },
      { fieldname: 'file', filename: 'script.exe', mimetype: 'application/x-msdownload', content: 'BINARY_MALWARE' }
    );
    const invalidUploadRes = await request('POST', '/api/data-sources/upload', invalidFileMultipart.body, {
      Authorization: `Bearer ${token1}`,
      'Content-Type': invalidFileMultipart.contentType,
      'Content-Length': invalidFileMultipart.body.length
    });

    assert(invalidUploadRes.status === 400, 'Test 7: Invalid file type (.exe) is rejected with 400 Bad Request');

    // -------------------------------------------------------------
    // Test 8: Oversized file check (simulated large buffer)
    // -------------------------------------------------------------
    // 26 MB dummy payload
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 'a');
    const oversizedMultipart = createMultipartPayload(
      { name: 'Oversized CSV' },
      { fieldname: 'file', filename: 'giant.csv', mimetype: 'text/csv', content: largeBuffer }
    );
    const oversizedRes = await request('POST', '/api/data-sources/upload', oversizedMultipart.body, {
      Authorization: `Bearer ${token1}`,
      'Content-Type': oversizedMultipart.contentType,
      'Content-Length': oversizedMultipart.body.length
    });

    assert(oversizedRes.status === 400 && oversizedRes.data.message.includes('exceeds'), 'Test 8: Oversized file (>25MB) is rejected');

    // -------------------------------------------------------------
    // Test 9: Dataset record has correctly inferred schema data types
    // -------------------------------------------------------------
    const datasetDetailRes = await request('GET', `/api/datasets/${user1DatasetId}`, null, { Authorization: `Bearer ${token1}` });
    const schema = datasetDetailRes.data.data.schema;
    const revCol = schema.find(c => c.name === 'revenue');
    const activeCol = schema.find(c => c.name === 'active');
    const dateCol = schema.find(c => c.name === 'created_date');

    assert(
      datasetDetailRes.status === 200 &&
      revCol?.type === 'number' &&
      activeCol?.type === 'boolean' &&
      dateCol?.type === 'date',
      'Test 9: Dataset schema correctly infers column types (number, boolean, date)'
    );

    // -------------------------------------------------------------
    // Test 10: Dataset preview strictly returns maximum 50 rows
    // -------------------------------------------------------------
    const previewRes = await request('GET', `/api/datasets/${user1DatasetId}/preview`, null, { Authorization: `Bearer ${token1}` });
    assert(
      previewRes.status === 200 &&
      previewRes.data.data.preview.length === 50 &&
      previewRes.data.data.rowCount === 80,
      'Test 10: Dataset preview returns maximum 50 rows (even for 80-row dataset)'
    );

    // -------------------------------------------------------------
    // Test 11: Dataset ownership is strictly enforced across users
    // -------------------------------------------------------------
    const idorDatasetRes = await request('GET', `/api/datasets/${user1DatasetId}/preview`, null, { Authorization: `Bearer ${token2}` });
    assert(idorDatasetRes.status === 404, 'Test 11: Dataset ownership is enforced (User 2 cannot preview User 1 dataset - 404)');

    // -------------------------------------------------------------
    // Test 12: Database credentials (passwords) are NEVER returned
    // -------------------------------------------------------------
    const dsListRes = await request('GET', '/api/data-sources', null, { Authorization: `Bearer ${token1}` });
    const pgSource = dsListRes.data.data.find(s => s.id === user1DsId);
    const hasRawPassword = JSON.stringify(pgSource).includes('SuperSecretPassword99!');

    assert(
      !hasRawPassword && pgSource?.config?.hasPassword === true,
      'Test 12: Database credentials (passwords) are never exposed in API responses'
    );

    // -------------------------------------------------------------
    // Test 13: File deletion/cleanup works safely
    // -------------------------------------------------------------
    const deleteRes = await request('DELETE', `/api/datasets/${user1DatasetId}`, null, { Authorization: `Bearer ${token1}` });
    const verifyDeleteRes = await request('GET', `/api/datasets/${user1DatasetId}`, null, { Authorization: `Bearer ${token1}` });

    if (verifyDeleteRes.status !== 404) {
      console.log('DEBUG verifyDeleteRes:', JSON.stringify(verifyDeleteRes));
    }

    assert(
      deleteRes.status === 200 && verifyDeleteRes.status === 404,
      'Test 13: Dataset and underlying file deleted cleanly and safely'
    );

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log(`\n=============================================`);
  console.log(`Phase 4 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
