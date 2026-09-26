const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');

// POST /api/auth/register - Register new account
router.post('/register', register);

// POST /api/auth/login - User login
router.post('/login', login);

// GET /api/auth/me - Get currently authenticated user (Protected)
router.get('/me', authenticateToken, getMe);

// POST /api/auth/logout - Terminate session
router.post('/logout', logout);

module.exports = router;
