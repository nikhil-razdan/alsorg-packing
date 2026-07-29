import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
export { default } from "./RequireAuth";

export default function ProtectedRoute({ children }) {
	const {
		isLoggedIn,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return (
			<div
				style={{
					height: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#0f172a",
					color: "#fff",
					fontWeight: 700,
				}}
			>
				Loading...
			</div>
		);
	}

	if (!isLoggedIn) {
		return <Navigate to="/login" replace />;
	}

	return children;
}