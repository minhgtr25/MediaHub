import { useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
export function useApi<T = any>(path: string | null, keepDataOnReload = true) {
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (path === null) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    if (!keepDataOnReload) setData(null);
    setError("");
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) { setData(value); setLoadedPath(path); }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) setData(null);
          setError(e.message); setErrorPath(path);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version, keepDataOnReload]);
  return { data: loadedPath === path ? data : null, error: errorPath === path ? error : "", loading, reload: () => setVersion((v) => v + 1) };
}
