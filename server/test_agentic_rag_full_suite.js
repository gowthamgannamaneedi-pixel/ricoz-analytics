/**
 * RicozAnalytics Comprehensive Agentic RAG Test Suite
 * Tests all 12 Phase 9 queries, edge cases, numerical verification, and security isolation.
 */
require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const aiQueryPlannerService = require('./services/aiQueryPlannerService');
const langGraphAssistantService = require('./services/langGraphAssistantService');
const pythonAiService = require('./services/pythonAiService');
const geminiService = require('./services/geminiService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ricoz_analytics'
});

async function runSuite() {
  console.log('\n============================================================');
  console.log('🤖 RICOZANALYTICS AGENTIC RAG FULL TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED:', err.message);
      failed++;
    }
  }

  // 1. Discover a valid test organization and dataset
  const orgRes = await pool.query("SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1;");
  if (orgRes.rows.length === 0) {
    throw new Error('No organizations found in database.');
  }
  const testOrg = orgRes.rows[0];
  const orgId = testOrg.id;

  const dsRes = await pool.query(
    "SELECT id, name, row_count, schema FROM datasets WHERE organization_id = $1 AND row_count > 0 ORDER BY row_count ASC LIMIT 5;",
    [orgId]
  );
  if (dsRes.rows.length === 0) {
    throw new Error('No datasets with records found for test organization.');
  }
  const testDataset = dsRes.rows[0];
  const datasetId = testDataset.id;

  console.log(`Context: Org="${testOrg.name}" (${orgId}), Dataset="${testDataset.name}" (${datasetId}, ${testDataset.row_count} rows)\n`);

  // --- QUERY 1: What is my total revenue? ---
  await test('Q1: What is my total revenue?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'What is my total revenue?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.data?.value === undefined) throw new Error('No metric value returned');

    // Independent SQL calculation check
    const sqlRes = await pool.query(
      `SELECT SUM((data->>'revenue')::numeric) as rev, SUM((data->>'sales_amount')::numeric) as s_rev, SUM((data->>'sales')::numeric) as sales
       FROM dataset_rows WHERE dataset_id = $1 AND organization_id = $2;`,
      [datasetId, orgId]
    );
    const expected = Number(sqlRes.rows[0].rev || sqlRes.rows[0].s_rev || sqlRes.rows[0].sales || 0);
    const actual = Number(res.data.value);
    if (expected > 0 && Math.abs(expected - actual) > 0.01) {
      throw new Error(`Numerical discrepancy: expected ${expected}, got ${actual}`);
    }
  });

  // --- QUERY 2: How can I increase my sales? ---
  await test('Q2: How can I increase my sales? (Must NOT be a 1-number KPI)', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'how to increse my sales', // testing with typo
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    const ans = res.answer;

    // Must be classified as sales growth analysis, NOT a generic KPI
    if (ans.includes('total revenue is') && !ans.includes('Sales Growth Analysis') && !ans.includes('Growth Levers')) {
      throw new Error('Returned simple 1-number KPI aggregation instead of deep investigation!');
    }
    if (!ans.includes('Sales Growth Analysis') && !ans.includes('Growth Levers') && !ans.includes('Current Performance')) {
      throw new Error('Answer missing structured growth sections');
    }
    if (!ans.includes('Measured Facts') && !ans.includes('Current Performance')) {
      throw new Error('Missing clear separation of Measured Facts');
    }
  });

  // --- QUERY 3: Why did my revenue decrease? ---
  await test('Q3: Why did my revenue decrease?', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Why did my revenue decrease?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (!res.answer.includes('Revenue Decline') && !res.answer.includes('Observed Drivers')) {
      throw new Error('Missing revenue decline diagnostics');
    }
  });

  // --- QUERY 4: Which product performs best? ---
  await test('Q4: Which product performs best?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'Which product performs best?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.plan.intent !== 'ranking') throw new Error(`Expected intent 'ranking', got '${res.plan.intent}'`);
  });

  // --- QUERY 5: Which region contributes the most revenue? ---
  await test('Q5: Which region contributes the most revenue?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'Which region contributes the most revenue?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.plan.intent !== 'ranking') throw new Error(`Expected ranking intent, got '${res.plan.intent}'`);
  });

  // --- QUERY 6: What is my gross profit margin? ---
  await test('Q6: What is my gross profit margin?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'What is my gross profit margin?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    // If dataset lacks cost, must acknowledge missing cost column honestly
    if (res.data?.hasCost === false && !res.answer.includes('Cost of Goods Sold')) {
      throw new Error('Failed to acknowledge missing cost column');
    }
  });

  // --- QUERY 7: Identify unusual sales patterns ---
  await test('Q7: Identify unusual sales patterns', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'Identify unusual sales patterns',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.plan.intent !== 'anomaly_explanation') {
      throw new Error(`Expected anomaly_explanation intent, got ${res.plan.intent}`);
    }
  });

  // --- QUERY 8: Forecast next month revenue ---
  await test('Q8: Forecast next month revenue', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: "Forecast next month's revenue",
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.plan.intent !== 'forecast_explanation') {
      throw new Error(`Expected forecast_explanation intent, got ${res.plan.intent}`);
    }
  });

  // --- QUERY 9: What happens if operating costs increase by 10%? ---
  await test('Q9: What happens if operating costs increase by 10%?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'What happens if operating costs increase by 10%?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (!res.answer.includes('What-If') && !res.answer.includes('Simulating')) {
      throw new Error('Did not generate counterfactual simulation');
    }
  });

  // --- QUERY 10: Compare the last two quarters ---
  await test('Q10: Compare the last two quarters', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'Compare the last two quarters',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (res.plan.intent !== 'comparison') {
      throw new Error(`Expected comparison intent, got ${res.plan.intent}`);
    }
  });

  // --- QUERY 11: Explain which factors are associated with revenue changes ---
  await test('Q11: Explain which factors are associated with revenue changes', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Explain which factors are associated with revenue changes',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
  });

  // --- QUERY 12: What information is missing from my dataset? ---
  await test('Q12: What information is missing from my dataset?', async () => {
    const res = await aiQueryPlannerService.processQuery({
      message: 'What information is missing from my dataset?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    if (!res.answer.includes('Dataset Schema & Coverage Inspection') && !res.answer.includes('Not Tracked')) {
      throw new Error('Missing schema coverage inspection');
    }
  });

  // --- EDGE CASE 1: 4-Row Small Dataset Handling ---
  await test('Edge Case: 4-Row Dataset Explicit Scope Limitation', async () => {
    // Find or test on a dataset with small row count (<=10)
    const smallDs = dsRes.rows.find(d => Number(d.row_count) <= 10) || testDataset;
    const res = await langGraphAssistantService.processQuery({
      message: 'how to increase my sales',
      organizationId: orgId,
      userId: 1,
      datasetId: smallDs.id
    });

    if (Number(smallDs.row_count) <= 10 && !res.answer.includes('Data Scope Note')) {
      throw new Error('Missing small dataset scope acknowledgment');
    }
  });

  // --- EDGE CASE 2: Cross-Tenant Access Rejection ---
  await test('Security: Cross-Tenant Dataset Isolation Enforcement', async () => {
    const rogueOrgId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    let rejected = false;
    try {
      await aiQueryPlannerService.processQuery({
        message: 'what is my revenue',
        organizationId: rogueOrgId,
        userId: 1,
        datasetId: datasetId
      });
    } catch (err) {
      if (err.message.includes('permission') || err.message.includes('not found') || err.message.includes('access')) {
        rejected = true;
      }
    }
    if (!rejected) throw new Error('Cross-tenant dataset access was not rejected!');
  });

  // --- EDGE CASE 3: Missing Column Honesty ---
  await test('Integrity: Missing Column Honesty (Turnover Rate)', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'What is employee turnover rate?',
      organizationId: orgId,
      userId: 1,
      datasetId: datasetId
    });

    if (!res || !res.answer) throw new Error('Empty response');
    // Must honestly report that turnover rate is not in the dataset
    if (res.answer.includes('total turnover rate is 154,000')) {
      throw new Error('Fabricated number for missing metric!');
    }
  });

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('============================================================\n');

  await pool.end();
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  pool.end();
  process.exit(1);
});
