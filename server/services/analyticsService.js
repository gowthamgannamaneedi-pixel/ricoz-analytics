const fs = require('fs');
const path = require('path');
const readline = require('readline');
const db = require('../config/database');
const storage = require('../storage');
const { parseDatasetFile, parseCsvLine, detectDelimiter, parseDatasetPreviewStream } = require('./fileParserService');

/**
 * Analytics Engine Service
 * Provides server-side dataset ingestion, dimension detection, dynamic filtering,
 * aggregation (SUM, AVG, COUNT, MIN, MAX), time-series trends, and categorical breakdowns.
 * 
 * Supports two ultra-efficient execution tiers:
 * 1. PostgreSQL DB-backed relational queries (via indexed dataset_rows table)
 * 2. High-throughput single-pass streaming file aggregator (constant <150MB memory footprint for 1M+ rows)
 */

/**
 * Load and parse dataset records from storage with database fallback (PostgreSQL dataset_rows)
 */
// In-memory cache for parsed dataset records to eliminate duplicate disk reads & CSV parsing
const parsedDatasetCache = new Map();
const datasetFlightPromises = new Map();
const PARSED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function getParsedCacheKey(datasetOrPathOrId) {
  if (!datasetOrPathOrId) return null;
  if (typeof datasetOrPathOrId === 'object') {
    if (datasetOrPathOrId.id) return `id:${datasetOrPathOrId.id}`;
    if (datasetOrPathOrId.file_path) return `path:${datasetOrPathOrId.file_path}`;
    if (datasetOrPathOrId.filePath) return `path:${datasetOrPathOrId.filePath}`;
    return JSON.stringify(datasetOrPathOrId);
  }
  return String(datasetOrPathOrId);
}

function invalidateParsedDatasetCache(identifier = null) {
  if (!identifier) {
    parsedDatasetCache.clear();
    datasetFlightPromises.clear();
    return;
  }
  const key = getParsedCacheKey(identifier);
  if (key) {
    parsedDatasetCache.delete(key);
    datasetFlightPromises.delete(key);
  }
}

/**
 * Loads parsed records for a dataset
 * Accepts: filePath string, dataset object, or dataset ID
 * @param {string|object|number} datasetOrPathOrId 
 * @param {number} [maxRows=1000000]
 * @returns {Promise<any[]>}
 */
async function loadDatasetRecords(datasetOrPathOrId, maxRows = 1000000) {
  if (!datasetOrPathOrId) {
    throw new Error('Dataset parameter is required to load records.');
  }

  const primaryKey = getParsedCacheKey(datasetOrPathOrId);

  // 1. Check in-memory parsed cache
  if (primaryKey && parsedDatasetCache.has(primaryKey)) {
    const entry = parsedDatasetCache.get(primaryKey);
    if (entry && entry.expiresAt > Date.now()) {
      const records = entry.records;
      return maxRows >= records.length ? records : records.slice(0, maxRows);
    } else {
      parsedDatasetCache.delete(primaryKey);
    }
  }

  // 2. Coalesce concurrent in-flight loading promises for identical dataset
  if (primaryKey && datasetFlightPromises.has(primaryKey)) {
    const records = await datasetFlightPromises.get(primaryKey);
    return maxRows >= records.length ? records : records.slice(0, maxRows);
  }

  const loadPromise = (async () => {
    let filePath = null;
    let datasetId = null;
    let datasetName = null;

    if (typeof datasetOrPathOrId === 'object' && datasetOrPathOrId !== null) {
      filePath = datasetOrPathOrId.file_path || datasetOrPathOrId.filePath || null;
      datasetId = datasetOrPathOrId.id || null;
      datasetName = datasetOrPathOrId.name || null;
    } else if (typeof datasetOrPathOrId === 'string' && (datasetOrPathOrId.includes('/') || datasetOrPathOrId.includes('\\') || datasetOrPathOrId.includes('.'))) {
      filePath = datasetOrPathOrId;
    } else {
      datasetId = datasetOrPathOrId;
    }

    // If only datasetId is provided, look up dataset metadata
    if (!filePath && datasetId) {
      try {
        const DatasetModel = require('../models/datasetModel');
        const ds = await DatasetModel.findById(datasetId);
        if (ds) {
          filePath = ds.file_path;
          datasetName = ds.name;
        }
      } catch (_) {}
    }

    // 1. If physical absolute file exists on disk
    if (filePath && pathIsAbsolute(filePath) && fs.existsSync(filePath)) {
      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const parsed = await parseDatasetFile(buffer, ext, 1000000);
      return parsed.preview || [];
    }

    // 2. Check storage provider (which checks local cache, PostgreSQL dataset_storage_files, and Supabase)
    if (filePath) {
      try {
        const exists = await storage.exists(filePath);
        if (exists) {
          const ext = path.extname(filePath).toLowerCase();
          const buffer = await storage.readFile(filePath);
          if (buffer && buffer.length > 0) {
            const parsed = await parseDatasetFile(buffer, ext, 1000000);
            if (parsed && Array.isArray(parsed.preview) && parsed.preview.length > 0) {
              return parsed.preview;
            }
          }
        }
      } catch (storageErr) {
        console.warn(`[loadDatasetRecords] Storage check warning for ${filePath}:`, storageErr.message);
      }
    }

    // 3. Fallback to PostgreSQL dataset_rows table directly
    if (!datasetId && filePath) {
      try {
        const pool = db.getPool();
        if (pool && !db.isUsingFallback()) {
          const cleanKey = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
          const dsRes = await pool.query(
            'SELECT id, name FROM datasets WHERE file_path = $1 OR file_path LIKE $2 LIMIT 1',
            [cleanKey, `%${cleanKey}`]
          );
          if (dsRes.rowCount > 0) {
            datasetId = dsRes.rows[0].id;
            datasetName = dsRes.rows[0].name;
          }
        }
      } catch (_) {}
    }

    if (datasetId) {
      try {
        const pool = db.getPool();
        if (pool && !db.isUsingFallback()) {
          const rowsRes = await pool.query(
            'SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index ASC LIMIT 1000000',
            [datasetId]
          );
          if (rowsRes.rowCount > 0) {
            return rowsRes.rows.map(r => r.data);
          }
        }
      } catch (dbErr) {
        console.warn(`[loadDatasetRecords] DB dataset_rows fallback warning:`, dbErr.message);
      }
    }

    throw new Error('Dataset file does not exist on storage.');
  })();

  if (primaryKey) {
    datasetFlightPromises.set(primaryKey, loadPromise);
  }

  let loadedRecords;
  try {
    loadedRecords = await loadPromise;
  } finally {
    if (primaryKey) {
      datasetFlightPromises.delete(primaryKey);
    }
  }

  // Cache in-memory
  if (primaryKey && Array.isArray(loadedRecords)) {
    parsedDatasetCache.set(primaryKey, {
      records: loadedRecords,
      expiresAt: Date.now() + PARSED_CACHE_TTL_MS
    });
    if (typeof datasetOrPathOrId === 'object' && datasetOrPathOrId.file_path) {
      parsedDatasetCache.set(`path:${datasetOrPathOrId.file_path}`, {
        records: loadedRecords,
        expiresAt: Date.now() + PARSED_CACHE_TTL_MS
      });
    }
  }

  return maxRows >= loadedRecords.length ? loadedRecords : loadedRecords.slice(0, maxRows);
}

