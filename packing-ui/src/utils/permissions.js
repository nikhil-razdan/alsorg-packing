export const normalizeRole = (role) => {
	return String(role || "").trim().toUpperCase();
};

export const canOpenWarehousePageFromUser = (user) => {
	const role = normalizeRole(user?.role);

	return (
		role === "ADMIN" ||
		role === "DISPATCH" ||
		role === "WAREHOUSE" ||
		user?.warehouseAccess === true
	);
};