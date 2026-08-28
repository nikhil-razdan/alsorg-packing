/*
 * Compatibility facade. Warehouse access rules live in permissions.js so the
 * sidebar, route guard and Warehouse page cannot drift apart.
 */
export {
	normalizeRole,
	userRoleList,
	hasRoleFromUser,
	canOpenWarehousePageFromUser,
	canOpenWarehousePage,
} from "./permissions";

export {
	canOpenWarehousePageFromUser as default,
} from "./permissions";
