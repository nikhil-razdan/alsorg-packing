import {
  fetchDispatchChallansPage,
  fetchDrivers,
  fetchLogisticsTrips,
  fetchShifts,
  fetchVehicles,
} from "../../api/logisticsApi";

/*
 * Scoped, in-memory Logistics read coordinator.
 *
 * Goals:
 * - coalesce identical in-flight reads;
 * - reuse very recent read results while the same authenticated user moves
 *   between Logistics tabs;
 * - keep bounded challan pages as the fast interactive primitive;
 * - reserve complete challan-history walking for screens that genuinely need it.
 *
 * SECURITY:
 * Cache entries are namespaced by the authenticated portal scope supplied by
 * LogisticsPortalPage. An empty scope deliberately disables value caching so a
 * standalone component can never reuse another signed-in user's response.
 */

const entries = new Map();

const MAX_FULL_CHALLAN_PAGES = 1000;
const FULL_HISTORY_YIELD_EVERY_PAGES = 5;

const TTL = Object.freeze({
  CHALLAN_PAGE: 7000,
  CHALLAN_FULL: 20000,
  SHIFTS: 9000,
  DRIVERS: 20000,
  VEHICLES: 20000,
  TRIPS: 9000,
});

const cleanScope = (scope) =>
  String(scope || "").trim();

const buildKey = (scope, resource, variant = "") =>
  `${cleanScope(scope)}|${resource}|${variant}`;

const now = () => Date.now();

const yieldToBrowser = () =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    window.setTimeout(resolve, 0);
  });

async function readScoped({
  scope,
  resource,
  variant = "",
  ttlMs,
  force = false,
  loader,
}) {
  const safeScope = cleanScope(scope);

  if (!safeScope) {
    return loader();
  }

  const key = buildKey(safeScope, resource, variant);
  const current = entries.get(key);

  if (current?.promise) {
    return current.promise;
  }

  if (
    !force &&
    current &&
    Object.prototype.hasOwnProperty.call(current, "value") &&
    now() - Number(current.fetchedAt || 0) < ttlMs
  ) {
    return current.value;
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      entries.set(key, {
        value,
        fetchedAt: now(),
        promise: null,
      });
      return value;
    })
    .catch((error) => {
      if (current && Object.prototype.hasOwnProperty.call(current, "value")) {
        entries.set(key, {
          ...current,
          promise: null,
        });
      } else {
        entries.delete(key);
      }
      throw error;
    });

  entries.set(key, {
    ...(current || {}),
    promise,
  });

  return promise;
}

export function clearLogisticsReadCache(scope = "") {
  const safeScope = cleanScope(scope);

  if (!safeScope) {
    return;
  }

  const prefix = `${safeScope}|`;

  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
    }
  }
}

