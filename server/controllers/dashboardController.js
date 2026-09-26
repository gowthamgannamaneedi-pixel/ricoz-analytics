const Dashboard = require('../models/dashboardModel');
const Dataset = require('../models/datasetModel');
const Metric = require('../models/metricModel');
const { loadDatasetRecords } = require('../services/analyticsService');
const dataQualityService = require('../services/dataQualityService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

const VALID_WIDGET_TYPES = [
  'kpi_card',
  'line_chart',
  'bar_chart',
  'pie_chart',
  'area_chart',
  'table',
  'scatter_plot',
  'metric_gauge',
  'forecast_chart',
  'data_quality_score',
  'ai_insights',
  'executive_insights'
];

/**
 * Helper to evaluate a dynamic metric or widget calculation
 */
function evaluateRecordAggregation(records = [], aggType = 'SUM', col = null) {
  if (!records || records.length === 0) return { value: 0, count: 0 };
  const agg = (aggType || 'SUM').toUpperCase();

  if (agg === 'COUNT') {
    return { value: records.length, count: records.length };
  }

  const findVal = (row, key) => {
    if (!key) return NaN;
    if (row[key] !== undefined) return Number(row[key]);
    const matched = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
    return matched ? Number(row[matched]) : NaN;
  };

  let targetCol = col;
  if (!targetCol && records.length > 0) {
    const firstRow = records[0];
    targetCol = Object.keys(firstRow).find(k => !isNaN(Number(firstRow[k])) && !k.toLowerCase().includes('id'));
  }

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const r of records) {
    const val = findVal(r, targetCol);
    if (!isNaN(val)) {
      sum += val;
      count++;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  if (count === 0) return { value: 0, count: records.length };

  let result = 0;
  switch (agg) {
    case 'AVG':
      result = sum / count;
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
    count
  };
}

/**
 * GET /api/dashboards
 * List all dashboards for authenticated user's organization
 */
const getDashboards = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const dashboards = await Dashboard.findByOrganizationId(orgId);

    return res.status(200).json({
      success: true,
      count: dashboards.length,
      data: dashboards,
      dashboards
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboards/:id
 * Retrieve a specific dashboard with its populated widgets
 */
const getDashboardById = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const dashboard = await Dashboard.findByIdAndOrgId(id, orgId);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or you do not have permission to access it.'
      });
    }

    const rawWidgets = await Dashboard.findWidgetsByDashboardId(id);

    // Enrich widgets with live calculated values or metric status if applicable
    const enrichedWidgets = await Promise.all(
      rawWidgets.map(async (w) => {
        let configuration = w.configuration;
        if (typeof configuration === 'string') {
          try { configuration = JSON.parse(configuration); } catch (_) { configuration = {}; }
        }
        let position = w.position;
        if (typeof position === 'string') {
          try { position = JSON.parse(position); } catch (_) { position = {}; }
        }

        let calculatedValue = w.metric_target_value ? Number(w.metric_target_value) : null;
        let chartData = null;

        // If widget is linked to a metric or dataset, calculate live values
        if (w.dataset_file_path) {
          try {
            const records = await loadDatasetRecords(w.dataset_file_path).catch(() => []);
            if (records && records.length > 0) {
              if (w.type === 'kpi_card' || w.type === 'metric_gauge') {
                const evalRes = evaluateRecordAggregation(
                  records,
                  configuration?.aggregation || 'SUM',
                  configuration?.valueColumn || configuration?.targetColumn
                );
                calculatedValue = evalRes.value;
              } else if (['line_chart', 'bar_chart', 'pie_chart', 'area_chart'].includes(w.type)) {
                // Group by category column
                const catCol = configuration?.categoryColumn || configuration?.dateColumn || Object.keys(records[0])[0];
                const valCol = configuration?.valueColumn || Object.keys(records[0]).find(k => !isNaN(Number(records[0][k])) && !k.toLowerCase().includes('id'));
                
                const groupMap = {};
                records.forEach(r => {
                  const key = String(r[catCol] || 'Other');
                  const num = Number(r[valCol]) || 0;
                  groupMap[key] = (groupMap[key] || 0) + num;
                });
                chartData = Object.entries(groupMap).map(([name, value]) => ({
                  name,
                  value: Math.round(value * 100) / 100
                })).slice(0, 10);
              }
            }
          } catch (_) {}
        }

        const target = Number(w.metric_target_value || configuration?.targetValue || 0);
        const current = calculatedValue !== null ? calculatedValue : (target || 0);
        const progressPct = target > 0 ? Number(((current / target) * 100).toFixed(2)) : 100;
        let status = 'on_track';
        if (target > 0) {
          if (progressPct < 70) status = 'behind';
          else if (progressPct < 85) status = 'at_risk';
        }

        let qualityProfile = null;
        if (w.type === 'data_quality_score' && w.dataset_id) {
          try {
            qualityProfile = await dataQualityService.getQualityProfile(w.dataset_id, orgId);
            if (qualityProfile) {
              calculatedValue = qualityProfile.quality_score;
              status = qualityProfile.status;
            }
          } catch (_) {}
        }

        let aiInsights = null;
        if (w.type === 'ai_insights' || w.type === 'executive_insights') {
          try {
            const insightService = require('../services/insightService');
            const insRes = await insightService.generateInsights(orgId, {
              datasetId: w.dataset_id || null,
              persist: false
            });
            aiInsights = insRes;
          } catch (_) {}
        }

        return {
          ...w,
          configuration,
          position,
          current_value: calculatedValue !== null ? calculatedValue : (target || 0),
          progress_pct: progressPct,
          status,
          chart_data: chartData,
          quality_profile: qualityProfile,
          ai_insights: aiInsights
        };
      })
    );

    const payload = {
      ...dashboard,
      widgets: enrichedWidgets
    };

    return res.status(200).json({
      success: true,
      data: payload,
      dashboard: payload
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/dashboards
 * Create a new dashboard definition
 */
const createDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const userId = req.user.id;
    const {
      title,
      description = '',
      is_default,
      isDefault,
      is_public,
      isPublic,
      layout = [],
      filters = {}
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard title is required.'
      });
    }

    const effectiveIsDefault = isDefault !== undefined ? isDefault : (is_default !== undefined ? is_default : false);
    const effectiveIsPublic = isPublic !== undefined ? isPublic : (is_public !== undefined ? is_public : false);

    const newDashboard = await Dashboard.create({
      organizationId: orgId,
      createdBy: userId,
      title,
      description,
      isDefault: effectiveIsDefault,
      isPublic: effectiveIsPublic,
      layout,
      filters
    });

    // Safe Audit Log
    await logAuditEvent({
      organizationId: orgId,
      userId,
      action: AUDIT_ACTIONS.DASHBOARD_CREATED,
      resourceType: 'dashboard',
      resourceId: newDashboard.id,
      description: `Dashboard "${newDashboard.title}" created by ${req.user.name || req.user.email}`,
      metadata: { title: newDashboard.title, isDefault: effectiveIsDefault },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Dashboard created successfully.',
      data: newDashboard,
      dashboard: newDashboard
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/dashboards/:id
 * Update dashboard metadata, layout, or filters
 */
const updateDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;
    const {
      title,
      description,
      is_default,
      isDefault,
      is_public,
      isPublic,
      layout,
      filters
    } = req.body;

    if (title !== undefined && (!title || typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard title cannot be empty.'
      });
    }

    const updated = await Dashboard.updateByIdAndOrgId(id, orgId, {
      title,
      description,
      isDefault: isDefault !== undefined ? isDefault : is_default,
      isPublic: isPublic !== undefined ? isPublic : is_public,
      layout,
      filters
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or you do not have permission to update it.'
      });
    }

    // Safe Audit Log
    await logAuditEvent({
      organizationId: orgId,
      userId: req.user.id,
      action: AUDIT_ACTIONS.DASHBOARD_UPDATED,
      resourceType: 'dashboard',
      resourceId: id,
      description: `Dashboard "${updated.title}" updated by ${req.user.name || req.user.email}`,
      metadata: { title: updated.title },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Dashboard updated successfully.',
      data: updated,
      dashboard: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/dashboards/:id
 * Delete a custom dashboard
 */
const deleteDashboard = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id } = req.params;

    const deleted = await Dashboard.deleteByIdAndOrgId(id, orgId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or you do not have permission to delete it.'
      });
    }

    // Safe Audit Log
    await logAuditEvent({
      organizationId: orgId,
      userId: req.user.id,
      action: AUDIT_ACTIONS.DASHBOARD_DELETED,
      resourceType: 'dashboard',
      resourceId: id,
      description: `Dashboard (ID: ${id}) deleted by ${req.user.name || req.user.email}`,
      metadata: { dashboardId: id },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Dashboard deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// WIDGET MANAGEMENT HANDLERS
// ============================================================================

/**
 * POST /api/dashboards/:id/widgets
 * Add a widget to a dashboard
 */
const addWidget = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id: dashboardId } = req.params;
    const {
      title,
      type,
      dataset_id,
      datasetId,
      metric_id,
      metricId,
      configuration = {},
      position = { x: 0, y: 0, w: 6, h: 4 }
    } = req.body;

    // Verify dashboard exists in org
    const dashboard = await Dashboard.findByIdAndOrgId(dashboardId, orgId);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or you do not have permission to add widgets to it.'
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Widget title is required.'
      });
    }

    if (!type || !VALID_WIDGET_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid widget type. Must be one of: ${VALID_WIDGET_TYPES.join(', ')}`
      });
    }

    const effectiveDatasetId = datasetId !== undefined ? datasetId : dataset_id;
    const effectiveMetricId = metricId !== undefined ? metricId : metric_id;

    const newWidget = await Dashboard.addWidget(dashboardId, {
      datasetId: effectiveDatasetId,
      metricId: effectiveMetricId,
      title,
      type,
      configuration,
      position
    });

    return res.status(201).json({
      success: true,
      message: 'Widget added to dashboard successfully.',
      data: newWidget,
      widget: newWidget
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/dashboards/:id/widgets/:widgetId
 * Update a widget's configuration or position
 */
const updateWidget = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id: dashboardId, widgetId } = req.params;
    const {
      title,
      type,
      dataset_id,
      datasetId,
      metric_id,
      metricId,
      configuration,
      position
    } = req.body;

    // Verify dashboard belongs to organization
    const dashboard = await Dashboard.findByIdAndOrgId(dashboardId, orgId);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or access denied.'
      });
    }

    if (type && !VALID_WIDGET_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid widget type. Must be one of: ${VALID_WIDGET_TYPES.join(', ')}`
      });
    }

    const updated = await Dashboard.updateWidget(widgetId, dashboardId, {
      title,
      type,
      datasetId: datasetId !== undefined ? datasetId : dataset_id,
      metricId: metricId !== undefined ? metricId : metric_id,
      configuration,
      position
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found on this dashboard.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Widget updated successfully.',
      data: updated,
      widget: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/dashboards/:id/widgets/:widgetId
 * Remove a widget from a dashboard
 */
const deleteWidget = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    const { id: dashboardId, widgetId } = req.params;

    const dashboard = await Dashboard.findByIdAndOrgId(dashboardId, orgId);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found or access denied.'
      });
    }

    const deleted = await Dashboard.deleteWidget(widgetId, dashboardId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found on this dashboard.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Widget removed from dashboard successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  deleteWidget
};
