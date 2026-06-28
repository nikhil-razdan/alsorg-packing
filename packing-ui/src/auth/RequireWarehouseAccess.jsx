import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function RequireWarehouseAccess({ children }) {
	const {
		role,
		warehouseAccess,
		authLoading,
		isLoggedIn,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return <Navigate to="/login" replace />;
	}

	const allowed =
		role === "ADMIN" ||
		role === "DISPATCH" ||
		role === "WAREHOUSE" ||
		warehouseAccess;

	if (!allowed) {
		return <Navigate to="/modules" replace />;
	}

	return children;
}

export default RequireWarehouseAccess;