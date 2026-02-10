import { useCallback, useEffect, useState } from 'react';
import type { StatusResponse } from '@/types';
import { statusService } from '@/services/api/status';

export function useStatus(pollMs = 0) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await statusService.getStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const handle = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(handle);
  }, [pollMs, refresh]);

  return { status, isLoading, error, refresh };
}

