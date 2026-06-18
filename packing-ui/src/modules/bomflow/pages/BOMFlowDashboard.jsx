import React from "react";
import { Box, Button, Card, Chip, Grid, Typography } from "@mui/material";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { useNavigate } from "react-router-dom";

const cards = [
	{
		title: "Product Master",
		subtitle: "Create product details, dimensions, photos, drawings and project references.",
		path: "/bomflow/products",
		icon: <Inventory2OutlinedIcon />,
		count: "Create",
	},
	{
		title: "BOM Builder",
		subtitle: "Build section-wise BOM for Metal, Wood, Hardware, Stone, Glass, Paint and Labour.",
		path: "/bomflow/bom-builder",
		icon: <RuleOutlinedIcon />,
		count: "Build",
	},
	{
		title: "Rate Master",
		subtitle: "Maintain approved material rates, vendors, effective dates and bill copies.",
		path: "/bomflow/rate-master",
		icon: <PriceChangeOutlinedIcon />,
		count: "Rates",
	},
	{
		title: "Labour Master",
		subtitle: "Control labour processes, departments, time standards and hourly rates.",
		path: "/bomflow/labour-master",
		icon: <EngineeringOutlinedIcon />,
		count: "Labour",
	},
	{
		title: "Reports",
		subtitle: "Export Excel/PDF reports, costing summaries, material split and change logs.",
		path: "/bomflow/reports",
		icon: <AssessmentOutlinedIcon />,
		count: "Export",
	},
];

export default function BOMFlowDashboard() {
	const navigate = useNavigate();

	return (
		<Box>
			<Box sx={pageHeadSx}>
				<Box>
					<Chip label="BOMFLOW MODULE" sx={labelChipSx} />

					<Typography sx={pageTitleSx}>
						Product Costing Control Center
					</Typography>

					<Typography sx={pageSubSx}>
						Create product profiles, build BOM, maintain rates, calculate costing,
						control workflow and export final reports.
					</Typography>
				</Box>

				<Box sx={costCardSx}>
					<Typography sx={costLabelSx}>ACTIVE COSTINGS</Typography>
					<Typography sx={costValueSx}>12</Typography>
				</Box>
			</Box>

			<Grid container spacing={2.2}>
				{cards.map((card) => (
					<Grid item xs={12} md={6} xl={4} key={card.title}>
						<Card sx={moduleCardSx}>
							<Box sx={cardTopSx}>
								<Box sx={iconSx}>{card.icon}</Box>
								<Chip label={card.count} size="small" sx={miniChipSx} />
							</Box>

							<Typography sx={cardTitleSx}>{card.title}</Typography>

							<Typography sx={cardSubSx}>{card.subtitle}</Typography>

							<Button
								fullWidth
								endIcon={<ArrowForwardIcon />}
								onClick={() => navigate(card.path)}
								sx={openBtnSx}
							>
								Open {card.title}
							</Button>
						</Card>
					</Grid>
				))}
			</Grid>
		</Box>
	);
}

const pageHeadSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	mb: 3,
};

const labelChipSx = {
	height: 24,
	borderRadius: "4px",
	background: "rgba(142,169,255,.12)",
	color: "#a8c3ff",
	border: "1px solid rgba(142,169,255,.22)",
	fontWeight: 900,
	letterSpacing: ".08em",
};

const pageTitleSx = {
	mt: 1.2,
	fontSize: 34,
	fontWeight: 950,
	letterSpacing: "-0.04em",
	color: "#f8fafc",
};

const pageSubSx = {
	mt: 0.6,
	color: "rgba(255,255,255,.70)",
	fontWeight: 650,
};

const costCardSx = {
	minWidth: 190,
	background: "#1c212b",
	border: "1px solid rgba(255,255,255,.10)",
	borderRadius: "8px",
	p: 2,
	boxShadow: "0 16px 40px rgba(0,0,0,.35)",
};

const costLabelSx = {
	color: "rgba(255,255,255,.65)",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".08em",
};

const costValueSx = {
	color: "#52e08f",
	fontSize: 26,
	fontWeight: 950,
	fontFamily: "monospace",
};

const moduleCardSx = {
	p: 2.4,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.10)",
	borderRadius: "8px",
	boxShadow: "0 18px 44px rgba(0,0,0,.30)",
	transition: "all .22s ease",
	"&:hover": {
		transform: "translateY(-3px)",
		borderColor: "rgba(168,195,255,.40)",
	},
};

const cardTopSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	mb: 2,
};

const iconSx = {
	width: 46,
	height: 46,
	borderRadius: "8px",
	background: "rgba(142,169,255,.12)",
	border: "1px solid rgba(142,169,255,.20)",
	color: "#a8c3ff",
	display: "grid",
	placeItems: "center",
};

const miniChipSx = {
	color: "#cbd5e1",
	background: "rgba(255,255,255,.06)",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 850,
};

const cardTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 21,
	mb: 1,
};

const cardSubSx = {
	color: "rgba(255,255,255,.62)",
	fontWeight: 600,
	lineHeight: 1.65,
	minHeight: 76,
	mb: 2,
};

const openBtnSx = {
	height: 42,
	borderRadius: "5px",
	background: "#4f8df7",
	color: "#111827",
	fontWeight: 950,
	textTransform: "none",
	"&:hover": {
		background: "#78a8ff",
	},
};