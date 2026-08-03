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

import LocalShippingOutlinedIcon
    from "@mui/icons-material/LocalShippingOutlined";

import InventoryOutlinedIcon
    from "@mui/icons-material/InventoryOutlined";

import MoveToInboxOutlinedIcon
    from "@mui/icons-material/MoveToInboxOutlined";

import TaskAltOutlinedIcon
    from "@mui/icons-material/TaskAltOutlined";

import {
    useNavigate,
} from "react-router-dom";

import {
    useMatFlow,
} from "../MatFlowContext";

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

const STATUS_OPTIONS = [
    "ALL",
    "PLANNED",
    "READY",
    "PARTIALLY_DISPATCHED",
    "IN_TRANSIT",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED",
];

const clean = (value) =>
    String(value ?? "").trim();

const normalizeStatus = (
    value
) =>
    clean(value)
        .toUpperCase();

const numberValue = (
    value
) => {
    const parsed =
        Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
};

const formatQty = (
    value
) =>
    numberValue(value)
        .toLocaleString(
            "en-IN",
            {
                maximumFractionDigits: 3,
            }
        );

const pendingDispatchQty = (
    transfer
) =>
    Math.max(
        0,
        numberValue(
            transfer?.plannedQty
        ) -
        numberValue(
            transfer?.dispatchedQty
        )
    );

const pendingReceiptQty = (
    transfer
) =>
    Math.max(
        0,
        numberValue(
            transfer?.dispatchedQty
        ) -
        numberValue(
            transfer?.receivedQty
        )
    );

const readable = (
    value
) =>
    clean(value)
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map(
            (part) =>
                part.charAt(0)
                    .toUpperCase() +
                part.slice(1)
        )
        .join(" ");

const statusMeta = (
    value
) => {
    switch (
    normalizeStatus(value)
    ) {
        case "PLANNED":
            return {
                label:
                    "Planned",
                color:
                    "#94a3b8",
            };

        case "READY":
            return {
                label:
                    "Ready to Dispatch",
                color:
                    "#2563eb",
            };

        case "PARTIALLY_DISPATCHED":
            return {
                label:
                    "Partially Dispatched",
                color:
                    "#d97706",
            };

        case "IN_TRANSIT":
            return {
                label:
                    "In Transit",
                color:
                    "#7c3aed",
            };

        case "PARTIALLY_RECEIVED":
            return {
                label:
                    "Partially Received",
                color:
                    "#ea580c",
            };

        case "RECEIVED":
            return {
                label:
                    "Received",
                color:
                    "#16a34a",
            };

        case "CANCELLED":
            return {
                label:
                    "Cancelled",
                color:
                    "#dc2626",
            };

        default:
            return {
                label:
                    readable(value) ||
                    "Unknown",
                color:
                    "#64748b",
            };
    }
};

