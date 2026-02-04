import { request, AuthOptions } from './client';
import type { Solution, SolutionInput, SearchResponse, Visibility } from '@/types';

export interface SolutionCreate extends SolutionInput {
  visibility?: Visibility;
}

export interface VoteResponse {
  solutionId: string;
  upvotes: number;
  downvotes: number;
  voteScore: number;
  myVote?: number | null;
}

export interface VisibilityUpdateResponse {
  id: string;
  visibility: Visibility;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  visibility?: Visibility;
}

export const solutionsService = {
  async list(auth: AuthOptions, options: ListOptions = {}): Promise<PaginatedResponse<Solution>> {
    const { limit = 25, offset = 0, visibility } = options;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (visibility) {
      params.set('visibility', visibility);
    }
    const data = await request<PaginatedResponse<Solution> | Solution[]>(
      `/solutions?${params.toString()}`,
      { method: 'GET' },
      auth
    );

    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        limit,
        offset,
      };
    }

    return data;
  },

  async get(auth: AuthOptions, id: string): Promise<Solution> {
    return request<Solution>(`/solutions/${id}`, { method: 'GET' }, auth);
  },

  async getEs(auth: AuthOptions, id: string): Promise<Solution> {
    return request<Solution>(`/solutions/${id}/es`, { method: 'GET' }, auth);
  },

  async create(auth: AuthOptions, data: SolutionCreate): Promise<Solution> {
    const tags = typeof data.tags === 'string'
      ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : data.tags;
    const payload = {
      ...data,
      tags,
    };
    return request<Solution>(
      '/solutions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      auth
    );
  },

  async delete(auth: AuthOptions, id: string): Promise<void> {
    return request(
      `/solutions/${id}`,
      { method: 'DELETE' },
      auth
    );
  },

  async updateVisibility(
    auth: AuthOptions,
    id: string,
    visibility: Visibility
  ): Promise<VisibilityUpdateResponse> {
    return request(
      `/solutions/${id}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility }),
      },
      auth
    );
  },

  async search(
    query: string,
    auth: AuthOptions,
    signal?: AbortSignal,
    visibility?: Visibility,
  ): Promise<SearchResponse> {
    const payload = {
      query,
      limit: 10,
      offset: 0,
      visibility,
    };
    return request<SearchResponse>(
      '/search',
      { method: 'POST', body: JSON.stringify(payload), signal },
      auth
    );
  },

  async count(auth: AuthOptions, visibility?: Visibility): Promise<{ total: number }> {
    const query = visibility ? `?visibility=${encodeURIComponent(visibility)}` : '';
    return request<{ total: number }>(
      `/solutions/count${query}`,
      { method: 'GET' },
      auth
    );
  },

  async vote(auth: AuthOptions, id: string, value: 1 | -1): Promise<VoteResponse> {
    return request<VoteResponse>(
      `/solutions/${id}/vote`,
      { method: 'POST', body: JSON.stringify({ value }) },
      auth
    );
  },

  async clearVote(auth: AuthOptions, id: string): Promise<VoteResponse> {
    return request<VoteResponse>(
      `/solutions/${id}/vote`,
      { method: 'DELETE' },
      auth
    );
  },
};
