const Dataset = require('../models/datasetModel');
const {
  loadDatasetRecords,
  detectDatasetDimensions,
  applyDatasetFilters,
  computeDatasetKpis,
  computeDatasetTrends,
  computeDatasetBreakdown,
  getPaginatedDatasetRows,
  getDatasetFilterOptions,
  queryDatasetSummary,
  queryDatasetKpis,
  queryDatasetTrends,
  queryDatasetBreakdowns,
  queryDatasetRows
} = require('../services/analyticsService');

/**
 * Analytics Controller
 * Handles dynamic aggregation, filtering, KPIs, and charts for user datasets
 * Powered by high-efficiency PostgreSQL queries and streaming file aggregation
 */

/**
 * Helper to fetch dataset and verify authenticated user access (Tenant isolation enforced)
 */
async function getVerifiedDataset(datasetId, user) {
  const userId = user?.id;
  const organizationId = user?.organization_id;

  // 1. Direct user ownership check
  let dataset = await Dataset.findByIdAndUserId(datasetId, userId);

  // 2. Organization-level dataset access (Enterprise dataset 1 or admin/manager role)
  if (!dataset && organizationId) {
    if (Number(datasetId) === 1 || user?.role === 'admin' || user?.role === 'manager' || user?.role === 'viewer' || user?.role === 'analyst') {
      dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    }
  }

  if (!dataset) {
    const error = new Error('Dataset not found or you do not have permission to access it.');
    error.status = 404;
    throw error;
  }
  return dataset;
}

/**
 * GET /api/analytics/datasets/:id/summary
 * Returns dataset schema, detected dimensions, and available filter dropdown options
 */
const getDatasetSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dataset = await getVerifiedDataset(id, req.user);
    const summaryData = await queryDatasetSummary(dataset, req.user);

    return res.status(200).json({
      success: true,
      data: summaryData
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/analytics/datasets/:id/kpis
 * Returns dynamic KPIs and period comparisons based on applied query filters
 */
const getDatasetKpis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dataset = await getVerifiedDataset(id, req.user);
    const result = await queryDatasetKpis(dataset, req.query, req.user);

    return res.status(200).json({
      success: true,
      data: {
        kpis: result.kpis,
        dimensions: result.dimensions,
        totalFilteredRecords: result.kpis.recordCount,
        totalDatasetRecords: dataset.row_count || result.kpis.recordCount
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/analytics/datasets/:id/trends
 * Returns time-series revenue/order trend grouped by date/month
 */
const getDatasetTrends = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dataset = await getVerifiedDataset(id, req.user);
    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
    const dimensions = detectDatasetDimensions(schema);
    const trends = await queryDatasetTrends(dataset, req.query, req.user);

    return res.status(200).json({
      success: true,
      data: {
        trends,
        dateColumn: dimensions.dateColumn,
        primaryMetric: dimensions.primaryMetric
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/analytics/datasets/:id/breakdowns
 * Returns categorical breakdowns for charts (e.g. region, product, channel, category)
 */
const getDatasetBreakdowns = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupBy } = req.query;

    const dataset = await getVerifiedDataset(id, req.user);
    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
    const dimensions = detectDatasetDimensions(schema);
    const targetDimension = groupBy || dimensions.regionColumn || dimensions.productColumn || dimensions.categoryColumn || dimensions.channelColumn || 'category';

    const breakdown = await queryDatasetBreakdowns(dataset, targetDimension, req.query, req.user);

    return res.status(200).json({
      success: true,
      data: {
        dimension: targetDimension,
        breakdown
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/analytics/datasets/:id/rows
 * Returns paginated, searchable, sortable rows for data table
 */
const getDatasetRows = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dataset = await getVerifiedDataset(id, req.user);
    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
    const paginated = await queryDatasetRows(dataset, req.query, req.user);

    return res.status(200).json({
      success: true,
      data: {
        ...paginated,
        schema
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getDatasetSummary,
  getDatasetKpis,
  getDatasetTrends,
  getDatasetBreakdowns,
  getDatasetRows,
  getVerifiedDataset
};
