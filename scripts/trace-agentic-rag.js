const langGraphAssistant = require('../server/services/langGraphAssistantService');

async function traceAgenticRAG() {
  console.log('=====================================================');
  console.log('🔍 RICOZANALYTICS PRODUCTION AGENTIC RAG TRACE');
  console.log('=====================================================\n');

  const testUser = {
    id: 1,
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000001'
  };

  const questions = [
    {
      q: 'Compare this month with last month.',
      datasetId: 391,
      name: 'Dataset 391: Mixed Variance Telemetry (Time-series MoM query)'
    },
    {
      q: 'What is total sales amount?',
      datasetId: 391,
      name: 'Dataset 391: Mixed Variance Telemetry (KPI aggregation)'
    },
    {
      q: 'What is the date range of the dataset?',
      datasetId: 393,
      name: 'Dataset 393: Enterprise Customer Directory (Non-date dataset safety)'
    }
  ];

  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    console.log(`\n-----------------------------------------------------`);
    console.log(`[TRACE ${i + 1}] Target: ${item.name}`);
    console.log(`User Question: "${item.q}"`);
    console.log(`Dataset ID: ${item.datasetId}`);
    console.log(`-----------------------------------------------------`);

    const startTime = Date.now();
    const result = await langGraphAssistant.processQuery({
      message: item.q,
      userId: testUser.id,
      userRole: testUser.role,
      organizationId: testUser.organization_id,
      datasetId: item.datasetId
    });
    const duration = Date.now() - startTime;

    console.log(`⏱️ Execution Latency: ${duration} ms`);
    console.log(`📌 Classified Intent:`, result.intent);
    console.log(`📋 Resolved Query Plan:`, JSON.stringify(result.plan));
    console.log(`🛡️ Grounded Status:`, result.grounded ? 'VERIFIED GROUNDED' : 'UNGROUNDED');
    console.log(`🔍 Evidence Validated:`, result.evidenceValidated ? 'YES' : 'NO');
    console.log(`🎯 Analysis Status:`, result.analysisStatus);
    console.log(`📈 Sources Used:`, result.sources);
    console.log(`📊 Visualization:`, result.visualization ? `${result.visualization.type} chart (${result.visualization.title})` : 'None');
    console.log(`💬 Grounded Answer Synthesized:`);
    console.log(result.answer);
  }

  console.log('\n=====================================================');
  console.log('✅ AGENTIC RAG TRACES CAPTURED SUCCESSFULLY');
  console.log('=====================================================');
  process.exit(0);
}

traceAgenticRAG().catch(err => {
  console.error('Fatal error tracing Agentic RAG:', err);
  process.exit(1);
});
