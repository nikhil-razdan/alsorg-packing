import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
	canAccessVenFlowScreen,
	defaultVenFlowPathForRole,
	getVenFlowRole,
} from "./utils/venflowAccess";

export default function VenFlowRoleGuard({
	screen,
	children,
}) {
	const location = useLocation();
	const role = getVenFlowRole();

	const allowed = canAccessVenFlowScreen(
		screen,
		role
	);

	if (allowed) {
		return children;
	}

	const fallback = defaultVenFlowPathForRole(role);

	if (fallback === location.pathname) {
		return <Navigate to="/modules" replace />;
	}

	return <Navigate to={fallback} replace />;
}