/**
 * Enterprise Billing Date & Timing Utilities — RicozAnalytics
 * Provides authoritative calendar-month and calendar-year billing calculations
 * and exact 14 × 24h free-trial timing.
 * 
 * Guarantees:
 * 1. True calendar arithmetic: Never replaces calendar months or years with fixed 30-day or 365-day durations.
 * 2. Month-end clamping: Jan 31 monthly billing dates land on Feb 28 (or Feb 29 in leap years),
 *    Mar 31 lands on Apr 30, etc., while preserving the exact time and UTC timezone.
 * 3. Leap-year handling: Feb 29 annual billing dates land on Feb 28 in non-leap years.
 * 4. Exact 14-day trial calculation: Ends exactly 14 × 24 hours (1,209,600,000 ms) after start.
 */

/**
 * Calculate the next billing period boundary using calendar-month and calendar-year arithmetic.
 * Never uses fixed 30-day or 365-day approximations.
 * 
 * @param {Date|string|number} startDate - Starting timestamp of the period
 * @param {'monthly'|'yearly'|'annual'} [interval='monthly'] - Billing cadence
 * @returns {Date}
 */
function calculateNextBillingDate(startDate, interval = 'monthly') {
  const d = startDate ? new Date(startDate) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error('Invalid startDate provided for billing date calculation');
  }

  const isAnnual = interval === 'yearly' || interval === 'annual';
  const startYear = d.getUTCFullYear();
  const startMonth = d.getUTCMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const startDay = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();

  if (isAnnual) {
    const targetYear = startYear + 1;
    const targetMonth = startMonth;
    // Calculate last day of target month (e.g. Feb 29 -> Feb 28 in non-leap year)
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(startDay, daysInTargetMonth);
    return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
  } else {
    // Monthly calculation
    const totalMonths = startMonth + 1;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = totalMonths % 12;
    // Calculate last day of target month (day 0 of next month is the last day of targetMonth)
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(startDay, daysInTargetMonth);
    return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
  }
}

/**
 * Calculate free trial end timestamp: exactly 14 × 24 hours (1,209,600,000 ms) in UTC.
 * @param {Date|string|number} startDate 
 * @param {number} [durationDays=14] 
 * @returns {Date}
 */
function calculateTrialEndDate(startDate, durationDays = 14) {
  const d = startDate ? new Date(startDate) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error('Invalid startDate provided for trial end calculation');
  }
  return new Date(d.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

/**
 * Calculate accurate countdown remaining time in days and hours from an authoritative end timestamp.
 * @param {Date|string|number} endDate 
 * @param {Date|string|number} [nowDate=new Date()]
 * @returns {{ isExpired: boolean, msRemaining: number, daysRemaining: number, hoursRemaining: number }}
 */
function calculateTimeRemaining(endDate, nowDate = new Date()) {
  const end = new Date(endDate);
  const now = new Date(nowDate);
  const msRemaining = end.getTime() - now.getTime();

  if (msRemaining <= 0) {
    return {
      isExpired: true,
      msRemaining: 0,
      daysRemaining: 0,
      hoursRemaining: 0
    };
  }

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));

  return {
    isExpired: false,
    msRemaining,
    daysRemaining,
    hoursRemaining
  };
}

module.exports = {
  calculateNextBillingDate,
  calculateTrialEndDate,
  calculateTimeRemaining
};
