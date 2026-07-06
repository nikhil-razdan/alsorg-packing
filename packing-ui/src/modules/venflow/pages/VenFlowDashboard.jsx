import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { venflowApi } from "../api/venflowApi";

import {
    loadingBoxSx,
    pageHeaderSx,
    pageSubSx,
    pageTitleSx,
    primaryBtnSx,
} from "../venflowTheme";

import {
    defaultVenFlowPathForRole,
    getVenFlowRole,
    isVenFlowAdminOrManager,
} from "../../../utils/venflowAccess";

export default function VenFlowDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const role = getVenFlowRole();
    const isAdminManager = isVenFlowAdminOrManager(role);

    const load = async () => {
        try {
            setLoading(true);
            const res = await venflowApi.getDashboard();
            setData(res.data || {});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (loading) {
        return (
            <Box sx={loadingBoxSx}>
                <CircularProgress />
            </Box>
        );
    }

    const cards = [
        {
            label: "Total Orders",
            value: data.totalEntries,
            subtle: "All plant-wise veneer requirements",
            accent: "#60a5fa",
        },
        {
            label: "Pending Store Check",
            value: data.pendingStoreCheck,
            subtle: "Production raised, Store pending",
            accent: "#f59e0b",
        },
        {
            label: "Sent to Purchase",
            value: data.sentToPurchase,
            subtle: "Store forwarded to Purchase",
            accent: "#a78bfa",
        },
        {
            label: "Pending PO Raise",
            value: data.pendingPoRaise,
            subtle: "Purchase has not raised PO",
            accent: "#fb7185",
        },
        {
            label: "Pending PO Approval",
            value: data.pendingPoApproval,
            subtle: "PO raised, approval pending",
            accent: "#f97316",
        },
        {
            label: "Pending Receiving",
            value: data.pendingMaterialReceiving,
            subtle: "PO approved, Store receiving pending",
            accent: "#06b6d4",
        },
        {
            label: "Production Not Started",
            value: data.productionNotStarted,
            subtle: "Material informed, start pending",
            accent: "#38bdf8",
        },
        {
            label: "Production Started",
            value: data.productionStarted,
            subtle: "Work in progress",
            accent: "#22c55e",
        },
        {
            label: "Job Done",
            value: data.jobDone,
            subtle: "Completed production work",
            accent: "#34d399",
        },
        {
            label: "Delayed Items",
            value: data.delayedItems,
            subtle: "Expected date crossed",
            accent: "#ef4444",
        },
        {
            label: "Pending Work Loading",
            value: data.totalPendingWorkLoading,
            subtle: "Everything except Job Done",
            accent: "#facc15",
        },
    ];

    return (
        <Box>
            <Box sx={pageHeaderSx}>
                <Box>
                    <Typography sx={pageTitleSx}>
                        Veneer Dashboard
                    </Typography>

                    <Typography sx={pageSubSx}>
                        Live tracking of BOM / Indent creation, AKG Store review, purchase request,
                        PO, GRN, QC, inventory acceptance, issue to production and process closure.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    onClick={() => navigate(defaultVenFlowPathForRole(role))}
                    sx={primaryBtnSx}
                >
                    Open My Work
                </Button>

                {(role === "VENFLOW_ENGINEERING" || isAdminManager) && (
                    <Button
                        variant="contained"
                        onClick={() => navigate("/venflow/create")}
                        sx={primaryBtnSx}
                    >
                        New Veneer Requirement
                    </Button>
                )}
            </Box>

            <Box sx={kpiGridSx}>
                {cards.map((card) => (
                    <Card key={card.label} sx={kpiCardSx(card.accent)}>
                        <CardContent sx={{ p: 2.4 }}>
                            <Box sx={cardAccentSx(card.accent)} />

                            <Typography sx={kpiLabelSx}>
                                {card.label}
                            </Typography>

                            <Typography sx={kpiValueSx}>
                                {card.value ?? 0}
                            </Typography>

                            <Typography sx={kpiSubtleSx}>
                                {card.subtle}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 1.8,
};

const kpiCardSx = (accent) => ({
    position: "relative",
    overflow: "hidden",
    borderRadius: "22px",
    background: "rgba(15,23,42,.78)",
    border: `1px solid ${accent}44`,
    boxShadow: "0 18px 35px rgba(2,6,23,.32)",
    backdropFilter: "blur(18px)",
    color: "#fff",
    transition: "all .25s ease",
    "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: `0 20px 42px ${accent}22`,
    },
});

const cardAccentSx = (accent) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: accent,
});

const kpiLabelSx = {
    color: "rgba(255,255,255,.62)",
    fontSize: 12,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const kpiValueSx = {
    mt: 1.2,
    fontSize: 34,
    fontWeight: 950,
    color: "#fff",
    lineHeight: 1,
};

const kpiSubtleSx = {
    mt: 1,
    color: "rgba(255,255,255,.52)",
    fontSize: 12,
    fontWeight: 650,
};