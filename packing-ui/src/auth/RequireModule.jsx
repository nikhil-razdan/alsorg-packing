import React from "react";

import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth }
	from "./AuthContext";

import {
	hasModuleAccessFromUser,
} from "../utils/moduleAccess";

export default function RequireModule({
	moduleKey,
	children,
}) {
	const location = useLocation();

	const {
		user,
		modules,
		authLoading,
		isLoggedIn,
		role,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{
					from: location.pathname,
				}}
			/>
		);
	}

	const accessUser = {
		...(user || {}),
		role:
			role ||
			user?.role ||
			"",
		modules:
			Array.isArray(modules)
				? modules
				: Array.isArray(user?.modules)
					? user.modules
					: [],
	};

	if (
		!hasModuleAccessFromUser(
			accessUser,
			moduleKey
		)
	) {
		return (
			<Navigate
				to="/modules"
				replace
				state={{
					deniedModule:
						moduleKey,
					from:
						location.pathname,
				}}
			/>
		);
	}

	return children;
}