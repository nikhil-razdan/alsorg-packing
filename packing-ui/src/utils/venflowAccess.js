import { normalizeRole } from "./permissions";

const readStoredRole = () => {
	try {
		const currentUser = JSON.parse(
			localStorage.getItem("currentUser") || "{}"
		);

		return (
			currentUser?.role ||
			localStorage.getItem("role") ||
			""
		);
	} catch {
		return localStorage.getItem("role") || "";
	}
};

export const VENFLOW_ROLES = {
	ADMIN: "ADMIN",
	MANAGER: "VENFLOW_MANAGER",
	ENGINEERING: "VENFLOW_ENGINEERING",
	STORE: "VENFLOW_STORE",
	PURCHASE: "VENFLOW_PURCHASE",
	PRODUCTION: "VENFLOW_PRODUCTION",
	SUPERVISOR: "VENFLOW_SUPERVISOR",
};

export const getVenFlowRole = (role) => {
	return normalizeRole(role || readStoredRole());
};

export const isVenFlowAdmin = (role) => {
	return getVenFlowRole(role) === VENFLOW_ROLES.ADMIN;
};

export const isVenFlowManager = (role) => {
	return getVenFlowRole(role) === VENFLOW_ROLES.MANAGER;
};

export const isVenFlowAdminOrManager = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		cleanRole === VENFLOW_ROLES.ADMIN ||
		cleanRole === VENFLOW_ROLES.MANAGER
	);
};

export const isVenFlowEngineering = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.ENGINEERING
	);
};

export const isVenFlowStore = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.STORE
	);
};

export const isVenFlowPurchase = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.PURCHASE
	);
};

export const isVenFlowProduction = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.PRODUCTION
	);
};

export const isVenFlowProcessing = (role) => {
	return isVenFlowProduction(role);
};

export const isVenFlowSupervisor = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.SUPERVISOR
	);
};

export const canCreateVenFlowRequirement = (role) => {
	return isVenFlowEngineering(role);
};

export const canOpenEngineeringDesk = (role) => {
	return isVenFlowEngineering(role);
};

export const canOpenStoreDesk = (role) => {
	return isVenFlowStore(role);
};

export const canOpenPurchaseDesk = (role) => {
	return isVenFlowPurchase(role);
};

export const canOpenProcessingDesk = (role) => {
	return isVenFlowProcessing(role);
};

export const canOpenProductionDesk = (role) => {
	return canOpenProcessingDesk(role);
};

export const canOpenSupervisorDesk = (role) => {
	return isVenFlowSupervisor(role);
};

export const canOpenFullTracker = (role) => {
	return isVenFlowAdminOrManager(role);
};

export const canApproveVenFlowPo = (role) => {
	return isVenFlowAdminOrManager(role);
};

export const canActAsAnyVenFlowUser = (role) => {
	return isVenFlowAdmin(role);
};

export const canAccessVenFlowScreen = (screen, role) => {
	const cleanRole = getVenFlowRole(role);

	/*
	 * ADMIN can open every VenFlow screen.
	 */
	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return true;
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
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

	if (screen === "engineering") {
		return canOpenEngineeringDesk(cleanRole);
	}

	if (screen === "store") {
		return canOpenStoreDesk(cleanRole);
	}

	if (screen === "purchase") {
		return canOpenPurchaseDesk(cleanRole);
	}

	if (screen === "processing") {
		return canOpenProcessingDesk(cleanRole);
	}

	if (screen === "production") {
		return canOpenProcessingDesk(cleanRole);
	}

	if (screen === "supervisor") {
		return canOpenSupervisorDesk(cleanRole);
	}

	if (screen === "entries") {
		return canOpenFullTracker(cleanRole);
	}

	return false;
};

export const defaultVenFlowPathForRole = (role) => {
	const cleanRole = getVenFlowRole(role);

	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return "/venflow/dashboard";
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
		return "/venflow/dashboard";
	}

	if (cleanRole === VENFLOW_ROLES.ENGINEERING) {
		return "/venflow/create";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "/venflow/store";
	}

	if (cleanRole === VENFLOW_ROLES.PURCHASE) {
		return "/venflow/purchase";
	}

	if (cleanRole === VENFLOW_ROLES.PRODUCTION) {
		return "/venflow/production";
	}

	if (cleanRole === VENFLOW_ROLES.SUPERVISOR) {
		return "/venflow/production";
	}

	return "/modules";
};

export const venFlowRoleLabel = (role) => {
	const cleanRole = getVenFlowRole(role);

	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return "Admin Super Access";
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
		return "VenFlow Manager";
	}

	if (cleanRole === VENFLOW_ROLES.ENGINEERING) {
		return "Engineering User";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "AKG Store User";
	}

	if (cleanRole === VENFLOW_ROLES.PURCHASE) {
		return "Purchase User";
	}

	if (cleanRole === VENFLOW_ROLES.PRODUCTION) {
		return "Processing User";
	}

	if (cleanRole === VENFLOW_ROLES.SUPERVISOR) {
		return "Supervisor User";
	}

	return "VenFlow User";
};