import React from 'react';
import { ShieldCheck, Lock, UserCheck, Key, FileCheck, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SecurityGovernance() {
  const securityFeatures = [
    {
      icon: UserCheck,
      title: 'Granular Role-Based Access (RBAC)',
      desc: 'Define strict role permissions across Admin, Analyst, and Viewer tiers. Restrict sensitive financial figures and customer PII by user or branch group.',
    },
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      desc: 'AES-256 encryption at rest and TLS 1.3 in-transit for all database connections, uploaded datasets, and exported intelligence reports.',
    },
    {
      icon: FileCheck,
      title: 'Immutable Audit Logging',
      desc: 'Every query executed, report downloaded, metric edited, and filter applied is tracked with user timestamps for enterprise compliance.',
    },
    {
      icon: Server,
      title: 'Sovereign & Isolated Workspaces',
      desc: 'Organization-level tenant isolation ensures zero cross-organization leakage. Supports dedicated VPC and on-premise relational nodes.',
    },
  ];

  return (
    <section id="security" className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
            Enterprise Trust &amp; Governance
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Bank-Grade Security Built for Mission-Critical Data
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            RicozAnalytics is architected from the ground up to satisfy the strictest enterprise compliance and security standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((item) => (
            <div
              key={item.title}
              className="bg-slate-50/70 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800/80 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 shadow-2xs group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <item.icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck size={14} />
                <span>Enterprise Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
