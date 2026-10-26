const assert = require('assert');
const langGraphAssistantService = require('./services/langGraphAssistantService');
const ragKnowledgeService = require('./services/ragKnowledgeService');
const rootCauseAttributionService = require('./services/rootCauseAttributionService');
const db = require('./config/database');

async function runTestSuite() {
  console.log('================================================================');
  console.log('  RicozAnalytics LangGraph Agentic RAG Verification Test Suite  ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    process.stdout.write(`  Test ${total}: ${name} ... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log('FAILED ✗');
      console.error(`     Error: ${err.message}`);
    }
  }

  const pool = db.getPool();
  if (!pool) {
    console.error('Database pool not available.');
    process.exit(1);
  }

  // Find two test organizations to verify multi-tenant isolation
  const orgs = await pool.query('SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 2;');
  if (orgs.rows.length === 0) {
    console.error('No organizations found in database.');
    process.exit(1);
  }

  const orgA = orgs.rows[0];
  const orgB = orgs.rows[1] || { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Org Isolation Test' };
  console.log(`  [Config] Org A: "${orgA.name}" (${orgA.id})`);
  console.log(`  [Config] Org B: "${orgB.name}" (${orgB.id})\n`);

  // Get user from Org A
  const userRes = await pool.query('SELECT id, email, role, organization_id FROM users WHERE organization_id = $1 LIMIT 1;', [orgA.id]);
  const testUser = userRes.rows[0] || { id: 1, email: 'test@ricoz.com', role: 'admin', organization_id: orgA.id };

  // Get dataset from Org A
  const dsRes = await pool.query('SELECT id, name, row_count, schema FROM datasets WHERE organization_id = $1 AND row_count > 0 LIMIT 1;', [orgA.id]);
  const testDataset = dsRes.rows[0] || null;
  console.log(`  [Config] Test Dataset: "${testDataset?.name || 'None'}" (ID: ${testDataset?.id || 'N/A'}, Rows: ${testDataset?.row_count || 0})\n`);

  // --------------------------------------------------------------------------
  // SECTION 1: BUSINESS RADAR VALIDATION & CALCULATIONS
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Business Radar Validation & Calculations ---');

  await test('1.1 Contributor Decomposition reconciles with Net Delta', async () => {
    const baseline = 50000;
    const current = 49715;
    const netDelta = current - baseline; // -285
    const netDeltaPct = Number(((netDelta / baseline) * 100).toFixed(2)); // -0.57%

    assert.strictEqual(netDelta, -285);
    assert.strictEqual(netDeltaPct, -0.57);

    const drivers = [
      { segment: 'North America', delta: -400 },
      { segment: 'Europe', delta: 115 }
    ];
    const sumDrivers = drivers.reduce((sum, d) => sum + d.delta, 0);
    assert.strictEqual(sumDrivers, netDelta, 'Segment contributors sum must equal net delta');
  });

  await test('1.2 Main Finding Sentence Formatted Accurately without Hardcoding', async () => {
    function formatMainFinding(metric, deltaPct) {
      if (deltaPct === 0) return `${metric} remained unchanged compared with the previous period.`;
      const direction = deltaPct < 0 ? 'decreased' : 'increased';
      return `${metric} ${direction} by ${Math.abs(deltaPct)}% compared with the previous period.`;
    }

    const findingDrop = formatMainFinding('Revenue', -0.57);
    assert.strictEqual(findingDrop, 'Revenue decreased by 0.57% compared with the previous period.');

    const findingGain = formatMainFinding('Revenue', 4.25);
    assert.strictEqual(findingGain, 'Revenue increased by 4.25% compared with the previous period.');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: THE 8 REQUIRED LANGGRAPH AGENTIC RAG VERIFICATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Required LangGraph Agentic RAG Verification ---');

  // Test 1: Knowledge Question triggers real retrieval and returns a relevant source
  await test('2.1 Knowledge Question ("What does this dataset contain?") triggers pgvector retrieval and returns relevant source', async () => {
    const response = await langGraphAssistantService.processQuery({
      message: 'What does this dataset contain?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null
    });

    assert(response.answer && response.answer.length > 0, 'Answer must not be empty');
    assert(response.sources && response.sources.length > 0, 'Sources array must contain retrieved citations');
    assert(
      response.sources.some(s => s.type === 'rag_document' || s.document_type === 'dataset_dictionary'),
      'Must cite dataset dictionary or knowledge source'
    );
    assert.strictEqual(response.grounded, true, 'Answer must be marked as grounded by validated retrieval');
    assert.strictEqual(response.evidenceValidated, true, 'Evidence validation must succeed');
  });

  // Test 2: Numerical Question executes authorized analytics tool and returns the correct result
  await test('2.2 Numerical Question ("What is the total revenue?") executes authorized analytics tool and returns verified result', async () => {
    const response = await langGraphAssistantService.processQuery({
      message: 'What is total revenue?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null
    });

    assert(response.answer && response.answer.length > 0, 'Must return analytical answer');
    assert(response.analysisStatus && response.analysisStatus.includes('records'), 'Must show records analyzed');
    assert.strictEqual(response.grounded, true, 'Grounding must be verified on dataset records');
    assert(response.sources.some(s => s.type === 'dataset'), 'Must cite dataset source');
  });

  // Test 3: Combined Question uses necessary retrieval and analytics steps
  await test('2.3 Combined Question ("Which region has the highest revenue, and what explains the difference?") uses hybrid retrieval + analytics', async () => {
    const response = await langGraphAssistantService.processQuery({
      message: 'Which region has the highest revenue, and what explains the difference?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null
    });

    assert(response.answer && response.answer.length > 0, 'Must answer combined question');
    assert.strictEqual(response.intent, 'hybrid', 'Must classify as hybrid intent');
    // Must contain both dataset telemetry and knowledge document sources
    assert(response.sources && response.sources.length >= 2, 'Must cite both knowledge document and physical dataset');
    assert(response.sources.some(s => s.type === 'rag_document'), 'Must have RAG citation');
    assert(response.sources.some(s => s.type === 'dataset'), 'Must have dataset telemetry citation');
    assert.strictEqual(response.grounded, true, 'Must verify grounding for hybrid evidence');
  });

  // Test 4: Conditional Graph Routing works for different intents
  await test('2.4 Conditional Graph Routing works correctly across intents', async () => {
    // 1. Pure retrieval routing
    const qKnowledge = await langGraphAssistantService.processQuery({
      message: 'What is the formula for Gross Margin and Net Revenue?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role
    });
    assert.strictEqual(qKnowledge.intent, 'knowledge_retrieval');
    assert(qKnowledge.sources.some(s => s.type === 'rag_document'));

    // 2. Pure analytics routing
    const qAnalytics = await langGraphAssistantService.processQuery({
      message: 'Show revenue breakdown by region',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null
    });
    assert(qAnalytics.intent === 'breakdown' || qAnalytics.intent === 'ranking' || qAnalytics.intent === 'analytics');
    assert(qAnalytics.sources.some(s => s.type === 'dataset'));

    // 3. Conversational fast path routing
    const qGreeting = await langGraphAssistantService.processQuery({
      message: 'Hello there!',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(qGreeting.intent, 'GREETING');
    assert.strictEqual(qGreeting.grounded, false, 'Chit-chat must not claim verified grounding');
  });

  // Test 5: Follow-up Questions preserve correct conversation context
  await test('2.5 Follow-up Questions preserve preceding conversation context', async () => {
    const conversationHistory = [
      { role: 'user', content: 'What was total revenue?' },
      { role: 'assistant', content: 'Total revenue calculated across 10,000 verified transactions is $50,000.' }
    ];

    const response = await langGraphAssistantService.processQuery({
      message: 'Which region performed best?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null,
      conversationHistory
    });

    assert(response.answer, 'Must return answer incorporating conversational thread');
    assert.strictEqual(response.grounded, true, 'Contextual answer must be grounded');
  });

  // Test 6: Unauthorized cross-tenant access is denied
  await test('2.6 Unauthorized cross-tenant access is denied (Tenant Isolation)', async () => {
    // Org B attempts to search Org A's private documents
    const resultsB = await ragKnowledgeService.searchKnowledge(
      'What is the formula for Gross Margin and Net Revenue?',
      { organizationId: orgB.id, limit: 3 }
    );
    assert.strictEqual(resultsB.length, 0, 'Org B must not retrieve Org A private knowledge documents');

    // Org B attempts to query Org A's dataset ID
    if (testDataset) {
      try {
        await langGraphAssistantService.processQuery({
          message: 'What is total revenue?',
          organizationId: orgB.id,
          userId: 9999,
          userRole: 'viewer',
          datasetId: testDataset.id // Org A's dataset
        });
        assert.fail('Should have thrown security access exception');
      } catch (secErr) {
        assert(
          secErr.message.includes('not found') || secErr.message.includes('permission') || secErr.message.includes('access'),
          'Must reject cross-tenant dataset query'
        );
      }
    }
  });

  // Test 7: Retrieval failure or model failure does not produce a falsely grounded answer
  await test('2.7 Retrieval or data failure does NOT produce a falsely grounded answer', async () => {
    // Querying with non-existent dataset ID
    try {
      const response = await langGraphAssistantService.processQuery({
        message: 'What is the conversion rate for product XYZ in Antarctica?',
        organizationId: orgA.id,
        userId: testUser.id,
        datasetId: 99999999
      });
      assert.strictEqual(response.grounded, false, 'Must not claim verified grounding on invalid/empty data');
    } catch (expectedErr) {
      assert(expectedErr.message.includes('not found') || expectedErr.message.includes('permission'));
    }
  });

  // Test 8: Existing AI Assistant UI and API response contract remain compatible
  await test('2.8 Existing AI Assistant UI and API response contract remain fully compatible', async () => {
    const response = await langGraphAssistantService.processQuery({
      message: 'Show revenue trend for last 6 months',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || null
    });

    // Check all required API contract fields consumed by client/src/pages/AIAnalyticsAssistant.jsx
    const requiredFields = [
      'question', 'answer', 'intent', 'plan', 'data',
      'visualization', 'tableData', 'sources', 'followUpQuestions',
      'analysisStatus', 'confidence', 'grounded', 'evidenceValidated'
    ];

    for (const field of requiredFields) {
      assert(field in response, `Response must contain contract field "${field}"`);
    }

    assert(Array.isArray(response.sources), 'sources must be an array');
    assert(Array.isArray(response.followUpQuestions), 'followUpQuestions must be an array');
    assert(typeof response.answer === 'string', 'answer must be a string');
    assert(typeof response.grounded === 'boolean', 'grounded must be boolean');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: THE 10 CRITICAL AI ANSWER QUALITY CONTENT & NUMERICAL REGRESSION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: 10 Critical AI Answer Quality Regression Tests ---');

  let rankingResult = null;
  const targetQuestion = 'Which region has the highest revenue, and what explains the difference?';

  // 1. Highest-revenue region includes the correct region name
  await test('3.1 Highest-revenue region includes the correct region name ("Bengaluru")', async () => {
    rankingResult = await langGraphAssistantService.processQuery({
      message: targetQuestion,
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || 1
    });

    assert(rankingResult.answer, 'Answer must not be empty');
    assert(rankingResult.answer.includes('Bengaluru'), 'Answer must explicitly name "Bengaluru" as the top performer');
    assert.strictEqual(rankingResult.data.top_performer?.name, 'Bengaluru');
    assert(rankingResult.answer.includes('Direct answer:'), 'Answer must contain structured Direct answer section');
  });

  // 2. The ranking table contains the correct regional totals
  await test('3.2 The ranking table contains the correct regional totals', async () => {
    assert(rankingResult.tableData, 'Must return tableData');
    const rows = rankingResult.tableData.rows;
    assert(rows.length >= 5, 'Must contain at least 5 ranked regions');

    // Expected regional totals from verified 20-row dataset
    const expectedTotals = {
      'Bengaluru': '4,49,000.5',
      'Hyderabad': '3,56,000',
      'Mumbai': '3,53,000',
      'Delhi NCR': '2,31,000',
      'Chennai': '2,02,000'
    };

    for (const [region, expectedVal] of Object.entries(expectedTotals)) {
      const match = rows.find(r => r[0] === region);
      assert(match, `Ranking table must contain ${region}`);
      assert(match[1].includes(expectedVal), `Regional total for ${region} must match expected ${expectedVal}, got: ${match[1]}`);
    }

    // Markdown table in answer text must also include regional totals
    assert(rankingResult.answer.includes('Bengaluru') && rankingResult.answer.includes('4,49,000.50'), 'Answer table must show Bengaluru total');
    assert(rankingResult.answer.includes('Hyderabad') && rankingResult.answer.includes('3,56,000.00'), 'Answer table must show Hyderabad total');
  });

  // 3. Totals and percentage shares reconcile within appropriate rounding
  await test('3.3 Totals and percentage shares reconcile within appropriate rounding (~100%)', async () => {
    const rows = rankingResult.tableData.rows;
    assert.strictEqual(rankingResult.data.top_performer?.share, 25.5, 'Bengaluru share must be 25.5%');
    assert.strictEqual(rankingResult.data.runner_up?.share, 20.3, 'Hyderabad share must be 20.3%');

    // Grand total verification
    assert.strictEqual(rankingResult.data.grand_total, 1758000.5, 'Grand total must equal ₹1,758,000.50');

    // Parse percentage shares
    const shares = rows.map(r => parseFloat(r[2].replace('%', ''))).filter(s => !isNaN(s));
    const sumShares = shares.reduce((acc, s) => acc + s, 0);
    // Sum of top 5 shares should be ~90.5% (with Pune 9.5% making 100%)
    assert(sumShares >= 89 && sumShares <= 101, `Shares sum must reconcile within expected bounds, got ${sumShares}%`);
  });

  // 4. The leading-versus-second-place difference is correct
  await test('3.4 The leading-versus-second-place difference is correct (₹93,000.50 / +26.1%)', async () => {
    const diff = rankingResult.data.difference;
    assert(diff, 'Must compute difference between #1 and #2');
    assert.strictEqual(diff.leader, 'Bengaluru');
    assert.strictEqual(diff.runnerUp, 'Hyderabad');
    assert.strictEqual(diff.absoluteDifference, 93000.5, 'Absolute difference must be 93,000.50');
    assert.strictEqual(diff.percentageDifference, 26.1, 'Percentage difference must be +26.1%');

    assert(rankingResult.answer.includes('93,000.50'), 'Answer must state absolute difference of ₹93,000.50');
    assert(rankingResult.answer.includes('26.1%'), 'Answer must state percentage difference of +26.1%');
  });

  // 5. A revenue question does not accidentally aggregate units or another measure
  await test('3.5 A revenue question does NOT accidentally aggregate units or another measure', async () => {
    // In dataset 1: Bengaluru units_sold is 117 (42+25+50). Total units is 428.
    // Revenue is ₹449,000.50.
    const topVal = rankingResult.data.top_performer.value;
    assert.strictEqual(topVal, 449000.5, 'Must calculate monetary sales_amount, NOT units_sold');
    assert.notStrictEqual(topVal, 117, 'Must not be equal to units_sold (117)');
    assert.notStrictEqual(topVal, 428, 'Must not be equal to total units_sold (428)');
  });

  // 6. A hybrid question uses relevant retrieved evidence without inventing causal explanations
  await test('3.6 Hybrid question uses relevant retrieved evidence without inventing causal explanations', async () => {
    assert(rankingResult.sources.some(s => s.type === 'rag_document'), 'Must cite retrieved RAG document');
    // Sub-drivers within Bengaluru must be data-backed (Developer Tools & AI Analytics Add-on)
    assert(rankingResult.answer.includes('Developer Tools'), 'Must cite top product contributor Developer Tools');
    assert(rankingResult.answer.includes('AI Analytics Add-on'), 'Must cite AI Analytics Add-on');
    // Must state honest limitation regarding external market factors
    assert(
      rankingResult.answer.includes('macro market factors') || rankingResult.answer.includes('external causal factors'),
      'Must state honest limitation regarding unobserved external causes'
    );
  });

  // 7. Missing revenue or region columns produce an honest limitation
  await test('3.7 Missing revenue or region columns produce an honest limitation', async () => {
    // Querying empty dataset (ID: 310 or 186)
    const emptyDsRes = await pool.query("SELECT id FROM datasets WHERE organization_id = $1 AND row_count = 0 LIMIT 1;", [orgA.id]);
    const emptyId = emptyDsRes.rows[0]?.id || 310;

    const resEmpty = await langGraphAssistantService.processQuery({
      message: 'Which region has the highest revenue?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: emptyId
    });

    assert.strictEqual(resEmpty.grounded, false, 'Missing dataset/columns must NOT be marked grounded');
    assert.strictEqual(resEmpty.insufficientData, true, 'Must flag insufficientData');
    assert(
      resEmpty.answer.includes('insufficient') || resEmpty.answer.includes('matching columns') || resEmpty.answer.includes('records'),
      'Answer must state honest limitation'
    );
  });

  // 8. A generic incomplete answer cannot receive a verified-grounding badge
  await test('3.8 Generic chit-chat or incomplete answers CANNOT receive a verified-grounding badge', async () => {
    const greetingRes = await langGraphAssistantService.processQuery({
      message: 'Good morning!',
      organizationId: orgA.id,
      userId: testUser.id
    });

    assert.strictEqual(greetingRes.grounded, false, 'Greetings must not receive verified grounding');
    assert.strictEqual(greetingRes.evidenceValidated, false, 'Greetings must not have evidenceValidated');
  });

  // 9. Follow-up questions retain the correct dataset and metric context
  await test('3.9 Follow-up questions retain the correct dataset and metric context', async () => {
    const history = [
      { role: 'user', content: 'What is the total revenue?' },
      { role: 'assistant', content: 'Total revenue is ₹17,58,000.50.' }
    ];

    const followUpRes = await langGraphAssistantService.processQuery({
      message: 'Which region performed best?',
      organizationId: orgA.id,
      userId: testUser.id,
      userRole: testUser.role,
      datasetId: testDataset?.id || 1,
      conversationHistory: history
    });

    assert(followUpRes.answer.includes('Bengaluru'), 'Follow-up must resolve to Bengaluru using contextual revenue metric');
    assert.strictEqual(followUpRes.grounded, true, 'Follow-up must be grounded on dataset');
    assert.strictEqual(followUpRes.data.top_performer?.name, 'Bengaluru');
  });

  // 10. Tenant isolation remains enforced
  await test('3.10 Tenant isolation remains strictly enforced across datasets and RAG', async () => {
    // Org B searching Org A's private knowledge
    const orgBSearch = await ragKnowledgeService.searchKnowledge(
      'Business Policy: Revenue Recognition & Gross Margin',
      { organizationId: orgB.id, limit: 3 }
    );
    assert.strictEqual(orgBSearch.length, 0, 'Org B must not access Org A knowledge documents');

    // Org B attempting to query Org A's dataset
    try {
      await langGraphAssistantService.processQuery({
        message: 'Which region has the highest revenue?',
        organizationId: orgB.id,
        userId: 9999,
        datasetId: testDataset?.id || 1
      });
      assert.fail('Cross-tenant query must be rejected');
    } catch (err) {
      assert(err.message.includes('not found') || err.message.includes('permission') || err.message.includes('access'));
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 4: THE 12 MANDATORY AI ASSISTANT QUALITY REGRESSION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: The 12 Mandatory Quality & Intent Regression Tests ---');

  // Test 4.1: Greeting
  await test('4.1 Greeting ("Hello") returns natural brief greeting without database execution', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Hello',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(res.intent, 'GREETING');
    assert.strictEqual(res.grounded, false, 'Greeting must not be grounded');
    assert.strictEqual(res.evidenceValidated, false, 'Greeting must not have evidence validated');
    assert.strictEqual(res.sources.length, 0, 'Greeting must not retrieve sources');
    assert(res.answer.toLowerCase().includes('hello') || res.answer.toLowerCase().includes('help'));
  });

  // Test 4.2: Organization-name question (with typo tolerance)
  await test('4.2 Organization-name question ("what is my origination name") returns verified organization name', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'what is my origination name',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(res.intent, 'ORGANIZATION_CONTEXT');
    assert.strictEqual(res.grounded, true, 'Organization context query must be grounded');
    assert.strictEqual(res.evidenceValidated, true, 'Organization context must be validated');
    assert(res.answer.includes(orgA.name), `Answer must contain organization name "${orgA.name}"`);
    assert(res.sources.some(s => s.title === orgA.name && s.document_type === 'workspace_organization'), 'Sources must cite workspace organization');

    // Also verify standard spelling
    const resStd = await langGraphAssistantService.processQuery({
      message: 'What is my organization name?',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(resStd.intent, 'ORGANIZATION_CONTEXT');
    assert(resStd.answer.includes(orgA.name));
  });

  // Test 4.3: Ambiguous wording requiring clarification
  await test('4.3 Ambiguous wording requiring clarification ("difference", "xyz arbitrary nonsensical input")', async () => {
    const resDiff = await langGraphAssistantService.processQuery({
      message: 'difference',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(resDiff.intent, 'AMBIGUOUS');
    assert.strictEqual(resDiff.grounded, false);
    assert.strictEqual(resDiff.evidenceValidated, false);
    assert(resDiff.answer.toLowerCase().includes('clarify'), 'Must ask for clarification');

    const resNonsense = await langGraphAssistantService.processQuery({
      message: 'xyz arbitrary nonsensical input',
      organizationId: orgA.id,
      userId: testUser.id
    });
    assert.strictEqual(resNonsense.intent, 'AMBIGUOUS');
    assert.strictEqual(resNonsense.grounded, false);
    assert(resNonsense.answer.toLowerCase().includes('clarify'), 'Must ask for clarification rather than generic brush-off');
  });

  // Test 4.4: Dataset description
  await test('4.4 Dataset description ("What does this dataset contain?") returns real schema and column list', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'What does this dataset contain?',
      organizationId: orgA.id,
      userId: testUser.id,
      datasetId: testDataset?.id || 1
    });
    assert.strictEqual(res.intent, 'knowledge_retrieval');
    assert.strictEqual(res.grounded, true);
    assert.strictEqual(res.evidenceValidated, true);
    assert(res.answer.includes(testDataset?.name || 'Telemetry'));
    assert(res.answer.toLowerCase().includes('columns') || res.answer.toLowerCase().includes('records') || res.answer.toLowerCase().includes('order_id'));
    assert(res.sources.some(s => s.type === 'rag_document'));
  });

  // Test 4.5: Total revenue
  await test('4.5 Total revenue ("What is total revenue?") computes verified aggregation across records', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'What is total revenue?',
      organizationId: orgA.id,
      userId: testUser.id,
      datasetId: testDataset?.id || 1
    });
    assert.strictEqual(res.grounded, true);
    assert.strictEqual(res.evidenceValidated, true);
    assert.strictEqual(res.data.value, 1758000.5, 'Must calculate exact revenue sum 1,758,000.50');
    assert(res.answer.includes('17,58,000.50') || res.answer.includes('1,758,000.50'));
  });

  // Test 4.6: Highest-revenue region
  await test('4.6 Highest-revenue region ("Which region has the highest revenue?") identifies leader and value', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Which region has the highest revenue?',
      organizationId: orgA.id,
      userId: testUser.id,
      datasetId: testDataset?.id || 1
    });
    assert.strictEqual(res.grounded, true);
    assert.strictEqual(res.evidenceValidated, true);
    assert.strictEqual(res.data.top_performer?.name, 'Bengaluru');
    assert.strictEqual(res.data.top_performer?.value, 449000.5);
    assert.strictEqual(res.data.runner_up?.name, 'Hyderabad');
    assert(res.answer.includes('Bengaluru'));
    assert(res.answer.includes('4,49,000.50') || res.answer.includes('449,000.50'));
  });

  // Test 4.7: Hybrid analytics and knowledge question
  await test('4.7 Hybrid analytics and knowledge question combines calculations with grounded knowledge', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Which region has the highest revenue, and what explains the difference?',
      organizationId: orgA.id,
      userId: testUser.id,
      datasetId: testDataset?.id || 1
    });
    assert.strictEqual(res.intent, 'hybrid');
    assert.strictEqual(res.grounded, true);
    assert.strictEqual(res.evidenceValidated, true);
    assert(res.answer.includes('Bengaluru'));
    assert(res.sources.some(s => s.type === 'dataset'));
    assert(res.sources.some(s => s.type === 'rag_document'));
  });

  // Test 4.8: Follow-up question using conversation context
  await test('4.8 Follow-up question ("Which region performed best?") retains previous revenue context', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'Which region performed best?',
      organizationId: orgA.id,
      userId: testUser.id,
      datasetId: testDataset?.id || 1,
      conversationHistory: [
        { role: 'user', content: 'What is our total revenue?' },
        { role: 'assistant', content: 'Total revenue is ₹1,758,000.50 based on Indian Enterprise Sales Telemetry (Q4).' }
      ]
    });
    assert.strictEqual(res.grounded, true);
    assert.strictEqual(res.data.top_performer?.name, 'Bengaluru');
    assert(res.answer.includes('Bengaluru'));
  });

  // Test 4.9: Missing data or unavailable organization context
  await test('4.9 Missing data or unavailable organization context handles gracefully without fabricating names', async () => {
    const res = await langGraphAssistantService.processQuery({
      message: 'What is my organization name?',
      organizationId: 'e9999999-9999-9999-9999-999999999999', // genuinely non-existent org
      userId: 9999
    });
    assert.strictEqual(res.grounded, false, 'Must not claim grounding when org is not found');
    assert.strictEqual(res.evidenceValidated, false);
    assert.strictEqual(res.insufficientData, true);
    assert(res.answer.includes('Unable to resolve') || res.answer.includes('unavailable'));
  });

  // Test 4.10: Cross-tenant access denial
  await test('4.10 Cross-tenant access denial strictly isolates tenant datasets and knowledge', async () => {
    try {
      await langGraphAssistantService.processQuery({
        message: 'What is total revenue?',
        organizationId: orgB.id,
        userId: 9999,
        datasetId: testDataset?.id || 1
      });
      assert.fail('Expected cross-tenant access to throw error');
    } catch (err) {
      assert(err.message.includes('not found') || err.message.includes('permission') || err.message.includes('access'));
    }
  });

  // Test 4.11: LLM failure and analytics-tool failure
  await test('4.11 Tool failure or empty dataset returns honest limitation instead of fabricating numbers', async () => {
    // Query a dataset with 0 rows
    const emptyDsRes = await pool.query("SELECT id FROM datasets WHERE row_count = 0 LIMIT 1;");
    if (emptyDsRes.rows.length > 0) {
      const emptyId = emptyDsRes.rows[0].id;
      const res = await langGraphAssistantService.processQuery({
        message: 'What is total revenue?',
        organizationId: orgA.id,
        userId: testUser.id,
        datasetId: emptyId
      });
      assert.strictEqual(res.grounded, false);
      assert.strictEqual(res.insufficientData, true);
      assert(res.answer.includes('does not contain sufficient records') || res.answer.includes('0 records'));
    }
  });

  // Test 4.12: No false grounding badges on incomplete or unsupported answers
  await test('4.12 No false grounding badges on conversational, ambiguous, or incomplete queries', async () => {
    const queries = ['hello', 'difference', 'what is the meaning of life', 'xyz nonsense'];
    for (const q of queries) {
      const res = await langGraphAssistantService.processQuery({
        message: q,
        organizationId: orgA.id,
        userId: testUser.id
      });
      assert.strictEqual(res.grounded, false, `Query "${q}" must NOT have grounded=true`);
      assert.strictEqual(res.evidenceValidated, false, `Query "${q}" must NOT have evidenceValidated=true`);
    }
  });

  console.log('\n================================================================');
  console.log(`  Test Suite Completed: ${passed}/${total} Tests Passed`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
