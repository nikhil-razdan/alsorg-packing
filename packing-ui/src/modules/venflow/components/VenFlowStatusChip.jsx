import React from "react";
import { Chip } from "@mui/material";

const STATUS_CONFIG = {
	/* Store */
	AVAILABLE_IN_STORE: {
		label: "Available in Store",
		color: "#22c55e",
	},
	AVAILABLE: {
		label: "Available",
		color: "#22c55e",
	},
	NOT_AVAILABLE: {
		label: "Not Available",
		color: "#ef4444",
	},
	PARTIALLY_AVAILABLE: {
		label: "Partially Available",
		color: "#f59e0b",
	},
	PENDING: {
		label: "Pending",
		color: "#94a3b8",
	},
	HOLD: {
		label: "Hold",
		color: "#ef4444",
	},

	/* PO */
	NOT_RAISED: {
		label: "PO Not Raised",
		color: "#64748b",
	},
	PENDING_DIRECTOR_APPROVAL: {
		label: "Director Approval Pending",
		color: "#f59e0b",
	},
	DIRECTOR_APPROVED: {
		label: "Director Approved",
		color: "#22c55e",
	},
	DIRECTOR_REJECTED: {
		label: "Returned by Director",
		color: "#ef4444",
	},
	ORDER_PLACED: {
		label: "Order Placed",
		color: "#06b6d4",
	},

	/* QC */
	NOT_REQUIRED: {
		label: "QC Not Required",
		color: "#64748b",
	},
	QC_PENDING: {
		label: "QC Pending",
		color: "#f59e0b",
	},
	PARTIALLY_QC_ACCEPTED: {
		label: "Partially QC Accepted",
		color: "#f59e0b",
	},
	PARTIALLY_ACCEPTED: {
		label: "Partially Accepted",
		color: "#f59e0b",
	},
	QC_ACCEPTED: {
		label: "QC Accepted",
		color: "#22c55e",
	},
	OK: {
		label: "QC Accepted",
		color: "#22c55e",
	},
	QC_REJECTED: {
		label: "QC Rejected",
		color: "#ef4444",
	},
	NOT_OK: {
		label: "QC Rejected",
		color: "#ef4444",
	},
	QC_HOLD: {
		label: "QC Hold",
		color: "#ef4444",
	},

	/* Issue */
	NOT_READY: {
		label: "Not Issue Ready",
		color: "#64748b",
	},
	READY_FOR_ISSUE: {
		label: "Ready for Issue",
		color: "#22c55e",
	},
	PARTIALLY_ISSUED: {
		label: "Partially Issued",
		color: "#f59e0b",
	},
	ISSUED: {
		label: "Issued",
		color: "#06b6d4",
	},

	/* Processing */
	NOT_STARTED: {
		label: "Not Started",
		color: "#64748b",
	},
	STARTED: {
		label: "Started",
		color: "#3b82f6",
	},
	COMPLETED: {
		label: "Completed",
		color: "#22c55e",
	},
	READY_FOR_NEXT_STAGE: {
		label: "Ready for Next Stage",
		color: "#22c55e",
	},
};

export default function VenFlowStatusChip({
	status,
}) {
	const normalized = String(
		status || ""
	)
		.trim()
		.toUpperCase();

	const config =
		STATUS_CONFIG[normalized] || {
			label: normalized
				? normalized.replaceAll("_", " ")
				: "Not Updated",
			color: "#94a3b8",
		};

	return (
		<Chip
			label={config.label}
			size="small"
			sx={{
				height: 24,
				borderRadius: 999,
				background: `${config.color}20`,
				color: config.color,
				border: `1px solid ${config.color}38`,
				fontWeight: 900,
				fontSize: 10.5,
			}}
		/>
	);
}