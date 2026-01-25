import React from 'react';
import { Calendar, Eye, ThumbsUp, ThumbsDown, Key } from 'lucide-react';
import { ThemeMode } from '../../types';

interface SolutionStatsProps {
  createdAt?: string;
  views?: number;
  upvotes?: number;
  downvotes?: number;
  apiKeyName?: string;
  compact?: boolean;
  theme: ThemeMode;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const SolutionStats: React.FC<SolutionStatsProps> = ({
  createdAt,
  views,
  upvotes,
  downvotes,
  apiKeyName,
  compact = false,
  theme,
}) => {
  const isDark = theme === 'dark';

  const statItems = [
    { icon: Calendar, value: formatDate(createdAt), show: true },
    { icon: Eye, value: views?.toString(), show: views !== undefined },
    { icon: ThumbsUp, value: upvotes?.toString(), show: upvotes !== undefined },
    { icon: ThumbsDown, value: downvotes?.toString(), show: downvotes !== undefined },
    { icon: Key, value: apiKeyName, show: !!apiKeyName },
  ].filter(item => item.show);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {statItems.map((item, index) => (
          <span key={index} className="flex items-center gap-1">
            <item.icon size={12} />
            <span className="truncate max-w-[80px]">{item.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`
        flex items-center gap-4 pt-3 mt-3 border-t text-xs
        ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}
      `}
    >
      {statItems.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <item.icon size={12} />
          <span className="truncate max-w-[100px]">{item.value}</span>
        </div>
      ))}
    </div>
  );
};
