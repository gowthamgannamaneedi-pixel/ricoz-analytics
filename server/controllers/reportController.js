const path = require('path');
const fs = require('fs');
const ReportModel = require('../models/reportModel');
const DashboardModel = require('../models/dashboardModel');
const reportService = require('../services/reportService');
const schedulerService = require('../services/schedulerService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

const VALID_FORMATS = ['pdf', 'csv', 'excel', 'xlsx', 'json', 'email_summary'];
const VALID_STATUSES = ['draft', 'active', 'paused', 'completed'];

/**
 * Report Controller for Phase 9 Enterprise Reports Engine
 */
const reportController = {
  /**
   * List all reports for current organization
   * GET /api/reports
   */
  async getReports(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const reports = await ReportModel.findByOrganizationId(organizationId);

      return res.status(200).json({
        success: true,
        count: reports.length,
        reports
      });
    } catch (err) {
      console.error('Error fetching reports:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve reports list',
        error: err.message
      });
    }
  },

  /**
   * Get single report by ID
   * GET /api/reports/:id
   */
  async getReportById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const report = await ReportModel.findByIdAndOrgId(id, organizationId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      return res.status(200).json({
        success: true,
        report
      });
    } catch (err) {
      console.error('Error fetching report by ID:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve report',
        error: err.message
      });
    }
  },

  /**
   * Create a new report definition
   * POST /api/reports
   */
  async createReport(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const createdBy = req.user.id;
      const {
        title,
        description,
        dashboard_id,
        format = 'pdf',
        schedule_cron,
        recipients = [],
        status = 'draft'
      } = req.body;

      // 1. Validation: Title
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Report title is required'
        });
      }

      // 2. Validation: Format
      const normalizedFormat = (format || 'pdf').toLowerCase();
      if (!VALID_FORMATS.includes(normalizedFormat)) {
        return res.status(400).json({
          success: false,
          message: `Invalid format "${format}". Supported formats: ${VALID_FORMATS.join(', ')}`
        });
      }

      // 3. Validation: Schedule Cron
      if (schedule_cron) {
        const normalizedCron = schedulerService.normalizeSchedule(schedule_cron);
        if (!schedulerService.validateCron(normalizedCron)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid schedule format. Must be "daily", "weekly", "monthly", or a valid 5-part cron expression.'
          });
        }
      }

      // 4. Validation: Status
      if (status && !VALID_STATUSES.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status "${status}". Allowed: ${VALID_STATUSES.join(', ')}`
        });
      }

      // 5. Validation: Dashboard belongs to organization
      if (dashboard_id) {
        const dashboard = await DashboardModel.findByIdAndOrgId(dashboard_id, organizationId);
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            message: 'Referenced dashboard not found in your organization'
          });
        }
      }

      // 6. Create Report Record
      const newReport = await ReportModel.create({
        organizationId,
        createdBy,
        dashboardId: dashboard_id || null,
        title: title.trim(),
        description: description || '',
        format: normalizedFormat,
        scheduleCron: schedule_cron ? schedulerService.normalizeSchedule(schedule_cron) : null,
        recipients: Array.isArray(recipients) ? recipients : (recipients ? [recipients] : []),
        status: status.toLowerCase()
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: createdBy,
        action: AUDIT_ACTIONS.REPORT_CREATED,
        resourceType: 'report',
        resourceId: newReport.id,
        description: `Scheduled report "${newReport.title}" created with format ${normalizedFormat}`,
        metadata: { title: newReport.title, format: normalizedFormat, schedule: schedule_cron },
        req
      });

      return res.status(201).json({
        success: true,
        message: 'Report definition created successfully',
        report: newReport
      });
    } catch (err) {
      console.error('Error creating report:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create report',
        error: err.message
      });
    }
  },

  /**
   * Update report configuration
   * PUT /api/reports/:id
   */
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const {
        title,
        description,
        dashboard_id,
        format = 'pdf',
        schedule_cron,
        recipients = [],
        status = 'draft'
      } = req.body;

      // 1. Validation: Title
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Report title is required'
        });
      }

      // 2. Validation: Format
      const normalizedFormat = (format || 'pdf').toLowerCase();
      if (!VALID_FORMATS.includes(normalizedFormat)) {
        return res.status(400).json({
          success: false,
          message: `Invalid format "${format}". Supported formats: ${VALID_FORMATS.join(', ')}`
        });
      }

      // 3. Validation: Schedule Cron
      if (schedule_cron) {
        const normalizedCron = schedulerService.normalizeSchedule(schedule_cron);
        if (!schedulerService.validateCron(normalizedCron)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid schedule format. Must be "daily", "weekly", "monthly", or a valid 5-part cron expression.'
          });
        }
      }

      // 4. Validation: Dashboard
      if (dashboard_id) {
        const dashboard = await DashboardModel.findByIdAndOrgId(dashboard_id, organizationId);
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            message: 'Referenced dashboard not found in your organization'
          });
        }
      }

      const updatedReport = await ReportModel.update(id, organizationId, {
        title: title.trim(),
        description: description || '',
        dashboardId: dashboard_id || null,
        format: normalizedFormat,
        scheduleCron: schedule_cron ? schedulerService.normalizeSchedule(schedule_cron) : null,
        recipients: Array.isArray(recipients) ? recipients : (recipients ? [recipients] : []),
        status: status ? status.toLowerCase() : 'draft'
      });

      if (!updatedReport) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.REPORT_UPDATED,
        resourceType: 'report',
        resourceId: id,
        description: `Report "${updatedReport.title}" updated`,
        metadata: { title: updatedReport.title, format: normalizedFormat },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Report updated successfully',
        report: updatedReport
      });
    } catch (err) {
      console.error('Error updating report:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update report',
        error: err.message
      });
    }
  },

  /**
   * Delete report
   * DELETE /api/reports/:id
   */
  async deleteReport(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const deleted = await ReportModel.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.REPORT_DELETED,
        resourceType: 'report',
        resourceId: id,
        description: `Report (ID: ${id}) deleted`,
        metadata: { reportId: id },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Report deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting report:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete report',
        error: err.message
      });
    }
  },

  /**
   * Execute Report On-Demand
   * POST /api/reports/:id/run
   */
  async runReport(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const executedBy = req.user.id;
      const formatOverride = req.body.format || null;

      const result = await reportService.executeReport(
        id,
        organizationId,
        executedBy,
        formatOverride
      );

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: executedBy,
        action: AUDIT_ACTIONS.REPORT_RUN,
        resourceType: 'report',
        resourceId: id,
        description: `Executed report export (format: ${formatOverride || 'default'})`,
        metadata: { reportId: id, format: formatOverride, fileSize: result.file_size_bytes },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Report generated successfully',
        execution: result
      });
    } catch (err) {
      console.error('Error running report on-demand:', err);
      const isNotFound = err.message.includes('not found') || err.message.includes('unauthorized');
      return res.status(isNotFound ? 404 : 500).json({
        success: false,
        message: err.message || 'Report execution failed',
        error: err.message
      });
    }
  },

  /**
   * Get Execution History for a Report
   * GET /api/reports/:id/executions
   */
  async getReportExecutions(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      // Verify report exists in org
      const report = await ReportModel.findByIdAndOrgId(id, organizationId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      const executions = await ReportModel.getExecutionsByReportId(id, organizationId);

      return res.status(200).json({
        success: true,
        count: executions.length,
        executions
      });
    } catch (err) {
      console.error('Error fetching report executions:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve execution history',
        error: err.message
      });
    }
  },

  /**
   * Get all organization execution history
   * GET /api/reports/executions/all
   */
  async getAllExecutions(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const executions = await ReportModel.getExecutionsByOrganizationId(organizationId);

      return res.status(200).json({
        success: true,
        count: executions.length,
        executions
      });
    } catch (err) {
      console.error('Error fetching all executions:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve execution history',
        error: err.message
      });
    }
  },

  /**
   * Download a generated report artifact
   * GET /api/reports/executions/:executionId/download
   */
  async downloadExecutionArtifact(req, res) {
    try {
      const { executionId } = req.params;
      const organizationId = req.user.organization_id;

      const execution = await ReportModel.getExecutionById(executionId, organizationId);
      if (!execution || execution.status !== 'completed' || !execution.file_path) {
        return res.status(404).json({
          success: false,
          message: 'Report artifact not found or execution incomplete'
        });
      }

      const fullPath = path.resolve(__dirname, '../uploads', execution.file_path);
      
      // Path traversal security check
      const baseUploadDir = path.resolve(__dirname, '../uploads');
      if (!fullPath.startsWith(baseUploadDir)) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden: invalid storage path'
        });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: 'Physical file artifact not found on server storage'
        });
      }

      const stat = fs.statSync(fullPath);

      // Generate meaningful, user-friendly filename based on report title and format
      const rawTitle = execution.report_title || 'Analytics-Report';
      const sanitizedBase = rawTitle
        .trim()
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .replace(/\s+/g, '-');

      let ext = (execution.format || 'pdf').toLowerCase();
      if (ext === 'excel') ext = 'xlsx';
      
      const userFriendlyFileName = `${sanitizedBase}.${ext}`;

      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', `attachment; filename="${userFriendlyFileName}"`);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      if (execution.format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (execution.format === 'excel' || execution.format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (execution.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      } else if (execution.format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }

      return res.sendFile(fullPath, {
        headers: {
          'Content-Disposition': `attachment; filename="${userFriendlyFileName}"`
        }
      });
    } catch (err) {
      console.error('Error downloading report artifact:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to download report artifact',
        error: err.message
      });
    }
  },

  /**
   * Direct On-Demand Dashboard Export
   * POST /api/reports/export-dashboard
   */
  async exportDashboardDirect(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { dashboard_id, format = 'pdf', title } = req.body;

      const normalizedFormat = (format || 'pdf').toLowerCase();
      if (!VALID_FORMATS.includes(normalizedFormat)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported format "${format}"`
        });
      }

      let dashboard = null;
      if (dashboard_id) {
        dashboard = await DashboardModel.findByIdAndOrgId(dashboard_id, organizationId);
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            message: 'Dashboard not found in organization'
          });
        }
      }

      const mockReport = {
        id: dashboard_id || 'instant_export',
        title: title || (dashboard ? dashboard.title : 'Analytics Executive Summary'),
        description: 'Instant dashboard analytics export.',
        dashboard_id: dashboard_id || null,
        dashboard_title: dashboard ? dashboard.title : 'Active Dashboard',
        format: normalizedFormat
      };

      const reportData = await reportService.compileReportData(mockReport, organizationId);

      let buffer;
      let fileExt;
      let contentType;

      if (normalizedFormat === 'pdf' || normalizedFormat === 'email_summary') {
        buffer = await reportService.generatePdf(reportData);
        fileExt = '.pdf';
        contentType = 'application/pdf';
      } else if (normalizedFormat === 'excel' || normalizedFormat === 'xlsx') {
        buffer = await reportService.generateExcel(reportData);
        fileExt = '.xlsx';
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (normalizedFormat === 'csv') {
        buffer = reportService.generateCsv(reportData);
        fileExt = '.csv';
        contentType = 'text/csv; charset=utf-8';
      } else if (normalizedFormat === 'json') {
        buffer = reportService.generateJson(reportData);
        fileExt = '.json';
        contentType = 'application/json; charset=utf-8';
      }

      const safeTitle = (reportData.title || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeTitle}_${Date.now()}${fileExt}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.status(200).send(buffer);
    } catch (err) {
      console.error('Direct dashboard export error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to export dashboard data',
        error: err.message
      });
    }
  }
};

module.exports = reportController;
