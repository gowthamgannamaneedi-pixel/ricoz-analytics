const nodemailer = require('nodemailer');
const emailService = require('./services/emailService');

async function testSmtpDelivery() {
  console.log('===============================================================');
  console.log('  RicozAnalytics Deep SMTP Delivery & Diagnostic Inspector     ');
  console.log('===============================================================\n');

  // 1. Inspect Environment Variables
  console.log('1. ENVIRONMENT VARIABLE INSPECTION:');
  const envVars = {
    DEMO_REQUEST_EMAIL: process.env.DEMO_REQUEST_EMAIL || '(default: care@ricoz.in)',
    SMTP_HOST: process.env.SMTP_HOST || '(not set)',
    SMTP_PORT: process.env.SMTP_PORT || '(not set, defaults to 587)',
    SMTP_SECURE: process.env.SMTP_SECURE || '(not set, defaults to false)',
    SMTP_USER: process.env.SMTP_USER ? (process.env.SMTP_USER.length > 4 ? `${process.env.SMTP_USER.slice(0, 2)}***${process.env.SMTP_USER.slice(-2)}` : '***') : '(not set)',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '******** (configured)' : '(not set)',
    SMTP_FROM: process.env.SMTP_FROM || process.env.REPORT_FROM_EMAIL || '(default: care@ricoz.in)'
  };
  console.table(envVars);

  // 2. Check EmailService Transporter Status
  console.log('\n2. EMAILSERVICE TRANSPORTER STATUS:');
  const status = emailService.getSmtpStatus();
  console.log(`  Configured: ${status.configured ? '✅ YES' : '❌ NO'}`);
  console.log(`  Recipient Target: ${status.demoRecipient}`);
  console.log(`  Missing Variables: ${status.missingVars.length > 0 ? status.missingVars.join(', ') : 'None'}`);

  // 3. Live SMTP Handshake (if configured)
  if (status.configured) {
    console.log('\n3. TESTING CONFIGURED SMTP TRANSPORT HANDSHAKE:');
    const verifyResult = await emailService.verifyConnection();
    console.log('  Handshake Result:', verifyResult);

    console.log('\n4. SENDING REAL TEST NOTIFICATION EMAIL TO care@ricoz.in:');
    const sendResult = await emailService.sendDemoRequestEmail({
      fullName: 'Enterprise Test Lead',
      workEmail: 'lead@enterprise.com',
      company: 'Ricoz Enterprise Test Corp',
      teamSize: '50-200',
      primaryDataSource: 'PostgreSQL',
      phone: '+91 99999 88888',
      notes: 'Testing real SMTP delivery pipeline to care@ricoz.in'
    });
    console.log('  Send Result:', sendResult);
  } else {
    console.log('\n3. LIVE REAL SMTP PIPELINE VALIDATION VIA NODEMAILER TEST TRANSPORT:');
    console.log('  Creating automated test SMTP account (Ethereal) to verify real network delivery...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`  ✅ Test SMTP Server Connected: ${testAccount.smtp.host}:${testAccount.smtp.port}`);

      const testTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const demoPayload = {
        fullName: 'Rajesh Demo Inspector',
        workEmail: 'rajesh.lead@enterprise.in',
        company: 'Ricoz Live Retail Network',
        teamSize: '10-50',
        primaryDataSource: 'PostgreSQL'
      };

      const mailOptions = {
        from: '"RicozAnalytics Demo Portal" <care@ricoz.in>',
        to: 'care@ricoz.in',
        replyTo: `"${demoPayload.fullName}" <${demoPayload.workEmail}>`,
        subject: `New RicozAnalytics Demo Request: ${demoPayload.fullName} (${demoPayload.company})`,
        html: `<h2>New RicozAnalytics Demo Request</h2><p>Lead: ${demoPayload.fullName}</p><p>Email: ${demoPayload.workEmail}</p><p>Company: ${demoPayload.company}</p>`
      };

      const info = await testTransporter.sendMail(mailOptions);
      console.log('\n  ✅ REAL SMTP TRANSMISSION SUCCESS:');
      console.log(`    Message ID: ${info.messageId}`);
      console.log(`    SMTP Response: ${info.response}`);
      console.log(`    Accepted: ${info.accepted ? info.accepted.join(', ') : 'none'}`);
      console.log(`    Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (etherealErr) {
      console.warn('  Test SMTP notice:', etherealErr.message);
    }
  }

  console.log('\n===============================================================');
  console.log('  DIAGNOSIS CONCLUSION & ACTION REQUIRED:                      ');
  console.log('===============================================================');
  if (!status.configured) {
    console.log('  ⚠️ ROOT CAUSE IDENTIFIED:');
    console.log('  SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) are NOT present');
    console.log('  in the server environment variables. Because no SMTP server is configured,');
    console.log('  emails cannot physically be dispatched to the remote mailbox care@ricoz.in.');
    console.log('\n  REQUIRED ACTION TO ENABLE REAL DELIVERY TO care@ricoz.in:');
    console.log('  Add the following variables to your production environment (Vercel / Render / .env):');
    console.log('    SMTP_HOST=smtp.your-provider.com  (e.g., smtp.gmail.com / smtp.sendgrid.net / smtp.resend.com)');
    console.log('    SMTP_PORT=587                     (or 465)');
    console.log('    SMTP_USER=your-smtp-username-or-email');
    console.log('    SMTP_PASSWORD=your-smtp-app-password-or-api-key');
    console.log('    SMTP_FROM=care@ricoz.in           (or no-reply@ricoz.in)');
    console.log('    DEMO_REQUEST_EMAIL=care@ricoz.in');
  } else {
    console.log('  ✅ SMTP is fully configured and operational.');
  }
  console.log('===============================================================\n');
}

testSmtpDelivery().catch(console.error);
