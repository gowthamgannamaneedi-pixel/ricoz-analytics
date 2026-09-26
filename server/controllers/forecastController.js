const ForecastModel = require('../models/forecastModel');
const Dataset = require('../models/datasetModel');
const MetricModel = require('../models/metricModel');
const mlForecastService = require('../services/mlForecastService');
const analyticsService = require('../services/analyticsService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

const VALID_MODELS = ['auto', 'linear_regression', 'holt_winters', 'arima', 'exponential_smoothing'];
const VALID_INTERVALS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'hourly'];

/**
 * Helper to extract and aggregate time series from dataset records
 */
function extractSeriesFromRecords(records, dateCol, targetCol) {
  if (!records || records.length === 0) return [];

  const dateMap = new Map();

  for (const row of records) {
    const rawDate = row[dateCol];
    const rawVal = row[targetCol];

    if (rawDate === undefined || rawDate === null || rawDate === '') continue;
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) continue;

    const numVal = Number(rawVal);
    if (isNaN(numVal) || !isFinite(numVal)) continue;

    // ISO date format YYYY-MM-DD
    const dateKey = parsedDate.toISOString().split('T')[0];

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        date: dateKey,
        value: 0,
        count: 0,
        timestamp: parsedDate.getTime()
      });
    }

    const item = dateMap.get(dateKey);
    item.value += numVal;
    item.count += 1;
  }

  return Array.from(dateMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(item => ({
      date: item.date,
      value: Number(item.value.toFixed(4))
    }));
}

/**
 * Forecast Controller
 * Coordinates time-series data extraction, FastAPI ML calls, persistence, and anomaly detection.
 */
