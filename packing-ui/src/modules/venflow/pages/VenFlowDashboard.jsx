import React, { useEffect, useState } from "react";
import {
	Box,
	Card,
	CardContent,
	Grid,
	Typography,
	CircularProgress,
	Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { venflowApi } from "../api/venflowApi";

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
			<Box sx={{ p: 5, textAlign: "center" }}>
				<CircularProgress />
			</Box>
		);
	}

	const cards = [
		["Total Entries", data.totalEntries],
		["Pending Store Check", data.pendingStoreCheck],
		["Pending Requisition", data.pendingRequisition],
		["Pending Order Qty", data.pendingOrderQty],
		["Pending Receiving", data.pendingReceiving],
		["Balance Pending", data.balancePending],
		["Delayed Items", data.delayedItems],
		["Completed", data.completedEntries],
	];

	return (
		<Box>
			<Box sx={headerSx}>
				<Box>
					<Typography sx={pageTitleSx}>
						Veneer Dashboard
					</Typography>

					<Typography sx={pageSubSx}>
						Live tracking of veneer requirement, store status, requisition, ordered quantity, receiving and pending balance.
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

			<Grid container spacing={2.2}>
				{cards.map(([label, value]) => (
					<Grid item xs={12} sm={6} md={3} key={label}>
						<Card sx={kpiCardSx}>
							<CardContent>
								<Typography sx={kpiLabelSx}>
									{label}
								</Typography>

								<Typography sx={kpiValueSx}>
									{value ?? 0}
								</Typography>
							</CardContent>
						</Card>
					</Grid>
				))}
			</Grid>
		</Box>
	);
}

const headerSx = {
	display: "flex",
	alignItems: { xs: "flex-start", md: "center" },
	justifyContent: "space-between",
	gap: 2,
	mb: 3,
	flexDirection: { xs: "column", md: "row" },
};

const pageTitleSx = {
	fontSize: 30,
	fontWeight: 950,
	color: "#111827",
	letterSpacing: "-0.05em",
};

const pageSubSx = {
	mt: 0.8,
	color: "#64748b",
	fontWeight: 650,
	maxWidth: 900,
	lineHeight: 1.7,
};

const primaryBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	background: "linear-gradient(135deg,#92400e,#b45309)",
	boxShadow: "0 14px 30px rgba(146,64,14,.22)",
};

const kpiCardSx = {
	borderRadius: 4,
	border: "1px solid #e5e7eb",
	boxShadow: "0 18px 45px rgba(15,23,42,.06)",
};

const kpiLabelSx = {
	color: "#64748b",
	fontSize: 13,
	fontWeight: 850,
};

const kpiValueSx = {
	mt: 1,
	fontSize: 34,
	fontWeight: 950,
	color: "#111827",
};