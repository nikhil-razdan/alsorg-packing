import {
	Navigate,
	useLocation,
} from "react-router-dom";

import {
	canOpenWarehousePageFromUser,
} from "../utils/permissions";

import {
	useAuth,
} from "./AuthContext";

function RequireWarehouseAccess({
	children,
}) {
	const location =
		useLocation();

	const {
		user,
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

	const allowed =
		canOpenWarehousePageFromUser(
			user
		);

	if (!allowed) {
		return (
			<Navigate
				to="/modules"
				replace
				state={{
					deniedPermission:
						"WAREHOUSE_ACCESS",

					from:
						location.pathname,
				}}
			/>
		);
	}

	return children;
}

export default RequireWarehouseAccess;