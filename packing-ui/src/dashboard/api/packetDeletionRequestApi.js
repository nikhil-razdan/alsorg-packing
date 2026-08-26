import API from "../../services/api";

const getApiMessage = (
  error,
  fallback = "The request could not be completed."
) => {
  const payload = error?.response?.data;

  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    const message =
      payload.message ||
      payload.detail ||
      payload.error;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const normalizeIds = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

const normalizePage = (value) =>
  Math.max(0, Number(value) || 0);

const normalizePageSize = (
  value,
  fallback = 50
) =>
  Math.max(
    1,
    Math.min(200, Number(value) || fallback)
  );

export async function submitPacketDeletionRequests({
  targetIds,
  reason,
  source,
}) {
  const cleanTargetIds = normalizeIds(targetIds);
  const cleanReason = String(reason ?? "").trim();
  const cleanSource = String(source ?? "")
    .trim()
    .toUpperCase();

  if (cleanTargetIds.length === 0) {
    throw new Error("Select at least one item.");
  }

  if (cleanTargetIds.length > 200) {
    throw new Error(
      "A maximum of 200 items can be requested at once."
    );
  }

  if (cleanReason.length < 5) {
    throw new Error(
      "Please enter a clear deletion reason of at least 5 characters."
    );
  }

  if (cleanReason.length > 1000) {
    throw new Error(
      "Deletion reason cannot exceed 1000 characters."
    );
  }

  if (!cleanSource) {
    throw new Error("Deletion request source is missing.");
  }

  try {
    const response = await API.post(
      "/packet-deletion-requests",
      {
        targetIds: cleanTargetIds,
        reason: cleanReason,
        source: cleanSource,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to send deletion request."
      )
    );
  }
}

export async function fetchPendingPacketDeletionRequests({
  page = 0,
  size = 50,
} = {}) {
  try {
    const response = await API.get(
      "/admin/center/deletion-requests",
      {
        params: {
          page: normalizePage(page),
          size: normalizePageSize(size, 50),
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to load pending deletion requests."
      )
    );
  }
}

export async function approvePacketDeletionRequests({
  requestIds,
  reason = "",
}) {
  const cleanRequestIds = normalizeIds(requestIds);
  const cleanReason = String(reason ?? "").trim();

  if (cleanRequestIds.length === 0) {
    throw new Error(
      "Select at least one deletion request to approve."
    );
  }

  if (cleanRequestIds.length > 200) {
    throw new Error(
      "A maximum of 200 deletion requests can be approved at once."
    );
  }

  if (cleanReason.length > 500) {
    throw new Error(
      "Admin note cannot exceed 500 characters."
    );
  }

  try {
    const response = await API.post(
      "/admin/center/deletion-requests/approve",
      {
        requestIds: cleanRequestIds,
        reason: cleanReason,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to approve deletion request."
      )
    );
  }
}

export async function rejectPacketDeletionRequests({
  requestIds,
  reason,
}) {
  const cleanRequestIds = normalizeIds(requestIds);
  const cleanReason = String(reason ?? "").trim();

  if (cleanRequestIds.length === 0) {
    throw new Error(
      "Select at least one deletion request to reject."
    );
  }

  if (cleanRequestIds.length > 200) {
    throw new Error(
      "A maximum of 200 deletion requests can be rejected at once."
    );
  }

  if (cleanReason.length < 3) {
    throw new Error("Please enter a rejection reason.");
  }

  if (cleanReason.length > 500) {
    throw new Error(
      "Rejection reason cannot exceed 500 characters."
    );
  }

  try {
    const response = await API.post(
      "/admin/center/deletion-requests/reject",
      {
        requestIds: cleanRequestIds,
        reason: cleanReason,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to reject deletion request."
      )
    );
  }
}
