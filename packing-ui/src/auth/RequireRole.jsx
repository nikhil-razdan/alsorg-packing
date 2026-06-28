import { Navigate } from "react-router-dom";
import { normalizeRole } from "../utils/permissions";
import { useAuth } from "./AuthContext";

function RequireRole({
	children,
	allowed,
}) {
	const { role, authLoading, isLoggedIn } = useAuth();

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return <Navigate to="/login" replace />;
	}

	const normalizedAllowed = allowed.map((item) =>
		normalizeRole(item)
	);

	if (!normalizedAllowed.includes(role)) {
		return <Navigate to="/modules" replace />;
	}

	return children;
}

export default RequireRole;