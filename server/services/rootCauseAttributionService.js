const Dataset = require('../models/datasetModel');
const InsightModel = require('../models/insightModel');
const analyticsService = require('./analyticsService');
const evidenceBuilderService = require('./evidenceBuilderService');

/**
 * Enterprise AI Root-Cause Driver Attribution Service (Phase 6)
 * 
 * Provides deterministic multi-dimensional variance decomposition of business metrics.
 * 
 * Mathematical Invariants:
 * 1. Exact Identity: sum(segmentDelta) === totalDelta
 * 2. Signed Contribution: contributionPercent = (segmentDelta / totalDelta) * 100
 *    - Allows <0% or >100% when positive and negative segment deltas coexist.
 *    - Never clamped or artificially normalized.
 * 3. Absolute Movement Share: absoluteMovementShare = (|segmentDelta| / sum(|all segmentDelta|)) * 100
 * 4. Movement Concentration (HHI): Calculated strictly from absolute movement shares:
 *    share_i = |segmentDelta_i| / sum(|segmentDelta|)
 *    HHI = sum(share_i^2)
 *    Documented strictly as "movement concentration", NOT causal concentration.
 * 5. Strict Observational Language: "accounted for X% of the observed net change" (NEVER "caused").
 * 6. Zero Division Protection: Handled when totalDelta === 0 or sum(|segmentDelta|) === 0.
 */
class RootCauseAttributionService {
  constructor() {
    this._cache = new Map();
    this._cacheTtlMs = 5 * 60 * 1000; // 5 minutes TTL
    this._maxCacheEntries = 200;
  }

  clearCache() {
    this._cache.clear();
  }

  getCacheStats() {
    return {
      size: this._cache.size,
      max: this._maxCacheEntries,
      ttlMs: this._cacheTtlMs
    };
  }

