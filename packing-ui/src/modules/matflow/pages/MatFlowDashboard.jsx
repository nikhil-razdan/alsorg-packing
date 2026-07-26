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
		title: "Approved BOM Releases",
		subtitle:
			"Immutable material demand released by BOMFlow.",
		path: "/matflow/releases",
		icon: <LayersOutlinedIcon />,
		accent: "#38bdf8",
	},
	{
		title: "Production Requisitions",
		subtitle:
			"Production raises controlled material requirements.",
		path: "/matflow/production",
		icon: <EngineeringOutlinedIcon />,
		accent: "#60a5fa",
	},
	{
		title: "Store Review",
		subtitle:
			"Store checks stock, blocks materials and records shortages.",
		path: "/matflow/store",
		icon: <StorefrontOutlinedIcon />,
		accent: "#22c55e",
	},
	{
		title: "Material Indents",
		subtitle:
			"Store consolidates shortages for Purchase.",
		path: "/matflow/indents",
		icon: <DescriptionOutlinedIcon />,
		accent: "#f59e0b",
	},
	{
		title: "Purchase Processing",
		subtitle:
			"Purchase compares quotations and prepares orders.",
		path: "/matflow/purchase",
		icon: <ShoppingCartOutlinedIcon />,
		accent: "#a78bfa",
	},
	{
		title: "PO Approval",
		subtitle:
			"Authorized approvers review submitted purchase orders.",
		path: "/matflow/approvals",
		icon: <ApprovalOutlinedIcon />,
		accent: "#f472b6",
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
					Control the complete material lifecycle from an approved
					BOMFlow revision through Production requisition, Store
					blocking, material indent, vendor quotation, purchase order,
					receiving and final issue.
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
					BOMFlow remains responsible for product BOM preparation,
					revision approval and release. MatFlow starts only after an
					approved BOM revision has been released. MatFlow must not
					allow its users to edit the source BOM snapshot.
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