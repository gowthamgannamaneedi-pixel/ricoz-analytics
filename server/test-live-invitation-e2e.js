const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const BASE_URL = 'https://ricoz-analytics.onrender.com';
const TEST_EMAIL = 'ricozanalytics@gmail.com';

async function main() {
  console.log('--- TESTING LIVE PRODUCTION INVITATION END-TO-END ---');

  // 1. Admin login to obtain token
  console.log('\n1. Logging in as Admin (admin@ricoz.test)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ricoz.test', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const adminToken = loginData.token;
  const orgId = loginData.user.organization_id;
  console.log(`✅ Admin logged in. Org: ${loginData.user.organization_name} (${orgId})`);

  // 2. Clean up any previous test invitation for TEST_EMAIL
  console.log(`\n2. Cleaning up any previous invitation for ${TEST_EMAIL}...`);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  await pool.query('DELETE FROM invitations WHERE LOWER(email) = $1', [TEST_EMAIL.toLowerCase()]).catch(() => null);
  await pool.query('DELETE FROM users WHERE LOWER(email) = $1', [TEST_EMAIL.toLowerCase()]).catch(() => null);

  // 3. Send fresh invitation via production API
  console.log(`\n3. Sending fresh invitation to ${TEST_EMAIL} as 'analyst'...`);
  const inviteRes = await fetch(`${BASE_URL}/api/admin/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      role: 'analyst'
    })
  });
  const inviteData = await inviteRes.json();
  console.log('Invite API Status:', inviteRes.status);
  console.log('Invite API Response:', inviteData);
  if (!inviteData.success) {
    throw new Error(`Invite API failed: ${JSON.stringify(inviteData)}`);
  }

  // 4. Retrieve raw token from DB
  console.log('\n4. Retrieving invitation token from DB...');
  const invDbRes = await pool.query(
    'SELECT id, token, token_hash, status, expires_at, role, organization_id FROM invitations WHERE LOWER(email) = $1 AND status = \'pending\'',
    [TEST_EMAIL.toLowerCase()]
  );
  if (invDbRes.rows.length === 0) {
    throw new Error('Invitation record not found in database!');
  }
  const dbInvite = invDbRes.rows[0];
  const rawToken = dbInvite.token;
  console.log(`✅ Invitation found: id=${dbInvite.id}, role=${dbInvite.role}, expires=${dbInvite.expires_at}`);

  // 5. Query public invitation details (GET /api/auth/invite/:rawToken)
  console.log('\n5. Inspecting invitation details via GET /api/auth/invite/:token...');
  const detailsRes = await fetch(`${BASE_URL}/api/auth/invite/${rawToken}`);
  const detailsData = await detailsRes.json();
  console.log('Details Status:', detailsRes.status);
  console.log('Details Response:', detailsData);
  if (detailsRes.status !== 200 || !detailsData.success) {
    throw new Error(`Failed to inspect invitation details: ${JSON.stringify(detailsData)}`);
  }
  console.log(`✅ Invitation verified: Org=${detailsData.invitation.organizationName}, Role=${detailsData.invitation.role}, ExistingUser=${detailsData.invitation.isExistingUser}`);

  // 6. Complete invitation acceptance (POST /api/auth/accept-invite)
  console.log('\n6. Accepting invitation via POST /api/auth/accept-invite...');
  const acceptRes = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      name: 'Ricoz Analyst Invitee',
      password: 'analystPassword2026!'
    })
  });
  const acceptData = await acceptRes.json();
  console.log('Accept Status:', acceptRes.status);
  console.log('Accept Response:', acceptData);
  if (acceptRes.status !== 200 || !acceptData.success) {
    throw new Error(`Failed to accept invitation: ${JSON.stringify(acceptData)}`);
  }
  console.log(`✅ Invitation accepted successfully! Assigned user: id=${acceptData.user.id}, email=${acceptData.user.email}, role=${acceptData.user.role}, org=${acceptData.user.organization_name}`);

  // 7. Verify token replay / reuse is strictly rejected
  console.log('\n7. Verifying token replay is rejected...');
  const replayRes = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      name: 'Replay Attacker',
      password: 'analystPassword2026!'
    })
  });
  const replayData = await replayRes.json();
  console.log('Replay Status:', replayRes.status);
  console.log('Replay Response:', replayData);
  if (replayRes.status !== 400 || replayData.error?.code !== 'INVITATION_ALREADY_USED') {
    throw new Error(`Replay protection failed! Expected INVITATION_ALREADY_USED, got: ${JSON.stringify(replayData)}`);
  }
  console.log('✅ Replay strictly blocked with 400 INVITATION_ALREADY_USED.');

  // 8. Verify the new user can log in with their accepted credentials
  console.log('\n8. Verifying newly accepted member can log in...');
  const memberLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: 'analystPassword2026!'
    })
  });
  const memberLoginData = await memberLoginRes.json();
  console.log('Member Login Status:', memberLoginRes.status);
  if (memberLoginRes.status !== 200 || !memberLoginData.success) {
    throw new Error(`Member login failed: ${JSON.stringify(memberLoginData)}`);
  }
  console.log(`✅ Member authenticated successfully! Role: ${memberLoginData.user.role}, Organization: ${memberLoginData.user.organization_name}`);

  // Cleanup test user from DB
  console.log('\n9. Cleaning up test record...');
  await pool.query('DELETE FROM users WHERE LOWER(email) = $1', [TEST_EMAIL.toLowerCase()]).catch(() => null);
  await pool.query('DELETE FROM invitations WHERE LOWER(email) = $1', [TEST_EMAIL.toLowerCase()]).catch(() => null);
  await pool.end();

  console.log('\n🎉 ALL LIVE PRODUCTION INVITATION ACCEPTANCE CHECKS PASSED END-TO-END!');
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