export function invalidateLogisticsResources(
  scope,
  resources = []
) {
  const safeScope = cleanScope(scope);
  const wanted = new Set(
    (Array.isArray(resources) ? resources : [resources])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  if (!safeScope || wanted.size === 0) return;

  const prefix = `${safeScope}|`;

  for (const key of entries.keys()) {
    if (!key.startsWith(prefix)) continue;

    const resource = key.slice(prefix.length).split("|")[0];

    if (wanted.has(resource)) {
      entries.delete(key);
    }
  }
}

export const getCachedDrivers = (
  scope,
  { force = false } = {}
) =>
  readScoped({
    scope,
    resource: "drivers",
    ttlMs: TTL.DRIVERS,
    force,
    loader: fetchDrivers,
  });

export const getCachedVehicles = (
  scope,
  { force = false } = {}
) =>
  readScoped({
    scope,
    resource: "vehicles",
    ttlMs: TTL.VEHICLES,
    force,
    loader: fetchVehicles,
  });

export const getCachedShifts = (
  scope,
  { force = false } = {}
) =>
  readScoped({
    scope,
    resource: "shifts",
    ttlMs: TTL.SHIFTS,
    force,
    loader: fetchShifts,
  });

export const getCachedTrips = (
  scope,
  { force = false } = {}
) =>
  readScoped({
    scope,
    resource: "trips",
    ttlMs: TTL.TRIPS,
    force,
    loader: fetchLogisticsTrips,
  });

export const getCachedDispatchChallanPage = (
  scope,
  {
    page = 0,
    size = 50,
    force = false,
  } = {}
) => {
  const safePage = Math.max(0, Number(page) || 0);
  const safeSize = Math.min(100, Math.max(1, Number(size) || 50));

  return readScoped({
    scope,
    resource: "challan-page",
    variant: `${safePage}:${safeSize}`,
    ttlMs: TTL.CHALLAN_PAGE,
    force,
    loader: () =>
      fetchDispatchChallansPage({
        page: safePage,
        size: safeSize,
      }),
  });
};

export async function getCachedDispatchChallanWindow(
  scope,
  {
    pages = 2,
    size = 100,
    force = false,
  } = {}
) {
  const safePages = Math.max(1, Math.min(5, Number(pages) || 2));
  const safeSize = Math.min(100, Math.max(1, Number(size) || 100));
  const rows = [];
  let last = null;

  for (let page = 0; page < safePages; page += 1) {
    last = await getCachedDispatchChallanPage(scope, {
      page,
      size: safeSize,
      force,
    });

    const pageRows = Array.isArray(last?.rows) ? last.rows : [];
    rows.push(...pageRows);

    if (!last?.hasNext || pageRows.length === 0) break;
  }

  return {
    rows,
    totalElements: Number(last?.totalElements || rows.length),
    totalPages: Number(last?.totalPages || 0),
    hasNext: Boolean(last?.hasNext),
    loadedRows: rows.length,
  };
}

export function getCachedDispatchChallans(
  scope,
  {
    force = false,
    pageSize = 100,
    maxPages = MAX_FULL_CHALLAN_PAGES,
  } = {}
) {
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 100));
  const safeMaxPages = Math.max(1, Math.min(
    MAX_FULL_CHALLAN_PAGES,
    Number(maxPages) || MAX_FULL_CHALLAN_PAGES
  ));

  return readScoped({
    scope,
    resource: "challan-full",
    variant: `${safePageSize}:${safeMaxPages}`,
    ttlMs: TTL.CHALLAN_FULL,
    force,
    loader: async () => {
      const rows = [];
      let page = 0;
      let previousPage = -1;

      while (page < safeMaxPages) {
        /*
         * Full-history walking is an explicit compatibility path only.
         * Fetch pages directly so a deep walk does not also retain hundreds
         * of intermediate page-cache entries. Page callers still use the
         * normal cached primitive above.
         */
        const result = await fetchDispatchChallansPage({
          page,
          size: safePageSize,
        });

        const pageRows = Array.isArray(result?.rows) ? result.rows : [];
        rows.push(...pageRows);

        if (!result?.hasNext) return rows;

        if (pageRows.length === 0) {
          throw new Error(
            "Dispatch challan paging stopped because the server returned an empty page with more history still indicated"
          );
        }

        const nextPage = Math.max(
          page + 1,
          Number(result?.pageNumber || page) + 1
        );

        if (nextPage <= page || nextPage === previousPage) {
          throw new Error("Dispatch challan paging did not advance");
        }

        previousPage = page;
        page = nextPage;

        if (
          page > 0 &&
          page % FULL_HISTORY_YIELD_EVERY_PAGES === 0
        ) {
          await yieldToBrowser();
        }
      }

      throw new Error(
        "Dispatch challan history exceeded the configured paging safety limit"
      );
    },
  });
}

export function mergeChallanRows(freshRows, currentRows) {
  const result = [];
  const seen = new Set();

  const keyOf = (row) =>
    String(
      row?.challanNumber ||
      row?.chalaanNumber ||
      row?.id ||
      ""
    ).trim();

  for (const row of [
    ...(Array.isArray(freshRows) ? freshRows : []),
    ...(Array.isArray(currentRows) ? currentRows : []),
  ]) {
    const key = keyOf(row);

    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(row);
  }

  return result;
}

export function scheduleLogisticsIdleWork(callback, delayMs = 900) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  let timeoutId = 0;
  let idleId = null;

  const run = () => {
    if (cancelled) return;
    Promise.resolve().then(() => callback?.());
  };

  timeoutId = window.setTimeout(() => {
    if (cancelled) return;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, {
        timeout: 2500,
      });
    } else {
      run();
    }
  }, Math.max(0, Number(delayMs) || 0));

  return () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    if (
      idleId !== null &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleId);
    }
  };
}

export function prefetchLogisticsCore(scope) {
  const safeScope = cleanScope(scope);
  if (!safeScope) return Promise.resolve([]);

  return Promise.allSettled([
    getCachedDrivers(safeScope),
    getCachedVehicles(safeScope),
    getCachedShifts(safeScope),
    getCachedDispatchChallanWindow(safeScope, {
      pages: 2,
      size: 100,
    }),
  ]);
}
