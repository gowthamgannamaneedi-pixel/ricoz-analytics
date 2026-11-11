const db = require('../server/config/database');
async function test() {
  try {
    const res = await db.query('SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2', ['518e3463-8e0d-4aab-95e7-cec3561f82d3', '00000000-0000-0000-0000-000000000001']);
    console.log('Query success:', res.rows);
  } catch (err) {
    console.error('Query error:', err);
  }
  process.exit(0);
}
test();
