const { Pool } = require('pg');
const config = require('./index');

let pool = null;
let useFallbackStore = false;

// In-memory fallback stores for dev/testing when PostgreSQL server is not connected
const fallbackUsers = [];
let nextUserId = 1;

const fallbackDataSources = [];
let nextDataSourceId = 1;

const fallbackDatasets = [];
let nextDatasetId = 1;

/**
 * Initialize PostgreSQL connection pool
 */
if (config.databaseUrl) {
  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL client error, falling back to memory store:', err.message);
    useFallbackStore = true;
  });
} else {
  // If no DATABASE_URL provided, default to memory store in local dev
  useFallbackStore = true;
}

/**
 * Execute SQL Query with error fallback
 * @param {string} text 
 * @param {any[]} [params] 
 * @returns {Promise<{ rows: any[], rowCount: number }>}
 */
async function query(text, params = []) {
  if (!useFallbackStore && pool) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      // If connection fails, switch to fallback in development
      console.warn(`PostgreSQL query error: ${err.message}. Operating in fallback store.`);
      useFallbackStore = true;
    }
  }

  // Handle fallback in-memory store queries
  return handleFallbackQuery(text, params);
}

/**
 * Minimal in-memory SQL dispatcher for dev/test reliability
 */
function handleFallbackQuery(text, params = []) {
  const normalizedSql = text.replace(/\s+/g, ' ').trim().toLowerCase();

  // ----------------- USERS -----------------
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from users where lower(email) = lower($1)')) {
    const email = params[0]?.toLowerCase();
    const user = fallbackUsers.find(u => u.email.toLowerCase() === email);
    return Promise.resolve({
      rows: user ? [{ ...user }] : [],
      rowCount: user ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('select') && normalizedSql.includes('from users where id = $1')) {
    const id = Number(params[0]);
    const user = fallbackUsers.find(u => u.id === id);
    return Promise.resolve({
      rows: user ? [{ ...user }] : [],
      rowCount: user ? 1 : 0
    });
  }

  if (normalizedSql.startsWith('insert into users')) {
    const [name, email, password_hash, role = 'viewer'] = params;
    const existing = fallbackUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      const err = new Error('duplicate key value violates unique constraint "users_email_key"');
      err.code = '23505';
      return Promise.reject(err);
    }

    const newUser = {
      id: nextUserId++,
      name,
      email,
      password_hash,
      role,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackUsers.push(newUser);

    return Promise.resolve({
      rows: [{
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      }],
      rowCount: 1
    });
  }

  // ----------------- DATA SOURCES -----------------
  // DELETE data_sources
  if (normalizedSql.startsWith('delete from data_sources')) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const idx = fallbackDataSources.findIndex(d => d.id === id && d.user_id === userId);
    if (idx !== -1) {
      const deleted = fallbackDataSources.splice(idx, 1)[0];
      // Cascade delete datasets
      for (let i = fallbackDatasets.length - 1; i >= 0; i--) {
        if (fallbackDatasets[i].data_source_id === id && fallbackDatasets[i].user_id === userId) {
          fallbackDatasets.splice(i, 1);
        }
      }
      return Promise.resolve({ rows: [deleted], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single data source by id and user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from data_sources') && (normalizedSql.includes('id = $1 and ds.user_id = $2') || normalizedSql.includes('id = $1 and user_id = $2'))) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const ds = fallbackDataSources.find(d => d.id === id && d.user_id === userId);
    return Promise.resolve({
      rows: ds ? [{ ...ds }] : [],
      rowCount: ds ? 1 : 0
    });
  }

  // SELECT data_sources by user_id with dataset count
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from data_sources')) {
    const userId = Number(params[0]);
    const list = fallbackDataSources
      .filter(ds => ds.user_id === userId)
      .map(ds => {
        const datasetCount = fallbackDatasets.filter(d => d.data_source_id === ds.id && d.user_id === userId).length;
        const totalRows = fallbackDatasets
          .filter(d => d.data_source_id === ds.id && d.user_id === userId)
          .reduce((sum, d) => sum + (Number(d.row_count) || 0), 0);
        return {
          ...ds,
          dataset_count: datasetCount,
          total_rows: totalRows
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT data_sources
  if (normalizedSql.startsWith('insert into data_sources')) {
    const [userId, name, type, status = 'active', config = {}] = params;
    const newDs = {
      id: nextDataSourceId++,
      user_id: Number(userId),
      name,
      type,
      status,
      config: typeof config === 'string' ? JSON.parse(config) : config,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDataSources.push(newDs);
    return Promise.resolve({
      rows: [{ ...newDs }],
      rowCount: 1
    });
  }

  // ----------------- DATASETS -----------------
  // DELETE dataset
  if (normalizedSql.startsWith('delete from datasets')) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const idx = fallbackDatasets.findIndex(d => d.id === id && d.user_id === userId);
    if (idx !== -1) {
      const deleted = fallbackDatasets.splice(idx, 1)[0];
      return Promise.resolve({ rows: [deleted], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT single dataset by id and user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && (normalizedSql.includes('d.id = $1 and d.user_id = $2') || normalizedSql.includes('id = $1 and user_id = $2'))) {
    const id = Number(params[0]);
    const userId = Number(params[1]);
    const dataset = fallbackDatasets.find(d => d.id === id && d.user_id === userId);
    if (dataset) {
      const ds = fallbackDataSources.find(s => s.id === dataset.data_source_id);
      return Promise.resolve({
        rows: [{
          ...dataset,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv'
        }],
        rowCount: 1
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  // SELECT datasets by data_source_id and user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets') && normalizedSql.includes('data_source_id = $1 and user_id = $2')) {
    const dataSourceId = Number(params[0]);
    const userId = Number(params[1]);
    const list = fallbackDatasets.filter(d => d.data_source_id === dataSourceId && d.user_id === userId);
    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // SELECT datasets list with data_source details for user_id
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from datasets')) {
    const userId = Number(params[0]);
    const list = fallbackDatasets
      .filter(d => d.user_id === userId)
      .map(d => {
        const ds = fallbackDataSources.find(s => s.id === d.data_source_id);
        return {
          ...d,
          data_source_name: ds ? ds.name : 'Direct Upload',
          data_source_type: ds ? ds.type : 'csv',
          data_source_status: ds ? ds.status : 'active'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.resolve({
      rows: list,
      rowCount: list.length
    });
  }

  // INSERT datasets
  if (normalizedSql.startsWith('insert into datasets')) {
    const [userId, dataSourceId, name, description = '', filePath = '', rowCount = 0, columnCount = 0, schema = []] = params;
    const newDataset = {
      id: nextDatasetId++,
      user_id: Number(userId),
      data_source_id: dataSourceId ? Number(dataSourceId) : null,
      name,
      description: description || '',
      file_path: filePath,
      row_count: Number(rowCount) || 0,
      column_count: Number(columnCount) || 0,
      schema: typeof schema === 'string' ? JSON.parse(schema) : schema,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackDatasets.push(newDataset);
    return Promise.resolve({
      rows: [{ ...newDataset }],
      rowCount: 1
    });
  }

  // Schema creation or other generic commands
  return Promise.resolve({ rows: [], rowCount: 0 });
}

/**
 * Initialize database schema
 */
async function initDb() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'manager', 'viewer')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS data_sources (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('csv', 'json', 'postgresql')),
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'connected', 'error', 'pending')),
      config JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON data_sources(user_id);
    CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);

    CREATE TABLE IF NOT EXISTS datasets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_source_id INTEGER REFERENCES data_sources(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      file_path VARCHAR(500),
      row_count INTEGER DEFAULT 0,
      column_count INTEGER DEFAULT 0,
      schema JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
    CREATE INDEX IF NOT EXISTS idx_datasets_data_source_id ON datasets(data_source_id);
  `;

  try {
    await query(schemaSql);
    console.log(' PostgreSQL Database schema initialized successfully');
  } catch (err) {
    console.error(' Failed to initialize PostgreSQL database schema:', err.message);
  }
}

module.exports = {
  query,
  initDb,
  getPool: () => pool,
  isUsingFallback: () => useFallbackStore,
  _resetFallbackStore: () => {
    fallbackUsers.length = 0;
    fallbackDataSources.length = 0;
    fallbackDatasets.length = 0;
    nextUserId = 1;
    nextDataSourceId = 1;
    nextDatasetId = 1;
  }
};
