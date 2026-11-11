const geminiService = require('../server/services/geminiService');

async function testPlan() {
  const queries = [
    "How many columns are there in this table?",
    "How many rows are in this dataset?",
    "What are the column names?",
    "Which columns contain numbers?",
    "What is the total revenue?",
    "What is the average order value?",
    "Which date range does this dataset cover?",
    "How many duplicate or missing records are present?"
  ];

  for (const q of queries) {
    try {
      const plan = await geminiService.planQuery(q, {
        datasets: [{ id: 391, name: 'Mixed Variance Telemetry', row_count: 8, column_count: 7 }],
        datasetSchema: [
          { name: 'date', type: 'date' },
          { name: 'profit', type: 'number' },
          { name: 'region', type: 'string' },
          { name: 'channel', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'units_sold', type: 'number' },
          { name: 'sales_amount', type: 'number' }
        ]
      });
      console.log(`Query: "${q}"\n  -> Plan intent: ${plan.intent}, metric: ${plan.metric}, date_col: ${plan.date_column}, agg: ${plan.aggregation}\n`);
    } catch (e) {
      console.log(`Query: "${q}" -> ERROR:`, e.message);
    }
  }
  process.exit(0);
}

testPlan();
