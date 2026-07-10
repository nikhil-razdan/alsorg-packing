import {
  useEffect,
  useRef,
} from "react";

export const ADMIN_RECORD_CHANGED_EVENT =
  "packflow:admin-record-changed";

/**
 * Runs the supplied refresh function whenever Admin Center
 * changes or permanently deletes a packet/master item.
 *
 * The ref prevents the listener from being removed and recreated
 * every time the page renders.
 */
export function useAdminCenterRefresh(
  refreshFunction
) {
  const refreshRef =
    useRef(refreshFunction);

  useEffect(() => {
    refreshRef.current =
      refreshFunction;
  }, [refreshFunction]);

  useEffect(() => {
    const handleAdminRecordChanged =
      async (event) => {
        try {
          await Promise.resolve(
            refreshRef.current?.(
              event?.detail || {}
            )
          );
        } catch (error) {
          console.error(
            "Failed to refresh after Admin Center change:",
            error
          );
        }
      };

    window.addEventListener(
      ADMIN_RECORD_CHANGED_EVENT,
      handleAdminRecordChanged
    );

    return () => {
      window.removeEventListener(
        ADMIN_RECORD_CHANGED_EVENT,
        handleAdminRecordChanged
      );
    };
  }, []);
}