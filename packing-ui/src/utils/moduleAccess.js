export const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
});

const normalizeModuleKey = (value) => {
	return String(value || "")
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
				.map(normalizeModuleKey)
				.filter(Boolean)
		)
	);
};

export function hasModuleAccessFromUser(
	user,
	moduleKey
) {
	const requestedKey =
		normalizeModuleKey(moduleKey);

	if (!requestedKey) {
		return false;
	}

	const role =
		normalizeModuleKey(user?.role);

	if (role === "ADMIN") {
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
	role = ""
) {
	return hasModuleAccessFromUser(
		{
			modules,
			role,
		},
		moduleKey
	);
}