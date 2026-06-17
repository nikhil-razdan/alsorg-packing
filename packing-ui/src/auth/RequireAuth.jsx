import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import API from "../services/api";
import { normalizeRole } from "../utils/permissions";

function RequireAuth({ children }) {
	const token = localStorage.getItem("token");

	const [loading, setLoading] = useState(!!token);
	const [ok, setOk] = useState(false);

	useEffect(() => {
		if (!token) return;

		let active = true;

		API.get("/auth/me", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
			.then((res) => {
				if (!active) return;

				const data = res.data || {};

				const finalRole = normalizeRole(
					data?.role ||
					data?.user?.role ||
					localStorage.getItem("role")
				);

				const finalUsername =
					data?.username ||
					data?.user?.username ||
					localStorage.getItem("username") ||
					"";

				const finalWarehouseAccess =
					data?.warehouseAccess === true ||
					data?.user?.warehouseAccess === true ||
					finalRole === "ADMIN" ||
					finalRole === "WAREHOUSE";

				localStorage.setItem("role", finalRole);
				localStorage.setItem("username", finalUsername);
				localStorage.setItem("warehouseAccess", String(finalWarehouseAccess));

				setOk(true);
			})
			.catch(() => {
				if (active) {
					localStorage.clear();
					setOk(false);
				}
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [token]);

	if (!token) {
		return <Navigate to="/login" replace />;
	}

	if (loading) {
		return (
			<div
				style={{
					height: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background:
						"#0f172a",
					color: "#fff",
					fontWeight: 700,
				}}
			>
				Loading...
			</div>
		);
	}

	return ok ? children : <Navigate to="/login" replace />;
}

export default RequireAuth;