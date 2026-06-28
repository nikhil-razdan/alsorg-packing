import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireModule({ moduleKey, children }) {
	const { modules, authLoading, isLoggedIn } = useAuth();

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return <Navigate to="/login" replace />;
	}

	if (!modules.includes(moduleKey)) {
		return <Navigate to="/modules" replace />;
	}

	return children;
}