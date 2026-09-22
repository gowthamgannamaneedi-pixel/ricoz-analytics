const path = require('path');
const storage = require('../storage');
const { parseDatasetFile } = require('./fileParserService');

/**
 * Analytics Engine Service
 * Provides server-side dataset ingestion, dimension detection, dynamic filtering,
 * aggregation (SUM, AVG, COUNT, MIN, MAX), time-series trends, and categorical breakdowns.
 */

/**
 * Load and parse entire dataset records from storage
 * @param {string} filePath 
 * @returns {Promise<any[]>}
 */
async function loadDatasetRecords(filePath) {
  if (!filePath) {
    throw new Error('Dataset has no attached file.');
  }

  const exists = await storage.exists(filePath);
  if (!exists) {
    throw new Error('Dataset file does not exist on storage.');
  }

  const buffer = await storage.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  // Request all rows for server-side aggregation
  const parsed = parseDatasetFile(buffer, ext, 1000000);
  return parsed.preview || [];
}

/**
 * Automatically inspect schema and classify columns into semantic roles
 * @param {Array<{ name: string, type: string }>} schema 
 * @param {any[]} [sampleRecords=[]]
 */
function detectDatasetDimensions(schema = [], sampleRecords = []) {
  const result = {
    dateColumn: null,
    primaryMetric: null,
    quantityMetric: null,
    orderIdColumn: null,
    regionColumn: null,
    productColumn: null,
    categoryColumn: null,
    channelColumn: null,
    numericColumns: [],
    categoricalColumns: [],
    dateColumns: []
  };

  if (!schema || schema.length === 0) return result;

  // Identify column types
  schema.forEach(col => {
    const colName = col.name.toLowerCase();
    const type = col.type;

    if (type === 'date' || colName.includes('date') || colName.includes('time') || colName === 'created_at') {
      result.dateColumns.push(col.name);
      if (!result.dateColumn) result.dateColumn = col.name;
    } else if (type === 'number') {
      result.numericColumns.push(col.name);
    } else if (type === 'string') {
      result.categoricalColumns.push(col.name);
    }
  });

  // 1. Primary Metric Detection (e.g. total, sales_amount, revenue, amount, price, profit)
  const primaryCandidates = ['total', 'sales_amount', 'revenue', 'amount', 'sales', 'profit', 'price', 'value'];
  for (const candidate of primaryCandidates) {
    const match = result.numericColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match) {
      result.primaryMetric = match;
      break;
    }
  }
  if (!result.primaryMetric && result.numericColumns.length > 0) {
    result.primaryMetric = result.numericColumns[0];
  }

  // 2. Quantity / Units Metric Detection
  const qtyCandidates = ['quantity', 'units_sold', 'units', 'qty', 'count', 'items'];
  for (const candidate of qtyCandidates) {
    const match = result.numericColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match && match !== result.primaryMetric) {
      result.quantityMetric = match;
      break;
    }
  }

  // 3. Order ID Column
  const idCandidates = ['order_id', 'id', 'transaction_id', 'invoice_id', 'order_number'];
  for (const candidate of idCandidates) {
    const match = schema.find(c => c.name.toLowerCase() === candidate || c.name.toLowerCase().includes(candidate));
    if (match) {
      result.orderIdColumn = match.name;
      break;
    }
  }

  // 4. Region Column
  const regionCandidates = ['region', 'hub', 'location', 'city', 'state', 'territory', 'country', 'zone'];
  for (const candidate of regionCandidates) {
    const match = result.categoricalColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match) {
      result.regionColumn = match;
      break;
    }
  }

  // 5. Product Column
  const productCandidates = ['product', 'item', 'product_name', 'sku', 'service'];
  for (const candidate of productCandidates) {
    const match = result.categoricalColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match) {
      result.productColumn = match;
      break;
    }
  }

  // 6. Category Column
  const catCandidates = ['category', 'segment', 'department', 'group', 'class'];
  for (const candidate of catCandidates) {
    const match = result.categoricalColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match && match !== result.productColumn) {
      result.categoryColumn = match;
      break;
    }
  }

  // 7. Channel Column
  const channelCandidates = ['channel', 'sales_channel', 'source', 'platform', 'medium', 'type'];
  for (const candidate of channelCandidates) {
    const match = result.categoricalColumns.find(c => c.toLowerCase() === candidate || c.toLowerCase().includes(candidate));
    if (match && match !== result.categoryColumn && match !== result.productColumn) {
      result.channelColumn = match;
      break;
    }
  }

  return result;
}

