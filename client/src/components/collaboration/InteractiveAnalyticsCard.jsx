import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Sparkles,
  FileBarChart,
  Radar,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { verifySharedResourceApi } from '../../services/api';

export default function InteractiveAnalyticsCard({ data, isSender }) {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [accessError, setAccessError] = useState(null);

  if (!data || typeof data !== 'object') return null;

  const {
    type = 'kpi',
    id,
    title = 'Analytics Resource',
    subtitle,
    metrics = {},
    previewData = [],
    severity = 'info',
    impactScore,
    openLink
  } = data;

  const handleOpenResource = async (e) => {
    e.preventDefault();
    setAccessError(null);
    setVerifying(true);

    try {
      if (id) {
        const verifyRes = await verifySharedResourceApi(type, id);
        if (!verifyRes.accessible) {
          setAccessError('This resource has been deleted or is no longer accessible.');
          setVerifying(false);
          return;
        }
      }

      // Navigate or open link
      if (openLink) {
        navigate(openLink);
      } else {
        switch (type.toLowerCase()) {
          case 'dashboard':
            navigate(id ? `/dashboards` : '/dashboards');
            break;
          case 'report':
            navigate('/reports');
            break;
          case 'insight':
          case 'business_radar':
            navigate('/ai-insights');
            break;
          case 'kpi':
            navigate('/kpis');
            break;
          default:
            navigate('/dashboard');
        }
      }
    } catch (err) {
      console.warn('Resource verification error:', err);
      setAccessError('Permission check failed. You may not have access to this item.');
    } finally {
      setVerifying(false);
    }
  };

  // Type-specific badge and icon configuration
  const getTypeConfig = () => {
    switch (type.toLowerCase()) {
      case 'dashboard':
        return {
          icon: LayoutDashboard,
          label: 'Dashboard',
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
        };
      case 'report':
        return {
          icon: FileBarChart,
          label: 'Executive Report',
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
        };
      case 'insight':
        return {
          icon: Sparkles,
          label: 'AI Insight',
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        };
      case 'business_radar':
        return {
          icon: Radar,
          label: 'Business Radar',
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
        };
      case 'chart':
        return {
          icon: BarChart3,
          label: 'Interactive Chart',
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
        };
      case 'kpi':
      default:
        return {
          icon: TrendingUp,
          label: 'Key Performance Metric',
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
        };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  const formatCurrency = (val, cur = 'INR') => {
    if (val === undefined || val === null || isNaN(Number(val))) return '₹0.00';
    const num = Number(val);
    const prefix = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : '';
    return `${prefix}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="mt-2.5 mb-1 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-4 shadow-sm hover:shadow-md transition text-slate-800 dark:text-slate-100 max-w-lg w-full">
      {/* Top Header: Type Pill & Live Grounding Badge */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config.bg}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{config.label}</span>
        </span>

        {impactScore !== undefined && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            Impact: {impactScore}/100
          </span>
        )}
      </div>

      {/* Main Title & Subtitle */}
      <div className="mt-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
          {title}
        </h4>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      {/* Specific Content Visualizations */}
      {/* 1. KPI Value Box */}
      {metrics && metrics.currentValue !== undefined && (
        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Current Value
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(metrics.currentValue, metrics.currency)}
            </div>
          </div>
          {metrics.growthPct !== undefined && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
              metrics.growthPct >= 0 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            }`}>
              {metrics.growthPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{metrics.growthPct > 0 ? `+${metrics.growthPct}%` : `${metrics.growthPct}%`}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. Sparkline or Mini Bar Preview */}
      {Array.isArray(previewData) && previewData.length > 0 && (
        <div className="mt-3 pt-2">
          <div className="flex items-end gap-1.5 h-12 w-full px-1">
            {previewData.map((d, i) => {
              const maxVal = Math.max(...previewData.map(p => Number(p.value) || 0), 1);
              const heightPct = Math.max(15, Math.round(((Number(d.value) || 0) / maxVal) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  <div 
                    className="w-full bg-rose-500/80 hover:bg-rose-600 dark:bg-rose-500 rounded-t-sm transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`${d.label || `Point ${i + 1}`}: ${d.value}`}
                  />
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[36px]">
                    {d.label ? String(d.label).slice(0, 3) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Access Error Banner (if resource deleted/revoked) */}
      {accessError && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{accessError}</span>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Tenant Verified</span>
        </span>

        <button
          onClick={handleOpenResource}
          disabled={verifying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {verifying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <span>Open Resource</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
