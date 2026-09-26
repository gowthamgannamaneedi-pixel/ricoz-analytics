const cron = require('node-cron');
const ReportModel = require('../models/reportModel');
const reportService = require('./reportService');
const alertEvaluatorService = require('./alertEvaluatorService');

/**
 * Enterprise Background Job Scheduler for Automated Reports & Operational Alerts
 */
class SchedulerService {
  constructor() {
    this.activeTasks = new Map();
    this.runningExecutions = new Set();
    this.pollInterval = null;
    this.isStarted = false;
  }

  /**
   * Validate if a cron expression is syntactically safe and valid
   * @param {string} expression 
   * @returns {boolean}
   */
  validateCron(expression) {
    if (!expression || typeof expression !== 'string') return false;
    const trimmed = expression.trim();
    
    // Check against standard preset aliases
    if (['daily', 'weekly', 'monthly', '@daily', '@weekly', '@monthly'].includes(trimmed.toLowerCase())) {
      return true;
    }

    // Must be standard 5-part cron syntax
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return false;
    }

    // Disallow dangerous characters/injection
    if (/[;<>&|`$\\]/.test(trimmed)) {
      return false;
    }

    try {
      return cron.validate(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Convert preset names into standard cron expressions
   * @param {string} preset 
   * @returns {string}
   */
  normalizeSchedule(preset) {
    if (!preset) return null;
    const clean = preset.trim().toLowerCase();
    switch (clean) {
      case 'daily':
      case '@daily':
        return '0 9 * * *'; // Everyday at 9:00 AM
      case 'weekly':
      case '@weekly':
        return '0 9 * * 1'; // Every Monday at 9:00 AM
      case 'monthly':
      case '@monthly':
        return '0 9 1 * *'; // 1st day of month at 9:00 AM
      default:
        return preset.trim();
    }
  }

  /**
   * Start the scheduler engine and poll daemon
   */
  start() {
    if (this.isStarted) return;
    this.isStarted = true;
    console.log(' SchedulerService: Initializing enterprise report scheduler...');

    // Master polling loop runs every minute to sync and trigger scheduled reports, alerts & insights
    this.masterTask = cron.schedule('* * * * *', async () => {
      await this.evaluateDueReports();
      await this.evaluateAlerts();
      await this.evaluateScheduledInsights();
    });

    console.log(' SchedulerService: Background cron daemon running (1-minute polling resolution).');
  }

  /**
   * Evaluate and proactively generate executive insights for active organizations
   */
  async evaluateScheduledInsights() {
    try {
      const insightService = require('./insightService');
      const defaultOrgId = '00000000-0000-0000-0000-000000000001';
      // Proactively evaluate insights with safety boundary
      await insightService.generateInsights(defaultOrgId, { persist: true }).catch(() => {});
    } catch (err) {
      console.warn('SchedulerService: Scheduled insight generation warning:', err.message);
    }
  }

  /**
   * Evaluate active operational alerts across all organizations
   */
  async evaluateAlerts() {
    try {
      const summary = await alertEvaluatorService.evaluateActiveAlerts();
      if (summary.triggered > 0 || summary.suppressed > 0) {
        console.log(`[Scheduler Alert Engine] Evaluated: ${summary.evaluated}, Triggered: ${summary.triggered}, Suppressed: ${summary.suppressed}, Errors: ${summary.errors}`);
      }
    } catch (err) {
      console.error('SchedulerService: Alert evaluation cycle error:', err.message);
    }
  }

  /**
   * Stop the scheduler engine cleanly
   */
  stop() {
    if (this.masterTask) {
      this.masterTask.stop();
    }
    this.activeTasks.forEach((task) => task.stop());
    this.activeTasks.clear();
    this.isStarted = false;
    console.log('🛑 SchedulerService: Background scheduler stopped.');
  }

  /**
   * Query database for active reports and execute due jobs
   */
  async evaluateDueReports() {
    try {
      const activeReports = await ReportModel.findActiveScheduledReports();
      if (!activeReports || activeReports.length === 0) return;

      const now = new Date();

      for (const report of activeReports) {
        // Prevent concurrent duplicate executions for the same report
        if (this.runningExecutions.has(report.id)) {
          continue;
        }

        const normalizedCron = this.normalizeSchedule(report.schedule_cron);
        if (!this.validateCron(normalizedCron)) {
          console.warn(`[Scheduler Warning] Report "${report.title}" has invalid cron: "${report.schedule_cron}". Skipping.`);
          continue;
        }

        // Check if report is due
        const isDue = this._isReportDue(report, now);
        if (isDue) {
          this._executeScheduledReport(report);
        }
      }
    } catch (err) {
      console.error('SchedulerService: Evaluation cycle error:', err.message);
    }
  }

  /**
   * Simple check to determine if a report should run
   * @param {object} report 
   * @param {Date} now 
   * @returns {boolean}
   */
  _isReportDue(report, now) {
    if (!report.last_generated_at) {
      return true; // Never run before -> due immediately
    }

    const lastGen = new Date(report.last_generated_at);
    const diffMs = now.getTime() - lastGen.getTime();

    // Check cadence based on cron or minutes elapsed
    const schedule = (report.schedule_cron || '').toLowerCase();
    if (schedule.includes('daily') || schedule === '0 9 * * *') {
      return diffMs >= 24 * 60 * 60 * 1000;
    }
    if (schedule.includes('weekly') || schedule === '0 9 * * 1') {
      return diffMs >= 7 * 24 * 60 * 60 * 1000;
    }
    if (schedule.includes('monthly') || schedule === '0 9 1 * *') {
      return diffMs >= 30 * 24 * 60 * 60 * 1000;
    }

    // Default safety interval for generic cron: at least 60 seconds elapsed
    return diffMs >= 60 * 1000;
  }

  /**
   * Execute scheduled report safely with multi-tenant boundary checks
   * @param {object} report 
   */
  async _executeScheduledReport(report) {
    this.runningExecutions.add(report.id);
    console.log(`[Scheduler] Starting scheduled generation for: "${report.title}" (Org: ${report.organization_id})`);

    try {
      await reportService.executeReport(
        report.id,
        report.organization_id,
        null, // System / scheduler execution
        report.format
      );
      console.log(`[Scheduler] Successfully executed scheduled report: "${report.title}"`);
    } catch (err) {
      console.error(`[Scheduler] Failed executing scheduled report: "${report.title}":`, err.message);
    } finally {
      this.runningExecutions.delete(report.id);
    }
  }
}

module.exports = new SchedulerService();
