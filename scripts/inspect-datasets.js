const db = require('../server/config/database');

async function inspectDatasets() {
  try {
    const res = await db.query(`
      SELECT id, name, organization_id, row_count, column_count, storage_table, file_path, schema_json, created_at 
      FROM datasets 
      ORDER BY id DESC 
      LIMIT 10;
    `);
    console.log(`Latest 10 datasets:`);
    for (const d of res.rows) {
      console.log(`[Dataset #${d.id}] "${d.name}" | org=${d.organization_id} | rows=${d.row_count} | cols=${d.column_count} | storage_table=${d.storage_table} | file_path=${d.file_path}`);
      console.log(`  Schema:`, typeof d.schema_json === 'string' ? d.schema_json.slice(0, 150) : JSON.stringify(d.schema_json).slice(0, 150));
    }
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    process.exit(0);
  }
}

inspectDatasets();
