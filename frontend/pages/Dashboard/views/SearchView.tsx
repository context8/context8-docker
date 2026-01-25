import React, { useState } from 'react';
import { Search, FileX } from 'lucide-react';
import { Button } from '../../../components/Common/Button';
import { useSearch } from '../../../hooks/useSearch';
import { ThemeMode, SearchResult } from '../../../types';

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
  const authOptions = token || apiKey ? { token: token || undefined, apiKey: apiKey || undefined } : null;
  if (!authOptions) {
    return (
      <div className="space-y-6">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
          Search Solutions
        </h2>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
          Please sign in or provide an API key to search.
        </p>
      </div>
    );
  }
  const { results, total, isLoading, query, search, clearSearch } = useSearch(authOptions);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      search(searchInput.trim());
    }
  };

  const handleClear = () => {
    setSearchInput('');
    clearSearch();
  };

  const inputClass = `flex-1 px-4 py-2 rounded-l-md border ${
    theme === 'dark'
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-2 focus:ring-emerald-500`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
          Search Solutions
        </h2>
        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Search through your error solutions
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-0">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by error message, tags, or solution..."
          className={inputClass}
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading || !searchInput.trim()}
          className="rounded-l-none"
        >
          <Search size={18} />
          <span className="ml-2">Search</span>
        </Button>
        {query && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            className="ml-2"
          >
            Clear
          </Button>
        )}
      </form>

      {/* Search Results */}
      {query && (
        <div>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
            {isLoading ? (
              'Searching...'
            ) : (
              <>Found {total} result{total !== 1 ? 's' : ''} for "{query}"</>
            )}
          </p>

          {results.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <FileX size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                No results found
              </h3>
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
                Try a different search query
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} theme={theme} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!query && (
        <div className="text-center py-12">
          <Search size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
          <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Start searching
          </h3>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
            Enter a search query to find solutions
          </p>
        </div>
      )}
    </div>
  );
};

interface SearchResultCardProps {
  result: SearchResult;
  theme: ThemeMode;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, theme }) => {
  return (
    <div
      className={`p-4 rounded-lg border transition-shadow duration-300 ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-700 hover:shadow-lg'
          : 'bg-white border-gray-200 hover:shadow-lg'
      }`}
    >
      <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
        {result.title || 'Untitled'}
      </h3>
      {result.preview && (
        <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
          {result.preview}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {result.errorType && (
          <span className={`px-2 py-1 rounded ${
            theme === 'dark'
              ? 'bg-red-900 text-red-200'
              : 'bg-red-100 text-red-800'
          }`}>
            {result.errorType}
          </span>
        )}
        {result.tags && result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className={`px-2 py-1 rounded ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {tag}
              </span>
            ))}
            {result.tags.length > 3 && (
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>
                +{result.tags.length - 3}
              </span>
            )}
          </div>
        )}
        {result.createdAt && (
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>
            {new Date(result.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};