/**
 * Filter dataset records based on multi-parameter query filters
 * @param {any[]} records 
 * @param {object} filters 
 * @param {object} dimensions 
 * @returns {any[]}
 */
function applyDatasetFilters(records = [], filters = {}, dimensions = {}) {
  let filtered = [...records];

  // 1. Date Range Filter
  if (dimensions.dateColumn && (filters.startDate || filters.endDate || filters.dateRange)) {
    const dateCol = dimensions.dateColumn;

    let startDate = filters.startDate ? new Date(filters.startDate) : null;
    let endDate = filters.endDate ? new Date(filters.endDate) : null;

    // Handle relative presets if explicit dates are not provided
    if (filters.dateRange && (!startDate || !endDate)) {
      // If dataset dates exist, use dataset max date as reference point
      const allDates = records.map(r => new Date(r[dateCol])).filter(d => !isNaN(d.getTime())).sort((a, b) => b - a);
      const referenceDate = allDates.length > 0 ? allDates[0] : new Date();

      if (filters.dateRange === '7d') {
        startDate = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = referenceDate;
      } else if (filters.dateRange === '30d') {
        startDate = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = referenceDate;
      } else if (filters.dateRange === '90d') {
        startDate = new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = referenceDate;
      } else if (filters.dateRange === 'ytd') {
        startDate = new Date(referenceDate.getFullYear(), 0, 1);
        endDate = referenceDate;
      }
    }

    if (startDate && !isNaN(startDate.getTime())) {
      filtered = filtered.filter(r => {
        const d = new Date(r[dateCol]);
        return !isNaN(d.getTime()) && d >= startDate;
      });
    }

    if (endDate && !isNaN(endDate.getTime())) {
      // Include whole end date (23:59:59)
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const d = new Date(r[dateCol]);
        return !isNaN(d.getTime()) && d <= endOfDay;
      });
    }
  }

  // 2. Exact match dimension filters (e.g. region, category, product, channel)
  const reservedParams = new Set([
    'startDate', 'endDate', 'dateRange', 'search', 'page', 'limit', 'sortKey', 'sortOrder', 'groupBy'
  ]);
  const filterKeys = Object.keys(filters).filter(k => !reservedParams.has(k));

  for (const key of filterKeys) {
    const val = filters[key];
    if (val && val !== 'all' && val !== 'ALL') {
      filtered = filtered.filter(r => {
        // Case-insensitive comparison
        const rowVal = r[key] !== undefined ? String(r[key]).toLowerCase() : '';
        return rowVal === String(val).toLowerCase();
      });
    }
  }

  // 3. Global Text Search Filter
  if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(r => 
      Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );
  }

  return filtered;
}

/**
 * Compute dynamic KPIs, statistics, and period-over-period comparisons
 * @param {any[]} allRecords 
 * @param {any[]} filteredRecords 
 * @param {object} dimensions 
 * @returns {object}
 */
