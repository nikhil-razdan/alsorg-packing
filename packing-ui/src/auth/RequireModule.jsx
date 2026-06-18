import React from "react";
import { Navigate } from "react-router-dom";
import { hasModuleAccess } from "../utils/moduleAccess";

export default function RequireModule({ moduleKey, children }) {
	const token = localStorage.getItem("token");

	if (!token) {
		return <Navigate to="/login" replace />;
	}

	if (!hasModuleAccess(moduleKey)) {
		return <Navigate to="/modules" replace />;
	}

	return children;
}