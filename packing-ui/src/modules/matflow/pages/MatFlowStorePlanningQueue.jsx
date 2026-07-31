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
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import RefreshOutlinedIcon
    from "@mui/icons-material/RefreshOutlined";

import VisibilityOutlinedIcon
    from "@mui/icons-material/VisibilityOutlined";

import StorefrontOutlinedIcon
    from "@mui/icons-material/StorefrontOutlined";

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
    emptySx,
    mainTextSx,
    subTextSx,
    tableShellSx,
} from "../matflowTheme";

const STORE_STATUSES = new Set([
    "SUBMITTED",
    "SHORTAGE_PENDING",
    "PLANNED",
]);

const clean = (value) => {
    return String(value ?? "")
        .trim();
};

const normalizeStatus = (value) => {
    return clean(value)
        .toUpperCase();
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

const formatDateTime = (value) => {
    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }

    return date.toLocaleString(
        "en-IN"
    );
};

const sumLines = (
    requisition,
    field
) => {
    const lines =
        Array.isArray(
            requisition?.lines
        )
            ? requisition.lines
            : [];

    return lines.reduce(
        (
            total,
            line
        ) => {
            const amount =
                Number(
                    line?.[field] ??
                    0
                );

            return total +
                (
                    Number.isFinite(
                        amount
                    )
                        ? amount
                        : 0
                );
        },
        0
    );
};

