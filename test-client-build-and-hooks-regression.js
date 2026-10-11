/**
 * Regression Test: Verify Client Hook & Identifier Imports
 * Prevents missing React hook imports (e.g., useRef ReferenceError)
 * and verifies that client production build succeeds.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Starting Client Hook & Import Regression Test ---');

const clientSrc = path.join(__dirname, 'client', 'src');
const reactHooks = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect'];
let failures = 0;

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const hook of reactHooks) {
    const hookRegex = new RegExp('\\b' + hook + '\\s*\\(');
    if (hookRegex.test(content)) {
      const importRegex = new RegExp('import\\s+[^;]*\\b' + hook + '\\b[^;]*from\\s+[\'"]react[\'"]');
      const reactDotRegex = new RegExp('React\\.' + hook + '\\s*\\(');
      const localDefRegex = new RegExp('(?:function|const|let|var)\\s+' + hook + '\\b');

      if (!importRegex.test(content) && !reactDotRegex.test(content) && !localDefRegex.test(content)) {
        console.error(`[FAIL] Missing '${hook}' import in ${path.relative(__dirname, filePath)}`);
        failures++;
      }
    }
  }
}

function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      checkFile(fullPath);
    }
  }
}

walk(clientSrc);

if (failures > 0) {
  console.error(`\nTest failed with ${failures} missing hook import(s).`);
  process.exit(1);
}

console.log('✓ All client React hook usages are correctly imported from "react".');

// Verify DashboardPage bundle compilation
try {
  console.log('Building client production bundle...');
  execSync('npm run build', { cwd: path.join(__dirname, 'client'), stdio: 'pipe' });
  console.log('✓ Client production build succeeded.');
} catch (err) {
  console.error('[FAIL] Client build failed:', err.message);
  process.exit(1);
}

// Verify compiled bundle does not have unbound global useRef
const distAssets = path.join(__dirname, 'client', 'dist', 'assets');
const dashFile = fs.readdirSync(distAssets).find(f => f.startsWith('DashboardPage-') && f.endsWith('.js'));
if (!dashFile) {
  console.error('[FAIL] DashboardPage bundle not found in dist/assets');
  process.exit(1);
}

const dashContent = fs.readFileSync(path.join(distAssets, dashFile), 'utf8');
if (dashContent.includes('useRef(0)') && !dashContent.includes('.useRef(0)')) {
  console.error('[FAIL] Found unbound global useRef(0) in compiled Dashboard bundle');
  process.exit(1);
}

console.log(`✓ Dashboard bundle ${dashFile} verified: useRef is safely bound to React.`);
console.log('--- All Client Import & Build Regression Tests Passed! ---');
process.exit(0);
