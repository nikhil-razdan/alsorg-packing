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
	QC: "VENFLOW_QC",
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

export const isRecognizedVenFlowRole = (role) => {
	const cleanRole = getVenFlowRole(role);

	return Object.values(VENFLOW_ROLES).includes(cleanRole);
};

export const isVenFlowAdminOrManager = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		cleanRole === VENFLOW_ROLES.ADMIN ||
		cleanRole === VENFLOW_ROLES.MANAGER
	);
};

/*
 * ADMIN currently performs Director actions.
 *
 * VENFLOW_DIRECTOR is also supported so the frontend remains
 * compatible when the dedicated Director account is enabled.
 */
export const isVenFlowDirector = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		cleanRole === VENFLOW_ROLES.ADMIN ||
		cleanRole === VENFLOW_ROLES.DIRECTOR
	);
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

/*
 * Backend QC access currently allows:
 * - ADMIN
 * - VENFLOW_MANAGER
 * - VENFLOW_QC
 * - VENFLOW_STORE
 *
 * Therefore Store users can also submit allocation-level QC.
 */
export const isVenFlowQc = (role) => {
	const cleanRole = getVenFlowRole(role);

	return (
		isVenFlowAdminOrManager(cleanRole) ||
		cleanRole === VENFLOW_ROLES.QC ||
		cleanRole === VENFLOW_ROLES.STORE
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

export const canOpenQcDesk = (role) => {
	return isVenFlowQc(role);
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

/*
 * Full Tracker remains restricted to ADMIN and VENFLOW_MANAGER.
 * Department users access individual requirement details through
 * their own desks.
 */
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

	if (cleanRole === VENFLOW_ROLES.ADMIN) {
		return true;
	}

	if (!isRecognizedVenFlowRole(cleanRole)) {
		return false;
	}

	if (
		screen === "dashboard" ||
		screen === "reports" ||
		screen === "detail"
	) {
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

	if (screen === "qc") {
		return canOpenQcDesk(
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

	if (cleanRole === VENFLOW_ROLES.DIRECTOR) {
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

	if (cleanRole === VENFLOW_ROLES.QC) {
		return "/venflow/qc";
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

	if (cleanRole === VENFLOW_ROLES.QC) {
		return "QC User";
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