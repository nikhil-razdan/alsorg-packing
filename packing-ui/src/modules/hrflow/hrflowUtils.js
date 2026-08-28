export const HR_CANDIDATE_STAGES = [
	"NEW",
	"APPLICATION_SENT",
	"APPLICATION_IN_PROGRESS",
	"APPLICATION_SUBMITTED",
	"HR_REVIEW",
	"INTERVIEW",
	"SELECTED",
	"OFFERED",
	"PRE_JOINING",
	"JOINED",
	"REJECTED",
	"ON_HOLD",
	"WITHDRAWN",
	"NO_SHOW",
];

export const HR_ONBOARDING_STATUSES = [
	"OPEN",
	"DOCUMENTS_PENDING",
	"READY_TO_JOIN",
	"JOINED",
	"ONBOARDING_COMPLETE",
	"CANCELLED",
];

export const HR_EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "EXITED"];

export const HR_ACCESS_ROLES = [
	"HR_ADMIN",
	"HR_HEAD",
	"HR_EXECUTIVE",
	"RECRUITER",
	"HOD",
];

export const HR_UPLOAD_DOCUMENT_TYPES = [
	"PHOTO",
	"RESUME",
	"AADHAAR",
	"PAN",
	"DRIVING_LICENSE",
	"EDUCATION_CERTIFICATE",
	"EXPERIENCE_LETTER",
	"ADDRESS_PROOF",
	"OFFER_ACCEPTANCE",
	"OTHER",
];

export const humanize = (value) =>
	String(value || "")
		.replaceAll("_", " ")
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase());

const LOCAL_DATE_RE = /^(\\d{4})-(\\d{2})-(\\d{2})$/;
const LOCAL_DATE_TIME_RE =
	/^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,9}))?)?$/;

