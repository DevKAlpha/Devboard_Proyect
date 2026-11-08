import { useEffect, useState } from 'react';

/**
 * Current time that refreshes every `intervalMs`. Card moods change over days,
 * so one shared tick per board (default: a minute) keeps them current without
 * reading the clock during render.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
