const db = require('../config/database');

/**
 * Dashboard & Dashboard Widget Data Access Model
 * Multi-tenant PostgreSQL Model for Enterprise Dashboards
 */
const DashboardModel = {
  /**
   * Find all dashboards for an organization
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        d.id,
        d.organization_id,
        d.created_by,
        d.title,
        d.description,
        d.is_default,
        d.is_public,
        d.layout,
        d.filters,
        d.created_at,
        d.updated_at,
        u.name as creator_name,
        u.email as creator_email,
        (SELECT COUNT(*) FROM dashboard_widgets w WHERE w.dashboard_id = d.id)::integer as widget_count
      FROM dashboards d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.organization_id = $1
      ORDER BY d.is_default DESC, d.created_at DESC;
    `;
    const result = await db.query(sql, [organizationId]);
    return result.rows || [];
  },

  /**
   * Find a dashboard by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        d.id,
        d.organization_id,
        d.created_by,
        d.title,
        d.description,
        d.is_default,
        d.is_public,
        d.layout,
        d.filters,
        d.created_at,
        d.updated_at,
        u.name as creator_name,
        u.email as creator_email
      FROM dashboards d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = $1 AND d.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Create a new dashboard
   * @param {{
   *   organizationId: string,
   *   createdBy: string|number,
   *   title: string,
   *   description?: string,
   *   isDefault?: boolean,
   *   isPublic?: boolean,
   *   layout?: any,
   *   filters?: any
   * }} data
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    createdBy,
    title,
    description = '',
    isDefault = false,
    isPublic = false,
    layout = [],
    filters = {}
  }) {
    // If setting as default, unset existing defaults for this organization
    if (isDefault) {
      await db.query(
        `UPDATE dashboards SET is_default = false WHERE organization_id = $1 AND is_default = true`,
        [organizationId]
      );
    }

    const sql = `
      INSERT INTO dashboards (
        organization_id,
        created_by,
        title,
        description,
        is_default,
        is_public,
        layout,
        filters
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      organizationId,
      createdBy,
      title.trim(),
      description ? description.trim() : '',
      Boolean(isDefault),
      Boolean(isPublic),
      typeof layout === 'object' ? JSON.stringify(layout) : layout,
      typeof filters === 'object' ? JSON.stringify(filters) : filters
    ]);

    return result.rows[0];
  },

  /**
   * Update a dashboard by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @param {object} updates 
   * @returns {Promise<any | null>}
   */
  async updateByIdAndOrgId(id, organizationId, updates = {}) {
    const existing = await this.findByIdAndOrgId(id, organizationId);
    if (!existing) return null;

    if (updates.isDefault || updates.is_default) {
      await db.query(
        `UPDATE dashboards SET is_default = false WHERE organization_id = $1 AND is_default = true AND id != $2`,
        [organizationId, id]
      );
    }

    const newTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const newDesc = updates.description !== undefined ? updates.description.trim() : existing.description;
    const newIsDefault = updates.isDefault !== undefined ? Boolean(updates.isDefault) : (updates.is_default !== undefined ? Boolean(updates.is_default) : existing.is_default);
    const newIsPublic = updates.isPublic !== undefined ? Boolean(updates.isPublic) : (updates.is_public !== undefined ? Boolean(updates.is_public) : existing.is_public);
    const newLayout = updates.layout !== undefined ? (typeof updates.layout === 'object' ? JSON.stringify(updates.layout) : updates.layout) : existing.layout;
    const newFilters = updates.filters !== undefined ? (typeof updates.filters === 'object' ? JSON.stringify(updates.filters) : updates.filters) : existing.filters;

    const sql = `
      UPDATE dashboards
      SET 
        title = $1,
        description = $2,
        is_default = $3,
        is_public = $4,
        layout = $5,
        filters = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND organization_id = $8
      RETURNING *;
    `;

    const result = await db.query(sql, [
      newTitle,
      newDesc,
      newIsDefault,
      newIsPublic,
      newLayout,
      newFilters,
      id,
      organizationId
    ]);

    return result.rows[0] || null;
  },

  /**
   * Delete a dashboard by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<boolean>}
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM dashboards
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return Boolean(result.rows && result.rows.length > 0);
  },

  // ==========================================================================
  // WIDGET OPERATIONS
  // ==========================================================================

  /**
   * Find all widgets for a dashboard with enriched dataset and metric metadata
   * @param {string} dashboardId 
   * @returns {Promise<Array<any>>}
   */
  async findWidgetsByDashboardId(dashboardId) {
    const sql = `
      SELECT 
        w.id,
        w.dashboard_id,
        w.dataset_id,
        w.metric_id,
        w.title,
        w.type,
        w.configuration,
        w.position,
        w.created_at,
        w.updated_at,
        ds.name as dataset_name,
        ds.file_path as dataset_file_path,
        m.name as metric_name,
        m.formula as metric_formula,
        m.type as metric_type,
        m.unit as metric_unit,
        m.target_value as metric_target_value,
        m.formatting as metric_formatting
      FROM dashboard_widgets w
      LEFT JOIN datasets ds ON w.dataset_id = ds.id
      LEFT JOIN metrics m ON w.metric_id = m.id
      WHERE w.dashboard_id = $1
      ORDER BY w.created_at ASC;
    `;
    const result = await db.query(sql, [dashboardId]);
    return result.rows || [];
  },

  /**
   * Find a specific widget by ID and dashboard ID
   * @param {string} widgetId 
   * @param {string} dashboardId 
   * @returns {Promise<any | null>}
   */
  async findWidgetById(widgetId, dashboardId) {
    const sql = `
      SELECT 
        w.id,
        w.dashboard_id,
        w.dataset_id,
        w.metric_id,
        w.title,
        w.type,
        w.configuration,
        w.position,
        w.created_at,
        w.updated_at,
        ds.name as dataset_name,
        ds.file_path as dataset_file_path,
        m.name as metric_name,
        m.formula as metric_formula,
        m.type as metric_type,
        m.unit as metric_unit,
        m.target_value as metric_target_value,
        m.formatting as metric_formatting
      FROM dashboard_widgets w
      LEFT JOIN datasets ds ON w.dataset_id = ds.id
      LEFT JOIN metrics m ON w.metric_id = m.id
      WHERE w.id = $1 AND w.dashboard_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [widgetId, dashboardId]);
    return result.rows[0] || null;
  },

  /**
   * Add a widget to a dashboard
   * @param {string} dashboardId 
   * @param {{
   *   datasetId?: string,
   *   metricId?: string,
   *   title: string,
   *   type: string,
   *   configuration?: any,
   *   position?: any
   * }} widgetData 
   * @returns {Promise<any>}
   */
  async addWidget(dashboardId, {
    datasetId = null,
    metricId = null,
    title,
    type,
    configuration = {},
    position = { x: 0, y: 0, w: 6, h: 4 }
  }) {
    const sql = `
      INSERT INTO dashboard_widgets (
        dashboard_id,
        dataset_id,
        metric_id,
        title,
        type,
        configuration,
        position
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      dashboardId,
      datasetId || null,
      metricId || null,
      title.trim(),
      type,
      typeof configuration === 'object' ? JSON.stringify(configuration) : configuration,
      typeof position === 'object' ? JSON.stringify(position) : position
    ]);

    return result.rows[0];
  },

  /**
   * Update a widget configuration / position
   * @param {string} widgetId 
   * @param {string} dashboardId 
   * @param {object} updates 
   * @returns {Promise<any | null>}
   */
  async updateWidget(widgetId, dashboardId, updates = {}) {
    const existing = await this.findWidgetById(widgetId, dashboardId);
    if (!existing) return null;

    const newTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const newType = updates.type !== undefined ? updates.type : existing.type;
    const newDatasetId = updates.datasetId !== undefined ? updates.datasetId : (updates.dataset_id !== undefined ? updates.dataset_id : existing.dataset_id);
    const newMetricId = updates.metricId !== undefined ? updates.metricId : (updates.metric_id !== undefined ? updates.metric_id : existing.metric_id);
    
    let newConfig = existing.configuration;
    if (updates.configuration !== undefined) {
      newConfig = typeof updates.configuration === 'object' ? JSON.stringify(updates.configuration) : updates.configuration;
    }
    
    let newPosition = existing.position;
    if (updates.position !== undefined) {
      newPosition = typeof updates.position === 'object' ? JSON.stringify(updates.position) : updates.position;
    }

    const sql = `
      UPDATE dashboard_widgets
      SET 
        title = $1,
        type = $2,
        dataset_id = $3,
        metric_id = $4,
        configuration = $5,
        position = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND dashboard_id = $8
      RETURNING *;
    `;

    const result = await db.query(sql, [
      newTitle,
      newType,
      newDatasetId || null,
      newMetricId || null,
      newConfig,
      newPosition,
      widgetId,
      dashboardId
    ]);

    return result.rows[0] || null;
  },

  /**
   * Delete a widget from a dashboard
   * @param {string} widgetId 
   * @param {string} dashboardId 
   * @returns {Promise<boolean>}
   */
  async deleteWidget(widgetId, dashboardId) {
    const sql = `
      DELETE FROM dashboard_widgets
      WHERE id = $1 AND dashboard_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [widgetId, dashboardId]);
    return Boolean(result.rows && result.rows.length > 0);
  }
};

module.exports = DashboardModel;
