import API from "../../services/api";

const MAX_SUBMIT_REASON_LENGTH = 1000;
const MAX_DECISION_REASON_LENGTH = 500;
const MAX_BATCH_SIZE = 200;
const ALLOWED_SOURCES = new Set([
  "DISPATCH",
  "INVENTORY_HISTORY",
]);

const getApiMessage = (
  error,
  fallback = "The request could not be completed."
) => {
  const payload = error?.response?.data;

  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  return (
    payload?.message ||
    payload?.detail ||
    payload?.error ||
    error?.message ||
    fallback
  );
};

const normalizeIds = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const requireIds = (values, label) => {
  const ids = normalizeIds(values);

  if (ids.length === 0) {
    throw new Error(`Select at least one ${label}.`);
  }

  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(
      `A maximum of ${MAX_BATCH_SIZE} ${label}s can be processed at once.`
    );
  }

  return ids;
};

const cleanReason = (
  value,
  {
    minimum = 0,
    maximum,
    label = "Reason",
    required = false,
  }
) => {
  const reason = String(value || "").trim();

  if (required && reason.length < minimum) {
    throw new Error(
      `${label} must contain at least ${minimum} characters.`
    );
  }

  if (!required && reason && reason.length < minimum) {
    throw new Error(
      `${label} must contain at least ${minimum} characters when provided.`
    );
  }

  if (reason.length > maximum) {
    throw new Error(
      `${label} cannot exceed ${maximum} characters.`
    );
  }

  return reason;
};

export async function submitPacketLifecycleRequests({
  targetIds,
  reason,
  source,
}) {
  const normalizedSource = String(source || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_SOURCES.has(normalizedSource)) {
    throw new Error(
      "Lifecycle request source must be DISPATCH or INVENTORY_HISTORY."
    );
  }

  const payload = {
    targetIds: requireIds(targetIds, "item"),
    reason: cleanReason(reason, {
      minimum: 5,
      maximum: MAX_SUBMIT_REASON_LENGTH,
      label: "Reason",
      required: true,
    }),
    source: normalizedSource,
  };

  try {
    const response = await API.post(
      "/packet-lifecycle-requests",
      payload
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to send lifecycle change request"
      )
    );
  }
}

export async function fetchPendingPacketLifecycleRequests({
  page = 0,
  size = 50,
} = {}) {
  try {
    const response = await API.get(
      "/admin/center/lifecycle-requests",
      {
        params: {
          page: Math.max(0, Number(page) || 0),
          size: Math.max(
            1,
            Math.min(MAX_BATCH_SIZE, Number(size) || 50)
          ),
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to load pending lifecycle requests"
      )
    );
  }
}

export async function approvePacketLifecycleRequests({
  requestIds,
  reason = "",
}) {
  const payload = {
    requestIds: requireIds(requestIds, "request"),
    reason: cleanReason(reason, {
      minimum: 0,
      maximum: MAX_DECISION_REASON_LENGTH,
      label: "Admin note",
      required: false,
    }),
  };

  try {
    const response = await API.post(
      "/admin/center/lifecycle-requests/approve",
      payload
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to approve lifecycle request"
      )
    );
  }
}

export async function rejectPacketLifecycleRequests({
  requestIds,
  reason,
}) {
  const payload = {
    requestIds: requireIds(requestIds, "request"),
    reason: cleanReason(reason, {
      minimum: 3,
      maximum: MAX_DECISION_REASON_LENGTH,
      label: "Rejection reason",
      required: true,
    }),
  };

  try {
    const response = await API.post(
      "/admin/center/lifecycle-requests/reject",
      payload
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to reject lifecycle request"
      )
    );
  }
}
