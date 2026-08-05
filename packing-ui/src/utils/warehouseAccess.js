const normalizeRole = (value) => {
    return String(value || "")
        .replace(/^ROLE_/i, "")
        .trim()
        .toUpperCase();
};

const readBoolean = (value) => {
    if (value === true) {
        return true;
    }

    return (
        String(value || "")
            .trim()
            .toLowerCase() === "true"
    );
};

/**
 * Returns all effective roles available on a frontend user object.
 *
 * Supports:
 * - New multi-role response: user.roles
 * - Existing primary role: user.role
 */
export const userRoleList = (user) => {
    const explicitRoles =
        Array.isArray(user?.roles)
            ? user.roles
            : [];

    return Array.from(
        new Set(
            [
                ...explicitRoles,
                user?.role,
            ]
                .map(normalizeRole)
                .filter(Boolean)
        )
    );
};

export const hasRoleFromUser = (
    user,
    requestedRole
) => {
    const cleanRequestedRole =
        normalizeRole(requestedRole);

    if (!cleanRequestedRole) {
        return false;
    }

    return userRoleList(user).includes(
        cleanRequestedRole
    );
};

/**
 * Controls permission to open the Warehouse page.
 *
 * Automatic access:
 * - ADMIN
 * - WAREHOUSE
 * - DISPATCH
 *
 * Optional page access:
 * - warehouseAccess=true
 */
export const canOpenWarehousePageFromUser = (
    user
) => {
    if (!user) {
        return false;
    }

    if (
        hasRoleFromUser(user, "ADMIN") ||
        hasRoleFromUser(user, "WAREHOUSE") ||
        hasRoleFromUser(user, "DISPATCH")
    ) {
        return true;
    }

    return (
        readBoolean(
            user?.warehouseAccess
        ) ||
        readBoolean(
            user?.warehousePageAccess
        ) ||
        readBoolean(
            user?.hasWarehouseAccess
        ) ||
        readBoolean(
            user?.canOpenWarehousePage
        )
    );
};

/**
 * Compatibility alias for pages that currently import or call
 * canOpenWarehousePage(user).
 */
export const canOpenWarehousePage =
    canOpenWarehousePageFromUser;

export default canOpenWarehousePageFromUser;