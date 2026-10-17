const db = require('../config/database');

async function check() {
  try {
    const r = await db.query(`
      SELECT tc.table_name, kcu.column_name, rc.delete_rule 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name 
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND rc.unique_constraint_name IN (
          SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'organizations'
        )
    `);
    console.table(r.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
