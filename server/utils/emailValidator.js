const dns = require('dns');

/**
 * Enterprise Email Validation, Normalization, and Deliverability Safeguard
 * Prevents transactional email bounces by enforcing RFC 5322 compliance,
 * disposable domain detection, test domain interception, and DNS MX record verification.
 */

// In-memory DNS MX cache: domain -> { hasMx: boolean, timestamp: number }
const mxCache = new Map();
const MX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Strict RFC 5322 compatible email regex
const RFC_5322_REGEX = /^(?:[a-zA-Z0-9_'^&/+-])+(?:\.(?:[a-zA-Z0-9_'^&/+-])+)*@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}|\[(?:[0-9]{1,3}\.){3}[0-9]{1,3}\])$/;

// Known disposable email provider domains
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'sharklasers.com',
  'getairmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'trashmail.com',
  'nada.ltd',
  'mohmal.com'
]);

// Known non-routable, dummy, or test domains that must never receive live outbound mail
const TEST_AND_PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.local',
  'test.org',
  'ricoz.test',
  'ricoztest.com',
  'invalid',
  'localhost',
  'test'
]);

/**
 * Normalize an email address:
 * - Trims whitespace
 * - Strips invisible / zero-width Unicode characters
 * - Converts to lowercase
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars
    .trim()
    .toLowerCase();
}

/**
 * Extract domain part from normalized email
 * @param {string} email
 * @returns {string}
 */
function extractDomain(email) {
  const clean = normalizeEmail(email);
  const parts = clean.split('@');
  return parts.length === 2 ? parts[1].trim() : '';
}

/**
 * Strict syntax validation
 * @param {string} email
 * @returns {boolean}
 */
function isValidSyntax(email) {
  const clean = normalizeEmail(email);
  if (!clean || clean.length > 254) return false;
  
  const [localPart, domainPart] = clean.split('@');
  if (!localPart || !domainPart) return false;
  if (localPart.length > 64) return false;

  // Domain cannot start or end with a hyphen or dot
  if (domainPart.startsWith('-') || domainPart.endsWith('-') || domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return false;
  }

  // Domain must contain at least one dot separating labels
  const labels = domainPart.split('.');
  if (labels.length < 2) return false;
  
  // TLD must be at least 2 alpha characters
  const tld = labels[labels.length - 1];
  if (!/^[a-zA-Z]{2,63}$/.test(tld)) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }

  return RFC_5322_REGEX.test(clean);
}

/**
 * Check if the email domain is a known disposable provider
 * @param {string} email
 * @returns {boolean}
 */
function isDisposableDomain(email) {
  const domain = extractDomain(email);
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if the email domain or username indicates a placeholder or test account
 * @param {string} email
 * @returns {boolean}
 */
function isTestOrPlaceholderEmail(email) {
  const clean = normalizeEmail(email);
  const domain = extractDomain(clean);
  const [user] = clean.split('@');

  if (TEST_AND_PLACEHOLDER_DOMAINS.has(domain)) return true;
  if (domain.endsWith('.test') || domain.endsWith('.invalid') || domain.endsWith('.localhost') || domain.endsWith('.local')) {
    return true;
  }

  if (user && (
    user.startsWith('test_') ||
    user.startsWith('otp_test_') ||
    user.startsWith('brevo_verify_') ||
    user.startsWith('testuser') ||
    user.startsWith('enterprise_tester') ||
    user.includes('.invite.test.')
  )) {
    return true;
  }

  return false;
}

/**
 * Verify DNS MX records for domain with cached results and fallback
 * @param {string} email
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<{ hasMx: boolean, mxRecords?: Array<any>, reason?: string }>}
 */
async function verifyDomainMx(email, timeoutMs = 2000) {
  const domain = extractDomain(email);
  if (!domain) {
    return { hasMx: false, reason: 'Invalid or missing domain' };
  }

  // If in test environment or mock email enabled, bypass network DNS if domain is a test domain
  if (isTestOrPlaceholderEmail(email)) {
    return { hasMx: true, isTestDomain: true };
  }

  // Check in-memory cache
  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && (now - cached.timestamp < MX_CACHE_TTL_MS)) {
    return { hasMx: cached.hasMx, reason: cached.reason };
  }

  // DNS MX resolution with timeout
  try {
    const mxPromise = dns.promises.resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs)
    );

    const records = await Promise.race([mxPromise, timeoutPromise]);
    
    if (Array.isArray(records) && records.length > 0) {
      mxCache.set(domain, { hasMx: true, timestamp: now });
      return { hasMx: true, mxRecords: records };
    }

    // Fallback: Check if domain has an A record (some legacy mail servers accept mail on A record)
    try {
      const aRecords = await dns.promises.resolve4(domain);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        mxCache.set(domain, { hasMx: true, timestamp: now });
        return { hasMx: true, fallbackA: true };
      }
    } catch (_) {}

    mxCache.set(domain, { hasMx: false, reason: 'Domain has no MX or A records configured for mail delivery', timestamp: now });
    return { hasMx: false, reason: 'Domain has no MX or A records configured for mail delivery' };
  } catch (err) {
    // If ENOTFOUND or ENODATA, domain does not exist or has no mail routing
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      mxCache.set(domain, { hasMx: false, reason: `Domain "${domain}" does not exist or has no mail records`, timestamp: now });
      return { hasMx: false, reason: `Domain "${domain}" does not exist or has no mail records` };
    }

    // In case of DNS timeout or SERVFAIL on client network, allow fallback to prevent blocking legitimate users during transient DNS glitches
    console.warn(`[EmailValidator] DNS MX check notice for "${domain}": ${err.message}. Defaulting to provisional pass.`);
    return { hasMx: true, transientWarning: err.message };
  }
}

/**
 * Validate an email address comprehensively
 * @param {string} email
 * @param {{ checkMx?: boolean, allowTestDomains?: boolean }} options
 * @returns {Promise<{ isValid: boolean, normalized: string, error?: string, code?: string }>}
 */
async function validateEmail(email, { checkMx = false, allowTestDomains = false } = {}) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return {
      isValid: false,
      normalized: '',
      code: 'EMAIL_REQUIRED',
      error: 'Email address is required.'
    };
  }

  if (!isValidSyntax(normalized)) {
    return {
      isValid: false,
      normalized,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'Please enter a valid email address (e.g., name@company.com).'
    };
  }

  if (isDisposableDomain(normalized)) {
    return {
      isValid: false,
      normalized,
      code: 'DISPOSABLE_EMAIL_REJECTED',
      error: 'Disposable or temporary email addresses are not accepted for enterprise accounts.'
    };
  }

  if (!allowTestDomains && isTestOrPlaceholderEmail(normalized) && process.env.NODE_ENV === 'production') {
    return {
      isValid: false,
      normalized,
      code: 'TEST_DOMAIN_REJECTED',
      error: 'Test or placeholder email domains cannot be used in production.'
    };
  }

  if (checkMx) {
    const mxResult = await verifyDomainMx(normalized);
    if (!mxResult.hasMx) {
      return {
        isValid: false,
        normalized,
        code: 'DOMAIN_CANNOT_RECEIVE_MAIL',
        error: mxResult.reason || 'The domain specified does not have active mail servers (MX records) configured.'
      };
    }
  }

  return {
    isValid: true,
    normalized
  };
}

module.exports = {
  normalizeEmail,
  extractDomain,
  isValidSyntax,
  isDisposableDomain,
  isTestOrPlaceholderEmail,
  verifyDomainMx,
  validateEmail
};
