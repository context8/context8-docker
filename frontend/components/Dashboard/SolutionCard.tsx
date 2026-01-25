import React, { useState } from 'react';
import { Eye, Trash2, Lock, Unlock } from 'lucide-react';
import { Solution, ThemeMode, Visibility } from '../../types';
import { Button } from '../Common/Button';
import { Toggle } from '../Common/Toggle';
import { ErrorTypeBadge } from '../Common/ErrorTypeBadge';
import { TagCloud } from '../Common/TagCloud';
import { SolutionPreview } from './SolutionPreview';
import { SolutionStats } from './SolutionStats';

export interface SolutionCardProps {
  solution: Solution;
  onView: (solution: Solution) => void;
  onDelete: (id: string) => void;
  onSetVisibility?: (id: string, visibility: Visibility) => void;
  theme: ThemeMode;
  showPreview?: boolean;
}

export const SolutionCard: React.FC<SolutionCardProps> = ({
  solution,
  onView,
  onDelete,
  onSetVisibility,
  theme,
  showPreview = true,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const isDark = theme === 'dark';
  const errorPreview = solution.errorMessage || solution.preview;
  const isTeam = solution.visibility === 'team';

  const handleDelete = () => {
    if (showConfirmDelete) {
      onDelete(solution.id);
    } else {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  const handleToggleVisibility = () => {
    if (onSetVisibility) {
      onSetVisibility(solution.id, isTeam ? 'private' : 'team');
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div
      className={`
        p-4 rounded-xl border transition-all duration-200
        ${isDark
          ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5'
          : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'
        }
        hover:-translate-y-0.5
      `}
    >
      {/* Header: Error Type & Visibility */}
      <div className="flex items-center justify-between mb-3">
        <ErrorTypeBadge type={solution.errorType} size="sm" theme={theme} />
        {solution.visibility !== undefined && (
          <div className="flex items-center gap-1">
            {isTeam ? (
              <Unlock size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            ) : (
              <Lock size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h3
        className={`
          font-semibold text-base mb-1 cursor-pointer transition-colors
          ${isDark ? 'text-slate-100 hover:text-emerald-400' : 'text-slate-900 hover:text-emerald-600'}
        `}
        onClick={() => onView(solution)}
      >
        {truncateText(solution.title || 'Untitled Solution', 60)}
      </h3>

      {/* Error Message Preview */}
      {errorPreview && (
        <p className={`text-sm mb-3 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {truncateText(errorPreview, 120)}
        </p>
      )}

      {/* Solution Preview */}
      {showPreview && solution.solution && (
        <div className="mb-3">
          <SolutionPreview
            content={solution.solution}
            maxLines={3}
            expandable={false}
            theme={theme}
          />
        </div>
      )}

      {/* Tags */}
      <div className="mb-3">
        <TagCloud tags={solution.tags} maxVisible={3} size="sm" theme={theme} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onView(solution)}
        >
          <Eye size={14} />
          <span className="ml-1">View</span>
        </Button>
        <Button
          variant={showConfirmDelete ? 'danger' : 'ghost'}
          size="sm"
          onClick={handleDelete}
        >
          <Trash2 size={14} />
          <span className="ml-1">{showConfirmDelete ? 'Confirm?' : 'Delete'}</span>
        </Button>
      </div>

      {/* Stats */}
      <SolutionStats
        createdAt={solution.createdAt}
        views={solution.views}
        upvotes={solution.upvotes}
        downvotes={solution.downvotes}
        apiKeyName={solution.apiKeyName}
        theme={theme}
      />

      {/* Team/Private Toggle */}
      {onSetVisibility && solution.visibility !== undefined && (
        <div className={`
          flex items-center justify-between pt-3 mt-3 border-t text-xs
          ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}
        `}>
          <span>{isTeam ? 'Team' : 'Private'}</span>
          <Toggle
            checked={isTeam}
            onChange={handleToggleVisibility}
            size="sm"
          />
        </div>
      )}
    </div>
  );
};
