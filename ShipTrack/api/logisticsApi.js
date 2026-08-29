import { api } from "./client";
import {
  enrichChallansWithOperationalMetadata,
} from "./operationalMetadataApi";

const CHALLAN_PAGE_SIZE = 100;
const MAX_CHALLAN_PAGES = 1000;

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

export async function fetchDrivers() {
  const res = await api.get(
    "/api/logistics/drivers"
  );

  return Array.isArray(res?.data)
    ? res.data
    : [];
}

export async function fetchVehicles() {
  const res = await api.get(
    "/api/logistics/vehicles"
  );

  return Array.isArray(res?.data)
    ? res.data
    : [];
}

export async function createDriver(payload = {}) {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("Driver name is required.");
  }

  const res = await api.post(
    "/api/logistics/drivers",
    { name }
  );

  return res.data;
}

export async function createVehicle(payload = {}) {
  const vehicleNumber = String(
    payload.vehicleNumber || ""
  ).trim();

  if (!vehicleNumber) {
    throw new Error("Vehicle number is required.");
  }

  const res = await api.post(
    "/api/logistics/vehicles",
    { vehicleNumber }
  );

  return res.data;
}

export async function fetchDispatchedChallansPage({
  page = 0,
  size = CHALLAN_PAGE_SIZE,
} = {}) {
  const safePage = Math.max(0, Number(page) || 0);
  const safeSize = Math.min(
    CHALLAN_PAGE_SIZE,
    Math.max(1, Number(size) || CHALLAN_PAGE_SIZE)
  );

  const res = await api.get(
    "/api/dispatched/challans/search",
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

  const rows = await enrichChallansWithOperationalMetadata(rawRows);

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
 * Existing screens expect an array. The backend history is now paged, so walk
 * the authorized page contract rather than using the legacy all-history route.
 */
export async function fetchDispatchedChallans() {
  const first = await fetchDispatchedChallansPage({
    page: 0,
    size: CHALLAN_PAGE_SIZE,
  });

  const rows = [...first.rows];
  let page = 1;
  let hasNext = first.hasNext;
  let totalPages = first.totalPages;

  while (
    hasNext &&
    page < MAX_CHALLAN_PAGES &&
    (totalPages <= 0 || page < totalPages)
  ) {
    const next = await fetchDispatchedChallansPage({
      page,
      size: CHALLAN_PAGE_SIZE,
    });

    rows.push(...next.rows);
    hasNext = next.hasNext;
    totalPages = next.totalPages || totalPages;
    page += 1;
  }

  if (hasNext && page >= MAX_CHALLAN_PAGES) {
    throw new Error(
      "Challan history exceeded the ShipTrack paging safety limit."
    );
  }

  return rows;
}

export async function fetchDispatchedChallan(challanNumber) {
  const cleanChallan = String(challanNumber || "").trim();

  if (!cleanChallan) {
    throw new Error("Challan number is required.");
  }

  const res = await api.get(
    `/api/dispatched/challans/${encodeURIComponent(cleanChallan)}`
  );

  const challan = res?.data || null;

  if (!challan || typeof challan !== "object") {
    return challan;
  }

  const [enriched] = await enrichChallansWithOperationalMetadata([
    challan,
  ]);

  return enriched || challan;
}

/* Legacy aliases retained for old screen imports. */
export async function fetchTrips() {
  return fetchDispatchedChallans();
}

export async function fetchTripItems(challanNumber) {
  const challan = await fetchDispatchedChallan(challanNumber);
  return Array.isArray(challan?.items)
    ? challan.items
    : [];
}

export async function endTrip() {
  throw new Error(
    "Driver delivery / POD flow has been removed from the current PackFlow backend."
  );
}

export async function startTrip() {
  throw new Error(
    "Driver trip-start flow has been removed. Dispatch challan timing is authoritative."
  );
}

export async function updateTripLocation() {
  throw new Error(
    "Live location tracking has been removed from the current PackFlow backend."
  );
}

export async function endDispatchedChallanTrip(
  challanNumber,
  tripEndedAt
) {
  const cleanChallan = String(challanNumber || "").trim();

  if (!cleanChallan) {
    throw new Error("Challan number is required.");
  }

  const res = await api.post(
    `/api/dispatched/challans/${encodeURIComponent(cleanChallan)}/end-trip`,
    { tripEndedAt }
  );

  return res.data;
}
