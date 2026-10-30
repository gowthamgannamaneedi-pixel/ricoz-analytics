import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Users, 
  MessageSquare, 
  Key, 
  FileCheck2, 
  CheckCircle2, 
  ArrowRight,
  Eye,
  Share2,
  Sparkles,
  Send,
  Building,
  ThumbsUp,
  Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Interactive3DCard from './Interactive3DCard';

export default function SecuritySection({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState('security'); // 'security' | 'collaboration'
  const [liked, setLiked] = useState(false);

  const securityCards = [
    {
      icon: FileCheck2,
      iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      title: 'SOC 2 & ISO 27001 Aligned Controls',
      desc: 'Architected with strict control principles, role-based access management, continuous audit logging, and defensive security baselines.',
      status: 'Enterprise control framework'
    },
    {
      icon: Lock,
      iconColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
      title: 'AES-256 & TLS 1.3 Encryption',
      desc: 'Every data byte is encrypted in flight with TLS 1.3 and at rest with hardware-backed AES-256 keys. Dedicated per-tenant KMS keys for enterprise tiers.',
      status: 'Zero unencrypted data pathways'
    },
    {
      icon: Key,
      iconColor: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
      title: 'Row-Level Security (RLS) & RBAC',
      desc: 'Franchise branch managers can only view rows matching their allocated store IDs, while HQ executives see consolidated network metrics.',
      status: 'Zero cross-branch data exposure'
    },
    {
      icon: Building,
      iconColor: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
      title: 'Sovereign Workspace Isolation',
      desc: 'Logical database partitioning ensures complete multi-tenant tenant isolation. On-premises and private VPC container deployments available for Enterprise.',
      status: 'Private VPC deployment ready'
    },
    {
      icon: Eye,
      iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      title: 'Immutable Audit Logging',
      desc: 'Every query run, report exported, threshold changed, and dashboard shared is immutably logged with timestamp, user ID, IP address, and payload hash.',
      status: 'Forensic audit compliance'
    },
    {
      icon: Users,
      iconColor: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
      title: 'Single Sign-On (SSO / SAML)',
      desc: 'Seamlessly provision team seats via Okta, Microsoft Entra ID (Azure AD), Google Workspace, or any custom SAML 2.0 / OIDC identity provider.',
      status: 'Zero-friction IT provisioning'
    }
  ];

  return (
    <section 
      id="security" 
      className="py-20 lg:py-28 bg-slate-50/70 dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <ShieldCheck size={14} className="text-red-600 dark:text-red-400" />
            <span>Enterprise Trust &amp; Governance</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Enterprise Security.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Seamless Team Collaboration.
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Protect multi-crore enterprise financial metrics with sovereign data tenancy, granular row-level access, and immutable audit logs.
          </p>

          {/* Toggle between Security & Collaboration */}
          <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Enterprise Security Architecture
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collaboration')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'collaboration'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Team Workspaces &amp; Collaboration
            </button>
          </div>
        </div>

        {/* Tab 1: Enterprise Security Grid with 3D Cards */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityCards.map((card, i) => {
              const IconComponent = card.icon;
              return (
                <Interactive3DCard
                  key={i}
                  maxTilt={12}
                  scale={1.03}
                  glare={true}
                  className="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-red-400 dark:hover:border-red-800 transition-colors"
                >
                  <div>
                    <div 
                      className={`w-12 h-12 rounded-2xl ${card.iconColor} flex items-center justify-center mb-4 shadow-xs`}
                      style={{ transform: 'translateZ(20px)' }}
                    >
                      <IconComponent size={24} />
                    </div>
                    <h3 
                      className="text-lg font-bold text-slate-900 dark:text-white mb-2"
                      style={{ transform: 'translateZ(15px)' }}
                    >
                      {card.title}
                    </h3>
                    <p 
                      className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4"
                      style={{ transform: 'translateZ(10px)' }}
                    >
                      {card.desc}
                    </p>
                  </div>
                  <div 
                    className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    style={{ transform: 'translateZ(15px)' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{card.status}</span>
                  </div>
                </Interactive3DCard>
              );
            })}
          </div>
        )}

        {/* Tab 2: Collaboration & Team Workspaces Mockup */}
        {activeTab === 'collaboration' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-10 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Info Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-3 py-1 rounded-md border border-red-200 dark:border-red-900/60">
                  Built for Cross-Functional Execution
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Discuss, Annotate &amp; Decide Right Inside the Dashboard
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Eliminate disjointed email threads and conflicting numbers. Leave contextual comments directly on specific chart points, @mention regional branch leads, and track action items to resolution.
                </p>

                <ul className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>Threaded dashboard commenting with @mentions and email notification</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>Granular share links with expiration timestamps and watermark protection</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>Role-based saved views for Store Managers vs Regional Finance Directors</span>
                  </li>
                </ul>
              </div>

              {/* Right Mockup: Live Comment Thread UI with 3D Depth */}
              <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-inner space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-red-600" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Thread on "West Region Margin Pacing"
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    2 Comments
                  </span>
                </div>

                {/* Comment 1 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-[10px] flex items-center justify-center">
                        RK
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">Rajesh Kumar</span>
                      <span className="text-[10px] text-slate-400 font-mono">VP Operations</span>
                    </div>
                    <span className="text-[10px] text-slate-400">12 mins ago</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 pl-8">
                    <span className="font-bold text-red-600 dark:text-red-400">@Vikram</span> noticing a 14.2% margin contraction at Hub 19 over the weekend. Has the vendor promotion rebate been reconciled in the ledger?
                  </p>
                </div>

                {/* Comment 2 */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5 ml-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                        VS
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">Vikram Sharma</span>
                      <span className="text-[10px] text-slate-400 font-mono">West Regional Director</span>
                    </div>
                    <span className="text-[10px] text-slate-400">4 mins ago</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 pl-8">
                    Confirmed, credit note #CR-9022 is currently processing in ERP. Margin will reflect back to 68.2% on the 18:00 sync.
                  </p>
                  <div className="pl-8 pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLiked(!liked)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                        liked ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <ThumbsUp size={11} />
                      <span>{liked ? 'Acknowledged (1)' : 'Acknowledge'}</span>
                    </button>
                  </div>
                </div>

                {/* Simulated Input Box */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    placeholder="Reply to thread or @mention team member..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400"
                  />
                  <div className="p-2 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30">
                    <Send size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
