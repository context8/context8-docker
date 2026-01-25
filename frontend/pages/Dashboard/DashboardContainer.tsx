import { useEffect, useState } from 'react';
import { Key, FileText, Search } from 'lucide-react';
import { ApiKeysView } from '@/pages/Dashboard/views/ApiKeysView';
import { SolutionsView } from '@/pages/Dashboard/views/SolutionsView';
import { SearchView } from '@/pages/Dashboard/views/SearchView';
import type { ThemeMode } from '@/types';

export type DashboardView = 'apikeys' | 'solutions' | 'search';

export interface SessionState {
  session: { token: string; email: string } | null;
  setSession: (session: { token: string; email: string } | null) => void;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
}

export interface DashboardContainerProps {
  sessionState: SessionState;
  theme: ThemeMode;
}

export const DashboardContainer: React.FC<DashboardContainerProps> = ({
  sessionState,
  theme,
}) => {
  const [currentView, setCurrentView] = useState<DashboardView>('solutions');
  const { session, apiKey } = sessionState;

  const token = session?.token || null;
  const solutionIdFromUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('solutionId')
    : null;

  useEffect(() => {
    if (solutionIdFromUrl) {
      setCurrentView('solutions');
    }
  }, [solutionIdFromUrl]);

  const tabs: Array<{ id: DashboardView; label: string; icon: React.ReactNode }> = [
    { id: 'apikeys', label: 'API Keys', icon: <Key size={18} /> },
    { id: 'solutions', label: 'Solutions', icon: <FileText size={18} /> },
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
  ];

  const tabButtonClass = (isActive: boolean) => `
    flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200
    ${isActive
      ? theme === 'dark'
        ? 'text-emerald-400 border-b-2 border-emerald-400'
        : 'text-emerald-600 border-b-2 border-emerald-600'
      : theme === 'dark'
        ? 'text-slate-400 hover:text-slate-200'
        : 'text-gray-600 hover:text-gray-900'
    }
  `;

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className={`border-b mb-6 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={tabButtonClass(currentView === tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* View Content */}
        <div>
          {currentView === 'apikeys' && (
            <ApiKeysView
              token={token}
              theme={theme}
            />
          )}
          {currentView === 'solutions' && (
            <SolutionsView
              token={token}
              apiKey={apiKey}
              theme={theme}
            />
          )}
          {currentView === 'search' && (
            <SearchView
              token={token}
              apiKey={apiKey}
              theme={theme}
            />
          )}
        </div>
      </div>
    </div>
  );
};
