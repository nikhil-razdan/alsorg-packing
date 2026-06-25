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
};

export default function VenFlowStageChip({ stage }) {
	const label = STAGE_LABELS[stage] || stage || "Draft";

	const isCompleted = stage === "COMPLETED";

	return (
		<Chip
			label={label}
			size="small"
			sx={{
				background: isCompleted ? "#dcfce7" : "#e0f2fe",
				color: isCompleted ? "#166534" : "#075985",
				fontWeight: 900,
			}}
		/>
	);
}