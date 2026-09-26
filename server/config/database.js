const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const config = require('./index');

let pool = null;
let useFallbackStore = false;

// Pre-compute default password hashes for test accounts
const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
const managerPasswordHash = bcrypt.hashSync('manager123', 10);
const analystPasswordHash = bcrypt.hashSync('analyst123', 10);
const viewerPasswordHash = bcrypt.hashSync('viewer123', 10);

// In-memory fallback stores for dev/testing when PostgreSQL server is not connected
const fallbackOrganizations = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Ricoz Primary Organization',
    slug: 'ricoz-primary',
    plan: 'enterprise',
    settings: { isDefault: true },
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Beta Global Enterprises',
    slug: 'beta-global',
    plan: 'enterprise',
    settings: { isDefault: false },
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextOrgId = 3;

const fallbackUsers = [
  {
    id: 1,
    name: 'Gowtham (Admin)',
    email: 'admin@ricoz.test',
    password_hash: defaultPasswordHash,
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    last_login_at: new Date('2026-09-25T08:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 2,
    name: 'Enterprise Manager',
    email: 'manager@ricoz.test',
    password_hash: managerPasswordHash,
    password_hash_alt: defaultPasswordHash,
    role: 'manager',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    last_login_at: new Date('2026-09-24T12:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 3,
    name: 'Data Analyst',
    email: 'analyst@ricoz.test',
    password_hash: analystPasswordHash,
    password_hash_alt: defaultPasswordHash,
    role: 'analyst',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    last_login_at: new Date('2026-09-23T15:30:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 4,
    name: 'Business Viewer',
    email: 'viewer@ricoz.test',
    password_hash: viewerPasswordHash,
    password_hash_alt: defaultPasswordHash,
    role: 'viewer',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    last_login_at: new Date('2026-09-20T09:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 5,
    name: 'Gowtham Gannamaneedi',
    email: 'gowthamgannamaneedi@gmail.com',
    password_hash: defaultPasswordHash,
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    last_login_at: new Date('2026-09-25T08:30:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 10,
    name: 'Tenant B Admin',
    email: 'admin_b@other.test',
    password_hash: defaultPasswordHash,
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000002',
    status: 'active',
    last_login_at: new Date('2026-09-25T08:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 11,
    name: 'Tenant B Viewer',
    email: 'viewer_b@other.test',
    password_hash: viewerPasswordHash,
    password_hash_alt: defaultPasswordHash,
    role: 'viewer',
    organization_id: '00000000-0000-0000-0000-000000000002',
    status: 'active',
    last_login_at: new Date('2026-09-25T08:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 99,
    name: 'Tenant B Secondary Admin',
    email: 'tenantb@other.test',
    password_hash: defaultPasswordHash,
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000002',
    status: 'active',
    last_login_at: new Date('2026-09-25T08:00:00Z'),
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextUserId = 100;

const fallbackDataSources = [];
let nextDataSourceId = 1;

const sampleDataset1Schema = [
  { name: 'order_id', type: 'string' },
  { name: 'region', type: 'string' },
  { name: 'category', type: 'string' },
  { name: 'channel', type: 'string' },
  { name: 'product', type: 'string' },
  { name: 'sales_amount', type: 'number' },
  { name: 'units_sold', type: 'number' },
  { name: 'profit', type: 'number' },
  { name: 'is_discounted', type: 'boolean' },
  { name: 'order_date', type: 'date' }
];

const fallbackDatasets = [
  {
    id: 1,
    user_id: 1,
    data_source_id: null,
    organization_id: '00000000-0000-0000-0000-000000000001',
    name: 'Indian Enterprise Sales Telemetry (Q4)',
    description: 'Enterprise sales transactions across Indian hubs, channels, and product categories',
    file_path: '1/sample_sales_q4.csv',
    row_count: 20,
    column_count: 10,
    schema: JSON.stringify(sampleDataset1Schema),
    created_at: new Date('2026-01-15T10:30:00Z'),
    updated_at: new Date('2026-01-15T10:30:00Z')
  }
];
let nextDatasetId = 2;

const fallbackMetrics = [];
let nextMetricId = 1;

const fallbackDashboards = [];
let nextDashboardId = 1;

const fallbackDashboardWidgets = [];
let nextWidgetId = 1;

const fallbackReports = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    created_by: '1',
    dashboard_id: null,
    title: 'Q4 Indian Enterprise Revenue Digest',
    description: 'Weekly financial telemetry, regional breakdown, and quota velocity.',
    format: 'pdf',
    schedule_cron: '0 9 * * 1',
    recipients: ['exec@ricoz.in', 'finance@ricoz.in'],
    last_generated_at: new Date(Date.now() - 3600000 * 24),
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    organization_id: '00000000-0000-0000-0000-000000000001',
    created_by: '1',
    dashboard_id: null,
    title: 'Dataset Raw Transaction Stream (Monthly)',
    description: 'Complete multi-sheet transactional telemetry for audit compliance.',
    format: 'excel',
    schedule_cron: '0 9 1 * *',
    recipients: ['compliance@ricoz.in'],
    last_generated_at: new Date(Date.now() - 3600000 * 72),
    status: 'active',
    created_at: new Date('2026-01-02T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z')
  }
];
let nextReportId = 3;

const fallbackReportExecutions = [];
let nextExecutionId = 1;

const fallbackAlerts = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    created_by: '1',
    metric_id: null,
    dataset_id: null,
    name: 'Quarterly Revenue Minimum Threshold',
    condition: 'less_than',
    threshold: 100000,
    severity: 'critical',
    status: 'active',
    notification_channels: ['in_app', 'email'],
    cooldown_minutes: 60,
    recipients: ['finance@ricoz.in'],
    last_triggered_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextAlertId = 2;

const fallbackAlertIncidents = [];
let nextAlertIncidentId = 1;

const fallbackForecasts = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    dataset_id: null,
    metric_id: null,
    created_by: '1',
    target_column: 'revenue',
    date_column: 'date',
    horizon_periods: 30,
    interval: 'daily',
    model_name: 'holt_winters',
    predictions: [
      { date: '2026-04-01', predicted: 10450.5, lower_bound: 9800.0, upper_bound: 11101.0 }
    ],
    confidence_intervals: { '95': [] },
    metrics: { mae: 120.4, rmse: 154.2, mape: 3.2, r2: 0.94 },
    anomalies: [],
    status: 'completed',
    error_message: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextForecastId = 2;

const fallbackAiConversations = [];
let nextAiConvId = 1;

const fallbackAiMessages = [];
let nextAiMsgId = 1;

const fallbackAuditLogs = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    user_id: 1,
    action: 'SYSTEM_INITIALIZATION',
    resource_type: 'organization',
    resource_id: '00000000-0000-0000-0000-000000000001',
    description: 'Ricoz Primary Organization initialized with enterprise governance policies.',
    metadata: { environment: 'production', tier: 'enterprise' },
    ip_address: '127.0.0.1',
    user_agent: 'RicozSystemBootstrap/1.0',
    created_at: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    organization_id: '00000000-0000-0000-0000-000000000001',
    user_id: 1,
    action: 'USER_LOGIN',
    resource_type: 'auth',
    resource_id: '1',
    description: 'Admin user logged into enterprise console.',
    metadata: { authProvider: 'internal_jwt' },
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    created_at: new Date('2026-09-25T08:00:00Z')
  }
];
let nextAuditLogId = 3;

const fallbackRelationships = [];
let nextRelationshipId = 1;

const fallbackQualitySnapshots = [];
let nextQualitySnapshotId = 1;

const fallbackQualityRules = [];
let nextQualityRuleId = 1;

const fallbackInsights = [];
let nextInsightId = 1;

const fallbackTeams = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    name: 'xyz',
    description: 'Core product engineering & analytics team',
    created_by: 1,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextTeamId = 2;

const fallbackTeamMembers = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    team_id: '00000000-0000-0000-0000-000000000001',
    user_id: 1,
    role: 'lead',
    created_at: new Date('2026-01-01T00:00:00Z')
  }
];
let nextTeamMemberId = 2;

const fallbackDashboardShares = [];
let nextDashShareId = 1;

const fallbackReportShares = [];
let nextReportShareId = 1;

const fallbackInsightShares = [];
let nextInsightShareId = 1;

const fallbackComments = [];
let nextCommentId = 1;

const fallbackFavorites = [];
let nextFavoriteId = 1;

const fallbackRecentlyViewed = [];
let nextRecentlyViewedId = 1;

const fallbackSavedViews = [];
let nextSavedViewId = 1;

const fallbackNotifications = [];
let nextNotificationId = 1;

/**
 * Initialize PostgreSQL connection pool
 */
if (config.databaseUrl) {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 15000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL client error, falling back to memory store:', err.message);
    useFallbackStore = true;
  });
} else {
  // If no DATABASE_URL provided, default to memory store in local dev
  useFallbackStore = true;
}

/**
 * Execute SQL Query with error fallback
 * @param {string} text 
 * @param {any[]} [params] 
 * @returns {Promise<{ rows: any[], rowCount: number }>}
 */
async function query(text, params = []) {
  if (!useFallbackStore && pool) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      // If connection fails, switch to fallback in development
      console.warn(`PostgreSQL query error: ${err.message}. Operating in fallback store.`);
      useFallbackStore = true;
    }
  }

  // Handle fallback in-memory store queries
  return handleFallbackQuery(text, params);
}

/**
 * Minimal in-memory SQL dispatcher for dev/test reliability
 */
