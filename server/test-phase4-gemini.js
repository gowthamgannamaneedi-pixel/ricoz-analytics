const fs = require('fs');
const path = require('path');
const assert = require('assert');
const storage = require('./storage');
const Dataset = require('./models/datasetModel');
const AlertModel = require('./models/alertModel');
const InsightModel = require('./models/insightModel');
const insightService = require('./services/insightService');
const evidenceBuilderService = require('./services/evidenceBuilderService');
const geminiService = require('./services/geminiService');
const analyticsService = require('./services/analyticsService');

/**
 * PHASE 4: GROUNDED GEMINI AI INSIGHTS TEST SUITE
 * 
 * Verifies production-safe Gemini integration:
 * Dataset -> Analytics -> Evidence Builder -> Gemini -> Grounded Insight
 * 
 * Core Invariants:
 * 1. Gemini is an explanation layer, NOT the source of truth.
 * 2. Gemini NEVER invents, calculates, or modifies factual business metrics.
 * 3. Gemini ONLY explains verified evidence from the Evidence Builder.
 * 4. Factual evidence remains strictly immutable.
 * 5. Full resilience and graceful deterministic fallback when Gemini is unavailable.
 * 6. Non-regression of Phase 1, Phase 2, and Phase 3.
 */
async function runPhase4GeminiTests() {
  console.log('===============================================================');
  console.log('  PHASE 4: GROUNDED GEMINI AI INSIGHTS TEST SUITE              ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  const testOrgA = '00000000-0000-0000-0000-000000000001';
  const testOrgB = '00000000-0000-0000-0000-000000000002';
  const testDir = path.resolve(__dirname, 'uploads/test_phase4');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Setup mock dataset for testing
  const growthPath = path.join(testDir, 'growth_gemini.csv');
  fs.writeFileSync(growthPath, [
    'date,revenue,units,region',
    '2026-01-01,10000,10,North',
    '2026-02-01,12500,12,North' // +25.0% verified growth
  ].join('\n'));

  const emptyPath = path.join(testDir, 'empty_gemini.csv');
  fs.writeFileSync(emptyPath, 'date,revenue,units\n');

  const dsGrowth = await Dataset.create({
    userId: 1,
    name: 'Q1 Gemini Verified Growth Dataset',
    filePath: growthPath,
    rowCount: 2,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'units', type: 'integer' },
      { name: 'region', type: 'string' }
    ]
  });

  const dsEmpty = await Dataset.create({
    userId: 1,
    name: 'Unverified Empty Dataset',
    filePath: emptyPath,
    rowCount: 0,
    columnCount: 3,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'units', type: 'integer' }
    ]
  });

  // Preserve original geminiService state for cleanup
  const originalApiKey = geminiService.apiKey;
  const originalGenerateContent = geminiService.generateContent;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Gemini Service Configuration
    // -------------------------------------------------------------------------
    await test('1. Gemini service configuration detects key presence accurately', async () => {
      geminiService.apiKey = 'test-mock-gemini-key-123';
      assert.strictEqual(geminiService.isConfigured(), true, 'Expected isConfigured to be true when key is set');

      geminiService.apiKey = '';
      assert.strictEqual(geminiService.isConfigured(), false, 'Expected isConfigured to be false when key is empty');

      geminiService.apiKey = '   ';
      assert.strictEqual(geminiService.isConfigured(), false, 'Expected isConfigured to be false when key is whitespace');
    });

    // -------------------------------------------------------------------------
    // Test 2: Missing API Key Fallback
    // -------------------------------------------------------------------------
    await test('2. Missing API key triggers deterministic fallback without crashing', async () => {
      geminiService.apiKey = ''; // No key configured

      const verifiedEvidence = {
        metric: 'revenue',
        currentValue: 12500,
        comparisonValue: 10000,
        changePercent: 25,
        recordsAnalyzed: 2,
        datasetName: 'Q1 Verified Telemetry',
        calculation: '((12500 - 10000) / 10000) * 100 = 25%',
        verified: true
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'growth',
        title: 'REVENUE grew by 25%',
        summary: 'Revenue increased by 25% in the latest period.',
        evidence: verifiedEvidence,
        recommendation: { action: 'Review driver segments' }
      });

      assert.strictEqual(result.fallback, true, 'Should indicate fallback');
      assert.strictEqual(result.aiGenerated, false, 'aiGenerated should be false when key is missing');
      assert(result.explanation.includes('25%'), 'Fallback explanation must contain verified numbers');
      assert(result.businessImpact.length > 10, 'Fallback business impact should be populated');
      assert.strictEqual(result.confidence, 'high');
    });

    // -------------------------------------------------------------------------
    // Test 3: Successful Grounded Gemini Response
    // -------------------------------------------------------------------------
    await test('3. Successful Gemini response parses and validates strict JSON schema', async () => {
      geminiService.apiKey = 'test-mock-key';

      // Mock Gemini returning strict, grounded JSON
      geminiService.generateContent = async (prompt) => {
        // Assert prompt contains strict grounding instructions
        assert(prompt.includes('STRICT GROUNDING INSTRUCTIONS'));
        assert(prompt.includes('12500'));
        assert(prompt.includes('10000'));
        assert(prompt.includes('25%') || prompt.includes('25'));

        return JSON.stringify({
          title: 'REVENUE grew by 25%',
          summary: 'Revenue expanded by 25% from 10,000 to 12,500 based on 2 verified records.',
          explanation: 'Physical dataset telemetry confirms sustained sales volume across northern accounts during Q1.',
          businessImpact: 'Accelerated revenue velocity indicates strong operational throughput.',
          recommendedAction: 'Align inventory and fulfillment with projected demand continuation.',
          confidence: 'high'
        });
      };

      const verifiedEvidence = {
        metric: 'revenue',
        currentValue: 12500,
        comparisonValue: 10000,
        changePercent: 25,
        recordsAnalyzed: 2,
        datasetName: 'Q1 Verified Growth',
        verified: true
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'growth',
        title: 'REVENUE grew by 25%',
        summary: 'Baseline summary',
        evidence: verifiedEvidence
      });

      assert.strictEqual(result.aiGenerated, true);
      assert.strictEqual(result.fallback, false);
      assert.strictEqual(result.title, 'REVENUE grew by 25%');
      assert(result.summary.includes('25%'));
      assert(result.explanation.includes('Physical dataset telemetry confirms'));
      assert(result.businessImpact.includes('Accelerated revenue velocity'));
      assert.strictEqual(result.confidence, 'high');
    });

    // -------------------------------------------------------------------------
    // Test 4: Invalid JSON Response Handling
    // -------------------------------------------------------------------------
    await test('4. Invalid JSON or markdown code block syntax gracefully falls back', async () => {
      geminiService.apiKey = 'test-mock-key';

      // Mock Gemini returning unparseable text
      geminiService.generateContent = async () => {
        return 'Here is your insight: Unfortunately I cannot produce valid JSON right now { broken syntax';
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'growth',
        title: 'REVENUE grew by 25%',
        summary: 'Baseline summary',
        evidence: { verified: true, currentValue: 12500, comparisonValue: 10000, changePercent: 25, recordsAnalyzed: 2 }
      });

      assert.strictEqual(result.fallback, true, 'Should fall back gracefully');
      assert.strictEqual(result.aiGenerated, false);
      assert(result.explanation.length > 20, 'Should return deterministic explanation');
    });

    // -------------------------------------------------------------------------
    // Test 5: Gemini API Failure Handling (500 / Network Error)
    // -------------------------------------------------------------------------
    await test('5. Gemini API 500 error or network exception falls back gracefully', async () => {
      geminiService.apiKey = 'test-mock-key';

      // Mock Gemini throwing an HTTP 500 error
      geminiService.generateContent = async () => {
        throw new Error('Gemini API responded with HTTP 500: Internal Server Error');
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'decline',
        title: 'REVENUE dropped by 30%',
        summary: 'Baseline summary',
        evidence: { verified: true, currentValue: 35000, comparisonValue: 50000, changePercent: -30, recordsAnalyzed: 2 }
      });

      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.aiGenerated, false);
      assert(result.explanation.includes('30%'));
    });

    // -------------------------------------------------------------------------
    // Test 6: Timeout Handling
    // -------------------------------------------------------------------------
    await test('6. Request timeout aborts cleanly and returns deterministic explanation', async () => {
      geminiService.apiKey = 'test-mock-key';

      // Mock AbortController timeout error
      geminiService.generateContent = async () => {
        const timeoutErr = new Error('Gemini API request timed out');
        timeoutErr.name = 'AbortError';
        throw timeoutErr;
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'trend',
        title: 'Sustained positive trajectory',
        summary: 'Continuous expansion over 4 periods',
        evidence: { verified: true, recordsAnalyzed: 4, currentValue: 19000, comparisonValue: 10000, changePercent: 90 }
      });

      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.aiGenerated, false);
      assert(result.explanation.length > 20);
    });

    // -------------------------------------------------------------------------
    // Test 7: Verified Evidence Sent to Gemini
    // -------------------------------------------------------------------------
    await test('7. Verified evidence is strictly passed in prompt to Gemini', async () => {
      geminiService.apiKey = 'test-mock-key';

      let promptReceived = '';
      geminiService.generateContent = async (prompt) => {
        promptReceived = prompt;
        return JSON.stringify({
          title: 'REVENUE grew by 25%',
          summary: 'Grounded summary',
          explanation: 'Grounded explanation',
          businessImpact: 'Impact',
          recommendedAction: 'Action',
          confidence: 'high'
        });
      };

      const verifiedEvidence = {
        metric: 'revenue',
        currentValue: 12500,
        comparisonValue: 10000,
        changePercent: 25,
        recordsAnalyzed: 2,
        datasetName: 'Target Dataset Alpha',
        calculation: 'Formula = 25%',
        verified: true
      };

      await geminiService.generateGroundedInsight({
        type: 'growth',
        title: 'REVENUE grew by 25%',
        summary: 'Baseline summary',
        evidence: verifiedEvidence
      });

      assert(promptReceived.length > 0, 'Prompt must be sent to Gemini');
      assert(promptReceived.includes('"currentValue": 12500'));
      assert(promptReceived.includes('"comparisonValue": 10000'));
      assert(promptReceived.includes('"changePercent": 25'));
      assert(promptReceived.includes('"recordsAnalyzed": 2'));
      assert(promptReceived.includes('Target Dataset Alpha'));
      assert(promptReceived.includes('STRICT GROUNDING INSTRUCTIONS'));
    });

    // -------------------------------------------------------------------------
    // Test 8: Unverified Evidence Does NOT Get Sent to Gemini
    // -------------------------------------------------------------------------
    await test('8. Unverified evidence (verified=false) is NEVER sent to Gemini', async () => {
      geminiService.apiKey = 'test-mock-key';

      let callCount = 0;
      geminiService.generateContent = async () => {
        callCount++;
        return '{}';
      };

      const unverifiedEvidence = {
        metric: 'revenue',
        currentValue: 0,
        comparisonValue: 0,
        changePercent: 0,
        recordsAnalyzed: 0,
        datasetName: 'Empty Dataset',
        verified: false,
        verificationReason: 'Evidence verification failed: 0 records'
      };

      const result = await geminiService.generateGroundedInsight({
        type: 'growth',
        title: 'Invalid growth',
        summary: 'Invalid summary',
        evidence: unverifiedEvidence
      });

      assert.strictEqual(callCount, 0, 'Gemini must NEVER be called for unverified evidence');
      assert.strictEqual(result.aiGenerated, false);
      assert.strictEqual(result.fallback, true);
    });

    // -------------------------------------------------------------------------
    // Test 9: Gemini CANNOT Overwrite Factual Evidence
    // -------------------------------------------------------------------------
    await test('9. Gemini output can NEVER overwrite factual business evidence', async () => {
      geminiService.apiKey = 'test-mock-key';

      // Malicious or hallucinating LLM trying to claim wild numbers
      geminiService.generateContent = async () => {
        return JSON.stringify({
          title: 'REVENUE exploded by 999999%',
          summary: 'All records changed to 999999',
          explanation: 'Values modified to 999999',
          businessImpact: 'Unchecked hallucination',
          recommendedAction: 'Ignore data',
          confidence: 'high'
        });
      };

      // Run through full insightService pipeline
      const res = await insightService.generateInsights(testOrgA, {
        datasetId: dsGrowth.id,
        persist: false,
        forceFresh: true
      });

      assert(res.insights.length >= 1, 'Expected at least 1 generated insight');
      const growthInsight = res.insights.find(i => i.type === 'growth');
      assert(growthInsight, 'Expected growth insight');

      // Factual values MUST remain exactly as calculated by evidenceBuilderService
      assert.strictEqual(growthInsight.evidence.currentValue, 12500, 'currentValue must NOT be overwritten');
      assert.strictEqual(growthInsight.evidence.comparisonValue, 10000, 'comparisonValue must NOT be overwritten');
      assert.strictEqual(growthInsight.evidence.changePercent, 25, 'changePercent must NOT be overwritten');
      assert.strictEqual(growthInsight.evidence.recordsAnalyzed, 2, 'recordsAnalyzed must NOT be overwritten');
      assert.strictEqual(growthInsight.evidence.verified, true, 'verification status must remain true');
      assert(growthInsight.evidence.calculation.includes('25%'), 'calculation must remain authentic');
    });

    // -------------------------------------------------------------------------
    // Test 10: Multi-Tenant Dataset Isolation
    // -------------------------------------------------------------------------
    await test('10. Multi-tenant isolation prevents tenant B from generating or accessing Org A insights', async () => {
      const orgBResult = await evidenceBuilderService.loadDatasetAndRecords(dsGrowth.id, testOrgB);
      assert.strictEqual(orgBResult.dataset, null, 'Tenant B must not load Tenant A dataset');
      assert.strictEqual(orgBResult.records.length, 0);

      const insightsB = await insightService.getInsights(testOrgB, { status: 'all' });
      const hasOrgAInsight = insightsB.some(i => i.source_metadata?.dataset_id === dsGrowth.id);
      assert.strictEqual(hasOrgAInsight, false, 'Tenant B must not see Tenant A insights');
    });

    // -------------------------------------------------------------------------
    // Test 11: Phase 1 Deduplication & Cooldown Compatibility
    // -------------------------------------------------------------------------
    await test('11. Deduplication prevents redundant Gemini invocations for active duplicates', async () => {
      geminiService.apiKey = 'test-mock-key';

      let geminiCallCount = 0;
      geminiService.generateContent = async () => {
        geminiCallCount++;
        return JSON.stringify({
          title: 'REVENUE grew by 25%',
          summary: 'Verified growth summary',
          explanation: 'Grounded explanation',
          businessImpact: 'Operational expansion',
          recommendedAction: 'Plan continuation',
          confidence: 'high'
        });
      };

      // Generation 1: New insight -> calls Gemini
      const res1 = await insightService.generateInsights(testOrgA, {
        datasetId: dsGrowth.id,
        persist: true,
        forceFresh: true
      });
      const callsAfterFirst = geminiCallCount;
      assert(callsAfterFirst >= 1, 'First generation should invoke Gemini');

      // Generation 2 within cooldown: Active duplicate exists -> does NOT call Gemini!
      const res2 = await insightService.generateInsights(testOrgA, {
        datasetId: dsGrowth.id,
        persist: true,
        forceFresh: false
      });
      const callsAfterSecond = geminiCallCount;

      assert.strictEqual(callsAfterSecond, callsAfterFirst, 'Second generation within cooldown MUST NOT call Gemini again');
    });

    // -------------------------------------------------------------------------
    // Test 12: Phase 2 Persistent Storage Compatibility
    // -------------------------------------------------------------------------
    await test('12. Persistent storage provider reads seed dataset and local cache cleanly', async () => {
      const buffer = await storage.readFile('1/sample_sales_q4.csv');
      assert(buffer && buffer.length > 0, 'Should read seed dataset');
      const exists = await storage.exists('1/sample_sales_q4.csv');
      assert.strictEqual(exists, true);
    });

    // -------------------------------------------------------------------------
    // Test 13: Phase 3 Evidence Builder Compatibility
    // -------------------------------------------------------------------------
    await test('13. Evidence builder builds verified evidence with zero hardcoded business values', async () => {
      const records = await analyticsService.loadDatasetRecords(growthPath);
      const dims = analyticsService.detectDatasetDimensions(dsGrowth.schema, records);
      const trends = analyticsService.computeDatasetTrends(records, dims);

      const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
        dataset: dsGrowth,
        records,
        dimensions: dims,
        prevPoint: trends[0],
        currPoint: trends[1],
        targetMetric: 'revenue'
      });

      assert.strictEqual(evidence.recordsAnalyzed, 2);
      assert.strictEqual(evidence.currentValue, 12500);
      assert.strictEqual(evidence.comparisonValue, 10000);
      assert.strictEqual(evidence.changePercent, 25);
      assert.strictEqual(evidence.verified, true);
    });

    // -------------------------------------------------------------------------
    // Test 14: Security & Key Redaction in Error Messages
    // -------------------------------------------------------------------------
    await test('14. Sensitive API keys and tokens are never leaked in errors or logs', async () => {
      geminiService.apiKey = 'AIzaSySecretApiKeyDoNotExpose12345';

      const mockErr = new Error(`Connection failed to https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSySecretApiKeyDoNotExpose12345: Network timeout`);
      const sanitized = geminiService._sanitizeError(mockErr);

      assert(!sanitized.message.includes('AIzaSySecretApiKeyDoNotExpose12345'), 'Raw API key must be scrubbed');
      assert(sanitized.message.includes('[REDACTED]'), 'Key must be replaced with [REDACTED]');
    });

  } finally {
    // Restore original geminiService state
    geminiService.apiKey = originalApiKey;
    geminiService.generateContent = originalGenerateContent;
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4GeminiTests().catch(err => {
  console.error('Fatal test error in Phase 4 suite:', err);
  process.exit(1);
});
