import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  Database, 
  Mail, 
  Trash2, 
  FileText, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <Logo size="md" linkTo="/" />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              to="/delete-account"
              className="hidden sm:inline-flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition"
            >
              <Trash2 size={14} />
              <span>Account Deletion</span>
            </Link>
            <Link
              to="/login"
              className="px-3.5 py-1.5 font-bold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-xs"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Title Header */}
        <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider font-mono">
            <ShieldCheck size={14} />
            <span>Official Policy · Effective November 14, 2026</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            RicozAnalytics Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            This Privacy Policy governs the collection, use, protection, and disclosure of data by{' '}
            <strong className="text-slate-900 dark:text-white font-semibold">Ricoz Digital Innovations Pvt Ltd</strong>{' '}
            (“Ricoz”, “we”, “us”, or “our”) across the RicozAnalytics web platform, Android mobile application (
            <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">com.ricoz.analytics</code>), 
            and associated enterprise cloud API services.
          </p>
        </div>

        {/* Policy Quick Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <Lock size={16} />
              <span>Zero Data Selling</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We never sell, rent, monetize, or trade your personal information or uploaded business datasets to third-party advertisers or brokers.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <Database size={16} />
              <span>Multi-Tenant Isolation</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All datasets and reports are strictly segregated by organization ID. Users can only access analytics belonging to their authorized tenant.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <Trash2 size={16} />
              <span>Right to Deletion</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              You can request deletion of your account and personal data at any time via in-app Settings or our public request portal at{' '}
              <Link to="/delete-account" className="underline font-medium hover:text-blue-500">
                ricoz.in/delete-account
              </Link>.
            </p>
          </div>
        </div>

        {/* Detailed Policy Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">01.</span>
              Information We Collect
            </h2>
            <div className="space-y-3">
              <p>
                To provide enterprise analytics and workspace collaboration, we collect the following categories of information:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
                <li>
                  <strong className="text-slate-900 dark:text-white">Account & Profile Information:</strong> Full name, corporate email address, organization/company name, and role assignment (Owner, Admin, Manager, Viewer).
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Authentication Credentials:</strong> Passwords are cryptographically salted and hashed using one-way bcrypt hashing. Plaintext passwords are never recorded, logged, or visible to employees.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Customer Business Datasets:</strong> Tabular data files (CSV, Excel XLSX, JSON) voluntarily uploaded to your workspace for analytical indexing, metric computation, forecasting, and reporting.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Workspace Communications:</strong> In-app team messages, dataset comments, and AI Copilot analytical conversation prompts initiated within your organization.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Operational Telemetry:</strong> Audit logs (login timestamps, resource creation/updates, and export executions) required for tenant security and administrative auditing.
                </li>
              </ul>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                <strong>Information We DO NOT Collect:</strong> RicozAnalytics does not collect device GPS location, phone contacts, photos/media libraries, biometric records, microphone recordings, or third-party advertising identifiers.
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">02.</span>
              How We Use Your Information
            </h2>
            <p>
              We process personal information and customer datasets strictly for legitimate business and contractual purposes:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
              <li>To create, verify, authenticate, and administer your organization's multi-tenant workspace.</li>
              <li>To parse and aggregate uploaded datasets to display interactive dashboards, KPI metrics, charts, and forecasts.</li>
              <li>To generate scheduled PDF executive briefings and spreadsheet exports (XLSX, CSV) requested by your users.</li>
              <li>To transmit transactional service messages, including email verification OTPs, password reset links, and critical anomaly sentinel alerts.</li>
              <li>To enforce tenant isolation, detect system errors, monitor latency, and protect against security threats and unauthorized access.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">03.</span>
              Data Sharing & Third-Party Processors
            </h2>
            <p>
              Ricoz maintains strict boundaries on third-party data sharing. We only disclose data to specialized infrastructure service providers bound by contractual confidentiality and security commitments:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold">
                    <th className="py-2.5 px-3">Service Provider</th>
                    <th className="py-2.5 px-3">Function / Role</th>
                    <th className="py-2.5 px-3">Data Handled</th>
                    <th className="py-2.5 px-3">Security Standards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Cloud Hosting (Render / Supabase / AWS)</td>
                    <td className="py-2.5 px-3">Production server API hosting & managed PostgreSQL</td>
                    <td className="py-2.5 px-3">Encrypted database records, tenant datasets</td>
                    <td className="py-2.5 px-3">TLS 1.3 transit, AES-256 rest, SOC 2 Type II</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Email Delivery (Brevo / SMTP)</td>
                    <td className="py-2.5 px-3">Transactional verification OTPs & alerts</td>
                    <td className="py-2.5 px-3">Recipient email, message subject, verification token</td>
                    <td className="py-2.5 px-3">TLS encrypted SMTP, strict DMARC/SPF/DKIM</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Payment Gateways (Razorpay / Stripe)</td>
                    <td className="py-2.5 px-3">Enterprise SaaS subscription billing (Web only)</td>
                    <td className="py-2.5 px-3">Customer billing email, invoice amounts (no raw card data stored on Ricoz)</td>
                    <td className="py-2.5 px-3">PCI-DSS Level 1 Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">AI Inference (Self-Hosted / Google Gemini API)</td>
                    <td className="py-2.5 px-3">Data anomaly summarization & forecasting queries</td>
                    <td className="py-2.5 px-3">Anonymized analytical prompts & metric aggregates</td>
                    <td className="py-2.5 px-3">Customer data is never used to train public foundation models</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">04.</span>
              Mobile Permissions (Android)
            </h2>
            <p>
              The RicozAnalytics Android application (<code className="font-mono text-xs">com.ricoz.analytics</code>) requests only the minimum network permissions required for operation:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
              <li>
                <strong className="text-slate-900 dark:text-white">INTERNET (<code className="text-xs">android.permission.INTERNET</code>):</strong> Required to establish encrypted HTTPS communication with RicozAnalytics cloud API servers.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">ACCESS_NETWORK_STATE (<code className="text-xs">android.permission.ACCESS_NETWORK_STATE</code>):</strong> Required by the application to monitor connection status and notify the user when the device is offline.
              </li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              File exports (PDF, XLSX, CSV) use standard modern Android Scoped Storage APIs (MediaStore / Documents), requiring zero dangerous storage permissions on modern Android versions.
            </p>
          </section>

          {/* Section 5 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">05.</span>
              Data Retention & Account Deletion Policy
            </h2>
            <div className="space-y-3">
              <p>
                We retain your information only as long as your enterprise workspace remains active, or as necessary to fulfill the purposes outlined in this policy:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
                <li>
                  <strong className="text-slate-900 dark:text-white">Active Retention:</strong> User profiles, uploaded datasets, AI query history, and dashboards are retained during the duration of your active subscription or free trial.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Deactivation & Purge:</strong> When an account or workspace is deleted, user credentials, authentication tokens, team messages, and uploaded datasets are permanently purged or anonymized within 30 days.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">Legitimate Legal Exceptions:</strong> Under applicable tax, financial, and corporate regulatory statutes (including Indian corporate accounting standards), financial transaction logs, tax invoices, and statutory audit trails are retained for statutory legal compliance periods (up to 7 years) before permanent automated destruction.
                </li>
              </ul>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <Link
                  to="/delete-account"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-xs"
                >
                  <Trash2 size={14} />
                  <span>Request Account Deletion Online</span>
                </Link>
                <span className="text-xs text-slate-500">
                  Requests are verified via email OTP and processed by our compliance team.
                </span>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">06.</span>
              Security & Encryption Standards
            </h2>
            <p>
              We implement comprehensive technical and organizational safeguards to ensure data confidentiality and integrity:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
              <li>
                <strong className="text-slate-900 dark:text-white">Encryption in Transit:</strong> All HTTP network traffic between client browsers, Android applications, and API servers is strictly encrypted using modern Transport Layer Security (TLS 1.3 / HTTPS). Cleartext HTTP is disallowed.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Encryption at Rest:</strong> Database storage volumes and file storage caches utilize industry-standard AES-256 block-level encryption.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Credential Protection:</strong> Passwords are protected via salted bcrypt hashing with high computational cost factors.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Role-Based Access Control (RBAC):</strong> Granular workspace permissions ensure team members access only the dashboards and datasets designated by their workspace administrators.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">07.</span>
              Your Privacy Rights & Controls
            </h2>
            <p>
              Regardless of your geographic location, Ricoz provides enterprise users with transparent controls:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
              <li><strong className="text-slate-900 dark:text-white">Access & Export:</strong> You can export your analytical reports, datasets, and summaries at any time in standard PDF, XLSX, CSV, or JSON formats.</li>
              <li><strong className="text-slate-900 dark:text-white">Correction:</strong> You can update your profile name and organization preferences directly in Settings.</li>
              <li><strong className="text-slate-900 dark:text-white">Revocation & Deletion:</strong> You may request revocation of access tokens and complete account deletion through in-app Settings or our web form.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">08.</span>
              Contact Us & Grievance Redressal
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data protection rights, please contact our Data Protection and Grievance Officer:
            </p>
            <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Ricoz Digital Innovations Pvt Ltd
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Attn: Data Protection Officer / Grievance Redressal Officer
              </div>
              <div>
                Location: Hyderabad, Telangana, India
              </div>
              <div>
                Email:{' '}
                <a href="mailto:contact@ricoz.in" className="font-semibold text-rose-600 dark:text-rose-400 hover:underline">
                  contact@ricoz.in
                </a>
              </div>
              <div>
                Telephone: +91 91771 97711
              </div>
              <div>
                Website:{' '}
                <a href="https://ricoz.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600 dark:text-rose-400 hover:underline">
                  https://ricoz.in
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Ricoz Digital Innovations Pvt Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/delete-account" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
              Account Deletion
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
