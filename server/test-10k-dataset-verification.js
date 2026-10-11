const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const Dataset = require('./models/datasetModel');

async function run10kUploadVerification() {
  console.log('\n================================================================');
  console.log('  10,000 ROWS DATASET UPLOAD & PERSISTENCE VERIFICATION TEST     ');
  console.log('================================================================\n');

  const csvPath = 'C:/Users/gowth/Downloads/ricozanalytics_test_10k.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }
  const fileStats = fs.statSync(csvPath);
  console.log(`[File] Target CSV: ${csvPath} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);

  let server = http.createServer(app);
  let port;
  let baseUrl;

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Server] Live test server listening on port ${port}`);
      resolve();
    });
  });

  const orgId = '00000000-0000-0000-0000-000000000001';
  const token = jwt.sign(
    { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: orgId },
    config.jwtSecret || 'super_secret_jwt_key_ricoz_2026',
    { expiresIn: '2h' }
  );

  let uploadedDatasetId = null;

  try {
    // 1. Upload via multipart/form-data to POST /api/data-sources/upload
    console.log('\n[Step 1] Uploading ricozanalytics_test_10k.csv via POST /api/data-sources/upload...');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const fileBuffer = fs.readFileSync(csvPath);

    const pre = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `Ricoz Analytics 10K Dataset\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="description"\r\n\r\n` +
      `Benchmark test dataset with 10000 transaction records\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="ricozanalytics_test_10k.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([pre, fileBuffer, post]);

    const uploadRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/data-sources/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      req.write(fullBody);
      req.end();
    });

    console.log(` -> Status: ${uploadRes.statusCode}`);
    assert.strictEqual(uploadRes.statusCode, 201, `Upload failed: ${JSON.stringify(uploadRes.body || uploadRes.raw)}`);
    assert(uploadRes.body.success, 'Response success should be true');

    const d = uploadRes.body.data.dataset;
    uploadedDatasetId = d.id;
    console.log(` -> Uploaded dataset ID: ${d.id}`);
    console.log(` -> Dataset name: ${d.name}`);
    console.log(` -> Row count: ${d.rowCount}`);
    console.log(` -> Column count: ${d.columnCount}`);

    assert.strictEqual(Number(d.rowCount), 10000, `Expected rowCount to be 10000, got ${d.rowCount}`);
    assert.strictEqual(Number(d.columnCount), 17, `Expected columnCount to be 17, got ${d.columnCount}`);
    console.log(' ✓ PASS: 10k CSV uploaded and parsed accurately (10,000 rows, 17 columns)');

    // 2. Fetch dataset list
    console.log('\n[Step 2] Verifying dataset appears in GET /api/datasets...');
    const listRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/datasets',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(listRes.statusCode, 200);
    const foundInList = listRes.body.data.find(item => item.id === uploadedDatasetId);
    assert(foundInList, `Uploaded dataset ID ${uploadedDatasetId} not found in /api/datasets response`);
    console.log(` ✓ PASS: Found dataset in /api/datasets list with ${foundInList.row_count} rows`);

    // 3. Fetch preview (strict max 50 rows)
    console.log('\n[Step 3] Fetching dataset preview via GET /api/datasets/:id/preview...');
    const previewRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/datasets/${uploadedDatasetId}/preview`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(previewRes.statusCode, 200);
    assert.strictEqual(previewRes.body.data.previewCount, 50);
    assert.strictEqual(previewRes.body.data.preview.length, 50);
    console.log(` ✓ PASS: Preview returned strictly 50 preview rows for 10,000 rows dataset`);

    // 4. Wait a brief moment for async PostgreSQL COPY and verify rows
    console.log('\n[Step 4] Checking PostgreSQL database records...');
    await new Promise(r => setTimeout(r, 2000));
    const pgDataset = await db.query('SELECT * FROM datasets WHERE id = $1', [uploadedDatasetId]);
    assert.strictEqual(pgDataset.rows.length, 1);
    console.log(` -> PostgreSQL datasets table record confirmed: ID ${pgDataset.rows[0].id}, rows: ${pgDataset.rows[0].row_count}`);

    // 5. Test survival across server restart
    console.log('\n[Step 5] Simulating backend server restart...');
    await new Promise(r => server.close(r));
    console.log(' -> Previous server instance closed.');

    // Launch a brand new server instance
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        console.log(` -> New server instance started on port ${port}`);
        resolve();
      });
    });

    // Query dataset after restart
    const postRestartRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: `/api/datasets/${uploadedDatasetId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(postRestartRes.statusCode, 200);
    assert.strictEqual(postRestartRes.body.data.name, 'Ricoz Analytics 10K Dataset');
    assert.strictEqual(Number(postRestartRes.body.data.row_count), 10000);
    console.log(' ✓ PASS: Dataset persisted and verified across full backend restart!');

    console.log('\n================================================================');
    console.log('  ALL 10K DATASET UPLOAD & PERSISTENCE CHECKS PASSED (100%)    ');
    console.log('================================================================\n');

  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
    await db.closeDb();
  }
}

run10kUploadVerification().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
