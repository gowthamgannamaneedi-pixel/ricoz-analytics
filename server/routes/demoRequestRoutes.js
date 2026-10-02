const express = require('express');
const router = express.Router();
const demoRequestController = require('../controllers/demoRequestController');

// GET /api/demo-request/smtp-status (Diagnostics)
router.get('/smtp-status', (req, res) => demoRequestController.getSmtpStatus(req, res));

// POST /api/demo-request/verify-smtp (Handshake Check)
router.post('/verify-smtp', (req, res) => demoRequestController.verifySmtp(req, res));

// POST /api/demo-request or /api/demo-requests (Form Submit)
router.post('/', (req, res) => demoRequestController.submitDemoRequest(req, res));

// GET /api/demo-request or /api/demo-requests (List records)
router.get('/', (req, res) => demoRequestController.listDemoRequests(req, res));

module.exports = router;
