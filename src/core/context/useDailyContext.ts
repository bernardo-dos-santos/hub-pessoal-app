import { useEffect, useState } from 'react';
import { getDailyContext, type DailyContext } from './dailyContext';

const REFRESH_INTERVAL_MS = 5 * 60_000; // 5 minutos

export function useDailyContext(): DailyContext {
  const [ctx, setCtx] = useState<DailyContext>(getDailyContext);

  useEffect(() => {
    const interval = setInterval(() => setCtx(getDailyContext()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return ctx;
}
