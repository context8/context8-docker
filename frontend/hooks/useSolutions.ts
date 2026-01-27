import { useState, useCallback, useEffect, useRef } from 'react';
import { solutionsService, SolutionCreate } from '../services/api/solutions';
import { Solution, SearchResult, Visibility } from '../types';
import { AuthOptions } from '../services/api/client';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export function useSolutions(auth: AuthOptions) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const searchAbortRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSolutions = useCallback(async (page = 1, pageSize = 25) => {
    if (!auth.token && !auth.apiKey && (!auth.apiKeys || auth.apiKeys.length === 0)) {
      setSolutions([]);
      setPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * pageSize;
      const data = await solutionsService.list(auth, { limit: pageSize, offset });
      setSolutions(data.items);
      setPagination({
        page,
        pageSize,
        total: data.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch solutions');
      setSolutions([]);
    } finally {
      setIsLoading(false);
    }
  }, [auth.token, auth.apiKey, auth.apiKeys?.join(',')]);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
    fetchSolutions(page, pagination.pageSize);
  }, [fetchSolutions, pagination.pageSize]);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, page: 1, pageSize }));
    fetchSolutions(1, pageSize);
  }, [fetchSolutions]);

  const createSolution = useCallback(async (data: SolutionCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await solutionsService.create(auth, data);
      await fetchSolutions(pagination.page, pagination.pageSize);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create solution';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [auth, fetchSolutions, pagination.page, pagination.pageSize]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchSolutions(pagination.page, pagination.pageSize);
    }, 800);
  }, [fetchSolutions, pagination.page, pagination.pageSize]);

  const deleteSolution = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await solutionsService.delete(auth, id);
      setSolutions((prev) => prev.filter((item) => item.id !== id));
      setSearchResults((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
      scheduleRefresh();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete solution';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [auth, scheduleRefresh]);

  const setVisibility = useCallback(async (id: string, visibility: Visibility) => {
    setIsLoading(true);
    setError(null);
    try {
      await solutionsService.updateVisibility(auth, id, visibility);
      await fetchSolutions(pagination.page, pagination.pageSize);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update solution';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [auth, fetchSolutions, pagination.page, pagination.pageSize]);

  const getSolution = useCallback(async (id: string) => {
    return solutionsService.getEs(auth, id);
  }, [auth]);

  const searchSolutions = useCallback(async (query: string, visibility?: Visibility) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setError(null);
    try {
      const response = await solutionsService.search(query, auth, controller.signal, visibility);
      setSearchResults(response.results || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [auth]);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  const voteSolution = useCallback(async (id: string, value: 1 | -1) => {
    const resp = await solutionsService.vote(auth, id, value);
    setSolutions((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              upvotes: resp.upvotes,
              downvotes: resp.downvotes,
              voteScore: resp.voteScore,
              myVote: resp.myVote ?? null,
            }
          : item
      )
    );
    setSearchResults((prev) =>
      prev
        ? prev.map((item) =>
            item.id === id
              ? { ...item, upvotes: resp.upvotes, downvotes: resp.downvotes, voteScore: resp.voteScore }
              : item
          )
        : prev
    );
    return resp;
  }, [auth]);

  const clearVote = useCallback(async (id: string) => {
    const resp = await solutionsService.clearVote(auth, id);
    setSolutions((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              upvotes: resp.upvotes,
              downvotes: resp.downvotes,
              voteScore: resp.voteScore,
              myVote: null,
            }
          : item
      )
    );
    setSearchResults((prev) =>
      prev
        ? prev.map((item) =>
            item.id === id
              ? { ...item, upvotes: resp.upvotes, downvotes: resp.downvotes, voteScore: resp.voteScore }
              : item
          )
        : prev
    );
    return resp;
  }, [auth]);

  useEffect(() => {
    fetchSolutions();
  }, [fetchSolutions]);

  useEffect(() => {
    return () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    solutions,
    searchResults,
    isLoading,
    isSearching,
    error,
    pagination,
    setPage,
    setPageSize,
    createSolution,
    deleteSolution,
    setVisibility,
    getSolution,
    searchSolutions,
    clearSearch,
    voteSolution,
    clearVote,
    refetch: fetchSolutions,
  };
}
