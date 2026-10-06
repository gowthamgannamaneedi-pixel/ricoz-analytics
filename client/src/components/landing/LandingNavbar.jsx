import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, PhoneCall, ChevronRight } from 'lucide-react';

export default function LandingNavbar({ onOpenDemo }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navContainerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click-outside and Escape key listener for mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (e) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: 'Platform', href: '#platform' },
    { name: 'Core Capabilities', href: '#features' },
    { name: 'Live Dashboards', href: '#dashboards' },
    { name: 'AI & Automation', href: '#ai-automation' },
    { name: 'Security & RBAC', href: '#security' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      ref={navContainerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/80 py-2.5'
          : 'bg-white border-b border-slate-100 py-3.5'
      }`}
    >
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between gap-4 lg:gap-6 xl:gap-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <span className="tracking-tighter">rZ</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Ricoz</span>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                Analytics
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-6 2xl:gap-8 shrink-0">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-xs xl:text-sm font-semibold text-slate-600 hover:text-red-600 transition-colors duration-150 whitespace-nowrap px-1 py-1"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Desktop CTA Action Buttons */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs xl:text-sm font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50/70 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PhoneCall size={14} className="text-red-600 shrink-0" />
              <span>Talk to Sales</span>
            </button>

            <Link
              to="/login"
              className="inline-flex items-center justify-center px-3.5 xl:px-4 py-2 text-xs xl:text-sm font-semibold text-red-600 border border-red-600/30 hover:border-red-600 hover:bg-red-50 rounded-xl transition-all duration-150 shadow-2xs whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 xl:px-4.5 py-2 text-xs xl:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-150 shadow-md shadow-red-600/20 hover:shadow-red-600/30 whitespace-nowrap shrink-0"
            >
              <span>Get Started</span>
              <ArrowRight size={14} className="shrink-0" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              to="/login"
              className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200"
            >
              Sign In
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-4 pb-6 border-t border-slate-100 animate-fadeIn">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-base font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span>{link.name}</span>
                  <ChevronRight size={16} className="text-slate-400" />
                </a>
              ))}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDemo();
                  }}
                  className="w-full py-2.5 px-4 text-center font-semibold text-sm text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Schedule Demo / Contact Sales
                </button>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 text-center font-semibold text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md shadow-red-600/20"
                >
                  Launch Free Workspace
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
