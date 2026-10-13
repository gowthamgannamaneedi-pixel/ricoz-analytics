import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Enterprise Universal Select / Dropdown Component — RicozAnalytics
 *
 * Visual standard: Reference 01 (Export Menu)
 * - White surface with rounded corners (rounded-xl)
 * - Subtle border and soft shadow (border border-slate-200/90 shadow-xl)
 * - Dark, readable default text (text-slate-800)
 * - Soft red/pale pink hover background with red text (hover:bg-rose-50 hover:text-rose-700)
 * - Clear keyboard focus, checkmark on selected item
 * - Portal-backed layering to prevent any clipping from parent overflow/cards/modals
 * - 100% backward compatible: supports both `options={...}` and `<option>` children
 * - Calls `onChange({ target: { value, name, id } })` for seamless drop-in replacement
 */
export function Select({
  value,
  defaultValue,
  onChange,
  options,
  children,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: LeftIcon,
  name,
  id: idProp,
  required = false,
  ariaLabel,
  'aria-label': ariaLabelProp,
  align = 'left', // 'left' | 'right'
  minMenuWidth,
  renderOption,
  ...rest
}) {
  const generatedId = useId();
  const selectId = idProp || generatedId;
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const hiddenSelectRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Normalize options from either `options` prop or `<option>` children
  const parsedOptions = React.useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options.map(opt => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          return { value: String(opt), label: String(opt) };
        }
        return {
          value: opt.value !== undefined ? String(opt.value) : '',
          label: opt.label !== undefined ? opt.label : String(opt.value ?? ''),
          badge: opt.badge,
          icon: opt.icon,
          disabled: Boolean(opt.disabled),
          description: opt.description
        };
      });
    }

    if (children) {
      const items = [];
      React.Children.forEach(children, child => {
        if (!React.isValidElement(child)) return;
        if (child.type === 'option') {
          const val = child.props.value !== undefined ? String(child.props.value) : String(child.props.children ?? '');
          items.push({
            value: val,
            label: child.props.children,
            badge: child.props.badge,
            icon: child.props.icon,
            disabled: Boolean(child.props.disabled),
            description: child.props.description
          });
        }
      });
      return items;
    }

    return [];
  }, [options, children]);

  // Selected item lookup
  const selectedOption = parsedOptions.find(opt => String(opt.value) === String(currentValue));

  // Compute trigger geometry for portal positioning
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const estimatedMenuHeight = Math.min(parsedOptions.length * 40 + 16, 260);
    const placement = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';

    let width = Math.max(rect.width, minMenuWidth || (size === 'sm' ? 160 : 180));
    let left = align === 'right' ? rect.right - width : rect.left;

    // Viewport containment
    if (left + width > viewportWidth - 12) {
      left = viewportWidth - width - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const top = placement === 'bottom'
      ? rect.bottom + 6
      : rect.top - estimatedMenuHeight - 6;

    setCoords({
      top: Math.max(8, top),
      left: Math.max(8, left),
      width,
      placement
    });
  }, [align, minMenuWidth, parsedOptions.length, size]);

  // Toggle & reposition
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
      const selIdx = parsedOptions.findIndex(opt => String(opt.value) === String(currentValue));
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);
    } else {
      setIsOpen(false);
    }
  }, [disabled, isOpen, updateCoords, parsedOptions, currentValue]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const handleSelect = useCallback((opt) => {
    if (opt.disabled) return;
    if (!isControlled) {
      setInternalValue(opt.value);
    }
    if (onChange) {
      const syntheticEvent = {
        target: { value: opt.value, name, id: selectId },
        currentTarget: { value: opt.value, name, id: selectId },
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      onChange(syntheticEvent);
    }
    handleClose();
    triggerRef.current?.focus();
  }, [isControlled, onChange, name, selectId, handleClose]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen, updateCoords]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          let next = prev + 1;
          while (next < parsedOptions.length && parsedOptions[next]?.disabled) next++;
          return next < parsedOptions.length ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          let next = prev - 1;
          while (next >= 0 && parsedOptions[next]?.disabled) next--;
          return next >= 0 ? next : prev;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < parsedOptions.length) {
          handleSelect(parsedOptions[highlightedIndex]);
        }
      } else if (e.key === 'Tab') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose, highlightedIndex, parsedOptions, handleSelect]);

  // Size styling tokens
  const sizeClasses = {
    sm: 'h-9 text-xs pl-3 pr-8 rounded-xl',
    md: 'h-10 text-xs sm:text-sm pl-3.5 pr-9 rounded-xl',
    lg: 'h-11 text-sm sm:text-base pl-4 pr-10 rounded-xl'
  };

  const chevronSizeClasses = {
    sm: 'h-3.5 w-3.5 right-2.5',
    md: 'h-4 w-4 right-3',
    lg: 'h-4.5 w-4.5 right-3.5'
  };

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* Hidden native select for form serialization / accessibility */}
      <select
        ref={hiddenSelectRef}
        name={name}
        id={selectId}
        value={currentValue ?? ''}
        required={required}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute opacity-0"
      >
        <option value="">{placeholder}</option>
        {parsedOptions.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {typeof opt.label === 'string' ? opt.label : opt.value}
          </option>
        ))}
      </select>

      {/* Styled Trigger Control */}
      <button
        ref={triggerRef}
        type="button"
        id={`${selectId}-trigger`}
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || ariaLabelProp || (typeof selectedOption?.label === 'string' ? selectedOption.label : placeholder)}
        className={[
          'group relative w-full text-left font-medium select-none',
          'flex items-center justify-between',
          'bg-white dark:bg-slate-900',
          'border border-slate-200 dark:border-slate-700',
          'text-slate-800 dark:text-slate-100',
          'hover:border-rose-300 dark:hover:border-rose-800',
          'hover:bg-rose-50/40 dark:hover:bg-rose-950/20',
          'focus:outline-hidden focus:border-[#D91542] focus:ring-2 focus:ring-[#D91542]/20',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-850',
          'transition-all duration-150 shadow-2xs cursor-pointer',
          sizeClasses[size] || sizeClasses.md,
          LeftIcon ? 'pl-9 sm:pl-10' : '',
          triggerClassName
        ].filter(Boolean).join(' ')}
        {...rest}
      >
        {/* Left Icon */}
        {LeftIcon && (
          <LeftIcon className="h-4 w-4 text-rose-600 dark:text-rose-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
        )}

        {/* Selected Label Display */}
        <span className="truncate pr-4 block font-semibold text-slate-800 dark:text-slate-100">
          {selectedOption ? selectedOption.label : (
            <span className="text-slate-400 dark:text-slate-500 font-normal">{placeholder}</span>
          )}
        </span>

        {/* Dropdown Chevron */}
        <ChevronDown
          className={[
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-150',
            isOpen ? 'rotate-180 text-rose-600 dark:text-rose-400' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300',
            chevronSizeClasses[size] || chevronSizeClasses.md
          ].join(' ')}
          strokeWidth={2}
        />
      </button>

      {/* Floating Menu Portal (Reference 01 Standard) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          id={`${selectId}-menu`}
          aria-labelledby={`${selectId}-trigger`}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999
          }}
          className={[
            'rounded-xl border border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900',
            'p-1.5 shadow-xl text-xs sm:text-sm',
            'max-h-64 overflow-y-auto animate-in fade-in duration-100',
            menuClassName
          ].filter(Boolean).join(' ')}
        >
          {parsedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
              No options available
            </div>
          ) : (
            parsedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(currentValue);
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={[
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition select-none cursor-pointer',
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : isSelected
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#D91542] dark:text-rose-300 font-semibold'
                      : isHighlighted
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium'
                      : 'text-slate-700 dark:text-slate-200 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300'
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge or Checkmark */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="h-4 w-4 text-[#D91542] dark:text-rose-400 shrink-0" strokeWidth={2.5} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default Select;
