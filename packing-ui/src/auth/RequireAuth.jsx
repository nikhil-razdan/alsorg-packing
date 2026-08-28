import {
	Navigate,
	useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthContext";
import HrFlowPublicEntry from "../modules/hrflow/HrFlowPublicEntry";

const isHrPublicPath = (location) => {
	const candidates = [
		String(location?.pathname || ""),
		String(location?.hash || ""),
		typeof window !== "undefined"
			? String(window.location?.pathname || "")
			: "",
		typeof window !== "undefined"
			? String(window.location?.hash || "")
			: "",
	];

	return candidates.some((value) => {
		const clean = value
			.toLowerCase()
			.replace(/^#/, "")
			.replace(/\/+/g, "/")
			.replace(/\/+$/, "");

		const pathOnly = clean.split("?")[0];

		return /(^|\/)hr\/(apply|onboarding)\/[^/]+$/.test(pathOnly);
	});
};

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

	/*
	 * SECONDARY DEFENSIVE GATE
	 *
	 * AuthContext is now the primary direct-link gate for HRFlow public token
	 * pages. This check is retained so the links also remain public if this
	 * guard is rendered directly by an authenticated wildcard route.
	 *
	 * The match is limited strictly to:
	 *   /hr/apply/{token}
	 *   /hr/onboarding/{token}
	 *
	 * Every other FlowSuite route keeps the original authentication behaviour.
	 */
	if (isHrPublicPath(location)) {
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
					from:
						location.pathname +
						location.search,
				}}
			/>
		);
	}

	return children;
}
