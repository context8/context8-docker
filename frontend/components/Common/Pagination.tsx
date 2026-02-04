import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ThemeMode } from '@/types';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  theme: ThemeMode;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  theme,
}) => {
  const isDark = theme === 'dark';
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const buttonClass = (disabled: boolean) => `
    p-2 rounded-lg transition-colors
    ${disabled
      ? isDark
        ? 'text-slate-700 cursor-not-allowed'
        : 'text-slate-300 cursor-not-allowed'
      : isDark
        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }
  `;

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page <= 3) {
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push('ellipsis');
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (total === 0) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
      <div className="text-sm">
        Showing <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{startItem}</span> to{' '}
        <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{endItem}</span> of{' '}
        <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>{total.toLocaleString()}</span> solutions
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={`
              px-2 py-1.5 rounded-lg text-sm border transition-colors
              ${isDark
                ? 'bg-slate-900 border-slate-700 text-slate-300 focus:border-emerald-500'
                : 'bg-white border-slate-200 text-slate-700 focus:border-emerald-400'
              }
              focus:outline-none focus:ring-2 focus:ring-emerald-500/20
            `}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev}
            className={buttonClass(!canGoPrev)}
            title="First page"
          >
            <ChevronsLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrev}
            className={buttonClass(!canGoPrev)}
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2">...</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`
                    min-w-[32px] h-8 px-2 rounded-lg text-sm transition-colors
                    ${p === page
                      ? isDark
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500 text-white'
                      : isDark
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
            className={buttonClass(!canGoNext)}
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
            className={buttonClass(!canGoNext)}
            title="Last page"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
