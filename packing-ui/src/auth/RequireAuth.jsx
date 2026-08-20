import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthContext";
import HrFlowPublicEntry from "../modules/hrflow/HrFlowPublicEntry";

const isHrPublicPath = (pathname = "") => {
	const clean = String(pathname || "").trim().toLowerCase();
	return (
		clean.includes("/hr/apply/") ||
		clean.includes("/hr/onboarding/")
	);
};

function AuthLoadingScreen() {
	return (
		<div
			style={{
				height: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "linear-gradient(135deg,#020617,#0f172a,#111827)",
				color: "#fff",
				fontWeight: 800,
				fontFamily: "Inter, system-ui, sans-serif",
			}}
		>
			Loading session...
		</div>
	);
}

export default function RequireAuth({ children }) {
	const location = useLocation();
	const {
		isLoggedIn,
		authLoading,
	} = useAuth();

	/*
	 * HRFlow candidate and onboarding links are public frontend routes.
	 * Their backend APIs are secured by the short-lived HRFlow token itself.
	 *
	 * This bypass protects deployments where the app's catch-all route is
	 * wrapped in RequireAuth. The explicit /hr/* route in App.jsx is still
	 * required as the primary route so a top-level wildcard Navigate cannot
	 * swallow these links.
	 */
	if (isHrPublicPath(location.pathname)) {
		return <HrFlowPublicEntry />;
	}

	if (authLoading) {
		return <AuthLoadingScreen />;
	}

	if (!isLoggedIn) {
		return (
			<Navigate
				to="/login"
				replace
				state={{
					from: location.pathname + location.search,
				}}
			/>
		);
	}

	return children;
}
