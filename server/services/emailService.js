const nodemailer = require('nodemailer');

/**
 * Enterprise Email Dispatch Service for Scheduled Reports, Alerts & Inbound Demo Inquiries
 * Configured with Zoho Mail SMTP integration.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this._initTransporter();
  }

  _initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.zoho.com';
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const user = process.env.SMTP_USER || 'care@ricoz.in';
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const maskedUser = user.length > 4 ? `${user.slice(0, 2)}***${user.slice(-2)}` : '***';
        const isPlaceholder = pass.includes('your_') || pass.includes('placeholder') || pass === 'your_zoho_app_password_here';
        console.log(`[EmailService] ✅ Zoho SMTP Transporter initialized (Host: ${host}:${port}, Secure: ${secure}, Sender: ${maskedUser}, App Password: ${isPlaceholder ? 'Placeholder' : 'Configured'})`);
      } catch (err) {
        console.error('[EmailService] ❌ Zoho SMTP transport initialization exception:', err.message);
        this.transporter = null;
      }
    } else {
      const missing = [];
      if (!host) missing.push('SMTP_HOST');
      if (!user) missing.push('SMTP_USER');
      if (!pass) missing.push('SMTP_PASSWORD');
      console.warn(`[EmailService] ⚠️ SMTP transport not configured. Missing environment variables: ${missing.join(', ')}.`);
      this.transporter = null;
    }
  }

  /**
   * Check if email delivery is configured in environment
   * @returns {boolean}
   */
  isConfigured() {
    if (!this.transporter && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this._initTransporter();
    }
    return this.transporter !== null;
  }

  /**
   * Safe Diagnostic Status Inspector
   * @returns {{ configured: boolean, host?: string, port?: number, secure?: boolean, senderUser?: string, fromEmail: string, demoRecipient: string, isPlaceholderPassword: boolean, missingVars: Array<string> }}
   */
  getSmtpStatus() {
    const host = process.env.SMTP_HOST || 'smtp.zoho.com';
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const user = process.env.SMTP_USER || 'care@ricoz.in';
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const fromEmail = process.env.SMTP_FROM || process.env.REPORT_FROM_EMAIL || 'care@ricoz.in';
    const demoRecipient = process.env.DEMO_REQUEST_EMAIL || 'care@ricoz.in';

    const missingVars = [];
    if (!host) missingVars.push('SMTP_HOST');
    if (!user) missingVars.push('SMTP_USER');
    if (!pass) missingVars.push('SMTP_PASSWORD');

    const isPlaceholderPassword = !pass || pass.includes('your_') || pass.includes('placeholder') || pass === 'your_zoho_app_password_here';
    const maskedUser = user ? (user.length > 4 ? `${user.slice(0, 2)}***${user.slice(-2)}` : '***') : null;

    return {
      configured: missingVars.length === 0,
      host: host || null,
      port: host ? port : null,
      secure: host ? secure : null,
      senderUser: maskedUser,
      fromEmail,
      demoRecipient,
      isPlaceholderPassword,
      missingVars
    };
  }

  /**
   * Test live SMTP handshake connection
   * @returns {Promise<{ configured: boolean, success: boolean, message: string, errorCode?: string }>}
   */
  async verifyConnection() {
    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      return {
        configured: false,
        success: false,
        message: `Zoho SMTP not configured. Missing: ${status.missingVars.join(', ')}`
      };
    }

    try {
      await this.transporter.verify();
      return {
        configured: true,
        success: true,
        message: 'Zoho SMTP handshake and authentication verified successfully.'
      };
    } catch (err) {
      let advice = err.message;
      if (err.code === 'EAUTH' || err.message.includes('535') || err.message.includes('Authentication Failed')) {
        advice = 'Zoho SMTP Authentication Failed (535 5.7.8). Please provide a dedicated Zoho App Password (from accounts.zoho.com -> Security -> App Passwords) in SMTP_PASSWORD.';
      }
      return {
        configured: true,
        success: false,
        message: `Zoho SMTP connection verification failed: ${advice}`,
        errorCode: err.code || 'EAUTH'
      };
    }
  }

  /**
   * Send Report Email with optional attachment
   * @param {{
   *   recipients: Array<string>,
   *   reportTitle: string,
   *   organizationName: string,
   *   format: string,
   *   attachmentBuffer?: Buffer,
   *   attachmentFileName?: string,
   *   summaryHtml?: string
   * }} options
   * @returns {Promise<{ attempted: boolean, success: boolean, messageId?: string, error?: string }>}
   */
  async sendReportEmail({
    recipients = [],
    reportTitle,
    organizationName,
    format = 'pdf',
    attachmentBuffer = null,
    attachmentFileName = 'report.pdf',
    summaryHtml = ''
  }) {
    if (!recipients || recipients.length === 0) {
      return { attempted: false, success: false, error: 'No recipients provided' };
    }

    const fromEmail = process.env.SMTP_FROM || process.env.REPORT_FROM_EMAIL || 'care@ricoz.in';

    if (!this.isConfigured()) {
      console.log(`[Email Notice] SMTP not configured. Skipped dispatching report "${reportTitle}" to: ${recipients.join(', ')}`);
      return {
        attempted: false,
        success: false,
        error: 'SMTP transport not configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).'
      };
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #0f172a; padding: 16px; border-radius: 6px 6px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">RICOZ ANALYTICS</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Automated Intelligence Report</p>
        </div>
        <div style="padding: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">${reportTitle}</h3>
          <p style="color: #64748b; font-size: 14px;">Organization: <strong>${organizationName}</strong></p>
          <div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 15px 0;">
            ${summaryHtml || '<p style="margin: 0; color: #334155; font-size: 13px;">Your automated report is attached.</p>'}
          </div>
          <p style="color: #64748b; font-size: 12px;">The report has been generated in <strong>${format.toUpperCase()}</strong> format.</p>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          Sent by RicozAnalytics Reporting Engine. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"RicozAnalytics Reports" <${fromEmail}>`,
      to: recipients.join(', '),
      subject: `[Report] ${reportTitle} — ${organizationName}`,
      html: htmlContent,
      attachments: attachmentBuffer ? [
        {
          filename: attachmentFileName,
          content: attachmentBuffer
        }
      ] : []
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Report email sent successfully (${info.messageId}) to: ${recipients.join(', ')}`);
      return {
        attempted: true,
        success: true,
        messageId: info.messageId
      };
    } catch (err) {
      console.error(`[EmailService] Failed to dispatch report email to ${recipients.join(', ')}:`, err.message);
      return {
        attempted: true,
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Send Alert Breach Notification Email
   * @param {{
   *   recipients: Array<string>,
   *   alertTitle: string,
   *   metricName?: string,
   *   metricValue: number,
   *   thresholdValue: number,
   *   condition: string,
   *   severity?: string,
   *   organizationName: string,
   *   triggeredAt?: Date|string
   * }} options
   * @returns {Promise<{ attempted: boolean, success: boolean, messageId?: string, error?: string }>}
   */
  async sendAlertEmail({
    recipients = [],
    alertTitle,
    metricName = 'Metric',
    metricValue,
    thresholdValue,
    condition,
    severity = 'medium',
    organizationName,
    triggeredAt = new Date()
  }) {
    if (!recipients || recipients.length === 0) {
      return { attempted: false, success: false, error: 'No recipients provided' };
    }

    const fromEmail = process.env.SMTP_FROM || process.env.ALERT_FROM_EMAIL || process.env.REPORT_FROM_EMAIL || 'care@ricoz.in';

    if (!this.isConfigured()) {
      console.log(`[Email Notice] SMTP not configured. Skipped dispatching alert "${alertTitle}" (${severity.toUpperCase()}) to: ${recipients.join(', ')}`);
      return {
        attempted: false,
        success: false,
        error: 'SMTP transport not configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).'
      };
    }

    const severityColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : severity === 'medium' ? '#d97706' : '#2563eb';
    const conditionReadable = condition.replace(/_/g, ' ');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #0f172a; padding: 16px; border-radius: 6px 6px 0 0; color: white; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">RICOZ ANALYTICS</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Real-Time Operational Alert Incident</p>
          </div>
          <span style="background-color: ${severityColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
            ${severity}
          </span>
        </div>
        <div style="padding: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">🚨 Alert Triggered: ${alertTitle}</h3>
          <p style="color: #64748b; font-size: 14px;">Organization: <strong>${organizationName}</strong></p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 15px 0;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Metric:</strong></td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: bold;">${metricName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Current Value:</strong></td>
                <td style="padding: 6px 0; color: ${severityColor}; font-weight: bold; font-size: 15px;">${metricValue}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Condition:</strong></td>
                <td style="padding: 6px 0; color: #334155;">${conditionReadable}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Configured Threshold:</strong></td>
                <td style="padding: 6px 0; color: #334155; font-weight: bold;">${thresholdValue}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Triggered At:</strong></td>
                <td style="padding: 6px 0; color: #64748b;">${new Date(triggeredAt).toUTCString()}</td>
              </tr>
            </table>
          </div>
          <p style="color: #64748b; font-size: 12px;">Log in to the RicozAnalytics Incident Center to acknowledge or resolve this operational incident.</p>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          Sent by RicozAnalytics Real-Time Alerts Engine. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"RicozAnalytics Alerts" <${fromEmail}>`,
      to: recipients.join(', '),
      subject: `[${severity.toUpperCase()} ALERT] ${alertTitle} — ${organizationName}`,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Alert email sent successfully (${info.messageId}) to: ${recipients.join(', ')}`);
      return {
        attempted: true,
        success: true,
        messageId: info.messageId
      };
    } catch (err) {
      console.error(`[EmailService] Failed to dispatch alert email to ${recipients.join(', ')}:`, err.message);
      return {
        attempted: true,
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Send Enterprise Demo Request Notification Email to the Ricoz Team via Zoho Mail SMTP
   * @param {{
   *   fullName: string,
   *   workEmail: string,
   *   company: string,
   *   teamSize: string,
   *   primaryDataSource: string,
   *   phone?: string,
   *   notes?: string,
   *   requestedAt?: Date|string
   * }} options
   * @returns {Promise<{ attempted: boolean, success: boolean, messageId?: string, response?: string, error?: string, recipient: string, missingVars?: Array<string> }>}
   */
  async sendDemoRequestEmail({
    fullName,
    workEmail,
    company,
    teamSize,
    primaryDataSource,
    phone = null,
    notes = null,
    requestedAt = new Date()
  }) {
    const recipient = process.env.DEMO_REQUEST_EMAIL || 'care@ricoz.in';
    const fromEmail = process.env.SMTP_FROM || process.env.REPORT_FROM_EMAIL || 'care@ricoz.in';
    const formattedDate = new Date(requestedAt).toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'long'
    }) + ` (${new Date(requestedAt).toUTCString()})`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 8px; color: #ffffff; text-align: left; border-bottom: 3px solid #dc2626;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                <span style="color: #ef4444;">RICOZ</span> ANALYTICS
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Enterprise Architecture Inbound Lead
              </p>
            </div>
            <span style="background-color: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
              New Inbound Demo
            </span>
          </div>
        </div>

        <!-- Headline -->
        <div style="padding: 24px 0 12px 0;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
            New RicozAnalytics Demo Request
          </h2>
          <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.5;">
            A prospective enterprise lead has requested a guided architecture walkthrough and live cockpit consultation.
          </p>
        </div>

        <!-- Details Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 40%; border-bottom: 1px solid #f1f5f9;">Full Name</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Work Email</td>
              <td style="padding: 10px 0; color: #dc2626; font-weight: 700; font-family: monospace; font-size: 14px; border-bottom: 1px solid #f1f5f9;">
                <a href="mailto:${workEmail}" style="color: #dc2626; text-decoration: none;">${workEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Company / Organization</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Team / Branch Size</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${teamSize}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Primary Data Source</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${primaryDataSource}</td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Phone Number</td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${phone}</td>
            </tr>
            ` : ''}
            ${notes ? `
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Inquiry Notes</td>
              <td style="padding: 10px 0; color: #334155; border-bottom: 1px solid #f1f5f9;">${notes}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Request Date / Time</td>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px;">${formattedDate}</td>
            </tr>
          </table>
        </div>

        <!-- Direct Reply Box -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.4;">
            <strong>Pro-tip:</strong> You can click <strong>Reply</strong> in your email client to respond directly to <strong>${fullName}</strong> at <span style="font-family: monospace;">${workEmail}</span>.
          </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Sent automatically by RicozAnalytics Inbound Notification Engine via Zoho Mail</p>
          <p style="margin: 4px 0 0 0;">Recipient: ${recipient}</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"RicozAnalytics Demo Portal" <${fromEmail}>`,
      to: recipient,
      replyTo: `"${fullName}" <${workEmail}>`,
      subject: `New RicozAnalytics Demo Request: ${fullName} (${company})`,
      html: htmlContent
    };

    console.log('[EmailService] 📨 Attempting demo notification dispatch:');
    console.log(`  -> Recipient: ${recipient}`);
    console.log(`  -> Reply-To: "${fullName}" <${workEmail}>`);
    console.log(`  -> Company: ${company} | Source: ${primaryDataSource} | Team: ${teamSize}`);
    console.log(`  -> SMTP Configured: ${this.isConfigured() ? 'YES' : 'NO'}`);

    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      console.warn(`[EmailService] ⚠️ Zoho SMTP transport is NOT configured. Missing: ${status.missingVars.join(', ')}.`);
      return {
        attempted: false,
        success: false,
        recipient,
        missingVars: status.missingVars,
        error: `Zoho SMTP transport not configured. Missing environment variables: ${status.missingVars.join(', ')}`
      };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Zoho SMTP Dispatch SUCCESS:`);
      console.log(`  -> Recipient: ${recipient}`);
      console.log(`  -> Message ID: ${info.messageId}`);
      console.log(`  -> SMTP Response: ${info.response || '250 OK'}`);
      console.log(`  -> Accepted: ${info.accepted ? info.accepted.join(', ') : 'none'}`);
      if (info.rejected && info.rejected.length > 0) {
        console.warn(`  -> Rejected: ${info.rejected.join(', ')}`);
      }

      return {
        attempted: true,
        success: true,
        recipient,
        messageId: info.messageId,
        response: info.response || '250 OK',
        accepted: info.accepted || [recipient],
        rejected: info.rejected || []
      };
    } catch (err) {
      console.error(`[EmailService] ❌ Zoho SMTP Dispatch FAILED:`);
      console.error(`  -> Recipient: ${recipient}`);
      console.error(`  -> Error Code: ${err.code || 'UNKNOWN'}`);
      console.error(`  -> Error Message: ${err.message}`);

      let helpfulAdvice = '';
      if (err.code === 'EAUTH' || err.message.includes('535') || err.message.includes('Authentication Failed')) {
        helpfulAdvice = 'Zoho SMTP Authentication Failed (535 5.7.8). Please provide a dedicated Zoho App Password (from accounts.zoho.com -> Security -> App Passwords) in SMTP_PASSWORD.';
      }

      return {
        attempted: true,
        success: false,
        recipient,
        error: helpfulAdvice ? `${err.message} — ${helpfulAdvice}` : err.message,
        code: err.code || 'SMTP_AUTH_ERROR'
      };
    }
  }
}

module.exports = new EmailService();
