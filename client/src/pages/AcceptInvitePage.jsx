import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ShieldCheck, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { getInvitationDetailsApi, acceptInvitationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Enterprise Team Member Invitation Acceptance Page — RicozAnalytics
 * Allows an invited member to join the inviter's organization directly.
 */
export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteDetails, setInviteDetails] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token. Please check the link from your email.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchInvitation() {
      try {
        setLoading(true);
        setError('');
        const res = await getInvitationDetailsApi(token);
        if (isMounted) {
          setInviteDetails(res.invitation);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Invitation is invalid or has expired.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchInvitation();
    return () => { isMounted = false; };
  }, [token]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await acceptInvitationApi({
        token,
        name: formData.name.trim(),
        password: formData.password
      });

      setSuccess(true);
      // Automatically authenticate with new credentials
      try {
        await login({
          email: inviteDetails.email,
          password: formData.password
        });
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      } catch (_) {
        setTimeout(() => {
          navigate('/login', {
            replace: true,
            state: { message: 'Invitation accepted successfully! Sign in to enter your workspace.' }
          });
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to accept invitation. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-6">
          <img 
            src="/ricoz-logo.png" 
            alt="RicoZ" 
            className="h-10 w-auto object-contain" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Analytics Workspace
            </span>
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              INVITATION
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          {loading ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Verifying team invitation...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Invitation Expired or Invalid</h3>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
              </div>
              <div className="pt-3">
                <Link to="/login" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-slate-900">Welcome to {inviteDetails?.organization_name}!</h3>
              <p className="text-xs text-slate-500">
                Your account is active with role <span className="font-bold text-slate-800 uppercase">{inviteDetails?.role}</span>. Redirecting to workspace...
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 mb-1">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Join {inviteDetails?.organization_name}
                </h2>
                <p className="text-xs text-slate-500">
                  You've been invited to join as an enterprise{' '}
                  <span className="font-semibold text-blue-700 uppercase font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
                    {inviteDetails?.role}
                  </span>
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono mt-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{inviteDetails?.email}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="name">
                    Your Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="password">
                    Set Workspace Password (min. 6 chars)
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 mt-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Activating Membership...</span>
                    </>
                  ) : (
                    <>
                      <span>Accept Invitation & Join Team</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
