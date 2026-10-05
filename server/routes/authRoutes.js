const express = require('express');
const router = express.Router();
const { 
  register, 
  verifyOtp, 
  verifyEmail, 
  resendOtp, 
  resendVerification, 
  login, 
  getMe, 
  getInvitationDetails, 
  acceptInvite, 
  logout 
} = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');

// POST /api/auth/register - Register new SaaS tenant account & 14-day trial
router.post('/register', register);

// POST /api/auth/verify-email & /api/auth/verify-otp - Verify email
router.post('/verify-email', verifyEmail);
router.post('/verify-otp', verifyOtp);

// POST /api/auth/resend-verification & /api/auth/resend-otp - Resend code
router.post('/resend-verification', resendVerification);
router.post('/resend-otp', resendOtp);

// POST /api/auth/login - User login with trial verification
router.post('/login', login);

// GET /api/auth/invitation/:token & /api/auth/invite/:token - Inspect invitation details
router.get('/invitation/:token', getInvitationDetails);
router.get('/invite/:token', getInvitationDetails);

// POST /api/auth/accept-invite - Accept invitation & join tenant
router.post('/accept-invite', acceptInvite);

// GET /api/auth/me - Get currently authenticated user (Protected)
router.get('/me', authenticateToken, getMe);

// POST /api/auth/logout - Terminate session
router.post('/logout', logout);

module.exports = router;
