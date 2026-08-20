import React from "react";
import { useLocation } from "react-router-dom";
import { Alert, Box, Paper, Typography } from "@mui/material";

import HrCandidateApplicationPage from "./HrCandidateApplicationPage";
import HrOnboardingPortalPage from "./HrOnboardingPortalPage";
import {
	HrBrand,
	HrFlowThemeProvider,
	hrColors,
	panelSx,
} from "./HrFlowCommon";

const decodeToken = (value) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
};

const readPublicRoute = (pathname = "") => {
	const parts = String(pathname || "")
		.split("/")
		.filter(Boolean);

	// Find the HR segment instead of assuming the app is mounted at domain root.
	// Supported examples:
	//   /hr/apply/{token}
	//   /hr/onboarding/{token}
	//   /flowsuite/hr/apply/{token}
	const hrIndex = parts.findIndex(
		(part) => String(part || "").trim().toLowerCase() === "hr"
	);
	if (hrIndex < 0) return { mode: "", token: "" };

	const mode = String(parts[hrIndex + 1] || "").trim().toLowerCase();
	const rawToken = parts.slice(hrIndex + 2).join("/");

	return {
		mode,
		token: decodeToken(rawToken),
	};
};

function HrFlowPublicEntryContent() {
	const location = useLocation();
	const { mode, token } = readPublicRoute(location.pathname);

	if (mode === "apply" && token) {
		return <HrCandidateApplicationPage token={token} />;
	}

	if (mode === "onboarding" && token) {
		return <HrOnboardingPortalPage token={token} />;
	}

	return (
		<Box
			sx={{
				minHeight: "100vh",
				background: "var(--hr-page-bg)",
				p: 2,
				display: "grid",
				placeItems: "center",
			}}
		>
			<Paper sx={{ ...panelSx, p: 3, width: "min(520px,100%)" }}>
				<HrBrand />
				<Typography
					sx={{
						mt: 2.5,
						fontSize: 22,
						fontWeight: 950,
						color: hrColors.ink,
					}}
				>
					Invalid HRFlow link
				</Typography>
				<Alert severity="warning" sx={{ mt: 1.5, borderRadius: 1.6 }}>
					Please use the exact secure application or onboarding link sent by HR.
				</Alert>
			</Paper>
		</Box>
	);
}

export default function HrFlowPublicEntry() {
	return (
		<HrFlowThemeProvider>
			<HrFlowPublicEntryContent />
		</HrFlowThemeProvider>
	);
}
