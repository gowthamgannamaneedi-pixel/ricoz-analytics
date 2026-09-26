const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const decisionIntelligenceController = require('../controllers/decisionIntelligenceController');

// All decision intelligence endpoints require JWT authentication
router.use(authenticateToken);

/**
 * GET /api/insights/:id/root-cause
 * Decompose metric variance across dimensional slices
 */
router.get(
  '/:id/root-cause',
  requirePermission('insights.view'),
  decisionIntelligenceController.getRootCause
);

/**
 * POST /api/insights/:id/simulate-scenario
 * Execute deterministic counterfactual simulation
 */
router.post(
  '/:id/simulate-scenario',
  requirePermission('insights.view'),
  decisionIntelligenceController.simulateScenario
);

/**
 * GET /api/insights/:id/dimensions
 * List eligible categorical dimensions for insight dataset
 */
router.get(
  '/:id/dimensions',
  requirePermission('insights.view'),
  decisionIntelligenceController.getAvailableDimensions
);

module.exports = router;
