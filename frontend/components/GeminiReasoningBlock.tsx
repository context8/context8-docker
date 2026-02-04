import React, { useState } from 'react';
import { ThemeMode } from '../types';

interface GeminiReasoningBlockProps {
  title: string;
  detail: string;
  duration?: number;
  theme: ThemeMode;
}

export const GeminiReasoningBlock: React.FC<GeminiReasoningBlockProps> = ({
  title,
  detail,
  duration,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!detail) return null;

  const isDark = theme === 'dark';

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-xs transition-colors group ${
          isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9l-.707.707M12 21v-1m0-5a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
          <span className="font-medium tracking-tight">{title} {typeof duration === 'number' ? `(${duration.toFixed(1)}s)` : ''}</span>
        </div>
      </button>

      {isOpen && (
        <div
          className={`mt-2 ml-5 pl-4 border-l text-xs leading-relaxed whitespace-pre-wrap font-light transition-colors ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-emerald-100 text-slate-500'
          }`}
        >
          {detail}
        </div>
      )}
    </div>
  );
};
