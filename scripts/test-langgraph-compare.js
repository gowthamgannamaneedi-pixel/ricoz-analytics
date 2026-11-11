const langGraphAssistantService = require('../server/services/langGraphAssistantService');
const db = require('../server/config/database');

async function test() {
  const datasetRes = await db.query("SELECT * FROM datasets WHERE id = 391");
  const dataset = datasetRes.rows[0];

  const result = await langGraphAssistantService.processQuery({
    message: "Compare this month with last month",
    datasetId: 391,
    organizationId: dataset.organization_id,
    userId: 1,
    userRole: 'admin'
  });

  console.log('Result from LangGraphAssistantService:');
  console.log('Intent:', result.intent);
  console.log('Answer:\n', result.answer);
  console.log('Visualization:\n', JSON.stringify(result.visualization, null, 2));

  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
