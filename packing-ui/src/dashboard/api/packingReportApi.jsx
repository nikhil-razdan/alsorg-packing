/**
 * Packing Report API
 */

export async function fetchPackingReport(from, to) {
  const res = await fetch(
    `/api/reports/packing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { credentials: "include" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch packing report");
  }

  return res.json();
}

export function exportPackingReport(type, from, to) {
  const url =
    type === "csv"
      ? `/api/reports/export/packing/csv?from=${from}&to=${to}`
      : `/api/reports/export/packing/excel?from=${from}&to=${to}`;

  window.open(url, "_blank");
}