function computeDatasetKpis(allRecords = [], filteredRecords = [], dimensions = {}) {
  const primaryCol = dimensions.primaryMetric;
  const qtyCol = dimensions.quantityMetric;
  const idCol = dimensions.orderIdColumn;
  const dateCol = dimensions.dateColumn;

  const totalRecordsCount = filteredRecords.length;

  if (totalRecordsCount === 0 || !primaryCol) {
    return {
      totalSales: 0,
      totalOrders: 0,
      totalQuantity: 0,
      averageOrderValue: 0,
      minSales: 0,
      maxSales: 0,
      comparison: null,
      primaryMetricName: primaryCol || 'Metric',
      hasNumericMetrics: Boolean(primaryCol)
    };
  }

  // 1. Primary Metric Aggregations
  let sumPrimary = 0;
  let minPrimary = Infinity;
  let maxPrimary = -Infinity;
  let validPrimaryCount = 0;

  for (const r of filteredRecords) {
    const val = Number(r[primaryCol]);
    if (!isNaN(val)) {
      sumPrimary += val;
      validPrimaryCount++;
      if (val < minPrimary) minPrimary = val;
      if (val > maxPrimary) maxPrimary = val;
    }
  }

  if (minPrimary === Infinity) minPrimary = 0;
  if (maxPrimary === -Infinity) maxPrimary = 0;

  const avgPrimary = validPrimaryCount > 0 ? (sumPrimary / validPrimaryCount) : 0;

  // 2. Orders Count (Distinct order_id if present, else row count)
  let totalOrders = totalRecordsCount;
  if (idCol) {
    const uniqueIds = new Set(filteredRecords.map(r => r[idCol]).filter(v => v !== undefined && v !== null));
    if (uniqueIds.size > 0) {
      totalOrders = uniqueIds.size;
    }
  }

  // 3. Quantity / Units Sum
  let totalQuantity = 0;
  if (qtyCol) {
    for (const r of filteredRecords) {
      const q = Number(r[qtyCol]);
      if (!isNaN(q)) {
        totalQuantity += q;
      }
    }
  } else {
    totalQuantity = totalOrders;
  }

  // 4. Average Order Value (AOV = sumPrimary / totalOrders)
  const averageOrderValue = totalOrders > 0 ? (sumPrimary / totalOrders) : avgPrimary;

  // 5. Period Comparison Calculation (Current Period vs Previous Period)
  let comparison = null;
  if (dateCol && filteredRecords.length >= 2) {
    const validDateRecords = filteredRecords
      .map(r => ({ ...r, _date: new Date(r[dateCol]) }))
      .filter(r => !isNaN(r._date.getTime()))
      .sort((a, b) => a._date - b._date);

    if (validDateRecords.length >= 2) {
      const minDate = validDateRecords[0]._date.getTime();
      const maxDate = validDateRecords[validDateRecords.length - 1]._date.getTime();
      const midPoint = minDate + (maxDate - minDate) / 2;

      const previousPeriodRecords = validDateRecords.filter(r => r._date.getTime() < midPoint);
      const currentPeriodRecords = validDateRecords.filter(r => r._date.getTime() >= midPoint);

      if (previousPeriodRecords.length > 0 && currentPeriodRecords.length > 0) {
        const prevSum = previousPeriodRecords.reduce((sum, r) => sum + (Number(r[primaryCol]) || 0), 0);
        const currSum = currentPeriodRecords.reduce((sum, r) => sum + (Number(r[primaryCol]) || 0), 0);

        const prevOrders = previousPeriodRecords.length;
        const currOrders = currentPeriodRecords.length;

        const salesChangePct = prevSum > 0 ? ((currSum - prevSum) / prevSum) * 100 : 0;
        const ordersChangePct = prevOrders > 0 ? ((currOrders - prevOrders) / prevOrders) * 100 : 0;

        comparison = {
          hasComparison: true,
          salesChange: `${salesChangePct >= 0 ? '+' : ''}${salesChangePct.toFixed(1)}%`,
          isSalesPositive: salesChangePct >= 0,
          ordersChange: `${ordersChangePct >= 0 ? '+' : ''}${ordersChangePct.toFixed(1)}%`,
          isOrdersPositive: ordersChangePct >= 0,
          periodLabel: 'vs previous period'
        };
      }
    }
  }

  return {
    totalSales: Number(sumPrimary.toFixed(2)),
    totalOrders,
    totalQuantity,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    minSales: Number(minPrimary.toFixed(2)),
    maxSales: Number(maxPrimary.toFixed(2)),
    recordCount: totalRecordsCount,
    primaryMetricName: primaryCol,
    quantityMetricName: qtyCol || 'Units',
    comparison
  };
}

/**
 * Generate time-series trend data grouped by date/month
 * @param {any[]} filteredRecords 
 * @param {object} dimensions 
 * @returns {any[]}
 */
