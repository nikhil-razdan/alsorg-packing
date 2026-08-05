import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { normalizeRole }
	from "../utils/permissions";

import { useAuth }
	from "./AuthContext";

function RequireRole({
	children,
	allowed = [],
}) {
	const location =
		useLocation();

	const {
		hasAnyRole,
		authLoading,
		isLoggedIn,
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
					from:
						location.pathname,
				}}
			/>
		);
	}

	const normalizedAllowed =
		allowed
			.map(normalizeRole)
			.filter(Boolean);

	const permitted =
		hasAnyRole(
			...normalizedAllowed
		);

	if (!permitted) {
		return (
			<Navigate
				to="/modules"
				replace
				state={{
					deniedRoles:
						normalizedAllowed,
					from:
						location.pathname,
				}}
			/>
		);
	}

	return children;
}

export default RequireRole;