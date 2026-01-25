import { request } from './client';
import { ApiKey } from '../../types';

export const apiKeysService = {
  async list(token: string): Promise<ApiKey[]> {
    return request<ApiKey[]>('/apikeys', { method: 'GET' }, { token });
  },

  async create(token: string, name: string): Promise<{ id: string; apiKey: string }> {
    return request(
      `/apikeys?name=${encodeURIComponent(name)}`,
      { method: 'POST' },
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
};
