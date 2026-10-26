/**
 * Enterprise Client Password Security & Strength Estimation Utility — RicozAnalytics
 * Provides real-time strength estimation and guidance for user registration.
 */

const COMMON_PREDICTABLE_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'admin', 'admin123', 'admin1234',
  '123456', '12345678', '123456789', '1234567890', 'qwerty', 'qwerty123',
  'letmein', 'welcome', 'welcome1', 'welcome123', 'monkey', 'dragon',
  'football', 'baseball', 'master', 'iloveyou', 'trustno1', 'sunshine',
  'princess', 'solo', 'starwars', 'superman', 'default', 'default123'
]);

/**
 * Check if string contains sequential or repeated patterns
 */
export function isPredictableSequence(str) {
  if (!str || str.length < 4) return true;
  const lower = str.toLowerCase();

  // Pure repetition like "aaaa", "1111"
  if (/^(.)\1+$/.test(lower)) return true;

  // Simple common keyboard runs
  const runs = [
    '0123456789', '9876543210',
    'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
  ];

  for (const run of runs) {
    for (let i = 0; i <= run.length - 4; i++) {
      const slice = run.slice(i, i + 4);
      if (lower.includes(slice)) {
        return true;
      }
    }
  }

  // Common predictable list or root words (e.g. "Password123!", "Admin@2026")
  for (const common of COMMON_PREDICTABLE_PASSWORDS) {
    if (lower.includes(common)) {
      return true;
    }
  }

  // Alpha base check (strip symbols/numbers)
  const alphaOnly = lower.replace(/[^a-z]/g, '');
  if (alphaOnly.length >= 4 && COMMON_PREDICTABLE_PASSWORDS.has(alphaOnly)) {
    return true;
  }

  return false;
}

/**
 * Evaluate password security strength and requirements
 * 
 * @param {string} password 
 * @returns {{
 *   score: number, // 0 to 4
 *   strength: 'weak' | 'moderate' | 'strong',
 *   isValid: boolean,
 *   requirements: {
 *     minLength: boolean,
 *     hasLower: boolean,
 *     hasUpper: boolean,
 *     hasNumber: boolean,
 *     hasSymbol: boolean,
 *     notPredictable: boolean
 *   },
 *   missingRequirements: string[],
 *   feedback: string
 * }}
 */
export function evaluatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return {
      score: 0,
      strength: 'weak',
      isValid: false,
      requirements: {
        minLength: false,
        hasLower: false,
        hasUpper: false,
        hasNumber: false,
        hasSymbol: false,
        notPredictable: false
      },
      missingRequirements: [
        'Add at least 8 characters',
        'Include uppercase and lowercase letters',
        'Include a number',
        'Include a symbol'
      ],
      feedback: 'Password is required and must be at least 8 characters long.'
    };
  }

  const minLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const notPredictable = !isPredictableSequence(password);

  const missing = [];
  if (!minLength) missing.push('Add at least 8 characters');
  if (!hasLower || !hasUpper) missing.push('Include uppercase and lowercase letters');
  if (!hasNumber) missing.push('Include a number');
  if (!hasSymbol) missing.push('Include a symbol (!@#$%^&*)');
  if (!notPredictable) missing.push('Avoid common words or predictable keyboard patterns');

  let categoryCount = 0;
  if (hasLower) categoryCount++;
  if (hasUpper) categoryCount++;
  if (hasNumber) categoryCount++;
  if (hasSymbol) categoryCount++;

  let score = 0;
  if (minLength) score++;
  if (categoryCount >= 3) score++;
  if (categoryCount >= 4) score++;
  if (password.length >= 12 && categoryCount >= 3) score++;
  if (!notPredictable) score = Math.min(score, 1);

  let strength = 'weak';
  if (!minLength || !notPredictable || categoryCount < 2) {
    strength = 'weak';
  } else if (
    (minLength && categoryCount >= 3) ||
    (password.length >= 10 && categoryCount >= 2)
  ) {
    if (
      (password.length >= 10 && categoryCount >= 4 && notPredictable) ||
      (password.length >= 14 && categoryCount >= 3 && notPredictable)
    ) {
      strength = 'strong';
    } else {
      strength = 'moderate';
    }
  } else {
    strength = 'weak';
  }

  const isValid = strength === 'moderate' || strength === 'strong';

  let feedback = '';
  if (!isValid) {
    feedback = 'Weak password: ' + (missing[0] || 'Include more character variety');
  } else if (strength === 'moderate') {
    feedback = 'Moderate strength: meets minimum security requirements.';
  } else {
    feedback = 'Strong password: secure and well-protected.';
  }

  return {
    score,
    strength,
    isValid,
    requirements: {
      minLength,
      hasLower,
      hasUpper,
      hasNumber,
      hasSymbol,
      notPredictable
    },
    missingRequirements: missing,
    feedback
  };
}
