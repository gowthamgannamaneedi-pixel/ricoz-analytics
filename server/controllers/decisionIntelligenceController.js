const insightService = require('../services/insightService');
const rootCauseAttributionService = require('../services/rootCauseAttributionService');
const scenarioSimulationService = require('../services/scenarioSimulationService');
const geminiService = require('../services/geminiService');
const evidenceBuilderService = require('../services/evidenceBuilderService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Enterprise Decision Intelligence & Business Radar Controller (Phase 6)
 * Handles root-cause variance attribution, Business Radar decomposition, and counterfactual scenario modeling.
 */
const decisionIntelligenceController = {
  /**
   * GET /api/insights/:id/root-cause
   * Decompose metric variance across dimensional slices for Business Radar
   */
  async getRootCause(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { id } = req.params;
      const { dimension, limit, forceFresh } = req.query;

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
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

      const attribution = await rootCauseAttributionService.calculateAttribution({
        insight,
        organizationId,
        dimension: dimension ? String(dimension).trim() : null,
        limit: limit ? Math.min(50, Math.max(1, Number(limit))) : 10,
        forceFresh: forceFresh === 'true' || forceFresh === true
      });

      // Structured Business Radar telemetry
      const radar = {
        metric: attribution.metric,
        dimension: attribution.dimension,
        availableDimensions: attribution.availableDimensions,
        severity: insight.severity || (Math.abs(attribution.totalDeltaPercent) >= 25 ? 'critical' : (Math.abs(attribution.totalDeltaPercent) >= 10 ? 'warning' : 'info')),
        magnitude: {
          totalDelta: attribution.totalDelta,
          totalDeltaPercent: attribution.totalDeltaPercent,
          totalBaseline: attribution.totalBaseline,
          totalCurrent: attribution.totalCurrent
        },
        evidence: {
          metric: attribution.metric,
          comparisonPeriod: insight.evidence?.comparisonPeriod || 'Historical Baseline',
          currentPeriod: insight.evidence?.currentPeriod || 'Current Observation',
          baselineValue: attribution.totalBaseline,
          currentValue: attribution.totalCurrent,
          delta: attribution.totalDelta,
          deltaPercent: attribution.totalDeltaPercent,
          calculationMethod: '((currentValue - baselineValue) / ABS(baselineValue)) * 100',
          mathBalanceVerified: attribution.mathBalanceVerified,
          recordsAnalyzed: attribution.recordsAnalyzed
        },
        drivers: attribution.drivers,
        primaryDetractor: attribution.primaryDetractor,
        primarySustainer: attribution.primarySustainer,
        concentration: attribution.concentration,
        observationalSummary: attribution.observationalSummary,
        correlationDisclaimer: 'Observational movement breakdown: segment variances reflect statistical accounting of net change. Telemetry does not establish causal direction without controlled experimentation.',
        emptyReason: attribution.emptyReason || null,
        suggestedQuestions: attribution.drivers && attribution.drivers.length > 0 ? [
          `Did transaction frequency or unit prices shift across the ${attribution.drivers[0]?.segment || 'primary'} segment?`,
          `Are inventory shortages or regional supply dynamics impacting ${attribution.primaryDetractor?.segment || 'lagging'} areas?`,
          `How did channel marketing or seasonality align with observed movement across ${attribution.dimension}?`
        ] : [],
        recommendation: insight.recommendation || {
          action: attribution.dimension ? `Investigate ${attribution.dimension} performance drivers` : 'Review dataset telemetry',
          target_page: '/datasets'
        }
      };

      // Check if dataset or historical records are insufficient
      if (attribution.emptyReason || !attribution.drivers || attribution.drivers.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            ...attribution,
            status: 'insufficient_evidence',
            emptyReason: attribution.emptyReason || 'Insufficient data available to decompose variance.',
            radar,
            analysis: null,
            explanation: attribution.emptyReason || 'No comparative breakdown available.',
            aiGenerated: false,
            fallback: false
          }
        });
      }

      // Generate grounded natural-language analysis via real AI model
      const aiResult = await geminiService.generateBusinessRadarAnalysis({
        insight,
        attribution
      });

      // Check if AI analysis failed or configuration is missing
      if (aiResult.error) {
        // If client explicitly permitted deterministic fallback
        if (req.query.allowFallback === 'true' || req.query.mode === 'deterministic') {
          const deterministicAnalysis = geminiService.buildDeterministicAnalyticalSummary(attribution, insight);
          return res.status(200).json({
            success: true,
            data: {
              ...attribution,
              emptyReason: null,
              radar,
              analysis: deterministicAnalysis,
              explanation: deterministicAnalysis.whatChanged.summary + '\n\n' + deterministicAnalysis.whatDataShows.summary,
              aiGenerated: false,
              isDeterministicSummary: true,
              aiError: aiResult.error
            }
          });
        }

        // Return honest error: DO NOT return HTTP 200 with fake success!
        const status = aiResult.error.status || (aiResult.error.code === 'AI_NOT_CONFIGURED' ? 503 : (aiResult.error.code === 'AI_QUOTA_EXCEEDED' ? 429 : (aiResult.error.code === 'AI_AUTH_FAILED' ? 401 : 500)));
        return res.status(status).json({
          success: false,
          error: {
            code: aiResult.error.code,
            message: aiResult.error.message,
            retryable: Boolean(aiResult.error.retryable)
          },
          data: {
            ...attribution,
            radar,
            canViewDeterministic: true
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...attribution,
          emptyReason: null,
          radar,
          analysis: aiResult.analysis,
          explanation: aiResult.analysis?.whatChanged?.summary
            ? `${aiResult.analysis.whatChanged.summary}\n\n${aiResult.analysis.whatDataShows?.summary || ''}`
            : 'Verified Business Radar analysis generated.',
          aiGenerated: true,
          model: aiResult.model || geminiService.modelName,
          evidenceValidated: true,
          fallback: false
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

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
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

      // 1. Resolve datasetId if missing but metricId present
      const evidence = insight.evidence || {};
      let datasetId = insight.dataset_id || evidence.datasetId || evidence.dataset_id || insight.source_metadata?.dataset_id;

      if (!datasetId && (insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id)) {
        const metricId = insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id;
        const MetricModel = require('../models/metricModel');
        const metric = await MetricModel.findByIdAndOrgId(metricId, organizationId).catch(() => null);
        if (metric?.dataset_id) {
          datasetId = metric.dataset_id;
          insight.dataset_id = metric.dataset_id;
        }
      }

      // 2. Calculate baseline attribution for the selected dimension
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

      if (!isValidUuid(id)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Insight #${id} not found or access denied.`
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

      const evidence = insight.evidence || {};
      let datasetId = insight.dataset_id || evidence.datasetId || evidence.dataset_id || insight.source_metadata?.dataset_id;

      if (!datasetId && (insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id)) {
        const metricId = insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id;
        const MetricModel = require('../models/metricModel');
        const metric = await MetricModel.findByIdAndOrgId(metricId, organizationId).catch(() => null);
        if (metric?.dataset_id) {
          datasetId = metric.dataset_id;
        }
      }

      if (!datasetId) {
        return res.status(200).json({
          success: true,
          data: {
            insightId: id,
            datasetId: null,
            availableDimensions: []
          }
        });
      }

      let schema = [];
      try {
        const loaded = await evidenceBuilderService.loadDatasetAndRecords(datasetId, organizationId);
        schema = loaded?.schema || [];
      } catch (_) {}

      const availableDimensions = rootCauseAttributionService.getEligibleDimensions(schema || []);

      return res.status(200).json({
        success: true,
        data: {
          insightId: id,
          datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
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
