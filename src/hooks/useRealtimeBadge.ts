import { useState, useCallback, useRef } from "react";

/**
 * Returns { triggerLive, isLive }.
 * Call triggerLive() when data updates — isLive will be true for 2.5 seconds.
 */
export function useRealtimeBadge() {
  const [isLive, setIsLive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerLive = useCallback(() => {
    setIsLive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsLive(false), 2500);
  }, []);

  return { triggerLive, isLive };
}
