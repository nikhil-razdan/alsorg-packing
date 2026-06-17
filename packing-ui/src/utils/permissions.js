export const normalizeRole = (role) => {
	return String(role || "").trim().toUpperCase();
};

export const readBooleanStorage = (key) => {
	return String(localStorage.getItem(key) || "")
		.trim()
		.toLowerCase() === "true";
};

export const canOpenWarehousePage = () => {
	const role = normalizeRole(localStorage.getItem("role"));
	const warehouseAccess = readBooleanStorage("warehouseAccess");

	return (
		role === "ADMIN" ||
		role === "WAREHOUSE" ||
		warehouseAccess
	);
};