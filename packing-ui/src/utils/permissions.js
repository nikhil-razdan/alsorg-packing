export const normalizeRole = (
	role
) => {
	return String(role || "")
		.replace(/^ROLE_/i, "")
		.trim()
		.toUpperCase();
};

export const userRoleList = (
	user
) => {
	const explicitRoles =
		Array.isArray(user?.roles)
			? user.roles
			: [];

	const normalizedRoles =
		Array.from(
			new Set(
				explicitRoles
					.map(normalizeRole)
					.filter(Boolean)
			)
		);

	/*
	 * Keep the primary legacy role as a fallback.
	 */
	const primaryRole =
		normalizeRole(
			user?.role
		);

	if (
		primaryRole &&
		!normalizedRoles.includes(
			primaryRole
		)
	) {
		normalizedRoles.push(
			primaryRole
		);
	}

	return normalizedRoles;
};

export const hasRoleFromUser = (
	user,
	requestedRole
) => {
	const cleanRequestedRole =
		normalizeRole(
			requestedRole
		);

	if (!cleanRequestedRole) {
		return false;
	}

	return userRoleList(user)
		.includes(
			cleanRequestedRole
		);
};

export const hasAnyRoleFromUser = (
	user,
	...requestedRoles
) => {
	return requestedRoles
		.flat()
		.some((requestedRole) =>
			hasRoleFromUser(
				user,
				requestedRole
			)
		);
};

const readBoolean = (
	value
) => {
	return (
		value === true ||
		String(value || "")
			.trim()
			.toLowerCase() ===
		"true"
	);
};

export const canOpenWarehousePageFromUser = (
	user
) => {
	if (!user) {
		return false;
	}

	return (
		hasAnyRoleFromUser(
			user,
			"ADMIN",
			"DISPATCH",
			"WAREHOUSE"
		) ||
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

/*
 * Compatibility alias used by WarehousePage.
 */
export const canOpenWarehousePage = (
	user
) => {
	return canOpenWarehousePageFromUser(
		user
	);
};