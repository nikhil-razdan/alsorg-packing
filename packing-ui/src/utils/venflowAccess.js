import { normalizeRole } from "../utils/permissions";

export const VENFLOW_ROLES = {
	ADMIN: "ADMIN",
	MANAGER: "VENFLOW_MANAGER",
	PRODUCTION: "VENFLOW_PRODUCTION",
	STORE: "VENFLOW_STORE",
	PURCHASE: "VENFLOW_PURCHASE",
};

export const getVenFlowRole = () => {
	return normalizeRole(localStorage.getItem("role"));
};

export const isVenFlowAdmin = (role = getVenFlowRole()) => {
	return role === VENFLOW_ROLES.ADMIN;
};

export const isVenFlowManager = (role = getVenFlowRole()) => {
	return role === VENFLOW_ROLES.MANAGER;
};

export const isVenFlowAdminOrManager = (role = getVenFlowRole()) => {
	return isVenFlowAdmin(role) || isVenFlowManager(role);
};

export const isVenFlowProduction = (role = getVenFlowRole()) => {
	return isVenFlowAdminOrManager(role) || role === VENFLOW_ROLES.PRODUCTION;
};

export const isVenFlowStore = (role = getVenFlowRole()) => {
	return isVenFlowAdminOrManager(role) || role === VENFLOW_ROLES.STORE;
};

export const isVenFlowPurchase = (role = getVenFlowRole()) => {
	return isVenFlowAdminOrManager(role) || role === VENFLOW_ROLES.PURCHASE;
};

export const canCreateVenFlowRequirement = (role = getVenFlowRole()) => {
	return isVenFlowProduction(role);
};

export const canOpenProductionDesk = (role = getVenFlowRole()) => {
	return isVenFlowProduction(role);
};

export const canOpenStoreDesk = (role = getVenFlowRole()) => {
	return isVenFlowStore(role);
};

export const canOpenPurchaseDesk = (role = getVenFlowRole()) => {
	return isVenFlowPurchase(role);
};

export const canOpenFullTracker = (role = getVenFlowRole()) => {
	return isVenFlowAdminOrManager(role);
};

export const canApproveVenFlowPo = (role = getVenFlowRole()) => {
	return isVenFlowAdminOrManager(role);
};

export const canAccessVenFlowScreen = (
	screen,
	role = getVenFlowRole()
) => {
	if (isVenFlowAdminOrManager(role)) {
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
		return canCreateVenFlowRequirement(role);
	}

	if (screen === "production") {
		return canOpenProductionDesk(role);
	}

	if (screen === "store") {
		return canOpenStoreDesk(role);
	}

	if (screen === "purchase") {
		return canOpenPurchaseDesk(role);
	}

	if (screen === "entries") {
		return canOpenFullTracker(role);
	}

	return false;
};

export const defaultVenFlowPathForRole = (
	role = getVenFlowRole()
) => {
	if (isVenFlowAdminOrManager(role)) {
		return "/venflow/dashboard";
	}

	if (role === VENFLOW_ROLES.PRODUCTION) {
		return "/venflow/production";
	}

	if (role === VENFLOW_ROLES.STORE) {
		return "/venflow/store";
	}

	if (role === VENFLOW_ROLES.PURCHASE) {
		return "/venflow/purchase";
	}

	return "/modules";
};

export const venFlowRoleLabel = (
	role = getVenFlowRole()
) => {
	if (role === "ADMIN") return "Admin Control";
	if (role === "VENFLOW_MANAGER") return "VenFlow Manager";
	if (role === "VENFLOW_PRODUCTION") return "Production User";
	if (role === "VENFLOW_STORE") return "Store User";
	if (role === "VENFLOW_PURCHASE") return "Purchase User";

	return "VenFlow User";
};