const https = require('https');
const crypto = require('crypto');

const BASE_URL = 'https://ricoz-analytics.onrender.com';

function httpRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'User-Agent': 'RicozProductionVerifier/1.0' };
    let payload = null;

    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(url, { method, headers, timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    if (payload) req.write(payload);
    req.end();
  });
}

async function verifyProduction() {
  console.log('\n===============================================================');
  console.log('  🌐 PRODUCTION LIVE VERIFICATION & SMOKE TEST SUITE');
  console.log(`  Target: ${BASE_URL}`);
  console.log('===============================================================\n');

  // 1. Health check
  console.log('1. Health check...');
  const health = await httpRequest('GET', '/health');
  console.log(`   Health status: ${health.status}, uptime: ${health.data?.uptime_seconds}s`);

  // 2. Authentication
  console.log('\n2. Authentication (admin@ricoz.test)...');
  const loginRes = await httpRequest('POST', '/api/auth/login', {
    email: 'admin@ricoz.test',
    password: 'admin123'
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data?.token || loginRes.data?.data?.token;
  const user = loginRes.data?.user || loginRes.data?.data?.user;
  console.log(`   Authenticated as ${user?.email} (Org: ${user?.organization_id}, Role: ${user?.role})`);

  // 3. Dataset listing
  console.log('\n3. Dataset listing...');
  const dsRes = await httpRequest('GET', '/api/datasets', null, token);
  console.log(`   Datasets status: ${dsRes.status}, count: ${dsRes.data?.count || dsRes.data?.data?.length || 0}`);
  const datasets = dsRes.data?.data || [];
  const benchmark10k = datasets.find(d => d.name?.includes('10K') || d.row_count === 10000 || d.name?.includes('Benchmark'));

  if (!benchmark10k) {
    console.log('   Available datasets:', datasets.map(d => ({ id: d.id, name: d.name, rows: d.row_count })));
    throw new Error('Benchmark 10K dataset not found in production organization.');
  }
  console.log(`   Found Benchmark Dataset: #${benchmark10k.id} "${benchmark10k.name}" (${benchmark10k.row_count} rows, ${benchmark10k.column_count} columns)`);

  // 4. Dataset Preview (stream / postgres fallback)
  console.log('\n4. Dataset Preview...');
  const previewRes = await httpRequest('GET', `/api/datasets/${benchmark10k.id}/preview`, null, token);
  console.log(`   Preview status: ${previewRes.status}`);
  if (previewRes.status === 200) {
    const previewRows = previewRes.data?.data?.preview || [];
    console.log(`   Preview rows returned: ${previewRows.length} (expected 50)`);
    if (previewRows.length > 0) {
      console.log(`   Sample row keys: ${Object.keys(previewRows[0]).join(', ')}`);
    }
  } else {
    console.log(`   Preview response: ${JSON.stringify(previewRes.data)}`);
  }

  // 5. Dashboard KPIs calculation
  console.log('\n5. Dashboard KPIs Calculation...');
  const kpisRes = await httpRequest('GET', `/api/analytics/datasets/${benchmark10k.id}/kpis`, null, token);
  console.log(`   KPIs status: ${kpisRes.status}`);
  if (kpisRes.status === 200) {
    const kpis = kpisRes.data?.data?.kpis;
    console.log('   Calculated KPIs:');
    console.log(`     - Total Sales: ₹${kpis?.totalSales?.toLocaleString('en-IN')}`);
    console.log(`     - Total Orders: ${kpis?.totalOrders?.toLocaleString()}`);
    console.log(`     - Total Quantity: ${kpis?.totalQuantity?.toLocaleString()}`);
    console.log(`     - AOV: ₹${kpis?.averageOrderValue?.toLocaleString('en-IN')}`);
    console.log(`     - Min / Max: ₹${kpis?.minSales} / ₹${kpis?.maxSales}`);
    console.log(`     - Primary Metric: ${kpis?.primaryMetricName}`);
  }

  // 6. Regional and Channel Breakdowns
  console.log('\n6. Categorical Breakdowns...');
  const regionRes = await httpRequest('GET', `/api/analytics/datasets/${benchmark10k.id}/breakdowns?groupBy=region`, null, token);
  const breakdownList = Array.isArray(regionRes.data?.data) ? regionRes.data.data : (regionRes.data?.data?.breakdown || regionRes.data?.breakdown || []);
  console.log(`   Region Breakdown status: ${regionRes.status}, items: ${breakdownList.length}`);
  breakdownList.slice(0, 4).forEach(r => console.log(`     * Region ${r.category || r.name}: ₹${r.value?.toLocaleString('en-IN')} (${r.percentage}%)`));

  // 7. Data Quality Profile
  console.log('\n7. Data Quality Profile...');
  const qualityRes = await httpRequest('GET', `/api/data-quality/datasets/${benchmark10k.id}`, null, token);
  console.log(`   Quality status: ${qualityRes.status}`);
  if (qualityRes.status === 200) {
    const q = qualityRes.data?.data || qualityRes.data?.profile;
    console.log(`   Quality Score: ${q?.quality_score}% (Status: ${q?.status})`);
    console.log(`     - Completeness: ${q?.completeness}%`);
    console.log(`     - Validity: ${q?.validity}%`);
    console.log(`     - Uniqueness: ${q?.uniqueness}%`);
    console.log(`     - Consistency: ${q?.consistency}%`);
    console.log(`     - Freshness: ${q?.freshness}%`);
    console.log(`     - Evaluated rows: ${q?.row_count}, columns: ${q?.column_count}`);
  }

  // 8. Reports JSON Export
  console.log('\n8. Direct Dashboard Export (JSON format)...');
  const exportRes = await httpRequest('POST', '/api/reports/export-dashboard', {
    dataset_id: benchmark10k.id,
    format: 'json',
    title: 'Executive Sales & Channel Analysis Export'
  }, token);
  console.log(`   Export JSON status: ${exportRes.status}`);
  if (exportRes.status === 200) {
    const report = exportRes.data;
    console.log(`   Export metadata: Title="${report.meta?.title}", Engine="${report.meta?.engine}"`);
    console.log(`   Export KPIs count: ${report.kpis?.length}`);
    if (report.kpis) {
      report.kpis.forEach(k => console.log(`     * ${k.name}: ${k.value} (${k.calculation || ''})`));
    }
    console.log(`   Export Widgets count: ${report.widgets?.length}`);
    if (report.widgets) {
      report.widgets.forEach(w => console.log(`     * Widget: ${w.title} (${w.type}), points: ${w.chart_data?.length || 0}`));
    }
    console.log(`   Export Embedded Rows: ${report.dataset?.rows?.length || 0}`);
  }

  console.log('\n===============================================================');
  console.log('  ✅ PRODUCTION LIVE VERIFICATION COMPLETED');
  console.log('===============================================================\n');
}

verifyProduction().catch(err => {
  console.error('\n❌ Production verification error:', err);
  process.exit(1);
});
