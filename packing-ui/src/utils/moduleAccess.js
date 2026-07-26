export const MODULE_KEYS = Object.freeze({
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	MATFLOW: "MATFLOW",
});

/*
 * Temporary compatibility only.
 *
 * MATFLOW accepts legacy VENFLOW module assignment while users
 * are migrated in the database.
 *
 * Remove this alias after all users have MATFLOW assigned.
 */
const LEGACY_MODULE_ALIASES = Object.freeze({
	[MODULE_KEYS.MATFLOW]: ["VENFLOW"],
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

	return modules
		.filter(Boolean)
		.map(normalizeModuleKey)
		.filter(Boolean);
};

const acceptedKeysFor = (moduleKey) => {
	const normalizedKey =
		normalizeModuleKey(moduleKey);

	if (!normalizedKey) {
		return [];
	}

	return [
		normalizedKey,
		...(
			LEGACY_MODULE_ALIASES[
				normalizedKey
			] || []
		),
	].map(normalizeModuleKey);
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

	const role = normalizeModuleKey(
		user?.role
	);

	/*
	 * Admin can access every application module even if the
	 * modules array is empty.
	 */
	if (role === "ADMIN") {
		return true;
	}

	const assignedModules =
		normalizeModules(user?.modules);

	const acceptedKeys =
		acceptedKeysFor(requestedKey);

	return acceptedKeys.some((key) =>
		assignedModules.includes(key)
	);
}

/*
 * Compatibility export.
 *
 * Correct usage:
 * hasModuleAccess(user, MODULE_KEYS.MATFLOW)
 */
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