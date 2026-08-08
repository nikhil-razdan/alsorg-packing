import {
  api,
} from "./client";

/*
 * =========================================================
 * LOCAL DATE/TIME
 * =========================================================
 *
 * Backend uses LocalDateTime, not UTC.
 *
 * Example:
 * 2026-08-07T11:45
 *
 * becomes:
 * 2026-08-07T11:45:00
 */
function normalizeLocalDateTime(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

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

/*
 * =========================================================
 * OPTIONAL DRIVER / VEHICLE ID
 * =========================================================
 *
 * Driver and vehicle are optional.
 *
 * ""          -> null
 * null        -> null
 * undefined   -> null
 * "null"      -> null
 * "undefined" -> null
 * valid UUID  -> unchanged
 */
function normalizeOptionalId(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  const lower =
    text.toLowerCase();

  if (
    lower === "null" ||
    lower === "undefined"
  ) {
    return null;
  }

  return text;
}

/*
 * =========================================================
 * HELPERS / LOADERS
 * =========================================================
 *
 * Same PackFlow behaviour:
 *
 * blank -> null
 * 0     -> null
 * 1-999 -> number
 */
function normalizeHelperLoaderCount(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

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
   * Blank and zero mean not specified.
   */
  return parsed === 0
    ? null
    : parsed;
}

/*
 * =========================================================
 * COMMON PAYLOAD
 * =========================================================
 *
 * Used for both:
 *
 * - Single QR Dispatch
 * - Bulk QR Dispatch
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
    ...payload,

    /*
     * Driver is optional.
     */
    driverId:
      normalizeOptionalId(
        payload.driverId
      ),

    /*
     * Vehicle is optional.
     */
    vehicleId:
      normalizeOptionalId(
        payload.vehicleId
      ),

    /*
     * Helpers/loaders optional.
     */
    helperLoaderCount,

    /*
     * Main challan dispatch date.
     */
    dispatchTime:
      finalDispatchTime,

    /*
     * Legacy scanner/trip compatibility.
     */
    tripStart:
      finalDispatchTime,

    /*
     * Normalize remarks too.
     */
    remarks:
      String(
        payload.remarks || ""
      ).trim(),
  };
}

/*
 * =========================================================
 * MANUAL STICKER NUMBER
 * =========================================================
 *
 * The backend scanner resolver already understands:
 *
 * SN=<stickerNumber>
 *
 * This allows manual sticker entry to use the exact same
 * resolver, FG checks, plant checks and dispatch flow as QR.
 */
export function buildStickerScanText(
  value
) {
  let stickerNumber =
    String(value || "").trim();

  /*
   * User may accidentally enter:
   *
   * SN=ABC123
   * SNo: ABC123
   *
   * Normalize both to just the actual sticker number first.
   */
  stickerNumber =
    stickerNumber
      .replace(
        /^SN\s*=\s*/i,
        ""
      )
      .replace(
        /^SNO\s*:\s*/i,
        ""
      )
      .trim();

  if (!stickerNumber) {
    throw new Error(
      "Sticker number is required."
    );
  }

  /*
   * These characters conflict with QR payload parsing.
   */
  if (
    stickerNumber.includes("|") ||
    stickerNumber.includes("\n") ||
    stickerNumber.includes("\r")
  ) {
    throw new Error(
      "Invalid sticker number."
    );
  }

  return `SN=${stickerNumber}`;
}

export async function resolveStickerNumber(
  stickerNumber
) {
  const scanText =
    buildStickerScanText(
      stickerNumber
    );

  const data =
    await resolveScan(
      scanText
    );

  return {
    scanText,
    data,
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
  const cleanScan =
    String(
      scanText || ""
    ).trim();

  if (!cleanScan) {
    throw new Error(
      "QR / Sticker Number is missing."
    );
  }

  const res =
    await api.post(
      "/api/scanner/resolve",
      {
        scanText:
          cleanScan,
      }
    );

  return res.data;
}

/*
 * =========================================================
 * MOVE TO FG
 * =========================================================
 */
export async function moveItemToFg(
  zohoItemId,
  fgZoneCode = ""
) {
  const cleanId =
    String(
      zohoItemId || ""
    ).trim();

  if (!cleanId) {
    throw new Error(
      "Zoho item id is required."
    );
  }

  const cleanZone =
    String(
      fgZoneCode || ""
    ).trim();

  const query =
    cleanZone
      ? `?fgZoneCode=${encodeURIComponent(
        cleanZone
      )}`
      : "";

  const res =
    await api.post(
      `/api/dispatched/${encodeURIComponent(
        cleanId
      )}/move-to-fg${query}`
    );

  return res.data;
}

/*
 * =========================================================
 * PDF RESPONSE CONFIG
 * =========================================================
 *
 * IMPORTANT:
 *
 * Global Axios client uses:
 *
 * Accept: application/json
 *
 * These two endpoints return PDF bytes, therefore they
 * MUST override Accept here.
 *
 * responseType alone does NOT change HTTP Accept.
 */
const DISPATCH_PDF_CONFIG = {
  responseType:
    "arraybuffer",

  headers: {
    Accept:
      "application/pdf",
  },
};

/*
 * =========================================================
 * SINGLE QR DISPATCH
 * =========================================================
 */
export async function dispatchSingleScan(
  payload
) {
  const finalPayload =
    buildDispatchPayload(
      payload
    );

  const res =
    await api.post(
      "/api/scanner/dispatch-single?preview=true",
      finalPayload,
      DISPATCH_PDF_CONFIG
    );

  return {
    success:
      true,

    tripId:
      res.headers?.[
      "x-trip-id"
      ] ||
      res.headers?.[
      "X-Trip-Id"
      ] ||
      null,

    challanNo:
      res.headers?.[
      "x-challan-no"
      ] ||
      res.headers?.[
      "X-Challan-No"
      ] ||
      null,
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
  const finalPayload =
    buildDispatchPayload(
      payload
    );

  const scanTexts =
    Array.isArray(
      finalPayload.scanTexts
    )
      ? finalPayload.scanTexts
        .map((value) =>
          String(
            value || ""
          ).trim()
        )
        .filter(Boolean)
      : [];

  if (
    scanTexts.length === 0
  ) {
    throw new Error(
      "At least one scanned item is required for bulk dispatch."
    );
  }

  const res =
    await api.post(
      "/api/scanner/dispatch-bulk?preview=true",
      {
        ...finalPayload,
        scanTexts,
      },
      DISPATCH_PDF_CONFIG
    );

  return {
    success:
      true,

    tripId:
      res.headers?.[
      "x-trip-id"
      ] ||
      res.headers?.[
      "X-Trip-Id"
      ] ||
      null,

    challanNo:
      res.headers?.[
      "x-challan-no"
      ] ||
      res.headers?.[
      "X-Challan-No"
      ] ||
      null,
  };
}