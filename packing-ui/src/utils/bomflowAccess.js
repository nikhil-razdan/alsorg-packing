const BOMFLOW_ROLES = Object.freeze([
	"ADMIN",
	"BOMFLOW_MANAGER",
	"BOMFLOW_EDITOR",
	"BOMFLOW_REVIEWER",
	"BOMFLOW_APPROVER",
]);

const normalizeRole = (value) => {
	return String(value || "")
		.replace(/^ROLE_/i, "")
		.trim()
		.toUpperCase();
};

const safeParse = (value) => {
	if (!value) {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

export const getBomFlowRole = () => {
	if (typeof window === "undefined") {
		return "";
	}

	const directCandidates = [
		localStorage.getItem("role"),
		localStorage.getItem("userRole"),
		localStorage.getItem("currentRole"),
	];

	for (const candidate of directCandidates) {
		const role = normalizeRole(candidate);

		if (role) {
			return role;
		}
	}

	const storedUser =
		safeParse(localStorage.getItem("user")) ||
		safeParse(localStorage.getItem("authUser")) ||
		safeParse(localStorage.getItem("currentUser"));

	const nestedRole = normalizeRole(
		storedUser?.role ||
			storedUser?.primaryRole ||
			storedUser?.roles?.[0]
	);

	return nestedRole;
};

export const hasBomFlowAccess = (role = getBomFlowRole()) => {
	return BOMFLOW_ROLES.includes(normalizeRole(role));
};

export const canEditBomFlowRevision = (
	role = getBomFlowRole()
) => {
	const normalized = normalizeRole(role);

	return [
		"ADMIN",
		"BOMFLOW_MANAGER",
		"BOMFLOW_EDITOR",
	].includes(normalized);
};

export const canSubmitBomFlowRevision =
	canEditBomFlowRevision;

export const canReviewBomFlowRevision = (
	role = getBomFlowRole()
) => {
	const normalized = normalizeRole(role);

	return [
		"ADMIN",
		"BOMFLOW_MANAGER",
		"BOMFLOW_REVIEWER",
		"BOMFLOW_APPROVER",
	].includes(normalized);
};

export const canApproveBomFlowRevision = (
	role = getBomFlowRole()
) => {
	const normalized = normalizeRole(role);

	return [
		"ADMIN",
		"BOMFLOW_MANAGER",
		"BOMFLOW_APPROVER",
	].includes(normalized);
};

export const canAccessBomFlowScreen = (
	screen,
	role = getBomFlowRole()
) => {
	if (!hasBomFlowAccess(role)) {
		return false;
	}

	const normalizedScreen = String(screen || "")
		.trim()
		.toLowerCase();

	if (!normalizedScreen) {
		return true;
	}

	if (
		[
			"home",
			"dashboard",
			"products",
			"product-master",
			"bom-builder",
			"builder",
			"rate-master",
			"labour-master",
			"costing",
			"reports",
		].includes(normalizedScreen)
	) {
		return true;
	}

	return false;
};

export const defaultBomFlowPathForRole = (
	role = getBomFlowRole()
) => {
	return hasBomFlowAccess(role)
		? "/bomflow/dashboard"
		: "/modules";
};

export { BOMFLOW_ROLES };
