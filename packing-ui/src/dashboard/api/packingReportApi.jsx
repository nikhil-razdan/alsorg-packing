import { API_BASE_URL } from "../config";
/**
 * Packing Report API
 */
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export async function fetchPackingReport(from, to) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/packing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: authHeaders() }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch packing report");
  }

  return res.json();
}

export function exportPackingReport(type, from, to) {
  const url =
    type === "csv"
      ? `${API_BASE_URL}/api/reports/export/packing/csv?from=${from}&to=${to}`
      : `${API_BASE_URL}/api/reports/export/packing/excel?from=${from}&to=${to}`;

  window.open(url, "_blank");
}
