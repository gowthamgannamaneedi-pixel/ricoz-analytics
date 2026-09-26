/**
 * Centralized Enterprise Role-Based Access Control (RBAC) Permission Matrix
 * Maps application capabilities across Admin, Manager, Analyst, and Viewer roles.
 */

const PERMISSIONS = {
  // Dashboard Permissions
  'dashboard.view': { key: 'dashboard.view', label: 'View Dashboards', category: 'Dashboards' },
  'dashboard.create': { key: 'dashboard.create', label: 'Create Dashboards', category: 'Dashboards' },
  'dashboard.edit': { key: 'dashboard.edit', label: 'Edit Dashboards & Widgets', category: 'Dashboards' },
  'dashboard.delete': { key: 'dashboard.delete', label: 'Delete Dashboards', category: 'Dashboards' },

  // KPI & Metric Permissions
  'metrics.view': { key: 'metrics.view', label: 'View KPIs & Metrics', category: 'Metrics' },
  'metrics.create': { key: 'metrics.create', label: 'Create KPI Metrics', category: 'Metrics' },
  'metrics.edit': { key: 'metrics.edit', label: 'Edit KPI Metrics', category: 'Metrics' },
  'metrics.delete': { key: 'metrics.delete', label: 'Delete KPI Metrics', category: 'Metrics' },

  // Report & Export Permissions
  'reports.view': { key: 'reports.view', label: 'View Scheduled Reports', category: 'Reports' },
  'reports.create': { key: 'reports.create', label: 'Create & Schedule Reports', category: 'Reports' },
  'reports.edit': { key: 'reports.edit', label: 'Update Report Configurations', category: 'Reports' },
  'reports.delete': { key: 'reports.delete', label: 'Delete Reports', category: 'Reports' },
  'reports.run': { key: 'reports.run', label: 'Execute On-Demand Exports (PDF/Excel/CSV)', category: 'Reports' },

  // Operational Alert & Incident Permissions
  'alerts.view': { key: 'alerts.view', label: 'View Alert Rules & Incidents', category: 'Alerts' },
  'alerts.create': { key: 'alerts.create', label: 'Create Threshold Alert Rules', category: 'Alerts' },
  'alerts.edit': { key: 'alerts.edit', label: 'Update Alert Rules', category: 'Alerts' },
  'alerts.delete': { key: 'alerts.delete', label: 'Delete Alert Rules', category: 'Alerts' },
  'alerts.resolve': { key: 'alerts.resolve', label: 'Acknowledge & Resolve Incidents', category: 'Alerts' },

  // Predictive ML & Forecasting Permissions
  'forecasts.view': { key: 'forecasts.view', label: 'View Saved Forecasts', category: 'Forecasts' },
  'forecasts.generate': { key: 'forecasts.generate', label: 'Generate ML Predictions & Anomalies', category: 'Forecasts' },
  'forecasts.delete': { key: 'forecasts.delete', label: 'Delete Forecast Records', category: 'Forecasts' },

  // AI Analytics Assistant Permissions
  'ai.query': { key: 'ai.query', label: 'Execute Natural Language Analytical Queries', category: 'AI Analytics' },
  'ai.history': { key: 'ai.history', label: 'View & Manage AI Conversation Threads', category: 'AI Analytics' },

  // Phase 14: Relational Data Modeling & Dataset Relationships
  'relationships.view': { key: 'relationships.view', label: 'View Dataset Relationships & Schema Models', category: 'Data Modeling' },
  'relationships.create': { key: 'relationships.create', label: 'Create Relational Schema Joins & Links', category: 'Data Modeling' },
  'relationships.edit': { key: 'relationships.edit', label: 'Update Dataset Relationship Definitions', category: 'Data Modeling' },
  'relationships.delete': { key: 'relationships.delete', label: 'Delete Dataset Relationships', category: 'Data Modeling' },
  'relationships.query': { key: 'relationships.query', label: 'Execute Multi-Dataset Relational Queries', category: 'Data Modeling' },

  // Phase 15: Data Quality & Observability
  'quality.view': { key: 'quality.view', label: 'View Data Quality Profiles & Health Scores', category: 'Data Quality' },
  'quality.evaluate': { key: 'quality.evaluate', label: 'Trigger On-Demand Data Quality Audits', category: 'Data Quality' },
  'quality.manage_rules': { key: 'quality.manage_rules', label: 'Create & Manage Data Quality Rules', category: 'Data Quality' },

  // Phase 16: Advanced AI & Automated Insights
  'insights.view': { key: 'insights.view', label: 'View Automated AI Insights & Executive Summaries', category: 'Automated Insights' },
  'insights.generate': { key: 'insights.generate', label: 'Generate On-Demand Executive Insights', category: 'Automated Insights' },
  'insights.manage': { key: 'insights.manage', label: 'Dismiss & Submit Insight Feedback', category: 'Automated Insights' },

  // Phase 17: Enterprise Collaboration & Sharing
  'collaboration.view': { key: 'collaboration.view', label: 'View Shared Resources & Notifications', category: 'Collaboration' },
  'collaboration.share': { key: 'collaboration.share', label: 'Share Dashboards, Reports & Insights', category: 'Collaboration' },
  'collaboration.manage': { key: 'collaboration.manage', label: 'Manage Sharing Permissions & Revocations', category: 'Collaboration' },
  'collaboration.comment': { key: 'collaboration.comment', label: 'Post Comments, Replies & @Mentions', category: 'Collaboration' },
  'collaboration.manage_teams': { key: 'collaboration.manage_teams', label: 'Create & Manage Workspace Teams', category: 'Collaboration' },
  'collaboration.manage_saved_views': { key: 'collaboration.manage_saved_views', label: 'Create & Manage Saved Views', category: 'Collaboration' },

  // Datasets & Data Ingestion Permissions
  'datasets.view': { key: 'datasets.view', label: 'View Datasets & Previews', category: 'Datasets' },
  'datasets.create': { key: 'datasets.create', label: 'Ingest & Upload Datasets', category: 'Datasets' },
  'datasets.delete': { key: 'datasets.delete', label: 'Delete Datasets & Associated Data', category: 'Datasets' },

  // Governance & Workspace Administration Permissions
  'users.view': { key: 'users.view', label: 'View Workspace Team Members', category: 'Administration' },
  'users.manage': { key: 'users.manage', label: 'Manage User Roles & Status', category: 'Administration' },
  'organization.manage': { key: 'organization.manage', label: 'Update Organization Settings', category: 'Administration' },
  'audit.view': { key: 'audit.view', label: 'View Workspace Audit & Activity Logs', category: 'Administration' },
  'settings.manage': { key: 'settings.manage', label: 'Manage Governance & Security Policies', category: 'Administration' }
};

const ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS),
  manager: [
    'datasets.view', 'datasets.create', 'datasets.delete',
    'dashboard.view', 'dashboard.create', 'dashboard.edit', 'dashboard.delete',
    'metrics.view', 'metrics.create', 'metrics.edit', 'metrics.delete',
    'reports.view', 'reports.create', 'reports.edit', 'reports.delete', 'reports.run',
    'alerts.view', 'alerts.create', 'alerts.edit', 'alerts.delete', 'alerts.resolve',
    'forecasts.view', 'forecasts.generate', 'forecasts.delete',
    'ai.query', 'ai.history',
    'relationships.view', 'relationships.create', 'relationships.edit', 'relationships.delete', 'relationships.query',
    'quality.view', 'quality.evaluate', 'quality.manage_rules',
    'insights.view', 'insights.generate', 'insights.manage',
    'collaboration.view', 'collaboration.share', 'collaboration.manage', 'collaboration.comment', 'collaboration.manage_teams', 'collaboration.manage_saved_views',
    'users.view', 'audit.view'
  ],
  analyst: [
    'datasets.view', 'datasets.create',
    'dashboard.view', 'dashboard.create', 'dashboard.edit',
    'metrics.view', 'metrics.create', 'metrics.edit',
    'reports.view', 'reports.create', 'reports.run',
    'alerts.view', 'alerts.create', 'alerts.resolve',
    'forecasts.view', 'forecasts.generate',
    'ai.query', 'ai.history',
    'relationships.view', 'relationships.create', 'relationships.edit', 'relationships.query',
    'quality.view', 'quality.evaluate', 'quality.manage_rules',
    'insights.view', 'insights.generate', 'insights.manage',
    'collaboration.view', 'collaboration.share', 'collaboration.comment', 'collaboration.manage_saved_views',
    'users.view'
  ],
  viewer: [
    'datasets.view',
    'dashboard.view',
    'metrics.view',
    'reports.view',
    'alerts.view',
    'forecasts.view',
    'ai.query',
    'relationships.view',
    'relationships.query',
    'quality.view',
    'insights.view',
    'collaboration.view',
    'collaboration.comment',
    'collaboration.manage_saved_views'
  ]
};

/**
 * Check if a role possesses a specific permission key
 * @param {string} role 
 * @param {string} permissionKey 
 * @returns {boolean}
 */
function hasPermission(role, permissionKey) {
  const cleanRole = (role || 'viewer').toLowerCase();
  if (cleanRole === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[cleanRole] || [];

  if (permissions.includes(permissionKey)) return true;

  // Normalize colon <-> dot and action synonyms (read->view, update->edit)
  const normalizedKey = permissionKey
    .replace(':', '.')
    .replace('.read', '.view')
    .replace('.update', '.edit');

  if (permissions.includes(normalizedKey)) return true;

  const dotToColon = permissionKey.replace('.', ':');
  if (permissions.includes(dotToColon)) return true;

  return false;
}

/**
 * Get all permissions for a role
 * @param {string} role 
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  const cleanRole = (role || 'viewer').toLowerCase();
  return ROLE_PERMISSIONS[cleanRole] || ROLE_PERMISSIONS.viewer;
}

/**
 * Return full permission matrix schema with categories
 */
function getFullPermissionMatrix() {
  const categories = {};
  
  Object.values(PERMISSIONS).forEach(perm => {
    if (!categories[perm.category]) {
      categories[perm.category] = [];
    }

    categories[perm.category].push({
      key: perm.key,
      label: perm.label,
      roles: {
        admin: hasPermission('admin', perm.key),
        manager: hasPermission('manager', perm.key),
        analyst: hasPermission('analyst', perm.key),
        viewer: hasPermission('viewer', perm.key)
      }
    });
  });

  return {
    permissions: PERMISSIONS,
    roles: ROLE_PERMISSIONS,
    matrix: categories
  };
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getPermissionsForRole,
  getFullPermissionMatrix
};
