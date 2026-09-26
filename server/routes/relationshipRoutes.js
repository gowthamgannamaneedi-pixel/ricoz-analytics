const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const relationshipController = require('../controllers/relationshipController');

// All dataset relationship routes require JWT authentication
router.use(authenticateToken);

// List all relationships for the user's organization
router.get(
  '/',
  requirePermission('relationships:read'),
  relationshipController.getRelationships
);

// Get single relationship definition
router.get(
  '/:id',
  requirePermission('relationships:read'),
  relationshipController.getRelationshipById
);

// Create new dataset relationship
router.post(
  '/',
  requirePermission('relationships:create'),
  relationshipController.createRelationship
);

// Update dataset relationship
router.put(
  '/:id',
  requirePermission('relationships:update'),
  relationshipController.updateRelationship
);

// Delete dataset relationship
router.delete(
  '/:id',
  requirePermission('relationships:delete'),
  relationshipController.deleteRelationship
);

// Execute relational query across datasets
router.post(
  '/query',
  requirePermission('relationships:query'),
  relationshipController.executeRelationalQuery
);

module.exports = router;
