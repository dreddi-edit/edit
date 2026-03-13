import { useEffect, useRef, useState } from 'react';

export function useAutoSave(data: unknown, saveFn: (data: unknown) => Promise<void>, delay = 2000) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(data);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, saveFn, delay]);

  return status;
}
