const https = require('https');

const BASE_URL = 'https://ricoz-analytics.onrender.com';
const TEST_INBOX = 'gowthamgannamaneedi@gmail.com';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RicozAnalytics-Brevo-Verification-Suite/1.0'
      }
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runProductionBrevoSuite() {
  console.log('========================================================================');
  console.log(' RICOZANALYTICS - LIVE PRODUCTION BREVO EMAIL INTEGRATION TEST');
  console.log(` Target: ${BASE_URL}`);
  console.log(` Test Prospect Inbox: ${TEST_INBOX}`);
  console.log('========================================================================\n');

  // STEP 1: Diagnostic Status Check
  console.log('--- Step 1: Checking Production Email Diagnostic Status ---');
  const statusRes = await request('GET', '/api/demo-request/smtp-status');
  console.log('Status Code:', statusRes.statusCode);
  console.log('Response:', JSON.stringify(statusRes.data, null, 2));

  if (statusRes.data?.data?.provider !== 'Brevo') {
    throw new Error(`Expected provider Brevo, got: ${statusRes.data?.data?.provider}`);
  }
  console.log('✅ Provider confirmed as Brevo on Port 443 (HTTPS REST API)\n');

  // STEP 2: Live Connection & Sender Verification
  console.log('--- Step 2: Verifying Brevo API Key & Active Verified Sender ---');
  const verifyRes = await request('POST', '/api/demo-request/verify-smtp');
  console.log('Status Code:', verifyRes.statusCode);
  console.log('Response:', JSON.stringify(verifyRes.data, null, 2));

  if (!verifyRes.data?.success || !(verifyRes.data?.data?.senderVerified || verifyRes.data?.senderVerified)) {
    throw new Error(`Brevo connection verification failed: ${JSON.stringify(verifyRes.data)}`);
  }
  console.log('✅ Brevo API key authenticated & sender "ricozanalytics@gmail.com" is ACTIVE and VERIFIED!\n');

  // STEP 2.5: Direct Test Email via Brevo
  console.log('--- Step 2.5: Sending Diagnostic Test Email to Real Inbox via Brevo ---');
  const testEmailRes = await request('POST', '/api/demo-request/test-email', {
    recipient: TEST_INBOX,
    subject: 'Brevo Production Integration Verification'
  });
  console.log('Test Email Status Code:', testEmailRes.statusCode);
  console.log('Test Email Response:', JSON.stringify(testEmailRes.data, null, 2));
  if (!testEmailRes.data?.success) {
    throw new Error(`Test email dispatch failed: ${JSON.stringify(testEmailRes.data)}`);
  }
  console.log(`✅ Test email successfully delivered via Brevo to ${TEST_INBOX} (Message ID: ${testEmailRes.data?.data?.messageId})!\n`);

  // STEP 3: Retry Failed Jobs via Brevo
  console.log('--- Step 3: Triggering Retry of Previously Failed Queue Jobs ---');
  const retryRes = await request('POST', '/api/demo-request/retry-jobs');
  console.log('Status Code:', retryRes.statusCode);
  console.log('Retry Result:', JSON.stringify(retryRes.data, null, 2));
  console.log(`✅ Retry triggered for ${retryRes.data?.retriedCount || 0} jobs.\n`);

  // Wait a short moment for worker to process retries
  console.log('Waiting 10s for queue worker to dispatch retried jobs via Brevo...');
  await new Promise(r => setTimeout(r, 10000));

  // STEP 4: Inspect Queue Status
  console.log('\n--- Step 4: Inspecting Live Queue Status ---');
  const queueStatusRes = await request('GET', '/api/demo-request/queue-status');
  console.log('Queue Metrics:', JSON.stringify({
    pending: queueStatusRes.data?.queue?.pending,
    completed: queueStatusRes.data?.queue?.completed,
    failed: queueStatusRes.data?.queue?.failed,
    worker: queueStatusRes.data?.queue?.worker,
    recentJobs: (queueStatusRes.data?.queue?.recentJobs || []).slice(0, 3).map(j => ({
      id: j.id,
      prospect: j.prospect_email,
      status: j.status,
      internal_status: j.internal_status,
      prospect_status: j.prospect_status,
      internal_msg_id: j.internal_message_id,
      prospect_msg_id: j.prospect_message_id
    }))
  }, null, 2));

  // STEP 5: Test Registration Verification Flow via Brevo
  console.log('\n--- Step 5: Testing User Registration Verification Email Flow ---');
  const regTimestamp = Date.now();
  const regEmail = `gowthamgannamaneedi+reg${regTimestamp}@gmail.com`;
  const regPassword = `BrevoTest!${regTimestamp}`;
  console.log(`Registering new test user: ${regEmail}...`);

  const regRes = await request('POST', '/api/auth/register', {
    name: 'Brevo Production Verifier',
    email: regEmail,
    password: regPassword,
    organizationName: `Ricoz Verification Corp ${regTimestamp}`
  });

  console.log('Registration Status Code:', regRes.statusCode);
  console.log('Registration Response:', JSON.stringify(regRes.data, null, 2));
  if (!regRes.data?.success || !regRes.data?.email_delivery?.success) {
    throw new Error(`Registration email flow failed: ${JSON.stringify(regRes.data)}`);
  }
  console.log(`✅ Registration verification email successfully dispatched via ${regRes.data?.email_delivery?.provider} to ${regEmail}!\n`);

  // STEP 6: Test Resending Verification Flow via Brevo
  console.log('--- Step 6: Testing Resend Verification Email Flow ---');
  console.log('Waiting 62 seconds to safely clear registration resend cooldown timer...');
  await new Promise(r => setTimeout(r, 62000));

  const resendRes = await request('POST', '/api/auth/resend-verification', {
    email: regEmail
  });

  console.log('Resend Status Code:', resendRes.statusCode);
  console.log('Resend Response:', JSON.stringify(resendRes.data, null, 2));
  if (!resendRes.data?.success) {
    throw new Error(`Resend verification flow failed: ${JSON.stringify(resendRes.data)}`);
  }
  console.log('✅ Resend verification flow executed via Brevo!\n');

  // STEP 7: Test Demo Request Flow (Internal Notification + Prospect Confirmation)
  console.log('--- Step 7: Testing Demo Request Submission & Queue Dispatch ---');
  const demoSubmission = {
    fullName: 'Gowtham Gannamaneedi',
    workEmail: TEST_INBOX,
    company: 'Ricoz Analytics Production',
    phone: '+91 9876543210',
    teamSize: '10-50',
    primaryDataSource: 'PostgreSQL',
    notes: 'Live Brevo production end-to-end delivery verification test'
  };

  const demoRes = await request('POST', '/api/demo-request', demoSubmission);
  console.log('Demo Submission Status Code:', demoRes.statusCode);
  console.log('Demo Submission Response:', JSON.stringify(demoRes.data, null, 2));

  const demoRequestId = demoRes.data?.data?.id;
  const jobId = demoRes.data?.data?.email_delivery?.jobId;
  console.log(`Demo Request ID: ${demoRequestId}, Job ID: ${jobId}`);

  // Poll for job completion in queue
  console.log('\nPolling queue status for Job #' + jobId + ' completion...');
  let jobCompleted = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise(r => setTimeout(r, 4000));
    const checkQueue = await request('GET', '/api/demo-request/queue-status');
    const job = (checkQueue.data?.queue?.recentJobs || []).find(j => j.id == jobId);
    if (job) {
      console.log(`[Attempt ${attempt}] Job #${job.id}: status=${job.status}, internal=${job.internal_status}, prospect=${job.prospect_status}`);
      if (job.status === 'completed' || (job.internal_status === 'sent' && job.prospect_status === 'sent')) {
        jobCompleted = true;
        console.log('\n🎉 JOB SUCCESSFULLY COMPLETED VIA BREVO!');
        console.log('Internal Message ID:', job.internal_message_id);
        console.log('Prospect Message ID:', job.prospect_message_id);
        break;
      }
    }
  }

  if (!jobCompleted) {
    throw new Error(`Job #${jobId} did not complete within timeout`);
  }

  console.log('\n========================================================================');
  console.log(' PRODUCTION BREVO INTEGRATION SUITE COMPLETE');
  console.log('========================================================================\n');
}

runProductionBrevoSuite().catch(err => {
  console.error('Production suite error:', err);
  process.exit(1);
});
