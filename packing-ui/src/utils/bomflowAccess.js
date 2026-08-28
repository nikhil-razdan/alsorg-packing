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

const resolveBomFlowRoles = (value) => {
	if (Array.isArray(value)) {
		return Array.from(new Set(value.map(normalizeRole).filter((role) => BOMFLOW_ROLES.includes(role))));
	}

	if (value && typeof value === "object") {
		return rolesFromUser(value).filter((role) => BOMFLOW_ROLES.includes(role));
	}

	const scalar = normalizeRole(value);
	const runtimeRoles = rolesFromUser(getRuntimeAuthUser())
		.filter((role) => BOMFLOW_ROLES.includes(role));

	/*
	 * Legacy callers often pass getBomFlowRole(), which is a single string.
	 * If that scalar is one of the current user's effective BOMFlow roles,
	 * evaluate permissions against the complete role union so a user such as
	 * EDITOR + APPROVER does not lose either capability in the UI.
	 */
	if (scalar && runtimeRoles.includes(scalar)) {
		return runtimeRoles;
	}

	if (scalar && BOMFLOW_ROLES.includes(scalar)) {
		return [scalar];
	}

	return runtimeRoles;
};

const resolveBomFlowRole = (value) =>
	resolveBomFlowRoles(value)[0] || "";

const hasAnyBomFlowRole = (value, allowed) =>
	resolveBomFlowRoles(value).some((role) => allowed.includes(role));

export const getBomFlowRole = () =>
	resolveBomFlowRole(getRuntimeAuthUser());

export const getBomFlowRoles = () =>
	resolveBomFlowRoles(getRuntimeAuthUser());

export const hasBomFlowAccess = (
	role = getRuntimeAuthUser()
) => resolveBomFlowRoles(role).length > 0;

export const canEditBomFlowRevision = (
	role = getRuntimeAuthUser()
) => hasAnyBomFlowRole(role, [
	"ADMIN",
	"BOMFLOW_MANAGER",
	"BOMFLOW_EDITOR",
]);

export const canSubmitBomFlowRevision =
	canEditBomFlowRevision;

export const canReviewBomFlowRevision = (
	role = getRuntimeAuthUser()
) => hasAnyBomFlowRole(role, [
	"ADMIN",
	"BOMFLOW_MANAGER",
	"BOMFLOW_REVIEWER",
	"BOMFLOW_APPROVER",
]);

export const canApproveBomFlowRevision = (
	role = getRuntimeAuthUser()
) => hasAnyBomFlowRole(role, [
	"ADMIN",
	"BOMFLOW_MANAGER",
	"BOMFLOW_APPROVER",
]);

export const canAccessBomFlowScreen = (
	screen,
	role = getRuntimeAuthUser()
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
	role = getRuntimeAuthUser()
) => hasBomFlowAccess(role)
	? "/bomflow/dashboard"
	: "/modules";

export { BOMFLOW_ROLES };
