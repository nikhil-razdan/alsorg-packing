export const PACKFLOW_DATA_CHANGED_EVENT =
  "packflow:data-changed";

export const PACKFLOW_DATA_CHANGED_STORAGE_KEY =
  "packflow:data-changed:last-event";

const normalizeScopes = (scopes) => {
  const values =
    Array.isArray(scopes)
      ? scopes
      : scopes
        ? [scopes]
        : [];

  return Array.from(
    new Set(
      values
        .map((scope) =>
          String(scope || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  );
};

const createEventId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

export const publishPackFlowDataChanged = (
  detail = {}
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const payload = {
    ...detail,

    eventId:
      detail.eventId ||
      createEventId(),

    changedAt:
      detail.changedAt ||
      new Date().toISOString(),

    scopes: normalizeScopes(
      detail.scopes?.length
        ? detail.scopes
        : [
            "inventory",
            "warehouse",
            "dispatch",
            "dashboard",
          ]
    ),
  };

  /*
   * Refresh listeners inside the current browser tab.
   */
  window.dispatchEvent(
    new CustomEvent(
      PACKFLOW_DATA_CHANGED_EVENT,
      {
        detail: payload,
      }
    )
  );

  /*
   * Notify other open browser tabs.
   *
   * The browser's storage event fires in other tabs,
   * but not in the tab that performed setItem().
   */
  try {
    localStorage.setItem(
      PACKFLOW_DATA_CHANGED_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn(
      "Unable to publish cross-tab PackFlow change:",
      error
    );
  }

  return payload;
};

export const subscribeToPackFlowDataChanges = (
  scope,
  listener
) => {
  if (
    typeof window === "undefined" ||
    typeof listener !== "function"
  ) {
    return () => {};
  }

  const normalizedScope =
    String(scope || "")
      .trim()
      .toLowerCase();

  const shouldHandle = (payload) => {
    const scopes =
      normalizeScopes(payload?.scopes);

    return (
      scopes.length === 0 ||
      scopes.includes("all") ||
      scopes.includes(normalizedScope)
    );
  };

  const notify = (payload) => {
    if (!shouldHandle(payload)) {
      return;
    }

    listener(payload || {});
  };

  const handleCurrentTabEvent = (event) => {
    notify(event?.detail || {});
  };

  const handleOtherTabEvent = (event) => {
    if (
      event.key !==
        PACKFLOW_DATA_CHANGED_STORAGE_KEY ||
      !event.newValue
    ) {
      return;
    }

    try {
      notify(
        JSON.parse(event.newValue)
      );
    } catch (error) {
      console.warn(
        "Invalid PackFlow data-change event:",
        error
      );
    }
  };

  window.addEventListener(
    PACKFLOW_DATA_CHANGED_EVENT,
    handleCurrentTabEvent
  );

  window.addEventListener(
    "storage",
    handleOtherTabEvent
  );

  return () => {
    window.removeEventListener(
      PACKFLOW_DATA_CHANGED_EVENT,
      handleCurrentTabEvent
    );

    window.removeEventListener(
      "storage",
      handleOtherTabEvent
    );
  };
};