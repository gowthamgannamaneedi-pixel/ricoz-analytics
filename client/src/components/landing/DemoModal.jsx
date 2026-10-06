import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, PhoneCall, ArrowRight, ShieldCheck, Mail, Building, User, AlertCircle, Loader2, ChevronDown, Check } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

const TEAM_SIZE_OPTIONS = [
  { value: '1-10', label: '1 - 10 branches / users' },
  { value: '10-50', label: '10 - 50 branches / users' },
  { value: '50-200', label: '50 - 200 branches / users' },
  { value: '200+', label: '200+ Enterprise Scale' }
];

const DATA_SOURCE_OPTIONS = [
  { value: 'PostgreSQL', label: 'PostgreSQL / Supabase' },
  { value: 'MySQL', label: 'MySQL Enterprise' },
  { value: 'Snowflake', label: 'Snowflake / BigQuery' },
  { value: 'REST', label: 'REST API / Webhooks' },
  { value: 'CSV', label: 'Google Sheets / CSV Uploads' },
  { value: 'Other', label: 'Multiple / Custom ERP System' }
];

function ModalSelect({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border bg-white text-left font-medium text-slate-800 transition shadow-2xs cursor-pointer flex items-center justify-between ${
            isOpen
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate">{selectedOption?.label || value}</span>
        </button>
        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-red-600' : 'text-slate-400'
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 py-1.5 overflow-hidden animate-fadeIn">
          <div className="max-h-56 overflow-y-auto py-0.5 space-y-0.5 px-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-blue-50/50 hover:text-blue-600 font-normal'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoModal({ isOpen, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    teamSize: '10-50',
    primaryDataSource: 'PostgreSQL',
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedCompany = formData.company.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailPattern.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    if (!trimmedCompany || trimmedCompany.length < 2) {
      setErrorMessage('Please enter your company or organization name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/demo-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: trimmedName,
          workEmail: trimmedEmail,
          company: trimmedCompany,
          teamSize: formData.teamSize,
          primaryDataSource: formData.primaryDataSource,
          phone: formData.phone.trim() || undefined,
          notes: formData.notes.trim() || undefined
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setSubmitted(true);
      } else {
        setErrorMessage(data?.message || 'Something went wrong while submitting your request. Please try again.');
      }
    } catch (err) {
      console.error('Demo request submission error:', err);
      setErrorMessage('Something went wrong while submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setErrorMessage('');
    setIsSubmitting(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      teamSize: '10-50',
      primaryDataSource: 'PostgreSQL',
      notes: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-fadeIn">
        {/* Close Button */}
        <button
          type="button"
          onClick={resetAndClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-2xl font-black text-slate-900">Request Received!</h3>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-sm font-medium max-w-md mx-auto leading-relaxed">
              Thanks! Your demo request has been received. The Ricoz team will contact you shortly.
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              A dedicated RicozAnalytics solutions architect will reach out to <span className="font-mono font-semibold text-slate-700">{formData.email}</span>.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-md shadow-red-600/20 cursor-pointer"
            >
              Back to Overview
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider mb-1">
                <PhoneCall size={12} /> Enterprise Consultation
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                Schedule an Architecture Walkthrough
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Discover how RicozAnalytics connects your multi-branch metrics and provides live AI BI cockpits.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Rajesh Kumar"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Work Email *</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="rajesh@company.com"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization *</label>
                  <div className="relative">
                    <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Acme Retail Ltd"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                <ModalSelect
                  label="Team / Branch Size *"
                  value={formData.teamSize}
                  options={TEAM_SIZE_OPTIONS}
                  onChange={(val) => setFormData({ ...formData, teamSize: val })}
                />
              </div>

              <ModalSelect
                label="Primary Data Source *"
                value={formData.primaryDataSource}
                options={DATA_SOURCE_OPTIONS}
                onChange={(val) => setFormData({ ...formData, primaryDataSource: val })}
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold text-sm transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Demo Request</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center pt-1">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Zero spam guarantee • Enterprise confidentiality under NDA</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
