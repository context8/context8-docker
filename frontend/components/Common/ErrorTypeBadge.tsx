import React from 'react';
import {
  Code,
  Zap,
  Settings,
  Package,
  Wifi,
  GitBranch,
  Gauge,
  Shield,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { ThemeMode } from '../../types';

const errorTypeConfig: Record<string, {
  icon: LucideIcon;
  label: string;
  lightClasses: string;
  darkClasses: string;
}> = {
  'compile error': {
    icon: Code,
    label: 'Compile',
    lightClasses: 'bg-red-50 text-red-700 border-red-200',
    darkClasses: 'bg-red-950 text-red-300 border-red-800',
  },
  'runtime error': {
    icon: Zap,
    label: 'Runtime',
    lightClasses: 'bg-orange-50 text-orange-700 border-orange-200',
    darkClasses: 'bg-orange-950 text-orange-300 border-orange-800',
  },
  'configuration error': {
    icon: Settings,
    label: 'Config',
    lightClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    darkClasses: 'bg-blue-950 text-blue-300 border-blue-800',
  },
  'dependency error': {
    icon: Package,
    label: 'Dependency',
    lightClasses: 'bg-purple-50 text-purple-700 border-purple-200',
    darkClasses: 'bg-purple-950 text-purple-300 border-purple-800',
  },
  'network error': {
    icon: Wifi,
    label: 'Network',
    lightClasses: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    darkClasses: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  },
  'logic error': {
    icon: GitBranch,
    label: 'Logic',
    lightClasses: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    darkClasses: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  },
  'performance issue': {
    icon: Gauge,
    label: 'Performance',
    lightClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    darkClasses: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
  'security issue': {
    icon: Shield,
    label: 'Security',
    lightClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    darkClasses: 'bg-rose-950 text-rose-300 border-rose-800',
  },
  other: {
    icon: HelpCircle,
    label: 'Other',
    lightClasses: 'bg-slate-50 text-slate-700 border-slate-200',
    darkClasses: 'bg-slate-800 text-slate-300 border-slate-700',
  },
};

const errorTypeAliases: Record<string, keyof typeof errorTypeConfig> = {
  compile: 'compile error',
  runtime: 'runtime error',
  configuration: 'configuration error',
  config: 'configuration error',
  dependency: 'dependency error',
  network: 'network error',
  logic: 'logic error',
  performance: 'performance issue',
  perf: 'performance issue',
  security: 'security issue',
};

export const normalizeErrorType = (type?: string): keyof typeof errorTypeConfig => {
  if (!type) return 'other';
  const raw = type.toLowerCase().trim();
  if (errorTypeConfig[raw]) {
    return raw as keyof typeof errorTypeConfig;
  }
  return errorTypeAliases[raw] || 'other';
};

interface ErrorTypeBadgeProps {
  type?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  theme: ThemeMode;
}

export const ErrorTypeBadge: React.FC<ErrorTypeBadgeProps> = ({
  type,
  size = 'sm',
  showIcon = true,
  theme,
}) => {
  const normalizedType = normalizeErrorType(type);
  const config = errorTypeConfig[normalizedType] || errorTypeConfig.other;
  const Icon = config.icon;
  const isDark = theme === 'dark';

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-sm gap-1.5';

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${sizeClasses}
        ${isDark ? config.darkClasses : config.lightClasses}
      `}
    >
      {showIcon && <Icon size={iconSize} />}
      <span>{config.label}</span>
    </span>
  );
};

export const getErrorTypeOptions = () => {
  return Object.entries(errorTypeConfig).map(([key, value]) => ({
    value: key,
    label: value.label,
    icon: value.icon,
  }));
};
