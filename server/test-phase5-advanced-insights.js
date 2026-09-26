const fs = require('fs');
const path = require('path');
const assert = require('assert');
const storage = require('./storage');
const Dataset = require('./models/datasetModel');
const AlertModel = require('./models/alertModel');
const InsightModel = require('./models/insightModel');
const insightService = require('./services/insightService');
const insightPrioritizationService = require('./services/insightPrioritizationService');
const insightRelationshipService = require('./services/insightRelationshipService');
const evidenceBuilderService = require('./services/evidenceBuilderService');
const geminiService = require('./services/geminiService');
const analyticsService = require('./services/analyticsService');

/**
 * PHASE 5: ADVANCED AI INSIGHT INTELLIGENCE TEST SUITE
 * 
 * Verifies:
 * 1. Priority calculation
 * 2. Severity calculation
 * 3. Impact score calculation
 * 4. Priority reason generation
 * 5. Insight ordering
 * 6. Relationship detection
 * 7. Revenue/orders relationship
 * 8. Revenue/units relationship
 * 9. Missing metrics handling
 * 10. No causation claims
 * 11. Multi-tenant isolation
 * 12. Gemini receives only verified evidence
 * 13. Gemini failure fallback
 * 14. Existing Phase 1 deduplication
 * 15. Existing Phase 2 storage
 * 16. Existing Phase 3 evidence
 * 17. Existing Phase 4 Gemini grounding
 */
