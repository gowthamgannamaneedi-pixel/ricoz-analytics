const dataQualityService = require('../services/dataQualityService');

/**
 * Data Quality & Observability Controller
 * Implements REST endpoints for dataset quality profiles, column analytics,
 * historical evaluation trends, and configurable quality rules.
 */
const dataQualityController = {
  /**
   * GET /api/data-quality/datasets/:datasetId
   * Retrieve latest quality profile for a dataset
   */
  async getDatasetQuality(req, res) {
    try {
      const { datasetId } = req.params;
      const organizationId = req.user.organization_id;
      const { forceReevaluate, sampleSize } = req.query;

      const profile = await dataQualityService.getQualityProfile(datasetId, organizationId, {
        forceReevaluate: forceReevaluate === 'true',
        sampleSize: sampleSize ? Number(sampleSize) : null,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        data: profile,
        profile
      });
    } catch (err) {
      console.error('[DataQualityController.getDatasetQuality] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to evaluate dataset quality.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/data-quality/datasets/:datasetId/evaluate
   * Trigger an on-demand data quality evaluation scan
   */
  async evaluateDatasetQuality(req, res) {
    try {
      const { datasetId } = req.params;
      const organizationId = req.user.organization_id;
      const { sampleSize, fullScan, expectedRefreshHours } = req.body;

      const profile = await dataQualityService.evaluateDatasetQuality(datasetId, organizationId, {
        sampleSize: sampleSize ? Number(sampleSize) : null,
        fullScan: fullScan !== false,
        expectedRefreshHours: expectedRefreshHours ? Number(expectedRefreshHours) : null,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'Dataset quality evaluation completed successfully.',
        data: profile,
        profile
      });
    } catch (err) {
      console.error('[DataQualityController.evaluateDatasetQuality] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to execute dataset quality scan.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/data-quality/datasets/:datasetId/columns
   * Retrieve column-level quality breakdown
   */
  async getColumnMetrics(req, res) {
    try {
      const { datasetId } = req.params;
      const organizationId = req.user.organization_id;

      const columnMetrics = await dataQualityService.getColumnMetrics(datasetId, organizationId);

      return res.status(200).json({
        success: true,
        count: columnMetrics.length,
        data: columnMetrics,
        columnMetrics
      });
    } catch (err) {
      console.error('[DataQualityController.getColumnMetrics] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve column metrics.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/data-quality/datasets/:datasetId/history
   * Retrieve historical quality snapshots
   */
  async getQualityHistory(req, res) {
    try {
      const { datasetId } = req.params;
      const organizationId = req.user.organization_id;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const history = await dataQualityService.getQualityHistory(datasetId, organizationId, limit);

      return res.status(200).json({
        success: true,
        count: history.length,
        data: history,
        history
      });
    } catch (err) {
      console.error('[DataQualityController.getQualityHistory] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve quality history.',
        error: err.message
      });
    }
  },

  /**
   * POST /api/data-quality/rules
   * Create a new custom quality rule
   */
  async createRule(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { datasetId, columnName, ruleType, configuration, severity, enabled } = req.body;

      if (!datasetId || !columnName || !ruleType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: datasetId, columnName, and ruleType are required.'
        });
      }

      const rule = await dataQualityService.createRule({
        organizationId,
        datasetId,
        columnName,
        ruleType,
        configuration,
        severity,
        enabled,
        createdBy: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(201).json({
        success: true,
        message: 'Data quality rule created successfully.',
        data: rule,
        rule
      });
    } catch (err) {
      console.error('[DataQualityController.createRule] Error:', err);
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to create data quality rule.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/data-quality/rules
   * List quality rules for organization or filtered by datasetId
   */
  async getRules(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { datasetId } = req.query;

      const rules = await dataQualityService.getRules(datasetId, organizationId);

      return res.status(200).json({
        success: true,
        count: rules.length,
        data: rules,
        rules
      });
    } catch (err) {
      console.error('[DataQualityController.getRules] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve quality rules.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/data-quality/rules/:id
   * Retrieve a single quality rule
   */
  async getRuleById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const rule = await dataQualityService.getRuleById(id, organizationId);
      if (!rule) {
        return res.status(404).json({
          success: false,
          message: 'Quality rule not found or access denied.'
        });
      }

      return res.status(200).json({
        success: true,
        data: rule,
        rule
      });
    } catch (err) {
      console.error('[DataQualityController.getRuleById] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to retrieve quality rule.',
        error: err.message
      });
    }
  },

  /**
   * PUT /api/data-quality/rules/:id
   * Update an existing quality rule
   */
  async updateRule(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const { columnName, ruleType, configuration, severity, enabled } = req.body;

      const updated = await dataQualityService.updateRule(id, organizationId, {
        columnName,
        ruleType,
        configuration,
        severity,
        enabled
      }, {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'Quality rule updated successfully.',
        data: updated,
        rule: updated
      });
    } catch (err) {
      console.error('[DataQualityController.updateRule] Error:', err);
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to update quality rule.',
        error: err.message
      });
    }
  },

  /**
   * DELETE /api/data-quality/rules/:id
   * Delete a custom quality rule
   */
  async deleteRule(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const deleted = await dataQualityService.deleteRule(id, organizationId, {
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'Quality rule deleted successfully.',
        data: deleted
      });
    } catch (err) {
      console.error('[DataQualityController.deleteRule] Error:', err);
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to delete quality rule.',
        error: err.message
      });
    }
  },

  /**
   * GET /api/data-quality/datasets/:datasetId/export
   * Export quality profile as PDF, Excel, CSV, or JSON
   */
  async exportQualityReport(req, res) {
    try {
      const { datasetId } = req.params;
      const organizationId = req.user.organization_id;
      const format = req.query.format || 'json';

      const reportService = require('../services/reportService');
      const exportResult = await reportService.exportQualityReport({
        datasetId,
        organizationId,
        format
      });

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
      return res.send(exportResult.buffer);
    } catch (err) {
      console.error('[DataQualityController.exportQualityReport] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'Failed to export quality report.',
        error: err.message
      });
    }
  }
};

module.exports = dataQualityController;
