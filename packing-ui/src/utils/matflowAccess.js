import { normalizeRole }
    from "./permissions";

const readStoredRole = () => {
    try {
        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "currentUser"
                ) || "{}"
            );

        return (
            currentUser?.role ||
            localStorage.getItem("role") ||
            ""
        );
    } catch {
        return (
            localStorage.getItem("role") ||
            ""
        );
    }
};

export const MATFLOW_ROLES =
    Object.freeze({
        ADMIN: "ADMIN",
        MANAGER: "MATFLOW_MANAGER",
        ENGINEERING:
            "MATFLOW_ENGINEERING",
        STORE: "MATFLOW_STORE",
        PURCHASE: "MATFLOW_PURCHASE",
        PROCESSING:
            "MATFLOW_PROCESSING",
        PRODUCTION:
            "MATFLOW_PRODUCTION",
        QC: "MATFLOW_QC",
        DIRECTOR: "MATFLOW_DIRECTOR",
    });

const ALL_MATFLOW_ROLES =
    Object.freeze(
        Object.values(MATFLOW_ROLES)
    );

const SCREEN_ROLES =
    Object.freeze({
        dashboard:
            ALL_MATFLOW_ROLES,

        tracking:
            ALL_MATFLOW_ROLES,

        projects: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.DIRECTOR,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        materials: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.QC,
        ],

        boms: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.DIRECTOR,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        "bom-create": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.ENGINEERING,
        ],

        "bom-edit": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.ENGINEERING,
        ],

        "bom-detail": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.DIRECTOR,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        "bom-approval": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.DIRECTOR,
        ],

        production: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        requisitions: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        "requisition-detail": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        store: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
        ],

        transfers: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PROCESSING,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.PRODUCTION,
        ],

        indents: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
        ],

        purchase: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        receiving: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.QC,
        ],

        approvals: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.DIRECTOR,
        ],

        qc: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.STORE,
        ],

        processing: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PROCESSING,
        ],

        returns: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.PROCESSING,
        ],

        ledger: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        reports: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.DIRECTOR,
        ],
    });

export const getMatFlowRole = (
    role
) => {
    return normalizeRole(
        role || readStoredRole()
    );
};

export const hasMatFlowRole = (
    role
) => {
    return ALL_MATFLOW_ROLES.includes(
        getMatFlowRole(role)
    );
};

export const isMatFlowAdmin = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.ADMIN
    );
};

export const isMatFlowManager = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.MANAGER
    );
};

export const isMatFlowEngineering = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.ENGINEERING
    );
};

export const isMatFlowStore = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.STORE
    );
};

export const isMatFlowPurchase = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.PURCHASE
    );
};

export const isMatFlowProcessing = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.PROCESSING
    );
};

export const isMatFlowProduction = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.PRODUCTION
    );
};

export const isMatFlowQc = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.QC
    );
};

export const isMatFlowDirector = (
    role
) => {
    return (
        getMatFlowRole(role) ===
        MATFLOW_ROLES.DIRECTOR
    );
};

export const canAccessMatFlowScreen = (
    screen,
    role
) => {
    const cleanRole =
        getMatFlowRole(role);

    if (
        cleanRole ===
        MATFLOW_ROLES.ADMIN
    ) {
        return true;
    }

    if (!hasMatFlowRole(cleanRole)) {
        return false;
    }

    const allowedRoles =
        SCREEN_ROLES[screen];

    if (!Array.isArray(allowedRoles)) {
        return false;
    }

    return allowedRoles.includes(
        cleanRole
    );
};

export const defaultMatFlowPathForRole = (
    role
) => {
    const cleanRole =
        getMatFlowRole(role);

    switch (cleanRole) {
        case MATFLOW_ROLES.ADMIN:
        case MATFLOW_ROLES.MANAGER:
            return "/matflow/dashboard";

        case MATFLOW_ROLES.ENGINEERING:
            return "/matflow/boms";

        case MATFLOW_ROLES.STORE:
            return "/matflow/store";

        case MATFLOW_ROLES.PURCHASE:
            return "/matflow/purchase";

        case MATFLOW_ROLES.PROCESSING:
            return "/matflow/processing";

        case MATFLOW_ROLES.PRODUCTION:
            return "/matflow/production";

        case MATFLOW_ROLES.QC:
            return "/matflow/qc";

        case MATFLOW_ROLES.DIRECTOR:
            return "/matflow/approvals";

        default:
            return "/modules";
    }
};

export const matFlowRoleLabel = (
    role
) => {
    const cleanRole =
        getMatFlowRole(role);

    switch (cleanRole) {
        case MATFLOW_ROLES.ADMIN:
            return "Administrator";

        case MATFLOW_ROLES.MANAGER:
            return "MatFlow Manager";

        case MATFLOW_ROLES.ENGINEERING:
            return "Engineering";

        case MATFLOW_ROLES.STORE:
            return "Stores";

        case MATFLOW_ROLES.PURCHASE:
            return "Purchase";

        case MATFLOW_ROLES.PROCESSING:
            return "Processing";

        case MATFLOW_ROLES.PRODUCTION:
            return "Production";

        case MATFLOW_ROLES.QC:
            return "Quality Control";

        case MATFLOW_ROLES.DIRECTOR:
            return "Director";

        default:
            return "MatFlow User";
    }
};