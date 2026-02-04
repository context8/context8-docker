import { useState, useCallback, useEffect } from 'react';
import { apiKeysService } from '../services/api/apiKeys';
import { ApiKey } from '../types';

export interface ApiKeyLimitsInput {
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export function useApiKeys(token: string | null) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!token) {
      setApiKeys([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiKeysService.list(token);
      setApiKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const createApiKey = useCallback(async (name: string, limits?: ApiKeyLimitsInput) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiKeysService.create(token, {
        name,
        dailyLimit: limits?.dailyLimit ?? null,
        monthlyLimit: limits?.monthlyLimit ?? null,
      });
      await fetchApiKeys();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create API key';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchApiKeys]);

  const deleteApiKey = useCallback(async (keyId: string) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      await apiKeysService.delete(token, keyId);
      await fetchApiKeys();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete API key';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchApiKeys]);

  const updateApiKeyLimits = useCallback(async (keyId: string, limits: ApiKeyLimitsInput) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      await apiKeysService.updateLimits(token, keyId, {
        dailyLimit: limits.dailyLimit ?? null,
        monthlyLimit: limits.monthlyLimit ?? null,
      });
      await fetchApiKeys();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update API key limits';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchApiKeys]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return {
    apiKeys,
    isLoading,
    error,
    createApiKey,
    deleteApiKey,
    updateApiKeyLimits,
    refetch: fetchApiKeys,
  };
}