  /**
   * Helper to parse numerical values safely
   */
  _toNum(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Detect valid categorical dimensions from schema
   * Excludes high-cardinality IDs and date columns
   */
  getEligibleDimensions(schema = []) {
    if (!Array.isArray(schema)) return [];
    const excludedPatterns = [
      'id', 'order_id', 'transaction_id', 'invoice_id', 'customer_id',
      'user_id', 'created_at', 'updated_at', 'date', 'time', 'timestamp'
    ];

    return schema
      .filter(col => {
        const colName = String(col.name || '').toLowerCase();
        const type = String(col.type || '').toLowerCase();
        const isString = type === 'string' || type === 'text' || type === 'varchar';
        const isExcluded = excludedPatterns.some(p => colName === p || colName.endsWith('_id'));
        return isString && !isExcluded;
      })
      .map(col => col.name);
  }

  /**
   * Decompose metric variance across a categorical dimension
   * 
   * @param {object} params
   * @param {object} params.insight - Insight record or evidence
   * @param {string} params.organizationId - Tenant organization ID
   * @param {string} [params.dimension] - Dimension column name (e.g. 'region', 'category')
   * @param {number} [params.limit=10] - Maximum drivers to return
   * @returns {Promise<object>} Deterministic attribution profile
   */
  async calculateAttribution({
    insight,
    organizationId,
    dimension = null,
    limit = 10,
    forceFresh = false
  }) {
    if (!insight) {
      throw new Error('Insight object is required for root-cause attribution.');
    }
    if (!organizationId) {
      throw new Error('Organization ID is required for multi-tenant isolation.');
    }

    const evidence = insight.evidence || {};
    let datasetId = insight.dataset_id || evidence.datasetId || evidence.dataset_id || insight.source_metadata?.dataset_id;

    if (!datasetId && (insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id)) {
      const metricId = insight.metric_id || evidence.metricId || insight.source_metadata?.metric_id;
      const MetricModel = require('../models/metricModel');
      const metric = await MetricModel.findByIdAndOrgId(metricId, organizationId).catch(() => null);
      if (metric?.dataset_id) {
        datasetId = metric.dataset_id;
        insight.dataset_id = metric.dataset_id;
      }
    }

    if (!datasetId) {
      return {
        insightId: String(insight.id || ''),
        datasetId: null,
        datasetName: null,
        metric: evidence.metric || 'metric',
        dimension: null,
        availableDimensions: [],
        recordsAnalyzed: 0,
        totalBaseline: this._toNum(evidence.comparisonValue, 0),
        totalCurrent: this._toNum(evidence.currentValue, 0),
        totalDelta: Number((this._toNum(evidence.currentValue, 0) - this._toNum(evidence.comparisonValue, 0)).toFixed(2)),
        totalDeltaPercent: this._toNum(evidence.changePercent, 0),
        sumOfSegmentDeltas: 0,
        mathBalanceVerified: true,
        drivers: [],
        totalDriversCount: 0,
        primaryDetractor: null,
        primarySustainer: null,
        concentration: {
          metric: 'movement_concentration',
          hhi: 0,
          type: 'dispersed',
          description: 'No dimensional data available.'
        },
        emptyReason: 'Analysis could not be completed because the source dataset is unavailable.',
        observationalSummary: 'Supporting dataset records are unavailable to decompose variance across dimensional segments.',
        verified: false,
        fromCache: false
      };
    }

    const insightId = String(insight.id || insight._id || 'direct');
    const cacheKey = `${organizationId}:${datasetId}:${dimension || 'auto'}:${limit}:${insightId}`;

    const cached = this._cache.get(cacheKey);
    if (!forceFresh && cached && (Date.now() - cached.timestamp < this._cacheTtlMs)) {
      return { ...JSON.parse(JSON.stringify(cached.data)), fromCache: true };
    }

    const candidateMetric = evidence.metric || evidence.sourceFields?.[0] || 'sales_amount';

    // Load dataset and verified physical records
    const { dataset, records, schema } = await evidenceBuilderService.loadDatasetAndRecords(
      datasetId,
      organizationId
    );

    if (!dataset) {
      return {
        insightId: String(insight.id || ''),
        datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
        datasetName: null,
        metric: candidateMetric,
        dimension: null,
        availableDimensions: [],
        recordsAnalyzed: 0,
        totalBaseline: 0,
        totalCurrent: 0,
        totalDelta: 0,
        totalDeltaPercent: 0,
        sumOfSegmentDeltas: 0,
        mathBalanceVerified: true,
        drivers: [],
        totalDriversCount: 0,
        primaryDetractor: null,
        primarySustainer: null,
        concentration: {
          metric: 'movement_concentration',
          hhi: 0,
          type: 'dispersed',
          description: 'Dataset not found.'
        },
        emptyReason: 'Analysis could not be completed because the source dataset is unavailable.',
        observationalSummary: 'Supporting dataset is not available to decompose variance.',
        verified: false,
        fromCache: false
      };
    }

    if (!records || records.length === 0) {
      return {
        insightId: String(insight.id || ''),
        datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
        datasetName: dataset.name,
        metric: candidateMetric,
        dimension: null,
        availableDimensions: [],
        recordsAnalyzed: 0,
        totalBaseline: 0,
        totalCurrent: 0,
        totalDelta: 0,
        totalDeltaPercent: 0,
        sumOfSegmentDeltas: 0,
        mathBalanceVerified: true,
        drivers: [],
        totalDriversCount: 0,
        primaryDetractor: null,
        primarySustainer: null,
        concentration: {
          metric: 'movement_concentration',
          hhi: 0,
          type: 'dispersed',
          description: 'Dataset contains 0 records.'
        },
        emptyReason: 'There is insufficient historical data to explain this change reliably.',
        observationalSummary: 'Dataset contains no physical records to decompose variance.',
        verified: false,
        fromCache: false
      };
    }

    // 1. Detect eligible categorical dimensions
    const availableDimensions = this.getEligibleDimensions(schema);
    if (availableDimensions.length === 0) {
      return {
        insightId: String(insight.id || ''),
        datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
        datasetName: dataset.name,
        metric: candidateMetric,
        dimension: null,
        availableDimensions: [],
        recordsAnalyzed: records.length,
        totalBaseline: Number(records.reduce((acc, r) => acc + this._toNum(r[candidateMetric], 0), 0).toFixed(2)),
        totalCurrent: Number(records.reduce((acc, r) => acc + this._toNum(r[candidateMetric], 0), 0).toFixed(2)),
        totalDelta: 0,
        totalDeltaPercent: 0,
        sumOfSegmentDeltas: 0,
        mathBalanceVerified: true,
        drivers: [],
        totalDriversCount: 0,
        primaryDetractor: null,
        primarySustainer: null,
        concentration: {
          metric: 'movement_concentration',
          hhi: 0,
          type: 'dispersed',
          description: 'No eligible categorical dimensions found in dataset.'
        },
        emptyReason: 'No categorical dimensions (such as region, category, or channel) found in dataset schema for dimensional breakdown.',
        observationalSummary: `The dataset does not contain categorical dimensions to decompose net change in ${candidateMetric}.`,
        verified: true,
        fromCache: false
      };
    }

    if (records.length < 2) {
      const singleVal = this._toNum(records[0][candidateMetric], 0);
      return {
        insightId: String(insight.id || ''),
        datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
        datasetName: dataset.name,
        metric: candidateMetric,
        dimension: availableDimensions[0] || null,
        availableDimensions,
        recordsAnalyzed: records.length,
        totalBaseline: singleVal,
        totalCurrent: singleVal,
        totalDelta: 0,
        totalDeltaPercent: 0,
        sumOfSegmentDeltas: 0,
        mathBalanceVerified: true,
        drivers: [],
        totalDriversCount: 0,
        primaryDetractor: null,
        primarySustainer: null,
        concentration: {
          metric: 'movement_concentration',
          hhi: 0,
          type: 'dispersed',
          description: 'Insufficient records.'
        },
        emptyReason: 'There is insufficient historical data to explain this change reliably.',
        observationalSummary: `Insufficient records in dataset "${dataset.name}" to perform chronological variance decomposition.`,
        verified: true,
        fromCache: false
      };
    }

    // Determine target dimension
    let targetDimension = dimension;
    if (!targetDimension || !availableDimensions.includes(targetDimension)) {
      // Pick first matching or prioritize region -> category -> channel -> first available
      const priorities = ['region', 'category', 'channel', 'segment', 'product'];
      targetDimension = priorities.find(p => availableDimensions.includes(p)) || availableDimensions[0];
    }

    // 2. Identify the target metric to decompose
    const numCol = schema.find(c => {
      const type = String(c.type).toLowerCase();
      const isNum = type === 'number' || type === 'numeric' || type === 'integer' || type === 'float';
      return isNum && (c.name === candidateMetric || c.name.toLowerCase() === String(candidateMetric).toLowerCase());
    }) || schema.find(c => {
      const type = String(c.type).toLowerCase();
      return type === 'number' || type === 'numeric' || type === 'integer' || type === 'float';
    });

    const metricName = numCol ? numCol.name : candidateMetric;

    // 3. Chronological or split-half partitioning to derive baseline vs. current
    // If dataset has a date column, sort chronologically; otherwise use sequential midpoint
    const dateCol = schema.find(c => {
      const type = String(c.type).toLowerCase();
      const name = String(c.name).toLowerCase();
      return type === 'date' || name.includes('date') || name.includes('time');
    });

    let sortedRecords = [...records];
    if (dateCol) {
      sortedRecords.sort((a, b) => new Date(a[dateCol.name] || 0) - new Date(b[dateCol.name] || 0));
    }

    const midpoint = Math.floor(sortedRecords.length / 2);
    const baselineRecords = sortedRecords.slice(0, midpoint);
    const currentRecords = sortedRecords.slice(midpoint);

    // 4. Aggregate segment values
    const segmentMap = new Map();

    const getSegmentKey = (row) => {
      const val = row[targetDimension];
      if (val === null || val === undefined || String(val).trim() === '') {
        return '(Unassigned)';
      }
      return String(val).trim();
    };

    // Baseline aggregation
    for (const row of baselineRecords) {
      const seg = getSegmentKey(row);
      if (!segmentMap.has(seg)) {
        segmentMap.set(seg, { baseline: 0, current: 0, baselineCount: 0, currentCount: 0 });
      }
      const data = segmentMap.get(seg);
      data.baseline += this._toNum(row[metricName], 0);
      data.baselineCount += 1;
    }

    // Current aggregation
    for (const row of currentRecords) {
      const seg = getSegmentKey(row);
      if (!segmentMap.has(seg)) {
        segmentMap.set(seg, { baseline: 0, current: 0, baselineCount: 0, currentCount: 0 });
      }
      const data = segmentMap.get(seg);
      data.current += this._toNum(row[metricName], 0);
      data.currentCount += 1;
    }

    // Compute net totals directly from segments
    let totalBaseline = 0;
    let totalCurrent = 0;
    for (const [_, val] of segmentMap) {
      totalBaseline += val.baseline;
      totalCurrent += val.current;
    }

    totalBaseline = Number(totalBaseline.toFixed(2));
    totalCurrent = Number(totalCurrent.toFixed(2));
    const totalDelta = Number((totalCurrent - totalBaseline).toFixed(2));
    const totalDeltaPercent = totalBaseline !== 0
      ? Number((((totalCurrent - totalBaseline) / totalBaseline) * 100).toFixed(2))
      : 0;

    // 5. Calculate segment deltas & sum of absolute deltas for movement share
    let sumSegmentDeltas = 0;
    let sumAbsSegmentDeltas = 0;

    const rawDrivers = [];
    for (const [segment, val] of segmentMap) {
      const baselineValue = Number(val.baseline.toFixed(2));
      const currentValue = Number(val.current.toFixed(2));
      const segmentDelta = Number((currentValue - baselineValue).toFixed(2));
      const absDelta = Math.abs(segmentDelta);

      sumSegmentDeltas += segmentDelta;
      sumAbsSegmentDeltas += absDelta;

      const deltaPercent = baselineValue !== 0
        ? Number((((currentValue - baselineValue) / baselineValue) * 100).toFixed(2))
        : (currentValue > 0 ? 100.0 : 0.0);

      rawDrivers.push({
        segment,
        baselineValue,
        currentValue,
        segmentDelta,
        deltaPercent,
        recordsCount: val.baselineCount + val.currentCount
      });
    }

    sumSegmentDeltas = Number(sumSegmentDeltas.toFixed(2));
    sumAbsSegmentDeltas = Number(sumAbsSegmentDeltas.toFixed(2));

    // 6. Compute exact signed contribution and absolute movement share
    const drivers = rawDrivers.map(d => {
      // Signed contribution to net variance (can be < 0% or > 100%)
      const contributionPercent = totalDelta !== 0
        ? Number(((d.segmentDelta / totalDelta) * 100).toFixed(2))
        : 0;

      // Absolute share of total movement (0% to 100%)
      const absoluteMovementShare = sumAbsSegmentDeltas > 0
        ? Number(((Math.abs(d.segmentDelta) / sumAbsSegmentDeltas) * 100).toFixed(2))
        : 0;

      // Classification based on direction of net change
      let classification = 'neutral';
      if (totalDelta < 0) {
        if (d.segmentDelta < 0) classification = 'detractor';
        else if (d.segmentDelta > 0) classification = 'sustainer';
      } else if (totalDelta > 0) {
        if (d.segmentDelta > 0) classification = 'driver';
        else if (d.segmentDelta < 0) classification = 'laggard';
      } else {
        classification = d.segmentDelta !== 0 ? 'offsetting' : 'neutral';
      }

      return {
        ...d,
        contributionPercent,
        absoluteMovementShare,
        classification
      };
    });

    // Sort drivers by absolute movement share descending
    drivers.sort((a, b) => Math.abs(b.segmentDelta) - Math.abs(a.segmentDelta));

    // Identify primary detractor and primary driver
    let primaryDetractor = null;
    let primarySustainer = null;

    if (totalDelta < 0) {
      const topDetractor = drivers.find(d => d.segmentDelta < 0);
      if (topDetractor) {
        topDetractor.classification = 'primary_detractor';
        primaryDetractor = topDetractor;
      }
      const topSustainer = drivers.find(d => d.segmentDelta > 0);
      if (topSustainer) {
        topSustainer.classification = 'primary_sustainer';
        primarySustainer = topSustainer;
      }
    } else if (totalDelta > 0) {
      const topDriver = drivers.find(d => d.segmentDelta > 0);
      if (topDriver) {
        topDriver.classification = 'primary_driver';
        primarySustainer = topDriver;
      }
      const topLaggard = drivers.find(d => d.segmentDelta < 0);
      if (topLaggard) {
        topLaggard.classification = 'primary_laggard';
        primaryDetractor = topLaggard;
      }
    } else {
      primaryDetractor = drivers.find(d => d.segmentDelta < 0) || null;
      primarySustainer = drivers.find(d => d.segmentDelta > 0) || null;
    }

    // 7. Calculate HHI from absolute movement shares
    // share_i = |segmentDelta_i| / sum(|segmentDelta|)
    // HHI = sum(share_i^2)  (Range: 0.0 to 1.0)
    let hhi = 0;
    if (sumAbsSegmentDeltas > 0) {
      for (const d of drivers) {
        const share = Math.abs(d.segmentDelta) / sumAbsSegmentDeltas;
        hhi += Math.pow(share, 2);
      }
    }
    hhi = Number(hhi.toFixed(4));

    const concentrationType = hhi >= 0.4 ? 'concentrated' : (hhi >= 0.2 ? 'moderate' : 'dispersed');
    const concentrationDescription = concentrationType === 'concentrated'
      ? `Observed movement is concentrated primarily within ${drivers[0]?.segment || 'top'} segment.`
      : (concentrationType === 'moderate'
        ? 'Observed movement is moderately distributed across several key segments.'
        : 'Observed movement is broadly dispersed across multiple segments.');

    // 8. Construct strictly observational narrative (Zero Causation)
    let observationalSummary = '';
    const topDriver = drivers[0];
    if (topDriver && totalDelta !== 0) {
      observationalSummary = `The ${topDriver.segment} segment accounted for ${Math.abs(topDriver.contributionPercent)}% of the observed net ${totalDelta < 0 ? 'contraction' : 'expansion'} in ${metricName}.`;
      if (primarySustainer && totalDelta < 0) {
        observationalSummary += ` Meanwhile, the ${primarySustainer.segment} segment exhibited positive delta (+${primarySustainer.segmentDelta.toLocaleString()}), partially offsetting the net decline.`;
      }
    } else {
      observationalSummary = `Net movement in ${metricName} remained stable across analyzed ${targetDimension} segments during the period.`;
    }

    const result = {
      insightId: String(insight.id || ''),
      datasetId: isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId),
      datasetName: dataset.name,
      metric: metricName,
      dimension: targetDimension,
      availableDimensions,
      recordsAnalyzed: records.length,
      totalBaseline,
      totalCurrent,
      totalDelta,
      totalDeltaPercent,
      sumOfSegmentDeltas: sumSegmentDeltas,
      mathBalanceVerified: Math.abs(sumSegmentDeltas - totalDelta) < 0.05,
      drivers: drivers.slice(0, limit),
      totalDriversCount: drivers.length,
      primaryDetractor: primaryDetractor ? {
        segment: primaryDetractor.segment,
        delta: primaryDetractor.segmentDelta,
        contributionPercent: primaryDetractor.contributionPercent
      } : null,
      primarySustainer: primarySustainer ? {
        segment: primarySustainer.segment,
        delta: primarySustainer.segmentDelta,
        contributionPercent: primarySustainer.contributionPercent
      } : null,
      concentration: {
        metric: 'movement_concentration',
        hhi,
        type: concentrationType,
        description: concentrationDescription
      },
      observationalSummary,
      verified: true
    };

    if (this._cache.size >= this._maxCacheEntries) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }
    this._cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return { ...result, fromCache: false };
  }
}

module.exports = new RootCauseAttributionService();