const statusMeta = (value) => {
    const status =
        normalizeStatus(value);

    switch (status) {
        case "SUBMITTED":
            return {
                label:
                    "Awaiting Planning",
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

        case "PLANNED":
            return {
                label:
                    "Planned",
                color:
                    "#34d399",
            };

        default:
            return {
                label:
                    status || "Unknown",
                color:
                    "#94a3b8",
            };
    }
};

export default function MatFlowStorePlanningQueue() {
    const navigate =
        useNavigate();

    const [rows, setRows] =
        useState([]);

    const [
        statusFilter,
        setStatusFilter,
    ] = useState("ALL");

    const [search, setSearch] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const loadQueue =
        useCallback(
            async () => {
                setLoading(true);
                setError("");

                try {
                    const response =
                        await matflowApi
                            .listRequisitions();

                    const loadedRows =
                        Array.isArray(
                            response?.data
                        )
                            ? response.data
                            : [];

                    setRows(
                        loadedRows.filter(
                            (row) =>
                                STORE_STATUSES.has(
                                    normalizeStatus(
                                        row?.status
                                    )
                                )
                        )
                    );
                } catch (
                requestError
                ) {
                    setError(
                        readMatFlowError(
                            requestError,
                            "Unable to load the Store planning queue."
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            []
        );

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    const filteredRows =
        useMemo(() => {
            const query =
                clean(search)
                    .toLowerCase();

            return rows.filter(
                (row) => {
                    const status =
                        normalizeStatus(
                            row.status
                        );

                    if (
                        statusFilter !==
                        "ALL" &&
                        status !==
                        statusFilter
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
                        row.destinationPlantCode,
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
            rows,
            search,
            statusFilter,
        ]);

    const counters =
        useMemo(() => {
            return {
                submitted:
                    rows.filter(
                        (row) =>
                            normalizeStatus(
                                row.status
                            ) ===
                            "SUBMITTED"
                    ).length,

                shortage:
                    rows.filter(
                        (row) =>
                            normalizeStatus(
                                row.status
                            ) ===
                            "SHORTAGE_PENDING"
                    ).length,

                planned:
                    rows.filter(
                        (row) =>
                            normalizeStatus(
                                row.status
                            ) ===
                            "PLANNED"
                    ).length,
            };
        }, [rows]);

    if (loading) {
        return (
            <Box sx={loadingSx}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={heroRowSx}>
                    <Box>
                        <Chip
                            icon={
                                <StorefrontOutlinedIcon />
                            }
                            label="STORE PLANNING"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Material Planning Queue
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Review submitted Production
                            requisitions, reserve available
                            material and identify shortages.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <RefreshOutlinedIcon />
                        }
                        onClick={loadQueue}
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
                    label="Awaiting Planning"
                    value={counters.submitted}
                    color="#60a5fa"
                />

                <Kpi
                    label="Shortage Pending"
                    value={counters.shortage}
                    color="#f59e0b"
                />

                <Kpi
                    label="Planned"
                    value={counters.planned}
                    color="#34d399"
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        placeholder="Requisition, project, drawing, BOM or destination"
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Planning Status"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        <MenuItem value="ALL">
                            All Store Items
                        </MenuItem>

                        <MenuItem value="SUBMITTED">
                            Awaiting Planning
                        </MenuItem>

                        <MenuItem value="SHORTAGE_PENDING">
                            Shortage Pending
                        </MenuItem>

                        <MenuItem value="PLANNED">
                            Planned
                        </MenuItem>
                    </TextField>
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={tableShellSx}>
                    <Box sx={queueHeaderSx}>
                        <Box sx={tableCellSx}>
                            Requisition
                        </Box>

                        <Box sx={tableCellSx}>
                            Project / Drawing
                        </Box>

                        <Box sx={tableCellSx}>
                            BOM
                        </Box>

                        <Box sx={tableCellSx}>
                            Destination
                        </Box>

                        <Box sx={tableCellSx}>
                            Requested
                        </Box>

                        <Box sx={tableCellSx}>
                            Reserved
                        </Box>

                        <Box sx={tableCellSx}>
                            Shortage
                        </Box>

                        <Box sx={tableCellSx}>
                            Status
                        </Box>

                        <Box sx={tableCellSx}>
                            Updated
                        </Box>

                        <Box sx={tableCellSx}>
                            Action
                        </Box>
                    </Box>

                    {filteredRows.length ===
                        0 ? (
                        <Box sx={emptySx}>
                            No Store planning
                            requisitions match the
                            selected filters.
                        </Box>
                    ) : (
                        filteredRows.map(
                            (row) => {
                                const meta =
                                    statusMeta(
                                        row.status
                                    );

                                return (
                                    <Box
                                        key={row.id}
                                        sx={queueRowSx}
                                    >
                                        <Box sx={tableCellSx}>
                                            <Typography sx={mainTextSx}>
                                                {row.requisitionNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                {row.requestedBy
                                                    ? `By ${row.requestedBy}`
                                                    : ""}
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
                                                {row.bomNumber ||
                                                    "-"}
                                            </Typography>

                                            <Typography sx={subTextSx}>
                                                Revision{" "}
                                                {row.bomRevisionNo ??
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
                                            {formatQty(
                                                sumLines(
                                                    row,
                                                    "requestedQty"
                                                )
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatQty(
                                                sumLines(
                                                    row,
                                                    "reservedQty"
                                                )
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatQty(
                                                sumLines(
                                                    row,
                                                    "shortageQty"
                                                )
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Chip
                                                label={meta.label}
                                                size="small"
                                                sx={statusChipSx(
                                                    meta.color
                                                )}
                                            />
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            {formatDateTime(
                                                row.plannedAt ||
                                                row.submittedAt ||
                                                row.requestedAt
                                            )}
                                        </Box>

                                        <Box sx={tableCellSx}>
                                            <Button
                                                startIcon={
                                                    <VisibilityOutlinedIcon />
                                                }
                                                onClick={() =>
                                                    navigate(
                                                        `/matflow/store/requisitions/${row.id}`
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
                {value}
            </Typography>
        </Card>
    );
}

const queueColumns =
    "minmax(160px,1.1fr) minmax(160px,1fr) minmax(145px,.9fr) minmax(155px,1fr) 95px 95px 95px 145px 150px 105px";

const queueHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        queueColumns,
};

const queueRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        queueColumns,
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
        "repeat(3,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(0,2fr) minmax(220px,1fr)",
    gap: "12px",

    "@media (max-width: 760px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const kpiValueSx = {
    mt: "5px",
    color:
        "var(--mf-text)",
    fontSize: "26px",
    fontWeight: 950,
};

const statusChipSx = (
    color
) => ({
    height: "23px",
    color,
    background:
        `${color}18`,
    border:
        `1px solid ${color}38`,
    fontWeight: 900,
    fontSize: "9px",
});