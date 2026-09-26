const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

const supabaseUrl = config.supabase?.url || process.env.SUPABASE_URL || '';
const supabaseAnonKey = config.supabase?.anonKey || process.env.SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-public-api-key')
);

// Supabase client instance (using anon key)
const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

/**
 * Health check & connection verification for Supabase
 * Communicates with the Supabase API to verify endpoint reachability and credentials.
 * @returns {Promise<{ success: boolean, configured: boolean, latencyMs?: number, message: string, details?: any }>}
 */
async function checkSupabaseConnection() {
  if (!isConfigured) {
    return {
      success: false,
      configured: false,
      message: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in server/.env'
    };
  }

  const startTime = Date.now();

  try {
    // 1. Attempt connection check via Supabase Auth / Health endpoint
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      }
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        configured: true,
        latencyMs,
        message: `Successfully connected to Supabase (${latencyMs}ms)`,
        url: supabaseUrl
      };
    }

    // 2. Fallback: Check PostgREST root endpoint with apikey header
    const restResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    const restLatencyMs = Date.now() - startTime;

    if (restResponse.ok || restResponse.status === 200 || restResponse.status === 404 || restResponse.status === 400) {
      return {
        success: true,
        configured: true,
        latencyMs: restLatencyMs,
        message: `Successfully communicated with Supabase PostgREST API (${restLatencyMs}ms)`,
        url: supabaseUrl
      };
    }

    return {
      success: false,
      configured: true,
      statusCode: restResponse.status,
      message: `Supabase responded with status ${restResponse.status} ${restResponse.statusText}`
    };
  } catch (error) {
    return {
      success: false,
      configured: true,
      message: `Supabase connection failed: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  supabase,
  isConfigured,
  checkSupabaseConnection
};
