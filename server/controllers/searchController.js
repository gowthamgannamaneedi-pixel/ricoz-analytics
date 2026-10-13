const db = require('../config/database');

/**
 * Enterprise Global Search Controller
 * Multi-tenant search across Datasets, KPIs, Reports, Dashboards, and Data Sources
 */
const searchController = {
  /**
   * GET /api/search?q=query&limit=20
   */
  async globalSearch(req, res) {
    try {
      const organizationId = req.user.organization_id;
      if (!organizationId) {
        return res.status(403).json({ success: false, message: 'Organization required.' });
      }

      const rawQuery = req.query.q || req.query.query || '';
      const trimmed = String(rawQuery).trim();
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 15));

      if (!trimmed) {
        return res.status(200).json({
          success: true,
          query: '',
          totalCount: 0,
          results: [],
          grouped: {
            datasets: [],
            kpis: [],
            reports: [],
            dashboards: [],
            data_sources: []
          }
        });
      }

      const pattern = `%${trimmed}%`;
      const exactPrefix = `${trimmed}%`;

      // 1. Search Datasets
      const datasetsQuery = `
        SELECT id, name, description, row_count, column_count
        FROM datasets
        WHERE (organization_id = $1 OR user_id IN (SELECT id FROM users WHERE organization_id = $1))
          AND (name ILIKE $2 OR COALESCE(description, '') ILIKE $2)
        ORDER BY CASE WHEN name ILIKE $3 THEN 1 ELSE 2 END, created_at DESC
        LIMIT 5;
      `;

      // 2. Search Metrics (KPIs)
      const metricsQuery = `
        SELECT id, name, description, formula, type, unit, target_value
        FROM metrics
        WHERE organization_id = $1
          AND (name ILIKE $2 OR formula ILIKE $2 OR COALESCE(description, '') ILIKE $2)
        ORDER BY CASE WHEN name ILIKE $3 THEN 1 ELSE 2 END, created_at DESC
        LIMIT 5;
      `;

      // 3. Search Reports
      const reportsQuery = `
        SELECT id, title, description, format, status
        FROM reports
        WHERE organization_id = $1
          AND (title ILIKE $2 OR COALESCE(description, '') ILIKE $2)
        ORDER BY CASE WHEN title ILIKE $3 THEN 1 ELSE 2 END, created_at DESC
        LIMIT 5;
      `;

      // 4. Search Dashboards
      const dashboardsQuery = `
        SELECT id, title, description, is_default
        FROM dashboards
        WHERE organization_id = $1
          AND (title ILIKE $2 OR COALESCE(description, '') ILIKE $2)
        ORDER BY CASE WHEN title ILIKE $3 THEN 1 ELSE 2 END, created_at DESC
        LIMIT 5;
      `;

      // 5. Search Data Sources
      const dataSourcesQuery = `
        SELECT id, name, type, status
        FROM data_sources
        WHERE (organization_id = $1 OR user_id IN (SELECT id FROM users WHERE organization_id = $1))
          AND (name ILIKE $2 OR type ILIKE $2)
        ORDER BY CASE WHEN name ILIKE $3 THEN 1 ELSE 2 END, created_at DESC
        LIMIT 5;
      `;

      const [dsRes, mRes, rRes, dbRes, dsrcRes] = await Promise.all([
        db.query(datasetsQuery, [organizationId, pattern, exactPrefix]).catch(e => { console.warn('Search datasets warn:', e.message); return { rows: [] }; }),
        db.query(metricsQuery, [organizationId, pattern, exactPrefix]).catch(e => { console.warn('Search metrics warn:', e.message); return { rows: [] }; }),
        db.query(reportsQuery, [organizationId, pattern, exactPrefix]).catch(e => { console.warn('Search reports warn:', e.message); return { rows: [] }; }),
        db.query(dashboardsQuery, [organizationId, pattern, exactPrefix]).catch(e => { console.warn('Search dashboards warn:', e.message); return { rows: [] }; }),
        db.query(dataSourcesQuery, [organizationId, pattern, exactPrefix]).catch(e => { console.warn('Search datasources warn:', e.message); return { rows: [] }; })
      ]);

      const datasets = (dsRes.rows || []).map(d => ({
        id: d.id,
        title: d.name,
        subtitle: `${d.row_count || 0} records · ${d.column_count || 0} cols`,
        type: 'dataset',
        category: 'Datasets',
        url: `/datasets`
      }));

      const kpis = (mRes.rows || []).map(m => ({
        id: m.id,
        title: m.name,
        subtitle: `${m.type} · ${m.formula}`,
        type: 'kpi',
        category: 'KPIs & Metrics',
        url: `/kpis`
      }));

      const reports = (rRes.rows || []).map(r => ({
        id: r.id,
        title: r.title,
        subtitle: `${(r.format || 'PDF').toUpperCase()} · ${r.status || 'Active'}`,
        type: 'report',
        category: 'Reports',
        url: `/reports`
      }));

      const dashboards = (dbRes.rows || []).map(b => ({
        id: b.id,
        title: b.title,
        subtitle: b.is_default ? 'Default Executive Overview' : 'Dashboard View',
        type: 'dashboard',
        category: 'Dashboards',
        url: `/dashboard`
      }));

      const dataSources = (dsrcRes.rows || []).map(s => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.type} · ${s.status || 'Connected'}`,
        type: 'data_source',
        category: 'Data Sources',
        url: `/data-sources`
      }));

      // Combined flat list
      const results = [...dashboards, ...datasets, ...kpis, ...reports, ...dataSources].slice(0, limit);

      return res.status(200).json({
        success: true,
        query: trimmed,
        totalCount: results.length,
        results,
        grouped: {
          dashboards,
          datasets,
          kpis,
          reports,
          data_sources: dataSources
        }
      });
    } catch (err) {
      console.error('[SearchController.globalSearch] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Search service failed.',
        error: err.message
      });
    }
  }
};

module.exports = searchController;
