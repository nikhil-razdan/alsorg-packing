import React from "react";
import { Chip } from "@mui/material";

const STATUS_CONFIG = {
	AVAILABLE_IN_STORE: {
		label: "Available in Store",
		bg: "#dcfce7",
		color: "#166534",
	},
	NOT_AVAILABLE: {
		label: "Not Available",
		bg: "#fee2e2",
		color: "#991b1b",
	},
	PARTIALLY_AVAILABLE: {
		label: "Partially Available",
		bg: "#fef3c7",
		color: "#92400e",
	},
	PENDING: {
		label: "Pending",
		bg: "#ffedd5",
		color: "#9a3412",
	},
	HOLD: {
		label: "Hold",
		bg: "#e5e7eb",
		color: "#374151",
	},
};

export default function VenFlowStatusChip({ status }) {
	if (!status) {
		return (
			<Chip
				label="Not Updated"
				size="small"
				sx={{
					background: "#f1f5f9",
					color: "#64748b",
					fontWeight: 800,
				}}
			/>
		);
	}

	const config = STATUS_CONFIG[status] || {
		label: status,
		bg: "#f1f5f9",
		color: "#334155",
	};

	return (
		<Chip
			label={config.label}
			size="small"
			sx={{
				background: config.bg,
				color: config.color,
				fontWeight: 900,
			}}
		/>
	);
}