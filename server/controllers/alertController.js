const AlertModel = require('../models/alertModel');
const alertEvaluatorService = require('../services/alertEvaluatorService');
const emailService = require('../services/emailService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

const VALID_CONDITIONS = [
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'equal',
  'equals',
  'not_equal',
  'not_equals',
  'percent_increase',
  'percentage_change_increase',
  'percent_decrease',
  'percentage_change_decrease',
  '>',
  '<',
  '>=',
  '<=',
  '=',
  '!='
];

function normalizeCondition(cond) {
  if (!cond || typeof cond !== 'string') return '';
  const c = cond.trim().toLowerCase();
  if (c === '>' || c === 'gt') return 'greater_than';
  if (c === '<' || c === 'lt') return 'less_than';
  if (c === '>=' || c === 'gte' || c === 'greater_than_equal') return 'greater_than_or_equal';
  if (c === '<=' || c === 'lte' || c === 'less_than_equal') return 'less_than_or_equal';
  if (c === '=' || c === '==' || c === 'eq' || c === 'equals') return 'equal';
  if (c === '!=' || c === '<>' || c === 'neq' || c === 'not_equals') return 'not_equal';
  if (c === 'percent_increase' || c === 'percentage_change_increase') return 'percent_increase';
  if (c === 'percent_decrease' || c === 'percentage_change_decrease') return 'percent_decrease';
  return c;
}

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['active', 'triggered', 'resolved', 'disabled'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Real-Time Alerts & Operational Incident Center Controller
 */
const AlertController = {
  /**
   * GET /api/alerts
   * List all alert rules for the user's organization
   */
  async getAlerts(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const alerts = await AlertModel.findByOrganizationId(organizationId);
      res.json({
        success: true,
        data: alerts
      });
    } catch (err) {
      console.error('Error fetching alerts:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve alert rules.' });
    }
  },

  /**
   * GET /api/alerts/summary
   * Summary operational metrics for overview cards
   */
  async getSummary(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const summary = await AlertModel.getSummaryCounts(organizationId);
      res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      console.error('Error fetching alert summary:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve alert summary metrics.' });
    }
  },

  /**
   * GET /api/alerts/:id
   * Get single alert rule by ID
   */
  async getAlertById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const alert = await AlertModel.findByIdAndOrgId(id, organizationId);
      if (!alert) {
        return res.status(404).json({ success: false, message: 'Alert rule not found or inaccessible.' });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (err) {
      console.error('Error fetching alert by ID:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve alert details.' });
    }
  },

  /**
   * POST /api/alerts
   * Create a new alert rule
   * RBAC: Admin, Manager, Analyst
   */
  async createAlert(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const createdBy = req.user.id;
      const {
        name,
        metricId,
        metric_id,
        datasetId,
        dataset_id,
        condition,
        threshold,
        severity = 'medium',
        status = 'active',
        notificationChannels,
        notification_channels,
        cooldownMinutes,
        cooldown_minutes,
        recipients = []
      } = req.body;

      // 1. Validation: Name
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Alert name is required.' });
      }

      // 2. Validation: Condition
      const cleanCondition = normalizeCondition(condition);
      if (!cleanCondition || !VALID_CONDITIONS.includes(cleanCondition)) {
        return res.status(400).json({
          success: false,
          message: `Invalid alert condition "${condition}". Supported conditions: ${VALID_CONDITIONS.join(', ')}.`
        });
      }

      // 3. Validation: Threshold
      if (threshold === undefined || threshold === null || isNaN(Number(threshold))) {
        return res.status(400).json({ success: false, message: 'A valid numeric threshold value is required.' });
      }

      // 4. Validation: Notification Delay (Cooldown Minutes)
      const rawCooldown = cooldownMinutes !== undefined ? cooldownMinutes : cooldown_minutes;
      let cleanCooldown = 60;
      if (rawCooldown !== undefined && rawCooldown !== null) {
        const cd = Number(rawCooldown);
        if (isNaN(cd) || cd < 0 || !Number.isInteger(cd)) {
          return res.status(400).json({
            success: false,
            message: 'Notification delay (cooldown_minutes) must be a non-negative integer (0 or more minutes).'
          });
        }
        cleanCooldown = cd;
      }

      // 5. Validation: Severity
      const cleanSeverity = (severity || 'medium').trim().toLowerCase();
      if (!VALID_SEVERITIES.includes(cleanSeverity)) {
        return res.status(400).json({
          success: false,
          message: `Invalid severity "${severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}.`
        });
      }

      // 6. Validation: Status
      const cleanStatus = (status || 'active').trim().toLowerCase();
      if (!VALID_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}.`
        });
      }

      // 7. Validation: Channels & Recipients
      const cleanChannels = Array.isArray(notificationChannels || notification_channels)
        ? (notificationChannels || notification_channels)
        : ['in_app'];

      const cleanRecipients = (Array.isArray(recipients) ? recipients : [])
        .map(r => typeof r === 'string' ? r.trim().toLowerCase() : '')
        .filter(Boolean);

      if (cleanChannels.includes('email') && cleanRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one valid recipient email address is required when email notifications are enabled.'
        });
      }

      for (const email of cleanRecipients) {
        if (!EMAIL_REGEX.test(email)) {
          return res.status(400).json({
            success: false,
            message: `Invalid recipient email address: "${email}".`
          });
        }
      }

      // Auto-resolve datasetId from metric if metricId is passed and datasetId is omitted
      let resolvedDatasetId = datasetId || dataset_id || null;
      const targetMetricId = metricId || metric_id || null;
      if (!resolvedDatasetId && targetMetricId) {
        const MetricModel = require('../models/metricModel');
        const m = await MetricModel.findByIdAndOrgId(targetMetricId, organizationId).catch(() => null);
        if (m && m.dataset_id) {
          resolvedDatasetId = m.dataset_id;
        }
      }

      const alert = await AlertModel.create({
        organizationId,
        createdBy,
        metricId: targetMetricId,
        datasetId: resolvedDatasetId,
        name: name.trim(),
        condition: cleanCondition,
        threshold: Number(threshold),
        severity: cleanSeverity,
        status: cleanStatus,
        notificationChannels: cleanChannels,
        cooldownMinutes: cleanCooldown,
        recipients: cleanRecipients
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: createdBy,
        action: AUDIT_ACTIONS.ALERT_CREATED,
        resourceType: 'alert',
        resourceId: alert.id,
        description: `Alert rule "${alert.name}" created (condition: ${cleanCondition}, threshold: ${threshold})`,
        metadata: { name: alert.name, condition: cleanCondition, threshold: Number(threshold), severity: cleanSeverity },
        req
      });

      res.status(201).json({
        success: true,
        message: 'Alert rule created successfully.',
        data: alert
      });
    } catch (err) {
      console.error('Error creating alert:', err.message);
      res.status(500).json({ success: false, message: 'Failed to create alert rule.' });
    }
  },

  /**
   * PUT /api/alerts/:id
   * Update an existing alert rule
   * RBAC: Admin, Manager, Analyst
   */
  async updateAlert(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const existing = await AlertModel.findByIdAndOrgId(id, organizationId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Alert rule not found or inaccessible.' });
      }

      const {
        name,
        metricId,
        metric_id,
        datasetId,
        dataset_id,
        condition,
        threshold,
        severity,
        status,
        notificationChannels,
        notification_channels,
        cooldownMinutes,
        cooldown_minutes,
        recipients
      } = req.body;

      let cleanCondition = undefined;
      if (condition !== undefined) {
        cleanCondition = normalizeCondition(condition);
        if (!cleanCondition || !VALID_CONDITIONS.includes(cleanCondition)) {
          return res.status(400).json({
            success: false,
            message: `Invalid alert condition "${condition}". Supported conditions: ${VALID_CONDITIONS.join(', ')}.`
          });
        }
      }

      if (threshold !== undefined && isNaN(Number(threshold))) {
        return res.status(400).json({ success: false, message: 'Threshold must be a valid numeric value.' });
      }

      const rawCooldown = cooldownMinutes !== undefined ? cooldownMinutes : cooldown_minutes;
      let cleanCooldown = undefined;
      if (rawCooldown !== undefined && rawCooldown !== null) {
        const cd = Number(rawCooldown);
        if (isNaN(cd) || cd < 0 || !Number.isInteger(cd)) {
          return res.status(400).json({
            success: false,
            message: 'Notification delay (cooldown_minutes) must be a non-negative integer (0 or more minutes).'
          });
        }
        cleanCooldown = cd;
      }

      if (severity !== undefined && !VALID_SEVERITIES.includes(severity.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid severity "${severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}.`
        });
      }

      if (status !== undefined && !VALID_STATUSES.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}.`
        });
      }

      let cleanRecipients = undefined;
      if (recipients !== undefined && Array.isArray(recipients)) {
        cleanRecipients = recipients
          .map(r => typeof r === 'string' ? r.trim().toLowerCase() : '')
          .filter(Boolean);

        for (const email of cleanRecipients) {
          if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
              success: false,
              message: `Invalid recipient email address: "${email}".`
            });
          }
        }
      }

      const cleanChannels = notificationChannels !== undefined 
        ? notificationChannels 
        : (notification_channels !== undefined ? notification_channels : undefined);

      const effectiveChannels = cleanChannels || existing.notification_channels || ['in_app'];
      const effectiveRecipients = cleanRecipients !== undefined ? cleanRecipients : (existing.recipients || []);

      if (effectiveChannels.includes('email') && effectiveRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one valid recipient email address is required when email notifications are enabled.'
        });
      }

      const updated = await AlertModel.update(id, organizationId, {
        name,
        metricId: metricId !== undefined ? metricId : metric_id,
        datasetId: datasetId !== undefined ? datasetId : dataset_id,
        condition: cleanCondition,
        threshold,
        severity,
        status,
        notificationChannels: cleanChannels,
        cooldownMinutes: cleanCooldown,
        recipients: cleanRecipients
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.ALERT_UPDATED,
        resourceType: 'alert',
        resourceId: id,
        description: `Alert rule "${updated.name}" updated`,
        metadata: { name: updated.name, condition: updated.condition, threshold: updated.threshold },
        req
      });

      res.json({
        success: true,
        message: 'Alert rule updated successfully.',
        data: updated
      });
    } catch (err) {
      console.error('Error updating alert:', err.message);
      res.status(500).json({ success: false, message: 'Failed to update alert rule.' });
    }
  },

  /**
   * DELETE /api/alerts/:id
   * Delete an alert rule
   * RBAC: Admin, Manager (Analyst returns 403)
   */
  async deleteAlert(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const existing = await AlertModel.findByIdAndOrgId(id, organizationId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Alert rule not found or inaccessible.' });
      }

      const deleted = await AlertModel.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Alert rule not found.' });
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.ALERT_DELETED,
        resourceType: 'alert',
        resourceId: id,
        description: `Alert rule "${existing.name}" (ID: ${id}) deleted`,
        metadata: { alertId: id, name: existing.name },
        req
      });

      res.json({
        success: true,
        message: 'Alert rule deleted successfully.'
      });
    } catch (err) {
      console.error('Error deleting alert:', err.message);
      res.status(500).json({ success: false, message: 'Failed to delete alert rule.' });
    }
  },

  /**
   * POST /api/alerts/:id/test
   * Test evaluate an alert rule immediately
   * RBAC: Admin, Manager, Analyst (Viewer returns 403)
   */
  async testAlert(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const { overrideMetricValue, baselineValue, dryRun = true, sendEmail = false } = req.body || {};

      const alert = await AlertModel.findByIdAndOrgId(id, organizationId);
      if (!alert) {
        return res.status(404).json({ success: false, message: 'Alert rule not found or inaccessible.' });
      }

      const evalResult = await alertEvaluatorService.evaluateAlertRule(alert, {
        overrideMetricValue,
        baselineValue,
        dryRun: dryRun !== false,
        sendEmail: Boolean(sendEmail)
      });

      res.json({
        success: true,
        message: evalResult.triggered ? 'Alert condition evaluated to TRUE (breach detected).' : 'Alert condition evaluated to FALSE (normal threshold).',
        data: evalResult
      });
    } catch (err) {
      console.error('Error testing alert evaluation:', err.message);
      res.status(500).json({ success: false, message: `Failed to test alert: ${err.message}` });
    }
  },

  // ============================================================================
  // INCIDENT MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * GET /api/alerts/incidents/all
   * Retrieve operational incident logs for the organization
   */
  async getAllIncidents(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { status, severity, limit, offset } = req.query;

      const incidents = await AlertModel.findIncidentsByOrganizationId(organizationId, {
        status,
        severity,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0
      });

      res.json({
        success: true,
        data: incidents
      });
    } catch (err) {
      console.error('Error retrieving incidents:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve incident logs.' });
    }
  },

  /**
   * GET /api/alerts/:id/incidents
   * Get incidents for a specific alert
   */
  async getAlertIncidents(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const alert = await AlertModel.findByIdAndOrgId(id, organizationId);
      if (!alert) {
        return res.status(404).json({ success: false, message: 'Alert rule not found.' });
      }

      const incidents = await AlertModel.findIncidentsByAlertId(id, organizationId);
      res.json({
        success: true,
        data: incidents
      });
    } catch (err) {
      console.error('Error retrieving alert incidents:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve alert incidents.' });
    }
  },

  /**
   * PUT /api/alerts/incidents/:id/acknowledge
   * Acknowledge an operational incident
   * RBAC: Admin, Manager, Analyst (Viewer returns 403)
   */
  async acknowledgeIncident(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const userId = req.user.id;

      const incident = await AlertModel.findIncidentByIdAndOrgId(id, organizationId);
      if (!incident) {
        return res.status(404).json({ success: false, message: 'Incident not found or inaccessible.' });
      }

      if (incident.status === 'resolved') {
        return res.status(400).json({ success: false, message: 'Incident is already resolved.' });
      }

      const updated = await AlertModel.acknowledgeIncident(id, organizationId, userId);

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.ALERT_ACKNOWLEDGED,
        resourceType: 'incident',
        resourceId: id,
        description: `Operational incident (ID: ${id}) acknowledged`,
        metadata: { incidentId: id },
        req
      });

      res.json({
        success: true,
        message: 'Incident acknowledged successfully.',
        data: updated || { ...incident, status: 'acknowledged' }
      });
    } catch (err) {
      console.error('Error acknowledging incident:', err.message);
      res.status(500).json({ success: false, message: 'Failed to acknowledge incident.' });
    }
  },

  /**
   * PUT /api/alerts/incidents/:id/resolve
   * Resolve an operational incident with resolution notes
   * RBAC: Admin, Manager, Analyst (Viewer returns 403)
   */
  async resolveIncident(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const { resolutionNotes, notes } = req.body || {};

      const incident = await AlertModel.findIncidentByIdAndOrgId(id, organizationId);
      if (!incident) {
        return res.status(404).json({ success: false, message: 'Incident not found or inaccessible.' });
      }

      const updated = await AlertModel.resolveIncident(
        id,
        organizationId,
        userId,
        resolutionNotes || notes || 'Resolved by operational team'
      );

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.ALERT_RESOLVED,
        resourceType: 'incident',
        resourceId: id,
        description: `Operational incident (ID: ${id}) resolved with notes: ${resolutionNotes || notes || 'Resolved'}`,
        metadata: { incidentId: id, notes: resolutionNotes || notes },
        req
      });

      res.json({
        success: true,
        message: 'Incident resolved successfully.',
        data: updated || { ...incident, status: 'resolved', resolved_by: userId, resolution_notes: resolutionNotes || notes }
      });
    } catch (err) {
      console.error('Error resolving incident:', err.message);
      res.status(500).json({ success: false, message: 'Failed to resolve incident.' });
    }
  },

  /**
   * GET /api/alerts/incidents/:id/delivery
   * Check real-time notification delivery status from provider (e.g. Brevo)
   */
  async getIncidentDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const incident = await AlertModel.findIncidentByIdAndOrgId(id, organizationId);
      if (!incident) {
        return res.status(404).json({ success: false, message: 'Incident not found or inaccessible.' });
      }

      const delivery = typeof incident.notification_delivery === 'string'
        ? JSON.parse(incident.notification_delivery || '{}')
        : (incident.notification_delivery || {});

      let liveStatus = {
        incidentId: id,
        severity: incident.severity,
        status: incident.status,
        inApp: delivery.in_app || { created: true },
        email: delivery.email || null,
        providerEvents: []
      };

      if (delivery.email?.messageId && emailService.isBrevo()) {
        try {
          const logs = await emailService.getBrevoTransactionalLogs({ messageId: delivery.email.messageId });
          liveStatus.providerEvents = logs.events || [];
          const deliveredEvent = logs.events?.find(e => e.event === 'delivered');
          if (deliveredEvent && !delivery.email.delivered) {
            delivery.email.delivered = true;
            delivery.email.deliveredAt = deliveredEvent.date;
            await AlertModel.updateIncidentNotificationDelivery(id, delivery);
          }
        } catch (logErr) {
          console.warn(`[AlertController] Could not fetch live Brevo delivery log: ${logErr.message}`);
        }
      }

      res.json({
        success: true,
        data: liveStatus
      });
    } catch (err) {
      console.error('Error fetching delivery status:', err.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve delivery status.' });
    }
  },

  /**
   * POST /api/alerts/incidents/:id/retry-email
   * Retry email notification dispatch for an incident with idempotency safeguard
   * RBAC: Admin, Manager, Analyst
   */
  async retryIncidentNotification(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const incident = await AlertModel.findIncidentByIdAndOrgId(id, organizationId);
      if (!incident) {
        return res.status(404).json({ success: false, message: 'Incident not found or inaccessible.' });
      }

      const delivery = typeof incident.notification_delivery === 'string'
        ? JSON.parse(incident.notification_delivery || '{}')
        : (incident.notification_delivery || {});

      // Idempotency: Prevent duplicate dispatch if already confirmed delivered
      if (delivery.email?.delivered) {
        return res.status(400).json({
          success: false,
          message: 'Email notification has already been confirmed delivered. Duplicate dispatch prevented.'
        });
      }

      // Fetch the parent alert rule for latest recipients and channels
      const alert = await AlertModel.findByIdAndOrgId(incident.alert_id, organizationId);
      if (!alert) {
        return res.status(404).json({ success: false, message: 'Associated alert rule not found.' });
      }

      const recipients = Array.isArray(alert.recipients)
        ? alert.recipients
        : (typeof alert.recipients === 'string' ? JSON.parse(alert.recipients || '[]') : []);

      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: 'No recipients configured on this alert rule.' });
      }

      let emailResult = null;
      try {
        emailResult = await emailService.sendAlertEmail({
          recipients,
          alertTitle: `[RETRY] ${alert.name}`,
          metricName: alert.metric_name || incident.metric_name || 'Operational KPI',
          metricValue: incident.metric_value,
          thresholdValue: incident.threshold_value,
          condition: incident.condition,
          severity: incident.severity || 'medium',
          organizationName: req.organization?.name || 'Ricoz Analytics Workspace',
          triggeredAt: incident.triggered_at || new Date()
        });
      } catch (sendErr) {
        emailResult = { attempted: true, success: false, error: sendErr.message };
      }

      delivery.email = {
        ...emailResult,
        retriedAt: new Date().toISOString()
      };

      await AlertModel.updateIncidentNotificationDelivery(id, delivery);

      res.json({
        success: emailResult.success,
        message: emailResult.success ? 'Email notification re-dispatched successfully.' : `Retry dispatch failed: ${emailResult.error}`,
        data: delivery
      });
    } catch (err) {
      console.error('Error retrying incident email:', err.message);
      res.status(500).json({ success: false, message: `Failed to retry email: ${err.message}` });
    }
  }
};

module.exports = AlertController;
