export const MODULE_KEYS = {
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
	VENFLOW: "VENFLOW",
};

export function hasModuleAccessFromUser(user, moduleKey) {
	return Array.isArray(user?.modules)
		&& user.modules.includes(moduleKey);
}