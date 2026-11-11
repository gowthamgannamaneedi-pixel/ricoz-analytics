const fs = require('fs');
const path = require('path');
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
      if (!targetDataset || (organizationId && String(targetDataset.organization_id) !== String(organizationId))) {
        // Multi-tenant security isolation check
        throw new Error('Dataset not found or you do not have permission to access it.');
      }
    } else if (userDatasets.length > 0) {
      const validDataset = userDatasets.find(d => {
        if (!d.file_path) return false;
        const p = path.isAbsolute(d.file_path) ? d.file_path : path.join(__dirname, '../uploads/datasets', d.file_path);
        return fs.existsSync(p);
      });
      targetDataset = validDataset || userDatasets[0];
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
    if (targetDataset) {
      try {
        datasetRecords = await analyticsService.loadDatasetRecords(targetDataset);
        // Refresh dimensions with actual record sample if available
        dimensions = analyticsService.detectDatasetDimensions(datasetSchema, datasetRecords.slice(0, 10));
      } catch (fileErr) {
        console.warn(`[AIQueryPlanner] Could not load physical dataset records for ${targetDataset.name}:`, fileErr.message);
        return {
          question: cleanQuestion,
          answer: `The selected dataset **${targetDataset.name}** does not have accessible physical records on storage to calculate "${cleanQuestion}". Please choose an authorized dataset with verified physical data records.`,
          intent: validatedPlan.intent,
          plan: validatedPlan,
          data: { error: 'Dataset physical file is unavailable on storage.', records: 0 },
          visualization: null,
          sources: [{ dataset_id: targetDataset.id, dataset_name: targetDataset.name, row_count: 0 }],
          confidence: 'low',
          insufficientData: true
        };
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
      organizationId,
      question: cleanQuestion
    });

    // 7. Generate Evidence-Grounded AI Explanation
    const answer = executionResult.answer || await geminiService.explainResults(
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
      'EXECUTIVE_SUMMARY': 'executive_summary',
      'SALES_GROWTH_ANALYSIS': 'sales_growth_analysis',
      'REVENUE_DECLINE_ANALYSIS': 'revenue_decline_analysis',
      'DATASET_EXPLORATION': 'dataset_exploration',
      'SCENARIO_SIMULATION': 'scenario_simulation',
      'PROFITABILITY_ANALYSIS': 'profitability_analysis'
    };

    const validAnalyticsIntents = [
      'kpi', 'comparison', 'trend', 'growth', 'ranking', 'breakdown',
      'anomaly_explanation', 'forecast_explanation', 'dashboard_summary', 'metric_explanation',
      'relational_breakdown', 'relational_query', 'data_quality_explanation', 'executive_summary',
      'sales_growth_analysis', 'revenue_decline_analysis', 'dataset_exploration', 'scenario_simulation', 'profitability_analysis'
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
        groupBy = dimensions.productColumn || dimensions.categoryColumn || dimensions.regionColumn || null;
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
    organizationId,
    question = ''
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

    // 0c. Sales Growth Analysis Intent
    if (plan.intent === 'sales_growth_analysis') {
      const kpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
      const totalSales = kpis.totalSales || 0;
      const primaryDim = effectiveDimensions.regionColumn || effectiveDimensions.productColumn || effectiveDimensions.categoryColumn || 'region';
      const breakdown = analyticsService.computeDatasetBreakdown(records, primaryDim, effectiveDimensions);
      breakdown.sort((a, b) => b.value - a.value);

      const secondaryDim = (primaryDim === effectiveDimensions.regionColumn ? effectiveDimensions.productColumn : effectiveDimensions.regionColumn) || effectiveDimensions.categoryColumn;
      let secondaryBreakdown = [];
      if (secondaryDim) {
        secondaryBreakdown = analyticsService.computeDatasetBreakdown(records, secondaryDim, effectiveDimensions);
        secondaryBreakdown.sort((a, b) => b.value - a.value);
      }

      return {
        data: {
          sales_growth_analysis: true,
          totalSales,
          orderCount: kpis.totalOrders || records.length,
          averageOrderValue: kpis.averageOrderValue || (records.length > 0 ? totalSales / records.length : 0),
          dimension: primaryDim,
          breakdown: breakdown.slice(0, 10),
          secondaryDimension: secondaryDim,
          secondaryBreakdown: secondaryBreakdown.slice(0, 10),
          rowCount: records.length,
          datasetName: dataset?.name || 'Dataset'
        },
        visualization: {
          type: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          title: `Sales Breakdown by ${primaryDim.toUpperCase()}`,
          data: breakdown.slice(0, 8)
        },
        sources
      };
    }

    // 0d. Revenue Decline Analysis Intent
    if (plan.intent === 'revenue_decline_analysis') {
      const kpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
      const totalSales = kpis.totalSales || 0;
      const primaryDim = effectiveDimensions.regionColumn || effectiveDimensions.productColumn || effectiveDimensions.categoryColumn || 'region';
      const breakdown = analyticsService.computeDatasetBreakdown(records, primaryDim, effectiveDimensions);
      breakdown.sort((a, b) => b.value - a.value);

      return {
        data: {
          revenue_decline_analysis: true,
          totalSales,
          rowCount: records.length,
          breakdown: breakdown.slice(0, 10),
          dimension: primaryDim,
          datasetName: dataset?.name || 'Dataset'
        },
        visualization: {
          type: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          title: `Sales Variance by ${primaryDim.toUpperCase()}`,
          data: breakdown.slice(0, 8)
        },
        sources
      };
    }

    // 0e. Dataset Exploration Intent
    if (plan.intent === 'dataset_exploration') {
      const schemaCols = (dataset?.schema || []).map(c => typeof c === 'string' ? c : c.name || c.key).filter(Boolean);
      const missingAttrs = [];
      const colNamesLower = schemaCols.map(c => c.toLowerCase());
      if (!colNamesLower.some(c => ['cost', 'cogs', 'expense', 'expenses'].includes(c))) {
        missingAttrs.push('Cost of Goods Sold (COGS) / Expenses: Required to compute Gross Profit and Margins.');
      }
      if (!colNamesLower.some(c => c.includes('customer'))) {
        missingAttrs.push('Customer ID / Account ID: Required to analyze cohort retention and customer lifetime value (LTV).');
      }
      if (!colNamesLower.some(c => c.includes('channel'))) {
        missingAttrs.push('Sales Acquisition Channel: Required to calculate channel ROI and customer acquisition efficiency.');
      }
      if (!colNamesLower.some(c => ['region', 'city', 'state', 'country'].includes(c))) {
        missingAttrs.push('Geographic Territory / Location: Required for regional performance benchmarking.');
      }
      if (!effectiveDimensions.dateColumn) {
        missingAttrs.push('Transaction Timestamp / Date: Required for multi-period trend and seasonality forecasting.');
      }

      return {
        data: {
          dataset_exploration: true,
          rowCount: records.length,
          columns: schemaCols,
          missing: missingAttrs,
          datasetName: dataset?.name || 'Dataset'
        },
        visualization: null,
        sources
      };
    }

    // 0f. Profitability Analysis Intent
    if (plan.intent === 'profitability_analysis') {
      const kpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
      const costCol = Object.keys(records[0] || {}).find(k => ['cost', 'cogs', 'expense', 'expenses'].includes(k.toLowerCase()));
      let marginVal = null;
      let hasCost = Boolean(costCol);
      if (hasCost) {
        const totalCost = records.reduce((sum, r) => sum + (Number(r[costCol]) || 0), 0);
        marginVal = kpis.totalSales > 0 ? Number((((kpis.totalSales - totalCost) / kpis.totalSales) * 100).toFixed(2)) : 0;
      }

      return {
        data: {
          profitability_analysis: true,
          value: marginVal,
          totalSales: kpis.totalSales,
          hasCost,
          datasetName: dataset?.name || 'Dataset'
        },
        visualization: {
          type: 'kpi_card',
          metric: 'Gross Margin',
          value: hasCost ? `${marginVal}%` : 'N/A',
          unit: hasCost ? '%' : 'Missing Cost Data'
        },
        sources
      };
    }

    // 0g. Scenario Simulation Intent
    if (plan.intent === 'scenario_simulation') {
      const kpis = analyticsService.computeDatasetKpis(records, records, effectiveDimensions);
      const baseRev = Number((kpis.totalSales || 0).toFixed(2));
      const hasCost = Boolean(effectiveDimensions.costColumn);
      const baseCost = hasCost
        ? records.reduce((s, r) => s + (Number(r[effectiveDimensions.costColumn]) || 0), 0)
        : Number((baseRev * 0.65).toFixed(2));
      const baseProfit = baseRev - baseCost;
      const baseMarginPct = baseRev > 0 ? Number(((baseProfit / baseRev) * 100).toFixed(1)) : 0;

      const priceDelta = Number(plan.levers?.priceChange || 5);
      const costDelta = Number(plan.levers?.costChange || 0);
      const volumeDelta = Number(plan.levers?.volumeChange || 0);

      const simRev = Number((baseRev * (1 + (priceDelta + volumeDelta) / 100)).toFixed(2));
      const simCost = Number((baseCost * (1 + (costDelta + volumeDelta) / 100)).toFixed(2));
      const simProfit = simRev - simCost;
      const simMargin = simRev > 0 ? Number(((simProfit / simRev) * 100).toFixed(1)) : 0;

      return {
        data: {
          scenario_simulation: true,
          baseline_revenue: baseRev,
          baseline_cost: baseCost,
          baseline_profit: baseProfit,
          baseline_margin_pct: baseMarginPct,
          simulated_revenue: simRev,
          simulated_cost: simCost,
          simulated_profit: simProfit,
          simulated_margin_pct: simMargin,
          datasetName: dataset?.name || 'Dataset'
        },
        visualization: {
          type: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          title: 'Scenario Simulation vs Baseline',
          data: [
            { category: 'Baseline Revenue', value: baseRev },
            { category: `Simulated Revenue (+${priceDelta + volumeDelta}%)`, value: simRev }
          ]
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
      const groupByCol = plan.group_by || effectiveDimensions.regionColumn || effectiveDimensions.productColumn || effectiveDimensions.categoryColumn || 'region';
      let breakdown = analyticsService.computeDatasetBreakdown(records, groupByCol, effectiveDimensions);
      
      if (plan.order === 'asc') {
        breakdown.sort((a, b) => a.value - b.value);
      } else {
        breakdown.sort((a, b) => b.value - a.value);
      }

      const limit = plan.limit || 5;
      const ranked = breakdown.slice(0, limit);
      const topItem = ranked[0] || null;
      const runnerUpItem = ranked[1] || null;
      const grandTotal = breakdown.reduce((sum, item) => sum + (item.value || 0), 0);

      // Compute lead difference between #1 and #2
      let difference = null;
      if (topItem && runnerUpItem && runnerUpItem.value > 0) {
        const absDiff = Number((topItem.value - runnerUpItem.value).toFixed(2));
        const pctDiff = Number((((topItem.value - runnerUpItem.value) / runnerUpItem.value) * 100).toFixed(1));
        difference = {
          leader: topItem.name,
          runnerUp: runnerUpItem.name,
          absoluteDifference: absDiff,
          percentageDifference: pctDiff,
          formatted: `${topItem.name} leads ${runnerUpItem.name} by ${absDiff.toLocaleString()} (+${pctDiff}%)`
        };
      }

      // Detect sub-drivers (e.g. top product or channel in the winning region)
      let winningDrivers = [];
      if (topItem && records.length > 0) {
        const actualGroupCol = analyticsService.resolveColumnKey(records[0], groupByCol, effectiveDimensions.regionColumn);
        const actualMetricCol = analyticsService.resolveColumnKey(records[0], plan.metric, effectiveDimensions.primaryMetric);
        const subDimension = effectiveDimensions.productColumn || effectiveDimensions.categoryColumn || effectiveDimensions.channelColumn;
        
        if (subDimension && actualGroupCol && actualMetricCol) {
          const leaderRecords = records.filter(r => String(r[actualGroupCol]).trim() === String(topItem.name).trim());
          const subBreakdown = analyticsService.computeDatasetBreakdown(leaderRecords, subDimension, { primaryMetric: actualMetricCol });
          winningDrivers = subBreakdown.slice(0, 3);
        }
      }

      return {
        data: {
          dimension: groupByCol,
          metric: plan.metric,
          ranking: ranked,
          total_categories: breakdown.length,
          grand_total: Number(grandTotal.toFixed(2)),
          top_performer: topItem ? {
            name: topItem.name,
            value: topItem.value,
            share: topItem.percentage
          } : null,
          runner_up: runnerUpItem ? {
            name: runnerUpItem.name,
            value: runnerUpItem.value,
            share: runnerUpItem.percentage
          } : null,
          difference,
          winning_drivers: winningDrivers
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
      const qLower = (question || plan.question || '').toLowerCase();
      const isTimeComparison = ['month', 'period', 'mom', 'year', 'quarter', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].some(t => qLower.includes(t)) || (!plan.group_by);

      if (isTimeComparison) {
        const dateCol = effectiveDimensions.dateColumn || 'date';
        const sampleRecord = records[0] || {};
        const hasDateCol = Boolean(sampleRecord[dateCol]);

        if (!hasDateCol) {
          return {
            data: {
              has_date_column: false,
              error: 'The selected dataset does not contain a usable date column.'
            },
            answer: `I cannot compare this month's performance with last month's because the selected dataset does not contain a usable date column.`,
            visualization: null,
            sources
          };
        }

        const metricCol = plan.metric || effectiveDimensions.primaryMetric || 'sales_amount';

        // 1. Group all records by month (YYYY-MM)
        const monthlyAggs = {};
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const formatMonthLabel = (mStr) => {
          const parts = mStr.split('-');
          if (parts.length === 2) {
            const yr = parts[0];
            const mo = parseInt(parts[1], 10);
            if (mo >= 1 && mo <= 12) return `${monthNames[mo - 1]} ${yr}`;
          }
          return mStr;
        };

        for (const r of records) {
          const dStr = String(r[dateCol] || '').slice(0, 7);
          if (dStr && dStr.match(/^\d{4}-\d{2}$/)) {
            monthlyAggs[dStr] = monthlyAggs[dStr] || { count: 0, total: 0, records: [] };
            monthlyAggs[dStr].total += Number(r[metricCol] || 0);
            monthlyAggs[dStr].count++;
            monthlyAggs[dStr].records.push(r);
          }
        }

        const sortedMonths = Object.keys(monthlyAggs).sort();

        if (sortedMonths.length < 2) {
          const singleMonth = sortedMonths[0] ? formatMonthLabel(sortedMonths[0]) : 'None';
          return {
            data: {
              comparison_type: 'insufficient_periods',
              available_months: sortedMonths
            },
            answer: `The selected dataset **${dataset?.name || 'Dataset'}** contains records for only one recorded monthly interval (${singleMonth}). A Month-over-Month comparison requires at least two distinct monthly periods.`,
            visualization: null,
            sources
          };
        }

        const priorM = sortedMonths[sortedMonths.length - 2];
        const latestM = sortedMonths[sortedMonths.length - 1];
        const priorTotal = Number(monthlyAggs[priorM].total.toFixed(2));
        const latestTotal = Number(monthlyAggs[latestM].total.toFixed(2));
        const absDiff = Number((latestTotal - priorTotal).toFixed(2));
        const pctChange = priorTotal > 0 ? Number(((absDiff / priorTotal) * 100).toFixed(1)) : 0;

        const priorLabel = formatMonthLabel(priorM);
        const latestLabel = formatMonthLabel(latestM);

        const chartData = [
          { period: priorLabel, value: priorTotal, records: monthlyAggs[priorM].count },
          { period: latestLabel, value: latestTotal, records: monthlyAggs[latestM].count }
        ];

        // Identify primary category or segment detractor / contributor
        let topDriverText = '';
        const categoryCol = effectiveDimensions.categoryColumn || effectiveDimensions.productColumn || effectiveDimensions.regionColumn;
        if (categoryCol) {
          const catDiffs = {};
          (monthlyAggs[priorM].records || []).forEach(r => {
            const k = r[categoryCol] || 'Other';
            catDiffs[k] = (catDiffs[k] || 0) - (Number(r[metricCol]) || 0);
          });
          (monthlyAggs[latestM].records || []).forEach(r => {
            const k = r[categoryCol] || 'Other';
            catDiffs[k] = (catDiffs[k] || 0) + (Number(r[metricCol]) || 0);
          });
          const sortedCats = Object.entries(catDiffs).sort((a, b) => a[1] - b[1]);
          if (sortedCats.length > 0) {
            const worst = sortedCats[0];
            const best = sortedCats[sortedCats.length - 1];
            if (absDiff < 0 && worst[1] < 0) {
              topDriverText = `\n\nThe primary detractor was **${worst[0]}**, which changed by ${worst[1] < 0 ? '-' : '+'}₹${Math.abs(Math.round(worst[1])).toLocaleString()}.`;
            } else if (absDiff >= 0 && best[1] > 0) {
              topDriverText = `\n\nThe primary growth driver was **${best[0]}**, contributing +₹${Math.round(best[1]).toLocaleString()}.`;
            }
          }
        }

        const formattedAnswer = `### Month-over-Month ${metricCol.toUpperCase().replace(/_/g, ' ')} Comparison\n\n` +
          `• **${latestLabel} (Latest Recorded Month):** ₹${latestTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${monthlyAggs[latestM].count} records.\n` +
          `• **${priorLabel} (Prior Recorded Month):** ₹${priorTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${monthlyAggs[priorM].count} records.\n` +
          `• **Period-over-Period Delta:** ${absDiff >= 0 ? '+' : ''}₹${absDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pctChange >= 0 ? '+' : ''}${pctChange}%)${topDriverText}`;

        return {
          data: {
            comparison_type: 'month_over_month',
            metric_column: metricCol,
            date_column: dateCol,
            current_period: { label: latestLabel, total: latestTotal, count: monthlyAggs[latestM].count },
            previous_period: { label: priorLabel, total: priorTotal, count: monthlyAggs[priorM].count },
            absolute_difference: absDiff,
            percentage_change: pctChange,
            chartData
          },
          answer: formattedAnswer,
          visualization: {
            type: 'bar',
            xAxis: 'period',
            yAxis: 'value',
            title: `Month-over-Month ${metricCol.replace(/_/g, ' ')} Comparison`,
            data: chartData
          },
          sources
        };
      }

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
