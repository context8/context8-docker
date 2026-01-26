import React from 'react';
import { ThemeMode, View } from '../types';
import { ShieldCheck, Users, Key } from 'lucide-react';

type Props = {
  onViewChange?: (view: View) => void;
  theme: ThemeMode;
};

export const Home: React.FC<Props> = ({ onViewChange, theme }) => {
  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col items-start gap-8 w-full ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
      <div className="w-full pt-8 pb-4">
        <h1 className={`text-3xl md:text-4xl font-bold mb-3 tracking-tight ${isDark ? 'text-slate-100' : 'text-emerald-900'}`}>
          Context8 Internal Knowledge Base
        </h1>
        <p className={`text-lg max-w-2xl ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          Private + team-only error solutions for your deployment. No public access. First visit sets the admin account.
        </p>
      </div>

      <div className="w-full flex flex-wrap gap-3">
        <button
          onClick={() => onViewChange?.('login')}
          className={`px-6 py-3 rounded-lg font-medium shadow-sm transition-colors ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
        >
          Sign in
        </button>
        <button
          onClick={() => onViewChange?.('dashboard')}
          className={`border px-6 py-3 rounded-lg font-medium shadow-sm transition-colors ${isDark ? 'border-slate-700 text-emerald-300 hover:bg-slate-900' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
        >
          Go to Dashboard
        </button>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className="font-semibold">Private by default</span>
          </div>
          <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>
            Solutions are private unless explicitly shared with your team.
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className="font-semibold">Team visibility</span>
          </div>
          <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>
            Mark solutions as team to make them available to all authenticated users and API keys.
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Key size={18} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className="font-semibold">API Key access</span>
          </div>
          <p className={isDark ? 'text-slate-400' : 'text-gray-600'}>
            Use API keys for automation and integration while keeping data private.
          </p>
        </div>
      </div>
    </div>
  );
};
