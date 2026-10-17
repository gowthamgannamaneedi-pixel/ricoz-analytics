const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// In production, default CLIENT_URL to canonical production deployment and never localhost
const defaultClientUrl = isProduction ? 'https://ricoz-analytics.vercel.app' : 'http://localhost:5173';
let resolvedClientUrl = process.env.CLIENT_URL || defaultClientUrl;

// If in production but CLIENT_URL points to localhost, fail safely by overriding with production URL
if (isProduction && (resolvedClientUrl.includes('localhost') || resolvedClientUrl.includes('127.0.0.1'))) {
  console.warn('[Config] ⚠️ In production, CLIENT_URL cannot point to localhost. Overriding with https://ricoz-analytics.vercel.app');
  resolvedClientUrl = 'https://ricoz-analytics.vercel.app';
}

// Centralized configuration management for server
const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: resolvedClientUrl,
  corsOrigin: process.env.CORS_ORIGIN || resolvedClientUrl,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default_dev_secret_key_change_in_production',
  jwtExpiration: process.env.JWT_EXPIRATION || '7d',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '250', 10),
  qualityBatchSize: parseInt(process.env.QUALITY_BATCH_SIZE || '25000', 10),
  qualityMaxConcurrentJobs: parseInt(process.env.QUALITY_MAX_CONCURRENT_JOBS || '2', 10),
  qualitySampleSize: parseInt(process.env.QUALITY_SAMPLE_SIZE || '10000', 10),
  qualityJobTimeoutMs: parseInt(process.env.QUALITY_JOB_TIMEOUT_MS || '600000', 10),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  emailProvider: (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase()
};

module.exports = config;
