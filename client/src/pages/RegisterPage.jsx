import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowLeft, Loader2, Mail, CheckCircle2, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function RegisterPage() {
  const { register, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'register' | 'verify'
  const [step, setStep] = useState(location.state?.verifyEmail ? 'verify' : 'register');

  const [formData, setFormData] = useState({
    name: location.state?.name || '',
    email: location.state?.verifyEmail || '',
    organization_name: '',
    password: '',
    confirmPassword: ''
  });

  // 6 separate digits for OTP
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 60-second cooldown timer for resending OTP
  const [resendCountdown, setResendCountdown] = useState(60);

  // Timer interval effect
  useEffect(() => {
    let timer = null;
    if (step === 'verify' && resendCountdown > 0 && !isSuccess) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCountdown, isSuccess]);

  // Focus the first empty OTP input when entering the verify step
  useEffect(() => {
    if (step === 'verify' && !isSuccess) {
      const firstEmptyIndex = otpDigits.findIndex((digit) => !digit);
      const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
      if (inputRefs.current[targetIndex]) {
        setTimeout(() => {
          inputRefs.current[targetIndex]?.focus();
        }, 100);
      }
    }
  }, [step, isSuccess]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (error) setError('');
  };

  // Handle Form Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please enter a valid work email.');
      return;
    }

    if (!formData.organization_name.trim()) {
      setError('Please enter your company or organization name.');
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

    setIsLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const result = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        organization_name: formData.organization_name.trim(),
        password: formData.password
      });

      // Clear any previous OTP inputs and reset countdown
      setOtpDigits(['', '', '', '', '', '']);
      setResendCountdown(60);
      setStep('verify');
      setInfoMessage('A 6-digit verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Input Handlers
  const handleDigitChange = (index, value) => {
    // Only accept numeric input
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue && value !== '') return;

    const newDigits = [...otpDigits];

    if (cleanValue.length > 1) {
      // User pasted or typed multiple digits
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
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);

    const targetIndex = Math.min(pastedData.length, 5);
    inputRefs.current[targetIndex]?.focus();
    if (error) setError('');
  };

  // Verify OTP submission
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();

    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsVerifying(true);
    setError('');
    setInfoMessage('');

    try {
      await verifyOtp({
        email: formData.email.trim(),
        otp: otpCode
      });

      setIsSuccess(true);

      // Redirect to login with success state after brief feedback delay
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            message: 'Email verified successfully! You can now sign in with your credentials.'
          }
        });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isResending) return;

    setIsResending(true);
    setError('');
    setInfoMessage('');

    try {
      await resendOtp({ email: formData.email.trim() });
      setResendCountdown(60);
      setInfoMessage('A new 6-digit verification code has been sent to your email.');
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const isOtpComplete = otpDigits.every((d) => d.length === 1);

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      {/* Top Right Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-6">
          <img 
            src="/ricoz-logo.png" 
            alt="RicoZ" 
            className="h-10 w-auto object-contain" 
          />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
              Analytics Workspace
            </span>
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              ENTERPRISE
            </span>
          </div>
        </div>

        {/* STEP 1: Registration Form */}
        {step === 'register' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Create Enterprise Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Start your 14-day free trial. Full enterprise admin access with isolated workspace.
              </p>
            </div>

            {/* Trial Banner */}
            <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-3.5 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">14-Day Free Enterprise Trial</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 text-[11px]">
                    No credit card required. A completely isolated, secure tenant workspace is provisioned instantly.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Aarav Sharma"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="organization_name">
                    Company / Organization Name
                  </label>
                  <input
                    id="organization_name"
                    name="organization_name"
                    type="text"
                    required
                    placeholder="Acme Analytics Corp"
                    value={formData.organization_name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="email">
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
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="password">
                    Password (min. 6 chars)
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  id="register-submit-btn"
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Register</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                Already have credentials?{' '}
                <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition">
                  Sign in
                </Link>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: OTP Email Verification Screen */}
        {step === 'verify' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 mb-3 shadow-xs">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Verify your email
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                We've sent a 6-digit code to your email address:
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{formData.email}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-5">
              {/* Success Notification */}
              {isSuccess && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-850 bg-emerald-50 dark:bg-emerald-950/50 p-4 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-200">Email verified successfully!</p>
                    <p className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5">Redirecting you to sign in...</p>
                  </div>
                </div>
              )}

              {/* Informational Notification */}
              {infoMessage && !error && !isSuccess && (
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/40 p-3 text-xs text-blue-800 dark:text-blue-300">
                  <Mail className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* Error Notification */}
              {error && !isSuccess && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {!isSuccess && (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5 text-center">
                      Enter 6-Digit Verification Code
                    </label>

                    {/* 6 Separate OTP Input Boxes */}
                    <div 
                      className="grid grid-cols-6 gap-2 sm:gap-2.5 justify-center max-w-sm mx-auto"
                      onPaste={handlePaste}
                    >
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (inputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          autoComplete={idx === 0 ? "one-time-code" : "off"}
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          id={`otp-input-${idx}`}
                          className="h-12 w-full text-center font-mono text-lg font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                          disabled={isVerifying || isSuccess}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Verify OTP Button */}
                  <button
                    type="submit"
                    disabled={!isOtpComplete || isVerifying || isSuccess}
                    id="verify-otp-btn"
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify OTP</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Resend OTP & Change Email Controls */}
              {!isSuccess && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Didn't receive the code?</span>
                    {resendCountdown > 0 ? (
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">
                        Resend in {resendCountdown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isResending}
                        id="resend-otp-btn"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50 cursor-pointer"
                      >
                        {isResending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span>Resend OTP</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setInfoMessage('');
                        setStep('register');
                      }}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Edit registration details</span>
                    </button>

                    <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition">
                      Sign in
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Security Tag */}
        <p className="mt-6 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">
          TLS 1.3 End-to-End Encrypted Session · Standalone Production Auth
        </p>
      </div>
    </div>
  );
}
