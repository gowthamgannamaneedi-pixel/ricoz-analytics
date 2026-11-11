const langGraphAssistantService = require('../server/services/langGraphAssistantService');
const db = require('../server/config/database');

const datasetsToTest = [
  { id: 391, name: 'Mixed Variance Telemetry', type: 'With Date Column' },
  { id: 393, name: 'Enterprise Customer Directory', type: 'Without Date Column' },
  { id: 394, name: 'Audit Telemetry With Missing Values', type: 'With Missing Values' },
  { id: 395, name: 'Audit Telemetry With Duplicate Records', type: 'With Duplicate Records' },
  { id: 396, name: 'Global Supply Chain Logistics', type: 'Different Metric & Dim Names' }
];

const queries = [
  "What are the column names?",
  "Which columns contain numbers?",
  "How many columns are there in this table?",
  "How many rows are in this dataset?",
  "What is the total revenue?",
  "What is the average order value?",
  "Which date range does this dataset cover?",
  "How many duplicate or missing records are present?"
];

async function runTestSuite() {
  const orgId = '00000000-0000-0000-0000-000000000001';
  console.log('========================================================================');
  console.log('🚀 MULTI-DATASET ACCEPTANCE TEST SUITE (5 DATASETS x 8 BASIC QUESTIONS)');
  console.log('========================================================================\n');

  const results = [];

  for (const dsInfo of datasetsToTest) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`📊 TESTING DATASET ${dsInfo.id}: "${dsInfo.name}" (${dsInfo.type})`);
    console.log(`------------------------------------------------------------------------`);

    // Fetch actual rows directly for independent ground-truth calculation
    const rowsRes = await db.query('SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index', [dsInfo.id]);
    const actualRows = rowsRes.rows.map(r => r.data);
    const dsMeta = (await db.query('SELECT * FROM datasets WHERE id = $1', [dsInfo.id])).rows[0];

    const actualRowCount = actualRows.length;
    const actualColNames = Object.keys(actualRows[0] || {});
    const actualColCount = actualColNames.length;

    // Independent expected calculations
    const expectedNumCols = actualColNames.filter(c => actualRows.some(r => typeof r[c] === 'number'));
    
    // Check date column (Must match YYYY-MM-DD or standard ISO date format, not ID strings like CUST-001)
    const dateColCandidates = actualColNames.filter(c => actualRows.some(r => {
      const v = String(r[c] || '').trim();
      return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v) && !isNaN(Date.parse(v));
    }));
    const hasDateCol = dateColCandidates.length > 0;
    let expectedDateRange = null;
    if (hasDateCol) {
      const dates = actualRows.map(r => r[dateColCandidates[0]]).filter(Boolean).sort();
      expectedDateRange = { min: dates[0], max: dates[dates.length - 1] };
    }

    // Missing values
    let expectedMissing = 0;
    actualRows.forEach(r => {
      actualColNames.forEach(c => {
        if (r[c] === null || r[c] === undefined || String(r[c]).trim() === '') expectedMissing++;
      });
    });

    // Duplicates
    const sigSet = new Set();
    let expectedDups = 0;
    actualRows.forEach(r => {
      const sig = JSON.stringify(r);
      if (sigSet.has(sig)) expectedDups++;
      else sigSet.add(sig);
    });

    console.log(`[Independent Truth] Rows: ${actualRowCount}, Cols: ${actualColCount}, Numeric: [${expectedNumCols.join(', ')}], Missing: ${expectedMissing}, Dups: ${expectedDups}, HasDate: ${hasDateCol}`);

    for (const q of queries) {
      process.stdout.write(`  Testing: "${q}" ... `);
      try {
        const res = await langGraphAssistantService.processQuery({
          message: q,
          datasetId: dsInfo.id,
          organizationId: orgId,
          userId: 1,
          userRole: 'admin'
        });

        const answerText = (res.answer || '').trim();
        let pass = true;
        let reason = 'Valid response';

        // Verification logic per query
        if (q === "What are the column names?") {
          const matchedCols = actualColNames.filter(c => answerText.includes(c));
          pass = matchedCols.length === actualColNames.length;
          if (!pass) reason = `Missing columns in answer. Expected: ${actualColNames.join(',')}`;
        } else if (q === "Which columns contain numbers?") {
          if (expectedNumCols.length === 0) {
            pass = answerText.toLowerCase().includes('not contain any numeric') || answerText.toLowerCase().includes('no numeric');
          } else {
            const matchedNumCols = expectedNumCols.filter(c => answerText.includes(c));
            pass = matchedNumCols.length === expectedNumCols.length;
          }
          if (!pass) reason = `Numeric column mismatch. Expected: ${expectedNumCols.join(',')}`;
        } else if (q === "How many columns are there in this table?") {
          pass = answerText.includes(`${actualColCount} columns`);
          if (!pass) reason = `Expected ${actualColCount} columns`;
        } else if (q === "How many rows are in this dataset?") {
          pass = answerText.includes(`${actualRowCount} recorded rows`) || answerText.includes(`${actualRowCount} records`);
          if (!pass) reason = `Expected ${actualRowCount} rows`;
        } else if (q === "Which date range does this dataset cover?") {
          if (!hasDateCol) {
            pass = answerText.toLowerCase().includes('does not contain an active date') || answerText.toLowerCase().includes('no usable date');
          } else {
            pass = answerText.includes(expectedDateRange.min) && answerText.includes(expectedDateRange.max);
          }
          if (!pass) reason = `Date range verification failed. Expected: ${JSON.stringify(expectedDateRange)}`;
        } else if (q === "How many duplicate or missing records are present?") {
          pass = answerText.includes(`${expectedMissing}`) && answerText.includes(`${expectedDups}`);
          if (!pass) reason = `Data quality mismatch. Expected missing: ${expectedMissing}, dups: ${expectedDups}`;
        } else if (q === "What is the average order value?") {
          pass = answerText.length > 20 && !answerText.includes('quota');
        } else if (q === "What is the total revenue?") {
          pass = answerText.length > 20 && !answerText.includes('quota');
        }

        console.log(pass ? '✅ PASS' : `❌ FAIL (${reason})`);
        results.push({
          datasetId: dsInfo.id,
          datasetName: dsInfo.name,
          datasetType: dsInfo.type,
          query: q,
          intent: res.intent,
          pass,
          answerSnippet: answerText.slice(0, 120).replace(/\n/g, ' ')
        });
      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
        results.push({
          datasetId: dsInfo.id,
          datasetName: dsInfo.name,
          datasetType: dsInfo.type,
          query: q,
          intent: 'ERROR',
          pass: false,
          answerSnippet: err.message
        });
      }
    }
  }

  console.log('\n========================================================================');
  console.log('📊 MULTI-DATASET ACCEPTANCE RESULTS SUMMARY');
  console.log('========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log(`Total Test Runs: ${total} | Passed: ${passed} | Failed: ${total - passed} | Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  process.exit(passed === total ? 0 : 1);
}

runTestSuite().catch(e => {
  console.error(e);
  process.exit(1);
});
