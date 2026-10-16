/**
 * RicozAnalytics Enterprise SMTP Test CLI Utility
 * 
 * Safe command-line tool to test and verify outbound email delivery without exposing credentials.
 * Usage:
 *   node server/send-test-email.js [recipient_email]
 * 
 * Example:
 *   node server/send-test-email.js gowthamgannamaneedi@gmail.com
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const emailService = require('./services/emailService');

async function run() {
  console.log('====================================================');
  console.log(' RicozAnalytics SMTP Delivery Verification Tool');
  console.log('====================================================');

  const status = emailService.getSmtpStatus();
  console.log(`[Config] Provider : ${status.provider} SMTP`);
  console.log(`[Config] Host     : ${status.host || 'Not set'}:${status.port || 'Not set'}`);
  console.log(`[Config] Secure   : ${status.secure ? 'SSL/TLS (Port 465)' : 'STARTTLS (Port 587)'}`);
  console.log(`[Config] Sender   : ${status.fromEmail}`);
  console.log(`[Config] User     : ${status.senderUser || 'Not set'}`);
  console.log(`[Config] Password : ${status.configured ? 'Configured (Masked)' : 'Missing'}`);
  console.log('----------------------------------------------------');

  if (!status.configured) {
    console.error(`[Error] ❌ SMTP transport is incomplete. Missing variables: ${status.missingVars.join(', ')}`);
    process.exit(1);
  }

  // Determine recipient
  const targetRecipient = (process.argv[2] || process.env.TEST_EMAIL_RECIPIENT || 'gowthamgannamaneedi@gmail.com').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetRecipient)) {
    console.error(`[Error] ❌ Invalid recipient email: "${targetRecipient}". Please pass a valid email address.`);
    process.exit(1);
  }

  console.log(`[Step 1] Verifying SMTP connection & credentials handshake...`);
  const handshake = await emailService.verifyConnection();
  if (!handshake.success) {
    console.error(`[Error] ❌ SMTP Handshake failed: ${handshake.message}`);
    process.exit(1);
  }
  console.log(`[Step 1] ✅ Handshake successful: ${handshake.message}`);

  console.log(`\n[Step 2] Sending live diagnostic test email to: ${targetRecipient}...`);
  const sendResult = await emailService.sendTestEmail({
    recipient: targetRecipient,
    subject: 'Live SMTP Delivery Verification'
  });

  if (!sendResult.success) {
    console.error(`[Step 2] ❌ Test email delivery failed: ${sendResult.error}`);
    process.exit(1);
  }

  console.log(`[Step 2] ✅ Test email delivered successfully!`);
  console.log(`  -> Target Recipient : ${sendResult.recipient}`);
  console.log(`  -> Message ID       : ${sendResult.messageId}`);
  console.log(`  -> SMTP Response    : ${sendResult.response}`);
  console.log(`  -> Accepted By SMTP : ${sendResult.accepted.join(', ')}`);
  console.log('====================================================');
  console.log(' Delivery verified live. Please check your inbox / spam folder.');
  console.log('====================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Fatal Error]:', err.message);
  process.exit(1);
});
