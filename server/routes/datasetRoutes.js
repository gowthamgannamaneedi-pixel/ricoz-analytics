const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
  getDatasets,
  getDatasetById,
  getDatasetPreview,
  deleteDataset
} = require('../controllers/datasetController');

// All dataset routes require JWT authentication
router.use(authenticateToken);

// Dataset endpoints
router.get('/', getDatasets);
router.get('/:id', getDatasetById);
router.get('/:id/preview', getDatasetPreview);
router.delete('/:id', deleteDataset);

module.exports = router;
