import React from "react";

import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth }
	from "./AuthContext";

import hrflowApi
	from "../modules/hrflow/hrflowApi";

import {
	MODULE_KEYS,
	hasModuleAccessFromUser,
} from "../utils/moduleAccess";

const hasHrFlowBackendAccess = (payload) => {
	const roles = Array.isArray(payload?.roles)
		? payload.roles
		: Array.isArray(payload?.hrRoles)
			? payload.hrRoles
			: Array.isArray(payload?.accessRoles)
				? payload.accessRoles
				: [];

	return Boolean(
		payload?.allowed === true ||
		payload?.hasAccess === true ||
		payload?.globalAdmin === true ||
		payload?.isGlobalAdmin === true ||
		payload?.admin === true ||
		roles.length > 0
	);
};

export default function RequireModule({
	moduleKey,
	children,
}) {
	const location = useLocation();

	const {
		user,
		roles,
		modules,
		authLoading,
		isLoggedIn,
		role,
	} = useAuth();

	const accessUser = React.useMemo(
		() => ({
			...(user || {}),
			role:
				role ||
				user?.role ||
				"",
			roles:
				Array.isArray(roles)
					? roles
					: Array.isArray(user?.roles)
						? user.roles
						: [],
			modules:
				Array.isArray(modules)
					? modules
					: Array.isArray(user?.modules)
						? user.modules
						: [],
		}),
		[user, role, roles, modules]
	);

	const normalizedModuleKey =
		String(moduleKey || "")
			.trim()
			.toUpperCase();

	const ordinaryAccess =
		hasModuleAccessFromUser(
			accessUser,
			normalizedModuleKey
		);

	const requiresHrGrantCheck =
		normalizedModuleKey === MODULE_KEYS.HRFLOW &&
		!ordinaryAccess;

	const sessionKey = String(
		user?.id ||
		user?.username ||
		""
	);

	const [hrGrantState, setHrGrantState] =
		React.useState({
			sessionKey: "",
			loading: false,
			allowed: false,
		});

	React.useEffect(() => {
		let active = true;

		if (
			authLoading ||
			!isLoggedIn ||
			!requiresHrGrantCheck
		) {
			setHrGrantState({
				sessionKey,
				loading: false,
				allowed: false,
			});

			return () => {
				active = false;
			};
		}

		setHrGrantState({
			sessionKey,
			loading: true,
			allowed: false,
		});

		hrflowApi
			.me()
			.then((response) => {
				if (!active) return;

				setHrGrantState({
					sessionKey,
					loading: false,
					allowed:
						hasHrFlowBackendAccess(
							response?.data
						),
				});
			})
			.catch(() => {
				if (!active) return;

				setHrGrantState({
					sessionKey,
					loading: false,
					allowed: false,
				});
			});

		return () => {
			active = false;
		};
	}, [
		authLoading,
		isLoggedIn,
		requiresHrGrantCheck,
		sessionKey,
	]);

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{
					from:
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	const hrGrantReady =
		hrGrantState.sessionKey ===
		sessionKey;

	if (
		requiresHrGrantCheck &&
		(
			!hrGrantReady ||
			hrGrantState.loading
		)
	) {
		return null;
	}

	const permitted =
		ordinaryAccess ||
		(
			normalizedModuleKey === MODULE_KEYS.HRFLOW &&
			hrGrantState.allowed
		);

	if (!permitted) {
		return (
			<Navigate
				to="/modules"
				replace
				state={{
					deniedModule:
						normalizedModuleKey || moduleKey,
					from:
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	return children;
}
