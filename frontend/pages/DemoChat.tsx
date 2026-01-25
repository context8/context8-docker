import React, { useEffect, useMemo, useRef, useState } from 'react';
import { runOpenRouterAssistant, generateFollowUpSuggestions } from '../services/openrouterAssistant';
import { GeminiChatInput } from '../components/GeminiChatInput';
import { GeminiReasoningBlock } from '../components/GeminiReasoningBlock';
import { MarkdownRenderer } from '../components/Common/MarkdownRenderer';
import { ErrorTypeBadge } from '../components/Common/ErrorTypeBadge';
import { TagCloud } from '../components/Common/TagCloud';
import { Modal } from '../components/Common/Modal';
import { SearchResult, ThemeMode, View } from '../types';
import { AlertTriangle, Database, Terminal, ChevronDown } from 'lucide-react';
import { solutionsService } from '../services/api/solutions';

type SessionState = {
  session: { token: string; email: string } | null;
  apiKey: string | null;
};

type Props = {
  sessionState: SessionState;
  theme: ThemeMode;
  onViewChange: (view: View) => void;
  onToggleTheme: () => void;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  thoughtDuration?: number;
  hits?: SearchResult[];
  flags?: {
    deepSearch?: boolean;
    deepThinking?: boolean;
  };
};

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Describe your bug and I will search Context8 solutions before answering.',
  },
];

