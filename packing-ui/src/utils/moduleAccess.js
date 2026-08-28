export const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
	ASSETFLOW: "ASSETFLOW",
	MATERIALS: "MATERIALS",
	CLIENTS: "CLIENTS",
	HRFLOW: "HRFLOW",
});

const normalizeValue = (value) => {
	return String(value || "")
		.replace(/^ROLE_/i, "")
		.trim()
		.toUpperCase();
};

const normalizeModules = (modules) => {
	if (!Array.isArray(modules)) {
		return [];
	}

	return Array.from(
		new Set(
			modules
				.map(normalizeValue)
				.filter(Boolean)
		)
	);
};

const normalizeRolesFromUser = (user) => {
	const roles =
		Array.isArray(user?.roles)
			? user.roles
			: [];

	const normalized =
		Array.from(
			new Set(
				roles
					.map(normalizeValue)
					.filter(Boolean)
			)
		);

	const primaryRole =
		normalizeValue(user?.role);

	if (
		primaryRole &&
		!normalized.includes(primaryRole)
	) {
		normalized.push(primaryRole);
	}

	return normalized;
};

export function hasModuleAccessFromUser(
	user,
	moduleKey
) {
	const requestedKey =
		normalizeValue(moduleKey);

	if (!requestedKey) {
		return false;
	}

	const roles =
		normalizeRolesFromUser(user);

	if (roles.includes("ADMIN")) {
		return true;
	}

	const assignedModules =
		normalizeModules(user?.modules);

	return assignedModules.includes(
		requestedKey
	);
}

export function hasModuleAccess(
	user,
	moduleKey
) {
	return hasModuleAccessFromUser(
		user,
		moduleKey
	);
}

export function hasModuleAccessFromList(
	modules,
	moduleKey,
	role = "",
	roles = []
) {
	return hasModuleAccessFromUser(
		{
			modules,
			role,
			roles,
		},
		moduleKey
	);
}
