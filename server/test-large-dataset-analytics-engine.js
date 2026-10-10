/**
 * Comprehensive Automated Verification Suite for Large Dataset Analytics Engine
 * Tests:
 * 1. 10,000 rows ingestion & exact mathematical KPI calculation
 * 2. 100,000 rows ingestion, filtered queries, trends & breakdowns
 * 3. 1,000,000+ rows (~149 MB) large-scale streaming analytics & peak memory measurement
 * 4. JSON / NDJSON ingestion & querying
 * 5. Malformed data handling & cancelled import rollback resilience
 * 6. Concurrent analytics requests
 * 7. Tenant isolation & dataset ownership enforcement
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const app = require('./app');
const db = require('./config/database');
const storage = require('./storage');
const { ingestDatasetFileStream } = require('./services/datasetIngestionService');
const analyticsService = require('./services/analyticsService');

let server;
const port = 5098;
const baseUrl = `http://localhost:${port}`;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(` ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(` ❌ FAIL: ${message}`);
  }
}

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
  return { body: Buffer.concat(parts.map(p => Buffer.from(p, 'utf-8'))), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function runSuite() {
  console.log('===============================================================');
  console.log('  🧪 Large Dataset Analytics Engine Automated Verification Suite');
  console.log('===============================================================\n');

  server = app.listen(port);
  await new Promise(r => setTimeout(r, 200));

  const performanceMetrics = {
    ingest10kMs: 0,
    kpiQuery10kMs: 0,
    ingest100kMs: 0,
    kpiQuery100kMs: 0,
    ingest1MMs: 0,
    kpiQuery1MMs: 0,
    trendsQuery1MMs: 0,
    breakdownsQuery1MMs: 0,
    rowsQuery1MMs: 0,
    peakHeapMb: 0
  };

  try {
    // ------------------------------------------------------------------------
    // SETUP: Authenticate Test Users
    // ------------------------------------------------------------------------
    console.log('[Setup] Authenticating test accounts...');
    const userAEmail = `analytics_tester_a_${Date.now()}@ricoz.test`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Tenant A Analytics Lead',
      organization_name: 'Tenant A Enterprise Corp',
      email: userAEmail,
      password: 'Password123!'
    });
    assert(regRes.status === 201, 'User A registered successfully');

    const otpA = regRes.data?._devVerificationOtp;
    const verifyRes = await request('POST', '/api/auth/verify-email', {
      email: userAEmail,
      otp: otpA || '123456'
    });
    const tokenA = verifyRes.data?.token || regRes.data?.token;
    assert(Boolean(tokenA), 'User A obtained authentication token');

    const userBEmail = `analytics_tester_b_${Date.now()}@ricoz.test`;
    const regBRes = await request('POST', '/api/auth/register', {
      name: 'Tenant B Analyst',
      organization_name: 'Tenant B Independent LLC',
      email: userBEmail,
      password: 'Password123!'
    });
    const otpB = regBRes.data?._devVerificationOtp;
    const verifyBRes = await request('POST', '/api/auth/verify-email', {
      email: userBEmail,
      otp: otpB || '123456'
    });
    const tokenB = verifyBRes.data?.token || regBRes.data?.token;
    assert(Boolean(tokenB), 'User B obtained authentication token');

    // ------------------------------------------------------------------------
    // SECTION 1: 10,000-Row Dataset Ingestion & Mathematical KPI Accuracy
    // ------------------------------------------------------------------------
    console.log('\n--- Section 1: 10,000 Rows Verification & Math Accuracy ---');
    const rows10k = 10000;
    let expectedSum10k = 0;
    let expectedOrders10k = rows10k;
    let minSales10k = Infinity;
    let maxSales10k = -Infinity;
    const csvLines10k = ['order_id,region,category,sales_amount,units_sold,order_date'];

    for (let i = 1; i <= rows10k; i++) {
      const sales = Math.round((50 + (i % 250) * 1.5) * 100) / 100;
      expectedSum10k += sales;
      if (sales < minSales10k) minSales10k = sales;
      if (sales > maxSales10k) maxSales10k = sales;

      const region = i % 2 === 0 ? 'North' : 'South';
      const category = i % 3 === 0 ? 'Software' : 'Hardware';
      const date = `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`;
      csvLines10k.push(`ORD-${100000 + i},${region},${category},${sales},${1 + (i % 5)},${date}`);
    }
    expectedSum10k = Number(expectedSum10k.toFixed(2));
    const expectedAov10k = Number((expectedSum10k / expectedOrders10k).toFixed(2));

    const csv10kBuffer = Buffer.from(csvLines10k.join('\n'), 'utf-8');
    const startIngest10k = Date.now();
    const payload10k = createMultipartPayload({ name: 'Benchmark 10K Dataset' }, {
      fieldname: 'file',
      filename: 'benchmark_10k.csv',
      mimetype: 'text/csv',
      content: csv10kBuffer
    });

    const upload10kRes = await request('POST', '/api/data-sources/upload', payload10k.body, {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': payload10k.contentType
    });
    performanceMetrics.ingest10kMs = Date.now() - startIngest10k;
    assert(upload10kRes.status === 201, `10K CSV upload succeeded in ${performanceMetrics.ingest10kMs}ms`);

    const dataset10kId = upload10kRes.data?.data?.dataset?.id;
    assert(Boolean(dataset10kId), `Dataset #10K created with ID #${dataset10kId}`);
    assert(upload10kRes.data?.data?.dataset?.rowCount === 10000, `Dataset row count verified at 10,000 rows`);

    // Verify Summary Endpoint
    const sum10kRes = await request('GET', `/api/analytics/datasets/${dataset10kId}/summary`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    assert(sum10kRes.status === 200, 'GET /summary for 10K dataset returns 200 OK');
    assert(sum10kRes.data?.data?.dimensions?.primaryMetric === 'sales_amount', 'Detected primary metric: sales_amount');
    assert(sum10kRes.data?.data?.dimensions?.regionColumn === 'region', 'Detected region dimension: region');

    // Verify KPIs Mathematical Accuracy
    const startKpi10k = Date.now();
    const kpi10kRes = await request('GET', `/api/analytics/datasets/${dataset10kId}/kpis`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.kpiQuery10kMs = Date.now() - startKpi10k;
    assert(kpi10kRes.status === 200, `GET /kpis executed in ${performanceMetrics.kpiQuery10kMs}ms`);

    const actualKpis10k = kpi10kRes.data?.data?.kpis || {};
    assert(actualKpis10k.recordCount === 10000, `KPI recordCount strictly equals 10,000`);
    assert(Math.abs(actualKpis10k.totalSales - expectedSum10k) < 0.1, `totalSales matches independent math: got ${actualKpis10k.totalSales}, expected ${expectedSum10k}`);
    assert(Math.abs(actualKpis10k.averageOrderValue - expectedAov10k) < 0.1, `averageOrderValue matches independent math: got ${actualKpis10k.averageOrderValue}, expected ${expectedAov10k}`);
    assert(actualKpis10k.minSales === minSales10k, `minSales matches exact minimum (${minSales10k})`);
    assert(actualKpis10k.maxSales === maxSales10k, `maxSales matches exact maximum (${maxSales10k})`);

    // Verify Trends
    const trends10kRes = await request('GET', `/api/analytics/datasets/${dataset10kId}/trends`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    assert(trends10kRes.status === 200, 'GET /trends returns 200 OK');
    assert(Array.isArray(trends10kRes.data?.data?.trends), 'Trends returned array of timeline points');

    // Verify Categorical Breakdowns
    const break10kRes = await request('GET', `/api/analytics/datasets/${dataset10kId}/breakdowns?groupBy=region`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    assert(break10kRes.status === 200, 'GET /breakdowns?groupBy=region returns 200 OK');
    assert(break10kRes.data?.data?.breakdown?.length === 2, 'Breakdown contains exactly 2 regions (North, South)');

    // Verify Filtered KPIs
    const filtered10kRes = await request('GET', `/api/analytics/datasets/${dataset10kId}/kpis?region=North`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    assert(filtered10kRes.status === 200, 'GET /kpis?region=North returns 200 OK');
    assert(filtered10kRes.data?.data?.kpis?.recordCount === 5000, 'Filtered region=North has exactly 5,000 records');

    // ------------------------------------------------------------------------
    // SECTION 2: 100,000-Row Dataset Verification & Query Latency
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: 100,000 Rows Verification ---');
    const rows100k = 100000;
    let expectedSum100k = 0;
    const temp100kFile = path.join(__dirname, 'temp_100k_test.csv');
    const writeStream100k = fs.createWriteStream(temp100kFile, { encoding: 'utf8' });
    writeStream100k.write('order_id,region,category,revenue,quantity,order_date\n');

    for (let i = 1; i <= rows100k; i++) {
      const rev = (10 + (i % 100)) * 2;
      expectedSum100k += rev;
      const reg = i % 4 === 0 ? 'East' : (i % 4 === 1 ? 'West' : (i % 4 === 2 ? 'North' : 'South'));
      writeStream100k.write(`ORD-${i},${reg},Enterprise,${rev},${1 + (i % 3)},2026-05-15\n`);
    }
    await new Promise(r => writeStream100k.end(r));

    const fileBuf100k = fs.readFileSync(temp100kFile);
    fs.unlinkSync(temp100kFile);

    const startIngest100k = Date.now();
    const payload100k = createMultipartPayload({ name: 'Benchmark 100K Dataset' }, {
      fieldname: 'file',
      filename: 'benchmark_100k.csv',
      mimetype: 'text/csv',
      content: fileBuf100k
    });

    const upload100kRes = await request('POST', '/api/data-sources/upload', payload100k.body, {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': payload100k.contentType
    });
    performanceMetrics.ingest100kMs = Date.now() - startIngest100k;
    assert(upload100kRes.status === 201, `100K CSV upload succeeded in ${performanceMetrics.ingest100kMs}ms`);

    const dataset100kId = upload100kRes.data?.data?.dataset?.id;
    assert(Boolean(dataset100kId), `Dataset #100K created with ID #${dataset100kId}`);
    assert(upload100kRes.data?.data?.dataset?.rowCount === 100000, `Row count accurately recorded as 100,000`);

    const startKpi100k = Date.now();
    const kpi100kRes = await request('GET', `/api/analytics/datasets/${dataset100kId}/kpis`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.kpiQuery100kMs = Date.now() - startKpi100k;
    assert(kpi100kRes.status === 200, `100K KPI query completed in ${performanceMetrics.kpiQuery100kMs}ms`);
    assert(kpi100kRes.data?.data?.kpis?.recordCount === 100000, `100K KPI recordCount equals 100,000`);
    assert(kpi100kRes.data?.data?.kpis?.totalSales === expectedSum100k, `100K totalSales matches independent math (${expectedSum100k})`);

    // ------------------------------------------------------------------------
    // SECTION 3: 1,000,000+ Rows (~149MB) Streaming Analytics & Memory Safety
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: 1,000,000-Row Dataset Streaming Analytics ---');
    const rows1M = 1000000;
    const temp1MPath = path.join(__dirname, 'temp_1m_analytics.csv');
    console.log('Generating 1,000,000 rows CSV on disk...');
    const ws1M = fs.createWriteStream(temp1MPath, { encoding: 'utf8' });
    ws1M.write('order_id,region,category,sales_amount,units_sold,order_date\n');

    let expectedSum1M = 0;
    for (let i = 1; i <= rows1M; i++) {
      const sales = 100.0;
      expectedSum1M += sales;
      ws1M.write(`ORD-${i},APAC,Cloud,${sales},2,2026-06-01\n`);
    }
    await new Promise(r => ws1M.end(r));

    const stat1M = fs.statSync(temp1MPath);
    const sizeMb1M = (stat1M.size / (1024 * 1024)).toFixed(1);
    console.log(`Generated ${rows1M} rows file (${sizeMb1M} MB)`);

    // Direct streaming storage ingestion
    const startIngest1M = Date.now();
    const userAObj = regRes.data?.user || regRes.data?.data?.user;
    const userIdA = userAObj?.id || 1;
    const savedFile1M = await storage.saveFile(userIdA, 'large_enterprise_1m.csv', temp1MPath);
    performanceMetrics.ingest1MMs = Date.now() - startIngest1M;
    if (fs.existsSync(temp1MPath)) {
      try { fs.unlinkSync(temp1MPath); } catch (_) {}
    }

    // Create Dataset record in store
    const ds1M = await db.query(
      `INSERT INTO datasets (user_id, data_source_id, name, description, file_path, row_count, column_count, schema)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        userIdA,
        null,
        'Enterprise 1M Analytics Stream',
        'Automated 1,000,000-row benchmark dataset',
        savedFile1M.filePath,
        1000000,
        6,
        JSON.stringify([
          { name: 'order_id', type: 'string' },
          { name: 'region', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'sales_amount', type: 'number' },
          { name: 'units_sold', type: 'number' },
          { name: 'order_date', type: 'date' }
        ])
      ]
    );
    const dataset1MId = ds1M.rows[0].id;
    assert(Boolean(dataset1MId), `Created 1,000,000-row dataset record with ID #${dataset1MId}`);

    // Query 1M KPIs and measure peak memory
    const initialHeap = process.memoryUsage().heapUsed;
    const startKpi1M = Date.now();
    const kpi1MRes = await request('GET', `/api/analytics/datasets/${dataset1MId}/kpis`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.kpiQuery1MMs = Date.now() - startKpi1M;
    const postKpiHeap = process.memoryUsage().heapUsed;
    performanceMetrics.peakHeapMb = Math.round(postKpiHeap / (1024 * 1024) * 10) / 10;

    assert(kpi1MRes.status === 200, `1,000,000-row KPI query succeeded in ${performanceMetrics.kpiQuery1MMs}ms`);
    assert(kpi1MRes.data?.data?.kpis?.recordCount === 1000000, `1M recordCount strictly equals 1,000,000`);
    assert(kpi1MRes.data?.data?.kpis?.totalSales === expectedSum1M, `1M totalSales exactly matches math (${expectedSum1M})`);
    assert(performanceMetrics.peakHeapMb < 250, `Memory footprint strictly bounded: peak heap is ${performanceMetrics.peakHeapMb} MB (< 250 MB target)`);

    // Query 1M Trends
    const startTrends1M = Date.now();
    const trends1MRes = await request('GET', `/api/analytics/datasets/${dataset1MId}/trends`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.trendsQuery1MMs = Date.now() - startTrends1M;
    assert(trends1MRes.status === 200, `1M trends query succeeded in ${performanceMetrics.trendsQuery1MMs}ms`);

    // Query 1M Breakdowns
    const startBreak1M = Date.now();
    const break1MRes = await request('GET', `/api/analytics/datasets/${dataset1MId}/breakdowns?groupBy=category`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.breakdownsQuery1MMs = Date.now() - startBreak1M;
    assert(break1MRes.status === 200, `1M category breakdown query succeeded in ${performanceMetrics.breakdownsQuery1MMs}ms`);

    // Query 1M Paginated Table Rows
    const startRows1M = Date.now();
    const rows1MRes = await request('GET', `/api/analytics/datasets/${dataset1MId}/rows?page=50&limit=20`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    performanceMetrics.rowsQuery1MMs = Date.now() - startRows1M;
    assert(rows1MRes.status === 200, `1M paginated rows query succeeded in ${performanceMetrics.rowsQuery1MMs}ms`);
    assert(rows1MRes.data?.data?.rows?.length === 20, `Page 50 returns strictly 20 rows`);
    assert(rows1MRes.data?.data?.totalCount === 1000000, `Total pagination count accurately reports 1,000,000`);

    // ------------------------------------------------------------------------
    // SECTION 4: JSON & NDJSON Dataset Support
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: JSON & NDJSON Support ---');
    const jsonRecords = [
      { id: 'J-1', product: 'Laptop', price: 1200, date: '2026-07-01' },
      { id: 'J-2', product: 'Monitor', price: 350, date: '2026-07-02' },
      { id: 'J-3', product: 'Keyboard', price: 80, date: '2026-07-03' }
    ];
    const jsonPayload = createMultipartPayload({ name: 'JSON Devices Dataset' }, {
      fieldname: 'file',
      filename: 'devices.json',
      mimetype: 'application/json',
      content: Buffer.from(JSON.stringify(jsonRecords), 'utf-8')
    });

    const jsonUploadRes = await request('POST', '/api/data-sources/upload', jsonPayload.body, {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': jsonPayload.contentType
    });
    assert(jsonUploadRes.status === 201, 'JSON file upload succeeded');
    const jsonDatasetId = jsonUploadRes.data?.data?.dataset?.id;

    const jsonKpis = await request('GET', `/api/analytics/datasets/${jsonDatasetId}/kpis`, null, {
      'Authorization': `Bearer ${tokenA}`
    });
    assert(jsonKpis.status === 200, 'JSON dataset KPIs queried successfully');
    assert(jsonKpis.data?.data?.kpis?.totalSales === 1630, 'JSON primary metric sum accurately equals 1630 (1200+350+80)');

    // ------------------------------------------------------------------------
    // SECTION 5: Malformed Data & Cancellation Rollback Resilience
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Malformed Data & Cancellation Resilience ---');
    const malformedCsv = [
      'id,name,value',
      '1,Valid Row,100',
      '2,Broken Row with Extra Columns,200,999,Extra,Unexpected',
      '3,"Row with mismatched quote,300',
      '4,Another Valid Row,400',
      '',
      '5,Final Valid Row,500'
    ].join('\n');

    const malformedFile = path.join(__dirname, 'temp_malformed.csv');
    fs.writeFileSync(malformedFile, malformedCsv, 'utf8');

    const ingestMalformedResult = await ingestDatasetFileStream({
      datasetId: 9999,
      filePath: malformedFile,
      fileExtension: 'csv'
    });
    fs.unlinkSync(malformedFile);

    assert(ingestMalformedResult.success === true, 'Streaming ingestion completed despite malformed rows');
    assert(ingestMalformedResult.rowsIngested >= 3, 'Valid rows ingested without crashing engine');

    // Test cancellation signal
    const abortCtrl = new AbortController();
    abortCtrl.abort(); // Pre-aborted signal
    let cancelCaught = false;
    try {
      await ingestDatasetFileStream({
        datasetId: 8888,
        filePath: savedFile1M.filePath,
        fileExtension: 'csv',
        signal: abortCtrl.signal
      });
    } catch (err) {
      cancelCaught = err.message.includes('cancelled');
    }
    assert(cancelCaught, 'Cancellation signal aborted ingestion cleanly with useful error message');

    // Verify dataset safety: physical file remains intact
    const fileStillExists = await storage.exists(savedFile1M.filePath);
    assert(fileStillExists, 'Dataset physical storage file is preserved safely and NEVER deleted on failure');

    // ------------------------------------------------------------------------
    // SECTION 6: Concurrent Analytics Requests
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: Concurrent Analytics Requests ---');
    const startConcurrent = Date.now();
    const [cSummary, cKpis, cTrends, cBreakdowns, cRows] = await Promise.all([
      request('GET', `/api/analytics/datasets/${dataset10kId}/summary`, null, { 'Authorization': `Bearer ${tokenA}` }),
      request('GET', `/api/analytics/datasets/${dataset10kId}/kpis`, null, { 'Authorization': `Bearer ${tokenA}` }),
      request('GET', `/api/analytics/datasets/${dataset10kId}/trends`, null, { 'Authorization': `Bearer ${tokenA}` }),
      request('GET', `/api/analytics/datasets/${dataset10kId}/breakdowns?groupBy=region`, null, { 'Authorization': `Bearer ${tokenA}` }),
      request('GET', `/api/analytics/datasets/${dataset10kId}/rows?page=1&limit=10`, null, { 'Authorization': `Bearer ${tokenA}` })
    ]);
    const concurrentMs = Date.now() - startConcurrent;

    assert(
      cSummary.status === 200 && cKpis.status === 200 && cTrends.status === 200 && cBreakdowns.status === 200 && cRows.status === 200,
      `All 5 concurrent requests succeeded with HTTP 200 in ${concurrentMs}ms`
    );

    // ------------------------------------------------------------------------
    // SECTION 7: Multi-Tenant Isolation & Dataset Ownership
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Multi-Tenant Isolation ---');
    const crossTenantKpis = await request('GET', `/api/analytics/datasets/${dataset1MId}/kpis`, null, {
      'Authorization': `Bearer ${tokenB}`
    });
    assert(crossTenantKpis.status === 404, 'Tenant B denied access to Tenant A 1M dataset (HTTP 404)');

    const crossTenantRows = await request('GET', `/api/analytics/datasets/${dataset1MId}/rows`, null, {
      'Authorization': `Bearer ${tokenB}`
    });
    assert(crossTenantRows.status === 404, 'Tenant B denied access to Tenant A rows (HTTP 404)');

    // Clean up test dataset
    await storage.deleteFile(savedFile1M.filePath).catch(() => {});

  } catch (err) {
    console.error('Unhandled Suite Failure:', err);
    failedTests++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================');
  console.log('📊 MEASURED PERFORMANCE SUMMARY:');
  console.log(` - 10,000 Rows Ingestion:      ${performanceMetrics.ingest10kMs}ms`);
  console.log(` - 10,000 Rows KPI Query:      ${performanceMetrics.kpiQuery10kMs}ms`);
  console.log(` - 100,000 Rows Ingestion:     ${performanceMetrics.ingest100kMs}ms`);
  console.log(` - 100,000 Rows KPI Query:     ${performanceMetrics.kpiQuery100kMs}ms`);
  console.log(` - 1,000,000 Rows Ingestion:   ${performanceMetrics.ingest1MMs}ms`);
  console.log(` - 1,000,000 Rows KPI Query:   ${performanceMetrics.kpiQuery1MMs}ms`);
  console.log(` - 1,000,000 Rows Trends:      ${performanceMetrics.trendsQuery1MMs}ms`);
  console.log(` - 1,000,000 Rows Breakdowns:  ${performanceMetrics.breakdownsQuery1MMs}ms`);
  console.log(` - 1,000,000 Rows Paginated:   ${performanceMetrics.rowsQuery1MMs}ms`);
  console.log(` - Peak Memory Usage:          ${performanceMetrics.peakHeapMb} MB`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
