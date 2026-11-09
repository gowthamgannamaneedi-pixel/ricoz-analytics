const assert = require('assert');
const { query, ensureTeamMessagingTables } = require('./config/database');
const TeamMessageModel = require('./models/teamMessageModel');
const teamMessageController = require('./controllers/teamMessageController');
const realtimeMessagingService = require('./services/realtimeMessagingService');

async function runStrictE2ETest() {
  console.log('=====================================================');
  console.log('🧪 RICOZANALYTICS TEAM MESSAGES COMPREHENSIVE E2E TEST');
  console.log('=====================================================');

  // STEP 1: Verify Schema
  console.log('\n[TEST 1] Verifying Database Schema via ensureTeamMessagingTables...');
  const schemaRes = await ensureTeamMessagingTables();
  assert(schemaRes.success, 'ensureTeamMessagingTables must return success: true');
  console.log('✅ Schema verified successfully. userIdType:', schemaRes.userIdType);

  // STEP 2: Find two test users in the same organization
  const orgRes = await query('SELECT id, name FROM organizations WHERE id = $1 LIMIT 1', ['00000000-0000-0000-0000-000000000001']);
  const org = orgRes.rows[0];
  assert(org, 'Default organization 00000000-0000-0000-0000-000000000001 must exist');

  const usersRes = await query('SELECT id, email, name, role FROM users WHERE organization_id = $1 LIMIT 5', [org.id]);
  assert(usersRes.rows.length >= 2, 'Need at least 2 users in test organization');

  const userAdmin = usersRes.rows.find(u => u.role === 'admin') || usersRes.rows[0];
  const userAnalyst = usersRes.rows.find(u => u.id !== userAdmin.id) || usersRes.rows[1];

  console.log(`\n[TEST 2] Using Test Users in org "${org.name}":`);
  console.log(`- User A (Sender): ${userAdmin.name} (${userAdmin.email}, ID: ${userAdmin.id})`);
  console.log(`- User B (Recipient): ${userAnalyst.name} (${userAnalyst.email}, ID: ${userAnalyst.id})`);

  // Mock response helper
  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };
  }

  // STEP 3: Self-messaging rejection
  console.log('\n[TEST 3] Verifying Self-Conversation Prevention (Backend Enforcement)...');
  const selfReq = {
    user: { id: userAdmin.id, email: userAdmin.email, organization_id: org.id },
    organization: { id: org.id },
    headers: { 'x-organization-id': org.id },
    body: { recipientId: userAdmin.id }
  };
  const selfRes = createMockRes();
  await teamMessageController.createDirectConversation(selfReq, selfRes);
  assert.strictEqual(selfRes.statusCode, 400, 'Self conversation must be rejected with 400');
  console.log('✅ Self conversation correctly rejected:', selfRes.body.message);

  // STEP 4: Create Direct Conversation (Admin -> Analyst)
  console.log('\n[TEST 4] Creating Direct Conversation (Admin -> Analyst)...');
  const dmReq1 = {
    user: { id: userAdmin.id, email: userAdmin.email, organization_id: org.id },
    organization: { id: org.id },
    headers: { 'x-organization-id': org.id },
    body: { recipientId: userAnalyst.id }
  };
  const dmRes1 = createMockRes();
  await teamMessageController.createDirectConversation(dmReq1, dmRes1);
  assert.strictEqual(dmRes1.statusCode, 201, `createDirectConversation must return 201, got ${dmRes1.statusCode}`);
  assert(dmRes1.body.success, 'Response success must be true');
  assert(dmRes1.body.data && dmRes1.body.data.id, 'Response must include conversation data with id');
  const convId = dmRes1.body.data.id;
  console.log('✅ Direct conversation initialized. Conv UUID:', convId);

  // STEP 5: Idempotency Verification (Analyst -> Admin or repeated Admin -> Analyst)
  console.log('\n[TEST 5] Verifying Idempotency (Repeat initialization)...');
  const dmReq2 = {
    user: { id: userAnalyst.id, email: userAnalyst.email, organization_id: org.id },
    organization: { id: org.id },
    headers: { 'x-organization-id': org.id },
    body: { recipientId: userAdmin.id }
  };
  const dmRes2 = createMockRes();
  await teamMessageController.createDirectConversation(dmReq2, dmRes2);
  assert.strictEqual(dmRes2.statusCode, 201, 'Subsequent call must return 201/200');
  assert.strictEqual(dmRes2.body.data.id, convId, 'Idempotent lookup must return the exact same conversation ID');
  console.log('✅ Idempotency verified: Both requests resolved to conversation UUID:', convId);

  // STEP 6: Realtime SSE event registration for User B
  console.log('\n[TEST 6] Registering Realtime SSE Client for User B (Analyst)...');
  const receivedEvents = [];
  const mockSseRes = {
    writableEnded: false,
    destroyed: false,
    write(chunk) {
      if (typeof chunk === 'string') {
        const lines = chunk.split('\n');
        for (const l of lines) {
          if (l.startsWith('data: ')) {
            try {
              receivedEvents.push(JSON.parse(l.slice(6)));
            } catch (_) {}
          }
        }
      }
    },
    on() {}
  };

  const connId = realtimeMessagingService.registerClient(mockSseRes, userAnalyst.id, org.id);
  assert(connId, 'SSE client must be registered with connectionId');
  console.log('✅ User B registered to SSE stream. Connection ID:', connId);

  // STEP 7: Send Message from Admin to Analyst
  console.log('\n[TEST 7] Sending message from User A to User B...');
  const sendReq = {
    user: { id: userAdmin.id, email: userAdmin.email, organization_id: org.id },
    organization: { id: org.id },
    params: { conversationId: convId },
    body: { content: 'Strict acceptance test message: Hello Team Analyst!' }
  };
  const sendRes = createMockRes();
  await teamMessageController.sendMessage(sendReq, sendRes);
  assert.strictEqual(sendRes.statusCode, 201, 'Send message must return 201');
  assert(sendRes.body.data && sendRes.body.data.id, 'Message must be returned with ID');
  const messageId = sendRes.body.data.id;
  console.log('✅ Message persisted successfully. Message ID:', messageId);

  // STEP 8: Verify Realtime Event Delivery to User B
  console.log('\n[TEST 8] Verifying Realtime SSE Delivery to User B...');
  const newMsgEvent = receivedEvents.find(e => e.message && e.message.id === messageId);
  assert(newMsgEvent, 'User B must have received message:new event via SSE');
  assert.strictEqual(newMsgEvent.message.content, 'Strict acceptance test message: Hello Team Analyst!');
  console.log('✅ User B received real-time SSE message without refreshing browser!');

  // STEP 9: Mark as Read by User B & Verify Unread Count
  console.log('\n[TEST 9] Marking conversation as read by User B...');
  const readReq = {
    user: { id: userAnalyst.id, email: userAnalyst.email, organization_id: org.id },
    organization: { id: org.id },
    params: { conversationId: convId },
    body: { messageId }
  };
  const readRes = createMockRes();
  await teamMessageController.markAsRead(readReq, readRes);
  assert.strictEqual(readRes.statusCode, 200, 'markAsRead must return 200');
  console.log('✅ Conversation marked as read.');

  // STEP 10: Toggle Emoji Reaction
  console.log('\n[TEST 10] Toggling emoji reaction on message...');
  const reactReq = {
    user: { id: userAnalyst.id, email: userAnalyst.email, organization_id: org.id },
    organization: { id: org.id },
    params: { messageId },
    body: { conversationId: convId, emoji: '🚀' }
  };
  const reactRes = createMockRes();
  await teamMessageController.toggleReaction(reactReq, reactRes);
  assert.strictEqual(reactRes.statusCode, 200, 'toggleReaction must return 200');
  assert.strictEqual(reactRes.body.data.action, 'added', 'Reaction action must be added');
  console.log('✅ Reaction added successfully:', reactRes.body.data);

  // Cleanup SSE client
  realtimeMessagingService.removeClient(connId);

  console.log('\n=====================================================');
  console.log('🎉 ALL 10 STRICT E2E ACCEPTANCE TESTS PASSED!');
  console.log('=====================================================');
  process.exit(0);
}

runStrictE2ETest().catch(e => {
  console.error('\n❌ STRICT E2E TEST FAILED:', e);
  process.exit(1);
});
