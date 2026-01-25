import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { ThemeMode } from '../../types';

interface DropdownOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface DropdownProps {
  value: string | null;
  options: DropdownOption[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  theme: ThemeMode;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  allowClear = true,
  disabled = false,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    if (allowClear && optionValue === value) {
      onChange(null);
    } else {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm
          min-w-[140px] transition-colors
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}
          ${isDark
            ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
          }
          ${isOpen ? (isDark ? 'border-emerald-500' : 'border-emerald-400') : ''}
        `}
      >
        <span className={`flex items-center gap-2 ${!selectedOption ? (isDark ? 'text-slate-500' : 'text-gray-400') : ''}`}>
          {selectedOption?.icon && <selectedOption.icon size={14} />}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 w-full min-w-[160px] rounded-lg border shadow-lg
            max-h-60 overflow-y-auto
            ${isDark
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-gray-200'
            }
          `}
        >
          {allowClear && value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-2 text-left text-sm transition-colors
                ${isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-gray-400 hover:bg-gray-50'
                }
              `}
            >
              Clear selection
            </button>
          )}
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                  ${isDark
                    ? `hover:bg-slate-800 ${isSelected ? 'bg-slate-800 text-emerald-400' : 'text-slate-200'}`
                    : `hover:bg-gray-50 ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`
                  }
                `}
              >
                {Icon && <Icon size={14} />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
