const Metric = require('../models/metricModel');
const Dataset = require('../models/datasetModel');
const { loadDatasetRecords } = require('../services/analyticsService');

/**
 * Metric & KPI Controller
 * Multi-tenant business metrics and KPI calculations engine
 */

const VALID_TYPES = ['currency', 'percentage', 'count', 'decimal', 'custom', 'number', 'ratio', 'average'];
const VALID_AGGREGATIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'CUSTOM'];

/**
 * Evaluate metric calculation on dataset records
 * Supports aggregations like SUM(col), AVG(col), COUNT(col), MIN(col), MAX(col), or combined expressions
 */
function evaluateMetricOnRecords(records = [], formula = '', aggregationType = 'SUM', targetColumn = null) {
  if (!records || records.length === 0) {
    return { value: 0, recordCount: 0 };
  }

  const formulaUpper = (formula || '').toUpperCase().trim();

  // 1. Detect aggregation from formula if not explicitly given
  let agg = (aggregationType || 'SUM').toUpperCase();
  let col = targetColumn;

  if (!col) {
    const aggMatch = formulaUpper.match(/(SUM|AVG|COUNT|MIN|MAX)\(([a-zA-Z0-9_]+)\)/i);
    if (aggMatch) {
      agg = aggMatch[1].toUpperCase();
      col = aggMatch[2].toLowerCase();
    }
  }

  // If column still not found, search record keys for matching column
  if (!col && records.length > 0) {
    const firstRow = records[0];
    const numericKey = Object.keys(firstRow).find(k => {
      const val = Number(firstRow[k]);
      return !isNaN(val) && !k.toLowerCase().includes('id');
    });
    col = numericKey || Object.keys(firstRow)[0];
  }

  if (agg === 'COUNT') {
    if (col && col !== '*' && col !== '1') {
      const validCount = records.filter(r => r[col] !== undefined && r[col] !== null && r[col] !== '').length;
      return { value: validCount, recordCount: records.length, column: col, agg };
    }
    return { value: records.length, recordCount: records.length, agg };
  }

  // Find column in row with case-insensitive matching
  const findRowVal = (row, targetKey) => {
    if (!targetKey) return NaN;
    if (row[targetKey] !== undefined) return Number(row[targetKey]);
    const matchedKey = Object.keys(row).find(k => k.toLowerCase() === targetKey.toLowerCase());
    return matchedKey ? Number(row[matchedKey]) : NaN;
  };

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const r of records) {
    const val = findRowVal(r, col);
    if (!isNaN(val)) {
      sum += val;
      count++;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  if (count === 0) {
    return { value: 0, recordCount: records.length, column: col, agg };
  }

  let result = 0;
  switch (agg) {
    case 'AVG':
      result = count > 0 ? (sum / count) : 0;
      break;
    case 'MIN':
      result = min !== Infinity ? min : 0;
      break;
    case 'MAX':
      result = max !== -Infinity ? max : 0;
      break;
    case 'SUM':
    default:
      result = sum;
      break;
  }

  return {
    value: Math.round(result * 100) / 100,
    recordCount: records.length,
    validRecords: count,
    column: col,
    agg
  };
}

/**
 * Determine metric status based on target and threshold boundaries
 */
function calculateMetricStatus(currentValue, targetValue, warningThreshold, criticalThreshold) {
  if (targetValue === null || targetValue === undefined || isNaN(Number(targetValue))) {
    return 'on_track';
  }

  const target = Number(targetValue);
  const val = Number(currentValue);

  if (criticalThreshold !== null && criticalThreshold !== undefined && !isNaN(Number(criticalThreshold))) {
    if (val < Number(criticalThreshold)) return 'critical';
  }

  if (warningThreshold !== null && warningThreshold !== undefined && !isNaN(Number(warningThreshold))) {
    if (val < Number(warningThreshold)) return 'at_risk';
  }

  // Default heuristic if explicit thresholds not specified
  if (target > 0) {
    const ratio = val / target;
    if (ratio >= 0.9) return 'on_track';
    if (ratio >= 0.7) return 'at_risk';
    return 'behind';
  }

  return 'on_track';
}

/**
 * GET /api/metrics
 * List all KPIs & metrics for the authenticated user's organization
 */
const getMetrics = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const metrics = await Metric.findByOrganizationId(orgId);

    // Populate live calculated values
    const enrichedMetrics = await Promise.all(
      metrics.map(async (m) => {
        let formatting = m.formatting;
        if (typeof formatting === 'string') {
          try { formatting = JSON.parse(formatting); } catch (_) { formatting = {}; }
        }

        let calculatedValue = m.target_value ? Number(m.target_value) : 0;
        let recordCount = 0;

        // If metric is linked to a dataset, calculate value dynamically
        if (m.dataset_id) {
          try {
            const dataset = await Dataset.findByIdAndUserId(m.dataset_id, req.user.id).catch(() => null);
            if (dataset && dataset.file_path) {
              const records = await loadDatasetRecords(dataset.file_path).catch(() => []);
              if (records && records.length > 0) {
                const evalRes = evaluateMetricOnRecords(
                  records,
                  m.formula,
                  formatting?.aggregation_type,
                  formatting?.target_column
                );
                calculatedValue = evalRes.value;
                recordCount = evalRes.recordCount;
              }
            }
          } catch (_) {
            // Gracefully use target or default if dataset is unavailable
          }
        }

        const status = calculateMetricStatus(
          calculatedValue,
          m.target_value,
          formatting?.warning_threshold,
          formatting?.critical_threshold
        );

        const target = Number(m.target_value);
        const progressPercentage = target > 0 ? Number(((calculatedValue / target) * 100).toFixed(2)) : 100;

        return {
          ...m,
          current_value: calculatedValue,
          record_count: recordCount,
          status: status,
          progress_percentage: progressPercentage,
          target_progress_pct: progressPercentage,
          formatting
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedMetrics.length,
      data: enrichedMetrics,
      metrics: enrichedMetrics
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/metrics/:id
 * Retrieve a single metric by ID
 */
const getMetricById = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const metric = await Metric.findByIdAndOrgId(id, orgId);
    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'Metric not found or you do not have permission to access it.'
      });
    }

    let formatting = metric.formatting;
    if (typeof formatting === 'string') {
      try { formatting = JSON.parse(formatting); } catch (_) { formatting = {}; }
    }

    let calculatedValue = metric.target_value ? Number(metric.target_value) : 0;
    let recordCount = 0;

    if (metric.dataset_file_path) {
      try {
        const records = await loadDatasetRecords(metric.dataset_file_path).catch(() => []);
        if (records && records.length > 0) {
          const evalRes = evaluateMetricOnRecords(
            records,
            metric.formula,
            formatting?.aggregation_type,
            formatting?.target_column
          );
          calculatedValue = evalRes.value;
          recordCount = evalRes.recordCount;
        }
      } catch (_) {}
    }

    const status = calculateMetricStatus(
      calculatedValue,
      metric.target_value,
      formatting?.warning_threshold,
      formatting?.critical_threshold
    );

    const target = Number(metric.target_value);
    const progressPercentage = target > 0 ? Number(((calculatedValue / target) * 100).toFixed(2)) : 100;

    const payload = {
      ...metric,
      current_value: calculatedValue,
      record_count: recordCount,
      status: status,
      progress_percentage: progressPercentage,
      target_progress_pct: progressPercentage,
      formatting
    };

    return res.status(200).json({
      success: true,
      data: payload,
      metric: payload
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/metrics
 * Create a new KPI / Metric definition
 */
const createMetric = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const userId = req.user.id;
    const {
      name,
      description = '',
      formula,
      type = 'currency',
      unit = '',
      target_value,
      targetValue,
      dataset_id,
      datasetId,
      aggregation_type,
      warning_threshold,
      critical_threshold,
      status,
      formatting = {}
    } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Metric name is required.'
      });
    }

    if (!formula || typeof formula !== 'string' || !formula.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Calculation formula is required (e.g. SUM(sales_amount) or COUNT(order_id)).'
      });
    }

    const normalizedType = String(type).toLowerCase();
    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid metric type. Must be one of: ${VALID_TYPES.join(', ')}`
      });
    }

    // Map to database schema enum
    let dbType = 'currency';
    if (['currency', 'percentage', 'count', 'decimal', 'custom'].includes(normalizedType)) {
      dbType = normalizedType;
    } else if (normalizedType === 'number') {
      dbType = 'decimal';
    } else if (normalizedType === 'average' || normalizedType === 'ratio') {
      dbType = 'custom';
    }

    const effectiveTargetValue = targetValue !== undefined ? targetValue : target_value;
    const effectiveDatasetId = datasetId !== undefined ? datasetId : dataset_id;

    // Merge metadata
    const mergedFormatting = {
      ...(typeof formatting === 'object' ? formatting : {}),
      aggregation_type: aggregation_type || 'SUM',
      warning_threshold: warning_threshold || null,
      critical_threshold: critical_threshold || null,
      status: status || 'on_track'
    };

    const newMetric = await Metric.create({
      organizationId: orgId,
      datasetId: effectiveDatasetId,
      createdBy: userId,
      name,
      description,
      formula,
      type: dbType,
      unit,
      targetValue: effectiveTargetValue,
      formatting: mergedFormatting
    });

    return res.status(201).json({
      success: true,
      message: 'KPI / Metric created successfully.',
      data: newMetric,
      metric: newMetric
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/metrics/:id
 * Update an existing metric
 */
const updateMetric = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;
    const {
      name,
      description,
      formula,
      type,
      unit,
      target_value,
      targetValue,
      dataset_id,
      datasetId,
      aggregation_type,
      warning_threshold,
      critical_threshold,
      status,
      formatting
    } = req.body;

    const effectiveTargetValue = targetValue !== undefined ? targetValue : target_value;
    const effectiveDatasetId = datasetId !== undefined ? datasetId : dataset_id;

    let mergedFormatting = typeof formatting === 'object' ? formatting : {};
    if (aggregation_type) mergedFormatting.aggregation_type = aggregation_type;
    if (warning_threshold !== undefined) mergedFormatting.warning_threshold = warning_threshold;
    if (critical_threshold !== undefined) mergedFormatting.critical_threshold = critical_threshold;
    if (status) mergedFormatting.status = status;

    const updated = await Metric.updateByIdAndOrgId(id, orgId, {
      name,
      description,
      formula,
      type,
      unit,
      targetValue: effectiveTargetValue,
      datasetId: effectiveDatasetId,
      formatting: Object.keys(mergedFormatting).length > 0 ? mergedFormatting : undefined
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Metric not found or you do not have permission to update it.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'KPI / Metric updated successfully.',
      data: updated,
      metric: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/metrics/:id
 * Delete metric definition
 */
const deleteMetric = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const deleted = await Metric.deleteByIdAndOrgId(id, orgId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Metric not found or you do not have permission to delete it.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'KPI / Metric deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMetrics,
  getMetricById,
  createMetric,
  updateMetric,
  deleteMetric,
  evaluateMetricOnRecords
};
