/**
 * Authoritative Plan Entitlements & Pricing Configuration — RicozAnalytics
 * Source of truth shared between billing, frontend telemetry, and backend authorization.
 */

const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    audience: 'Individuals and small teams',
    regularPriceMonthly: 999,
    priceMonthly: 699,
    discountPercentMonthly: 30,
    regularPriceYearly: 8388,
    priceYearly: 4697,
    priceAnnual: 4697,
    annualSavings: 3691,
    discountPercentYearly: 44,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: '',
    popular: false,
    hasContactSales: false,
    maxDatasets: 10,
    maxUsers: 5,
    description: 'Essential analytics, datasets, and executive reporting for individuals and agile small teams.',
    features: [
      '10 Connected Datasets',
      '5 Team Members',
      'Automated Daily Reports',
      'Standard Email Support'
    ],
    entitlements: {
      maxDatasets: 10,
      maxUsers: 5,
      reports: true,
      automatedReports: true,
      exportFormats: ['csv', 'json', 'pdf'],
      insights: false,
      alerts: false,
      aiQueryPlanner: false,
      customInfrastructure: false,
      prioritySupport: false
    }
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    audience: 'Growing businesses and analytics teams',
    regularPriceMonthly: 2999,
    priceMonthly: 1999,
    discountPercentMonthly: 33,
    regularPriceYearly: 23988,
    priceYearly: 13433,
    priceAnnual: 13433,
    annualSavings: 10555,
    discountPercentYearly: 44,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: '',
    popular: true,
    hasContactSales: false,
    maxDatasets: 50,
    maxUsers: 25,
    description: 'High-performance relational modeling, automated anomaly alerts, and executive AI copilot.',
    features: [
      '50 Connected Datasets',
      '25 Team Members',
      'Executive AI Insights',
      'Real-time Anomaly Alerts',
      'Priority SLA Support'
    ],
    entitlements: {
      maxDatasets: 50,
      maxUsers: 25,
      reports: true,
      automatedReports: true,
      exportFormats: ['csv', 'json', 'pdf', 'excel'],
      insights: true,
      alerts: true,
      aiQueryPlanner: false,
      customInfrastructure: false,
      prioritySupport: true
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Larger organizations requiring advanced governance and support',
    regularPriceMonthly: 9999,
    priceMonthly: 6999,
    discountPercentMonthly: 30,
    regularPriceYearly: 83988,
    priceYearly: 47033,
    priceAnnual: 47033,
    annualSavings: 36955,
    discountPercentYearly: 44,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: ' onwards',
    popular: false,
    hasContactSales: true,
    maxDatasets: -1, // Unlimited
    maxUsers: -1,    // Unlimited
    description: 'Unlimited compute, customized AI query planner, dedicated infrastructure, and 24/7 support.',
    features: [
      'Unlimited Datasets & Warehouses',
      'Unlimited Team Members',
      'Custom AI Query Planner',
      'Dedicated Infrastructure',
      '24/7 Dedicated Support'
    ],
    entitlements: {
      maxDatasets: -1,
      maxUsers: -1,
      reports: true,
      automatedReports: true,
      exportFormats: ['csv', 'json', 'pdf', 'excel', 'raw'],
      insights: true,
      alerts: true,
      aiQueryPlanner: true,
      customInfrastructure: true,
      prioritySupport: true,
      dedicatedSupport247: true
    }
  }
};

const PLAN_HIERARCHY = ['starter', 'growth', 'enterprise'];

/**
 * Normalize and retrieve plan definition
 * @param {string} planId
 * @returns {object}
 */
function getPlan(planId) {
  const normalized = String(planId || 'starter').trim().toLowerCase();
  return PLANS[normalized] || PLANS.starter;
}

/**
 * Check whether a given plan possesses a specific feature entitlement
 * @param {string} planId
 * @param {string} featureKey e.g. 'insights', 'alerts', 'aiQueryPlanner'
 * @returns {boolean}
 */
function hasFeature(planId, featureKey) {
  const plan = getPlan(planId);
  return Boolean(plan.entitlements && plan.entitlements[featureKey]);
}

/**
 * Get numerical limit for a resource (-1 = unlimited)
 * @param {string} planId
 * @param {'maxDatasets'|'maxUsers'} resourceKey
 * @returns {number}
 */
function getLimit(planId, resourceKey) {
  const plan = getPlan(planId);
  if (plan.entitlements && plan.entitlements[resourceKey] !== undefined) {
    return plan.entitlements[resourceKey];
  }
  return plan[resourceKey] !== undefined ? plan[resourceKey] : -1;
}

/**
 * Check if the given usage count is allowed under the plan
 * @param {string} planId
 * @param {'maxDatasets'|'maxUsers'} resourceKey
 * @param {number} currentCount
 * @returns {boolean}
 */
function isWithinLimit(planId, resourceKey, currentCount) {
  const limit = getLimit(planId, resourceKey);
  if (limit === -1) return true; // Unlimited
  return Number(currentCount) < limit;
}

/**
 * Compare two plans in the hierarchy
 * @param {string} planA
 * @param {string} planB
 * @returns {number} -1 if planA < planB, 0 if equal, 1 if planA > planB
 */
function comparePlans(planA, planB) {
  const idxA = PLAN_HIERARCHY.indexOf(String(planA).toLowerCase());
  const idxB = PLAN_HIERARCHY.indexOf(String(planB).toLowerCase());
  if (idxA < idxB) return -1;
  if (idxA > idxB) return 1;
  return 0;
}

/**
 * Returns upgrade guidance object with target plan, required price, and features
 * @param {string} currentPlanId
 * @param {string} requiredFeature
 * @returns {object}
 */
function getUpgradeGuidance(currentPlanId, requiredFeature) {
  const current = getPlan(currentPlanId);
  // Find minimum plan that offers requiredFeature
  const targetPlanKey = PLAN_HIERARCHY.find(pKey => PLANS[pKey].entitlements[requiredFeature]);
  const targetPlan = targetPlanKey ? PLANS[targetPlanKey] : PLANS.enterprise;

  return {
    currentPlan: current.id,
    currentPlanName: current.name,
    targetPlan: targetPlan.id,
    targetPlanName: targetPlan.name,
    requiredFeature,
    upgradeUrl: '/billing',
    priceMonthly: targetPlan.priceMonthly,
    priceYearly: targetPlan.priceYearly,
    currencySymbol: targetPlan.currencySymbol,
    message: `The ${requiredFeature} feature requires the ${targetPlan.name} plan (₹${targetPlan.priceMonthly.toLocaleString('en-IN')}/month). Upgrade your subscription to unlock this feature.`
  };
}

module.exports = {
  PLANS,
  PLAN_HIERARCHY,
  getPlan,
  hasFeature,
  getLimit,
  isWithinLimit,
  comparePlans,
  getUpgradeGuidance
};
