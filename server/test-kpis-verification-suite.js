const assert = require('assert');
const {
  detectDatasetDimensions,
  computeDatasetKpis,
  computeDatasetTrends,
  applyDatasetFilters
} = require('./services/analyticsService');
const Dataset = require('./models/datasetModel');
const { loadDatasetRecords } = require('./services/analyticsService');

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  RICOZ ANALYTICS — KPI & DATA VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Real Dataset 1 — Total Orders & Units Sold
  // --------------------------------------------------------------------------
  const orgId = '00000000-0000-0000-0000-000000000001';
  const datasets = await Dataset.findByOrganizationId(orgId);
  const ds = datasets[0];
  const records = await loadDatasetRecords(ds.file_path);
  const schema = JSON.parse(ds.schema);
  const dimensions = detectDatasetDimensions(schema, records);

  test('1. Total Orders on Real Dataset matches COUNT(DISTINCT order_id) = 20', () => {
    const kpis = computeDatasetKpis(records, records, dimensions);
    const manualDistinctOrders = new Set(records.map(r => r.order_id).filter(Boolean)).size;
    assert.strictEqual(kpis.totalOrders, 20, 'Total orders should be 20');
    assert.strictEqual(kpis.totalOrders, manualDistinctOrders, 'totalOrders must equal COUNT(DISTINCT order_id)');
  });

  test('2. Units Sold on Real Dataset matches SUM(units_sold) = 282', () => {
    const kpis = computeDatasetKpis(records, records, dimensions);
    const manualSumUnits = records.reduce((s, r) => s + Number(r.units_sold), 0);
    assert.strictEqual(kpis.totalQuantity, 282, 'Units sold should be 282');
    assert.strictEqual(kpis.totalQuantity, manualSumUnits, 'totalQuantity must equal SUM(units_sold)');
  });

  test('3. Revenue and AOV mathematical consistency on Real Dataset', () => {
    const kpis = computeDatasetKpis(records, records, dimensions);
    const manualSales = records.reduce((s, r) => s + Number(r.sales_amount), 0);
    assert.strictEqual(kpis.totalSales, 1758000.5, 'Total sales should be 1758000.5');
    assert.strictEqual(kpis.totalSales, manualSales, 'totalSales must equal SUM(sales_amount)');
    // AOV = Total Sales / Total Orders = 1758000.5 / 20 = 87900.025
    assert.strictEqual(kpis.averageOrderValue, 87900.02, 'AOV should be 87900.02');
    // Avg Order Volume = 282 / 20 = 14.1 units
    const avgOrderVol = Number((kpis.totalQuantity / kpis.totalOrders).toFixed(1));
    assert.strictEqual(avgOrderVol, 14.1, 'Avg Order Volume should be 14.1 units');
    // Avg Unit Realization = 1758000.5 / 282 = 6234.04
    const avgUnitRealization = Number((kpis.totalSales / kpis.totalQuantity).toFixed(2));
    assert.strictEqual(avgUnitRealization, 6234.04, 'Avg Unit Realization should be 6234.04');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Filtered Total Orders & Units Sold
  // --------------------------------------------------------------------------
  test('4. Filtered KPIs: Region = Bengaluru', () => {
    const filtered = applyDatasetFilters(records, { region: 'Bengaluru' }, dimensions);
    const kpis = computeDatasetKpis(records, filtered, dimensions);
    assert.strictEqual(kpis.totalOrders, 4, 'Bengaluru orders count must be 4');
    assert.strictEqual(kpis.totalQuantity, 42, 'Bengaluru units sold must be 42');
    assert.strictEqual(kpis.totalSales, 449000.5, 'Bengaluru sales must be 449000.5');
    assert.strictEqual(kpis.averageOrderValue, 112250.13, 'Bengaluru AOV must be 112250.13');
  });

  test('5. Filtered KPIs: Channel = Direct Online', () => {
    const filtered = applyDatasetFilters(records, { channel: 'Direct Online' }, dimensions);
    const kpis = computeDatasetKpis(records, filtered, dimensions);
    assert.strictEqual(kpis.totalOrders, 8, 'Direct Online orders count must be 8');
    assert.strictEqual(kpis.totalQuantity, 120, 'Direct Online units sold must be 120');
    assert.strictEqual(kpis.totalSales, 631000.5, 'Direct Online sales must be 631000.5');
  });

  test('6. Filtered KPIs: Category = Hardware', () => {
    const filtered = applyDatasetFilters(records, { category: 'Hardware' }, dimensions);
    const kpis = computeDatasetKpis(records, filtered, dimensions);
    assert.strictEqual(kpis.totalOrders, 7, 'Hardware orders count must be 7');
    assert.strictEqual(kpis.totalQuantity, 128, 'Hardware units sold must be 128');
    assert.strictEqual(kpis.totalSales, 381000.5, 'Hardware sales must be 381000.5');
  });

  test('7. Filtered KPIs: Date Range = 7d', () => {
    const filtered = applyDatasetFilters(records, { dateRange: '7d' }, dimensions);
    const kpis = computeDatasetKpis(records, filtered, dimensions);
    assert.strictEqual(kpis.totalOrders, 8, 'Last 7 days orders count must be 8');
    assert.strictEqual(kpis.totalQuantity, 110, 'Last 7 days units sold must be 110');
    assert.strictEqual(kpis.totalSales, 610000, 'Last 7 days sales must be 610000');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Edge Case — Empty Dataset
  // --------------------------------------------------------------------------
  test('8. Empty Dataset returns zeroed metrics without crashing or NaN', () => {
    const kpis = computeDatasetKpis([], [], dimensions);
    assert.strictEqual(kpis.totalSales, 0);
    assert.strictEqual(kpis.totalOrders, 0);
    assert.strictEqual(kpis.totalQuantity, 0);
    assert.strictEqual(kpis.averageOrderValue, 0);
    assert.strictEqual(kpis.minSales, 0);
    assert.strictEqual(kpis.maxSales, 0);
    assert.strictEqual(kpis.recordCount, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Edge Case — Null, Undefined, String & Invalid Values
  // --------------------------------------------------------------------------
  test('9. Null and invalid values handled gracefully', () => {
    const dirtyRecords = [
      { order_id: 'ORD-A', sales_amount: 100, units_sold: 2, order_date: '2026-09-01' },
      { order_id: 'ORD-B', sales_amount: null, units_sold: 'N/A', order_date: '2026-09-02' },
      { order_id: 'ORD-C', sales_amount: undefined, units_sold: null, order_date: '2026-09-03' },
      { order_id: null, sales_amount: 50, units_sold: 3, order_date: '2026-09-04' },
      { order_id: '   ', sales_amount: 'invalid', units_sold: 5, order_date: '2026-09-05' },
      { order_id: 'ORD-D', sales_amount: 250, units_sold: 10, order_date: '2026-09-06' }
    ];
    const dirtyDimensions = {
      primaryMetric: 'sales_amount',
      quantityMetric: 'units_sold',
      orderIdColumn: 'order_id',
      dateColumn: 'order_date'
    };
    const kpis = computeDatasetKpis(dirtyRecords, dirtyRecords, dirtyDimensions);
    // Valid sales: 100 + 50 + 250 = 400
    assert.strictEqual(kpis.totalSales, 400, 'Total sales should sum only valid numbers');
    // Valid units: 2 + 3 + 5 + 10 = 20
    assert.strictEqual(kpis.totalQuantity, 20, 'Units sold should sum valid numbers (ignoring N/A, null)');
    // Distinct order IDs: 'ORD-A', 'ORD-B', 'ORD-C', 'ORD-D' -> 4
    assert.strictEqual(kpis.totalOrders, 4, 'Total orders should count distinct non-empty order IDs');
    // AOV = 400 / 4 = 100
    assert.strictEqual(kpis.averageOrderValue, 100, 'AOV should be 400 / 4 = 100');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Multiple Orders with Repeated Order IDs (Line Items)
  // --------------------------------------------------------------------------
  test('10. Multi-line items with repeated order IDs correctly deduplicates Total Orders', () => {
    // 6 rows representing 3 distinct orders
    const multiLineRecords = [
      { order_id: 'ORD-001', item: 'Laptop', sales_amount: 50000, units_sold: 1, order_date: '2026-09-01' },
      { order_id: 'ORD-001', item: 'Mouse', sales_amount: 1500, units_sold: 2, order_date: '2026-09-01' },
      { order_id: 'ORD-001', item: 'Bag', sales_amount: 2500, units_sold: 1, order_date: '2026-09-01' },
      { order_id: 'ORD-002', item: 'Monitor', sales_amount: 20000, units_sold: 2, order_date: '2026-09-02' },
      { order_id: 'ORD-002', item: 'Cable', sales_amount: 500, units_sold: 4, order_date: '2026-09-02' },
      { order_id: 'ORD-003', item: 'Keyboard', sales_amount: 3500, units_sold: 1, order_date: '2026-09-03' }
    ];
    const testDimensions = {
      primaryMetric: 'sales_amount',
      quantityMetric: 'units_sold',
      orderIdColumn: 'order_id',
      dateColumn: 'order_date'
    };
    const kpis = computeDatasetKpis(multiLineRecords, multiLineRecords, testDimensions);

    // Row count = 6
    assert.strictEqual(kpis.recordCount, 6, 'Record count is 6');
    // Total Orders = COUNT(DISTINCT order_id) = 3 (ORD-001, ORD-002, ORD-003)
    assert.strictEqual(kpis.totalOrders, 3, 'Total Orders must be 3 distinct orders, NOT 6 rows!');
    // Units Sold = SUM(units_sold) = 1 + 2 + 1 + 2 + 4 + 1 = 11 units
    assert.strictEqual(kpis.totalQuantity, 11, 'Units sold must be 11 total units');
    // Total Sales = 50000 + 1500 + 2500 + 20000 + 500 + 3500 = 78000
    assert.strictEqual(kpis.totalSales, 78000, 'Total sales must be 78000');
    // AOV = 78000 / 3 = 26000
    assert.strictEqual(kpis.averageOrderValue, 26000, 'AOV must be 78000 / 3 = 26000');
    // Avg Order Volume = 11 / 3 = 3.67 units per order
    const avgOrderVol = Number((kpis.totalQuantity / kpis.totalOrders).toFixed(1));
    assert.strictEqual(avgOrderVol, 3.7, 'Avg Order Volume must be 3.7 units');
    // Avg Unit Realization = 78000 / 11 = 7090.91
    const avgUnitReal = Number((kpis.totalSales / kpis.totalQuantity).toFixed(2));
    assert.strictEqual(avgUnitReal, 7090.91, 'Avg Unit Realization must be 7090.91');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Column Detection Robustness (Discount is NOT units, Customer ID is NOT Order ID)
  // --------------------------------------------------------------------------
  test('11. Column detection robustness: discount is not quantity, customer_id is not order_id', () => {
    const complexSchema = [
      { name: 'customer_id', type: 'string' },
      { name: 'product_id', type: 'string' },
      { name: 'order_number', type: 'string' },
      { name: 'revenue', type: 'number' },
      { name: 'discount', type: 'number' },
      { name: 'qty', type: 'number' },
      { name: 'date', type: 'date' }
    ];
    const complexDimensions = detectDatasetDimensions(complexSchema, []);
    assert.strictEqual(complexDimensions.orderIdColumn, 'order_number', 'orderIdColumn must pick order_number, NOT customer_id or product_id');
    assert.strictEqual(complexDimensions.quantityMetric, 'qty', 'quantityMetric must pick qty, NOT discount!');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Time-series Trends includes Units
  // --------------------------------------------------------------------------
  test('12. computeDatasetTrends accumulates daily units for sparklines', () => {
    const trends = computeDatasetTrends(records, dimensions);
    assert(trends.length > 0, 'Trends should have points');
    assert.strictEqual(typeof trends[0].revenue, 'number', 'Trend point has revenue');
    assert.strictEqual(typeof trends[0].orders, 'number', 'Trend point has orders');
    assert.strictEqual(typeof trends[0].units, 'number', 'Trend point has units');
    const totalTrendUnits = trends.reduce((s, t) => s + t.units, 0);
    assert.strictEqual(totalTrendUnits, 282, 'Sum of units across trends matches totalUnits (282)');
  });

  console.log(`\n===============================================================`);
  console.log(`  SUITE COMPLETE: ${passed} / ${total} Tests Passed`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
