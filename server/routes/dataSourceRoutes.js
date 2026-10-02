const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const {
  getDataSources,
  getDataSourceById,
  createDataSource,
  testConnection,
  testApiConnection,
  syncDataSource,
  uploadDataSource,
  deleteDataSource
} = require('../controllers/dataSourceController');

// All data source routes require JWT authentication
router.use(authenticateToken);

// Standard CRUD endpoints
router.get('/', getDataSources);
router.post('/', createDataSource);
router.post('/test-connection', testConnection);
router.post('/test-api', requireRole('admin', 'manager', 'analyst'), testApiConnection);
router.post('/upload', handleUpload('file'), uploadDataSource);
router.get('/:id', getDataSourceById);
router.post('/:id/sync', requireRole('admin', 'manager', 'analyst'), syncDataSource);
router.delete('/:id', deleteDataSource);

module.exports = router;
