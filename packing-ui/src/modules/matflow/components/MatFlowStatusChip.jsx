import { Chip } from "@mui/material";

const SUCCESS_STATUSES =
	new Set([
		"ACTIVE",
		"APPROVED",
		"EFFECTIVE",
		"AVAILABLE",
		"READY",
		"RECEIVED",
		"ACCEPTED",
		"ISSUED",
		"COMPLETED",
		"CLOSED",
		"PLACED",
	]);

const ERROR_STATUSES =
	new Set([
		"REJECTED",
		"CANCELLED",
		"FAILED",
		"PO_RETURNED",
	]);

const WARNING_STATUSES =
	new Set([
		"DRAFT",
		"PENDING",
		"SUBMITTED",
		"PLANNED",
		"IN_TRANSIT",
		"PARTIALLY_DISPATCHED",
		"PARTIALLY_RECEIVED",
		"PARTIALLY_ACCEPTED",
		"SHORTAGE_PENDING",
		"HOLD",
		"QC_PENDING",
		"NOT_READY",
		"NOT_AVAILABLE",
	]);

const PURPLE_STATUSES =
	new Set([
		"SUPERSEDED",
		"UNDER_REVIEW",
		"PENDING_DIRECTOR_APPROVAL",
		"PO_PENDING_DIRECTOR_APPROVAL",
	]);

const normalizeStatus = (status) => {
	return String(status || "")
		.trim()
		.toUpperCase();
};

const getTone = (status) => {
	const value =
		normalizeStatus(status);

	if (
		SUCCESS_STATUSES.has(value)
	) {
		return {
			color: "#4ade80",
			background:
				"rgba(34,197,94,.13)",
			border:
				"1px solid rgba(34,197,94,.24)",
		};
	}

	if (
		ERROR_STATUSES.has(value)
	) {
		return {
			color: "#fca5a5",
			background:
				"rgba(239,68,68,.13)",
			border:
				"1px solid rgba(239,68,68,.24)",
		};
	}

	if (
		WARNING_STATUSES.has(value) ||
		value.startsWith("PENDING_") ||
		value.startsWith("PARTIALLY_")
	) {
		return {
			color: "#fbbf24",
			background:
				"rgba(245,158,11,.13)",
			border:
				"1px solid rgba(245,158,11,.24)",
		};
	}

	if (
		PURPLE_STATUSES.has(value)
	) {
		return {
			color: "#c4b5fd",
			background:
				"rgba(139,92,246,.13)",
			border:
				"1px solid rgba(139,92,246,.24)",
		};
	}

	return {
		color: "#7dd3fc",
		background:
			"rgba(14,165,233,.13)",
		border:
			"1px solid rgba(14,165,233,.24)",
	};
};

const labelStatus = (status) => {
	const value =
		normalizeStatus(status);

	if (!value) {
		return "UNKNOWN";
	}

	return value.replaceAll("_", " ");
};

export default function MatFlowStatusChip({
	status,
}) {
	return (
		<Chip
			label={labelStatus(status)}
			size="small"
			sx={{
				height: "23px",
				borderRadius: 999,
				fontSize: "9.5px",
				fontWeight: 900,
				...getTone(status),
			}}
		/>
	);
}