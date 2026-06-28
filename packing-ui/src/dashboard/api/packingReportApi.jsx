import { API_BASE_URL } from "../config";

/**
 * Packing Report API
 * Uses HttpOnly cookie auth.
 */

export async function fetchPackingReport(
	from,
	to
) {
	const res = await fetch(
		`${API_BASE_URL}/api/reports/packing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		{
			credentials: "include",
		}
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || "Failed to fetch packing report");
	}

	return res.json();
}

export async function exportPackingReport(
	type,
	from,
	to
) {
	const url =
		type === "csv"
			? `${API_BASE_URL}/api/reports/export/packing/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
			: `${API_BASE_URL}/api/reports/export/packing/excel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

	const res = await fetch(url, {
		credentials: "include",
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || "Export failed");
	}

	const blob = await res.blob();

	const disposition =
		res.headers.get("Content-Disposition") || "";

	let filename =
		type === "csv"
			? "packing_report.csv"
			: "packing_report.xlsx";

	const match =
		disposition.match(/filename="?([^"]+)"?/);

	if (match && match[1]) {
		filename = match[1];
	}

	const blobUrl =
		window.URL.createObjectURL(blob);

	const a =
		document.createElement("a");

	a.href = blobUrl;
	a.download = filename;

	document.body.appendChild(a);
	a.click();
	a.remove();

	window.URL.revokeObjectURL(blobUrl);
}