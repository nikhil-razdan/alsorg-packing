import { useEffect } from "react";

/**
 * Keeps a CSS --vh unit aligned with the visible browser viewport.
 *
 * visualViewport is preferred on browsers that expose it because mobile
 * browser chrome and the on-screen keyboard can change the visible viewport
 * without changing the layout viewport in exactly the same way.
 *
 * Updates are coalesced to one animation frame so resize storms do not force a
 * synchronous style write for every browser event.
 */
export default function useViewportHeight() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    let frameId = 0;

    const applyViewportHeight = () => {
      frameId = 0;

      const viewportHeight =
        window.visualViewport?.height ||
        window.innerHeight;

      if (
        !Number.isFinite(viewportHeight) ||
        viewportHeight <= 0
      ) {
        return;
      }

      document.documentElement.style.setProperty(
        "--vh",
        `${viewportHeight * 0.01}px`
      );
    };

    const scheduleViewportHeight = () => {
      if (frameId) {
        return;
      }

      frameId =
        window.requestAnimationFrame(
          applyViewportHeight
        );
    };

    applyViewportHeight();

    window.addEventListener(
      "resize",
      scheduleViewportHeight,
      { passive: true }
    );

    window.addEventListener(
      "orientationchange",
      scheduleViewportHeight,
      { passive: true }
    );

    const visualViewport =
      window.visualViewport;

    visualViewport?.addEventListener(
      "resize",
      scheduleViewportHeight,
      { passive: true }
    );

    visualViewport?.addEventListener(
      "scroll",
      scheduleViewportHeight,
      { passive: true }
    );

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(
          frameId
        );
      }

      window.removeEventListener(
        "resize",
        scheduleViewportHeight
      );

      window.removeEventListener(
        "orientationchange",
        scheduleViewportHeight
      );

      visualViewport?.removeEventListener(
        "resize",
        scheduleViewportHeight
      );

      visualViewport?.removeEventListener(
        "scroll",
        scheduleViewportHeight
      );
    };
  }, []);
}
