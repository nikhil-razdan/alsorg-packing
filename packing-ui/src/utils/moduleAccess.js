export const MODULE_KEYS = {
	PACKFLOW: "PACKFLOW",
	BOMFLOW: "BOMFLOW",
};

export function getCurrentUser() {
	try {
		return JSON.parse(localStorage.getItem("currentUser") || "{}");
	} catch {
		return {};
	}
}

export function getUserModules() {
	const user = getCurrentUser();

	if (Array.isArray(user.modules)) {
		return user.modules;
	}

	try {
		return JSON.parse(localStorage.getItem("modules") || "[]");
	} catch {
		return [];
	}
}

export function hasModuleAccess(moduleKey) {
	const modules = getUserModules();
	return modules.includes(moduleKey);
}