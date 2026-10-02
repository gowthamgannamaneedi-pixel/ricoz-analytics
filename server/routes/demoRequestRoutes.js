const express = require('express');
const router = express.Router();
const demoRequestController = require('../controllers/demoRequestController');

// POST /api/demo-request or /api/demo-requests
router.post('/', (req, res) => demoRequestController.submitDemoRequest(req, res));

// GET /api/demo-request or /api/demo-requests
router.get('/', (req, res) => demoRequestController.listDemoRequests(req, res));

module.exports = router;
