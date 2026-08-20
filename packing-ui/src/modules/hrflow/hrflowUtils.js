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

export const formatDate = (value) => {
	if (!value) return "—";
	const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
};

export const formatDateTime = (value) => {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
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

export const pageContent = (response) => response?.data?.content || [];
export const totalElements = (response) => Number(response?.data?.totalElements || 0);

export const copyText = async (value) => {
	const text = String(value || "");
	if (!text) return false;
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const input = document.createElement("textarea");
		input.value = text;
		input.style.position = "fixed";
		input.style.opacity = "0";
		document.body.appendChild(input);
		input.select();
		const success = document.execCommand("copy");
		input.remove();
		return success;
	}
};

export const saveBlob = (response, fallbackName = "download") => {
	const blob = response?.data;
	if (!blob) return;
	const disposition = String(response?.headers?.["content-disposition"] || "");
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
	anchor.download = name;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
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
	if (!cleanToken) return "";
	return `${window.location.origin}${normalizedBasePath()}/hr/${mode}/${encodeURIComponent(cleanToken)}`;
};

export const publicApplicationUrl = (rawToken) =>
	publicHrUrl("apply", rawToken);

export const publicOnboardingUrl = (rawToken) =>
	publicHrUrl("onboarding", rawToken);
