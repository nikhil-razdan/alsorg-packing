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
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	const allowedValues = Array.isArray(allowed)
		? allowed.flat()
		: [allowed];

	const normalizedAllowed =
		allowedValues
			.map(normalizeRole)
			.filter(Boolean);

	const permitted =
		normalizedAllowed.length > 0 &&
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
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	return children;
}

export default RequireRole;
