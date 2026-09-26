/**
 * Enterprise AI Insight Prioritization & Ranking Engine
 * Deterministically evaluates verified evidence and metadata to compute:
 * - impactScore (0-100)
 * - priority ('critical' | 'high' | 'medium' | 'low')
 * - severity ('critical' | 'high' | 'medium' | 'low' | 'info')
 * - priorityReason (explainable, deterministic derivation)
 * 
 * Strict Invariants:
 * - Uses ONLY existing verified evidence and metadata.
 * - Does NOT use Gemini or any LLM to calculate scores or severity.
 * - Deterministic, mathematical, and 100% explainable.
 */
class InsightPrioritizationService {
  /**
   * Helper to safely parse numbers
   */
  _toNum(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Calculate deterministic priority, severity, impact score, and priority reason for an insight
   * @param {object} insight 
   * @returns {{
   *   impactScore: number,
   *   priority: 'critical'|'high'|'medium'|'low',
   *   severity: 'critical'|'high'|'medium'|'low'|'info',
   *   priorityReason: string
   * }}
   */
  calculateInsightPriority(insight) {
    if (!insight) {
      return {
        impactScore: 0,
        priority: 'low',
        severity: 'info',
        priorityReason: 'No telemetry available for evaluation.'
      };
    }

    const type = String(insight.type || '').toLowerCase();
    const evidence = insight.evidence || {};
    const meta = insight.source_metadata || {};
    const metric = String(evidence.metric || meta.metric_name || '').toLowerCase();
    const changePercent = this._toNum(evidence.changePercent ?? evidence.change_percent, 0);
    const records = this._toNum(evidence.recordsAnalyzed ?? evidence.records_analyzed, 0);
    const isVerified = Boolean(evidence.verified === true);

    let baseScore = 50;
    const scoreFactors = [];

    // 1. Evaluate by Insight Type & Severity
    switch (type) {
      case 'operational': {
        baseScore = 75;
        const condition = evidence.condition || 'breached';
        const threshold = evidence.threshold ?? evidence.comparisonValue;
        scoreFactors.push(`Operational alert trigger (${condition} ${threshold})`);

        if (insight.severity === 'critical') {
          baseScore += 15;
          scoreFactors.push('Critical alert severity level');
        } else {
          baseScore += 5;
        }
        break;
      }

      case 'anomaly': {
        const anomCount = this._toNum(evidence.anomalyCount ?? evidence.anomaly_count, 1);
        baseScore = 70;
        scoreFactors.push(`${anomCount} statistical time-series outlier(s) detected`);
        if (anomCount >= 3) {
          baseScore += 15;
          scoreFactors.push('Cluster of 3+ anomalous deviations');
        } else if (anomCount > 1) {
          baseScore += 8;
        }
        break;
      }

      case 'decline': {
        const absChange = Math.abs(changePercent);
        baseScore = 60;
        scoreFactors.push(`Negative contraction velocity (-${absChange.toFixed(1)}%)`);

        if (absChange >= 25) {
          baseScore += 25;
          scoreFactors.push('Severe contraction exceeding 25%');
        } else if (absChange >= 15) {
          baseScore += 15;
          scoreFactors.push('Substantial decline exceeding 15%');
        } else {
          baseScore += Math.round(absChange * 0.8);
        }
        break;
      }

      case 'growth': {
        baseScore = 55;
        scoreFactors.push(`Positive expansion velocity (+${changePercent.toFixed(1)}%)`);

        if (changePercent >= 30) {
          baseScore += 20;
          scoreFactors.push('Rapid high-growth velocity exceeding 30%');
        } else if (changePercent >= 15) {
          baseScore += 12;
          scoreFactors.push('Solid growth velocity exceeding 15%');
        } else {
          baseScore += Math.round(changePercent * 0.5);
        }
        break;
      }

      case 'data_quality': {
        const qScore = this._toNum(evidence.quality_score, 100);
        const nulls = this._toNum(evidence.nullCount ?? evidence.null_count, 0);
        const dups = this._toNum(evidence.duplicateCount ?? evidence.duplicate_count, 0);

        if (qScore < 60) {
          baseScore = 80;
          scoreFactors.push(`Critical data health score (${qScore}/100)`);
        } else if (qScore < 75) {
          baseScore = 65;
          scoreFactors.push(`Degraded data health score (${qScore}/100)`);
        } else {
          baseScore = 35;
          scoreFactors.push(`High data health score (${qScore}/100) passing verification`);
        }

        if (evidence.status === 'stale' || evidence.age_hours > 72) {
          baseScore += 12;
          scoreFactors.push('Dataset ingestion stale (>72 hours)');
        }
        if (nulls > 0 || dups > 0) {
          baseScore += Math.min(8, (nulls > 0 ? 4 : 0) + (dups > 0 ? 4 : 0));
        }
        break;
      }

      case 'forecast': {
        baseScore = 52;
        const predChange = this._toNum(evidence.predictedChangePercent ?? evidence.predicted_change_percent, 0);
        if (predChange <= -15) {
          baseScore += 20;
          scoreFactors.push(`Downside predictive projection (-${Math.abs(predChange).toFixed(1)}%)`);
        } else if (predChange >= 15) {
          baseScore += 10;
          scoreFactors.push(`Upside predictive projection (+${predChange.toFixed(1)}%)`);
        } else {
          scoreFactors.push('Forward horizon trajectory evaluated');
        }
        break;
      }

      case 'trend': {
        baseScore = 50;
        const periods = this._toNum(evidence.consecutivePeriods ?? evidence.consecutive_periods, 4);
        if (insight.severity === 'warning' || insight.title?.toLowerCase().includes('downward')) {
          baseScore += 18;
          scoreFactors.push(`Sustained downward trajectory across ${periods} periods`);
        } else {
          baseScore += 10;
          scoreFactors.push(`Sustained directional expansion across ${periods} periods`);
        }
        break;
      }

      case 'relationship': {
        baseScore = 48;
        scoreFactors.push('Multi-dataset relational alignment verified');
        break;
      }

      default:
        baseScore = 45;
        scoreFactors.push('Standard organizational telemetry observation');
    }

    // 2. Metric Importance Boost
    if (metric.includes('revenue') || metric.includes('sales') || metric.includes('profit') || metric.includes('margin')) {
      baseScore += 10;
      scoreFactors.push(`Primary financial metric (${metric})`);
    } else if (metric.includes('order') || metric.includes('unit') || metric.includes('customer')) {
      baseScore += 5;
      scoreFactors.push(`Core business volume metric (${metric})`);
    }

    // 3. Data Volume / Record Confidence Weight
    if (records >= 100) {
      baseScore += 5;
      scoreFactors.push(`High statistical sample (${records} records)`);
    } else if (records >= 20) {
      baseScore += 3;
    }

    // 4. Verification Check
    if (!isVerified) {
      baseScore = Math.min(25, baseScore);
      scoreFactors.unshift('Unverified evidence penalization');
    }

    // Clamp impact score strictly to [0, 100]
    const impactScore = Math.max(0, Math.min(100, Math.round(baseScore)));

    // 5. Derive Priority, Severity, and Reason
    let priority = 'low';
    let severity = 'info';

    if (impactScore >= 80) {
      priority = 'critical';
      severity = 'critical';
    } else if (impactScore >= 65) {
      priority = 'high';
      severity = 'high';
    } else if (impactScore >= 50) {
      priority = 'medium';
      severity = 'medium';
    } else if (impactScore >= 30) {
      priority = 'low';
      severity = 'low';
    } else {
      priority = 'low';
      severity = 'info';
    }

    // Compose explainable priority reason
    const priorityReason = scoreFactors.length > 0
      ? `Impact score ${impactScore}/100 (${priority.toUpperCase()} priority) driven by: ${scoreFactors.join('; ')}.`
      : `Impact score ${impactScore}/100 (${priority.toUpperCase()} priority) based on baseline telemetry.`;

    return {
      impactScore,
      priority,
      severity,
      priorityReason
    };
  }

  /**
   * Enrich an insight object with deterministic prioritization fields
   * @param {object} insight 
   * @returns {object}
   */
  enrichInsight(insight) {
    if (!insight) return insight;

    const { impactScore, priority, severity, priorityReason } = this.calculateInsightPriority(insight);

    const enriched = {
      ...insight,
      priority,
      impactScore,
      impact_score: impactScore,
      priorityReason,
      priority_reason: priorityReason
    };

    // Store within evidence for persistent immutability
    if (enriched.evidence && typeof enriched.evidence === 'object') {
      enriched.evidence = {
        ...enriched.evidence,
        priority,
        severity,
        impactScore,
        impact_score: impactScore,
        priorityReason,
        priority_reason: priorityReason
      };
    }

    return enriched;
  }

  /**
   * Sort insights deterministically by impact score descending, then created_at descending
   * @param {Array<object>} insights 
   * @returns {Array<object>}
   */
  rankInsights(insights = []) {
    if (!Array.isArray(insights) || insights.length === 0) return [];

    const priorityWeight = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    return [...insights].sort((a, b) => {
      // 1. Primary sort: Impact score (descending)
      const scoreA = this._toNum(a.impactScore ?? a.impact_score ?? a.evidence?.impact_score, 0);
      const scoreB = this._toNum(b.impactScore ?? b.impact_score ?? b.evidence?.impact_score, 0);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // 2. Secondary sort: Priority weight
      const pWeightA = priorityWeight[String(a.priority || a.evidence?.priority).toLowerCase()] || 0;
      const pWeightB = priorityWeight[String(b.priority || b.evidence?.priority).toLowerCase()] || 0;
      if (pWeightB !== pWeightA) {
        return pWeightB - pWeightA;
      }

      // 3. Tertiary sort: Creation timestamp (descending)
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }
}

module.exports = new InsightPrioritizationService();
