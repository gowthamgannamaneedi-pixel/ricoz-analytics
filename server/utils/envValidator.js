/**
 * Enterprise Production Configuration & Environment Validator
 * Validates mandatory/optional runtime environment variables without exposing secret values.
 */

function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const warnings = [];
  const errors = [];

  // Check Node Environment
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Check JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProd) {
      errors.push('JWT_SECRET is required in production.');
    } else {
      warnings.push('JWT_SECRET is not set; using local development fallback.');
    }
  } else if (isProd && (jwtSecret.length < 32 || jwtSecret.includes('dev') || jwtSecret.includes('default'))) {
    warnings.push('JWT_SECRET in production should be at least 32 characters of high-entropy random data.');
  }

  // Check Database URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (isProd) {
      warnings.push('DATABASE_URL is not set; operating in fallback memory store.');
    } else {
      warnings.push('DATABASE_URL is not set; operating in memory fallback store for development/testing.');
    }
  }

  // Check Supabase Configuration
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) {
    warnings.push('Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY) are not fully configured.');
  }

  // Check CORS in Production
  if (isProd && !process.env.CORS_ORIGIN && !process.env.CLIENT_URL) {
    warnings.push('CORS_ORIGIN or CLIENT_URL is not explicitly specified in production.');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    nodeEnv,
    errors,
    warnings
  };
}

module.exports = {
  validateEnvironment
};
