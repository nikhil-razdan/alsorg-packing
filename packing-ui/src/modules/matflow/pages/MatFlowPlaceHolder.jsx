import React from "react";
import {
	Box,
	Card,
	Chip,
	Typography,
} from "@mui/material";

export default function MatFlowPlaceholder({
	title,
	subtitle,
}) {
	return (
		<Box>
			<Card
				sx={{
					p: "24px",
					borderRadius: "12px",
					background:
						"rgba(15,23,42,.82)",
					border:
						"1px solid rgba(255,255,255,.08)",
				}}
			>
				<Chip
					label="BACKEND STEP PENDING"
					sx={{
						color: "#fbbf24",
						background:
							"rgba(245,158,11,.12)",
					}}
				/>

				<Typography
					sx={{
						mt: "12px",
						color: "#fff",
						fontSize: "26px",
						fontWeight: 950,
					}}
				>
					{title}
				</Typography>

				<Typography
					sx={{
						mt: "6px",
						color:
							"rgba(255,255,255,.58)",
					}}
				>
					{subtitle}
				</Typography>
			</Card>
		</Box>
	);
}