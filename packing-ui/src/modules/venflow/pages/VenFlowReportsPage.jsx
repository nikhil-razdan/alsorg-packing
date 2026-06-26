import React, { useEffect, useState } from "react";
import {
	Box,
	Card,
	CardContent,
	CircularProgress,
	Typography,
} from "@mui/material";

import { venflowApi } from "../api/venflowApi";

import {
	cardSx,
	loadingBoxSx,
	pageSubSx,
	pageTitleSx,
} from "../venflowTheme";

export default function VenFlowReportsPage() {
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;

		venflowApi.getReportSummary()
			.then((res) => {
				if (!active) return;
				setSummary(res.data || {});
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, []);

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	const cards = [
		["Total Orders", summary?.totalOrders, "All veneer orders"],
		["Pending Store Check", summary?.pendingStoreCheck, "Production raised but Store pending"],
		["Sent to Purchase", summary?.sentToPurchase, "Store forwarded to Purchase"],
		["Pending PO Raise", summary?.pendingPoRaise, "Purchase has not raised PO"],
		["Pending PO Approval", summary?.pendingPoApproval, "PO raised but not approved"],
		["Pending Material Receiving", summary?.pendingMaterialReceiving, "PO approved, receiving pending"],
		["Material Received Not Informed", summary?.materialReceivedNotInformed, "Store received but Production not informed"],
		["Production Not Started", summary?.productionNotStarted, "Production informed but not started"],
		["Production Started", summary?.productionStarted, "Work started but not done"],
		["Job Done", summary?.jobDone, "Closed production jobs"],
		["Delayed Items", summary?.delayedItems, "Expected date crossed"],
		["Total Pending Work Loading", summary?.totalPendingWorkLoading, "Everything except Job Done"],
	];

	return (
		<Box>
			<Typography sx={pageTitleSx}>
				VenFlow Reports
			</Typography>

			<Typography sx={pageSubSx}>
				Plant-wise and access-wise reporting for veneer requirement,
				Store review, Purchase PO, material receiving and Production closure.
			</Typography>

			<Box sx={gridSx}>
				{cards.map(([label, value, subtle]) => (
					<Card key={label} sx={reportCardSx}>
						<CardContent sx={{ p: 2.4 }}>
							<Typography sx={labelSx}>
								{label}
							</Typography>

							<Typography sx={valueSx}>
								{value ?? 0}
							</Typography>

							<Typography sx={subtleSx}>
								{subtle}
							</Typography>
						</CardContent>
					</Card>
				))}
			</Box>

			<Card sx={{ ...cardSx, mt: 2.5 }}>
				<CardContent sx={{ p: 3 }}>
					<Typography sx={sectionTitleSx}>
						Next detailed exports
					</Typography>

					<Box sx={reportsGridSx}>
						{[
							"Total Orders List",
							"Date-wise Order Log",
							"Daily Production Done",
							"Total Pending Work Loading",
							"Purchase Pending Report",
							"Store Pending Report",
							"Production Pending Report",
							"Plant-wise Excel Export",
						].map((item, index) => (
							<Box key={item} sx={reportItemSx}>
								<Box sx={indexSx}>{index + 1}</Box>
								<Typography sx={reportTextSx}>{item}</Typography>
							</Box>
						))}
					</Box>
				</CardContent>
			</Card>
		</Box>
	);
}

const gridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
	gap: 1.8,
	mt: 2.5,
};

const reportCardSx = {
	position: "relative",
	overflow: "hidden",
	borderRadius: "22px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(59,130,246,.28)",
	boxShadow: "0 18px 35px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	color: "#fff",
};

const labelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 12,
	fontWeight: 850,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const valueSx = {
	mt: 1.2,
	fontSize: 34,
	fontWeight: 950,
	color: "#fff",
	lineHeight: 1,
};

const subtleSx = {
	mt: 1,
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	fontWeight: 650,
};

const sectionTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 20,
	mb: 2,
};

const reportsGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2, minmax(0,1fr))",
	},
	gap: 1.4,
};

const reportItemSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	p: 1.6,
	borderRadius: "16px",
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.07)",
};

const indexSx = {
	width: 30,
	height: 30,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	background: "rgba(59,130,246,.16)",
	color: "#93c5fd",
	fontWeight: 950,
	fontSize: 12,
};

const reportTextSx = {
	color: "rgba(255,255,255,.78)",
	fontWeight: 800,
	fontSize: 14,
};