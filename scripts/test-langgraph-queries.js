const langGraph = require('../server/services/langGraphAssistantService');

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

async function runTest() {
  console.log("Testing langGraphAssistantService on the 8 queries...");
  for (const q of queries) {
    try {
      const state = await langGraph._classifyIntentNode({
        message: q,
        organizationId: "00000000-0000-0000-0000-000000000001",
        datasetId: 391,
        conversationHistory: []
      });
      console.log(`Query: "${q}"\n  -> intent: ${state.intent}, requiresRetrieval: ${state.requiresRetrieval}, requiresAnalytics: ${state.requiresAnalytics}`);
    } catch (e) {
      console.log(`Query "${q}" threw error:`, e.message);
    }
  }
  process.exit(0);
}

runTest();
