const db = require('../server/config/database');

async function inspectDatasetColumns() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'datasets';
    `);
    console.log('Columns in datasets table:');
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    const sample = await db.query(`SELECT * FROM datasets ORDER BY id DESC LIMIT 3`);
    console.log('\nSample dataset row:');
    console.log(sample.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspectDatasetColumns();
