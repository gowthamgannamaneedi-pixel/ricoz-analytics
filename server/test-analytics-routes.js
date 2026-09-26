/**
 * RicozAnalytics - Analytics Endpoints & Multi-Tenant Isolation Test Suite
 * Validates dataset analytics APIs: summary, kpis, trends, breakdowns, rows,
 * along with RBAC across roles, tenant isolation, and error handling.
 */

const http = require('http');
const app = require('./app');

let BASE_URL = process.env.TEST_API_URL;
let testServer = null;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const headers = { ...options.headers };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  return { status: res.status, headers: res.headers, data };
}

async function loginUser(email, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Failed to login as ${email}: status ${res.status}`);
  }
  return res.data;
}

async function runTests() {
  console.log('====================================================');
  console.log(' RicozAnalytics - Analytics API Verification Suite');
  console.log('====================================================\n');

  if (!BASE_URL) {
    testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, () => {
        const port = testServer.address().port;
        BASE_URL = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  try {
    // ----------------------------------------------------
    // Section 1: Authentication & Token Retrieval
    // ----------------------------------------------------
    console.log('[1] User Logins & Multi-Tenant Accounts Setup');
    const adminAuth = await loginUser('admin@ricoz.test', 'admin123');
    assert(adminAuth.user.role === 'admin', 'Admin logged in with role admin');
    assert(adminAuth.user.organization_id === '00000000-0000-0000-0000-000000000001', 'Admin belongs to Org 1');

    const managerAuth = await loginUser('manager@ricoz.test', 'manager123');
    assert(managerAuth.user.role === 'manager', 'Manager logged in with role manager');

    const analystAuth = await loginUser('analyst@ricoz.test', 'analyst123');
    assert(analystAuth.user.role === 'analyst', 'Analyst logged in with role analyst');

    const viewerAuth = await loginUser('viewer@ricoz.test', 'viewer123');
    assert(viewerAuth.user.role === 'viewer', 'Viewer logged in with role viewer');

    const tenantBAuth = await loginUser('admin_b@other.test', 'admin123');
    assert(tenantBAuth.user.organization_id === '00000000-0000-0000-0000-000000000002', 'Tenant B user belongs to Org 2');

    const adminToken = adminAuth.token;
    const viewerToken = viewerAuth.token;
    const tenantBToken = tenantBAuth.token;

    // ----------------------------------------------------
    // Section 2: GET /api/analytics/datasets/1/summary
    // ----------------------------------------------------
    console.log('\n[2] GET /api/analytics/datasets/1/summary');
    const summaryRes = await request('/api/analytics/datasets/1/summary', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(summaryRes.status === 200, 'Summary returns 200 OK');
    assert(summaryRes.data?.success === true, 'Summary success flag is true');
    assert(summaryRes.data?.data?.dataset?.id === 1, 'Summary contains dataset ID 1');
    assert(Array.isArray(summaryRes.data?.data?.dataset?.schema), 'Dataset schema is an array');
    assert(summaryRes.data?.data?.dimensions?.primaryMetric === 'sales_amount', 'Detected primary metric is sales_amount');
    assert(Boolean(summaryRes.data?.data?.filterOptions), 'Summary contains filterOptions object');

    // ----------------------------------------------------
    // Section 3: GET /api/analytics/datasets/1/kpis
    // ----------------------------------------------------
    console.log('\n[3] GET /api/analytics/datasets/1/kpis');
    const kpiRes = await request('/api/analytics/datasets/1/kpis', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(kpiRes.status === 200, 'KPIs endpoint returns 200 OK');
    assert(kpiRes.data?.success === true, 'KPIs success flag is true');
    assert(typeof kpiRes.data?.data?.kpis?.totalSales === 'number', 'KPIs includes numeric totalSales');
    assert(kpiRes.data?.data?.kpis?.totalSales > 0, `KPIs totalSales is positive (${kpiRes.data?.data?.kpis?.totalSales})`);
    assert(kpiRes.data?.data?.kpis?.totalOrders === 20, 'KPIs totalOrders matches dataset record count (20)');
    assert(typeof kpiRes.data?.data?.kpis?.averageOrderValue === 'number', 'KPIs includes averageOrderValue');
    assert(typeof kpiRes.data?.data?.kpis?.totalQuantity === 'number', 'KPIs includes totalQuantity');

    // ----------------------------------------------------
    // Section 4: GET /api/analytics/datasets/1/trends
    // ----------------------------------------------------
    console.log('\n[4] GET /api/analytics/datasets/1/trends');
    const trendsRes = await request('/api/analytics/datasets/1/trends', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(trendsRes.status === 200, 'Trends endpoint returns 200 OK');
    assert(trendsRes.data?.success === true, 'Trends success flag is true');
    assert(Array.isArray(trendsRes.data?.data?.trends), 'Trends data is an array');
    assert(trendsRes.data?.data?.trends.length > 0, `Trends contains points (${trendsRes.data?.data?.trends.length} days)`);
    assert(trendsRes.data?.data?.trends[0].revenue !== undefined, 'Trend points contain revenue metric');

    // ----------------------------------------------------
    // Section 5: GET /api/analytics/datasets/1/breakdowns (region, channel, product)
    // ----------------------------------------------------
    console.log('\n[5] Categorical Breakdowns (region, channel, product)');
    
    // 5a. Region breakdown
    const regionRes = await request('/api/analytics/datasets/1/breakdowns?groupBy=region', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(regionRes.status === 200, 'Region breakdown returns 200 OK');
    assert(regionRes.data?.data?.dimension === 'region', 'Dimension is region');
    assert(Array.isArray(regionRes.data?.data?.breakdown), 'Region breakdown is an array');
    assert(regionRes.data?.data?.breakdown.some(b => b.category === 'Bengaluru'), 'Contains Bengaluru region');

    // 5b. Channel breakdown
    const channelRes = await request('/api/analytics/datasets/1/breakdowns?groupBy=channel', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(channelRes.status === 200, 'Channel breakdown returns 200 OK');
    assert(channelRes.data?.data?.dimension === 'channel', 'Dimension is channel');
    assert(channelRes.data?.data?.breakdown.some(b => b.category === 'Direct Online'), 'Contains Direct Online channel');

    // 5c. Product breakdown
    const productRes = await request('/api/analytics/datasets/1/breakdowns?groupBy=product', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(productRes.status === 200, 'Product breakdown returns 200 OK');
    assert(productRes.data?.data?.dimension === 'product', 'Dimension is product');
    assert(productRes.data?.data?.breakdown.some(b => b.category === 'Enterprise Suite'), 'Contains Enterprise Suite product');

    // ----------------------------------------------------
    // Section 6: GET /api/analytics/datasets/1/rows
    // ----------------------------------------------------
    console.log('\n[6] Paginated Rows & Filtering');
    const rowsRes = await request('/api/analytics/datasets/1/rows?page=1&limit=5&sortKey=sales_amount&sortOrder=desc', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rowsRes.status === 200, 'Rows endpoint returns 200 OK');
    assert(rowsRes.data?.data?.rows?.length === 5, 'Returns requested limit of 5 rows');
    assert(rowsRes.data?.data?.totalCount === 20, 'Total count reflects all 20 rows');
    assert(rowsRes.data?.data?.rows[0].sales_amount >= rowsRes.data?.data?.rows[1].sales_amount, 'Rows sorted descending by sales_amount');

    // 6b. Filtered by region
    const filteredRes = await request('/api/analytics/datasets/1/kpis?region=Bengaluru', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(filteredRes.status === 200, 'Filtered KPIs returns 200 OK');
    assert(filteredRes.data?.data?.totalFilteredRecords === 4, 'Filtered Bengaluru records count is 4');
    assert(filteredRes.data?.data?.kpis?.totalOrders === 4, 'Filtered orders is 4');

    // ----------------------------------------------------
    // Section 7: RBAC - Viewer and Manager Access in Same Org
    // ----------------------------------------------------
    console.log('\n[7] RBAC: Viewer & Manager Analytics Access');
    const viewerKpiRes = await request('/api/analytics/datasets/1/kpis', {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(viewerKpiRes.status === 200, 'Viewer can access organization dataset analytics');
    assert(viewerKpiRes.data?.data?.kpis?.totalOrders === 20, 'Viewer gets identical aggregated metrics');

    const managerSummaryRes = await request('/api/analytics/datasets/1/summary', {
      headers: { Authorization: `Bearer ${managerAuth.token}` }
    });
    assert(managerSummaryRes.status === 200, 'Manager can access dataset summary');

    // ----------------------------------------------------
    // Section 8: Strict Multi-Tenant Isolation
    // ----------------------------------------------------
    console.log('\n[8] Multi-Tenant Isolation');
    const tenantBAttempt = await request('/api/analytics/datasets/1/kpis', {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    assert(tenantBAttempt.status === 404, 'Tenant B Admin denied access to Tenant A dataset (404)');
    assert(tenantBAttempt.data?.success === false, 'Tenant B response success is false');

    const tenantBBreakdown = await request('/api/analytics/datasets/1/breakdowns?groupBy=region', {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    assert(tenantBBreakdown.status === 404, 'Tenant B Admin denied access to Tenant A breakdowns (404)');

    // ----------------------------------------------------
    // Section 9: Security & Error Handling (401, 404)
    // ----------------------------------------------------
    console.log('\n[9] Security & Non-Existent Resource Handling');
    const unauthRes = await request('/api/analytics/datasets/1/kpis');
    assert(unauthRes.status === 401, 'Unauthenticated request receives 401 Unauthorized');

    const nonExistentRes = await request('/api/analytics/datasets/99999/kpis', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(nonExistentRes.status === 404, 'Non-existent dataset ID 99999 receives 404 Not Found');

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(` Results: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('====================================================');

    if (testServer) {
      testServer.close();
    }

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    if (testServer) {
      testServer.close();
    }
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();
