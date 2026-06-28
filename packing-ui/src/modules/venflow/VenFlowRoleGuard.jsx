import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
	canAccessVenFlowScreen,
	defaultVenFlowPathForRole,
	getVenFlowRole,
} from "./../../utils/venflowAccess";

import { useAuth } from "../../auth/AuthContext";

export default function VenFlowRoleGuard({
	screen,
	children,
}) {
	const location = useLocation();

	const { role } = useAuth();

	const venFlowRole = getVenFlowRole(role);

	const allowed = canAccessVenFlowScreen(
		screen,
		venFlowRole
	);

	if (allowed) {
		return children;
	}

	const fallback =
		defaultVenFlowPathForRole(venFlowRole);

	if (fallback === location.pathname) {
		return <Navigate to="/modules" replace />;
	}

	return <Navigate to={fallback} replace />;
}