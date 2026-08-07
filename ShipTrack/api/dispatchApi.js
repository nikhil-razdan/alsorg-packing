import {
  api,
} from "./client";

/*
 * =========================================================
 * LOCAL DATE/TIME NORMALIZER
 * =========================================================
 *
 * Backend expects LocalDateTime:
 *
 * 2026-08-07T10:30:00
 *
 * Do NOT convert this to UTC using toISOString().
 */
function normalizeLocalDateTime(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value)
      .trim()
      .replace(" ", "T");

  if (!text) {
    return null;
  }

  /*
   * datetime-local normally gives:
   * 2026-08-07T10:30
   *
   * Backend expects seconds also.
   */
  if (text.length === 16) {
    return `${text}:00`;
  }

  return text;
}

/*
 * =========================================================
 * HELPERS / LOADERS NORMALIZER
 * =========================================================
 *
 * Same behaviour as PackFlow Dispatch Page:
 *
 * blank  -> null
 * 0      -> null
 * 1-999  -> number
 *
 * Invalid:
 * negative numbers
 * decimals
 * letters
 * more than 999
 */
function normalizeHelperLoaderCount(value) {
  /*
   * Completely empty / missing field.
   */
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  /*
   * Blank means not specified.
   */
  if (!text) {
    return null;
  }

  /*
   * Only whole positive numeric characters.
   *
   * Allows:
   * 0
   * 1
   * 12
   * 999
   *
   * Rejects:
   * -1
   * 1.5
   * abc
   * 1000
   */
  if (!/^\d{1,3}$/.test(text)) {
    throw new Error(
      "Helpers / loaders must be a whole number between 0 and 999."
    );
  }

  const parsed =
    Number(text);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > 999
  ) {
    throw new Error(
      "Helpers / loaders must be a whole number between 0 and 999."
    );
  }

  /*
   * Match PackFlow behaviour:
   *
   * Blank or 0 means "not specified".
   */
  if (parsed === 0) {
    return null;
  }

  return parsed;
}

/*
 * =========================================================
 * COMMON DISPATCH PAYLOAD BUILDER
 * =========================================================
 *
 * Used by:
 *
 * - Single QR Dispatch
 * - Bulk QR Dispatch
 *
 * Keeping common normalization here ensures both mobile
 * screens send exactly the same backend format.
 */
function buildDispatchPayload(
  payload = {}
) {
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

  const helperLoaderCount =
    normalizeHelperLoaderCount(
      payload.helperLoaderCount
    );

  return {
    /*
     * Preserve every existing property sent by the
     * mobile screens:
     *
     * scanText
     * rawScan
     * scanTexts
     * driverId
     * vehicleId
     * remarks
     * etc.
     */
    ...payload,

    /*
     * =====================================================
     * HELPERS / LOADERS
     * =====================================================
     *
     * Backend receives:
     *
     * helperLoaderCount: 4
     *
     * or:
     *
     * helperLoaderCount: null
     *
     * when blank / zero.
     */
    helperLoaderCount,

    /*
     * =====================================================
     * DISPATCH / CHALLAN DATE
     * =====================================================
     *
     * Main backend/PDF/challan date field.
     */
    dispatchTime:
      finalDispatchTime,

    /*
     * Legacy scanner/trip field.
     *
     * Keep this because existing backend scanner/trip
     * functionality may still read tripStart.
     *
     * DO NOT REMOVE.
     */
    tripStart:
      finalDispatchTime,
  };
}

/*
 * =========================================================
 * QR RESOLVE
 * =========================================================
 */
export async function resolveScan(
  scanText
) {
  const res =
    await api.post(
      "/api/scanner/resolve",
      {
        scanText,
      }
    );

  return res.data;
}

/*
 * =========================================================
 * MOVE PACKED ITEM TO FG
 * =========================================================
 */
export async function moveItemToFg(
  zohoItemId,
  fgZoneCode = ""
) {
  const query =
    fgZoneCode
      ? `?fgZoneCode=${encodeURIComponent(
        fgZoneCode
      )}`
      : "";

  const res =
    await api.post(
      `/api/dispatched/${encodeURIComponent(
        zohoItemId
      )}/move-to-fg${query}`
    );

  return res.data;
}

/*
 * =========================================================
 * SINGLE QR DISPATCH
 * =========================================================
 */
export async function dispatchSingleScan(
  payload
) {
  /*
   * This validates and normalizes:
   *
   * - dispatchTime
   * - tripStart
   * - helperLoaderCount
   */
  const finalPayload =
    buildDispatchPayload(
      payload
    );

  const res =
    await api.post(
      "/api/scanner/dispatch-single?preview=true",
      finalPayload,
      {
        responseType:
          "arraybuffer",
      }
    );

  return {
    success: true,

    tripId:
      res.headers?.[
      "x-trip-id"
      ],

    challanNo:
      res.headers?.[
      "x-challan-no"
      ],
  };
}

/*
 * =========================================================
 * BULK QR DISPATCH
 * =========================================================
 */
export async function dispatchBulkScans(
  payload
) {
  /*
   * Uses exactly the same normalization as single
   * dispatch so helper/loader count behaves identically.
   */
  const finalPayload =
    buildDispatchPayload(
      payload
    );

  const res =
    await api.post(
      "/api/scanner/dispatch-bulk?preview=true",
      finalPayload,
      {
        responseType:
          "arraybuffer",
      }
    );

  return {
    success: true,

    tripId:
      res.headers?.[
      "x-trip-id"
      ],

    challanNo:
      res.headers?.[
      "x-challan-no"
      ],
  };
}