import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Enterprise Upload & Ingest Pipeline Progress Component
 * @param {{
 *   progress: number,
 *   stage: 'uploading' | 'parsing' | 'schema' | 'complete' | string,
 *   stageMessage?: string
 * }} props
 */
export default function UploadProgress({
  progress = 0,
  stage = 'uploading',
  stageMessage
}) {
  const steps = [
    { key: 'uploading', label: '1. Binary Transfer' },
    { key: 'parsing', label: '2. Parsing Records' },
    { key: 'schema', label: '3. Inferring Schema' },
    { key: 'complete', label: '4. Ingest Complete' }
  ];

  const getStepStatus = (stepKey) => {
    const order = ['uploading', 'parsing', 'schema', 'complete'];
    const currentIndex = order.indexOf(stage);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stage === 'complete' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          )}
          <span className="text-xs font-semibold text-slate-800">
            {stageMessage || 'Processing dataset ingestion pipeline...'}
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-slate-700">
          {Math.min(100, Math.max(0, Math.round(progress)))}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
        />
      </div>

      {/* Pipeline Steps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[11px]">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-center gap-1.5 font-medium ${
                status === 'done'
                  ? 'text-emerald-600'
                  : status === 'active'
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === 'done'
                    ? 'bg-emerald-600'
                    : status === 'active'
                    ? 'bg-blue-600 animate-pulse'
                    : 'bg-slate-300'
                }`}
              />
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
