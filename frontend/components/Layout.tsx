import React, { useState } from 'react';
import { 
  ChevronDown, 
  Plus, 
  Bug, 
  X as XIcon, // Renamed to avoid confusion if needed, but lucide exports X for close icon usually. Using basic svg for Twitter X.
  ExternalLink,
  Github
} from 'lucide-react';
import { ThemeMode, View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
  user?: any;
  onLogout?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  hideChrome?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onViewChange,
  user,
  onLogout,
  theme,
  onToggleTheme,
  hideChrome,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isDark ? 'bg-[#0a0a0a] text-slate-200' : 'bg-white text-slate-900'}`}>
      {!hideChrome && (
        <header className={`sticky top-0 z-50 w-full backdrop-blur-md border-b px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between ${isDark ? 'bg-[#0a0a0a]/80 border-slate-800' : 'bg-white/80 border-emerald-100'}`}>
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

            <div className={`hidden md:flex items-center gap-2 rounded-md px-3 py-1.5 text-sm border border-transparent cursor-pointer transition-colors ${isDark ? 'bg-slate-900/60 hover:border-slate-700' : 'bg-emerald-50/60 hover:border-emerald-100'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-emerald-700'}>Personal</span>
              <ChevronDown size={14} className={isDark ? 'text-slate-500' : 'text-emerald-300'} />
              <span 
                className={`ml-2 transition-colors ${currentView === 'dashboard' ? (isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-medium') : (isDark ? 'text-slate-400 hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-600')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewChange('dashboard');
                }}
              >
                Dashboard
              </span>
              <span 
                className={`ml-2 transition-colors ${currentView === 'demo' ? (isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-medium') : (isDark ? 'text-slate-400 hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-600')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewChange('demo');
                }}
              >
                Demo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <nav className={`hidden md:flex items-center gap-6 font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <a href="#" className={`transition-colors decoration-emerald-500/30 hover:underline underline-offset-4 ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Plans</a>
              <a href="#" className={`transition-colors decoration-emerald-500/30 hover:underline underline-offset-4 ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Learn</a>
              <button
                type="button"
                onClick={() => onViewChange('demo')}
                className={`transition-colors decoration-emerald-500/30 hover:underline underline-offset-4 ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}
              >
                Try Live
              </button>
              <a href="#" className={`transition-colors decoration-emerald-500/30 hover:underline underline-offset-4 ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Install</a>
            </nav>
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
            {user ? (
              <div className="flex items-center gap-3">
                <span className={`text-sm truncate max-w-[150px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {user.name || user.email || "Signed in"}
                </span>
                <button
                  className={`border px-3 py-1.5 rounded-md text-sm transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-emerald-100 text-slate-700 hover:bg-emerald-50'}`}
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors shadow-sm ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'}`}
                onClick={() => onViewChange('login')}
              >
                <Plus size={16} />
                Sign In
              </button>
            )}
          </div>
        </header>
      )}

      <main className={hideChrome ? 'flex-1 w-full' : 'flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        {children}
      </main>

      {!hideChrome && (
        <>
          <footer className={`w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-auto border-t ${isDark ? 'border-slate-900' : 'border-emerald-100'}`}>
            <div className={`flex flex-col md:flex-row items-center justify-between gap-4 text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <div className="flex items-center gap-2">
                <span>© 2025, Context8 local knowledge</span>
              </div>
              
              <div className="flex items-center gap-6">
                <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>About</a>
                <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Contact</a>
                <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Legal</a>
                <a href="#" className={`transition-colors ${isDark ? 'hover:text-emerald-300' : 'hover:text-emerald-600'}`}>Follow on X</a>
              </div>
            </div>
          </footer>

          <button className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-transform hover:-translate-y-1 z-50 ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
            <Bug size={16} />
            Report Issue
          </button>
        </>
      )}
    </div>
  );
};
