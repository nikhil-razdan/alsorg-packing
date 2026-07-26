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

export const MATFLOW_ROLES = Object.freeze({
    ADMIN: "ADMIN",

    MANAGER: "MATFLOW_MANAGER",
    ENGINEERING: "MATFLOW_ENGINEERING",
    PRODUCTION: "MATFLOW_PRODUCTION",
    STORE: "MATFLOW_STORE",
    PURCHASE: "MATFLOW_PURCHASE",
    APPROVER: "MATFLOW_APPROVER",
});

/*
 * Temporary role aliases.
 *
 * Keep these while existing VenFlow users are being migrated
 * to MATFLOW_* roles.
 *
 * Remove these aliases only after the database and user screens
 * have been completely migrated.
 */
const LEGACY_ROLE_ALIASES = Object.freeze({
    VENFLOW_MANAGER: MATFLOW_ROLES.MANAGER,
    VENFLOW_ENGINEERING: MATFLOW_ROLES.ENGINEERING,

    VENFLOW_PRODUCTION: MATFLOW_ROLES.PRODUCTION,
    VENFLOW_SUPERVISOR: MATFLOW_ROLES.PRODUCTION,

    VENFLOW_STORE: MATFLOW_ROLES.STORE,
    VENFLOW_QC: MATFLOW_ROLES.STORE,

    VENFLOW_PURCHASE: MATFLOW_ROLES.PURCHASE,

    VENFLOW_DIRECTOR: MATFLOW_ROLES.APPROVER,
});

export const getMatFlowRole = (role) => {
    const cleanRole = normalizeRole(
        role || readStoredRole()
    );

    return (
        LEGACY_ROLE_ALIASES[cleanRole] ||
        cleanRole
    );
};

/* =========================================================
 * BASIC ROLE CHECKS
 * ========================================================= */

export const isMatFlowAdmin = (role) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.ADMIN
    );
};

export const isMatFlowManager = (role) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.MANAGER
    );
};

export const isMatFlowAdminOrManager = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        cleanRole === MATFLOW_ROLES.ADMIN ||
        cleanRole === MATFLOW_ROLES.MANAGER
    );
};

export const isMatFlowEngineering = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        isMatFlowAdminOrManager(cleanRole) ||
        cleanRole === MATFLOW_ROLES.ENGINEERING
    );
};

export const isMatFlowProduction = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        isMatFlowAdminOrManager(cleanRole) ||
        cleanRole === MATFLOW_ROLES.PRODUCTION
    );
};

export const isMatFlowStore = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        isMatFlowAdminOrManager(cleanRole) ||
        cleanRole === MATFLOW_ROLES.STORE
    );
};

export const isMatFlowPurchase = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        isMatFlowAdminOrManager(cleanRole) ||
        cleanRole === MATFLOW_ROLES.PURCHASE
    );
};

export const isMatFlowApprover = (role) => {
    const cleanRole = getMatFlowRole(role);

    return (
        cleanRole === MATFLOW_ROLES.ADMIN ||
        cleanRole === MATFLOW_ROLES.APPROVER
    );
};

export const hasMatFlowRole = (role) => {
    const cleanRole = getMatFlowRole(role);

    return Object.values(
        MATFLOW_ROLES
    ).includes(cleanRole);
};

/* =========================================================
 * SCREEN PERMISSIONS
 * ========================================================= */

export const canAccessMatFlowScreen = (
    screen,
    role
) => {
    const cleanRole = getMatFlowRole(role);

    if (cleanRole === MATFLOW_ROLES.ADMIN) {
        return true;
    }

    if (!hasMatFlowRole(cleanRole)) {
        return false;
    }

    switch (screen) {
        case "dashboard":
        case "releases":
        case "release-detail":
        case "reports":
            return true;

        case "production":
        case "requisition-detail":
            return isMatFlowProduction(cleanRole);

        case "store":
            return isMatFlowStore(cleanRole);

        case "indents":
        case "indent-detail":
            return (
                isMatFlowStore(cleanRole) ||
                isMatFlowPurchase(cleanRole)
            );

        case "purchase":
            return isMatFlowPurchase(cleanRole);

        case "approvals":
        case "purchase-order-detail":
            return isMatFlowApprover(cleanRole);

        default:
            return false;
    }
};

/* =========================================================
 * DEFAULT LANDING
 * ========================================================= */

export const defaultMatFlowPathForRole = (
    role
) => {
    const cleanRole = getMatFlowRole(role);

    if (
        cleanRole === MATFLOW_ROLES.ADMIN ||
        cleanRole === MATFLOW_ROLES.MANAGER
    ) {
        return "/matflow/dashboard";
    }

    if (
        cleanRole ===
        MATFLOW_ROLES.ENGINEERING
    ) {
        return "/matflow/releases";
    }

    if (
        cleanRole ===
        MATFLOW_ROLES.PRODUCTION
    ) {
        return "/matflow/production";
    }

    if (
        cleanRole ===
        MATFLOW_ROLES.STORE
    ) {
        return "/matflow/store";
    }

    if (
        cleanRole ===
        MATFLOW_ROLES.PURCHASE
    ) {
        return "/matflow/purchase";
    }

    if (
        cleanRole ===
        MATFLOW_ROLES.APPROVER
    ) {
        return "/matflow/approvals";
    }

    return "/modules";
};

/* =========================================================
 * DISPLAY LABELS
 * ========================================================= */

export const matFlowRoleLabel = (role) => {
    const cleanRole = getMatFlowRole(role);

    switch (cleanRole) {
        case MATFLOW_ROLES.ADMIN:
            return "Administrator";

        case MATFLOW_ROLES.MANAGER:
            return "MatFlow Manager";

        case MATFLOW_ROLES.ENGINEERING:
            return "Engineering";

        case MATFLOW_ROLES.PRODUCTION:
            return "Production";

        case MATFLOW_ROLES.STORE:
            return "Store";

        case MATFLOW_ROLES.PURCHASE:
            return "Purchase";

        case MATFLOW_ROLES.APPROVER:
            return "Purchase Approver";

        default:
            return "MatFlow User";
    }
};