import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth }
	from "../../auth/AuthContext";

import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../../utils/moduleAccess";

import {
	canAccessMatFlowScreen,
	defaultMatFlowPathForRole,
	getMatFlowRole,
} from "../../utils/matflowAccess";

function GuardLoadingScreen() {
	return (
		<div
			style={{
				minHeight: "60vh",
				display: "grid",
				placeItems: "center",
				color:
					"rgba(255,255,255,.72)",
				fontWeight: 800,
			}}
		>
			Loading MatFlow...
		</div>
	);
}

export default function MatFlowRouteGuard({
	screen,
	children,
}) {
	const location = useLocation();

	const {
		user,
		role,
		modules,
		isLoggedIn,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return <GuardLoadingScreen />;
	}

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{
					from:
						location.pathname,
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
				: user?.modules || [],
	};

	if (
		!hasModuleAccessFromUser(
			accessUser,
			MODULE_KEYS.MATFLOW
		)
	) {
		return (
			<Navigate
				to="/modules"
				replace
			/>
		);
	}

	const cleanRole =
		getMatFlowRole(role);

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
					from:
						location.pathname,
				}}
			/>
		);
	}

	return children;
}