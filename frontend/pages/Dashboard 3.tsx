import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../constants';
import { Copy, Plus, Search, FileText, Mail, KeyRound, Loader2, RefreshCcw } from 'lucide-react';
import { ApiKey, SearchResult, Solution, SolutionInput } from '../types';

type SessionState = {
  session: { token: string; email: string } | null;
  setSession: (s: { token: string; email: string }) => void;
  apiKey: string | null;
  setApiKey: (k: string | null) => void;
};

type Props = {
  sessionState: SessionState;
};

type Status = { kind: 'idle' | 'ok' | 'error' | 'loading'; message?: string };

const authHeaders = (token?: string | null, apiKey?: string | null) => {
  if (apiKey) return { 'X-API-Key': apiKey };
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
};

export const Dashboard: React.FC<Props> = ({ sessionState }) => {
  const { session, setSession, apiKey, setApiKey } = sessionState;
  const [email, setEmail] = useState(session?.email ?? '');
  const [code, setCode] = useState('');
  const [sendStatus, setSendStatus] = useState<Status>({ kind: 'idle' });
  const [verifyStatus, setVerifyStatus] = useState<Status>({ kind: 'idle' });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyName, setApiKeyName] = useState('default');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [solutionInput, setSolutionInput] = useState<SolutionInput>({
    title: '',
    errorMessage: '',
    errorType: 'runtime',
    context: '',
    rootCause: '',
    solution: '',
    tags: '',
  });
  const [solutionStatus, setSolutionStatus] = useState<Status>({ kind: 'idle' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<Status>({ kind: 'idle' });

  const token = session?.token;

  useEffect(() => {
    if (session?.token) {
      void fetchApiKeys();
      void fetchSolutions();
    }
  }, [session?.token]);

  const fetchApiKeys = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/apikeys`, {
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiKeys(data || []);
    } catch (e: any) {
      console.error('list apikeys', e);
    }
  };

  const fetchSolutions = async () => {
    if (!token && !apiKey) return;
    try {
      const res = await fetch(`${API_BASE}/solutions?limit=50`, {
        headers: { ...authHeaders(token, apiKey) },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSolutions(data || []);
    } catch (e) {
      console.error('list solutions', e);
    }
  };

  const sendCode = async () => {
    if (!email) return;
    setSendStatus({ kind: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/auth/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSendStatus({ kind: 'ok', message: 'Verification code sent' });
    } catch (e: any) {
      setSendStatus({ kind: 'error', message: e?.message || 'Failed to send' });
    }
  };

  const verifyCode = async () => {
    if (!email || !code) return;
    setVerifyStatus({ kind: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/auth/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSession({ token: data.token, email: data.user.email });
      localStorage.setItem('ctx8_token', data.token);
      localStorage.setItem('ctx8_email', data.user.email);
      setVerifyStatus({ kind: 'ok', message: 'Login successful' });
      setCode('');
      void fetchApiKeys();
      void fetchSolutions();
    } catch (e: any) {
      setVerifyStatus({ kind: 'error', message: e?.message || 'Verification failed' });
    }
  };

  const createApiKey = async () => {
    if (!token) return;
    setVerifyStatus({ kind: 'loading', message: 'Creating API Key...' });
    try {
      const res = await fetch(`${API_BASE}/apikeys?name=${encodeURIComponent(apiKeyName || 'default')}`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiKey(data.apiKey);
      localStorage.setItem('ctx8_apikey', data.apiKey);
      setVerifyStatus({ kind: 'ok', message: 'API Key created' });
      await fetchApiKeys();
    } catch (e: any) {
      setVerifyStatus({ kind: 'error', message: e?.message || 'Failed to create' });
    }
  };

  const saveSolution = async () => {
    if (!token && !apiKey) {
      setSolutionStatus({ kind: 'error', message: 'Please login or set API Key first' });
      return;
    }
    if (!solutionInput.title || !solutionInput.errorMessage || !solutionInput.context || !solutionInput.rootCause || !solutionInput.solution) {
      setSolutionStatus({ kind: 'error', message: 'Please fill in required fields' });
      return;
    }
    setSolutionStatus({ kind: 'loading' });
    try {
      const payload = {
        title: solutionInput.title,
        errorMessage: solutionInput.errorMessage,
        errorType: solutionInput.errorType || 'runtime',
        context: solutionInput.context,
        rootCause: solutionInput.rootCause,
        solution: solutionInput.solution,
        tags: solutionInput.tags ? solutionInput.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const res = await fetch(`${API_BASE}/solutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, apiKey) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setSolutionStatus({ kind: 'ok', message: 'Saved' });
      setSolutionInput({ title: '', errorMessage: '', errorType: 'runtime', context: '', rootCause: '', solution: '', tags: '' });
      await fetchSolutions();
    } catch (e: any) {
      setSolutionStatus({ kind: 'error', message: e?.message || 'Save failed' });
    }
  };

  const runSearch = async () => {
    if (!token && !apiKey) {
      setSearchStatus({ kind: 'error', message: 'Please login or set API Key first' });
      return;
    }
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    setSearchStatus({ kind: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, apiKey) },
        body: JSON.stringify({ query: searchQuery, limit: 10, offset: 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchStatus({ kind: 'ok', message: `${data.total} results` });
    } catch (e: any) {
      setSearchStatus({ kind: 'error', message: e?.message || 'Search failed' });
    }
  };

  const currentAuth = useMemo(() => {
    if (apiKey) return `X-API-Key ${apiKey.slice(0, 8)}...`;
    if (token) return 'Bearer (JWT saved)';
    return 'Not logged in';
  }, [apiKey, token]);

  return (
    <div className="w-full flex flex-col gap-8">
      {/* API Base */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Base</div>
          <div className="text-gray-900 font-mono text-sm mt-1">{API_BASE}</div>
          <div className="text-xs text-gray-500 mt-1">Auth: {currentAuth}</div>
        </div>
        <button className="text-gray-400 hover:text-emerald-600" onClick={() => navigator.clipboard.writeText(API_BASE)}>
          <Copy size={16} />
        </button>
      </div>

      {/* Auth section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Email Verification Login</h2>
          </div>
          <div className="space-y-3">
            <label className="text-sm text-gray-700 font-medium">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" placeholder="you@example.com" />
            <button
              onClick={sendCode}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
            >
              {sendStatus.kind === 'loading' && <Loader2 className="animate-spin" size={14} />}
              Send Code
            </button>
            {sendStatus.message && <p className={`text-sm ${sendStatus.kind === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{sendStatus.message}</p>}
          </div>
          <div className="space-y-3">
            <label className="text-sm text-gray-700 font-medium">Verification Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" placeholder="6 digits" />
            <button
              onClick={verifyCode}
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
            >
              {verifyStatus.kind === 'loading' && <Loader2 className="animate-spin" size={14} />}
              Verify and Login
            </button>
            {verifyStatus.message && <p className={`text-sm ${verifyStatus.kind === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{verifyStatus.message}</p>}
            {token && (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 mt-2">
                JWT saved. Include `Authorization: Bearer ...` on requests.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={apiKeyName}
              onChange={e => setApiKeyName(e.target.value)}
              className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
              placeholder="key name"
              disabled={!token}
            />
            <button
              onClick={createApiKey}
              disabled={!token}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus size={14} />
              Create
            </button>
            <button
              onClick={fetchApiKeys}
              disabled={!token}
              className="text-gray-500 hover:text-gray-800 px-3 py-2 rounded-md text-sm inline-flex items-center gap-1 border border-gray-200"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {apiKeys.length === 0 && <p className="text-sm text-gray-500">No API keys yet</p>}
            {apiKeys.map(key => (
              <div key={key.id} className="border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800">{key.name}</div>
                  <div className="text-xs text-gray-500">{key.createdAt || 'created'}</div>
                </div>
                <span className="text-xs text-gray-500">Not recoverable</span>
              </div>
            ))}
            {apiKey && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md p-2 flex items-center justify-between gap-3">
                <span>Current X-API-Key: {apiKey.slice(0, 8)}...</span>
                <button
                  className="text-emerald-700 hover:text-emerald-900"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                  }}
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
            {!apiKey && (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-md p-2">
                Stored keys cannot be recovered after creation.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Solutions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Save Solution</h2>
          </div>
          <button
            className="text-gray-500 hover:text-gray-800 text-sm inline-flex items-center gap-1"
            onClick={fetchSolutions}
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="Title"
            value={solutionInput.title}
            onChange={e => setSolutionInput(prev => ({ ...prev, title: e.target.value }))}
          />
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="Error type (runtime/build/...)"
            value={solutionInput.errorType}
            onChange={e => setSolutionInput(prev => ({ ...prev, errorType: e.target.value }))}
          />
          <textarea
            className="border border-gray-200 rounded-md px-3 py-2 text-sm md:col-span-2"
            rows={2}
            placeholder="Error message"
            value={solutionInput.errorMessage}
            onChange={e => setSolutionInput(prev => ({ ...prev, errorMessage: e.target.value }))}
          />
          <textarea
            className="border border-gray-200 rounded-md px-3 py-2 text-sm md:col-span-2"
            rows={2}
            placeholder="Context"
            value={solutionInput.context}
            onChange={e => setSolutionInput(prev => ({ ...prev, context: e.target.value }))}
          />
          <textarea
            className="border border-gray-200 rounded-md px-3 py-2 text-sm md:col-span-2"
            rows={2}
            placeholder="Root cause"
            value={solutionInput.rootCause}
            onChange={e => setSolutionInput(prev => ({ ...prev, rootCause: e.target.value }))}
          />
          <textarea
            className="border border-gray-200 rounded-md px-3 py-2 text-sm md:col-span-2"
            rows={3}
            placeholder="Solution"
            value={solutionInput.solution}
            onChange={e => setSolutionInput(prev => ({ ...prev, solution: e.target.value }))}
          />
          <input
            className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="Tags (comma separated)"
            value={solutionInput.tags}
            onChange={e => setSolutionInput(prev => ({ ...prev, tags: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={saveSolution}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
            >
              {solutionStatus.kind === 'loading' && <Loader2 className="animate-spin" size={14} />}
              Save
            </button>
            {solutionStatus.message && <span className={`text-sm ${solutionStatus.kind === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{solutionStatus.message}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {solutions.length === 0 && <p className="text-sm text-gray-500">No data yet. Create one first.</p>}
          {solutions.map(sol => (
            <div key={sol.id} className="border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{sol.title}</h3>
                <span className="text-xs text-gray-500">{new Date(sol.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{sol.errorType}</div>
              <div className="text-sm text-gray-700 mt-2 line-clamp-3">{sol.errorMessage}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {sol.tags?.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Search My Solutions</h2>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
            placeholder="Enter keywords"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button
            onClick={runSearch}
            className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
          >
            {searchStatus.kind === 'loading' && <Loader2 className="animate-spin" size={14} />}
            Search
          </button>
          {searchStatus.message && <span className={`text-sm ${searchStatus.kind === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{searchStatus.message}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.map(r => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{r.title}</h3>
                <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{r.errorType}</div>
              <p className="text-sm text-gray-700 mt-2">{r.preview}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {r.tags?.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {searchResults.length === 0 && searchStatus.kind !== 'loading' && (
            <p className="text-sm text-gray-500">No results</p>
          )}
        </div>
      </div>
    </div>
  );
};
