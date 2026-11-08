const { Client } = require('pg');
const { validateUrl } = require('../utils/urlSecurity');

/**
 * PostgreSQL Data Source Service
 * Handles connection validation and credential sanitization for external PostgreSQL sources
 */

/**
 * Sanitize PostgreSQL config object (strips password and sensitive tokens)
 * @param {object} config 
 * @returns {object}
 */
function sanitizePostgresConfig(config = {}) {
  if (!config || typeof config !== 'object') return {};
  const { password, auth_token, authToken, apiKey, api_key, token, ...safeConfig } = config;
  return {
    ...safeConfig,
    hasPassword: Boolean(password),
    hasAuthToken: Boolean(auth_token || authToken || apiKey || api_key || token)
  };
}

/**
 * Test external PostgreSQL connection
 * @param {object} params
 * @param {string} params.host
 * @param {number} [params.port=5432]
 * @param {string} params.database
 * @param {string} params.user
 * @param {string} [params.password]
 * @param {boolean} [params.ssl=false]
 * @returns {Promise<{ success: boolean, message: string, serverVersion?: string, tables?: string[] }>}
 */
async function testPostgresConnection({ host, port = 5432, database, user, password, ssl = false, allowLocal }) {
  if (!host || !database || !user) {
    throw new Error('Host, database name, and username are required.');
  }
  // Validate host to prevent SSRF/internal connections
  try {
    const isLocalAllowed = Boolean(process.env.ALLOW_LOCAL_CONNECTORS === 'true' || allowLocal);
    await validateUrl(`http://${host}`, { allowLocal: isLocalAllowed });
  } catch (e) {
    throw new Error(`Disallowed PostgreSQL host: ${e.message}`);
  }
  const client = new Client({
    host,
    port: Number(port) || 5432,
    database,
    user,
    password: password || '',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 4000 // 4 second connection timeout
  });

  try {
    await client.connect();

    // Query basic system info and public tables
    const versionRes = await client.query('SELECT version()');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name 
      LIMIT 20
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    const serverVersion = versionRes.rows[0]?.version || 'PostgreSQL';

    await client.end();

    return {
      success: true,
      message: 'Successfully established connection with PostgreSQL database.',
      serverVersion,
      tables
    };
  } catch (err) {
    try {
      await client.end();
    } catch (_) {}

    return {
      success: false,
      message: `Connection failed: ${err.message}`
    };
  }
}

/**
 * Preview sample rows and schema from a specific PostgreSQL table
 * @param {object} params
 * @param {string} params.host
 * @param {number} [params.port=5432]
 * @param {string} params.database
 * @param {string} params.user
 * @param {string} [params.password]
 * @param {boolean} [params.ssl=false]
 * @param {string} params.table
 * @param {number} [params.limit=10]
 * @param {boolean} [params.allowLocal=false]
 */
async function previewPostgresTable({ host, port = 5432, database, user, password, ssl = false, table, limit = 10, allowLocal }) {
  if (!host || !database || !user || !table) {
    throw new Error('Host, database name, username, and table name are required.');
  }

  const isLocalAllowed = Boolean(process.env.ALLOW_LOCAL_CONNECTORS === 'true' || allowLocal);
  try {
    await validateUrl(`http://${host}`, { allowLocal: isLocalAllowed });
  } catch (e) {
    throw new Error(`Disallowed PostgreSQL host: ${e.message}`);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error('Invalid table name. Only alphanumeric characters and underscores are permitted.');
  }

  const client = new Client({
    host,
    port: Number(port) || 5432,
    database,
    user,
    password: password || '',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();

    const checkTable = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (checkTable.rows.length === 0) {
      throw new Error(`Table '${table}' not found in public schema.`);
    }

    const columnsRes = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const dataRes = await client.query(`SELECT * FROM "${table}" LIMIT $1`, [safeLimit]);

    const countRes = await client.query(`SELECT count(*)::int as total FROM "${table}"`);
    const totalRows = countRes.rows[0]?.total || 0;

    await client.end();

    const schema = columnsRes.rows.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES'
    }));

    return {
      success: true,
      table,
      totalRows,
      rowCount: dataRes.rows.length,
      columnCount: schema.length,
      schema,
      preview: dataRes.rows
    };
  } catch (err) {
    try { await client.end(); } catch (_) {}
    throw err;
  }
}

/**
 * Ingest rows from a specific PostgreSQL table into records array
 * @param {object} params
 * @param {string} params.host
 * @param {number} [params.port=5432]
 * @param {string} params.database
 * @param {string} params.user
 * @param {string} [params.password]
 * @param {boolean} [params.ssl=false]
 * @param {string} params.table
 * @param {number} [params.maxRecords=10000]
 * @param {boolean} [params.allowLocal=false]
 */
async function ingestPostgresTable({ host, port = 5432, database, user, password, ssl = false, table, maxRecords = 10000, allowLocal }) {
  if (!host || !database || !user || !table) {
    throw new Error('Host, database name, username, and table name are required.');
  }

  const isLocalAllowed = Boolean(process.env.ALLOW_LOCAL_CONNECTORS === 'true' || allowLocal);
  try {
    await validateUrl(`http://${host}`, { allowLocal: isLocalAllowed });
  } catch (e) {
    throw new Error(`Disallowed PostgreSQL host: ${e.message}`);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error('Invalid table name. Only alphanumeric characters and underscores are permitted.');
  }

  const client = new Client({
    host,
    port: Number(port) || 5432,
    database,
    user,
    password: password || '',
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();

    const checkTable = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (checkTable.rows.length === 0) {
      throw new Error(`Table '${table}' not found in public schema.`);
    }

    const columnsRes = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    const safeLimit = Math.min(Math.max(Number(maxRecords) || 1000, 1), 50000);
    const dataRes = await client.query(`SELECT * FROM "${table}" LIMIT $1`, [safeLimit]);

    await client.end();

    const schema = columnsRes.rows.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES'
    }));

    return {
      success: true,
      table,
      rowCount: dataRes.rows.length,
      columnCount: schema.length,
      schema,
      records: dataRes.rows
    };
  } catch (err) {
    try { await client.end(); } catch (_) {}
    throw err;
  }
}

module.exports = {
  testPostgresConnection,
  previewPostgresTable,
  ingestPostgresTable,
  sanitizePostgresConfig
};
