import { API_BASE_URL } from "../../config";

/**
 * Dashboard API
 * Uses HttpOnly cookie auth.
 */

const requestJson = async (
	path,
	errorMessage
) => {
	const res = await fetch(`${API_BASE_URL}${path}`, {
		credentials: "include",
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || errorMessage);
	}

	return res.json();
};

export async function fetchDashboardStats() {
	return requestJson(
		"/api/reports/dashboard",
		"Failed to load dashboard stats"
	);
}

export async function fetchDashboardActivity(
	limit = 10
) {
	return requestJson(
		`/api/reports/dashboard/activity?limit=${encodeURIComponent(limit)}`,
		"Failed to load activity feed"
	);
}

export async function fetchInventoryAging() {
	return requestJson(
		"/api/reports/inventory-aging",
		"Failed to fetch inventory aging"
	);
}

export async function fetchPackingReport(
	from,
	to
) {
	return requestJson(
		`/api/reports/packing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		"Packing report failed"
	);
}

export async function fetchDispatchReport(
	from,
	to
) {
	return requestJson(
		`/api/reports/dispatch?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		"Dispatch report failed"
	);
}

export async function fetchCombinedReport(
	from,
	to
) {
	return requestJson(
		`/api/reports/combined?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		"Combined report failed"
	);
}

export async function fetchLogisticsStats() {
	return requestJson(
		"/api/analytics",
		"Failed analytics"
	);
}

export async function fetchDailyThroughputUsers(
	type
) {
	return requestJson(
		`/api/reports/dashboard/daily-throughput/users?type=${encodeURIComponent(type)}`,
		"Failed to load throughput user data"
	);
}