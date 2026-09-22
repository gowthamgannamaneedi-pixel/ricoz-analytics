/**
 * Comprehensive Automated Test Suite for Phase 5: Dynamic Dashboard Analytics
 * Tests 12 critical functional and security requirements
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

// Multipart helper
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
  console.log('🧪 Starting Phase 5 Automated Test Suite (Dynamic Dashboard Analytics)...\n');

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
    // Setup: Create 2 users to verify cross-user analytics isolation
    // -------------------------------------------------------------
    const user1Res = await request('POST', '/api/auth/register', {
      name: 'Diana Director',
      email: `diana_${Date.now()}@ricoz.test`,
      password: 'Password123!'
    });
    const token1 = user1Res.data.token;
    const userId1 = user1Res.data.user.id;

    const user2Res = await request('POST', '/api/auth/register', {
      name: 'Edward External',
      email: `edward_${Date.now()}@ricoz.test`,
      password: 'Password123!'
    });
    const token2 = user2Res.data.token;
    const userId2 = user2Res.data.user.id;

    // Upload a test CSV dataset with 5 known records
    const testCsv = [
      'order_id,date,region,category,product,channel,quantity,total',
      '101,2025-01-01,North,Hardware,Monitor,Online,2,1000',
      '102,2025-01-02,South,Software,Antivirus,Retail,1,500',
      '103,2025-01-03,North,Hardware,Keyboard,Online,3,300',
      '104,2025-01-04,East,Services,Installation,Direct,1,1200',
      '105,2025-01-05,South,Hardware,Mouse,Online,4,200'
    ].join('\n');

    const csvMultipart = createMultipartPayload(
      { name: 'Q1 Enterprise Sales Telemetry', description: 'Real baseline sales data' },
      { fieldname: 'file', filename: 'q1_sales.csv', mimetype: 'text/csv', content: testCsv }
    );

    const uploadRes = await request('POST', '/api/data-sources/upload', csvMultipart.body, {
      Authorization: `Bearer ${token1}`,
      'Content-Type': csvMultipart.contentType,
      'Content-Length': csvMultipart.body.length
    });

    const datasetId = uploadRes.data.data.dataset.id;
    console.log(`Test dataset created (ID: ${datasetId}) for User 1 (ID: ${userId1})\n`);

    // -------------------------------------------------------------
    // Test 1: GET /api/analytics/datasets/:id/summary detects dimensions & filter options
    // -------------------------------------------------------------
    const summaryRes = await request('GET', `/api/analytics/datasets/${datasetId}/summary`, null, {
      Authorization: `Bearer ${token1}`
    });

    const summaryData = summaryRes.data.data;
    assert(
      summaryRes.status === 200 &&
      summaryData.dimensions.primaryMetric === 'total' &&
      summaryData.dimensions.quantityMetric === 'quantity' &&
      summaryData.dimensions.dateColumn === 'date' &&
      summaryData.dimensions.regionColumn === 'region' &&
      summaryData.filterOptions.regions.length === 3,
      'Test 1: Summary endpoint correctly detects dimensions and populates filter options (North, East, South)'
    );

    // -------------------------------------------------------------
    // Test 2: Dynamic KPI calculation (SUM, COUNT, QUANTITY, AVG, MIN, MAX)
    // -------------------------------------------------------------
    const kpisRes = await request('GET', `/api/analytics/datasets/${datasetId}/kpis`, null, {
      Authorization: `Bearer ${token1}`
    });

    const kpis = kpisRes.data.data.kpis;
    assert(
      kpisRes.status === 200 &&
      kpis.totalSales === 3200 &&
      kpis.totalOrders === 5 &&
      kpis.totalQuantity === 11 &&
      kpis.averageOrderValue === 640 &&
      kpis.minSales === 200 &&
      kpis.maxSales === 1200,
      'Test 2: Dynamic KPIs calculated correctly (Sales: 3200, Orders: 5, Qty: 11, AOV: 640, Min: 200, Max: 1200)'
    );

    // -------------------------------------------------------------
    // Test 3: Time-Series Trends aggregation
    // -------------------------------------------------------------
    const trendsRes = await request('GET', `/api/analytics/datasets/${datasetId}/trends`, null, {
      Authorization: `Bearer ${token1}`
    });

    const trends = trendsRes.data.data.trends;
    assert(
      trendsRes.status === 200 &&
      trends.length === 5 &&
      trends[0].date === '2025-01-01' &&
      trends[0].revenue === 1000 &&
      trends[4].date === '2025-01-05' &&
      trends[4].revenue === 200,
      'Test 3: Trends endpoint aggregates records grouped by date in ascending order'
    );

    // -------------------------------------------------------------
    // Test 4: Regional Breakdown aggregation
    // -------------------------------------------------------------
    const regionBreakdownRes = await request('GET', `/api/analytics/datasets/${datasetId}/breakdowns?groupBy=region`, null, {
      Authorization: `Bearer ${token1}`
    });

    const regionBreakdown = regionBreakdownRes.data.data.breakdown;
    const northEntry = regionBreakdown.find(b => b.category === 'North');
    const eastEntry = regionBreakdown.find(b => b.category === 'East');
    const southEntry = regionBreakdown.find(b => b.category === 'South');

    assert(
      regionBreakdownRes.status === 200 &&
      northEntry?.value === 1300 &&
      eastEntry?.value === 1200 &&
      southEntry?.value === 700,
      'Test 4: Regional breakdown calculates exact sums (North: 1300, East: 1200, South: 700)'
    );

    // -------------------------------------------------------------
    // Test 5: Channel Breakdown aggregation
    // -------------------------------------------------------------
    const channelBreakdownRes = await request('GET', `/api/analytics/datasets/${datasetId}/breakdowns?groupBy=channel`, null, {
      Authorization: `Bearer ${token1}`
    });

    const channelBreakdown = channelBreakdownRes.data.data.breakdown;
    const onlineEntry = channelBreakdown.find(b => b.category === 'Online');
    const retailEntry = channelBreakdown.find(b => b.category === 'Retail');
    const directEntry = channelBreakdown.find(b => b.category === 'Direct');

    assert(
      channelBreakdownRes.status === 200 &&
      onlineEntry?.value === 1500 && // 1000 + 300 + 200
      retailEntry?.value === 500 &&
      directEntry?.value === 1200,
      'Test 5: Channel breakdown calculates exact channel sums (Online: 1500, Direct: 1200, Retail: 500)'
    );

    // -------------------------------------------------------------
    // Test 6: Multi-parameter filtering (Region = North)
    // -------------------------------------------------------------
    const filteredKpiRes = await request('GET', `/api/analytics/datasets/${datasetId}/kpis?region=North`, null, {
      Authorization: `Bearer ${token1}`
    });

    const filteredKpis = filteredKpiRes.data.data.kpis;
    assert(
      filteredKpiRes.status === 200 &&
      filteredKpis.totalSales === 1300 &&
      filteredKpis.totalOrders === 2 &&
      filteredKpis.totalQuantity === 5 &&
      filteredKpis.averageOrderValue === 650,
      'Test 6: Regional filter (region=North) dynamically reduces KPIs (Sales: 1300, Orders: 2, Qty: 5, AOV: 650)'
    );

    // -------------------------------------------------------------
    // Test 7: Multi-parameter filtering (Date range + Channel)
    // -------------------------------------------------------------
    const dateChannelKpiRes = await request('GET', `/api/analytics/datasets/${datasetId}/kpis?startDate=2025-01-01&endDate=2025-01-03&channel=Online`, null, {
      Authorization: `Bearer ${token1}`
    });

    const dateChannelKpis = dateChannelKpiRes.data.data.kpis;
    assert(
      dateChannelKpiRes.status === 200 &&
      dateChannelKpis.totalSales === 1300 && // 1000 + 300 (Row 1 & Row 3)
      dateChannelKpis.totalOrders === 2,
      'Test 7: Combined Date Range and Channel filter calculates exact matching subset'
    );

    // -------------------------------------------------------------
    // Test 8: Paginated Dataset Rows endpoint with sorting
    // -------------------------------------------------------------
    const rowsRes = await request('GET', `/api/analytics/datasets/${datasetId}/rows?page=1&limit=2&sortKey=total&sortOrder=desc`, null, {
      Authorization: `Bearer ${token1}`
    });

    const rowsData = rowsRes.data.data;
    assert(
      rowsRes.status === 200 &&
      rowsData.rows.length === 2 &&
      rowsData.totalCount === 5 &&
      rowsData.totalPages === 3 &&
      rowsData.rows[0].total === 1200 && // highest total
      rowsData.rows[1].total === 1000,
      'Test 8: Paginated rows endpoint supports sorting and page limits (Page 1 of 3, top 2 rows: 1200, 1000)'
    );

    // -------------------------------------------------------------
    // Test 9: Full-Text search query on rows endpoint
    // -------------------------------------------------------------
    const searchRes = await request('GET', `/api/analytics/datasets/${datasetId}/rows?search=Monitor`, null, {
      Authorization: `Bearer ${token1}`
    });

    assert(
      searchRes.status === 200 &&
      searchRes.data.data.totalCount === 1 &&
      searchRes.data.data.rows[0].product === 'Monitor',
      'Test 9: Full-text search correctly filters rows (search=Monitor -> 1 row)'
    );

    // -------------------------------------------------------------
    // Test 10: Strict cross-user ownership isolation (IDOR protection)
    // -------------------------------------------------------------
    const unauthorizedKpiRes = await request('GET', `/api/analytics/datasets/${datasetId}/kpis`, null, {
      Authorization: `Bearer ${token2}`
    });

    assert(
      unauthorizedKpiRes.status === 404,
      'Test 10: Unauthorized user cannot query another user\'s dataset analytics (Returns 404)'
    );

    // -------------------------------------------------------------
    // Test 11: Non-existent dataset ID returns 404
    // -------------------------------------------------------------
    const notFoundRes = await request('GET', `/api/analytics/datasets/99999/kpis`, null, {
      Authorization: `Bearer ${token1}`
    });

    assert(
      notFoundRes.status === 404,
      'Test 11: Non-existent dataset returns 404 cleanly'
    );

    // -------------------------------------------------------------
    // Test 12: Period-over-period comparison calculation
    // -------------------------------------------------------------
    assert(
      kpis.comparison !== null &&
      kpis.comparison.hasComparison === true &&
      typeof kpis.comparison.salesChange === 'string',
      'Test 12: Period comparison calculates delta percentage between time periods'
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
  console.log(`Phase 5 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
