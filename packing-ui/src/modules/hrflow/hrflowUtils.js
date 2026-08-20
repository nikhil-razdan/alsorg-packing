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

export const publicApplicationUrl = (rawToken) =>
	`${window.location.origin}/hr/apply/${encodeURIComponent(rawToken)}`;

export const publicOnboardingUrl = (rawToken) =>
	`${window.location.origin}/hr/onboarding/${encodeURIComponent(rawToken)}`;
