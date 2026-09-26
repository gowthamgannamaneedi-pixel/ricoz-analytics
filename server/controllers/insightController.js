const insightService = require('../services/insightService');

/**
 * Enterprise AI Automated Insights Controller
 * Handles REST endpoints for on-demand insight generation, structured evidence retrieval,
 * executive summaries, dismiss actions, user feedback, and report exports.
 */
const insightController = {
  /**
   * POST /api/insights/generate
   * Trigger on-demand insight generation across organization subsystems
   */
  async generateInsights(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { datasetId, persist } = req.body;

      const result = await insightService.generateInsights(organizationId, {
        userId: req.user.id,
        datasetId: datasetId ? Number(datasetId) : null,
        persist: persist !== false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: `Successfully evaluated and generated ${result.count} AI insights.`,
        data: result.insights,
        insights: result.insights,
        executive_summary: result.executive_summary,
        count: result.count,
        generated_at: result.generated_at
      });
    } catch (err) {
      console.error('[InsightController.generateInsights] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to generate AI insights.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/insights
   * Retrieve active/filtered insights for an organization
   */
  async getInsights(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { status, type, severity, datasetId, metricId, limit, page } = req.query;

      const insights = await insightService.getInsights(organizationId, {
        status: status || 'active',
        type,
        severity,
        datasetId,
        metricId,
        limit,
        page
      });

      return res.status(200).json({
        success: true,
        count: insights.length,
        data: insights,
        insights
      });
    } catch (err) {
      console.error('[InsightController.getInsights] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve AI insights.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/insights/summary
   * Retrieve executive summary based on latest organization insights
   */
  async getExecutiveSummary(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { datasetId } = req.query;

      const result = await insightService.generateInsights(organizationId, {
        userId: req.user.id,
        datasetId: datasetId ? Number(datasetId) : null,
        persist: false, // On-demand summary evaluation without duplicate storage
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        summary: result.executive_summary,
        executive_summary: result.executive_summary,
        insights_count: result.count,
        generated_at: result.generated_at
      });
    } catch (err) {
      console.error('[InsightController.getExecutiveSummary] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to generate executive summary.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/insights/:id
   * Retrieve a single insight by ID
   */
  async getInsightById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const insight = await insightService.getInsightById(id, organizationId);
      if (!insight) {
        return res.status(404).json({
          success: false,
          message: `Insight #${id} not found or access denied.`
        });
      }

      return res.status(200).json({
        success: true,
        data: insight,
        insight
      });
    } catch (err) {
      console.error('[InsightController.getInsightById] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve AI insight.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/insights/:id/dismiss
   * Dismiss an insight
   */
  async dismissInsight(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const dismissed = await insightService.dismissInsight(id, organizationId, {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'Insight dismissed successfully.',
        data: dismissed,
        insight: dismissed
      });
    } catch (err) {
      console.error('[InsightController.dismissInsight] Error:', err);
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to dismiss insight.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/insights/:id/feedback
   * Submit feedback (useful / not_useful) on an insight
   */
  async submitFeedback(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const { feedback } = req.body;

      if (!feedback) {
        return res.status(400).json({
          success: false,
          message: 'Feedback is required. Must be "useful" or "not_useful".'
        });
      }

      const updated = await insightService.submitFeedback(id, organizationId, feedback, {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'Feedback recorded successfully.',
        data: updated,
        insight: updated
      });
    } catch (err) {
      console.error('[InsightController.submitFeedback] Error:', err);
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to record insight feedback.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/insights/export
   * Export insights report as PDF, Excel, CSV, or JSON
   */
  async exportInsights(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const format = req.query.format || 'json';

      const reportService = require('../services/reportService');
      const exportResult = await reportService.exportInsightsReport({
        organizationId,
        format
      });

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
      return res.send(exportResult.buffer);
    } catch (err) {
      console.error('[InsightController.exportInsights] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to export insights report.',
        error: err.message
      });
    }
  }
};

module.exports = insightController;
