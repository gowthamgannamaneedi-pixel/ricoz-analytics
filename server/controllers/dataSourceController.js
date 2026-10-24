const fs = require('fs');
const path = require('path');
const { validateUrl } = require('../utils/urlSecurity');
const DataSource = require('../models/dataSourceModel');
const Dataset = require('../models/datasetModel');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');
const storage = require('../storage');
const db = require('../config/database');
const { parseDatasetFile, parseDatasetFileStream } = require('../services/fileParserService');
const { testPostgresConnection } = require('../services/postgresSourceService');
const { testMongoConnection, previewMongoCollection, ingestMongoCollection } = require('../services/mongoSourceService');
const { testRestApiConnection, ingestRestApiData } = require('../services/restSourceService');
const { encryptConfig, decryptConfig, sanitizeDataSourceConfig } = require('../services/encryptionService');
const { ingestDatasetFileStream } = require('../services/datasetIngestionService');
const subscriptionService = require('../services/subscriptionService');
const insightService = require('../services/insightService');
const tenantService = require('../services/tenantService');

/**
 * Data Source Controller
 * Handles CRUD and file ingestion for user-isolated data pipelines
 * Supports CSV, JSON, PostgreSQL, MongoDB, and REST API connectors.
 */

/**
 * Resolves and authoritatively validates the organization ID for an authenticated user.
 */
async function resolveTrustedOrganizationId(reqOrUser, optionalUser) {
  const req = optionalUser ? reqOrUser : null;
  const user = optionalUser || reqOrUser;
  if (!user || (!user.id && !user.email)) return null;

  const tenantRes = await tenantService.resolveAndAuthorizeOrganization(req, user);
  if (tenantRes.organizationId) {
    return tenantRes.organizationId;
  }
  return null;
}

/**
 * Populate dataset rows into PostgreSQL dataset_rows table for relational analytics
 * @param {string|number} datasetId
 * @param {string} organizationId
 * @param {Array<object>} records
 */
async function populateDatasetRows(datasetId, organizationId, records) {
  const pool = db.getPool();
  if (db.isUsingFallback() || !pool || !Array.isArray(records) || records.length === 0) {
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);

      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const chunk = records.slice(i, i + batchSize);
        const valuesSql = [];
        const params = [];
        let paramIdx = 1;

        for (let j = 0; j < chunk.length; j++) {
          valuesSql.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          params.push(datasetId, organizationId, i + j + 1, JSON.stringify(chunk[j]));
        }

        const insertSql = `
          INSERT INTO dataset_rows (dataset_id, organization_id, row_index, data)
          VALUES ${valuesSql.join(', ')}
        `;
        await client.query(insertSql, params);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[DataSourceController] Error populating dataset_rows:', err.message);
    } finally {
      client.release();
    }
  } catch (connErr) {
    console.warn('[DataSourceController] DB pool connection error for dataset_rows:', connErr.message);
  }
}

/**
 * Helper to clean up partial upload artifacts on ingestion failure
 */
async function clientCleanup(datasetId, dataSourceId, organizationId, filePath) {
  try {
    if (datasetId) {
      await db.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]).catch(() => null);
      if (organizationId) {
        await Dataset.deleteByIdAndOrgId(datasetId, organizationId).catch(() => null);
      }
    }
    if (dataSourceId && organizationId) {
      await DataSource.deleteByIdAndOrgId(dataSourceId, organizationId).catch(() => null);
    }
    if (filePath) {
      await storage.deleteFile(filePath).catch(() => null);
    }
  } catch (cleanErr) {
    console.warn('[UploadCleanup] Cleanup warning:', cleanErr.message);
  }
}

/**
 * GET /api/data-sources
 * Get all data sources for authenticated user or organization
 */
const getDataSources = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req, req.user);

    const sources = organizationId
      ? await DataSource.findByOrganizationId(organizationId)
      : await DataSource.findByUserId(userId);

    // Sanitize config in all returned sources (mask URIs, strip passwords and secret tokens)
    const sanitized = sources.map(src => ({
      ...src,
      config: sanitizeDataSourceConfig(typeof src.config === 'string' ? JSON.parse(src.config) : src.config)
    }));

    return res.status(200).json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/data-sources/:id
 * Get single data source by ID with its datasets (Ownership/Tenant enforced)
 */
