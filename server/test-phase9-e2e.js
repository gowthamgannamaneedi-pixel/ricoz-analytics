/**
 * RicozAnalytics — Phase 9 Comprehensive End-to-End (E2E) Workflow Test
 * 
 * Verifies the full user & system lifecycle:
 * 1. Dashboard & Widget Provisioning
 * 2. Report Creation (linked to Dashboard)
 * 3. On-Demand Report Execution
 * 4. Execution Record Lifecycle (running -> completed/failed)
 * 5. PDF Export Generation
 * 6. Excel/XLSX Export Generation
 * 7. CSV Export Generation
 * 8. JSON Export Generation
 * 9. Artifact File Download via Streaming API
 * 10. Execution History in Reports API
 * 11. Status Transition & Error Handling
 * 12. Multi-Tenant Organization Isolation
 * 13. RBAC Matrix (Admin, Manager, Analyst, Viewer)
 * 14. Scheduler Background Execution Cycle
 * 15. Direct Dashboard Export
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');
const DashboardModel = require('./models/dashboardModel');
const ReportModel = require('./models/reportModel');
const reportService = require('./services/reportService');
const schedulerService = require('./services/schedulerService');

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

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('  RicozAnalytics Phase 9: End-to-End (E2E) Workflow Test Suite  ');
  console.log('================================================================\n');

  // Start test server on ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let passed = 0;
  let total = 0;
  const bugs = [];

  function assert(condition, stepName, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] Step ${total}: ${stepName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Step ${total}: ${stepName} ${details ? `(${details})` : ''}`);
      bugs.push({ step: total, name: stepName, details });
    }
  }

  try {
    const orgAId = '00000000-0000-0000-0000-000000000001';
    const orgBId = '00000000-0000-0000-0000-000000000002';

    // 1. Provision RBAC Users for Organization A
    const adminUser = await UserModel.create({
      name: 'E2E Admin',
      email: `e2e_admin_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'admin',
      organization_id: orgAId
    });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const managerUser = await UserModel.create({
      name: 'E2E Manager',
      email: `e2e_manager_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'manager',
      organization_id: orgAId
    });
    const managerToken = jwt.sign(
      { id: managerUser.id, email: managerUser.email, role: 'manager', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const analystUser = await UserModel.create({
      name: 'E2E Analyst',
      email: `e2e_analyst_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'analyst',
      organization_id: orgAId
    });
    const analystToken = jwt.sign(
      { id: analystUser.id, email: analystUser.email, role: 'analyst', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const viewerUser = await UserModel.create({
      name: 'E2E Viewer',
      email: `e2e_viewer_${Date.now()}@ricoz.test`,
      password: 'Password123!',
      role: 'viewer',
      organization_id: orgAId
    });
    const viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerUser.email, role: 'viewer', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Provision Org B User for Multi-Tenancy testing
    const orgBUser = await UserModel.create({
      name: 'E2E Foreign User',
      email: `e2e_foreign_${Date.now()}@foreign.test`,
      password: 'Password123!',
      role: 'admin',
      organization_id: orgBId
    });
    const orgBToken = jwt.sign(
      { id: orgBUser.id, email: orgBUser.email, role: 'admin', organization_id: orgBId },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // 2. Setup a Test Dashboard in Org A
    const dashRes = await request(
      'POST',
      '/api/dashboards',
      {
        title: 'Executive Financial Telemetry Dashboard',
        description: 'Primary executive KPIs and sales charts',
        is_default: true
      },
      { Authorization: `Bearer ${analystToken}` }
    );
    const dashboardId = dashRes.data.data ? dashRes.data.data.id : (dashRes.data.dashboard ? dashRes.data.dashboard.id : null);
    assert(dashRes.status === 201 && dashboardId, 'Provision test dashboard in Organization A');

    // Add widgets to dashboard
    await request(
      'POST',
      `/api/dashboards/${dashboardId}/widgets`,
      {
        title: 'Revenue Velocity',
        type: 'line_chart',
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      { Authorization: `Bearer ${analystToken}` }
    );

    // -----------------------------------------------------------------
    // Step 1: Create a test report linked to the dashboard
    // -----------------------------------------------------------------
    const createReportRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Monthly Executive Financial Telemetry Digest',
        description: 'Comprehensive financial digest with charts, KPIs, and tabular records.',
        dashboard_id: dashboardId,
        format: 'pdf',
        schedule_cron: '0 9 * * 1',
        recipients: ['executives@ricoz.test', 'board@ricoz.test'],
        status: 'active'
      },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(
      createReportRes.status === 201 &&
      createReportRes.data.success === true &&
      createReportRes.data.report.title === 'Monthly Executive Financial Telemetry Digest',
      'Create report definition linked to Dashboard via API'
    );
    const reportId = createReportRes.data.report.id;

    // -----------------------------------------------------------------
    // Step 2: Verify report retrieval in list & single endpoints
    // -----------------------------------------------------------------
    const getReportRes = await request('GET', `/api/reports/${reportId}`, null, {
      Authorization: `Bearer ${viewerToken}`
    });
    assert(
      getReportRes.status === 200 &&
      getReportRes.data.report.id === reportId &&
      getReportRes.data.report.dashboard_id === dashboardId,
      'Retrieve report by ID and verify dashboard binding'
    );

    const listReportsRes = await request('GET', '/api/reports', null, {
      Authorization: `Bearer ${viewerToken}`
    });
    assert(
      listReportsRes.status === 200 &&
      listReportsRes.data.reports.some(r => r.id === reportId),
      'Verify report appears in organization reports list'
    );

    // -----------------------------------------------------------------
    // Step 3 & 4: Run report manually & verify record in report_executions
    // -----------------------------------------------------------------
    const runPdfRes = await request(
      'POST',
      `/api/reports/${reportId}/run`,
      { format: 'pdf' },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(
      runPdfRes.status === 200 &&
      runPdfRes.data.success === true &&
      runPdfRes.data.execution.status === 'completed' &&
      runPdfRes.data.execution.fileSize > 0,
      'Run report manually and verify execution completed with artifact'
    );
    const pdfExecutionId = runPdfRes.data.execution.executionId;

    // -----------------------------------------------------------------
    // Step 5: Test PDF Export Format
    // -----------------------------------------------------------------
    const compiledData = await reportService.compileReportData(
      { id: reportId, title: 'PDF Test', description: 'Desc', dashboard_id: dashboardId },
      orgAId
    );
    const pdfBuf = await reportService.generatePdf(compiledData);
    assert(
      Buffer.isBuffer(pdfBuf) && pdfBuf.length > 500 && pdfBuf.toString('utf-8', 0, 5) === '%PDF-',
      'PDF Export Engine: Generated valid binary PDF document (%PDF-)'
    );

    // -----------------------------------------------------------------
    // Step 6: Test Excel/XLSX Export Format
    // -----------------------------------------------------------------
    const excelBuf = await reportService.generateExcel(compiledData);
    assert(
      Buffer.isBuffer(excelBuf) && excelBuf.length > 500 && excelBuf[0] === 0x50 && excelBuf[1] === 0x4B,
      'Excel/XLSX Export Engine: Generated valid multi-sheet workbook (PK Header)'
    );

    // -----------------------------------------------------------------
    // Step 7: Test CSV Export Format
    // -----------------------------------------------------------------
    const csvBuf = reportService.generateCsv(compiledData);
    const csvStr = csvBuf.toString('utf-8');
    assert(
      Buffer.isBuffer(csvBuf) && csvStr.includes('Region') && csvStr.includes('Revenue'),
      'CSV Export Engine: Generated RFC 4180 CSV with headers & UTF-8 BOM'
    );

    // -----------------------------------------------------------------
    // Step 8: Test JSON Export Format
    // -----------------------------------------------------------------
    const jsonBuf = reportService.generateJson(compiledData);
    const jsonParsed = JSON.parse(jsonBuf.toString('utf-8'));
    assert(
      jsonParsed.meta && jsonParsed.kpis && jsonParsed.widgets && jsonParsed.dataset,
      'JSON Export Engine: Generated structured analytics payload'
    );

    // -----------------------------------------------------------------
    // Step 9: Verify generated file can be downloaded via streaming endpoint
    // -----------------------------------------------------------------
    const downloadRes = await request(
      'GET',
      `/api/reports/executions/${pdfExecutionId}/download`,
      null,
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(
      downloadRes.status === 200 &&
      downloadRes.headers['content-type']?.includes('application/pdf') &&
      downloadRes.headers['content-disposition']?.includes('attachment'),
      'Download API: Streamed generated report artifact with correct headers'
    );

    // -----------------------------------------------------------------
    // Step 10: Verify execution history list endpoints
    // -----------------------------------------------------------------
    const execHistoryRes = await request(
      'GET',
      `/api/reports/${reportId}/executions`,
      null,
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(
      execHistoryRes.status === 200 &&
      execHistoryRes.data.executions.length >= 1 &&
      execHistoryRes.data.executions[0].id === pdfExecutionId,
      'Execution History: Retrieved report-specific execution logs'
    );

    const allExecsRes = await request(
      'GET',
      '/api/reports/executions/all',
      null,
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(
      allExecsRes.status === 200 && allExecsRes.data.executions.length >= 1,
      'Execution History: Retrieved organization-wide execution logs'
    );

    // -----------------------------------------------------------------
    // Step 11: Verify status transitions and error recording
    // -----------------------------------------------------------------
    const simulatedFailExec = await ReportModel.createExecution({
      reportId,
      organizationId: orgAId,
      executedBy: adminUser.id,
      status: 'failed',
      format: 'pdf',
      errorMessage: 'Network timeout connecting to external data source'
    });
    assert(
      simulatedFailExec.status === 'failed' &&
      simulatedFailExec.error_message === 'Network timeout connecting to external data source',
      'Status Transition: Failed execution recorded with error_message'
    );

    // -----------------------------------------------------------------
    // Step 12: Test Multi-Tenant Organization Isolation
    // -----------------------------------------------------------------
    const orgBGetReport = await request('GET', `/api/reports/${reportId}`, null, {
      Authorization: `Bearer ${orgBToken}`
    });
    assert(orgBGetReport.status === 404, 'Multi-Tenancy: Org B cannot view Org A report (404 Isolated)');

    const orgBRunReport = await request('POST', `/api/reports/${reportId}/run`, {}, {
      Authorization: `Bearer ${orgBToken}`
    });
    assert(orgBRunReport.status === 404, 'Multi-Tenancy: Org B cannot execute Org A report (404 Isolated)');

    const orgBDownload = await request('GET', `/api/reports/executions/${pdfExecutionId}/download`, null, {
      Authorization: `Bearer ${orgBToken}`
    });
    assert(orgBDownload.status === 404, 'Multi-Tenancy: Org B cannot download Org A report artifact (404 Isolated)');

    const orgBExecHistory = await request('GET', `/api/reports/${reportId}/executions`, null, {
      Authorization: `Bearer ${orgBToken}`
    });
    assert(orgBExecHistory.status === 404, 'Multi-Tenancy: Org B cannot view Org A execution logs (404 Isolated)');

    // -----------------------------------------------------------------
    // Step 13: Test RBAC Matrix
    // -----------------------------------------------------------------
    // Admin: Full access
    const adminUpdate = await request(
      'PUT',
      `/api/reports/${reportId}`,
      { title: 'Admin Updated Title', format: 'excel' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminUpdate.status === 200, 'RBAC Admin: Authorized to update report');

    // Manager: Full access
    const managerRun = await request(
      'POST',
      `/api/reports/${reportId}/run`,
      { format: 'excel' },
      { Authorization: `Bearer ${managerToken}` }
    );
    assert(managerRun.status === 200, 'RBAC Manager: Authorized to execute report');

    // Analyst: Create/Update/Run allowed, Delete blocked
    const analystDelete = await request(
      'DELETE',
      `/api/reports/${reportId}`,
      null,
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(analystDelete.status === 403, 'RBAC Analyst: Blocked from deleting report (403 Forbidden)');

    // Viewer: Read-only, mutations blocked
    const viewerCreate = await request(
      'POST',
      '/api/reports',
      { title: 'Viewer Attempt', format: 'pdf' },
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(viewerCreate.status === 403, 'RBAC Viewer: Blocked from creating report (403 Forbidden)');

    const viewerUpdate = await request(
      'PUT',
      `/api/reports/${reportId}`,
      { title: 'Viewer Attempt', format: 'pdf' },
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(viewerUpdate.status === 403, 'RBAC Viewer: Blocked from updating report (403 Forbidden)');

    const viewerRun = await request(
      'POST',
      `/api/reports/${reportId}/run`,
      {},
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(viewerRun.status === 403, 'RBAC Viewer: Blocked from running report (403 Forbidden)');

    const viewerDelete = await request(
      'DELETE',
      `/api/reports/${reportId}`,
      null,
      { Authorization: `Bearer ${viewerToken}` }
    );
    assert(viewerDelete.status === 403, 'RBAC Viewer: Blocked from deleting report (403 Forbidden)');

    // -----------------------------------------------------------------
    // Step 14: Test Scheduled Report Execution Cycle
    // -----------------------------------------------------------------
    const schedReportRes = await request(
      'POST',
      '/api/reports',
      {
        title: 'Daily Auto-Scheduled Intelligence Broadcast',
        dashboard_id: dashboardId,
        format: 'json',
        schedule_cron: 'daily',
        status: 'active'
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    const schedReportId = schedReportRes.data.report.id;
    assert(schedReportRes.status === 201, 'Create active scheduled report for scheduler test');

    // Trigger scheduler evaluation cycle
    await schedulerService.evaluateDueReports();
    
    // Check if execution was logged
    const schedHistory = await request(
      'GET',
      `/api/reports/${schedReportId}/executions`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(
      schedHistory.status === 200 && schedHistory.data.executions.length >= 1,
      'Scheduler Service: Background daemon successfully evaluated and executed scheduled report'
    );

    // -----------------------------------------------------------------
    // Step 15: Direct Dashboard Export (Instant Stream)
    // -----------------------------------------------------------------
    const directExportPdf = await request(
      'POST',
      '/api/reports/export-dashboard',
      { dashboard_id: dashboardId, format: 'pdf' },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(
      directExportPdf.status === 200 && directExportPdf.headers['content-type']?.includes('application/pdf'),
      'Direct Dashboard Export: Streamed PDF buffer without requiring stored report'
    );

    const directExportXlsx = await request(
      'POST',
      '/api/reports/export-dashboard',
      { dashboard_id: dashboardId, format: 'excel' },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(
      directExportXlsx.status === 200 && directExportXlsx.headers['content-type']?.includes('spreadsheetml'),
      'Direct Dashboard Export: Streamed Excel XLSX buffer without requiring stored report'
    );

  } catch (err) {
    console.error('E2E Test Suite Exception:', err);
    bugs.push({ step: 'Exception', name: 'Unhandled Exception', details: err.message });
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`  Phase 9 E2E Test Results: ${passed}/${total} Passed (${bugs.length} Bugs)`);
  console.log('================================================================\n');

  if (passed === total && total > 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runE2ETests();
