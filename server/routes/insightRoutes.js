const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const insightController = require('../controllers/insightController');

// All insight endpoints require JWT authentication
router.use(authenticateToken);

// Executive insights generation & listing
router.post(
  '/generate',
  requirePermission('insights.generate'),
  insightController.generateInsights
);

router.get(
  '/',
  requirePermission('insights.view'),
  insightController.getInsights
);

router.get(
  '/summary',
  requirePermission('insights.view'),
  insightController.getExecutiveSummary
);

router.get(
  '/export',
  requirePermission('insights.view'),
  insightController.exportInsights
);

router.get(
  '/:id',
  requirePermission('insights.view'),
  insightController.getInsightById
);

router.post(
  '/:id/dismiss',
  requirePermission('insights.manage'),
  insightController.dismissInsight
);

router.post(
  '/:id/feedback',
  requirePermission('insights.manage'),
  insightController.submitFeedback
);

// Phase 6: Decision Intelligence & Root-Cause Attribution
const decisionIntelligenceController = require('../controllers/decisionIntelligenceController');

router.get(
  '/:id/root-cause',
  requirePermission('insights.view'),
  decisionIntelligenceController.getRootCause
);

router.post(
  '/:id/simulate-scenario',
  requirePermission('insights.view'),
  decisionIntelligenceController.simulateScenario
);

router.get(
  '/:id/dimensions',
  requirePermission('insights.view'),
  decisionIntelligenceController.getAvailableDimensions
);

module.exports = router;

