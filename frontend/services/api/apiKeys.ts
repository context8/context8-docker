import { request } from './client';
import { ApiKey, SubApiKey } from '../../types';

export const apiKeysService = {
  async list(token: string): Promise<ApiKey[]> {
    return request<ApiKey[]>('/apikeys', { method: 'GET' }, { token });
  },

  async create(
    token: string,
    payload: { name: string; dailyLimit?: number | null; monthlyLimit?: number | null }
  ): Promise<{ id: string; apiKey: string; dailyLimit?: number | null; monthlyLimit?: number | null }> {
    return request(
      `/apikeys`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { token }
    );
  },

  async delete(token: string, keyId: string): Promise<void> {
    return request(
      `/apikeys/${keyId}`,
      { method: 'DELETE' },
      { token }
    );
  },

  async updateLimits(
    token: string,
    keyId: string,
    payload: { dailyLimit?: number | null; monthlyLimit?: number | null }
  ): Promise<ApiKey> {
    return request(
      `/apikeys/${keyId}/limits`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      { token }
    );
  },

  async listSubKeys(token: string, parentId: string): Promise<SubApiKey[]> {
    return request<SubApiKey[]>(
      `/apikeys/${parentId}/subkeys`,
      { method: 'GET' },
      { token }
    );
  },

  async createSubKey(
    token: string,
    parentId: string,
    payload: {
      name: string;
      canRead: boolean;
      canWrite: boolean;
      dailyLimit?: number | null;
      monthlyLimit?: number | null;
    }
  ): Promise<SubApiKey> {
    return request(
      `/apikeys/${parentId}/subkeys`,
      { method: 'POST', body: JSON.stringify(payload) },
      { token }
    );
  },

  async updateSubKey(
    token: string,
    parentId: string,
    subId: string,
    payload: {
      name?: string;
      canRead?: boolean;
      canWrite?: boolean;
      dailyLimit?: number | null;
      monthlyLimit?: number | null;
    }
  ): Promise<SubApiKey> {
    return request(
      `/apikeys/${parentId}/subkeys/${subId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      { token }
    );
  },

  async deleteSubKey(token: string, parentId: string, subId: string): Promise<void> {
    return request(
      `/apikeys/${parentId}/subkeys/${subId}`,
      { method: 'DELETE' },
      { token }
    );
  },
};
