import React from "react";
import { Chip } from "@mui/material";

const STAGE_LABELS = {
	INDENT_CREATED: "BOM / Indent Created",
	SENT_TO_STORE: "Sent to AKG Store",
	STORE_REVIEWED: "Store Reviewed",
	STOCK_AVAILABLE: "Stock Available",
	MATERIAL_RESERVED: "Material Reserved",
	PURCHASE_REQUEST_RAISED: "Purchase Request Raised",
	PO_RAISED: "PO Raised",
	MATERIAL_RECEIVED_AT_STORE: "Material Received at Store",
	GRN_DONE: "GRN Done",
	QC_PENDING: "QC Pending",
	QC_OK: "QC OK",
	QC_NOT_OK: "QC Not OK",
	MATERIAL_ACCEPTED_IN_STORE: "Accepted in Inventory",
	MATERIAL_REJECTED_HOLD_RETURN: "Rejected / Hold / Return",
	PRODUCTION_INFORMED: "Production Informed",
	PRODUCTION_DETAILS_ADDED: "Production Details Added",
	MATERIAL_ISSUED_TO_PRODUCTION: "Issued to Production",
	PROCESSING_STARTED: "Processing Started",
	PROCESS_COMPLETED: "Process Completed",
	SUPERVISOR_INFORMED: "Supervisor Informed",
	READY_FOR_NEXT_STAGE: "Ready for Next Stage",
};

const CONFIG = {
	INDENT_CREATED: {
		bg: "rgba(96,165,250,.14)",
		color: "#93c5fd",
		border: "rgba(96,165,250,.28)",
	},
	SENT_TO_STORE: {
		bg: "rgba(59,130,246,.14)",
		color: "#93c5fd",
		border: "rgba(59,130,246,.28)",
	},
	STORE_REVIEWED: {
		bg: "rgba(245,158,11,.14)",
		color: "#fbbf24",
		border: "rgba(245,158,11,.28)",
	},
	STOCK_AVAILABLE: {
		bg: "rgba(34,197,94,.14)",
		color: "#86efac",
		border: "rgba(34,197,94,.28)",
	},
	MATERIAL_RESERVED: {
		bg: "rgba(20,184,166,.14)",
		color: "#5eead4",
		border: "rgba(20,184,166,.28)",
	},
	PURCHASE_REQUEST_RAISED: {
		bg: "rgba(168,85,247,.14)",
		color: "#c4b5fd",
		border: "rgba(168,85,247,.28)",
	},
	PO_RAISED: {
		bg: "rgba(251,113,133,.14)",
		color: "#fda4af",
		border: "rgba(251,113,133,.28)",
	},
	MATERIAL_RECEIVED_AT_STORE: {
		bg: "rgba(6,182,212,.14)",
		color: "#67e8f9",
		border: "rgba(6,182,212,.28)",
	},
	GRN_DONE: {
		bg: "rgba(14,165,233,.14)",
		color: "#7dd3fc",
		border: "rgba(14,165,233,.28)",
	},
	QC_PENDING: {
		bg: "rgba(245,158,11,.14)",
		color: "#fbbf24",
		border: "rgba(245,158,11,.28)",
	},
	QC_OK: {
		bg: "rgba(34,197,94,.14)",
		color: "#86efac",
		border: "rgba(34,197,94,.28)",
	},
	MATERIAL_ACCEPTED_IN_STORE: {
		bg: "rgba(34,197,94,.16)",
		color: "#bbf7d0",
		border: "rgba(34,197,94,.34)",
	},
	MATERIAL_REJECTED_HOLD_RETURN: {
		bg: "rgba(239,68,68,.14)",
		color: "#fca5a5",
		border: "rgba(239,68,68,.28)",
	},
	PRODUCTION_INFORMED: {
		bg: "rgba(59,130,246,.14)",
		color: "#93c5fd",
		border: "rgba(59,130,246,.28)",
	},
	PRODUCTION_DETAILS_ADDED: {
		bg: "rgba(99,102,241,.14)",
		color: "#c4b5fd",
		border: "rgba(99,102,241,.28)",
	},
	MATERIAL_ISSUED_TO_PRODUCTION: {
		bg: "rgba(249,115,22,.14)",
		color: "#fdba74",
		border: "rgba(249,115,22,.28)",
	},
	PROCESSING_STARTED: {
		bg: "rgba(249,115,22,.14)",
		color: "#fdba74",
		border: "rgba(249,115,22,.28)",
	},
	PROCESS_COMPLETED: {
		bg: "rgba(34,197,94,.18)",
		color: "#bbf7d0",
		border: "rgba(34,197,94,.34)",
	},
	SUPERVISOR_INFORMED: {
		bg: "rgba(14,165,233,.14)",
		color: "#7dd3fc",
		border: "rgba(14,165,233,.28)",
	},
	READY_FOR_NEXT_STAGE: {
		bg: "rgba(34,197,94,.20)",
		color: "#dcfce7",
		border: "rgba(34,197,94,.38)",
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