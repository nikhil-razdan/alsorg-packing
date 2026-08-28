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
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	/*
	 * UTL_DISPATCH is allowed to open this page by permissions.js, but
	 * WarehousePage sends that identity only to /api/utl/warehouse.
	 * No generic WAREHOUSE authority is granted here.
	 */
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
						location.pathname +
						location.search +
						location.hash,
				}}
			/>
		);
	}

	return children;
}

export default RequireWarehouseAccess;
