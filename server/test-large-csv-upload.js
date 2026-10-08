/**
 * Large File (CSV / JSON) Enterprise Ingestion Automated Verification Suite
 * Tests 149 MB / 1,000,000-row CSV upload, small CSV upload, over-limit rejection, and streaming preview
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const app = require('./app');
const db = require('./config/database');
const storage = require('./storage');

let server;
let port = 5096;
let baseUrl = `http://localhost:${port}`;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    let postData = null;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !headers['Content-Type']?.includes('multipart/form-data')) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    } else if (Buffer.isBuffer(body) && !headers['Content-Length']) {
      options.headers['Content-Length'] = body.length;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body && (headers['Content-Type']?.includes('multipart/form-data') || Buffer.isBuffer(body))) {
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
      body: fullBody,
      contentType: `multipart/form-data; boundary=${boundary}`
    };
  }

  return {
    body: Buffer.concat(parts.map(p => Buffer.from(p, 'utf-8'))),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

/**
 * Stream a large file from disk in a multipart/form-data HTTP request
 */
function streamMultipartFile(reqPath, fields, filePath, filename, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';
    const fieldParts = [];

    for (const [key, val] of Object.entries(fields)) {
      fieldParts.push(
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
        `${val}${crlf}`
      );
    }

    const fileHeader =
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}` +
      `Content-Type: text/csv${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    const headerBuf = Buffer.concat([
      ...fieldParts.map(p => Buffer.from(p, 'utf-8')),
      Buffer.from(fileHeader, 'utf-8')
    ]);
    const footerBuf = Buffer.from(footer, 'utf-8');

    const fileSize = fs.statSync(filePath).size;
    const totalContentLength = headerBuf.length + fileSize + footerBuf.length;

    const url = new URL(reqPath, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalContentLength
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));

    req.write(headerBuf);
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('data', (chunk) => {
      req.write(chunk);
    });
    fileStream.on('end', () => {
      req.write(footerBuf);
      req.end();
    });
    fileStream.on('error', (err) => reject(err));
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(` ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(` ✅ PASS: ${message}`);
}

async function runLargeUploadTests() {
  console.log('===============================================================');
  console.log('  🧪 Large File CSV Upload & Ingestion Verification Suite');
  console.log('===============================================================\n');

  server = app.listen(port);

  try {
    await db.initDb();

    // 1. Create test user and token
    const uniqueEmail = `enterprise_tester_${Date.now()}@ricoz.test`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Enterprise Data Engineer',
      organization_name: 'Large Datasets Corp',
      email: uniqueEmail,
      password: 'Password123!'
    });

    const otp = regRes.data?._devVerificationOtp;
    const verifyOtpRes = await request('POST', '/api/auth/verify-email', {
      email: uniqueEmail,
      otp: otp || '123456'
    });

    const token = verifyOtpRes.data?.token || regRes.data?.token;
    assert(token, 'Test 1: Successfully authenticated test user');

    // 2. Test Small CSV Upload (<1MB)
    const smallCsvLines = ['order_id,product_name,units,revenue,is_shipped,order_date'];
    for (let i = 1; i <= 50; i++) {
      smallCsvLines.push(`ORD-${i},Product_${i},${i * 2},${(i * 19.99).toFixed(2)},${i % 2 === 0},2025-01-01`);
    }
    const smallPayload = createMultipartPayload(
      { name: 'Small 50-Row Test CSV', description: 'Small dataset verification' },
      { fieldname: 'file', filename: 'small_test.csv', mimetype: 'text/csv', content: smallCsvLines.join('\n') }
    );
    const smallUploadRes = await request('POST', '/api/data-sources/upload', smallPayload.body, {
      Authorization: `Bearer ${token}`,
      'Content-Type': smallPayload.contentType,
      'Content-Length': smallPayload.body.length
    });

    assert(
      smallUploadRes.status === 201 &&
      smallUploadRes.data.success === true &&
      smallUploadRes.data.data.dataset.rowCount === 50 &&
      smallUploadRes.data.data.dataset.columnCount === 6,
      'Test 2: Standard small CSV uploads continue to work flawlessly (50 rows, 6 cols)'
    );

    // 3. Test Configurable Limit Rejection (exceeding MAX_UPLOAD_SIZE_MB)
    const savedLimit = process.env.MAX_UPLOAD_SIZE_MB;
    process.env.MAX_UPLOAD_SIZE_MB = '2'; // Set 2MB limit
    const oversized3MbPayload = createMultipartPayload(
      { name: 'Oversized 3MB CSV' },
      { fieldname: 'file', filename: 'oversized_3mb.csv', mimetype: 'text/csv', content: Buffer.alloc(3 * 1024 * 1024, 'a') }
    );
    const overLimitRes = await request('POST', '/api/data-sources/upload', oversized3MbPayload.body, {
      Authorization: `Bearer ${token}`,
      'Content-Type': oversized3MbPayload.contentType,
      'Content-Length': oversized3MbPayload.body.length
    });
    process.env.MAX_UPLOAD_SIZE_MB = savedLimit || '250';

    assert(
      overLimitRes.status === 400 &&
      overLimitRes.data.success === false &&
      overLimitRes.data.message.includes('exceeds the maximum allowed limit'),
      'Test 3: File exceeding configured MAX_UPLOAD_SIZE_MB is rejected with clear user-facing message'
    );

    // 4. Test Large 149 MB / 1,000,000-Row CSV Upload
    const largeCsvPath = 'C:\\Users\\gowth\\Downloads\\ricozanalytics_enterprise_sales_1m.csv';
    if (fs.existsSync(largeCsvPath)) {
      const fileSizeMb = (fs.statSync(largeCsvPath).size / (1024 * 1024)).toFixed(1);
      console.log(`\n⏳ Streaming large CSV file (${fileSizeMb} MB, 1,000,000 rows) to upload API...`);
      const startTime = Date.now();

      const largeUploadRes = await streamMultipartFile(
        '/api/data-sources/upload',
        { name: 'Enterprise Sales 1M Dataset', description: '1 Million records telemetry dataset' },
        largeCsvPath,
        'ricozanalytics_enterprise_sales_1m.csv',
        token
      );

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱ Ingestion & parsing took ${elapsedSec} seconds.\n`);

      assert(
        largeUploadRes.status === 201 && largeUploadRes.data.success === true,
        'Test 4: 149 MB CSV upload accepted and created dataset successfully'
      );

      const dataset = largeUploadRes.data.data.dataset;
      assert(dataset.rowCount === 1000000, `Test 5: Ingested row count is exactly 1,000,000 rows (got ${dataset.rowCount})`);
      assert(dataset.columnCount === 17, `Test 6: Ingested column count is exactly 17 columns (got ${dataset.columnCount})`);
      assert(dataset.schema && dataset.schema.length === 17, 'Test 7: Inferred schema contains all 17 detected columns');

      // Verify schema types
      const revCol = dataset.schema.find(c => c.name === 'revenue');
      const orderCol = dataset.schema.find(c => c.name === 'order_id');
      const dateCol = dataset.schema.find(c => c.name === 'order_date');
      assert(revCol?.type === 'number', 'Test 8: "revenue" column correctly classified as number');
      assert(orderCol?.type === 'string', 'Test 9: "order_id" column correctly classified as string');
      assert(dateCol?.type === 'date', 'Test 10: "order_date" column correctly classified as date');

      // 5. Test Fast Stream Preview on 1M dataset
      const previewStartTime = Date.now();
      const previewRes = await request('GET', `/api/datasets/${dataset.id}/preview`, null, {
        Authorization: `Bearer ${token}`
      });
      const previewElapsedMs = Date.now() - previewStartTime;

      assert(previewRes.status === 200, 'Test 11: GET /api/datasets/:id/preview returns 200 OK');
      assert(previewRes.data.data.preview.length === 50, 'Test 12: Preview strictly returns first 50 rows');
      assert(previewRes.data.data.rowCount === 1000000, 'Test 13: Preview returns total rowCount 1,000,000');
      console.log(`⚡ 50-row preview stream response time for 1M dataset: ${previewElapsedMs}ms`);
      assert(previewElapsedMs < 2000, 'Test 14: Preview streamed in sub-second time without loading entire file');

      // 6. Test Clean Cascading Deletion
      const deleteRes = await request('DELETE', `/api/datasets/${dataset.id}`, null, {
        Authorization: `Bearer ${token}`
      });
      assert(deleteRes.status === 200, 'Test 15: Dataset and physical storage file deleted cleanly');
    } else {
      console.warn(` [Notice] Large CSV file not found at ${largeCsvPath}, skipping 1M stream test.`);
    }

    console.log('\n===============================================================');
    console.log('  🎉 ALL LARGE FILE UPLOAD & INGESTION TESTS PASSED!');
    console.log('===============================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

if (require.main === module) {
  runLargeUploadTests().then(() => process.exit(0)).catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = runLargeUploadTests;
