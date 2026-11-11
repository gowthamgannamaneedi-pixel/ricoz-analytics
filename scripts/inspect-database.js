const db = require('../server/config/database');

async function inspectTables() {
  try {
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`Found ${res.rows.length} tables in PostgreSQL:`);
    for (const row of res.rows) {
      try {
        const countRes = await db.query(`SELECT COUNT(*) as c FROM "${row.table_name}"`);
        console.log(`  ${row.table_name}: ${countRes.rows[0].c} rows`);
      } catch (e) {
        console.log(`  ${row.table_name}: error (${e.message})`);
      }
    }
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    process.exit(0);
  }
}

inspectTables();
