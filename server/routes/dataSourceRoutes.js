const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireUsageLimit } = require('../middleware/subscriptionMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const {
  getDataSources,
  getDataSourceById,
  createDataSource,
  testConnection,
  testApiConnection,
  syncDataSource,
  uploadDataSource,
  updateDataSource,
  deleteDataSource
} = require('../controllers/dataSourceController');

// All data source routes require JWT authentication
router.use(authenticateToken);

// Standard CRUD endpoints
router.get('/', getDataSources);
router.post('/', requireUsageLimit('datasets'), createDataSource);
router.post('/test-connection', testConnection);
router.post('/test-api', requireRole('admin', 'manager', 'analyst'), testApiConnection);
router.post('/upload', requireUsageLimit('datasets'), handleUpload('file'), uploadDataSource);
router.get('/:id', getDataSourceById);
router.put('/:id', requireRole('admin', 'manager', 'analyst'), updateDataSource);
router.post('/:id/sync', requireRole('admin', 'manager', 'analyst'), syncDataSource);
router.delete('/:id', deleteDataSource);

module.exports = router;
