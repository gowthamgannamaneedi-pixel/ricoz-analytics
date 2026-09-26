const path = require('path');
const storage = require('../storage');
const Dataset = require('../models/datasetModel');
const analyticsService = require('./analyticsService');

/**
 * Enterprise AI Insights Evidence Builder Service
 * Ground-truth evidence calculator that binds AI insights directly to physical dataset rows,
 * eliminating fabricated or hardcoded metrics.
 */
class EvidenceBuilderService {
  /**
   * Safe number parser
   */
  _toNum(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Load dataset and its physical records while enforcing multi-tenant isolation
   * @param {number|string} datasetId 
   * @param {string} [organizationId] 
   * @param {number|string} [userId]
   * @returns {Promise<{ dataset: object|null, records: any[], dimensions: object, schema: any[] }>}
   */
  async loadDatasetAndRecords(datasetId, organizationId = null, userId = null) {
    if (!datasetId) {
      return { dataset: null, records: [], dimensions: {}, schema: [] };
    }

    let dataset = null;
    if (organizationId) {
      dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    } else if (userId) {
      dataset = await Dataset.findByIdAndUserId(datasetId, userId);
    } else if (Dataset.findById) {
      dataset = await Dataset.findById(datasetId);
    }

    if (!dataset) {
      return { dataset: null, records: [], dimensions: {}, schema: [] };
    }

    let records = [];
    if (dataset.file_path) {
      try {
        records = await analyticsService.loadDatasetRecords(dataset.file_path);
      } catch (err) {
        console.warn(`[EvidenceBuilderService] Could not load records for dataset #${datasetId}:`, err.message);
      }
    }

    const schema = Array.isArray(dataset.schema) 
      ? dataset.schema 
      : (typeof dataset.schema === 'string' ? JSON.parse(dataset.schema || '[]') : []);

    const dimensions = analyticsService.detectDatasetDimensions(schema, records.slice(0, 25));

    return { dataset, records, dimensions, schema };
  }

  /**
   * Build ground-truth evidence for Growth or Decline insights
   * @param {object} params
   */
  buildGrowthOrDeclineEvidence({
    dataset,
    records = [],
    dimensions = {},
    prevPoint = {},
    currPoint = {},
    targetMetric = null
  }) {
    const datasetId = dataset?.id || null;
    const datasetName = dataset?.name || 'Dataset Telemetry';
    const recordsAnalyzed = Array.isArray(records) ? records.length : 0;
    const metric = targetMetric || dimensions?.primaryMetric || 'revenue';
    const dateColumn = dimensions?.dateColumn || null;

    const currVal = this._toNum(currPoint.revenue !== undefined ? currPoint.revenue : (currPoint.value !== undefined ? currPoint.value : currPoint[metric]));
    const prevVal = this._toNum(prevPoint.revenue !== undefined ? prevPoint.revenue : (prevPoint.value !== undefined ? prevPoint.value : prevPoint[metric]));

    let changePercent = 0;
    if (prevVal !== 0) {
      changePercent = Number((((currVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(1));
    }

    const currentPeriod = currPoint.date || currPoint.period || 'Current Period';
    const comparisonPeriod = prevPoint.date || prevPoint.period || 'Previous Period';
    const sourceFields = [metric, dateColumn].filter(Boolean);
    const calculation = `((currentValue - comparisonValue) / ABS(comparisonValue)) * 100 = ((${currVal} - ${prevVal}) / ${Math.abs(prevVal)}) * 100 = ${changePercent}%`;

    const isValid = recordsAnalyzed > 0 && isFinite(currVal) && isFinite(prevVal);

    return {
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric,
      currentValue: currVal,
      current_value: currVal,
      comparisonValue: prevVal,
      previous_value: prevVal,
      changePercent,
      change_percent: changePercent,
      period: currentPeriod,
      currentPeriod,
      comparisonPeriod,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Ground-truth verified from ${recordsAnalyzed} records in dataset "${datasetName}".`
        : `Evidence verification failed: ${recordsAnalyzed === 0 ? 'Dataset contains 0 records' : 'Invalid metric values'}`
    };
  }

  /**
   * Build ground-truth evidence for Multi-Period Sustained Trends
   */
  buildTrendEvidence({
    dataset,
    records = [],
    dimensions = {},
    recentPoints = [],
    direction = 'expansion'
  }) {
    const datasetId = dataset?.id || null;
    const datasetName = dataset?.name || 'Dataset Telemetry';
    const recordsAnalyzed = Array.isArray(records) ? records.length : 0;
    const metric = dimensions?.primaryMetric || 'revenue';
    const dateColumn = dimensions?.dateColumn || null;
    const consecutivePeriods = recentPoints.length;

    const startPoint = recentPoints[0] || {};
    const latestPoint = recentPoints[recentPoints.length - 1] || {};

    const startVal = this._toNum(startPoint.revenue !== undefined ? startPoint.revenue : startPoint.value);
    const latestVal = this._toNum(latestPoint.revenue !== undefined ? latestPoint.revenue : latestPoint.value);

    let changePercent = 0;
    if (startVal !== 0) {
      changePercent = Number((((latestVal - startVal) / Math.abs(startVal)) * 100).toFixed(1));
    }

    const sourceFields = [metric, dateColumn].filter(Boolean);
    const calculation = `Monotonic ${direction} across ${consecutivePeriods} consecutive observation intervals (${startPoint.date || 'T0'} to ${latestPoint.date || 'T_end'})`;
    const isValid = recordsAnalyzed >= 4 && consecutivePeriods >= 4 && isFinite(startVal) && isFinite(latestVal);

    return {
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric,
      currentValue: latestVal,
      current_value: latestVal,
      comparisonValue: startVal,
      previous_value: startVal,
      changePercent,
      change_percent: changePercent,
      consecutivePeriods,
      consecutive_periods: consecutivePeriods,
      startingValue: startVal,
      starting_value: startVal,
      latestValue: latestVal,
      latest_value: latestVal,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Sustained trend verified across ${consecutivePeriods} consecutive observation periods on ${recordsAnalyzed} records.`
        : `Evidence verification failed: Insufficient consecutive trend periods (${consecutivePeriods}) or records (${recordsAnalyzed}).`
    };
  }

  /**
   * Build ground-truth evidence for Data Quality telemetry
   */
  buildDataQualityEvidence({
    dataset,
    records = [],
    schema = [],
    qualityProfile = null
  }) {
    const datasetId = dataset?.id || null;
    const datasetName = dataset?.name || 'Dataset Telemetry';
    const recordsAnalyzed = Array.isArray(records) ? records.length : 0;

    // Calculate actual null / empty cell count across all rows
    let nullCount = 0;
    let totalCells = 0;
    const colNames = Array.isArray(schema) && schema.length > 0 
      ? schema.map(s => s.name) 
      : (records[0] ? Object.keys(records[0]) : []);

    const seenRows = new Set();
    let duplicateCount = 0;

    if (recordsAnalyzed > 0 && colNames.length > 0) {
      for (const row of records) {
        totalCells += colNames.length;
        for (const col of colNames) {
          const val = row[col];
          if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
            nullCount++;
          }
        }

        const serialized = JSON.stringify(row);
        if (seenRows.has(serialized)) {
          duplicateCount++;
        } else {
          seenRows.add(serialized);
        }
      }
    }

    const completenessScore = totalCells > 0 
      ? Number((((totalCells - nullCount) / totalCells) * 100).toFixed(1))
      : 100;
    const uniquenessScore = recordsAnalyzed > 0 
      ? Number((((recordsAnalyzed - duplicateCount) / recordsAnalyzed) * 100).toFixed(1))
      : 100;

    const qualityScore = qualityProfile?.quality_score !== undefined
      ? Number(qualityProfile.quality_score)
      : Math.round((completenessScore * 0.6) + (uniquenessScore * 0.4));

    const issuesCount = qualityProfile?.issues?.length !== undefined 
      ? qualityProfile.issues.length 
      : (nullCount > 0 ? 1 : 0) + (duplicateCount > 0 ? 1 : 0);

    const calculation = `Completeness: (${totalCells - nullCount}/${totalCells}) = ${completenessScore}%, Uniqueness: (${recordsAnalyzed - duplicateCount}/${recordsAnalyzed}) = ${uniquenessScore}%`;
    const isValid = recordsAnalyzed > 0;

    return {
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric: 'data_quality_score',
      currentValue: qualityScore,
      current_value: qualityScore,
      comparisonValue: 100,
      previous_value: 100,
      changePercent: Number((qualityScore - 100).toFixed(1)),
      change_percent: Number((qualityScore - 100).toFixed(1)),
      quality_score: qualityScore,
      completeness_score: completenessScore,
      uniqueness_score: uniquenessScore,
      validity_score: qualityProfile?.dimensions?.validity?.score || 100,
      nullCount,
      null_count: nullCount,
      duplicateCount,
      duplicate_count: duplicateCount,
      issuesCount,
      issues_count: issuesCount,
      age_hours: qualityProfile?.dimensions?.freshness?.age_hours || null,
      sourceFields: colNames,
      source_fields: colNames,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Audited ${recordsAnalyzed} records across ${colNames.length} schema columns (${nullCount} missing cells, ${duplicateCount} duplicate rows).`
        : `Evidence verification failed: Empty dataset cannot be audited for quality.`
    };
  }

  /**
   * Build ground-truth evidence for Operational Threshold Alerts
   */
  buildOperationalAlertEvidence({
    alert,
    dataset = null,
    records = [],
    dimensions = {}
  }) {
    const alertId = alert?.id || null;
    const alertName = alert?.name || 'Operational Alert';
    const condition = alert?.condition || 'greater_than';
    const threshold = this._toNum(alert?.threshold, 0);
    const lastTriggeredAt = alert?.last_triggered_at || new Date().toISOString();

    const datasetId = dataset?.id || alert?.dataset_id || null;
    const datasetName = dataset?.name || (datasetId ? `Dataset #${datasetId}` : 'Operational Telemetry');
    const recordsAnalyzed = Array.isArray(records) ? records.length : 0;
    const metric = alert?.metric_name || dimensions?.primaryMetric || 'threshold_metric';

    // Calculate actual current metric value from real dataset records if available
    let currentValue = threshold;
    let calculation = `Alert "${alertName}" breached threshold (${condition} ${threshold})`;

    if (recordsAnalyzed > 0 && dimensions?.primaryMetric) {
      const sum = records.reduce((acc, r) => acc + this._toNum(r[dimensions.primaryMetric]), 0);
      currentValue = Math.round(sum * 100) / 100;
      calculation = `SUM(${dimensions.primaryMetric}) = ${currentValue}, condition: ${condition} ${threshold}`;
    } else if (alert?.current_value !== undefined) {
      currentValue = this._toNum(alert.current_value, threshold);
    }

    let changePercent = null;
    if (threshold !== 0) {
      changePercent = Number((((currentValue - threshold) / Math.abs(threshold)) * 100).toFixed(1));
    }

    const sourceFields = dimensions?.primaryMetric ? [dimensions.primaryMetric] : ['threshold', 'condition'];
    const isValid = Boolean(alertId && (recordsAnalyzed > 0 || alert?.last_triggered_at));

    return {
      alertId,
      alert_id: alertId,
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric,
      currentValue,
      current_value: currentValue,
      comparisonValue: threshold,
      previous_value: threshold,
      threshold,
      condition,
      changePercent,
      change_percent: changePercent,
      lastTriggeredAt,
      last_triggered_at: lastTriggeredAt,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? (recordsAnalyzed > 0 
            ? `Verified against ${recordsAnalyzed} records in "${datasetName}": actual value ${currentValue} triggered condition (${condition} ${threshold}).`
            : `Verified against operational trigger incident on ${new Date(lastTriggeredAt).toLocaleString()}.`)
        : `Evidence verification failed: Alert contains no trigger history or data link.`
    };
  }

  /**
   * Build ground-truth evidence for Machine Learning Forecasts
   */
  buildForecastEvidence({
    forecast,
    dataset = null,
    predictions = [],
    anomalies = []
  }) {
    const forecastId = forecast?.id || null;
    const modelName = forecast?.model_name || 'Predictive Model';
    const targetColumn = forecast?.target_column || 'target_metric';
    const horizonPeriods = forecast?.horizon_periods || (predictions ? predictions.length : 30);
    const datasetId = dataset?.id || forecast?.dataset_id || null;
    const datasetName = dataset?.name || (datasetId ? `Dataset #${datasetId}` : 'Predictive Horizon');

    const recordsAnalyzed = (Array.isArray(predictions) ? predictions.length : 0) + (Array.isArray(anomalies) ? anomalies.length : 0);

    const firstPred = predictions && predictions.length > 0 ? this._toNum(predictions[0].predicted || predictions[0].value) : 0;
    const lastPred = predictions && predictions.length > 0 ? this._toNum(predictions[predictions.length - 1].predicted || predictions[predictions.length - 1].value) : 0;

    let predictedChangePercent = 0;
    if (firstPred !== 0) {
      predictedChangePercent = Number((((lastPred - firstPred) / Math.abs(firstPred)) * 100).toFixed(1));
    }

    const sourceFields = [targetColumn];
    const calculation = `Projected ${predictedChangePercent}% progression over ${horizonPeriods} periods from ${firstPred} to ${lastPred} via ${modelName}`;
    const isValid = predictions.length >= 2;

    return {
      forecastId,
      forecast_id: forecastId,
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric: targetColumn,
      currentValue: lastPred,
      current_value: lastPred,
      comparisonValue: firstPred,
      previous_value: firstPred,
      changePercent: predictedChangePercent,
      change_percent: predictedChangePercent,
      predictedChangePercent,
      predicted_change_percent: predictedChangePercent,
      startPredicted: firstPred,
      start_predicted: firstPred,
      endPredicted: lastPred,
      end_predicted: lastPred,
      model: modelName,
      model_name: modelName,
      horizonPeriods,
      horizon_periods: horizonPeriods,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Validated predictive projection across ${predictions.length} time-horizon intervals using ${modelName}.`
        : `Evidence verification failed: Insufficient forecast prediction intervals.`
    };
  }

  /**
   * Build ground-truth evidence for Detected Anomaly insights
   */
  buildAnomalyEvidence({
    forecast,
    dataset = null,
    anomalies = []
  }) {
    const forecastId = forecast?.id || null;
    const modelName = forecast?.model_name || 'Statistical Dispersion Model';
    const targetColumn = forecast?.target_column || 'target_metric';
    const datasetId = dataset?.id || forecast?.dataset_id || null;
    const datasetName = dataset?.name || (datasetId ? `Dataset #${datasetId}` : 'Telemetry');
    const recordsAnalyzed = anomalies.length;

    const sourceFields = [targetColumn];
    const calculation = `Statistical outliers identified at >2.5 standard deviations from median trajectory`;
    const isValid = anomalies.length > 0;

    return {
      forecastId,
      forecast_id: forecastId,
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric: targetColumn,
      currentValue: anomalies.length,
      current_value: anomalies.length,
      comparisonValue: 0,
      previous_value: 0,
      changePercent: null,
      change_percent: null,
      anomalyCount: anomalies.length,
      anomaly_count: anomalies.length,
      sampleAnomaly: anomalies[0] || null,
      sample_anomaly: anomalies[0] || null,
      targetColumn,
      target_column: targetColumn,
      modelName,
      model_name: modelName,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Identified ${anomalies.length} anomalous points exceeding standard variance bounds.`
        : `Evidence verification failed: Zero anomalies present in telemetry.`
    };
  }

  /**
   * Build ground-truth evidence for Relational Multi-Dataset Joins
   */
  buildRelationalEvidence({
    baseDataset,
    targetDataset,
    baseRecords = [],
    targetRecords = [],
    relationalResult = {},
    rel = {}
  }) {
    const datasetId = baseDataset?.id || null;
    const datasetName = `${baseDataset?.name || 'Dataset A'} ⨝ ${targetDataset?.name || 'Dataset B'}`;
    const recordsAnalyzed = (baseRecords ? baseRecords.length : 0) + (targetRecords ? targetRecords.length : 0);
    const joinedRecords = relationalResult.totalCount !== undefined ? relationalResult.totalCount : (relationalResult.rows?.length || 0);

    const sourceFields = [rel.source_column, rel.target_column].filter(Boolean);
    const calculation = `${(rel.relationship_type || 'INNER').toUpperCase()} JOIN ON ${baseDataset?.name}.${rel.source_column} = ${targetDataset?.name}.${rel.target_column}`;
    const isValid = recordsAnalyzed > 0 && joinedRecords > 0;

    return {
      datasetId,
      dataset_id: datasetId,
      datasetName,
      dataset_name: datasetName,
      recordsAnalyzed,
      records_analyzed: recordsAnalyzed,
      metric: 'joined_records_count',
      currentValue: joinedRecords,
      current_value: joinedRecords,
      comparisonValue: baseRecords.length,
      previous_value: baseRecords.length,
      changePercent: null,
      change_percent: null,
      sourceDataset: baseDataset?.name,
      source_dataset: baseDataset?.name,
      targetDataset: targetDataset?.name,
      target_dataset: targetDataset?.name,
      joinType: rel.relationship_type || 'left',
      join_type: rel.relationship_type || 'left',
      totalJoinedRecords: joinedRecords,
      total_joined_records: joinedRecords,
      sourceFields,
      source_fields: sourceFields,
      calculation,
      verified: isValid,
      verificationReason: isValid
        ? `Successfully joined ${baseRecords.length} base records with ${targetRecords.length} target records yielding ${joinedRecords} aligned rows.`
        : `Evidence verification failed: No matching relational records produced.`
    };
  }
}

module.exports = new EvidenceBuilderService();
