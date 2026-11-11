const aiQueryPlannerService = require('../server/services/aiQueryPlannerService');
const db = require('../server/config/database');

async function test() {
  const datasetRes = await db.query("SELECT * FROM datasets WHERE id = 391");
  const dataset = datasetRes.rows[0];
  console.log('Dataset:', dataset.id, dataset.name);

  const result = await aiQueryPlannerService.processQuery({
    message: "Compare this month with last month",
    datasetId: 391,
    organizationId: dataset.organization_id,
    userId: 1
  });
  console.log('AI Query Planner Result:');
  console.log('Intent:', result.intent);
  console.log('Plan:', JSON.stringify(result.plan, null, 2));
  console.log('Answer:\n', result.answer);
  console.log('Visualization:', JSON.stringify(result.visualization, null, 2));
  console.log('Data:', JSON.stringify(result.data, null, 2));

  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
