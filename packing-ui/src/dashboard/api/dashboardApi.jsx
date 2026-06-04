import { API_BASE_URL } from "../../config";

/**
 * Dashboard API
 * Centralized dashboard data fetching
 */
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export async function fetchDashboardStats() {
  const res = await fetch(`${API_BASE_URL}/api/reports/dashboard`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error("Failed to load dashboard stats");
  return res.json();
}

export async function fetchDashboardActivity(limit = 10) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/dashboard/activity?limit=${limit}`,
    { headers: authHeaders() }
  );

  if (!res.ok) throw new Error("Failed to load activity feed");
  return res.json();
}

export async function fetchInventoryAging() {
  const res = await fetch(`${API_BASE_URL}/api/reports/inventory-aging`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch inventory aging");
  }

  return res.json();
}

export async function fetchPackingReport(from, to) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/packing?from=${from}&to=${to}`,
    { headers: authHeaders()}
  );
  if (!res.ok) throw new Error("Packing report failed");
  return res.json();
}

export async function fetchDispatchReport(from, to) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/dispatch?from=${from}&to=${to}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Dispatch report failed");
  return res.json();
}

export async function fetchCombinedReport(
  from,
  to
) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/combined?from=${encodeURIComponent(
      from
    )}&to=${encodeURIComponent(to)}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Combined report failed"
    );
  }

  return res.json();
}

export async function fetchLogisticsStats() {
  const res = await fetch(`${API_BASE_URL}/api/analytics`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!res.ok) throw new Error("Failed analytics");
  return res.json();
}

export async function fetchDailyThroughputUsers(type) {
  const res = await fetch(
    `${API_BASE_URL}/api/reports/dashboard/daily-throughput/users?type=${encodeURIComponent(type)}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load throughput user data");
  }

  return res.json();
}