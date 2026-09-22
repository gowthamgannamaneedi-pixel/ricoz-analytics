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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and verify authentication state on application startup
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCurrentUser();
        if (data && data.user) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err.message);
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  /**
   * Log in user with credentials
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
      setError(err.message || 'Failed to login');
      throw err;
    }
  };

  /**
   * Register new user
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
      setError(err.message || 'Failed to register account');
      throw err;
    }
  };

  /**
   * Log out user and clear storage
   */
  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
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
    logout
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
