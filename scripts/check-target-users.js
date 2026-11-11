const db = require('../server/config/database');

async function test() {
  const users = await db.query(
    "SELECT id, name, email, role, organization_id FROM users WHERE email ILIKE '%gowtham%'"
  );
  console.log('Users:', users.rows);

  const teamMembers = await db.query(
    "SELECT tm.*, t.name as team_name, t.organization_id as team_org_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id IN ('1', '727') OR tm.user_id::text IN ('1', '727')"
  );
  console.log('Team memberships:', teamMembers.rows);

  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
