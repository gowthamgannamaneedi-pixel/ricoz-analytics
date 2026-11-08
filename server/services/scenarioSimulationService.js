/**
 * Enterprise AI What-If Scenario Simulation Service (Phase 6)
 * 
 * Provides deterministic counterfactual sensitivity modeling on top of verified baselines.
 * 
 * Invariants:
 * 1. Output is strictly COUNTERFACTUAL / PROJECTED.
 * 2. Never modifies the underlying dataset or database.
 * 3. Never presents simulated values as historical facts.
 * 4. Bounded: Negative adjustments that would push a segment below zero are clamped to zero
 *    with an explicit `clampedAtZero: true` validation flag.
 * 5. Deterministic calculation: simulatedTotal = sum(simulatedSegments).
 * 6. Observational language: "projected to change by X% under the simulated scenario".
 */
class ScenarioSimulationService {
  /**
   * Safe number parsing
   */
  _toNum(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Run deterministic counterfactual simulation on an attribution driver set
   * 
   * @param {object} params
   * @param {Array<object>} params.baselineDrivers - Array of { segment, currentValue (or baselineValue) }
   * @param {Array<object>} params.adjustments - Array of { segment: string, deltaPercent?: number, deltaAbsolute?: number }
   * @param {object} [params.context] - Metadata { metric, dimension, insightId }
   * @returns {object} Deterministic counterfactual simulation result
   */
  simulate({
    baselineDrivers = [],
    adjustments = [],
    context = {}
  }) {
    if (!Array.isArray(baselineDrivers) || baselineDrivers.length === 0) {
      throw new Error('Baseline drivers array is required to run counterfactual simulation.');
    }

    const metricName = context.metric || 'metric';
    const dimensionName = context.dimension || 'dimension';
    const adjustmentMap = new Map();

    if (Array.isArray(adjustments)) {
      for (const adj of adjustments) {
        if (adj && adj.segment) {
          adjustmentMap.set(String(adj.segment).trim().toLowerCase(), adj);
        }
      }
    }

    let baselineTotal = 0;
    let simulatedTotal = 0;
    let anyClamped = false;

    const segmentBreakdown = baselineDrivers.map(driver => {
      const segment = String(driver.segment || 'Unknown').trim();
      // Use currentValue as baseline for forward-looking what-if simulation (or baselineValue if specified)
      const baseVal = this._toNum(driver.currentValue ?? driver.baselineValue ?? 0);
      baselineTotal += baseVal;

      const adj = adjustmentMap.get(segment.toLowerCase());
      let simulatedVal = baseVal;
      let deltaPercent = 0;
      let deltaAbsolute = 0;
      let clampedAtZero = false;

      if (adj) {
        if (adj.deltaPercent !== undefined && adj.deltaPercent !== null) {
          deltaPercent = Number(Number(adj.deltaPercent).toFixed(2));
          deltaAbsolute = Number((baseVal * (deltaPercent / 100)).toFixed(2));
          simulatedVal = baseVal + deltaAbsolute;
        } else if (adj.deltaAbsolute !== undefined && adj.deltaAbsolute !== null) {
          deltaAbsolute = Number(Number(adj.deltaAbsolute).toFixed(2));
          simulatedVal = baseVal + deltaAbsolute;
          deltaPercent = baseVal !== 0 ? Number(((deltaAbsolute / baseVal) * 100).toFixed(2)) : 0;
        }

        // Bounded constraint: Financial/operational metrics cannot drop below 0
        if (simulatedVal < 0) {
          simulatedVal = 0;
          clampedAtZero = true;
          anyClamped = true;
          deltaAbsolute = -baseVal;
          deltaPercent = baseVal !== 0 ? -100.0 : 0;
        }
      }

      simulatedVal = Number(simulatedVal.toFixed(2));
      simulatedTotal += simulatedVal;

      const netDelta = Number((simulatedVal - baseVal).toFixed(2));

      return {
        segment,
        baselineValue: baseVal,
        simulatedValue: simulatedVal,
        netDelta,
        adjustmentPercent: deltaPercent,
        adjustmentAbsolute: deltaAbsolute,
        isAdjusted: Boolean(adj),
        clampedAtZero
      };
    });

    baselineTotal = Number(baselineTotal.toFixed(2));
    simulatedTotal = Number(simulatedTotal.toFixed(2));
    const netProjectedDelta = Number((simulatedTotal - baselineTotal).toFixed(2));
    const netProjectedPercent = baselineTotal !== 0
      ? Number(((netProjectedDelta / baselineTotal) * 100).toFixed(2))
      : 0;

    // Construct strictly observational counterfactual summary
    const adjustedCount = segmentBreakdown.filter(s => s.isAdjusted).length;
    let observationalSummary = '';

    if (adjustedCount === 0) {
      observationalSummary = `Zero parameter adjustments applied. Counterfactual projection equals verified baseline of ${baselineTotal.toLocaleString()}.`;
    } else {
      const topAdj = segmentBreakdown.find(s => s.isAdjusted);
      const signStr = netProjectedDelta >= 0 ? '+' : '';
      observationalSummary = `Counterfactual projection across ${adjustedCount} adjusted segment(s) yields a simulated total ${metricName} of ${simulatedTotal.toLocaleString()} (${signStr}${netProjectedPercent}% net projected difference over baseline).`;
      if (anyClamped) {
        observationalSummary += ` One or more downward adjustments were bounded to 0 to prevent negative values.`;
      }
    }

    return {
      simulationId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      classification: 'COUNTERFACTUAL_SIMULATION',
      isCounterfactual: true,
      immutableDatasetPreserved: true,
      metric: metricName,
      dimension: dimensionName,
      insightId: context.insightId ? String(context.insightId) : null,
      baselineTotal,
      simulatedTotal,
      netProjectedDelta,
      netProjectedPercent,
      adjustmentsApplied: adjustedCount,
      anyClampedAtZero: anyClamped,
      segmentBreakdown,
      observationalSummary,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Run deterministic financial counterfactual simulation on revenue and cost levers
   * 
   * @param {object} params
   * @param {number} params.baselineRevenue - Baseline revenue amount
   * @param {number} [params.baselineCost] - Baseline cost (COGS + Opex)
   * @param {number} [params.baselineUnits] - Baseline volume/units
   * @param {boolean} [params.hasCostColumn] - Whether cost was directly derived from a dataset column
   * @param {object} [params.levers] - { priceChangePct, volumeChangePct, cogsChangePct, opexChangePct, conversionChangePct }
   * @param {object} [params.context] - Metadata { datasetId, datasetName, insightId }
   * @returns {object} Deterministic financial simulation result
   */
  simulateFinancialLevers({
    baselineRevenue = 0,
    baselineCost = 0,
    baselineUnits = 0,
    hasCostColumn = true,
    levers = {},
    context = {}
  }) {
    const baseRev = Math.max(0, this._toNum(baselineRevenue, 0));
    let baseCost = this._toNum(baselineCost, 0);
    if (baseCost <= 0) {
      // Default to conservative 65% COGS baseline if cost is unknown
      baseCost = Number((baseRev * 0.65).toFixed(2));
    }
    const baseUnits = Math.max(0, this._toNum(baselineUnits, 1));

    const priceChangePct = this._toNum(levers.priceChangePct ?? levers.price_change_pct, 0);
    const volumeChangePct = this._toNum(levers.volumeChangePct ?? levers.volume_change_pct, 0);
    const conversionChangePct = this._toNum(levers.conversionChangePct ?? levers.conversion_change_pct, 0);
    const cogsChangePct = this._toNum(levers.cogsChangePct ?? levers.cogs_change_pct, 0);
    const opexChangePct = this._toNum(levers.opexChangePct ?? levers.opex_change_pct, 0);

    const priceFactor = 1.0 + (priceChangePct / 100.0);
    const effVolumeFactor = (1.0 + (volumeChangePct / 100.0)) * (1.0 + (conversionChangePct / 100.0));
    const cogsFactor = 1.0 + (cogsChangePct / 100.0);
    const opexFactor = 1.0 + (opexChangePct / 100.0);

    // Baseline profitability
    const baseProfit = Number((baseRev - baseCost).toFixed(2));
    const baseMarginPct = baseRev > 0 ? Number(((baseProfit / baseRev) * 100).toFixed(2)) : 0;

    // Simulated revenue = Baseline Revenue * (1 + Price%) * (1 + Volume%)
    const simulatedRevenue = Number(Math.max(0, baseRev * priceFactor * effVolumeFactor).toFixed(2));

    // Split baseline cost into variable (COGS ~ 80%) and fixed (Opex ~ 20%)
    const baseCOGS = Number((baseCost * 0.80).toFixed(2));
    const baseOpex = Number((baseCost * 0.20).toFixed(2));

    // Variable costs scale with volume and COGS factor
    const simulatedCOGS = Number(Math.max(0, baseCOGS * cogsFactor * effVolumeFactor).toFixed(2));
    // Operating expenses scale with Opex factor (overhead, largely independent of volume)
    const simulatedOpex = Number(Math.max(0, baseOpex * opexFactor).toFixed(2));
    const simulatedCost = Number((simulatedCOGS + simulatedOpex).toFixed(2));

    const simulatedProfit = Number((simulatedRevenue - simulatedCost).toFixed(2));
    const simulatedMarginPct = simulatedRevenue > 0
      ? Number(((simulatedProfit / simulatedRevenue) * 100).toFixed(2))
      : 0;
    const simulatedUnits = Math.max(0, Math.round(baseUnits * effVolumeFactor));

    // Deltas
    const revenueDelta = Number((simulatedRevenue - baseRev).toFixed(2));
    const revenueDeltaPct = baseRev > 0 ? Number(((revenueDelta / baseRev) * 100).toFixed(2)) : 0;

    const costDelta = Number((simulatedCost - baseCost).toFixed(2));
    const costDeltaPct = baseCost > 0 ? Number(((costDelta / baseCost) * 100).toFixed(2)) : 0;

    const profitDelta = Number((simulatedProfit - baseProfit).toFixed(2));
    const profitDeltaPct = baseProfit !== 0 ? Number(((profitDelta / Math.abs(baseProfit)) * 100).toFixed(2)) : 0;

    const marginDeltaPct = Number((simulatedMarginPct - baseMarginPct).toFixed(2));

    const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

    let narrative = `Under the simulated scenario (Price: ${sign(priceChangePct)}%, Volume: ${sign(volumeChangePct)}%, COGS: ${sign(cogsChangePct)}%, Opex: ${sign(opexChangePct)}%), `;
    narrative += `projected revenue shifts to ₹${simulatedRevenue.toLocaleString()} (${sign(revenueDeltaPct)}%), `;
    narrative += `resulting in gross profit of ₹${simulatedProfit.toLocaleString()} (${sign(profitDeltaPct)}%) `;
    narrative += `and an adjusted gross margin of ${simulatedMarginPct}% (${sign(marginDeltaPct)} pp variance over baseline).`;

    return {
      simulationId: `sim_fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      classification: 'COUNTERFACTUAL_FINANCIAL_SIMULATION',
      isCounterfactual: true,
      immutableDatasetPreserved: true,
      datasetId: context.datasetId || null,
      datasetName: context.datasetName || 'Dataset',
      insightId: context.insightId ? String(context.insightId) : null,
      levers: {
        priceChangePct,
        volumeChangePct,
        conversionChangePct,
        cogsChangePct,
        opexChangePct
      },
      baseline: {
        revenue: baseRev,
        cost: baseCost,
        grossProfit: baseProfit,
        grossMarginPct: baseMarginPct,
        units: baseUnits,
        hasCostColumn
      },
      simulated: {
        revenue: simulatedRevenue,
        cost: simulatedCost,
        grossProfit: simulatedProfit,
        grossMarginPct: simulatedMarginPct,
        units: simulatedUnits
      },
      variance: {
        revenueDelta,
        revenueDeltaPct,
        costDelta,
        costDeltaPct,
        profitDelta,
        profitDeltaPct,
        marginDeltaPct
      },
      // Backwards-compatible aliases for UI components
      metric: 'Revenue & Gross Profit',
      dimension: 'Financial Levers',
      baselineTotal: baseRev,
      simulatedTotal: simulatedRevenue,
      netProjectedDelta: revenueDelta,
      netProjectedPercent: revenueDeltaPct,
      observationalSummary: narrative,
      explanation: narrative,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ScenarioSimulationService();
