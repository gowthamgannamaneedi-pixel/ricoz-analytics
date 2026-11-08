/**
 * HTTP Integration Test Suite for RicozAnalytics Team Messages REST Endpoints
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const { query, closeDb } = require('./config/database');

async function runHttpTests() {
  console.log('===========================================================');
  console.log(' RUNNING TEAM MESSAGES HTTP REST ENDPOINTS TEST');
  console.log('===========================================================');

  // Start ephemeral server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/collaboration`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(` ✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Get test users
  const userRes = await query(`
    SELECT id, email, role, organization_id, name 
    FROM users 
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY id ASC;
  `);

  const admin = userRes.rows.find(u => u.role === 'admin') || userRes.rows[0];
  const colleague = userRes.rows.find(u => u.id !== admin.id) || userRes.rows[1];
  const orgId = '00000000-0000-0000-0000-000000000001';

  // Generate valid signed JWTs
  const adminToken = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, organization_id: orgId },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const colleagueToken = jwt.sign(
    { id: colleague.id, email: colleague.email, role: colleague.role, organization_id: orgId },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  let testConvId = null;
  let testMsgId = null;

  // TEST 1: GET /api/collaboration/conversations
  await test('1. GET /api/collaboration/conversations returns conversation list', async () => {
    const res = await fetch(`${baseUrl}/conversations`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-organization-id': orgId
      }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert(Array.isArray(json.data));
  });

  // TEST 2: POST /api/collaboration/conversations/direct
  await test('2. POST /api/collaboration/conversations/direct creates DM', async () => {
    const res = await fetch(`${baseUrl}/conversations/direct`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'x-organization-id': orgId
      },
      body: JSON.stringify({ recipientId: colleague.id })
    });
    assert([200, 201].includes(res.status));
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert(json.data.id);
    assert.strictEqual(json.data.type, 'direct');
    testConvId = json.data.id;
  });

  // TEST 3: POST /api/collaboration/conversations/:id/messages
  await test('3. POST /api/collaboration/conversations/:id/messages sends message', async () => {
    const res = await fetch(`${baseUrl}/conversations/${testConvId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'x-organization-id': orgId
      },
      body: JSON.stringify({
        content: 'HTTP API test message for team messaging.'
      })
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.content, 'HTTP API test message for team messaging.');
    testMsgId = json.data.id;
  });

  // TEST 4: GET /api/collaboration/conversations/:id/messages
  await test('4. GET /api/collaboration/conversations/:id/messages returns message history', async () => {
    const res = await fetch(`${baseUrl}/conversations/${testConvId}/messages`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-organization-id': orgId
      }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert(Array.isArray(json.data));
    const found = json.data.find(m => m.id === testMsgId);
    assert(found, 'Created message must be present in history');
  });

  // TEST 5: POST /api/collaboration/messages/:id/reactions
  await test('5. POST /api/collaboration/messages/:id/reactions toggles reaction', async () => {
    const res = await fetch(`${baseUrl}/messages/${testMsgId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'x-organization-id': orgId
      },
      body: JSON.stringify({
        emoji: '🔥',
        conversationId: testConvId
      })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.action, 'added');
  });

  // TEST 6: POST /api/collaboration/messages/verify-shared-resource
  await test('6. POST /api/collaboration/messages/verify-shared-resource validates resource existence', async () => {
    const res = await fetch(`${baseUrl}/messages/verify-shared-resource`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'x-organization-id': orgId
      },
      body: JSON.stringify({
        resourceType: 'dashboard',
        resourceId: '00000000-0000-0000-0000-000000000001'
      })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.accessible, true);
  });

  // TEST 7: GET /api/collaboration/messages/presence
  await test('7. GET /api/collaboration/messages/presence returns presence map', async () => {
    const res = await fetch(`${baseUrl}/messages/presence`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-organization-id': orgId
      }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert(typeof json.data === 'object');
  });

  // TEST 8: POST /api/collaboration/conversations/:id/read
  await test('8. POST /api/collaboration/conversations/:id/read marks conversation as read', async () => {
    const res = await fetch(`${baseUrl}/conversations/${testConvId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${colleagueToken}`,
        'Content-Type': 'application/json',
        'x-organization-id': orgId
      },
      body: JSON.stringify({ messageId: testMsgId })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
  });

  // TEST 9: Tenant boundary rejection
  await test('9. Security: Block cross-tenant conversation access via HTTP', async () => {
    const res = await fetch(`${baseUrl}/conversations/${testConvId}/messages`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-organization-id': '00000000-0000-0000-0000-000000000002' // Mismatched org
      }
    });
    assert([403, 404].includes(res.status), `Status should be 403 or 404, got ${res.status}`);
  });

  server.close();
  await closeDb();

  console.log('===========================================================');
  console.log(` HTTP RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) process.exit(1);
}

runHttpTests().catch(async (e) => {
  console.error('Fatal HTTP test error:', e);
  await closeDb();
  process.exit(1);
});
