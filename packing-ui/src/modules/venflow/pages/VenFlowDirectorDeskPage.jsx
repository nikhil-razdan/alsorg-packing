import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TablePagination,
    TextField,
    Typography,
} from "@mui/material";

import {
    useNavigate,
} from "react-router-dom";

import GavelOutlinedIcon
    from "@mui/icons-material/GavelOutlined";
import WarningAmberOutlinedIcon
    from "@mui/icons-material/WarningAmberOutlined";
import ShoppingCartCheckoutOutlinedIcon
    from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import LocalShippingOutlinedIcon
    from "@mui/icons-material/LocalShippingOutlined";
import TimerOutlinedIcon
    from "@mui/icons-material/TimerOutlined";
import OpenInNewOutlinedIcon
    from "@mui/icons-material/OpenInNewOutlined";

import { venflowApi }
    from "../api/venflowApi";

import VenFlowStageChip
    from "../components/VenFlowStageChip";

import {
    errorAlertSx,
    fieldSx,
    loadingBoxSx,
    outlineBtnSx,
    primaryBtnSx,
    premiumScrollbarSx,
} from "../venflowTheme";

const formatMinutes = (minutes) => {
    const value = Number(minutes || 0);

    if (value < 60) {
        return `${value} min`;
    }

    const hours = Math.floor(value / 60);
    const remaining = value % 60;

    if (hours < 24) {
        return `${hours}h ${remaining}m`;
    }

    const days = Math.floor(hours / 24);
    const extraHours = hours % 24;

    return `${days}d ${extraHours}h`;
};

const formatDateTime = (value) => {
    if (!value) return "-";

    return String(value)
        .replace("T", " ")
        .slice(0, 16);
};

