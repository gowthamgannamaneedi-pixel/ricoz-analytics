/**
 * Unit Test Suite for Formula Calculator Utility
 * Tests required by Phase 2:
 * 1. Arithmetic accuracy (Revenue - COGS = Gross Profit)
 * 2. Currency units (₹ Cr, $, Lakhs)
 * 3. Percentage calculations ((Gross Profit / Revenue) * 100)
 * 4. Division by zero (Revenue = 0, Hubs = 0, Negative Hubs)
 * 5. Missing data (undefined, null, empty string, NaN)
 * 6. Negative values (Losses where COGS > Revenue)
 * 7. Rounding precision (Gross Margin 68.4%, Gross Profit per hub 0.12 Cr)
 * 8. Large values (Trillions / Crores / large hub counts)
 */

import {
  safeNumber,
  roundTo,
  formatCurrencyValue,
  formatPercentageValue,
  calculateGrossMetrics,
  DEFAULT_ILLUSTRATIVE_METRICS
} from './src/utils/formulaCalculator.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${message}`);
}

console.log('--- RUNNING FORMULA CALCULATOR UNIT TESTS ---\n');

// 1. Core Specified Mathematics
console.log('1. Core Specified Business Calculation:');
{
  const result = calculateGrossMetrics({
    revenue: 8.42,
    cogs: 2.66,
    hubs: 48,
    currencySymbol: '₹',
    unit: 'Cr'
  });

  // Gross Profit = 8.42 - 2.66 = 5.76
  assert(result.raw.grossProfit === 5.76, 'Gross Profit is exactly 5.76 Cr');
  assert(result.formatted.grossProfit === '₹5.76 Cr', 'Formatted Gross Profit is ₹5.76 Cr');

  // Gross Margin = (5.76 / 8.42) * 100 = 68.40855... -> 68.4%
  assert(Math.abs(result.raw.grossMarginPercent - 68.41) < 0.01, 'Gross Margin % is ~68.41% raw');
  assert(result.rounded.grossMarginPercent === 68.4, 'Rounded Gross Margin % is 68.4%');
  assert(result.formatted.grossMargin === '68.4%', 'Formatted Gross Margin is 68.4%');

  // Gross Profit per Hub = 5.76 / 48 = 0.12
  assert(result.raw.grossProfitPerHub === 0.12, 'Gross Profit per Hub is exactly 0.12 Cr');
  assert(result.formatted.grossProfitPerHub === '₹0.12 Cr', 'Formatted Gross Profit per Hub is ₹0.12 Cr');
}

// 2. Arithmetic Accuracy
console.log('\n2. Arithmetic Accuracy with floating point edge cases:');
{
  // 0.1 + 0.2 floating point anomaly prevention
  const res = calculateGrossMetrics({ revenue: 0.3, cogs: 0.2, hubs: 1 });
  assert(res.raw.grossProfit === 0.1, '0.3 - 0.2 yields exact 0.1 without floating point tail');
  assert(res.rounded.grossProfit === 0.1, 'Rounded gross profit is 0.10');
}

// 3. Currency Units and Formatting
console.log('\n3. Currency Units & Formatting:');
{
  const inDollars = calculateGrossMetrics({ revenue: 100, cogs: 40, hubs: 10, currencySymbol: '$', unit: 'M' });
  assert(inDollars.formatted.grossProfit === '$60.00 M', 'Supports dollar currency symbol and M unit');

  const inLakhs = calculateGrossMetrics({ revenue: 450, cogs: 150, hubs: 3, currencySymbol: '₹', unit: 'Lakhs' });
  assert(inLakhs.formatted.grossProfit === '₹300.00 Lakhs', 'Supports Lakhs unit');
  assert(inLakhs.formatted.grossProfitPerHub === '₹100.00 Lakhs', 'Supports Lakhs per hub');
}

// 4. Percentage Calculations
console.log('\n4. Percentage Calculations:');
{
  // 50% margin
  const res50 = calculateGrossMetrics({ revenue: 200, cogs: 100, hubs: 2 });
  assert(res50.rounded.grossMarginPercent === 50.0, 'Calculates exactly 50.0% margin');
  assert(res50.formatted.grossMargin === '50.0%', 'Formats 50.0% properly');

  // 100% margin (zero COGS)
  const res100 = calculateGrossMetrics({ revenue: 50, cogs: 0, hubs: 5 });
  assert(res100.rounded.grossMarginPercent === 100.0, 'Calculates 100.0% margin when COGS = 0');
}

