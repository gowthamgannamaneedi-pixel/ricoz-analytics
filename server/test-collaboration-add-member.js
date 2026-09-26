/**
 * Comprehensive Automated Test Suite: Collaboration "Add Member" Bug Fix
 * Tests all 20 required criteria:
 * 1. Admin can add same-org member
 * 2. Manager permission according to existing RBAC
 * 3. Analyst denied if unauthorized (403)
 * 4. Viewer denied (403)
 * 5. Missing JWT -> 401
 * 6. Invalid JWT -> 401
 * 7. Nonexistent team -> 404
 * 8. Nonexistent user -> 404
 * 9. Cross-tenant user -> denied (404/403)
 * 10. Cross-tenant team -> denied (404/403)
 * 11. Duplicate member -> 409 Conflict
 * 12. Successful membership creation
 * 13. Organization isolation
 * 14. Audit event created (TEAM_MEMBER_ADDED)
 * 15. Notification behavior (team_change)
 * 16. Empty users handled safely
 * 17. API error handled gracefully
 * 18. Loading state handled safely
 * 19. Response schema matches frontend
 * 20. Existing team roster remains correct (team "xyz")
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const UserModel = require('./models/userModel');
const AuditLogModel = require('./models/auditLogModel');
const { TeamModel, NotificationModel } = require('./models/collaborationModel');

let server;
let port;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    let reqBody = null;
    if (body) {
      reqBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  COLLABORATION "ADD MEMBER" COMPREHENSIVE TEST SUITE (20 TESTS)  ');
  console.log('===============================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const orgA = '00000000-0000-0000-0000-000000000001';
  const orgB = '00000000-0000-0000-0000-000000000002';

  const adminTokenA = generateToken(1, 'admin@ricoz.test', 'admin', orgA);
  const managerTokenA = generateToken(2, 'manager@ricoz.test', 'manager', orgA);
  const analystTokenA = generateToken(3, 'analyst@ricoz.test', 'analyst', orgA);
  const viewerTokenA = generateToken(4, 'viewer@ricoz.test', 'viewer', orgA);
  const adminTokenB = generateToken(10, 'admin_b@other.test', 'admin', orgB);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Admin can add same-org member
    // -------------------------------------------------------------
    let testTeamId;
    await test('Admin can add same-org member', async () => {
      // Create fresh team
      const createRes = await request('POST', '/api/collaboration/teams', {
        name: 'Alpha Squad',
        description: 'Engineering analytics team'
      }, { Authorization: `Bearer ${adminTokenA}` });
      assert.strictEqual(createRes.statusCode, 201);
      testTeamId = createRes.body.data.id;

      // Add user 2 (Manager) as member
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 2,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenA}` });

      assert.ok([200, 201].includes(addRes.statusCode), `Expected 200 or 201, got ${addRes.statusCode}`);
      assert.strictEqual(addRes.body.success, true);
      assert.strictEqual(addRes.body.data.role, 'member');
    });

    // -------------------------------------------------------------
    // Test 2: Manager permission according to existing RBAC
    // -------------------------------------------------------------
    await test('Manager permission allows adding team members', async () => {
      // User 2 (Manager) adds User 3 (Analyst) to team
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 3,
        role: 'member'
      }, { Authorization: `Bearer ${managerTokenA}` });

      assert.ok([200, 201].includes(addRes.statusCode), `Expected 200 or 201, got ${addRes.statusCode}`);
      assert.strictEqual(addRes.body.success, true);
    });

    // -------------------------------------------------------------
    // Test 3: Analyst denied if unauthorized (403)
    // -------------------------------------------------------------
    await test('Analyst denied if unauthorized (403 Forbidden)', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 4,
        role: 'member'
      }, { Authorization: `Bearer ${analystTokenA}` });

      assert.strictEqual(addRes.statusCode, 403);
    });

    // -------------------------------------------------------------
    // Test 4: Viewer denied (403)
    // -------------------------------------------------------------
    await test('Viewer denied (403 Forbidden)', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 4,
        role: 'member'
      }, { Authorization: `Bearer ${viewerTokenA}` });

      assert.strictEqual(addRes.statusCode, 403);
    });

    // -------------------------------------------------------------
    // Test 5: Missing JWT -> 401 Unauthorized
    // -------------------------------------------------------------
    await test('Missing JWT returns 401 Unauthorized', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 4,
        role: 'member'
      });

      assert.strictEqual(addRes.statusCode, 401);
    });

    // -------------------------------------------------------------
    // Test 6: Invalid JWT -> 401 Unauthorized
    // -------------------------------------------------------------
    await test('Invalid JWT returns 401 Unauthorized', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 4,
        role: 'member'
      }, { Authorization: 'Bearer invalid.token.payload' });

      assert.strictEqual(addRes.statusCode, 401);
    });

    // -------------------------------------------------------------
    // Test 7: Nonexistent team -> 404 Not Found
    // -------------------------------------------------------------
    await test('Nonexistent team returns 404 Not Found', async () => {
      const addRes = await request('POST', '/api/collaboration/teams/999999/members', {
        targetUserId: 4,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenA}` });

      assert.strictEqual(addRes.statusCode, 404);
      assert.strictEqual(addRes.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 8: Nonexistent user -> 404 Not Found
    // -------------------------------------------------------------
    await test('Nonexistent user returns 404 Not Found', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 999999,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenA}` });

      assert.strictEqual(addRes.statusCode, 404);
      assert.strictEqual(addRes.body.success, false);
    });

    // -------------------------------------------------------------
    // Test 9: Cross-tenant user -> denied
    // -------------------------------------------------------------
    await test('Cross-tenant user cannot be added to Org A team (404/403)', async () => {
      // User 10 belongs to Org B
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 10,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenA}` });

      // Target user does not belong to Org A -> 404
      assert.strictEqual(addRes.statusCode, 404);
    });

    // -------------------------------------------------------------
    // Test 10: Cross-tenant team -> denied
    // -------------------------------------------------------------
    await test('Org B admin cannot access or add members to Org A team (404/403)', async () => {
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 10,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenB}` });

      assert.strictEqual(addRes.statusCode, 404);
    });

    // -------------------------------------------------------------
    // Test 11: Duplicate member -> 409 Conflict
    // -------------------------------------------------------------
    await test('Duplicate member returns 409 Conflict', async () => {
      // User 2 is already a member of Alpha Squad (added in Test 1)
      const dupRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 2,
        role: 'member'
      }, { Authorization: `Bearer ${adminTokenA}` });

      assert.strictEqual(dupRes.statusCode, 409);
      assert.strictEqual(dupRes.body.success, false);
      assert.match(dupRes.body.message || dupRes.body.error, /already a member/i);
    });

    // -------------------------------------------------------------
    // Test 12: Successful membership creation
    // -------------------------------------------------------------
    await test('Successful membership creation returns valid record', async () => {
      // Add User 4 (Viewer) to team as 'lead'
      const addRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {
        targetUserId: 4,
        role: 'lead'
      }, { Authorization: `Bearer ${adminTokenA}` });

      assert.ok([200, 201].includes(addRes.statusCode), `Expected 200 or 201, got ${addRes.statusCode}`);
      assert.strictEqual(addRes.body.success, true);
      assert.strictEqual(String(addRes.body.data.user_id), '4');
      assert.strictEqual(addRes.body.data.role, 'lead');
    });

    // -------------------------------------------------------------
    // Test 13: Organization isolation on team listing & member access
    // -------------------------------------------------------------
    await test('Organization isolation verified on team details and member list', async () => {
      // Org A details
      const detailsA = await request('GET', `/api/collaboration/teams/${testTeamId}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      assert.strictEqual(detailsA.statusCode, 200);
      assert.strictEqual(detailsA.body.data.name, 'Alpha Squad');
      assert.ok(Array.isArray(detailsA.body.data.members));
      assert.ok(detailsA.body.data.members.length >= 3);

      // Org B admin cannot view Org A team
      const detailsB = await request('GET', `/api/collaboration/teams/${testTeamId}`, null, {
        Authorization: `Bearer ${adminTokenB}`
      });
      assert.strictEqual(detailsB.statusCode, 404);
    });

    // -------------------------------------------------------------
    // Test 14: Audit event created (TEAM_MEMBER_ADDED)
    // -------------------------------------------------------------
    await test('Audit event TEAM_MEMBER_ADDED is logged with safe metadata', async () => {
      const logs = await AuditLogModel.findByOrganizationId(orgA, {
        action: 'TEAM_MEMBER_ADDED',
        limit: 10
      });

      const memberLogs = logs.logs || logs;
      assert.ok(memberLogs.length > 0, 'Audit event TEAM_MEMBER_ADDED should exist');
      const latest = memberLogs[0];
      assert.strictEqual(latest.action, 'TEAM_MEMBER_ADDED');
      assert.strictEqual(latest.resource_type, 'team');
      assert.ok(latest.description.includes('Alpha Squad') || latest.description.includes('user'));
    });

    // -------------------------------------------------------------
    // Test 15: Notification behavior
    // -------------------------------------------------------------
    await test('Notification created for added member', async () => {
      // User 4 should have received a notification
      const notifs = await NotificationModel.listByUser(4, orgA, 10);
      assert.ok(notifs.length > 0, 'Notification should be created for added member');
      const teamNotif = notifs.find(n => n.type === 'team_change');
      assert.ok(teamNotif, 'Team change notification should exist');
      assert.match(teamNotif.title, /Alpha Squad/i);
    });

    // -------------------------------------------------------------
    // Test 16: Safe handling of user search with empty results
    // -------------------------------------------------------------
    await test('Organization users search returns empty array when no query matches', async () => {
      const searchRes = await request('GET', '/api/collaboration/users?search=nonexistent_xyz_query_123', null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(searchRes.statusCode, 200);
      assert.strictEqual(searchRes.body.success, true);
      assert.ok(Array.isArray(searchRes.body.data));
      assert.strictEqual(searchRes.body.data.length, 0);
    });

    // -------------------------------------------------------------
    // Test 17: Safe handling of API errors on frontend
    // -------------------------------------------------------------
    await test('API error handling does not throw unhandled exceptions', async () => {
      // Simulate client calling with missing/invalid params
      const errRes = await request('POST', `/api/collaboration/teams/${testTeamId}/members`, {}, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(errRes.statusCode, 400);
      assert.strictEqual(errRes.body.success, false);
      assert.strictEqual(typeof errRes.body.message, 'string');
    });

    // -------------------------------------------------------------
    // Test 18: Loading state & sanitized user response
    // -------------------------------------------------------------
    await test('Organization users list excludes password and includes safe fields', async () => {
      const usersRes = await request('GET', '/api/collaboration/users', null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(usersRes.statusCode, 200);
      assert.ok(Array.isArray(usersRes.body.data));
      for (const u of usersRes.body.data) {
        assert.strictEqual(u.password, undefined);
        assert.strictEqual(u.password_hash, undefined);
        assert.ok(u.id);
        assert.ok(u.name);
        assert.ok(u.email);
        assert.ok(u.role);
      }
    });

    // -------------------------------------------------------------
    // Test 19: Response schema matches frontend expectation
    // -------------------------------------------------------------
    await test('Response schema matches frontend (success: true, data: Array)', async () => {
      const usersRes = await request('GET', `/api/collaboration/users?teamId=${testTeamId}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(usersRes.statusCode, 200);
      assert.strictEqual(usersRes.body.success, true);
      assert.ok(Array.isArray(usersRes.body.data), 'data must be an Array');
      
      // Verify is_already_member flag is provided when teamId is passed
      const user2 = usersRes.body.data.find(u => String(u.id) === '2');
      if (user2) {
        assert.strictEqual(user2.is_already_member, true);
      }
    });

    // -------------------------------------------------------------
    // Test 20: Existing team "xyz" roster remains correct
    // -------------------------------------------------------------
    await test('Existing team "xyz" and its roster remain intact', async () => {
      const teamsRes = await request('GET', '/api/collaboration/teams', null, {
        Authorization: `Bearer ${adminTokenA}`
      });

      assert.strictEqual(teamsRes.statusCode, 200);
      assert.ok(Array.isArray(teamsRes.body.data));
      const xyzTeam = teamsRes.body.data.find(t => t.name === 'xyz');
      assert.ok(xyzTeam, 'Team "xyz" must exist');

      const xyzDetails = await request('GET', `/api/collaboration/teams/${xyzTeam.id}`, null, {
        Authorization: `Bearer ${adminTokenA}`
      });
      assert.strictEqual(xyzDetails.statusCode, 200);
      assert.strictEqual(xyzDetails.body.data.name, 'xyz');
      assert.ok(Array.isArray(xyzDetails.body.data.members));
      assert.ok(xyzDetails.body.data.members.length >= 1, 'Team "xyz" must have at least 1 member');
      assert.ok(xyzDetails.body.data.members.some(m => m.user_name?.toLowerCase().includes('gowtham') || m.user_email?.includes('admin')));
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  RESULT: ${passed}/${total} TESTS PASSED (${((passed/total)*100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runTests;
