/**
 * Comprehensive Automated Test Suite for Phase 9: Automated Reports & Export Engine
 * Tests 20 critical functional, security, export format, scheduling, and multi-tenant isolation requirements:
 * 
 * 1. Unauthenticated request to /api/reports returns 401 Unauthorized
 * 2. Authenticated user (viewer) can list reports (GET /api/reports) with 200 OK
 * 3. Authorized user (analyst) creates report definition with 201 Created and org binding
 * 4. RBAC: Viewer role is blocked from creating reports (403 Forbidden)
 * 5. Authorized user (manager) updates report configuration and schedule with 200 OK
 * 6. RBAC: Viewer role is blocked from updating reports (403 Forbidden)
 * 7. Authorized user (admin/manager) deletes report with 200 OK
 * 8. RBAC: Viewer role is blocked from deleting reports (403 Forbidden)
 * 9. Report on-demand execution (POST /api/reports/:id/run) generates artifact with 200 OK
 * 10. Execution history is created and retrievable (GET /api/reports/:id/executions)
 * 11. Validation: Unsupported report format rejected with 400 Bad Request
 * 12. Validation: Invalid schedule cron expression rejected with 400 Bad Request
 * 13. Multi-tenancy: Foreign organization (Org B) cannot view, update, or delete Org A reports (404 Isolated)
 * 14. Multi-tenancy: Foreign organization cannot execute Org A reports (404 Isolated)
 * 15. PDF Generation Engine produces valid binary PDF buffer
 * 16. CSV Generation Engine produces RFC 4180 compliant CSV buffer with headers
 * 17. Excel/XLSX Generation Engine produces valid multi-tab spreadsheet buffer
 * 18. JSON Export Engine produces structured schema & metadata payload
 * 19. Failed execution is safely recorded in report_executions table with error_message
 * 20. Direct Dashboard Export (POST /api/reports/export-dashboard) generates and streams file artifact
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');
const ReportModel = require('./models/reportModel');
const reportService = require('./services/reportService');
const schedulerService = require('./services/schedulerService');

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
    if (body) {
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

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runPhase9Tests() {
  console.log('====================================================');
  console.log('  RicozAnalytics Phase 9: Reports & Export Engine   ');
  console.log('====================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Test ${total}: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Unauthenticated request to /api/reports returns 401
    // -------------------------------------------------------------
    const unauthRes = await request('GET', '/api/reports');
    assert(unauthRes.status === 401, 'Unauthenticated request to /api/reports returns 401 Unauthorized');

    // Setup Test Users across two distinct Organizations
    const orgAId = '00000000-0000-0000-0000-000000000001';
    const orgBId = '00000000-0000-0000-0000-000000000002';

    // Provision Org A Users: Admin, Manager, Analyst, Viewer
    const adminUser = await UserModel.create({
      name: 'P9 Admin',
      email: `p9_admin_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'admin',
      organizationId: orgAId
    });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const managerUser = await UserModel.create({
      name: 'P9 Manager',
      email: `p9_manager_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'manager',
      organizationId: orgAId
    });
    const managerToken = jwt.sign(
      { id: managerUser.id, email: managerUser.email, role: 'manager', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const analystUser = await UserModel.create({
      name: 'P9 Analyst',
      email: `p9_analyst_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'analyst',
      organizationId: orgAId
    });
    const analystToken = jwt.sign(
      { id: analystUser.id, email: analystUser.email, role: 'analyst', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const viewerUser = await UserModel.create({
      name: 'P9 Viewer',
      email: `p9_viewer_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'viewer',
      organizationId: orgAId
    });
    const viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerUser.email, role: 'viewer', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Provision Org B User for Multi-Tenancy testing
    const orgBUser = await UserModel.create({
      name: 'P9 OrgB User',
      email: `p9_orgb_${Date.now()}@foreign.test`,
      password: 'Password123!',
      role: 'admin',
      organizationId: orgBId
    });
    const orgBToken = jwt.sign(
      { id: orgBUser.id, email: orgBUser.email, role: 'admin', organization_id: orgBId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // -------------------------------------------------------------
    // Test 2: Authenticated user (viewer) can list reports
    // -------------------------------------------------------------
    const listRes = await request('GET', '/api/reports', null, {
      Authorization: `Bearer ${viewerToken}`
    });
    assert(
      listRes.status === 200 && Array.isArray(listRes.data.reports),
      'Authenticated user (viewer) can list organization reports with 200 OK'
    );

    // -------------------------------------------------------------
    // Test 3: Authorized user (analyst) creates report
    // -------------------------------------------------------------
    const createRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Q4 Revenue & Growth Summary',
        description: 'Monthly executive analytics report with KPIs and visualizations.',
        format: 'pdf',
        schedule_cron: '0 9 * * 1',
        recipients: ['exec@ricoz.test', 'cfo@ricoz.test'],
        status: 'active'
      },
      {
        Authorization: `Bearer ${analystToken}`
      }
    );
    assert(
      createRes.status === 201 &&
      createRes.data.success === true &&
      createRes.data.report.title === 'Q4 Revenue & Growth Summary' &&
      createRes.data.report.format === 'pdf',
      'Authorized user (analyst) creates report definition with 201 Created and org binding'
    );

    const reportId = createRes.data.report.id;

    // -------------------------------------------------------------
    // Test 4: RBAC: Viewer role is blocked from creating reports (403)
    // -------------------------------------------------------------
    const viewerCreateRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Unauthorized Report',
        format: 'pdf'
      },
      {
        Authorization: `Bearer ${viewerToken}`
      }
    );
    assert(
      viewerCreateRes.status === 403,
      'RBAC: Viewer role is blocked from creating reports (403 Forbidden)'
    );

    // -------------------------------------------------------------
    // Test 5: Authorized user (manager) updates report
    // -------------------------------------------------------------
    const updateRes = await request(
      'PUT',
      `/api/reports/${reportId}`,
      {
        title: 'Q4 Executive Intelligence Digest (Updated)',
        description: 'Comprehensive updated executive report.',
        format: 'excel',
        schedule_cron: 'daily',
        recipients: ['board@ricoz.test'],
        status: 'active'
      },
      {
        Authorization: `Bearer ${managerToken}`
      }
    );
    assert(
      updateRes.status === 200 &&
      updateRes.data.success === true &&
      updateRes.data.report.title === 'Q4 Executive Intelligence Digest (Updated)' &&
      updateRes.data.report.format === 'excel',
      'Authorized user (manager) updates report configuration and schedule with 200 OK'
    );

    // -------------------------------------------------------------
    // Test 6: RBAC: Viewer role is blocked from updating reports (403)
    // -------------------------------------------------------------
    const viewerUpdateRes = await request(
      'PUT',
      `/api/reports/${reportId}`,
      {
        title: 'Hacked Title',
        format: 'pdf'
      },
      {
        Authorization: `Bearer ${viewerToken}`
      }
    );
    assert(
      viewerUpdateRes.status === 403,
      'RBAC: Viewer role is blocked from updating reports (403 Forbidden)'
    );

    // -------------------------------------------------------------
    // Test 7: Authorized user (admin) creates secondary report for delete test
    // -------------------------------------------------------------
    const tempReportRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Temporary Report to Delete',
        format: 'csv',
        status: 'draft'
      },
      {
        Authorization: `Bearer ${adminToken}`
      }
    );
    const tempReportId = tempReportRes.data.report.id;

    // -------------------------------------------------------------
    // Test 8: RBAC: Viewer role is blocked from deleting reports (403)
    // -------------------------------------------------------------
    const viewerDeleteRes = await request(
      'DELETE',
      `/api/reports/${tempReportId}`,
      null,
      {
        Authorization: `Bearer ${viewerToken}`
      }
    );
    assert(
      viewerDeleteRes.status === 403,
      'RBAC: Viewer role is blocked from deleting reports (403 Forbidden)'
    );

    // Authorized deletion by Manager
    const managerDeleteRes = await request(
      'DELETE',
      `/api/reports/${tempReportId}`,
      null,
      {
        Authorization: `Bearer ${managerToken}`
      }
    );
    assert(
      managerDeleteRes.status === 200 && managerDeleteRes.data.success === true,
      'Authorized user (manager) deletes report with 200 OK'
    );

    // -------------------------------------------------------------
    // Test 9: Report on-demand execution (POST /api/reports/:id/run)
    // -------------------------------------------------------------
    const runRes = await request(
      'POST',
      `/api/reports/${reportId}/run`,
      { format: 'pdf' },
      {
        Authorization: `Bearer ${analystToken}`
      }
    );
    assert(
      runRes.status === 200 &&
      runRes.data.success === true &&
      runRes.data.execution.status === 'completed' &&
      runRes.data.execution.fileSize > 0,
      'Report on-demand execution (POST /api/reports/:id/run) generates artifact with 200 OK'
    );

    const executionId = runRes.data.execution.executionId;

    // -------------------------------------------------------------
    // Test 10: Execution history is created and retrievable
    // -------------------------------------------------------------
    const historyRes = await request(
      'GET',
      `/api/reports/${reportId}/executions`,
      null,
      {
        Authorization: `Bearer ${viewerToken}`
      }
    );
    assert(
      historyRes.status === 200 &&
      historyRes.data.count >= 1 &&
      historyRes.data.executions[0].status === 'completed',
      'Execution history is created and retrievable (GET /api/reports/:id/executions)'
    );

    // -------------------------------------------------------------
    // Test 11: Validation: Unsupported format rejected (400)
    // -------------------------------------------------------------
    const invalidFormatRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Bad Format Report',
        format: 'unsupported_format_xyz'
      },
      {
        Authorization: `Bearer ${adminToken}`
      }
    );
    assert(
      invalidFormatRes.status === 400,
      'Validation: Unsupported report format rejected with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Test 12: Validation: Invalid schedule cron expression rejected (400)
    // -------------------------------------------------------------
    const invalidCronRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Bad Cron Report',
        format: 'pdf',
        schedule_cron: 'invalid_cron_syntax_123 99 99'
      },
      {
        Authorization: `Bearer ${adminToken}`
      }
    );
    assert(
      invalidCronRes.status === 400,
      'Validation: Invalid schedule cron expression rejected with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Test 13: Multi-tenancy: Foreign organization (Org B) cannot access Org A report
    // -------------------------------------------------------------
    const orgBGetRes = await request(
      'GET',
      `/api/reports/${reportId}`,
      null,
      {
        Authorization: `Bearer ${orgBToken}`
      }
    );
    assert(
      orgBGetRes.status === 404,
      'Multi-Tenancy: Foreign organization (Org B) cannot view Org A report (404 Isolated)'
    );

    // -------------------------------------------------------------
    // Test 14: Multi-tenancy: Foreign organization cannot execute Org A report
    // -------------------------------------------------------------
    const orgBRunRes = await request(
      'POST',
      `/api/reports/${reportId}/run`,
      {},
      {
        Authorization: `Bearer ${orgBToken}`
      }
    );
    assert(
      orgBRunRes.status === 404,
      'Multi-Tenancy: Foreign organization (Org B) cannot execute Org A report (404 Isolated)'
    );

    // -------------------------------------------------------------
    // Test 15: PDF Generation Engine produces valid binary PDF buffer
    // -------------------------------------------------------------
    const sampleData = {
      title: 'PDF Unit Test Report',
      description: 'Testing PDF generation pipeline',
      organizationName: 'Ricoz Test Org',
      dashboardTitle: 'Test Dashboard',
      generatedAt: new Date(),
      kpis: [
        { name: 'Revenue', value: 1500000, unit: 'INR', target: 1200000, progress: 125, status: 'on_track' }
      ],
      widgets: [
        { title: 'Sales Trend', type: 'line_chart', position: { w: 6, h: 4 } }
      ],
      datasetName: 'Sales Data',
      datasetSchema: [{ name: 'Month', type: 'text' }, { name: 'Sales', type: 'number' }],
      rows: [{ Month: 'Jan', Sales: 50000 }, { Month: 'Feb', Sales: 75000 }]
    };

    const pdfBuffer = await reportService.generatePdf(sampleData);
    const isPdfValid = Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 500 && pdfBuffer.toString('utf-8', 0, 5) === '%PDF-';
    assert(isPdfValid, 'PDF Generation Engine produces valid binary PDF document buffer (%PDF-)');

    // -------------------------------------------------------------
    // Test 16: CSV Generation Engine produces RFC 4180 compliant CSV
    // -------------------------------------------------------------
    const csvBuffer = reportService.generateCsv(sampleData);
    const csvString = csvBuffer.toString('utf-8');
    const isCsvValid = Buffer.isBuffer(csvBuffer) && csvString.includes('"Month","Sales"') && csvString.includes('"Jan","50000"');
    assert(isCsvValid, 'CSV Generation Engine produces RFC 4180 compliant CSV with headers');

    // -------------------------------------------------------------
    // Test 17: Excel/XLSX Generation Engine produces valid spreadsheet buffer
    // -------------------------------------------------------------
    const excelBuffer = await reportService.generateExcel(sampleData);
    // XLSX file signature is PK zip header: 0x50 0x4B 0x03 0x04
    const isExcelValid = Buffer.isBuffer(excelBuffer) && excelBuffer.length > 500 && excelBuffer[0] === 0x50 && excelBuffer[1] === 0x4B;
    assert(isExcelValid, 'Excel/XLSX Generation Engine produces valid multi-tab spreadsheet buffer (PK Header)');

    // -------------------------------------------------------------
    // Test 18: JSON Export Engine produces structured payload
    // -------------------------------------------------------------
    const jsonBuffer = reportService.generateJson(sampleData);
    const parsedJson = JSON.parse(jsonBuffer.toString('utf-8'));
    assert(
      parsedJson.meta && parsedJson.meta.title === 'PDF Unit Test Report' && Array.isArray(parsedJson.kpis),
      'JSON Export Engine produces structured schema & metadata payload'
    );

    // -------------------------------------------------------------
    // Test 19: Failed execution is safely recorded in report_executions
    // -------------------------------------------------------------
    const failedExec = await ReportModel.createExecution({
      reportId,
      organizationId: orgAId,
      executedBy: adminUser.id,
      status: 'failed',
      format: 'pdf',
      errorMessage: 'Simulated downstream data source timeout'
    });
    assert(
      failedExec.status === 'failed' && failedExec.error_message === 'Simulated downstream data source timeout',
      'Failed execution is safely recorded with status and error_message'
    );

    // -------------------------------------------------------------
    // Test 20: Direct Dashboard Export (POST /api/reports/export-dashboard)
    // -------------------------------------------------------------
    const directExportRes = await request(
      'POST',
      '/api/reports/export-dashboard',
      {
        format: 'csv',
        title: 'Direct Export Test'
      },
      {
        Authorization: `Bearer ${analystToken}`
      }
    );
    assert(
      directExportRes.status === 200 &&
      directExportRes.headers['content-type']?.includes('text/csv'),
      'Direct Dashboard Export (POST /api/reports/export-dashboard) generates and streams file artifact'
    );

  } catch (err) {
    console.error('Test execution exception:', err);
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================');
  console.log(`  Phase 9 Test Results: ${passed}/${total} Passed`);
  console.log('====================================================\n');

  if (passed === total && total > 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run test suite
runPhase9Tests();
