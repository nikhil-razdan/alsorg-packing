import {
  api,
} from "./client";

function normalizeLocalDateTime(value) {
  if (!value) {
    return null;
  }

  /*
   * IMPORTANT:
   * Do not use new Date(value).toISOString().
   * Mobile selected time is business local time.
   * Backend LocalDateTime expects:
   * 2026-07-03T14:30:00
   */
  const text =
    String(value)
      .trim()
      .replace(" ", "T");

  if (!text) {
    return null;
  }

  if (text.length === 16) {
    return `${text}:00`;
  }

  return text;
}

function buildDispatchPayload(payload = {}) {
  const finalDispatchTime =
    normalizeLocalDateTime(
      payload.dispatchTime ||
      payload.tripStart
    );

  if (!finalDispatchTime) {
    throw new Error(
      "Challan date and time is required."
    );
  }

  return {
    ...payload,

    /*
     * New backend/PDF/challan-number field.
     */
    dispatchTime: finalDispatchTime,

    /*
     * Legacy scanner/trip field.
     * Keep this for old controller/service compatibility.
     */
    tripStart: finalDispatchTime,
  };
}

export async function resolveScan(scanText) {
  const res = await api.post(
    "/api/scanner/resolve",
    {
      scanText,
    }
  );

  return res.data;
}

export async function moveItemToFg(
  zohoItemId,
  fgZoneCode = ""
) {
  const query = fgZoneCode
    ? `?fgZoneCode=${encodeURIComponent(fgZoneCode)}`
    : "";

  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(
      zohoItemId
    )}/move-to-fg${query}`
  );

  return res.data;
}

export async function dispatchSingleScan(
  payload
) {
  const finalPayload =
    buildDispatchPayload(payload);

  const res = await api.post(
    "/api/scanner/dispatch-single?preview=true",
    finalPayload,
    {
      responseType: "arraybuffer",
    }
  );

  return {
    success: true,
    tripId: res.headers?.["x-trip-id"],
    challanNo: res.headers?.["x-challan-no"],
  };
}

export async function dispatchBulkScans(
  payload
) {
  const finalPayload =
    buildDispatchPayload(payload);

  const res = await api.post(
    "/api/scanner/dispatch-bulk?preview=true",
    finalPayload,
    {
      responseType: "arraybuffer",
    }
  );

  return {
    success: true,
    tripId: res.headers?.["x-trip-id"],
    challanNo: res.headers?.["x-challan-no"],
  };
}