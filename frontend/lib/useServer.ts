import { useEffect, useState } from "react";

/**
 * Load from the API and keep trying until it answers. Free hosting sleeps when idle, so the first visit may have
 * to wait for it to wake. Returns true once the wait is long enough to be worth explaining. Keep both arguments stable.
 */
export function useServer<T>(load: () => Promise<T>, done: (v: T) => void) {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    let stop = false, retry: ReturnType<typeof setTimeout> | undefined;
    const slow = setTimeout(() => setWaiting(true), 4000);
    const go = () => load().then((v) => {
      if (stop) return;
      clearTimeout(slow);
      setWaiting(false);
      done(v);
    }).catch(() => {
      if (stop) return;
      setWaiting(true);
      retry = setTimeout(go, 3000);
    });
    go();
    return () => { stop = true; clearTimeout(slow); clearTimeout(retry); };
  }, [load, done]);
  return waiting;
}
