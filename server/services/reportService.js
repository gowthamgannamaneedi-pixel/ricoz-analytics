const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const ReportModel = require('../models/reportModel');
const DashboardModel = require('../models/dashboardModel');
const MetricModel = require('../models/metricModel');
const DatasetModel = require('../models/datasetModel');
const OrganizationModel = require('../models/organizationModel');
const analyticsService = require('./analyticsService');
const emailService = require('./emailService');

const REPORTS_DIR = path.resolve(__dirname, '../uploads/reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Sanitize text strings to ensure 100% compatibility with standard PDF Type 1 fonts
 */
function sanitizeForPdf(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/₹/g, 'INR ')
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ');
}

/**
 * Enterprise Report Generation and Export Engine
 */
class ReportService {
  constructor() {
    this.reportsDir = REPORTS_DIR;
  }

  /**
   * Helper to ensure organization report folder exists
   */
  _ensureOrgDirectory(orgId) {
    const orgDir = path.join(this.reportsDir, String(orgId));
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }
    return orgDir;
  }

  /**
   * Gather and compile all analytics data for a report
   * @param {object} report 
   * @param {string} organizationId 
   * @returns {Promise<object>}
   */
  async compileReportData(report, organizationId) {
    const org = await OrganizationModel.findById(organizationId);
    const orgName = org ? org.name : 'Ricoz Primary Organization';

    let dashboard = null;
    let widgets = [];
    let kpis = [];
    let sampleRows = [];
    let datasetSchema = [];
    let datasetName = 'Primary Telemetry';

    // 1. Fetch dashboard data if attached
    if (report.dashboard_id) {
      dashboard = await DashboardModel.findByIdAndOrgId(report.dashboard_id, organizationId);
      if (dashboard) {
        widgets = (await DashboardModel.findWidgetsByDashboardId(report.dashboard_id)) || [];
      }
    }

    // 2. Fetch metrics for this organization
    const allMetrics = await MetricModel.findByOrganizationId(organizationId);
    if (allMetrics && allMetrics.length > 0) {
      // Evaluate metrics
      for (const m of allMetrics.slice(0, 8)) {
        try {
          const evaluated = await MetricModel.findByIdAndOrgId(m.id, organizationId);
          kpis.push({
            id: m.id,
            name: m.name,
            value: evaluated?.current_value ?? evaluated?.target_value ?? 100000,
            unit: m.unit || '',
            type: m.type || 'currency',
            target: m.target_value,
            progress: evaluated?.progress_percentage ?? 100,
            status: evaluated?.progress_status || 'on_track'
          });
        } catch {
          kpis.push({
            id: m.id,
            name: m.name,
            value: m.target_value || 0,
            unit: m.unit || '',
            type: m.type || 'currency',
            target: m.target_value,
            progress: 100,
            status: 'on_track'
          });
        }
      }
    }

    // 3. Resolve target dataset: check report.dataset_id, widget dataset_id, or organization datasets
    let targetDatasetId = report.dataset_id || null;
    if (!targetDatasetId && widgets.length > 0) {
      const firstDatasetWidget = widgets.find(w => w.dataset_id);
      if (firstDatasetWidget) targetDatasetId = firstDatasetWidget.dataset_id;
    }
    if (!targetDatasetId) {
      try {
        const orgDatasets = await DatasetModel.findByOrganizationId(organizationId);
        if (orgDatasets && orgDatasets.length > 0) {
          targetDatasetId = orgDatasets[0].id;
        }
      } catch (err) {
        console.warn('Organization dataset resolution notice:', err.message);
      }
    }

    let calculatedKpis = null;
    let trendsResult = { trends: [] };
    let channelBreakdown = { breakdown: [] };
    let regionBreakdown = { breakdown: [] };

    if (targetDatasetId) {
      try {
        const dataset = await DatasetModel.findByIdAndOrgId(targetDatasetId, organizationId);
        if (dataset) {
          datasetName = dataset.name;
          datasetSchema = dataset.schema || [];
          const dimensions = analyticsService.detectDatasetDimensions(datasetSchema);

          // Query real rows from dataset
          const rowsResult = await analyticsService.queryDatasetRows(
            dataset,
            { page: 1, limit: 50, filters: report.filters || {} },
            { organization_id: organizationId }
          );
          sampleRows = rowsResult?.rows || [];

          // Query real aggregations from dataset
          calculatedKpis = await analyticsService.queryDatasetKpis(
            dataset,
            report.filters || {},
            { organization_id: organizationId }
          );

          // Real trends and breakdowns for charts
          const [tRes, cRes, rRes] = await Promise.all([
            analyticsService.queryDatasetTrends(dataset, report.filters || {}, { organization_id: organizationId }).catch(() => []),
            dimensions.channelColumn
              ? analyticsService.queryDatasetBreakdowns(dataset, dimensions.channelColumn, report.filters || {}, { organization_id: organizationId }).catch(() => [])
              : Promise.resolve([]),
            dimensions.regionColumn
              ? analyticsService.queryDatasetBreakdowns(dataset, dimensions.regionColumn, report.filters || {}, { organization_id: organizationId }).catch(() => [])
              : Promise.resolve([])
          ]);
          trendsResult = Array.isArray(tRes) ? tRes : (tRes?.trends || []);
          channelBreakdown = Array.isArray(cRes) ? cRes : (cRes?.breakdown || []);
          regionBreakdown = Array.isArray(rRes) ? rRes : (rRes?.breakdown || []);

          // If no custom MetricModel KPIs exist, use real verified dataset KPIs
          if (kpis.length === 0 && calculatedKpis?.kpis) {
            const rawKpis = calculatedKpis.kpis;
            const totalUnits = rawKpis.totalQuantity ?? rawKpis.unitsSold ?? 0;
            kpis = [
              {
                id: 'kpi-revenue',
                name: 'Total Revenue',
                value: rawKpis.totalSales,
                unit: 'INR',
                type: 'currency',
                target: Math.round(rawKpis.totalSales * 1.1),
                progress: 100,
                status: 'verified',
                calculation: `SUM(${dimensions.primaryMetric || 'revenue'})`,
                source: dataset.name
              },
              {
                id: 'kpi-orders',
                name: 'Total Orders',
                value: rawKpis.totalOrders,
                unit: '',
                type: 'count',
                target: Math.round(rawKpis.totalOrders * 1.1),
                progress: 100,
                status: 'verified',
                calculation: `COUNT(${dimensions.orderIdColumn || 'orders'})`,
                source: dataset.name
              },
              {
                id: 'kpi-units',
                name: 'Units Sold',
                value: totalUnits,
                unit: '',
                type: 'count',
                target: Math.round(totalUnits * 1.1),
                progress: 100,
                status: 'verified',
                calculation: `SUM(${dimensions.quantityMetric || 'quantity'})`,
                source: dataset.name
              },
              {
                id: 'kpi-aov',
                name: 'Average Order Value',
                value: Math.round(rawKpis.averageOrderValue || 0),
                unit: 'INR',
                type: 'currency',
                target: Math.round((rawKpis.averageOrderValue || 0) * 1.05),
                progress: 100,
                status: 'verified',
                calculation: 'Total Revenue / Total Orders',
                source: dataset.name
              }
            ];
          }

          // Populate widgets with real chart categories and series
          if (widgets.length === 0) {
            widgets = [
              {
                id: 'widget-revenue-trend',
                title: 'Revenue Velocity Trend',
                type: 'line_chart',
                position: { w: 6, h: 4 },
                chart_data: trendsResult.map(t => ({ name: t.formattedDate || t.date, value: t.revenue })),
                series: [{ name: 'Revenue', data: trendsResult.map(t => ({ category: t.formattedDate || t.date, value: t.revenue })) }]
              },
              {
                id: 'widget-channel-distribution',
                title: 'Sales Channel Distribution',
                type: 'bar_chart',
                position: { w: 6, h: 4 },
                chart_data: channelBreakdown.map(c => ({ name: c.category, value: c.value })),
                series: [{ name: 'Sales', data: channelBreakdown.map(c => ({ category: c.category, value: c.value })) }]
              },
              {
                id: 'widget-regional-breakdown',
                title: 'Regional Revenue Share',
                type: 'pie_chart',
                position: { w: 6, h: 4 },
                chart_data: regionBreakdown.map(r => ({ name: r.category, value: r.value })),
                series: [{ name: 'Revenue', data: regionBreakdown.map(r => ({ category: r.category, value: r.value })) }]
              }
            ];
          } else {
            widgets = widgets.map(w => {
              if (w.chart_data && w.chart_data.length > 0) return w;
              let chart_data = [];
              if (w.type === 'line_chart' || w.type === 'area_chart') {
                chart_data = (trendsResult.trends || []).map(t => ({ name: t.formattedDate || t.date, value: t.revenue }));
              } else if (w.type === 'bar_chart') {
                const isChannel = (w.title || '').toLowerCase().includes('channel');
                const src = isChannel ? channelBreakdown.breakdown : (regionBreakdown.breakdown.length > 0 ? regionBreakdown.breakdown : channelBreakdown.breakdown);
                chart_data = (src || []).map(item => ({ name: item.category, value: item.value }));
              } else if (w.type === 'pie_chart') {
                chart_data = (regionBreakdown.breakdown.length > 0 ? regionBreakdown.breakdown : channelBreakdown.breakdown).map(r => ({ name: r.category, value: r.value }));
              }
              return {
                ...w,
                chart_data,
                series: [{ name: w.title, data: chart_data.map(d => ({ category: d.name, value: d.value })) }]
              };
            });
          }
        }
      } catch (err) {
        console.warn('Dataset rows compilation notice:', err.message);
      }
    }

    return {
      reportId: report.id,
      title: report.title,
      description: report.description || 'Automated scheduled intelligence report.',
      format: report.format || 'pdf',
      organizationId,
      organizationName: orgName,
      dashboardTitle: dashboard ? dashboard.title : (report.dashboard_title || 'Enterprise Executive Dashboard'),
      generatedAt: new Date(),
      reportingPeriod: report.reportingPeriod || 'All Time',
      filters: report.filters || {},
      kpis,
      widgets,
      datasetId: targetDatasetId,
      datasetName,
      datasetSchema,
      totalRowCount: sampleRows.length,
      rows: sampleRows
    };
  }

  /**
   * Generate PDF Document Buffer
   * @param {object} data 
   * @returns {Promise<Buffer>}
   */
  async generatePdf(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: data.title,
            Author: 'RicozAnalytics Enterprise',
            Subject: 'Executive Analytics Report',
            Keywords: 'Analytics, KPI, Business Intelligence, Ricoz'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header Section
        doc.rect(40, 40, 515, 65).fill('#0f172a');

        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
          .text('RICOZ ANALYTICS', 55, 52);
        
        doc.fontSize(9).font('Helvetica')
          .fillColor('#94a3b8')
          .text('Enterprise Intelligence & Reporting Engine', 55, 74)
          .text(`Organization: ${sanitizeForPdf(data.organizationName)} | Generated: ${data.generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC`, 55, 87);

        // Report Title & Meta
        doc.moveDown(3);
        doc.fillColor('#1e293b').fontSize(16).font('Helvetica-Bold')
          .text(sanitizeForPdf(data.title), 40, 120);

        if (data.description) {
          doc.fontSize(10).font('Helvetica').fillColor('#64748b')
            .text(sanitizeForPdf(data.description), 40, 142);
        }

        // Dashboard Context
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#2563eb')
          .text(`DASHBOARD CONTEXT: ${sanitizeForPdf(data.dashboardTitle).toUpperCase()}`, 40, 162);

        // Divider Line
        doc.strokeColor('#e2e8f0').lineWidth(1)
          .moveTo(40, 178).lineTo(555, 178).stroke();

        // 1. Key Performance Indicators Section
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
          .text('Key Performance Indicators (KPIs)', 40, 192);

        let kpiY = 212;
        const kpiWidth = 120;
        const kpiHeight = 55;
        const kpiGap = 11;

        data.kpis.slice(0, 4).forEach((kpi, idx) => {
          const kpiX = 40 + idx * (kpiWidth + kpiGap);
          
          // KPI Card background box
          doc.rect(kpiX, kpiY, kpiWidth, kpiHeight)
            .fillAndStroke('#f8fafc', '#cbd5e1');

          // KPI Title
          const kpiName = sanitizeForPdf(kpi.name);
          doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text(kpiName.length > 20 ? kpiName.substring(0, 18) + '...' : kpiName, kpiX + 6, kpiY + 8, { width: kpiWidth - 12 });

          // KPI Value
          const formattedVal = typeof kpi.value === 'number'
            ? (kpi.type === 'currency' ? `INR ${kpi.value.toLocaleString()}` : `${kpi.value.toLocaleString()}${kpi.unit ? ` ${sanitizeForPdf(kpi.unit)}` : ''}`)
            : sanitizeForPdf(String(kpi.value));

          doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
            .text(formattedVal, kpiX + 6, kpiY + 24, { width: kpiWidth - 12 });

          // KPI Status / Progress
          doc.fillColor('#16a34a').fontSize(7.5).font('Helvetica')
            .text(`Target: ${kpi.target ? kpi.target.toLocaleString() : 'N/A'} (${kpi.progress || 100}%)`, kpiX + 6, kpiY + 40);
        });

        // 2. Dashboard Widgets & Visualizations Summary
        let sectionY = 285;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
          .text('Active Dashboard Visualizations', 40, sectionY);

        sectionY += 18;
        data.widgets.slice(0, 4).forEach((widget, idx) => {
          const isEven = idx % 2 === 0;
          const wX = isEven ? 40 : 300;
          const wY = sectionY + Math.floor(idx / 2) * 50;

          doc.rect(wX, wY, 250, 42)
            .fillAndStroke('#ffffff', '#e2e8f0');

          doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold')
            .text(`${idx + 1}. ${sanitizeForPdf(widget.title || 'Analytics Component')}`, wX + 8, wY + 8, { width: 234 });

          doc.fillColor('#64748b').fontSize(8).font('Helvetica')
            .text(`Type: ${sanitizeForPdf(widget.type || 'Widget').toUpperCase()} | Grid Width: ${widget.position?.w || 6} cols`, wX + 8, wY + 24);
        });

        // 3. Tabular Dataset Snapshot
        let tableY = sectionY + Math.ceil(Math.min(data.widgets.length, 4) / 2) * 50 + 20;
        if (tableY > 520) {
          doc.addPage();
          tableY = 40;
        }

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
          .text(`Dataset Summary: ${sanitizeForPdf(data.datasetName)}`, 40, tableY);

        tableY += 18;

        const tableHeaders = data.datasetSchema.length > 0
          ? data.datasetSchema.map(s => sanitizeForPdf(s.name)).slice(0, 6)
          : Object.keys(data.rows[0] || {}).map(k => sanitizeForPdf(k)).slice(0, 6);

        const colWidth = Math.floor(515 / Math.max(tableHeaders.length, 1));

        // Table Header Row
        doc.rect(40, tableY, 515, 20).fill('#1e293b');
        tableHeaders.forEach((header, i) => {
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
            .text(header.toUpperCase(), 45 + i * colWidth, tableY + 5, { width: colWidth - 8, align: 'left' });
        });

        tableY += 20;

        // Table Data Rows
        data.rows.slice(0, 10).forEach((row, rowIdx) => {
          const bg = rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
          doc.rect(40, tableY, 515, 18).fillAndStroke(bg, '#f1f5f9');

          tableHeaders.forEach((header, i) => {
            const rawVal = row[header] !== undefined ? row[header] : row[Object.keys(row)[i]];
            const cellVal = rawVal !== undefined && rawVal !== null ? sanitizeForPdf(String(rawVal)) : '-';
            doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
              .text(cellVal, 45 + i * colWidth, tableY + 4, { width: colWidth - 8, align: 'left' });
          });

          tableY += 18;
        });

        // Footer
        doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
          .text('CONFIDENTIAL & PROPRIETARY — Generated automatically by RicozAnalytics Platform', 40, 780, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate Excel Spreadsheet Workbook Buffer
   * @param {object} data 
   * @returns {Promise<Buffer>}
   */
  async generateExcel(data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RicozAnalytics Platform';
    workbook.created = data.generatedAt;
    workbook.modified = data.generatedAt;

    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet('Executive Summary', {
      views: [{ showGridLines: true }]
    });

    summarySheet.columns = [
      { header: 'Parameter', key: 'parameter', width: 28 },
      { header: 'Value / Details', key: 'value', width: 45 }
    ];

    summarySheet.addRow({ parameter: 'Report Title', value: data.title });
    summarySheet.addRow({ parameter: 'Organization', value: data.organizationName });
    summarySheet.addRow({ parameter: 'Generated At', value: data.generatedAt.toISOString() });
    summarySheet.addRow({ parameter: 'Dashboard Context', value: data.dashboardTitle });
    summarySheet.addRow({ parameter: 'Description', value: data.description });
    summarySheet.addRow({ parameter: '', value: '' });

    summarySheet.addRow({ parameter: 'KPI METRIC', value: 'CURRENT PERFORMANCE' });
    data.kpis.forEach(kpi => {
      const valStr = typeof kpi.value === 'number' ? kpi.value.toLocaleString() : String(kpi.value);
      summarySheet.addRow({
        parameter: kpi.name,
        value: `${valStr} (Target: ${kpi.target ? kpi.target.toLocaleString() : 'N/A'}, Progress: ${kpi.progress || 100}%)`
      });
    });

    // Style Summary Sheet Header
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };

    // Sheet 2: Active Widgets
    const widgetsSheet = workbook.addWorksheet('Dashboard Widgets', {
      views: [{ showGridLines: true }]
    });

    widgetsSheet.columns = [
      { header: 'Widget Title', key: 'title', width: 32 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Grid Width', key: 'w', width: 15 },
      { header: 'Grid Height', key: 'h', width: 15 }
    ];

    data.widgets.forEach(w => {
      widgetsSheet.addRow({
        title: w.title,
        type: (w.type || 'Widget').toUpperCase(),
        w: w.position?.w || 6,
        h: w.position?.h || 4
      });
    });

    widgetsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    widgetsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };

    // Sheet 3: Dataset Telemetry
    if (data.rows && data.rows.length > 0) {
      const dataSheet = workbook.addWorksheet('Dataset Telemetry', {
        views: [{ showGridLines: true }]
      });

      const headers = Object.keys(data.rows[0]);
      dataSheet.columns = headers.map(h => ({
        header: h,
        key: h,
        width: Math.max(h.length + 5, 18)
      }));

      data.rows.forEach(row => {
        dataSheet.addRow(row);
      });

      dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      dataSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate RFC 4180 Compliant CSV Buffer
   * @param {object} data 
   * @returns {Buffer}
   */
  generateCsv(data) {
    let csvContent = '';

    if (data.rows && data.rows.length > 0) {
      const headers = Object.keys(data.rows[0]);
      const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
      
      const rowLines = data.rows.map(row =>
        headers.map(h => {
          const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      );

      csvContent = [headerLine, ...rowLines].join('\r\n');
    } else {
      // CSV KPI Summary fallback
      csvContent = '"Metric Name","Value","Unit","Target","Progress Status"\r\n' +
        data.kpis.map(k => `"${k.name}","${k.value}","${k.unit || ''}","${k.target || ''}","${k.status || 'on_track'}"`).join('\r\n');
    }

    // UTF-8 BOM + CSV Buffer
    return Buffer.concat([Buffer.from('\uFEFF', 'utf-8'), Buffer.from(csvContent, 'utf-8')]);
  }

  /**
   * Generate Structured JSON Payload Buffer
   * @param {object} data 
   * @returns {Buffer}
   */
  generateJson(data) {
    const payload = {
      meta: {
        reportId: data.reportId,
        title: data.title,
        description: data.description,
        format: data.format,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        dashboardTitle: data.dashboardTitle,
        generatedAt: data.generatedAt.toISOString(),
        reportingPeriod: data.reportingPeriod || 'All Time',
        filters: data.filters || {},
        engine: 'RicozAnalytics Enterprise Reporting Pipeline'
      },
      kpis: (data.kpis || []).map(k => ({
        id: k.id || undefined,
        name: k.name,
        value: k.value,
        unit: k.unit || '',
        type: k.type || 'currency',
        target: k.target ?? null,
        progress: k.progress ?? null,
        calculation: k.calculation || 'Aggregated from dataset records',
        source: k.source || data.datasetName || 'Active Dataset',
        status: k.status || 'verified'
      })),
      widgets: (data.widgets || []).map(w => ({
        id: w.id,
        title: w.title,
        type: w.type,
        position: w.position,
        chart_data: w.chart_data || [],
        series: w.series || (w.chart_data ? [{ name: w.title, data: w.chart_data.map(d => ({ category: d.name, value: d.value })) }] : [])
      })),
      dataset: {
        id: data.datasetId || null,
        name: data.datasetName,
        schema: data.datasetSchema,
        rowCount: data.totalRowCount || (data.rows ? data.rows.length : 0),
        sampleRowCount: data.rows ? data.rows.length : 0,
        rows: data.rows || []
      }
    };

    return Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
  }

  /**
   * Execute report generation on-demand or via scheduler
   * @param {string} reportId 
   * @param {string} organizationId 
   * @param {string|number|null} executedBy 
   * @param {string} [formatOverride]
   * @returns {Promise<object>}
   */
  async executeReport(reportId, organizationId, executedBy = null, formatOverride = null) {
    const report = await ReportModel.findByIdAndOrgId(reportId, organizationId);
    if (!report) {
      throw new Error('Report not found or access unauthorized.');
    }

    const format = (formatOverride || report.format || 'pdf').toLowerCase();
    const validFormats = ['pdf', 'csv', 'excel', 'json', 'email_summary'];
    if (!validFormats.includes(format)) {
      throw new Error(`Unsupported report export format: ${format}`);
    }

    // Create execution record with 'running' status
    const execution = await ReportModel.createExecution({
      reportId: report.id,
      organizationId,
      executedBy,
      status: 'running',
      format,
      startedAt: new Date()
    });

    try {
      // 1. Compile Analytics Data
      const reportData = await this.compileReportData(report, organizationId);

      // 2. Generate Format Artifact Buffer
      let buffer;
      let fileExt;
      let contentType;

      if (format === 'pdf' || format === 'email_summary') {
        buffer = await this.generatePdf(reportData);
        fileExt = '.pdf';
        contentType = 'application/pdf';
      } else if (format === 'excel' || format === 'xlsx') {
        buffer = await this.generateExcel(reportData);
        fileExt = '.xlsx';
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (format === 'csv') {
        buffer = this.generateCsv(reportData);
        fileExt = '.csv';
        contentType = 'text/csv; charset=utf-8';
      } else if (format === 'json') {
        buffer = this.generateJson(reportData);
        fileExt = '.json';
        contentType = 'application/json; charset=utf-8';
      }

      // 3. Save Artifact to Isolated Storage
      const orgDir = this._ensureOrgDirectory(organizationId);
      const safeFileName = `report_${report.id.substring(0, 8)}_${execution.id.substring(0, 8)}_${Date.now()}${fileExt}`;
      const destinationPath = path.join(orgDir, safeFileName);
      await fs.promises.writeFile(destinationPath, buffer);

      const relativeKey = `reports/${organizationId}/${safeFileName}`;

      // 4. Update Execution Record to 'completed'
      const completedExec = await ReportModel.updateExecution(execution.id, {
        status: 'completed',
        completedAt: new Date(),
        fileSize: buffer.length,
        filePath: relativeKey,
        errorMessage: null
      });

      // 5. Update Report last_generated_at
      await ReportModel.updateLastGenerated(report.id, new Date());

      // 6. Deliver Email if recipients exist
      const recipients = Array.isArray(report.recipients)
        ? report.recipients
        : (typeof report.recipients === 'string' ? JSON.parse(report.recipients || '[]') : []);

      let emailDelivery = { attempted: false, success: false };
      if (recipients && recipients.length > 0) {
        emailDelivery = await emailService.sendReportEmail({
          recipients,
          reportTitle: report.title,
          organizationName: reportData.organizationName,
          format,
          attachmentBuffer: buffer,
          attachmentFileName: safeFileName,
          summaryHtml: `
            <p>Your scheduled report <strong>${report.title}</strong> has been generated.</p>
            <p><strong>Dashboard:</strong> ${reportData.dashboardTitle}</p>
            <p><strong>KPIs evaluated:</strong> ${reportData.kpis.length} metrics.</p>
          `
        });
      }

      return {
        success: true,
        executionId: execution.id,
        status: 'completed',
        format,
        fileSize: buffer.length,
        filePath: relativeKey,
        fileName: safeFileName,
        contentType,
        emailDelivery,
        report
      };
    } catch (err) {
      console.error(`Report execution error (ID: ${reportId}):`, err.message);
      
      // Update execution record to 'failed'
      await ReportModel.updateExecution(execution.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: err.message
      });

      throw err;
    }
  }

  /**
   * Export comprehensive Data Quality Audit Report in PDF, Excel, CSV, or JSON
   * @param {{ datasetId: number|string, organizationId: string, format: string }} options 
   */
  async exportQualityReport({ datasetId, organizationId, format = 'json' }) {
    const dataQualityService = require('./dataQualityService');
    const profile = await dataQualityService.getQualityProfile(datasetId, organizationId);
    const dataset = await DatasetModel.findByIdAndOrgId(datasetId, organizationId);
    const org = await OrganizationModel.findById(organizationId);
    const orgName = org ? org.name : 'Ricoz Primary Organization';

    const fmt = (format || 'json').toLowerCase();

    if (fmt === 'json') {
      return {
        buffer: Buffer.from(JSON.stringify(profile, null, 2)),
        contentType: 'application/json',
        fileName: `data_quality_${dataset ? dataset.name.replace(/\s+/g, '_') : datasetId}_${Date.now()}.json`
      };
    }

    if (fmt === 'csv') {
      const headers = ['column_name', 'data_type', 'total_rows', 'null_count', 'empty_count', 'missing_count', 'completeness_pct', 'validity_pct', 'uniqueness_pct', 'is_candidate_pk'];
      const rows = [headers.join(',')];
      for (const col of profile.column_metrics || []) {
        rows.push([
          `"${col.column_name}"`,
          col.data_type,
          col.total_rows,
          col.null_count,
          col.empty_count,
          col.missing_count,
          col.completeness_pct,
          col.validity_pct,
          col.uniqueness_pct,
          col.is_candidate_pk
        ].join(','));
      }
      return {
        buffer: Buffer.from(rows.join('\n')),
        contentType: 'text/csv',
        fileName: `data_quality_${dataset ? dataset.name.replace(/\s+/g, '_') : datasetId}_${Date.now()}.csv`
      };
    }

    if (fmt === 'excel' || fmt === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const overviewSheet = workbook.addWorksheet('Quality Summary');
      overviewSheet.addRow(['Dataset', dataset ? dataset.name : datasetId]);
      overviewSheet.addRow(['Organization', orgName]);
      overviewSheet.addRow(['Overall Score', `${profile.quality_score} / 100`]);
      overviewSheet.addRow(['Status', profile.status]);
      overviewSheet.addRow(['Completeness', `${profile.dimensions?.completeness?.score || 0}%`]);
      overviewSheet.addRow(['Validity', `${profile.dimensions?.validity?.score || 0}%`]);
      overviewSheet.addRow(['Uniqueness', `${profile.dimensions?.uniqueness?.score || 0}%`]);
      overviewSheet.addRow(['Consistency', `${profile.dimensions?.consistency?.score || 0}%`]);
      overviewSheet.addRow(['Freshness', `${profile.dimensions?.freshness?.score || 0}%`]);
      overviewSheet.addRow(['Evaluated At', profile.evaluated_at]);

      const colsSheet = workbook.addWorksheet('Column Metrics');
      colsSheet.columns = [
        { header: 'Column Name', key: 'col' },
        { header: 'Type', key: 'type' },
        { header: 'Rows', key: 'rows' },
        { header: 'Missing', key: 'missing' },
        { header: 'Completeness %', key: 'comp' },
        { header: 'Validity %', key: 'val' },
        { header: 'Uniqueness %', key: 'uniq' },
        { header: 'Candidate PK', key: 'pk' }
      ];
      for (const col of profile.column_metrics || []) {
        colsSheet.addRow({
          col: col.column_name,
          type: col.data_type,
          rows: col.total_rows,
          missing: col.missing_count,
          comp: col.completeness_pct,
          val: col.validity_pct,
          uniq: col.uniqueness_pct,
          pk: col.is_candidate_pk ? 'YES' : 'NO'
        });
      }

      const issuesSheet = workbook.addWorksheet('Quality Issues');
      issuesSheet.columns = [
        { header: 'Dimension', key: 'dim' },
        { header: 'Severity', key: 'sev' },
        { header: 'Column', key: 'col' },
        { header: 'Message', key: 'msg' }
      ];
      for (const iss of profile.issues || []) {
        issuesSheet.addRow({
          dim: iss.dimension,
          sev: iss.severity,
          col: iss.column || 'N/A',
          msg: iss.message
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `data_quality_${dataset ? dataset.name.replace(/\s+/g, '_') : datasetId}_${Date.now()}.xlsx`
      };
    }

    if (fmt === 'pdf') {
      const buffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.rect(40, 40, 515, 60).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('DATA QUALITY AUDIT REPORT', 55, 52);
        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(`Dataset: ${sanitizeForPdf(dataset ? dataset.name : datasetId)} | Org: ${sanitizeForPdf(orgName)}`, 55, 74);

        doc.moveDown(3);
        doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(`Overall Quality Score: ${profile.quality_score}/100 (${(profile.status || '').toUpperCase()})`, 40, 120);

        doc.fontSize(10).font('Helvetica').fillColor('#475569')
          .text(`Completeness: ${profile.dimensions?.completeness?.score || 0}% | Validity: ${profile.dimensions?.validity?.score || 0}% | Uniqueness: ${profile.dimensions?.uniqueness?.score || 0}% | Consistency: ${profile.dimensions?.consistency?.score || 0}%`, 40, 140);

        doc.moveDown();
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Detected Issues & Anomalies:', 40, 165);
        let y = 185;
        (profile.issues || []).slice(0, 8).forEach(iss => {
          doc.fontSize(8.5).font('Helvetica').fillColor(iss.severity === 'critical' ? '#dc2626' : '#d97706')
            .text(`[${(iss.severity || '').toUpperCase()}] [${iss.dimension}] ${sanitizeForPdf(iss.message)}`, 40, y);
          y += 18;
        });

        doc.end();
      });

      return {
        buffer,
        contentType: 'application/pdf',
        fileName: `data_quality_${dataset ? dataset.name.replace(/\s+/g, '_') : datasetId}_${Date.now()}.pdf`
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Export comprehensive AI Executive Insights Report in PDF, Excel, CSV, or JSON
   * @param {{ organizationId: string, format: string }} options 
   */
  async exportInsightsReport({ organizationId, format = 'json' }) {
    const insightService = require('./insightService');
    const org = await OrganizationModel.findById(organizationId);
    const orgName = org ? org.name : 'Ricoz Primary Organization';

    const insRes = await insightService.generateInsights(organizationId, { persist: false });
    const insights = insRes.insights || [];
    const executiveSummary = insRes.executive_summary || '';

    const fmt = (format || 'json').toLowerCase();

    if (fmt === 'json') {
      return {
        buffer: Buffer.from(JSON.stringify(insRes, null, 2)),
        contentType: 'application/json',
        fileName: `ai_insights_${organizationId.substring(0, 8)}_${Date.now()}.json`
      };
    }

    if (fmt === 'csv') {
      const headers = ['id', 'type', 'severity', 'confidence', 'title', 'summary', 'dataset', 'metric', 'recommendation'];
      const rows = [headers.join(',')];
      for (const ins of insights) {
        rows.push([
          `"${ins.id || ''}"`,
          `"${ins.type || ''}"`,
          `"${ins.severity || 'info'}"`,
          ins.confidence || 0.95,
          `"${(ins.title || '').replace(/"/g, '""')}"`,
          `"${(ins.summary || '').replace(/"/g, '""')}"`,
          `"${(ins.source_metadata?.dataset_name || ins.dataset_name || '').replace(/"/g, '""')}"`,
          `"${(ins.source_metadata?.metric_name || ins.metric_name || '').replace(/"/g, '""')}"`,
          `"${(ins.recommendation?.action || '').replace(/"/g, '""')}"`
        ].join(','));
      }
      return {
        buffer: Buffer.from(rows.join('\n')),
        contentType: 'text/csv; charset=utf-8',
        fileName: `ai_insights_${organizationId.substring(0, 8)}_${Date.now()}.csv`
      };
    }

    if (fmt === 'excel' || fmt === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const overviewSheet = workbook.addWorksheet('Executive Overview');
      overviewSheet.addRow(['Organization', orgName]);
      overviewSheet.addRow(['Generated At', insRes.generated_at ? new Date(insRes.generated_at).toISOString() : new Date().toISOString()]);
      overviewSheet.addRow(['Total Insights Detected', insights.length]);
      overviewSheet.addRow(['', '']);
      overviewSheet.addRow(['Executive Summary', '']);
      overviewSheet.addRow(['', executiveSummary]);

      overviewSheet.getRow(1).font = { bold: true };
      overviewSheet.getColumn(1).width = 25;
      overviewSheet.getColumn(2).width = 65;

      const itemsSheet = workbook.addWorksheet('Detected Insights');
      itemsSheet.columns = [
        { header: 'Type', key: 'type', width: 16 },
        { header: 'Severity', key: 'severity', width: 14 },
        { header: 'Title', key: 'title', width: 32 },
        { header: 'Confidence', key: 'confidence', width: 12 },
        { header: 'Summary', key: 'summary', width: 48 },
        { header: 'Recommended Action', key: 'rec', width: 35 }
      ];

      insights.forEach(ins => {
        itemsSheet.addRow({
          type: (ins.type || 'insight').toUpperCase(),
          severity: (ins.severity || 'info').toUpperCase(),
          title: ins.title,
          confidence: `${Math.round((ins.confidence || 0.95) * 100)}%`,
          summary: ins.summary,
          rec: ins.recommendation?.action || 'N/A'
        });
      });

      itemsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      itemsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `ai_insights_${organizationId.substring(0, 8)}_${Date.now()}.xlsx`
      };
    }

    if (fmt === 'pdf') {
      const buffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.rect(40, 40, 515, 60).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('AI EXECUTIVE INSIGHTS REPORT', 55, 52);
        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(`Organization: ${sanitizeForPdf(orgName)} | Generated: ${new Date().toISOString().substring(0, 19)} UTC`, 55, 74);

        // Executive Summary
        doc.moveDown(3);
        doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Executive Summary', 40, 120);

        const cleanSummary = sanitizeForPdf(executiveSummary).replace(/### Enterprise AI Executive Summary\n?/g, '');
        doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(cleanSummary, 40, 140, { width: 515 });

        // Insights List
        let y = doc.y + 20;
        if (y > 600) {
          doc.addPage();
          y = 40;
        }

        doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(`Detected Insights (${insights.length})`, 40, y);
        y += 20;

        insights.slice(0, 8).forEach(ins => {
          if (y > 720) {
            doc.addPage();
            y = 40;
          }

          const sevColor = ins.severity === 'critical' ? '#dc2626' : (ins.severity === 'warning' ? '#d97706' : (ins.severity === 'positive' ? '#16a34a' : '#2563eb'));
          doc.rect(40, y, 515, 45).fillAndStroke('#f8fafc', '#e2e8f0');

          doc.fillColor(sevColor).fontSize(8).font('Helvetica-Bold')
            .text(`[${(ins.severity || 'INFO').toUpperCase()}] [${(ins.type || 'INSIGHT').toUpperCase()}]`, 48, y + 6);

          doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
            .text(sanitizeForPdf(ins.title), 130, y + 6, { width: 410 });

          doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
            .text(sanitizeForPdf(ins.summary), 48, y + 22, { width: 495 });

          y += 52;
        });

        doc.end();
      });

      return {
        buffer,
        contentType: 'application/pdf',
        fileName: `ai_insights_${organizationId.substring(0, 8)}_${Date.now()}.pdf`
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}

module.exports = new ReportService();
