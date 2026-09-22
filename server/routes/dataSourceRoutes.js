const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const {
  getDataSources,
  getDataSourceById,
  createDataSource,
  testConnection,
  uploadDataSource,
  deleteDataSource
} = require('../controllers/dataSourceController');

// All data source routes require JWT authentication
router.use(authenticateToken);

// Standard CRUD endpoints
router.get('/', getDataSources);
router.post('/', createDataSource);
router.post('/test-connection', testConnection);
router.post('/upload', handleUpload('file'), uploadDataSource);
router.get('/:id', getDataSourceById);
router.delete('/:id', deleteDataSource);

module.exports = router;
