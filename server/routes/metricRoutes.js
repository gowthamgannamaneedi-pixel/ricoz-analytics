const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  getMetrics,
  getMetricById,
  createMetric,
  updateMetric,
  deleteMetric
} = require('../controllers/metricController');

// All metrics endpoints require authentication
router.use(authenticateToken);

// Read endpoints accessible to all authenticated organization members (including viewers)
router.get('/', getMetrics);
router.get('/:id', getMetricById);

// Mutating endpoints require at least Analyst privileges
router.post('/', requireRole('admin', 'manager', 'analyst'), createMetric);
router.put('/:id', requireRole('admin', 'manager', 'analyst'), updateMetric);
router.delete('/:id', requireRole('admin', 'manager', 'analyst'), deleteMetric);

module.exports = router;
