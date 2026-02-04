import React, { useEffect, useState } from 'react';
import { Cloud, Database, Search, FileX, Plug } from 'lucide-react';
import { Button } from '../../../components/Common/Button';
import { SegmentedControl } from '../../../components/Common/SegmentedControl';
import { useSearch } from '../../../hooks/useSearch';
import { ThemeMode, SearchResult, SearchSource } from '../../../types';

export interface SearchViewProps {
  token?: string | null;
  apiKey?: string | null;
  theme: ThemeMode;
}

export const SearchView: React.FC<SearchViewProps> = ({
  token,
  apiKey,
  theme,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [source, setSource] = useState<SearchSource>('local');
  const [remoteBase, setRemoteBase] = useState('');
  const [remoteApiKey, setRemoteApiKey] = useState('');
  const authOptions = token || apiKey ? { token: token || undefined, apiKey: apiKey || undefined } : null;
  if (!authOptions) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Search</h2>
        <p className="text-sm text-foreground-light">Please sign in or provide an API key to search.</p>
      </div>
    );
  }
  const { results, total, isLoading, query, search, clearSearch } = useSearch(authOptions);
  const remoteReady = source === 'local' || (remoteBase.trim() && remoteApiKey.trim());
  const remoteActive = source === 'remote' || source === 'all';
  const remoteBaseValue = remoteBase.trim();

  useEffect(() => {
    const storedSource = (localStorage.getItem('ctx8_search_source') as SearchSource | null) ?? 'local';
    const storedBase = localStorage.getItem('ctx8_remote_base') ?? '';
    const storedKey = localStorage.getItem('ctx8_remote_key') ?? '';
    setSource(storedSource);
    setRemoteBase(storedBase);
    setRemoteApiKey(storedKey);
  }, []);

  useEffect(() => {
    localStorage.setItem('ctx8_search_source', source);
  }, [source]);

  useEffect(() => {
    localStorage.setItem('ctx8_remote_base', remoteBase);
  }, [remoteBase]);

  useEffect(() => {
    localStorage.setItem('ctx8_remote_key', remoteApiKey);
  }, [remoteApiKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      search(searchInput.trim(), {
        source,
        remoteBase: remoteBaseValue || undefined,
        remoteApiKey: remoteApiKey.trim() || undefined,
      });
    }
  };

  const handleClear = () => {
    setSearchInput('');
    clearSearch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Search</h2>
        <p className="mt-1 text-sm text-foreground-light">
          Find solutions across local and remote Context8 stores.
        </p>
      </div>

      <div className="p-4 rounded-xl border border-default bg-surface">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Search source</div>
              <div className="text-xs text-foreground-light">
                Local requires your admin/API key; remote uses the configured key.
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground-light">
              <Plug size={14} />
              <span>Local auth required</span>
            </div>
          </div>
          <SegmentedControl
            theme={theme}
            value={source}
            onChange={(val) => setSource(val as SearchSource)}
            options={[
              { value: 'local', label: 'Local', icon: Database },
              { value: 'remote', label: 'Remote', icon: Cloud },
              { value: 'all', label: 'All', icon: Search },
            ]}
          />

          {remoteActive && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">
                  Remote base URL
                </label>
                <input
                  type="text"
                  value={remoteBase}
                  onChange={(e) => setRemoteBase(e.target.value)}
                  placeholder="https://api.context8.org"
                  className="dash-input h-10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-foreground-light">
                  Remote API key
                </label>
                <input
                  type="password"
                  value={remoteApiKey}
                  onChange={(e) => setRemoteApiKey(e.target.value)}
                  placeholder="ctx8_..."
                  className="dash-input h-10"
                />
              </div>
            </div>
          )}
          {!remoteReady && remoteActive && (
            <div className="text-xs text-amber-600">
              Remote source selected. Please set both the remote base URL and API key.
            </div>
          )}
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-0">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by error message, tags, or solution..."
          className="dash-input h-10 flex-1 rounded-r-none px-4"
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading || !searchInput.trim() || !remoteReady}
          className="rounded-l-none rounded-r-full h-10 px-4"
        >
          <Search size={18} />
          <span className="ml-2">Search</span>
        </Button>
        {query && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            className="ml-2 h-10 px-4"
          >
            Clear
          </Button>
        )}
      </form>

      {/* Search Results */}
      {query && (
        <div>
          <p className="text-sm mb-4 text-foreground-light">
            {isLoading ? (
              'Searching...'
            ) : (
              <>Found {total} result{total !== 1 ? 's' : ''} for "{query}"</>
            )}
          </p>

          {results.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-default bg-surface py-12 text-center">
              <FileX size={48} className="mx-auto mb-4 text-foreground-light" />
              <h3 className="text-lg font-medium mb-2 text-foreground">No results found</h3>
              <p className="text-foreground-light">Try a different search query.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!query && (
        <div className="rounded-xl border border-default bg-surface py-12 text-center">
          <Search size={48} className="mx-auto mb-4 text-foreground-light" />
          <h3 className="text-lg font-medium mb-2 text-foreground">Start searching</h3>
          <p className="text-foreground-light">Enter a search query to find solutions.</p>
        </div>
      )}
    </div>
  );
};

interface SearchResultCardProps {
  result: SearchResult;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result }) => {
  return (
    <div
      className="p-4 rounded-lg border border-default bg-surface transition-colors hover:bg-[hsl(var(--dash-fg)/0.02)]"
    >
      <h3 className="font-semibold mb-2 text-foreground">{result.title || 'Untitled'}</h3>
      {result.preview && (
        <p className="text-sm mb-3 text-foreground-light">{result.preview}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {result.source && (
          <span className={`px-2 py-1 rounded border border-default ${
            result.source === 'remote'
              ? 'bg-sky-50 text-sky-700'
              : 'bg-alternative text-foreground-light'
          }`}>
            {result.source}
          </span>
        )}
        {result.errorType && (
          <span className="px-2 py-1 rounded border border-default bg-alternative text-foreground-light">
            {result.errorType}
          </span>
        )}
        {result.tags && result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded border border-default bg-alternative text-foreground-light"
              >
                {tag}
              </span>
            ))}
            {result.tags.length > 3 && (
              <span className="text-foreground-light">
                +{result.tags.length - 3}
              </span>
            )}
          </div>
        )}
        {result.createdAt && (
          <span className="text-foreground-light">
            {new Date(result.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};
