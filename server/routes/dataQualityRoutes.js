const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const dataQualityController = require('../controllers/dataQualityController');

// All data quality endpoints require JWT authentication
router.use(authenticateToken);

// Dataset Quality Evaluation & Profile
router.get(
  '/datasets/:datasetId',
  requirePermission('quality.view'),
  dataQualityController.getDatasetQuality
);

router.post(
  '/datasets/:datasetId/evaluate',
  requirePermission('quality.evaluate'),
  dataQualityController.evaluateDatasetQuality
);

router.get(
  '/datasets/:datasetId/columns',
  requirePermission('quality.view'),
  dataQualityController.getColumnMetrics
);

router.get(
  '/datasets/:datasetId/history',
  requirePermission('quality.view'),
  dataQualityController.getQualityHistory
);

router.get(
  '/datasets/:datasetId/export',
  requirePermission('quality.view'),
  dataQualityController.exportQualityReport
);

// Custom Quality Rules Management
router.post(
  '/rules',
  requirePermission('quality.manage_rules'),
  dataQualityController.createRule
);

router.get(
  '/rules',
  requirePermission('quality.view'),
  dataQualityController.getRules
);

router.get(
  '/rules/:id',
  requirePermission('quality.view'),
  dataQualityController.getRuleById
);

router.put(
  '/rules/:id',
  requirePermission('quality.manage_rules'),
  dataQualityController.updateRule
);

router.delete(
  '/rules/:id',
  requirePermission('quality.manage_rules'),
  dataQualityController.deleteRule
);

module.exports = router;
