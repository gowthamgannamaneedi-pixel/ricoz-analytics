const subscriptionService = require('../server/services/subscriptionService');

async function test() {
  const sub = await subscriptionService.getOrganizationSubscription('00000000-0000-0000-0000-000000000001', { forceFresh: true });
  console.log('Result for primary org:', JSON.stringify(sub, null, 2));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
