const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  refreshDataset,
  deleteDataset,
  devCreateDataset
} = require('../controllers/datasetController');

// All dataset routes require JWT authentication
router.use(authenticateToken);

// Dataset endpoints protected with RBAC
router.get('/', requirePermission('datasets.view'), getDatasets);
router.post('/dev-create', devCreateDataset);
router.get('/:id', requirePermission('datasets.view'), getDatasetById);
router.get('/:id/preview', requirePermission('datasets.view'), getDatasetPreview);
router.post('/:id/refresh', requirePermission('datasets.create'), refreshDataset);
router.delete('/:id', requirePermission('datasets.delete'), deleteDataset);

module.exports = router;
