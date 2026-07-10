import { API_BASE_URL } from "../../config";

const getStoredToken = () => {
	const possibleKeys = [
		"token",
		"authToken",
		"jwt",
		"accessToken",
	];

	for (const key of possibleKeys) {
		const value =
			localStorage.getItem(key);

		if (value && value.trim()) {
			const token =
				value.trim();

			return token.startsWith("Bearer ")
				? token
				: `Bearer ${token}`;
		}
	}

	return "";
};

const buildAuthHeaders = (
	extra = {}
) => {
	const headers = {
		...extra,
	};

	const token =
		getStoredToken();

	if (token) {
		headers.Authorization = token;
	}

	return headers;
};

const readResponsePayload = async (res) => {
	const contentType =
		(
			res.headers.get(
				"content-type"
			) || ""
		).toLowerCase();

	if (res.status === 204) {
		return null;
	}

	if (contentType.includes("json")) {
		try {
			return await res.json();
		} catch {
			return null;
		}
	}

	try {
		return await res.text();
	} catch {
		return null;
	}
};

const getApiErrorMessage = (
	payload,
	fallbackMessage
) => {
	if (typeof payload === "string" && payload.trim()) {
		return payload.trim();
	}

	return (
		payload?.message ||
		payload?.error ||
		payload?.detail ||
		fallbackMessage
	);
};

