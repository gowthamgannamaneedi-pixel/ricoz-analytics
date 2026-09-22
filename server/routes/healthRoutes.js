const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/healthController');

// GET /api/health - Check if backend API service is running
router.get('/health', getHealthStatus);

module.exports = router;
