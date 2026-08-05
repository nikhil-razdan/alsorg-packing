export const normalizeRole = (role) => {
	return String(role || "")
		.replace("ROLE_", "")
		.trim()
		.toUpperCase();
};

export const userRoleList = (user) => {
	const roles =
		Array.isArray(user?.roles)
			? user.roles
			: [];

	const normalizedRoles =
		Array.from(
			new Set(
				roles
					.map(normalizeRole)
					.filter(Boolean)
			)
		);

	const primaryRole =
		normalizeRole(user?.role);

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
	const role =
		normalizeRole(requestedRole);

	return userRoleList(user)
		.includes(role);
};

export const canOpenWarehousePageFromUser = (
	user
) => {
	return (
		hasRoleFromUser(
			user,
			"ADMIN"
		) ||
		hasRoleFromUser(
			user,
			"DISPATCH"
		) ||
		hasRoleFromUser(
			user,
			"WAREHOUSE"
		) ||
		user?.warehouseAccess === true
	);
};

export const canOpenWarehousePage = (
	user
) => {
	return canOpenWarehousePageFromUser(
		user
	);
};