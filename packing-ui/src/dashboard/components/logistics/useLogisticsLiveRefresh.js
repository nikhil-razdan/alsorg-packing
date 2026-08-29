import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import usePackFlowDataRefresh
  from "../../hooks/usePackFlowDataRefresh";

/*
 * Logistics live-refresh adapter.
 *
 * Under LogisticsPortalPage the portal owns the visibility-aware polling clock
 * and supplies liveRefreshToken.  Standalone logistics components fall back to
 * the shared PackFlow live-refresh hook.  In both modes this adapter prevents
 * overlapping refreshes and queues at most one follow-up refresh.
 */
function useLogisticsLiveRefresh(
  liveRefreshToken,
  refreshCallback,
  options = {}
) {
  const callbackRef =
    useRef(refreshCallback);

  const previousTokenRef =
    useRef(liveRefreshToken);

  const runningRef =
    useRef(false);

  const queuedRef =
    useRef(false);

  const lastRunAtRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  const hasExternalClock =
    liveRefreshToken !== null &&
    liveRefreshToken !== undefined;

  const enabled =
    options?.enabled !== false;

  const minIntervalMs = Math.max(
    3000,
    Number(options?.minIntervalMs ?? 8000) || 8000
  );

  useEffect(() => {
    callbackRef.current =
      refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const executeRefresh =
    useCallback(async (detail = {}) => {
      if (!mountedRef.current) {
        return;
      }

      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const elapsed = Date.now() - lastRunAtRef.current;

      if (elapsed < minIntervalMs) {
        return;
      }

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;
      lastRunAtRef.current = Date.now();

      try {
        await Promise.resolve(
          callbackRef.current?.({
            ...(detail || {}),
            background: true,
          })
        );
      } catch {
        /* Keep the last good live UI and retry on the next signal. */
      } finally {
        runningRef.current = false;

        if (
          mountedRef.current &&
          queuedRef.current
        ) {
          queuedRef.current = false;

          queueMicrotask(() => {
            void executeRefresh({
              source: "queued-logistics-refresh",
            });
          });
        } else {
          queuedRef.current = false;
        }
      }
    }, [minIntervalMs]);

  usePackFlowDataRefresh(
    "logistics",
    executeRefresh,
    {
      intervalMs:
        options?.intervalMs ?? 12000,
      enabled:
        enabled &&
        !hasExternalClock,
    }
  );

  useEffect(() => {
    if (!hasExternalClock) {
      previousTokenRef.current =
        liveRefreshToken;
      return;
    }

    if (!enabled) {
      previousTokenRef.current =
        liveRefreshToken;
      return;
    }

    if (
      previousTokenRef.current ===
      liveRefreshToken
    ) {
      return;
    }

    previousTokenRef.current =
      liveRefreshToken;

    void executeRefresh({
      source: "portal-live-token",
    });
  }, [
    enabled,
    executeRefresh,
    hasExternalClock,
    liveRefreshToken,
  ]);
}

export default useLogisticsLiveRefresh;
