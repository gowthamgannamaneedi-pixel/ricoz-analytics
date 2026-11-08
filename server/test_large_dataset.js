const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const pythonAiService = require('./services/pythonAiService');
  
  // Find Audit Dataset or dataset with 4 rows or positive revenue
  const auditRes = await pool.query(
    "SELECT id, name, row_count FROM datasets WHERE (name ILIKE '%audit%' OR name ILIKE '%telemetry%' OR id = 31) AND row_count > 0 LIMIT 3;"
  );
  console.log('Selected Datasets for Testing:', auditRes.rows);

  for (const ds of auditRes.rows) {
    const sample = await pool.query("SELECT data FROM dataset_rows WHERE dataset_id = $1 LIMIT 1", [ds.id]);
    console.log(`\n======================================================`);
    console.log(`DATASET: ${ds.name} (ID: ${ds.id}, Rows: ${ds.row_count})`);
    console.log(`Sample columns:`, Object.keys(sample.rows[0]?.data || {}));

    const qRes = await pythonAiService.query({
      message: 'how to increase my sales',
      organizationId: '00000000-0000-0000-0000-000000000001',
      userId: 1,
      userRole: 'admin',
      datasetId: ds.id
    });

    console.log(`\nAnswer for "${ds.name}":\n`);
    console.log(qRes.answer);
  }

  await pool.end();
}
check().catch(console.error);
