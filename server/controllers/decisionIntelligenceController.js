const insightService = require('../services/insightService');
const rootCauseAttributionService = require('../services/rootCauseAttributionService');
const scenarioSimulationService = require('../services/scenarioSimulationService');
const geminiService = require('../services/geminiService');
const evidenceBuilderService = require('../services/evidenceBuilderService');

/**
 * Enterprise Decision Intelligence Controller (Phase 6)
 * Handles root-cause variance attribution and counterfactual scenario modeling.
 */
const decisionIntelligenceController = {
  /**
   * GET /api/insights/:id/root-cause
   * Decompose metric variance across dimensional slices
   */
  async getRootCause(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { id } = req.params;
      const { dimension, limit } = req.query;

      const insight = await insightService.getInsightById(id, organizationId);
      if (!insight) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
          }
        });
      }

      const attribution = await rootCauseAttributionService.calculateAttribution({
        insight,
        organizationId,
        dimension: dimension ? String(dimension).trim() : null,
        limit: limit ? Math.min(50, Math.max(1, Number(limit))) : 10
      });

      // Generate grounded natural-language explanation
      const aiResult = await geminiService.generateDriverExplanation({ attribution });

      return res.status(200).json({
        success: true,
        data: {
          ...attribution,
          explanation: aiResult.explanation,
          aiGenerated: aiResult.aiGenerated,
          fallback: aiResult.fallback,
          model: geminiService.modelName
        }
      });
    } catch (err) {
      console.error('[DecisionIntelligenceController.getRootCause] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        error: {
          code: 'ROOT_CAUSE_ERROR',
          message: err.message || 'Failed to calculate root-cause variance attribution.'
        }
      });
    }
  },

  /**
   * POST /api/insights/:id/simulate-scenario
   * Execute deterministic counterfactual simulation on insight baseline
   */
  async simulateScenario(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { id } = req.params;
      const { dimension, adjustments } = req.body;

      if (!Array.isArray(adjustments)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'Body field "adjustments" must be an array of { segment, deltaPercent } objects.'
          }
        });
      }

      const insight = await insightService.getInsightById(id, organizationId);
      if (!insight) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
          }
        });
      }

      // 1. Calculate baseline attribution for the selected dimension
      const attribution = await rootCauseAttributionService.calculateAttribution({
        insight,
        organizationId,
        dimension: dimension ? String(dimension).trim() : null,
        limit: 50
      });

      // 2. Run deterministic counterfactual simulation
      const simulation = scenarioSimulationService.simulate({
        baselineDrivers: attribution.drivers,
        adjustments,
        context: {
          metric: attribution.metric,
          dimension: attribution.dimension,
          insightId: id
        }
      });

      // 3. Grounded explanation layer
      const aiResult = await geminiService.generateScenarioExplanation({ simulation });

      return res.status(200).json({
        success: true,
        data: {
          ...simulation,
          explanation: aiResult.explanation,
          aiGenerated: aiResult.aiGenerated,
          fallback: aiResult.fallback,
          model: geminiService.modelName
        }
      });
    } catch (err) {
      console.error('[DecisionIntelligenceController.simulateScenario] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        error: {
          code: 'SIMULATION_ERROR',
          message: err.message || 'Failed to execute counterfactual scenario simulation.'
        }
      });
    }
  },

  /**
   * GET /api/insights/:id/dimensions
   * List available categorical dimensions for an insight's dataset
   */
  async getAvailableDimensions(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { id } = req.params;

      const insight = await insightService.getInsightById(id, organizationId);
      if (!insight) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
          }
        });
      }

      const evidence = insight.evidence || {};
      const datasetId = insight.dataset_id || evidence.datasetId || evidence.dataset_id || insight.source_metadata?.dataset_id;

      if (!datasetId) {
        return res.status(200).json({
          success: true,
          data: {
            availableDimensions: []
          }
        });
      }

      const { schema } = await evidenceBuilderService.loadDatasetAndRecords(datasetId, organizationId);
      const availableDimensions = rootCauseAttributionService.getEligibleDimensions(schema);

      return res.status(200).json({
        success: true,
        data: {
          insightId: id,
          datasetId: Number(datasetId),
          availableDimensions
        }
      });
    } catch (err) {
      console.error('[DecisionIntelligenceController.getAvailableDimensions] Error:', err);
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        error: {
          code: 'DIMENSIONS_ERROR',
          message: err.message || 'Failed to list dataset dimensions.'
        }
      });
    }
  }
};

module.exports = decisionIntelligenceController;