const requestJson = async (
	path,
	errorMessage,
	options = {}
) => {
	const {
		method = "GET",
		body,
		headers: extraHeaders = {},
	} = options;

	const hasBody =
		body !== undefined &&
		body !== null;

	const res =
		await fetch(`${API_BASE_URL}${path}`, {
			method,
			credentials: "include",
			cache: "no-store",

			headers: buildAuthHeaders({
				Accept: "application/json",

				...(hasBody
					? {
						"Content-Type":
							"application/json",
					}
					: {}),

				...extraHeaders,
			}),

			body: hasBody
				? JSON.stringify(body)
				: undefined,
		});

	const payload =
		await readResponsePayload(res);

	if (!res.ok) {
		const message =
			getApiErrorMessage(
				payload,
				errorMessage
			);

		if (res.status === 401) {
			throw new Error(
				message ||
				"Unauthorized. Please login again."
			);
		}

		if (res.status === 403) {
			throw new Error(
				message ||
				"Only ADMIN can perform this action."
			);
		}

		if (res.status === 404) {
			throw new Error(
				message ||
				"The selected record no longer exists."
			);
		}

		if (res.status === 409) {
			throw new Error(
				message ||
				"Deletion was blocked by another linked record."
			);
		}

		throw new Error(
			message ||
			errorMessage
		);
	}

	return payload;
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

export async function fetchDashboardTrace({
	type = "all",
	from,
	to,
	search,
	limit = 250,
	offset = 0,
} = {}) {
	const params = new URLSearchParams();

	params.set("type", type);
	params.set("limit", String(limit));
	params.set("offset", String(offset));

	if (from) {
		params.set("from", from);
	}

	if (to) {
		params.set("to", to);
	}

	if (search) {
		params.set("search", search);
	}

	return requestJson(
		`/api/reports/dashboard/inventory-trace?${params.toString()}`,
		"Failed to load inventory traceability"
	);
}

export async function fetchMasterItemReport({
	status = "ALL",
	search = "",
	plantCode = "",
	client = "",
	from,
	to,
	limit = 500,
	offset = 0,
	page,
	size,
} = {}) {
	const params = new URLSearchParams();

	const finalLimit =
		Number(limit || size || 500);

	const finalOffset =
		Number(offset || 0);

	const finalPage =
		page !== undefined && page !== null
			? Number(page)
			: Math.floor(finalOffset / finalLimit);

	params.set("status", status || "ALL");
	params.set("packingStatus", status || "ALL");

	params.set("limit", String(finalLimit));
	params.set("offset", String(finalOffset));

	params.set("page", String(finalPage));
	params.set("size", String(finalLimit));

	if (search) {
		params.set("search", search);
	}

	if (plantCode) {
		params.set("plantCode", plantCode);
	}

	if (client) {
		params.set("client", client);
		params.set("clientName", client);
	}

	if (from) {
		params.set("from", from);
	}

	if (to) {
		params.set("to", to);
	}

	return requestJson(
		`/api/reports/dashboard/master-items?${params.toString()}`,
		"Failed to load master item report"
	);
}

export async function fetchMasterItems({
	search = "",
	packingStatus = "ALL",
	plantCode = "",
	clientName = "",
	from = "",
	to = "",
	page = 0,
	size = 20,
} = {}) {
	const params = new URLSearchParams();

	if (search) {
		params.set("search", search);
	}

	if (packingStatus && packingStatus !== "ALL") {
		params.set("packingStatus", packingStatus);
	}

	if (plantCode) {
		params.set("plantCode", plantCode);
	}

	if (clientName) {
		params.set("clientName", clientName);
	}

	if (from) {
		params.set("from", from);
	}

	if (to) {
		params.set("to", to);
	}

	params.set("page", String(page));
	params.set("size", String(size));

	return requestJson(
		`/api/reports/dashboard/master-items?${params.toString()}`,
		"Failed to load master items"
	);
}

export async function fetchMasterItemDetail(
	masterItemId
) {
	if (!masterItemId) {
		throw new Error("Master item id missing");
	}

	return requestJson(
		`/api/reports/dashboard/master-items/${encodeURIComponent(masterItemId)}`,
		"Failed to load master item details"
	);
}

export function buildDashboardFileUrl(path) {
	if (!path) {
		return "";
	}

	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	return `${API_BASE_URL}${path}`;
}

export function openDashboardPdf(path) {
	const url =
		buildDashboardFileUrl(path);

	if (!url) {
		alert("PDF is not available.");
		return;
	}

	window.open(
		url,
		"_blank",
		"noopener,noreferrer"
	);
}

export async function downloadDashboardPdf(
	path,
	filename = "document.pdf"
) {
	const url =
		buildDashboardFileUrl(path);

	if (!url) {
		alert("PDF is not available.");
		return;
	}

	try {
		const res =
			await fetch(url, {
				credentials: "include",
			});

		if (!res.ok) {
			const text =
				await res.text();

			throw new Error(
				text || "Failed to download PDF"
			);
		}

		const blob =
			await res.blob();

		const objectUrl =
			window.URL.createObjectURL(blob);

		const link =
			document.createElement("a");

		link.href = objectUrl;
		link.download = filename;

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		window.URL.revokeObjectURL(objectUrl);
	} catch (e) {
		console.error(e);

		alert(
			e.message ||
			"Failed to download PDF"
		);
	}
}

export async function fetchProtectedDashboardPdfBlob(path) {
	const url =
		buildDashboardFileUrl(path);

	if (!url) {
		throw new Error("PDF URL missing");
	}

	const res =
		await fetch(url, {
			method: "GET",
			credentials: "include",
			cache: "no-store",
			headers: buildAuthHeaders({
				Accept: "application/pdf",
			}),
		});

	const contentType =
		res.headers.get("content-type") || "";

	if (!res.ok || !contentType.includes("pdf")) {
		const text =
			await res.text();

		throw new Error(
			text || "Failed to load PDF"
		);
	}

	return res.blob();
}

export async function openProtectedDashboardPdf(path) {
	try {
		const blob =
			await fetchProtectedDashboardPdfBlob(path);

		const objectUrl =
			window.URL.createObjectURL(blob);

		window.open(
			objectUrl,
			"_blank",
			"noopener,noreferrer"
		);

		setTimeout(() => {
			window.URL.revokeObjectURL(objectUrl);
		}, 30000);
	} catch (e) {
		console.error(e);

		alert(
			e.message ||
			"Failed to open PDF"
		);
	}
}

export async function downloadProtectedDashboardPdf(
	path,
	filename = "document.pdf"
) {
	try {
		const blob =
			await fetchProtectedDashboardPdfBlob(path);

		const objectUrl =
			window.URL.createObjectURL(blob);

		const link =
			document.createElement("a");

		link.href = objectUrl;
		link.download = filename;

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		window.URL.revokeObjectURL(objectUrl);
	} catch (e) {
		console.error(e);

		alert(
			e.message ||
			"Failed to download PDF"
		);
	}
}

export function latestStickerPdfPath(
	packetItemId,
	download = false
) {
	if (!packetItemId) {
		return "";
	}

	return `/api/inventory/stickers/packet-items/${encodeURIComponent(
		packetItemId
	)}/latest?download=${download ? "true" : "false"}`;
}

/* =========================================================
   ADMIN DELETE CENTER
   ========================================================= */

export async function searchAdminPacketItems({
	query,
	page = 0,
	size = 20,
} = {}) {
	const cleanQuery =
		String(query || "").trim();

	if (!cleanQuery) {
		throw new Error(
			"Enter a packet, item, PD number, SKU, sticker number or UUID."
		);
	}

	const params =
		new URLSearchParams();

	params.set("query", cleanQuery);
	params.set("page", String(page));
	params.set("size", String(size));

	return requestJson(
		`/api/admin/deletions/packet-items/search?${params.toString()}`,
		"Failed to search packet items"
	);
}

export async function searchAdminMasterItems({
	query,
	page = 0,
	size = 20,
} = {}) {
	const cleanQuery =
		String(query || "").trim();

	if (!cleanQuery) {
		throw new Error(
			"Enter a master item, PD number, drawing, client or UUID."
		);
	}

	const params =
		new URLSearchParams();

	params.set("query", cleanQuery);
	params.set("page", String(page));
	params.set("size", String(size));

	return requestJson(
		`/api/admin/deletions/master-items/search?${params.toString()}`,
		"Failed to search master items"
	);
}

export async function previewAdminPacketDeletion(
	packetItemId
) {
	if (!packetItemId) {
		throw new Error(
			"Packet item ID is missing."
		);
	}

	return requestJson(
		`/api/admin/deletions/packet-items/${encodeURIComponent(
			packetItemId
		)}/preview`,
		"Failed to preview packet deletion"
	);
}

export async function previewAdminMasterDeletion(
	masterItemId
) {
	if (!masterItemId) {
		throw new Error(
			"Master item ID is missing."
		);
	}

	return requestJson(
		`/api/admin/deletions/master-items/${encodeURIComponent(
			masterItemId
		)}/preview`,
		"Failed to preview master deletion"
	);
}

export async function executeAdminPacketDeletion(
	packetItemId,
	{
		confirmationText = "",
		reason = "",
	} = {}
) {
	if (!packetItemId) {
		throw new Error(
			"Packet item ID is missing."
		);
	}

	return requestJson(
		`/api/admin/deletions/packet-items/${encodeURIComponent(
			packetItemId
		)}/execute`,
		"Failed to permanently delete packet",
		{
			method: "POST",

			body: {
				confirmationText,
				reason,
			},
		}
	);
}

export async function executeAdminMasterDeletion(
	masterItemId,
	{
		confirmationText = "",
		reason = "",
	} = {}
) {
	if (!masterItemId) {
		throw new Error(
			"Master item ID is missing."
		);
	}

	return requestJson(
		`/api/admin/deletions/master-items/${encodeURIComponent(
			masterItemId
		)}/execute`,
		"Failed to permanently delete master item",
		{
			method: "POST",

			body: {
				confirmationText,
				reason,
			},
		}
	);
}

export async function fetchAdminDeletionHistory({
	page = 0,
	size = 20,
} = {}) {
	const params =
		new URLSearchParams();

	params.set("page", String(page));
	params.set("size", String(size));

	return requestJson(
		`/api/admin/deletions/history?${params.toString()}`,
		"Failed to load deletion history"
	);
}