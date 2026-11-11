const db = require('../server/config/database');
const storage = require('../server/storage');

async function testStorage() {
  try {
    const res = await db.query(`SELECT id, name, file_path, row_count, organization_id FROM datasets ORDER BY id DESC LIMIT 10`);
    console.log(`Testing storage for 10 datasets (Provider: ${storage.constructor.name}):`);
    for (const d of res.rows) {
      const exists = d.file_path ? await storage.exists(d.file_path) : false;
      const rowRes = await db.query(`SELECT COUNT(*) as c FROM dataset_rows WHERE dataset_id = $1`, [d.id]);
      console.log(`[#${d.id}] "${d.name}": file_path="${d.file_path}" -> fileExists=${exists}, dataset_rows=${rowRes.rows[0].c}`);
    }
  } catch (err) {
    console.error('Storage test failed:', err);
  } finally {
    process.exit(0);
  }
}

testStorage();
