const TeamMessageModel = require('../server/models/teamMessageModel');
const db = require('../server/config/database');

async function test() {
  try {
    const orgId = '00000000-0000-0000-0000-000000000001';
    const teamRes = await db.query("SELECT id, name FROM teams WHERE organization_id = $1 LIMIT 1", [orgId]);
    const userRes = await db.query("SELECT id FROM users WHERE organization_id = $1 LIMIT 1", [orgId]);
    
    console.log('Testing createGroupConversation with:', { orgId, team: teamRes.rows[0], user: userRes.rows[0] });
    
    if (teamRes.rows[0]) {
      const conv = await TeamMessageModel.createGroupConversation({
        organizationId: orgId,
        teamId: teamRes.rows[0].id,
        title: teamRes.rows[0].name,
        createdBy: userRes.rows[0]?.id || 1,
        memberUserIds: []
      });
      console.log('Group conv created successfully:', conv?.id, conv?.title);
    }
  } catch (err) {
    console.error('Error creating group conversation:', err);
  }
  process.exit(0);
}
test();
