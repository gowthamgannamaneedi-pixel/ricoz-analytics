const langGraphAssistantService = require('../server/services/langGraphAssistantService');
const db = require('../server/config/database');

const queries = [
  "What are the column names?",
  "Which columns contain numbers?",
  "How many columns are there in this table?",
  "How many rows are in this dataset?",
  "What is the total revenue?",
  "What is the average order value?",
  "Which date range does this dataset cover?",
  "How many duplicate or missing records are present?"
];

async function test() {
  const datasetRes = await db.query("SELECT * FROM datasets WHERE id = 391");
  const dataset = datasetRes.rows[0];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`========================================`);
    try {
      const res = await langGraphAssistantService.processQuery({
        message: q,
        datasetId: 391,
        organizationId: dataset.organization_id,
        userId: 1,
        userRole: 'admin'
      });
      console.log('Intent:', res.intent);
      console.log('Answer:\n', res.answer);
      if (res.visualization) {
        console.log('Visualization:', res.visualization.type, res.visualization.title);
      }
    } catch (err) {
      console.error('ERROR:', err.message);
    }
  }

  // Also test when NO dataset is selected
  console.log(`\n========================================`);
  console.log(`QUERY WITHOUT DATASET: "What are the column names?"`);
  console.log(`========================================`);
  try {
    const res = await langGraphAssistantService.processQuery({
      message: "What are the column names?",
      datasetId: null,
      organizationId: dataset.organization_id,
      userId: 1,
      userRole: 'admin'
    });
    console.log('Intent:', res.intent);
    console.log('Answer:\n', res.answer);
  } catch (err) {
    console.error('ERROR:', err.message);
  }

  process.exit(0);
}
test();
