const AuditLogModel = require('../models/auditLogModel');

/**
 * Enterprise Audit Logging Service
 * Provides multi-tenant, tamper-resistant, safe audit event recording.
 * Automatically scrubs sensitive attributes (passwords, tokens, API keys).
 */

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'passwordhash',
  'pwd',
  'token',
  'jwt',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'credit_card'
];

/**
 * Recursively sanitize metadata to remove sensitive credentials
 * @param {any} data 
 * @returns {any}
 */
function sanitizeMetadata(data) {
  if (!data) return {};
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeMetadata(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sens => lowerKey.includes(sens));

    if (isSensitive) {
      cleaned[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      cleaned[key] = sanitizeMetadata(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Log an audit event safely without breaking business flow on error
 * @param {{
 *   organizationId: string,
 *   userId?: number|string|null,
 *   action: string,
 *   resourceType: string,
 *   resourceId?: string|number|null,
 *   description: string,
 *   metadata?: any,
 *   ipAddress?: string|null,
 *   userAgent?: string|null,
 *   req?: any
 * }} options
 * @returns {Promise<any | null>}
 */
async function logAuditEvent({
  organizationId,
  userId = null,
  action,
  resourceType,
  resourceId = null,
  description,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  req = null
}) {
  try {
    if (!organizationId) {
      console.warn('[AuditService] Skipping audit log: Missing organizationId');
      return null;
    }

    // Extract network info from express request object if provided
    let ip = ipAddress;
    let ua = userAgent;
    let actorId = userId;

    if (req) {
      if (!ip) {
        ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
      }
      if (!ua) {
        ua = req.headers['user-agent'] || null;
      }
      if (!actorId && req.user) {
        actorId = req.user.id;
      }
    }

    const safeMeta = sanitizeMetadata(metadata);

    const logEntry = await AuditLogModel.create({
      organizationId,
      userId: actorId,
      action: (action || 'UNKNOWN_ACTION').toUpperCase(),
      resourceType: (resourceType || 'system').toLowerCase(),
      resourceId,
      description: description || `Action ${action} performed on ${resourceType}`,
      metadata: safeMeta,
      ipAddress: ip,
      userAgent: ua
    });

    return logEntry;
  } catch (error) {
    // Fail-safe: Audit logging failure must NEVER crash caller business logic
    console.error(`[AuditService Error] Failed to log audit event "${action}":`, error.message);
    return null;
  }
}

/**
 * Standard audit event action constants
 */
const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTERED: 'USER_REGISTERED',
  
  // User Management
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  USER_CREATED: 'USER_CREATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',

  // Organization
  ORGANIZATION_UPDATED: 'ORGANIZATION_UPDATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',

  // Dashboards
  DASHBOARD_CREATED: 'DASHBOARD_CREATED',
  DASHBOARD_UPDATED: 'DASHBOARD_UPDATED',
  DASHBOARD_DELETED: 'DASHBOARD_DELETED',

  // Metrics
  METRIC_CREATED: 'METRIC_CREATED',
  METRIC_UPDATED: 'METRIC_UPDATED',
  METRIC_DELETED: 'METRIC_DELETED',

  // Reports
  REPORT_CREATED: 'REPORT_CREATED',
  REPORT_UPDATED: 'REPORT_UPDATED',
  REPORT_DELETED: 'REPORT_DELETED',
  REPORT_RUN: 'REPORT_RUN',

  // Alerts
  ALERT_CREATED: 'ALERT_CREATED',
  ALERT_UPDATED: 'ALERT_UPDATED',
  ALERT_DELETED: 'ALERT_DELETED',
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',

  // Forecasts
  FORECAST_GENERATED: 'FORECAST_GENERATED',
  FORECAST_DELETED: 'FORECAST_DELETED',

  // AI
  AI_QUERY: 'AI_QUERY',
  AI_CONVERSATION_DELETED: 'AI_CONVERSATION_DELETED',

  // Phase 14: Relational Data Modeling
  DATASET_RELATIONSHIP_CREATED: 'DATASET_RELATIONSHIP_CREATED',
  DATASET_RELATIONSHIP_UPDATED: 'DATASET_RELATIONSHIP_UPDATED',
  DATASET_RELATIONSHIP_DELETED: 'DATASET_RELATIONSHIP_DELETED',
  RELATIONAL_QUERY_EXECUTED: 'RELATIONAL_QUERY_EXECUTED',

  // Phase 15: Data Quality & Observability
  DATA_QUALITY_CHECKED: 'DATA_QUALITY_CHECKED',
  DATA_QUALITY_RULE_CREATED: 'DATA_QUALITY_RULE_CREATED',
  DATA_QUALITY_RULE_UPDATED: 'DATA_QUALITY_RULE_UPDATED',
  DATA_QUALITY_RULE_DELETED: 'DATA_QUALITY_RULE_DELETED',
  DATA_QUALITY_ISSUE_DETECTED: 'DATA_QUALITY_ISSUE_DETECTED',
  SCHEMA_CHANGE_DETECTED: 'SCHEMA_CHANGE_DETECTED',

  // Phase 16: Advanced AI & Automated Insights
  INSIGHTS_GENERATED: 'INSIGHTS_GENERATED',
  INSIGHT_DISMISSED: 'INSIGHT_DISMISSED',
  INSIGHT_FEEDBACK_SUBMITTED: 'INSIGHT_FEEDBACK_SUBMITTED',
  EXECUTIVE_SUMMARY_GENERATED: 'EXECUTIVE_SUMMARY_GENERATED'
};

module.exports = {
  logAuditEvent,
  log: logAuditEvent,
  sanitizeMetadata,
  AUDIT_ACTIONS
};
