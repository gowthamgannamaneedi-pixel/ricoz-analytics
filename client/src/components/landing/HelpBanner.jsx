import React from 'react';
import { PhoneCall, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

export default function HelpBanner({ onOpenDemo }) {
  return (
    <section className="py-16 bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* 3 Overlapping Avatar Bubbles */}
            <div className="flex -space-x-3 overflow-hidden p-1">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-400 border-2 border-white flex items-center justify-center font-bold text-white text-xs shadow-sm">
                AR
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 border-2 border-white flex items-center justify-center font-bold text-white text-xs shadow-sm">
                SK
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-800 to-red-600 border-2 border-white flex items-center justify-center font-bold text-white text-xs shadow-sm">
                VM
              </div>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
                Have questions about custom connectors or enterprise deployment?
              </h3>
              <p className="text-sm text-slate-600">
                Our solutions architects are ready to review your data schemas and build a custom proof-of-concept.
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={onOpenDemo}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-md shadow-red-600/20 hover:shadow-red-600/30"
            >
              <PhoneCall size={16} />
              <span>Talk to an Analytics Specialist</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
