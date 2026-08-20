import React from "react";
import { useLocation } from "react-router-dom";
import { Alert, Box, Paper, Typography } from "@mui/material";
import HrCandidateApplicationPage from "./HrCandidateApplicationPage";
import HrOnboardingPortalPage from "./HrOnboardingPortalPage";
import { HrBrand, hrColors, panelSx } from "./HrFlowCommon";

export default function HrFlowPublicEntry() {
	const location = useLocation();
	const parts = String(location.pathname || "").split("/").filter(Boolean);
	const mode = parts[1] || "";
	const token = parts.slice(2).join("/");

	if (mode === "apply" && token) return <HrCandidateApplicationPage token={decodeURIComponent(token)} />;
	if (mode === "onboarding" && token) return <HrOnboardingPortalPage token={decodeURIComponent(token)} />;

	return (
		<Box sx={{ minHeight: "100vh", background: "#f1f5f9", p: 2, display: "grid", placeItems: "center" }}>
			<Paper sx={{ ...panelSx, p: 3, width: "min(520px,100%)" }}>
				<HrBrand />
				<Typography sx={{ mt: 2.5, fontSize: 22, fontWeight: 950, color: hrColors.ink }}>Invalid HRFlow link</Typography>
				<Alert severity="warning" sx={{ mt: 1.5, borderRadius: 1.6 }}>Please use the exact secure application or onboarding link sent by HR.</Alert>
			</Paper>
		</Box>
	);
}
