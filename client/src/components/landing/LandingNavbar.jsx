import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, PhoneCall, ChevronRight, Sparkles } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from '../ui/Logo';

export default function LandingNavbar({ onOpenDemo }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navContainerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      if (totalScroll > 0) {
        setScrollProgress((currentScroll / totalScroll) * 100);
      }
      setIsScrolled(currentScroll > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
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
      if (e.key === 'Escape') setMobileMenuOpen(false);
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
    { name: 'Product', href: '#product' },
    { name: 'Features', href: '#features' },
    { name: 'Analytics', href: '#analytics' },
    { name: 'AI Copilot', href: '#ai-insights' },
    { name: 'Integrations', href: '#integrations' },
    { name: 'Security', href: '#security' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      ref={navContainerRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800 py-2.5'
          : 'bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 py-3.5'
      }`}
    >
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Official Brand Logo */}
          <Logo size="lg" linkTo="/" />

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-5 2xl:gap-7 shrink-0">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-xs 2xl:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 whitespace-nowrap px-1 py-1"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Desktop CTA Action Buttons */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <ThemeToggle size="sm" />

            <button
              type="button"
              onClick={onOpenDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs xl:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PhoneCall size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              <span>Book Demo</span>
            </button>

            <Link
              to="/login"
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs xl:text-sm font-semibold text-red-600 dark:text-red-400 border border-red-600/30 dark:border-red-500/30 hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all duration-150 shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs xl:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-150 shadow-md shadow-red-600/20 hover:shadow-red-600/30 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={14} className="shrink-0" />
            </Link>
          </div>

          {/* Mobile Actions: Theme Toggle + Sign In + Menu */}
          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle size="sm" />
            <Link
              to="/login"
              className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50"
            >
              Sign In
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-4 pb-6 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
            <div className="flex flex-col space-y-2.5">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between"
                >
                  <span>{link.name}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </a>
              ))}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDemo();
                  }}
                  className="w-full py-2.5 px-4 text-center font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Book Enterprise Architecture Demo
                </button>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 text-center font-bold text-xs text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md shadow-red-600/20 cursor-pointer"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exploration Scroll Progress Indicator */}
      <div 
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-red-600 via-rose-500 to-red-600 transition-all duration-150 pointer-events-none" 
        style={{ width: `${scrollProgress}%` }} 
      />
    </header>
  );
}
