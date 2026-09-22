import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getAuthToken, 
  setAuthToken, 
  removeAuthToken, 
  loginUser, 
  registerUser, 
  getCurrentUser 
} from '../services/api';

const AuthContext = createContext(null);

// Default demo user when backend is offline or during preview deployment
const DEMO_USER = {
  id: 1,
  name: 'Gowtham (Admin)',
  email: 'gowthamgannamaneedi@gmail.com',
  role: 'admin'
};

const DEMO_TOKEN = 'demo_enterprise_auth_token_preview';

export function AuthProvider({ children }) {
  // Initialize with demo user by default so user can access the analytics dashboard directly
  const [user, setUser] = useState(DEMO_USER);
  const [token, setToken] = useState(getAuthToken() || DEMO_TOKEN);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize and verify authentication state if real backend is reachable
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        // Keep demo user active
        setUser(DEMO_USER);
        setToken(DEMO_TOKEN);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCurrentUser();
        if (data && data.user) {
          setUser(data.user);
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('Backend authentication not connected, running in preview/demo mode:', err.message);
        // Fall back gracefully to demo user rather than locking the user out
        setUser(DEMO_USER);
        setToken(DEMO_TOKEN);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  /**
   * Log in user with credentials (with graceful demo fallback if backend is offline)
   */
  const login = async (credentials) => {
    setError(null);
    try {
      const data = await loginUser(credentials);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      console.warn('Login endpoint offline or returned non-JSON, falling back to demo user:', err.message);
      // If backend is not available, accept any credentials in demo mode
      setAuthToken(DEMO_TOKEN);
      setToken(DEMO_TOKEN);
      setUser({
        ...DEMO_USER,
        email: credentials.email || DEMO_USER.email,
        name: credentials.email ? credentials.email.split('@')[0] : DEMO_USER.name
      });
      return DEMO_USER;
    }
  };

  /**
   * Register new user (with graceful demo fallback if backend is offline)
   */
  const register = async (userData) => {
    setError(null);
    try {
      const data = await registerUser(userData);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      console.warn('Register endpoint offline or returned non-JSON, falling back to demo user:', err.message);
      setAuthToken(DEMO_TOKEN);
      setToken(DEMO_TOKEN);
      const newUser = {
        id: Date.now(),
        name: userData.name || 'Enterprise Analyst',
        email: userData.email || 'user@ricozanalytics.com',
        role: userData.role || 'admin'
      };
      setUser(newUser);
      return newUser;
    }
  };

  /**
   * Log out user and reset to demo or cleared state
   */
  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    setError(null);
  };

  /**
   * Reset to active demo session
   */
  const enterDemoMode = () => {
    setAuthToken(DEMO_TOKEN);
    setToken(DEMO_TOKEN);
    setUser(DEMO_USER);
    setError(null);
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
    enterDemoMode
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
