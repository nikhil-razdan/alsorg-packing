import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthContext";

function AuthLoadingScreen() {
	return (
		<div
			style={{
				height: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background:
					"linear-gradient(135deg,#020617,#0f172a,#111827)",
				color: "#fff",
				fontWeight: 800,
				fontFamily:
					"Inter, system-ui, sans-serif",
			}}
		>
			Loading session...
		</div>
	);
}

export default function RequireAuth({
	children,
}) {
	const location = useLocation();

	const {
		isLoggedIn,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return <AuthLoadingScreen />;
	}

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{
					from:
						location.pathname +
						location.search,
				}}
			/>
		);
	}

	return children;
}
