const express = require('express');
const router = express.Router();
const demoRequestController = require('../controllers/demoRequestController');

// GET /api/demo-request/smtp-status (Diagnostics)
router.get('/smtp-status', (req, res) => demoRequestController.getSmtpStatus(req, res));

// GET /api/demo-request/user-status (User Account Status Diagnostics)
router.get('/user-status', (req, res) => demoRequestController.getUserStatus(req, res));

// POST /api/demo-request/reset-user-verification (Reset user to pending_verification and dispatch fresh OTP)
router.post('/reset-user-verification', (req, res) => demoRequestController.resetUserVerification(req, res));

// POST /api/demo-request/cleanup-accounts (Purge all accounts except admin@ricoz.test and ricoz@admin.test)
router.post('/cleanup-accounts', (req, res) => demoRequestController.cleanupAccounts(req, res));

// GET /api/demo-request/brevo-logs (Brevo Transactional Email Event Diagnostics)
router.get('/brevo-logs', (req, res) => demoRequestController.getBrevoLogs(req, res));

// GET /api/demo-request/queue-status (Background Email Queue Diagnostics)
router.get('/queue-status', (req, res) => demoRequestController.getQueueStatus(req, res));

// POST /api/demo-request/retry-jobs (Manually retry failed jobs)
router.post('/retry-jobs', (req, res) => demoRequestController.retryQueue(req, res));

// POST /api/demo-request/verify-smtp (Handshake Check)
router.post('/verify-smtp', (req, res) => demoRequestController.verifySmtp(req, res));

// POST /api/demo-request/test-email (Safe Test Email Delivery)
router.post('/test-email', (req, res) => demoRequestController.sendTestEmail(req, res));

// POST /api/demo-request or /api/demo-requests (Form Submit)
router.post('/', (req, res) => demoRequestController.submitDemoRequest(req, res));

// GET /api/demo-request or /api/demo-requests (List records)
router.get('/', (req, res) => demoRequestController.listDemoRequests(req, res));

module.exports = router;