const getDataSourceById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req, req.user);
    const { id } = req.params;

    const source = organizationId
      ? await DataSource.findByIdAndOrgId(id, organizationId)
      : await DataSource.findByIdAndUserId(id, userId);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to access it.'
      });
    }

    const datasets = await Dataset.findByDataSourceId(id, userId, organizationId);

    return res.status(200).json({
      success: true,
      data: {
        ...source,
        config: sanitizeDataSourceConfig(typeof source.config === 'string' ? JSON.parse(source.config) : source.config),
        datasets
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources
 * Create a new data source (PostgreSQL, MongoDB, REST API, etc.)
 */
const createDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req, req.user);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No tenant organization associated with current session.'
        },
        message: 'No tenant organization associated with current session.'
      });
    }

    const { name, type, config = {} } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Data source name is required.'
      });
    }

    // Check subscription dataset limit
    const limitCheck = await subscriptionService.checkUsageLimit(organizationId, 'datasets');
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: limitCheck.code,
          message: limitCheck.message
        },
        message: limitCheck.message,
        requiresUpgrade: true,
        limit: limitCheck.limit,
        currentCount: limitCheck.currentCount,
        upgradeGuidance: limitCheck.upgradeGuidance
      });
    }

    const validTypes = ['csv', 'json', 'postgresql', 'mysql', 'mongodb', 'rest_api', 'api'];
    const normalizedType = type ? type.toLowerCase() : '';
    if (!type || !validTypes.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid data source type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    let effectiveType = normalizedType === 'api' ? 'rest_api' : normalizedType;
    let status = 'active';
    let initialRecords = null;
    let initialSchema = [];
    let initialCollection = config.collection || config.collectionName || null;

    // 1. PostgreSQL Connector
    if (effectiveType === 'postgresql') {
      const { host, port, database, user, password, ssl } = config;
      if (!host || !database || !user) {
        return res.status(400).json({
          success: false,
          message: 'PostgreSQL connection requires host, database, and user.'
        });
      }

      try {
        const testResult = await testPostgresConnection({ host, port, database, user, password, ssl });
        status = testResult.success ? 'connected' : 'error';
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: `PostgreSQL connection failed: ${testResult.message}`
          });
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'PostgreSQL connection failed.'
        });
      }
    }

    // 2. MongoDB Connector
    if (effectiveType === 'mongodb') {
      try {
        const testResult = await testMongoConnection(config);
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: testResult.message
          });
        }
        status = 'connected';

        // If collection specified, or if only 1 collection found, ingest initial documents
        const targetCollection = initialCollection || (testResult.collections && testResult.collections.length === 1 ? testResult.collections[0] : null);
        if (targetCollection) {
          initialCollection = targetCollection;
          config.collection = targetCollection;
          try {
            const ingestRes = await ingestMongoCollection(config, targetCollection, { limit: 10000 });
            initialRecords = ingestRes.records;
            initialSchema = ingestRes.schema;
          } catch (ingestErr) {
            console.warn('[DataSourceController] MongoDB collection initial ingestion notice:', ingestErr.message);
          }
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'MongoDB connection failed.'
        });
      }
    }

    // 3. REST API Connector
    if (effectiveType === 'rest_api') {
      try {
        const testResult = await testRestApiConnection(config);
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: testResult.message
          });
        }
        status = 'active';

        // Fetch initial records for dataset
        try {
          const ingestRes = await ingestRestApiData(config, { maxRecords: 10000 });
          initialRecords = ingestRes.records;
          initialSchema = ingestRes.schema;
        } catch (ingestErr) {
          console.warn('[DataSourceController] REST API initial ingestion notice:', ingestErr.message);
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'REST API connection failed.'
        });
      }
    }

    // Encrypt sensitive credentials at rest before writing to database
    const secureConfig = encryptConfig(config);

    const newSource = await DataSource.create({
      userId,
      organizationId,
      name: name.trim(),
      type: effectiveType,
      status,
      config: secureConfig
    });

    // If initial records were extracted from REST API or MongoDB, persist Dataset & dataset_rows
    let createdDataset = null;
    if (initialRecords && Array.isArray(initialRecords) && initialRecords.length > 0) {
      try {
        const safeSuffix = effectiveType === 'mongodb' ? `_mongo_${initialCollection || 'data'}.json` : '_api.json';
        const filename = `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}${safeSuffix}`;
        const buffer = Buffer.from(JSON.stringify(initialRecords, null, 2));
        const saved = await storage.saveFile(userId, filename, buffer);

        let parsedMetadata;
        try {
          parsedMetadata = await parseDatasetFile(buffer, '.json', 50);
        } catch (_) {
          parsedMetadata = {
            rowCount: initialRecords.length,
            columnCount: initialSchema.length || Object.keys(initialRecords[0] || {}).length,
            schema: initialSchema
          };
        }

        const dsDesc = effectiveType === 'mongodb'
          ? `Auto-ingested from MongoDB collection '${initialCollection}'`
          : `Auto-ingested from REST API (${config.url || ''})`;

        createdDataset = await Dataset.create({
          userId,
          organizationId,
          dataSourceId: newSource.id,
          name: name.trim(),
          description: dsDesc,
          filePath: saved.filePath,
          rowCount: parsedMetadata.rowCount || initialRecords.length,
          columnCount: parsedMetadata.columnCount || initialSchema.length,
          schema: parsedMetadata.schema || initialSchema
        });

        // Populate dataset_rows in PostgreSQL
        await populateDatasetRows(createdDataset.id, organizationId, initialRecords);
      } catch (dsErr) {
        console.warn('[DataSourceController] Auto dataset creation warning:', dsErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Data source created successfully.',
      data: {
        ...newSource,
        config: sanitizeDataSourceConfig(config),
        dataset: createdDataset
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources/test-connection
 * Unified connection tester routing to PostgreSQL, MongoDB, or REST API based on type
 */
const testConnection = async (req, res, next) => {
  try {
    const type = (req.body.type || req.body.sourceType || 'postgresql').toLowerCase();
    const config = req.body.config || req.body;

    if (type === 'mongodb') {
      const result = await testMongoConnection(config);
      return res.status(result.success ? 200 : 400).json(result);
    }

    if (type === 'rest_api' || type === 'api') {
      const result = await testRestApiConnection(config);
      return res.status(result.success ? 200 : 400).json(result);
    }

    const { host, port, database, user, password, ssl } = config;
    const result = await testPostgresConnection({ host, port, database, user, password, ssl });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Connection test failed.'
    });
  }
};

/**
 * POST /api/data-sources/test-mongodb
 * Dedicated test endpoint for MongoDB credentials, collections & TLS validation
 */
const testMongoConnectionHandler = async (req, res, next) => {
  try {
    const config = req.body.config || req.body;
    const result = await testMongoConnection(config);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'MongoDB connection test failed.'
    });
  }
};

