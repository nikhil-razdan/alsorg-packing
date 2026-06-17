import { Navigate } from "react-router-dom";
import { canOpenWarehousePage } from "../utils/permissions";

function RequireWarehouseAccess({ children }) {
	if (!canOpenWarehousePage()) {
		return <Navigate to="/" replace />;
	}

	return children;
}

export default RequireWarehouseAccess;