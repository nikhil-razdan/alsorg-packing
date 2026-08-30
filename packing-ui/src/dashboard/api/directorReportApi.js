import { API_BASE_URL } from "../../config";
import {
  getSecurityCacheNamespace,
  secureFetch,
} from "../../services/api";

const DIRECTOR_VOLUME_CACHE_TTL_MS =
  2 * 60 * 1000;

const responseCache = new Map();
const inFlight = new Map();

const cleanBaseUrl = (value) =>
  String(value || "").replace(/\/+$/, "");

const buildRangeQuery = (from, to) =>
  `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

const readError = async (
  response,
  fallback
) => {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const readCached = (key) => {
  const entry = responseCache.get(key);

  if (!entry) return null;

  if (
    Date.now() - entry.cachedAt >
    DIRECTOR_VOLUME_CACHE_TTL_MS
  ) {
    responseCache.delete(key);
    return null;
  }

  return entry.data;
};

export async function fetchDirectorPackingVolumeReport(
  from,
  to,
  { forceRefresh = false } = {}
) {
  const url =
    `${cleanBaseUrl(API_BASE_URL)}` +
    `/api/reports/director/packing-volume?${buildRangeQuery(from, to)}`;

  const cacheKey =
    `${getSecurityCacheNamespace()}::${url}`;

  if (!forceRefresh) {
    const cached = readCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const existing = inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }
  }

  const request = secureFetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load Director packing-volume intelligence"
          )
        );
      }

      const payload = await response.json();
      const rows = Array.isArray(payload)
        ? payload
        : [];

      responseCache.set(cacheKey, {
        data: rows,
        cachedAt: Date.now(),
      });

      return rows;
    })
    .finally(() => {
      if (inFlight.get(cacheKey) === request) {
        inFlight.delete(cacheKey);
      }
    });

  inFlight.set(cacheKey, request);
  return request;
}

export function clearDirectorReportCache() {
  responseCache.clear();
  inFlight.clear();
}
