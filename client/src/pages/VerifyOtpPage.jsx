import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, RefreshCw, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtpPage() {
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const email = (location.state && location.state.email) || '';

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [resendCountdown, setResendCountdown] = useState(60);

  useEffect(() => {
    let timer = null;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCountdown]);

  useEffect(() => {
    const firstEmpty = otpDigits.findIndex(d => !d);
    const idx = firstEmpty !== -1 ? firstEmpty : 0;
    inputRefs.current[idx]?.focus();
  }, []);

  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean && value !== '') return;
    const newDigits = [...otpDigits];
    if (clean.length > 1) {
      const slice = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) newDigits[i] = slice[i] || '';
      setOtpDigits(newDigits);
      const nextIdx = Math.min(slice.length, 5);
      inputRefs.current[nextIdx]?.focus();
    } else {
      newDigits[index] = clean;
      setOtpDigits(newDigits);
      if (clean && index < 5) inputRefs.current[index + 1]?.focus();
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

  const handlePaste = e => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || '';
    setOtpDigits(newDigits);
    const targetIdx = Math.min(pasted.length, 5);
    inputRefs.current[targetIdx]?.focus();
    if (error) setError('');
  };

  const handleVerifyOtp = async e => {
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
      await verifyOtp({ email, otp: otpCode });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true, state: { message: 'Email verified successfully! Please sign in.' } });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    setInfoMessage('');
    try {
      await resendOtp({ email });
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

  const isOtpComplete = otpDigits.every(d => d.length === 1);

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center justify-center gap-2 mb-6">
          <img src="/ricoz-logo.png" alt="RicoZ" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">Analytics Workspace</span>
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">ENTERPRISE</span>
          </div>
        </div>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/80 mb-3 shadow-xs"><ShieldCheck className="w-6 h-6" /></div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Verify your email</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">We've sent a 6-digit code to your email address:</p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
            <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{email}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-5">
          {isSuccess && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-xs text-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-bold text-emerald-900 dark:text-emerald-100">Email verified successfully!</p>
                <p className="text-emerald-700 dark:text-emerald-300 text-[11px] mt-0.5">Redirecting you to sign in...</p>
              </div>
            </div>
          )}
          {infoMessage && !error && !isSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-100 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-300">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{infoMessage}</span>
            </div>
          )}
          {error && !isSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}
          {!isSuccess && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5 text-center">Enter 6-Digit Verification Code</label>
                <div className="grid grid-cols-6 gap-2 sm:gap-2.5 justify-center max-w-sm mx-auto" onPaste={handlePaste}>
                  {otpDigits.map((digit, idx) => (
                    <input key={idx} ref={el => (inputRefs.current[idx] = el)} type="text" inputMode="numeric" autoComplete={idx === 0 ? 'one-time-code' : 'off'} pattern="[0-9]*" maxLength={1} value={digit} onChange={e => handleDigitChange(idx, e.target.value)} onKeyDown={e => handleKeyDown(idx, e)} id={`otp-input-${idx}`} className="h-12 w-full text-center font-mono text-lg font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-rose-600 focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-rose-600/20" disabled={isVerifying || isSuccess} />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={!isOtpComplete || isVerifying || isSuccess} className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {isVerifying ? (<><Loader2 className="h-4 w-4 animate-spin" /> <span>Verifying Code...</span></>) : (<><ShieldCheck className="h-4 w-4" /> <span>Verify OTP</span></>)}
              </button>
            </form>
          )}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Didn't receive the code?</span>
              {resendCountdown > 0 ? (
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">Resend in {resendCountdown}s</span>
              ) : (
                <button type="button" onClick={handleResendOtp} disabled={isResending} className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition disabled:opacity-50 cursor-pointer">
                  {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>Resend OTP</span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <button type="button" onClick={() => navigate('/login')} className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">TLS 1.3 End-to-End Encrypted Session · Standalone Production Auth</p>
      </div>
    </div>
  );
}