/**
 * POST /api/data-sources/preview-mongodb
 * Preview sample documents and inferred schema for a specific MongoDB collection
 */
const previewMongoCollectionHandler = async (req, res, next) => {
  try {
    const config = req.body.config || req.body;
    const collection = req.body.collection || req.body.collectionName;
    const limit = Number(req.body.limit) || 10;

    if (!collection) {
      return res.status(400).json({
        success: false,
        message: 'Collection name is required for preview.'
      });
    }

    const result = await previewMongoCollection(config, collection, limit);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'MongoDB collection preview failed.'
    });
  }
};

/**
 * POST /api/data-sources/test-api
 * Test connection to external REST API endpoint and preview schema/records
 */
const testApiConnection = async (req, res, next) => {
  try {
    const config = req.body.config || req.body;
    const result = await testRestApiConnection(config);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to connect to API.'
    });
  }
};

/**
 * POST /api/data-sources/:id/sync
 * Trigger manual or scheduled refresh of an external data source
 */
const syncDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req.user);
    const { id } = req.params;

    const source = organizationId
      ? await DataSource.findByIdAndOrgId(id, organizationId)
      : await DataSource.findByIdAndUserId(id, userId);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to sync it.'
      });
    }

    let storedConfig = source.config;
    if (typeof storedConfig === 'string') {
      try { storedConfig = JSON.parse(storedConfig); } catch (_) { storedConfig = {}; }
    }

    // Decrypt credentials for internal execution
    const config = decryptConfig(storedConfig);

    // 1. REST API Refresh
    if (source.type === 'rest_api' || source.type === 'api') {
      const ingestRes = await ingestRestApiData(config, { maxRecords: 20000 });
      const records = ingestRes.records;

      const filename = `${source.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sync.json`;
      const fileBuffer = Buffer.from(JSON.stringify(records, null, 2));
      const saved = await storage.saveFile(userId, filename, fileBuffer);

      const datasets = await Dataset.findByDataSourceId(id, userId, organizationId);
      if (datasets && datasets.length > 0) {
        for (const ds of datasets) {
          await Dataset.update(ds.id, {
            filePath: saved.filePath,
            rowCount: ingestRes.rowCount,
            columnCount: ingestRes.columnCount,
            schema: ingestRes.schema
          });
          await populateDatasetRows(ds.id, organizationId, records);
        }
      } else {
        const createdDs = await Dataset.create({
          userId,
          organizationId,
          dataSourceId: id,
          name: source.name,
          description: `Synced from REST API (${config.url})`,
          filePath: saved.filePath,
          rowCount: ingestRes.rowCount,
          columnCount: ingestRes.columnCount,
          schema: ingestRes.schema
        });
        await populateDatasetRows(createdDs.id, organizationId, records);
      }

      await DataSource.updateStatus(id, 'active');

      return res.status(200).json({
        success: true,
        message: `Data source successfully synchronized (${records.length} records ingested).`,
        rowCount: records.length,
        status: 'active',
        syncedAt: new Date().toISOString()
      });
    }

    // 2. MongoDB Refresh
    if (source.type === 'mongodb') {
      const collection = config.collection || config.collectionName;
      if (!collection) {
        return res.status(400).json({
          success: false,
          message: 'MongoDB data source has no target collection configured for synchronization.'
        });
      }

      const ingestRes = await ingestMongoCollection(config, collection, { limit: 20000 });
      const records = ingestRes.records;

      const filename = `${source.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mongo_${collection}_sync.json`;
      const fileBuffer = Buffer.from(JSON.stringify(records, null, 2));
      const saved = await storage.saveFile(userId, filename, fileBuffer);

      const datasets = await Dataset.findByDataSourceId(id, userId, organizationId);
      if (datasets && datasets.length > 0) {
        for (const ds of datasets) {
          await Dataset.update(ds.id, {
            filePath: saved.filePath,
            rowCount: ingestRes.rowCount,
            columnCount: ingestRes.columnCount,
            schema: ingestRes.schema
          });
          await populateDatasetRows(ds.id, organizationId, records);
        }
      } else {
        const createdDs = await Dataset.create({
          userId,
          organizationId,
          dataSourceId: id,
          name: source.name,
          description: `Synced from MongoDB collection '${collection}'`,
          filePath: saved.filePath,
          rowCount: ingestRes.rowCount,
          columnCount: ingestRes.columnCount,
          schema: ingestRes.schema
        });
        await populateDatasetRows(createdDs.id, organizationId, records);
      }

      await DataSource.updateStatus(id, 'connected');

      return res.status(200).json({
        success: true,
        message: `MongoDB collection '${collection}' synchronized (${records.length} records ingested).`,
        rowCount: records.length,
        status: 'connected',
        syncedAt: new Date().toISOString()
      });
    }

    // 3. PostgreSQL Refresh
    if (source.type === 'postgresql') {
      const testRes = await testPostgresConnection(config);
      await DataSource.updateStatus(id, testRes.success ? 'connected' : 'error');
      return res.status(200).json({
        success: testRes.success,
        message: testRes.success ? 'PostgreSQL connection verified and synchronized.' : 'PostgreSQL connection failed during sync.',
        status: testRes.success ? 'connected' : 'error',
        syncedAt: new Date().toISOString()
      });
    }

    // 4. CSV/JSON File data sources
    await DataSource.updateStatus(id, 'active');
    return res.status(200).json({
      success: true,
      message: 'Static file data source verified and synchronized.',
      status: 'active',
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources/upload
 * Handle CSV or JSON file upload and create dataset with safe transactional cleanup
 */
const uploadDataSource = async (req, res, next) => {
  let savedFile = null;
  let dataSource = null;
  let dataset = null;
  let organizationId = null;

  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a CSV or JSON file.'
      });
    }

    organizationId = await resolveTrustedOrganizationId(req, req.user);
    if (!organizationId) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_ORGANIZATION',
          message: 'No tenant organization associated with current session.'
        },
        message: 'No tenant organization associated with current session.'
      });
    }

    const limitCheck = await subscriptionService.checkUsageLimit(organizationId, 'datasets');
    if (!limitCheck.allowed) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      return res.status(403).json({
        success: false,
        error: {
          code: limitCheck.code,
          message: limitCheck.message
        },
        message: limitCheck.message,
        requiresUpgrade: true,
        limit: limitCheck.limit,
        currentCount: limitCheck.currentCount,
        upgradeGuidance: limitCheck.upgradeGuidance
      });
    }

    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const sourceName = req.body.name?.trim() || path.basename(originalName, ext);
    const description = req.body.description?.trim() || `Imported from ${originalName}`;
    const fileType = ext === '.json' ? 'json' : 'csv';

    const fileInput = file.path || file.buffer;

    let parsedMetadata;
    try {
      parsedMetadata = await parseDatasetFileStream(fileInput, ext, 50);
    } catch (parseErr) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
      return res.status(400).json({
        success: false,
        message: `Failed to process data file: ${parseErr.message}`
      });
    }

    savedFile = await storage.saveFile(userId, originalName, fileInput);

    dataSource = await DataSource.create({
      userId,
      organizationId,
      name: sourceName,
      type: fileType,
      status: 'active',
      config: {
        originalFilename: originalName,
        fileSize: savedFile.size || file.size,
        mimeType: file.mimetype
      }
    });

    dataset = await Dataset.create({
      userId,
      organizationId,
      dataSourceId: dataSource.id,
      name: sourceName,
      description,
      filePath: savedFile.filePath,
      rowCount: parsedMetadata.rowCount,
      columnCount: parsedMetadata.columnCount,
      schema: parsedMetadata.schema
    });

    const pool = db.getPool();
    const isLargeDataset = Number(parsedMetadata.rowCount || 0) > 25000;

    if (!db.isUsingFallback() && pool) {
      if (isLargeDataset) {
        setImmediate(async () => {
          try {
            await ingestDatasetFileStream(savedFile.filePath, dataset.id, organizationId, {
              batchSize: 5000,
              useCopyStreams: true
            });
          } catch (bgErr) {
            console.error(`[Ingestion] Async background ingestion failed:`, bgErr.message);
          }
        });
      } else {
        try {
          await ingestDatasetFileStream(savedFile.filePath, dataset.id, organizationId, {
            batchSize: 2000,
            useCopyStreams: true
          });
        } catch (ingestErr) {
          console.warn(`[UploadIngestion] Synchronous ingestion notice:`, ingestErr.message);
        }
      }
    }

    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, () => {});
    }

    if (organizationId) {
      insightService.invalidateCache(organizationId);
    }

    return res.status(201).json({
      success: true,
      message: 'Data source and dataset created successfully.',
      data: {
        dataSource,
        dataset: {
          ...dataset,
          rowCount: parsedMetadata.rowCount,
          columnCount: parsedMetadata.columnCount,
          schema: parsedMetadata.schema,
          preview: parsedMetadata.preview
        }
      }
    });
  } catch (err) {
    if (dataset?.id || dataSource?.id) {
      await clientCleanup(dataset?.id, dataSource?.id, organizationId, savedFile?.filePath);
    }
    next(err);
  }
};

