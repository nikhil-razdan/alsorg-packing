import { Navigate } from "react-router-dom";
import { normalizeRole } from "../utils/permissions";

function RequireRole({
	children,
	allowed,
}) {
	const role = normalizeRole(localStorage.getItem("role"));

	const normalizedAllowed = allowed.map((item) =>
		normalizeRole(item)
	);

	if (!normalizedAllowed.includes(role)) {
		return <Navigate to="/" replace />;
	}

	return children;
}

export default RequireRole;