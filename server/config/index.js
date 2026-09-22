require('dotenv').config();

// Centralized configuration management for server
const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default_dev_secret_key_change_in_production'
};

module.exports = config;