function pathIsAbsolute(p) {
  if (typeof p !== 'string') return false;
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
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

    const isNum = type === 'number' || type === 'numeric' || type === 'integer' || type === 'float' || type === 'double' || type === 'decimal';
    if (type === 'date' || colName.includes('date') || colName.includes('time') || colName === 'created_at') {
      result.dateColumns.push(col.name);
      if (!result.dateColumn) result.dateColumn = col.name;
    } else if (isNum) {
      result.numericColumns.push(col.name);
    } else if (type === 'string' || type === 'text') {
      result.categoricalColumns.push(col.name);
    }
  });

  // 1. Primary Metric Detection
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
    const match = result.numericColumns.find(c => {
      const colLower = c.toLowerCase();
      if (candidate === 'count' && colLower.includes('discount')) return false;
      return colLower === candidate || colLower === `total_${candidate}` || colLower.includes(`_${candidate}`) || colLower.includes(`${candidate}_`);
    });
    if (match && match !== result.primaryMetric) {
      result.quantityMetric = match;
      break;
    }
  }

  // 3. Order ID Column
  const idCandidates = ['order_id', 'orderid', 'order_number', 'order_no', 'orderno', 'transaction_id', 'transactionid', 'invoice_id', 'invoice_number', 'invoice_no'];
  for (const candidate of idCandidates) {
    const match = schema.find(c => {
      const colLower = c.name.toLowerCase();
      return colLower === candidate || colLower.replace(/[-_\s]/g, '') === candidate.replace(/[-_\s]/g, '');
    });
    if (match) {
      result.orderIdColumn = match.name;
      break;
    }
  }
  if (!result.orderIdColumn) {
    const exactId = schema.find(c => c.name.toLowerCase() === 'id');
    if (exactId) {
      result.orderIdColumn = exactId.name;
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
 * Filter dataset records based on multi-parameter query filters (in-memory array helper)
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

    if (filters.dateRange && (!startDate || !endDate)) {
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
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const d = new Date(r[dateCol]);
        return !isNaN(d.getTime()) && d <= endOfDay;
      });
    }
  }

  // 2. Exact match dimension filters
  const reservedParams = new Set([
    'startDate', 'endDate', 'dateRange', 'search', 'page', 'limit', 'sortKey', 'sortOrder', 'groupBy', 'filters'
  ]);
  const activeFilters = (filters.filters && typeof filters.filters === 'object') ? { ...filters, ...filters.filters } : filters;
  const filterKeys = Object.keys(activeFilters).filter(k => !reservedParams.has(k));

  for (const key of filterKeys) {
    const val = activeFilters[key];
    if (val && val !== 'all' && val !== 'ALL') {
      filtered = filtered.filter(r => {
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
 * Compute dynamic KPIs, statistics, and period-over-period comparisons (in-memory array helper)
 * @param {any[]} allRecords 
 * @param {any[]} filteredRecords 
 * @param {object} dimensions 
 * @returns {object}
 */
/**
 * Safely resolve column names against record keys and semantic dimension synonyms
 * Prevents metric mismatch (e.g. asking for 'revenue' when dataset column is 'sales_amount')
 */
function resolveColumnKey(sampleRecord, requestedCol, semanticFallback = null) {
  if (!sampleRecord || typeof sampleRecord !== 'object') return requestedCol || semanticFallback;
  const keys = Object.keys(sampleRecord);
  if (!requestedCol) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    return null;
  }

  // 1. Exact match
  if (sampleRecord[requestedCol] !== undefined) return requestedCol;

  // 2. Case-insensitive match
  const lowerReq = String(requestedCol).toLowerCase().trim();
  const caseMatch = keys.find(k => k.toLowerCase().trim() === lowerReq);
  if (caseMatch) return caseMatch;

  // 3. Normalized / underscore / hyphen match (e.g. salesAmount vs sales_amount vs sales-amount)
  const normReq = lowerReq.replace(/[\s_-]+/g, '');
  const normMatch = keys.find(k => k.toLowerCase().replace(/[\s_-]+/g, '') === normReq);
  if (normMatch) return normMatch;

  // 4. Semantic synonyms for common financial / analytical metrics
  if (['revenue', 'sales', 'amount', 'total', 'metric', 'turnover', 'sales_amount', 'salesamount'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['sales_amount', 'revenue', 'amount', 'sales', 'total_amount', 'net_sales', 'gross_sales', 'profit', 'price', 'value'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m && !isNaN(Number(sampleRecord[m]))) return m;
    }
  }

  // 5. Semantic synonyms for common geographical / regional dimensions
  if (['region', 'state', 'location', 'area', 'territory', 'country', 'city', 'zone', 'province'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['region', 'state', 'city', 'territory', 'location', 'zone', 'country', 'province', 'area'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  // 6. Semantic synonyms for products / categories
  if (['product', 'item', 'product_name', 'sku', 'service'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['product', 'item', 'product_name', 'sku', 'service', 'item_name'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  if (['category', 'segment', 'department', 'group'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['category', 'segment', 'department', 'group', 'class'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  // 7. Semantic synonyms for dates / timestamps
  if (['date', 'order_date', 'orderdate', 'transaction_date', 'timestamp', 'created_at', 'invoice_date', 'time'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['order_date', 'transaction_date', 'invoice_date', 'date', 'created_at', 'timestamp', 'datetime', 'time'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  // 8. Semantic synonyms for quantity / volume
  if (['quantity', 'units_sold', 'units', 'qty', 'count', 'items', 'volume'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['units_sold', 'quantity', 'units', 'qty', 'items', 'volume', 'count'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m && !isNaN(Number(sampleRecord[m]))) return m;
    }
  }

  // 9. Semantic synonyms for channels
  if (['channel', 'sales_channel', 'saleschannel', 'source', 'platform', 'medium'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['channel', 'sales_channel', 'source', 'platform', 'medium', 'distribution_channel'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  // 10. Semantic synonyms for order IDs
  if (['order_id', 'orderid', 'order_no', 'transaction_id', 'invoice_id', 'id'].includes(lowerReq)) {
    if (semanticFallback && sampleRecord[semanticFallback] !== undefined) return semanticFallback;
    const candidates = ['order_id', 'orderid', 'order_no', 'transaction_id', 'invoice_id', 'id'];
    for (const c of candidates) {
      const m = keys.find(k => k.toLowerCase() === c || k.toLowerCase().includes(c));
      if (m) return m;
    }
  }

  return (semanticFallback && sampleRecord[semanticFallback] !== undefined) ? semanticFallback : requestedCol;
}

function computeDatasetKpis(allRecords = [], filteredRecords = [], dimensions = {}) {
  const sample = filteredRecords[0] || allRecords[0];
  const primaryCol = resolveColumnKey(sample, dimensions.primaryMetric, 'sales_amount') || resolveColumnKey(sample, 'revenue');
  const qtyCol = resolveColumnKey(sample, dimensions.quantityMetric, 'units_sold') || resolveColumnKey(sample, 'quantity');
  const idCol = resolveColumnKey(sample, dimensions.orderIdColumn, 'order_id');
  const dateCol = resolveColumnKey(sample, dimensions.dateColumn, 'order_date') || resolveColumnKey(sample, 'date');

  const totalRecordsCount = filteredRecords.length;

  if (totalRecordsCount === 0 || !primaryCol || (sample && sample[primaryCol] === undefined)) {
    return {
      totalSales: 0,
      totalOrders: 0,
      totalQuantity: 0,
      averageOrderValue: 0,
      minSales: 0,
      maxSales: 0,
      recordCount: 0,
      comparison: null,
      primaryMetricName: primaryCol || 'Metric',
      quantityMetricName: qtyCol || 'Units',
      hasNumericMetrics: Boolean(primaryCol)
    };
  }

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

  let totalOrders = totalRecordsCount;
  if (idCol) {
    const uniqueIds = new Set(filteredRecords.map(r => r[idCol]).filter(v => v !== undefined && v !== null && String(v).trim() !== ''));
    if (uniqueIds.size > 0) {
      totalOrders = uniqueIds.size;
    }
  }

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

  const averageOrderValue = totalOrders > 0 ? (sumPrimary / totalOrders) : avgPrimary;

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
 * Generate time-series trend data grouped by date/month (in-memory array helper)
 * @param {any[]} filteredRecords 
 * @param {object} dimensions 
 * @returns {any[]}
 */
function computeDatasetTrends(filteredRecords = [], dimensions = {}) {
  if (!filteredRecords || filteredRecords.length === 0) return [];
  const sample = filteredRecords[0];
  const dateCol = resolveColumnKey(sample, dimensions.dateColumn, dimensions.dateColumn);
  const primaryCol = resolveColumnKey(sample, dimensions.primaryMetric, dimensions.primaryMetric);
  const qtyCol = resolveColumnKey(sample, dimensions.quantityMetric, dimensions.quantityMetric);

  if (!dateCol || !primaryCol || sample[primaryCol] === undefined) {
    return [];
  }

  const dateMap = new Map();

  filteredRecords.forEach(r => {
    const rawDate = r[dateCol];
    if (!rawDate) return;

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) return;

    const dateKey = parsedDate.toISOString().split('T')[0];
    const val = Number(r[primaryCol]) || 0;
    const qty = qtyCol ? (Number(r[qtyCol]) || 0) : 0;

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        date: dateKey,
        revenue: 0,
        orders: 0,
        units: 0,
        rawTimestamp: parsedDate.getTime()
      });
    }

    const entry = dateMap.get(dateKey);
    entry.revenue += val;
    entry.orders += 1;
    entry.units += qty;
  });

  const sortedTrends = Array.from(dateMap.values()).sort((a, b) => a.rawTimestamp - b.rawTimestamp);

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
 * Generate categorical breakdown for specified column (in-memory array helper)
 * @param {any[]} filteredRecords 
 * @param {string} groupByCol 
 * @param {object} dimensions 
 * @returns {any[]}
 */
function computeDatasetBreakdown(filteredRecords = [], groupByCol, dimensions = {}) {
  if (!filteredRecords || filteredRecords.length === 0) {
    return [];
  }

  const sample = filteredRecords[0];
  const actualGroupCol = resolveColumnKey(sample, groupByCol, dimensions.regionColumn || dimensions.categoryColumn || dimensions.productColumn);
  const actualPrimaryCol = resolveColumnKey(sample, dimensions.primaryMetric, dimensions.primaryMetric);

  if (!actualGroupCol || !actualPrimaryCol || sample[actualPrimaryCol] === undefined) {
    return [];
  }

  const groupMap = new Map();
  let grandTotal = 0;

  filteredRecords.forEach(r => {
    const rawCategory = r[actualGroupCol];
    const category = rawCategory !== undefined && rawCategory !== null && String(rawCategory).trim() !== ''
      ? String(rawCategory).trim()
      : 'Uncategorized';

    const val = Number(r[actualPrimaryCol]) || 0;
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
 * Return paginated, sorted, and searchable rows for data table (in-memory array helper)
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
 * Get distinct values for all categorical dimensions and date boundaries (in-memory array helper)
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

// ============================================================================
// ULTRA-SCALABLE STREAMING & POSTGRES ANALYTICS ENGINE (1M+ ROWS / 250MB+)
// ============================================================================

/**
 * Check if dataset rows are present in PostgreSQL dataset_rows table
 */
async function hasPostgresDatasetRows(datasetId) {
  const pool = db.getPool();
  if (db.isUsingFallback() || !pool) return false;
  try {
    const res = await pool.query('SELECT 1 FROM dataset_rows WHERE dataset_id = $1 LIMIT 1', [datasetId]);
    return res.rowCount > 0;
  } catch (_) {
    return false;
  }
}

/**
 * High-performance query for Dataset Summary & Dimensions
 */
async function queryDatasetSummary(dataset, user) {
  const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
  
  // Sample up to 50 rows via stream preview for fast dimension detection without loading file
  let sampleRecords = [];
  if (dataset.file_path) {
    try {
      const ext = path.extname(dataset.file_path).toLowerCase();
      const fileStream = storage.getFileStream(dataset.file_path);
      const parsed = await parseDatasetPreviewStream(fileStream, ext, 50);
      sampleRecords = parsed.preview || [];
    } catch (_) {}
  }

  const dimensions = detectDatasetDimensions(schema, sampleRecords);
  const filterOptions = await queryDatasetFilterOptions(dataset, dimensions, user);

  return {
    dataset: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      rowCount: dataset.row_count || 0,
      columnCount: dataset.column_count || schema.length,
      schema,
      createdAt: dataset.created_at,
      dataSourceName: dataset.data_source_name,
      dataSourceType: dataset.data_source_type
    },
    dimensions,
    filterOptions
  };
}

/**
 * High-performance query for KPIs and period comparison
 */
async function queryDatasetKpis(dataset, filters = {}, user = null) {
  const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
  const dimensions = detectDatasetDimensions(schema);

  if (!dataset.file_path || Number(dataset.row_count) === 0) {
    return {
      kpis: {
        totalSales: 0,
        totalOrders: 0,
        totalQuantity: 0,
        averageOrderValue: 0,
        minSales: 0,
        maxSales: 0,
        recordCount: 0,
        primaryMetricName: dimensions.primaryMetric || 'Metric',
        quantityMetricName: dimensions.quantityMetric || 'Units',
        comparison: null
      },
      dimensions,
      filtersApplied: filters
    };
  }

  // Fast path for small datasets (<= 5000 rows) to preserve legacy test parity and period comparisons
  if (dataset.row_count && dataset.row_count <= 5000) {
    const records = await loadDatasetRecords(dataset);
    const filteredRecords = applyDatasetFilters(records, filters, dimensions);
    const kpis = computeDatasetKpis(records, filteredRecords, dimensions);
    return {
      kpis,
      dimensions,
      filtersApplied: filters
    };
  }

  if (await hasPostgresDatasetRows(dataset.id)) {
    return await queryPostgresKpis(dataset, dimensions, filters, user);
  }

  // Large-scale streaming path: Constant-memory single-pass streaming file aggregation
  const result = await streamAggregateDatasetFile({
    dataset,
    dimensions,
    filters,
    options: { needKpis: true }
  });

  return {
    kpis: result.kpis,
    dimensions,
    filtersApplied: filters
  };
}

/**
 * High-performance query for Trends
 */
async function queryDatasetTrends(dataset, filters = {}, user = null) {
  const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
  const dimensions = detectDatasetDimensions(schema);

  if (!dataset.file_path || Number(dataset.row_count) === 0) {
    return [];
  }

  if (dataset.row_count && dataset.row_count <= 5000) {
    const records = await loadDatasetRecords(dataset);
    const filteredRecords = applyDatasetFilters(records, filters, dimensions);
    return computeDatasetTrends(filteredRecords, dimensions);
  }

  if (await hasPostgresDatasetRows(dataset.id)) {
    return await queryPostgresTrends(dataset, dimensions, filters, user);
  }

  const result = await streamAggregateDatasetFile({
    dataset,
    dimensions,
    filters,
    options: { needTrends: true }
  });

  return result.trends;
}

/**
 * High-performance query for Categorical Breakdowns
 */
async function queryDatasetBreakdowns(dataset, groupByCol, filters = {}, user = null) {
  const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
  const dimensions = detectDatasetDimensions(schema);
  const targetCol = groupByCol || dimensions.regionColumn || dimensions.categoryColumn || dimensions.channelColumn;

  if (!dataset.file_path || Number(dataset.row_count) === 0) {
    return [];
  }

  if (dataset.row_count && dataset.row_count <= 5000) {
    const records = await loadDatasetRecords(dataset);
    const filteredRecords = applyDatasetFilters(records, filters, dimensions);
    return computeDatasetBreakdown(filteredRecords, targetCol, dimensions);
  }

  if (await hasPostgresDatasetRows(dataset.id)) {
    return await queryPostgresBreakdowns(dataset, targetCol, dimensions, filters, user);
  }

  const result = await streamAggregateDatasetFile({
    dataset,
    dimensions,
    filters,
    options: { needBreakdown: true, groupByCol: targetCol }
  });

  return result.breakdowns;
}

/**
 * High-performance query for Paginated Table Rows
 */
async function queryDatasetRows(dataset, queryOptions = {}, user = null) {
  const schema = typeof dataset.schema === 'string' ? JSON.parse(dataset.schema) : (dataset.schema || []);
  const dimensions = detectDatasetDimensions(schema);

  if (!dataset.file_path || Number(dataset.row_count) === 0) {
    const page = Math.max(1, Number(queryOptions.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(queryOptions.limit) || 20));
    return {
      rows: [],
      totalCount: 0,
      page,
      limit,
      totalPages: 1
    };
  }

  if (dataset.row_count && dataset.row_count <= 5000) {
    const records = await loadDatasetRecords(dataset);
    const filteredRecords = applyDatasetFilters(records, queryOptions, dimensions);
    return getPaginatedDatasetRows(filteredRecords, queryOptions);
  }

  if (await hasPostgresDatasetRows(dataset.id)) {
    return await queryPostgresRows(dataset, queryOptions, dimensions, user);
  }

  const result = await streamAggregateDatasetFile({
    dataset,
    dimensions,
    filters: queryOptions,
    options: {
      needRows: true,
      page: Number(queryOptions.page) || 1,
      limit: Number(queryOptions.limit) || 20,
      sortKey: queryOptions.sortKey,
      sortOrder: queryOptions.sortOrder || 'desc'
    }
  });

  return result.rowsData;
}

/**
 * High-performance query for Filter Dropdown Options
 */
async function queryDatasetFilterOptions(dataset, dimensions, user = null) {
  if (!dataset.file_path || Number(dataset.row_count) === 0) {
    return {
      regions: [],
      categories: [],
      products: [],
      channels: [],
      dateBounds: { min: null, max: null }
    };
  }

  if (await hasPostgresDatasetRows(dataset.id)) {
    return await queryPostgresFilterOptions(dataset, dimensions, user);
  }

  const result = await streamAggregateDatasetFile({
    dataset,
    dimensions,
    filters: {},
    options: { needFilterOptions: true }
  });

  return result.filterOptions;
}

// ----------------------------------------------------------------------------
// POSTGRESQL SQL ENGINE (Direct indexed JSONB queries)
// ----------------------------------------------------------------------------

function buildPostgresFilterClauses(datasetId, orgId, filters, dimensions, startParamIdx = 1) {
  const clauses = ['dataset_id = $' + startParamIdx++];
  const params = [datasetId];

  if (orgId) {
    clauses.push(`(organization_id = $${startParamIdx++} OR organization_id IS NULL)`);
    params.push(orgId);
  }

  if (dimensions.dateColumn) {
    const dateCol = dimensions.dateColumn;
    if (filters.startDate) {
      clauses.push(`(data->>'${dateCol}')::date >= $${startParamIdx++}::date`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      clauses.push(`(data->>'${dateCol}')::date <= $${startParamIdx++}::date`);
      params.push(filters.endDate);
    }
  }

  const reserved = new Set(['startDate', 'endDate', 'dateRange', 'search', 'page', 'limit', 'sortKey', 'sortOrder', 'groupBy']);
  for (const [key, val] of Object.entries(filters || {})) {
    if (!reserved.has(key) && val && val !== 'all' && val !== 'ALL') {
      clauses.push(`lower(data->>$${startParamIdx++}) = lower($${startParamIdx++})`);
      params.push(key, String(val));
    }
  }

  if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
    clauses.push(`data::text ILIKE $${startParamIdx++}`);
    params.push(`%${filters.search.trim()}%`);
  }

  return { whereSql: clauses.join(' AND '), params, nextIdx: startParamIdx };
}

async function queryPostgresKpis(dataset, dimensions, filters, user) {
  const orgId = user?.organization_id;
  const primaryCol = dimensions.primaryMetric;
  const qtyCol = dimensions.quantityMetric;
  const idCol = dimensions.orderIdColumn;

  const { whereSql, params } = buildPostgresFilterClauses(dataset.id, orgId, filters, dimensions);

  const sql = `
    SELECT
      COUNT(*) AS total_records,
      ${idCol ? `COUNT(DISTINCT (data->>'${idCol}'))` : `COUNT(*)`} AS total_orders,
      ${primaryCol ? `COALESCE(SUM((data->>'${primaryCol}')::numeric), 0)` : `0`} AS total_sales,
      ${primaryCol ? `COALESCE(AVG((data->>'${primaryCol}')::numeric), 0)` : `0`} AS avg_sales,
      ${primaryCol ? `COALESCE(MIN((data->>'${primaryCol}')::numeric), 0)` : `0`} AS min_sales,
      ${primaryCol ? `COALESCE(MAX((data->>'${primaryCol}')::numeric), 0)` : `0`} AS max_sales,
      ${qtyCol ? `COALESCE(SUM((data->>'${qtyCol}')::numeric), 0)` : `COUNT(*)`} AS total_quantity
    FROM dataset_rows
    WHERE ${whereSql}
  `;

  const pool = db.getPool();
  const res = await pool.query(sql, params);
  const row = res.rows[0] || {};

  const totalSales = Number(parseFloat(row.total_sales || 0).toFixed(2));
  const totalOrders = Number(row.total_orders || 0);
  const avgOrderValue = totalOrders > 0 ? Number((totalSales / totalOrders).toFixed(2)) : Number(parseFloat(row.avg_sales || 0).toFixed(2));

  return {
    kpis: {
      totalSales,
      totalOrders,
      totalQuantity: Number(row.total_quantity || totalOrders),
      averageOrderValue: avgOrderValue,
      minSales: Number(parseFloat(row.min_sales || 0).toFixed(2)),
      maxSales: Number(parseFloat(row.max_sales || 0).toFixed(2)),
      recordCount: Number(row.total_records || 0),
      primaryMetricName: primaryCol,
      quantityMetricName: qtyCol || 'Units',
      comparison: null
    },
    dimensions,
    filtersApplied: filters
  };
}

async function queryPostgresTrends(dataset, dimensions, filters, user) {
  const orgId = user?.organization_id;
  const dateCol = dimensions.dateColumn;
  const primaryCol = dimensions.primaryMetric;
  const qtyCol = dimensions.quantityMetric;

  if (!dateCol || !primaryCol) return [];

  const { whereSql, params } = buildPostgresFilterClauses(dataset.id, orgId, filters, dimensions);

  const sql = `
    SELECT
      (data->>'${dateCol}')::date AS date_key,
      COALESCE(SUM((data->>'${primaryCol}')::numeric), 0) AS revenue,
      COUNT(*) AS orders,
      ${qtyCol ? `COALESCE(SUM((data->>'${qtyCol}')::numeric), 0)` : `COUNT(*)`} AS units
    FROM dataset_rows
    WHERE ${whereSql} AND (data->>'${dateCol}') IS NOT NULL
    GROUP BY 1
    ORDER BY date_key ASC
    LIMIT 365
  `;

  const pool = db.getPool();
  const res = await pool.query(sql, params);

  const trends = res.rows.map(r => {
    const dStr = r.date_key instanceof Date ? r.date_key.toISOString().split('T')[0] : String(r.date_key);
    return {
      date: dStr,
      revenue: Number(parseFloat(r.revenue || 0).toFixed(2)),
      orders: Number(r.orders || 0),
      units: Number(r.units || 0),
      target: 0,
      formattedDate: new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  });

  if (trends.length > 0) {
    const avgRevenue = trends.reduce((sum, t) => sum + t.revenue, 0) / trends.length;
    trends.forEach(t => {
      t.target = Number((avgRevenue * 0.95).toFixed(2));
    });
  }

  return trends;
}

async function queryPostgresBreakdowns(dataset, groupByCol, dimensions, filters, user) {
  const orgId = user?.organization_id;
  const primaryCol = dimensions.primaryMetric;
  if (!groupByCol || !primaryCol) return [];

  const { whereSql, params } = buildPostgresFilterClauses(dataset.id, orgId, filters, dimensions);

  const sql = `
    SELECT
      COALESCE(NULLIF(data->>'${groupByCol}', ''), 'Uncategorized') AS category,
      COALESCE(SUM((data->>'${primaryCol}')::numeric), 0) AS value,
      COUNT(*) AS orders
    FROM dataset_rows
    WHERE ${whereSql}
    GROUP BY 1
    ORDER BY value DESC
    LIMIT 50
  `;

  const pool = db.getPool();
  const res = await pool.query(sql, params);

  let grandTotal = 0;
  const list = res.rows.map(r => {
    const val = Number(parseFloat(r.value || 0).toFixed(2));
    grandTotal += val;
    return {
      name: r.category,
      category: r.category,
      value: val,
      orders: Number(r.orders || 0)
    };
  });

  return list.map(item => ({
    ...item,
    percentage: grandTotal > 0 ? Number(((item.value / grandTotal) * 100).toFixed(1)) : 0
  }));
}

async function queryPostgresRows(dataset, queryOptions, dimensions, user) {
  const orgId = user?.organization_id;
  const page = Math.max(1, Number(queryOptions.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryOptions.limit) || 20));
  const offset = (page - 1) * limit;

  const { whereSql, params, nextIdx } = buildPostgresFilterClauses(dataset.id, orgId, queryOptions, dimensions);

  let sortClause = 'ORDER BY row_index ASC';
  if (queryOptions.sortKey) {
    const order = (queryOptions.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sortClause = `ORDER BY (data->>'${queryOptions.sortKey}') ${order}`;
  }

  const pool = db.getPool();
  const countSql = `SELECT COUNT(*) AS total FROM dataset_rows WHERE ${whereSql}`;
  const countRes = await pool.query(countSql, params);
  const totalCount = Number(countRes.rows[0]?.total || 0);

  const dataSql = `
    SELECT data FROM dataset_rows
    WHERE ${whereSql}
    ${sortClause}
    LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
  `;
  const dataRes = await pool.query(dataSql, [...params, limit, offset]);

  return {
    rows: dataRes.rows.map(r => r.data),
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit) || 1
  };
}

async function queryPostgresFilterOptions(dataset, dimensions, user) {
  const orgId = user?.organization_id;
  const pool = db.getPool();

  const options = {
    regions: [],
    categories: [],
    products: [],
    channels: [],
    dateBounds: { min: null, max: null }
  };

  const getDistinct = async (col) => {
    if (!col) return [];
    const sql = `
      SELECT DISTINCT (data->>'${col}') AS val
      FROM dataset_rows
      WHERE dataset_id = $1 ${orgId ? 'AND (organization_id = $2 OR organization_id IS NULL)' : ''}
      AND (data->>'${col}') IS NOT NULL AND (data->>'${col}') != ''
      LIMIT 100
    `;
    const p = orgId ? [dataset.id, orgId] : [dataset.id];
    const res = await pool.query(sql, p);
    return res.rows.map(r => r.val).sort();
  };

  if (dimensions.regionColumn) options.regions = await getDistinct(dimensions.regionColumn);
  if (dimensions.categoryColumn) options.categories = await getDistinct(dimensions.categoryColumn);
  if (dimensions.productColumn) options.products = await getDistinct(dimensions.productColumn);
  if (dimensions.channelColumn) options.channels = await getDistinct(dimensions.channelColumn);

  if (dimensions.dateColumn) {
    const dateSql = `
      SELECT
        MIN((data->>'${dimensions.dateColumn}')::date) AS min_d,
        MAX((data->>'${dimensions.dateColumn}')::date) AS max_d
      FROM dataset_rows
      WHERE dataset_id = $1 ${orgId ? 'AND (organization_id = $2 OR organization_id IS NULL)' : ''}
    `;
    const p = orgId ? [dataset.id, orgId] : [dataset.id];
    const res = await pool.query(dateSql, p);
    if (res.rows[0]) {
      const minD = res.rows[0].min_d;
      const maxD = res.rows[0].max_d;
      options.dateBounds.min = minD ? (minD instanceof Date ? minD.toISOString().split('T')[0] : String(minD)) : null;
      options.dateBounds.max = maxD ? (maxD instanceof Date ? maxD.toISOString().split('T')[0] : String(maxD)) : null;
    }
  }

  return options;
}

// ----------------------------------------------------------------------------
// STREAMING FILE AGGREGATOR (O(1) CONSTANT MEMORY PASS ON CSV / JSON FILES)
// ----------------------------------------------------------------------------

/**
 * Execute single-pass streaming aggregation across 1M+ rows with constant memory (<150MB heap)
 */
async function streamAggregateDatasetFile({
  dataset,
  dimensions,
  filters = {},
  options = {}
}) {
  const filePath = dataset.file_path;
  if (!filePath) {
    throw new Error('Dataset has no attached file.');
  }

  let inputStream;
  if (pathIsAbsolute(filePath) && fs.existsSync(filePath)) {
    inputStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  } else {
    const exists = await storage.exists(filePath);
    if (!exists) {
      throw new Error('Dataset file does not exist on storage.');
    }
    inputStream = storage.getFileStream(filePath);
    inputStream.setEncoding('utf8');
  }

  const {
    needKpis = false,
    needTrends = false,
    needBreakdown = false,
    groupByCol = null,
    needRows = false,
    page = 1,
    limit = 20,
    sortKey = null,
    sortOrder = 'desc',
    needFilterOptions = false
  } = options;

  const primaryCol = dimensions.primaryMetric;
  const qtyCol = dimensions.quantityMetric;
  const idCol = dimensions.orderIdColumn;
  const dateCol = dimensions.dateColumn;

  // Filter criteria setup
  let startDate = filters.startDate ? new Date(filters.startDate) : null;
  let endDate = filters.endDate ? new Date(filters.endDate) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  const reservedParams = new Set([
    'startDate', 'endDate', 'dateRange', 'search', 'page', 'limit', 'sortKey', 'sortOrder', 'groupBy'
  ]);
  const exactFilters = {};
  for (const [k, v] of Object.entries(filters || {})) {
    if (!reservedParams.has(k) && v && v !== 'all' && v !== 'ALL') {
      exactFilters[k.toLowerCase()] = String(v).toLowerCase();
    }
  }
  const searchQuery = filters.search && typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : null;

  // Accumulators
  let totalFilteredCount = 0;
  let sumPrimary = 0;
  let minPrimary = Infinity;
  let maxPrimary = -Infinity;
  let validPrimaryCount = 0;
  let sumQuantity = 0;

  // Fast unique orders tracking (capped at 50,000 for strict memory safety)
  const uniqueOrdersSet = new Set();
  let uniqueOrdersCapped = false;

  // Period comparison tracking
  let earliestDateTs = Infinity;
  let latestDateTs = -Infinity;
  let prevPeriodSum = 0;
  let currPeriodSum = 0;
  let prevPeriodCount = 0;
  let currPeriodCount = 0;

  // Trends
  const trendsMap = new Map();

  // Breakdown
  const breakdownMap = new Map();
  let grandTotalBreakdown = 0;

  // Rows pagination
  const startIndex = (page - 1) * limit;
  const targetEndIndex = startIndex + limit;
  let collectedRows = [];
  const topRowsHeap = []; // if sorted

  // Filter options
  const filterOptionsSets = {
    regions: new Set(),
    categories: new Set(),
    products: new Set(),
    channels: new Set(),
    minDate: null,
    maxDate: null
  };

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let delimiter = ',';
  let isJson = path.extname(filePath).toLowerCase() === '.json';

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    const rowList = [];

    if (!isJson) {
      if (!headers) {
        delimiter = detectDelimiter(line);
        headers = parseCsvLine(line, delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        continue;
      }
      const values = parseCsvLine(line, delimiter);
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = values[i] !== undefined ? values[i] : null;
      }
      rowList.push(row);
    } else {
      try {
        let clean = line;
        if (clean.endsWith(',')) clean = clean.slice(0, -1);
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          rowList.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          rowList.push(parsed);
        }
      } catch (_) {
        try {
          const stripped = line.replace(/^\[|\]$/g, '').trim();
          if (stripped) {
            const parsed = JSON.parse(stripped.endsWith(',') ? stripped.slice(0, -1) : stripped);
            if (Array.isArray(parsed)) rowList.push(...parsed);
            else if (parsed && typeof parsed === 'object') rowList.push(parsed);
          }
        } catch (__) {
          continue;
        }
      }
    }

    if (rowList.length === 0) continue;

    for (const row of rowList) {
      // Apply Filter Criteria
      let pass = true;

      // Date filter
      if (dateCol && (startDate || endDate)) {
        const rawD = row[dateCol];
        if (rawD) {
          const d = new Date(rawD);
          if (!isNaN(d.getTime())) {
            if (startDate && d < startDate) pass = false;
            if (endDate && d > endDate) pass = false;
          }
        }
      }

      // Exact match filters
      if (pass && Object.keys(exactFilters).length > 0) {
        for (const [fKey, fVal] of Object.entries(exactFilters)) {
          const rowVal = row[fKey] !== undefined ? String(row[fKey]).toLowerCase() : '';
          if (rowVal !== fVal) {
            pass = false;
            break;
          }
        }
      }

      // Search query
      if (pass && searchQuery) {
        const hasMatch = Object.values(row).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(searchQuery));
        if (!hasMatch) pass = false;
      }

      // Filter Options Collection (computed on unfiltered or filtered rows)
      if (needFilterOptions) {
        if (dimensions.regionColumn && row[dimensions.regionColumn]) {
          if (filterOptionsSets.regions.size < 100) filterOptionsSets.regions.add(String(row[dimensions.regionColumn]));
        }
        if (dimensions.categoryColumn && row[dimensions.categoryColumn]) {
          if (filterOptionsSets.categories.size < 100) filterOptionsSets.categories.add(String(row[dimensions.categoryColumn]));
        }
        if (dimensions.productColumn && row[dimensions.productColumn]) {
          if (filterOptionsSets.products.size < 100) filterOptionsSets.products.add(String(row[dimensions.productColumn]));
        }
        if (dimensions.channelColumn && row[dimensions.channelColumn]) {
          if (filterOptionsSets.channels.size < 100) filterOptionsSets.channels.add(String(row[dimensions.channelColumn]));
        }
        if (dateCol && row[dateCol]) {
          const dStr = String(row[dateCol]).substring(0, 10);
          if (!filterOptionsSets.minDate || dStr < filterOptionsSets.minDate) filterOptionsSets.minDate = dStr;
          if (!filterOptionsSets.maxDate || dStr > filterOptionsSets.maxDate) filterOptionsSets.maxDate = dStr;
        }
      }

      if (!pass) continue;

      totalFilteredCount++;

      // Accumulate Primary Metric
      let primaryVal = 0;
      if (primaryCol) {
        const parsedNum = Number(row[primaryCol]);
        if (!isNaN(parsedNum)) {
          primaryVal = parsedNum;
          sumPrimary += primaryVal;
          validPrimaryCount++;
          if (primaryVal < minPrimary) minPrimary = primaryVal;
          if (primaryVal > maxPrimary) maxPrimary = primaryVal;
        }
      }

      // Accumulate Quantity
      if (qtyCol) {
        const q = Number(row[qtyCol]);
        if (!isNaN(q)) sumQuantity += q;
      }

      // Unique Orders
      if (idCol) {
        const idVal = row[idCol];
        if (idVal !== undefined && idVal !== null && !uniqueOrdersCapped) {
          if (uniqueOrdersSet.size < 50000) {
            uniqueOrdersSet.add(String(idVal));
          } else {
            uniqueOrdersCapped = true;
          }
        }
      }

      // Trends accumulation
      if (needTrends && dateCol && row[dateCol]) {
        const rawD = String(row[dateCol]);
        const dateKey = rawD.length >= 10 ? rawD.substring(0, 10) : rawD;
        if (!trendsMap.has(dateKey)) {
          trendsMap.set(dateKey, {
            date: dateKey,
            revenue: 0,
            orders: 0,
            units: 0
          });
        }
        const entry = trendsMap.get(dateKey);
        entry.revenue += primaryVal;
        entry.orders += 1;
        entry.units += (qtyCol ? (Number(row[qtyCol]) || 0) : 1);
      }

      // Breakdown accumulation
      if (needBreakdown && groupByCol) {
        const cat = row[groupByCol] !== undefined && row[groupByCol] !== null && String(row[groupByCol]).trim() !== ''
          ? String(row[groupByCol]).trim()
          : 'Uncategorized';
        
        grandTotalBreakdown += primaryVal;
        if (!breakdownMap.has(cat)) {
          breakdownMap.set(cat, {
            category: cat,
            value: 0,
            orders: 0
          });
        }
        const bEntry = breakdownMap.get(cat);
        bEntry.value += primaryVal;
        bEntry.orders += 1;
      }

      // Paginated Rows collection
      if (needRows) {
        if (!sortKey) {
          if (totalFilteredCount > startIndex && totalFilteredCount <= targetEndIndex) {
            collectedRows.push(row);
          }
        } else {
          // Collect bounded sample if sorting
          if (topRowsHeap.length < 2000) {
            topRowsHeap.push(row);
          }
        }
      }
    }
  }

  // Finalize KPIs
  if (minPrimary === Infinity) minPrimary = 0;
  if (maxPrimary === -Infinity) maxPrimary = 0;
  const avgSales = validPrimaryCount > 0 ? (sumPrimary / validPrimaryCount) : 0;
  const totalOrders = idCol ? (uniqueOrdersCapped ? totalFilteredCount : uniqueOrdersSet.size) : totalFilteredCount;
  const averageOrderValue = totalOrders > 0 ? (sumPrimary / totalOrders) : avgSales;

  const kpis = {
    totalSales: Number(sumPrimary.toFixed(2)),
    totalOrders,
    totalQuantity: qtyCol ? sumQuantity : totalOrders,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    minSales: Number(minPrimary.toFixed(2)),
    maxSales: Number(maxPrimary.toFixed(2)),
    recordCount: totalFilteredCount,
    primaryMetricName: primaryCol || 'Metric',
    quantityMetricName: qtyCol || 'Units',
    comparison: null
  };

  // Finalize Trends
  const sortedTrends = Array.from(trendsMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365);
  
  if (sortedTrends.length > 0) {
    const avgRev = sortedTrends.reduce((s, t) => s + t.revenue, 0) / sortedTrends.length;
    sortedTrends.forEach(t => {
      t.revenue = Number(t.revenue.toFixed(2));
      t.target = Number((avgRev * 0.95).toFixed(2));
      try {
        t.formattedDate = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (_) {
        t.formattedDate = t.date;
      }
    });
  }

  // Finalize Breakdowns
  const breakdowns = Array.from(breakdownMap.values())
    .map(b => ({
      name: b.category,
      category: b.category,
      value: Number(b.value.toFixed(2)),
      orders: b.orders,
      percentage: grandTotalBreakdown > 0 ? Number(((b.value / grandTotalBreakdown) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50);

  // Finalize Rows
  let finalRows = collectedRows;
  if (needRows && sortKey && topRowsHeap.length > 0) {
    topRowsHeap.sort((a, b) => {
      const vA = a[sortKey];
      const vB = b[sortKey];
      const isAsc = sortOrder.toLowerCase() === 'asc';
      if (!isNaN(vA) && !isNaN(vB)) return isAsc ? Number(vA) - Number(vB) : Number(vB) - Number(vA);
      return isAsc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    });
    finalRows = topRowsHeap.slice(startIndex, startIndex + limit);
  }

  const rowsData = {
    rows: finalRows,
    totalCount: totalFilteredCount,
    page,
    limit,
    totalPages: Math.ceil(totalFilteredCount / limit) || 1
  };

  const filterOptions = {
    regions: Array.from(filterOptionsSets.regions).sort(),
    categories: Array.from(filterOptionsSets.categories).sort(),
    products: Array.from(filterOptionsSets.products).sort(),
    channels: Array.from(filterOptionsSets.channels).sort(),
    dateBounds: {
      min: filterOptionsSets.minDate,
      max: filterOptionsSets.maxDate
    }
  };

  return {
    kpis,
    trends: sortedTrends,
    breakdowns,
    rowsData,
    filterOptions,
    totalFilteredCount
  };
}

// ----------------------------------------------------------------------------
// RELATIONAL ENGINE HELPERS
// ----------------------------------------------------------------------------

function validateRelationshipDefinition(sourceDataset, sourceCol, targetDataset, targetCol, relationshipType = 'many_to_one') {
  if (!sourceDataset || !targetDataset) {
    return { valid: false, error: 'Both source and target datasets must exist and be accessible.' };
  }

  let srcSchema = sourceDataset.schema || [];
  if (typeof srcSchema === 'string') {
    try { srcSchema = JSON.parse(srcSchema); } catch (_) { srcSchema = []; }
  }

  let tgtSchema = targetDataset.schema || [];
  if (typeof tgtSchema === 'string') {
    try { tgtSchema = JSON.parse(tgtSchema); } catch (_) { tgtSchema = []; }
  }

  const srcField = srcSchema.find(c => c.name.toLowerCase() === sourceCol.trim().toLowerCase());
  if (!srcField) {
    return { valid: false, error: `Source column "${sourceCol}" does not exist in dataset "${sourceDataset.name}".` };
  }

  const tgtField = tgtSchema.find(c => c.name.toLowerCase() === targetCol.trim().toLowerCase());
  if (!tgtField) {
    return { valid: false, error: `Target column "${targetCol}" does not exist in dataset "${targetDataset.name}".` };
  }

  const normalizeType = (t) => {
    const clean = (t || 'string').toLowerCase();
    if (clean === 'integer' || clean === 'int' || clean === 'smallint' || clean === 'float' || clean === 'double' || clean === 'decimal' || clean === 'numeric' || clean === 'bigint') return 'number';
    if (clean === 'timestamp' || clean === 'timestamptz' || clean === 'datetime') return 'date';
    if (clean === 'varchar' || clean === 'text' || clean === 'char') return 'string';
    return clean;
  };

  const srcType = normalizeType(srcField.type);
  const tgtType = normalizeType(tgtField.type);

  if (srcType !== tgtType) {
    return {
      valid: false,
      error: `Cannot create relationship: "${sourceCol}" is ${srcField.type || 'unknown'} in ${sourceDataset.name} but "${targetCol}" is ${tgtField.type || 'unknown'} in ${targetDataset.name}. Column data types must be compatible.`
    };
  }

  const validTypes = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];
  if (relationshipType && !validTypes.includes(relationshipType.toLowerCase())) {
    return { valid: false, error: `Invalid relationship type "${relationshipType}". Allowed types: ${validTypes.join(', ')}.` };
  }

  return { valid: true };
}

/**
 * Detect physical data type of an array of values
 * Returns: 'integer' | 'number' | 'date' | 'boolean' | 'string'
 */
function detectPhysicalType(values) {
  if (!values || values.length === 0) return 'string';
  let numCount = 0;
  let intCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  let total = 0;

  for (const val of values) {
    if (val === null || val === undefined || val === '') continue;
    total++;
    const s = String(val).trim();
    if (s.toLowerCase() === 'true' || s.toLowerCase() === 'false') {
      boolCount++;
    } else if (!isNaN(Number(s)) && isFinite(Number(s))) {
      numCount++;
      if (Number.isInteger(Number(s)) && !s.includes('.')) {
        intCount++;
      }
    } else if (s.length >= 8 && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) && !isNaN(Date.parse(s))) {
      dateCount++;
    }
  }

  if (total === 0) return 'string';
  if (intCount / total >= 0.7) return 'integer';
  if (numCount / total >= 0.7) return 'number';
  if (dateCount / total >= 0.7) return 'date';
  if (boolCount / total >= 0.7) return 'boolean';
  return 'string';
}

/**
 * Validate dataset relationship with schema, physical data types, and cardinality
 */
async function validateRelationshipWithData({
  sourceDataset,
  sourceColumn,
  targetDataset,
  targetColumn,
  relationshipType = 'many_to_one'
}) {
  // 1. Basic schema definition validation
  const baseValidation = validateRelationshipDefinition(
    sourceDataset,
    sourceColumn,
    targetDataset,
    targetColumn,
    relationshipType
  );
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const relType = String(relationshipType || 'many_to_one').toLowerCase();

  // 2. Load dataset records to inspect physical types and check cardinality
  let srcRecords = [];
  let tgtRecords = [];

  try {
    srcRecords = await loadDatasetRecords(sourceDataset, 10000);
  } catch (_) {
    srcRecords = [];
  }

  try {
    tgtRecords = await loadDatasetRecords(targetDataset, 10000);
  } catch (_) {
    tgtRecords = [];
  }

  // 3. Physical Type Compatibility Verification (Do not rely only on UI/schema string label)
  if (srcRecords.length > 0 && tgtRecords.length > 0) {
    const srcValues = srcRecords.map(r => r[sourceColumn]).filter(v => v !== undefined && v !== null && v !== '');
    const tgtValues = tgtRecords.map(r => r[targetColumn]).filter(v => v !== undefined && v !== null && v !== '');

    const srcPhysType = detectPhysicalType(srcValues);
    const tgtPhysType = detectPhysicalType(tgtValues);

    const isNumericType = (t) => t === 'integer' || t === 'number';

    // Incompatible if one is strictly numeric and the other is non-numeric text
    if ((isNumericType(srcPhysType) && tgtPhysType === 'string') || (srcPhysType === 'string' && isNumericType(tgtPhysType))) {
      return {
        valid: false,
        error: `Cannot establish relationship: "${sourceColumn}" in "${sourceDataset.name}" is ${srcPhysType} but "${targetColumn}" in "${targetDataset.name}" is ${tgtPhysType}. Incompatible column data types cannot be linked.`
      };
    }
  }

  // 4. Cardinality & Duplicate Key Validation
  // Many-to-One (N:1): Target must be unique key (no duplicates, no nulls)
  if (relType === 'many_to_one' && tgtRecords.length > 0) {
    const seen = new Map();
    let nullCount = 0;
    let dupKey = null;
    let dupCount = 0;

    for (const r of tgtRecords) {
      const v = r[targetColumn];
      if (v === null || v === undefined || String(v).trim() === '') {
        nullCount++;
        continue;
      }
      const norm = String(v).trim().toLowerCase();
      const count = (seen.get(norm) || 0) + 1;
      seen.set(norm, count);
      if (count > 1 && !dupKey) {
        dupKey = String(v).trim();
        dupCount = count;
      } else if (dupKey && dupKey.toLowerCase() === norm) {
        dupCount = count;
      }
    }

    if (dupKey) {
      return {
        valid: false,
        error: `Cannot establish Many-to-One (N:1) relationship: Target column "${targetColumn}" in dataset "${targetDataset.name}" contains duplicate keys (e.g. "${dupKey}" occurs ${dupCount} times). Many-to-One relationships require unique keys in the target dataset. Consider choosing Many-to-Many (N:N) instead.`
      };
    }

    if (nullCount > 0 && seen.size > 0) {
      return {
        valid: false,
        error: `Cannot establish Many-to-One (N:1) relationship: Target column "${targetColumn}" in dataset "${targetDataset.name}" contains ${nullCount} null/empty values. Target key column cannot contain nulls.`
      };
    }
  }

  // One-to-Many (1:N): Source must be unique key (no duplicates, no nulls)
  if (relType === 'one_to_many' && srcRecords.length > 0) {
    const seen = new Map();
    let nullCount = 0;
    let dupKey = null;
    let dupCount = 0;

    for (const r of srcRecords) {
      const v = r[sourceColumn];
      if (v === null || v === undefined || String(v).trim() === '') {
        nullCount++;
        continue;
      }
      const norm = String(v).trim().toLowerCase();
      const count = (seen.get(norm) || 0) + 1;
      seen.set(norm, count);
      if (count > 1 && !dupKey) {
        dupKey = String(v).trim();
        dupCount = count;
      } else if (dupKey && dupKey.toLowerCase() === norm) {
        dupCount = count;
      }
    }

    if (dupKey) {
      return {
        valid: false,
        error: `Cannot establish One-to-Many (1:N) relationship: Source column "${sourceColumn}" in dataset "${sourceDataset.name}" contains duplicate keys (e.g. "${dupKey}" occurs ${dupCount} times). One-to-Many relationships require unique keys in the source dataset. Consider choosing Many-to-Many (N:N) instead.`
      };
    }

    if (nullCount > 0 && seen.size > 0) {
      return {
        valid: false,
        error: `Cannot establish One-to-Many (1:N) relationship: Source column "${sourceColumn}" in dataset "${sourceDataset.name}" contains ${nullCount} null/empty values. Source key column cannot contain nulls.`
      };
    }
  }

  // One-to-One (1:1): Both Source and Target must be unique keys (no duplicates, no nulls)
  if (relType === 'one_to_one') {
    if (srcRecords.length > 0) {
      const seen = new Map();
      let dupKey = null;
      let dupCount = 0;
      for (const r of srcRecords) {
        const v = r[sourceColumn];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        const norm = String(v).trim().toLowerCase();
        const count = (seen.get(norm) || 0) + 1;
        seen.set(norm, count);
        if (count > 1 && !dupKey) {
          dupKey = String(v).trim();
          dupCount = count;
        }
      }
      if (dupKey) {
        return {
          valid: false,
          error: `Cannot establish One-to-One (1:1) relationship: Source column "${sourceColumn}" in dataset "${sourceDataset.name}" contains duplicate keys (e.g. "${dupKey}" occurs ${dupCount} times). One-to-One relationships require unique keys in both datasets.`
        };
      }
    }

    if (tgtRecords.length > 0) {
      const seen = new Map();
      let dupKey = null;
      let dupCount = 0;
      for (const r of tgtRecords) {
        const v = r[targetColumn];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        const norm = String(v).trim().toLowerCase();
        const count = (seen.get(norm) || 0) + 1;
        seen.set(norm, count);
        if (count > 1 && !dupKey) {
          dupKey = String(v).trim();
          dupCount = count;
        }
      }
      if (dupKey) {
        return {
          valid: false,
          error: `Cannot establish One-to-One (1:1) relationship: Target column "${targetColumn}" in dataset "${targetDataset.name}" contains duplicate keys (e.g. "${dupKey}" occurs ${dupCount} times). One-to-One relationships require unique keys in both datasets.`
        };
      }
    }
  }

  // Many-to-Many (N:N): Allows duplicates on both sides.
  return { valid: true };
}

async function executeRelationalQuery({
  baseDataset,
  baseRecords = [],
  joins = [],
  dimensions = [],
  metrics = [],
  filters = {},
  limit = 5000,
  page = 1
}) {
  const startTime = Date.now();
  const maxJoinsAllowed = 4;
  if (joins.length > maxJoinsAllowed) {
    throw new Error(`Exceeded maximum allowed joins per query (${maxJoinsAllowed}).`);
  }

  const maxRowsAllowed = 10000;
  const effectiveLimit = Math.min(maxRowsAllowed, Math.max(1, Number(limit) || 100));
  const effectivePage = Math.max(1, Number(page) || 1);

  const baseName = (baseDataset.name || 'base').replace(/[^a-zA-Z0-9_]/g, '_');

  let currentWorkingSet = baseRecords.map(row => {
    const disambiguated = {};
    for (const [k, v] of Object.entries(row)) {
      disambiguated[k] = v;
      disambiguated[`${baseName}.${k}`] = v;
    }
    return disambiguated;
  });

  for (const join of joins) {
    const {
      targetDataset,
      targetRecords = [],
      sourceColumn,
      targetColumn,
      type = 'left'
    } = join;

    const targetName = (targetDataset.name || 'target').replace(/[^a-zA-Z0-9_]/g, '_');
    const isInner = (type || 'left').toLowerCase() === 'inner';

    const targetHashIndex = new Map();
    for (const tgtRow of targetRecords) {
      const joinKeyVal = tgtRow[targetColumn];
      if (joinKeyVal !== undefined && joinKeyVal !== null) {
        const key = String(joinKeyVal).trim().toLowerCase();
        if (!targetHashIndex.has(key)) {
          targetHashIndex.set(key, []);
        }
        targetHashIndex.get(key).push(tgtRow);
      }
    }

    const joinedResults = [];

    for (const baseRow of currentWorkingSet) {
      const rawSourceVal = baseRow[sourceColumn] !== undefined ? baseRow[sourceColumn] : baseRow[`${baseName}.${sourceColumn}`];
      const lookupKey = rawSourceVal !== undefined && rawSourceVal !== null ? String(rawSourceVal).trim().toLowerCase() : null;
      const matchingTargetRows = lookupKey ? targetHashIndex.get(lookupKey) : null;

      if (matchingTargetRows && matchingTargetRows.length > 0) {
        for (const tgtMatch of matchingTargetRows) {
          const mergedRow = { ...baseRow };
          for (const [tk, tv] of Object.entries(tgtMatch)) {
            mergedRow[`${targetName}.${tk}`] = tv;
            if (mergedRow[tk] === undefined) {
              mergedRow[tk] = tv;
            }
          }
          joinedResults.push(mergedRow);
        }
      } else if (!isInner) {
        const mergedRow = { ...baseRow };
        let tgtSchema = targetDataset.schema || [];
        if (typeof tgtSchema === 'string') {
          try { tgtSchema = JSON.parse(tgtSchema); } catch (_) { tgtSchema = []; }
        }
        tgtSchema.forEach(col => {
          mergedRow[`${targetName}.${col.name}`] = null;
        });
        joinedResults.push(mergedRow);
      }
    }

    currentWorkingSet = joinedResults;
  }

  let filteredSet = currentWorkingSet;
  if (filters && typeof filters === 'object') {
    const filterKeys = Object.keys(filters).filter(k => !['page', 'limit', 'sortKey', 'sortOrder'].includes(k));
    for (const fKey of filterKeys) {
      const fVal = filters[fKey];
      if (fVal !== undefined && fVal !== null && fVal !== 'all' && fVal !== 'ALL' && fVal !== '') {
        const cleanVal = String(fVal).trim().toLowerCase();
        filteredSet = filteredSet.filter(r => {
          const rowVal = r[fKey] !== undefined ? r[fKey] : r[fKey.split('.').pop()];
          if (rowVal === undefined || rowVal === null) return false;
          return String(rowVal).trim().toLowerCase() === cleanVal;
        });
      }
    }
  }

  if (dimensions.length > 0 || metrics.length > 0) {
    const groupMap = new Map();

    const resolveVal = (row, colKey) => {
      if (row[colKey] !== undefined) return row[colKey];
      const bare = colKey.includes('.') ? colKey.split('.').pop() : colKey;
      if (row[bare] !== undefined) return row[bare];
      const matchedKey = Object.keys(row).find(k => k.toLowerCase() === colKey.toLowerCase() || k.toLowerCase().endsWith(`.${bare.toLowerCase()}`));
      return matchedKey ? row[matchedKey] : undefined;
    };

    for (const r of filteredSet) {
      const dimVals = dimensions.map(d => {
        const val = resolveVal(r, d);
        return val !== undefined && val !== null ? String(val) : 'Other';
      });
      const groupKey = dimVals.join(' | ') || 'All';

      if (!groupMap.has(groupKey)) {
        const initialGroup = { groupKey, _count: 0 };
        dimensions.forEach((d, idx) => {
          initialGroup[d] = dimVals[idx];
          if (idx === 0) initialGroup.name = dimVals[0];
        });
        metrics.forEach((m) => {
          const alias = m.alias || `${m.aggregation || 'SUM'}_${m.column}`;
          initialGroup[alias] = 0;
          initialGroup[`_${alias}_sum`] = 0;
          initialGroup[`_${alias}_count`] = 0;
          initialGroup[`_${alias}_min`] = Infinity;
          initialGroup[`_${alias}_max`] = -Infinity;
        });
        groupMap.set(groupKey, initialGroup);
      }

      const g = groupMap.get(groupKey);
      g._count++;

      metrics.forEach((m) => {
        const alias = m.alias || `${m.aggregation || 'SUM'}_${m.column}`;
        const rawNum = Number(resolveVal(r, m.column));
        if (!isNaN(rawNum) && isFinite(rawNum)) {
          g[`_${alias}_sum`] += rawNum;
          g[`_${alias}_count`]++;
          if (rawNum < g[`_${alias}_min`]) g[`_${alias}_min`] = rawNum;
          if (rawNum > g[`_${alias}_max`]) g[`_${alias}_max`] = rawNum;
        }
      });
    }

    const groupedRows = Array.from(groupMap.values()).map(g => {
      const finalRow = { ...g };
      metrics.forEach((m) => {
        const alias = m.alias || `${m.aggregation || 'SUM'}_${m.column}`;
        const agg = (m.aggregation || 'SUM').toUpperCase();
        let computed = 0;

        if (agg === 'COUNT') {
          computed = g[`_${alias}_count`];
        } else if (agg === 'AVG') {
          computed = g[`_${alias}_count`] > 0 ? (g[`_${alias}_sum`] / g[`_${alias}_count`]) : 0;
        } else if (agg === 'MIN') {
          computed = g[`_${alias}_min`] !== Infinity ? g[`_${alias}_min`] : 0;
        } else if (agg === 'MAX') {
          computed = g[`_${alias}_max`] !== -Infinity ? g[`_${alias}_max`] : 0;
        } else {
          computed = g[`_${alias}_sum`];
        }

        finalRow[alias] = Math.round(computed * 100) / 100;
        if (metrics.length === 1) finalRow.value = finalRow[alias];

        delete finalRow[`_${alias}_sum`];
        delete finalRow[`_${alias}_count`];
        delete finalRow[`_${alias}_min`];
        delete finalRow[`_${alias}_max`];
      });

      return finalRow;
    });

    if (metrics.length > 0) {
      const firstMetricAlias = metrics[0].alias || `${metrics[0].aggregation || 'SUM'}_${metrics[0].column}`;
      groupedRows.sort((a, b) => (Number(b[firstMetricAlias]) || 0) - (Number(a[firstMetricAlias]) || 0));
    }

    const totalCount = groupedRows.length;
    const startIndex = (effectivePage - 1) * effectiveLimit;
    const paginatedRows = groupedRows.slice(startIndex, startIndex + effectiveLimit);

    return {
      rows: paginatedRows,
      totalCount,
      page: effectivePage,
      limit: effectiveLimit,
      totalPages: Math.ceil(totalCount / effectiveLimit) || 1,
      executionTimeMs: Date.now() - startTime
    };
  }

  const totalCount = filteredSet.length;
  const startIndex = (effectivePage - 1) * effectiveLimit;
  const paginatedRows = filteredSet.slice(startIndex, startIndex + effectiveLimit);

  return {
    rows: paginatedRows,
    totalCount,
    page: effectivePage,
    limit: effectiveLimit,
    totalPages: Math.ceil(totalCount / effectiveLimit) || 1,
    executionTimeMs: Date.now() - startTime
  };
}

module.exports = {
  loadDatasetRecords,
  detectDatasetDimensions,
  applyDatasetFilters,
  computeDatasetKpis,
  computeDatasetTrends,
  computeDatasetBreakdown,
  resolveColumnKey,
  getPaginatedDatasetRows,
  getDatasetFilterOptions,
  validateRelationshipDefinition,
  validateRelationshipWithData,
  detectPhysicalType,
  executeRelationalQuery,
  queryDatasetSummary,
  queryDatasetKpis,
  queryDatasetTrends,
  queryDatasetBreakdowns,
  queryDatasetRows,
  queryDatasetFilterOptions,
  streamAggregateDatasetFile,
  invalidateParsedDatasetCache
};
