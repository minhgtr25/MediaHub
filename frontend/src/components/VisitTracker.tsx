import { useEffect } from "react";

const storageKey = "mediahub.visit-session";
const sessionWindow = 30 * 60 * 1000;

export function VisitTracker() {
  useEffect(() => {
    let sessionId: string = crypto.randomUUID();
    const now = Date.now();
    try {
      const previous = JSON.parse(
        sessionStorage.getItem(storageKey) || "null",
      ) as {
        id?: string;
        seen_at?: number;
      } | null;
      if (
        previous?.id &&
        typeof previous.seen_at === "number" &&
        now - previous.seen_at < sessionWindow
      ) {
        sessionId = previous.id;
      }
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ id: sessionId, seen_at: now }),
      );
    } catch {
      // Private browsing may block session storage; the current visit still counts.
    }
    void fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/public/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return null;
}
