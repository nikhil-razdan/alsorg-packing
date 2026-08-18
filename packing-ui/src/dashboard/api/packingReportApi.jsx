import { API_BASE_URL } from "../../config";

/**
 * Packing Report API
 *
 * Existing packing report contract is preserved.
 * The packet-level volume endpoint is additive and returns the dimensions,
 * calculated cubic metre value, packed user and packed timestamp used by the
 * Inventory Reports workspace.
 */
const authHeaders = () => {
  const token = localStorage.getItem("token");

  if (
    !token ||
    token === "null" ||
    token === "undefined"
  ) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

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

export async function fetchPackingReport(from, to) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/packing?${buildRangeQuery(from, to)}`,
    {
      credentials: "include",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(
      await readError(res, "Failed to fetch packing report")
    );
  }

  return res.json();
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
export async function fetchPackingVolumeReport(from, to) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/packing/volume?${buildRangeQuery(from, to)}`,
    {
      credentials: "include",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(
      await readError(res, "Failed to fetch packing volume report")
    );
  }

  const data = await res.json();

  return Array.isArray(data) ? data : [];
}

/**
 * Existing report export helper retained.
 *
 * We continue opening the existing backend export route so callers that rely
 * on this helper keep the same browser behaviour. The generated Excel now
 * contains the volume-aware backend sheets introduced in the reporting fix.
 */
export function exportPackingReport(type, from, to) {
  const query = buildRangeQuery(from, to);

  const url =
    type === "csv"
      ? `${API_BASE_URL}/api/reports/export/packing/csv?${query}`
      : `${API_BASE_URL}/api/reports/export/packing/excel?${query}`;

  window.open(url, "_blank", "noopener,noreferrer");
}
