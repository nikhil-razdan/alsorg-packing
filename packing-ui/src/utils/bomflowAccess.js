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

export const BOMFLOW_ROLES = Object.freeze({
    ADMIN: "ADMIN",
    MANAGER: "BOMFLOW_MANAGER",
    EDITOR: "BOMFLOW_EDITOR",
    REVIEWER: "BOMFLOW_REVIEWER",
    APPROVER: "BOMFLOW_APPROVER",
});

export const getBomFlowRole = (role) => {
    return normalizeRole(role || readStoredRole());
};

export const isRecognizedBomFlowRole = (role) => {
    const cleanRole = getBomFlowRole(role);

    return Object.values(BOMFLOW_ROLES).includes(cleanRole);
};

export const isBomFlowAdmin = (role) => {
    return getBomFlowRole(role) === BOMFLOW_ROLES.ADMIN;
};

export const isBomFlowManager = (role) => {
    return getBomFlowRole(role) === BOMFLOW_ROLES.MANAGER;
};

export const isBomFlowEditor = (role) => {
    return getBomFlowRole(role) === BOMFLOW_ROLES.EDITOR;
};

export const isBomFlowReviewer = (role) => {
    return getBomFlowRole(role) === BOMFLOW_ROLES.REVIEWER;
};

export const isBomFlowApprover = (role) => {
    return getBomFlowRole(role) === BOMFLOW_ROLES.APPROVER;
};

export const canViewBomFlow = (role) => {
    return isRecognizedBomFlowRole(role);
};

export const canCreateBomFlowProduct = (role) => {
    const cleanRole = getBomFlowRole(role);

    return [
        BOMFLOW_ROLES.ADMIN,
        BOMFLOW_ROLES.MANAGER,
        BOMFLOW_ROLES.EDITOR,
    ].includes(cleanRole);
};

export const canEditBomFlowRevision = (role) => {
    return canCreateBomFlowProduct(role);
};

export const canSubmitBomFlowRevision = (role) => {
    return canEditBomFlowRevision(role);
};

export const canReviewBomFlowRevision = (role) => {
    const cleanRole = getBomFlowRole(role);

    return [
        BOMFLOW_ROLES.ADMIN,
        BOMFLOW_ROLES.MANAGER,
        BOMFLOW_ROLES.REVIEWER,
    ].includes(cleanRole);
};

export const canApproveBomFlowRevision = (role) => {
    const cleanRole = getBomFlowRole(role);

    return [
        BOMFLOW_ROLES.ADMIN,
        BOMFLOW_ROLES.MANAGER,
        BOMFLOW_ROLES.APPROVER,
    ].includes(cleanRole);
};

export const canReleaseBomToMatFlow = (role) => {
    return canApproveBomFlowRevision(role);
};

export const canAccessBomFlowScreen = (screen, role) => {
    const cleanRole = getBomFlowRole(role);

    if (!isRecognizedBomFlowRole(cleanRole)) {
        return false;
    }

    if (
        [
            "home",
            "dashboard",
            "products",
            "product-detail",
            "bom-detail",
            "reports",
        ].includes(screen)
    ) {
        return true;
    }

    if (
        [
            "create-product",
            "edit-product",
            "bom-builder",
        ].includes(screen)
    ) {
        return canEditBomFlowRevision(cleanRole);
    }

    if (screen === "review") {
        return canReviewBomFlowRevision(cleanRole);
    }

    if (
        screen === "approval" ||
        screen === "release"
    ) {
        return canApproveBomFlowRevision(cleanRole);
    }

    return false;
};

export const defaultBomFlowPathForRole = (role) => {
    const cleanRole = getBomFlowRole(role);

    if (
        cleanRole === BOMFLOW_ROLES.ADMIN ||
        cleanRole === BOMFLOW_ROLES.MANAGER
    ) {
        return "/bomflow/dashboard";
    }

    if (cleanRole === BOMFLOW_ROLES.EDITOR) {
        return "/bomflow/products";
    }

    if (cleanRole === BOMFLOW_ROLES.REVIEWER) {
        return "/bomflow/review";
    }

    if (cleanRole === BOMFLOW_ROLES.APPROVER) {
        return "/bomflow/approval";
    }

    return "/modules";
};

export const bomFlowRoleLabel = (role) => {
    const cleanRole = getBomFlowRole(role);

    switch (cleanRole) {
        case BOMFLOW_ROLES.ADMIN:
            return "Admin Access";
        case BOMFLOW_ROLES.MANAGER:
            return "BOMFlow Manager";
        case BOMFLOW_ROLES.EDITOR:
            return "BOM Editor";
        case BOMFLOW_ROLES.REVIEWER:
            return "BOM Reviewer";
        case BOMFLOW_ROLES.APPROVER:
            return "Engineering Approver";
        default:
            return "BOMFlow User";
    }
};