export default function MatFlowTransferList() {
    const navigate =
        useNavigate();

    const {
        selectedPlantParam,
    } = useMatFlow();

    const [
        rows,
        setRows,
    ] = useState([]);

    const [
        statusFilter,
        setStatusFilter,
    ] = useState("ALL");

    const [
        search,
        setSearch,
    ] = useState("");

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState("");

    const activePlant =
        selectedPlantParam &&
            selectedPlantParam !==
            "ALL"
            ? selectedPlantParam
            : undefined;

    const load = useCallback(
        async () => {
            setLoading(true);
            setError("");

            try {
                const response =
                    await matflowApi
                        .listTransfers({
                            status:
                                statusFilter ===
                                    "ALL"
                                    ? undefined
                                    : statusFilter,

                            plantCode:
                                activePlant,
                        });

                const responseData =
                    response?.data;

                const transferRows =
                    Array.isArray(responseData)
                        ? responseData
                        : Array.isArray(
                            responseData?.content
                        )
                            ? responseData.content
                            : Array.isArray(
                                responseData?.rows
                            )
                                ? responseData.rows
                                : [];

                setRows(
                    transferRows
                );
            } catch (
            requestError
            ) {
                setRows([]);

                setError(
                    readMatFlowError(
                        requestError,
                        "Unable to load material transfers."
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [
            activePlant,
            statusFilter,
        ]
    );

    useEffect(() => {
        load();
    }, [load]);

    const filteredRows =
        useMemo(() => {
            const query =
                clean(search)
                    .toLowerCase();

            if (!query) {
                return rows;
            }

            return rows.filter(
                (row) =>
                    [
                        row.transferNumber,
                        row.materialCode,
                        row.materialName,
                        row.fromLocationCode,
                        row.fromPlantCode,
                        row.toLocationCode,
                        row.toPlantCode,
                        row.purpose,
                        row.requisitionNumber,
                        row.projectCode,
                        row.drawingNo,
                        row.productName,
                        row.clientName,
                        row.bomNumber,
                        row.responsibleDepartment,
                        row.nextAction,
                        row.status,
                    ].some(
                        (value) =>
                            clean(value)
                                .toLowerCase()
                                .includes(
                                    query
                                )
                    )
            );
        }, [
            rows,
            search,
        ]);

    const counters =
        useMemo(() => {
            const countStatus = (
                statuses
            ) =>
                rows.filter(
                    (row) =>
                        statuses.includes(
                            normalizeStatus(
                                row.status
                            )
                        )
                ).length;

            return {
                ready:
                    countStatus([
                        "READY",
                    ]),

                inTransit:
                    countStatus([
                        "PARTIALLY_DISPATCHED",
                        "IN_TRANSIT",
                    ]),

                partialReceipt:
                    countStatus([
                        "PARTIALLY_RECEIVED",
                    ]),

                received:
                    countStatus([
                        "RECEIVED",
                    ]),
            };
        }, [rows]);

    return (
        <Box sx={pageSx}>
            <Box sx={heroSx}>
                <Box sx={heroRowSx}>
                    <Box>
                        <Chip
                            icon={
                                <LocalShippingOutlinedIcon />
                            }
                            label="TRANSFER CONTROL DESK"
                            sx={heroBadgeSx}
                        />

                        <Typography sx={heroTitleSx}>
                            Material Transfers
                        </Typography>

                        <Typography sx={heroSubSx}>
                            Dispatch and receive reserved
                            material across Store, Processing,
                            QC and Production locations while
                            maintaining stock and in-transit
                            control.
                        </Typography>
                    </Box>

                    <Button
                        startIcon={
                            <RefreshOutlinedIcon />
                        }
                        onClick={load}
                        disabled={loading}
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
                    label="Ready to Dispatch"
                    value={counters.ready}
                    color="#2563eb"
                    icon={
                        <InventoryOutlinedIcon />
                    }
                />

                <Kpi
                    label="In Transit"
                    value={counters.inTransit}
                    color="#7c3aed"
                    icon={
                        <LocalShippingOutlinedIcon />
                    }
                />

                <Kpi
                    label="Partial Receipt"
                    value={
                        counters.partialReceipt
                    }
                    color="#ea580c"
                    icon={
                        <MoveToInboxOutlinedIcon />
                    }
                />

                <Kpi
                    label="Received"
                    value={counters.received}
                    color="#16a34a"
                    icon={
                        <TaskAltOutlinedIcon />
                    }
                />
            </Box>

            <Card sx={panelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search Transfers"
                        placeholder="Transfer, material, route or plant..."
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    />

                    <TextField
                        select
                        label="Transfer Status"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(
                                event.target.value
                            )
                        }
                        sx={fieldSx}
                    >
                        {STATUS_OPTIONS.map(
                            (status) => (
                                <MenuItem
                                    key={status}
                                    value={status}
                                >
                                    {status ===
                                        "ALL"
                                        ? "All Transfers"
                                        : readable(
                                            status
                                        )}
                                </MenuItem>
                            )
                        )}
                    </TextField>
                </Box>
            </Card>

            <Card sx={panelSx}>
                <Box sx={resultHeaderSx}>
                    <Box>
                        <Typography sx={sectionTitleSx}>
                            Transfer Register
                        </Typography>

                        <Typography sx={sectionSubSx}>
                            {filteredRows.length}
                            {" transfer record"}
                            {filteredRows.length ===
                                1
                                ? ""
                                : "s"}
                        </Typography>
                    </Box>

                    {activePlant && (
                        <Chip
                            label={`Plant: ${activePlant}`}
                            sx={plantChipSx}
                        />
                    )}
                </Box>

                {loading ? (
                    <Box sx={loadingSx}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={transferHeaderSx}>

                            <Box sx={tableCellSx}>
                                Project / BOM
                            </Box>

                            <Box sx={tableCellSx}>
                                Responsible / Next
                            </Box>

                            <Box sx={tableCellSx}>
                                Transfer
                            </Box>

                            <Box sx={tableCellSx}>
                                Material
                            </Box>

                            <Box sx={tableCellSx}>
                                Route
                            </Box>

                            <Box sx={tableCellSx}>
                                Planned
                            </Box>

                            <Box sx={tableCellSx}>
                                Dispatched
                            </Box>

                            <Box sx={tableCellSx}>
                                Received
                            </Box>

                            <Box sx={tableCellSx}>
                                Pending
                            </Box>

                            <Box sx={tableCellSx}>
                                Status
                            </Box>

                            <Box sx={tableCellSx}>
                                Action
                            </Box>
                        </Box>

                        {filteredRows.length ===
                            0 ? (
                            <Box sx={emptySx}>
                                <Typography sx={emptyTitleSx}>
                                    No material transfers exist
                                </Typography>

                                <Typography sx={emptySubSx}>
                                    Open a submitted requisition in the Store
                                    Planning queue and run material planning.
                                    A transfer is created only when reserved
                                    stock must move from another location.
                                    Shortages create indents, while stock already
                                    at Production creates a direct reservation.
                                </Typography>

                                <Button
                                    onClick={() =>
                                        navigate(
                                            "/matflow/store"
                                        )
                                    }
                                    sx={{
                                        ...primaryBtnSx,
                                        mt: "12px",
                                    }}
                                >
                                    Open Store Planning
                                </Button>
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
                                            sx={transferRowSx}
                                        >
                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {row.transferNumber ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    Route step{" "}
                                                    {row.routeSequenceNo ??
                                                        "-"}
                                                    {" · "}
                                                    {readable(
                                                        row.purpose
                                                    )}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {row.projectCode ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {row.productName ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {row.drawingNo ||
                                                        "-"}
                                                    {" · "}
                                                    {row.bomNumber ||
                                                        "-"}
                                                    {" R"}
                                                    {row.bomRevisionNo ??
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={mainTextSx}>
                                                    {row.materialName ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {row.materialCode ||
                                                        "-"}
                                                    {" · "}
                                                    {row.uom ||
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={routeMainSx}>
                                                    {row.fromLocationCode ||
                                                        "-"}
                                                    {" → "}
                                                    {row.toLocationCode ||
                                                        "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {row.fromPlantCode ||
                                                        "-"}
                                                    {" → "}
                                                    {row.toPlantCode ||
                                                        "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    row.plannedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    row.dispatchedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                {formatQty(
                                                    row.receivedQty
                                                )}
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Typography sx={pendingTextSx}>
                                                    Dispatch{" "}
                                                    {formatQty(
                                                        pendingDispatchQty(
                                                            row
                                                        )
                                                    )}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    Receipt{" "}
                                                    {formatQty(
                                                        pendingReceiptQty(
                                                            row
                                                        )
                                                    )}
                                                </Typography>
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
                                                <Typography sx={ownerTextSx}>
                                                    {readable(
                                                        row.responsibleDepartment
                                                    ) || "-"}
                                                </Typography>

                                                <Typography sx={subTextSx}>
                                                    {readable(
                                                        row.nextAction
                                                    ) || "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={tableCellSx}>
                                                <Button
                                                    startIcon={
                                                        <VisibilityOutlinedIcon />
                                                    }
                                                    onClick={() =>
                                                        navigate(
                                                            `/matflow/transfers/${row.id}`
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
                )}
            </Card>
        </Box>
    );
}

function Kpi({
    label,
    value,
    color,
    icon,
}) {
    return (
        <Card
            sx={{
                ...kpiCardSx,
                borderTop:
                    `3px solid ${color}`,
            }}
        >
            <Box
                sx={{
                    ...kpiIconSx,
                    color,
                    background:
                        `${color}14`,
                    border:
                        `1px solid ${color}30`,
                }}
            >
                {icon}
            </Box>

            <Box>
                <Typography sx={kpiLabelSx}>
                    {label}
                </Typography>

                <Typography sx={kpiValueSx}>
                    {value}
                </Typography>
            </Box>
        </Card>
    );
}

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
        "repeat(4,minmax(0,1fr))",
    gap: "10px",

    "@media (max-width: 900px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },

    "@media (max-width: 520px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const kpiCardSx = {
    ...panelSx,
    minHeight: "86px",
    display: "flex",
    alignItems: "center",
    gap: "11px",
};

const kpiIconSx = {
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    borderRadius: "11px",
};

const kpiLabelSx = {
    color:
        "var(--mf-text-muted)",
    fontSize: "9.5px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const kpiValueSx = {
    mt: "4px",
    color:
        "var(--mf-text)",
    fontSize: "24px",
    fontWeight: 950,
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "minmax(280px,1.5fr) minmax(220px,.6fr)",
    gap: "12px",

    "@media (max-width: 720px)": {
        gridTemplateColumns:
            "1fr",
    },
};

const resultHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    mb: "12px",
};

const sectionTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "17px",
    fontWeight: 950,
};

const sectionSubSx = {
    mt: "3px",
    color:
        "var(--mf-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
};

const plantChipSx = {
    color: "#0284c7",
    background:
        "rgba(2,132,199,.09)",
    border:
        "1px solid rgba(2,132,199,.22)",
    fontWeight: 850,
};

const transferColumns =
    "165px minmax(210px,1.1fr) minmax(220px,1.2fr) minmax(200px,1fr) 85px 95px 95px 115px 145px 175px 100px";

const transferHeaderSx = {
    ...tableHeaderSx,
    gridTemplateColumns:
        transferColumns,
    minWidth: "1580px",
};

const transferRowSx = {
    ...tableRowSx,
    gridTemplateColumns:
        transferColumns,
    minWidth: "1580px",
};

const mainTextSx = {
    color:
        "var(--mf-text)",
    fontSize: "12px",
    fontWeight: 850,
};

const subTextSx = {
    mt: "2px",
    color:
        "var(--mf-text-muted)",
    fontSize: "9.5px",
    fontWeight: 650,
};

const routeMainSx = {
    color: "#7c3aed",
    fontSize: "11px",
    fontWeight: 850,
};

const pendingTextSx = {
    color: "#d97706",
    fontSize: "10px",
    fontWeight: 850,
};

const statusChipSx = (
    color
) => ({
    height: "24px",
    maxWidth: "150px",
    color,
    background:
        `${color}14`,
    border:
        `1px solid ${color}34`,
    fontSize: "8.5px",
    fontWeight: 900,
});

const emptySx = {
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    p: "24px",
};

const emptyTitleSx = {
    color:
        "var(--mf-text)",
    fontSize: "14px",
    fontWeight: 950,
};

const emptySubSx = {
    mt: "6px",
    maxWidth: "560px",
    color:
        "var(--mf-text-muted)",
    fontSize: "10.5px",
    lineHeight: 1.55,
};

const ownerTextSx = {
    color: "#7c3aed",
    fontSize: "10px",
    fontWeight: 900,
};