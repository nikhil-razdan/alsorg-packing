import React, { useEffect, useState } from "react";
import {
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { venflowApi } from "../api/venflowApi";

import {
	loadingBoxSx,
	pageHeaderSx,
	pageSubSx,
	pageTitleSx,
	primaryBtnSx,
} from "../venflowTheme";

export default function VenFlowDashboard() {
	const navigate = useNavigate();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		try {
			setLoading(true);
			const res = await venflowApi.getDashboard();
			setData(res.data || {});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	if (loading) {
		return (
			<Box sx={loadingBoxSx}>
				<CircularProgress />
			</Box>
		);
	}

	const cards = [
		{
			label: "Total Entries",
			value: data.totalEntries,
			subtle: "All veneer requirements",
			accent: "#60a5fa",
		},
		{
			label: "Pending Store Check",
			value: data.pendingStoreCheck,
			subtle: "Store status not updated",
			accent: "#f59e0b",
		},
		{
			label: "Pending Requisition",
			value: data.pendingRequisition,
			subtle: "Slip pending after store check",
			accent: "#fb7185",
		},
		{
			label: "Pending Order Qty",
			value: data.pendingOrderQty,
			subtle: "Purchase quantity pending",
			accent: "#a78bfa",
		},
		{
			label: "Pending Receiving",
			value: data.pendingReceiving,
			subtle: "Ordered but not completed",
			accent: "#22c55e",
		},
		{
			label: "Balance Pending",
			value: data.balancePending,
			subtle: "Received quantity short",
			accent: "#06b6d4",
		},
		{
			label: "Delayed Items",
			value: data.delayedItems,
			subtle: "Expected date crossed",
			accent: "#ef4444",
		},
		{
			label: "Completed",
			value: data.completedEntries,
			subtle: "Fully received / closed",
			accent: "#34d399",
		},
	];

	return (
		<Box>
			<Box sx={pageHeaderSx}>
				<Box>
					<Typography sx={pageTitleSx}>
						Veneer Dashboard
					</Typography>

					<Typography sx={pageSubSx}>
						Live tracking of veneer requirement, store status, requisition,
						ordered quantity, receiving and balance closure.
					</Typography>
				</Box>

				<Button
					variant="contained"
					onClick={() => navigate("/venflow/create")}
					sx={primaryBtnSx}
				>
					New Veneer Requirement
				</Button>
			</Box>

			<Box sx={kpiGridSx}>
				{cards.map((card) => (
					<Card key={card.label} sx={kpiCardSx(card.accent)}>
						<CardContent sx={{ p: 2.4 }}>
							<Box sx={cardAccentSx(card.accent)} />

							<Typography sx={kpiLabelSx}>
								{card.label}
							</Typography>

							<Typography sx={kpiValueSx}>
								{card.value ?? 0}
							</Typography>

							<Typography sx={kpiSubtleSx}>
								{card.subtle}
							</Typography>
						</CardContent>
					</Card>
				))}
			</Box>
		</Box>
	);
}

const kpiGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: 1.8,
};

const kpiCardSx = (accent) => ({
	position: "relative",
	overflow: "hidden",
	borderRadius: "22px",
	background: "rgba(15,23,42,.78)",
	border: `1px solid ${accent}44`,
	boxShadow: "0 18px 35px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	color: "#fff",
	transition: "all .25s ease",
	"&:hover": {
		transform: "translateY(-4px)",
		boxShadow: `0 20px 42px ${accent}22`,
	},
});

const cardAccentSx = (accent) => ({
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	height: 4,
	background: accent,
});

const kpiLabelSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 12,
	fontWeight: 850,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

const kpiValueSx = {
	mt: 1.2,
	fontSize: 34,
	fontWeight: 950,
	color: "#fff",
	lineHeight: 1,
};

const kpiSubtleSx = {
	mt: 1,
	color: "rgba(255,255,255,.52)",
	fontSize: 12,
	fontWeight: 650,
};