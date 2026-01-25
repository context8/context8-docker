import React from 'react';
import { ThemeMode } from '../../types';

interface TagCloudProps {
  tags?: string[];
  maxVisible?: number;
  onTagClick?: (tag: string) => void;
  interactive?: boolean;
  size?: 'sm' | 'md';
  theme: ThemeMode;
}

export const TagCloud: React.FC<TagCloudProps> = ({
  tags = [],
  maxVisible = 3,
  onTagClick,
  interactive = false,
  size = 'sm',
  theme,
}) => {
  const isDark = theme === 'dark';
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm';

  const baseClasses = `
    rounded-md font-medium transition-colors
    ${sizeClasses}
    ${isDark
      ? 'bg-slate-800 text-slate-300 border border-slate-700'
      : 'bg-slate-100 text-slate-600 border border-slate-200'
    }
  `;

  const interactiveClasses = interactive
    ? `cursor-pointer ${isDark ? 'hover:bg-slate-700 hover:border-emerald-600' : 'hover:bg-slate-200 hover:border-emerald-300'}`
    : '';

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleTags.map((tag, index) => (
        <span
          key={index}
          className={`${baseClasses} ${interactiveClasses}`}
          onClick={() => interactive && onTagClick?.(tag)}
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className={`
            ${sizeClasses}
            rounded-md font-medium
            ${isDark ? 'text-slate-500' : 'text-slate-400'}
          `}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};
