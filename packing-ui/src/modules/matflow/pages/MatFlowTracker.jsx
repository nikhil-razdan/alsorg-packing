import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import VisibilityOutlinedIcon
    from "@mui/icons-material/VisibilityOutlined";

import TrackChangesOutlinedIcon
    from "@mui/icons-material/TrackChangesOutlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    matflowApi,
    readMatFlowError,
} from "../api/matflowApi";

import {
    errorBoxSx,
    fieldSx,
    heroBadgeSx,
    heroSubSx,
    heroSx,
    heroTitleSx,
    loadingSx,
    pageSx,
    panelSx,
    primaryBtnSx,
    secondaryBtnSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
} from "../matflowTheme";

const clean = (value) => {
    return String(value ?? "")
        .trim();
};

const normalize = (value) => {
    return clean(value)
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
};

const formatQty = (value) => {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 3,
        }
    );
};

const formatAge = (hours) => {
    const numeric =
        Number(hours);

    if (!Number.isFinite(numeric)) {
        return "-";
    }

    if (numeric < 24) {
        return `${Math.max(
            0,
            Math.floor(numeric)
        )} hr`;
    }

    const days =
        Math.floor(
            numeric / 24
        );

    const remainingHours =
        Math.floor(
            numeric % 24
        );

    return remainingHours > 0
        ? `${days}d ${remainingHours}h`
        : `${days}d`;
};

const stageMeta = (value) => {
    const stage =
        normalize(value);

    switch (stage) {
        case "DRAFT":
            return {
                label:
                    "Draft",
                color:
                    "#94a3b8",
            };

        case "AWAITING_STORE_PLANNING":
            return {
                label:
                    "Awaiting Store Planning",
                color:
                    "#60a5fa",
            };

        case "SHORTAGE_PENDING":
            return {
                label:
                    "Shortage Pending",
                color:
                    "#f59e0b",
            };

        case "MATERIAL_RESERVED":
            return {
                label:
                    "Material Reserved",
                color:
                    "#34d399",
            };

        case "TRANSFER_IN_PROGRESS":
            return {
                label:
                    "Transfer in Progress",
                color:
                    "#a78bfa",
            };

        case "PRODUCTION_ISSUE":
            return {
                label:
                    "Production Issue",
                color:
                    "#22d3ee",
            };

        case "CONSUMPTION_COMPLETE":
            return {
                label:
                    "Completed",
                color:
                    "#10b981",
            };

        case "CANCELLED":
            return {
                label:
                    "Cancelled",
                color:
                    "#f87171",
            };

        default:
            return {
                label:
                    clean(value) ||
                    "Unknown",
                color:
                    "#94a3b8",
            };
    }
};

const emptyPayload = {
    kpis: {
        activeRequisitions: 0,
        awaitingStorePlanning: 0,
        shortagePending: 0,
        materialReserved: 0,
        transfersInProgress: 0,
        productionInProgress: 0,
        openIndents: 0,
        totalRequestedQty: 0,
        totalReservedQty: 0,
        totalShortageQty: 0,
    },
    rows: [],
};

