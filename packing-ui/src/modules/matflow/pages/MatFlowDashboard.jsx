import React from "react";

import {
	Box,
	Button,
	Card,
	Chip,
	Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import {
	heroBadgeSx,
	heroSubSx,
	heroSx,
	heroTitleSx,
	pageSx,
	panelSubSx,
	panelSx,
	panelTitleSx,
	primaryBtnSx,
} from "../matflowTheme";

import LayersOutlinedIcon
	from "@mui/icons-material/LayersOutlined";
import EngineeringOutlinedIcon
	from "@mui/icons-material/EngineeringOutlined";
import StorefrontOutlinedIcon
	from "@mui/icons-material/StorefrontOutlined";
import DescriptionOutlinedIcon
	from "@mui/icons-material/DescriptionOutlined";
import ShoppingCartOutlinedIcon
	from "@mui/icons-material/ShoppingCartOutlined";
import ApprovalOutlinedIcon
	from "@mui/icons-material/ApprovalOutlined";
import ArrowForwardIcon
	from "@mui/icons-material/ArrowForward";

const stages = [
	{
		title: "Projects and Drawings",
		subtitle:
			"Create project, PD, drawing and plant context.",
		path: "/matflow/projects",
		icon: <FolderOutlinedIcon />,
		accent: "#38bdf8",
	},
	{
		title: "Material Master",
		subtitle:
			"Maintain standardized materials, units and specifications.",
		path: "/matflow/materials",
		icon: <Inventory2OutlinedIcon />,
		accent: "#60a5fa",
	},
	{
		title: "Operational BOMs",
		subtitle:
			"Prepare and approve project-specific operational BOM revisions.",
		path: "/matflow/boms",
		icon: <AccountTreeOutlinedIcon />,
		accent: "#22c55e",
	},
	{
		title: "Production Planning",
		subtitle:
			"Raise production material requisitions against effective BOMs.",
		path: "/matflow/production",
		icon: <EngineeringOutlinedIcon />,
		accent: "#f59e0b",
	},
	{
		title: "Store and Reservations",
		subtitle:
			"Check stock, reserve material and identify shortages.",
		path: "/matflow/store",
		icon: <StorefrontOutlinedIcon />,
		accent: "#a78bfa",
	},
	{
		title: "Transfers",
		subtitle:
			"Move material between stores, plants, QC and processing.",
		path: "/matflow/transfers",
		icon: <SwapHorizOutlinedIcon />,
		accent: "#f472b6",
	},
	{
		title: "Purchase",
		subtitle:
			"Process shortages through indents, vendors, POs and receiving.",
		path: "/matflow/purchase",
		icon: <ShoppingCartOutlinedIcon />,
		accent: "#fb7185",
	},
	{
		title: "Quality Control",
		subtitle:
			"Inspect received and transferred materials before use.",
		path: "/matflow/qc",
		icon: <FactCheckOutlinedIcon />,
		accent: "#2dd4bf",
	},
];

export default function MatFlowDashboard() {
	const navigate = useNavigate();

	return (
		<Box sx={pageSx}>
			<Box sx={heroSx}>
				<Chip
					label="MATFLOW CONTROL CENTER"
					sx={heroBadgeSx}
				/>

				<Typography sx={heroTitleSx}>
					Material Planning and Procurement
				</Typography>

				<Typography sx={heroSubSx}>
					Control the complete operational material lifecycle from
					project and drawing registration through BOM approval,
					stock planning, reservations, procurement, QC, transfers,
					production consumption and returns.
				</Typography>
			</Box>

			<Box sx={gridSx}>
				{stages.map((stage, index) => (
					<Card
						key={stage.title}
						sx={stageCardSx(stage.accent)}
					>
						<Box sx={stageTopSx}>
							<Box sx={stageIconSx(stage.accent)}>
								{stage.icon}
							</Box>

							<Chip
								label={`STEP ${index + 1}`}
								size="small"
								sx={stepChipSx}
							/>
						</Box>

						<Typography sx={panelTitleSx}>
							{stage.title}
						</Typography>

						<Typography sx={panelSubSx}>
							{stage.subtitle}
						</Typography>

						<Button
							fullWidth
							endIcon={<ArrowForwardIcon />}
							onClick={() =>
								navigate(stage.path)
							}
							sx={{
								...primaryBtnSx,
								mt: "15px",
							}}
						>
							Open
						</Button>
					</Card>
				))}
			</Box>

			<Card sx={panelSx}>
				<Typography sx={panelTitleSx}>
					Controlled Workflow
				</Typography>

				<Typography sx={panelSubSx}>
					MatFlow maintains its own project-specific operational BOM.
					BOMFlow remains an independent product BOM and costing
					module. No automatic BOMFlow-to-MatFlow release is required.
				</Typography>
			</Card>
		</Box>
	);
}

const gridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(auto-fit,minmax(260px,1fr))",
	gap: "12px",
};

const stageCardSx = (accent) => ({
	...panelSx,
	position: "relative",
	overflow: "hidden",
	borderTop: `3px solid ${accent}`,

	"&:before": {
		content: '""',
		position: "absolute",
		width: "120px",
		height: "120px",
		borderRadius: "50%",
		right: "-55px",
		top: "-55px",
		background: `${accent}12`,
	},
});

const stageTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	mb: "13px",
};

const stageIconSx = (accent) => ({
	width: "42px",
	height: "42px",
	borderRadius: "10px",
	display: "grid",
	placeItems: "center",
	color: accent,
	background: `${accent}18`,
	border: `1px solid ${accent}33`,
});

const stepChipSx = {
	height: "22px",
	borderRadius: 999,
	color: "#94a3b8",
	background: "rgba(255,255,255,.05)",
	border: "1px solid rgba(255,255,255,.08)",
	fontSize: "9px",
	fontWeight: 900,
};