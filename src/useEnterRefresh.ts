import { useEffect } from "react";

/** Refresh when the screen is opened, and again when returning to the app without wiping in-progress work. */
export function useEnterRefresh(
  onEnter: () => void | Promise<unknown>,
  deps: unknown[],
  onReturn?: () => void | Promise<unknown>,
) {
  useEffect(() => {
    void onEnter();
    function onVis() {
      if (document.visibilityState === "visible") void (onReturn ?? onEnter)();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // Caller passes the values this refresh should follow.
  }, deps);
}
