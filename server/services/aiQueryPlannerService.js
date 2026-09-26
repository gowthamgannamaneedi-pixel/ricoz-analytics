const Dataset = require('../models/datasetModel');
const MetricModel = require('../models/metricModel');
const Dashboard = require('../models/dashboardModel');
const AlertModel = require('../models/alertModel');
const ForecastModel = require('../models/forecastModel');
const DatasetRelationshipModel = require('../models/datasetRelationshipModel');
const analyticsService = require('./analyticsService');
const mlForecastService = require('./mlForecastService');
const geminiService = require('./geminiService');

/**
 * AI Query Planner & Analytics Execution Service
 * Orchestrates multi-tenant authorization, query planning, secure computation, and Gemini explanation.
 */
class AIQueryPlannerService {
  /**
   * Execute an end-to-end natural language analytics query
   * @param {{
   *   message: string,
   *   organizationId: string,
   *   userId: number|string,
   *   userRole?: string,
   *   datasetId?: string|number|null,
   *   dashboardId?: string|null,
   *   metricId?: string|null
   * }} params
   * @returns {Promise<object>}
   */
  async processQuery({
    message,
    organizationId,
    userId,
    userRole = 'viewer',
    datasetId = null,
    dashboardId = null,
    metricId = null
  }) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Query message cannot be empty.');
    }

    const cleanQuestion = message.trim();

    // 1. Gather Authorized Context
    const [userDatasets, orgMetrics, orgDashboards, orgAlerts, orgForecasts, orgRelationships] = await Promise.all([
      Dataset.findByUserId(userId).catch(() => []),
      MetricModel.findByOrganizationId(organizationId).catch(() => []),
      Dashboard.findByOrganizationId(organizationId).catch(() => []),
      AlertModel.findByOrganizationId(organizationId).catch(() => []),
      ForecastModel.findByOrganizationId(organizationId, 10).catch(() => []),
      DatasetRelationshipModel.findByOrganizationId(organizationId).catch(() => [])
    ]);

    // Select primary dataset context
    let targetDataset = null;
    if (datasetId) {
      targetDataset = await Dataset.findById(datasetId);
      if (!targetDataset) {
        // Multi-tenant security isolation check
        throw new Error('Dataset not found or you do not have permission to access it.');
      }
    } else if (userDatasets.length > 0) {
      targetDataset = userDatasets[0];
    }

    // Select dashboard context if provided
    let targetDashboard = null;
    if (dashboardId) {
      targetDashboard = orgDashboards.find(d => String(d.id) === String(dashboardId));
      if (!targetDashboard) {
        throw new Error('Dashboard not found or access denied.');
      }
    }

    // Select metric context if provided
    let targetMetric = null;
    if (metricId) {
      targetMetric = orgMetrics.find(m => String(m.id) === String(metricId));
      if (!targetMetric) {
        throw new Error('Metric not found or access denied.');
      }
    }

    // Parse schema & dimensions for target dataset
    let datasetSchema = [];
    let dimensions = {};

    if (targetDataset) {
      datasetSchema = targetDataset.schema || [];
      if (typeof datasetSchema === 'string') {
        try { datasetSchema = JSON.parse(datasetSchema); } catch (_) { datasetSchema = []; }
      }
      dimensions = analyticsService.detectDatasetDimensions(datasetSchema, []);
    }

    const plannerContext = {
      datasets: userDatasets.map(d => ({ id: d.id, name: d.name, row_count: d.row_count })),
      datasetSchema,
      dimensions,
      metrics: orgMetrics.map(m => ({ id: m.id, name: m.name, formula: m.formula, type: m.type })),
      dashboards: orgDashboards.map(d => ({ id: d.id, title: d.title })),
      alerts: orgAlerts.map(a => ({ id: a.id, name: a.name, severity: a.severity, status: a.status })),
      forecasts: orgForecasts.map(f => ({ id: f.id, model: f.model_name, horizon: f.horizon_periods })),
      relationships: orgRelationships.map(r => ({
        id: r.id,
        source_dataset_id: r.source_dataset_id,
        source_dataset_name: r.source_dataset_name,
        source_column: r.source_column,
        target_dataset_id: r.target_dataset_id,
        target_dataset_name: r.target_dataset_name,
        target_column: r.target_column,
        relationship_type: r.relationship_type
      }))
    };

    // 2. Generate Plan with Gemini (or Deterministic Rule Planner)
    const rawPlan = await geminiService.planQuery(cleanQuestion, plannerContext);

    // 3. Security Validation & Column Allowlist Enforcement
    const validatedPlan = this._enforceSecurityAndAllowlists(rawPlan, datasetSchema, dimensions, orgRelationships, userDatasets);

    // 4. Non-Analytics Fast Path (Greetings, Farewell, Thanks, Help, Capabilities, Non-Analytics Chit-Chat)
    const nonAnalyticsIntents = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'];
    if (nonAnalyticsIntents.includes(String(validatedPlan.intent).toUpperCase())) {
      const answer = await geminiService.explainResults(
        cleanQuestion,
        validatedPlan,
        {},
        {
          datasetName: targetDataset?.name || '',
          metricUnit: '',
          userRole
        }
      );

      return {
        question: cleanQuestion,
        answer,
        intent: validatedPlan.intent,
        plan: validatedPlan,
        data: {},
        visualization: null,
        sources: [],
        confidence: validatedPlan.confidence || 'high'
      };
    }

    // 5. Load physical dataset records ONLY for real analytics computations
    let datasetRecords = [];
    if (targetDataset && targetDataset.file_path) {
      try {
        datasetRecords = await analyticsService.loadDatasetRecords(targetDataset.file_path);
        // Refresh dimensions with actual record sample if available
        dimensions = analyticsService.detectDatasetDimensions(datasetSchema, datasetRecords.slice(0, 10));
      } catch (fileErr) {
        console.warn(`[AIQueryPlanner] Could not load physical dataset file for ${targetDataset.name}:`, fileErr.message);
      }
    }

    // 6. Secure Analytics Computation
    const executionResult = await this._executeAnalyticsPlan({
      plan: validatedPlan,
      records: datasetRecords,
      dimensions,
      dataset: targetDataset,
      dashboard: targetDashboard,
      metric: targetMetric,
      alerts: orgAlerts,
      forecasts: orgForecasts,
      relationships: orgRelationships,
      userDatasets,
      organizationId
    });

    // 7. Generate Evidence-Grounded AI Explanation
    const answer = await geminiService.explainResults(
      cleanQuestion,
      validatedPlan,
      executionResult.data,
      {
        datasetName: targetDataset?.name || 'Enterprise Telemetry',
        metricUnit: targetMetric?.unit || '',
        userRole
      }
    );

    return {
      question: cleanQuestion,
      answer,
      intent: validatedPlan.intent,
      plan: validatedPlan,
      data: executionResult.data,
      visualization: executionResult.visualization,
      sources: executionResult.sources,
      confidence: validatedPlan.confidence || 'high'
    };
  }

  /**
   * Validate that all fields in plan adhere to strict column allowlists and authorized operations
   */
  _enforceSecurityAndAllowlists(plan, schema = [], dimensions = {}, relationships = [], userDatasets = []) {
    const nonAnalyticsIntents = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'];
    const intentUpper = String(plan?.intent || '').toUpperCase();

    if (nonAnalyticsIntents.includes(intentUpper)) {
      return {
        intent: intentUpper,
        metric: null,
        date_column: null,
        group_by: null,
        joins: [],
        base_dataset: null,
        aggregation: null,
        limit: null,
        order: null,
        filters: [],
        time_range: null,
        compare_with: null,
        visualization: null,
        confidence: plan.confidence || 'high'
      };
    }

    const intentAliases = {
      'KPI_LOOKUP': 'kpi',
      'KPI': 'kpi',
      'TREND': 'trend',
      'COMPARISON': 'comparison',
      'GROWTH': 'growth',
      'RANKING': 'ranking',
      'BREAKDOWN': 'breakdown',
      'ANOMALY_DIAGNOSTICS': 'anomaly_explanation',
      'ANOMALY_EXPLANATION': 'anomaly_explanation',
      'FORECAST_EXPLANATION': 'forecast_explanation',
      'DASHBOARD_SUMMARY': 'dashboard_summary',
      'METRIC_EXPLANATION': 'metric_explanation',
      'RELATIONAL_BREAKDOWN': 'relational_breakdown',
      'DATA_QUALITY_EXPLANATION': 'data_quality_explanation',
      'EXECUTIVE_SUMMARY': 'executive_summary'
    };

    const validAnalyticsIntents = [
      'kpi', 'comparison', 'trend', 'growth', 'ranking', 'breakdown',
      'anomaly_explanation', 'forecast_explanation', 'dashboard_summary', 'metric_explanation',
      'relational_breakdown', 'relational_query', 'data_quality_explanation', 'executive_summary'
    ];

    let intent = plan?.intent;
    if (intentAliases[intentUpper]) {
      intent = intentAliases[intentUpper];
    } else if (!validAnalyticsIntents.includes(intent)) {
      // CRITICAL: Unknown / invalid input must NEVER default to 'kpi'
      return {
        intent: 'NON_ANALYTICS',
        metric: null,
        date_column: null,
        group_by: null,
        joins: [],
        base_dataset: null,
        aggregation: null,
        limit: null,
        order: null,
        filters: [],
        time_range: null,
        compare_with: null,
        visualization: null,
        confidence: 'medium'
      };
    }

    const allowedColumns = new Set(schema.map(c => c.name.toLowerCase()));
    
    // Fallback safe defaults if no schema
    if (allowedColumns.size === 0) {
      ['revenue', 'sales', 'amount', 'profit', 'date', 'region', 'product', 'category', 'channel', 'orders', 'customer_id'].forEach(c => allowedColumns.add(c));
    }

    // Validate metric column against allowlist
    let metric = plan.metric;
    const cleanMetric = (metric || '').replace(/^[A-Za-z0-9_-]+\./, ''); // remove table prefix if any
    if (!metric || (!allowedColumns.has(metric.toLowerCase()) && !allowedColumns.has(cleanMetric.toLowerCase()))) {
      metric = dimensions.primaryMetric || 'revenue';
    }

    // Validate date column
    let dateCol = plan.date_column;
    if (!dateCol || !allowedColumns.has(dateCol.toLowerCase())) {
      dateCol = dimensions.dateColumn || 'date';
    }

    // Validate group by column
    let groupBy = plan.group_by;
    const cleanGroupBy = (groupBy || '').replace(/^[A-Za-z0-9_-]+\./, '');
    if (groupBy && !allowedColumns.has(groupBy.toLowerCase()) && !allowedColumns.has(cleanGroupBy.toLowerCase())) {
      // If part of relational joins, allow dotted column
      if (plan.joins && plan.joins.length > 0 && groupBy.includes('.')) {
        // keep dotted group_by for relational joins
      } else {
        groupBy = dimensions.regionColumn || dimensions.categoryColumn || null;
      }
    }

    // Validate and sanitize joins against configured relationships
    const validatedJoins = [];
    if (Array.isArray(plan.joins)) {
      for (const j of plan.joins) {
        const tgtDatasetNameOrId = j.dataset || j.dataset_id || j.target_dataset_id;
        // Find matching dataset from userDatasets
        const matchedDataset = userDatasets.find(d => 
          String(d.id) === String(tgtDatasetNameOrId) ||
          d.name.toLowerCase() === String(tgtDatasetNameOrId).toLowerCase()
        );

        if (matchedDataset) {
          validatedJoins.push({
            dataset_id: matchedDataset.id,
            dataset: matchedDataset.name,
            source_column: j.source_column || 'customer_id',
            target_column: j.target_column || 'customer_id',
            type: ['inner', 'left'].includes(String(j.type || '').toLowerCase()) ? j.type.toLowerCase() : 'left'
          });
        }
      }
    }

    return {
      intent,
      metric,
      date_column: dateCol,
      group_by: groupBy,
      joins: validatedJoins,
      base_dataset: plan.base_dataset || null,
      aggregation: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(plan.aggregation) ? plan.aggregation : 'SUM',
      limit: typeof plan.limit === 'number' ? Math.max(1, Math.min(100, plan.limit)) : (intent === 'ranking' ? 5 : null),
      order: ['asc', 'desc'].includes(plan.order) ? plan.order : (intent === 'ranking' ? 'desc' : null),
      filters: Array.isArray(plan.filters) ? plan.filters : [],
      time_range: plan.time_range || null,
      compare_with: plan.compare_with || null,
      visualization: plan.visualization || (intent === 'trend' ? 'line' : (intent === 'breakdown' || intent === 'relational_breakdown' ? 'pie' : 'kpi_card')),
      confidence: plan.confidence || 'high'
    };
  }

  /**
   * Execute computations safely inside the analytics engine
   */
  async _executeAnalyticsPlan({
    plan,
    records = [],
    dimensions = {},
    dataset = null,
    dashboard = null,
    metric = null,
    alerts = [],
    forecasts = [],
    relationships = [],
    userDatasets = [],
    organizationId
  }) {
    const nonAnalyticsIntents = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'];
    if (nonAnalyticsIntents.includes(String(plan?.intent || '').toUpperCase())) {
      return {
        data: {},
        visualization: null,
        sources: []
      };
    }

    // Relational Execution Branch
    if ((plan.joins && plan.joins.length > 0) || plan.intent === 'relational_breakdown' || plan.intent === 'relational_query') {
      try {
        const populatedJoins = [];
        const joinedDatasetSources = [];

        for (const j of (plan.joins || [])) {
          const tgtDataset = userDatasets.find(d => String(d.id) === String(j.dataset_id)) ||
                             (await Dataset.findById(j.dataset_id).catch(() => null));

          if (tgtDataset) {
            let tgtRecords = [];
            if (tgtDataset.file_path) {
              tgtRecords = await analyticsService.loadDatasetRecords(tgtDataset.file_path).catch(() => []);
            }

            populatedJoins.push({
              targetDataset: tgtDataset,
              targetRecords: tgtRecords,
              sourceColumn: j.source_column || 'customer_id',
              targetColumn: j.target_column || 'customer_id',
              type: j.type || 'left'
            });

            joinedDatasetSources.push({
              dataset_id: tgtDataset.id,
              dataset_name: tgtDataset.name,
              row_count: tgtRecords.length
            });
          }
        }

        const relationalRes = await analyticsService.executeRelationalQuery({
          baseDataset: dataset,
          baseRecords: records,
          joins: populatedJoins,
          dimensions: plan.group_by ? [plan.group_by] : [],
          metrics: plan.metric ? [{ column: plan.metric, aggregation: plan.aggregation || 'SUM', alias: 'value' }] : [],
          filters: {},
          limit: plan.limit || 50
        });

        const breakdown = (relationalRes.rows || []).map(r => ({
          category: r[plan.group_by] || r[plan.group_by?.split('.').pop()] || Object.values(r)[0] || 'Unknown',
          value: Number(r.value || r[plan.metric] || r[plan.metric?.split('.').pop()] || 0)
        }));

        return {
          data: {
            relational_query: true,
            base_dataset: dataset?.name,
            joined_datasets: populatedJoins.map(j => j.targetDataset.name),
            dimension: plan.group_by,
            metric: plan.metric,
            aggregation: plan.aggregation,
            breakdown: breakdown,
            total_records: relationalRes.totalCount
          },
          visualization: {
            type: plan.visualization || 'bar',
            xAxis: 'category',
            yAxis: 'value',
            title: `${(plan.metric || 'Metric').toUpperCase()} by ${plan.group_by || 'Dimension'} (Relational Join)`,
            data: breakdown
          },
          sources: [
            {
              dataset_id: dataset?.id,
              dataset_name: dataset?.name || 'Base Dataset',
              row_count: records.length
            },
            ...joinedDatasetSources
          ]
        };
      } catch (relErr) {
        console.warn('[AIQueryPlanner] Relational execution encountered error, falling back to standard plan:', relErr.message);
      }
    }
    const effectiveDimensions = {
      ...dimensions,
      primaryMetric: plan.metric || dimensions.primaryMetric,
      dateColumn: plan.date_column || dimensions.dateColumn
    };

    const sources = [{
      dataset_id: dataset?.id || null,
      dataset_name: dataset?.name || 'Direct Telemetry',
      row_count: records.length,
      columns_analyzed: [effectiveDimensions.primaryMetric, effectiveDimensions.dateColumn, plan.group_by].filter(Boolean)
    }];

    // 0. Executive Summary & Automated Insights Intent (Phase 16)
    if (plan.intent === 'executive_summary') {
      const insightService = require('./insightService');
      let insightResult = { count: 0, insights: [], executive_summary: 'No significant changes detected.' };
      try {
        insightResult = await insightService.generateInsights(organizationId, {
          datasetId: dataset?.id || null,
          persist: false
        });
      } catch (insErr) {
        console.warn('[AIQueryPlanner] Error generating insights for executive summary:', insErr.message);
      }

      return {
        data: {
          executive_summary: insightResult.executive_summary,
          count: insightResult.count,
          insights: insightResult.insights
        },
        visualization: {
          type: 'insights_list',
          title: 'Executive Insights & Strategic Overview',
          data: insightResult.insights
        },
        sources
      };
    }

    // 0b. Data Quality Intent
    if (plan.intent === 'data_quality_explanation') {
      const dataQualityService = require('./dataQualityService');
      let qualityProfile = null;
      if (dataset?.id && organizationId) {
        try {
          qualityProfile = await dataQualityService.getQualityProfile(dataset.id, organizationId);
        } catch (err) {
          console.warn('[AIQueryPlanner] Error retrieving data quality profile:', err.message);
        }
      }

      const score = qualityProfile ? qualityProfile.quality_score : 100;
      const status = qualityProfile ? qualityProfile.status : 'healthy';

      return {
        data: {
          quality_score: score,
          status,
          dimensions: qualityProfile?.dimensions || {},
          column_metrics: qualityProfile?.column_metrics || [],
          issues: qualityProfile?.issues || [],
          dataset_name: dataset?.name || 'Dataset'
        },
        visualization: {
          type: 'kpi_card',
          metric: 'Quality Score',
          value: `${score}/100`,
          unit: status.toUpperCase(),
          status
        },
        sources
      };
    }

    // 1. KPI Query Intent
    if (plan.intent === 'kpi' || plan.intent === 'metric_explanation') {
      const kpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
      const val = plan.aggregation === 'AVG' 
        ? (kpis.averageOrderValue || 0) 
        : (plan.aggregation === 'COUNT' ? kpis.totalOrders : kpis.totalSales);

      return {
        data: {
          metric: plan.metric,
          aggregation: plan.aggregation,
          value: val,
          count: kpis.totalOrders,
          stats: kpis
        },
        visualization: {
          type: 'kpi_card',
          metric: plan.metric,
          value: val,
          unit: metric?.unit || '',
          comparison: kpis.comparison
        },
        sources
      };
    }

    // 2. Trend & Growth Intent
    if (plan.intent === 'trend' || plan.intent === 'growth') {
      const trends = analyticsService.computeDatasetTrends(records, effectiveDimensions);
      
      let growthRate = 0;
      if (trends.length >= 2) {
        const firstVal = trends[0].revenue || 0;
        const lastVal = trends[trends.length - 1].revenue || 0;
        if (firstVal > 0) {
          growthRate = Number((((lastVal - firstVal) / firstVal) * 100).toFixed(2));
        }
      }

      return {
        data: {
          trends,
          growth_rate: growthRate,
          data_points: trends.length
        },
        visualization: {
          type: 'line',
          xAxis: 'date',
          yAxis: 'revenue',
          title: `${plan.metric.toUpperCase()} Trend (${trends.length} periods)`,
          series: [
            { key: 'revenue', name: plan.metric, color: '#2563EB' },
            { key: 'target', name: 'Baseline', color: '#94A3B8', strokeDasharray: '4 4' }
          ],
          data: trends
        },
        sources
      };
    }

    // 3. Ranking Intent
    if (plan.intent === 'ranking') {
      const groupByCol = plan.group_by || effectiveDimensions.regionColumn || effectiveDimensions.productColumn || 'category';
      let breakdown = analyticsService.computeDatasetBreakdown(records, groupByCol, effectiveDimensions);
      
      if (plan.order === 'asc') {
        breakdown.sort((a, b) => a.value - b.value);
      } else {
        breakdown.sort((a, b) => b.value - a.value);
      }

      const limit = plan.limit || 5;
      const ranked = breakdown.slice(0, limit);

      return {
        data: {
          dimension: groupByCol,
          ranking: ranked,
          total_categories: breakdown.length
        },
        visualization: {
          type: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          title: `Top ${ranked.length} ${groupByCol.toUpperCase()} by ${plan.metric}`,
          data: ranked
        },
        sources
      };
    }

    // 4. Breakdown Intent
    if (plan.intent === 'breakdown') {
      const groupByCol = plan.group_by || effectiveDimensions.regionColumn || effectiveDimensions.categoryColumn || 'region';
      const breakdown = analyticsService.computeDatasetBreakdown(records, groupByCol, effectiveDimensions);

      return {
        data: {
          dimension: groupByCol,
          breakdown,
          total_categories: breakdown.length
        },
        visualization: {
          type: 'pie',
          nameKey: 'category',
          dataKey: 'value',
          title: `${plan.metric.toUpperCase()} Breakdown by ${groupByCol}`,
          data: breakdown
        },
        sources
      };
    }

    // 5. Comparison Intent
    if (plan.intent === 'comparison') {
      const groupByCol = plan.group_by || effectiveDimensions.regionColumn || 'region';
      const breakdown = analyticsService.computeDatasetBreakdown(records, groupByCol, effectiveDimensions);

      return {
        data: {
          dimension: groupByCol,
          comparison_items: breakdown
        },
        visualization: {
          type: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          title: `Comparative ${plan.metric} Analysis`,
          data: breakdown
        },
        sources
      };
    }

    // 6. Anomaly Explanation Intent (Phase 10 & 11)
    if (plan.intent === 'anomaly_explanation') {
      const timeSeries = analyticsService.computeDatasetTrends(records, effectiveDimensions).map(t => ({
        date: t.date,
        value: t.revenue
      }));

      const anomalies = await mlForecastService.detectAnomalies(timeSeries, {
        zThreshold: 2.2,
        windowSize: 5
      });

      return {
        data: {
          anomaly_count: anomalies.length,
          anomalies,
          evaluated_points: timeSeries.length,
          active_alerts: alerts.filter(a => a.status === 'active').length
        },
        visualization: {
          type: 'line',
          xAxis: 'date',
          yAxis: 'value',
          title: `Anomaly Diagnostics (${anomalies.length} outliers detected)`,
          data: timeSeries,
          anomalies
        },
        sources
      };
    }

    // 7. Forecast Explanation Intent (Phase 11)
    if (plan.intent === 'forecast_explanation') {
      const timeSeries = analyticsService.computeDatasetTrends(records, effectiveDimensions).map(t => ({
        date: t.date,
        value: t.revenue
      }));

      let forecastRes;
      if (timeSeries.length >= 4) {
        forecastRes = await mlForecastService.generateForecast(timeSeries, {
          horizon: 30,
          interval: 'daily',
          model: 'auto'
        });
      } else if (forecasts.length > 0) {
        forecastRes = forecasts[0];
      } else {
        forecastRes = {
          model: 'linear_regression',
          predictions: [],
          horizon: 30
        };
      }

      return {
        data: {
          model: forecastRes.model || 'auto',
          horizon: forecastRes.horizon || 30,
          predictions: forecastRes.predictions || [],
          metrics: forecastRes.metrics || {}
        },
        visualization: {
          type: 'line',
          xAxis: 'date',
          yAxis: 'predicted',
          title: `AI Predictive Forecast (${(forecastRes.model || 'ML').toUpperCase()})`,
          data: forecastRes.predictions || []
        },
        sources
      };
    }

    // 8. Dashboard Summary Intent
    if (plan.intent === 'dashboard_summary') {
      return {
        data: {
          dashboard_title: dashboard?.title || 'Operational Overview',
          widget_count: dashboard?.widget_count || 4,
          status: 'operational'
        },
        visualization: {
          type: 'table',
          title: 'Dashboard Component Summary'
        },
        sources
      };
    }

    // Default Fallback
    const fallbackKpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
    return {
      data: fallbackKpis,
      visualization: {
        type: 'kpi_card',
        metric: plan.metric,
        value: fallbackKpis.totalSales
      },
      sources
    };
  }
}

module.exports = new AIQueryPlannerService();