export default function MatFlowTracker() {
    const navigate =
        useNavigate();

    const [
        payload,
        setPayload,
    ] = useState(
        emptyPayload
    );

    const [search, setSearch] =
        useState("");

    const [
        plantFilter,
        setPlantFilter,
    ] = useState("ALL");

    const [
        stageFilter,
        setStageFilter,
    ] = useState("ALL");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const loadTracker =
        useCallback(
            async () => {
                setLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .getTracker();

                    const data =
                        response?.data ||
                        {};

                    setPayload({
                        kpis: {
                            ...emptyPayload.kpis,
                            ...(
                                data.kpis ||
                                {}
                            ),
                        },

                        rows:
                            Array.isArray(
                                data.rows
                            )
                                ? data.rows
                                : [],
                    });
                } catch (
                requestError
                ) {
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load the MatFlow tracker."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );

    useEffect(() => {
        loadTracker();
    }, [loadTracker]);

    const plantOptions =
        useMemo(() => {
            return Array.from(
                new Set(
                    payload.rows
                        .map(
                            (row) =>
                                clean(
                                    row.destinationPlantCode
                                )
                        )
                        .filter(Boolean)
                )
            ).sort();
        }, [payload.rows]);

    const stageOptions =
        useMemo(() => {
            return Array.from(
                new Set(
                    payload.rows
                        .map(
                            (row) =>
                                normalize(
                                    row.currentStage
                                )
                        )
                        .filter(Boolean)
                )
            ).sort();
        }, [payload.rows]);

    const visibleRows =
        useMemo(() => {
            const query =
                clean(search)
                    .toLowerCase();

            return payload.rows.filter(
                (row) => {
                    if (
                        plantFilter !==
                        "ALL" &&
                        normalize(
                            row.destinationPlantCode
                        ) !==
                        normalize(
                            plantFilter
                        )
                    ) {
                        return false;
                    }

                    if (
                        stageFilter !==
                        "ALL" &&
                        normalize(
                            row.currentStage
                        ) !==
                        normalize(
                            stageFilter
                        )
                    ) {
                        return false;
                    }

                    if (!query) {
                        return true;
                    }

                    return [
                        row.requisitionNumber,
                        row.projectCode,
                        row.drawingNo,
                        row.bomNumber,
                        row.destinationLocationCode,
                        row.destinationLocationName,
                        row.currentStage,
                        row.responsibleDesk,
                    ].some(
                        (value) =>
                            clean(value)
                                .toLowerCase()
                                .includes(
                                    query
                                )
                    );
                }
            );
        }, [
            payload.rows,
            plantFilter,
            search,
            stageFilter,
        ]);

    const openRow = (row) => {
        const stage =
            normalize(
                row.currentStage
            );

        if (
            stage ===
            "AWAITING_STORE_PLANNING" ||
            stage ===
            "SHORTAGE_PENDING" ||
            stage ===
            "MATERIAL_RESERVED" ||
            stage ===
            "TRANSFER_IN_PROGRESS"
        ) {
            navigate(
                `/matflow/store/requisitions/${row.requisitionId}`
            );

            return;
        }

        navigate(
            `/matflow/requisitions/${row.requisitionId}`
        );
    };

    if (loading) {
        return (
            <Box sx={loadingSx}>
                <CircularProgress />
            </Box>
        );
    }

    const kpis =
        payload.kpis;

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={heroRowSx}>
                    <Box>
                        <Chip
                            icon={
                                <TrackChangesOutlinedIcon />
                            }
                            label="MATFLOW CONTROL TOWER"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Professional Material Tracker
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Track each project from
                            Production demand through
                            planning, reservation,
                            shortage, transfer and
                            Production execution.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <RefreshOutlinedIcon />
                        }
                        onClick={loadTracker}
                        sx={secondaryBtnSx}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {error && (
                <Box sx={errorBoxSx}>
                    {error}
                </Box>
            )}

            <Box sx={kpiGridSx}>
                <Kpi
                    label="Active Requisitions"
                    value={
                        kpis.activeRequisitions
                    }
                    color="#60a5fa"
                />

                <Kpi
                    label="Awaiting Store"
                    value={
                        kpis.awaitingStorePlanning
                    }
                    color="#38bdf8"
                />

                <Kpi
                    label="Shortage Pending"
                    value={
                        kpis.shortagePending
                    }
                    color="#f59e0b"
                />

                <Kpi
                    label="Material Reserved"
                    value={
                        kpis.materialReserved
                    }
                    color="#34d399"
                />

                <Kpi
                    label="Transfers in Progress"
                    value={
                        kpis.transfersInProgress
                    }
                    color="#a78bfa"
                />

                <Kpi
                    label="Open Indents"
                    value={
                        kpis.openIndents
                    }
                    color="#fb7185"
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search Tracker"
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        placeholder="Requisition, project, drawing, BOM or location"
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Plant"
                        value={plantFilter}
                        onChange={(event) =>
                            setPlantFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">
                            All Accessible Plants
                        </MenuItem>

                        {plantOptions.map(
                            (plant) => (
                                <MenuItem
                                    key={plant}
                                    value={plant}
                                >
                                    {plant}
                                </MenuItem>
                            )
                        )}
                    </TextField>

                    <TextField
                        select
                        label="Current Stage"
                        value={stageFilter}
                        onChange={(event) =>
                            setStageFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">
                            All Stages
                        </MenuItem>

                        {stageOptions.map(
                            (stage) => (
                                <MenuItem
                                    key={stage}
                                    value={stage}
                                >
                                    {stageMeta(
                                        stage
                                    ).label}
                                </MenuItem>
                            )
                        )}
                    </TextField>
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={tableShellSx}>
                    <Box sx={trackerHeaderSx}>
                        <Box sx={tableCellSx}>
                            Requisition
                        </Box>

                        <Box sx={tableCellSx}>
                            Project / Drawing
                        </Box>

                        <Box sx={tableCellSx}>
                            Destination
                        </Box>

                        <Box sx={tableCellSx}>
                            Material Position
                        </Box>

                        <Box sx={tableCellSx}>
                            Current Stage
                        </Box>

                        <Box sx={tableCellSx}>
                            Progress
                        </Box>

                        <Box sx={tableCellSx}>
                            Open Activity
                        </Box>

                        <Box sx={tableCellSx}>
                            Responsible
                        </Box>

                        <Box sx={tableCellSx}>
                            Age
                        </Box>

                        <Box sx={tableCellSx}>
                            Action
                        </Box>
                    </Box>

                    {visibleRows.length ===
                        0 ? (
                        <Box sx={emptySx}>
                            No MatFlow tracker rows
                            match the selected filters.
                        </Box>
                    ) : (
                        visibleRows.map(
                            (row) => {
                                const meta =
                                    stageMeta(
                                        row.currentStage
                                    );

                                return (
                                    <Box
                                        key={
                                            row.requisitionId
                                        }
                                        sx={trackerRowSx}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.requisitionNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.bomNumber ||
                                                    "-"}
                                                {" · Rev "}
                                                {row.bomRevisionNo ??
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.projectCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.drawingNo ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.destinationLocationCode ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.destinationPlantCode ||
                                                    "-"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <QtyLine
                                                label="REQ"
                                                value={
                                                    row.requestedQty
                                                }
                                            />

                                            <QtyLine
                                                label="RES"
                                                value={
                                                    row.reservedQty
                                                }
                                            />

                                            <QtyLine
                                                label="SHORT"
                                                value={
                                                    row.shortageQty
                                                }
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Chip
                                                label={
                                                    meta.label
                                                }
                                                size="small"
                                                sx={stageChipSx(
                                                    meta.color
                                                )}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Box sx={progressTopSx}>
                                                <Typography sx={progressTextSx}>
                                                    {row.progressPercent ??
                                                        0}
                                                    %
                                                </Typography>
                                            </Box>

                                            <LinearProgress
                                                variant="determinate"
                                                value={
                                                    Math.min(
                                                        100,
                                                        Math.max(
                                                            0,
                                                            Number(
                                                                row.progressPercent ||
                                                                0
                                                            )
                                                        )
                                                    )
                                                }
                                                sx={progressSx(
                                                    meta.color
                                                )}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.openTransferCount ||
                                                    0}
                                                {" transfer"}
                                                {row.openTransferCount ===
                                                    1
                                                    ? ""
                                                    : "s"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.openIndentCount ||
                                                    0}
                                                {" open indent"}
                                                {row.openIndentCount ===
                                                    1
                                                    ? ""
                                                    : "s"}
                                            </Typography>
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {row.responsibleDesk ||
                                                "-"}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatAge(
                                                row.ageHours
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Button
                                                startIcon={
                                                    <VisibilityOutlinedIcon />
                                                }
                                                onClick={() =>
                                                    openRow(
                                                        row
                                                    )
                                                }
                                                sx={primaryBtnSx}
                                            >
                                                Open
                                            </Button>
                                        </Box>
                                    </Box>
                                );
                            }
                        )
                    )}
                </Box>
            </Card>
        </Box>
    );
}

function Kpi({
    label,
    value,
    color,
}) {
    return (
        <Card
            sx={{
                ...panelSx,
                borderLeft:
                    `3px solid ${color}`,
            }}
        >
            <Typography sx={kpiLabelSx}>
                {label}
            </Typography>

            <Typography sx={kpiValueSx}>
                {value ?? 0}
            </Typography>
        </Card>
    );
}

function QtyLine({
    label,
    value,
}) {
    return (
        <Box sx={qtyLineSx}>
            <Typography sx={qtyLabelSx}>
                {label}
            </Typography>

            <Typography sx={qtyValueSx}>
                {formatQty(
                    value
                )}
            </Typography>
        </Box>
    );
}

const trackerColumns =
    "minmax(175px,1.05fr) minmax(160px,.95fr) minmax(150px,.9fr) 125px minmax(170px,1fr) 145px 135px 125px 80px 105px";

const trackerHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        trackerColumns,
};

const trackerRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        trackerColumns,
};

