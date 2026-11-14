const fs = require('fs');
const path = require('path');
const dotenv = require(path.resolve(__dirname, '../server/node_modules/dotenv'));
const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server/.env')));
const { Pool } = require(path.resolve(__dirname, '../server/node_modules/pg'));

const isLocal = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function runBackup() {
  console.log('[Backup] Connecting to production PostgreSQL database...');
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[Backup] Found ${tables.length} tables in public schema.`);

    const backupDir = 'backups';
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${backupDir}/db_snapshot_${ts}.json`;

    const snapshot = {
      timestamp: new Date().toISOString(),
      database_host: new URL(env.DATABASE_URL.replace('postgresql://', 'http://')).host,
      table_count: tables.length,
      tables: {}
    };

    for (const table of tables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const rowCount = parseInt(countRes.rows[0].count, 10);
        snapshot.tables[table] = { row_count: rowCount };
      } catch (err) {
        snapshot.tables[table] = { error: err.message };
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2));
    console.log(`[Backup] ✅ Database snapshot metadata successfully saved to: ${backupFile}`);
    console.log('[Backup] Table summary:');
    console.table(snapshot.tables);

    // Add backups/ to .gitignore check
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.includes('backups/')) {
      fs.appendFileSync('.gitignore', '\n# Database backups\nbackups/\n');
    }

    return backupFile;
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch(err => {
  console.error('[Backup Error]:', err.message);
  process.exit(1);
});
