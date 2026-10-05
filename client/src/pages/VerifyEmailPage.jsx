import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Enterprise Email Verification Page — RicozAnalytics
 * Handles both 1-click token links (/auth/verify-email?token=xyz)
 * and manual 6-digit OTP input with resend cooldown timer.
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();

  const tokenParam = searchParams.get('token');
  const emailParam = searchParams.get('email') || location.state?.email || '';

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const [isTokenVerifying, setIsTokenVerifying] = useState(Boolean(tokenParam));
  const [isManualVerifying, setIsManualVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [countdown, setCountdown] = useState(60);

  // If token is present in URL, auto-verify immediately on mount
  useEffect(() => {
    if (!tokenParam) return;

    let isMounted = true;
    async function verifyWithToken() {
      try {
        setIsTokenVerifying(true);
        setError('');
        const res = await verifyEmail({ token: tokenParam });
        if (isMounted) {
          setIsSuccess(true);
          setSuccessMsg(res.message || 'Email verified successfully! Your enterprise workspace is active.');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Invalid or expired verification link. Please request a new code.');
        }
      } finally {
        if (isMounted) {
          setIsTokenVerifying(false);
        }
      }
    }

    verifyWithToken();
    return () => { isMounted = false; };
  }, [tokenParam]);

  // Cooldown countdown timer
  useEffect(() => {
    let interval = null;
    if (countdown > 0 && !isSuccess) {
      interval = setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown, isSuccess]);

  // Focus first input on mount if not auto-verifying
  useEffect(() => {
    if (!tokenParam && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [tokenParam]);

  // OTP Digits Handling
  const handleDigitChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue && value !== '') return;

    const newDigits = [...otpDigits];

    if (cleanValue.length > 1) {
      // Pasted full code
      const digitsArr = cleanValue.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = digitsArr[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIdx = Math.min(digitsArr.length, 5);
      inputRefs.current[nextIdx]?.focus();
    } else {
      newDigits[index] = cleanValue;
      setOtpDigits(newDigits);
      if (cleanValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    if (error) setError('');
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else if (otpDigits[index]) {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const targetIdx = Math.min(pasted.length, 5);
    inputRefs.current[targetIdx]?.focus();
    if (error) setError('');
  };

  // Submit manual OTP
  const handleSubmitOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide the email address you registered with.');
      return;
    }

    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsManualVerifying(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await verifyEmail({
        email: email.trim(),
        otp: code
      });

      setIsSuccess(true);
      setSuccessMsg(res.message || 'Email verified successfully! Welcome to your analytics workspace.');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1800);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code. Please check your email or resend.');
    } finally {
      setIsManualVerifying(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    if (!email.trim()) {
      setError('Please enter your work email to receive a new code.');
      return;
    }

    setIsResending(true);
    setError('');
    setInfoMessage('');

    try {
      await resendVerification({ email: email.trim() });
      setCountdown(60);
      setInfoMessage('A new 6-digit verification code has been dispatched to your email.');
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
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
              ENTERPRISE
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          {/* Header Title */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 mb-3 shadow-2xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Verify your email address
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              To secure your tenant workspace and start your 14-day free trial, please verify your email.
            </p>
          </div>

          {/* Automatic token verification spinner */}
          {isTokenVerifying && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Verifying your email token with server...
              </p>
            </div>
          )}

          {/* Success Notification */}
          {isSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-emerald-900">Email Verified Successfully</span>
              </div>
              <p className="text-emerald-700 text-[11px]">{successMsg}</p>
              <p className="text-emerald-600 text-[11px] font-medium animate-pulse">
                Redirecting to workspace dashboard...
              </p>
            </div>
          )}

          {/* Error Notification */}
          {error && !isSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Info Notification */}
          {infoMessage && !error && !isSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-800">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {!isTokenVerifying && !isSuccess && (
            <form onSubmit={handleSubmitOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="verify-email">
                  Registered Work Email
                </label>
                <input
                  id="verify-email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
                  6-Digit Verification Code
                </label>
                <div 
                  className="grid grid-cols-6 gap-2 justify-center max-w-xs mx-auto"
                  onPaste={handlePaste}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e.target.value, e)}
                      className="w-10 h-12 text-center text-lg font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isManualVerifying}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 mt-2"
              >
                {isManualVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email & Access Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Resend Action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0 || isResending}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : countdown > 0 ? (
                    <span>Resend in {countdown}s</span>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      <span>Resend Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Back to{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
