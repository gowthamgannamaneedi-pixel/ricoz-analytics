import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Globe,
  ExternalLink,
  Activity,
  Lock,
  Heart
} from 'lucide-react';
import Logo from '../ui/Logo';

export default function LandingFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-800/80">
          {/* Column 1: Brand & Contact Info (2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            <div className="inline-flex items-center gap-3">
              <Logo size="lg" linkTo="/" theme="dark" />
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              Next-generation enterprise data intelligence platform for fast-growing businesses, multi-branch franchises, and leadership teams across India.
            </p>

            {/* Corporate Location & Direct Contact */}
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <MapPin size={15} className="text-red-500 flex-shrink-0" />
                <span>Ricoz Digital Innovations Pvt Ltd, Hyderabad, Telangana, India</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="text-red-500 flex-shrink-0" />
                <a href="mailto:contact@ricoz.in" className="hover:text-white transition">
                  contact@ricoz.in
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-red-500 flex-shrink-0" />
                <span>+91 91771 97711</span>
              </div>
            </div>

            {/* Newsletter Subscription */}
            <div className="pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                Subscribe to Product &amp; Engineering Updates
              </div>
              {subscribed ? (
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Thank you! You have been subscribed to executive digests.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex max-w-sm gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter corporate email..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/20 cursor-pointer"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Column 2: Platform Capabilities */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Platform</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#product" className="hover:text-white transition">Executive Cockpit</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">Zero-ETL Data Lake</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">KPI &amp; Formula Studio</a>
              </li>
              <li>
                <a href="#analytics" className="hover:text-white transition">Interactive Visualizations</a>
              </li>
              <li>
                <a href="#ai-insights" className="hover:text-white transition">AI Copilot &amp; Forecasts</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">Scheduled PDF Briefings</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">Anomaly Sentinel Alerts</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Data Connectors & Solutions */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Connectors</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#integrations" className="hover:text-white transition">PostgreSQL Ingestion</a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-white transition">Snowflake &amp; BigQuery</a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-white transition">MySQL Enterprise</a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-white transition">Google Sheets &amp; CSV</a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-white transition">REST APIs &amp; Webhooks</a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition">Enterprise RBAC &amp; Sovereign VPC</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition">Transparent Pricing</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Access & Enterprise Portal */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Access Portal</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link to="/login" className="hover:text-white transition flex items-center gap-1">
                  <span>Sign In to Workspace</span>
                  <ArrowRight size={11} />
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition flex items-center gap-1 text-red-400 font-bold">
                  <span>Start 14-Day Free Trial</span>
                  <ArrowRight size={11} />
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition">Frequently Asked Questions</a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition">Security Architecture</a>
              </li>
              <li>
                <a 
                  href="https://ricoz.in/franchise" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <span>Ricoz Franchise Network</span>
                  <ExternalLink size={11} />
                </a>
              </li>
              <li>
                <a 
                  href="https://ricoz.in" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <span>Ricoz Corporate Portal</span>
                  <ExternalLink size={11} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          {/* Copyright */}
          <div>
            © {new Date().getFullYear()} Ricoz Digital Innovations Pvt Ltd. All rights reserved.
          </div>

          {/* Operational Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Systems Operational • Sub-Second Pipeline</span>
          </div>

          {/* Compliance & Trust Badges */}
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Enterprise RBAC</span>
            </span>
            <span className="flex items-center gap-1">
              <Lock size={13} className="text-blue-500" />
              <span>AES-256</span>
            </span>
            <span>GDPR Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
