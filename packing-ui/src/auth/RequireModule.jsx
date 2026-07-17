import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireModule({ moduleKey, children }) {
	const {
		modules,
		authLoading,
		isLoggedIn,
		role,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	if (!isLoggedIn) {
		return <Navigate to="/login" replace />;
	}

	if (role === "ADMIN") {
		return children;
	}

	const normalizedModuleKey =
		String(moduleKey || "")
			.trim()
			.toUpperCase();

	const normalizedModules =
		Array.isArray(modules)
			? modules
				.filter(Boolean)
				.map((module) =>
					String(module)
						.trim()
						.toUpperCase()
				)
			: [];

	if (
		!normalizedModules.includes(
			normalizedModuleKey
		)
	) {
		return (
			<Navigate
				to="/modules"
				replace
			/>
		);
	}

	return children;
}