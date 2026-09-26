const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  deleteDataset
} = require('../controllers/datasetController');

// All dataset routes require JWT authentication
router.use(authenticateToken);

// Dataset endpoints protected with RBAC
router.get('/', requirePermission('datasets.view'), getDatasets);
router.get('/:id', requirePermission('datasets.view'), getDatasetById);
router.get('/:id/preview', requirePermission('datasets.view'), getDatasetPreview);
router.delete('/:id', requirePermission('datasets.delete'), deleteDataset);

module.exports = router;