export const parseHrDateTime = (value) => {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
	}

	const raw = String(value ?? "").trim();
	if (!raw) return null;

	const dateOnly = raw.match(LOCAL_DATE_RE);
	if (dateOnly) {
		const date = new Date(
			Number(dateOnly[1]),
			Number(dateOnly[2]) - 1,
			Number(dateOnly[3]),
			0,
			0,
			0,
			0
		);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	/*
	 * Spring LocalDateTime has no timezone. It represents FlowSuite business
	 * local wall-clock time, so construct it with numeric Date parts instead of
	 * relying on browser-specific string parsing or accidentally treating it as
	 * UTC. Offset/Z timestamps still use the native parser.
	 */
	const localDateTime = raw.match(LOCAL_DATE_TIME_RE);
	if (localDateTime) {
		const milliseconds = Number(
			String(localDateTime[7] || "")
				.padEnd(3, "0")
				.slice(0, 3) || 0
		);
		const date = new Date(
			Number(localDateTime[1]),
			Number(localDateTime[2]) - 1,
			Number(localDateTime[3]),
			Number(localDateTime[4]),
			Number(localDateTime[5]),
			Number(localDateTime[6] || 0),
			milliseconds
		);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value) => {
	if (!value) return "—";
	const date = parseHrDateTime(String(value).slice(0, 10));
	if (!date) return String(value);
	return date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
};

export const formatDateTime = (value) => {
	if (!value) return "—";
	const date = parseHrDateTime(value);
	if (!date) return String(value);
	return date.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const money = (value) => {
	if (value === null || value === undefined || value === "") return "—";
	const number = Number(value);
	if (Number.isNaN(number)) return String(value);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(number);
};

export const apiMessage = (error, fallback = "Something went wrong.") =>
	error?.response?.data?.message ||
	error?.response?.data?.error ||
	error?.message ||
	fallback;

export const blobApiMessage = async (error, fallback = "Something went wrong.") => {
	const data = error?.response?.data;
	if (typeof Blob !== "undefined" && data instanceof Blob) {
		try {
			const text = await data.text();
			if (text) {
				try {
					const json = JSON.parse(text);
					return json?.message || json?.error || text || fallback;
				} catch {
					return text;
				}
			}
		} catch {
			// Fall through to the ordinary Axios error message.
		}
	}
	return apiMessage(error, fallback);
};

export const pageContent = (response) => {
	const payload = response?.data;
	if (Array.isArray(payload)) return payload;
	if (Array.isArray(payload?.content)) return payload.content;
	if (Array.isArray(payload?.rows)) return payload.rows;
	if (Array.isArray(payload?.data)) return payload.data;
	return [];
};

export const totalElements = (response) => {
	const payload = response?.data;
	if (Array.isArray(payload)) return payload.length;
	const fallback = pageContent(response).length;
	const total = Number(payload?.totalElements ?? payload?.total ?? fallback);
	return Number.isFinite(total) && total >= 0 ? total : fallback;
};

export const totalPages = (response, fallbackPageSize = 1) => {
	const payload = response?.data;
	const explicit = Number(payload?.totalPages);
	if (Number.isFinite(explicit) && explicit >= 0) return explicit;

	const size = Math.max(
		1,
		Number(payload?.size ?? fallbackPageSize) || fallbackPageSize || 1
	);
	return Math.ceil(totalElements(response) / size);
};

export const pageNumber = (response, fallback = 0) => {
	const payload = response?.data;
	const page = Number(payload?.number ?? payload?.page ?? fallback);
	return Number.isFinite(page) && page >= 0 ? page : fallback;
};

export const copyText = async (value) => {
	const text = String(value || "");
	if (!text || typeof document === "undefined") return false;
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fall back to the temporary textarea path below.
	}

	try {
		const input = document.createElement("textarea");
		input.value = text;
		input.setAttribute("readonly", "");
		input.style.position = "fixed";
		input.style.left = "-9999px";
		input.style.opacity = "0";
		document.body.appendChild(input);
		input.select();
		const success = document.execCommand("copy");
		input.remove();
		return success;
	} catch {
		return false;
	}
};

const safeDownloadName = (value, fallback = "download") => {
	const cleaned = String(value || fallback)
		.replace(/[\\/\\\\?%*:|"<>\\u0000-\\u001f]/g, "_")
		.replace(/\\s+/g, " ")
		.trim()
		.slice(0, 180);
	return cleaned || fallback;
};

const responseHeader = (headers, name) => {
	if (!headers) return "";
	if (typeof headers.get === "function") return String(headers.get(name) || "");
	return String(headers[name] || headers[name.toLowerCase()] || "");
};

export const saveBlob = (response, fallbackName = "download") => {
	const blob = response?.data;
	if (
		typeof Blob === "undefined" ||
		!(blob instanceof Blob) ||
		blob.size <= 0 ||
		typeof document === "undefined"
	) {
		return false;
	}

	const disposition = responseHeader(response?.headers, "content-disposition");
	const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	const plain = disposition.match(/filename="?([^";]+)"?/i);
	let name = fallbackName;

	try {
		if (utf8?.[1]) name = decodeURIComponent(utf8[1]);
		else if (plain?.[1]) name = plain[1];
	} catch {
		name = fallbackName;
	}

	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = safeDownloadName(name, safeDownloadName(fallbackName));
	anchor.rel = "noopener";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
	return true;
};

const normalizedBasePath = () => {
	if (typeof window === "undefined") return "";

	// Prefer the bundler/deployment base when one is configured.
	const viteBase = String(import.meta.env?.BASE_URL || "").trim();
	if (viteBase && viteBase !== "/" && viteBase !== "./") {
		const clean = `/${viteBase}`.replace(/\/+/g, "/").replace(/\/$/, "");
		return clean === "/" ? "" : clean;
	}

	// Fallback for reverse-proxy deployments that mount FlowSuite below a path
	// even when Vite BASE_URL was left at '/'.
	const pathname = String(window.location.pathname || "");
	const markers = [
		"/modules",
		"/packflow",
		"/bomflow",
		"/matflow",
		"/users",
		"/hr",
	];
	const indexes = markers
		.map((marker) => pathname.toLowerCase().indexOf(marker))
		.filter((index) => index >= 0);
	if (!indexes.length) return "";
	const index = Math.min(...indexes);
	return index > 0 ? pathname.slice(0, index).replace(/\/$/, "") : "";
};

const publicHrUrl = (mode, rawToken) => {
	const cleanToken = String(rawToken || "").trim();
	if (!cleanToken || typeof window === "undefined") return "";
	return `${window.location.origin}${normalizedBasePath()}/hr/${mode}/${encodeURIComponent(cleanToken)}`;
};

export const publicApplicationUrl = (rawToken) =>
	publicHrUrl("apply", rawToken);

export const publicOnboardingUrl = (rawToken) =>
	publicHrUrl("onboarding", rawToken);