/**
 * DELETE /api/data-sources/:id
 * Delete data source and its associated datasets
 */
const deleteDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req.user);
    const { id } = req.params;

    const source = organizationId
      ? await DataSource.findByIdAndOrgId(id, organizationId)
      : await DataSource.findByIdAndUserId(id, userId);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to delete it.'
      });
    }

    const datasets = await Dataset.findByDataSourceId(id, userId, organizationId);
    if (datasets && datasets.length > 0) {
      for (const ds of datasets) {
        await db.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [ds.id]).catch(() => null);
        if (organizationId) {
          await Dataset.deleteByIdAndOrgId(ds.id, organizationId);
        } else {
          await Dataset.deleteByIdAndUserId(ds.id, userId);
        }
        if (ds.file_path) {
          await storage.deleteFile(ds.file_path).catch(() => null);
        }
      }
    }

    if (organizationId) {
      await DataSource.deleteByIdAndOrgId(id, organizationId);
      insightService.invalidateCache(organizationId);
    } else {
      await DataSource.deleteByIdAndUserId(id, userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Data source and associated datasets deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/data-sources/:id
 * Update data source name, status or configuration with encryption
 */
const updateDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const organizationId = await resolveTrustedOrganizationId(req.user);
    const { id } = req.params;
    const { name, config, status } = req.body;

    const source = organizationId
      ? await DataSource.findByIdAndOrgId(id, organizationId)
      : await DataSource.findByIdAndUserId(id, userId);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to edit it.'
      });
    }

    // Encrypt sensitive fields if config updated
    const secureConfig = config ? encryptConfig(config) : undefined;

    const updated = await DataSource.update(id, userId, {
      name,
      config: secureConfig,
      status
    });

    return res.status(200).json({
      success: true,
      message: 'Data source updated successfully.',
      data: {
        ...updated,
        config: sanitizeDataSourceConfig(config || (typeof updated.config === 'string' ? JSON.parse(updated.config) : updated.config))
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDataSources,
  getDataSourceById,
  createDataSource,
  updateDataSource,
  testConnection,
  testMongoConnectionHandler,
  previewMongoCollectionHandler,
  testApiConnection,
  syncDataSource,
  uploadDataSource,
  deleteDataSource
};
