import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState(
    location.state?.sessionExpired 
      ? 'Your session has expired. Please sign in again.' 
      : (location.state?.message || '')
  );
  const [isLoading, setIsLoading] = useState(false);

  // Development-only authentication helper (strictly disabled in production)
  const isDevAuthEnabled = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === 'true'
  );

  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please enter both work email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login({
        email: formData.email,
        password: formData.password
      });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
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
          />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Analytics Workspace
            </span>
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              ENTERPRISE
            </span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Sign in to Workspace
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your enterprise credentials to access analytics telemetry
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
                Work Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              id="login-submit-btn"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Development-Only Test Credentials Helper (Guarded by VITE_ENABLE_DEV_AUTH) */}
          {isDevAuthEnabled && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-amber-700 mb-1.5 font-mono">
                [DEV ONLY] Pre-fill Test Credentials:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ email: 'admin@ricoz.test', password: 'admin123' })}
                  className="py-1 px-2 text-[10px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ email: 'manager@ricoz.test', password: 'manager123' })}
                  className="py-1 px-2 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ email: 'analyst@ricoz.test', password: 'analyst123' })}
                  className="py-1 px-2 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  Analyst
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ email: 'viewer@ricoz.test', password: 'viewer123' })}
                  className="py-1 px-2 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition"
                >
                  Viewer
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
            Need an enterprise account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition">
              Register here
            </Link>
          </div>
        </div>

        {/* Security Tag */}
        <p className="mt-6 text-center font-mono text-[11px] text-slate-400">
          TLS 1.3 End-to-End Encrypted Session · Standalone Production Auth
        </p>
      </div>
    </div>
  );
}
