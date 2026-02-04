import React from 'react';
import { ThemeMode } from '../../types';

interface SolutionCardSkeletonProps {
  theme: ThemeMode;
  layout?: 'grid' | 'list';
}

export const SolutionCardSkeleton: React.FC<SolutionCardSkeletonProps> = ({
  theme,
  layout = 'grid',
}) => {
  const isDark = theme === 'dark';
  const shimmerClass = isDark ? 'bg-slate-700' : 'bg-slate-200';

  if (layout === 'list') {
    return (
      <div
        className={`
          flex items-center gap-4 p-4 animate-pulse
          ${isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'}
        `}
      >
        <div className={`h-6 w-20 rounded ${shimmerClass}`} />
        <div className={`h-5 w-48 rounded ${shimmerClass}`} />
        <div className="flex-1" />
        <div className={`h-5 w-24 rounded ${shimmerClass}`} />
        <div className={`h-5 w-20 rounded ${shimmerClass}`} />
      </div>
    );
  }

  return (
    <div
      className={`
        p-4 rounded-xl border animate-pulse
        ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className={`h-6 w-24 rounded ${shimmerClass}`} />
        <div className={`h-5 w-5 rounded ${shimmerClass}`} />
      </div>

      {/* Title */}
      <div className={`h-5 w-3/4 rounded mb-2 ${shimmerClass}`} />

      {/* Description */}
      <div className={`h-4 w-full rounded mb-1 ${shimmerClass}`} />
      <div className={`h-4 w-2/3 rounded mb-4 ${shimmerClass}`} />

      {/* Preview box */}
      <div className={`h-20 w-full rounded-lg mb-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`} />

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        <div className={`h-6 w-16 rounded ${shimmerClass}`} />
        <div className={`h-6 w-20 rounded ${shimmerClass}`} />
        <div className={`h-6 w-14 rounded ${shimmerClass}`} />
      </div>

      {/* Stats */}
      <div className={`pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex gap-4">
          <div className={`h-4 w-20 rounded ${shimmerClass}`} />
          <div className={`h-4 w-16 rounded ${shimmerClass}`} />
          <div className={`h-4 w-24 rounded ${shimmerClass}`} />
        </div>
      </div>
    </div>
  );
};
