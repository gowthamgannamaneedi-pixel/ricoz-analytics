const path = require('path');
const DataSource = require('../models/dataSourceModel');
const Dataset = require('../models/datasetModel');
const storage = require('../storage');
const { parseDatasetFile } = require('../services/fileParserService');
const { testPostgresConnection, sanitizePostgresConfig } = require('../services/postgresSourceService');

/**
 * Data Source Controller
 * Handles CRUD and file ingestion for user-isolated data pipelines
 */

/**
 * GET /api/data-sources
 * Get all data sources for authenticated user
 */
const getDataSources = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sources = await DataSource.findByUserId(userId);

    // Sanitize config in all returned sources
    const sanitized = sources.map(src => ({
      ...src,
      config: sanitizePostgresConfig(typeof src.config === 'string' ? JSON.parse(src.config) : src.config)
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
 * Get single data source by ID with its datasets (Ownership enforced)
 */
const getDataSourceById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const source = await DataSource.findByIdAndUserId(id, userId);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to access it.'
      });
    }

    const datasets = await Dataset.findByDataSourceId(id, userId);

    return res.status(200).json({
      success: true,
      data: {
        ...source,
        config: sanitizePostgresConfig(typeof source.config === 'string' ? JSON.parse(source.config) : source.config),
        datasets
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources
 * Create a new data source (e.g., PostgreSQL connection)
 */
const createDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, type, config = {} } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Data source name is required.'
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
    let parsedMetadata = null;

    // 1. PostgreSQL Connector
    if (effectiveType === 'postgresql') {
      const { host, port, database, user, password, ssl } = config;
      if (!host || !database || !user) {
        return res.status(400).json({
          success: false,
          message: 'PostgreSQL connection requires host, database, and user.'
        });
      }

      // Test connection
      const testResult = await testPostgresConnection({ host, port, database, user, password, ssl });
      status = testResult.success ? 'connected' : 'error';
    }

    // 2. REST API Connector
    if (effectiveType === 'rest_api') {
      const url = config.url || config.endpoint_url || config.endpointUrl;
      const method = config.method || 'GET';
      const headers = config.headers || {};
      const dataKey = config.dataKey || config.data_key;

      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return res.status(400).json({
          success: false,
          message: 'REST API data source requires a valid HTTP or HTTPS endpoint URL.'
        });
      }

      // Ensure url is explicitly set on config
      config.url = url;
      config.endpoint_url = url;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const apiRes = await fetch(url, {
          method: (method || 'GET').toUpperCase(),
          headers: {
            'Accept': 'application/json',
            ...headers
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (apiRes.ok) {
          const json = await apiRes.json().catch(() => null);
          let records = Array.isArray(json) ? json : (dataKey && Array.isArray(json[dataKey]) ? json[dataKey] : (json?.data && Array.isArray(json.data) ? json.data : null));
          if (records && Array.isArray(records) && records.length > 0) {
            initialRecords = records;
            status = 'active';
          }
        } else {
          status = 'error';
        }
      } catch (err) {
        status = 'error';
      }
    }

    const newSource = await DataSource.create({
      userId,
      name: name.trim(),
      type: effectiveType,
      status,
      config
    });

    // If records were ingested from REST API, persist dataset file and create Dataset record
    let createdDataset = null;
    if (initialRecords && initialRecords.length > 0) {
      try {
        const filename = `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_api.json`;
        const buffer = Buffer.from(JSON.stringify(initialRecords, null, 2));
        const saved = await storage.saveFile(userId, filename, buffer);
        parsedMetadata = parseDatasetFile(buffer, '.json', 50);

        createdDataset = await Dataset.create({
          userId,
          dataSourceId: newSource.id,
          name: name.trim(),
          description: `Auto-ingested from REST API (${config.url})`,
          filePath: saved.filePath,
          rowCount: parsedMetadata.rowCount,
          columnCount: parsedMetadata.columnCount,
          schema: parsedMetadata.schema
        });
      } catch (dsErr) {
        console.warn('[DataSourceController] Auto dataset creation warning:', dsErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Data source created successfully.',
      data: {
        ...newSource,
        config: sanitizePostgresConfig(newSource.config),
        dataset: createdDataset
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources/test-connection
 * Test connection parameters for PostgreSQL without saving
 */
const testConnection = async (req, res, next) => {
  try {
    const { host, port, database, user, password, ssl } = req.body;
    const result = await testPostgresConnection({ host, port, database, user, password, ssl });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources/test-api
 * Test connection to external REST API endpoint and preview schema/records
 */
const testApiConnection = async (req, res, next) => {
  try {
    const url = req.body.url || req.body.endpoint_url || req.body.endpointUrl;
    const method = req.body.method || 'GET';
    const headers = req.body.headers || {};
    const dataKey = req.body.dataKey || req.body.data_key;

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return res.status(400).json({
        success: false,
        message: 'A valid HTTP or HTTPS URL is required.'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: (method || 'GET').toUpperCase(),
      headers: {
        'Accept': 'application/json',
        ...headers
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        status: response.status,
        message: `Remote API returned HTTP ${response.status}: ${response.statusText}`
      });
    }

    const json = await response.json();
    let records = Array.isArray(json) ? json : (dataKey && Array.isArray(json[dataKey]) ? json[dataKey] : (json?.data && Array.isArray(json.data) ? json.data : null));

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint returned JSON, but no records array was found. Please specify the data key (e.g. data, items).'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully connected. Retrieved ${records.length} records.`,
      status: response.status,
      recordCount: records.length,
      preview: records.slice(0, 5)
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: `Failed to connect to API: ${err.message}`
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
    const { id } = req.params;

    const source = await DataSource.findByIdAndUserId(id, userId);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to sync it.'
      });
    }

    let config = source.config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (_) { config = {}; }
    }

    if (source.type === 'rest_api' || source.type === 'api') {
      const url = config?.url || config?.endpoint_url || config?.endpointUrl;
      const method = config?.method || 'GET';
      const headers = config?.headers || {};
      const dataKey = config?.dataKey || config?.data_key;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'Data source has no URL configured.'
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        method: (method || 'GET').toUpperCase(),
        headers: { 'Accept': 'application/json', ...headers },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        await DataSource.updateStatus(id, 'error');
        return res.status(502).json({
          success: false,
          message: `Sync failed: remote endpoint returned HTTP ${response.status}`
        });
      }

      const json = await response.json();
      let records = Array.isArray(json) ? json : (dataKey && Array.isArray(json[dataKey]) ? json[dataKey] : (json?.data && Array.isArray(json.data) ? json.data : null));

      if (!records || !Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data format returned by remote API.'
        });
      }

      const filename = `${source.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_sync.json`;
      const fileBuffer = Buffer.from(JSON.stringify(records, null, 2));
      const saved = await storage.saveFile(userId, filename, fileBuffer);
      const parsedMetadata = parseDatasetFile(fileBuffer, '.json', 50);

      const datasets = await Dataset.findByDataSourceId(id, userId);
      if (datasets && datasets.length > 0) {
        for (const ds of datasets) {
          await Dataset.update(ds.id, {
            filePath: saved.filePath,
            rowCount: parsedMetadata.rowCount,
            columnCount: parsedMetadata.columnCount,
            schema: parsedMetadata.schema
          });
        }
      } else {
        await Dataset.create({
          userId,
          dataSourceId: id,
          name: source.name,
          description: `Synced from ${url}`,
          filePath: saved.filePath,
          rowCount: parsedMetadata.rowCount,
          columnCount: parsedMetadata.columnCount,
          schema: parsedMetadata.schema
        });
      }

      await DataSource.updateStatus(id, 'active');

      return res.status(200).json({
        success: true,
        message: `Data source successfully synchronized (${records.length} records ingested).`,
        rowCount: records.length,
        status: 'active',
        syncedAt: new Date().toISOString()
      });
    } else if (source.type === 'postgresql') {
      const testRes = await testPostgresConnection(config);
      await DataSource.updateStatus(id, testRes.success ? 'connected' : 'error');
      return res.status(200).json({
        success: testRes.success,
        message: testRes.success ? 'PostgreSQL connection verified and synchronized.' : 'PostgreSQL connection failed during sync.',
        status: testRes.success ? 'connected' : 'error',
        syncedAt: new Date().toISOString()
      });
    } else {
      // CSV/JSON file data sources
      await DataSource.updateStatus(id, 'active');
      return res.status(200).json({
        success: true,
        message: 'Static file data source verified and synchronized.',
        status: 'active',
        syncedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/data-sources/upload
 * Handle CSV or JSON file upload and create dataset
 */
const uploadDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a CSV or JSON file.'
      });
    }

    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const sourceName = req.body.name?.trim() || path.basename(originalName, ext);
    const description = req.body.description?.trim() || `Imported from ${originalName}`;
    const fileType = ext === '.json' ? 'json' : 'csv';

    // 1. Parse and extract metadata from memory buffer
    let parsedMetadata;
    try {
      parsedMetadata = parseDatasetFile(file.buffer, ext, 50);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: `Failed to process data file: ${parseErr.message}`
      });
    }

    // 2. Persist file via StorageProvider
    const savedFile = await storage.saveFile(userId, originalName, file.buffer);

    // 3. Create Data Source record
    const dataSource = await DataSource.create({
      userId,
      name: sourceName,
      type: fileType,
      status: 'active',
      config: {
        originalFilename: originalName,
        fileSize: file.size,
        mimeType: file.mimetype
      }
    });

    // 4. Create Dataset record
    const dataset = await Dataset.create({
      userId,
      dataSourceId: dataSource.id,
      name: sourceName,
      description,
      filePath: savedFile.filePath,
      rowCount: parsedMetadata.rowCount,
      columnCount: parsedMetadata.columnCount,
      schema: parsedMetadata.schema
    });

    return res.status(201).json({
      success: true,
      message: 'File uploaded and dataset processed successfully.',
      data: {
        dataSource: {
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type,
          status: dataSource.status
        },
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          rowCount: dataset.row_count,
          columnCount: dataset.column_count,
          schema: dataset.schema,
          preview: parsedMetadata.preview,
          createdAt: dataset.created_at
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/data-sources/:id
 * Delete data source, cascade datasets and cleanup physical files
 */
const deleteDataSource = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership and get datasets to clean up files
    const source = await DataSource.findByIdAndUserId(id, userId);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found or you do not have permission to delete it.'
      });
    }

    const datasets = await Dataset.findByDataSourceId(id, userId);
    for (const ds of datasets) {
      if (ds.file_path) {
        await storage.deleteFile(ds.file_path);
      }
    }

    await DataSource.deleteByIdAndUserId(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Data source and associated datasets deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDataSources,
  getDataSourceById,
  createDataSource,
  testConnection,
  testApiConnection,
  syncDataSource,
  uploadDataSource,
  deleteDataSource
};
