import React from "react";

import { Chip } from "@mui/material";

const getTone = (status) => {
    const value = String(
        status || ""
    ).toUpperCase();

    if (
        value.includes("APPROVED") ||
        value.includes("ACTIVE") ||
        value.includes("FULLY") ||
        value.includes("COMPLETED") ||
        value.includes("READY")
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
        value.includes("REJECTED") ||
        value.includes("CANCELLED") ||
        value.includes("RETURNED")
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
        value.includes("HOLD") ||
        value.includes("PENDING") ||
        value.includes("PARTIALLY")
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
        value.includes("SUPERSEDED")
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
    if (!status) return "UNKNOWN";

    return String(status)
        .replaceAll("_", " ");
};

export default function MatFlowStatusChip({
    status,
}) {
    const tone = getTone(status);

    return (
        <Chip
            label={labelStatus(status)}
            size="small"
            sx={{
                height: "23px",
                borderRadius: 999,
                fontSize: "9.5px",
                fontWeight: 900,
                ...tone,
            }}
        />
    );
}