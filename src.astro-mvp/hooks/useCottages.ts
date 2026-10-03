import { useEffect, useState } from 'react';
import { getCottages, type Cottage } from '@/lib/api';

export interface UseCottagesResult {
  data: Cottage[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCottages(): UseCottagesResult {
  const [data, setData] = useState<Cottage[] | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getCottages().then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.success) {
        setData(res.data.cottages);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
