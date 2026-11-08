import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  LayoutDashboard,
  FileBarChart,
  Sparkles,
  TrendingUp,
  BarChart3,
  Radar,
  Check,
  Send,
  Loader2
} from 'lucide-react';
import { getDashboards, getReports, getAIInsights } from '../../services/api';

export default function ShareAnalyticsModal({ isOpen, onClose, onShare }) {
  const [activeTab, setActiveTab] = useState('dashboards');
  const [searchQuery, setSearchQuery] = useState('');
  const [note, setNote] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const [dashboards, setDashboards] = useState([]);
  const [reports, setReports] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWorkspaceResources();
    }
  }, [isOpen]);

  const loadWorkspaceResources = async () => {
    try {
      setLoading(true);
      const [dashRes, repRes, insRes] = await Promise.all([
        getDashboards ? getDashboards().catch(() => ({ dashboards: [] })) : Promise.resolve({ dashboards: [] }),
        getReports ? getReports().catch(() => ({ reports: [] })) : Promise.resolve({ reports: [] }),
        getAIInsights ? getAIInsights().catch(() => ({ insights: [] })) : Promise.resolve({ insights: [] })
      ]);

      setDashboards(dashRes.dashboards || dashRes.data || []);
      setReports(repRes.reports || repRes.data || []);
      setInsights(insRes.insights || insRes.data || []);
    } catch (err) {
      console.warn('Error loading analytics items for sharing:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter items by search query
  const filterList = (list, titleKey = 'title') => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => {
      const title = (item[titleKey] || item.name || '').toLowerCase();
      const desc = (item.description || item.summary || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  };

  const handleConfirmShare = () => {
    if (!selectedItem) return;

    let analyticsPayload = null;

    if (activeTab === 'dashboards') {
      analyticsPayload = {
        type: 'dashboard',
        id: selectedItem.id,
        title: selectedItem.title || 'Executive Dashboard',
        subtitle: selectedItem.description || 'Workspace overview & metrics',
        openLink: `/dashboards`
      };
    } else if (activeTab === 'reports') {
      analyticsPayload = {
        type: 'report',
        id: selectedItem.id,
        title: selectedItem.title || 'Analytics Digest',
        subtitle: `Format: ${(selectedItem.format || 'PDF').toUpperCase()} • ${selectedItem.description || 'Periodic analysis report'}`,
        openLink: `/reports`
      };
    } else if (activeTab === 'insights') {
      analyticsPayload = {
        type: 'insight',
        id: selectedItem.id,
        title: selectedItem.title || 'AI Anomaly & Trend',
        subtitle: selectedItem.summary || 'Automated ML intelligence discovery',
        severity: selectedItem.severity || 'info',
        impactScore: selectedItem.impact_score || 95,
        openLink: `/ai-insights`
      };
    } else {
      // KPI / Metric
      analyticsPayload = {
        type: 'kpi',
        id: selectedItem.id,
        title: selectedItem.name || 'Core Business Metric',
        subtitle: 'Telemetry Dataset',
        metrics: {
          currentValue: selectedItem.current_value || 154000,
          growthPct: 24.8,
          currency: 'INR'
        },
        openLink: `/kpis`
      };
    }

    onShare({
      content: note.trim() || `Shared ${analyticsPayload.title}:`,
      sharedAnalytics: analyticsPayload
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Share Live Analytics to Chat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Embed interactive KPIs, dashboards, AI insights, or reports directly into the conversation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-2">
          {[
            { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard },
            { id: 'insights', label: 'AI Insights', icon: Sparkles },
            { id: 'reports', label: 'Reports', icon: FileBarChart },
            { id: 'kpis', label: 'Key Metrics', icon: TrendingUp }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedItem(null);
                }}
                className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  active
                    ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <span className="text-xs">Loading analytics resources...</span>
            </div>
          ) : (
            (() => {
              let items = [];
              if (activeTab === 'dashboards') items = filterList(dashboards, 'title');
              else if (activeTab === 'reports') items = filterList(reports, 'title');
              else if (activeTab === 'insights') items = filterList(insights, 'title');
              else {
                items = [
                  { id: 'kpi_mrr', name: 'Monthly Recurring Revenue (MRR)', current_value: 154000, growthPct: 24.8 },
                  { id: 'kpi_conversion', name: 'Sales Conversion Rate', current_value: 18.4, growthPct: 3.2 },
                  { id: 'kpi_aov', name: 'Average Order Value (AOV)', current_value: 4850, growthPct: -1.4 }
                ];
              }

              if (items.length === 0) {
                return (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No items found in this workspace category.
                  </div>
                );
              }

              return items.map(item => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.title || item.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {item.description || item.summary || 'Production telemetry metrics'}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Note input & Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 space-y-3">
          <input
            type="text"
            placeholder="Add an optional note to accompany the shared analytics..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedItem}
              onClick={handleConfirmShare}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
