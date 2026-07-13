import React from "react";

import { Chip } from "@mui/material";

const STATUS_CONFIG = {
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
		label: "Hold / Return",
		color: "#ef4444",
	},
};

export default function VenFlowStatusChip({
	status,
}) {
	const config =
		STATUS_CONFIG[status] || {
			label: status || "Not Updated",
			color: "#94a3b8",
		};

	return (
		<Chip
			label={config.label}
			size="small"
			sx={{
				height: 24,
				borderRadius: 999,
				background:
					`${config.color}20`,
				color: config.color,
				border:
					`1px solid ${config.color}38`,
				fontWeight: 900,
				fontSize: 10.5,
			}}
		/>
	);
}