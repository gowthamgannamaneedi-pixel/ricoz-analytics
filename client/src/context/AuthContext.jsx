import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getAuthToken, 
  setAuthToken, 
  removeAuthToken, 
  getActiveOrganizationId,
  setActiveOrganizationId,
  removeActiveOrganizationId,
  loginUser, 
  registerUser, 
  verifyOtpUser,
  resendOtpUser,
  verifyEmailApi,
  resendVerificationApi,
  getBillingSubscription,
  getCurrentUser,
  logoutUser,
  sendHeartbeat
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken() || null);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState(getActiveOrganizationId() || null);
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and verify authentication state on startup against /api/auth/me
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setSubscription(null);
        setActiveOrganizationIdState(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCurrentUser();
        if (data && data.user && data.user.status !== 'pending_verification') {
          setUser(data.user);
          setToken(storedToken);
          const currentStoredOrg = getActiveOrganizationId();
          const targetOrgId = currentStoredOrg || data.user.organization_id;
          if (targetOrgId) {
            setActiveOrganizationId(targetOrgId);
            setActiveOrganizationIdState(targetOrgId);
          }
          if (data.subscription) {
            setSubscription(data.subscription);
          } else {
            // Fetch subscription telemetry if not bundled
            try {
              const subRes = await getBillingSubscription();
              if (subRes && subRes.subscription) {
                setSubscription(subRes.subscription);
              }
            } catch (_) {
              // Ignore failure if background billing endpoint is offline
            }
          }
        } else {
          removeAuthToken();
          removeActiveOrganizationId();
          setUser(null);
          setToken(null);
          setActiveOrganizationIdState(null);
          setSubscription(null);
        }
      } catch (err) {
        console.warn('Session verification note on startup:', err.message);
        const isRateLimit = err.message?.includes('429') || err.message?.includes('Rate limit') || err.message?.includes('RATE_LIMIT');
        const isNetworkErr = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
        if (!isRateLimit && !isNetworkErr) {
          removeAuthToken();
          removeActiveOrganizationId();
          setUser(null);
          setToken(null);
          setActiveOrganizationIdState(null);
          setSubscription(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  // Listen for 401 session expiry events dispatched by apiRequest
  useEffect(() => {
    const handleSessionExpired = (e) => {
      removeAuthToken();
      setToken(null);
      setUser(null);
      setSubscription(null);
      setError(e.detail?.message || 'Your session has expired. Please sign in again.');
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  // Listen for 402 trial expired / payment required events dispatched by apiRequest
  useEffect(() => {
    const handleTrialExpired = (e) => {
      setSubscription((prev) => ({
        ...(prev || {}),
        status: 'trial_expired',
        hasWorkspaceAccess: false,
        daysRemaining: 0,
        message: e.detail?.message || 'Your 14-day free trial has expired.'
      }));
    };

    window.addEventListener('auth:trial_expired', handleTrialExpired);
    return () => {
      window.removeEventListener('auth:trial_expired', handleTrialExpired);
    };
  }, []);

  // Lightweight authenticated presence heartbeat (every 2 minutes)
  useEffect(() => {
    if (!token || !user?.id) return;

    // Send immediate heartbeat on session start
    sendHeartbeat().catch(() => null);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        sendHeartbeat().catch(() => null);
      }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [token, user?.id]);

  /**
   * Log in user with credentials — strictly verified against server
   */
  const login = async (credentials) => {
    setError(null);
    const data = await loginUser(credentials);
    if (!data || !data.token || !data.user) {
      throw new Error(data?.message || 'Login failed. Invalid response from server.');
    }
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    const orgId = data.user.organization_id;
    if (orgId) {
      setActiveOrganizationId(orgId);
      setActiveOrganizationIdState(orgId);
    }
    if (data.subscription) {
      setSubscription(data.subscription);
    }
    return data.user;
  };

  /**
   * Register new user (initiates isolated tenant + 14-day trial)
   */
  const register = async (userData) => {
    setError(null);
    const data = await registerUser(userData);
    if (!data) {
      throw new Error(data?.message || 'Registration failed. Invalid response from server.');
    }
    if (userData.email) {
      setPendingVerificationEmail(userData.email);
    }
    // If server requires email verification, do not set active session
    if (data.requiresVerification) {
      return data;
    }
    if (data.token && data.user) {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      if (data.subscription) {
        setSubscription(data.subscription);
      }
    }
    return data;
  };

  /**
   * Verify email via link token or 6-digit OTP
   */
  const verifyEmail = async (payload) => {
    setError(null);
    const data = await verifyEmailApi(payload);
    if (data.token && data.user) {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      if (data.subscription) {
        setSubscription(data.subscription);
      }
    }
    return data;
  };

  /**
   * Resend verification email and 6-digit OTP
   */
  const resendVerification = async (payload) => {
    setError(null);
    return resendVerificationApi(payload);
  };

  /**
   * Refresh organization subscription status from server
   */
  const refreshSubscription = useCallback(async () => {
    try {
      const data = await getBillingSubscription();
      if (data && data.subscription) {
        setSubscription(data.subscription);
        return data.subscription;
      }
    } catch (_) {
      // Ignore background refresh errors
    }
    return null;
  }, []);

  /**
   * Verify 6-digit email OTP (legacy alias)
   */
  const verifyOtp = async (payload) => {
    return verifyEmail(payload);
  };

  /**
   * Resend 6-digit email OTP (legacy alias)
   */
  const resendOtp = async (payload) => {
    return resendVerification(payload);
  };

  /**
   * Log out user and clear stored tokens
   */
  const logout = async () => {
    try {
      await logoutUser();
    } catch (_) {
      // Continue cleanup
    }
    removeAuthToken();
    removeActiveOrganizationId();
    setActiveOrganizationIdState(null);
    setToken(null);
    setUser(null);
    setSubscription(null);
    setError(null);
  };

  // RBAC Permission Check Helpers
  const currentRole = user?.role || 'viewer';
  const isAdmin = currentRole === 'admin';
  const isManager = currentRole === 'manager' || isAdmin;
  const isAnalyst = currentRole === 'analyst' || isManager;
  const isViewer = currentRole === 'viewer';

  /**
   * Check if current user has any of the required roles
   * @param  {...string} roles 
   */
  const hasRole = (...roles) => {
    if (isAdmin) return true;
    return roles.includes(currentRole);
  };

  // Subscription & 14-Day Trial Helpers
  const isPaid = subscription?.status === 'active';
  const rawTrialEnd = subscription?.relevantEndDate || subscription?.trialEndsAt || subscription?.trial_ends_at;
  const isTimeElapsed = rawTrialEnd ? new Date(rawTrialEnd).getTime() <= Date.now() : false;
  const isTrialExpired = Boolean(
    !isPaid && (
      subscription?.status === 'trial_expired' || 
      subscription?.status === 'expired' ||
      isTimeElapsed ||
      (subscription?.daysRemaining != null && subscription.daysRemaining <= 0) ||
      subscription?.hasWorkspaceAccess === false
    )
  );
  const trialDaysRemaining = rawTrialEnd && !isPaid
    ? Math.max(0, Math.ceil((new Date(rawTrialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : (subscription?.daysRemaining != null ? subscription.daysRemaining : 0);
  const subscriptionStatus = isPaid ? 'active' : (isTrialExpired ? 'trial_expired' : (subscription?.status || 'trial'));
  const plan = subscription?.plan || 'starter';

  /**
   * Directly set authenticated session (e.g. following invitation acceptance)
   */
  const setAuthSession = useCallback((sessionData) => {
    if (sessionData?.token) {
      setAuthToken(sessionData.token);
      setToken(sessionData.token);
    }
    if (sessionData?.user) {
      setUser(sessionData.user);
      if (sessionData.user.organization_id) {
        setActiveOrganizationId(sessionData.user.organization_id);
        setActiveOrganizationIdState(sessionData.user.organization_id);
      }
    }
    if (sessionData?.subscription) {
      setSubscription(sessionData.subscription);
    }
  }, []);

  /**
   * Switch active workspace organization
   */
  const switchOrganization = useCallback(async (orgId) => {
    if (!orgId) return;
    setActiveOrganizationId(orgId);
    setActiveOrganizationIdState(orgId);
    try {
      const data = await getCurrentUser();
      if (data && data.user) {
        setUser(data.user);
        if (data.subscription) {
          setSubscription(data.subscription);
        }
      }
    } catch (_) {}
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    register,
    verifyEmail,
    resendVerification,
    verifyOtp,
    resendOtp,
    logout,
    refreshSubscription,
    setAuthSession,
    // Multi-tenant Organization context
    activeOrganizationId: activeOrganizationId || user?.organization_id || null,
    organizations: user?.organizations || [],
    switchOrganization,
    // Subscription & 14-Day Trial
    subscription,
    isTrialExpired,
    trialDaysRemaining,
    subscriptionStatus,
    plan,
    // Pending verification email for OTP flow
    pendingVerificationEmail,
    setPendingVerificationEmail,
    // RBAC
    currentRole,
    isAdmin,
    isManager,
    isAnalyst,
    isViewer,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
