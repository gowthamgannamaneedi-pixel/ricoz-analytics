const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const {
  getMetrics,
  getMetricById,
  createMetric,
  updateMetric,
  deleteMetric
} = require('../controllers/metricController');

// All metrics endpoints require authentication
router.use(authenticateToken);

// Read endpoints accessible to all authenticated organization members (including viewers and expired accounts)
router.get('/', getMetrics);
router.get('/:id', getMetricById);

// Mutating endpoints require active subscription and at least Analyst privileges
router.post('/', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), createMetric);
router.put('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateMetric);
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), deleteMetric);

module.exports = router;
