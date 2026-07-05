import React from "react";
import {
	Box,
	Typography,
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";

const STEPS = [
	{
		key: "INDENT_CREATED",
		label: "BOM / Indent Created",
		dept: "Engineering",
	},
	{
		key: "SENT_TO_STORE",
		label: "Sent to AKG Store",
		dept: "Engineering",
	},
	{
		key: "STORE_REVIEWED",
		label: "Store Stock Review",
		dept: "Store",
	},
	{
		key: "MATERIAL_RESERVED",
		label: "Material Reserved",
		dept: "Store",
	},
	{
		key: "PURCHASE_REQUEST_RAISED",
		label: "Purchase Request",
		dept: "Store",
	},
	{
		key: "PO_RAISED",
		label: "PO Raised",
		dept: "Purchase",
	},
	{
		key: "MATERIAL_RECEIVED_AT_STORE",
		label: "Material Received",
		dept: "Store",
	},
	{
		key: "GRN_DONE",
		label: "GRN Entry",
		dept: "Store",
	},
	{
		key: "QC_OK",
		label: "QC OK",
		dept: "QC / Store",
	},
	{
		key: "MATERIAL_ACCEPTED_IN_STORE",
		label: "Accepted in Inventory",
		dept: "Store",
	},
	{
		key: "PRODUCTION_INFORMED",
		label: "Production Informed",
		dept: "Store",
	},
	{
		key: "PRODUCTION_DETAILS_ADDED",
		label: "Production Details",
		dept: "Production",
	},
	{
		key: "MATERIAL_ISSUED_TO_PRODUCTION",
		label: "Issued to Harender",
		dept: "Store",
	},
	{
		key: "PROCESSING_STARTED",
		label: "Processing Started",
		dept: "Production",
	},
	{
		key: "PROCESS_COMPLETED",
		label: "Process Completed",
		dept: "Production",
	},
	{
		key: "SUPERVISOR_INFORMED",
		label: "Supervisor Informed",
		dept: "Production",
	},
	{
		key: "READY_FOR_NEXT_STAGE",
		label: "Ready Next Stage",
		dept: "Supervisor",
	},
];

const indexOfStage = (stage) => {
	const index = STEPS.findIndex((s) => s.key === stage);
	return index < 0 ? 0 : index;
};

export default function VenFlowTracker({ stage }) {
	const activeIndex = indexOfStage(stage);

	return (
		<Box sx={trackerSx}>
			<Box sx={trackerHeaderSx}>
				<Typography sx={trackerTitleSx}>
					Live Workflow Tracker
				</Typography>

				<Typography sx={trackerSubSx}>
					Department-wise movement from requirement to job closure
				</Typography>
			</Box>

			<Box sx={stepsSx}>
				{STEPS.map((step, index) => {
					const completed = index < activeIndex;
					const active = index === activeIndex;

					return (
						<Box key={step.key} sx={stepSx}>
							<Box sx={iconWrapSx(completed, active)}>
								{completed ? (
									<CheckCircleRoundedIcon fontSize="small" />
								) : active ? (
									<RadioButtonCheckedRoundedIcon fontSize="small" />
								) : (
									<RadioButtonUncheckedRoundedIcon fontSize="small" />
								)}
							</Box>

							<Box sx={{ minWidth: 0 }}>
								<Typography sx={stepLabelSx(completed, active)}>
									{step.label}
								</Typography>

								<Typography sx={stepDeptSx}>
									{step.dept}
								</Typography>
							</Box>

							{index !== STEPS.length - 1 && (
								<Box sx={lineSx(completed)} />
							)}
						</Box>
					);
				})}
			</Box>
		</Box>
	);
}

const trackerSx = {
	mt: 2,
	mb: 2.5,
	p: 2.2,
	borderRadius: "24px",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.72))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 45px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
};

const trackerHeaderSx = {
	mb: 2,
};

const trackerTitleSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 18,
};

const trackerSubSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.56)",
	fontWeight: 650,
	fontSize: 13,
};

const stepsSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2, minmax(0, 1fr))",
		lg: "repeat(4, minmax(0, 1fr))",
		xl: "repeat(5, minmax(0, 1fr))",
	},
	gap: 1.4,
};

const stepSx = {
	position: "relative",
	display: "flex",
	alignItems: "flex-start",
	gap: 1,
	p: 1.2,
	borderRadius: "16px",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.06)",
	minHeight: 82,
};

const iconWrapSx = (completed, active) => ({
	width: 30,
	height: 30,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	flexShrink: 0,
	color: completed || active ? "#fff" : "rgba(255,255,255,.35)",
	background: completed
		? "linear-gradient(135deg,#16a34a,#22c55e)"
		: active
			? "linear-gradient(135deg,#2563eb,#3b82f6)"
			: "rgba(255,255,255,.06)",
	boxShadow: active
		? "0 10px 24px rgba(37,99,235,.32)"
		: "none",
});

const stepLabelSx = (completed, active) => ({
	color: completed || active ? "#fff" : "rgba(255,255,255,.56)",
	fontWeight: completed || active ? 950 : 800,
	fontSize: 12,
	lineHeight: 1.35,
});

const stepDeptSx = {
	mt: 0.5,
	color: "rgba(255,255,255,.42)",
	fontSize: 11,
	fontWeight: 750,
};

const lineSx = (completed) => ({
	display: { xs: "none", lg: "block" },
	position: "absolute",
	right: -12,
	top: 25,
	width: 12,
	height: 2,
	background: completed
		? "rgba(34,197,94,.75)"
		: "rgba(255,255,255,.10)",
});
