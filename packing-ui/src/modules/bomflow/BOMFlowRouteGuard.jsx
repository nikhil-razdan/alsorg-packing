import React from "react";
import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../../utils/moduleAccess";
import {
	BOMFLOW_ROLES,
	canAccessBomFlowScreen,
	canEditBomFlowRevision,
	defaultBomFlowPathForRole,
} from "../../utils/bomflowAccess";

const normalizeRole = (value) =>
	String(value || "")
		.replace(/^ROLE_/i, "")
		.trim()
		.toUpperCase();

const effectiveBomFlowRole = ({
	user,
	role,
	roles,
}) => {
	const values = [
		...(Array.isArray(roles) ? roles : []),
		...(Array.isArray(user?.roles) ? user.roles : []),
		role,
		user?.role,
	]
		.map(normalizeRole)
		.filter(Boolean);

	return (
		BOMFLOW_ROLES.find((candidate) =>
			values.includes(candidate)
		) || ""
	);
};

export default function BOMFlowRouteGuard({
	screen,
	requireEdit = false,
	children,
}) {
	const location = useLocation();
	const {
		user,
		role,
		roles,
		modules,
		isLoggedIn,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	const returnLocation = `${location.pathname}${location.search}${location.hash}`;

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{ from: returnLocation }}
			/>
		);
	}

	const accessUser = {
		...(user || {}),
		role: role || user?.role || "",
		roles: Array.isArray(roles)
			? roles
			: (Array.isArray(user?.roles) ? user.roles : []),
		modules: Array.isArray(modules)
			? modules
			: (Array.isArray(user?.modules) ? user.modules : []),
	};

	if (!hasModuleAccessFromUser(accessUser, MODULE_KEYS.BOMFLOW)) {
		return <Navigate to="/modules" replace />;
	}

	const bomRole = effectiveBomFlowRole({
		user,
		role,
		roles,
	});

	if (
		!canAccessBomFlowScreen(screen, bomRole) ||
		(requireEdit && !canEditBomFlowRevision(bomRole))
	) {
		return (
			<Navigate
				to={defaultBomFlowPathForRole(bomRole)}
				replace
				state={{ from: returnLocation }}
			/>
		);
	}

	return children;
}
