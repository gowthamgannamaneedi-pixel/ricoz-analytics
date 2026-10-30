import React from 'react';
import { Quote, Star, CheckCircle2, Award } from 'lucide-react';
import { useInView } from './useScrollAnimation';

export default function TestimonialBanner() {
  const [sectionRef, inView] = useInView({ threshold: 0.08 });

  return (
    <section 
      ref={sectionRef}
      id="testimonial"
      className="py-20 lg:py-24 bg-gradient-to-b from-white to-slate-50 dark:from-[#0B0F19] dark:to-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200"
    >
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-12 text-white shadow-2xl overflow-hidden border border-slate-800 rz-reveal-scale ${
          inView ? 'is-revealed' : ''
        }`}>
          {/* Subtle Ambient Red Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-red-700/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left/Top Quote mark & Profile Info */}
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} fill="currentColor" />
                ))}
                <span className="ml-2 text-xs font-bold text-slate-300 font-mono">5.0 Enterprise Review</span>
              </div>

              <blockquote className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug tracking-tight">
                "RicozAnalytics transformed how our leadership monitors regional operations. We unified 14 disconnected data feeds into live executive cockpits, reducing monthly reporting overhead by <span className="text-red-400 font-extrabold underline decoration-red-500/50">85%</span> while giving store leaders instant performance clarity."
              </blockquote>

              <div className="flex items-center gap-4 pt-2">
                <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-red-600 to-rose-400 p-0.5 shadow-md">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-base">
                    RK
                  </div>
                </div>
                <div>
                  <div className="text-base font-black text-white flex items-center gap-1.5">
                    <span>Rajesh Kumar</span>
                    <CheckCircle2 size={16} className="text-red-400" />
                  </div>
                  <div className="text-xs text-slate-400">
                    VP of Operations &amp; Business Intelligence, Ricoz Network
                  </div>
                </div>
              </div>
            </div>

            {/* Right Badge Card with subtle floating depth */}
            <div className="w-full md:w-68 bg-slate-800/90 backdrop-blur-md p-6 rounded-2xl border border-slate-700/80 flex flex-col items-center text-center space-y-3.5 shadow-xl rz-float">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shadow-xs">
                <Award size={26} />
              </div>
              <div className="text-sm font-bold text-white">Verified Enterprise Partner</div>
              <div className="text-xs text-slate-400 leading-relaxed">
                Processing over 4.8 million data records daily with sub-second dashboard rendering.
              </div>
              <div className="pt-2 w-full border-t border-slate-700/60 flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Production Node</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
