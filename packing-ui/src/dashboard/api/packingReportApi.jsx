import { API_BASE_URL } from "../../config";
import {
  getSecurityCacheNamespace,
  secureFetch,
} from "../../services/api";

/**
 * Packing Report API
 *
 * Existing contracts are preserved. GET report responses use a short-lived
 * in-memory cache and in-flight de-duplication so reopening Reports or two
 * components requesting the same range do not download the same large JSON
 * twice. Explicit Apply Filters can bypass the cache with forceRefresh.
 */
const REPORT_CACHE_TTL_MS = 2 * 60 * 1000;
const responseCache = new Map();
const inFlight = new Map();

const authHeaders = () => ({});

const buildRangeQuery = (from, to) =>
  `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

const readError = async (res, fallback) => {
  try {
    const text = await res.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const readCached = (key) => {
  const entry = responseCache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.cachedAt > REPORT_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }

  return entry.data;
};

const fetchJsonReport = async (
  url,
  fallbackError,
  { forceRefresh = false } = {}
) => {
  const key =
    `${getSecurityCacheNamespace()}::${url}`;

  if (!forceRefresh) {
    const cached = readCached(key);
    if (cached !== null) return cached;

    const existing = inFlight.get(key);
    if (existing) return existing;
  }

  const request = secureFetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          await readError(res, fallbackError)
        );
      }

      const data = await res.json();

      responseCache.set(key, {
        data,
        cachedAt: Date.now(),
      });

      return data;
    })
    .finally(() => {
      if (inFlight.get(key) === request) {
        inFlight.delete(key);
      }
    });

  inFlight.set(key, request);
  return request;
};

export async function fetchPackingReport(
  from,
  to,
  options = {}
) {
  return fetchJsonReport(
    `${API_BASE_URL}/api/reports/packing?${buildRangeQuery(from, to)}`,
    "Failed to fetch packing report",
    options
  );
}

/**
 * Packet-level physical volume feed.
 *
 * Backend source: packet_items
 * Fields include:
 * packetItemId, zohoItemId, pdNo, drawingNo, sku, itemName,
 * description, clientName, clientAddress, plantCode, floor,
 * packetNumber, quantity, dimensions, volumeCbm, packedAt,
 * packedBy, status and stickerNumber.
 */
export async function fetchPackingVolumeReport(
  from,
  to,
  options = {}
) {
  const data = await fetchJsonReport(
    `${API_BASE_URL}/api/reports/packing/volume?${buildRangeQuery(from, to)}`,
    "Failed to fetch packing volume report",
    options
  );

  return Array.isArray(data) ? data : [];
}

/**
 * Existing report export helper retained.
 */
export async function exportPackingReport(type, from, to) {
  const query = buildRangeQuery(from, to);

  const isCsv =
    String(type || "").toLowerCase() === "csv";

  const url =
    isCsv
      ? `${API_BASE_URL}/api/reports/export/packing/csv?${query}`
      : `${API_BASE_URL}/api/reports/export/packing/excel?${query}`;

  const response =
    await secureFetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: isCsv
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to export packing report"
      )
    );
  }

  const blob =
    await response.blob();

  const objectUrl =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = objectUrl;
  link.download =
    isCsv
      ? "packing_report.csv"
      : "packing_report.xlsx";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(
    objectUrl
  );
}
