import { evaluatePasswordStrength, isPredictableSequence } from './src/utils/passwordSecurity.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log('--- Client Password Security & Strength Tests ---');

// 1. Weak passwords
const weak1 = evaluatePasswordStrength('short');
assert(!weak1.isValid && weak1.strength === 'weak', 'Rejects short password');

const weak2 = evaluatePasswordStrength('password123');
assert(!weak2.isValid && weak2.strength === 'weak', 'Rejects predictable password (password123)');

const weak3 = evaluatePasswordStrength('qwerty1234!');
assert(!weak3.isValid && weak3.strength === 'weak', 'Rejects predictable keyboard run (qwerty1234!)');

// 2. Moderate and Strong passwords
const mod = evaluatePasswordStrength('Security#2026');
assert(mod.isValid && mod.strength !== 'weak', 'Accepts moderate password (Security#2026)');

const str = evaluatePasswordStrength('Enterprise#Alpha2026!X9');
assert(str.isValid && str.strength === 'strong', 'Accepts strong password (Enterprise#Alpha2026!X9)');

// 3. Guidance checklist
assert(weak1.missingRequirements.length > 0, 'Guidance provided for missing requirements');

console.log(`\nClient Verification Result: ${passed} PASSED, ${failed} FAILED\n`);
process.exit(failed > 0 ? 1 : 0);
