import { request } from './client';
import type { StatusResponse, StatusSummaryResponse } from '@/types';

export const statusService = {
  async getStatus(): Promise<StatusResponse> {
    return request<StatusResponse>('/status', { method: 'GET' });
  },

  async getSummary(): Promise<StatusSummaryResponse> {
    return request<StatusSummaryResponse>('/status/summary', { method: 'GET' });
  },
};

