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

    const validTypes = ['csv', 'json', 'postgresql'];
    if (!type || !validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid data source type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    let status = 'active';

    // If type is postgresql, validate and test connection
    if (type.toLowerCase() === 'postgresql') {
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

    const newSource = await DataSource.create({
      userId,
      name: name.trim(),
      type: type.toLowerCase(),
      status,
      config
    });

    return res.status(201).json({
      success: true,
      message: 'Data source created successfully.',
      data: {
        ...newSource,
        config: sanitizePostgresConfig(newSource.config)
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
  uploadDataSource,
  deleteDataSource
};
