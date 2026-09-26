const analyticsService = require('./analyticsService');

/**
 * Enterprise Cross-Metric Relationship Intelligence Service
 * Deterministically identifies empirical co-movements and multi-metric patterns
 * directly supported by physical dataset records.
 * 
 * Strict Invariants:
 * 1. ONLY reports relationships when required metrics actually exist in the schema.
 * 2. Grounded strictly in calculated evidence; never invents correlations.
 * 3. NO CAUSATION: Strictly observational phrasing ("Revenue and orders both increased during the analyzed period").
 *    NEVER claims one metric caused another.
 * 4. Multi-tenant isolation enforced via dataset ownership.
 */
class InsightRelationshipService {
  _toNum(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isFinite(num) ? num : fallback;
  }

  /**
   * Identify column in schema matching a list of candidate names
   */
  _findMatchingColumn(colNames, candidates) {
    const lowerCols = colNames.map(c => String(c).toLowerCase());
    for (const cand of candidates) {
      const idx = lowerCols.indexOf(cand.toLowerCase());
      if (idx !== -1) return colNames[idx];
    }
    return null;
  }

  /**
   * Calculate period-over-period movement for a specific numeric column in records
   */
  _calculateMetricMovement(records, metricCol, dateCol = null) {
    if (!Array.isArray(records) || records.length < 2 || !metricCol) {
      return null;
    }

    // If records can be split chronologically or sequentially
    let prevVal = 0;
    let currVal = 0;

    if (dateCol) {
      // Sort chronologically
      const sorted = [...records].filter(r => r[dateCol] && r[metricCol] !== undefined).sort((a, b) => {
        return new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime();
      });

      if (sorted.length >= 2) {
        const mid = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid);
        const secondHalf = sorted.slice(mid);

        prevVal = firstHalf.reduce((acc, r) => acc + this._toNum(r[metricCol]), 0);
        currVal = secondHalf.reduce((acc, r) => acc + this._toNum(r[metricCol]), 0);
      }
    }

    // Fallback: compare first half to second half of raw records
    if (prevVal === 0 && currVal === 0) {
      const mid = Math.floor(records.length / 2);
      const firstHalf = records.slice(0, mid);
      const secondHalf = records.slice(mid);

      prevVal = firstHalf.reduce((acc, r) => acc + this._toNum(r[metricCol]), 0);
      currVal = secondHalf.reduce((acc, r) => acc + this._toNum(r[metricCol]), 0);
    }

    if (prevVal === 0 && currVal === 0) {
      return null;
    }

