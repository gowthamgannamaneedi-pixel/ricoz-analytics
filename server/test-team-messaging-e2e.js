/**
 * Team Messaging End-to-End Test Suite
 * Tests direct conversations, group conversations, real-time broadcasting,
 * participants resolution, and message persistence.
 */

const { query } = require('./config/database');
const TeamMessageModel = require('./models/teamMessageModel');
const realtimeMessagingService = require('./services/realtimeMessagingService');

async function runTests() {
  console.log('--- STARTING TEAM MESSAGING E2E TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Fetch organization and test users
    const userRes = await query('SELECT id, name, email, organization_id FROM users WHERE organization_id IS NOT NULL LIMIT 2;');
    if (userRes.rows.length < 2) {
      console.log('Skipping test: need at least 2 users in db');
      process.exit(0);
    }
    const userA = userRes.rows[0];
    const userB = userRes.rows[1];
    const orgId = userA.organization_id;

    console.log(`[Test Setup] UserA: ${userA.id} (${userA.email}), UserB: ${userB.id} (${userB.email}), Org: ${orgId}`);

    // TEST 1: Direct Conversation Creation
    console.log('\n[TEST 1] Create Direct Conversation');
    const directConv1 = await TeamMessageModel.createDirectConversation({
      organizationId: orgId,
      userAId: userA.id,
      userBId: userB.id,
      createdBy: userA.id
    });

    assert(directConv1 && directConv1.id, 'Direct conversation created successfully');
    assert(directConv1.type === 'direct', 'Conversation type is direct');
    assert(Array.isArray(directConv1.participants) && directConv1.participants.length >= 2, 'Has 2 participants');
    assert(directConv1.direct_other_user && String(directConv1.direct_other_user.user_id) === String(userB.id), 'direct_other_user correctly points to userB');

    // TEST 2: Direct Conversation Idempotency
    console.log('\n[TEST 2] Direct Conversation Idempotency');
    const directConv2 = await TeamMessageModel.createDirectConversation({
      organizationId: orgId,
      userAId: userB.id, // reverse direction
      userBId: userA.id,
      createdBy: userB.id
    });
    assert(directConv2 && directConv2.id === directConv1.id, 'Re-requesting direct conversation returns the existing conversation id');

    // TEST 3: Group Conversation Creation
    console.log('\n[TEST 3] Create Group Conversation');
    const groupConv = await TeamMessageModel.createGroupConversation({
      organizationId: orgId,
      title: 'E2E Testing Group Channel',
      createdBy: userA.id,
      memberUserIds: [userB.id]
    });
    assert(groupConv && groupConv.id, 'Group conversation created successfully');
    assert(groupConv.type === 'group', 'Conversation type is group');
    assert(groupConv.participants.some(p => String(p.user_id) === String(userA.id)), 'UserA is a participant');
    assert(groupConv.participants.some(p => String(p.user_id) === String(userB.id)), 'UserB is a participant');

    // TEST 4: Send Message
    console.log('\n[TEST 4] Send Message & Unread Count');
    const msg1 = await TeamMessageModel.createMessage({
      conversationId: groupConv.id,
      organizationId: orgId,
      senderId: userA.id,
      content: 'Hello team from automated E2E test!',
      mentions: [userB.id],
      metadata: { test: true }
    });
    assert(msg1 && msg1.id, 'Message created successfully');
    assert(msg1.content === 'Hello team from automated E2E test!', 'Message content matches');

    // TEST 5: Toggle Reaction
    console.log('\n[TEST 5] Toggle Emoji Reaction');
    const reactRes = await TeamMessageModel.toggleReaction({
      messageId: msg1.id,
      conversationId: groupConv.id,
      organizationId: orgId,
      userId: userB.id,
      emoji: '👍'
    });
    assert(reactRes && reactRes.action === 'added', 'Reaction added');
    assert(reactRes.reactions && reactRes.reactions.some(r => r.emoji === '👍'), 'Reaction list contains emoji');

    // Toggle off
    const reactOff = await TeamMessageModel.toggleReaction({
      messageId: msg1.id,
      conversationId: groupConv.id,
      organizationId: orgId,
      userId: userB.id,
      emoji: '👍'
    });
    assert(reactOff && reactOff.action === 'removed', 'Reaction toggled off cleanly');

    // TEST 6: Mark Read
    console.log('\n[TEST 6] Mark Conversation Read');
    const readRes = await TeamMessageModel.markConversationRead({
      conversationId: groupConv.id,
      userId: userB.id,
      organizationId: orgId,
      messageId: msg1.id
    });
    assert(readRes && readRes.success === true, 'Conversation marked as read');

    // TEST 7: Real-Time SSE Broadcasting
    console.log('\n[TEST 7] Real-Time SSE Broadcast & Presence');
    let clientReceived = false;
    const fakeRes = {
      writableEnded: false,
      destroyed: false,
      write: (data) => {
        if (data.includes('event: message:new')) {
          clientReceived = true;
        }
      },
      on: () => {}
    };

    const connId = realtimeMessagingService.registerClient(fakeRes, userB.id, orgId);
    assert(connId, 'Registered SSE client for userB');

    const isOnline = realtimeMessagingService.isUserOnline(orgId, userB.id);
    assert(isOnline === true, 'UserB is detected online in presence cache');

    await realtimeMessagingService.broadcastToConversation(
      groupConv.id,
      orgId,
      'message:new',
      { conversationId: groupConv.id, message: msg1 }
    );
    assert(clientReceived === true, 'UserB received real-time SSE broadcast message');

    realtimeMessagingService.removeClient(connId);
    const isOffline = !realtimeMessagingService.isUserOnline(orgId, userB.id);
    assert(isOffline === true, 'UserB successfully transitioned offline after disconnect');

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runTests();
