/*
 * Compatibility facade. Warehouse page-opening rules live in permissions.js so
 * Sidebar/Layout, RequireWarehouseAccess and WarehousePage cannot drift apart.
 * UTL_DISPATCH is allowed to open the page, while WarehousePage routes that
 * identity exclusively to /api/utl/warehouse rather than the normal API.
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
