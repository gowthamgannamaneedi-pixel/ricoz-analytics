const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
  getDatasetSummary,
  getDatasetKpis,
  getDatasetTrends,
  getDatasetBreakdowns,
  getDatasetRows
} = require('../controllers/analyticsController');

// All analytics endpoints require valid JWT authentication
router.use(authenticateToken);

// Dataset Analytics Endpoints
router.get('/datasets/:id/summary', getDatasetSummary);
router.get('/datasets/:id/kpis', getDatasetKpis);
router.get('/datasets/:id/trends', getDatasetTrends);
router.get('/datasets/:id/breakdowns', getDatasetBreakdowns);
router.get('/datasets/:id/rows', getDatasetRows);

module.exports = router;
