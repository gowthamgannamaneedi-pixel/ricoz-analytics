import React from 'react';
import { Database, Sliders, FileText, AlertTriangle, Clock } from 'lucide-react';

/**
 * Professional Light-First Activity Audit Stream
 * @param {{ activities: Array<{ id: number, type: string, title: string, description: string, timestamp: string, user: string }> }} props
 */
export default function ActivityList({ activities = [] }) {
  const getBadge = (type) => {
    switch (type) {
      case 'upload':
        return { label: 'ETL INGEST', color: 'text-sky-700 bg-sky-50 border-sky-200' };
      case 'kpi':
        return { label: 'KPI CONFIG', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'report':
        return { label: 'REPORT GEN', color: 'text-purple-700 bg-purple-50 border-purple-200' };
      case 'alert':
        return { label: 'THRESHOLD', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      default:
        return { label: 'AUDIT', color: 'text-slate-700 bg-slate-100 border-slate-200' };
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        No recent activity events recorded in stream.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 font-sans">
      {activities.map((item) => {
        const badge = getBadge(item.type);
        return (
          <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="font-semibold text-slate-900 truncate">
                  {item.title}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {item.description}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] text-slate-400 font-medium block">{item.timestamp}</span>
              <span className="text-[11px] text-slate-600 font-medium block">{item.user}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
