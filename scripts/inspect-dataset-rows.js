const db = require('../server/config/database');

async function inspectDatasetRows() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dataset_rows';
    `);
    console.log('Columns in dataset_rows table:');
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    const sample = await db.query(`SELECT * FROM dataset_rows ORDER BY id DESC LIMIT 3`);
    console.log('\nSample dataset_rows row:');
    console.log(sample.rows[0]);

    // Check count for dataset 392
    const d392 = await db.query(`SELECT COUNT(*) as c FROM dataset_rows WHERE dataset_id = 392`);
    console.log(`\nDataset 392 row count in dataset_rows:`, d392.rows[0].c);

    // Check "Mixed Variance Telemetry" dataset
    const mvt = await db.query(`SELECT id, name, row_count, column_count, organization_id FROM datasets WHERE name ILIKE '%Mixed Variance%'`);
    console.log(`\nMixed Variance Telemetry datasets:`, mvt.rows);
    if (mvt.rows.length > 0) {
      const mvtRows = await db.query(`SELECT * FROM dataset_rows WHERE dataset_id = $1 LIMIT 5`, [mvt.rows[0].id]);
      console.log(`Sample rows for Mixed Variance Telemetry (dataset ${mvt.rows[0].id}):`, mvtRows.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspectDatasetRows();
