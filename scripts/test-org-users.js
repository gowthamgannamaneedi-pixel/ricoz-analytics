const db = require('../server/config/database');

async function test() {
  const users = await db.query(
    "SELECT id, name, email, role, organization_id FROM users WHERE email ILIKE '%ricozanalytics%'"
  );
  console.log('Ricozanalytics users:', users.rows);

  const teamMembers = await db.query(
    "SELECT tm.*, t.name as team_name, t.organization_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.name ILIKE '%test%'"
  );
  console.log('Teams with test:', teamMembers.rows);

  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
