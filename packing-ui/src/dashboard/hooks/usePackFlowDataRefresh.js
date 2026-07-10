import {
  useEffect,
  useRef,
} from "react";

import {
  subscribeToPackFlowDataChanges,
} from "../../utils/packFlowDataEvents";

function usePackFlowDataRefresh(
  scope,
  refreshCallback
) {
  const callbackRef =
    useRef(refreshCallback);

  /*
   * Always keep the newest callback without reinstalling
   * the browser listener after every component render.
   */
  useEffect(() => {
    callbackRef.current =
      refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    let timerId = null;

    const unsubscribe =
      subscribeToPackFlowDataChanges(
        scope,
        (detail) => {
          /*
           * Small debounce prevents multiple immediate refreshes
           * when the parent callback and browser event occur close
           * together.
           */
          if (timerId) {
            window.clearTimeout(
              timerId
            );
          }

          timerId =
            window.setTimeout(() => {
              Promise.resolve(
                callbackRef.current?.(
                  detail
                )
              ).catch((error) => {
                console.error(
                  `Failed to refresh ${scope} after PackFlow change:`,
                  error
                );
              });
            }, 80);
        }
      );

    return () => {
      if (timerId) {
        window.clearTimeout(
          timerId
        );
      }

      unsubscribe();
    };
  }, [scope]);
}

export default usePackFlowDataRefresh;