export default function VenFlowDirectorDeskPage() {
    const navigate = useNavigate();

    const [dashboard, setDashboard] =
        useState({});

    const [rows, setRows] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [page, setPage] =
        useState(0);

    const [size, setSize] =
        useState(25);

    const [total, setTotal] =
        useState(0);

    const [search, setSearch] =
        useState("");

    const [selectedEntry, setSelectedEntry] =
        useState(null);

    const [decisionMode, setDecisionMode] =
        useState("");

    const [decisionRemarks, setDecisionRemarks] =
        useState("");

    const [saving, setSaving] =
        useState(false);

    const load = async (
        targetPage = page,
        activeSearch = search
    ) => {
        try {
            setLoading(true);
            setError("");

            const [dashboardRes, queueRes] =
                await Promise.all([
                    venflowApi
                        .getDirectorDashboard(),

                    venflowApi
                        .getDirectorPoQueue({
                            page: targetPage,
                            size,
                            search:
                                activeSearch ||
                                undefined,
                        }),
                ]);

            setDashboard(
                dashboardRes.data || {}
            );

            setRows(
                queueRes.data?.content || []
            );

            setTotal(
                queueRes.data
                    ?.totalElements || 0
            );
        } catch (err) {
            setError(
                err?.response?.data
                    ?.message ||
                err?.response?.data
                    ?.error ||
                "Unable to load Director Desk."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(page);
        // eslint-disable-next-line
    }, [page, size]);

    const kpis = useMemo(
        () => [
            {
                label:
                    "Pending Approvals",
                value:
                    dashboard
                        .pendingPoApprovals,
                accent: "#f59e0b",
                icon:
                    <GavelOutlinedIcon />,
            },
            {
                label:
                    "Approval SLA Breached",
                value:
                    dashboard
                        .approvalSlaBreaches,
                accent: "#ef4444",
                icon:
                    <WarningAmberOutlinedIcon />,
            },
            {
                label:
                    "Pending Approval Value",
                value:
                    `₹${Number(
                        dashboard
                            .pendingApprovalAmount ||
                        0
                    ).toLocaleString(
                        "en-IN"
                    )}`,
                accent: "#a78bfa",
                icon:
                    <ShoppingCartCheckoutOutlinedIcon />,
            },
            {
                label:
                    "Approved / Order Pending",
                value:
                    dashboard
                        .approvedAwaitingVendorOrder,
                accent: "#3b82f6",
                icon:
                    <ShoppingCartCheckoutOutlinedIcon />,
            },
            {
                label:
                    "Open Vendor Orders",
                value:
                    dashboard
                        .openVendorOrders,
                accent: "#06b6d4",
                icon:
                    <LocalShippingOutlinedIcon />,
            },
            {
                label:
                    "Vendor Delayed",
                value:
                    dashboard
                        .vendorDeliveryDelayed,
                accent: "#ef4444",
                icon:
                    <TimerOutlinedIcon />,
            },
        ],
        [dashboard]
    );

    const openDecision = (
        row,
        mode
    ) => {
        setSelectedEntry(row);
        setDecisionMode(mode);
        setDecisionRemarks("");
    };

    const submitDecision = async () => {
        if (!selectedEntry) return;

        if (
            decisionMode === "REJECT" &&
            !decisionRemarks.trim()
        ) {
            setError(
                "Rejection reason is required."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");

            if (
                decisionMode === "APPROVE"
            ) {
                await venflowApi
                    .directorApprovePo(
                        selectedEntry.id,
                        {
                            remarks:
                                decisionRemarks
                                    .trim(),
                        }
                    );
            } else {
                await venflowApi
                    .directorRejectPo(
                        selectedEntry.id,
                        {
                            remarks:
                                decisionRemarks
                                    .trim(),
                        }
                    );
            }

            setSelectedEntry(null);
            setDecisionMode("");
            setDecisionRemarks("");

            await load(page);
        } catch (err) {
            setError(
                err?.response?.data
                    ?.message ||
                err?.response?.data
                    ?.error ||
                "Director decision failed."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading && rows.length === 0) {
        return (
            <Box sx={loadingBoxSx}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box>
                    <Typography sx={titleSx}>
                        Director's Desk
                    </Typography>

                    <Typography sx={subSx}>
                        PO approval, live material
                        location, department aging,
                        vendor follow-up and exception
                        control across VenFlow.
                    </Typography>
                </Box>

                <Button
                    startIcon={
                        <OpenInNewOutlinedIcon />
                    }
                    onClick={() =>
                        navigate(
                            "/venflow/entries"
                        )
                    }
                    sx={outlineBtnSx}
                >
                    Open Full Tracker
                </Button>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={errorAlertSx}
                >
                    {error}
                </Alert>
            )}

            <Box sx={kpiGridSx}>
                {kpis.map((item) => (
                    <Card
                        key={item.label}
                        sx={kpiCardSx(
                            item.accent
                        )}
                    >
                        <Box
                            sx={kpiIconSx(
                                item.accent
                            )}
                        >
                            {item.icon}
                        </Box>

                        <Box>
                            <Typography
                                sx={kpiLabelSx}
                            >
                                {item.label}
                            </Typography>

                            <Typography
                                sx={kpiValueSx}
                            >
                                {item.value ?? 0}
                            </Typography>
                        </Box>
                    </Card>
                ))}
            </Box>

            <Card sx={queueCardSx}>
                <Box sx={queueHeaderSx}>
                    <Box>
                        <Typography sx={queueTitleSx}>
                            PO Approval Queue
                        </Typography>

                        <Typography sx={queueSubSx}>
                            Oldest pending approval appears
                            first.
                        </Typography>
                    </Box>

                    <Box sx={searchRowSx}>
                        <TextField
                            size="small"
                            label="Search PD / Client / PO / Vendor"
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                            onKeyDown={(e) => {
                                if (
                                    e.key ===
                                    "Enter"
                                ) {
                                    setPage(0);
                                    load(
                                        0,
                                        search
                                    );
                                }
                            }}
                            sx={fieldSx}
                        />

                        <Button
                            onClick={() => {
                                setPage(0);
                                load(0, search);
                            }}
                            sx={outlineBtnSx}
                        >
                            Search
                        </Button>
                    </Box>
                </Box>

                <Box sx={tableScrollSx}>
                    <Box sx={tableHeadSx}>
                        <Box>PD / Client</Box>
                        <Box>PO / Vendor</Box>
                        <Box>Material / Qty</Box>
                        <Box>Amount</Box>
                        <Box>Current Stage</Box>
                        <Box>Waiting Since</Box>
                        <Box>Action</Box>
                    </Box>

                    {rows.map((row) => {
                        const enteredAt =
                            row.stageEnteredAt
                                ? new Date(
                                    row.stageEnteredAt
                                )
                                : null;

                        const waitingMinutes =
                            enteredAt
                                ? Math.max(
                                    0,
                                    Math.floor(
                                        (Date.now() -
                                            enteredAt.getTime()) /
                                        60000
                                    )
                                )
                                : 0;

                        const pending =
                            row.stage ===
                            "PO_PENDING_DIRECTOR_APPROVAL";

                        return (
                            <Box
                                key={row.id}
                                sx={tableRowSx}
                            >
                                <Box>
                                    <Typography
                                        sx={mainTextSx}
                                    >
                                        {row.pdNo ||
                                            "-"}
                                    </Typography>

                                    <Typography
                                        sx={mutedTextSx}
                                    >
                                        {row.clientName ||
                                            "-"}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography
                                        sx={mainTextSx}
                                    >
                                        {row.poNo ||
                                            "-"}
                                    </Typography>

                                    <Typography
                                        sx={mutedTextSx}
                                    >
                                        {row.vendorName ||
                                            "-"}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography
                                        sx={mainTextSx}
                                    >
                                        {row.materialName ||
                                            "-"}
                                    </Typography>

                                    <Typography
                                        sx={mutedTextSx}
                                    >
                                        {row.orderedQty ??
                                            row.requiredQty ??
                                            "-"}{" "}
                                        {row.unit ||
                                            ""}
                                    </Typography>
                                </Box>

                                <Typography
                                    sx={mainTextSx}
                                >
                                    ₹
                                    {Number(
                                        row.poAmount ||
                                        0
                                    ).toLocaleString(
                                        "en-IN"
                                    )}
                                </Typography>

                                <VenFlowStageChip
                                    stage={row.stage}
                                />

                                <Box>
                                    <Typography
                                        sx={
                                            waitingMinutes >
                                                720
                                                ? overdueTextSx
                                                : mainTextSx
                                        }
                                    >
                                        {formatMinutes(
                                            waitingMinutes
                                        )}
                                    </Typography>

                                    <Typography
                                        sx={mutedTextSx}
                                    >
                                        {formatDateTime(
                                            row.stageEnteredAt
                                        )}
                                    </Typography>
                                </Box>

                                <Box sx={actionRowSx}>
                                    {pending && (
                                        <>
                                            <Button
                                                onClick={() =>
                                                    openDecision(
                                                        row,
                                                        "APPROVE"
                                                    )
                                                }
                                                sx={
                                                    primaryBtnSx
                                                }
                                            >
                                                Approve
                                            </Button>

                                            <Button
                                                onClick={() =>
                                                    openDecision(
                                                        row,
                                                        "REJECT"
                                                    )
                                                }
                                                sx={
                                                    rejectBtnSx
                                                }
                                            >
                                                Return
                                            </Button>
                                        </>
                                    )}

                                    <Button
                                        onClick={() =>
                                            navigate(
                                                `/venflow/entries/${row.id}`
                                            )
                                        }
                                        sx={outlineBtnSx}
                                    >
                                        Open
                                    </Button>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>

                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    rowsPerPage={size}
                    onPageChange={(_, value) =>
                        setPage(value)
                    }
                    onRowsPerPageChange={(e) => {
                        setSize(
                            Number(
                                e.target.value
                            )
                        );
                        setPage(0);
                    }}
                    rowsPerPageOptions={[
                        10,
                        25,
                        50,
                        100,
                    ]}
                    sx={paginationSx}
                />
            </Card>

            <Dialog
                open={Boolean(decisionMode)}
                onClose={() => {
                    if (!saving) {
                        setDecisionMode("");
                        setSelectedEntry(null);
                    }
                }}
                PaperProps={{
                    sx: dialogPaperSx,
                }}
            >
                <DialogTitle sx={dialogTitleSx}>
                    {decisionMode === "APPROVE"
                        ? "Approve Purchase Order"
                        : "Return PO to Purchase"}
                </DialogTitle>

                <DialogContent>
                    <Typography sx={dialogSummarySx}>
                        PO:{" "}
                        {selectedEntry?.poNo ||
                            "-"}
                        <br />
                        Vendor:{" "}
                        {selectedEntry?.vendorName ||
                            "-"}
                        <br />
                        Amount: ₹
                        {Number(
                            selectedEntry?.poAmount ||
                            0
                        ).toLocaleString(
                            "en-IN"
                        )}
                    </Typography>

                    <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        label={
                            decisionMode ===
                                "REJECT"
                                ? "Rejection / Correction Reason"
                                : "Approval Remarks"
                        }
                        value={decisionRemarks}
                        onChange={(e) =>
                            setDecisionRemarks(
                                e.target.value
                            )
                        }
                        required={
                            decisionMode ===
                            "REJECT"
                        }
                        sx={{
                            ...fieldSx,
                            mt: 2,
                        }}
                    />
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setDecisionMode("")
                        }
                        disabled={saving}
                        sx={outlineBtnSx}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={submitDecision}
                        disabled={saving}
                        sx={
                            decisionMode ===
                                "APPROVE"
                                ? primaryBtnSx
                                : rejectBtnSx
                        }
                    >
                        {saving
                            ? "Saving..."
                            : decisionMode ===
                                "APPROVE"
                                ? "Approve PO"
                                : "Return to Purchase"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

const pageSx = {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
};

const heroSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 2,
    flexWrap: "wrap",
};

const titleSx = {
    color: "#fff",
    fontSize: {
        xs: 28,
        md: 36,
    },
    fontWeight: 950,
    letterSpacing: "-.05em",
};

const subSx = {
    mt: 1,
    color: "rgba(255,255,255,.64)",
    fontSize: 13,
    fontWeight: 650,
};

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2,minmax(0,1fr))",
        xl: "repeat(6,minmax(0,1fr))",
    },
    gap: "10px",
};

const kpiCardSx = (accent) => ({
    p: "14px",
    minHeight: 104,
    borderRadius: "16px",
    background:
        "linear-gradient(180deg,rgba(30,41,59,.78),rgba(15,23,42,.78))",
    border: `1px solid ${accent}38`,
    display: "flex",
    alignItems: "center",
    gap: 1.3,
    color: "#fff",
});

const kpiIconSx = (accent) => ({
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: `${accent}20`,
    color: accent,
    border: `1px solid ${accent}40`,
});

const kpiLabelSx = {
    color: "rgba(255,255,255,.62)",
    fontSize: 10.5,
    fontWeight: 900,
    textTransform: "uppercase",
};

const kpiValueSx = {
    mt: 0.7,
    color: "#fff",
    fontSize: 27,
    fontWeight: 950,
};

const queueCardSx = {
    borderRadius: "16px",
    background: "rgba(15,23,42,.74)",
    border: "1px solid rgba(255,255,255,.07)",
    color: "#fff",
    overflow: "hidden",
};

const queueHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    p: 2,
    borderBottom:
        "1px solid rgba(255,255,255,.07)",
    flexWrap: "wrap",
};

const queueTitleSx = {
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
};

const queueSubSx = {
    mt: 0.4,
    color: "rgba(255,255,255,.52)",
    fontSize: 11.5,
};

const searchRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minWidth: {
        xs: "100%",
        md: 480,
    },
};

const tableScrollSx = {
    overflow: "auto",
    maxHeight: 580,
    ...premiumScrollbarSx,
};

const tableHeadSx = {
    display: "grid",
    gridTemplateColumns:
        "1.1fr 1.1fr 1.25fr .75fr 1.1fr .85fr 250px",
    gap: "12px",
    alignItems: "center",
    minWidth: 1250,
    minHeight: 44,
    px: 2,
    background: "rgba(2,6,23,.34)",
    color: "rgba(255,255,255,.52)",
    fontSize: 10.5,
    fontWeight: 950,
    textTransform: "uppercase",
};

const tableRowSx = {
    display: "grid",
    gridTemplateColumns:
        "1.1fr 1.1fr 1.25fr .75fr 1.1fr .85fr 250px",
    gap: "12px",
    alignItems: "center",
    minWidth: 1250,
    minHeight: 70,
    px: 2,
    borderBottom:
        "1px solid rgba(255,255,255,.06)",

    "&:hover": {
        background: "rgba(59,130,246,.07)",
    },
};

const mainTextSx = {
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
};

const mutedTextSx = {
    mt: 0.4,
    color: "rgba(255,255,255,.48)",
    fontSize: 10.5,
    fontWeight: 650,
};

const overdueTextSx = {
    ...mainTextSx,
    color: "#f87171",
};

const actionRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.7,
};

const rejectBtnSx = {
    height: 38,
    borderRadius: "9px",
    px: 1.5,
    textTransform: "none",
    fontWeight: 850,
    color: "#fca5a5",
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.26)",
};

const paginationSx = {
    color: "#cbd5e1",
    borderTop:
        "1px solid rgba(255,255,255,.07)",
};

const dialogPaperSx = {
    width: "min(560px,calc(100vw - 32px))",
    borderRadius: "18px",
    background:
        "linear-gradient(180deg,#0f172a,#111827)",
    color: "#fff",
    border:
        "1px solid rgba(255,255,255,.08)",
};

const dialogTitleSx = {
    color: "#fff",
    fontWeight: 950,
};

const dialogSummarySx = {
    color: "rgba(255,255,255,.68)",
    fontWeight: 750,
    fontSize: 13,
    lineHeight: 1.7,
};