function handleFallbackQuery(text, params = []) {
  const normalizedSql = text.replace(/\s+/g, ' ').trim().toLowerCase();

  // ----------------- ORGANIZATIONS -----------------
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from organizations where lower(slug) = lower($1)')) {
    const slug = params[0]?.toLowerCase();
    const org = fallbackOrganizations.find(o => o.slug.toLowerCase() === slug);
    return Promise.resolve({
      rows: org ? [{ ...org }] : [],
      rowCount: org ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from organizations where id = $1')) {
    const id = String(params[0]);
    const org = fallbackOrganizations.find(o => String(o.id) === id);
    return Promise.resolve({
      rows: org ? [{ ...org }] : [],
      rowCount: org ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('insert into organizations')) {
    const [name, slug, plan = 'starter', settings = '{}'] = params;
    const existing = fallbackOrganizations.find(o => o.slug.toLowerCase() === slug.toLowerCase());
    if (existing) {
      const err = new Error('duplicate key value violates unique constraint "organizations_slug_key"');
      err.code = '23505';
      return Promise.reject(err);
    }

    const newOrg = {
      id: `00000000-0000-0000-0000-00000000000${nextOrgId++}`,
      name,
      slug,
      plan,
      settings: typeof settings === 'string' ? JSON.parse(settings) : settings,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackOrganizations.push(newOrg);
    return Promise.resolve({
      rows: [{ ...newOrg }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('update organizations set')) {
    const orgId = String(params[params.length - 1]);
    const org = fallbackOrganizations.find(o => String(o.id) === orgId);
    if (org) {
      let paramIdx = 0;
      if (normalizedSql.includes('name = $')) {
        org.name = params[paramIdx++];
      }
      if (normalizedSql.includes('settings = $')) {
        const rawSettings = params[paramIdx++];
        org.settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings;
      }
      if (normalizedSql.includes('plan = $')) {
        org.plan = params[paramIdx++];
      }
      org.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...org }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.includes('from users where organization_id = $1') && normalizedSql.includes('as members_count')) {
    const orgId = String(params[0]);
    const membersCount = fallbackUsers.filter(u => String(u.organization_id) === orgId).length;
    const activeMembersCount = fallbackUsers.filter(u => String(u.organization_id) === orgId && (u.status || 'active') === 'active').length;
    const orgUserIds = fallbackUsers.filter(u => String(u.organization_id) === orgId).map(u => u.id);
    const datasetsCount = fallbackDatasets.filter(d => orgUserIds.includes(d.user_id)).length;
    const dashboardsCount = fallbackDashboards.filter(d => String(d.organization_id) === orgId).length;
    const reportsCount = fallbackReports.filter(r => String(r.organization_id) === orgId).length;
    const alertsCount = fallbackAlerts.filter(a => String(a.organization_id) === orgId).length;
    const forecastsCount = fallbackForecasts.filter(f => String(f.organization_id) === orgId).length;
    const aiQueriesCount = fallbackAiConversations.filter(c => String(c.organization_id) === orgId).length;
    const auditLogsCount = fallbackAuditLogs.filter(a => String(a.organization_id) === orgId).length;

    return Promise.resolve({
      rows: [{
        members_count: membersCount,
        active_members_count: activeMembersCount,
        datasets_count: datasetsCount,
        dashboards_count: dashboardsCount,
        reports_count: reportsCount,
        alerts_count: alertsCount,
        forecasts_count: forecastsCount,
        ai_queries_count: aiQueriesCount,
        audit_logs_count: auditLogsCount
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.includes('select role, count(*)::integer as count') && normalizedSql.includes('from users where organization_id = $1 group by role')) {
    const orgId = String(params[0]);
    const counts = { admin: 0, manager: 0, analyst: 0, viewer: 0 };
    fallbackUsers.filter(u => String(u.organization_id) === orgId).forEach(u => {
      const r = (u.role || 'viewer').toLowerCase();
      counts[r] = (counts[r] || 0) + 1;
    });
    const rows = Object.entries(counts).map(([role, count]) => ({ role, count }));
    return Promise.resolve({ rows, rowCount: rows.length });
  }

  // ----------------- AUDIT LOGS -----------------
  if (normalizedSql.startsWith('insert into audit_logs')) {
    const [id, orgId, userId, action, resourceType, resourceId, description, metadata, ipAddress, userAgent] = params;
    const newLog = {
      id: id || `00000000-0000-0000-0000-00000000000${nextAuditLogId++}`,
      organization_id: String(orgId),
      user_id: userId ? Number(userId) : null,
      action: String(action).toUpperCase(),
      resource_type: String(resourceType).toLowerCase(),
      resource_id: resourceId !== null && resourceId !== undefined ? String(resourceId) : null,
      description: String(description || ''),
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {}),
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      created_at: new Date()
    };
    fallbackAuditLogs.push(newLog);
    return Promise.resolve({
      rows: [{ ...newLog }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select count(*)::integer as total from audit_logs a')) {
    const orgId = String(params[0]);
    let filtered = fallbackAuditLogs.filter(a => String(a.organization_id) === orgId);
    
    // Check extra filters in query/params
    if (params.length > 1) {
      for (let i = 1; i < params.length; i++) {
        const val = params[i];
        if (typeof val === 'number') {
          filtered = filtered.filter(a => a.user_id === val);
        } else if (typeof val === 'string' && val.startsWith('%') && val.endsWith('%')) {
          const q = val.replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(a => 
            (a.description && a.description.toLowerCase().includes(q)) ||
            (a.action && a.action.toLowerCase().includes(q)) ||
            (a.resource_type && a.resource_type.toLowerCase().includes(q))
          );
        } else if (typeof val === 'string') {
          filtered = filtered.filter(a => 
            a.action.toLowerCase() === val.toLowerCase() || 
            a.resource_type.toLowerCase() === val.toLowerCase()
          );
        } else if (val instanceof Date) {
          // Date range check
          filtered = filtered.filter(a => new Date(a.created_at) >= val || new Date(a.created_at) <= val);
        }
      }
    }

    return Promise.resolve({
      rows: [{ total: filtered.length }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select a.id, a.organization_id') && normalizedSql.includes('from audit_logs a')) {
    const orgId = String(params[0]);
    let filtered = fallbackAuditLogs.filter(a => String(a.organization_id) === orgId);

    let limit = 20;
    let offset = 0;

    // Filter processing
    for (let i = 1; i < params.length; i++) {
      const val = params[i];
      if (i === params.length - 2 && typeof val === 'number' && typeof params[params.length - 1] === 'number') {
        limit = val;
      } else if (i === params.length - 1 && typeof val === 'number') {
        offset = val;
      } else if (typeof val === 'number') {
        filtered = filtered.filter(a => a.user_id === val);
      } else if (typeof val === 'string' && val.startsWith('%') && val.endsWith('%')) {
        const q = val.replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(a => 
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.action && a.action.toLowerCase().includes(q)) ||
          (a.resource_type && a.resource_type.toLowerCase().includes(q))
        );
      } else if (typeof val === 'string') {
        filtered = filtered.filter(a => 
          a.action.toLowerCase() === val.toLowerCase() || 
          a.resource_type.toLowerCase() === val.toLowerCase()
        );
      }
    }

    // Sort descending by created_at
    const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const sliced = sorted.slice(offset, offset + limit).map(log => {
      const u = fallbackUsers.find(user => user.id === log.user_id);
      return {
        ...log,
        user_name: u ? u.name : null,
        user_email: u ? u.email : null,
        user_role: u ? u.role : null
      };
    });

    return Promise.resolve({
      rows: sliced,
      rowCount: sliced.length
    });
  }

  // ----------------- USERS -----------------
  if (normalizedSql.startsWith('select id, name, email, role, organization_id') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const id = Number(params[0]);
    const orgId = String(params[1]);
    const user = fallbackUsers.find(u => u.id === id && String(u.organization_id) === orgId);
    return Promise.resolve({
      rows: user ? [{ ...user, status: user.status || 'active' }] : [],
      rowCount: user ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('select count(*)::integer as total from users where')) {
    const orgId = String(params[0]);
    let filtered = fallbackUsers.filter(u => String(u.organization_id) === orgId);

    if (params.length > 1) {
      for (let i = 1; i < params.length; i++) {
        const val = params[i];
        if (typeof val === 'string' && val.startsWith('%') && val.endsWith('%')) {
          const q = val.replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        } else if (typeof val === 'string') {
          filtered = filtered.filter(u => u.role.toLowerCase() === val.toLowerCase() || (u.status || 'active').toLowerCase() === val.toLowerCase());
        }
      }
    }

    return Promise.resolve({
      rows: [{ total: filtered.length }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select id, name, email, role, organization_id') && normalizedSql.includes('from users where') && normalizedSql.includes('order by created_at')) {
    const orgId = String(params[0]);
    let filtered = fallbackUsers.filter(u => String(u.organization_id) === orgId);

    let limit = 20;
    let offset = 0;

    for (let i = 1; i < params.length; i++) {
      const val = params[i];
      if (i === params.length - 2 && typeof val === 'number' && typeof params[params.length - 1] === 'number') {
        limit = val;
      } else if (i === params.length - 1 && typeof val === 'number') {
        offset = val;
      } else if (typeof val === 'string' && val.startsWith('%') && val.endsWith('%')) {
        const q = val.replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      } else if (typeof val === 'string') {
        filtered = filtered.filter(u => u.role.toLowerCase() === val.toLowerCase() || (u.status || 'active').toLowerCase() === val.toLowerCase());
      }
    }

    const sorted = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const sliced = sorted.slice(offset, offset + limit).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      organization_id: u.organization_id,
      avatar_url: u.avatar_url || null,
      status: u.status || 'active',
      last_login_at: u.last_login_at || null,
      created_at: u.created_at,
      updated_at: u.updated_at
    }));

    return Promise.resolve({
      rows: sliced,
      rowCount: sliced.length
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from users where lower(email) = lower($1)')) {
    const email = params[0]?.toLowerCase();
    const user = fallbackUsers.find(u => u.email.toLowerCase() === email);
    return Promise.resolve({
      rows: user ? [{ ...user, status: user.status || 'active' }] : [],
      rowCount: user ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from users where id = $1')) {
    const id = Number(params[0]);
    const user = fallbackUsers.find(u => u.id === id);
    return Promise.resolve({
      rows: user ? [{ ...user, status: user.status || 'active' }] : [],
      rowCount: user ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('insert into users')) {
    const [name, email, password_hash, role = 'viewer', organization_id = '00000000-0000-0000-0000-000000000001', status = 'active'] = params;
    const existing = fallbackUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      const err = new Error('duplicate key value violates unique constraint "users_email_key"');
      err.code = '23505';
      return Promise.reject(err);
    }

    const newUser = {
      id: nextUserId++,
      name,
      email,
      password_hash,
      role,
      organization_id: organization_id || '00000000-0000-0000-0000-000000000001',
      status: status || 'active',
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackUsers.push(newUser);

    return Promise.resolve({
      rows: [{
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        organization_id: newUser.organization_id,
        status: newUser.status,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('update users set role = $1') && normalizedSql.includes('organization_id = $3')) {
    const [role, id, orgId] = params;
    const user = fallbackUsers.find(u => u.id === Number(id) && String(u.organization_id) === String(orgId));
    if (user) {
      user.role = role;
      user.updated_at = new Date();
      return Promise.resolve({
        rows: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          status: user.status || 'active',
          updated_at: user.updated_at
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update users set role = $1')) {
    const [role, id] = params;
    const user = fallbackUsers.find(u => u.id === Number(id));
    if (user) {
      user.role = role;
      user.updated_at = new Date();
      return Promise.resolve({
        rows: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          status: user.status || 'active',
          updated_at: user.updated_at
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update users set status = $1')) {
    const [status, id, orgId] = params;
    const user = fallbackUsers.find(u => u.id === Number(id) && String(u.organization_id) === String(orgId));
    if (user) {
      user.status = status;
      user.updated_at = new Date();
      return Promise.resolve({
        rows: [{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          status: user.status,
          updated_at: user.updated_at
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update users set last_login_at = current_timestamp')) {
    const [id] = params;
    const user = fallbackUsers.find(u => u.id === Number(id));
    if (user) {
      user.last_login_at = new Date();
    }
    return Promise.resolve({ rows: [], rowCount: 1 });
  }

  // ----------------- DATA SOURCES -----------------
  // DELETE data_sources
  if (normalizedSql.startsWith('delete from data_sources')) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const idx = fallbackDataSources.findIndex(d => d.id === id && d.user_id === userId);
    if (idx !== -1) {
      const deleted = fallbackDataSources.splice(idx, 1)[0];
      // Cascade delete datasets
      for (let i = fallbackDatasets.length - 1; i >= 0; i--) {
        if (fallbackDatasets[i].data_source_id === id && fallbackDatasets[i].user_id === userId) {
          fallbackDatasets.splice(i, 1);
        }
      }
      return Promise.resolve({ rows: [deleted], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single data source by id and user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from data_sources') && (normalizedSql.includes('id = $1 and ds.user_id = $2') || normalizedSql.includes('id = $1 and user_id = $2'))) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const ds = fallbackDataSources.find(d => d.id === id && d.user_id === userId);
    return Promise.resolve({
      rows: ds ? [{ ...ds }] : [],
      rowCount: ds ? 1 : 0
    });
  }

  // SELECT data_sources by user_id with dataset count
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from data_sources')) {
    const userId = Number(params[0]);
    const list = fallbackDataSources
      .filter(ds => ds.user_id === userId)
      .map(ds => {
        const datasetCount = fallbackDatasets.filter(d => d.data_source_id === ds.id && d.user_id === userId).length;
        const totalRows = fallbackDatasets
          .filter(d => d.data_source_id === ds.id && d.user_id === userId)
          .reduce((sum, d) => sum + (Number(d.row_count) || 0), 0);
        return {
          ...ds,
          dataset_count: datasetCount,
          total_rows: totalRows
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT data_sources
  if (normalizedSql.startsWith('insert into data_sources')) {
    const [userId, name, type, status = 'active', config = {}] = params;
    const newDs = {
      id: nextDataSourceId++,
      user_id: Number(userId),
      name,
      type,
      status,
      config: typeof config === 'string' ? JSON.parse(config) : config,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDataSources.push(newDs);
    return Promise.resolve({
      rows: [{ ...newDs }],
      rowCount: 1
    });
  }

  // ----------------- DATASETS -----------------
  // DELETE dataset
  if (normalizedSql.startsWith('delete from datasets')) {
    const id = Number(params[0]);
    const secondParam = params[1];
    const idx = fallbackDatasets.findIndex(d => {
      if (Number(d.id) !== id) return false;
      if (!secondParam) return true;
      if (typeof secondParam === 'number' || (!isNaN(Number(secondParam)) && Number(secondParam) < 1000)) {
        return Number(d.user_id) === Number(secondParam);
      }
      if (String(d.organization_id) === String(secondParam)) return true;
      const u = fallbackUsers.find(user => Number(user.id) === Number(d.user_id));
      return u && String(u.organization_id) === String(secondParam);
    });
    if (idx !== -1) {
      const deleted = fallbackDatasets.splice(idx, 1)[0];
      return Promise.resolve({ rows: [deleted], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // Check widget dependencies for dataset
  if (normalizedSql.startsWith('select count') && normalizedSql.includes('from dashboard_widgets') && normalizedSql.includes('dataset_id = $1')) {
    const datasetId = Number(params[0]);
    const count = fallbackDashboardWidgets.filter(w => Number(w.dataset_id) === datasetId).length;
    return Promise.resolve({ rows: [{ count }], rowCount: 1 });
  }

  // SELECT single dataset by id and user_id OR by id alone
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && (normalizedSql.includes('d.id = $1 and d.user_id = $2') || normalizedSql.includes('id = $1 and user_id = $2'))) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const dataset = fallbackDatasets.find(d => d.id === id && d.user_id === userId);
    if (dataset) {
      const ds = fallbackDataSources.find(s => s.id === dataset.data_source_id);
      return Promise.resolve({
        rows: [{
          ...dataset,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && normalizedSql.includes('organization_id = $2')) {
    const id = Number(params[0]);
    const orgId = String(params[1]);
    const dataset = fallbackDatasets.find(d => Number(d.id) === id);
    if (dataset) {
      const u = fallbackUsers.find(user => Number(user.id) === Number(dataset.user_id));
      if ((u && String(u.organization_id) === orgId) || String(dataset.organization_id) === orgId) {
        const ds = fallbackDataSources.find(s => s.id === dataset.data_source_id);
        return Promise.resolve({
          rows: [{
            ...dataset,
            organization_id: u ? u.organization_id : dataset.organization_id,
            data_source_name: ds ? ds.name : 'Direct Upload',
            data_source_type: ds ? ds.type : 'csv'
          }],
          rowCount: 1
        });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && (normalizedSql.includes('d.id = $1 limit 1') || normalizedSql.includes('where d.id = $1') || normalizedSql.includes('where id = $1'))) {
    const id = Number(params[0]);
    const dataset = fallbackDatasets.find(d => Number(d.id) === id);
    if (dataset) {
      const ds = fallbackDataSources.find(s => s.id === dataset.data_source_id);
      return Promise.resolve({
        rows: [{
          ...dataset,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT datasets by data_source_id and user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && normalizedSql.includes('data_source_id = $1 and user_id = $2')) {
    const dataSourceId = Number(params[0]);
    const userId = Number(params[1]);
    const list = fallbackDatasets.filter(d => d.data_source_id === dataSourceId && d.user_id === userId);
    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT datasets by organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && normalizedSql.includes('u.organization_id = $1')) {
    const orgId = String(params[0]);
    const orgUserIds = fallbackUsers.filter(u => String(u.organization_id) === orgId).map(u => u.id);
    const list = fallbackDatasets
      .filter(d => orgUserIds.includes(d.user_id) || String(d.organization_id) === orgId)
      .map(d => {
        const ds = fallbackDataSources.find(s => s.id === d.data_source_id);
        return {
          ...d,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv',
          data_source_status: ds ? ds.status : 'active'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT datasets list with data_source details for user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets')) {
    const userId = Number(params[0]);
    const list = fallbackDatasets
      .filter(d => d.user_id === userId)
      .map(d => {
        const ds = fallbackDataSources.find(s => s.id === d.data_source_id);
        return {
          ...d,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv',
          data_source_status: ds ? ds.status : 'active'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT datasets
  if (normalizedSql.startsWith('insert into datasets')) {
    const [userId, dataSourceId, name, description = '', filePath = '', rowCount = 0, columnCount = 0, schema = []] = params;
    const u = fallbackUsers.find(user => Number(user.id) === Number(userId));
    const newDataset = {
      id: nextDatasetId++,
      user_id: Number(userId),
      organization_id: u ? String(u.organization_id) : '00000000-0000-0000-0000-000000000001',
      data_source_id: dataSourceId ? Number(dataSourceId) : null,
      name,
      description: description || '',
      file_path: filePath,
      row_count: Number(rowCount) || 0,
      column_count: Number(columnCount) || 0,
      schema: typeof schema === 'string' ? JSON.parse(schema) : schema,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDatasets.push(newDataset);
    return Promise.resolve({
      rows: [{ ...newDataset }],
      rowCount: 1
    });
  }

  // ----------------- METRICS -----------------
  // DELETE metrics
  if (normalizedSql.startsWith('delete from metrics')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const idx = fallbackMetrics.findIndex(m => String(m.id) === id && String(m.organization_id) === orgId);
    if (idx !== -1) {
      const deleted = fallbackMetrics.splice(idx, 1)[0];
      return Promise.resolve({ rows: [deleted], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE metrics
  if (normalizedSql.startsWith('update metrics')) {
    const [name, description, formula, type, unit, target_value, dataset_id, formatting, id, orgId] = params;
    const metric = fallbackMetrics.find(m => String(m.id) === String(id) && String(m.organization_id) === String(orgId));
    if (metric) {
      metric.name = name;
      metric.description = description;
      metric.formula = formula;
      metric.type = type;
      metric.unit = unit;
      metric.target_value = target_value;
      metric.dataset_id = dataset_id;
      metric.formatting = typeof formatting === 'string' ? JSON.parse(formatting) : formatting;
      metric.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...metric }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single metric by id and organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from metrics') && normalizedSql.includes('m.id = $1 and m.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const metric = fallbackMetrics.find(m => String(m.id) === id && String(m.organization_id) === orgId);
    if (metric) {
      const ds = fallbackDatasets.find(d => String(d.id) === String(metric.dataset_id));
      const user = fallbackUsers.find(u => String(u.id) === String(metric.created_by));
      return Promise.resolve({
        rows: [{
          ...metric,
          dataset_name: ds ? ds.name : null,
          dataset_file_path: ds ? ds.file_path : null,
          dataset_schema: ds ? ds.schema : null,
          creator_name: user ? user.name : 'Analyst'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT metrics list by organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from metrics') && normalizedSql.includes('where m.organization_id = $1')) {
    const orgId = String(params[0]);
    const list = fallbackMetrics
      .filter(m => String(m.organization_id) === orgId)
      .map(m => {
        const ds = fallbackDatasets.find(d => String(d.id) === String(m.dataset_id));
        const user = fallbackUsers.find(u => String(u.id) === String(m.created_by));
        return {
          ...m,
          dataset_name: ds ? ds.name : null,
          creator_name: user ? user.name : 'Analyst'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT metrics
  if (normalizedSql.startsWith('insert into metrics')) {
    const [organization_id, dataset_id, created_by, name, description = '', formula, type = 'currency', unit = '', target_value = null, formatting = '{}'] = params;
    const newMetric = {
      id: `00000000-0000-0000-0000-00000000000${nextMetricId++}`,
      organization_id: String(organization_id),
      dataset_id: dataset_id ? String(dataset_id) : null,
      created_by: created_by ? String(created_by) : null,
      name,
      description,
      formula,
      type,
      unit,
      target_value: target_value !== null ? Number(target_value) : null,
      formatting: typeof formatting === 'string' ? JSON.parse(formatting) : formatting,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackMetrics.push(newMetric);
    return Promise.resolve({
      rows: [{ ...newMetric }],
      rowCount: 1
    });
  }

  // ----------------- DASHBOARDS -----------------
  // UPDATE is_default unsetting
  if (normalizedSql.startsWith('update dashboards set is_default = false')) {
    const orgId = String(params[0]);
    const excludeId = params[1] ? String(params[1]) : null;
    fallbackDashboards.forEach(d => {
      if (String(d.organization_id) === orgId && (!excludeId || String(d.id) !== excludeId)) {
        d.is_default = false;
        d.updated_at = new Date();
      }
    });
    return Promise.resolve({ rows: [], rowCount: 1 });
  }

  // UPDATE dashboard
  if (normalizedSql.startsWith('update dashboards set')) {
    const [title, description, is_default, is_public, layout, filters, id, organization_id] = params;
    const dash = fallbackDashboards.find(d => String(d.id) === String(id) && String(d.organization_id) === String(organization_id));
    if (dash) {
      dash.title = title;
      dash.description = description;
      dash.is_default = Boolean(is_default);
      dash.is_public = Boolean(is_public);
      dash.layout = typeof layout === 'string' ? JSON.parse(layout) : layout;
      dash.filters = typeof filters === 'string' ? JSON.parse(filters) : filters;
      dash.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...dash }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // DELETE dashboard
  if (normalizedSql.startsWith('delete from dashboards')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const idx = fallbackDashboards.findIndex(d => String(d.id) === id && String(d.organization_id) === orgId);
    if (idx !== -1) {
      const removed = fallbackDashboards.splice(idx, 1)[0];
      // Cascade delete widgets
      const widgetIndices = [];
      fallbackDashboardWidgets.forEach((w, i) => {
        if (String(w.dashboard_id) === id) widgetIndices.push(i);
      });
      for (let i = widgetIndices.length - 1; i >= 0; i--) {
        fallbackDashboardWidgets.splice(widgetIndices[i], 1);
      }
      return Promise.resolve({
        rows: [{ id: removed.id }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single dashboard by id and orgId
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dashboards') && normalizedSql.includes('d.id = $1 and d.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const dash = fallbackDashboards.find(d => String(d.id) === id && String(d.organization_id) === orgId);
    if (dash) {
      const user = fallbackUsers.find(u => String(u.id) === String(dash.created_by));
      return Promise.resolve({
        rows: [{
          ...dash,
          creator_name: user ? user.name : 'Analyst',
          creator_email: user ? user.email : 'analyst@ricoz.test'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT dashboards list by organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dashboards') && normalizedSql.includes('where d.organization_id = $1')) {
    const orgId = String(params[0]);
    const list = fallbackDashboards
      .filter(d => String(d.organization_id) === orgId)
      .map(d => {
        const user = fallbackUsers.find(u => String(u.id) === String(d.created_by));
        const widgetCount = fallbackDashboardWidgets.filter(w => String(w.dashboard_id) === String(d.id)).length;
        return {
          ...d,
          creator_name: user ? user.name : 'Analyst',
          creator_email: user ? user.email : 'analyst@ricoz.test',
          widget_count: widgetCount
        };
      })
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT dashboard
  if (normalizedSql.startsWith('insert into dashboards')) {
    const [organization_id, created_by, title, description = '', is_default = false, is_public = false, layout = '[]', filters = '{}'] = params;
    const newDash = {
      id: `00000000-0000-0000-0000-00000000000${nextDashboardId++}`,
      organization_id: String(organization_id),
      created_by: created_by ? String(created_by) : null,
      title,
      description,
      is_default: Boolean(is_default),
      is_public: Boolean(is_public),
      layout: typeof layout === 'string' ? JSON.parse(layout) : layout,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDashboards.push(newDash);
    return Promise.resolve({
      rows: [{ ...newDash }],
      rowCount: 1
    });
  }

  // ----------------- DASHBOARD WIDGETS -----------------
  // DELETE widget
  if (normalizedSql.startsWith('delete from dashboard_widgets')) {
    const widgetId = String(params[0]);
    const dashboardId = params[1] ? String(params[1]) : null;
    const idx = fallbackDashboardWidgets.findIndex(w => {
      if (String(w.id) !== widgetId) return false;
      if (dashboardId && String(w.dashboard_id) !== dashboardId) return false;
      return true;
    });
    if (idx !== -1) {
      const removed = fallbackDashboardWidgets.splice(idx, 1)[0];
      return Promise.resolve({
        rows: [{ id: removed.id }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE widget
  if (normalizedSql.startsWith('update dashboard_widgets set')) {
    const [title, type, dataset_id, metric_id, configuration, position, widgetId, dashboardId] = params;
    const widget = fallbackDashboardWidgets.find(w => String(w.id) === String(widgetId) && String(w.dashboard_id) === String(dashboardId));
    if (widget) {
      widget.title = title;
      widget.type = type;
      widget.dataset_id = dataset_id ? String(dataset_id) : null;
      widget.metric_id = metric_id ? String(metric_id) : null;
      widget.configuration = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      widget.position = typeof position === 'string' ? JSON.parse(position) : position;
      widget.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...widget }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single widget by id and dashboard_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dashboard_widgets') && normalizedSql.includes('where w.id = $1 and w.dashboard_id = $2')) {
    const widgetId = String(params[0]);
    const dashboardId = String(params[1]);
    const widget = fallbackDashboardWidgets.find(w => String(w.id) === widgetId && String(w.dashboard_id) === dashboardId);
    if (widget) {
      const ds = fallbackDatasets.find(d => String(d.id) === String(widget.dataset_id));
      const metric = fallbackMetrics.find(m => String(m.id) === String(widget.metric_id));
      return Promise.resolve({
        rows: [{
          ...widget,
          dataset_name: ds ? ds.name : null,
          dataset_file_path: ds ? ds.file_path : null,
          metric_name: metric ? metric.name : null,
          metric_formula: metric ? metric.formula : null,
          metric_type: metric ? metric.type : null,
          metric_unit: metric ? metric.unit : null,
          metric_target_value: metric ? metric.target_value : null,
          metric_formatting: metric ? metric.formatting : null
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT widgets list by dashboard_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dashboard_widgets') && normalizedSql.includes('where w.dashboard_id = $1')) {
    const dashboardId = String(params[0]);
    const list = fallbackDashboardWidgets
      .filter(w => String(w.dashboard_id) === dashboardId)
      .map(w => {
        const ds = fallbackDatasets.find(d => String(d.id) === String(w.dataset_id));
        const metric = fallbackMetrics.find(m => String(m.id) === String(w.metric_id));
        return {
          ...w,
          dataset_name: ds ? ds.name : null,
          dataset_file_path: ds ? ds.file_path : null,
          metric_name: metric ? metric.name : null,
          metric_formula: metric ? metric.formula : null,
          metric_type: metric ? metric.type : null,
          metric_unit: metric ? metric.unit : null,
          metric_target_value: metric ? metric.target_value : null,
          metric_formatting: metric ? metric.formatting : null
        };
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT widget
  if (normalizedSql.startsWith('insert into dashboard_widgets')) {
    let id, dashboard_id, dataset_id, metric_id, title, type, configuration, position;
    if (normalizedSql.includes('(id,')) {
      [id, dashboard_id, dataset_id, title, type, metric_id, configuration, position] = params;
    } else {
      [dashboard_id, dataset_id, metric_id, title, type, configuration, position] = params;
    }
    const newWidget = {
      id: id || `00000000-0000-0000-0000-00000000000${nextWidgetId++}`,
      dashboard_id: dashboard_id ? String(dashboard_id) : null,
      dataset_id: dataset_id ? String(dataset_id) : null,
      metric_id: metric_id ? String(metric_id) : null,
      title: title || 'Widget',
      type: type || 'bar_chart',
      configuration: typeof configuration === 'string' ? JSON.parse(configuration) : (configuration || {}),
      position: typeof position === 'string' ? JSON.parse(position) : (position || { x: 0, y: 0, w: 6, h: 4 }),
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDashboardWidgets.push(newWidget);
    return Promise.resolve({
      rows: [{ ...newWidget }],
      rowCount: 1
    });
  }

  // ----------------- REPORTS -----------------
  // DELETE report
  if (normalizedSql.startsWith('delete from reports')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const idx = fallbackReports.findIndex(r => String(r.id) === id && String(r.organization_id) === orgId);
    if (idx !== -1) {
      const removed = fallbackReports.splice(idx, 1)[0];
      // Cascade delete report executions
      for (let i = fallbackReportExecutions.length - 1; i >= 0; i--) {
        if (String(fallbackReportExecutions[i].report_id) === id) {
          fallbackReportExecutions.splice(i, 1);
        }
      }
      return Promise.resolve({
        rows: [{ id: removed.id }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE report status
  if (normalizedSql.startsWith('update reports set status = $1')) {
    const [status, id, orgId] = params;
    const report = fallbackReports.find(r => String(r.id) === String(id) && String(r.organization_id) === String(orgId));
    if (report) {
      report.status = status;
      report.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...report }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE report schedule
  if (normalizedSql.startsWith('update reports set schedule_cron = $1')) {
    const [schedule_cron, id, orgId] = params;
    const report = fallbackReports.find(r => String(r.id) === String(id) && String(r.organization_id) === String(orgId));
    if (report) {
      report.schedule_cron = schedule_cron;
      report.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...report }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE report last_generated_at
  if (normalizedSql.startsWith('update reports set last_generated_at = $1')) {
    const [last_generated_at, id] = params;
    const report = fallbackReports.find(r => String(r.id) === String(id));
    if (report) {
      report.last_generated_at = last_generated_at;
      report.updated_at = new Date();
      return Promise.resolve({
        rows: [{ id: report.id, last_generated_at: report.last_generated_at }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // UPDATE report configuration
  if (normalizedSql.startsWith('update reports set')) {
    const [title, description, dashboard_id, format, schedule_cron, recipients, status, id, organization_id] = params;
    const report = fallbackReports.find(r => String(r.id) === String(id) && String(r.organization_id) === String(organization_id));
    if (report) {
      report.title = title;
      report.description = description;
      report.dashboard_id = dashboard_id ? String(dashboard_id) : null;
      report.format = format;
      report.schedule_cron = schedule_cron;
      report.recipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
      report.status = status;
      report.updated_at = new Date();
      return Promise.resolve({
        rows: [{ ...report }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single report by id and orgId
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from reports') && normalizedSql.includes('r.id = $1 and r.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const report = fallbackReports.find(r => String(r.id) === id && String(r.organization_id) === orgId);
    if (report) {
      const user = fallbackUsers.find(u => String(u.id) === String(report.created_by));
      const dash = fallbackDashboards.find(d => String(d.id) === String(report.dashboard_id));
      return Promise.resolve({
        rows: [{
          ...report,
          creator_name: user ? user.name : 'Analyst',
          creator_email: user ? user.email : 'analyst@ricoz.test',
          dashboard_title: dash ? dash.title : null
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT all active scheduled reports across organizations
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from reports r') && normalizedSql.includes("r.status = 'active'") && normalizedSql.includes('r.schedule_cron is not null')) {
    const activeReports = fallbackReports
      .filter(r => r.status === 'active' && r.schedule_cron)
      .map(r => {
        const org = fallbackOrganizations.find(o => String(o.id) === String(r.organization_id));
        return {
          ...r,
          organization_name: org ? org.name : 'Ricoz Primary Organization'
        };
      });
    return Promise.resolve({
      rows: activeReports,
      rowCount: activeReports.length
    });
  }

  // SELECT reports list by organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from reports') && normalizedSql.includes('where r.organization_id = $1')) {
    const orgId = String(params[0]);
    const list = fallbackReports
      .filter(r => String(r.organization_id) === orgId)
      .map(r => {
        const user = fallbackUsers.find(u => String(u.id) === String(r.created_by));
        const dash = fallbackDashboards.find(d => String(d.id) === String(r.dashboard_id));
        const executions = fallbackReportExecutions.filter(e => String(e.report_id) === String(r.id));
        const lastExec = executions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        return {
          ...r,
          creator_name: user ? user.name : 'Analyst',
          creator_email: user ? user.email : 'analyst@ricoz.test',
          dashboard_title: dash ? dash.title : null,
          execution_count: executions.length,
          last_execution_status: lastExec ? lastExec.status : null
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT report
  if (normalizedSql.startsWith('insert into reports')) {
    const [organization_id, created_by, dashboard_id, title, description = '', format = 'pdf', schedule_cron = null, recipients = '[]', status = 'draft'] = params;
    const newReport = {
      id: `00000000-0000-0000-0000-00000000000${nextReportId++}`,
      organization_id: String(organization_id),
      created_by: created_by ? String(created_by) : null,
      dashboard_id: dashboard_id ? String(dashboard_id) : null,
      title,
      description,
      format,
      schedule_cron: schedule_cron || null,
      recipients: typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || []),
      last_generated_at: null,
      status,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackReports.push(newReport);
    return Promise.resolve({
      rows: [{ ...newReport }],
      rowCount: 1
    });
  }

  // ----------------- REPORT EXECUTIONS -----------------
  // UPDATE report_executions
  if (normalizedSql.startsWith('update report_executions set')) {
    const [status, completed_at, file_size, file_path, error_message, id] = params;
    const exec = fallbackReportExecutions.find(e => String(e.id) === String(id));
    if (exec) {
      exec.status = status;
      exec.completed_at = completed_at;
      exec.file_size = Number(file_size) || 0;
      exec.file_path = file_path;
      exec.error_message = error_message;
      return Promise.resolve({
        rows: [{ ...exec }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single report_execution by id and organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from report_executions') && normalizedSql.includes('where re.id = $1 and re.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const exec = fallbackReportExecutions.find(e => String(e.id) === id && String(e.organization_id) === orgId);
    if (exec) {
      const report = fallbackReports.find(r => String(r.id) === String(exec.report_id));
      const user = fallbackUsers.find(u => String(u.id) === String(exec.executed_by));
      return Promise.resolve({
        rows: [{
          ...exec,
          report_title: report ? report.title : 'Deleted Report',
          executed_by_name: user ? user.name : 'System/Scheduler',
          executed_by_email: user ? user.email : null
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT report_executions by report_id and organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from report_executions') && normalizedSql.includes('where re.report_id = $1 and re.organization_id = $2')) {
    const reportId = String(params[0]);
    const orgId = String(params[1]);
    const limit = Number(params[2]) || 50;
    const list = fallbackReportExecutions
      .filter(e => String(e.report_id) === reportId && String(e.organization_id) === orgId)
      .map(e => {
        const report = fallbackReports.find(r => String(r.id) === String(e.report_id));
        const user = fallbackUsers.find(u => String(u.id) === String(e.executed_by));
        return {
          ...e,
          report_title: report ? report.title : 'Report',
          executed_by_name: user ? user.name : 'System/Scheduler'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT all report_executions for organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from report_executions') && normalizedSql.includes('where re.organization_id = $1')) {
    const orgId = String(params[0]);
    const limit = Number(params[1]) || 50;
    const list = fallbackReportExecutions
      .filter(e => String(e.organization_id) === orgId)
      .map(e => {
        const report = fallbackReports.find(r => String(r.id) === String(e.report_id));
        const user = fallbackUsers.find(u => String(u.id) === String(e.executed_by));
        return {
          ...e,
          report_title: report ? report.title : 'Report',
          executed_by_name: user ? user.name : 'System/Scheduler'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT report_execution
  if (normalizedSql.startsWith('insert into report_executions')) {
    const [report_id, organization_id, executed_by, status = 'queued', format, started_at = new Date(), completed_at = null, file_size = 0, file_path = null, error_message = null] = params;
    const newExec = {
      id: `00000000-0000-0000-0000-00000000000${nextExecutionId++}`,
      report_id: String(report_id),
      organization_id: String(organization_id),
      executed_by: executed_by ? String(executed_by) : null,
      status,
      format,
      started_at: started_at || new Date(),
      completed_at: completed_at || null,
      file_size: Number(file_size) || 0,
      file_path: file_path || null,
      error_message: error_message || null,
      created_at: new Date()
    };
    fallbackReportExecutions.push(newExec);
    return Promise.resolve({
      rows: [{ ...newExec }],
      rowCount: 1
    });
  }

  // ----------------- ALERTS -----------------
  // SELECT all alerts for organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alerts') && normalizedSql.includes('where a.organization_id = $1')) {
    const orgId = String(params[0]);
    const list = fallbackAlerts
      .filter(a => String(a.organization_id) === orgId)
      .map(a => {
        const user = fallbackUsers.find(u => String(u.id) === String(a.created_by));
        const metric = fallbackMetrics.find(m => String(m.id) === String(a.metric_id));
        const dataset = fallbackDatasets.find(d => String(d.id) === String(a.dataset_id));
        const incidents = fallbackAlertIncidents.filter(ai => String(ai.alert_id) === String(a.id));
        const openIncidents = incidents.filter(ai => ['triggered', 'acknowledged'].includes(ai.status));
        const lastIncident = incidents.sort((x, y) => new Date(y.triggered_at) - new Date(x.triggered_at))[0];

        return {
          ...a,
          creator_name: user ? user.name : 'System User',
          creator_email: user ? user.email : 'system@ricoz.com',
          metric_name: metric ? metric.name : null,
          metric_formula: metric ? metric.formula : null,
          metric_type: metric ? metric.type : null,
          metric_unit: metric ? metric.unit : null,
          dataset_name: dataset ? dataset.name : null,
          open_incidents_count: openIncidents.length,
          last_incident_status: lastIncident ? lastIncident.status : null,
          last_incident_value: lastIncident ? lastIncident.metric_value : null
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT single alert by id and organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alerts') && normalizedSql.includes('where a.id = $1 and a.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const alert = fallbackAlerts.find(a => String(a.id) === id && String(a.organization_id) === orgId);
    if (!alert) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    const user = fallbackUsers.find(u => String(u.id) === String(alert.created_by));
    const metric = fallbackMetrics.find(m => String(m.id) === String(alert.metric_id));
    const dataset = fallbackDatasets.find(d => String(d.id) === String(alert.dataset_id));

    return Promise.resolve({
      rows: [{
        ...alert,
        creator_name: user ? user.name : 'System User',
        creator_email: user ? user.email : 'system@ricoz.com',
        metric_name: metric ? metric.name : null,
        metric_formula: metric ? metric.formula : null,
        metric_type: metric ? metric.type : null,
        metric_unit: metric ? metric.unit : null,
        dataset_name: dataset ? dataset.name : null
      }],
      rowCount: 1
    });
  }

  // SELECT active alerts across all orgs (for scheduler/evaluator)
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alerts') && normalizedSql.includes("where a.status = 'active'")) {
    const list = fallbackAlerts
      .filter(a => a.status === 'active')
      .map(a => {
        const org = fallbackOrganizations.find(o => String(o.id) === String(a.organization_id));
        const metric = fallbackMetrics.find(m => String(m.id) === String(a.metric_id));
        const dataset = fallbackDatasets.find(d => String(d.id) === String(a.dataset_id));

        return {
          ...a,
          organization_name: org ? org.name : 'Primary Organization',
          metric_name: metric ? metric.name : null,
          metric_formula: metric ? metric.formula : null,
          metric_type: metric ? metric.type : null,
          dataset_file_path: dataset ? dataset.file_path : null,
          dataset_name: dataset ? dataset.name : null
        };
      });

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT alert
  if (normalizedSql.startsWith('insert into alerts')) {
    const [organization_id, created_by, metric_id, dataset_id, name, condition, threshold, severity = 'medium', status = 'active', notification_channels = '["in_app"]', cooldown_minutes = 60, recipients = '[]'] = params;
    const newAlert = {
      id: `00000000-0000-0000-0000-00000000000${nextAlertId++}`,
      organization_id: String(organization_id),
      created_by: created_by ? String(created_by) : null,
      metric_id: metric_id ? String(metric_id) : null,
      dataset_id: dataset_id ? String(dataset_id) : null,
      name,
      condition,
      threshold: Number(threshold),
      severity,
      status,
      notification_channels: typeof notification_channels === 'string' ? JSON.parse(notification_channels) : notification_channels,
      cooldown_minutes: Number(cooldown_minutes) || 60,
      recipients: typeof recipients === 'string' ? JSON.parse(recipients) : recipients,
      last_triggered_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackAlerts.push(newAlert);
    return Promise.resolve({
      rows: [{ ...newAlert }],
      rowCount: 1
    });
  }

  // UPDATE alerts
  if (normalizedSql.startsWith('update alerts')) {
    if (normalizedSql.includes('last_triggered_at = $1')) {
      const [timestamp, status, id] = params;
      const alert = fallbackAlerts.find(a => String(a.id) === String(id));
      if (alert) {
        alert.last_triggered_at = timestamp;
        if (alert.status !== 'disabled') {
          alert.status = status;
        }
        alert.updated_at = new Date();
        return Promise.resolve({ rows: [{ ...alert }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    // Standard update
    const [name, metric_id, dataset_id, condition, threshold, severity, status, notification_channels, cooldown_minutes, recipients, id, organization_id] = params;
    const alert = fallbackAlerts.find(a => String(a.id) === String(id) && String(a.organization_id) === String(organization_id));
    if (!alert) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    alert.name = name;
    alert.metric_id = metric_id ? String(metric_id) : null;
    alert.dataset_id = dataset_id ? String(dataset_id) : null;
    alert.condition = condition;
    alert.threshold = Number(threshold);
    alert.severity = severity;
    alert.status = status;
    alert.notification_channels = typeof notification_channels === 'string' ? JSON.parse(notification_channels) : notification_channels;
    alert.cooldown_minutes = Number(cooldown_minutes) || 60;
    alert.recipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
    alert.updated_at = new Date();

    return Promise.resolve({
      rows: [{ ...alert }],
      rowCount: 1
    });
  }

  // DELETE alerts
  if (normalizedSql.startsWith('delete from alerts')) {
    const [id, organization_id] = params;
    const idx = fallbackAlerts.findIndex(a => String(a.id) === String(id) && String(a.organization_id) === String(organization_id));
    if (idx !== -1) {
      const deleted = fallbackAlerts.splice(idx, 1);
      return Promise.resolve({ rows: deleted, rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- ALERT INCIDENTS -----------------
  // SELECT alert_incidents for cooldown check (recent incidents)
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alert_incidents') && normalizedSql.includes('ai.alert_id = $1') && normalizedSql.includes('ai.organization_id = $2') && normalizedSql.includes('cooldown')) {
    const alertId = String(params[0]);
    const orgId = String(params[1]);
    const cooldownMins = Number(params[2]) || 60;
    const cutoff = new Date(Date.now() - cooldownMins * 60 * 1000);

    const recent = fallbackAlertIncidents
      .filter(ai => String(ai.alert_id) === alertId && String(ai.organization_id) === orgId && ['triggered', 'acknowledged'].includes(ai.status) && new Date(ai.triggered_at) >= cutoff)
      .sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at))[0];

    return Promise.resolve({
      rows: recent ? [{ ...recent }] : [],
      rowCount: recent ? 1 : 0
    });
  }

  // SELECT alert_incidents by alert_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alert_incidents') && normalizedSql.includes('ai.alert_id = $1') && normalizedSql.includes('ai.organization_id = $2')) {
    const alertId = String(params[0]);
    const orgId = String(params[1]);
    const limit = Number(params[2]) || 50;

    const list = fallbackAlertIncidents
      .filter(ai => String(ai.alert_id) === alertId && String(ai.organization_id) === orgId)
      .map(ai => {
        const user = fallbackUsers.find(u => String(u.id) === String(ai.resolved_by));
        return {
          ...ai,
          resolved_by_name: user ? user.name : null
        };
      })
      .sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at))
      .slice(0, limit);

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT single incident by id and organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alert_incidents') && normalizedSql.includes('where ai.id = $1 and ai.organization_id = $2')) {
    const id = String(params[0]);
    const orgId = String(params[1]);
    const incident = fallbackAlertIncidents.find(ai => String(ai.id) === id && String(ai.organization_id) === orgId);
    if (!incident) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    const alert = fallbackAlerts.find(a => String(a.id) === String(incident.alert_id));
    const metric = alert ? fallbackMetrics.find(m => String(m.id) === String(alert.metric_id)) : null;
    const user = fallbackUsers.find(u => String(u.id) === String(incident.resolved_by));

    return Promise.resolve({
      rows: [{
        ...incident,
        alert_name: alert ? alert.name : 'Unknown Alert',
        metric_name: metric ? metric.name : null,
        metric_unit: metric ? metric.unit : null,
        resolved_by_name: user ? user.name : null,
        resolved_by_email: user ? user.email : null
      }],
      rowCount: 1
    });
  }

  // SELECT all alert_incidents for organization_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from alert_incidents') && normalizedSql.includes('where ai.organization_id = $1')) {
    const orgId = String(params[0]);
    let filtered = fallbackAlertIncidents.filter(ai => String(ai.organization_id) === orgId);

    // Filter by status/severity if in SQL / params
    if (params.length >= 2 && typeof params[1] === 'string' && ['triggered', 'acknowledged', 'resolved', 'suppressed'].includes(params[1])) {
      filtered = filtered.filter(ai => ai.status === params[1]);
    }
    if (params.length >= 3 && typeof params[2] === 'string' && ['low', 'medium', 'high', 'critical'].includes(params[2])) {
      filtered = filtered.filter(ai => ai.severity === params[2]);
    }

    const list = filtered
      .map(ai => {
        const alert = fallbackAlerts.find(a => String(a.id) === String(ai.alert_id));
        const metric = alert ? fallbackMetrics.find(m => String(m.id) === String(alert.metric_id)) : null;
        const user = fallbackUsers.find(u => String(u.id) === String(ai.resolved_by));

        return {
          ...ai,
          alert_name: alert ? alert.name : 'Operational Alert',
          metric_name: metric ? metric.name : null,
          metric_unit: metric ? metric.unit : null,
          resolved_by_name: user ? user.name : null,
          resolved_by_email: user ? user.email : null
        };
      })
      .sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT alert_incidents
  if (normalizedSql.startsWith('insert into alert_incidents')) {
    const [alert_id, organization_id, metric_value, threshold_value, condition, severity = 'medium', status = 'triggered', notification_delivery = '{}'] = params;
    const newIncident = {
      id: `00000000-0000-0000-0000-00000000000${nextAlertIncidentId++}`,
      alert_id: String(alert_id),
      organization_id: String(organization_id),
      metric_value: Number(metric_value),
      threshold_value: Number(threshold_value),
      condition,
      severity,
      status,
      notification_delivery: typeof notification_delivery === 'string' ? JSON.parse(notification_delivery) : notification_delivery,
      triggered_at: new Date(),
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      created_at: new Date()
    };
    fallbackAlertIncidents.push(newIncident);
    return Promise.resolve({
      rows: [{ ...newIncident }],
      rowCount: 1
    });
  }

  // UPDATE alert_incidents (acknowledge or resolve)
  if (normalizedSql.startsWith('update alert_incidents')) {
    if (normalizedSql.includes("status = 'acknowledged'")) {
      const [id, organization_id] = params;
      const incident = fallbackAlertIncidents.find(ai => String(ai.id) === String(id) && String(ai.organization_id) === String(organization_id));
      if (incident && incident.status === 'triggered') {
        incident.status = 'acknowledged';
        return Promise.resolve({ rows: [{ ...incident }], rowCount: 1 });
      }
      return Promise.resolve({ rows: incident ? [{ ...incident }] : [], rowCount: incident ? 1 : 0 });
    }

    if (normalizedSql.includes("status = 'resolved'")) {
      const [userId, resolutionNotes, id, organization_id] = params;
      const incident = fallbackAlertIncidents.find(ai => String(ai.id) === String(id) && String(ai.organization_id) === String(organization_id));
      if (incident && ['triggered', 'acknowledged'].includes(incident.status)) {
        incident.status = 'resolved';
        incident.resolved_at = new Date();
        incident.resolved_by = userId ? String(userId) : null;
        incident.resolution_notes = resolutionNotes || null;
        return Promise.resolve({ rows: [{ ...incident }], rowCount: 1 });
      }
      return Promise.resolve({ rows: incident ? [{ ...incident }] : [], rowCount: incident ? 1 : 0 });
    }
  }

  // Summary counts query for alerts
  if (normalizedSql.includes('select (select count(*) from alerts where organization_id = $1 and status = \'active\')')) {
    const orgId = String(params[0]);
    const activeRules = fallbackAlerts.filter(a => String(a.organization_id) === orgId && a.status === 'active').length;
    const openIncidents = fallbackAlertIncidents.filter(ai => String(ai.organization_id) === orgId && ['triggered', 'acknowledged'].includes(ai.status)).length;
    const criticalAlerts = fallbackAlerts.filter(a => String(a.organization_id) === orgId && a.severity === 'critical' && a.status === 'active').length;
    const resolvedMtd = fallbackAlertIncidents.filter(ai => String(ai.organization_id) === orgId && ai.status === 'resolved').length;

    return Promise.resolve({
      rows: [{
        active_rules: activeRules,
        open_incidents: openIncidents,
        critical_alerts: criticalAlerts,
        resolved_mtd: resolvedMtd
      }],
      rowCount: 1
    });
  }

  // ----------------- FORECASTS -----------------
  if (normalizedSql.startsWith('insert into forecasts')) {
    const [
      id,
      organizationId,
      datasetId,
      metricId,
      createdBy,
      targetColumn,
      dateColumn,
      horizonPeriods,
      interval,
      modelName,
      predictions,
      confidenceIntervals,
      metrics,
      anomalies,
      status,
      errorMessage
    ] = params;

    const newForecast = {
      id: id || `00000000-0000-0000-0000-00000000000${nextForecastId++}`,
      organization_id: String(organizationId),
      dataset_id: datasetId ? String(datasetId) : null,
      metric_id: metricId ? String(metricId) : null,
      created_by: createdBy ? String(createdBy) : null,
      target_column: targetColumn,
      date_column: dateColumn,
      horizon_periods: horizonPeriods || 30,
      interval: interval || 'daily',
      model_name: modelName || 'linear_regression',
      predictions: typeof predictions === 'string' ? JSON.parse(predictions) : (predictions || []),
      confidence_intervals: typeof confidenceIntervals === 'string' ? JSON.parse(confidenceIntervals) : (confidenceIntervals || {}),
      metrics: typeof metrics === 'string' ? JSON.parse(metrics) : (metrics || {}),
      anomalies: typeof anomalies === 'string' ? JSON.parse(anomalies) : (anomalies || []),
      status: status || 'completed',
      error_message: errorMessage || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackForecasts.push(newForecast);
    return Promise.resolve({
      rows: [{ ...newForecast }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from forecasts') && normalizedSql.includes('where f.id = $1 and f.organization_id = $2')) {
    const [id, orgId] = params;
    const forecast = fallbackForecasts.find(f => String(f.id) === String(id) && String(f.organization_id) === String(orgId));
    if (!forecast) return Promise.resolve({ rows: [], rowCount: 0 });
    const dataset = forecast.dataset_id ? fallbackDatasets.find(d => String(d.id) === String(forecast.dataset_id)) : null;
    const metric = forecast.metric_id ? fallbackMetrics.find(m => String(m.id) === String(forecast.metric_id)) : null;
    const user = forecast.created_by ? fallbackUsers.find(u => String(u.id) === String(forecast.created_by)) : null;
    return Promise.resolve({
      rows: [{
        ...forecast,
        dataset_name: dataset?.name || null,
        metric_name: metric?.name || null,
        creator_name: user?.name || null,
        creator_email: user?.email || null
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from forecasts') && normalizedSql.includes('where f.organization_id = $1')) {
    const orgId = String(params[0]);
    const limit = typeof params[1] === 'number' ? params[1] : 50;
    const items = fallbackForecasts
      .filter(f => String(f.organization_id) === orgId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(f => {
        const dataset = f.dataset_id ? fallbackDatasets.find(d => String(d.id) === String(f.dataset_id)) : null;
        const metric = f.metric_id ? fallbackMetrics.find(m => String(m.id) === String(f.metric_id)) : null;
        const user = f.created_by ? fallbackUsers.find(u => String(u.id) === String(f.created_by)) : null;
        return {
          ...f,
          dataset_name: dataset?.name || null,
          metric_name: metric?.name || null,
          creator_name: user?.name || null
        };
      });
    return Promise.resolve({ rows: items, rowCount: items.length });
  }

  if (normalizedSql.startsWith('delete from forecasts') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackForecasts.findIndex(f => String(f.id) === String(id) && String(f.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackForecasts.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ id: deleted.id }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update forecasts')) {
    const [
      targetColumn,
      dateColumn,
      horizonPeriods,
      interval,
      modelName,
      predictions,
      confidenceIntervals,
      metrics,
      anomalies,
      status,
      errorMessage,
      id,
      orgId
    ] = params;

    const forecast = fallbackForecasts.find(f => String(f.id) === String(id) && String(f.organization_id) === String(orgId));
    if (forecast) {
      forecast.target_column = targetColumn;
      forecast.date_column = dateColumn;
      forecast.horizon_periods = horizonPeriods;
      forecast.interval = interval;
      forecast.model_name = modelName;
      forecast.predictions = typeof predictions === 'string' ? JSON.parse(predictions) : (predictions || []);
      forecast.confidence_intervals = typeof confidenceIntervals === 'string' ? JSON.parse(confidenceIntervals) : (confidenceIntervals || {});
      forecast.metrics = typeof metrics === 'string' ? JSON.parse(metrics) : (metrics || {});
      forecast.anomalies = typeof anomalies === 'string' ? JSON.parse(anomalies) : (anomalies || []);
      forecast.status = status;
      forecast.error_message = errorMessage || null;
      forecast.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...forecast }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- AI CONVERSATIONS & MESSAGES -----------------
  if (normalizedSql.startsWith('insert into ai_conversations')) {
    const [id, orgId, userId, title = 'New AI Analytics Conversation', datasetId = null, dashboardId = null] = params;
    const newConv = {
      id: id || `00000000-0000-0000-0000-00000000000${nextAiConvId++}`,
      organization_id: String(orgId),
      user_id: Number(userId),
      title: title || 'New AI Analytics Conversation',
      dataset_id: datasetId ? Number(datasetId) : null,
      dashboard_id: dashboardId ? String(dashboardId) : null,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackAiConversations.push(newConv);
    return Promise.resolve({
      rows: [{ ...newConv }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from ai_conversations') && normalizedSql.includes('c.organization_id = $1 and c.user_id = $2')) {
    const [orgId, userId, limit = 50] = params;
    const items = fallbackAiConversations
      .filter(c => String(c.organization_id) === String(orgId) && Number(c.user_id) === Number(userId))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, Number(limit) || 50)
      .map(c => {
        const dataset = c.dataset_id ? fallbackDatasets.find(d => Number(d.id) === Number(c.dataset_id)) : null;
        const dash = c.dashboard_id ? fallbackDashboards.find(d => String(d.id) === String(c.dashboard_id)) : null;
        const msgs = fallbackAiMessages.filter(m => String(m.conversation_id) === String(c.id));
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].content : null;
        return {
          ...c,
          dataset_name: dataset?.name || null,
          dashboard_title: dash?.title || null,
          message_count: msgs.length,
          last_message: lastMsg
        };
      });
    return Promise.resolve({ rows: items, rowCount: items.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from ai_conversations') && normalizedSql.includes('c.id = $1 and c.organization_id = $2')) {
    const [id, orgId] = params;
    const conv = fallbackAiConversations.find(c => String(c.id) === String(id) && String(c.organization_id) === String(orgId));
    if (!conv) return Promise.resolve({ rows: [], rowCount: 0 });
    const dataset = conv.dataset_id ? fallbackDatasets.find(d => Number(d.id) === Number(conv.dataset_id)) : null;
    const dash = conv.dashboard_id ? fallbackDashboards.find(d => String(d.id) === String(conv.dashboard_id)) : null;
    return Promise.resolve({
      rows: [{
        ...conv,
        dataset_name: dataset?.name || null,
        dashboard_title: dash?.title || null
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('delete from ai_conversations') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackAiConversations.findIndex(c => String(c.id) === String(id) && String(c.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackAiConversations.splice(idx, 1)[0];
      // Cascade delete messages
      for (let i = fallbackAiMessages.length - 1; i >= 0; i--) {
        if (String(fallbackAiMessages[i].conversation_id) === String(id)) {
          fallbackAiMessages.splice(i, 1);
        }
      }
      return Promise.resolve({ rows: [{ id: deleted.id }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from ai_conversations') && normalizedSql.includes('where organization_id = $1 and user_id = $2')) {
    const [orgId, userId] = params;
    let count = 0;
    for (let i = fallbackAiConversations.length - 1; i >= 0; i--) {
      const c = fallbackAiConversations[i];
      if (String(c.organization_id) === String(orgId) && Number(c.user_id) === Number(userId)) {
        fallbackAiConversations.splice(i, 1);
        count++;
      }
    }
    return Promise.resolve({ rows: [], rowCount: count });
  }

  if (normalizedSql.startsWith('update ai_conversations set title = $1, updated_at = current_timestamp where id = $2 and organization_id = $3')) {
    const [title, id, orgId] = params;
    const conv = fallbackAiConversations.find(c => String(c.id) === String(id) && String(c.organization_id) === String(orgId));
    if (conv) {
      conv.title = title;
      conv.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...conv }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update ai_conversations set updated_at = current_timestamp where id = $1')) {
    const [id] = params;
    const conv = fallbackAiConversations.find(c => String(c.id) === String(id));
    if (conv) conv.updated_at = new Date();
    return Promise.resolve({ rows: conv ? [{ ...conv }] : [], rowCount: conv ? 1 : 0 });
  }

  if (normalizedSql.startsWith('insert into ai_messages')) {
    const [
      id,
      conversationId,
      role,
      content,
      intent,
      queryPlan,
      data,
      visualization,
      sources,
      confidence
    ] = params;

    const newMsg = {
      id: id || `00000000-0000-0000-0000-00000000000${nextAiMsgId++}`,
      conversation_id: String(conversationId),
      role,
      content,
      intent: intent || null,
      query_plan: typeof queryPlan === 'string' ? JSON.parse(queryPlan) : (queryPlan || {}),
      data: typeof data === 'string' ? JSON.parse(data) : (data || []),
      visualization: typeof visualization === 'string' ? JSON.parse(visualization) : (visualization || {}),
      sources: typeof sources === 'string' ? JSON.parse(sources) : (sources || []),
      confidence: confidence || 'high',
      created_at: new Date()
    };
    fallbackAiMessages.push(newMsg);

    const conv = fallbackAiConversations.find(c => String(c.id) === String(conversationId));
    if (conv) conv.updated_at = new Date();

    return Promise.resolve({
      rows: [{ ...newMsg }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from ai_messages') && normalizedSql.includes('where conversation_id = $1')) {
    const [convId] = params;
    const msgs = fallbackAiMessages
      .filter(m => String(m.conversation_id) === String(convId))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return Promise.resolve({ rows: msgs, rowCount: msgs.length });
  }

  // ----------------- DATASET RELATIONSHIPS -----------------
  if (normalizedSql.startsWith('insert into dataset_relationships')) {
    const [id, orgId, createdBy, sourceDatasetId, sourceColumn, targetDatasetId, targetColumn, relationshipType, description] = params;
    const newRel = {
      id: id || `00000000-0000-0000-0000-00000000000${nextRelationshipId++}`,
      organization_id: String(orgId),
      created_by: createdBy ? Number(createdBy) : null,
      source_dataset_id: Number(sourceDatasetId),
      source_column: String(sourceColumn),
      target_dataset_id: Number(targetDatasetId),
      target_column: String(targetColumn),
      relationship_type: String(relationshipType || 'many_to_one').toLowerCase(),
      description: String(description || ''),
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackRelationships.push(newRel);
    return Promise.resolve({
      rows: [{ ...newRel }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_relationships') && normalizedSql.includes('where r.organization_id = $1')) {
    const orgId = String(params[0]);
    const list = fallbackRelationships
      .filter(r => String(r.organization_id) === orgId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(r => {
        const sd = fallbackDatasets.find(d => Number(d.id) === Number(r.source_dataset_id));
        const td = fallbackDatasets.find(d => Number(d.id) === Number(r.target_dataset_id));
        const u = fallbackUsers.find(user => Number(user.id) === Number(r.created_by));
        return {
          ...r,
          source_dataset_name: sd ? sd.name : null,
          source_file_path: sd ? sd.file_path : null,
          target_dataset_name: td ? td.name : null,
          target_file_path: td ? td.file_path : null,
          creator_name: u ? u.name : null,
          creator_email: u ? u.email : null
        };
      });
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_relationships') && (normalizedSql.includes('where r.id = $1 and r.organization_id = $2') || normalizedSql.includes('where id = $1 and organization_id = $2'))) {
    const [id, orgId] = params;
    const r = fallbackRelationships.find(rel => String(rel.id) === String(id) && String(rel.organization_id) === String(orgId));
    if (!r) return Promise.resolve({ rows: [], rowCount: 0 });
    const sd = fallbackDatasets.find(d => Number(d.id) === Number(r.source_dataset_id));
    const td = fallbackDatasets.find(d => Number(d.id) === Number(r.target_dataset_id));
    return Promise.resolve({
      rows: [{
        ...r,
        source_dataset_name: sd ? sd.name : null,
        source_file_path: sd ? sd.file_path : null,
        target_dataset_name: td ? td.name : null,
        target_file_path: td ? td.file_path : null
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_relationships') && normalizedSql.includes('organization_id = $3')) {
    const [d1, d2, orgId] = params;
    const list = fallbackRelationships.filter(r => 
      String(r.organization_id) === String(orgId) &&
      ((Number(r.source_dataset_id) === Number(d1) && Number(r.target_dataset_id) === Number(d2)) ||
       (Number(r.source_dataset_id) === Number(d2) && Number(r.target_dataset_id) === Number(d1)))
    );
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('update dataset_relationships set')) {
    const [id, orgId] = params.slice(0, 2);
    const r = fallbackRelationships.find(rel => String(rel.id) === String(id) && String(rel.organization_id) === String(orgId));
    if (r) {
      let paramIdx = 2;
      if (normalizedSql.includes('source_column = $')) {
        r.source_column = params[paramIdx++];
      }
      if (normalizedSql.includes('target_column = $')) {
        r.target_column = params[paramIdx++];
      }
      if (normalizedSql.includes('relationship_type = $')) {
        r.relationship_type = params[paramIdx++];
      }
      if (normalizedSql.includes('description = $')) {
        r.description = params[paramIdx++];
      }
      r.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...r }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from dataset_relationships') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackRelationships.findIndex(r => String(r.id) === String(id) && String(r.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackRelationships.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // --- Phase 15 Data Quality Snapshots & Rules ---
  if (normalizedSql.startsWith('insert into dataset_quality_snapshots')) {
    const [
      id,
      dataset_id,
      organization_id,
      quality_score,
      status,
      completeness,
      validity,
      uniqueness,
      consistency,
      freshness,
      row_count,
      column_count,
      scan_mode,
      sample_size,
      schema_hash,
      dimensions,
      column_metrics,
      issues
    ] = params;

    const newSnapshot = {
      id: id || `snapshot-${nextQualitySnapshotId++}`,
      dataset_id: Number(dataset_id),
      organization_id: String(organization_id),
      quality_score: Number(quality_score),
      status: status || 'healthy',
      completeness: Number(completeness),
      validity: Number(validity),
      uniqueness: Number(uniqueness),
      consistency: Number(consistency),
      freshness: Number(freshness),
      row_count: Number(row_count),
      column_count: Number(column_count),
      scan_mode: scan_mode || 'FULL_SCAN',
      sample_size: sample_size !== null && sample_size !== undefined ? Number(sample_size) : null,
      schema_hash: schema_hash || null,
      dimensions: typeof dimensions === 'string' ? JSON.parse(dimensions) : (dimensions || {}),
      column_metrics: typeof column_metrics === 'string' ? JSON.parse(column_metrics) : (column_metrics || []),
      issues: typeof issues === 'string' ? JSON.parse(issues) : (issues || []),
      evaluated_at: new Date(),
      created_at: new Date()
    };

    fallbackQualitySnapshots.unshift(newSnapshot);
    return Promise.resolve({ rows: [{ ...newSnapshot }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_quality_snapshots') && normalizedSql.includes('order by evaluated_at desc limit 1')) {
    const [datasetId, orgId] = params;
    const snap = fallbackQualitySnapshots.find(s => 
      Number(s.dataset_id) === Number(datasetId) && String(s.organization_id) === String(orgId)
    );
    return Promise.resolve({ rows: snap ? [{ ...snap }] : [], rowCount: snap ? 1 : 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_quality_snapshots') && normalizedSql.includes('limit $3')) {
    const [datasetId, orgId, limit] = params;
    const snaps = fallbackQualitySnapshots
      .filter(s => Number(s.dataset_id) === Number(datasetId) && String(s.organization_id) === String(orgId))
      .slice(0, Number(limit) || 20);
    return Promise.resolve({ rows: snaps.map(s => ({ ...s })), rowCount: snaps.length });
  }

  if (normalizedSql.startsWith('insert into dataset_quality_rules')) {
    const [
      id,
      organization_id,
      dataset_id,
      column_name,
      rule_type,
      configuration,
      severity,
      enabled,
      created_by
    ] = params;

    const newRule = {
      id: id || `rule-${nextQualityRuleId++}`,
      organization_id: String(organization_id),
      dataset_id: Number(dataset_id),
      column_name: String(column_name),
      rule_type: String(rule_type),
      configuration: typeof configuration === 'string' ? JSON.parse(configuration) : (configuration || {}),
      severity: severity || 'warning',
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      created_by: created_by ? Number(created_by) : null,
      created_at: new Date(),
      updated_at: new Date()
    };

    fallbackQualityRules.push(newRule);
    return Promise.resolve({ rows: [{ ...newRule }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_quality_rules') && normalizedSql.includes('r.dataset_id = $1 and r.organization_id = $2')) {
    const [datasetId, orgId] = params;
    const rules = fallbackQualityRules
      .filter(r => Number(r.dataset_id) === Number(datasetId) && String(r.organization_id) === String(orgId))
      .map(r => {
        const u = fallbackUsers.find(user => Number(user.id) === Number(r.created_by));
        return {
          ...r,
          creator_name: u ? u.name : null,
          creator_email: u ? u.email : null
        };
      });
    return Promise.resolve({ rows: rules, rowCount: rules.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_quality_rules') && normalizedSql.includes('r.organization_id = $1')) {
    const [orgId] = params;
    const rules = fallbackQualityRules
      .filter(r => String(r.organization_id) === String(orgId))
      .map(r => {
        const d = fallbackDatasets.find(ds => Number(ds.id) === Number(r.dataset_id));
        const u = fallbackUsers.find(user => Number(user.id) === Number(r.created_by));
        return {
          ...r,
          dataset_name: d ? d.name : null,
          creator_name: u ? u.name : null,
          creator_email: u ? u.email : null
        };
      });
    return Promise.resolve({ rows: rules, rowCount: rules.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dataset_quality_rules') && normalizedSql.includes('r.id = $1 and r.organization_id = $2')) {
    const [id, orgId] = params;
    const r = fallbackQualityRules.find(rule => String(rule.id) === String(id) && String(rule.organization_id) === String(orgId));
    if (!r) return Promise.resolve({ rows: [], rowCount: 0 });
    const d = fallbackDatasets.find(ds => Number(ds.id) === Number(r.dataset_id));
    return Promise.resolve({
      rows: [{
        ...r,
        dataset_name: d ? d.name : null
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('update dataset_quality_rules set')) {
    const [id, orgId] = params.slice(0, 2);
    const r = fallbackQualityRules.find(rule => String(rule.id) === String(id) && String(rule.organization_id) === String(orgId));
    if (r) {
      let paramIdx = 2;
      if (normalizedSql.includes('column_name = $')) {
        r.column_name = params[paramIdx++];
      }
      if (normalizedSql.includes('rule_type = $')) {
        r.rule_type = params[paramIdx++];
      }
      if (normalizedSql.includes('configuration = $')) {
        const val = params[paramIdx++];
        r.configuration = typeof val === 'string' ? JSON.parse(val) : val;
      }
      if (normalizedSql.includes('severity = $')) {
        r.severity = params[paramIdx++];
      }
      if (normalizedSql.includes('enabled = $')) {
        r.enabled = Boolean(params[paramIdx++]);
      }
      r.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...r }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from dataset_quality_rules') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackQualityRules.findIndex(r => String(r.id) === String(id) && String(r.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackQualityRules.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // --- Phase 16 AI Automated Insights ---
  if (normalizedSql.startsWith('insert into ai_insights')) {
    const [
      id,
      organization_id,
      user_id,
      dataset_id,
      metric_id,
      dashboard_id,
      type,
      title,
      summary,
      severity,
      confidence,
      evidence,
      source_metadata,
      recommendation,
      status,
      feedback,
      expires_at
    ] = params;

    const newInsight = {
      id: id || `insight-${nextInsightId++}`,
      organization_id: String(organization_id),
      user_id: user_id ? Number(user_id) : null,
      dataset_id: dataset_id ? Number(dataset_id) : null,
      metric_id: metric_id ? String(metric_id) : null,
      dashboard_id: dashboard_id ? String(dashboard_id) : null,
      type: type || 'kpi',
      title: String(title),
      summary: String(summary),
      severity: severity || 'info',
      confidence: confidence !== undefined ? Number(confidence) : 0.95,
      evidence: typeof evidence === 'string' ? JSON.parse(evidence) : (evidence || {}),
      source_metadata: typeof source_metadata === 'string' ? JSON.parse(source_metadata) : (source_metadata || {}),
      recommendation: typeof recommendation === 'string' ? JSON.parse(recommendation) : (recommendation || {}),
      status: status || 'active',
      feedback: feedback || null,
      created_at: new Date(),
      expires_at: expires_at ? new Date(expires_at) : null
    };

    fallbackInsights.unshift(newInsight);
    return Promise.resolve({ rows: [{ ...newInsight }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from ai_insights') && (normalizedSql.includes('where id = $1 and organization_id = $2') || normalizedSql.includes('where i.id = $1 and i.organization_id = $2'))) {
    const [id, orgId] = params;
    const ins = fallbackInsights.find(i => String(i.id) === String(id) && String(i.organization_id) === String(orgId));
    if (!ins) return Promise.resolve({ rows: [], rowCount: 0 });
    const ds = fallbackDatasets.find(d => Number(d.id) === Number(ins.dataset_id));
    const m = fallbackMetrics.find(met => String(met.id) === String(ins.metric_id));
    return Promise.resolve({
      rows: [{
        ...ins,
        dataset_name: ds ? ds.name : null,
        metric_name: m ? m.name : null
      }],
      rowCount: 1
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from ai_insights') && normalizedSql.includes('organization_id = $1')) {
    const [orgId] = params;
    let list = fallbackInsights.filter(i => String(i.organization_id) === String(orgId));

    if (normalizedSql.includes('status = $')) {
      const statusParam = params.find((p, idx) => idx > 0 && typeof p === 'string' && ['active', 'dismissed', 'archived'].includes(p));
      if (statusParam) {
        list = list.filter(i => i.status === statusParam);
      }
    }

    if (normalizedSql.includes('type = $')) {
      const typeParam = params.find((p, idx) => idx > 0 && typeof p === 'string' && ['trend', 'growth', 'decline', 'anomaly', 'forecast', 'kpi', 'data_quality', 'relationship', 'comparison', 'ranking', 'operational', 'executive_summary'].includes(p));
      if (typeParam) {
        list = list.filter(i => i.type === typeParam);
      }
    }

    if (normalizedSql.includes('severity = $')) {
      const sevParam = params.find((p, idx) => idx > 0 && typeof p === 'string' && ['info', 'positive', 'warning', 'critical'].includes(p));
      if (sevParam) {
        list = list.filter(i => i.severity === sevParam);
      }
    }

    if (normalizedSql.includes('dataset_id = $')) {
      const dsParam = params.find((p, idx) => idx > 0 && typeof p === 'number');
      if (dsParam) {
        list = list.filter(i => Number(i.dataset_id) === Number(dsParam));
      }
    }

    // Deduplicate when DISTINCT ON / deduplicated is specified in query
    if (normalizedSql.includes('distinct on') || normalizedSql.includes('deduplicated')) {
      const seen = new Set();
      const deduped = [];
      const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      for (const item of sorted) {
        const key = `${item.type}:::${item.dataset_id || 0}:::${String(item.title).trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }
      list = deduped;
    }

    const enriched = list.map(ins => {
      const ds = fallbackDatasets.find(d => Number(d.id) === Number(ins.dataset_id));
      const m = fallbackMetrics.find(met => String(met.id) === String(ins.metric_id));
      return {
        ...ins,
        dataset_name: ds ? ds.name : null,
        metric_name: m ? m.name : null
      };
    });

    return Promise.resolve({ rows: enriched, rowCount: enriched.length });
  }

  if (normalizedSql.startsWith('update ai_insights set')) {
    if (normalizedSql.includes('status = $1')) {
      const [status, id, orgId] = params;
      const ins = fallbackInsights.find(i => String(i.id) === String(id) && String(i.organization_id) === String(orgId));
      if (ins) {
        ins.status = status;
        return Promise.resolve({ rows: [{ ...ins }], rowCount: 1 });
      }
    } else if (normalizedSql.includes('feedback = $1')) {
      const [feedback, id, orgId] = params;
      const ins = fallbackInsights.find(i => String(i.id) === String(id) && String(i.organization_id) === String(orgId));
      if (ins) {
        ins.feedback = feedback;
        return Promise.resolve({ rows: [{ ...ins }], rowCount: 1 });
      }
    } else {
      const [id, orgId] = params.slice(-2);
      const ins = fallbackInsights.find(i => String(i.id) === String(id) && String(i.organization_id) === String(orgId));
      if (ins) {
        const setPart = normalizedSql.split('set ')[1]?.split(' where ')[0] || '';
        const setClauses = setPart.split(',').map(s => s.trim());
        setClauses.forEach((clause, idx) => {
          const col = clause.split('=')[0]?.trim();
          if (col && params[idx] !== undefined) {
            if (col === 'evidence' || col === 'source_metadata' || col === 'recommendation') {
              ins[col] = typeof params[idx] === 'string' ? JSON.parse(params[idx]) : params[idx];
            } else {
              ins[col] = params[idx];
            }
          }
        });
        return Promise.resolve({ rows: [{ ...ins }], rowCount: 1 });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from ai_insights') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackInsights.findIndex(i => String(i.id) === String(id) && String(i.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackInsights.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- PHASE 17: TEAMS -----------------
  if (normalizedSql.startsWith('insert into teams')) {
    const [organization_id, name, description = '', created_by] = params;
    const newTeam = {
      id: `00000000-0000-0000-0000-0000000000${String(nextTeamId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      name,
      description: description || '',
      created_by: created_by ? Number(created_by) : null,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackTeams.push(newTeam);
    return Promise.resolve({ rows: [{ ...newTeam }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from teams t') && normalizedSql.includes('where t.id = $1 and t.organization_id = $2')) {
    const [id, orgId] = params;
    const team = fallbackTeams.find(t => String(t.id) === String(id) && String(t.organization_id) === String(orgId));
    if (team) {
      const u = fallbackUsers.find(user => Number(user.id) === Number(team.created_by));
      return Promise.resolve({
        rows: [{
          ...team,
          creator_name: u ? u.name : 'Admin'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from teams t') && normalizedSql.includes('where t.organization_id = $1')) {
    const [orgId] = params;
    const list = fallbackTeams
      .filter(t => String(t.organization_id) === String(orgId))
      .map(t => {
        const u = fallbackUsers.find(user => Number(user.id) === Number(t.created_by));
        const memberCount = fallbackTeamMembers.filter(tm => String(tm.team_id) === String(t.id)).length;
        return {
          ...t,
          creator_name: u ? u.name : 'Admin',
          member_count: memberCount
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('update teams')) {
    const [name, description, id, orgId] = params;
    const team = fallbackTeams.find(t => String(t.id) === String(id) && String(t.organization_id) === String(orgId));
    if (team) {
      if (name) team.name = name;
      if (description !== undefined) team.description = description;
      team.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...team }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from teams') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackTeams.findIndex(t => String(t.id) === String(id) && String(t.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackTeams.splice(idx, 1)[0];
      // Cascade delete members and shares
      for (let i = fallbackTeamMembers.length - 1; i >= 0; i--) {
        if (String(fallbackTeamMembers[i].team_id) === String(id)) fallbackTeamMembers.splice(i, 1);
      }
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- PHASE 17: TEAM MEMBERS -----------------
  if (normalizedSql.startsWith('insert into team_members')) {
    const [team_id, user_id, role = 'member'] = params;
    const existingIdx = fallbackTeamMembers.findIndex(tm => String(tm.team_id) === String(team_id) && Number(tm.user_id) === Number(user_id));
    if (existingIdx !== -1) {
      fallbackTeamMembers[existingIdx].role = role;
      return Promise.resolve({ rows: [{ ...fallbackTeamMembers[existingIdx] }], rowCount: 1 });
    }
    const newMember = {
      id: `00000000-0000-0000-0000-0000000000${String(nextTeamMemberId++).padStart(2, '0')}`,
      team_id: String(team_id),
      user_id: Number(user_id),
      role: role || 'member',
      created_at: new Date()
    };
    fallbackTeamMembers.push(newMember);
    return Promise.resolve({ rows: [{ ...newMember }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from team_members') && normalizedSql.includes('where team_id = $1 and user_id = $2')) {
    const [teamId, userId] = params;
    const exists = fallbackTeamMembers.some(tm => String(tm.team_id) === String(teamId) && Number(tm.user_id) === Number(userId));
    return Promise.resolve({
      rows: exists ? [{ '?column?': 1 }] : [],
      rowCount: exists ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('delete from team_members') && normalizedSql.includes('where team_id = $1 and user_id = $2')) {
    const [teamId, userId] = params;
    const idx = fallbackTeamMembers.findIndex(tm => String(tm.team_id) === String(teamId) && Number(tm.user_id) === Number(userId));
    if (idx !== -1) {
      const deleted = fallbackTeamMembers.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from team_members tm') && normalizedSql.includes('where tm.team_id = $1')) {
    const [teamId] = params;
    const list = fallbackTeamMembers
      .filter(tm => String(tm.team_id) === String(teamId))
      .map(tm => {
        const u = fallbackUsers.find(user => Number(user.id) === Number(tm.user_id));
        return {
          ...tm,
          user_name: u ? u.name : 'Unknown User',
          user_email: u ? u.email : '',
          platform_role: u ? u.role : 'viewer'
        };
      });
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from team_members tm') && normalizedSql.includes('where tm.user_id = $1 and t.organization_id = $2')) {
    const [userId, orgId] = params;
    const userMemberships = fallbackTeamMembers.filter(tm => Number(tm.user_id) === Number(userId));
    const list = [];
    for (const mem of userMemberships) {
      const team = fallbackTeams.find(t => String(t.id) === String(mem.team_id) && String(t.organization_id) === String(orgId));
      if (team) {
        list.push({
          id: team.id,
          organization_id: team.organization_id,
          name: team.name,
          description: team.description,
          team_role: mem.role
        });
      }
    }
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  // ----------------- PHASE 17: SHARES (DASHBOARD, REPORT, INSIGHT) -----------------
  if (normalizedSql.startsWith('insert into dashboard_shares')) {
    const [organization_id, dashboard_id, shared_by, user_id = null, team_id = null, permission = 'viewer'] = params;
    const newShare = {
      id: `00000000-0000-0000-0000-0000000000${String(nextDashShareId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      dashboard_id: String(dashboard_id),
      shared_by: Number(shared_by),
      user_id: user_id ? Number(user_id) : null,
      team_id: team_id ? String(team_id) : null,
      permission: permission || 'viewer',
      created_at: new Date()
    };
    fallbackDashboardShares.push(newShare);
    return Promise.resolve({ rows: [{ ...newShare }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from dashboard_shares ds') && normalizedSql.includes('where ds.dashboard_id = $1 and ds.organization_id = $2')) {
    const [dashId, orgId] = params;
    const list = fallbackDashboardShares
      .filter(ds => String(ds.dashboard_id) === String(dashId) && String(ds.organization_id) === String(orgId))
      .map(ds => {
        const u = ds.user_id ? fallbackUsers.find(user => Number(user.id) === Number(ds.user_id)) : null;
        const t = ds.team_id ? fallbackTeams.find(team => String(team.id) === String(ds.team_id)) : null;
        const sb = fallbackUsers.find(user => Number(user.id) === Number(ds.shared_by));
        return {
          ...ds,
          target_user_name: u ? u.name : null,
          target_user_email: u ? u.email : null,
          target_team_name: t ? t.name : null,
          shared_by_name: sb ? sb.name : 'User'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('delete from dashboard_shares') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackDashboardShares.findIndex(ds => String(ds.id) === String(id) && String(ds.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackDashboardShares.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('insert into report_shares')) {
    const [organization_id, report_id, shared_by, user_id = null, team_id = null, permission = 'viewer'] = params;
    const newShare = {
      id: `00000000-0000-0000-0000-0000000000${String(nextReportShareId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      report_id: String(report_id),
      shared_by: Number(shared_by),
      user_id: user_id ? Number(user_id) : null,
      team_id: team_id ? String(team_id) : null,
      permission: permission || 'viewer',
      created_at: new Date()
    };
    fallbackReportShares.push(newShare);
    return Promise.resolve({ rows: [{ ...newShare }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from report_shares rs') && normalizedSql.includes('where rs.report_id = $1 and rs.organization_id = $2')) {
    const [repId, orgId] = params;
    const list = fallbackReportShares
      .filter(rs => String(rs.report_id) === String(repId) && String(rs.organization_id) === String(orgId))
      .map(rs => {
        const u = rs.user_id ? fallbackUsers.find(user => Number(user.id) === Number(rs.user_id)) : null;
        const t = rs.team_id ? fallbackTeams.find(team => String(team.id) === String(rs.team_id)) : null;
        const sb = fallbackUsers.find(user => Number(user.id) === Number(rs.shared_by));
        return {
          ...rs,
          target_user_name: u ? u.name : null,
          target_user_email: u ? u.email : null,
          target_team_name: t ? t.name : null,
          shared_by_name: sb ? sb.name : 'User'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('delete from report_shares') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackReportShares.findIndex(rs => String(rs.id) === String(id) && String(rs.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackReportShares.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('insert into insight_shares')) {
    const [organization_id, insight_id, shared_by, user_id = null, team_id = null, permission = 'viewer'] = params;
    const newShare = {
      id: `00000000-0000-0000-0000-0000000000${String(nextInsightShareId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      insight_id: String(insight_id),
      shared_by: Number(shared_by),
      user_id: user_id ? Number(user_id) : null,
      team_id: team_id ? String(team_id) : null,
      permission: permission || 'viewer',
      created_at: new Date()
    };
    fallbackInsightShares.push(newShare);
    return Promise.resolve({ rows: [{ ...newShare }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from insight_shares ins') && normalizedSql.includes('where ins.insight_id = $1 and ins.organization_id = $2')) {
    const [insId, orgId] = params;
    const list = fallbackInsightShares
      .filter(ins => String(ins.insight_id) === String(insId) && String(ins.organization_id) === String(orgId))
      .map(ins => {
        const u = ins.user_id ? fallbackUsers.find(user => Number(user.id) === Number(ins.user_id)) : null;
        const t = ins.team_id ? fallbackTeams.find(team => String(team.id) === String(ins.team_id)) : null;
        const sb = fallbackUsers.find(user => Number(user.id) === Number(ins.shared_by));
        return {
          ...ins,
          target_user_name: u ? u.name : null,
          target_user_email: u ? u.email : null,
          target_team_name: t ? t.name : null,
          shared_by_name: sb ? sb.name : 'User'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('delete from insight_shares') && normalizedSql.includes('where id = $1 and organization_id = $2')) {
    const [id, orgId] = params;
    const idx = fallbackInsightShares.findIndex(ins => String(ins.id) === String(id) && String(ins.organization_id) === String(orgId));
    if (idx !== -1) {
      const deleted = fallbackInsightShares.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- PHASE 17: COMMENTS -----------------
  if (normalizedSql.startsWith('insert into comments')) {
    const [organization_id, user_id, resource_type, resource_id, parent_comment_id = null, content, mentions = []] = params;
    const newComment = {
      id: `00000000-0000-0000-0000-0000000000${String(nextCommentId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      user_id: Number(user_id),
      resource_type,
      resource_id: String(resource_id),
      parent_comment_id: parent_comment_id ? String(parent_comment_id) : null,
      content,
      mentions: typeof mentions === 'string' ? JSON.parse(mentions) : mentions,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    };
    fallbackComments.push(newComment);
    return Promise.resolve({ rows: [{ ...newComment }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from comments c') && normalizedSql.includes('c.resource_type = $2 and c.resource_id = $3')) {
    const [orgId, resType, resId] = params;
    const list = fallbackComments
      .filter(c => String(c.organization_id) === String(orgId) && c.resource_type === resType && String(c.resource_id) === String(resId) && !c.deleted_at)
      .map(c => {
        const u = fallbackUsers.find(user => Number(user.id) === Number(c.user_id));
        return {
          ...c,
          author_name: u ? u.name : 'Unknown User',
          author_email: u ? u.email : '',
          author_role: u ? u.role : 'viewer'
        };
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('update comments set content = $1')) {
    const [content, id, userId, orgId] = params;
    const c = fallbackComments.find(comm => String(comm.id) === String(id) && Number(comm.user_id) === Number(userId) && String(comm.organization_id) === String(orgId) && !comm.deleted_at);
    if (c) {
      c.content = content;
      c.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...c }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update comments set deleted_at = current_timestamp')) {
    if (params.length === 2) {
      // Admin/manager delete: id, orgId
      const [id, orgId] = params;
      const c = fallbackComments.find(comm => String(comm.id) === String(id) && String(comm.organization_id) === String(orgId));
      if (c) {
        c.deleted_at = new Date();
        return Promise.resolve({ rows: [{ ...c }], rowCount: 1 });
      }
    } else {
      // User delete: id, userId, orgId
      const [id, userId, orgId] = params;
      const c = fallbackComments.find(comm => String(comm.id) === String(id) && Number(comm.user_id) === Number(userId) && String(comm.organization_id) === String(orgId));
      if (c) {
        c.deleted_at = new Date();
        return Promise.resolve({ rows: [{ ...c }], rowCount: 1 });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- PHASE 17: FAVORITES -----------------
  if (normalizedSql.startsWith('insert into favorites')) {
    const [organization_id, user_id, resource_type, resource_id] = params;
    const existing = fallbackFavorites.find(f => Number(f.user_id) === Number(user_id) && f.resource_type === resource_type && String(f.resource_id) === String(resource_id));
    if (existing) {
      return Promise.resolve({ rows: [{ ...existing }], rowCount: 1 });
    }
    const newFav = {
      id: `00000000-0000-0000-0000-0000000000${String(nextFavoriteId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      user_id: Number(user_id),
      resource_type,
      resource_id: String(resource_id),
      created_at: new Date()
    };
    fallbackFavorites.push(newFav);
    return Promise.resolve({ rows: [{ ...newFav }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('delete from favorites') && normalizedSql.includes('where organization_id = $1 and user_id = $2 and resource_type = $3 and resource_id = $4')) {
    const [orgId, userId, resType, resId] = params;
    const idx = fallbackFavorites.findIndex(f => String(f.organization_id) === String(orgId) && Number(f.user_id) === Number(userId) && f.resource_type === resType && String(f.resource_id) === String(resId));
    if (idx !== -1) {
      const deleted = fallbackFavorites.splice(idx, 1)[0];
      return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('select id from favorites') && normalizedSql.includes('where user_id = $1 and resource_type = $2 and resource_id = $3')) {
    const [userId, resType, resId] = params;
    const fav = fallbackFavorites.find(f => Number(f.user_id) === Number(userId) && f.resource_type === resType && String(f.resource_id) === String(resId));
    return Promise.resolve({ rows: fav ? [{ id: fav.id }] : [], rowCount: fav ? 1 : 0 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from favorites f') && normalizedSql.includes('where f.user_id = $1 and f.organization_id = $2')) {
    const [userId, orgId] = params;
    const list = fallbackFavorites
      .filter(f => Number(f.user_id) === Number(userId) && String(f.organization_id) === String(orgId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  // ----------------- PHASE 17: RECENTLY VIEWED -----------------
  if (normalizedSql.startsWith('insert into recently_viewed')) {
    const [organization_id, user_id, resource_type, resource_id] = params;
    const existing = fallbackRecentlyViewed.find(r => Number(r.user_id) === Number(user_id) && r.resource_type === resource_type && String(r.resource_id) === String(resource_id));
    if (existing) {
      existing.viewed_at = new Date();
      return Promise.resolve({ rows: [{ ...existing }], rowCount: 1 });
    }
    const newRecent = {
      id: `00000000-0000-0000-0000-0000000000${String(nextRecentlyViewedId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      user_id: Number(user_id),
      resource_type,
      resource_id: String(resource_id),
      viewed_at: new Date()
    };
    fallbackRecentlyViewed.push(newRecent);
    return Promise.resolve({ rows: [{ ...newRecent }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from recently_viewed rv') && normalizedSql.includes('where rv.user_id = $1 and rv.organization_id = $2')) {
    const [userId, orgId, limit = 20] = params;
    const list = fallbackRecentlyViewed
      .filter(r => Number(r.user_id) === Number(userId) && String(r.organization_id) === String(orgId))
      .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at))
      .slice(0, limit);
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  // ----------------- PHASE 17: SAVED VIEWS -----------------
  if (normalizedSql.startsWith('insert into saved_views')) {
    const [organization_id, user_id, dashboard_id, name, filters = {}, is_shared = false] = params;
    const newView = {
      id: `00000000-0000-0000-0000-0000000000${String(nextSavedViewId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      user_id: Number(user_id),
      dashboard_id: String(dashboard_id),
      name,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
      is_shared: Boolean(is_shared),
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackSavedViews.push(newView);
    return Promise.resolve({ rows: [{ ...newView }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from saved_views sv') && normalizedSql.includes('where sv.organization_id = $1 and sv.dashboard_id = $2')) {
    const [orgId, dashId, userId] = params;
    const list = fallbackSavedViews
      .filter(sv => String(sv.organization_id) === String(orgId) && String(sv.dashboard_id) === String(dashId) && (Number(sv.user_id) === Number(userId) || sv.is_shared))
      .map(sv => {
        const u = fallbackUsers.find(user => Number(user.id) === Number(sv.user_id));
        return {
          ...sv,
          creator_name: u ? u.name : 'Analyst'
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from saved_views sv') && normalizedSql.includes('where sv.id = $1 and sv.organization_id = $2')) {
    const [id, orgId] = params;
    const sv = fallbackSavedViews.find(view => String(view.id) === String(id) && String(view.organization_id) === String(orgId));
    return Promise.resolve({ rows: sv ? [{ ...sv }] : [], rowCount: sv ? 1 : 0 });
  }

  if (normalizedSql.startsWith('update saved_views')) {
    const [name, filters, isShared, id, userId, orgId] = params;
    const sv = fallbackSavedViews.find(view => String(view.id) === String(id) && Number(view.user_id) === Number(userId) && String(view.organization_id) === String(orgId));
    if (sv) {
      if (name) sv.name = name;
      if (filters !== null && filters !== undefined) sv.filters = typeof filters === 'string' ? JSON.parse(filters) : filters;
      if (isShared !== null && isShared !== undefined) sv.is_shared = Boolean(isShared);
      sv.updated_at = new Date();
      return Promise.resolve({ rows: [{ ...sv }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('delete from saved_views')) {
    if (params.length === 2) {
      // Admin/manager delete: id, orgId
      const [id, orgId] = params;
      const idx = fallbackSavedViews.findIndex(view => String(view.id) === String(id) && String(view.organization_id) === String(orgId));
      if (idx !== -1) {
        const deleted = fallbackSavedViews.splice(idx, 1)[0];
        return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
      }
    } else {
      // User delete: id, userId, orgId
      const [id, userId, orgId] = params;
      const idx = fallbackSavedViews.findIndex(view => String(view.id) === String(id) && Number(view.user_id) === Number(userId) && String(view.organization_id) === String(orgId));
      if (idx !== -1) {
        const deleted = fallbackSavedViews.splice(idx, 1)[0];
        return Promise.resolve({ rows: [{ ...deleted }], rowCount: 1 });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // ----------------- PHASE 17: NOTIFICATIONS -----------------
  if (normalizedSql.startsWith('insert into notifications')) {
    const [organization_id, user_id, actor_id = null, type, title, message, resource_type = null, resource_id = null] = params;
    const newNotif = {
      id: `00000000-0000-0000-0000-0000000000${String(nextNotificationId++).padStart(2, '0')}`,
      organization_id: String(organization_id),
      user_id: Number(user_id),
      actor_id: actor_id ? Number(actor_id) : null,
      type,
      title,
      message,
      resource_type: resource_type || null,
      resource_id: resource_id ? String(resource_id) : null,
      read_at: null,
      created_at: new Date()
    };
    fallbackNotifications.push(newNotif);
    return Promise.resolve({ rows: [{ ...newNotif }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from notifications n') && normalizedSql.includes('where n.user_id = $1 and n.organization_id = $2')) {
    const [userId, orgId, limit = 30] = params;
    const list = fallbackNotifications
      .filter(n => Number(n.user_id) === Number(userId) && String(n.organization_id) === String(orgId))
      .map(n => {
        const u = n.actor_id ? fallbackUsers.find(user => Number(user.id) === Number(n.actor_id)) : null;
        return {
          ...n,
          actor_name: u ? u.name : 'System',
          actor_email: u ? u.email : ''
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    return Promise.resolve({ rows: list, rowCount: list.length });
  }

  if (normalizedSql.startsWith('select count(*)::integer as unread_count from notifications')) {
    const [userId, orgId] = params;
    const unreadCount = fallbackNotifications.filter(n => Number(n.user_id) === Number(userId) && String(n.organization_id) === String(orgId) && !n.read_at).length;
    return Promise.resolve({ rows: [{ unread_count: unreadCount }], rowCount: 1 });
  }

  if (normalizedSql.startsWith('update notifications set read_at = current_timestamp') && normalizedSql.includes('where id = $1')) {
    const [id, userId, orgId] = params;
    const notif = fallbackNotifications.find(n => String(n.id) === String(id) && Number(n.user_id) === Number(userId) && String(n.organization_id) === String(orgId));
    if (notif) {
      notif.read_at = new Date();
      return Promise.resolve({ rows: [{ ...notif }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  if (normalizedSql.startsWith('update notifications set read_at = current_timestamp') && normalizedSql.includes('read_at is null')) {
    const [userId, orgId] = params;
    const updated = [];
    fallbackNotifications.forEach(n => {
      if (Number(n.user_id) === Number(userId) && String(n.organization_id) === String(orgId) && !n.read_at) {
        n.read_at = new Date();
        updated.push(n);
      }
    });
    return Promise.resolve({ rows: updated, rowCount: updated.length });
  }

  // Schema creation or other generic commands
  return Promise.resolve({ rows: [], rowCount: 0 });
}

/**
 * Initialize database schema
 */
async function initDb() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'manager', 'viewer')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS data_sources (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('csv', 'json', 'postgresql')),
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'connected', 'error', 'pending')),
      config JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON data_sources(user_id);
    CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);

    CREATE TABLE IF NOT EXISTS datasets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_source_id INTEGER REFERENCES data_sources(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      file_path VARCHAR(500),
      row_count INTEGER DEFAULT 0,
      column_count INTEGER DEFAULT 0,
      schema JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
    CREATE INDEX IF NOT EXISTS idx_datasets_data_source_id ON datasets(data_source_id);
  `;

  try {
    await query(schemaSql);
    console.log(' PostgreSQL Database schema initialized successfully');
  } catch (err) {
    console.error(' Failed to initialize PostgreSQL database schema:', err.message);
  }
}

module.exports = {
  query,
  initDb,
  getPool: () => pool,
  isUsingFallback: () => useFallbackStore,
  closeDb: async () => {
    if (pool) {
      try {
        await pool.end();
        console.log(' PostgreSQL database pool closed cleanly.');
      } catch (err) {
        console.warn(' PostgreSQL pool close warning:', err.message);
      }
    }
  },
  _resetFallbackStore: () => {
    fallbackUsers.length = 0;
    fallbackDataSources.length = 0;
    fallbackDatasets.length = 0;
    fallbackDatasets.push({
      id: 1,
      user_id: 1,
      data_source_id: null,
      organization_id: '00000000-0000-0000-0000-000000000001',
      name: 'Indian Enterprise Sales Telemetry (Q4)',
      description: 'Enterprise sales transactions across Indian hubs, channels, and product categories',
      file_path: '1/sample_sales_q4.csv',
      row_count: 20,
      column_count: 10,
      schema: JSON.stringify(sampleDataset1Schema),
      created_at: new Date('2026-01-15T10:30:00Z'),
      updated_at: new Date('2026-01-15T10:30:00Z')
    });
    fallbackMetrics.length = 0;
    fallbackDashboards.length = 0;
    fallbackDashboardWidgets.length = 0;
    fallbackReports.length = 0;
    fallbackReportExecutions.length = 0;
    fallbackAlerts.length = 0;
    fallbackAlertIncidents.length = 0;
    fallbackForecasts.length = 0;
    fallbackAiConversations.length = 0;
    fallbackAiMessages.length = 0;
    fallbackAuditLogs.length = 0;
    fallbackRelationships.length = 0;
    fallbackQualitySnapshots.length = 0;
    fallbackQualityRules.length = 0;
    fallbackInsights.length = 0;
    fallbackTeams.length = 0;
    fallbackTeams.push({
      id: '00000000-0000-0000-0000-000000000001',
      organization_id: '00000000-0000-0000-0000-000000000001',
      name: 'xyz',
      description: 'Core product engineering & analytics team',
      created_by: 1,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    });
    fallbackTeamMembers.length = 0;
    fallbackTeamMembers.push({
      id: '00000000-0000-0000-0000-000000000001',
      team_id: '00000000-0000-0000-0000-000000000001',
      user_id: 1,
      role: 'lead',
      created_at: new Date('2026-01-01T00:00:00Z')
    });
    fallbackDashboardShares.length = 0;
    fallbackReportShares.length = 0;
    fallbackInsightShares.length = 0;
    fallbackComments.length = 0;
    fallbackFavorites.length = 0;
    fallbackRecentlyViewed.length = 0;
    fallbackSavedViews.length = 0;
    fallbackNotifications.length = 0;
    nextUserId = 1;
    nextDataSourceId = 1;
    nextDatasetId = 1;
    nextMetricId = 1;
    nextDashboardId = 1;
    nextWidgetId = 1;
    nextReportId = 1;
    nextExecutionId = 1;
    nextAlertId = 1;
    nextAlertIncidentId = 1;
    nextForecastId = 1;
    nextAiConvId = 1;
    nextAiMsgId = 1;
    nextAuditLogId = 1;
    nextRelationshipId = 1;
    nextQualitySnapshotId = 1;
    nextQualityRuleId = 1;
    nextInsightId = 1;
    nextTeamId = 1;
    nextTeamMemberId = 1;
    nextDashShareId = 1;
    nextReportShareId = 1;
    nextInsightShareId = 1;
    nextCommentId = 1;
    nextFavoriteId = 1;
    nextRecentlyViewedId = 1;
    nextSavedViewId = 1;
    nextNotificationId = 1;
  }
};
