import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight, 
  CheckCircle2,
  ShieldCheck, 
  Globe
} from 'lucide-react';

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
    <footer className="bg-[#b91c1c] text-white pt-16 pb-12 border-t border-red-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-red-800/80">
          {/* Column 1: Brand & Contact Info */}
          <div className="lg:col-span-2 space-y-5">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center font-black text-xl shadow-md">
                <span className="tracking-tighter">rZ</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white tracking-tight">Ricoz</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white bg-red-800/80 px-2 py-0.5 rounded border border-red-700">
                  Analytics
                </span>
              </div>
            </Link>

            <p className="text-sm text-red-100/90 leading-relaxed max-w-sm">
              Next-generation enterprise data intelligence platform for fast-growing businesses, multi-branch franchises, and leadership teams across India.
            </p>

            <div className="space-y-2.5 text-xs text-red-100">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-red-200 flex-shrink-0" />
                <span>Ricoz Digital Innovations Pvt Ltd, Hyderabad, India</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-red-200 flex-shrink-0" />
                <a href="mailto:contact@ricoz.in" className="hover:underline">
                  contact@ricoz.in
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-red-200 flex-shrink-0" />
                <span>+91 91771 97711</span>
              </div>
            </div>
          </div>

          {/* Column 2: Platform Capabilities */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Platform</h4>
            <ul className="space-y-2 text-xs text-red-100">
              <li>
                <a href="#features" className="hover:text-white transition">Data Ingestion &amp; ETL</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">KPI &amp; Metrics Studio</a>
              </li>
              <li>
                <a href="#dashboards" className="hover:text-white transition">Interactive Dashboards</a>
              </li>
              <li>
                <a href="#ai-automation" className="hover:text-white transition">Scheduled PDF Reports</a>
              </li>
              <li>
                <a href="#ai-automation" className="hover:text-white transition">Proactive Alerts Engine</a>
              </li>
              <li>
                <a href="#ai-automation" className="hover:text-white transition">AI Anomaly Copilot</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Solutions & Portal Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Access Portal</h4>
            <ul className="space-y-2 text-xs text-red-100">
              <li>
                <Link to="/login" className="hover:text-white transition">Enterprise Login</Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition">Create New Workspace</Link>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition">RBAC &amp; Security</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition">Frequently Asked Questions</a>
              </li>
              <li>
                <a href="https://ricoz.in/franchise" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Ricoz Franchise Network ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter / Enterprise Updates */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Stay Updated</h4>
            <p className="text-xs text-red-100">
              Subscribe to enterprise product releases, analytics benchmarks, and case studies.
            </p>

            {subscribed ? (
              <div className="p-3 bg-red-800/80 rounded-xl text-xs text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span>Thank you for subscribing!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-red-900 hover:bg-red-950 text-white font-bold text-xs rounded-xl transition border border-red-700 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>Subscribe to Updates</span>
                  <ArrowRight size={13} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Copyright & Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-red-200">
          <div>
            © {new Date().getFullYear()} Ricoz Analytics. A Division of Ricoz Digital Innovations. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#security" className="hover:underline">Privacy Policy</a>
            <a href="#security" className="hover:underline">Terms of Service</a>
            <a href="#security" className="hover:underline">Security Standards</a>
            <span className="text-red-300">ISO/SOC2 Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
