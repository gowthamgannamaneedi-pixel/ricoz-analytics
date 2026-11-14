import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft, 
  Mail, 
  Building2, 
  AlertTriangle,
  Lock,
  Clock,
  FileText,
  KeyRound,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Logo from '../components/ui/Logo';
import { API_BASE_URL } from '../services/api';

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL query params
  const paramEmail = searchParams.get('email') || '';
  const paramOtp = searchParams.get('otp') || '';
  const paramToken = searchParams.get('token') || '';

  // Form Step: 'request' | 'verify' | 'completed'
  const [step, setStep] = useState(paramOtp || paramToken ? 'verify' : 'request');

  // Form fields
  const [email, setEmail] = useState(paramEmail);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [scope, setScope] = useState('user_account');
  const [reason, setReason] = useState('no_longer_needed');
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [otp, setOtp] = useState(paramOtp);
  const [token, setToken] = useState(paramToken);

  // Status & Telemetry
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [referenceId, setReferenceId] = useState(null);
  const [completedAt, setCompletedAt] = useState(null);

  useEffect(() => {
    if (paramOtp || paramToken) {
      setStep('verify');
      if (paramEmail) setEmail(paramEmail);
      if (paramOtp) setOtp(paramOtp);
      if (paramToken) setToken(paramToken);
    }
  }, [paramEmail, paramOtp, paramToken]);

  // Handle Step 1: Submit initial deletion request
  const handleRequestDeletion = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email || !email.includes('@')) {
      setError('Please provide a valid corporate email address.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide your full name for verification.');
      return;
    }
    if (!confirmedRisk) {
      setError('Please confirm that you understand the permanent nature of data deletion.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/request-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          organization: organization.trim(),
          scope,
          reason
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit account deletion request.');
      }

      setReferenceId(data.referenceId);
      if (data.token) setToken(data.token);
      setInfoMessage(data.message || 'Verification code dispatched to your email.');
      setStep('verify');
    } catch (err) {
      setError(err.message || 'Network error submitting request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Confirm deletion with OTP / token
  const handleConfirmDeletion = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!otp && !token) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/confirm-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp ? otp.trim() : undefined,
          token: token || undefined,
          referenceId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      setReferenceId(data.referenceId || referenceId);
      setCompletedAt(data.completedAt || new Date().toISOString());
      setStep('completed');
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again or request a fresh code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
              to="/privacy"
              className="font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
            >
              Privacy Policy
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

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Title Header */}
        <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider font-mono">
            <ShieldAlert size={14} />
            <span>Google Play Policy & GDPR Compliance Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Account & Data Deletion Request
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            In compliance with Google Play Developer Program Policies, RicozAnalytics allows users to request permanent deletion of their account, uploaded datasets, and associated profile data directly from this public form or via in-app Settings.
          </p>
        </div>

        {/* Information Notice Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 text-xs leading-relaxed">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
            <Clock size={16} className="text-rose-600 dark:text-rose-400" />
            <span>Deletion Workflow & Statutory Retention Policy</span>
          </h3>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
            <li>
              <strong className="text-slate-900 dark:text-white">Handling Time:</strong> Once your request is verified via email OTP, individual account deletion is processed immediately. Workspace-level purges are finalized within 24 to 72 hours.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white">What is Purged:</strong> Name, email address, password hashes, active session tokens, personal preferences, notifications, comments, and uploaded raw analytical dataset files.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white">Legitimate Retention Exceptions:</strong> In accordance with corporate accounting and Indian tax compliance regulations, paid subscription invoices, transaction logs, and statutory audit trails are retained in anonymized format for up to 7 years before automated destruction.
            </li>
          </ul>
        </div>

        {/* Error / Alert Banners */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error:</span> {error}
            </div>
          </div>
        )}

        {infoMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>{infoMessage}</div>
          </div>
        )}

        {/* STEP 1: Request Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestDeletion} className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail size={16} className="text-rose-600 dark:text-rose-400" />
              <span>Step 1: Enter Account Verification Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. gowtham@company.com"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gowtham G"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Organization / Workspace Name (Optional)</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Acme Analytics Pvt Ltd"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Deletion Scope *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScope('user_account')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    scope === 'user_account'
                      ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="block text-xs">Individual Account Only</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Purges your login profile and personal preferences while organizational workspace datasets remain accessible to teammates.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('full_workspace')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    scope === 'full_workspace'
                      ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="block text-xs">Entire Workspace & Datasets</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    (Owner only) Permanently purges all connected datasets, reports, dashboards, and all member accounts in the organization.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Reason for Account Deletion (Optional)</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-xs"
              >
                <option value="no_longer_needed">No longer require data intelligence services</option>
                <option value="switching_platform">Migrating to alternative data warehouse/BI tool</option>
                <option value="completed_trial">Completed evaluation / trial period</option>
                <option value="privacy_preference">Company privacy & data minimization policy</option>
                <option value="other">Other business reason</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={confirmedRisk}
                  onChange={(e) => setConfirmedRisk(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  I understand that this action will permanently delete my credentials and datasets. Once confirmed via email OTP, this action cannot be undone.
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link to="/login" className="text-xs text-slate-500 hover:underline">
                Never mind, keep my account
              </Link>
              <button
                type="submit"
                disabled={loading || !confirmedRisk}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                <span>{loading ? 'Dispatching Verification...' : 'Send 6-Digit Deletion Code'}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Verify OTP */}
        {step === 'verify' && (
          <form onSubmit={handleConfirmDeletion} className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound size={16} className="text-rose-600 dark:text-rose-400" />
              <span>Step 2: Enter Verification Code</span>
            </h2>

            <p className="text-slate-600 dark:text-slate-400">
              We dispatched a 6-digit cryptographic verification code to <strong className="text-slate-900 dark:text-white font-semibold">{email}</strong>. 
              Please enter it below to confirm that you authorize permanent account deletion.
            </p>

            {referenceId && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-500">
                Ticket Reference: <strong className="text-slate-800 dark:text-slate-200">{referenceId}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">6-Digit Deletion Verification Code *</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full sm:w-48 h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-xl tracking-widest text-center"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                ← Edit email address
              </button>
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{loading ? 'Verifying Deletion...' : 'Confirm & Permanently Delete Account'}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Completed Confirmation */}
        {step === 'completed' && (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#111827] border border-emerald-200 dark:border-emerald-800/60 shadow-2xs space-y-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Account Deletion Successfully Executed
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Your credentials and personal workspace data have been permanently purged from RicozAnalytics. A confirmation email has been dispatched to your address.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-md mx-auto text-left text-xs space-y-1.5 font-mono">
              <div className="text-slate-500">Official Compliance Receipt:</div>
              <div>Reference Ticket: <strong className="text-slate-900 dark:text-white">{referenceId || 'DEL-CONFIRMED'}</strong></div>
              <div>Account: <strong className="text-slate-900 dark:text-white">{email}</strong></div>
              <div>Scope: <strong className="text-slate-900 dark:text-white">{scope === 'full_workspace' ? 'Full Workspace' : 'User Account'}</strong></div>
              <div>Execution Timestamp: <strong className="text-slate-900 dark:text-white">{new Date().toUTCString()}</strong></div>
              <div className="text-[11px] text-slate-400 pt-1">Status: COMPLETED · TOKENS REVOKED</div>
            </div>

            <div className="pt-2 flex justify-center">
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-xs"
              >
                Return to Ricoz Homepage
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Ricoz Digital Innovations Pvt Ltd. Hyderabad, India.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
              Privacy Policy
            </Link>
            <span>•</span>
            <a href="mailto:contact@ricoz.in" className="hover:text-rose-600 dark:hover:text-rose-400 transition">
              contact@ricoz.in
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
