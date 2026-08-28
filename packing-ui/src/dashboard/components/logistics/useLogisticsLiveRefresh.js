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

  const mountedRef =
    useRef(true);

  const hasExternalClock =
    liveRefreshToken !== null &&
    liveRefreshToken !== undefined;

  const enabled =
    options?.enabled !== false;

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

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;

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
    }, []);

  usePackFlowDataRefresh(
    "logistics",
    executeRefresh,
    {
      intervalMs:
        options?.intervalMs ?? 6000,
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
