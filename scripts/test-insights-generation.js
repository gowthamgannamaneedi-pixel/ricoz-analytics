const insightService = require('../server/services/insightService');

async function testInsights() {
  const orgId = '00000000-0000-0000-0000-000000000001';
  console.log('Generating insights for organization:', orgId);
  const result = await insightService.generateInsights(orgId, { forceFresh: true });

  console.log(`Generated ${result.insights.length} verified insights:`);
  result.insights.slice(0, 5).forEach((ins, idx) => {
    console.log(`\n[Insight #${idx + 1}] Type: ${ins.type} | Priority: ${ins.priority || ins.severity}`);
    console.log(`  Title: ${ins.title}`);
    console.log(`  Summary: ${ins.summary}`);
    console.log(`  Dataset: ${ins.source_metadata?.dataset_name} (ID: ${ins.source_metadata?.dataset_id})`);
    if (ins.evidence) {
      console.log(`  Evidence Baseline: ${ins.evidence.baseline_value ?? 'N/A'}, Current: ${ins.evidence.current_value ?? 'N/A'}`);
      console.log(`  Evidence Delta: ${ins.evidence.change_percentage ?? 'N/A'}%`);
    }
  });

  process.exit(0);
}

testInsights().catch(e => {
  console.error('Insight generation failed:', e);
  process.exit(1);
});
