import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X, 
  Lock, 
  Mail, 
  User, 
  Building2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  TrendingUp, 
  Database, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { evaluatePasswordStrength } from '../utils/passwordSecurity';
import ThemeToggle from '../components/ui/ThemeToggle';
import Logo from '../components/ui/Logo';

/**
 * OneScore-Inspired Executive Onboarding Experience — RicozAnalytics
 * 
 * Features:
 * 1. Premium Value Proposition Carousel (3 Pillars: Telemetry Score, Data Vault, AI Copilot)
 * 2. Progressive 3-Step Guided Workspace Setup (Profile -> Workspace -> Security)
 * 3. Dedicated 6-Digit Email OTP Verification View
 * 4. High-Tech Workspace Provisioning Celebration Transition
 * 5. Streamlined Native Sign In (Login) View with instant switching
 * 6. Responsive, thumb-friendly touch targets with native Android interaction feel
 */

// Value Proposition Carousel Slides Data
const ONBOARDING_SLIDES = [
  {
    id: 'telemetry',
    tag: 'SAMPLE TELEMETRY',
    demoBadge: 'DEMO BENCHMARK',
    title: 'Autonomous Business Telemetry',
    subtitle: 'Real-time revenue monitoring, automated KPI velocity, and comprehensive financial health scoring.',
    icon: TrendingUp,
    accentColor: '#E11D48', // Crimson accent
    renderVisual: (isDark) => (
      <div className="relative w-full h-44 sm:h-52 flex items-center justify-center select-none">
        {/* High-tech circular score arc graphic */}
        <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="7"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset="62.8" // 270 degree arc
              strokeLinecap="round"
            />
            {/* Progress Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="url(#crimsonEmeraldGrad)"
              strokeWidth="7"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset="95"
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="crimsonEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#BE123C" />
                <stop offset="60%" stopColor="#E11D48" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
          </svg>

          {/* Centered Score Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              SAMPLE HEALTH INDEX
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                842
              </span>
              <span className="text-xs font-semibold text-slate-400">/1000</span>
            </div>
            <span className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-2.5 h-2.5" /> OPTIMAL
            </span>
          </div>
        </div>

        {/* Ambient floating metric chips */}
        <div className="absolute -top-1 left-2 sm:left-4 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xs flex items-center gap-2 text-left">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Sample MOM Growth</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">+24.8%</div>
          </div>
        </div>

        <div className="absolute -bottom-1 right-2 sm:right-4 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xs flex items-center gap-2 text-left">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Sample Runway</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">18.4 Mo</div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'vault',
    tag: 'SAMPLE ARCHITECTURE',
    demoBadge: 'SAMPLE TOPOLOGY',
    title: 'Zero-Latency Data Vault',
    subtitle: 'Connect enterprise datasets in seconds with automated schema discovery and tenant-isolated 256-bit encryption.',
    icon: Database,
    accentColor: '#3B82F6', // Blue accent
    renderVisual: (isDark) => (
      <div className="relative w-full h-44 sm:h-52 flex items-center justify-center select-none px-4">
        {/* Central Encrypted Vault Node */}
        <div className="relative z-10 w-24 h-24 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-rose-500/30 dark:border-rose-500/40 shadow-lg shadow-rose-950/30 flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-1 text-rose-500">
            <Lock className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-white tracking-wide">AES-256</span>
          <span className="text-[8px] text-slate-400 uppercase font-mono">ISOLATED</span>
        </div>

        {/* Orbiting Source Nodes */}
        <div className="absolute top-4 left-3 sm:left-8 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> PostgreSQL
        </div>

        <div className="absolute top-4 right-3 sm:right-8 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> Snowflake
        </div>

        <div className="absolute bottom-2 left-3 sm:left-8 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CSV / Excel
        </div>

        <div className="absolute bottom-2 right-3 sm:right-8 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> REST APIs
        </div>

        {/* Connecting Data Pulse Lines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-48 h-48 rounded-full border border-dashed border-slate-400 dark:border-slate-700 animate-spin" style={{ animationDuration: '30s' }} />
        </div>
      </div>
    )
  },
  {
    id: 'ai-copilot',
    tag: 'SIMULATED INSIGHTS',
    demoBadge: 'SIMULATED INSIGHT',
    title: 'Predictive AI Intelligence',
    subtitle: 'Ask plain-English questions, uncover hidden anomalies, and forecast quarterly growth with confidence.',
    icon: Sparkles,
    accentColor: '#8B5CF6', // Purple/Violet accent
    renderVisual: (isDark) => (
      <div className="relative w-full h-44 sm:h-52 flex flex-col items-center justify-center select-none px-4 sm:px-8">
        <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-md space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Sample Neural Copilot</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Simulated 98.6%
            </span>
          </div>

          {/* Anomaly Preview Box */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              <AlertCircle className="w-3 h-3" /> Sample Growth Anomaly
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              Enterprise ARR increased <span className="font-bold text-emerald-600 dark:text-emerald-400">+14.2%</span> following Q3 upsell cycles.
            </p>
          </div>

          {/* Prompt sample */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg">
            <span className="truncate italic">"Forecast Q4 enterprise pipeline..."</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          </div>
        </div>
      </div>
    )
  }
];

export default function OnboardingPage() {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'welcome' | 'register' | 'login' | 'verify' | 'provisioning'
  const initialMode = new URLSearchParams(location.search).get('mode') || 
                      (location.state?.verifyEmail ? 'verify' : 'welcome');
  const [view, setView] = useState(initialMode);

  // Carousel Active Slide Index
  const [activeSlide, setActiveSlide] = useState(0);

  // Registration Stepper: 1 (Profile) | 2 (Workspace) | 3 (Security)
  const [registerStep, setRegisterStep] = useState(1);

  // Form Data
  const queryEmail = new URLSearchParams(location.search).get('email') || '';
  const [formData, setFormData] = useState({
    name: location.state?.name || '',
    email: (location.state?.email || location.state?.verifyEmail || queryEmail || '').trim(),
    organization_name: '',
    industry: 'Fintech',
    team_size: '11-50',
    password: '',
    confirmPassword: '',
    agreeTerms: true
  });

  // Login Form Data
  const [loginData, setLoginData] = useState({
    email: queryEmail || '',
    password: '',
    rememberMe: true
  });

  // UI / Password Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordStrength = evaluatePasswordStrength(formData.password);

  // OTP Verification Digits (6 individual slots)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);
  const [resendCountdown, setResendCountdown] = useState(60);

  // State Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(location.state?.sessionExpired ? 'Your session has expired. Please sign in again.' : '');
  const [unregisteredEmail, setUnregisteredEmail] = useState('');
  const [provisioningProgress, setProvisioningProgress] = useState(0);

  // Auto-advance Carousel every 6 seconds on Welcome view
  useEffect(() => {
    if (view !== 'welcome') return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % ONBOARDING_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [view]);

  // Support Android Hardware Back Button & Browser History popstate
  useEffect(() => {
    const handlePopState = (e) => {
      setError('');
      if (view === 'register') {
        if (registerStep > 1) {
          setRegisterStep((prev) => prev - 1);
        } else {
          setView('welcome');
        }
      } else if (view === 'login' || view === 'verify') {
        setView('welcome');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, registerStep]);

  // Resend Countdown Timer effect on Verify step
  useEffect(() => {
    let timer = null;
    if (view === 'verify' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [view, resendCountdown]);

  // Form Field Change Handlers
  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
  };

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
    if (unregisteredEmail) setUnregisteredEmail('');
  };

  // OTP Input Management
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, ''); // Numbers only
    if (!cleanVal && value !== '') return;

    const newDigits = [...otpDigits];
    
    // Paste full 6-digit code support
    if (cleanVal.length > 1) {
      const pasted = cleanVal.slice(0, 6).split('');
      pasted.forEach((char, i) => {
        if (i < 6) newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[index] = cleanVal ? cleanVal[0] : '';
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 1 Validation (Name & Email)
  const isEmailValid = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !isEmailValid(formData.email.trim())) {
      setError('Please enter a valid business work email.');
      return;
    }
    setError('');
    window.history.pushState({ view: 'register', step: 2 }, '');
    setRegisterStep(2);
  };

  // Step 2 Validation (Organization)
  const handleStep2Submit = (e) => {
    e.preventDefault();
    if (!formData.organization_name.trim()) {
      setError('Please enter your company or workspace name.');
      return;
    }
    setError('');
    window.history.pushState({ view: 'register', step: 3 }, '');
    setRegisterStep(3);
  };

  // Step 3 Submission (Master Password & Register API)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!passwordStrength.isValid) {
      setError(passwordStrength.feedback || 'Please choose a stronger password.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!formData.agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        organization_name: formData.organization_name.trim(),
        password: formData.password
      });

      setOtpDigits(['', '', '', '', '', '']);
      setView('verify');
      setResendCountdown(60);
    } catch (err) {
      const errMsg = err.message || 'Registration failed.';
      if (err.data?.code === 'EMAIL_ALREADY_VERIFIED' || err.data?.isVerified) {
        setError('This email is already verified. Please sign in directly.');
        setView('login');
        setLoginData((prev) => ({ ...prev, email: formData.email.trim() }));
      } else if (err.data?.code === 'EMAIL_ALREADY_EXISTS') {
        setError('An account with this email already exists. Please verify your OTP or sign in.');
        setView('verify');
      } else {
        setError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Verification Submission
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await verifyOtp({
        email: formData.email.trim(),
        otp: fullOtp
      });

      // Trigger OneScore-Style Provisioning Celebration Animation
      setView('provisioning');
      animateProvisioning();
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code. Please check your email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP Action
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    setError('');
    try {
      await resendOtp({ email: formData.email.trim() });
      setResendCountdown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Streamlined Login Submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      setError('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    setUnregisteredEmail('');

    try {
      await login({
        email: loginData.email.trim(),
        password: loginData.password
      });

      // Launch Provisioning sequence then land on Dashboard
      setView('provisioning');
      animateProvisioning();
    } catch (err) {
      const errMsg = err.message || 'Invalid email or password.';
      const errCode = err.data?.error?.code || err.data?.code;

      if (errCode === 'ACCOUNT_NOT_FOUND' || errMsg.toLowerCase().includes('no account found')) {
        setUnregisteredEmail(loginData.email.trim());
        setError('');
      } else if (errCode === 'EMAIL_NOT_VERIFIED' || errMsg.toLowerCase().includes('verify your email')) {
        setFormData((prev) => ({ ...prev, email: loginData.email.trim() }));
        setView('verify');
        setError('Please enter your 6-digit verification code to complete activation.');
      } else {
        setError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // OneScore-Style Provisioning Animation Sequence (3 stages)
  const animateProvisioning = () => {
    setProvisioningProgress(1); // Stage 1: Verified
    setTimeout(() => {
      setProvisioningProgress(2); // Stage 2: Vault provisioned
    }, 600);
    setTimeout(() => {
      setProvisioningProgress(3); // Stage 3: Calibrated
    }, 1200);
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1700);
  };

  return (
    <div 
      className="relative min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors duration-200 overflow-x-hidden overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)'
      }}
    >
      {/* Top Navigation Bar */}
      <header className="w-full max-w-lg mx-auto px-4 sm:px-6 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          {view !== 'welcome' && view !== 'provisioning' && (
            <button
              type="button"
              onClick={() => {
                setError('');
                if (view === 'register') {
                  if (registerStep > 1) {
                    setRegisterStep((prev) => prev - 1);
                  } else {
                    setView('welcome');
                  }
                } else if (view === 'login' || view === 'verify') {
                  setView('welcome');
                }
              }}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 active:scale-95 transition-all"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 select-none">
            <Logo size="sm" variant="mark" />
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                Ricoz<span className="text-rose-600">Analytics</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>256-Bit SSL</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area with Fluid Transitions */}
      <main className="w-full max-w-md mx-auto px-4 sm:px-6 my-auto z-10">
        <AnimatePresence mode="wait">
          
          {/* ========================================================================= */}
          {/* VIEW 1: WELCOME & VALUE PROPOSITION CAROUSEL */}
          {/* ========================================================================= */}
          {view === 'welcome' && (
            <motion.div
              key="welcome-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-5"
            >
              {/* Category Tag */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Sparkles className="w-3 h-3" />
                {ONBOARDING_SLIDES[activeSlide].tag}
              </div>

              {/* Visual Showcase Card */}
              <div className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md p-4 shadow-sm shadow-slate-200/50 dark:shadow-none min-h-[200px] flex items-center justify-center">
                {ONBOARDING_SLIDES[activeSlide].renderVisual(true)}
              </div>

              {/* Text Headline & Value Description */}
              <div className="space-y-1.5 px-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {ONBOARDING_SLIDES[activeSlide].title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {ONBOARDING_SLIDES[activeSlide].subtitle}
                </p>
              </div>

              {/* Dot Indicators */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                {ONBOARDING_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      activeSlide === idx 
                        ? 'w-7 bg-rose-600' 
                        : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Primary Call to Action Buttons */}
              <div className="w-full space-y-2.5 pt-2">
                <button
                  type="button"
                  id="onboarding-get-started-btn"
                  onClick={() => {
                    setError('');
                    window.history.pushState({ view: 'register', step: 1 }, '');
                    setRegisterStep(1);
                    setView('register');
                  }}
                  className="w-full h-13 px-6 text-sm font-semibold rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] text-white shadow-lg shadow-rose-950/20 transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Create Enterprise Workspace</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  id="onboarding-sign-in-btn"
                  onClick={() => {
                    setError('');
                    window.history.pushState({ view: 'login' }, '');
                    setView('login');
                  }}
                  className="w-full h-11 px-6 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  Already have a workspace? <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">Sign In</span>
                </button>
              </div>

              {/* Trust Badge Footer */}
              <div className="pt-2 flex flex-col items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-500 font-medium select-none">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 256-bit AES
                  </span>
                  <span>•</span>
                  <span>SOC-2 Ready</span>
                  <span>•</span>
                  <span>Zero Spam</span>
                </div>
                <p className="text-[9px] text-slate-400 dark:text-slate-600 italic">
                  *All preview scores and metrics shown above are simulated illustrative benchmarks.
                </p>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: PROGRESSIVE GUIDED REGISTRATION STEPPER */}
          {/* ========================================================================= */}
          {view === 'register' && (
            <motion.div
              key="register-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* Stepper Header & Segmented Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-rose-600 dark:text-rose-400 uppercase tracking-wider font-bold">
                    Step {registerStep} of 3
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {registerStep === 1 && 'Profile Details'}
                    {registerStep === 2 && 'Workspace Setup'}
                    {registerStep === 3 && 'Security Key'}
                  </span>
                </div>

                {/* 3-Part Progress Indicator */}
                <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                  <div className={`h-full rounded-full transition-all duration-300 ${registerStep >= 1 ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  <div className={`h-full rounded-full transition-all duration-300 ${registerStep >= 2 ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  <div className={`h-full rounded-full transition-all duration-300 ${registerStep >= 3 ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                </div>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* ----------------- STEP 1: ACCOUNT PROFILE ----------------- */}
              {registerStep === 1 && (
                <form onSubmit={handleStep1Submit} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Let's set up your profile
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter your administrative contact info to initialize access.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Full Name Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          name="name"
                          id="register-name-input"
                          value={formData.name}
                          onChange={handleRegisterChange}
                          placeholder="e.g. Maya Lin"
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    {/* Work Email Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Work Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          name="email"
                          id="register-email-input"
                          value={formData.email}
                          onChange={handleRegisterChange}
                          placeholder="name@company.com"
                          className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          required
                        />
                        {isEmailValid(formData.email) && (
                          <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        We send your single-use 6-digit access code to this address.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="step1-continue-btn"
                    className="w-full h-12 mt-2 px-6 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-md shadow-rose-950/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Continue to Organization</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* ----------------- STEP 2: WORKSPACE SETUP ----------------- */}
              {registerStep === 2 && (
                <form onSubmit={handleStep2Submit} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Configure your workspace
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Creates your isolated multi-tenant data partition.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Organization / Company Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Company / Workspace Name
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          name="organization_name"
                          id="register-org-input"
                          value={formData.organization_name}
                          onChange={handleRegisterChange}
                          placeholder="e.g. Acme Corporation"
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    {/* Industry Selector Pills */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Industry
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['Fintech', 'SaaS / Tech', 'E-Commerce', 'Healthcare', 'Services', 'Other'].map((ind) => (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, industry: ind }))}
                            className={`h-9 px-2 rounded-lg text-[11px] font-semibold border transition-all truncate ${
                              formData.industry === ind
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Team Size Pills */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Team Size
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['1–10', '11–50', '51–250', '250+'].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, team_size: sz }))}
                            className={`h-9 px-2 rounded-lg text-[11px] font-semibold border transition-all ${
                              formData.team_size === sz
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="step2-continue-btn"
                    className="w-full h-12 mt-2 px-6 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-md shadow-rose-950/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Continue to Security</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* ----------------- STEP 3: MASTER SECURITY KEY ----------------- */}
              {registerStep === 3 && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Set your security key
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Create a strong master password for administrator access.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Master Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Master Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          id="register-password-input"
                          value={formData.password}
                          onChange={handleRegisterChange}
                          placeholder="At least 8 characters"
                          className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          autoFocus
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Live Password Strength Meter */}
                      {formData.password && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 h-1 w-full">
                            {[1, 2, 3, 4].map((bar) => (
                              <div
                                key={bar}
                                className={`h-full flex-1 rounded-full transition-all duration-300 ${
                                  passwordStrength.score >= bar
                                    ? passwordStrength.score >= 3 
                                      ? 'bg-emerald-500' 
                                      : passwordStrength.score === 2 
                                        ? 'bg-amber-500' 
                                        : 'bg-rose-500'
                                    : 'bg-slate-200 dark:bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                            <span className={`flex items-center gap-1 ${passwordStrength.requirements.minLength ? 'text-emerald-500 font-semibold' : ''}`}>
                              {passwordStrength.requirements.minLength ? '✓' : '•'} 8+ characters
                            </span>
                            <span className={`flex items-center gap-1 ${passwordStrength.requirements.hasUpper && passwordStrength.requirements.hasLower ? 'text-emerald-500 font-semibold' : ''}`}>
                              {passwordStrength.requirements.hasUpper && passwordStrength.requirements.hasLower ? '✓' : '•'} Upper & lower
                            </span>
                            <span className={`flex items-center gap-1 ${passwordStrength.requirements.hasNumber ? 'text-emerald-500 font-semibold' : ''}`}>
                              {passwordStrength.requirements.hasNumber ? '✓' : '•'} Number
                            </span>
                            <span className={`flex items-center gap-1 ${passwordStrength.requirements.hasSymbol ? 'text-emerald-500 font-semibold' : ''}`}>
                              {passwordStrength.requirements.hasSymbol ? '✓' : '•'} Symbol
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          id="register-confirm-password-input"
                          value={formData.confirmPassword}
                          onChange={handleRegisterChange}
                          placeholder="Re-enter password"
                          className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.confirmPassword && (
                        <p className={`mt-1 text-[11px] font-semibold ${
                          formData.password === formData.confirmPassword 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-rose-500'
                        }`}>
                          {formData.password === formData.confirmPassword 
                            ? '✓ Passwords match' 
                            : '✗ Passwords do not match'}
                        </p>
                      )}
                    </div>

                    {/* Terms Agreement Checkbox */}
                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="agreeTerms"
                        name="agreeTerms"
                        checked={formData.agreeTerms}
                        onChange={handleRegisterChange}
                        className="mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <label htmlFor="agreeTerms" className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                        I agree to the{' '}
                        <Link to="/privacy" target="_blank" className="text-rose-600 dark:text-rose-400 underline">
                          Privacy Policy
                        </Link>{' '}
                        and understand data is isolated in compliance with SOC-2 standards.
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="submit-register-btn"
                    disabled={isLoading || !passwordStrength.isValid || formData.password !== formData.confirmPassword}
                    className="w-full h-12 mt-2 px-6 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-md shadow-rose-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Enterprise Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: 6-DIGIT EMAIL VERIFICATION (OTP) */}
          {/* ========================================================================= */}
          {view === 'verify' && (
            <motion.div
              key="verify-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Verify your credentials
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  We sent a 6-digit verification code to{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formData.email}
                  </span>
                </p>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2.5 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* 6 Digit Numeric Inputs */}
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
                <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      id={`otp-digit-${index}`}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center font-mono font-bold text-lg sm:text-xl rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all shadow-xs"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  id="verify-otp-submit-btn"
                  disabled={isLoading || otpDigits.join('').length !== 6}
                  className="w-full h-12 px-6 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-md shadow-rose-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Security Key...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Provision Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Resend Code Action */}
                <div className="text-xs text-slate-500">
                  {resendCountdown > 0 ? (
                    <span>
                      Resend code in <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">0:{resendCountdown.toString().padStart(2, '0')}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      id="resend-otp-btn"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend Code
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 4: STREAMLINED NATIVE SIGN IN (LOGIN) */}
          {/* ========================================================================= */}
          {view === 'login' && (
            <motion.div
              key="login-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="space-y-4"
            >
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Sign in to Workspace
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter your credentials to access your administrative analytics.
                </p>
              </div>

              {/* Unregistered Email Prompt */}
              {unregisteredEmail && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 p-3.5 text-xs text-blue-900 dark:text-blue-200 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-bold">No Workspace Found</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300">
                    No active account exists for <strong>{unregisteredEmail}</strong>. Create a workspace in 60 seconds.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, email: unregisteredEmail }));
                      setRegisterStep(1);
                      setView('register');
                    }}
                    className="w-full h-10 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Create Workspace with this Email</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Error Alert Box */}
              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Work Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      name="email"
                      id="login-email-input"
                      value={loginData.email}
                      onChange={handleLoginChange}
                      placeholder="name@company.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Master Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Master Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      id="login-password-input"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      placeholder="••••••••••••"
                      className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Device Toggle */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    name="rememberMe"
                    checked={loginData.rememberMe}
                    onChange={handleLoginChange}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <label htmlFor="rememberMe" className="text-xs text-slate-600 dark:text-slate-400 select-none">
                    Remember this device for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={isLoading}
                  className="w-full h-12 mt-1 px-6 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-md shadow-rose-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Switch to Register */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setRegisterStep(1);
                    setView('register');
                  }}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Need a workspace?{' '}
                  <span className="font-bold text-rose-600 dark:text-rose-400 underline">
                    Create One Free
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 5: ONESCORE-STYLE CELEBRATION PROVISIONING ANIMATION */}
          {/* ========================================================================= */}
          {view === 'provisioning' && (
            <motion.div
              key="provisioning-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center text-center space-y-6 py-6"
            >
              {/* Pulsing Telemetry Emblem */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-rose-500/20 animate-ping opacity-30" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-700 border border-rose-400 shadow-xl shadow-rose-950/30 flex items-center justify-center text-white">
                  <ShieldCheck className="w-10 h-10" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Initializing Workspace
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  Calibrating your enterprise analytical vault...
                </p>
              </div>

              {/* Progress Checklist Steps */}
              <div className="w-full max-w-xs space-y-2.5 text-left text-xs">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${provisioningProgress >= 1 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className={provisioningProgress >= 1 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}>
                    Identity & Credentials Verified
                  </span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${provisioningProgress >= 2 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className={provisioningProgress >= 2 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}>
                    Provisioning 256-bit Multi-tenant Vault
                  </span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${provisioningProgress >= 3 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className={provisioningProgress >= 3 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}>
                    Calibrating Executive Analytics Engine
                  </span>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Persistent Bottom Safe Area Spacer */}
      <footer className="w-full max-w-md mx-auto px-4 py-2 text-center select-none">
        <p className="text-[10px] text-slate-400 dark:text-slate-600">
          RicozAnalytics v1.0.1 · Enterprise Decision Intelligence Console
        </p>
      </footer>
    </div>
  );
}
