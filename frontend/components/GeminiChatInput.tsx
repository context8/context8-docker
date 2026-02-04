import React, { useEffect, useState } from 'react';
import { ThemeMode } from '../types';

interface GeminiChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  theme: ThemeMode;
  resetToken?: number;
  deepSearchEnabled?: boolean;
  deepThinkingEnabled?: boolean;
  onToggleDeepSearch?: () => void;
  onToggleDeepThinking?: () => void;
  suggestions?: string[];
}

const defaultSuggestions = [
  'TypeError undefined',
  'Vite import error',
  'DB timeout',
  'CORS blocked',
];

export const GeminiChatInput: React.FC<GeminiChatInputProps> = ({
  onSend,
  disabled,
  theme,
  resetToken,
  deepSearchEnabled,
  deepThinkingEnabled,
  onToggleDeepSearch,
  onToggleDeepThinking,
  suggestions,
}) => {
  const [input, setInput] = useState('');
  const displaySuggestions = suggestions && suggestions.length > 0 ? suggestions : defaultSuggestions;

  useEffect(() => {
    setInput('');
  }, [resetToken]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const payload = input.trim();
    if (payload && !disabled) {
      onSend(payload);
      setInput('');
    }
  };

  const handleSuggestionClick = (text: string) => {
    if (!disabled) onSend(text);
  };

  const isDark = theme === 'dark';

  return (
    <div className="px-4 pb-8 max-w-4xl mx-auto w-full">
      <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {displaySuggestions.map((text, index) => (
          <button
            key={`${text}-${index}`}
            onClick={() => handleSuggestionClick(text)}
            className={`px-3 py-1.5 border rounded-full text-xs transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className={`relative border rounded-2xl p-4 shadow-sm transition-all duration-300 ${
          isDark
            ? 'bg-slate-950 border-slate-800 focus-within:border-slate-600'
            : 'bg-white border-slate-200 focus-within:border-slate-300'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={onToggleDeepSearch}
            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              deepSearchEnabled
                ? isDark
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDark
                  ? 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            Deep Search
          </button>
          <button
            type="button"
            onClick={onToggleDeepThinking}
            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              deepThinkingEnabled
                ? isDark
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : isDark
                  ? 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            Deep Thinking
          </button>
          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Toggle to widen retrieval or add deeper reasoning.
          </span>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the bug or paste the error message..."
          rows={2}
          name="demoChatMessage"
          id="demo-chat-message"
          className={`w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed transition-colors ${
            isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div
          className={`flex items-center justify-between mt-2 pt-2 border-t transition-colors ${
            isDark ? 'border-slate-800/60' : 'border-slate-200'
          }`}
        >
          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Enter to send • Shift+Enter for newline
          </div>
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              input.trim() && !disabled
                ? isDark
                  ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                : isDark
                  ? 'bg-slate-800 text-slate-600'
                  : 'bg-emerald-50 text-emerald-300'
            }`}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
