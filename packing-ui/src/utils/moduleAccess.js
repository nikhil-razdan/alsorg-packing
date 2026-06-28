export const MODULE_KEYS = {
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	VENFLOW: "VENFLOW",
};

export function hasModuleAccessFromUser(user, moduleKey) {
	return Array.isArray(user?.modules)
		&& user.modules.includes(moduleKey);
}

/*
 * Compatibility export only.
 * Do not use this without passing user.
 *
 * Correct usage:
 *   hasModuleAccess(user, "BOMFLOW")
 */
export function hasModuleAccess(user, moduleKey) {
	if (!moduleKey) {
		return false;
	}

	return hasModuleAccessFromUser(user, moduleKey);
}