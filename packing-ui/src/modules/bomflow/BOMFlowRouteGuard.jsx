import React from "react";
import {
	Navigate,
	useLocation,
} from "react-router-dom";

import {
	canAccessBomFlowScreen,
	defaultBomFlowPathForRole,
	getBomFlowRole,
} from "../../utils/bomflowAccess";

export default function BOMFlowRouteGuard({
	screen,
	children,
}) {
	const location = useLocation();
	const role = getBomFlowRole();

	if (!canAccessBomFlowScreen(screen, role)) {
		return (
			<Navigate
				to={defaultBomFlowPathForRole(role)}
				replace
				state={{
					from: location.pathname,
				}}
			/>
		);
	}

	return children;
}