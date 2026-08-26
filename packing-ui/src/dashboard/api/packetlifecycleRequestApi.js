import API from "../../services/api";

/*
 * ============================================================
 * PACKFLOW PACKET LIFECYCLE REQUEST API
 * ============================================================
 *
 * Purpose:
 *
 * 1. DISPATCH / PACKING users can REQUEST that a packet be moved
 *    one lifecycle state backwards.
 *
 * 2. The request itself DOES NOT change packet state.
 *
 * 3. ADMIN users can review pending requests from Admin Center.
 *
 * 4. ADMIN can approve or reject one or many requests.
 *
 * 5. Actual packet rollback continues to be executed securely
 *    by the backend lifecycle service.
 *
 * IMPORTANT:
 *
 * ../../services/api already uses a base URL ending in "/api".
 *
 * Therefore paths in this file intentionally DO NOT begin with
 * another "/api".
 *
 * Correct:
 *   /packet-lifecycle-requests
 *
 * Incorrect:
 *   /api/packet-lifecycle-requests
 * ============================================================
 */


/*
 * Extract the most useful error message returned by Spring Boot
 * or Axios while keeping frontend callers simple.
 */
const getApiMessage = (
  error,
  fallback = "The request could not be completed."
) => {
  const payload =
    error?.response?.data;

  if (
    typeof payload === "string" &&
    payload.trim()
  ) {
    return payload.trim();
  }

  if (
    payload &&
    typeof payload === "object"
  ) {
    const message =
      payload.message ||
      payload.detail ||
      payload.error;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message.trim();
    }
  }

  if (
    typeof error?.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
};


/*
 * Clean IDs before sending them to the backend.
 *
 * - removes null/undefined/blank values
 * - converts IDs to strings
 * - trims whitespace
 * - removes duplicate IDs
 *
 * This is useful for both single and bulk operations.
 */
const normalizeIds = (
  values
) => {
  return Array.from(
    new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          value =>
            String(
              value ?? ""
            ).trim()
        )
        .filter(Boolean)
    )
  );
};


/*
 * Keep pagination values bounded before sending them to the
 * Admin Center endpoint.
 */
const normalizePage = (
  value
) => {
  return Math.max(
    0,
    Number(value) || 0
  );
};


const normalizePageSize = (
  value,
  fallback = 50
) => {
  return Math.max(
    1,
    Math.min(
      200,
      Number(value) ||
      fallback
    )
  );
};


/*
 * ============================================================
 * USER — SUBMIT LIFECYCLE CHANGE REQUEST
 * ============================================================
 *
 * Used by:
 *
 * - DispatchedItemsPage.jsx
 * - ZohoItemsPage.jsx Generated History
 *
 * Backend:
 *
 * POST /api/packet-lifecycle-requests
 *
 * `targetIds` meaning depends on `source`:
 *
 * DISPATCH
 *   targetIds = selected Dispatch item IDs
 *
 * INVENTORY_HISTORY
 *   targetIds = selected StickerHistory IDs
 *
 * The backend resolves the real PacketItem and performs all
 * ownership/access/security checks.
 */
export async function submitPacketLifecycleRequests({
  targetIds,
  reason,
  source,
}) {
  const cleanTargetIds =
    normalizeIds(
      targetIds
    );

  const cleanReason =
    String(
      reason ?? ""
    ).trim();

  const cleanSource =
    String(
      source ?? ""
    )
      .trim()
      .toUpperCase();

  /*
   * Frontend validation provides immediate feedback.
   *
   * Backend validation remains authoritative.
   */
  if (
    cleanTargetIds.length === 0
  ) {
    throw new Error(
      "Select at least one packet."
    );
  }

  if (
    cleanTargetIds.length > 200
  ) {
    throw new Error(
      "A maximum of 200 packets can be requested at once."
    );
  }

  if (
    cleanReason.length < 5
  ) {
    throw new Error(
      "Please enter a clear reason of at least 5 characters."
    );
  }

  if (
    cleanReason.length > 1000
  ) {
    throw new Error(
      "Reason cannot exceed 1000 characters."
    );
  }

  if (!cleanSource) {
    throw new Error(
      "Lifecycle request source is missing."
    );
  }

  try {
    const response =
      await API.post(
        "/packet-lifecycle-requests",
        {
          targetIds:
            cleanTargetIds,

          reason:
            cleanReason,

          source:
            cleanSource,
        }
      );

    return response.data;

  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to send lifecycle change request."
      )
    );
  }
}


