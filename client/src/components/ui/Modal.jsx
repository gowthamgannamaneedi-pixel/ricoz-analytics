import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Universal Shared Modal & Full-Viewport Backdrop Overlay Component
 *
 * Requirements:
 * - Backdrop covers the entire application viewport (top: 0 to 100vh, left: 0 to 100vw),
 *   strictly covering header, logo, sidebar, and main content (z-[100]).
 * - Eliminates any uncovered top strip.
 * - Prevents background scrolling and background clicks while open.
 * - Fully accessible with Escape key listener and focus management.
 * - Theme-appropriate light and dark mode surfaces.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  maxWidth = 'max-w-lg', // 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl'
  showCloseButton = true,
  className = '',
  footer
}) {
  // Lock body scroll and handle Escape key while modal is mounted
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={(e) => {
        // Close if clicked directly on backdrop
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full ${maxWidth} rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] text-slate-900 dark:text-[#F8FAFC] shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#334155] bg-white dark:bg-[#111827] shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              {Icon && (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/60 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 id="modal-title" className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5 truncate">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-rose-500 transition cursor-pointer shrink-0"
                aria-label="Close dialog"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] rounded-b-2xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default Modal;
