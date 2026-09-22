const Dataset = require('../models/datasetModel');
const {
  loadDatasetRecords,
  detectDatasetDimensions,
  applyDatasetFilters,
  computeDatasetKpis,
  computeDatasetTrends,
  computeDatasetBreakdown,
  getPaginatedDatasetRows,
  getDatasetFilterOptions
} = require('../services/analyticsService');

/**
 * Analytics Controller
 * Handles dynamic aggregation, filtering, KPIs, and charts for user datasets
 */

/**
 * Helper to fetch dataset and verify authenticated user ownership
 */
async function getVerifiedDataset(datasetId, userId) {
  const dataset = await Dataset.findByIdAndUserId(datasetId, userId);
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
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await getVerifiedDataset(id, userId);
    const records = await loadDatasetRecords(dataset.file_path);

    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : dataset.schema || [];
    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));
    const filterOptions = getDatasetFilterOptions(records, dimensions);

    return res.status(200).json({
      success: true,
      data: {
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          rowCount: dataset.row_count || records.length,
          columnCount: dataset.column_count || schema.length,
          schema,
          createdAt: dataset.created_at,
          dataSourceName: dataset.data_source_name,
          dataSourceType: dataset.data_source_type
        },
        dimensions,
        filterOptions
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
 * GET /api/analytics/datasets/:id/kpis
 * Returns dynamic KPIs and period comparisons based on applied query filters
 */
const getDatasetKpis = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await getVerifiedDataset(id, userId);
    const records = await loadDatasetRecords(dataset.file_path);

    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : dataset.schema || [];
    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));

    // Apply active query filters
    const filteredRecords = applyDatasetFilters(records, req.query, dimensions);
    const kpis = computeDatasetKpis(records, filteredRecords, dimensions);

    return res.status(200).json({
      success: true,
      data: {
        kpis,
        dimensions,
        totalFilteredRecords: filteredRecords.length,
        totalDatasetRecords: records.length
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
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await getVerifiedDataset(id, userId);
    const records = await loadDatasetRecords(dataset.file_path);

    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : dataset.schema || [];
    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));

    const filteredRecords = applyDatasetFilters(records, req.query, dimensions);
    const trends = computeDatasetTrends(filteredRecords, dimensions);

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
    const userId = req.user.id;
    const { id } = req.params;
    const { groupBy } = req.query;

    const dataset = await getVerifiedDataset(id, userId);
    const records = await loadDatasetRecords(dataset.file_path);

    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : dataset.schema || [];
    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));

    const targetDimension = groupBy || dimensions.regionColumn || dimensions.productColumn || dimensions.categoryColumn || dimensions.channelColumn;

    const filteredRecords = applyDatasetFilters(records, req.query, dimensions);
    const breakdown = computeDatasetBreakdown(filteredRecords, targetDimension, dimensions);

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
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await getVerifiedDataset(id, userId);
    const records = await loadDatasetRecords(dataset.file_path);

    const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : dataset.schema || [];
    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));

    const filteredRecords = applyDatasetFilters(records, req.query, dimensions);
    const paginated = getPaginatedDatasetRows(filteredRecords, req.query);

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
  getDatasetRows
};
