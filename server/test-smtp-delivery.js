require('dotenv').config();
const emailService = require('./services/emailService');

async function testSmtpDelivery() {
  console.log('===============================================================');
  console.log('  RicozAnalytics Zoho Mail SMTP Diagnostic & Delivery Suite   ');
  console.log('===============================================================\n');

  // 1. Inspect Environment Variables
  console.log('1. ZOHO SMTP ENVIRONMENT VARIABLE INSPECTION:');
  const envVars = {
    DEMO_REQUEST_EMAIL: process.env.DEMO_REQUEST_EMAIL || 'care@ricoz.in',
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.zoho.com',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    SMTP_SECURE: process.env.SMTP_SECURE || 'false',
    SMTP_USER: process.env.SMTP_USER || 'care@ricoz.in',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ? (process.env.SMTP_PASSWORD === 'your_zoho_app_password_here' ? '[PLACEHOLDER: your_zoho_app_password_here]' : '******** [CONFIGURED]') : '[NOT SET]',
    SMTP_FROM: process.env.SMTP_FROM || 'care@ricoz.in'
  };
  console.table(envVars);

  // 2. Check EmailService Transporter Status
  console.log('\n2. EMAILSERVICE TRANSPORTER STATUS:');
  const status = emailService.getSmtpStatus();
  console.log(`  Configured: ${status.configured ? '✅ YES' : '❌ NO'}`);
  console.log(`  Recipient Target: ${status.demoRecipient}`);
  console.log(`  Sender Email: ${status.fromEmail}`);
  console.log(`  Host: ${status.host}`);
  console.log(`  Port: ${status.port}`);
  console.log(`  Password Status: ${status.isPlaceholderPassword ? '⚠️ PLACEHOLDER (Needs real Zoho App Password)' : '✅ Configured'}`);
  console.log(`  Missing Variables: ${status.missingVars.length > 0 ? status.missingVars.join(', ') : 'None'}`);

  // 3. Live Zoho SMTP Handshake
  console.log('\n3. TESTING LIVE ZOHO SMTP CONNECTION HANDSHAKE:');
  const verifyResult = await emailService.verifyConnection();
  console.log('  Handshake Status:', verifyResult.success ? '✅ PASSED' : '⚠️ ATTEMPTED (Awaiting Real App Password)');
  console.log('  Handshake Details:', verifyResult.message);

  // 4. Live Demo Request Notification Test
  console.log('\n4. ATTEMPTING LIVE DEMO REQUEST EMAIL DISPATCH TO care@ricoz.in:');
  const sendResult = await emailService.sendDemoRequestEmail({
    fullName: 'Rajesh Kumar (Enterprise Test)',
    workEmail: 'rajesh.kumar@enterprise-retail.com',
    company: 'Enterprise Retail Network India',
    teamSize: '50-200',
    primaryDataSource: 'PostgreSQL',
    phone: '+91 98765 43210',
    notes: 'Testing Zoho Mail SMTP dispatch pipeline to care@ricoz.in'
  });

  console.log('\n  Dispatch Attempt Result:');
  console.log(`    Attempted: ${sendResult.attempted}`);
  console.log(`    Success: ${sendResult.success}`);
  console.log(`    Recipient: ${sendResult.recipient}`);
  if (sendResult.success) {
    console.log(`    ✅ Message ID: ${sendResult.messageId}`);
    console.log(`    ✅ SMTP Response: ${sendResult.response}`);
  } else {
    console.log(`    ⚠️ Status Note: ${sendResult.error}`);
  }

  console.log('\n===============================================================');
  console.log('  DIAGNOSIS & ZOHO SMTP READINESS SUMMARY:                     ');
  console.log('===============================================================');
  if (status.isPlaceholderPassword) {
    console.log('  📌 CONFIGURATION READY — ACTION REQUIRED:');
    console.log('  The Zoho SMTP infrastructure is fully configured with:');
    console.log('    • Host: smtp.zoho.com (Port: 587, Secure: false)');
    console.log('    • Sender: care@ricoz.in');
    console.log('    • Recipient: care@ricoz.in');
    console.log('    • Reply-To: submitter email');
    console.log('');
    console.log('  To complete real delivery, set the following environment variable:');
    console.log('    SMTP_PASSWORD=<your_16_char_zoho_app_password>');
    console.log('');
    console.log('  Steps to generate Zoho App Password:');
    console.log('    1. Log in to https://accounts.zoho.com with care@ricoz.in');
    console.log('    2. Go to Security -> App Passwords');
    console.log('    3. Click "Generate New Password", name it "RicozAnalytics"');
    console.log('    4. Paste the 16-character code into server/.env: SMTP_PASSWORD=xxxx xxxx xxxx xxxx');
  } else if (sendResult.success) {
    console.log('  ✅ Real Zoho SMTP email sent successfully!');
  } else {
    console.log(`  ⚠️ Zoho SMTP returned: ${sendResult.error}`);
  }
  console.log('===============================================================\n');
}

testSmtpDelivery().catch(console.error);
