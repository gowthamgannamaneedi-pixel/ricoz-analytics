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
}

module.exports = new ScenarioSimulationService();
