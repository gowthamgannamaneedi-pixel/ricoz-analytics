import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, AlertCircle, Clock, CheckCircle, TrendingUp, Database, Zap, CheckCircle2, Activity, Server, ShieldCheck, ClipboardList, Users, PieChart, Search } from 'lucide-react';

/**
 * Public landing page that introduces RicozAnalytics and guides new customers through the onboarding flow.
 * The page is styled with Tailwind CSS to match the existing design system.
 */
export default function LandingPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      {/* HERO SECTION */}
      <section className="relative py-24 px-6 md:px-12 lg:px-24 bg-gradient-to-b from-slate-900/80 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Turn Your Business Data Into Actionable Insights
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            RicozAnalytics connects your data, monitors KPIs, builds dashboards, generates reports and helps you understand business performance—all in one enterprise‑grade platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition"
            >
              Get Started <ArrowRight size={16} />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition">
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* WHAT IS RICOZANALYTICS */}
      <section id="what-is" className="py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">What is RicozAnalytics?</h2>
          <p className="text-slate-300 leading-relaxed">
            RicozAnalytics is an enterprise analytics platform that helps businesses:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-left">
            <li className="flex items-start gap-2"><Database size={20} className="flex-shrink-0 text-brand-500"/> Connect business data</li>
            <li className="flex items-start gap-2"><ClipboardList size={20} className="flex-shrink-0 text-brand-500"/> Organize datasets</li>
            <li className="flex items-start gap-2"><Zap size={20} className="flex-shrink-0 text-brand-500"/> Create KPIs</li>
            <li className="flex items-start gap-2"><BarChart3 size={20} className="flex-shrink-0 text-brand-500"/> Build dashboards</li>
            <li className="flex items-start gap-2"><TrendingUp size={20} className="flex-shrink-0 text-brand-500"/> Analyse trends</li>
            <li className="flex items-start gap-2"><ClipboardList size={20} className="flex-shrink-0 text-brand-500"/> Generate reports</li>
            <li className="flex items-start gap-2"><AlertCircle size={20} className="flex-shrink-0 text-brand-500"/> Receive alerts</li>
            <li className="flex items-start gap-2"><Search size={20} className="flex-shrink-0 text-brand-500"/> Understand performance</li>
          </ul>
        </div>
      </section>

      {/* WHY USE RICOZANALYTICS */}
      <section id="features" className="py-16 bg-slate-900/50 px-6 md:px-12 lg:px-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-8">Why Use RicozAnalytics?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <Activity size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Centralized Analytics</h3>
              <p className="text-slate-400">Bring important business information into one place.</p>
            </div>
            {/* Card 2 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <Clock size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Real‑Time Monitoring</h3>
              <p className="text-slate-400">Monitor important business metrics as they happen.</p>
            </div>
            {/* Card 3 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <BarChart3 size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Interactive Dashboards</h3>
              <p className="text-slate-400">Visualize performance with drag‑and‑drop widgets.</p>
            </div>
            {/* Card 4 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <ClipboardList size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Automated Reports</h3>
              <p className="text-slate-400">Generate and distribute reports on schedule.</p>
            </div>
            {/* Card 5 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <AlertCircle size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Smart Alerts</h3>
              <p className="text-slate-400">Know when important business conditions change.</p>
            </div>
            {/* Card 6 */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
              <TrendingUp size={24} className="text-brand-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Analytics</h3>
              <p className="text-slate-400">
                Forecasting, anomaly detection and AI‑powered insights (currently in development).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW RICOZANALYTICS WORKS */}
      <section id="how-it-works" className="py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-8">How RicozAnalytics Works</h2>
          <div className="flex flex-col items-center space-y-6">
            {[
              {step: 1, title: 'Connect Your Data', icon: Database},
              {step: 2, title: 'Organize Your Data', icon: ClipboardList},
              {step: 3, title: 'Define Your KPIs', icon: CheckCircle2},
              {step: 4, title: 'Build Your Dashboard', icon: BarChart3},
              {step: 5, title: 'Monitor & Act', icon: Activity},
            ].map(({step, title, icon: Icon}) => (
              <div key={step} className="flex items-center w-full max-w-xl">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center mr-4 text-brand-400">
                  <Icon size={24} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-semibold text-white">STEP {step} — {title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOMER ONBOARDING */}
      <section id="onboarding" className="py-16 bg-slate-900/50 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-8">Get Started With RicozAnalytics</h2>
          <ol className="list-decimal list-inside space-y-4 text-slate-300">
            <li>Create Your Account (sign‑up or login)</li>
            <li>Set Up Your Organization</li>
            <li>Add Your Data</li>
            <li>Choose Your Dataset</li>
            <li>Create Your KPIs</li>
            <li>Create Your Dashboard</li>
            <li>Set Up Reports &amp; Alerts</li>
            <li>Start Monitoring</li>
          </ol>
        </div>
      </section>

      {/* WHAT CAN YOU ANALYZE */}
      <section id="analysis-areas" className="py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-8">What Can You Analyze?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Revenue', 'Sales', 'Products', 'Regions', 'Sales Channels', 'Business KPIs', 'Trends', 'Operational Metrics'].map((label) => (
              <div key={label} className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition text-center">
                <Users size={24} className="mx-auto mb-2 text-brand-400" />
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT CAN YOU DO WITH YOUR DATA */}
      <section id="capabilities" className="py-16 bg-slate-900/50 px-6 md:px-12 lg:px-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-8">What Can You Do With Your Data?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {[
              {label: 'Analyze', icon: Search},
              {label: 'Visualize', icon: BarChart3},
              {label: 'Compare', icon: Server},
              {label: 'Monitor', icon: Activity},
              {label: 'Report', icon: ClipboardList},
              {label: 'Automate', icon: Zap},
              {label: 'Alert', icon: AlertCircle},
              {label: 'Predict', icon: TrendingUp, note: '(in development)'},
            ].map(({label, icon: Icon, note}) => (
              <div key={label} className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 transition">
                <Icon size={28} className="mx-auto mb-2 text-brand-400" />
                <span className="block text-sm font-medium text-white">{label}</span>
                {note && <small className="block text-xs text-slate-500">{note}</small>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ONBOARDING CHECKLIST */}
      <section id="checklist" className="py-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Onboarding Checklist</h2>
          <ul className="space-y-2 text-left text-slate-300 max-w-md mx-auto">
            {['Account created','Organization configured','Data source added','Dataset selected','First KPI created','First dashboard created','First report configured','Alerts configured','Analytics ready'].map(item => (
              <li key={item} className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FIRST DASHBOARD EXPERIENCE */}
      <section id="first-dashboard" className="py-16 bg-slate-900/50 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Your First Dashboard Experience</h2>
          <p className="text-slate-300 mb-4">
            After the onboarding steps you’ll see a clean interface that flows from your data to actionable insights.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Database className="text-brand-400" />
              <span className="text-slate-300">Your Data</span>
            </div>
            <span className="text-slate-500">↘</span>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="text-brand-400" />
              <span className="text-slate-300">KPIs</span>
            </div>
            <span className="text-slate-500">↘</span>
            <div className="flex items-center space-x-2">
              <BarChart3 className="text-brand-400" />
              <span className="text-slate-300">Charts</span>
            </div>
            <span className="text-slate-500">↘</span>
            <div className="flex items-center space-x-2">
              <Activity className="text-brand-400" />
              <span className="text-slate-300">Dashboard</span>
            </div>
            <span className="text-slate-500">↘</span>
            <div className="flex items-center space-x-2">
              <TrendingUp className="text-brand-400" />
              <span className="text-slate-300">Business Insights</span>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition"
          >
            Create Your First Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section id="final-cta" className="py-20 bg-slate-950 text-center px-6 md:px-12 lg:px-24">
        <h2 className="text-4xl font-extrabold text-white mb-4">Ready to Start With RicozAnalytics?</h2>
        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
          Bring your business data together, understand your performance and start making data‑driven decisions.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition"
          >
            Get Started <ArrowRight size={18} />
          </Link>
          <a href="mailto:contact@ricozanalytics.com" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition">
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