// 5. Division by Zero Protection
console.log('\n5. Division by Zero Protection:');
{
  // Revenue = 0: margin should be 0%, not NaN or Infinity
  const resZeroRev = calculateGrossMetrics({ revenue: 0, cogs: 0, hubs: 10 });
  assert(resZeroRev.status.isRevenueZero === true, 'Flags revenue as zero');
  assert(resZeroRev.raw.grossMarginPercent === 0, 'Gross margin percent is 0 when revenue is 0');
  assert(resZeroRev.formatted.grossMargin === '0.0%', 'Formatted margin is 0.0% when revenue is 0');

  // Hubs = 0: profit per hub should be 0, not Infinity
  const resZeroHubs = calculateGrossMetrics({ revenue: 10, cogs: 4, hubs: 0 });
  assert(resZeroHubs.status.isHubsZero === true, 'Flags hubs as zero');
  assert(resZeroHubs.raw.grossProfitPerHub === 0, 'Gross profit per hub is 0 when hubs is 0');
  assert(resZeroHubs.formatted.grossProfitPerHub === '₹0.00 Cr', 'Formatted profit per hub handles zero hubs');

  // Negative hubs
  const resNegHubs = calculateGrossMetrics({ revenue: 10, cogs: 4, hubs: -5 });
  assert(resNegHubs.status.isHubsZero === true, 'Flags negative hubs as invalid');
  assert(resNegHubs.raw.grossProfitPerHub === 0, 'Gross profit per hub is 0 when hubs < 0');
}

// 6. Missing / Malformed Data
console.log('\n6. Missing & Malformed Data Handling:');
{
  const missingInputs = calculateGrossMetrics({});
  assert(missingInputs.status.isValid === false, 'Flags missing inputs');
  assert(missingInputs.status.missingFields.length === 3, 'Reports 3 missing fields');
  assert(missingInputs.raw.grossProfit === 0, 'Safe default 0 for gross profit');

  const stringInputs = calculateGrossMetrics({ revenue: '₹8.42 Cr', cogs: '₹2.66 Cr', hubs: '48 hubs' });
  assert(stringInputs.raw.grossProfit === 5.76, 'Parses string numbers with currency/unit symbols');
  assert(stringInputs.rounded.grossProfitPerHub === 0.12, 'Calculates correctly from string inputs');

  const nullInputs = calculateGrossMetrics({ revenue: null, cogs: undefined, hubs: 'abc' });
  assert(nullInputs.raw.grossProfit === 0, 'Handles null and undefined safely');
}

// 7. Negative Values (Operational Loss)
console.log('\n7. Negative Values (Operational Loss):');
{
  // COGS > Revenue (e.g. 5 Cr revenue, 8 Cr COGS = -3 Cr gross profit)
  const loss = calculateGrossMetrics({ revenue: 5.0, cogs: 8.0, hubs: 10 });
  assert(loss.status.isNegativeProfit === true, 'Flags negative profit');
  assert(loss.raw.grossProfit === -3.0, 'Gross profit is -3.0');
  assert(loss.formatted.grossProfit === '-₹3.00 Cr', 'Formatted negative gross profit shows -₹3.00 Cr');
  assert(loss.rounded.grossMarginPercent === -60.0, 'Gross margin is -60.0%');
  assert(loss.formatted.grossMargin === '-60.0%', 'Formatted negative gross margin shows -60.0%');
  assert(loss.formatted.grossProfitPerHub === '-₹0.30 Cr', 'Gross profit per hub is -₹0.30 Cr');
}

// 8. Rounding Precision
console.log('\n8. Rounding Precision:');
{
  // 1/3 division
  const third = calculateGrossMetrics({ revenue: 3, cogs: 2, hubs: 3 });
  assert(third.rounded.grossProfit === 1.0, '1.0 gross profit');
  assert(third.rounded.grossMarginPercent === 33.3, 'Rounded margin is 33.3%');
  assert(third.rounded.grossProfitPerHub === 0.33, 'Rounded per hub is 0.33');
}

// 9. Large Values
console.log('\n9. Large Values (High Enterprise Scale):');
{
  const enterprise = calculateGrossMetrics({ revenue: 45000.75, cogs: 18200.25, hubs: 1250 });
  assert(enterprise.raw.grossProfit === 26800.5, 'Large crore calculations remain accurate');
  assert(enterprise.formatted.grossProfit === '₹26800.50 Cr', 'Formatted large value properly');
  assert(enterprise.rounded.grossProfitPerHub === 21.44, 'Calculates per hub for large franchise networks');
}

console.log(`\n========================================`);
console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions)`);
console.log(`========================================\n`);
