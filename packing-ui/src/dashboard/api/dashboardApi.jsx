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

export async function fetchLogisticsStats() {
  const res = await fetch(`${API_BASE_URL}/api/analytics`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!res.ok) throw new Error("Failed analytics");
  return res.json();
}

const toLocalDateParam = (value = new Date()) => {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  const local =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() * 60000
    );

  return local.toISOString().slice(0, 10);
};

export async function fetchDailyThroughputUserBreakdown(
  type,
  date = new Date()
) {
  const day = toLocalDateParam(date);

  const res = await fetch(
    `${API_BASE_URL}/api/reports/dashboard/daily-throughput/users?type=${encodeURIComponent(
      type
    )}&date=${day}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load daily user throughput");
  }

  return res.json();
}