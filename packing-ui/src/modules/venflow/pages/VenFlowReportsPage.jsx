import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

export default function VenFlowReportsPage() {
	return (
		<Box>
			<Typography sx={titleSx}>
				VenFlow Reports
			</Typography>

			<Typography sx={subSx}>
				Reports will include pending store check, pending requisition, pending receiving, delayed expected date, balance pending, PD-wise and client-wise tracking.
			</Typography>

			<Card sx={cardSx}>
				<CardContent>
					<Typography sx={{ fontWeight: 900 }}>
						Coming next:
					</Typography>

					<Typography sx={{ mt: 1, color: "#64748b", lineHeight: 1.8 }}>
						1. Pending Requisition Report<br />
						2. Pending Receiving Report<br />
						3. Balance Qty Report<br />
						4. Delayed Expected Date Report<br />
						5. Client-wise Veneer Summary<br />
						6. Excel Export
					</Typography>
				</CardContent>
			</Card>
		</Box>
	);
}

const titleSx = {
	fontSize: 28,
	fontWeight: 950,
	color: "#111827",
	letterSpacing: "-0.04em",
};

const subSx = {
	mt: 0.5,
	mb: 2.5,
	color: "#64748b",
	fontWeight: 650,
	lineHeight: 1.7,
};

const cardSx = {
	borderRadius: 4,
	border: "1px solid #e5e7eb",
	boxShadow: "0 18px 45px rgba(15,23,42,.06)",
};