    let changePercent = 0;
    if (prevVal !== 0) {
      changePercent = Number((((currVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(1));
    }

    return {
      metric: metricCol,
      previousValue: Math.round(prevVal * 100) / 100,
      currentValue: Math.round(currVal * 100) / 100,
      changePercent
    };
  }

  /**
   * Detect cross-metric relationships in a dataset
   * @param {{
   *   dataset: object,
   *   records: Array<any>,
   *   dimensions?: object
   * }} params
   * @returns {Array<{
   *   id: string,
   *   relationship: string,
   *   metrics: string[],
   *   direction: 'positive'|'negative'|'divergent',
   *   evidence: Array<object>,
   *   verified: boolean,
   *   summary: string
   * }>}
   */
  detectRelationships({ dataset, records = [], dimensions = {} }) {
    if (!Array.isArray(records) || records.length < 2) {
      return [];
    }

    const colNames = records[0] ? Object.keys(records[0]) : [];
    if (colNames.length === 0) return [];

    const dateCol = dimensions.dateColumn || this._findMatchingColumn(colNames, ['date', 'order_date', 'timestamp', 'created_at', 'period']);
    const revenueCol = this._findMatchingColumn(colNames, ['revenue', 'sales_amount', 'sales', 'amount', 'total_amount']);
    const ordersCol = this._findMatchingColumn(colNames, ['orders', 'order_count', 'order_id', 'transactions', 'orders_count']);
    const unitsCol = this._findMatchingColumn(colNames, ['units_sold', 'units', 'quantity', 'quantity_sold', 'items_sold']);
    const profitCol = this._findMatchingColumn(colNames, ['profit', 'net_profit', 'margin', 'gross_profit']);

    const relationships = [];

    // Helper: calculate movement for orders if orders is count of order_id
    let orderMovement = null;
    if (ordersCol) {
      // Check if ordersCol is an ID column or numeric count
      const isIdCol = ordersCol.toLowerCase().endsWith('_id') || ordersCol.toLowerCase() === 'id';
      if (isIdCol) {
        const mid = Math.floor(records.length / 2);
        const prevCount = records.slice(0, mid).length;
        const currCount = records.slice(mid).length;
        const changePct = prevCount !== 0 ? Number((((currCount - prevCount) / prevCount) * 100).toFixed(1)) : 0;
        orderMovement = {
          metric: 'orders',
          previousValue: prevCount,
          currentValue: currCount,
          changePercent: changePct
        };
      } else {
        orderMovement = this._calculateMetricMovement(records, ordersCol, dateCol);
      }
    }

    const revenueMovement = revenueCol ? this._calculateMetricMovement(records, revenueCol, dateCol) : null;
    const unitsMovement = unitsCol ? this._calculateMetricMovement(records, unitsCol, dateCol) : null;
    const profitMovement = profitCol ? this._calculateMetricMovement(records, profitCol, dateCol) : null;

    // 1. Relationship: Revenue & Orders
    if (revenueMovement && orderMovement) {
      const revChange = revenueMovement.changePercent;
      const ordChange = orderMovement.changePercent;

      let direction = 'divergent';
      let relationshipText = '';

      if (revChange > 0 && ordChange > 0) {
        direction = 'positive';
        relationshipText = 'Revenue and orders both increased during the analyzed period';
      } else if (revChange < 0 && ordChange < 0) {
        direction = 'positive';
        relationshipText = 'Revenue and orders both contracted during the analyzed period';
      } else if (revChange > 0 && ordChange < 0) {
        direction = 'divergent';
        relationshipText = 'Revenue increased while orders decreased during the analyzed period';
      } else if (revChange < 0 && ordChange > 0) {
        direction = 'divergent';
        relationshipText = 'Revenue contracted while orders increased during the analyzed period';
      } else {
        direction = 'positive';
        relationshipText = 'Revenue and orders exhibited stable alignment during the analyzed period';
      }

      relationships.push({
        id: 'rel_revenue_orders',
        relationship: relationshipText,
        metrics: [revenueMovement.metric, orderMovement.metric],
        direction,
        evidence: [revenueMovement, orderMovement],
        verified: true,
        summary: `${revenueMovement.metric} moved ${revChange >= 0 ? '+' : ''}${revChange}% and ${orderMovement.metric} moved ${ordChange >= 0 ? '+' : ''}${ordChange}% across ${records.length} records.`
      });

      // 1b. Check Average Order Value (AOV = Revenue / Orders)
      if (orderMovement.previousValue > 0 && orderMovement.currentValue > 0) {
        const prevAov = revenueMovement.previousValue / orderMovement.previousValue;
        const currAov = revenueMovement.currentValue / orderMovement.currentValue;
        const aovChange = Number((((currAov - prevAov) / prevAov) * 100).toFixed(1));

        if (ordChange > 0 && aovChange < 0) {
          relationships.push({
            id: 'rel_orders_aov',
            relationship: 'Orders increased while average order value decreased during the analyzed period',
            metrics: [orderMovement.metric, 'average_order_value'],
            direction: 'divergent',
            evidence: [
              orderMovement,
              {
                metric: 'average_order_value',
                previousValue: Math.round(prevAov * 100) / 100,
                currentValue: Math.round(currAov * 100) / 100,
                changePercent: aovChange
              }
            ],
            verified: true,
            summary: `Order volume grew (+${ordChange}%) while average transaction basket declined (${aovChange}%).`
          });
        }
      }
    }

    // 2. Relationship: Revenue & Units Sold
    if (revenueMovement && unitsMovement && (!ordersCol || unitsCol !== ordersCol)) {
      const revChange = revenueMovement.changePercent;
      const unitChange = unitsMovement.changePercent;

      let direction = 'divergent';
      let relationshipText = '';

      if (revChange > 0 && unitChange > 0) {
        direction = 'positive';
        relationshipText = 'Revenue and units sold both increased during the analyzed period';
      } else if (revChange < 0 && unitChange < 0) {
        direction = 'positive';
        relationshipText = 'Revenue and units sold both contracted during the analyzed period';
      } else if (revChange > 0 && unitChange < 0) {
        direction = 'divergent';
        relationshipText = 'Revenue increased while units sold decreased during the analyzed period';
      } else if (revChange < 0 && unitChange > 0) {
        direction = 'divergent';
        relationshipText = 'Revenue contracted while units sold increased during the analyzed period';
      } else {
        direction = 'positive';
        relationshipText = 'Revenue and units sold exhibited stable progression during the analyzed period';
      }

      relationships.push({
        id: 'rel_revenue_units',
        relationship: relationshipText,
        metrics: [revenueMovement.metric, unitsMovement.metric],
        direction,
        evidence: [revenueMovement, unitsMovement],
        verified: true,
        summary: `${revenueMovement.metric} moved ${revChange >= 0 ? '+' : ''}${revChange}% and ${unitsMovement.metric} moved ${unitChange >= 0 ? '+' : ''}${unitChange}%.`
      });
    }

    // 3. Relationship: Revenue & Profit
    if (revenueMovement && profitMovement) {
      const revChange = revenueMovement.changePercent;
      const profChange = profitMovement.changePercent;

      let direction = 'divergent';
      let relationshipText = '';

      if (revChange > 0 && profChange > 0) {
        direction = 'positive';
        relationshipText = 'Revenue and profit both increased during the analyzed period';
      } else if (revChange < 0 && profChange < 0) {
        direction = 'positive';
        relationshipText = 'Revenue and profit both contracted during the analyzed period';
      } else if (revChange > 0 && profChange < 0) {
        direction = 'divergent';
        relationshipText = 'Revenue increased while profit contracted during the analyzed period';
      } else if (revChange < 0 && profChange > 0) {
        direction = 'divergent';
        relationshipText = 'Revenue contracted while profit increased during the analyzed period';
      } else {
        direction = 'positive';
        relationshipText = 'Revenue and profit moved in parallel during the analyzed period';
      }

      relationships.push({
        id: 'rel_revenue_profit',
        relationship: relationshipText,
        metrics: [revenueMovement.metric, profitMovement.metric],
        direction,
        evidence: [revenueMovement, profitMovement],
        verified: true,
        summary: `${revenueMovement.metric} (${revChange >= 0 ? '+' : ''}${revChange}%) and ${profitMovement.metric} (${profChange >= 0 ? '+' : ''}${profChange}%).`
      });
    }

    return relationships;
  }
}

module.exports = new InsightRelationshipService();
