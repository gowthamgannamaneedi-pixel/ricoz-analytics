// Centralized API utility with authentication token management
const API_BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'ricoz_auth_token';

/**
 * Get current stored authentication token
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Persist authentication token
 * @param {string} token 
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    removeAuthToken();
  }
}

/**
 * Remove stored authentication token
 */
export function removeAuthToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Perform an HTTP request to the backend API
 * @param {string} endpoint 
 * @param {RequestInit} [options] 
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach auth token if present
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({
        success: false,
        message: 'Failed to parse response JSON'
      }));
    } else {
      // Non-JSON response (e.g. HTML 404 from static host like Vercel)
      const text = await response.text().catch(() => '');
      data = {
        success: false,
        isOfflineOrHtml: true,
        message: `Backend API route not available (${response.status})`
      };
    }

    if (!response.ok) {
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
        removeAuthToken();
      }
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.statusCode = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    // Gracefully annotate connection failures
    if (!err.statusCode) {
      err.isOffline = true;
    }
    throw err;
  }
}

/**
 * Check backend API health status
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * Register a new user account
 * @param {{ name: string, email: string, password: string, role?: string }} userData 
 */
export async function registerUser(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

/**
 * Authenticate user with credentials
 * @param {{ email: string, password: string }} credentials 
 */
export async function loginUser(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

/**
 * Retrieve profile of currently authenticated user
 */
export async function getCurrentUser() {
  return apiRequest('/auth/me');
}
