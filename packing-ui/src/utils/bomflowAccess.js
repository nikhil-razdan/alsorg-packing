import {
	getRuntimeAuthUser,
} from "./runtimeAuthState";

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

const rolesFromUser = (user) => {
	if (!user || typeof user !== "object") {
		return [];
	}

	const roles = Array.isArray(user.roles)
		? user.roles
		: [];

	return Array.from(
		new Set(
			[...roles, user.role]
				.map(normalizeRole)
				.filter(Boolean)
		)
	);
};

const resolveBomFlowRole = (value) => {
	if (typeof value === "string") {
		return normalizeRole(value);
	}

	const roles = rolesFromUser(value);

	return (
		BOMFLOW_ROLES.find((role) =>
			roles.includes(role)
		) || ""
	);
};

/*
 * Compatibility function retained for existing BOMFlow callers, but the role
 * now comes from the current in-memory AuthContext snapshot rather than
 * localStorage. Backend authorization remains authoritative.
 */
export const getBomFlowRole = () => {
	return resolveBomFlowRole(
		getRuntimeAuthUser()
	);
};

export const hasBomFlowAccess = (
	role = getBomFlowRole()
) => {
	return BOMFLOW_ROLES.includes(
		resolveBomFlowRole(role)
	);
};

export const canEditBomFlowRevision = (
	role = getBomFlowRole()
) => {
	const normalized =
		resolveBomFlowRole(role);

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
	const normalized =
		resolveBomFlowRole(role);

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
	const normalized =
		resolveBomFlowRole(role);

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

	return [
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
	].includes(normalizedScreen);
};

export const defaultBomFlowPathForRole = (
	role = getBomFlowRole()
) => {
	return hasBomFlowAccess(role)
		? "/bomflow/dashboard"
		: "/modules";
};

export { BOMFLOW_ROLES };
