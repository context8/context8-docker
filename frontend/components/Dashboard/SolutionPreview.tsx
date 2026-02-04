import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ThemeMode } from '../../types';

interface SolutionPreviewProps {
  content?: string;
  maxLines?: number;
  expandable?: boolean;
  theme: ThemeMode;
}

export const SolutionPreview: React.FC<SolutionPreviewProps> = ({
  content,
  maxLines = 3,
  expandable = true,
  theme,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDark = theme === 'dark';

  if (!content) {
    return null;
  }

  const lines = content.split('\n');
  const needsExpansion = lines.length > maxLines || content.length > 200;
  const displayContent = isExpanded ? content : content.slice(0, 200);

  return (
    <div className="relative">
      <div
        className={`
          relative rounded-lg p-3 text-sm font-mono
          ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}
        `}
      >
        <pre
          className={`
            whitespace-pre-wrap break-words overflow-hidden
            ${isDark ? 'text-slate-300' : 'text-slate-600'}
            ${!isExpanded && needsExpansion ? 'line-clamp-3' : ''}
          `}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: isExpanded ? 'unset' : maxLines,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {displayContent}
        </pre>

        {!isExpanded && needsExpansion && (
          <div
            className={`
              absolute bottom-0 left-0 right-0 h-8
              bg-gradient-to-t pointer-events-none
              ${isDark ? 'from-slate-800/50' : 'from-slate-50'}
            `}
          />
        )}
      </div>

      {expandable && needsExpansion && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            mt-2 flex items-center gap-1 text-xs font-medium transition-colors
            ${isDark
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-emerald-600 hover:text-emerald-700'
            }
          `}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
};
