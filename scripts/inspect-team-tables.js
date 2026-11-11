const db = require('../server/config/database');

async function run() {
  try {
    const c = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'conversations'");
    console.log('conversations:', c.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const t = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'teams'");
    console.log('teams:', t.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const tm = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'team_members'");
    console.log('team_members:', tm.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const u = await db.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('users:', u.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
    const sampleUsers = await db.query("SELECT id, name, email, organization_id FROM users LIMIT 5");
    console.log('sampleUsers:', sampleUsers.rows);
    const sampleTeams = await db.query("SELECT id, name, organization_id FROM teams LIMIT 5");
    console.log('sampleTeams:', sampleTeams.rows);
    const sampleTM = await db.query("SELECT id, team_id, user_id FROM team_members LIMIT 5");
    console.log('sampleTM:', sampleTM.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
run();

