/**
 * Comprehensive Integration & Security Test Suite for RicozAnalytics Team Messages
 */

const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { query, closeDb } = require('./config/database');
const TeamMessageModel = require('./models/teamMessageModel');
const realtimeMessagingService = require('./services/realtimeMessagingService');

async function runTests() {
  console.log('===========================================================');
  console.log(' RUNNING RICOZ TEAM MESSAGES TEST SUITE');
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(` ✗ [FAIL] ${name}:`, err.message);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // 1. Get test users and organization
  const userRes = await query(`
    SELECT id, email, role, organization_id, name 
    FROM users 
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY id ASC;
  `);

  assert(userRes.rows.length >= 2, 'Must have at least 2 users in primary org');
  const adminUser = userRes.rows.find(u => u.role === 'admin') || userRes.rows[0];
  const otherUser = userRes.rows.find(u => u.id !== adminUser.id) || userRes.rows[1];
  const orgId = '00000000-0000-0000-0000-000000000001';

  console.log(` Test context: Admin=${adminUser.name} (${adminUser.id}), Colleague=${otherUser.name} (${otherUser.id}), Org=${orgId}`);

  let createdDmConv = null;
  let testMsgId = null;
  let testReplyId = null;

  // TEST 1: Direct conversation creation and idempotency
  await test('1. Create direct message conversation between two users', async () => {
    const conv = await TeamMessageModel.createDirectConversation({
      organizationId: orgId,
      userAId: adminUser.id,
      userBId: otherUser.id,
      createdBy: adminUser.id
    });

    assert(conv, 'Conversation should be created');
    assert.strictEqual(conv.type, 'direct');
    assert.strictEqual(conv.organization_id, orgId);
    assert.strictEqual(conv.participants.length, 2);
    createdDmConv = conv;

    // Test idempotency: calling again should return the EXACT same conversation
    const conv2 = await TeamMessageModel.createDirectConversation({
      organizationId: orgId,
      userAId: adminUser.id,
      userBId: otherUser.id,
      createdBy: adminUser.id
    });
    assert.strictEqual(conv2.id, conv.id, 'Duplicate DM should return existing conversation ID');
  });

  // TEST 2: Send message with content
  await test('2. Send text message in conversation', async () => {
    const msg = await TeamMessageModel.createMessage({
      conversationId: createdDmConv.id,
      organizationId: orgId,
      senderId: adminUser.id,
      content: 'Hello! Checking quarterly analytics progress.'
    });

    assert(msg, 'Message should be returned');
    assert.strictEqual(msg.content, 'Hello! Checking quarterly analytics progress.');
    assert.strictEqual(msg.sender_id, adminUser.id);
    assert.strictEqual(msg.is_edited, false);
    assert.strictEqual(msg.is_deleted, false);
    testMsgId = msg.id;
  });

  // TEST 3: Edit message
  await test('3. Edit own message and set is_edited flag', async () => {
    const updated = await TeamMessageModel.editMessage(
      testMsgId,
      adminUser.id,
      orgId,
      'Hello! Checking quarterly analytics progress (Updated).'
    );

    assert(updated, 'Updated message should be returned');
    assert.strictEqual(updated.content, 'Hello! Checking quarterly analytics progress (Updated).');
    assert.strictEqual(updated.is_edited, true);
    assert(updated.edited_at, 'edited_at timestamp must be set');
  });

  // TEST 4: Prevent editing another user\'s message
  await test('4. Security: Block non-author from editing message', async () => {
    let threw = false;
    try {
      await TeamMessageModel.editMessage(
        testMsgId,
        otherUser.id, // Not author
        orgId,
        'Hacked message'
      );
    } catch (e) {
      threw = true;
      assert(e.message.includes('Access denied') || e.message.includes('own messages'));
    }
    assert(threw, 'Should throw access denied when non-author edits');
  });

  // TEST 5: Toggle emoji reaction (add and remove)
  await test('5. Toggle emoji reaction (add then remove)', async () => {
    // Add reaction 👍
    const r1 = await TeamMessageModel.toggleReaction({
      messageId: testMsgId,
      conversationId: createdDmConv.id,
      organizationId: orgId,
      userId: otherUser.id,
      emoji: '👍'
    });

    assert.strictEqual(r1.action, 'added');
    assert.strictEqual(r1.emoji, '👍');
    const thumb = r1.reactions.find(r => r.emoji === '👍');
    assert(thumb, 'Reaction summary should contain thumbs up');
    assert.strictEqual(thumb.count, 1);

    // Toggle off (remove)
    const r2 = await TeamMessageModel.toggleReaction({
      messageId: testMsgId,
      conversationId: createdDmConv.id,
      organizationId: orgId,
      userId: otherUser.id,
      emoji: '👍'
    });

    assert.strictEqual(r2.action, 'removed');
    const thumb2 = r2.reactions.find(r => r.emoji === '👍');
    assert(!thumb2, 'Thumbs up should be removed');

    // Add 🚀 and leave it for subsequent tests
    await TeamMessageModel.toggleReaction({
      messageId: testMsgId,
      conversationId: createdDmConv.id,
      organizationId: orgId,
      userId: adminUser.id,
      emoji: '🚀'
    });
  });

  // TEST 6: Threaded reply
  await test('6. Post threaded reply linked to parent message', async () => {
    const reply = await TeamMessageModel.createMessage({
      conversationId: createdDmConv.id,
      organizationId: orgId,
      senderId: otherUser.id,
      content: 'Quarterly review is on track! Metrics look strong.',
      parentMessageId: testMsgId
    });

    assert(reply, 'Reply should be created');
    assert.strictEqual(reply.parent_message_id, testMsgId);
    testReplyId = reply.id;

    // Fetch replies for parent
    const replies = await TeamMessageModel.getThreadReplies(testMsgId, createdDmConv.id, orgId, adminUser.id);
    assert(replies.length >= 1, 'Should find at least 1 reply in thread');
    assert.strictEqual(replies[0].id, reply.id);
  });

  // TEST 7: Share interactive analytics payload
  await test('7. Share interactive analytics card (KPI & Chart) in message', async () => {
    const analyticsPayload = {
      type: 'kpi',
      title: 'Monthly Recurring Revenue',
      subtitle: 'Audit Telemetry Dataset',
      datasetId: 1,
      metrics: {
        currentValue: 154000,
        currency: 'INR',
        growthPct: 24.8,
        status: 'positive'
      },
      previewData: [
        { label: 'Jan', value: 100000 },
        { label: 'Feb', value: 154000 }
      ],
      openLink: '/kpis?id=mrr'
    };

    const analyticsMsg = await TeamMessageModel.createMessage({
      conversationId: createdDmConv.id,
      organizationId: orgId,
      senderId: adminUser.id,
      content: 'Reviewing our latest MRR telemetry:',
      sharedAnalytics: analyticsPayload
    });

    assert(analyticsMsg, 'Analytics message should be created');
    assert(analyticsMsg.shared_analytics, 'shared_analytics payload must exist');
    assert.strictEqual(analyticsMsg.shared_analytics.title, 'Monthly Recurring Revenue');
    assert.strictEqual(analyticsMsg.shared_analytics.metrics.currentValue, 154000);
  });

  // TEST 8: Mark conversation as read and verify read receipts
  await test('8. Mark conversation as read and record read receipts', async () => {
    const readRes = await TeamMessageModel.markConversationRead({
      conversationId: createdDmConv.id,
      userId: adminUser.id,
      organizationId: orgId,
      messageId: testReplyId
    });

    assert(readRes.success, 'markConversationRead should succeed');

    const convs = await TeamMessageModel.getConversationsForUser(adminUser.id, orgId);
    const targetConv = convs.find(c => c.id === createdDmConv.id);
    assert(targetConv, 'Target conversation must be in user list');
    assert.strictEqual(targetConv.unread_count, 0, 'Unread count should be 0 after reading');
  });

  // TEST 9: Group conversation linked to existing team
  await test('9. Create group conversation linked to team', async () => {
    const teamRes = await query(
      "SELECT id, name FROM teams WHERE organization_id = $1 LIMIT 1",
      [orgId]
    );

    let teamId = null;
    let teamName = 'Engineering Team';
    if (teamRes.rows[0]) {
      teamId = teamRes.rows[0].id;
      teamName = teamRes.rows[0].name;
    }

    const groupConv = await TeamMessageModel.createGroupConversation({
      organizationId: orgId,
      teamId,
      title: teamName,
      createdBy: adminUser.id,
      memberUserIds: [adminUser.id, otherUser.id]
    });

    assert(groupConv, 'Group conversation should be created');
    assert.strictEqual(groupConv.type, 'group');
    assert(groupConv.participants.length >= 2, 'Group conversation must include team participants');

    // Prevent duplicate team conversation
    if (teamId) {
      const dup = await TeamMessageModel.createGroupConversation({
        organizationId: orgId,
        teamId,
        title: teamName,
        createdBy: adminUser.id
      });
      assert.strictEqual(dup.id, groupConv.id, 'Duplicate team group should return existing conversation');
    }
  });

  // TEST 10: Multi-tenant isolation test
  await test('10. Multi-tenant security: Block access to conversation from other organization', async () => {
    const otherOrgId = '00000000-0000-0000-0000-000000000002';
    let threw = false;
    try {
      await TeamMessageModel.getMessages({
        conversationId: createdDmConv.id,
        organizationId: otherOrgId, // Wrong organization!
        userId: adminUser.id
      });
    } catch (e) {
      threw = true;
      assert(e.message.includes('Access denied'));
    }
    assert(threw, 'Should reject access across tenant boundaries');
  });

  // TEST 11: Soft delete message
  await test('11. Soft delete message preserves placeholder and clears analytics', async () => {
    const deleted = await TeamMessageModel.deleteMessage(
      testMsgId,
      adminUser.id,
      orgId,
      adminUser.role
    );

    assert(deleted, 'Delete should return message');
    assert.strictEqual(deleted.is_deleted, true);
    assert.strictEqual(deleted.content, 'This message was deleted.');
    assert.strictEqual(deleted.shared_analytics, null);
  });

  // TEST 12: Search messages
  await test('12. Search messages across conversations', async () => {
    // Also post a specific searchable message
    await TeamMessageModel.createMessage({
      conversationId: createdDmConv.id,
      organizationId: orgId,
      senderId: adminUser.id,
      content: 'Shared deep analytics intelligence report.'
    });

    const searchRes = await TeamMessageModel.searchMessages({
      organizationId: orgId,
      userId: otherUser.id,
      queryText: 'analytics'
    });

    assert(Array.isArray(searchRes), 'Search should return an array');
    assert(searchRes.length >= 1, 'Should find messages matching "analytics"');
  });

  // TEST 13: Real-time presence tracking
  await test('13. Real-time presence tracking registers and retrieves status', async () => {
    const mockRes = {
      writableEnded: false,
      destroyed: false,
      write: (data) => {},
      on: () => {}
    };

    const connId = realtimeMessagingService.registerClient(mockRes, adminUser.id, orgId);
    assert(connId, 'Connection ID must be assigned');
    assert.strictEqual(realtimeMessagingService.isUserOnline(orgId, adminUser.id), true);

    const presence = realtimeMessagingService.getPresenceForOrg(orgId);
    assert(presence[String(adminUser.id)], 'Presence entry must exist');
    assert.strictEqual(presence[String(adminUser.id)].status, 'online');

    realtimeMessagingService.removeClient(connId);
    assert.strictEqual(realtimeMessagingService.isUserOnline(orgId, adminUser.id), false);
  });

  console.log('===========================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  await closeDb();
  if (failed > 0) process.exit(1);
}

runTests().catch(async (e) => {
  console.error('Fatal test error:', e);
  await closeDb();
  process.exit(1);
});
