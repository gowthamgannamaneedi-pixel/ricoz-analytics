const path = require('path');
const Dataset = require('../models/datasetModel');
const storage = require('../storage');
const { parseDatasetFile } = require('../services/fileParserService');

/**
 * Dataset Controller
 * Handles dataset retrieval, max 50-row preview, and deletion
 */

/**
 * GET /api/datasets
 * List all datasets for authenticated user
 */
const getDatasets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const datasets = await Dataset.findByUserId(userId);

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
 * Get single dataset by ID (Ownership enforced)
 */
const getDatasetById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await Dataset.findByIdAndUserId(id, userId);
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
    const { id } = req.params;

    const dataset = await Dataset.findByIdAndUserId(id, userId);
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
 * Delete dataset and remove underlying stored file
 */
const deleteDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const dataset = await Dataset.findByIdAndUserId(id, userId);
    if (!dataset) {
      return res.status(404).json({
        success: false,
        message: 'Dataset not found or you do not have permission to delete it.'
      });
    }

    // Cleanup stored file
    if (dataset.file_path) {
      await storage.deleteFile(dataset.file_path);
    }

    await Dataset.deleteByIdAndUserId(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Dataset deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  deleteDataset
};
