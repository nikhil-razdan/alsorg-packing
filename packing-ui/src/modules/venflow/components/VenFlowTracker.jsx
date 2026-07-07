import React from "react";
import {
	Box,
	Typography,
} from "@mui/material";

import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

const MILESTONES = [
	{
		key: "REQUEST_CREATED",
		label: "Request Created",
	},
	{
		key: "STORE_CHECK",
		label: "Store Check",
	},
	{
		key: "PO_RAISED",
		label: "PO Raised",
	},
	{
		key: "PRODUCTION_STARTED",
		label: "Production Started",
	},
	{
		key: "COMPLETED",
		label: "Completed",
	},
];

const STAGE_TO_INDEX = {
	INDENT_CREATED: 0,

	SENT_TO_STORE: 1,
	STORE_REVIEWED: 1,
	STOCK_AVAILABLE: 1,
	MATERIAL_RESERVED: 1,
	PURCHASE_REQUEST_RAISED: 1,

	PO_RAISED: 2,
	MATERIAL_RECEIVED_AT_STORE: 2,
	GRN_DONE: 2,
	QC_PENDING: 2,
	QC_OK: 2,
	MATERIAL_ACCEPTED_IN_STORE: 2,
	PRODUCTION_INFORMED: 2,
	PRODUCTION_DETAILS_ADDED: 2,
	MATERIAL_ISSUED_TO_PRODUCTION: 2,

	PROCESSING_STARTED: 3,

	PROCESS_COMPLETED: 4,
	SUPERVISOR_INFORMED: 4,
	READY_FOR_NEXT_STAGE: 4,
};

const formatDateTime = (value) => {
	if (!value) return "—";

	return String(value)
		.replace("T", " ")
		.slice(0, 16);
};

const getStageDate = (entry, index) => {
	if (!entry) return "—";

	if (index === 0) {
		return formatDateTime(entry.raisedAt || entry.createdAt);
	}

	if (index === 1) {
		return formatDateTime(
			entry.storeReviewedAt ||
			entry.sentToStoreAt ||
			entry.updatedAt
		);
	}

	if (index === 2) {
		return formatDateTime(
			entry.poRaisedAt ||
			entry.poDate ||
			entry.updatedAt
		);
	}

	if (index === 3) {
		return formatDateTime(
			entry.processingStartedAt ||
			entry.productionStartedAt
		);
	}

	return formatDateTime(
		entry.processCompletedAt ||
		entry.jobDoneAt ||
		entry.updatedAt
	);
};

export default function VenFlowTracker({
	stage,
	entry,
}) {
	const activeIndex =
		STAGE_TO_INDEX[stage] ?? 0;

	return (
		<Box sx={trackerSx}>
			{MILESTONES.map((step, index) => {
				const completed = index < activeIndex;
				const active = index === activeIndex;
				const pending = index > activeIndex;

				return (
					<Box key={step.key} sx={stepWrapSx}>
						<Box sx={lineSx(completed, active, index)} />

						<Box sx={circleSx(completed, active, pending)}>
							{completed ? (
								<CheckRoundedIcon sx={{ fontSize: 18 }} />
							) : (
								index + 1
							)}
						</Box>

						<Typography sx={labelSx(completed, active)}>
							{step.label}
						</Typography>

						<Typography sx={dateSx}>
							{getStageDate(entry, index)}
						</Typography>
					</Box>
				);
			})}
		</Box>
	);
}

const trackerSx = {
	width: "100%",
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(5, minmax(0,1fr))",
	},
	alignItems: "start",
	position: "relative",
	py: 2,
	px: {
		xs: 1,
		md: 2,
	},
};

const stepWrapSx = {
	position: "relative",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	minHeight: 82,
};

const lineSx = (completed, active, index) => ({
	display: {
		xs: "none",
		md: index === 0 ? "none" : "block",
	},
	position: "absolute",
	top: 15,
	left: "-50%",
	width: "100%",
	height: 4,
	borderRadius: 999,
	background:
		completed || active
			? "linear-gradient(90deg,#2563eb,#3b82f6)"
			: "rgba(148,163,184,.24)",
	zIndex: 0,
});

const circleSx = (completed, active, pending) => ({
	width: 34,
	height: 34,
	borderRadius: "50%",
	display: "grid",
	placeItems: "center",
	position: "relative",
	zIndex: 1,
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
	background: completed
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: active
			? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
			: "rgba(148,163,184,.45)",
	border: active
		? "2px solid rgba(147,197,253,.70)"
		: "1px solid rgba(255,255,255,.14)",
	boxShadow: active
		? "0 0 0 5px rgba(59,130,246,.16), 0 12px 28px rgba(37,99,235,.34)"
		: completed
			? "0 10px 24px rgba(37,99,235,.24)"
			: "none",
	opacity: pending ? 0.72 : 1,
});

const labelSx = (completed, active) => ({
	mt: 1.1,
	color:
		completed || active
			? "#fff"
			: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: completed || active ? 900 : 750,
	lineHeight: 1.25,
});

const dateSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.48)",
	fontSize: 10.5,
	fontWeight: 650,
	lineHeight: 1.25,
};