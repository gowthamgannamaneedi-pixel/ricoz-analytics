import React from 'react';
import { 
  Database, 
  BarChart3, 
  Zap, 
  FileSpreadsheet, 
  BellRing, 
  Sparkles, 
  CheckCircle, 
  ArrowRight,
  Sliders,
  Share2,
  LineChart,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesGrid() {
  const features = [
    {
      icon: Database,
      badge: 'Data Management & Ingestion',
      title: 'Unified Multi-Source Data Lake',
      description:
        'Connect PostgreSQL, MySQL, REST APIs, CSV uploads, Snowflake, and Google Sheets into a consolidated sovereign warehouse with schema auto-inference.',
      highlights: [
        'Automated schema discovery & data type validation',
        'Real-time streaming & scheduled micro-batching',
        'Relational data modeling & cross-table foreign key linking'
      ],
      linkText: 'Explore Data Sources',
      linkUrl: '/login'
    },
    {
      icon: Sliders,
      badge: 'Metrics & Performance',
      title: 'Dynamic KPI & Goal Tracking Engine',
      description:
        'Define formulaic enterprise KPIs, assign performance targets, calculate variances, and monitor department scorecards without writing SQL.',
      highlights: [
        'Custom metric formulas (e.g., Target vs Actuals, ROI, CAGR)',
        'Automated status grading (Healthy, Warning, Critical)',
        'Hierarchical grouping by Franchise, Region, or Department'
      ],
      linkText: 'Explore KPI Studio',
      linkUrl: '/login'
    },
    {
      icon: BarChart3,
      badge: 'Visualization & Cockpits',
      title: 'Interactive Visual Dashboards',
      description:
        'Build customizable analytical dashboards with drag-and-drop charts, multi-dimensional filter bars, and responsive layouts designed for decision makers.',
      highlights: [
        '20+ chart variations (Area, Multi-Bar, Donut, Heatmaps)',
        'Interactive drilldowns and cross-filtering',
        'Role-customized views for executives vs store managers'
      ],
      linkText: 'Explore Dashboards',
      linkUrl: '/login'
    },
    {
      icon: FileSpreadsheet,
      badge: 'Reports & Exports',
      title: 'Automated Reports & Scheduled Delivery',
      description:
        'Configure cron schedules to automatically compile pixel-perfect executive PDF summaries and formatted Excel workbooks delivered right to your inbox.',
      highlights: [
        'Scheduled daily, weekly, and monthly email dispatches',
        'Comprehensive PDF reports with corporate branding',
        'Raw data export in CSV, XLSX, and JSON formats'
      ],
      linkText: 'Explore Automated Reports',
      linkUrl: '/login'
    },
    {
      icon: BellRing,
      badge: 'Incidents & Real-Time Monitoring',
      title: 'Proactive Alerting & SLA Safeguards',
      description:
        'Eliminate blind spots with instant automated alerts triggered when key business metrics, margins, or branch thresholds drop below tolerance.',
      highlights: [
        'Multi-condition threshold evaluation rules',
        'Multi-channel dispatch (Email, Slack, Webhooks, In-App)',
        'Incident tracking with root-cause diagnostic drawer'
      ],
      linkText: 'Explore Alert Systems',
      linkUrl: '/login'
    },
    {
      icon: Sparkles,
      badge: 'Predictive Intelligence',
      title: 'AI Analytics Copilot & Forecasts',
      description:
        'Leverage embedded machine learning to project upcoming revenue trajectories, identify anomalies before they impact EBITDA, and ask questions in plain English.',
      highlights: [
        'Automated time-series regression & seasonality forecasting',
        'Root-cause anomaly detection across high-volume datasets',
        'Natural language business query conversational assistant'
      ],
      linkText: 'Explore AI Assistant',
      linkUrl: '/login'
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
            Why RicozAnalytics
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Enterprise Architecture Built for Modern Decision Velocity
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            From raw transaction ingestion to automated leadership briefings, RicozAnalytics handles every tier of your modern business intelligence lifecycle.
          </p>
        </div>

        {/* 6 Core Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-xl hover:border-red-300 dark:hover:border-red-800/80 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-13 h-13 p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
                    <feature.icon size={26} />
                  </div>
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md uppercase tracking-wider border border-red-100 dark:border-red-900/50">
                    {feature.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {feature.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  {feature.description}
                </p>

                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 mb-6">
                  {feature.highlights.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <CheckCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={feature.linkUrl}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 group-hover:translate-x-1 transition-transform"
              >
                <span>{feature.linkText}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
