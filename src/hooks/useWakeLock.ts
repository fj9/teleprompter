import { useEffect } from "react";

/** Keeps the screen awake while mounted, where the browser supports it (e.g. iPad Safari 16.4+). */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Refused (e.g. low battery); practice works fine without it.
      }
    }

    // The browser drops the lock whenever the page is hidden, so take it again on return.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void lock?.release();
    };
  }, []);
}
