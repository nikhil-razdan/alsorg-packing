import React from "react";
import { Chip } from "@mui/material";

const STAGE_LABELS = {
	HEADER_CREATED: "Header Created",
	PRODUCT_DETAILS_FILLED: "Product Details Filled",
	STORE_STATUS_UPDATED: "Store Status Updated",
	REQUISITION_UPDATED: "Requisition Updated",
	ORDER_QTY_UPDATED: "Ordered Qty Updated",
	EXPECTED_DATE_UPDATED: "Expected Date Updated",
	RECEIVED_QTY_UPDATED: "Receiving Updated",
	COMPLETED: "Completed",

	PRODUCTION_RAISED: "Production Raised",
	STORE_REVIEWED: "Store Reviewed",
	SENT_TO_PURCHASE: "Sent to Purchase",
	PO_RAISED: "PO Raised",
	PO_APPROVED: "PO Approved",
	MATERIAL_RECEIVED: "Material Received",
	MATERIAL_INFORMED: "Production Informed",
	PRODUCTION_STARTED: "Production Started",
	JOB_DONE: "Job Done",
};

const CONFIG = {
	PRODUCTION_RAISED: {
		bg: "rgba(96,165,250,.14)",
		color: "#93c5fd",
		border: "rgba(96,165,250,.28)",
	},
	STORE_REVIEWED: {
		bg: "rgba(245,158,11,.14)",
		color: "#fbbf24",
		border: "rgba(245,158,11,.28)",
	},
	SENT_TO_PURCHASE: {
		bg: "rgba(168,85,247,.14)",
		color: "#c4b5fd",
		border: "rgba(168,85,247,.28)",
	},
	PO_RAISED: {
		bg: "rgba(251,113,133,.14)",
		color: "#fda4af",
		border: "rgba(251,113,133,.28)",
	},
	PO_APPROVED: {
		bg: "rgba(34,197,94,.14)",
		color: "#86efac",
		border: "rgba(34,197,94,.28)",
	},
	MATERIAL_RECEIVED: {
		bg: "rgba(6,182,212,.14)",
		color: "#67e8f9",
		border: "rgba(6,182,212,.28)",
	},
	MATERIAL_INFORMED: {
		bg: "rgba(59,130,246,.14)",
		color: "#93c5fd",
		border: "rgba(59,130,246,.28)",
	},
	PRODUCTION_STARTED: {
		bg: "rgba(249,115,22,.14)",
		color: "#fdba74",
		border: "rgba(249,115,22,.28)",
	},
	JOB_DONE: {
		bg: "rgba(34,197,94,.18)",
		color: "#bbf7d0",
		border: "rgba(34,197,94,.34)",
	},
	COMPLETED: {
		bg: "rgba(34,197,94,.18)",
		color: "#bbf7d0",
		border: "rgba(34,197,94,.34)",
	},
};

export default function VenFlowStageChip({ stage }) {
	const label = STAGE_LABELS[stage] || stage || "Draft";
	const config = CONFIG[stage] || {
		bg: "rgba(148,163,184,.14)",
		color: "#cbd5e1",
		border: "rgba(148,163,184,.24)",
	};

	return (
		<Chip
			label={label}
			size="small"
			sx={{
				background: config.bg,
				color: config.color,
				border: `1px solid ${config.border}`,
				fontWeight: 900,
			}}
		/>
	);
}