const AlertModel = require('../models/alertModel');
const MetricModel = require('../models/metricModel');
const DatasetModel = require('../models/datasetModel');
const { loadDatasetRecords } = require('./analyticsService');
const emailService = require('./emailService');

/**
 * Helper to evaluate a metric formula on dataset records
 */
function computeMetricValueFromRecords(records = [], formula = '', targetColumn = null) {
  if (!records || records.length === 0) return 0;
  const formulaUpper = (formula || '').toUpperCase().trim();
  
  let agg = 'SUM';
  let col = targetColumn;

  const aggMatch = formulaUpper.match(/(SUM|AVG|COUNT|MIN|MAX)\(([a-zA-Z0-9_]+)\)/i);
  if (aggMatch) {
    agg = aggMatch[1].toUpperCase();
    col = aggMatch[2].toLowerCase();
  }

  if (!col && records.length > 0) {
    const firstRow = records[0];
    const numKey = Object.keys(firstRow).find(k => {
      const v = Number(firstRow[k]);
      return !isNaN(v) && !k.toLowerCase().includes('id');
    });
    col = numKey || Object.keys(firstRow)[0];
  }

  if (agg === 'COUNT') {
    return records.length;
  }

  const findVal = (row, key) => {
    if (!key) return NaN;
    if (row[key] !== undefined) return Number(row[key]);
    const matchedKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
    return matchedKey ? Number(row[matchedKey]) : NaN;
  };

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const r of records) {
    const v = findVal(r, col);
    if (!isNaN(v)) {
      sum += v;
      count++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  if (count === 0) return 0;

  switch (agg) {
    case 'AVG': return Math.round((sum / count) * 100) / 100;
    case 'MIN': return min !== Infinity ? min : 0;
    case 'MAX': return max !== -Infinity ? max : 0;
    case 'SUM':
    default: return Math.round(sum * 100) / 100;
  }
}

/**
 * Real-Time Alert Evaluator & Incident Engine
 */
class AlertEvaluatorService {
  constructor() {
    this.isEvaluating = false;
  }

  /**
   * Evaluate if a numeric metric value satisfies an alert condition rule
   * Supports exactly 6 conditions:
   * - greater_than
   * - less_than
   * - equal (or equals)
   * - not_equal (or not_equals)
   * - percent_increase (or percentage_change_increase)
   * - percent_decrease (or percentage_change_decrease)
   *
   * @param {string} condition 
   * @param {number} metricValue 
   * @param {number} threshold 
   * @param {number} [baselineValue] 
   * @returns {boolean}
   */
  evaluateCondition(condition, metricValue, threshold, baselineValue = null) {
    const val = Number(metricValue);
    const target = Number(threshold);
    const cond = (condition || '').toLowerCase().trim();

    if (isNaN(val) || isNaN(target)) {
      return false;
    }

    switch (cond) {
      case 'greater_than':
        return val > target;

      case 'less_than':
        return val < target;

      case 'equal':
      case 'equals':
        return Math.abs(val - target) < 0.0001;

      case 'not_equal':
      case 'not_equals':
        return Math.abs(val - target) >= 0.0001;

      case 'percent_increase':
      case 'percentage_change_increase': {
        // If baseline is provided, compute percentage rise from baseline: ((val - baseline) / baseline) * 100 >= target
        // If no baseline provided, interpret metricValue as percentage delta or evaluate directly: val >= target
        if (baselineValue !== null && baselineValue !== undefined && !isNaN(Number(baselineValue)) && Number(baselineValue) !== 0) {
          const baseline = Number(baselineValue);
          const percentChange = ((val - baseline) / Math.abs(baseline)) * 100;
          return percentChange >= target;
        }
        return val >= target;
      }

      case 'percent_decrease':
      case 'percentage_change_decrease': {
        // If baseline is provided, compute percentage drop from baseline: ((baseline - val) / baseline) * 100 >= target
        // If no baseline provided, evaluate directly: val <= -target or val >= target (drop)
        if (baselineValue !== null && baselineValue !== undefined && !isNaN(Number(baselineValue)) && Number(baselineValue) !== 0) {
          const baseline = Number(baselineValue);
          const percentDrop = ((baseline - val) / Math.abs(baseline)) * 100;
          return percentDrop >= target;
        }
        return val >= target || val <= -target;
      }

      default:
        console.warn(`[AlertEvaluator] Unknown alert condition: "${condition}"`);
        return false;
    }
  }

  /**
   * Fetch live metric value for an alert
   * @param {object} alert 
   * @returns {Promise<number>}
   */
  async resolveMetricValue(alert) {
    if (alert.metric_id) {
      const metric = await MetricModel.findByIdAndOrgId(alert.metric_id, alert.organization_id);
      if (metric && metric.dataset_file_path) {
        try {
          const records = await loadDatasetRecords(metric.dataset_file_path);
          return computeMetricValueFromRecords(records, metric.formula);
        } catch (err) {
          console.warn(`[AlertEvaluator] Could not load dataset records for metric ${metric.name}:`, err.message);
          return Number(metric.target_value || 0);
        }
      } else if (metric && metric.target_value !== null && metric.target_value !== undefined) {
        return Number(metric.target_value);
      }
    }

    if (alert.dataset_id) {
      const dataset = await DatasetModel.findByIdAndOrgId(alert.dataset_id, alert.organization_id);
      if (dataset && dataset.file_path) {
        try {
          const records = await loadDatasetRecords(dataset.file_path);
          return computeMetricValueFromRecords(records, 'SUM');
        } catch (err) {
          console.warn(`[AlertEvaluator] Could not load dataset ${dataset.name}:`, err.message);
        }
      }
    }

    return 0;
  }

  /**
   * Evaluate a single alert rule
   * @param {object} alert 
   * @param {{
   *   overrideMetricValue?: number,
   *   baselineValue?: number,
   *   dryRun?: boolean
   * }} [options={}]
   * @returns {Promise<{
   *   alertId: string,
   *   alertName: string,
   *   condition: string,
   *   threshold: number,
   *   metricValue: number,
   *   triggered: boolean,
   *   suppressed: boolean,
   *   incident: object | null,
   *   notificationResult: object | null,
   *   message: string
   * }>}
   */
  async evaluateAlertRule(alert, options = {}) {
    if (!alert) {
      throw new Error('Alert object is required for evaluation.');
    }

    // 1. Resolve metric value
    let metricValue = options.overrideMetricValue !== undefined 
      ? Number(options.overrideMetricValue) 
      : await this.resolveMetricValue(alert);

    if (isNaN(metricValue)) {
      metricValue = 0;
    }

    const threshold = Number(alert.threshold);
    const baseline = options.baselineValue !== undefined ? Number(options.baselineValue) : null;
    const isTriggered = this.evaluateCondition(alert.condition, metricValue, threshold, baseline);

    if (!isTriggered) {
      return {
        alertId: alert.id,
        alertName: alert.name,
        condition: alert.condition,
        threshold,
        metricValue,
        triggered: false,
        suppressed: false,
        incident: null,
        notificationResult: null,
        message: `Metric value (${metricValue}) does not breach condition "${alert.condition}" (Threshold: ${threshold}).`
      };
    }

    // 2. If dry-run (e.g. testing endpoint with mock value or preview), skip incident creation & emails
    if (options.dryRun) {
      return {
        alertId: alert.id,
        alertName: alert.name,
        condition: alert.condition,
        threshold,
        metricValue,
        triggered: true,
        suppressed: false,
        incident: null,
        notificationResult: null,
        message: `Condition breached: ${metricValue} ${alert.condition.replace(/_/g, ' ')} ${threshold}. (Dry run test successful)`
      };
    }

    // 3. Anti-flapping Cooldown Check
    const cooldownMins = Number(alert.cooldown_minutes) >= 0 ? Number(alert.cooldown_minutes) : 60;
    const recentIncident = await AlertModel.findRecentIncidentForAlert(alert.id, alert.organization_id, cooldownMins);

    if (recentIncident) {
      return {
        alertId: alert.id,
        alertName: alert.name,
        condition: alert.condition,
        threshold,
        metricValue,
        triggered: true,
        suppressed: true,
        incident: recentIncident,
        notificationResult: null,
        message: `Alert triggered but suppressed by ${cooldownMins}m cooldown (Incident #${recentIncident.id} already active).`
      };
    }

    // 4. Create Incident Record
    let incident = null;
    let notificationDelivery = { in_app: { created: true, timestamp: new Date() } };

    try {
      incident = await AlertModel.createIncident({
        alertId: alert.id,
        organizationId: alert.organization_id,
        metricValue,
        thresholdValue: threshold,
        condition: alert.condition,
        severity: alert.severity || 'medium',
        status: 'triggered',
        notificationDelivery
      });

      await AlertModel.updateLastTriggered(alert.id, new Date(), 'triggered');
    } catch (dbErr) {
      console.error(`[AlertEvaluator] Failed to create incident record for alert "${alert.name}":`, dbErr.message);
      throw dbErr;
    }

    // 5. Dispatch Email Notifications if configured
    const channels = Array.isArray(alert.notification_channels) 
      ? alert.notification_channels 
      : (typeof alert.notification_channels === 'string' ? JSON.parse(alert.notification_channels || '[]') : []);

    const recipients = Array.isArray(alert.recipients)
      ? alert.recipients
      : (typeof alert.recipients === 'string' ? JSON.parse(alert.recipients || '[]') : []);

    let emailResult = null;
    if (channels.includes('email') && recipients.length > 0) {
      try {
        emailResult = await emailService.sendAlertEmail({
          recipients,
          alertTitle: alert.name,
          metricName: alert.metric_name || 'Operational KPI',
          metricValue,
          thresholdValue: threshold,
          condition: alert.condition,
          severity: alert.severity || 'medium',
          organizationName: alert.organization_name || 'Ricoz Primary Organization',
          triggeredAt: new Date()
        });
        notificationDelivery.email = emailResult;
      } catch (emailErr) {
        // Email failure must NOT crash evaluator or scheduler
        console.error(`[AlertEvaluator] Email dispatch failure for alert "${alert.name}":`, emailErr.message);
        notificationDelivery.email = { attempted: true, success: false, error: emailErr.message };
      }
    }

    return {
      alertId: alert.id,
      alertName: alert.name,
      condition: alert.condition,
      threshold,
      metricValue,
      triggered: true,
      suppressed: false,
      incident,
      notificationResult: notificationDelivery,
      message: `Operational incident triggered: ${metricValue} ${alert.condition.replace(/_/g, ' ')} ${threshold}.`
    };
  }

  /**
   * Periodic scheduler batch evaluation for all active alerts
   * @returns {Promise<{ evaluated: number, triggered: number, suppressed: number, errors: number }>}
   */
  async evaluateActiveAlerts() {
    if (this.isEvaluating) {
      console.log('[AlertEvaluator] Previous evaluation cycle is still running. Skipping overlap.');
      return { evaluated: 0, triggered: 0, suppressed: 0, errors: 0 };
    }

    this.isEvaluating = true;
    const summary = { evaluated: 0, triggered: 0, suppressed: 0, errors: 0 };

    try {
      const activeAlerts = await AlertModel.findActiveAlerts();
      if (!activeAlerts || activeAlerts.length === 0) {
        return summary;
      }

      for (const alert of activeAlerts) {
        summary.evaluated++;
        try {
          const res = await this.evaluateAlertRule(alert);
          if (res.triggered) {
            if (res.suppressed) {
              summary.suppressed++;
            } else {
              summary.triggered++;
            }
          }
        } catch (itemErr) {
          summary.errors++;
          console.error(`[AlertEvaluator] Error evaluating alert "${alert.name}" (${alert.id}):`, itemErr.message);
        }
      }
    } catch (batchErr) {
      console.error('[AlertEvaluator] Batch evaluation failure:', batchErr.message);
    } finally {
      this.isEvaluating = false;
    }

    return summary;
  }
}

module.exports = new AlertEvaluatorService();
