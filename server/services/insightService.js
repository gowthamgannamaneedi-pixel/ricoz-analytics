const crypto = require('crypto');
const InsightModel = require('../models/insightModel');
const Dataset = require('../models/datasetModel');
const MetricModel = require('../models/metricModel');
const ForecastModel = require('../models/forecastModel');
const AlertModel = require('../models/alertModel');
const Dashboard = require('../models/dashboardModel');
const DatasetRelationshipModel = require('../models/datasetRelationshipModel');
const analyticsService = require('./analyticsService');
const dataQualityService = require('./dataQualityService');
const geminiService = require('./geminiService');
const auditService = require('./auditService');

/**
 * Enterprise AI Automated Insights Engine Service
 * Proactively identifies statistically and evidentially meaningful events across:
 * - KPIs & Metrics
 * - Time-Series Trends & Growth/Decline Velocity
 * - Machine Learning Forecasts & Anomalies
 * - Data Quality & Observability Telemetry
 * - Multi-Dataset Relational Joins
 * - Operational Threshold Alerts
 */
class InsightService {
  constructor() {
    this.cooldownMinutes = 60; // Deduplication window
  }

  /**
   * Helper to format numbers cleanly in summaries
   */
  _formatNumber(val) {
    if (val === null || val === undefined || isNaN(Number(val))) return '0';
    const num = Number(val);
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /**
   * Generate comprehensive organization insights across all available subsystems
   * @param {string} organizationId 
   * @param {{
   *   userId?: number|string|null,
   *   datasetId?: number|string|null,
   *   persist?: boolean,
   *   forceReevaluate?: boolean,
   *   ipAddress?: string|null,
   *   userAgent?: string|null
   * }} [options={}]
   * @returns {Promise<{
   *   insights: Array<any>,
   *   executive_summary: string,
   *   count: number,
   *   generated_at: Date
   * }>}
   */
  async generateInsights(organizationId, options = {}) {
    if (!organizationId) {
      throw new Error('Organization ID is required to generate insights.');
    }

    const detectedInsights = [];

    // 1. Gather all tenant data concurrently with error boundaries
    const [datasets, metrics, forecasts, alerts, relationships] = await Promise.all([
      (Dataset.findByOrganizationId ? Dataset.findByOrganizationId(organizationId) : (Dataset.findByUserId ? Dataset.findByUserId(options.userId || 1) : [])).catch(() => []),
      MetricModel.findByOrganizationId(organizationId).catch(() => []),
      ForecastModel.findByOrganizationId(organizationId, 10).catch(() => []),
      AlertModel.findByOrganizationId(organizationId).catch(() => []),
      DatasetRelationshipModel.findByOrganizationId(organizationId).catch(() => [])
    ]);

    const targetDatasets = options.datasetId 
      ? datasets.filter(d => String(d.id) === String(options.datasetId))
      : datasets;

    // 2. Evaluate Datasets for Growth, Decline, Trends, and Breakdown Insights
    for (const ds of targetDatasets.slice(0, 5)) {
      try {
        if (!ds.file_path) continue;
        const records = await analyticsService.loadDatasetRecords(ds.file_path);
        if (!records || records.length === 0) continue;

        const schema = Array.isArray(ds.schema) ? ds.schema : [];
        const dims = analyticsService.detectDatasetDimensions(schema, records.slice(0, 20));

        // A. Growth & Decline Detection
        const trends = analyticsService.computeDatasetTrends(records, dims);
        if (trends && trends.length >= 2) {
          const prevPoint = trends[trends.length - 2];
          const currPoint = trends[trends.length - 1];
          const prevVal = Number(prevPoint.revenue || prevPoint.value || 0);
          const currVal = Number(currPoint.revenue || currPoint.value || 0);

          if (prevVal > 0) {
            const changePct = Number((((currVal - prevVal) / prevVal) * 100).toFixed(1));
            const metricName = (dims.primaryMetric || 'revenue').replace(/_/g, ' ');

            // Significant Growth (>= +10%)
            if (changePct >= 10) {
              detectedInsights.push({
                type: 'growth',
                title: `${metricName.toUpperCase()} grew by ${changePct}%`,
                summary: `${metricName.charAt(0).toUpperCase() + metricName.slice(1)} increased by ${changePct}% (from ${this._formatNumber(prevVal)} to ${this._formatNumber(currVal)}) in the latest period.`,
                severity: 'positive',
                confidence: 0.96,
                evidence: {
                  metric: dims.primaryMetric || 'revenue',
                  current_value: currVal,
                  previous_value: prevVal,
                  change_percent: changePct,
                  period: currPoint.date || 'Latest'
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Review top driver segments for ${ds.name}`,
                  target_page: `/datasets`,
                  params: { datasetId: ds.id }
                }
              });
            } else if (changePct <= -10) {
              // Significant Decline (<= -10%)
              const isCritical = changePct <= -25;
              detectedInsights.push({
                type: 'decline',
                title: `${metricName.toUpperCase()} dropped by ${Math.abs(changePct)}%`,
                summary: `${metricName.charAt(0).toUpperCase() + metricName.slice(1)} contracted by ${Math.abs(changePct)}% compared with previous period.`,
                severity: isCritical ? 'critical' : 'warning',
                confidence: 0.95,
                evidence: {
                  metric: dims.primaryMetric || 'revenue',
                  current_value: currVal,
                  previous_value: prevVal,
                  change_percent: changePct,
                  period: currPoint.date || 'Latest'
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Investigate root-cause of ${metricName} contraction in ${ds.name}`,
                  target_page: `/datasets`,
                  params: { datasetId: ds.id }
                }
              });
            }
          }

          // B. Multi-Period Trend Detection (3+ consecutive growth / decline periods)
          if (trends.length >= 4) {
            const recent = trends.slice(-4);
            const isRising = recent.every((pt, idx) => idx === 0 || Number(pt.revenue || pt.value) >= Number(recent[idx - 1].revenue || recent[idx - 1].value));
            const isFalling = recent.every((pt, idx) => idx === 0 || Number(pt.revenue || pt.value) <= Number(recent[idx - 1].revenue || recent[idx - 1].value));

            if (isRising) {
              detectedInsights.push({
                type: 'trend',
                title: `Sustained positive trajectory on ${ds.name}`,
                summary: `${dims.primaryMetric || 'Telemetry'} has exhibited continuous expansion across 4 consecutive observation intervals.`,
                severity: 'positive',
                confidence: 0.94,
                evidence: {
                  consecutive_periods: 4,
                  starting_value: Number(recent[0].revenue || recent[0].value),
                  latest_value: Number(recent[3].revenue || recent[3].value)
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Analyze capacity and forecast continuation on ${ds.name}`,
                  target_page: `/forecasts`
                }
              });
            } else if (isFalling) {
              detectedInsights.push({
                type: 'trend',
                title: `Sustained downward trend detected on ${ds.name}`,
                summary: `${dims.primaryMetric || 'Telemetry'} has declined for 4 consecutive observation periods.`,
                severity: 'warning',
                confidence: 0.94,
                evidence: {
                  consecutive_periods: 4,
                  starting_value: Number(recent[0].revenue || recent[0].value),
                  latest_value: Number(recent[3].revenue || recent[3].value)
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Review operational drivers for consecutive period decline`,
                  target_page: `/datasets`,
                  params: { datasetId: ds.id }
                }
              });
            }
          }
        }

        // C. Data Quality Telemetry Integration (Phase 15)
        try {
          const quality = await dataQualityService.getQualityProfile(ds.id, organizationId);
          if (quality && quality.quality_score !== undefined) {
            if (quality.quality_score < 75) {
              detectedInsights.push({
                type: 'data_quality',
                title: `Low quality health score on ${ds.name} (${quality.quality_score}/100)`,
                summary: `Dataset health score is at ${quality.quality_score}/100 with status "${quality.status || 'warning'}". Detected ${quality.issues?.length || 0} quality anomalies.`,
                severity: quality.quality_score < 60 ? 'critical' : 'warning',
                confidence: 0.98,
                evidence: {
                  quality_score: quality.quality_score,
                  completeness_score: quality.dimensions?.completeness?.score || 100,
                  validity_score: quality.dimensions?.validity?.score || 100,
                  issues_count: quality.issues?.length || 0
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Open Data Quality console to review column anomalies`,
                  target_page: `/data-quality`,
                  params: { datasetId: ds.id }
                }
              });
            } else {
              detectedInsights.push({
                type: 'data_quality',
                title: `Data quality verified on ${ds.name} (${quality.quality_score}/100)`,
                summary: `Dataset passes data health audit with ${quality.quality_score}/100 composite score. Completeness and validity within optimal thresholds.`,
                severity: 'positive',
                confidence: 0.95,
                evidence: {
                  quality_score: quality.quality_score,
                  completeness_score: quality.dimensions?.completeness?.score || 100,
                  validity_score: quality.dimensions?.validity?.score || 100,
                  issues_count: quality.issues?.length || 0
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Monitor scheduled data quality rules`,
                  target_page: `/data-quality`,
                  params: { datasetId: ds.id }
                }
              });
            }

            if (quality.dimensions?.freshness?.status === 'stale') {
              detectedInsights.push({
                type: 'data_quality',
                title: `Dataset ${ds.name} is stale`,
                summary: `Dataset refresh interval exceeded. Last updated ${quality.dimensions?.freshness?.age_hours || 'N/A'} hours ago.`,
                severity: 'warning',
                confidence: 0.95,
                evidence: {
                  age_hours: quality.dimensions?.freshness?.age_hours,
                  status: 'stale'
                },
                source_metadata: {
                  dataset_id: ds.id,
                  dataset_name: ds.name
                },
                recommendation: {
                  action: `Trigger ingestion pipeline refresh for ${ds.name}`,
                  target_page: `/data-sources`
                }
              });
            }
          }
        } catch (_) {}

      } catch (dsErr) {
        console.warn(`[InsightService] Error processing dataset #${ds.id}:`, dsErr.message);
      }
    }

    // 3. Evaluate Machine Learning Forecasts & Anomalies (Phase 11)
    for (const fc of forecasts.slice(0, 5)) {
      try {
        const predictions = Array.isArray(fc.predictions) ? fc.predictions : [];
        const anomalies = Array.isArray(fc.anomalies) ? fc.anomalies : [];

        // A. Detected Anomalies
        if (anomalies.length > 0) {
          detectedInsights.push({
            type: 'anomaly',
            title: `Detected ${anomalies.length} ML statistical anomalies in ${fc.target_column || 'forecast'}`,
            summary: `Automated ML anomaly detector flagged ${anomalies.length} time-series data points exceeding standard dispersion thresholds.`,
            severity: 'warning',
            confidence: 0.92,
            evidence: {
              target_column: fc.target_column,
              model_name: fc.model_name,
              anomaly_count: anomalies.length,
              sample_anomaly: anomalies[0]
            },
            source_metadata: {
              forecast_id: fc.id,
              target_column: fc.target_column
            },
            recommendation: {
              action: `Review anomaly timestamps in predictive dashboard`,
              target_page: `/forecasts`
            }
          });
        }

        // B. Forecast Trajectory (Horizon Trend)
        if (predictions.length >= 2) {
          const firstPred = Number(predictions[0].predicted || 0);
          const lastPred = Number(predictions[predictions.length - 1].predicted || 0);
          if (firstPred > 0) {
            const predChange = Number((((lastPred - firstPred) / firstPred) * 100).toFixed(1));
            if (predChange <= -10) {
              detectedInsights.push({
                type: 'forecast',
                title: `Forecast predicts ${Math.abs(predChange)}% reduction over next ${fc.horizon_periods || 30} periods`,
                summary: `${fc.model_name || 'ML Model'} projects a downward trajectory for ${fc.target_column || 'target metric'}.`,
                severity: predChange <= -20 ? 'critical' : 'warning',
                confidence: 0.89,
                evidence: {
                  model: fc.model_name,
                  horizon_periods: fc.horizon_periods,
                  predicted_change_percent: predChange,
                  start_predicted: firstPred,
                  end_predicted: lastPred
                },
                source_metadata: {
                  forecast_id: fc.id
                },
                recommendation: {
                  action: `Inspect forecast horizon and adjust strategic targets`,
                  target_page: `/forecasts`
                }
              });
            } else if (predChange >= 15) {
              detectedInsights.push({
                type: 'forecast',
                title: `Forecast predicts strong ${predChange}% growth`,
                summary: `${fc.model_name || 'ML Model'} projects continued upward expansion for ${fc.target_column || 'target metric'}.`,
                severity: 'positive',
                confidence: 0.90,
                evidence: {
                  model: fc.model_name,
                  horizon_periods: fc.horizon_periods,
                  predicted_change_percent: predChange,
                  start_predicted: firstPred,
                  end_predicted: lastPred
                },
                source_metadata: {
                  forecast_id: fc.id
                },
                recommendation: {
                  action: `Review capacity constraints for projected demand growth`,
                  target_page: `/forecasts`
                }
              });
            }
          }
        }
      } catch (fcErr) {
        console.warn(`[InsightService] Error evaluating forecast #${fc.id}:`, fcErr.message);
      }
    }

    // 4. Evaluate Relational Dataset Joins (Phase 14)
    if (relationships.length > 0) {
      try {
        const rel = relationships[0];
        const srcDs = datasets.find(d => Number(d.id) === Number(rel.source_dataset_id));
        const tgtDs = datasets.find(d => Number(d.id) === Number(rel.target_dataset_id));

        if (srcDs && tgtDs && srcDs.file_path && tgtDs.file_path) {
          const srcRecords = await analyticsService.loadDatasetRecords(srcDs.file_path);
          const tgtRecords = await analyticsService.loadDatasetRecords(tgtDs.file_path);

          const relationalRes = await analyticsService.executeRelationalQuery({
            baseDataset: srcDs,
            baseRecords: srcRecords,
            joins: [{
              targetDataset: tgtDs,
              targetRecords: tgtRecords,
              sourceColumn: rel.source_column,
              targetColumn: rel.target_column,
              type: 'left'
            }],
            dimensions: [rel.target_column],
            metrics: [{ column: 'revenue', aggregation: 'SUM', alias: 'total_revenue' }],
            limit: 5
          });

          if (relationalRes.rows && relationalRes.rows.length > 0) {
            const topRow = relationalRes.rows[0];
            const topKey = Object.keys(topRow)[0];

            detectedInsights.push({
              type: 'relationship',
              title: `Relational segmentation across ${srcDs.name} & ${tgtDs.name}`,
              summary: `Cross-dataset relational query indicates high volume concentration associated with primary relational key "${topKey}".`,
              severity: 'info',
              confidence: 0.93,
              evidence: {
                source_dataset: srcDs.name,
                target_dataset: tgtDs.name,
                join_type: rel.relationship_type,
                total_joined_records: relationalRes.totalCount
              },
              source_metadata: {
                relationship_id: rel.id
              },
              recommendation: {
                action: `Explore multi-dataset schema modeling`,
                target_page: `/data-model`
              }
            });
          }
        }
      } catch (relErr) {
        console.warn(`[InsightService] Relational insight notice:`, relErr.message);
      }
    }

    // 5. Evaluate Operational Threshold Alerts (Phase 10)
    for (const alert of alerts.slice(0, 5)) {
      if ((alert.status === 'active' || alert.status === 'triggered') && alert.last_triggered_at) {
        const trigDate = new Date(alert.last_triggered_at);
        const hoursAgo = (Date.now() - trigDate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo <= 48 || isNaN(hoursAgo)) {
          detectedInsights.push({
            type: 'operational',
            title: `Operational Alert Triggered: "${alert.name}"`,
            summary: `Threshold alert "${alert.name}" recently breached configured condition (${alert.condition} ${alert.threshold}).`,
            severity: alert.severity === 'critical' ? 'critical' : 'warning',
            confidence: 0.99,
            evidence: {
              alert_id: alert.id,
              condition: alert.condition,
              threshold: alert.threshold,
              last_triggered_at: alert.last_triggered_at
            },
            source_metadata: {
              alert_id: alert.id,
              metric_id: alert.metric_id
            },
            recommendation: {
              action: `Acknowledge and resolve active alert incident`,
              target_page: `/alerts`
            }
          });
        }
      }
    }

    // 6. Synthesize Executive Summary
    const executiveSummary = this._synthesizeExecutiveSummary(detectedInsights);

    // 7. Persist generated insights with strict deduplication & cooldown enforcement
    const persistedInsights = [];
    if (options.persist !== false && detectedInsights.length > 0) {
      const cooldownMinutes = options.forceFresh ? 0 : (options.cooldownMinutes || this.cooldownMinutes || 60);

      for (const ins of detectedInsights) {
        try {
          // Check for existing active duplicate within cooldown window or matching natural key
          const existing = await InsightModel.findActiveDuplicate({
            organizationId,
            type: ins.type,
            title: ins.title,
            alertId: ins.source_metadata?.alert_id || null,
            datasetId: ins.source_metadata?.dataset_id || null,
            cooldownMinutes
          });

          if (existing && !options.forceFresh) {
            // Update existing insight evidence & telemetry instead of creating duplicate UUID row
            const updated = await InsightModel.updateInsight(existing.id, organizationId, {
              summary: ins.summary,
              severity: ins.severity || existing.severity,
              confidence: ins.confidence || existing.confidence,
              evidence: ins.evidence || existing.evidence,
              sourceMetadata: ins.source_metadata || existing.source_metadata,
              recommendation: ins.recommendation || existing.recommendation
            });
            persistedInsights.push(updated || existing);
          } else {
            // If forceFresh was requested and an active duplicate exists, archive it first
            if (existing && options.forceFresh) {
              await InsightModel.updateStatus(existing.id, organizationId, 'archived').catch(() => {});
            }

            const saved = await InsightModel.create({
              organizationId,
              userId: options.userId || null,
              datasetId: ins.source_metadata?.dataset_id || null,
              metricId: ins.source_metadata?.metric_id || null,
              dashboardId: ins.source_metadata?.dashboard_id || null,
              type: ins.type,
              title: ins.title,
              summary: ins.summary,
              severity: ins.severity || 'info',
              confidence: ins.confidence || 0.95,
              evidence: ins.evidence || {},
              sourceMetadata: ins.source_metadata || {},
              recommendation: ins.recommendation || {},
              status: 'active'
            });
            persistedInsights.push(saved);
          }
        } catch (dbErr) {
          console.warn('[InsightService] Insight persistence notice:', dbErr.message);
          persistedInsights.push({ id: crypto.randomUUID(), ...ins });
        }
      }

      // Log audit event
      auditService.log({
        organizationId,
        userId: options.userId || null,
        action: 'INSIGHTS_GENERATED',
        resourceType: 'ai_insights',
        resourceId: String(organizationId),
        description: `Generated ${detectedInsights.length} automated AI insights and executive summary.`,
        metadata: { count: detectedInsights.length, severities: detectedInsights.map(i => i.severity) },
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null
      }).catch(() => {});
    }

    return {
      insights: persistedInsights.length > 0 ? persistedInsights : detectedInsights,
      executive_summary: executiveSummary,
      count: detectedInsights.length,
      generated_at: new Date()
    };
  }

  /**
   * Synthesize natural-language Executive Summary from detected evidence
   * @param {Array<any>} insights 
   * @returns {string}
   */
  _synthesizeExecutiveSummary(insights = []) {
    if (!insights || insights.length === 0) {
      return 'No significant changes detected. Enterprise telemetry, forecasts, and data quality metrics remain stable within expected parameters.';
    }

    const positive = insights.find(i => i.severity === 'positive');
    const warningOrCrit = insights.find(i => i.severity === 'critical' || i.severity === 'warning');
    const anomaly = insights.find(i => i.type === 'anomaly');
    const quality = insights.find(i => i.type === 'data_quality');
    const forecast = insights.find(i => i.type === 'forecast');

    const sections = ['### Enterprise AI Executive Summary\n'];

    if (positive) {
      sections.push(`• **Top Positive Movement:** ${positive.title} — ${positive.summary}`);
    }

    if (warningOrCrit) {
      sections.push(`• **Operational Watch:** ${warningOrCrit.title} — ${warningOrCrit.summary}`);
    }

    if (anomaly) {
      sections.push(`• **Anomaly Alert:** ${anomaly.summary}`);
    }

    if (quality) {
      sections.push(`• **Data Quality Note:** ${quality.summary}`);
    }

    if (forecast) {
      sections.push(`• **Predictive Outlook:** ${forecast.summary}`);
    }

    const recs = insights.filter(i => i.recommendation?.action).slice(0, 2);
    if (recs.length > 0) {
      sections.push(`\n**Recommended Strategic Actions:**\n` + recs.map(r => `1. ${r.recommendation.action}`).join('\n'));
    }

    return sections.join('\n');
  }

  /**
   * Fetch active insights for an organization
   */
  async getInsights(organizationId, filters = {}) {
    if (!organizationId) throw new Error('Organization ID is required.');
    return InsightModel.findByOrganizationId(organizationId, filters);
  }

  /**
   * Fetch single insight by ID
   */
  async getInsightById(id, organizationId) {
    if (!id || !organizationId) throw new Error('ID and Organization ID are required.');
    return InsightModel.findByIdAndOrgId(id, organizationId);
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(id, organizationId, { userId = null, ipAddress = null, userAgent = null } = {}) {
    const existing = await InsightModel.findByIdAndOrgId(id, organizationId);
    if (!existing) {
      const err = new Error(`Insight #${id} not found.`);
      err.status = 404;
      throw err;
    }

    const updated = await InsightModel.updateStatus(id, organizationId, 'dismissed');

    auditService.log({
      organizationId,
      userId,
      action: 'INSIGHT_DISMISSED',
      resourceType: 'ai_insights',
      resourceId: String(id),
      description: `Dismissed AI insight "${existing.title}".`,
      ipAddress,
      userAgent
    }).catch(() => {});

    return updated;
  }

  /**
   * Submit feedback on insight (useful / not_useful)
   */
  async submitFeedback(id, organizationId, feedback, { userId = null, ipAddress = null, userAgent = null } = {}) {
    const valid = ['useful', 'not_useful'];
    if (!valid.includes(String(feedback).toLowerCase())) {
      throw new Error(`Invalid feedback "${feedback}". Must be 'useful' or 'not_useful'.`);
    }

    const existing = await InsightModel.findByIdAndOrgId(id, organizationId);
    if (!existing) {
      const err = new Error(`Insight #${id} not found.`);
      err.status = 404;
      throw err;
    }

    const updated = await InsightModel.updateFeedback(id, organizationId, feedback.toLowerCase());

    auditService.log({
      organizationId,
      userId,
      action: 'INSIGHT_FEEDBACK_SUBMITTED',
      resourceType: 'ai_insights',
      resourceId: String(id),
      description: `Submitted feedback "${feedback}" on insight "${existing.title}".`,
      metadata: { feedback },
      ipAddress,
      userAgent
    }).catch(() => {});

    return updated;
  }
}

module.exports = new InsightService();
