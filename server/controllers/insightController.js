const insightService = require('../services/insightService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

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
      const { datasetId, persist, forceFresh } = req.body;

      const result = await insightService.generateInsights(organizationId, {
        userId: req.user.id,
        datasetId: datasetId ? Number(datasetId) : null,
        persist: persist !== false,
        forceFresh: Boolean(forceFresh),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: `Successfully evaluated and generated ${result.count} AI insights.`,
        data: result.insights,
        insights: result.insights,
        executive_summary: result.executive_summary,
        briefing: result.briefing || null,
        relationships: result.relationships || [],
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
      const { status, type, severity, datasetId, metricId, limit, page, dedup } = req.query;

      const insights = await insightService.getInsights(organizationId, {
        status: status || 'active',
        type,
        severity,
        datasetId,
        metricId,
        limit,
        page,
        dedup: dedup === undefined ? true : (dedup !== 'false' && dedup !== false)
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
      const numDatasetId = datasetId && !isNaN(Number(datasetId)) ? Number(datasetId) : undefined;

      // 1. Fast path: If active insights already exist, build briefing quickly without full dataset rescan
      const existingInsights = await insightService.getInsights(organizationId, {
        status: 'active',
        datasetId: numDatasetId,
        limit: 10
      }).catch(() => []);

      if (existingInsights && existingInsights.length > 0) {
        const geminiService = require('../services/geminiService');
        const briefing = geminiService._buildDeterministicExecutiveBriefing({
          insights: existingInsights,
          relationships: [],
          context: { organizationId }
        });
        const baseSummary = briefing.summary || '';
        const executiveSummary = baseSummary.includes('Executive Summary')
          ? baseSummary
          : `### Enterprise AI Executive Summary\n\n${baseSummary}`;
        return res.status(200).json({
          success: true,
          summary: executiveSummary,
          executive_summary: executiveSummary,
          briefing,
          relationships: [],
          insights_count: existingInsights.length,
          generated_at: new Date()
        });
      }

      // 2. On-demand generation with a safety boundary
      const result = await Promise.race([
        insightService.generateInsights(organizationId, {
          userId: req.user.id,
          datasetId: numDatasetId || null,
          persist: false,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Summary generation timeout')), 8000))
      ]);

      return res.status(200).json({
        success: true,
        summary: result.executive_summary,
        executive_summary: result.executive_summary,
        briefing: result.briefing || null,
        relationships: result.relationships || [],
        insights_count: result.count,
        generated_at: result.generated_at
      });
    } catch (err) {
      console.warn('[InsightController.getExecutiveSummary] Notice:', err.message);
      return res.status(200).json({
        success: true,
        summary: 'No critical anomalies or threshold breaches currently detected across analyzed data.',
        executive_summary: 'No critical anomalies or threshold breaches currently detected across analyzed data.',
        briefing: null,
        relationships: [],
        insights_count: 0,
        generated_at: new Date()
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

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          message: `Insight #${id} not found or access denied.`
        });
      }

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

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          message: `Insight #${id} not found or access denied.`
        });
      }

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

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          message: `Insight #${id} not found or access denied.`
        });
      }

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
