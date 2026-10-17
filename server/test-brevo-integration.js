const assert = require('assert');
const emailService = require('./services/emailService');
const demoEmailQueueService = require('./services/demoEmailQueueService');
const db = require('./config/database');

async function runBrevoIntegrationTests() {
  console.log('========================================================================');
  console.log(' RICOZANALYTICS - BREVO TRANSACTIONAL EMAIL INTEGRATION TEST SUITE');
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

  // Backup original env
  const origProvider = process.env.EMAIL_PROVIDER;
  const origApiKey = process.env.BREVO_API_KEY;
  const origFrom = process.env.SMTP_FROM;

  try {
    // 1. Provider Selection
    console.log('--- Test Group 1: Dynamic Provider Selection & Detection ---');
    process.env.EMAIL_PROVIDER = 'brevo';
    testAssert(emailService.isBrevo() === true, 'isBrevo() returns true when EMAIL_PROVIDER=brevo');
    testAssert(emailService.getProvider() === 'Brevo', 'getProvider() returns "Brevo"');

    process.env.EMAIL_PROVIDER = 'smtp';
    testAssert(emailService.isBrevo() === false, 'isBrevo() returns false when EMAIL_PROVIDER=smtp');
    testAssert(emailService.getProvider() !== 'Brevo', 'getProvider() falls back to SMTP provider when EMAIL_PROVIDER=smtp');

    // Restore to brevo for remaining tests
    process.env.EMAIL_PROVIDER = 'brevo';
    process.env.SMTP_FROM = 'ricozanalytics@gmail.com';

    // 2. Safe Diagnostics and Status Inspection
    console.log('\n--- Test Group 2: Status Inspector & Safe Credential Masking ---');
    delete process.env.BREVO_API_KEY;
    testAssert(emailService.isConfigured() === false, 'isConfigured() returns false when BREVO_API_KEY is missing');
    let status = emailService.getSmtpStatus();
    testAssert(status.provider === 'Brevo', 'Status reports provider as "Brevo"');
    testAssert(status.transportType === 'https_rest_api', 'Transport type is https_rest_api (Port 443)');
    testAssert(status.port === 443, 'Port is 443 (HTTPS)');
    testAssert(status.missingVars.includes('BREVO_API_KEY'), 'Correctly reports BREVO_API_KEY in missingVars');

    // Test with simulated Brevo API key
    process.env.BREVO_API_KEY = 'xkeysib-mock1234567890abcdef12345678';
    testAssert(emailService.isConfigured() === true, 'isConfigured() returns true when BREVO_API_KEY is configured');
    status = emailService.getSmtpStatus();
    testAssert(status.apiKeyConfigured === true, 'Status reports apiKeyConfigured: true');
    testAssert(status.maskedKey === 'xkey***5678', `API key is safely masked: "${status.maskedKey}" (no raw secrets exposed)`);
    testAssert(status.fromEmail === 'ricozanalytics@gmail.com', 'Verified sender email matches configured SMTP_FROM');

    // 3. Sender Verification Logic
    console.log('\n--- Test Group 3: Verified Sender Matching ---');
    // Mock _callBrevoApi to test /senders parsing
    const originalCallApi = emailService._callBrevoApi.bind(emailService);
    emailService._callBrevoApi = async (endpoint) => {
      if (endpoint === '/senders') {
        return {
          status: 200,
          data: {
            senders: [
              { id: 1, name: 'Ricoz Analytics', email: 'ricozanalytics@gmail.com', active: true },
              { id: 2, name: 'Inactive User', email: 'inactive@example.com', active: false }
            ]
          }
        };
      }
      if (endpoint === '/account') {
        return {
          status: 200,
          data: { email: 'ricozanalytics@gmail.com', plan: [{ type: 'free' }] }
        };
      }
      throw new Error(`Unhandled endpoint in mock: ${endpoint}`);
    };

    const senderMatch = await emailService.verifyBrevoSender('ricozanalytics@gmail.com');
    testAssert(senderMatch.verified === true, 'verifyBrevoSender matches active verified sender (ricozanalytics@gmail.com)');
    testAssert(senderMatch.sender.active === true, 'Sender is active');

    const inactiveMatch = await emailService.verifyBrevoSender('inactive@example.com');
    testAssert(inactiveMatch.verified === false, 'verifyBrevoSender rejects inactive sender');

    const missingMatch = await emailService.verifyBrevoSender('unknown@domain.com');
    testAssert(missingMatch.verified === false, 'verifyBrevoSender reports unconfigured sender');

    const connResult = await emailService.verifyConnection();
    testAssert(connResult.success === true, 'verifyConnection() succeeds for active verified sender');
    testAssert(connResult.provider === 'Brevo', 'verifyConnection() reports provider: Brevo');

    // 4. Transactional Email Dispatch Payload Verification
    console.log('\n--- Test Group 4: Brevo Email Dispatch & Payload Construction ---');
    let capturedPayload = null;
    emailService._callBrevoApi = async (endpoint, options) => {
      if (endpoint === '/smtp/email' && options.method === 'POST') {
        capturedPayload = options.body;
        return {
          status: 201,
          data: { messageId: '<brevo-mock-msg-999@smtp-relay.brevo.com>' }
        };
      }
      return originalCallApi(endpoint, options);
    };

    // Test sendInternalDemoNotification
    const internalDemoResult = await emailService.sendInternalDemoNotification({
      fullName: 'Enterprise Lead',
      workEmail: 'lead@bigenterprise.com',
      company: 'Big Enterprise Corp',
      teamSize: '50-200',
      primaryDataSource: 'PostgreSQL'
    });

    testAssert(internalDemoResult.success === true, 'sendInternalDemoNotification succeeds via Brevo');
    testAssert(internalDemoResult.provider === 'Brevo', 'Provider is Brevo');
    testAssert(capturedPayload.sender.email === 'ricozanalytics@gmail.com', 'Payload sender matches verified sender');
    testAssert(capturedPayload.to[0].email === 'ricozanalytics@gmail.com', 'Payload recipient is company demo email');
    testAssert(capturedPayload.replyTo.email === 'lead@bigenterprise.com', 'Payload replyTo matches prospect email');
    testAssert(capturedPayload.subject.includes('Big Enterprise Corp'), 'Payload subject contains company name');

    // Test sendProspectDemoConfirmation
    capturedPayload = null;
    const prospectResult = await emailService.sendProspectDemoConfirmation({
      fullName: 'Enterprise Lead',
      workEmail: 'lead@bigenterprise.com',
      company: 'Big Enterprise Corp',
      primaryDataSource: 'PostgreSQL'
    });

    testAssert(prospectResult.success === true, 'sendProspectDemoConfirmation succeeds via Brevo');
    testAssert(capturedPayload.to[0].email === 'lead@bigenterprise.com', 'Prospect confirmation recipient is prospect email');
    testAssert(capturedPayload.to[0].name === 'Enterprise Lead', 'Prospect confirmation includes lead name');

    // Test sendVerificationEmail
    capturedPayload = null;
    const verifResult = await emailService.sendVerificationEmail({
      email: 'newuser@enterprise.com',
      name: 'Alice Engineer',
      token: 'tok_abc123',
      otp: '654321',
      verifyUrl: 'https://ricozanalytics.com/auth/verify-email?token=tok_abc123'
    });

    testAssert(verifResult.success === true, 'sendVerificationEmail succeeds via Brevo');
    testAssert(capturedPayload.to[0].email === 'newuser@enterprise.com', 'Verification recipient matches registrant email');
    testAssert(capturedPayload.subject.includes('654321'), 'Verification subject contains 6-digit OTP');
    testAssert(capturedPayload.htmlContent.includes('654321'), 'Verification HTML body contains 6-digit OTP');

    // Test sendReportEmail with PDF attachment
    capturedPayload = null;
    const reportBuffer = Buffer.from('%PDF-1.4 Mock PDF Content');
    const reportResult = await emailService.sendReportEmail({
      recipients: ['analyst@ricoz.in'],
      reportTitle: 'Q4 Revenue Intelligence',
      organizationName: 'Ricoz Analytics',
      attachmentBuffer: reportBuffer,
      attachmentFileName: 'q4_report.pdf'
    });

    testAssert(reportResult.success === true, 'sendReportEmail succeeds via Brevo');
    testAssert(capturedPayload.attachment && capturedPayload.attachment.length === 1, 'Report includes attachment');
    testAssert(capturedPayload.attachment[0].name === 'q4_report.pdf', 'Attachment filename matches');
    testAssert(capturedPayload.attachment[0].content === reportBuffer.toString('base64'), 'Attachment content is properly Base64 encoded');

    // 5. Queue Worker Retry Mechanism with Brevo
    console.log('\n--- Test Group 5: Queue Worker Brevo Retries & Idempotency ---');
    await demoEmailQueueService.init();

    // Create a mock stalled job where internal notification failed and prospect confirmation failed
    const insertStalled = await db.query(`
      INSERT INTO demo_email_jobs (
        recipient, prospect_email, payload, status, internal_status, prospect_status, attempts, max_attempts, next_attempt_at, last_error
      ) VALUES (
        'ricozanalytics@gmail.com', 'prospect.retry@testdomain.com', $1::jsonb, 'failed', 'failed', 'failed', 5, 5, NOW(), 'Gmail Daily limit exceeded (550 5.4.5)'
      ) RETURNING id;
    `, [JSON.stringify({
      fullName: 'Retry Lead',
      workEmail: 'prospect.retry@testdomain.com',
      company: 'Retry Test Corp',
      teamSize: '10-50',
      primaryDataSource: 'PostgreSQL'
    })]);

    const stalledJobId = insertStalled.rows[0].id;
    testAssert(Boolean(stalledJobId), `Created stalled failed job #${stalledJobId}`);

    // Call retryFailedJobs()
    const retryRes = await demoEmailQueueService.retryFailedJobs();
    testAssert(retryRes.success === true, 'retryFailedJobs() executed successfully');
    testAssert(retryRes.jobIds.includes(stalledJobId), `Stalled job #${stalledJobId} was included in retry list`);

    // Verify job in database is now pending and attempts reset
    const checkStalled = await db.query('SELECT status, attempts, internal_status, prospect_status FROM demo_email_jobs WHERE id = $1', [stalledJobId]);
    testAssert(checkStalled.rows[0].status === 'pending', 'Stalled job status reset to pending');
    testAssert(checkStalled.rows[0].attempts === 0, 'Attempts counter reset to 0');

    // Test idempotency: Create a job where internal notification was ALREADY 'sent'
    const insertPartial = await db.query(`
      INSERT INTO demo_email_jobs (
        recipient, prospect_email, payload, status, internal_status, prospect_status, attempts, max_attempts, next_attempt_at, last_error
      ) VALUES (
        'ricozanalytics@gmail.com', 'prospect.partial@testdomain.com', $1::jsonb, 'failed', 'sent', 'failed', 2, 5, NOW(), 'Prospect timeout'
      ) RETURNING id;
    `, [JSON.stringify({
      fullName: 'Partial Lead',
      workEmail: 'prospect.partial@testdomain.com',
      company: 'Partial Corp',
      teamSize: '10-50',
      primaryDataSource: 'PostgreSQL'
    })]);

    const partialJobId = insertPartial.rows[0].id;

    // Retry should preserve internal_status = 'sent'
    await demoEmailQueueService.retryFailedJobs();
    const checkPartial = await db.query('SELECT internal_status, prospect_status FROM demo_email_jobs WHERE id = $1', [partialJobId]);
    testAssert(checkPartial.rows[0].internal_status === 'sent', 'Idempotency preserved: internal_status remains "sent" (no duplicate send!)');
    testAssert(checkPartial.rows[0].prospect_status === 'failed', 'prospect_status remains runnable for retry');

    // Clean up test jobs from database
    await db.query('DELETE FROM demo_email_jobs WHERE id IN ($1, $2)', [stalledJobId, partialJobId]);

    // Restore original _callBrevoApi
    emailService._callBrevoApi = originalCallApi;

  } finally {
    demoEmailQueueService.stop();

    // Restore environment
    if (origProvider !== undefined) process.env.EMAIL_PROVIDER = origProvider;
    else delete process.env.EMAIL_PROVIDER;

    if (origApiKey !== undefined) process.env.BREVO_API_KEY = origApiKey;
    else delete process.env.BREVO_API_KEY;

    if (origFrom !== undefined) process.env.SMTP_FROM = origFrom;
    else delete process.env.SMTP_FROM;
  }

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}% SUCCESS)`);
  console.log('========================================================================\n');

  if (passed === total && !process.exitCode) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runBrevoIntegrationTests().catch(err => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
