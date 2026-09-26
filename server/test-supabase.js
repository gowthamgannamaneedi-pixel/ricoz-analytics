const { supabase, isConfigured, checkSupabaseConnection } = require('./config/supabase');
const config = require('./config');

async function runSupabaseTests() {
  console.log('====================================================');
  console.log('  RicozAnalytics Supabase Integration Test Suite    ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✓ Test ${total}: ${testName} — PASSED`);
      passed++;
    } else {
      console.error(`  ✗ Test ${total}: ${testName} — FAILED`);
    }
  }

  // Test 1: Module Export Verification
  assert(typeof checkSupabaseConnection === 'function', 'Supabase connection check helper is exported');

  // Test 2: Config Loaded Correctly
  assert(
    config.supabase !== undefined &&
    typeof config.supabase.url === 'string' &&
    typeof config.supabase.anonKey === 'string',
    'Supabase URL and Anon Key configuration loaded'
  );

  // Test 3: Supabase Client Initialized if Configured
  if (isConfigured) {
    assert(supabase !== null && typeof supabase.from === 'function', 'Supabase client initialized successfully with anon key');
  } else {
    assert(supabase === null, 'Supabase client gracefully handles missing/placeholder credentials');
  }

  // Test 4: Live Connectivity Check
  console.log('\n--- Connectivity & Status Check ---');
  console.log(`  Configured: ${isConfigured ? 'YES' : 'NO (Placeholders or missing in .env)'}`);
  console.log(`  Supabase URL: ${config.supabase.url ? config.supabase.url : '(not set)'}`);

  const healthResult = await checkSupabaseConnection();
  console.log('  Result:', healthResult);

  if (isConfigured) {
    assert(healthResult.success === true, `Live connection to Supabase (${healthResult.message})`);
  } else {
    assert(healthResult.configured === false, 'Gracefully handles unconfigured/placeholder state');
  }

  console.log('\n====================================================');
  console.log(`  Results: ${passed}/${total} Tests Passed`);
  console.log('====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSupabaseTests().catch((err) => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
