const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const { requireActiveSubscription, requireUsageLimit } = require('../middleware/subscriptionMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');
const {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  refreshDataset,
  deleteDataset,
  devCreateDataset,
  rehydrateDataset
} = require('../controllers/datasetController');

// All dataset routes require JWT authentication
router.use(authenticateToken);

// Dataset endpoints protected with RBAC and subscription gating
// GET endpoints are permitted for expired accounts to safely preserve customer dataset visibility
router.get('/', requirePermission('datasets.view'), getDatasets);
router.post('/dev-create', requireActiveSubscription, requireUsageLimit('datasets'), devCreateDataset);
router.get('/:id', requirePermission('datasets.view'), getDatasetById);
router.get('/:id/preview', requirePermission('datasets.view'), getDatasetPreview);
router.post('/:id/refresh', requireActiveSubscription, requirePermission('datasets.create'), refreshDataset);
router.post('/:id/rehydrate', requireActiveSubscription, requirePermission('datasets.create'), handleUpload('file'), rehydrateDataset);
router.delete('/:id', requirePermission('datasets.delete'), deleteDataset);

module.exports = router;
