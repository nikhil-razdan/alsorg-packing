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

	const cleanRole =
		normalizeRole(role);

	if (
		!normalizedAllowed.includes(
			cleanRole
		)
	) {
		return <Navigate to="/modules" replace />;
	}

	return children;
}

export default RequireRole;