const ForecastController = {
  /**
   * GET /api/forecasts
   * List all saved forecasts for the organization
   */
  async getForecasts(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const limit = parseInt(req.query.limit, 10) || 50;

      const forecasts = await ForecastModel.findByOrganizationId(organizationId, limit);

      return res.status(200).json({
        success: true,
        count: forecasts.length,
        data: forecasts
      });
    } catch (err) {
      console.error('Error in getForecasts:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve forecasts.'
      });
    }
  },

  /**
   * GET /api/forecasts/:id
   * Get single forecast details
   */
  async getForecastById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const forecast = await ForecastModel.findByIdAndOrgId(id, organizationId);
      if (!forecast) {
        return res.status(404).json({
          success: false,
          message: 'Forecast not found or inaccessible.'
        });
      }

      return res.status(200).json({
        success: true,
        data: forecast
      });
    } catch (err) {
      console.error('Error in getForecastById:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve forecast details.'
      });
    }
  },

  /**
   * POST /api/forecasts
   * Save or generate a forecast record
   */
  async createForecast(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const {
        dataset_id,
        datasetId,
        metric_id,
        metricId,
        target_column,
        targetColumn,
        date_column,
        dateColumn,
        horizon_periods,
        horizonPeriods,
        interval,
        model_name,
        modelName,
        series,
        predictions,
        confidence_intervals,
        metrics,
        anomalies
      } = req.body;

      const effectiveDatasetId = dataset_id || datasetId || null;
      const effectiveMetricId = metric_id || metricId || null;
      const effectiveTargetCol = target_column || targetColumn || 'value';
      const effectiveDateCol = date_column || dateColumn || 'date';
      const effectiveHorizon = parseInt(horizon_periods || horizonPeriods || 30, 10);
      const effectiveInterval = interval || 'daily';
      const effectiveModel = (model_name || modelName || 'auto').toLowerCase();

      // If predictions are not already supplied, generate them
      if (!predictions || predictions.length === 0) {
        let timeSeries = series;

        if (!timeSeries && effectiveDatasetId) {
          const dataset = await Dataset.findById(effectiveDatasetId);
          if (!dataset) {
            return res.status(404).json({ success: false, message: 'Dataset not found.' });
          }
          if (dataset.file_path) {
            const records = await analyticsService.loadDatasetRecords(dataset.file_path);
            timeSeries = extractSeriesFromRecords(records, effectiveDateCol, effectiveTargetCol);
          }
        }

        if (!timeSeries || timeSeries.length < 4) {
          return res.status(400).json({
            success: false,
            message: `Insufficient time-series data for forecasting. Minimum 4 historical points required, found ${timeSeries ? timeSeries.length : 0}.`
          });
        }

        const mlResult = await mlForecastService.forecastAndDetect(timeSeries, {
          horizon: effectiveHorizon,
          interval: effectiveInterval,
          model: effectiveModel,
          confidenceLevel: 0.95
        });

        const created = await ForecastModel.create({
          organizationId,
          datasetId: effectiveDatasetId,
          metricId: effectiveMetricId,
          createdBy: userId,
          targetColumn: effectiveTargetCol,
          dateColumn: effectiveDateCol,
          horizonPeriods: effectiveHorizon,
          interval: effectiveInterval,
          modelName: mlResult.model || effectiveModel,
          predictions: mlResult.predictions,
          confidenceIntervals: mlResult.confidence_intervals,
          metrics: mlResult.metrics,
          anomalies: mlResult.anomalies,
          status: 'completed'
        });

        return res.status(201).json({
          success: true,
          data: created
        });
      }

      // If manual predictions payload supplied, persist directly
      const created = await ForecastModel.create({
        organizationId,
        datasetId: effectiveDatasetId,
        metricId: effectiveMetricId,
        createdBy: userId,
        targetColumn: effectiveTargetCol,
        dateColumn: effectiveDateCol,
        horizonPeriods: effectiveHorizon,
        interval: effectiveInterval,
        modelName: effectiveModel,
        predictions: predictions || [],
        confidenceIntervals: confidence_intervals || {},
        metrics: metrics || {},
        anomalies: anomalies || [],
        status: 'completed'
      });

      return res.status(201).json({
        success: true,
        data: created
      });
    } catch (err) {
      console.error('Error in createForecast:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create forecast.'
      });
    }
  },

  /**
   * POST /api/forecasts/generate
   * On-demand ML forecast generation with optional persistence
   */
  async generateForecast(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const {
        dataset_id,
        datasetId,
        metric_id,
        metricId,
        target_column,
        targetColumn,
        date_column,
        dateColumn,
        horizon_periods,
        horizonPeriods,
        horizon,
        interval = 'daily',
        model_name,
        modelName,
        model = 'auto',
        confidence_level,
        confidenceLevel = 0.95,
        persist = true,
        detect_anomalies = true,
        z_threshold = 2.5,
        series
      } = req.body;

      const effectiveDatasetId = dataset_id || datasetId || null;
      const effectiveMetricId = metric_id || metricId || null;
      let effectiveTargetCol = target_column || targetColumn || null;
      let effectiveDateCol = date_column || dateColumn || null;
      const rawHorizon = horizon_periods !== undefined ? horizon_periods : (horizonPeriods !== undefined ? horizonPeriods : (horizon !== undefined ? horizon : 30));
      const effectiveHorizon = parseInt(rawHorizon, 10);
      const effectiveInterval = (interval || 'daily').toLowerCase();
      const rawModel = (model_name || modelName || model || 'auto').toLowerCase();
      const effectiveModel = VALID_MODELS.includes(rawModel) ? rawModel : 'auto';
      const effectiveConfidence = Number(confidence_level || confidenceLevel) || 0.95;

      if (isNaN(effectiveHorizon) || effectiveHorizon <= 0 || effectiveHorizon > 365) {
        return res.status(400).json({
          success: false,
          message: 'Invalid forecast horizon. Must be an integer between 1 and 365.'
        });
      }

      if (!VALID_INTERVALS.includes(effectiveInterval)) {
        return res.status(400).json({
          success: false,
          message: `Invalid interval. Supported intervals: ${VALID_INTERVALS.join(', ')}.`
        });
      }

      let timeSeries = [];

      // 1. Time-series extraction from direct array
      if (Array.isArray(series) && series.length > 0) {
        timeSeries = series.map(p => ({
          date: String(p.date || p.timestamp || p.time),
          value: Number(p.value !== undefined ? p.value : p.val)
        })).filter(p => p.date && !isNaN(p.value) && isFinite(p.value));
      } 
      // 2. Time-series extraction from Dataset ID
      else if (effectiveDatasetId) {
        const dataset = await Dataset.findById(effectiveDatasetId);
        if (!dataset) {
          return res.status(404).json({
            success: false,
            message: 'Dataset not found.'
          });
        }

        if (!dataset.file_path) {
          return res.status(400).json({
            success: false,
            message: 'Dataset has no attached data file.'
          });
        }

        const records = await analyticsService.loadDatasetRecords(dataset.file_path);
        if (!records || records.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Dataset is empty. Cannot generate forecast.'
          });
        }

        // Auto-detect columns if not explicitly provided
        if (!effectiveDateCol || !effectiveTargetCol) {
          let schema = dataset.schema;
          if (typeof schema === 'string') {
            try { schema = JSON.parse(schema); } catch (_) { schema = []; }
          }
          const detected = analyticsService.detectDatasetDimensions(schema, records.slice(0, 10));
          if (!effectiveDateCol) effectiveDateCol = detected.dateColumn || 'date';
          if (!effectiveTargetCol) effectiveTargetCol = detected.primaryMetric || 'revenue';
        }

        timeSeries = extractSeriesFromRecords(records, effectiveDateCol, effectiveTargetCol);
      }
      // 3. Time-series extraction from Metric ID
      else if (effectiveMetricId) {
        const metric = await MetricModel.findByIdAndOrgId(effectiveMetricId, organizationId);
        if (!metric) {
          return res.status(404).json({
            success: false,
            message: 'Metric not found or inaccessible.'
          });
        }

        if (metric.dataset_file_path) {
          const records = await analyticsService.loadDatasetRecords(metric.dataset_file_path);
          let schema = metric.dataset_schema;
          if (typeof schema === 'string') {
            try { schema = JSON.parse(schema); } catch (_) { schema = []; }
          }
          const detected = analyticsService.detectDatasetDimensions(schema, records.slice(0, 10));
          effectiveDateCol = effectiveDateCol || detected.dateColumn || 'date';
          effectiveTargetCol = effectiveTargetCol || detected.primaryMetric || 'revenue';
          timeSeries = extractSeriesFromRecords(records, effectiveDateCol, effectiveTargetCol);
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either series array, dataset_id, or metric_id is required to generate forecast.'
        });
      }

      // Validate time-series length
      if (timeSeries.length < 4) {
        return res.status(400).json({
          success: false,
          message: `Insufficient historical time-series data. Minimum 4 valid data points required, found ${timeSeries.length}.`
        });
      }

      // Call ML Service for forecasting & anomaly detection
      let mlResult;
      if (detect_anomalies) {
        mlResult = await mlForecastService.forecastAndDetect(timeSeries, {
          horizon: effectiveHorizon,
          interval: effectiveInterval,
          model: effectiveModel,
          confidenceLevel: effectiveConfidence,
          zThreshold: z_threshold
        });
      } else {
        const forecastResp = await mlForecastService.generateForecast(timeSeries, {
          horizon: effectiveHorizon,
          interval: effectiveInterval,
          model: effectiveModel,
          confidenceLevel: effectiveConfidence
        });
        mlResult = {
          ...forecastResp,
          anomalies: []
        };
      }

      let savedRecord = null;
      if (persist) {
        savedRecord = await ForecastModel.create({
          organizationId,
          datasetId: effectiveDatasetId,
          metricId: effectiveMetricId,
          createdBy: userId,
          targetColumn: effectiveTargetCol || 'value',
          dateColumn: effectiveDateCol || 'date',
          horizonPeriods: effectiveHorizon,
          interval: effectiveInterval,
          modelName: mlResult.model || effectiveModel,
          predictions: mlResult.predictions || [],
          confidenceIntervals: mlResult.confidence_intervals || {},
          metrics: mlResult.metrics || {},
          anomalies: mlResult.anomalies || [],
          status: 'completed'
        });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.FORECAST_GENERATED,
        resourceType: 'forecast',
        resourceId: savedRecord ? savedRecord.id : null,
        description: `ML Forecast generated (model: ${mlResult.model || effectiveModel}, horizon: ${effectiveHorizon})`,
        metadata: { model: mlResult.model || effectiveModel, horizon: effectiveHorizon, interval: effectiveInterval },
        req
      });

      return res.status(200).json({
        success: true,
        data: {
          id: savedRecord ? savedRecord.id : null,
          model: mlResult.model,
          historical_points: timeSeries.length,
          historical_series: timeSeries,
          predictions: mlResult.predictions,
          confidence_intervals: mlResult.confidence_intervals,
          metrics: mlResult.metrics,
          anomalies: mlResult.anomalies || [],
          model_metadata: mlResult.model_metadata || {},
          persisted: Boolean(savedRecord)
        }
      });
    } catch (err) {
      console.error('Error in generateForecast:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Forecast generation failed.'
      });
    }
  },

  /**
   * POST /api/forecasts/anomalies
   * Statistical ML anomaly detection on time-series
   */
  async detectAnomalies(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const {
        series,
        dataset_id,
        datasetId,
        target_column,
        targetColumn,
        date_column,
        dateColumn,
        z_threshold = 2.5,
        window_size = 7
      } = req.body;

      const effectiveDatasetId = dataset_id || datasetId || null;
      const effectiveTargetCol = target_column || targetColumn || 'value';
      const effectiveDateCol = date_column || dateColumn || 'date';

      let timeSeries = [];

      if (Array.isArray(series) && series.length > 0) {
        timeSeries = series.map(p => ({
          date: String(p.date || p.timestamp || p.time),
          value: Number(p.value !== undefined ? p.value : p.val)
        })).filter(p => p.date && !isNaN(p.value) && isFinite(p.value));
      } else if (effectiveDatasetId) {
        const dataset = await Dataset.findById(effectiveDatasetId);
        if (!dataset) {
          return res.status(404).json({ success: false, message: 'Dataset not found.' });
        }
        if (dataset.file_path) {
          const records = await analyticsService.loadDatasetRecords(dataset.file_path);
          timeSeries = extractSeriesFromRecords(records, effectiveDateCol, effectiveTargetCol);
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either series array or dataset_id is required for anomaly detection.'
        });
      }

      if (timeSeries.length < 4) {
        return res.status(400).json({
          success: false,
          message: `Insufficient data points for anomaly detection. Minimum 4 points required, found ${timeSeries.length}.`
        });
      }

      const anomalies = await mlForecastService.detectAnomalies(timeSeries, {
        zThreshold: Number(z_threshold) || 2.5,
        windowSize: parseInt(window_size, 10) || 7
      });

      return res.status(200).json({
        success: true,
        count: anomalies.length,
        data: anomalies
      });
    } catch (err) {
      console.error('Error in detectAnomalies:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Anomaly detection failed.'
      });
    }
  },

  /**
   * DELETE /api/forecasts/:id
   * Delete a forecast record
   */
  async deleteForecast(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const deleted = await ForecastModel.deleteByIdAndOrgId(id, organizationId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Forecast not found or already deleted.'
        });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.FORECAST_DELETED,
        resourceType: 'forecast',
        resourceId: id,
        description: `Forecast record (ID: ${id}) deleted`,
        metadata: { forecastId: id },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Forecast deleted successfully.'
      });
    } catch (err) {
      console.error('Error in deleteForecast:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete forecast.'
      });
    }
  }
};

module.exports = ForecastController;
