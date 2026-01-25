import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { DashboardContainer } from './pages/Dashboard/DashboardContainer';
import { Login } from './pages/Login';
import { DemoChat } from './pages/DemoChat';
import { ThemeMode, View } from './types';
import { setUnauthorizedHandler } from './services/api/client';

type Session = {
  token: string;
  email: string;
};

const STORAGE_KEYS = {
  token: 'ctx8_token',
  email: 'ctx8_email',
  apiKey: 'ctx8_apikey',
  theme: 'ctx8_theme',
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const email = localStorage.getItem(STORAGE_KEYS.email);
    const storedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const storedTheme = localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode | null;
    if (token && email) {
      setSession({ token, email });
    }
    if (storedKey) {
      setApiKey(storedKey);
    }
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.email);
      localStorage.removeItem(STORAGE_KEYS.apiKey);
      setSession(null);
      setApiKey(null);
      setCurrentView('login');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.email);
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    setSession(null);
    setApiKey(null);
    setCurrentView('home');
  };

  const handleLoginSuccess = (token: string, user: { id: string; email: string }) => {
    setSession({ token, email: user.email });
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.email, user.email);
    setCurrentView('dashboard');
  };

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEYS.theme, next);
      return next;
    });
  };

  const sessionValue = useMemo(
    () => ({ session, setSession, apiKey, setApiKey }),
    [session, apiKey]
  );

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      user={session ? { email: session.email } : undefined}
      onLogout={session ? handleLogout : undefined}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      hideChrome={currentView === 'demo'}
    >
      {currentView === 'home' && <Home onViewChange={setCurrentView} theme={theme} />}
      {currentView === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {currentView === 'dashboard' && (
        <DashboardContainer sessionState={sessionValue} theme={theme} />
      )}
      {currentView === 'demo' && <DemoChat sessionState={sessionValue} theme={theme} onViewChange={setCurrentView} onToggleTheme={handleToggleTheme} />}
    </Layout>
  );
};

export default App;
