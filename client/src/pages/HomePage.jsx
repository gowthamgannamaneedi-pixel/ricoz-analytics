import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Layers, 
  Server, 
  ShieldCheck, 
  Database, 
  BarChart3, 
  BrainCircuit, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Terminal,
  ArrowRight
} from 'lucide-react';
import { checkHealth } from '../services/api';

export default function HomePage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to reach API server');
      setHealthData(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const architecturePhases = [
    { phase: 'Phase 1', name: 'Foundation & Health API', status: 'Completed', icon: CheckCircle2, active: true },
    { phase: 'Phase 2', name: 'Application UI & Layouts', status: 'Next Up', icon: Layers, active: false },
    { phase: 'Phase 3', name: 'Auth & Role Permissions', status: 'Planned', icon: ShieldCheck, active: false },
    { phase: 'Phase 4', name: 'PostgreSQL Database & Schema', status: 'Planned', icon: Database, active: false },
    { phase: 'Phase 5-8', name: 'Data Pipelines, KPIs & Dashboards', status: 'Planned', icon: BarChart3, active: false },
    { phase: 'Phase 11-12', name: 'ML Forecasting & Gemini AI', status: 'Planned', icon: BrainCircuit, active: false },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              RicozAnalytics
            </h1>
            <p className="text-xs text-slate-400">Enterprise Intelligence Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Phase 1 Active
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider">
              <Server className="w-3.5 h-3.5" />
              Production Architecture Scaffold
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise Data Intelligence & Predictive Operations
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              RicozAnalytics is engineered with a decoupled React/Vite frontend, an Express REST backend, a scalable PostgreSQL data tier, and a Python FastAPI service for machine learning forecasts and Gemini AI integration.
            </p>
          </div>
        </section>

        {/* Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* API Health Monitor Card */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-brand-400" />
                  <h3 className="font-semibold text-lg text-white">API Health Verification</h3>
                </div>
                <button
                  onClick={fetchHealth}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700 disabled:opacity-50"
                  id="refresh-health-btn"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Checking...' : 'Test Connection'}
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-6">
                Target Endpoint: <code className="text-xs bg-slate-950 px-2 py-1 rounded text-brand-300 font-mono">GET /api/health</code>
              </p>

              {/* Status Visualizer */}
              <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Response Status</span>
                  {healthData ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" /> 200 OK — Operational
                    </span>
                  ) : error ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                      <XCircle className="w-4 h-4" /> Connection Failed
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Checking...</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-400">Raw JSON Payload</span>
                  <pre className="text-xs font-mono bg-slate-900/90 text-emerald-400 p-3 rounded border border-slate-800 overflow-x-auto">
                    {healthData 
                      ? JSON.stringify(healthData, null, 2) 
                      : error 
                      ? JSON.stringify({ success: false, error }, null, 2) 
                      : '{\n  "status": "loading..."\n}'
                    }
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Endpoint: Express.js (Port 5000)</span>
              <span>Last Checked: {lastChecked || 'Never'}</span>
            </div>
          </div>

          {/* Quick System Stats */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-6 shadow-lg">
            <h3 className="font-semibold text-lg text-white">Stack Architecture</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                  <span className="text-sm font-medium">Frontend</span>
                </div>
                <span className="text-xs text-slate-400">React + Vite + Tailwind</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <span className="text-sm font-medium">Backend API</span>
                </div>
                <span className="text-xs text-slate-400">Node.js + Express</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium">Database Layer</span>
                </div>
                <span className="text-xs text-slate-400">PostgreSQL (pg)</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-400"></div>
                  <span className="text-sm font-medium">ML & AI Service</span>
                </div>
                <span className="text-xs text-slate-400">FastAPI + Gemini API</span>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap Steps */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xl text-white">Implementation Roadmap</h3>
            <span className="text-xs text-slate-400">Modular incremental delivery</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {architecturePhases.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    item.active 
                      ? 'bg-slate-900/90 border-brand-500/50 shadow-md shadow-brand-500/10' 
                      : 'bg-slate-900/30 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.phase}
                    </span>
                    <Icon className={`w-4 h-4 ${item.active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <h4 className="font-medium text-slate-200 mt-3 text-sm">{item.name}</h4>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Status</span>
                    <span className={item.active ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 px-6 text-center text-xs text-slate-500">
        RicozAnalytics Enterprise Platform &copy; 2026. Built with modular architecture.
      </footer>
    </div>
  );
}
