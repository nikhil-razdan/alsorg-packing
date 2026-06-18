import React from "react";
import { Box, Card, Chip, Typography } from "@mui/material";

export default function BOMFlowPlaceholder({ title, subtitle }) {
	return (
		<Box>
			<Card sx={panelSx}>
				<Chip label="COMING NEXT" sx={chipSx} />

				<Typography sx={titleSx}>{title}</Typography>

				<Typography sx={subtitleSx}>{subtitle}</Typography>

				<Typography sx={noteSx}>
					This module will be connected after Product Master and BOM Builder are finalized.
				</Typography>
			</Card>
		</Box>
	);
}

const panelSx = {
	minHeight: 360,
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "center",
	p: 5,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.12)",
	borderRadius: "8px",
	boxShadow: "0 18px 44px rgba(0,0,0,.32)",
};

const chipSx = {
	mb: 2,
	height: 26,
	borderRadius: "4px",
	background: "rgba(142,169,255,.12)",
	color: "#a8c3ff",
	border: "1px solid rgba(142,169,255,.22)",
	fontWeight: 950,
};

const titleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 38,
	letterSpacing: "-0.04em",
};

const subtitleSx = {
	mt: 1,
	color: "rgba(255,255,255,.68)",
	fontWeight: 650,
	fontSize: 17,
	maxWidth: 760,
	lineHeight: 1.7,
};

const noteSx = {
	mt: 3,
	color: "#dbeafe",
	fontWeight: 800,
};