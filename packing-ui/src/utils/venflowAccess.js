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

export const VENFLOW_ROLES = Object.freeze({
	ADMIN: "ADMIN",
	MANAGER: "VENFLOW_MANAGER",
	ENGINEERING: "VENFLOW_ENGINEERING",
	STORE: "VENFLOW_STORE",
	PURCHASE: "VENFLOW_PURCHASE",

	/*
	 * Reserved for the future dedicated Director role.
	 * Currently ADMIN performs Director actions.
	 */
	DIRECTOR: "VENFLOW_DIRECTOR",

	PRODUCTION: "VENFLOW_PRODUCTION",
	SUPERVISOR: "VENFLOW_SUPERVISOR",
});

export const getVenFlowRole = (role) => {
	return normalizeRole(
		role || readStoredRole()
	);
};

/* =========================================================
 * BASE ROLE CHECKS
 * ========================================================= */

export const isVenFlowAdmin = (role) => {
	return (
		getVenFlowRole(role) ===
		VENFLOW_ROLES.ADMIN
	);
};

export const isVenFlowManager = (role) => {
	return (
		getVenFlowRole(role) ===
		VENFLOW_ROLES.MANAGER
	);
};

export const isVenFlowAdminOrManager = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		cleanRole === VENFLOW_ROLES.ADMIN ||
		cleanRole === VENFLOW_ROLES.MANAGER
	);
};

/*
 * Current implementation:
 * ADMIN acts as Director.
 *
 * Later, when VENFLOW_DIRECTOR is enabled, change this to:
 *
 * return (
 *     cleanRole === VENFLOW_ROLES.ADMIN ||
 *     cleanRole === VENFLOW_ROLES.DIRECTOR
 * );
 */
export const isVenFlowDirector = (role) => {
	const cleanRole = getVenFlowRole(role);

	return cleanRole === VENFLOW_ROLES.ADMIN;
};

/* =========================================================
 * DEPARTMENT ROLE CHECKS
 * ========================================================= */

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

/* =========================================================
 * ACTION PERMISSIONS
 * ========================================================= */

export const canApproveVenFlowPo = (role) => {
	return isVenFlowDirector(role);
};

export const canCreateVenFlowRequirement = (role) => {
	return isVenFlowEngineering(role);
};

export const canActAsAnyVenFlowUser = (role) => {
	return isVenFlowAdmin(role);
};

/* =========================================================
 * SCREEN PERMISSIONS
 * ========================================================= */

export const canOpenEngineeringDesk = (role) => {
	return isVenFlowEngineering(role);
};

export const canOpenStoreDesk = (role) => {
	return isVenFlowStore(role);
};

export const canOpenPurchaseDesk = (role) => {
	return isVenFlowPurchase(role);
};

export const canOpenDirectorDesk = (role) => {
	return isVenFlowDirector(role);
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

/* =========================================================
 * CENTRAL SCREEN ACCESS
 * ========================================================= */

export const canAccessVenFlowScreen = (
	screen,
	role
) => {
	const cleanRole = getVenFlowRole(role);

	/*
	 * ADMIN has access to every VenFlow screen,
	 * including Director Desk.
	 */
	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return true;
	}

	/*
	 * Do not return true globally for MANAGER here.
	 *
	 * A global manager return previously allowed Manager to open
	 * Director Desk and approve POs. Screen access must therefore
	 * remain explicit below.
	 */

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
		return canCreateVenFlowRequirement(
			cleanRole
		);
	}

	if (screen === "engineering") {
		return canOpenEngineeringDesk(
			cleanRole
		);
	}

	if (screen === "store") {
		return canOpenStoreDesk(
			cleanRole
		);
	}

	if (screen === "purchase") {
		return canOpenPurchaseDesk(
			cleanRole
		);
	}

	if (screen === "director") {
		return canOpenDirectorDesk(
			cleanRole
		);
	}

	if (
		screen === "processing" ||
		screen === "production"
	) {
		return canOpenProcessingDesk(
			cleanRole
		);
	}

	if (screen === "supervisor") {
		return canOpenSupervisorDesk(
			cleanRole
		);
	}

	if (screen === "entries") {
		return canOpenFullTracker(
			cleanRole
		);
	}

	return false;
};

/* =========================================================
 * DEFAULT LANDING ROUTE
 * ========================================================= */

export const defaultVenFlowPathForRole = (
	role
) => {
	const cleanRole = getVenFlowRole(role);

	/*
	 * ADMIN currently acts as Director.
	 */
	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return "/venflow/director";
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
		return "/venflow/dashboard";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.ENGINEERING
	) {
		return "/venflow/create";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "/venflow/store";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.PURCHASE
	) {
		return "/venflow/purchase";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.PRODUCTION
	) {
		return "/venflow/production";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.SUPERVISOR
	) {
		return "/venflow/supervisor";
	}

	/*
	 * Future dedicated Director role.
	 * This route remains ready even though Director access currently
	 * operates through ADMIN.
	 */
	if (
		cleanRole ===
		VENFLOW_ROLES.DIRECTOR
	) {
		return "/venflow/director";
	}

	return "/modules";
};

/* =========================================================
 * DISPLAY LABELS
 * ========================================================= */

export const venFlowRoleLabel = (role) => {
	const cleanRole = getVenFlowRole(role);

	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return "Admin / Director Access";
	}

	if (cleanRole === VENFLOW_ROLES.MANAGER) {
		return "VenFlow Manager";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.ENGINEERING
	) {
		return "Engineering User";
	}

	if (cleanRole === VENFLOW_ROLES.STORE) {
		return "AKG Store User";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.PURCHASE
	) {
		return "Purchase User";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.DIRECTOR
	) {
		return "VenFlow Director";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.PRODUCTION
	) {
		return "Processing User";
	}

	if (
		cleanRole ===
		VENFLOW_ROLES.SUPERVISOR
	) {
		return "Supervisor User";
	}

	return "VenFlow User";
};