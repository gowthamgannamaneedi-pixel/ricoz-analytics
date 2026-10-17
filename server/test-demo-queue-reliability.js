const assert = require('assert');
const db = require('./config/database');
const demoEmailQueueService = require('./services/demoEmailQueueService');
const emailService = require('./services/emailService');

async function runQueueReliabilityTests() {
  console.log('========================================================================');
  console.log(' RICOZANALYTICS - ADVANCED DEMO EMAIL QUEUE RELIABILITY VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function testAssert(condition, desc) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Initialize queue and schema
  console.log('--- Test 1: Queue Initialization and Schema Integrity ---');
  await demoEmailQueueService.init();
  testAssert(Boolean(demoEmailQueueService.workerId), `Worker initialized with ID: ${demoEmailQueueService.workerId}`);

  // Check columns on demo_email_jobs
  const colCheck = await db.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'demo_email_jobs';
  `);
  const columns = colCheck.rows.map(r => r.column_name);
  testAssert(columns.includes('internal_status'), 'Column internal_status exists on demo_email_jobs');
  testAssert(columns.includes('prospect_status'), 'Column prospect_status exists on demo_email_jobs');
  testAssert(columns.includes('internal_error'), 'Column internal_error exists on demo_email_jobs');
  testAssert(columns.includes('prospect_error'), 'Column prospect_error exists on demo_email_jobs');
  testAssert(columns.includes('locked_at'), 'Column locked_at exists on demo_email_jobs');
  testAssert(columns.includes('locked_by'), 'Column locked_by exists on demo_email_jobs');

  // 2. Test Enqueue and Idempotent Deduplication
  console.log('\n--- Test 2: Enqueue Job and Deduplication ---');
  const demoReqId = `test_req_${Date.now()}`;
  const prospect = 'prospect.tester@enterprise-test.org';

  const enqueueRes1 = await demoEmailQueueService.enqueueJob({
    demoRequestId: demoReqId,
    recipient: 'ricozanalytics@gmail.com',
    prospectEmail: prospect,
    payload: {
      fullName: 'Prospect Tester',
      workEmail: prospect,
      company: 'Enterprise Test Corp',
      teamSize: '50-200',
      primaryDataSource: 'PostgreSQL'
    }
  });

  testAssert(Boolean(enqueueRes1.jobId), `Job enqueued with ID: ${enqueueRes1.jobId}`);
  testAssert(enqueueRes1.status === 'queued' || enqueueRes1.status === 'pending', 'Enqueue status is queued/pending');

  // Attempt duplicate enqueue with same demoRequestId
  const enqueueRes2 = await demoEmailQueueService.enqueueJob({
    demoRequestId: demoReqId,
    recipient: 'ricozanalytics@gmail.com',
    prospectEmail: prospect,
    payload: {
      fullName: 'Prospect Tester',
      workEmail: prospect,
      company: 'Enterprise Test Corp',
      teamSize: '50-200',
      primaryDataSource: 'PostgreSQL'
    }
  });

  testAssert(enqueueRes2.jobId === enqueueRes1.jobId, 'Duplicate enqueue returns existing job ID (idempotency preserved)');
  testAssert(enqueueRes2.reused === true, 'Duplicate enqueue flagged as reused');

  // 3. Test Atomic Stale Job Recovery
  console.log('\n--- Test 3: Abandoned Processing Job Recovery ---');
  // Wait for any in-flight execution to settle
  while (demoEmailQueueService.isProcessing) {
    await new Promise(r => setTimeout(r, 100));
  }

  // Insert synthetic abandoned job stuck in 'processing' > 10 minutes ago
  const abandonedInsert = await db.query(`
    INSERT INTO demo_email_jobs (
      demo_request_id,
      recipient,
      prospect_email,
      payload,
      status,
      internal_status,
      prospect_status,
      attempts,
      max_attempts,
      next_attempt_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, 'processing', 'pending', 'pending', 1, 5, NOW(), NOW() - INTERVAL '10 minutes')
    RETURNING id;
  `, [
    `abandoned_${Date.now()}`,
    'ricozanalytics@gmail.com',
    'abandoned.lead@enterprise-test.org',
    JSON.stringify({ fullName: 'Abandoned Lead', workEmail: 'abandoned.lead@enterprise-test.org', company: 'Ghost Corp' })
  ]);
  const abandonedJobId = abandonedInsert.rows[0].id;
  testAssert(Boolean(abandonedJobId), `Created synthetic abandoned job #${abandonedJobId}`);

  // Process queue - atomic claim should reclaim abandoned job
  await demoEmailQueueService.processQueue();

  const checkedAbandoned = (await db.query('SELECT status, attempts, locked_by FROM demo_email_jobs WHERE id = $1', [abandonedJobId])).rows[0];
  testAssert(checkedAbandoned.attempts >= 2, `Abandoned job was claimed and attempts incremented (attempts=${checkedAbandoned.attempts})`);

  // 4. Test Error Classification
  console.log('\n--- Test 4: Error Classification and Quota Safety ---');
  const quotaErr = new Error('Data command failed: 550-5.4.5 Daily user sending limit exceeded. For more information on Gmail 550-5.4.5 sending limits go to https://support.google.com/a/answer/166852');
  const classifiedQuota = emailService._classifyError(quotaErr, 'Gmail');
  testAssert(classifiedQuota.code === 'DAILY_LIMIT_EXCEEDED', 'Daily limit error classified as DAILY_LIMIT_EXCEEDED');
  testAssert(classifiedQuota.isQuotaError === true, 'Quota error correctly flagged isQuotaError: true');
  testAssert(classifiedQuota.isTransient === false, 'Daily limit classified as non-transient until window reset');

  const timeoutErr = new Error('connect ETIMEDOUT 142.250.185.108:465');
  timeoutErr.code = 'ETIMEDOUT';
  const classifiedTimeout = emailService._classifyError(timeoutErr, 'Gmail');
  testAssert(classifiedTimeout.code === 'ETIMEDOUT', 'Timeout classified as ETIMEDOUT');
  testAssert(classifiedTimeout.isTransient === true, 'Timeout flagged as retryable transient failure');

  // 5. Test Queue Stats Diagnostics
  console.log('\n--- Test 5: Queue Status Diagnostics Payload ---');
  const stats = await demoEmailQueueService.getQueueStats();
  testAssert(typeof stats.pending === 'number', `Pending count is number: ${stats.pending}`);
  testAssert(typeof stats.processing === 'number', `Processing count is number: ${stats.processing}`);
  testAssert(typeof stats.completed === 'number', `Completed count is number: ${stats.completed}`);
  testAssert(typeof stats.failed === 'number', `Failed count is number: ${stats.failed}`);
  testAssert(Boolean(stats.worker?.workerId), `Worker info exposed: ${stats.worker.workerId}`);
  testAssert(Array.isArray(stats.recentJobs), `Recent jobs array returned (${stats.recentJobs.length} jobs)`);

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (${passed === total ? '100% SUCCESS' : 'FAILURES OCCURRED'})`);
  console.log('========================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runQueueReliabilityTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
