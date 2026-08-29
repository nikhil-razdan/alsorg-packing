import { api, getStoredRoles } from "./client";
import {
  enrichItemsWithOperationalMetadata,
} from "./operationalMetadataApi";

const DISPATCH_PAGE_SIZE = 200;
const MAX_DISPATCH_PAGES = 1000;

const normalizeRole = (value) =>
  String(value || "")
    .replace(/^ROLE_/i, "")
    .trim()
    .toUpperCase();

async function isPureUtlDispatchSession() {
  const roles = (await getStoredRoles()).map(normalizeRole);

  return (
    roles.includes("UTL_DISPATCH") &&
    !roles.includes("DISPATCH")
  );
}

function headerNumber(headers, name, fallback = 0) {
  const raw =
    headers?.[name] ??
    headers?.[name.toLowerCase()] ??
    headers?.[name.toUpperCase()];

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function headerBoolean(headers, name, fallback = false) {
  const raw =
    headers?.[name] ??
    headers?.[name.toLowerCase()] ??
    headers?.[name.toUpperCase()];

  if (raw === undefined || raw === null) {
    return fallback;
  }

  return String(raw).trim().toLowerCase() === "true";
}

export async function fetchDispatchedItemsPage({
  page = 0,
  size = DISPATCH_PAGE_SIZE,
} = {}) {
  const safePage = Math.max(0, Number(page) || 0);
  const safeSize = Math.min(
    DISPATCH_PAGE_SIZE,
    Math.max(1, Number(size) || DISPATCH_PAGE_SIZE)
  );

  const res = await api.get(
    "/api/dispatched",
    {
      params: {
        page: safePage,
        size: safeSize,
      },
    }
  );

  const rawRows = Array.isArray(res?.data)
    ? res.data
    : [];

  const rows = await enrichItemsWithOperationalMetadata(rawRows);

  return {
    rows,
    pageNumber: headerNumber(
      res?.headers,
      "x-page-number",
      safePage
    ),
    pageSize: headerNumber(
      res?.headers,
      "x-page-size",
      safeSize
    ),
    totalPages: headerNumber(
      res?.headers,
      "x-total-pages",
      rawRows.length < safeSize ? safePage + 1 : 0
    ),
    totalElements: headerNumber(
      res?.headers,
      "x-total-elements",
      rawRows.length
    ),
    hasNext: headerBoolean(
      res?.headers,
      "x-has-next",
      rawRows.length === safeSize
    ),
  };
}

/*
 * Compatibility function used by the existing screens.
 * The backend GET /api/dispatched is now paged, so returning only res.data
 * silently truncated ShipTrack at the first server page. Reconstruct the full
 * authorized register through the backend paging contract instead.
 */
export async function fetchDispatchedItems() {
  const first = await fetchDispatchedItemsPage({
    page: 0,
    size: DISPATCH_PAGE_SIZE,
  });

  const rows = [...first.rows];
  let page = 1;
  let hasNext = first.hasNext;
  let totalPages = first.totalPages;

  while (
    hasNext &&
    page < MAX_DISPATCH_PAGES &&
    (totalPages <= 0 || page < totalPages)
  ) {
    const next = await fetchDispatchedItemsPage({
      page,
      size: DISPATCH_PAGE_SIZE,
    });

    rows.push(...next.rows);
    hasNext = next.hasNext;
    totalPages = next.totalPages || totalPages;
    page += 1;
  }

  if (hasNext && page >= MAX_DISPATCH_PAGES) {
    throw new Error(
      "Dispatch history exceeded the ShipTrack paging safety limit."
    );
  }

  return rows;
}

export async function updateDispatchStatus(
  zohoItemId,
  status
) {
  const cleanId = String(zohoItemId || "").trim();
  const cleanStatus = String(status || "").trim().toUpperCase();

  if (!cleanId) {
    throw new Error("Dispatch item id is required.");
  }

  if (!cleanStatus) {
    throw new Error("Dispatch status is required.");
  }

  const pureUtlDispatch = await isPureUtlDispatchSession();
  const base = pureUtlDispatch
    ? "/api/utl/dispatch"
    : "/api/dispatched";

  const res = await api.post(
    `${base}/${encodeURIComponent(cleanId)}/dispatch`,
    null,
    {
      params: {
        status: cleanStatus,
      },
    }
  );

  return res.data;
}

export async function moveToWarehouse(
  zohoItemId,
  warehouseCode,
  fromLocation = ""
) {
  const cleanId = String(zohoItemId || "").trim();
  const pureUtlDispatch = await isPureUtlDispatchSession();
  const base = pureUtlDispatch
    ? "/api/utl/dispatch"
    : "/api/dispatched";

  const res = await api.post(
    `${base}/${encodeURIComponent(cleanId)}/store`,
    null,
    {
      params: {
        warehouseCode,
        ...(fromLocation
          ? { fromLocation }
          : {}),
      },
    }
  );

  return res.data;
}

export async function requestReturnToDispatch(
  zohoItemId
) {
  const cleanId = String(zohoItemId || "").trim();

  /*
   * Current PackFlow keeps the warehouse-return request on the normal Dispatch
   * workflow. UTL_DISPATCH does not get this mutation unless the backend adds a
   * dedicated assignment-scoped endpoint, so fail closed instead of bypassing
   * UTL isolation through the generic controller.
   */
  if (await isPureUtlDispatchSession()) {
    throw new Error(
      "Warehouse return request is not available for UTL Dispatch in the current PackFlow workflow."
    );
  }

  const res = await api.post(
    `/api/dispatched/${encodeURIComponent(cleanId)}/request-return`
  );

  return res.data;
}
