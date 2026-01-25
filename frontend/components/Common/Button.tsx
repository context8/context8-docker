import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-600',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 dark:hover:bg-slate-800 dark:text-slate-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded',
    md: 'px-4 py-2 text-base rounded-md',
    lg: 'px-6 py-3 text-lg rounded-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin mr-2" size={16} />}
      {children}
    </button>
  );
};
