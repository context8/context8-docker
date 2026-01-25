import React from 'react';
import { LucideIcon } from 'lucide-react';
import { ThemeMode } from '../../types';

interface SegmentOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  theme: ThemeMode;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'sm',
  disabled = false,
  theme,
}) => {
  const isDark = theme === 'dark';

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2 text-sm';

  return (
    <div
      className={`
        inline-flex rounded-lg p-1
        ${isDark ? 'bg-slate-900' : 'bg-slate-100'}
      `}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!disabled) {
                onChange(option.value);
              }
            }}
            disabled={disabled}
            className={`
              ${sizeClasses}
              rounded-md font-medium transition-all duration-200
              flex items-center gap-1.5
              ${disabled ? 'cursor-not-allowed opacity-60' : ''}
              ${isActive
                ? isDark
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'bg-white text-emerald-700 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`
                  ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                  ${isActive
                    ? isDark
                      ? 'bg-emerald-900/50 text-emerald-300'
                      : 'bg-emerald-100 text-emerald-700'
                    : isDark
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-slate-200 text-slate-500'
                  }
                `}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
