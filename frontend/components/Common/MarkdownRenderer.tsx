import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  theme: 'light' | 'dark';
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, theme }) => {
  const isDark = theme === 'dark';

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className={`text-2xl font-bold mt-4 mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={`text-xl font-bold mt-4 mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={`text-lg font-semibold mt-3 mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className={`mb-3 leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="ml-2">{children}</li>
        ),
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                isDark ? 'bg-slate-800 text-emerald-300' : 'bg-slate-100 text-emerald-700'
              }`}>
                {children}
              </code>
            );
          }
          return (
            <code className={`block p-3 rounded-lg text-sm font-mono overflow-x-auto ${
              isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
            }`}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className={`mb-3 rounded-lg overflow-hidden ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className={`border-l-4 pl-4 my-3 italic ${
            isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-600'
          }`}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className={`min-w-full border-collapse ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className={`border px-3 py-2 text-left font-semibold ${
            isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100'
          }`}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className={`border px-3 py-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            {children}
          </td>
        ),
        hr: () => (
          <hr className={`my-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
