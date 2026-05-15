'use client';

import { useState, useEffect, useCallback } from 'react';

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useEnsureSeeded(): void {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!seeded) {
      import('./seed').then(({ seedService }) => {
        seedService.ensureSeeded().then(() => setSeeded(true));
      });
    }
  }, [seeded]);
}
