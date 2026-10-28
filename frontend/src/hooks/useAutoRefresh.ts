import { useEffect, useRef } from "react";

type AutoRefreshOptions = {
  intervalMs: number;
  enabled?: boolean;
  runImmediately?: boolean;
  listenVisibilityChange?: boolean;
  resetKey?: string | number;
};

export function useAutoRefresh(
  refresh: () => void,
  {
    intervalMs,
    enabled = true,
    runImmediately = false,
    listenVisibilityChange = false,
    resetKey,
  }: AutoRefreshOptions,
) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    if (runImmediately) run();
    const timer = window.setInterval(run, intervalMs);
    window.addEventListener("focus", run);
    if (listenVisibilityChange)
      document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
      if (listenVisibilityChange)
        document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs, runImmediately, listenVisibilityChange, resetKey]);
}
