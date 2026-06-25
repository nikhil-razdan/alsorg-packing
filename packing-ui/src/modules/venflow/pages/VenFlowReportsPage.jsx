import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

import {
	cardSx,
	pageSubSx,
	pageTitleSx,
} from "../venflowTheme";

export default function VenFlowReportsPage() {
	const reports = [
		"Pending Store Check Report",
		"Pending Requisition Report",
		"Pending Ordered Quantity Report",
		"Pending Receiving Report",
		"Balance Quantity Report",
		"Delayed Expected Date Report",
		"PD-wise Veneer Summary",
		"Client-wise Veneer Summary",
		"Excel Export",
	];

	return (
		<Box>
			<Typography sx={pageTitleSx}>
				VenFlow Reports
			</Typography>

			<Typography sx={pageSubSx}>
				Reports will cover pending store checks, requisition gaps, delayed
				receiving, balance quantities, PD-wise movement and client-wise tracking.
			</Typography>

			<Card sx={{ ...cardSx, mt: 2.5 }}>
				<CardContent sx={{ p: 3 }}>
					<Typography sx={sectionTitleSx}>
						Coming Next
					</Typography>

					<Box sx={reportsGridSx}>
						{reports.map((item, index) => (
							<Box key={item} sx={reportItemSx}>
								<Box sx={indexSx}>
									{index + 1}
								</Box>

								<Typography sx={reportTextSx}>
									{item}
								</Typography>
							</Box>
						))}
					</Box>
				</CardContent>
			</Card>
		</Box>
	);
}

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