/*
 * ============================================================
 * ADMIN — LOAD PENDING REQUESTS
 * ============================================================
 *
 * Used by:
 *
 * src/dashboard/components/admin/AdminCenter.jsx
 *
 * Backend:
 *
 * GET /api/admin/center/lifecycle-requests
 */
export async function fetchPendingPacketLifecycleRequests({
  page = 0,
  size = 50,
} = {}) {
  try {
    const response =
      await API.get(
        "/admin/center/lifecycle-requests",
        {
          params: {
            page:
              normalizePage(
                page
              ),

            size:
              normalizePageSize(
                size,
                50
              ),
          },
        }
      );

    return response.data;

  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to load pending lifecycle requests."
      )
    );
  }
}


/*
 * ============================================================
 * ADMIN — APPROVE SINGLE / BULK REQUESTS
 * ============================================================
 *
 * Backend:
 *
 * POST /api/admin/center/lifecycle-requests/approve
 *
 * The backend:
 *
 * - verifies ADMIN access
 * - locks relevant records
 * - confirms request is still PENDING
 * - confirms the packet is still in the state recorded when
 *   the request was submitted
 * - performs the existing one-step rollback
 * - writes lifecycle/audit information
 * - marks the request APPROVED
 *
 * `reason` is optional here because the user's original reason
 * is already stored with the request. AdminCenter may provide
 * an additional decision note.
 */
export async function approvePacketLifecycleRequests({
  requestIds,
  reason = "",
}) {
  const cleanRequestIds =
    normalizeIds(
      requestIds
    );

  const cleanReason =
    String(
      reason ?? ""
    ).trim();

  if (
    cleanRequestIds.length === 0
  ) {
    throw new Error(
      "Select at least one lifecycle request to approve."
    );
  }

  if (
    cleanRequestIds.length > 200
  ) {
    throw new Error(
      "A maximum of 200 lifecycle requests can be approved at once."
    );
  }

  if (
    cleanReason.length > 1000
  ) {
    throw new Error(
      "Admin note cannot exceed 1000 characters."
    );
  }

  try {
    const response =
      await API.post(
        "/admin/center/lifecycle-requests/approve",
        {
          requestIds:
            cleanRequestIds,

          reason:
            cleanReason,
        }
      );

    return response.data;

  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to approve lifecycle request."
      )
    );
  }
}


/*
 * ============================================================
 * ADMIN — REJECT SINGLE / BULK REQUESTS
 * ============================================================
 *
 * Backend:
 *
 * POST /api/admin/center/lifecycle-requests/reject
 *
 * Rejecting a request does NOT change packet state.
 *
 * The rejection reason is required so there is a clear,
 * permanent explanation for the requester/admin audit trail.
 */
export async function rejectPacketLifecycleRequests({
  requestIds,
  reason,
}) {
  const cleanRequestIds =
    normalizeIds(
      requestIds
    );

  const cleanReason =
    String(
      reason ?? ""
    ).trim();

  if (
    cleanRequestIds.length === 0
  ) {
    throw new Error(
      "Select at least one lifecycle request to reject."
    );
  }

  if (
    cleanRequestIds.length > 200
  ) {
    throw new Error(
      "A maximum of 200 lifecycle requests can be rejected at once."
    );
  }

  if (
    cleanReason.length < 3
  ) {
    throw new Error(
      "Please enter a rejection reason."
    );
  }

  if (
    cleanReason.length > 1000
  ) {
    throw new Error(
      "Rejection reason cannot exceed 1000 characters."
    );
  }

  try {
    const response =
      await API.post(
        "/admin/center/lifecycle-requests/reject",
        {
          requestIds:
            cleanRequestIds,

          reason:
            cleanReason,
        }
      );

    return response.data;

  } catch (error) {
    throw new Error(
      getApiMessage(
        error,
        "Unable to reject lifecycle request."
      )
    );
  }
}