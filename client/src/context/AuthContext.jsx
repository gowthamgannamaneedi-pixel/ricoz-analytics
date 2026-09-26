import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuthToken, 
  setAuthToken, 
  removeAuthToken, 
  loginUser, 
  registerUser, 
  getCurrentUser,
  logoutUser
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken() || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and verify authentication state on startup against /api/auth/me
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCurrentUser();
        if (data && data.user) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          removeAuthToken();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Session verification failed on startup:', err.message);
        removeAuthToken();
        setUser(null);
        setToken(null);
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
      setError(e.detail?.message || 'Your session has expired. Please sign in again.');
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

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
    return data.user;
  };

  /**
   * Register new user (server strictly assigns 'viewer' role per security policy)
   */
  const register = async (userData) => {
    setError(null);
    const data = await registerUser(userData);
    if (!data || !data.token || !data.user) {
      throw new Error(data?.message || 'Registration failed. Invalid response from server.');
    }
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
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
    setToken(null);
    setUser(null);
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

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    register,
    logout,
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
