import { useState, useCallback } from 'react';
import { solutionsService } from '../services/api/solutions';
import { SearchResult } from '../types';
import { AuthOptions } from '../services/api/client';

export function useSearch(auth: AuthOptions) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setQuery('');
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuery(searchQuery);

    try {
      const data = await solutionsService.search(searchQuery, auth);
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setQuery('');
    setError(null);
    setTotal(0);
  }, []);

  return {
    results,
    total,
    isLoading,
    error,
    query,
    search,
    clearSearch,
  };
}
