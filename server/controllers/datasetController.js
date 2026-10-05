const path = require('path');
const db = require('../config/database');
const Dataset = require('../models/datasetModel');
const storage = require('../storage');
const auditService = require('../services/auditService');
const { parseDatasetFile } = require('../services/fileParserService');

/**
 * Dataset Controller
 * Handles dataset retrieval, max 50-row preview, and deletion
 */

/**
 * GET /api/datasets
 * List all datasets for authenticated organization
 */
const getDatasets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const datasets = organizationId
      ? await Dataset.findByOrganizationId(organizationId)
      : await Dataset.findByUserId(userId);

    return res.status(200).json({
      success: true,
      count: datasets.length,
      data: datasets
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/datasets/:id
 * Get single dataset by ID (Tenant isolation enforced)
 */
const getDatasetById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const dataset = organizationId
      ? await Dataset.findByIdAndOrgId(id, organizationId)
      : await Dataset.findByIdAndUserId(id, userId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found or you do not have permission to access it.'
      });
    }

    return res.status(200).json({
      success: true,
      data: dataset
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/datasets/:id/preview
 * Return maximum first 50 rows of dataset (Never full file)
 */
const getDatasetPreview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const dataset = organizationId
      ? await Dataset.findByIdAndOrgId(id, organizationId)
      : await Dataset.findByIdAndUserId(id, userId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found or you do not have permission to access it.'
      });
    }

    if (!dataset.file_path) {
      return res.status(200).json({
        success: true,
        data: {
          id: dataset.id,
          name: dataset.name,
          rowCount: dataset.row_count,
          columnCount: dataset.column_count,
          schema: dataset.schema,
          preview: [],
          message: 'No physical file attached to this dataset (direct connection).'
        }
      });
    }

    // Check file existence
    const fileExists = await storage.exists(dataset.file_path);
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        message: 'Underlying dataset file could not be found on storage.'
      });
    }

    // Read file and parse strictly first 50 rows
    const buffer = await storage.readFile(dataset.file_path);
    const ext = path.extname(dataset.file_path).toLowerCase();
    const parsed = parseDatasetFile(buffer, ext, 50);

    return res.status(200).json({
      success: true,
      data: {
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        rowCount: dataset.row_count,
        columnCount: dataset.column_count,
        schema: dataset.schema,
        preview: parsed.preview.slice(0, 50), // Hard guarantee: strictly maximum 50 rows
        previewCount: Math.min(parsed.preview.length, 50)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/datasets/:id
 * Delete dataset, verify dependencies, clean up storage, and remove orphaned records
 */
const deleteDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    // Verify dataset exists and belongs to authenticated user's organization (Tenant isolation)
    const dataset = organizationId
      ? await Dataset.findByIdAndOrgId(id, organizationId)
      : await Dataset.findByIdAndUserId(id, userId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found or you do not have permission to delete it.'
      });
    }

    // Step 19: Check for blocking dependencies (e.g. Dashboard widgets)
    const widgetCountRes = await db.query(
      'SELECT COUNT(*)::int AS count FROM dashboard_widgets WHERE dataset_id = $1',
      [id]
    );
    const widgetCount = Number(widgetCountRes?.rows?.[0]?.count || 0);
    if (widgetCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Dataset cannot be deleted because it is used by ${widgetCount} dashboard widget${widgetCount > 1 ? 's' : ''}.`
      });
    }

    // Cascade delete any dependent metrics, forecasts, alerts, quality snapshots/rules, relationships
    await db.query('DELETE FROM metrics WHERE dataset_id = $1', [id]).catch(() => null);
    await db.query('DELETE FROM alerts WHERE dataset_id = $1', [id]).catch(() => null);
    await db.query('DELETE FROM forecasts WHERE dataset_id = $1', [id]).catch(() => null);
    await db.query('DELETE FROM dataset_quality_snapshots WHERE dataset_id = $1', [id]).catch(() => null);
    await db.query('DELETE FROM dataset_quality_rules WHERE dataset_id = $1', [id]).catch(() => null);
    await db.query('DELETE FROM dataset_relationships WHERE dataset_id_1 = $1 OR dataset_id_2 = $1', [id]).catch(() => null);

    // Cleanup physical file on storage
    if (dataset.file_path) {
      await storage.deleteFile(dataset.file_path);
    }

    // Delete dataset record
    if (organizationId) {
      await Dataset.deleteByIdAndOrgId(id, organizationId);
    } else {
      await Dataset.deleteByIdAndUserId(id, userId);
    }

    // Log audit event
    await auditService.logAuditEvent({
      organizationId: organizationId || '00000000-0000-0000-0000-000000000001',
      userId,
      action: 'DATASET_DELETED',
      resourceType: 'dataset',
      resourceId: id,
      description: `Deleted dataset "${dataset.name}".`,
      metadata: { datasetId: id, name: dataset.name },
      req
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Dataset deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/datasets/:id/refresh
 * Refresh dataset ingestion, recalculate row/column counts, and update schema
 */
const refreshDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const userRole = (req.user.role || 'viewer').toLowerCase();
    const { id } = req.params;

    let dataset;
    if (['admin', 'manager', 'analyst'].includes(userRole)) {
      dataset = organizationId
        ? await Dataset.findByIdAndOrgId(id, organizationId)
        : await Dataset.findByIdAndUserId(id, userId);
    } else {
      dataset = await Dataset.findByIdAndUserId(id, userId);
    }

    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found or you do not have permission to refresh it.'
      });
    }

    let updatedRowCount = dataset.row_count;
    let updatedColumnCount = dataset.column_count;
    let updatedSchema = dataset.schema;

    // 1. If connected to a Data Source
    if (dataset.data_source_id) {
      const DataSource = require('../models/dataSourceModel');
      const source = await DataSource.findByIdAndUserId(dataset.data_source_id, dataset.user_id || userId);
      if (source && (source.type === 'rest_api' || source.type === 'api')) {
        let config = source.config;
        if (typeof config === 'string') {
          try { config = JSON.parse(config); } catch (_) { config = {}; }
        }
        if (config?.url) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const apiRes = await fetch(config.url, {
            method: (config.method || 'GET').toUpperCase(),
            headers: { 'Accept': 'application/json', ...(config.headers || {}) },
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (apiRes.ok) {
            const json = await apiRes.json();
            const dataKey = config.dataKey;
            let records = Array.isArray(json) ? json : (dataKey && Array.isArray(json[dataKey]) ? json[dataKey] : (json?.data && Array.isArray(json.data) ? json.data : null));
            if (records && Array.isArray(records)) {
              const filename = `${dataset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_refresh.json`;
              const fileBuffer = Buffer.from(JSON.stringify(records, null, 2));
              const saved = await storage.saveFile(userId, filename, fileBuffer);
              const meta = parseDatasetFile(fileBuffer, '.json', 50);

              updatedRowCount = meta.rowCount;
              updatedColumnCount = meta.columnCount;
              updatedSchema = meta.schema;

              await Dataset.update(dataset.id, {
                filePath: saved.filePath,
                rowCount: meta.rowCount,
                columnCount: meta.columnCount,
                schema: meta.schema
              });
            }
          }
        }
      }
    }

    // 2. If dataset has a file on storage, re-verify and update counts
    if (dataset.file_path && await storage.exists(dataset.file_path)) {
      const buffer = await storage.readFile(dataset.file_path);
      const ext = path.extname(dataset.file_path).toLowerCase();
      const meta = parseDatasetFile(buffer, ext, 50);
      updatedRowCount = meta.rowCount;
      updatedColumnCount = meta.columnCount;
      updatedSchema = meta.schema;

      await Dataset.update(dataset.id, {
        rowCount: meta.rowCount,
        columnCount: meta.columnCount,
        schema: meta.schema
      });
    }

    // Safe Audit Log
    await auditService.logAuditEvent({
      organizationId: organizationId || '00000000-0000-0000-0000-000000000001',
      userId,
      action: 'DATASET_REFRESHED',
      resourceType: 'dataset',
      resourceId: id,
      description: `Refreshed dataset "${dataset.name}" (${updatedRowCount} rows).`,
      metadata: { datasetId: id, rowCount: updatedRowCount, columnCount: updatedColumnCount },
      req
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Dataset refreshed successfully.',
      data: {
        id: dataset.id,
        name: dataset.name,
        rowCount: updatedRowCount,
        columnCount: updatedColumnCount,
        schema: updatedSchema,
        refreshedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DEV ONLY: Create dataset for automated multi-tenant isolation testing
 */
const devCreateDataset = async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Simulation disabled in production' });
  }
  try {
    const { name, rowCount } = req.body;
    const dataset = await Dataset.create({
      userId: req.user.id,
      organizationId: req.user.organization_id,
      name: name || 'Isolated Test Dataset',
      rowCount: rowCount || 100,
      columnCount: 5,
      schema: [{ name: 'id', type: 'integer' }, { name: 'sales', type: 'numeric' }]
    });
    return res.status(201).json({ success: true, dataset });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  refreshDataset,
  deleteDataset,
  devCreateDataset
};
