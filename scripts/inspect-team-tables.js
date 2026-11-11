const db = require('../server/config/database');

async function run() {
  try {
    const c = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'conversations'");
    console.log('conversations:', c.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const t = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'teams'");
    console.log('teams:', t.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const tm = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'team_members'");
    console.log('team_members:', tm.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const cp = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'conversation_participants'");
    console.log('conversation_participants:', cp.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
run();
