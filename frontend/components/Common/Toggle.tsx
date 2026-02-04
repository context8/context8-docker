import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: {
      switch: 'w-9 h-5',
      circle: 'w-4 h-4',
      translate: checked ? 'translate-x-4' : 'translate-x-0',
    },
    md: {
      switch: 'w-11 h-6',
      circle: 'w-5 h-5',
      translate: checked ? 'translate-x-5' : 'translate-x-0',
    },
  };

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`
          relative inline-flex items-center
          ${sizeClasses[size].switch}
          rounded-full
          transition-colors duration-200
          ${checked ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={handleClick}
      >
        <span
          className={`
            ${sizeClasses[size].circle}
            inline-block
            rounded-full
            bg-white
            shadow-md
            transform
            transition-transform duration-200
            ${sizeClasses[size].translate}
          `}
        />
      </div>
      {label && (
        <span className="text-sm text-gray-700 dark:text-slate-300">
          {label}
        </span>
      )}
    </label>
  );
};
