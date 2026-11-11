const db = require('../server/config/database');
const { loadDatasetRecords } = require('../server/services/analyticsService');
const scenarioSimulationService = require('../server/services/scenarioSimulationService');
const Dataset = require('../server/models/datasetModel');

async function runWhatIfSuite() {
  console.log('=====================================================');
  console.log('🧪 RICOZANALYTICS WHAT-IF SIMULATION ACCEPTANCE SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  async function testScenario(datasetId, name, levers, description) {
    total++;
    console.log(`[TEST ${total}] ${name} (Dataset ID: ${datasetId})`);
    console.log(`Description: ${description}`);
    console.log(`Levers:`, JSON.stringify(levers));

    const dataset = await Dataset.findById(datasetId);
    if (!dataset) {
      console.error(`❌ Dataset ${datasetId} not found.`);
      return false;
    }

    const records = await loadDatasetRecords(dataset, 10000);
    console.log(`Loaded ${records.length} records from database.`);

    const schema = Array.isArray(dataset.schema) ? dataset.schema : [];
    const colNames = schema.map(c => (typeof c === 'string' ? c : c.name || '')).filter(Boolean);

    const revCol = colNames.find(c => ['revenue', 'sales', 'total_amount', 'amount', 'order_value'].includes(c.toLowerCase())) ||
      colNames.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales')) ||
      (schema.find(c => typeof c === 'object' && ['number', 'numeric', 'float', 'integer'].includes(c.type))?.name);

    const costCol = colNames.find(c => ['cost', 'cogs', 'expenses', 'expense'].includes(c.toLowerCase())) ||
      colNames.find(c => c.toLowerCase().includes('cost'));

    const qtyCol = colNames.find(c => ['quantity', 'units', 'units_sold', 'volume', 'order_count'].includes(c.toLowerCase()));

    // Independent calculation directly from records:
    let expectedBaseRev = 0;
    let expectedBaseCost = 0;
    let expectedBaseUnits = 0;

    for (const r of records) {
      expectedBaseRev += Number(r[revCol]) || 0;
      if (costCol) expectedBaseCost += Number(r[costCol]) || 0;
      if (qtyCol) expectedBaseUnits += Number(r[qtyCol]) || 0;
    }
    if (!costCol) expectedBaseCost = Number((expectedBaseRev * 0.65).toFixed(2));
    if (!qtyCol) expectedBaseUnits = records.length;

    expectedBaseRev = Number(expectedBaseRev.toFixed(2));
    expectedBaseCost = Number(expectedBaseCost.toFixed(2));

    const pChg = Number(levers.priceChangePct || 0);
    const vChg = Number(levers.volumeChangePct || 0);
    const convChg = Number(levers.conversionChangePct || 0);
    const cogsChg = Number(levers.cogsChangePct || 0);
    const opexChg = Number(levers.opexChangePct || 0);

    const priceFactor = 1.0 + (pChg / 100.0);
    const effVolFactor = (1.0 + (vChg / 100.0)) * (1.0 + (convChg / 100.0));
    const cogsFactor = 1.0 + (cogsChg / 100.0);
    const opexFactor = 1.0 + (opexChg / 100.0);

    const expectedSimRev = Number(Math.max(0, expectedBaseRev * priceFactor * effVolFactor).toFixed(2));
    const expBaseCOGS = Number((expectedBaseCost * 0.80).toFixed(2));
    const expBaseOpex = Number((expectedBaseCost * 0.20).toFixed(2));
    const expSimCOGS = Number(Math.max(0, expBaseCOGS * cogsFactor * effVolFactor).toFixed(2));
    const expSimOpex = Number(Math.max(0, expBaseOpex * opexFactor).toFixed(2));
    const expectedSimCost = Number((expSimCOGS + expSimOpex).toFixed(2));
    const expectedSimProfit = Number((expectedSimRev - expectedSimCost).toFixed(2));

    // Run service simulation:
    const sim = scenarioSimulationService.simulateFinancialLevers({
      baselineRevenue: expectedBaseRev,
      baselineCost: expectedBaseCost,
      baselineUnits: expectedBaseUnits,
      hasCostColumn: Boolean(costCol),
      levers,
      context: { datasetId: dataset.id, datasetName: dataset.name }
    });

    console.log(`Baseline Revenue: ₹${sim.baseline.revenue} (Expected: ₹${expectedBaseRev})`);
    console.log(`Simulated Revenue: ₹${sim.simulated.revenue} (Expected: ₹${expectedSimRev})`);
    console.log(`Baseline Cost: ₹${sim.baseline.cost} (Expected: ₹${expectedBaseCost})`);
    console.log(`Simulated Cost: ₹${sim.simulated.cost} (Expected: ₹${expectedSimCost})`);
    console.log(`Simulated Profit: ₹${sim.simulated.grossProfit} (Expected: ₹${expectedSimProfit})`);

    const isMatch = (
      Math.abs(sim.baseline.revenue - expectedBaseRev) < 0.01 &&
      Math.abs(sim.simulated.revenue - expectedSimRev) < 0.01 &&
      Math.abs(sim.baseline.cost - expectedBaseCost) < 0.01 &&
      Math.abs(sim.simulated.cost - expectedSimCost) < 0.01 &&
      Math.abs(sim.simulated.grossProfit - expectedSimProfit) < 0.01
    );

    if (isMatch) {
      console.log(`✅ PASSED: Exact mathematical match against independent ground truth.\n`);
      passed++;
      return true;
    } else {
      console.error(`❌ FAILED: Mathematical deviation detected.\n`);
      return false;
    }
  }

  // Scenario 1: Mixed Variance Telemetry (Price +10%, COGS -5%)
  await testScenario(391, 'Mixed Variance Telemetry', { priceChangePct: 10, cogsChangePct: -5 }, 'Margin expansion: price increase + procurement cost reduction');

  // Scenario 2: Global Supply Chain Logistics (Price +15%, Volume +5%)
  await testScenario(396, 'Global Supply Chain Logistics', { priceChangePct: 15, volumeChangePct: 5 }, 'Logistics rate revision with network expansion');

  // Scenario 3: Audit Telemetry With Missing Values (Price +5%, Conversion +10%)
  await testScenario(394, 'Audit Telemetry With Missing Values', { priceChangePct: 5, conversionChangePct: 10 }, 'Funnel conversion boost across sparse telemetry with nulls');

  // Scenario 4: Enterprise Customer Directory (Numeric credit_limit lever +20%)
  await testScenario(393, 'Enterprise Customer Directory', { priceChangePct: 20 }, 'Credit expansion simulation on non-standard numeric column');

  // Scenario 5: Audit Telemetry With Duplicate Records (Price -10%, Volume +20%, Opex +10%)
  await testScenario(395, 'Audit Telemetry With Duplicate Records', { priceChangePct: -10, volumeChangePct: 20, opexChangePct: 10 }, 'Price elasticity simulation with overhead scale');

  console.log('=====================================================');
  console.log(`🏁 WHAT-IF ACCEPTANCE SUMMARY: ${passed}/${total} PASSED (${((passed/total)*100).toFixed(1)}%)`);
  console.log('=====================================================');

  process.exit(passed === total ? 0 : 1);
}

runWhatIfSuite().catch(err => {
  console.error('Fatal error in What-If suite:', err);
  process.exit(1);
});