const heroRowSx = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
};

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(6,minmax(0,1fr))",
    gap: "9px",

    "@media (max-width: 1180px)": {
        gridTemplateColumns:
            "repeat(3,minmax(0,1fr))",
    },

    "@media (max-width: 650px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(260px,2fr) minmax(180px,1fr) minmax(220px,1fr)",
    gap: "11px",

    "@media (max-width: 820px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiLabelSx = {
    color:
        "rgba(255,255,255,.52)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const kpiValueSx = {
    mt: "5px",
    color: "#fff",
    fontSize: "24px",
    fontWeight: 950,
};

const mainTextSx = {
    color: "#fff",
    fontSize: "11.5px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color:
        "rgba(255,255,255,.47)",
    fontSize: "9.5px",
};

const stageChipSx = (
    color
) => ({
    height: "24px",
    color,
    background:
        `${color}17`,
    border:
        `1px solid ${color}38`,
    fontSize: "8.5px",
    fontWeight: 900,
});

const progressTopSx = {
    display: "flex",
    justifyContent: "flex-end",
};

const progressTextSx = {
    color:
        "rgba(255,255,255,.65)",
    fontSize: "9px",
    fontWeight: 800,
};

const progressSx = (
    color
) => ({
    mt: "4px",
    height: "6px",
    borderRadius: 999,
    background:
        "rgba(255,255,255,.08)",

    "& .MuiLinearProgress-bar": {
        borderRadius: 999,
        backgroundColor:
            color,
    },
});

const qtyLineSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
};

const qtyLabelSx = {
    color:
        "rgba(255,255,255,.40)",
    fontSize: "8.5px",
    fontWeight: 900,
};

const qtyValueSx = {
    color: "#fff",
    fontSize: "10px",
    fontWeight: 850,
};

const emptySx = {
    p: "28px",
    textAlign: "center",
    color:
        "rgba(255,255,255,.52)",
    fontSize: "12px",
};