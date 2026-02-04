import React, { useState } from 'react';
import { Eye, Trash2, Lock, Unlock } from 'lucide-react';
import { Solution, ThemeMode } from '../../types';
import { ErrorTypeBadge } from '../Common/ErrorTypeBadge';
import { TagCloud } from '../Common/TagCloud';

interface SolutionListItemProps {
  solution: Solution;
  onView: (solution: Solution) => void;
  onDelete: (id: string) => void;
  theme: ThemeMode;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const SolutionListItem: React.FC<SolutionListItemProps> = ({
  solution,
  onView,
  onDelete,
  theme,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDark = theme === 'dark';
  const errorPreview = solution.errorMessage || solution.preview;

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(solution.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={`
        group flex items-center gap-4 px-4 py-3 transition-colors
        ${isDark
          ? 'border-b border-slate-800/50 hover:bg-slate-900/50'
          : 'border-b border-slate-100 hover:bg-slate-50/50'
        }
      `}
    >
      {/* Error Type */}
      <div className="flex-shrink-0 w-24">
        <ErrorTypeBadge type={solution.errorType} size="sm" theme={theme} />
      </div>

      {/* Title & Description */}
      <div className="flex-1 min-w-0">
        <h3
          className={`
            font-medium truncate cursor-pointer transition-colors
            ${isDark ? 'text-slate-200 hover:text-emerald-400' : 'text-slate-800 hover:text-emerald-600'}
          `}
          onClick={() => onView(solution)}
        >
          {solution.title || 'Untitled Solution'}
        </h3>
        {errorPreview && (
          <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {errorPreview}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="hidden lg:flex flex-shrink-0 w-40">
        <TagCloud tags={solution.tags} maxVisible={2} size="sm" theme={theme} />
      </div>

      {/* Date */}
      <div className={`flex-shrink-0 w-20 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {formatDate(solution.createdAt)}
      </div>

      {/* Team/Private */}
      <div className="flex-shrink-0 w-6">
        {solution.visibility === 'team' ? (
          <Unlock size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
        ) : (
          <Lock size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onView(solution)}
          className={`
            p-1.5 rounded-md transition-colors
            ${isDark
              ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
            }
          `}
          title="View details"
        >
          <Eye size={16} />
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          className={`
            p-1.5 rounded-md transition-colors
            ${confirmDelete
              ? 'text-red-500 bg-red-500/10'
              : isDark
                ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                : 'text-slate-500 hover:text-red-500 hover:bg-slate-100'
            }
          `}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
