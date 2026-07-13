import React from "react";

import { Chip } from "@mui/material";

import {
	getStageMeta,
} from "../venflowWorkflow";

export default function VenFlowStageChip({
	stage,
}) {
	const config = getStageMeta(stage);

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