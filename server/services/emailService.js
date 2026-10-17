const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const dns = require('dns');
if (dns && dns.setDefaultResultOrder) {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch (_) {}
}
const nodemailer = require('nodemailer');

/**
 * Enterprise Email Dispatch Service for Scheduled Reports, Alerts & Inbound Demo Inquiries
 * Configured with dynamic SMTP integration (Gmail, Zoho Mail, or custom SMTP) and HTTPS API support.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this._initTransporter();
  }

  _getProviderName(host = '') {
    const h = (host || '').toLowerCase();
    if (h.includes('gmail.com')) return 'Gmail';
    if (h.includes('zoho.com')) return 'Zoho Mail';
    if (h.includes('sendgrid.net')) return 'SendGrid';
    if (h.includes('mailgun.org')) return 'Mailgun';
    if (h.includes('office365.com') || h.includes('outlook.com')) return 'Microsoft 365';
    return 'Custom SMTP';
  }

  _initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const provider = this._getProviderName(host);

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          family: 4, // Explicitly enforce IPv4 to prevent ENETUNREACH / ETIMEDOUT on cloud providers
          auth: {
            user,
            pass
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 10000, // 10s max connection handshake timeout
          greetingTimeout: 8000,    // 8s max greeting timeout
          socketTimeout: 15000      // 15s max socket timeout
        });
        const maskedUser = user.length > 4 ? `${user.slice(0, 2)}***${user.slice(-2)}` : '***';
        const isPlaceholder = pass.includes('your_') || pass.includes('placeholder') || pass === 'your_zoho_app_password_here';
        console.log(`[EmailService] ✅ ${provider} SMTP Transporter initialized (Host: ${host}:${port}, Secure: ${secure}, IPv4-First: true, Sender: ${maskedUser}, Password: ${isPlaceholder ? 'Placeholder' : 'Configured'})`);
      } catch (err) {
        console.error(`[EmailService] ❌ ${provider} SMTP transport initialization exception:`, err.message);
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
   * @returns {{ configured: boolean, provider: string, host?: string, port?: number, secure?: boolean, senderUser?: string, fromEmail: string, demoRecipient: string, isPlaceholderPassword: boolean, missingVars: Array<string> }}
   */
  getSmtpStatus() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const fromEmail = process.env.SMTP_FROM || process.env.REPORT_FROM_EMAIL || user || 'care@ricoz.in';
    const demoRecipient = process.env.DEMO_REQUEST_EMAIL || user || 'care@ricoz.in';
    const provider = this._getProviderName(host);

    const missingVars = [];
    if (!host) missingVars.push('SMTP_HOST');
    if (!user) missingVars.push('SMTP_USER');
    if (!pass) missingVars.push('SMTP_PASSWORD');

    const isPlaceholderPassword = !pass || pass.includes('your_') || pass.includes('placeholder') || pass === 'your_zoho_app_password_here';
    const maskedUser = user ? (user.length > 4 ? `${user.slice(0, 2)}***${user.slice(-2)}` : '***') : null;

    return {
      configured: missingVars.length === 0,
      provider,
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
   * @returns {Promise<{ configured: boolean, success: boolean, provider: string, message: string, errorCode?: string }>}
   */
  async verifyConnection() {
    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      return {
        configured: false,
        success: false,
        provider: status.provider,
        message: `${status.provider} SMTP not configured. Missing: ${status.missingVars.join(', ')}`
      };
    }

    const host = process.env.SMTP_HOST || '';
    const provider = this._getProviderName(host);

    try {
      await this.transporter.verify();
      return {
        configured: true,
        success: true,
        provider,
        message: `${provider} SMTP connection and authentication verified successfully.`
      };
    } catch (err) {
      let advice = err.message;
      if (err.code === 'EAUTH' || err.message.includes('535') || err.message.includes('Authentication Failed')) {
        advice = `${provider} SMTP Authentication Failed (535 5.7.8). Check your credentials / App Password in SMTP_PASSWORD.`;
      }
      return {
        configured: true,
        success: false,
        provider,
        message: `${provider} SMTP connection verification failed: ${advice}`,
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
   * Safe Diagnostic Test Email Dispatcher
   * Sends a single diagnostic test email to the specified recipient.
   * @param {{ recipient: string, subject?: string }} options
   * @returns {Promise<{ attempted: boolean, success: boolean, recipient: string, messageId?: string, response?: string, error?: string, provider?: string }>}
   */
  async sendTestEmail({ recipient, subject = 'RicozAnalytics SMTP Test Verification' }) {
    if (!recipient) {
      return { attempted: false, success: false, recipient: '', error: 'Recipient email address is required' };
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const provider = this._getProviderName(host);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ricozanalytics@gmail.com';

    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      return {
        attempted: false,
        success: false,
        recipient,
        provider,
        error: `${provider} SMTP transport not configured. Missing: ${status.missingVars.join(', ')}`
      };
    }

    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'long'
    }) + ` (${new Date().toUTCString()})`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 20px 24px; border-radius: 8px; color: #ffffff; border-bottom: 3px solid #10b981;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
            <span style="color: #10b981;">RICOZ</span> ANALYTICS
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
            SMTP Delivery Verification Dispatcher
          </p>
        </div>

        <div style="padding: 24px 0 12px 0;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
            Email Delivery Confirmed ✅
          </h2>
          <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.5;">
            This test email confirms that the <strong>${provider} SMTP</strong> transport configured on RicozAnalytics is active, authenticated, and successfully routing outbound messages to your mailbox.
          </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 35%;">Provider:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${provider} SMTP</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Host:</td>
              <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${host}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Sender:</td>
              <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${fromEmail}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Target Recipient:</td>
              <td style="padding: 6px 0; color: #10b981; font-weight: 700; font-family: monospace;">${recipient}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Timestamp:</td>
              <td style="padding: 6px 0; color: #64748b; font-size: 12px;">${formattedDate}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #065f46; line-height: 1.4;">
            <strong>Diagnostics Succeeded:</strong> Transport verification passed and Google SMTP accepted delivery.
          </p>
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
          Sent by RicozAnalytics Automated Email Verification Service. All rights reserved.
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"RicozAnalytics" <${fromEmail}>`,
      to: recipient,
      subject: `[RicozAnalytics] ${subject}`,
      html: htmlContent,
      text: `RicozAnalytics Test Delivery: SMTP connection and delivery verified successfully.\nProvider: ${provider}\nSender: ${fromEmail}\nRecipient: ${recipient}\nTimestamp: ${timestamp}`
    };

    console.log(`[EmailService] 📨 Attempting test email dispatch to: ${recipient} via ${provider}`);

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Test email dispatched successfully to: ${recipient}`);
      console.log(`  -> Message ID: ${info.messageId}`);
      console.log(`  -> SMTP Response: ${info.response || '250 OK'}`);

      return {
        attempted: true,
        success: true,
        provider,
        recipient,
        messageId: info.messageId,
        response: info.response || '250 OK',
        accepted: info.accepted || [recipient],
        rejected: info.rejected || []
      };
    } catch (err) {
      console.error(`[EmailService] ❌ Test email dispatch failed to ${recipient}:`, err.message);
      return {
        attempted: true,
        success: false,
        provider,
        recipient,
        error: err.message,
        code: err.code || 'SMTP_SEND_FAILED'
      };
    }
  }

  /**
   * Send Enterprise Demo Request Notification Email to the Ricoz Team and Confirmation to the Prospect
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
   * @returns {Promise<{ attempted: boolean, success: boolean, messageId?: string, response?: string, error?: string, recipient: string, prospectConfirmation?: { attempted: boolean, success: boolean, messageId?: string, error?: string }, missingVars?: Array<string> }>}
   */
  /**
   * Helper to categorize email transport exceptions safely
   */
  _classifyError(err, provider = 'SMTP') {
    const msg = err.message || '';
    const code = err.code || 'UNKNOWN';

    if (msg.includes('550-5.4.5') || msg.includes('Daily user sending limit exceeded') || err.responseCode === 550) {
      return {
        code: 'DAILY_LIMIT_EXCEEDED',
        isQuotaError: true,
        isTransient: false,
        message: `${provider} Daily Sending Limit Exceeded (550 5.4.5). Google has capped outbound emails for this account until the 24-hour quota resets.`
      };
    }
    if (code === 'ETIMEDOUT' || msg.includes('timeout')) {
      return {
        code: 'ETIMEDOUT',
        isQuotaError: false,
        isTransient: true,
        message: `${provider} connection timed out. Outbound network traffic may be blocked by cloud host firewall (Render Free tier blocks outbound ports 25, 465, 587) or network latency.`
      };
    }
    if (code === 'ENETUNREACH' || msg.includes('ENETUNREACH')) {
      return {
        code: 'ENETUNREACH',
        isQuotaError: false,
        isTransient: true,
        message: `${provider} network unreachable. Host lacks IPv6 route or network interface unreachable.`
      };
    }
    if (code === 'EAUTH' || msg.includes('535') || msg.includes('Authentication Failed')) {
      return {
        code: 'EAUTH',
        isQuotaError: false,
        isTransient: false,
        message: `${provider} Authentication Failed (535). Verify SMTP credentials and App Password in SMTP_PASSWORD.`
      };
    }

    return {
      code: code || 'SEND_FAILED',
      isQuotaError: false,
      isTransient: true,
      message: msg
    };
  }

  /**
   * Send internal notification to the Ricoz team about an inbound demo request
   */
  async sendInternalDemoNotification({
    fullName,
    workEmail,
    company,
    teamSize,
    primaryDataSource,
    phone = null,
    notes = null,
    requestedAt = new Date()
  }) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const provider = this._getProviderName(host);
    const recipient = process.env.DEMO_REQUEST_EMAIL || process.env.SMTP_USER || 'ricozanalytics@gmail.com';
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ricozanalytics@gmail.com';
    const formattedDate = new Date(requestedAt).toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'long'
    }) + ` (${new Date(requestedAt).toUTCString()})`;

    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      return {
        attempted: false,
        success: false,
        recipient,
        error: `${provider} SMTP transport not configured. Missing: ${status.missingVars.join(', ')}`,
        code: 'NOT_CONFIGURED'
      };
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 8px; color: #ffffff; text-align: left; border-bottom: 3px solid #dc2626;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
            <span style="color: #ef4444;">RICOZ</span> ANALYTICS
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
            Enterprise Architecture Inbound Lead
          </p>
        </div>
        <div style="padding: 24px 0 12px 0;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">New Demo Request</h2>
          <p style="font-size: 14px; color: #64748b; margin: 0;">An enterprise lead has requested an architecture walkthrough.</p>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Full Name</td><td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${fullName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Work Email</td><td style="padding: 8px 0; color: #dc2626; font-weight: 700;"><a href="mailto:${workEmail}" style="color: #dc2626;">${workEmail}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Company</td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${company}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Team Size</td><td style="padding: 8px 0; color: #0f172a;">${teamSize}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Data Source</td><td style="padding: 8px 0; color: #0f172a;">${primaryDataSource}</td></tr>
            ${phone ? `<tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Phone</td><td style="padding: 8px 0; color: #0f172a;">${phone}</td></tr>` : ''}
            ${notes ? `<tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Notes</td><td style="padding: 8px 0; color: #334155;">${notes}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requested At</td><td style="padding: 8px 0; color: #64748b; font-size: 13px;">${formattedDate}</td></tr>
          </table>
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

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Internal demo notification delivered to ${recipient} (${info.messageId})`);
      return {
        attempted: true,
        success: true,
        recipient,
        messageId: info.messageId,
        response: info.response || '250 OK'
      };
    } catch (err) {
      const classification = this._classifyError(err, provider);
      console.error(`[EmailService] ❌ Internal demo notification failed to ${recipient}: [${classification.code}] ${classification.message}`);
      return {
        attempted: true,
        success: false,
        recipient,
        error: classification.message,
        code: classification.code,
        isQuotaError: classification.isQuotaError,
        isTransient: classification.isTransient
      };
    }
  }

  /**
   * Send prospect confirmation email acknowledging their demo request
   */
  async sendProspectDemoConfirmation({
    fullName,
    workEmail,
    company,
    primaryDataSource,
    requestedAt = new Date()
  }) {
    if (!workEmail || !workEmail.includes('@') || this.isTestOrPlaceholderRecipient(workEmail)) {
      return {
        attempted: false,
        skipped: true,
        success: true,
        recipient: workEmail || '',
        message: 'Prospect confirmation skipped (placeholder or non-standard recipient domain)'
      };
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const provider = this._getProviderName(host);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ricozanalytics@gmail.com';

    if (!this.isConfigured()) {
      return {
        attempted: false,
        success: false,
        recipient: workEmail,
        error: 'SMTP transport not configured',
        code: 'NOT_CONFIGURED'
      };
    }

    const prospectHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 20px 24px; border-radius: 8px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
            <span style="color: #ef4444;">RICOZ</span> ANALYTICS
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Demo Request Confirmation</p>
        </div>
        <div style="padding: 24px 0;">
          <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 12px 0;">Hello ${fullName},</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
            Thank you for your interest in RicozAnalytics. We have received your request for an enterprise architecture walkthrough for <strong>${company}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px;">
            <p style="margin: 0 0 8px 0; color: #64748b;"><strong>What happens next:</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6;">
              <li>An enterprise solutions architect will review your data requirements (${primaryDataSource}).</li>
              <li>We will reach out to schedule your personalized live cockpit demo.</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            If you have urgent questions, reply directly to this email or contact us at <a href="mailto:${fromEmail}" style="color: #ef4444;">${fromEmail}</a>.
          </p>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
          © ${new Date().getFullYear()} RicozAnalytics Inc.
        </div>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: `"RicozAnalytics Team" <${fromEmail}>`,
        to: workEmail,
        subject: `We've received your RicozAnalytics demo request, ${fullName}`,
        html: prospectHtml
      });
      console.log(`[EmailService] ✅ Prospect confirmation delivered to ${workEmail} (${info.messageId})`);
      return {
        attempted: true,
        success: true,
        recipient: workEmail,
        messageId: info.messageId,
        response: info.response || '250 OK'
      };
    } catch (err) {
      const classification = this._classifyError(err, provider);
      console.warn(`[EmailService] ⚠️ Prospect confirmation failed to ${workEmail}: [${classification.code}] ${classification.message}`);
      return {
        attempted: true,
        success: false,
        recipient: workEmail,
        error: classification.message,
        code: classification.code,
        isQuotaError: classification.isQuotaError,
        isTransient: classification.isTransient
      };
    }
  }

  /**
   * Send Enterprise Demo Request Notification Email to the Ricoz Team and Confirmation to the Prospect
   * Orchestrates separate delivery outcomes for internal notification and prospect confirmation.
   */
  async sendDemoRequestEmail(payload) {
    const internalRes = await this.sendInternalDemoNotification(payload);
    const prospectRes = await this.sendProspectDemoConfirmation(payload);

    return {
      attempted: internalRes.attempted || prospectRes.attempted,
      success: internalRes.success && (prospectRes.success || prospectRes.skipped),
      recipient: internalRes.recipient,
      messageId: internalRes.messageId,
      response: internalRes.response,
      error: internalRes.error || (prospectRes.success ? null : prospectRes.error),
      code: internalRes.code || prospectRes.code,
      internalNotification: internalRes,
      prospectConfirmation: prospectRes
    };
  }

  /**
   * Check if recipient address is a placeholder or synthetic test address
   * (e.g., example.com, example.org, *.test, *.invalid, testuser_*)
   * @param {string} email
   * @returns {boolean}
   */
  isTestOrPlaceholderRecipient(email) {
    if (!email || typeof email !== 'string') return false;
    const lower = email.toLowerCase().trim();
    const parts = lower.split('@');
    if (parts.length !== 2) return false;
    const [user, domain] = parts;

    // RFC 2606 & RFC 6761 reserved test and documentation domains
    const testDomains = [
      'example.com',
      'example.org',
      'example.net',
      'example.edu',
      'test',
      'test.com',
      'ricoz.test',
      'other.test',
      'foreign.test',
      'invalid',
      'localhost'
    ];

    if (testDomains.includes(domain) || domain.endsWith('.test') || domain.endsWith('.invalid') || domain.endsWith('.localhost')) {
      return true;
    }

    if (user.startsWith('testuser_verif') || user.startsWith('testuser') || user.startsWith('test_registrant') || user.startsWith('enterprise_tester')) {
      return true;
    }

    return false;
  }

  /**
   * Send Account Verification Email with 6-digit OTP and 1-Click Verification Link
   * @param {{ email: string, name?: string, token: string, otp: string, verifyUrl?: string }} options
   * @returns {Promise<{ attempted: boolean, success: boolean, recipient: string, deliveredTo?: string, isTestRedirect?: boolean, mocked?: boolean, messageId?: string, response?: string, provider?: string, error?: string }>}
   */
  async sendVerificationEmail({ email, name, token, otp, verifyUrl }) {
    if (!email) {
      return { attempted: false, success: false, recipient: '', error: 'Recipient email is required' };
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const provider = this._getProviderName(host);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ricozanalytics@gmail.com';
    const link = verifyUrl || `http://localhost:5173/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    console.log(`[EmailService] ✉️ Verification email dispatch initiated for: ${email} via ${provider}`);

    // Check if recipient is a test or placeholder address (e.g. example.com, *.test)
    const isTestRecipient = this.isTestOrPlaceholderRecipient(email);
    const mockMode = process.env.MOCK_EMAIL === 'true' || process.env.NODE_ENV === 'test';
    const testRoutingEnabled = process.env.ENABLE_TEST_EMAIL_ROUTING === 'true';
    const testInbox = (testRoutingEnabled || process.env.NODE_ENV === 'test')
      ? (process.env.TEST_EMAIL_INBOX || process.env.TEST_EMAIL_RECIPIENT)
      : null;

    // Real users' emails are NEVER routed to TEST_EMAIL_INBOX; they are always delivered directly to their submitted email!
    let deliveryRecipient = email;
    let isTestRedirect = false;

    if (isTestRecipient) {
      if (testInbox && !mockMode) {
        deliveryRecipient = testInbox;
        isTestRedirect = true;
        console.log(`[EmailService] 🧪 [Explicit Test Routing Active] Placeholder "${email}" routed to test inbox: "${testInbox}"`);
      } else {
        // Safe mock for placeholder domains when test inbox routing is not explicitly enabled or mock mode is requested
        console.log(`[EmailService] 🧪 Safe Mock: Skipping SMTP delivery for placeholder address "${email}" (Credentials & tokens safely generated in DB)`);
        return {
          attempted: true,
          mocked: true,
          success: true,
          recipient: email,
          provider: 'MockTestService',
          messageId: `<mock-${Date.now()}@ricozanalytics.test>`,
          response: '250 Mock email accepted for test placeholder'
        };
      }
    }

    if (!this.isConfigured()) {
      const status = this.getSmtpStatus();
      console.warn(`[EmailService] ⚠️ ${provider} SMTP transport not configured. Verification email skipped for: ${email}. Missing: ${status.missingVars.join(', ')}`);
      return {
        attempted: false,
        success: false,
        recipient: email,
        provider,
        error: `${provider} SMTP transport not configured. Missing: ${status.missingVars.join(', ')}`
      };
    }

    const recipientName = (name || 'there').trim();
    const expiryHours = 24;

    const testBannerHtml = isTestRedirect ? `
        <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #92400e; line-height: 1.5;">
          <strong>🧪 Test Routing Notice:</strong> This verification email was registered for placeholder recipient <code>${email}</code>. Because placeholder domains cannot receive mail, it was safely routed to your configured test inbox (<code>${deliveryRecipient}</code>).
        </div>
    ` : '';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <!-- Brand Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 8px; color: #ffffff; border-bottom: 3px solid #2563eb;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
            ricoz<span style="color: #3b82f6;">Analytics</span>
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
            Enterprise Workspace Email Verification
          </p>
        </div>

        <!-- Headline & Welcome -->
        <div style="padding: 24px 0 12px 0;">
          ${testBannerHtml}
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0;">
            Verify your email address
          </h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
            Hi <strong>${recipientName}</strong>, welcome to RicozAnalytics! Your 14-day full enterprise trial workspace has been initialized. Please verify your email address to activate your access.
          </p>
        </div>

        <!-- 6-Digit OTP Box -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 22px; text-align: center; margin: 20px 0;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 10px;">
            Your 6-Digit Verification Code
          </div>
          <div style="font-family: 'Courier New', Courier, monospace, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e293b; padding-left: 10px;">
            ${otp}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
            This verification code is single-use and will expire in ${expiryHours} hours.
          </div>
        </div>

        <!-- 1-Click Verification CTA Button -->
        <div style="text-align: center; margin: 28px 0 20px 0;">
          <a href="${link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.25);">
            Verify Email &amp; Launch Workspace
          </a>
        </div>

        <!-- Direct Link Fallback -->
        <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 14px; margin-top: 20px; font-size: 12px; color: #64748b; word-break: break-all;">
          <span style="font-weight: 600; color: #334155;">Direct Verification Link:</span><br/>
          <a href="${link}" style="color: #2563eb; text-decoration: underline;">${link}</a>
        </div>

        <!-- Security Notice Footer -->
        <div style="border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
          <p style="margin: 0;">If you did not register for a RicozAnalytics account, you can safely disregard this email.</p>
          <p style="margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} RicozAnalytics Inc. Security &amp; Tenant Isolation Verified.</p>
        </div>
      </div>
    `;

    const textHeader = isTestRedirect ? `[TEST ROUTE: Intended for ${email} -> Delivered to ${deliveryRecipient}]\n\n` : '';
    const textContent = textHeader + [
      `RicozAnalytics Enterprise Email Verification`,
      `-------------------------------------------`,
      `Hi ${recipientName},`,
      ``,
      `Welcome to RicozAnalytics! Your 14-day enterprise trial workspace has been initialized.`,
      `Please verify your email address to activate your access.`,
      ``,
      `Your 6-Digit Verification Code: ${otp}`,
      `(This verification code will expire in ${expiryHours} hours)`,
      ``,
      `Alternatively, verify directly using this link:`,
      link,
      ``,
      `If you did not request this verification, you can safely ignore this message.`,
      `© ${new Date().getFullYear()} RicozAnalytics Inc.`
    ].join('\n');

    const subjectPrefix = isTestRedirect ? `[TEST for ${email}] ` : '';
    const subject = `${subjectPrefix}[RicozAnalytics] Verify your email address (${otp})`;

    const mailOptions = {
      from: `"RicozAnalytics Security" <${fromEmail}>`,
      to: deliveryRecipient,
      replyTo: fromEmail,
      subject,
      html: htmlContent,
      text: textContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Verification email dispatched successfully to: ${deliveryRecipient}${isTestRedirect ? ` (intended: ${email})` : ''}`);
      console.log(`  -> Message ID: ${info.messageId}`);
      console.log(`  -> SMTP Response: ${info.response || '250 OK'}`);

      return {
        attempted: true,
        success: true,
        recipient: email,
        deliveredTo: deliveryRecipient,
        isTestRedirect,
        provider,
        messageId: info.messageId,
        response: info.response || '250 OK'
      };
    } catch (err) {
      console.error(`[EmailService] ❌ Verification email SMTP dispatch failed to ${deliveryRecipient}:`, err.message);
      return {
        attempted: true,
        success: false,
        recipient: email,
        deliveredTo: deliveryRecipient,
        isTestRedirect,
        provider,
        error: err.message,
        code: err.code || 'SMTP_DISPATCH_FAILED'
      };
    }
  }

  /**
   * Send Team Member Invitation Email
   * @param {{ email: string, inviterName: string, orgName: string, role: string, inviteUrl: string }} options
   */
  async sendInvitationEmail({ email, inviterName, orgName, role, inviteUrl }) {
    const fromEmail = process.env.SMTP_FROM || 'care@ricoz.in';
    const link = inviteUrl || `http://localhost:5173/auth/accept-invite?email=${encodeURIComponent(email)}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 24px;">
          <span style="font-weight: 800; font-size: 20px; color: #0f172a; letter-spacing: -0.5px;">ricoz<span style="color: #2563eb;">Analytics</span></span>
          <span style="margin-left: 8px; font-size: 10px; font-weight: 700; background: #eff6ff; color: #2563eb; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">Workspace Invitation</span>
        </div>
        <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;">You've been invited to join ${orgName}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          <strong>${inviterName || 'An administrator'}</strong> has invited you to join the <strong>${orgName}</strong> team on RicozAnalytics with the role of <strong>${role.toUpperCase()}</strong>.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
            Accept Invitation & Join Team
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
          This invitation link is valid for 7 days.<br>
          <a href="${link}" style="color: #2563eb; word-break: break-all;">${link}</a>
        </p>

        <div style="border-top: 1px solid #f1f5f9; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
          © ${new Date().getFullYear()} RicozAnalytics Inc.
        </div>
      </div>
    `;

    console.log(`[EmailService] ✉️ Team Invitation generated for: ${email} -> ${orgName} (${role})`);

    if (!this.isConfigured()) {
      return {
        attempted: false,
        success: true,
        recipient: email,
        inviteUrl: link
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"RicozAnalytics Team" <${fromEmail}>`,
        to: email,
        subject: `Invitation to join ${orgName} on RicozAnalytics`,
        html: htmlContent
      });
      return {
        attempted: true,
        success: true,
        recipient: email,
        messageId: info.messageId
      };
    } catch (err) {
      console.warn(`[EmailService] Invitation email SMTP warning: ${err.message}`);
      return {
        attempted: true,
        success: false,
        recipient: email,
        error: err.message
      };
    }
  }

  /**
   * Send Password Reset Email
   * @param {{ email: string, name?: string, token: string, resetUrl?: string }} options
   */
  async sendPasswordResetEmail({ email, name, token, resetUrl }) {
    const fromEmail = process.env.SMTP_FROM || 'care@ricoz.in';
    const link = resetUrl || `http://localhost:5173/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 24px;">
          <span style="font-weight: 800; font-size: 20px; color: #0f172a; letter-spacing: -0.5px;">ricoz<span style="color: #2563eb;">Analytics</span></span>
          <span style="margin-left: 8px; font-size: 10px; font-weight: 700; background: #eff6ff; color: #2563eb; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">Security</span>
        </div>
        <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;">Reset your password</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Hi ${name || 'there'}, we received a request to reset your password for your RicozAnalytics account. Click the button below to choose a new password:
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
            Reset Password
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
          This password reset link is single-use and will expire in 1 hour.<br>
          If you did not request a password reset, you can safely ignore this email.<br>
          <a href="${link}" style="color: #2563eb; word-break: break-all;">${link}</a>
        </p>

        <div style="border-top: 1px solid #f1f5f9; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
          © ${new Date().getFullYear()} RicozAnalytics Inc.
        </div>
      </div>
    `;

    console.log(`[EmailService] ✉️ Password Reset Email generated for: ${email}`);

    if (!this.isConfigured()) {
      return {
        attempted: false,
        success: true,
        recipient: email,
        token,
        resetUrl: link
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"RicozAnalytics Security" <${fromEmail}>`,
        to: email,
        subject: 'Reset your RicozAnalytics password',
        html: htmlContent
      });
      return {
        attempted: true,
        success: true,
        recipient: email,
        messageId: info.messageId
      };
    } catch (err) {
      console.warn(`[EmailService] Password reset email SMTP warning: ${err.message}`);
      return {
        attempted: true,
        success: false,
        recipient: email,
        error: err.message
      };
    }
  }
}

module.exports = new EmailService();

