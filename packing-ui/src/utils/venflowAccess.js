import { normalizeRole } from "../utils/permissions";

export const VENFLOW_ROLES = {
	ADMIN: "ADMIN",
	MANAGER: "VENFLOW_MANAGER",
	PRODUCTION: "VENFLOW_PRODUCTION",
	STORE: "VENFLOW_STORE",
	PURCHASE: "VENFLOW_PURCHASE",
};

export const isVenFlowAdmin = (role) => {
	return normalizeRole(role) === VENFLOW_ROLES.ADMIN;
};

export const isVenFlowManager = (role) => {
	return normalizeRole(role) === VENFLOW_ROLES.MANAGER;
};

export const isVenFlowAdminOrManager = (role) => {
	const cleanRole = normalizeRole(role);

	return (
		cleanRole === VENFLOW_ROLES.ADMIN ||
		cleanRole === VENFLOW_ROLES.MANAGER
	);
};

export const isVenFlowProduction = (role) => {
	const cleanRole = normalizeRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.PRODUCTION
	);
};

export const isVenFlowStore = (role) => {
	const cleanRole = normalizeRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.STORE
	);
};

export const isVenFlowPurchase = (role) => {
	const cleanRole = normalizeRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.PURCHASE
	);
};

export const canCreateVenFlowRequirement = (role) => {
	return isVenFlowProduction(role);
};

export const canOpenProductionDesk = (role) => {
	return isVenFlowProduction(role);
};

export const canOpenStoreDesk = (role) => {
	return isVenFlowStore(role);
};

export const canOpenPurchaseDesk = (role) => {
	return isVenFlowPurchase(role);
};

export const canOpenFullTracker = (role) => {
	return isVenFlowAdminOrManager(role);
};

export const canApproveVenFlowPo = (role) => {
	return isVenFlowAdminOrManager(role);
};

export const canAccessVenFlowScreen = (
	screen,
	role
) => {
	const cleanRole = normalizeRole(role);

	if (isVenFlowAdminOrManager(cleanRole)) {
		return true;
	}

	if (screen === "dashboard") {
		return true;
	}

	if (screen === "reports") {
		return true;
	}

	if (screen === "detail") {
		return true;
	}

	if (screen === "create") {
		return canCreateVenFlowRequirement(cleanRole);
	}

	if (screen === "production") {
		return canOpenProductionDesk(cleanRole);
	}

	if (screen === "store") {
		return canOpenStoreDesk(cleanRole);
	}

	if (screen === "purchase") {
		return canOpenPurchaseDesk(cleanRole);
	}

	if (screen === "entries") {
		return canOpenFullTracker(cleanRole);
	}

	return false;
};

export const defaultVenFlowPathForRole = (role) => {
	const cleanRole = normalizeRole(role);

	if (isVenFlowAdminOrManager(cleanRole)) {
		return "/venflow/dashboard";
	}

	if (cleanRole === VENFLOW_ROLES.PRODUCTION) {
		return "/venflow/production";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "/venflow/store";
	}

	if (cleanRole === VENFLOW_ROLES.PURCHASE) {
		return "/venflow/purchase";
	}

	return "/modules";
};

export const venFlowRoleLabel = (role) => {
	const cleanRole = normalizeRole(role);

	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return "Admin Control";
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
		return "VenFlow Manager";
	}

	if (cleanRole === VENFLOW_ROLES.PRODUCTION) {
		return "Production User";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "Store User";
	}

	if (cleanRole === VENFLOW_ROLES.PURCHASE) {
		return "Purchase User";
	}

	return "VenFlow User";
};