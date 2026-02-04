import { useState, useCallback, useEffect } from 'react';
import { apiKeysService } from '../services/api/apiKeys';
import { ApiKey, SubApiKey } from '../types';

export interface ApiKeyLimitsInput {
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export interface SubApiKeyInput {
  name: string;
  canRead: boolean;
  canWrite: boolean;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export function useApiKeys(token: string | null) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [subKeysByParent, setSubKeysByParent] = useState<Record<string, SubApiKey[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!token) {
      setApiKeys([]);
      setSubKeysByParent({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiKeysService.list(token);
      setApiKeys(data);
      const subEntries = await Promise.all(
        data.map(async (key) => {
          try {
            const subKeys = await apiKeysService.listSubKeys(token, key.id);
            return [key.id, subKeys] as const;
          } catch {
            return [key.id, []] as const;
          }
        })
      );
      setSubKeysByParent(Object.fromEntries(subEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
      setApiKeys([]);
      setSubKeysByParent({});
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

  const createSubKey = useCallback(async (parentId: string, input: SubApiKeyInput) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiKeysService.createSubKey(token, parentId, input);
      await fetchApiKeys();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create sub API key';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchApiKeys]);

  const updateSubKey = useCallback(async (
    parentId: string,
    subId: string,
    input: Partial<SubApiKeyInput>
  ) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      await apiKeysService.updateSubKey(token, parentId, subId, input);
      await fetchApiKeys();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update sub API key';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [token, fetchApiKeys]);

  const deleteSubKey = useCallback(async (parentId: string, subId: string) => {
    if (!token) throw new Error('No token');
    setIsLoading(true);
    setError(null);
    try {
      await apiKeysService.deleteSubKey(token, parentId, subId);
      await fetchApiKeys();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete sub API key';
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
    subKeysByParent,
    isLoading,
    error,
    createApiKey,
    deleteApiKey,
    updateApiKeyLimits,
    createSubKey,
    updateSubKey,
    deleteSubKey,
    refetch: fetchApiKeys,
  };
}
