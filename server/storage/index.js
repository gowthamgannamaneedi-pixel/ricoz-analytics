const LocalStorageProvider = require('./LocalStorageProvider');
const SupabaseStorageProvider = require('./SupabaseStorageProvider');
const { supabase, supabaseAdmin, isConfigured } = require('../config/supabase');

/**
 * Storage Provider Factory & Singleton
 * Returns SupabaseStorageProvider when cloud Supabase is configured;
 * otherwise gracefully falls back to LocalStorageProvider for offline / local test environments.
 */
function createStorageProvider() {
  const client = supabaseAdmin || supabase;
  if (isConfigured && client) {
    return new SupabaseStorageProvider({
      client,
      bucket: process.env.SUPABASE_STORAGE_BUCKET || 'datasets'
    });
  }

  return new LocalStorageProvider();
}

const storage = createStorageProvider();
storage.LocalStorageProvider = LocalStorageProvider;
storage.SupabaseStorageProvider = SupabaseStorageProvider;
storage.createStorageProvider = createStorageProvider;

module.exports = storage;
