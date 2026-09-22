const { Client } = require('pg');

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
  const { password, ...safeConfig } = config;
  return {
    ...safeConfig,
    hasPassword: Boolean(password)
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
async function testPostgresConnection({ host, port = 5432, database, user, password, ssl = false }) {
  if (!host || !database || !user) {
    throw new Error('Host, database name, and username are required.');
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

module.exports = {
  testPostgresConnection,
  sanitizePostgresConfig
};