function computeDatasetTrends(filteredRecords = [], dimensions = {}) {
  const dateCol = dimensions.dateColumn;
  const primaryCol = dimensions.primaryMetric;

  if (!dateCol || !primaryCol || filteredRecords.length === 0) {
    return [];
  }

  const dateMap = new Map();

  filteredRecords.forEach(r => {
    const rawDate = r[dateCol];
    if (!rawDate) return;

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) return;

    // Standard ISO Date Key: YYYY-MM-DD
    const dateKey = parsedDate.toISOString().split('T')[0];
    const val = Number(r[primaryCol]) || 0;

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        date: dateKey,
        revenue: 0,
        orders: 0,
        rawTimestamp: parsedDate.getTime()
      });
    }

    const entry = dateMap.get(dateKey);
    entry.revenue += val;
    entry.orders += 1;
  });

  const sortedTrends = Array.from(dateMap.values()).sort((a, b) => a.rawTimestamp - b.rawTimestamp);

  // Compute baseline benchmark target (e.g. running average or 105% baseline for trendline)
  if (sortedTrends.length > 0) {
    const avgRevenue = sortedTrends.reduce((sum, t) => sum + t.revenue, 0) / sortedTrends.length;
    sortedTrends.forEach(t => {
      t.revenue = Number(t.revenue.toFixed(2));
      t.target = Number((avgRevenue * 0.95).toFixed(2));
      t.formattedDate = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }

  return sortedTrends;
}

/**
 * Generate categorical breakdown for specified column
 * @param {any[]} filteredRecords 
 * @param {string} groupByCol 
 * @param {object} dimensions 
 * @returns {any[]}
 */
function computeDatasetBreakdown(filteredRecords = [], groupByCol, dimensions = {}) {
  const primaryCol = dimensions.primaryMetric;
  if (!groupByCol || !primaryCol || filteredRecords.length === 0) {
    return [];
  }

  const groupMap = new Map();
  let grandTotal = 0;

  filteredRecords.forEach(r => {
    const category = r[groupByCol] !== undefined && r[groupByCol] !== null && String(r[groupByCol]).trim() !== ''
      ? String(r[groupByCol]).trim()
      : 'Uncategorized';

    const val = Number(r[primaryCol]) || 0;
    grandTotal += val;

    if (!groupMap.has(category)) {
      groupMap.set(category, {
        category,
        value: 0,
        orders: 0
      });
    }

    const entry = groupMap.get(category);
    entry.value += val;
    entry.orders += 1;
  });

  const result = Array.from(groupMap.values())
    .map(g => ({
      name: g.category,
      category: g.category,
      value: Number(g.value.toFixed(2)),
      orders: g.orders,
      percentage: grandTotal > 0 ? Number(((g.value / grandTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.value - a.value);

  return result;
}

/**
 * Return paginated, sorted, and searchable rows for data table
 * @param {any[]} filteredRecords 
 * @param {object} queryOptions 
 * @returns {{ rows: any[], totalCount: number, page: number, limit: number, totalPages: number }}
 */
function getPaginatedDatasetRows(filteredRecords = [], queryOptions = {}) {
  const page = Math.max(1, Number(queryOptions.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryOptions.limit) || 20));
  const sortKey = queryOptions.sortKey;
  const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase();

  let rows = [...filteredRecords];

  if (sortKey) {
    rows.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
  }

  const totalCount = rows.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedRows = rows.slice(startIndex, startIndex + limit);

  return {
    rows: paginatedRows,
    totalCount,
    page,
    limit,
    totalPages
  };
}

/**
 * Get distinct values for all categorical dimensions and date boundaries
 * @param {any[]} records 
 * @param {object} dimensions 
 * @returns {object}
 */
function getDatasetFilterOptions(records = [], dimensions = {}) {
  const filterOptions = {
    regions: [],
    categories: [],
    products: [],
    channels: [],
    dateBounds: { min: null, max: null }
  };

  if (records.length === 0) return filterOptions;

  // Extract distinct values
  if (dimensions.regionColumn) {
    const set = new Set(records.map(r => r[dimensions.regionColumn]).filter(Boolean));
    filterOptions.regions = Array.from(set).sort();
  }

  if (dimensions.categoryColumn) {
    const set = new Set(records.map(r => r[dimensions.categoryColumn]).filter(Boolean));
    filterOptions.categories = Array.from(set).sort();
  }

  if (dimensions.productColumn) {
    const set = new Set(records.map(r => r[dimensions.productColumn]).filter(Boolean));
    filterOptions.products = Array.from(set).sort();
  }

  if (dimensions.channelColumn) {
    const set = new Set(records.map(r => r[dimensions.channelColumn]).filter(Boolean));
    filterOptions.channels = Array.from(set).sort();
  }

  if (dimensions.dateColumn) {
    const dates = records
      .map(r => new Date(r[dimensions.dateColumn]))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a - b);

    if (dates.length > 0) {
      filterOptions.dateBounds.min = dates[0].toISOString().split('T')[0];
      filterOptions.dateBounds.max = dates[dates.length - 1].toISOString().split('T')[0];
    }
  }

  return filterOptions;
}

module.exports = {
  loadDatasetRecords,
  detectDatasetDimensions,
  applyDatasetFilters,
  computeDatasetKpis,
  computeDatasetTrends,
  computeDatasetBreakdown,
  getPaginatedDatasetRows,
  getDatasetFilterOptions
};
