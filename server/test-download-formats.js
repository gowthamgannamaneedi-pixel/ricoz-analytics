const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');
const ReportModel = require('./models/reportModel');

let server;
let port;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBuffer.toString('utf-8'));
        } catch (_) {}

        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : rawBuffer,
          buffer: rawBuffer
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runDownloadTests() {
  console.log('================================================================');
  console.log('  RicozAnalytics: Multi-Format Report Download Verification      ');
  console.log('================================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  try {
    const orgAId = '00000000-0000-0000-0000-000000000001';
    const orgBId = '00000000-0000-0000-0000-000000000002';

    // Admin in Org A
    const adminUser = await UserModel.create({
      name: 'Admin Test',
      email: `admin_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'admin',
      organization_id: orgAId
    });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Viewer in Org A
    const viewerUser = await UserModel.create({
      name: 'Viewer Test',
      email: `viewer_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'viewer',
      organization_id: orgAId
    });
    const viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerUser.email, role: 'viewer', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Org B User
    const orgBUser = await UserModel.create({
      name: 'Org B User',
      email: `orgb_${Date.now()}@foreign.test`,
      password: 'Password123!',
      role: 'admin',
      organization_id: orgBId
    });
    const orgBToken = jwt.sign(
      { id: orgBUser.id, email: orgBUser.email, role: 'admin', organization_id: orgBId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Create Report in Org A
    const repRes = await request('POST', '/api/reports', {
      title: 'Multi-Format Telemetry Test Report',
      format: 'pdf',
      status: 'active'
    }, { Authorization: `Bearer ${adminToken}` });
    const reportId = repRes.data.report.id;

    const formats = ['pdf', 'excel', 'csv', 'json'];
    const executionIds = {};

    for (const fmt of formats) {
      const runRes = await request('POST', `/api/reports/${reportId}/run`, { format: fmt }, {
        Authorization: `Bearer ${adminToken}`
      });
      if (runRes.status !== 200) {
        throw new Error(`Failed to run report format ${fmt}: ${JSON.stringify(runRes.data)}`);
      }
      executionIds[fmt] = runRes.data.execution.executionId;
      console.log(`  ✓ Generated ${fmt.toUpperCase()} execution: ${executionIds[fmt]}`);
    }

    console.log('\n--- Testing Downloads with Viewer Role ---');
    // 1. PDF Download
    const pdfDown = await request('GET', `/api/reports/executions/${executionIds['pdf']}/download`, null, {
      Authorization: `Bearer ${viewerToken}`
    });
    console.log(`  PDF Download Status: ${pdfDown.status}, Content-Type: ${pdfDown.headers['content-type']}, Disposition: ${pdfDown.headers['content-disposition']}`);
    if (pdfDown.status !== 200 || !pdfDown.headers['content-type'].includes('application/pdf')) {
      throw new Error('PDF download verification failed');
    }
    if (!pdfDown.headers['content-disposition']?.includes('Multi-Format-Telemetry-Test-Report.pdf')) {
      throw new Error(`PDF Content-Disposition filename mismatch: ${pdfDown.headers['content-disposition']}`);
    }

    // 2. XLSX Download
    const xlsxDown = await request('GET', `/api/reports/executions/${executionIds['excel']}/download`, null, {
      Authorization: `Bearer ${viewerToken}`
    });
    console.log(`  XLSX Download Status: ${xlsxDown.status}, Content-Type: ${xlsxDown.headers['content-type']}, Disposition: ${xlsxDown.headers['content-disposition']}`);
    if (xlsxDown.status !== 200 || !xlsxDown.headers['content-type'].includes('spreadsheetml')) {
      throw new Error('XLSX download verification failed');
    }
    if (!xlsxDown.headers['content-disposition']?.includes('Multi-Format-Telemetry-Test-Report.xlsx')) {
      throw new Error(`XLSX Content-Disposition filename mismatch: ${xlsxDown.headers['content-disposition']}`);
    }

    // 3. CSV Download
    const csvDown = await request('GET', `/api/reports/executions/${executionIds['csv']}/download`, null, {
      Authorization: `Bearer ${viewerToken}`
    });
    console.log(`  CSV Download Status: ${csvDown.status}, Content-Type: ${csvDown.headers['content-type']}, Disposition: ${csvDown.headers['content-disposition']}`);
    if (csvDown.status !== 200 || !csvDown.headers['content-type'].includes('text/csv')) {
      throw new Error('CSV download verification failed');
    }
    if (!csvDown.headers['content-disposition']?.includes('Multi-Format-Telemetry-Test-Report.csv')) {
      throw new Error(`CSV Content-Disposition filename mismatch: ${csvDown.headers['content-disposition']}`);
    }

    // 4. JSON Download
    const jsonDown = await request('GET', `/api/reports/executions/${executionIds['json']}/download`, null, {
      Authorization: `Bearer ${viewerToken}`
    });
    console.log(`  JSON Download Status: ${jsonDown.status}, Content-Type: ${jsonDown.headers['content-type']}, Disposition: ${jsonDown.headers['content-disposition']}`);
    if (jsonDown.status !== 200 || !jsonDown.headers['content-type'].includes('application/json')) {
      throw new Error('JSON download verification failed');
    }
    if (!jsonDown.headers['content-disposition']?.includes('Multi-Format-Telemetry-Test-Report.json')) {
      throw new Error(`JSON Content-Disposition filename mismatch: ${jsonDown.headers['content-disposition']}`);
    }

    console.log('\n--- Testing Cross-Tenant Download Isolation (Org B attempting to download Org A) ---');
    for (const fmt of formats) {
      const crossDown = await request('GET', `/api/reports/executions/${executionIds[fmt]}/download`, null, {
        Authorization: `Bearer ${orgBToken}`
      });
      console.log(`  Cross-Tenant ${fmt.toUpperCase()} Download Status: ${crossDown.status} (Expected 404)`);
      if (crossDown.status !== 404) {
        throw new Error(`Cross-tenant download isolation failed for format ${fmt}`);
      }
    }

    console.log('\n--- Testing Unauthenticated Download (Without Authorization Header) ---');
    for (const fmt of formats) {
      const unauthDown = await request('GET', `/api/reports/executions/${executionIds[fmt]}/download`, null, {});
      console.log(`  Unauthenticated ${fmt.toUpperCase()} Download Status: ${unauthDown.status} (Expected 401)`);
      if (unauthDown.status !== 401) {
        throw new Error(`Unauthenticated download check failed for format ${fmt}`);
      }
    }

    console.log('\n================================================================');
    console.log('  ALL MULTI-FORMAT DOWNLOAD TESTS PASSED!                        ');
    console.log('================================================================\n');

  } finally {
    if (server) server.close();
  }
}

runDownloadTests().catch((err) => {
  console.error('Download verification error:', err);
  process.exit(1);
});
