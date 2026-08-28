import {
  useEffect,
  useRef,
} from "react";

import {
  subscribeToPackFlowDataChanges,
} from "../../utils/packFlowDataEvents";

/*
 * PackFlow live-refresh bridge.
 *
 * Existing event-driven refresh remains the fastest path for changes made in
 * this browser or another PackFlow tab.  The visibility-aware polling fallback
 * catches authoritative backend changes made by ShipTrack, another workstation,
 * scheduled jobs, imports or any path that does not publish a browser event.
 *
 * The hook never starts a second callback while the previous one is still
 * running.  Hidden/offline tabs stop polling and revalidate immediately when
 * they become visible/online again.
 */
function usePackFlowDataRefresh(
  scope,
  refreshCallback,
  options = {}
) {
  const callbackRef =
    useRef(refreshCallback);

  const runningRef =
    useRef(false);

  const queuedRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const optionsRef =
    useRef(options);

  useEffect(() => {
    callbackRef.current =
      refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    optionsRef.current =
      options || {};
  }, [options]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let eventTimerId = null;
    let intervalId = null;

    const normalizedInterval =
      Math.max(
        0,
        Number(
          optionsRef.current?.intervalMs ??
          6000
        ) || 0
      );

    const isEnabled = () =>
      optionsRef.current?.enabled !== false;

    const canBackgroundRefresh = () => {
      if (!isEnabled()) {
        return false;
      }

      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return false;
      }

      if (
        typeof navigator !== "undefined" &&
        navigator.onLine === false
      ) {
        return false;
      }

      return true;
    };

    const executeRefresh =
      async (detail = {}) => {
        if (
          !mountedRef.current ||
          !isEnabled()
        ) {
          return;
        }

        if (runningRef.current) {
          queuedRef.current = true;
          return;
        }

        runningRef.current = true;

        try {
          await Promise.resolve(
            callbackRef.current?.(
              detail
            )
          );
        } catch (error) {
          /*
           * Background refresh failure must not tear down an already-rendered
           * operational page.  The page-level loader keeps its current data and
           * the next poll/focus/event remains retryable.
           */
          console.warn(
            `PackFlow live refresh failed for ${scope}:`,
            error
          );
        } finally {
          runningRef.current = false;

          if (
            mountedRef.current &&
            queuedRef.current &&
            canBackgroundRefresh()
          ) {
            queuedRef.current = false;

            queueMicrotask(() => {
              void executeRefresh({
                source: "queued",
                background: true,
              });
            });
          } else {
            queuedRef.current = false;
          }
        }
      };

    const scheduleEventRefresh =
      (detail) => {
        if (eventTimerId) {
          window.clearTimeout(
            eventTimerId
          );
        }

        eventTimerId =
          window.setTimeout(() => {
            void executeRefresh({
              ...(detail || {}),
              source:
                detail?.source ||
                "event",
              background: true,
            });
          }, 80);
      };

    const unsubscribe =
      subscribeToPackFlowDataChanges(
        scope,
        scheduleEventRefresh
      );

    const refreshForResume = () => {
      if (!canBackgroundRefresh()) {
        return;
      }

      void executeRefresh({
        source: "resume",
        background: true,
      });
    };

    const onVisibilityChange = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshForResume();
      }
    };

    if (
      typeof window !== "undefined"
    ) {
      window.addEventListener(
        "focus",
        refreshForResume
      );

      window.addEventListener(
        "online",
        refreshForResume
      );

      document.addEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      if (normalizedInterval > 0) {
        intervalId =
          window.setInterval(() => {
            if (!canBackgroundRefresh()) {
              return;
            }

            void executeRefresh({
              source: "poll",
              background: true,
            });
          }, normalizedInterval);
      }
    }

    return () => {
      if (eventTimerId) {
        window.clearTimeout(
          eventTimerId
        );
      }

      if (intervalId) {
        window.clearInterval(
          intervalId
        );
      }

      if (
        typeof window !== "undefined"
      ) {
        window.removeEventListener(
          "focus",
          refreshForResume
        );

        window.removeEventListener(
          "online",
          refreshForResume
        );

        document.removeEventListener(
          "visibilitychange",
          onVisibilityChange
        );
      }

      unsubscribe();
    };
  }, [scope]);
}

export default usePackFlowDataRefresh;
