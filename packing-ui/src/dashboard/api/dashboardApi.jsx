/**
 * Dashboard API
 * Centralized dashboard data fetching
 */

export async function fetchDashboardStats() {
  const res = await fetch("/api/reports/dashboard", {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to load dashboard stats");
  return res.json();
}

export async function fetchDashboardActivity(limit = 10) {
  const res = await fetch(
    `/api/reports/dashboard/activity?limit=${limit}`,
    { credentials: "include" }
  );

  if (!res.ok) throw new Error("Failed to load activity feed");
  return res.json();
}

export async function fetchInventoryAging() {
  const res = await fetch("/api/reports/inventory-aging", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch inventory aging");
  }

  return res.json();
}

export async function fetchPackingReport(from, to) {
  const res = await fetch(
    `/api/reports/packing?from=${from}&to=${to}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Packing report failed");
  return res.json();
}

export async function fetchDispatchReport(from, to) {
  const res = await fetch(
    `/api/reports/dispatch?from=${from}&to=${to}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Dispatch report failed");
  return res.json();
}


