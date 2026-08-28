export const PACKFLOW_DATA_CHANGED_EVENT =
  "packflow:data-changed";

export const PACKFLOW_DATA_CHANGED_STORAGE_KEY =
  "packflow:data-changed:last-event";

const BROADCAST_CHANNEL_NAME =
  "packflow:data-changed:v1";

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

const buildCrossTabEnvelope = (payload) => ({
  eventId: payload.eventId,
  changedAt: payload.changedAt,
  scopes: normalizeScopes(payload.scopes),
  action: String(payload.action || "").slice(0, 80),
  targetType: String(payload.targetType || "").slice(0, 80),
});

const openBroadcastChannel = () => {
  if (
    typeof window === "undefined" ||
    typeof window.BroadcastChannel !== "function"
  ) {
    return null;
  }

  try {
    return new window.BroadcastChannel(
      BROADCAST_CHANNEL_NAME
    );
  } catch {
    return null;
  }
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

  /* Current tab receives the full in-memory detail. */
  window.dispatchEvent(
    new CustomEvent(
      PACKFLOW_DATA_CHANGED_EVENT,
      { detail: payload }
    )
  );

  /*
   * Other tabs only need enough information to know what to refresh. Never
   * persist deletion results, snapshots or other business payloads in
   * localStorage merely to trigger a refresh.
   */
  const envelope =
    buildCrossTabEnvelope(payload);

  const channel =
    openBroadcastChannel();

  if (channel) {
    try {
      channel.postMessage(envelope);
    } finally {
      channel.close();
    }
  } else {
    try {
      window.localStorage.setItem(
        PACKFLOW_DATA_CHANGED_STORAGE_KEY,
        JSON.stringify(envelope)
      );
      window.localStorage.removeItem(
        PACKFLOW_DATA_CHANGED_STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        "Unable to publish cross-tab PackFlow change:",
        error
      );
    }
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
    if (shouldHandle(payload)) {
      listener(payload || {});
    }
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
      notify(JSON.parse(event.newValue));
    } catch (error) {
      console.warn(
        "Invalid PackFlow data-change event:",
        error
      );
    }
  };

  const channel =
    openBroadcastChannel();

  const handleBroadcastMessage = (event) => {
    notify(event?.data || {});
  };

  window.addEventListener(
    PACKFLOW_DATA_CHANGED_EVENT,
    handleCurrentTabEvent
  );
  window.addEventListener(
    "storage",
    handleOtherTabEvent
  );

  if (channel) {
    channel.addEventListener(
      "message",
      handleBroadcastMessage
    );
  }

  return () => {
    window.removeEventListener(
      PACKFLOW_DATA_CHANGED_EVENT,
      handleCurrentTabEvent
    );
    window.removeEventListener(
      "storage",
      handleOtherTabEvent
    );

    if (channel) {
      channel.removeEventListener(
        "message",
        handleBroadcastMessage
      );
      channel.close();
    }
  };
};
