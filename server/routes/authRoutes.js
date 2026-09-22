const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');

// POST /api/auth/register - Register new account
router.post('/register', register);

// POST /api/auth/login - User login
router.post('/login', login);

// GET /api/auth/me - Get currently authenticated user (Protected)
router.get('/me', authenticateToken, getMe);

module.exports = router;
