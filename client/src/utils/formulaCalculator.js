/**
 * Formula Calculator Utility for Financial & Operational Metrics
 * Programmatic calculation engine with input validation, edge-case safety,
 * arithmetic accuracy, currency formatting, and error boundary handling.
 */

/**
 * Safely parse a numeric value from number, string, or null/undefined
 * @param {any} value 
 * @param {number} fallback 
 * @returns {number}
 */
export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return isNaN(value) || !isFinite(value) ? fallback : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Precise rounding helper to avoid JavaScript floating point artifacts
 * @param {number} num 
 * @param {number} decimals 
 * @returns {number}
 */
export function roundTo(num, decimals = 2) {
  if (!isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Format currency with unit (e.g., "₹5.76 Cr" or "-₹0.50 Cr")
 * @param {number} val 
 * @param {string} symbol 
 * @param {string} unit 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatCurrencyValue(val, symbol = '₹', unit = 'Cr', decimals = 2) {
  if (!isFinite(val)) return '—';
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formattedNum = absVal.toFixed(decimals);
  const prefix = isNegative ? `-${symbol}` : symbol;
  return unit ? `${prefix}${formattedNum} ${unit}` : `${prefix}${formattedNum}`;
}

/**
 * Format percentage (e.g., "68.4%" or "-12.5%")
 * @param {number} val 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatPercentageValue(val, decimals = 1) {
  if (!isFinite(val)) return '0.0%';
  return `${val.toFixed(decimals)}%`;
}

/**
 * Programmatic Calculation of Gross Profit, Gross Margin, and Gross Profit Per Hub
 * Formula definitions:
 * - Gross Profit = Revenue - COGS
 * - Gross Margin (%) = (Gross Profit / Revenue) * 100
 * - Gross Profit Per Hub = Gross Profit / Active Hubs
 *
 * @param {object} params
 * @param {number|string} params.revenue Invoiced Revenue (e.g., 8.42)
 * @param {number|string} params.cogs Cost of Goods Sold / Supply Chain COGS (e.g., 2.66)
 * @param {number|string} params.hubs Number of active hubs/branches (e.g., 48)
 * @param {string} [params.currencySymbol='₹']
 * @param {string} [params.unit='Cr']
 * @returns {object} Calculated metrics, raw numbers, and formatted output strings
 */
export function calculateGrossMetrics({
  revenue,
  cogs,
  hubs,
  currencySymbol = '₹',
  unit = 'Cr'
} = {}) {
  // Input validation
  const isRevenueProvided = revenue !== undefined && revenue !== null && revenue !== '';
  const isCogsProvided = cogs !== undefined && cogs !== null && cogs !== '';
  const isHubsProvided = hubs !== undefined && hubs !== null && hubs !== '';

  const missingFields = [];
  if (!isRevenueProvided) missingFields.push('revenue');
  if (!isCogsProvided) missingFields.push('cogs');
  if (!isHubsProvided) missingFields.push('hubs');

  const rev = safeNumber(revenue, 0);
  const cost = safeNumber(cogs, 0);
  const hubCount = safeNumber(hubs, 0);

  // 1. Gross Profit = Revenue - COGS
  const rawGrossProfit = rev - cost;
  const grossProfit = roundTo(rawGrossProfit, 4);

  // 2. Gross Margin % = (Gross Profit / Revenue) * 100
  // Guard against division by zero when revenue is 0
  let grossMarginPercent = 0;
  let isRevenueZero = false;
  if (rev === 0) {
    isRevenueZero = true;
    grossMarginPercent = 0;
  } else {
    grossMarginPercent = roundTo((grossProfit / rev) * 100, 2);
  }

  // 3. Gross Profit Per Hub = Gross Profit / Hubs
  // Guard against division by zero when hubs <= 0
  let grossProfitPerHub = 0;
  let isHubsZero = false;
  if (hubCount <= 0) {
    isHubsZero = true;
    grossProfitPerHub = 0;
  } else {
    grossProfitPerHub = roundTo(grossProfit / hubCount, 4);
  }

  return {
    inputs: {
      revenue: rev,
      cogs: cost,
      hubs: hubCount,
      currencySymbol,
      unit
    },
    raw: {
      grossProfit,
      grossMarginPercent,
      grossProfitPerHub
    },
    rounded: {
      grossProfit: roundTo(grossProfit, 2),
      grossMarginPercent: roundTo(grossMarginPercent, 1),
      grossProfitPerHub: roundTo(grossProfitPerHub, 2)
    },
    formatted: {
      revenue: formatCurrencyValue(rev, currencySymbol, unit, 2),
      cogs: formatCurrencyValue(cost, currencySymbol, unit, 2),
      hubs: `${Math.round(hubCount)}`,
      grossProfit: formatCurrencyValue(roundTo(grossProfit, 2), currencySymbol, unit, 2),
      grossMargin: formatPercentageValue(roundTo(grossMarginPercent, 1), 1),
      grossProfitPerHub: formatCurrencyValue(roundTo(grossProfitPerHub, 2), currencySymbol, unit, 2)
    },
    status: {
      isValid: missingFields.length === 0,
      missingFields,
      isRevenueZero,
      isHubsZero,
      isNegativeProfit: grossProfit < 0
    }
  };
}

/**
 * Standard default illustrative demo calculation
 * Revenue: ₹8.42 Cr, COGS: ₹2.66 Cr, Hubs: 48
 * Expected:
 * - Gross Profit: ₹5.76 Cr (8.42 - 2.66)
 * - Gross Margin: 68.4% (5.76 / 8.42 * 100 = 68.4085%)
 * - Gross Profit Per Hub: ₹0.12 Cr (5.76 / 48 = 0.12)
 */
export const DEFAULT_ILLUSTRATIVE_METRICS = calculateGrossMetrics({
  revenue: 8.42,
  cogs: 2.66,
  hubs: 48,
  currencySymbol: '₹',
  unit: 'Cr'
});
