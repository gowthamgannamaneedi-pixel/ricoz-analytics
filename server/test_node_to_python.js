require('dotenv').config({ path: './server/.env' });
const pythonAiService = require('./services/pythonAiService');

async function testNodeToPython() {
  console.log('1. Checking Python service health...');
  const health = await pythonAiService.checkHealth();
  console.log('Health:', health);

  console.log('\n2. Querying Python Agentic RAG: "how to increase my sales"...');
  const queryRes = await pythonAiService.query({
    message: 'how to increase my sales',
    organizationId: '00000000-0000-0000-0000-000000000001',
    userId: 1,
    userRole: 'admin'
  });

  console.log('\n--- PYTHON AGENTIC RAG RESULT ---');
  console.log('Intent:', queryRes.intent);
  console.log('Grounded:', queryRes.grounded);
  console.log('Evidence Validated:', queryRes.evidenceValidated);
  console.log('Tools Executed:', queryRes.toolExecutions.map(t => `${t.tool_name} (${t.execution_time_ms}ms)`));
  console.log('\n--- ANSWER ---');
  console.log(queryRes.answer);
  console.log('\n--- FOLLOW UP QUESTIONS ---');
  console.log(queryRes.followUpQuestions);
}

testNodeToPython().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