async function runPhase5Tests() {
  console.log('===============================================================');
  console.log('  PHASE 5: ADVANCED AI INSIGHT INTELLIGENCE TEST SUITE        ');
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
  const testDir = path.resolve(__dirname, 'uploads/test_phase5');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Multi-metric dataset for relationship testing
  const salesPath = path.join(testDir, 'sales_relationships.csv');
  fs.writeFileSync(salesPath, [
    'date,revenue,orders,units_sold,profit',
    '2026-01-01,10000,50,100,2000',
    '2026-01-02,12000,60,120,2500',
    '2026-01-03,15000,75,150,3200',
    '2026-01-04,18000,90,180,3900'
  ].join('\n'));

  // Divergent dataset: orders grew but basket / revenue dropped
  const divergentPath = path.join(testDir, 'divergent_relationships.csv');
  fs.writeFileSync(divergentPath, [
    'date,revenue,orders,units_sold,profit',
    '2026-01-01,20000,50,100,5000',
    '2026-01-02,22000,55,110,5500',
    '2026-01-03,15000,90,70,3000',
    '2026-01-04,12000,100,60,2000'
  ].join('\n'));

  // Dataset missing orders and units
  const missingColsPath = path.join(testDir, 'missing_cols.csv');
  fs.writeFileSync(missingColsPath, [
    'date,cost,margin',
    '2026-01-01,500,20',
    '2026-01-02,600,25'
  ].join('\n'));

  const dsSales = await Dataset.create({
    userId: 1,
    name: 'Sales Relational Dataset',
    filePath: salesPath,
    rowCount: 4,
    columnCount: 5,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'orders', type: 'integer' },
      { name: 'units_sold', type: 'integer' },
      { name: 'profit', type: 'numeric' }
    ]
  });

  const dsDivergent = await Dataset.create({
    userId: 1,
    name: 'Divergent Relational Dataset',
    filePath: divergentPath,
    rowCount: 4,
    columnCount: 5,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'orders', type: 'integer' },
      { name: 'units_sold', type: 'integer' },
      { name: 'profit', type: 'numeric' }
    ]
  });

  const dsMissing = await Dataset.create({
    userId: 1,
    name: 'Missing Columns Dataset',
    filePath: missingColsPath,
    rowCount: 2,
    columnCount: 3,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'cost', type: 'numeric' },
      { name: 'margin', type: 'numeric' }
    ]
  });

  const originalApiKey = geminiService.apiKey;
  const originalGenerateContent = geminiService.generateContent;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Priority Calculation
    // -------------------------------------------------------------------------
    await test('1. Priority calculation deterministically assigns critical, high, medium, low', () => {
      const critInsight = {
        type: 'operational',
        severity: 'critical',
        evidence: {
          metric: 'revenue',
          condition: '>',
          comparisonValue: 100000,
          recordsAnalyzed: 500,
          verified: true
        }
      };
      const pCrit = insightPrioritizationService.calculateInsightPriority(critInsight);
      assert.strictEqual(pCrit.priority, 'critical', 'Operational critical alert on revenue must be critical priority');

      const lowInsight = {
        type: 'general',
        evidence: {
          metric: 'misc',
          recordsAnalyzed: 10,
          verified: true
        }
      };
      const pLow = insightPrioritizationService.calculateInsightPriority(lowInsight);
      assert(['low', 'medium'].includes(pLow.priority), 'General low-signal insight must have low or medium priority');
    });

    // -------------------------------------------------------------------------
    // Test 2: Severity Calculation
    // -------------------------------------------------------------------------
    await test('2. Severity calculation derives deterministic severity values', () => {
      const declineInsight = {
        type: 'decline',
        evidence: {
          metric: 'revenue',
          changePercent: -35.5,
          recordsAnalyzed: 250,
          verified: true
        }
      };
      const pDecline = insightPrioritizationService.calculateInsightPriority(declineInsight);
      assert(
        ['critical', 'high'].includes(pDecline.severity),
        `Severe decline (-35.5%) must yield high or critical severity (got ${pDecline.severity})`
      );

      const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
      assert(validSeverities.includes(pDecline.severity), 'Severity must be in allowed enum');
    });

    // -------------------------------------------------------------------------
    // Test 3: Impact Score Calculation
    // -------------------------------------------------------------------------
    await test('3. Impact score calculation is bounded strictly between 0 and 100', () => {
      const massiveBreach = {
        type: 'operational',
        severity: 'critical',
        evidence: {
          metric: 'revenue_loss',
          recordsAnalyzed: 10000,
          verified: true
        }
      };
      const pMassive = insightPrioritizationService.calculateInsightPriority(massiveBreach);
      assert(pMassive.impactScore >= 80 && pMassive.impactScore <= 100, 'Extreme event must be >= 80 and <= 100');

      const unverified = {
        type: 'growth',
        evidence: {
          metric: 'revenue',
          changePercent: 50,
          verified: false // Unverified penalty
        }
      };
      const pUnverified = insightPrioritizationService.calculateInsightPriority(unverified);
      assert(pUnverified.impactScore <= 25, 'Unverified insight must receive severe penalty (<= 25)');
    });

    // -------------------------------------------------------------------------
    // Test 4: Priority Reason Generation
    // -------------------------------------------------------------------------
    await test('4. Priority reason generation explains score factors transparently', () => {
      const insight = {
        type: 'decline',
        evidence: {
          metric: 'revenue',
          changePercent: -20,
          recordsAnalyzed: 150,
          verified: true
        }
      };
      const p = insightPrioritizationService.calculateInsightPriority(insight);
      assert(typeof p.priorityReason === 'string', 'Priority reason must be string');
      assert(p.priorityReason.includes('Impact score'), 'Must cite impact score');
      assert(p.priorityReason.toLowerCase().includes('revenue'), 'Must mention primary metric');
      assert(p.priorityReason.toLowerCase().includes('contraction'), 'Must cite negative contraction velocity');
    });

    // -------------------------------------------------------------------------
    // Test 5: Insight Ordering (Ranking)
    // -------------------------------------------------------------------------
    await test('5. Insight ordering ranks high impact scores above lower impact scores', () => {
      const insList = [
        { id: '1', title: 'Low Priority Event', impactScore: 35, created_at: new Date('2026-01-02') },
        { id: '2', title: 'Critical Revenue Outlier', impactScore: 92, created_at: new Date('2026-01-01') },
        { id: '3', title: 'Moderate Growth', impactScore: 68, created_at: new Date('2026-01-03') }
      ];

      const ranked = insightPrioritizationService.rankInsights(insList);
      assert.strictEqual(ranked[0].id, '2', 'Impact score 92 must rank #1');
      assert.strictEqual(ranked[1].id, '3', 'Impact score 68 must rank #2');
      assert.strictEqual(ranked[2].id, '1', 'Impact score 35 must rank #3');
    });

    // -------------------------------------------------------------------------
    // Test 6: Relationship Detection
    // -------------------------------------------------------------------------
    await test('6. Relationship detection identifies empirical co-movements across metrics', async () => {
      const records = await analyticsService.loadDatasetRecords(salesPath);
      const dims = analyticsService.detectDatasetDimensions(dsSales.schema, records);

      const rels = insightRelationshipService.detectRelationships({
        dataset: dsSales,
        records,
        dimensions: dims
      });

      assert(Array.isArray(rels), 'Must return relationships array');
      assert(rels.length >= 2, `Must identify multiple relationships (found ${rels.length})`);
    });

    // -------------------------------------------------------------------------
    // Test 7: Revenue / Orders Relationship
    // -------------------------------------------------------------------------
    await test('7. Revenue and orders relationship correctly identifies positive co-movement', async () => {
      const records = await analyticsService.loadDatasetRecords(salesPath);
      const dims = analyticsService.detectDatasetDimensions(dsSales.schema, records);

      const rels = insightRelationshipService.detectRelationships({
        dataset: dsSales,
        records,
        dimensions: dims
      });

      const revOrdRel = rels.find(r => r.id === 'rel_revenue_orders');
      assert(revOrdRel, 'Must detect rel_revenue_orders');
      assert.strictEqual(revOrdRel.direction, 'positive', 'Direction must be positive');
      assert(revOrdRel.relationship.includes('Revenue and orders both increased'), 'Phrasing must be observational');
      assert.strictEqual(revOrdRel.verified, true, 'Relationship must be verified');
      assert(Array.isArray(revOrdRel.evidence) && revOrdRel.evidence.length === 2, 'Evidence must contain both metrics');
    });

    // -------------------------------------------------------------------------
    // Test 8: Revenue / Units Relationship
    // -------------------------------------------------------------------------
    await test('8. Revenue and units sold relationship correctly reports alignment', async () => {
      const records = await analyticsService.loadDatasetRecords(salesPath);
      const dims = analyticsService.detectDatasetDimensions(dsSales.schema, records);

      const rels = insightRelationshipService.detectRelationships({
        dataset: dsSales,
        records,
        dimensions: dims
      });

      const revUnitsRel = rels.find(r => r.id === 'rel_revenue_units');
      assert(revUnitsRel, 'Must detect rel_revenue_units');
      assert.strictEqual(revUnitsRel.verified, true);
      assert(revUnitsRel.metrics.includes('revenue') && revUnitsRel.metrics.includes('units_sold'));
    });

    // -------------------------------------------------------------------------
    // Test 9: Missing Metrics Handling
    // -------------------------------------------------------------------------
    await test('9. Missing metrics dataset produces zero false relationships', async () => {
      const records = await analyticsService.loadDatasetRecords(missingColsPath);
      const dims = analyticsService.detectDatasetDimensions(dsMissing.schema, records);

      const rels = insightRelationshipService.detectRelationships({
        dataset: dsMissing,
        records,
        dimensions: dims
      });

      assert.strictEqual(rels.length, 0, 'No relationships should be detected when revenue/orders/units are missing');
    });

    // -------------------------------------------------------------------------
    // Test 10: No Causation Claims
    // -------------------------------------------------------------------------
    await test('10. Strict invariant: Relationships never claim causation', async () => {
      const records = await analyticsService.loadDatasetRecords(divergentPath);
      const dims = analyticsService.detectDatasetDimensions(dsDivergent.schema, records);

      const rels = insightRelationshipService.detectRelationships({
        dataset: dsDivergent,
        records,
        dimensions: dims
      });

      for (const rel of rels) {
        const text = `${rel.relationship} ${rel.summary}`.toLowerCase();
        assert(!text.includes('caused'), 'Must never say "caused"');
        assert(!text.includes('led to'), 'Must never say "led to"');
        assert(!text.includes('because of'), 'Must never say "because of"');
        assert(!text.includes('due to'), 'Must never say "due to"');
      }
    });

    // -------------------------------------------------------------------------
    // Test 11: Multi-Tenant Isolation
    // -------------------------------------------------------------------------
    await test('11. Multi-tenant isolation: Datasets across different organizations are never co-mingled', async () => {
      const resultA = await insightService.generateInsights(testOrgA, { persist: false });
      const resultB = await insightService.generateInsights(testOrgB, { persist: false });

      assert(Array.isArray(resultA.insights));
      assert(Array.isArray(resultB.insights));

      // Insights for org A must not leak into org B
      for (const ins of resultA.insights) {
        assert.notStrictEqual(ins.organization_id, testOrgB, 'Cross-tenant leak detected');
      }
    });

    // -------------------------------------------------------------------------
    // Test 12: Gemini Receives Only Verified Evidence
    // -------------------------------------------------------------------------
    await test('12. Gemini prompt builder sends strictly verified evidence and observational relationships', () => {
      const mockInsights = [
        {
          id: 'ins-1',
          type: 'growth',
          title: 'Revenue Grew 25%',
          summary: 'Revenue grew by 25%.',
          priority: 'high',
          evidence: {
            metric: 'revenue',
            currentValue: 12500,
            comparisonValue: 10000,
            changePercent: 25,
            verified: true
          }
        }
      ];

      const mockRelationships = [
        {
          relationship: 'Revenue and orders both increased during the analyzed period',
          metrics: ['revenue', 'orders'],
          direction: 'positive',
          verified: true
        }
      ];

      const prompt = geminiService._buildExecutiveBriefingPrompt({
        insights: mockInsights,
        relationships: mockRelationships,
        context: { organizationId: testOrgA }
      });

      assert(prompt.includes('CRITICAL GROUNDING & ACCURACY RULES'), 'Must include grounding rules');
      assert(prompt.includes('DO NOT claim causation'), 'Must enforce no causation rule');
      assert(prompt.includes('12500'), 'Must include verified currentValue');
      assert(prompt.includes('Revenue and orders both increased'), 'Must include verified relationship');
    });

    // -------------------------------------------------------------------------
    // Test 13: Gemini Failure Fallback
    // -------------------------------------------------------------------------
    await test('13. Executive briefing graceful deterministic fallback on Gemini error', async () => {
      // Force Gemini to throw error
      geminiService.apiKey = 'AIzaSyMockKeyForcedFailure';
      geminiService.generateContent = async () => {
        throw new Error('503 Service Unavailable: Gemini 2.5 Flash temporarily overloaded');
      };

      const mockInsights = [
        {
          id: 'ins-1',
          type: 'growth',
          title: 'Revenue Grew 25%',
          summary: 'Revenue increased by 25%.',
          priority: 'high',
          evidence: { verified: true }
        }
      ];

      const briefing = await geminiService.generateExecutiveBriefing({
        insights: mockInsights,
        relationships: [{ relationship: 'Revenue and orders both increased', verified: true }],
        context: { organizationId: testOrgA }
      });

      assert(briefing, 'Fallback briefing must be generated');
      assert.strictEqual(briefing.aiGenerated, false, 'Must indicate deterministic fallback');
      assert.strictEqual(briefing.fallback, true, 'Fallback flag must be true');
      assert(typeof briefing.headline === 'string', 'Headline must be string');
      assert(Array.isArray(briefing.businessImplications), 'Business implications must be array');
      assert(Array.isArray(briefing.recommendedActions), 'Recommended actions must be array');
    });

    // -------------------------------------------------------------------------
    // Test 14: Existing Phase 1 Deduplication
    // -------------------------------------------------------------------------
    await test('14. Phase 1 Deduplication: Active duplicate insight inside cooldown is reused', async () => {
      const title = 'Test Phase 5 Cooldown Insight';
      const created = await InsightModel.create({
        organizationId: testOrgA,
        type: 'trend',
        title,
        summary: 'Original observation.',
        severity: 'info',
        evidence: { verified: true }
      });

      const duplicate = await InsightModel.findActiveDuplicate({
        organizationId: testOrgA,
        type: 'trend',
        title,
        cooldownMinutes: 60
      });

      assert(duplicate, 'Must find active duplicate within cooldown');
      assert.strictEqual(duplicate.id, created.id);

      // Cleanup
      await InsightModel.deleteByIdAndOrgId(created.id, testOrgA);
    });

    // -------------------------------------------------------------------------
    // Test 15: Existing Phase 2 Storage
    // -------------------------------------------------------------------------
    await test('15. Phase 2 persistent dataset storage layer functions seamlessly', async () => {
      const records = await analyticsService.loadDatasetRecords(salesPath);
      assert(Array.isArray(records) && records.length === 4, 'Must load persistent records');
    });

    // -------------------------------------------------------------------------
    // Test 16: Existing Phase 3 Evidence
    // -------------------------------------------------------------------------
    await test('16. Phase 3 Evidence Builder calculates verified factual evidence from rows', async () => {
      const records = await analyticsService.loadDatasetRecords(salesPath);
      const dims = analyticsService.detectDatasetDimensions(dsSales.schema, records);
      const trends = analyticsService.computeDatasetTrends(records, dims);

      const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
        dataset: dsSales,
        records,
        dimensions: dims,
        prevPoint: trends[0],
        currPoint: trends[1],
        targetMetric: 'revenue'
      });

      assert.strictEqual(evidence.verified, true);
      assert.strictEqual(typeof evidence.currentValue, 'number');
      assert.strictEqual(typeof evidence.comparisonValue, 'number');
    });

    // -------------------------------------------------------------------------
    // Test 17: Existing Phase 4 Gemini Grounding
    // -------------------------------------------------------------------------
    await test('17. Phase 4 Gemini grounding preserves factual metrics immutably', () => {
      const evidence = {
        currentValue: 18000,
        comparisonValue: 15000,
        changePercent: 20,
        recordsAnalyzed: 4,
        datasetId: 1,
        sourceFields: ['revenue'],
        calculation: 'period_over_period',
        verified: true
      };

      const snapshot = insightService._extractFactualEvidence(evidence);
      assert.strictEqual(snapshot.currentValue, 18000);
      assert.strictEqual(snapshot.changePercent, 20);
      assert.strictEqual(snapshot.verified, true);
    });

  } finally {
    // Restore Gemini service
    geminiService.apiKey = originalApiKey;
    geminiService.generateContent = originalGenerateContent;
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch(err => {
  console.error('Fatal test error in Phase 5 suite:', err);
  process.exit(1);
});
