const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireActiveSubscription, requireUsageLimit } = require('../middleware/subscriptionMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const {
  getDataSources,
  getDataSourceById,
  createDataSource,
  testConnection,
  previewPostgresTableHandler,
  testMongoConnectionHandler,
  previewMongoCollectionHandler,
  testApiConnection,
  syncDataSource,
  uploadDataSource,
  updateDataSource,
  deleteDataSource
} = require('../controllers/dataSourceController');

// All data source routes require JWT authentication
router.use(authenticateToken);

// Standard CRUD endpoints
// GET endpoints are permitted for expired accounts to preserve customer data source visibility
router.get('/', getDataSources);
router.post('/', requireActiveSubscription, requireUsageLimit('datasets'), createDataSource);
router.post('/test-connection', requireActiveSubscription, testConnection);
router.post('/preview-postgres', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), previewPostgresTableHandler);
router.post('/test-mongodb', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), testMongoConnectionHandler);
router.post('/preview-mongodb', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), previewMongoCollectionHandler);
router.post('/test-api', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), testApiConnection);
router.post('/upload', requireActiveSubscription, requireUsageLimit('datasets'), handleUpload('file'), uploadDataSource);
router.get('/:id', getDataSourceById);
router.put('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateDataSource);
router.post('/:id/sync', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), syncDataSource);
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager'), deleteDataSource);

module.exports = router;
