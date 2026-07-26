import React from "react";

import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
	canAccessMatFlowScreen,
	defaultMatFlowPathForRole,
	getMatFlowRole,
} from "../../utils/matflowAccess";

export default function MatFlowRouteGuard({
	screen,
	children,
}) {
	const location = useLocation();

	const {
		role,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	const cleanRole = getMatFlowRole(role);

	if (
		!canAccessMatFlowScreen(
			screen,
			cleanRole
		)
	) {
		return (
			<Navigate
				to={defaultMatFlowPathForRole(
					cleanRole
				)}
				replace
				state={{
					from: location.pathname,
				}}
			/>
		);
	}

	return children;
}