export const DemoChat: React.FC<Props> = ({ sessionState, theme, onViewChange, onToggleTheme }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(true);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<SearchResult | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const auth = useMemo(() => ({
    token: sessionState.session?.token,
    apiKey: sessionState.apiKey,
  }), [sessionState.session?.token, sessionState.apiKey]);

  const authLabel = useMemo(() => {
    if (auth.apiKey) return `X-API-Key ${auth.apiKey.slice(0, 6)}...`;
    if (auth.token) return 'Bearer (saved session)';
    return 'No auth detected';
  }, [auth.apiKey, auth.token]);

  useEffect(() => {
    if (autoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status, autoScroll]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance < 80;
      setAutoScroll(atBottom);
      setShowScrollToBottom(!atBottom);
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const updateMessage = (id: string, update: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...update } : msg)));
  };

  const buildHitPreview = (hit: SearchResult) => {
    if (hit.errorMessage) return hit.errorMessage;
    if (hit.preview) return hit.preview;
    return 'No preview available';
  };

  const handleOpenSolution = async (solutionId: string) => {
    setIsDetailLoading(true);
    setSelectedSolution({ id: solutionId } as SearchResult);
    try {
      const hasAuth = Boolean(auth.apiKey || auth.token);
      if (!hasAuth) {
        throw new Error('Please sign in or provide an API key to view solutions.');
      }
      const detail = await solutionsService.getEs(auth, solutionId);
      setSelectedSolution(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load solution details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSend = async (prompt: string) => {
    setError(null);
    setStatus('loading');
    if (!auth.apiKey && !auth.token) {
      setStatus('error');
      setError('Please sign in or provide an API key to use Demo Chat.');
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
    };

    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      thought: '',
      thoughtDuration: 0,
      flags: {
        deepSearch: deepSearchEnabled,
        deepThinking: deepThinkingEnabled,
      },
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    const startTime = Date.now();

    try {
      const requestPrompt = deepThinkingEnabled
        ? `${prompt}\n\nPlease provide a thorough diagnosis and fix plan with clear steps.`
        : prompt;

      const result = await runOpenRouterAssistant({
        prompt: requestPrompt,
        auth,
        limit: deepSearchEnabled ? 8 : 5,
      });
      const duration = (Date.now() - startTime) / 1000;
      const trace = result.toolTrace.length > 0
        ? result.toolTrace.join('\n')
        : 'No tool calls were made.';

      updateMessage(assistantId, {
        content: result.reply,
        thought: trace,
        thoughtDuration: Number(duration.toFixed(1)),
        hits: result.hits,
      });

      setStatus('idle');

      // Generate follow-up suggestions
      generateFollowUpSuggestions({
        userQuestion: prompt,
        aiResponse: result.reply,
        auth,
      }).then((newSuggestions) => {
        if (newSuggestions.length > 0) {
          setSuggestions(newSuggestions);
        }
      }).catch((err) => {
        console.error('Failed to generate suggestions:', err);
      });
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Assistant failed');
      updateMessage(assistantId, {
        content: 'I hit an error while contacting the assistant. Please try again.',
      });
    }
  };

  const resetChat = () => {
    setMessages(initialMessages);
    setError(null);
    setStatus('idle');
    setSuggestions([]);
    setResetToken((prev) => prev + 1);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`h-screen w-full flex flex-col ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
      <header className={`flex-shrink-0 h-14 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-md ${isDark ? 'bg-[#0a0a0a]/80 border-slate-800' : 'bg-white/80 border-emerald-100'}`}>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors shadow-sm ${isDark ? 'bg-slate-900 border border-slate-800 hover:border-emerald-500' : 'bg-white border border-emerald-100 hover:border-emerald-300'}`}
            onClick={() => onViewChange('home')}
          >
            <div className={`rounded-sm p-0.5 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
              <img src="/logo.png" alt="Context8 logo" className="h-4 w-4" />
            </div>
            <span className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Context8</span>
          </div>

          <div className={`hidden md:flex items-center gap-2 rounded-md px-3 py-1.5 text-sm border border-transparent ${isDark ? 'bg-slate-900/60' : 'bg-emerald-50/60'}`}>
            <span className={isDark ? 'text-slate-300' : 'text-emerald-700'}>Personal</span>
            <ChevronDown size={14} className={isDark ? 'text-slate-500' : 'text-emerald-300'} />
            <button
              className={`ml-2 transition-colors ${isDark ? 'text-slate-400 hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-600'}`}
              onClick={() => onViewChange('dashboard')}
            >
              Dashboard
            </button>
            <span className={`ml-2 ${isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-medium'}`}>
              Demo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-colors border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
            title="Toggle Theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9l-.707.707M12 21v-1m0-5a3 3 0 110-6 3 3 0 010 6z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={resetChat}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors border font-medium ${isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}
          >
            New Chat
          </button>
        </div>
      </header>

      <div className={`flex-shrink-0 border-b ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50/50'} px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs`}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-500" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>LLM tool-driven triage</span>
        </div>
        <div className="flex items-center gap-2">
          <Database size={14} className="text-emerald-500" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Search auth: {authLabel}</span>
        </div>
        {!auth.apiKey && !auth.token && (
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle size={14} /> Login or set API key for private results.
          </div>
        )}
      </div>

      <main
        ref={chatScrollRef}
        className={`flex-1 relative overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-white'}`}
      >
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex flex-col items-center">
                  <div className={`h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-600'}`}>
                    C8
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3 max-w-[85%] w-full">
                <div
                  className={`rounded-2xl border px-4 py-3 shadow-sm transition-all ${
                    msg.role === 'user'
                      ? isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-900'
                      : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-100'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                    {msg.flags?.deepSearch && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                        Deep Search
                      </span>
                    )}
                    {msg.flags?.deepThinking && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                        Deep Thinking
                      </span>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.thought && (
                    <div className="mt-3">
                      <GeminiReasoningBlock
                        title="Retrieval steps"
                        detail={msg.thought}
                        duration={msg.thoughtDuration}
                        theme={theme}
                      />
                    </div>
                  )}

                  <div className="mt-3 text-sm md:text-base leading-relaxed">
                    {msg.content ? (
                      msg.role === 'assistant' ? (
                        <MarkdownRenderer content={msg.content} theme={theme} />
                      ) : (
                        <span className={`whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {msg.content}
                        </span>
                      )
                    ) : (
                      status === 'loading' && msg.role === 'assistant' ? (
                        <span className="animate-pulse">...</span>
                      ) : null
                    )}
                  </div>
                </div>

                {msg.role === 'assistant' && msg.hits && msg.hits.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                      <span>Matches</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                        {msg.hits.length} found
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {msg.hits.slice(0, 5).map((hit) => (
                        <div
                          key={hit.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isDark
                              ? 'bg-slate-950 border-slate-800 hover:border-emerald-500/40'
                              : 'bg-white border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <ErrorTypeBadge type={hit.errorType} size="sm" theme={theme} />
                                <span className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                  {hit.title || 'Untitled Solution'}
                                </span>
                              </div>
                              <p className={`mt-2 text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {buildHitPreview(hit)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenSolution(hit.id)}
                              className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                                isDark
                                  ? 'border-slate-700 text-slate-200 hover:border-emerald-400 hover:text-emerald-300'
                                  : 'border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-600'
                              }`}
                            >
                              Open
                            </button>
                          </div>
                          {hit.tags && hit.tags.length > 0 && (
                            <div className="mt-2">
                              <TagCloud tags={hit.tags} maxVisible={4} size="sm" theme={theme} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex flex-col items-center">
                  <div className={`h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-600'}`}>
                    You
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} className="h-4" />
        </div>
        {showScrollToBottom && (
          <button
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className={`sticky bottom-6 ml-auto mr-6 flex items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-md ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Jump to latest
          </button>
        )}
      </main>

      <div className={`flex-shrink-0 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <GeminiChatInput
          onSend={handleSend}
          disabled={status === 'loading'}
          theme={theme}
          resetToken={resetToken}
          deepSearchEnabled={deepSearchEnabled}
          deepThinkingEnabled={deepThinkingEnabled}
          onToggleDeepSearch={() => setDeepSearchEnabled((prev) => !prev)}
          onToggleDeepThinking={() => setDeepThinkingEnabled((prev) => !prev)}
          suggestions={suggestions}
        />
        {error && (
          <div className="max-w-4xl mx-auto px-6 pb-4">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedSolution}
        onClose={() => setSelectedSolution(null)}
        title={selectedSolution?.title || 'Solution Details'}
        size="xl"
      >
        {selectedSolution && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ErrorTypeBadge type={selectedSolution.errorType} size="md" theme={theme} />
              {selectedSolution.tags && selectedSolution.tags.length > 0 && (
                <TagCloud tags={selectedSolution.tags} maxVisible={5} size="sm" theme={theme} />
              )}
            </div>

            {isDetailLoading && (
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Loading full details...
              </div>
            )}

            <div>
              <h4 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Error Message
              </h4>
              <div className={`p-3 rounded-lg font-mono text-sm ${isDark ? 'bg-slate-800 text-red-300' : 'bg-red-50 text-red-700'}`}>
                {selectedSolution.errorMessage || 'No error message'}
              </div>
            </div>

            {selectedSolution.context && (
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Context
                </h4>
                <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  {selectedSolution.context}
                </p>
              </div>
            )}

            {selectedSolution.rootCause && (
              <div>
                <h4 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Root Cause
                </h4>
                <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  {selectedSolution.rootCause}
                </p>
              </div>
            )}

            <div>
              <h4 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                Solution
              </h4>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-emerald-50/50'}`}>
                <MarkdownRenderer
                  content={selectedSolution.solution || 'No solution provided'}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <footer className={`flex-shrink-0 border-t px-4 sm:px-6 py-3 ${isDark ? 'border-slate-800 bg-[#0a0a0a]' : 'border-emerald-100 bg-white'}`}>
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          <span>© 2025, Context8 local knowledge</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onViewChange('home')}
              className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}
            >
              Home
            </button>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}
            >
              Dashboard
            </button>
            <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>About</a>
            <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
