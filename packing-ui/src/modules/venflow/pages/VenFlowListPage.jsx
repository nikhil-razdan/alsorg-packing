import React, {
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
    Divider,
    LinearProgress,
    MenuItem,
    TablePagination,
    TextField,
    Typography,
} from "@mui/material";

import {
    getStageLabel,
    getStageProgress,
} from "../venflowWorkflow";

import { useNavigate } from "react-router-dom";

import API from "../../../services/api";
import { venflowApi } from "../api/venflowApi";

import VenFlowStageChip from "../components/VenFlowStageChip";
import VenFlowStatusChip from "../components/VenFlowStatusChip";
import VenFlowTracker from "../components/VenFlowTracker";

import {
    darkMenuProps,
    fieldSx,
    loadingBoxSx,
    outlineBtnSx,
    primaryBtnSx,
    tableCellSx,
    tableHeadCellSx,
    premiumScrollbarSx,
} from "../venflowTheme";

import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import PauseCircleOutlineOutlinedIcon from "@mui/icons-material/PauseCircleOutlineOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import TrackChangesOutlinedIcon from "@mui/icons-material/TrackChangesOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";

const STAGE_OPTIONS = [
    ["", "All"],
    ["INDENT_CREATED", "Engineering BOM / Indent"],
    ["SENT_TO_STORE", "Sent to Store"],
    ["STORE_REVIEWED", "Store Reviewed"],
    ["STOCK_AVAILABLE", "Stock Available"],
    [
        "PURCHASE_REQUEST_RAISED",
        "Purchase Request Raised",
    ],
    [
        "PO_PENDING_DIRECTOR_APPROVAL",
        "Director Approval Pending",
    ],
    [
        "PO_APPROVED_BY_DIRECTOR",
        "Director Approved",
    ],
    [
        "PO_REJECTED_BY_DIRECTOR",
        "Returned by Director",
    ],
    [
        "ORDER_PLACED_WITH_VENDOR",
        "Order Placed with Vendor",
    ],
    [
        "MATERIAL_RECEIVED_AT_STORE",
        "Material Received",
    ],
    ["GRN_DONE", "GRN Done"],
    ["QC_PENDING", "QC Pending"],
    ["QC_OK", "QC Accepted"],
    [
        "MATERIAL_REJECTED_HOLD_RETURN",
        "QC Hold / Return",
    ],
    [
        "MATERIAL_ISSUED_TO_PRODUCTION",
        "Issued to Production",
    ],
    [
        "PROCESSING_STARTED",
        "Processing Started",
    ],
    [
        "PROCESS_COMPLETED",
        "Process Completed",
    ],
    [
        "SUPERVISOR_INFORMED",
        "Supervisor Informed",
    ],
    [
        "READY_FOR_NEXT_STAGE",
        "Ready for Next Stage",
    ],
];

const normalizePlantCode = (value) => {
    if (!value) return "";

    if (typeof value === "string") {
        return value.trim().toUpperCase();
    }

    return String(
        value.plantCode ||
        value.code ||
        value.name ||
        value.plant ||
        value.value ||
        ""
    )
        .trim()
        .toUpperCase();
};

const uniquePlants = (items = []) => {
    return Array.from(
        new Set(
            items
                .map(normalizePlantCode)
                .filter(Boolean)
        )
    );
};

const extractPlantOptionsFromResponse = (data) => {
    if (Array.isArray(data)) return uniquePlants(data);
    if (Array.isArray(data?.content)) return uniquePlants(data.content);
    if (Array.isArray(data?.data)) return uniquePlants(data.data);
    if (Array.isArray(data?.plants)) return uniquePlants(data.plants);

    return [];
};

const readCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
        return {};
    }
};

const readLocalPlantCodes = () => {
    try {
        return JSON.parse(localStorage.getItem("plantCodes") || "[]");
    } catch {
        return [];
    }
};

const isCompletedStage = (stage) =>
    [
        "READY_FOR_NEXT_STAGE",
        "SUPERVISOR_INFORMED",
        "PROCESS_COMPLETED",
    ].includes(stage);

const isHoldStage = (row) =>
    row?.storeStatus === "HOLD" ||
    row?.poStatus === "DIRECTOR_REJECTED" ||
    row?.qcStatus === "HOLD" ||
    row?.qcStatus === "NOT_OK" ||
    row?.stage ===
    "MATERIAL_REJECTED_HOLD_RETURN";

const formatDateTime = (value) => {
    if (!value) return "-";

    return String(value)
        .replace("T", " ")
        .slice(0, 16);
};

const safeNumber = (value) => {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const calculateBalance = (row) => {
    if (row?.balanceQty !== null && row?.balanceQty !== undefined) {
        return row.balanceQty;
    }

    const required = safeNumber(row?.requiredQty);
    const received = safeNumber(row?.receivedQty);
    const issued = safeNumber(row?.issuedQty);

    if (received > 0 || issued > 0) {
        return Math.max(required - issued, 0);
    }

    return required;
};

const getPriority = (row) => {
    const stage = row?.stage;

    if (isCompletedStage(stage)) return "Low";

    if (row?.expectedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expected = new Date(row.expectedDate);
        expected.setHours(0, 0, 0, 0);

        if (expected < today) return "High";
    }

    if (
        [
            "PO_RAISED",
            "PROCESSING_STARTED",
            "MATERIAL_ISSUED_TO_PRODUCTION",
        ].includes(stage)
    ) {
        return "High";
    }

    if (
        [
            "SENT_TO_STORE",
            "STORE_REVIEWED",
            "PURCHASE_REQUEST_RAISED",
            "PRODUCTION_INFORMED",
        ].includes(stage)
    ) {
        return "Medium";
    }

    return "Low";
};

const getStatusText = (row) =>
    getStageLabel(row?.stage);

const getProgressPercent = (stage) =>
    getStageProgress(stage);

export default function VenFlowListPage() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [dashboard, setDashboard] = useState({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        search: "",
        plantCode: "",
        stage: "",
        storeStatus: "",
        poStatus: "",
        productionStatus: "",
    });

    const [plantOptions, setPlantOptions] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [auditRows, setAuditRows] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);

    const selectedRow = useMemo(() => {
        if (
            selectedEntry?.id === selectedId
        ) {
            return selectedEntry;
        }

        return (
            rows.find(
                (row) =>
                    row.id === selectedId
            ) ||
            rows[0] ||
            null
        );
    }, [
        rows,
        selectedEntry,
        selectedId,
    ]);

    const loadDashboard = async () => {
        try {
            const res = await venflowApi.getDashboard();
            setDashboard(res.data || {});
        } catch {
            setDashboard({});
        }
    };

    const loadPlants = async () => {
        const currentUser = readCurrentUser();

        const role = String(
            currentUser.role ||
            localStorage.getItem("role") ||
            ""
        ).toUpperCase();

        const assignedPlants =
            Array.isArray(currentUser.plantCodes) &&
                currentUser.plantCodes.length > 0
                ? currentUser.plantCodes
                : readLocalPlantCodes();

        if (
            role === "ADMIN" ||
            (role === "VENFLOW_MANAGER" && assignedPlants.length === 0)
        ) {
            try {
                const res = await API.get("/plants");
                setPlantOptions(extractPlantOptionsFromResponse(res.data));
            } catch {
                setPlantOptions([]);
            }

            return;
        }

        setPlantOptions(uniquePlants(assignedPlants));
    };

    const load = async (
        targetPage = page,
        activeFilters = filters
    ) => {
        try {
            setLoading(true);

            const res =
                await venflowApi.getEntries({
                    page: targetPage,
                    size,

                    search:
                        activeFilters.search ||
                        undefined,

                    plantCode:
                        activeFilters.plantCode ||
                        undefined,

                    stage:
                        activeFilters.stage ||
                        undefined,

                    storeStatus:
                        activeFilters.storeStatus ||
                        undefined,

                    poStatus:
                        activeFilters.poStatus ||
                        undefined,

                    productionStatus:
                        activeFilters.productionStatus ||
                        undefined,
                });

            const data = res.data || {};
            const nextRows = data.content || [];

            setRows(nextRows);
            setTotal(data.totalElements || 0);

            if (
                nextRows.length > 0 &&
                (!selectedId ||
                    !nextRows.some((row) => row.id === selectedId))
            ) {
                setSelectedId(nextRows[0].id);
            }

            if (nextRows.length === 0) {
                setSelectedId("");
                setSelectedEntry(null);
                setAuditRows([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadSelectedEntry = async (id) => {
        if (!id) return;

        try {
            setDetailLoading(true);

            const [entryRes, auditRes] = await Promise.allSettled([
                venflowApi.getEntry(id),
                venflowApi.getAudit(id),
            ]);

            if (entryRes.status === "fulfilled") {
                setSelectedEntry(entryRes.value.data || null);
            }

            if (auditRes.status === "fulfilled") {
                setAuditRows(
                    Array.isArray(auditRes.value.data)
                        ? auditRes.value.data
                        : []
                );
            } else {
                setAuditRows([]);
            }
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        loadPlants();
        loadDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, size]);

    useEffect(() => {
        if (selectedId) {
            loadSelectedEntry(selectedId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const applyFilters = () => {
        setPage(0);
        load(0);
    };

    const clearFilters = () => {
        const cleared = {
            search: "",
            plantCode: "",
            stage: "",
            storeStatus: "",
            poStatus: "",
            productionStatus: "",
        };

        setFilters(cleared);
        setPage(0);
        setSelectedId("");
        setSelectedEntry(null);
        setAuditRows([]);

        load(0, cleared);
    };

    const updateFilter = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const kpis = [
        {
            title: "Total Requests",
            value: dashboard.totalEntries ?? total,
            trend: "Live tracker",
            icon: <LayersOutlinedIcon />,
            accent: "#3b82f6",
        },
        {
            title: "In Progress",
            value:
                safeNumber(dashboard.totalPendingWorkLoading) ||
                rows.filter((row) => !isCompletedStage(row.stage)).length,
            trend: "Open workflow",
            icon: <HourglassTopOutlinedIcon />,
            accent: "#60a5fa",
        },
        {
            title: "On Hold",
            value: rows.filter(isHoldStage).length,
            trend: "Needs attention",
            icon: <PauseCircleOutlineOutlinedIcon />,
            accent: "#f59e0b",
        },
        {
            title: "Completed",
            value: dashboard.jobDone ?? 0,
            trend: "Closed work",
            icon: <CheckCircleOutlineOutlinedIcon />,
            accent: "#22c55e",
        },
        {
            title: "Avg. Cycle Time",
            value:
                dashboard.averageCycleDays ??
                "—",
            valueSuffix:
                dashboard.averageCycleDays != null
                    ? "days"
                    : "",
            trend: "Operational average",
            icon: <AccessTimeOutlinedIcon />,
            accent: "#38bdf8",
        },
        {
            title: "OTD Performance",
            value:
                dashboard.onTimeDeliveryPercent != null
                    ? `${dashboard.onTimeDeliveryPercent}%`
                    : "—",
            trend: "On-time delivery",
            icon: <TrackChangesOutlinedIcon />,
            accent: "#8b5cf6",
        },
    ];

    return (
        <Box sx={pageSx}>
            <Box sx={kpiGridSx}>
                {kpis.map((item) => (
                    <KpiCard key={item.title} item={item} />
                ))}
            </Box>

            <Card sx={filterPanelSx}>
                <Box sx={filterGridSx}>
                    <TextField
                        label="Search by Request / Item / PO / Supplier..."
                        size="small"
                        value={filters.search}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        sx={fieldSx}
                        InputProps={{
                            startAdornment: (
                                <SearchIcon
                                    sx={{
                                        color: "#94a3b8",
                                        fontSize: 18,
                                        mr: 1,
                                    }}
                                />
                            ),
                        }}
                    />

                    <TextField
                        label="Plant"
                        size="small"
                        select
                        value={filters.plantCode}
                        onChange={(e) => updateFilter("plantCode", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        {plantOptions.map((plant) => (
                            <MenuItem key={plant} value={plant}>
                                {plant}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Stage"
                        size="small"
                        select
                        value={filters.stage}
                        onChange={(e) => updateFilter("stage", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        {STAGE_OPTIONS.map(([value, label]) => (
                            <MenuItem key={label} value={value}>
                                {label}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Store Status"
                        size="small"
                        select
                        value={filters.storeStatus}
                        onChange={(e) => updateFilter("storeStatus", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="AVAILABLE_IN_STORE">Available</MenuItem>
                        <MenuItem value="NOT_AVAILABLE">Not Available</MenuItem>
                        <MenuItem value="PARTIALLY_AVAILABLE">Partial</MenuItem>
                        <MenuItem value="PENDING">Pending</MenuItem>
                        <MenuItem value="HOLD">Hold</MenuItem>
                    </TextField>

                    <TextField
                        label="PO Status"
                        size="small"
                        select
                        value={filters.poStatus}
                        onChange={(e) => updateFilter("poStatus", e.target.value)}
                        sx={fieldSx}
                        SelectProps={{ MenuProps: darkMenuProps }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="NOT_RAISED">Not Raised</MenuItem>
                        <MenuItem value="PENDING_DIRECTOR_APPROVAL">
                            Pending Director Approval
                        </MenuItem>

                        <MenuItem value="DIRECTOR_APPROVED">
                            Director Approved
                        </MenuItem>

                        <MenuItem value="DIRECTOR_REJECTED">
                            Returned by Director
                        </MenuItem>

                        <MenuItem value="ORDER_PLACED">
                            Order Placed
                        </MenuItem>
                    </TextField>

                    <Box sx={filterButtonRowSx}>
                        <Button
                            onClick={applyFilters}
                            sx={outlineBtnSx}
                        >
                            Filters
                        </Button>

                        <Button
                            onClick={clearFilters}
                            sx={clearBtnSx}
                        >
                            Clear
                        </Button>
                    </Box>
                </Box>
            </Card>

            <Box sx={mainGridSx}>
                <Card sx={masterPanelSx}>
                    <Box sx={masterHeaderSx}>
                        <Typography sx={masterTitleSx}>
                            {total} results
                        </Typography>

                        <Button
                            startIcon={<ViewColumnOutlinedIcon />}
                            sx={columnsBtnSx}
                        >
                            Columns
                        </Button>
                    </Box>

                    <Box sx={listScrollSx}>
                        <Box sx={listHeadSx}>
                            <Box />
                            <Typography sx={tableHeadCellSx}>Request ID</Typography>
                            <Typography sx={tableHeadCellSx}>Item / Description</Typography>
                            <Typography sx={tableHeadCellSx}>Status</Typography>
                            <Typography sx={tableHeadCellSx}>Priority</Typography>
                            <Typography sx={tableHeadCellSx}>Updated</Typography>
                            <Box />
                        </Box>

                        {loading ? (
                            <Box sx={listLoadingSx}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <Box sx={listBodySx}>
                                {rows.map((row) => {
                                    const selected = row.id === selectedId;
                                    const priority = getPriority(row);

                                    return (
                                        <Box
                                            key={row.id}
                                            sx={listRowSx(selected)}
                                            onClick={() => {
                                                setSelectedId(row.id);
                                                setSelectedEntry(null);
                                                setAuditRows([]);
                                            }}
                                        >
                                            <Box sx={checkboxSx(selected)}>
                                                {selected ? "✓" : ""}
                                            </Box>

                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={reqIdSx}>
                                                    {row.pdNo || "-"}
                                                </Typography>

                                                <Typography sx={smallMutedSx}>
                                                    {row.bomReference || row.plantCode || "-"}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={itemTitleSx}>
                                                    {row.materialName ||
                                                        row.productDescription ||
                                                        row.veneerType ||
                                                        "Veneer Requirement"}
                                                </Typography>

                                                <Typography sx={smallMutedSx}>
                                                    Qty: {row.requiredQty ?? "-"} {row.unit || ""}
                                                </Typography>
                                            </Box>

                                            <Chip
                                                label={getStatusText(row)}
                                                size="small"
                                                sx={statusChipSx(row.stage)}
                                            />

                                            <Chip
                                                label={priority}
                                                size="small"
                                                sx={priorityChipSx(priority)}
                                            />

                                            <Typography sx={tableCellSx}>
                                                {formatDateTime(row.updatedAt || row.raisedAt)}
                                            </Typography>

                                            <ArrowForwardIosRoundedIcon
                                                sx={{
                                                    color: selected
                                                        ? "#60a5fa"
                                                        : "rgba(255,255,255,.34)",
                                                    fontSize: 15,
                                                }}
                                            />
                                        </Box>
                                    );
                                })}

                                {rows.length === 0 && (
                                    <Box sx={emptySx}>
                                        No VenFlow entries found.
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>

                    <Box sx={paginationWrapSx}>
                        <Typography sx={showingTextSx}>
                            Showing {rows.length === 0 ? 0 : page * size + 1} to{" "}
                            {page * size + rows.length} of {total} results
                        </Typography>

                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            rowsPerPage={size}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            onRowsPerPageChange={(e) => {
                                setSize(Number(e.target.value));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                            labelRowsPerPage="Rows"
                            SelectProps={{
                                MenuProps: darkMenuProps,
                            }}
                            sx={paginationSx}
                        />
                    </Box>
                </Card>

                <Card sx={detailPanelSx}>
                    {!selectedRow ? (
                        <Box sx={emptyDetailSx}>
                            Select a row to view tracker details.
                        </Box>
                    ) : detailLoading ? (
                        <Box sx={loadingBoxSx}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <DetailPanel
                            entry={selectedRow}
                            auditRows={auditRows}
                            onOpen={() =>
                                navigate(`/venflow/entries/${selectedRow.id}`)
                            }
                        />
                    )}
                </Card>
            </Box>
        </Box>
    );
}

function KpiCard({ item }) {
    return (
        <Card sx={kpiCardSx}>
            <Box sx={kpiIconSx(item.accent)}>
                {item.icon}
            </Box>

            <Box sx={{ minWidth: 0 }}>
                <Typography sx={kpiTitleSx}>
                    {item.title}
                </Typography>

                <Box sx={kpiValueRowSx}>
                    <Typography sx={kpiValueSx}>
                        {item.value ?? 0}
                    </Typography>

                    {item.valueSuffix && (
                        <Typography sx={kpiSuffixSx}>
                            {item.valueSuffix}
                        </Typography>
                    )}
                </Box>

                <Typography sx={kpiTrendSx(item.accent)}>
                    ▲ {item.trend}
                </Typography>
            </Box>

            <MiniSpark accent={item.accent} />
        </Card>
    );
}

function MiniSpark({ accent }) {
    return (
        <Box sx={sparkBoxSx}>
            <svg width="100%" height="34" viewBox="0 0 120 34">
                <polyline
                    fill="none"
                    stroke={accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,25 10,18 20,23 30,12 40,16 50,9 60,21 70,14 80,19 90,8 100,13 110,6 120,11"
                />
            </svg>
        </Box>
    );
}

function DetailPanel({
    entry,
    auditRows,
    onOpen,
}) {
    const priority = getPriority(entry);
    const progress = getProgressPercent(entry.stage);

    return (
        <Box sx={detailContentSx}>
            <Box sx={detailHeaderSx}>
                <Box sx={detailDocIconSx}>
                    <DescriptionOutlinedIcon />
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={detailTitleRowSx}>
                        <Typography sx={detailTitleSx}>
                            {entry.pdNo || "Requirement"}
                        </Typography>

                        <Chip
                            label={priority}
                            size="small"
                            sx={priorityChipSx(priority)}
                        />
                    </Box>

                    <Typography sx={detailSubSx}>
                        {entry.materialName ||
                            entry.productDescription ||
                            entry.veneerType ||
                            "Veneer Requirement"}
                    </Typography>

                    <Typography sx={detailMetaSx}>
                        Qty: {entry.requiredQty ?? "-"} {entry.unit || ""} &nbsp; | &nbsp;
                        Plant: {entry.plantCode || "-"}
                    </Typography>
                </Box>

                <Box sx={detailHeaderRightSx}>
                    <InfoBlock label="Requested By" value={entry.raisedBy || "-"} />
                    <InfoBlock label="Requested On" value={formatDateTime(entry.raisedAt)} />

                    <Button
                        endIcon={<MoreVertIcon />}
                        onClick={onOpen}
                        sx={primaryBtnSx}
                    >
                        Actions
                    </Button>
                </Box>
            </Box>

            <Box sx={trackerPanelSx}>
                <VenFlowTracker
                    stage={entry.stage}
                    entry={entry}
                />
            </Box>

            <Box sx={detailGridSx}>
                <Card sx={innerCardSx}>
                    <Typography sx={innerTitleSx}>
                        Stage Progress
                    </Typography>

                    <Box sx={donutWrapSx}>
                        <Box sx={donutSx(progress)}>
                            <Box sx={donutInnerSx}>
                                <Typography sx={donutValueSx}>
                                    {progress}%
                                </Typography>
                                <Typography sx={donutLabelSx}>
                                    Completed
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={legendSx}>
                            <LegendRow color="#22c55e" label="Completed" value={Math.round(progress / 20)} />
                            <LegendRow color="#3b82f6" label="In Progress" value={progress < 100 ? 1 : 0} />
                            <LegendRow color="#64748b" label="Pending" value={Math.max(5 - Math.round(progress / 20), 0)} />
                            <Divider sx={{ borderColor: "rgba(255,255,255,.08)", my: 1 }} />
                            <LegendRow color="#94a3b8" label="Total Stages" value={5} />
                        </Box>
                    </Box>
                </Card>

                <Card sx={innerCardSx}>
                    <Typography sx={innerTitleSx}>
                        Request Details
                    </Typography>

                    <DetailRow label="Client" value={entry.clientName} />
                    <DetailRow label="Material" value={entry.materialName} />
                    <DetailRow label="Veneer Type" value={entry.veneerType} />
                    <DetailRow label="Drawing No." value={entry.drawingNo} />
                    <DetailRow label="Store Status" value={<VenFlowStatusChip status={entry.storeStatus} />} />
                    <DetailRow label="PO Number" value={entry.poNo} />
                    <DetailRow label="Balance Qty" value={calculateBalance(entry)} />
                </Card>

                <Card sx={innerCardSx}>
                    <Typography sx={innerTitleSx}>
                        Mini Insights
                    </Typography>

                    <Box sx={insightBoxSx}>
                        <Typography sx={insightLabelSx}>
                            Cycle Time
                        </Typography>

                        <Typography sx={insightValueSx}>
                            4.2 days
                        </Typography>

                        <MiniSpark accent="#3b82f6" />
                    </Box>

                    <Box sx={insightBoxSx}>
                        <Typography sx={insightLabelSx}>
                            On-Time Delivery
                        </Typography>

                        <Typography sx={insightValueSx}>
                            95%
                        </Typography>

                        <MiniSpark accent="#22c55e" />
                    </Box>
                </Card>
            </Box>

            <Box sx={tabsRowSx}>
                <Box sx={tabActiveSx}>Timeline</Box>
                <Box sx={tabSx}>Comments</Box>
                <Box sx={tabSx}>Attachments</Box>
                <Box sx={tabSx}>History</Box>
            </Box>

            <Box sx={bottomGridSx}>
                <Card sx={timelineCardSx}>
                    {auditRows.length === 0 ? (
                        <Typography sx={emptyTimelineSx}>
                            No audit activity found yet.
                        </Typography>
                    ) : (
                        auditRows.slice(0, 4).map((item, index) => (
                            <Box key={index} sx={timelineItemSx}>
                                <Box sx={timelineDotSx} />

                                <Box>
                                    <Typography sx={timelineDateSx}>
                                        {formatDateTime(item.changedAt)}
                                    </Typography>

                                    <Typography sx={timelineTitleSx}>
                                        {item.action || item.stage || "Activity"}
                                    </Typography>

                                    <Typography sx={timelineMsgSx}>
                                        {item.newValue ||
                                            item.oldValue ||
                                            "Workflow updated"}
                                        {" · "}
                                        {item.changedBy || "-"}
                                    </Typography>
                                </Box>
                            </Box>
                        ))
                    )}
                </Card>

                <Card sx={commentsCardSx}>
                    <Box sx={commentHeaderSx}>
                        <Typography sx={innerTitleSx}>
                            Remarks
                        </Typography>

                        <Button
                            onClick={onOpen}
                            sx={smallLinkBtnSx}
                        >
                            View full
                        </Button>
                    </Box>

                    <Typography sx={remarkTextSx}>
                        {entry.remarks || "No remarks added yet."}
                    </Typography>

                    <Button
                        startIcon={<SendOutlinedIcon />}
                        fullWidth
                        onClick={onOpen}
                        sx={{ ...primaryBtnSx, mt: 2 }}
                    >
                        Open Full Details
                    </Button>
                </Card>
            </Box>
        </Box>
    );
}

function InfoBlock({
    label,
    value,
}) {
    return (
        <Box>
            <Typography sx={infoBlockLabelSx}>
                {label}
            </Typography>

            <Typography sx={infoBlockValueSx}>
                {value || "-"}
            </Typography>
        </Box>
    );
}

function DetailRow({
    label,
    value,
}) {
    return (
        <Box sx={detailRowSx}>
            <Typography sx={detailRowLabelSx}>
                {label}
            </Typography>

            <Box sx={detailRowValueSx}>
                {value || "-"}
            </Box>
        </Box>
    );
}

function LegendRow({
    color,
    label,
    value,
}) {
    return (
        <Box sx={legendRowSx}>
            <Box sx={legendNameSx}>
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: color,
                        display: "inline-block",
                    }}
                />
                {label}
            </Box>

            <Typography sx={legendValueSx}>
                {value}
            </Typography>
        </Box>
    );
}

/* ===================== STYLES ===================== */

const pageSx = {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
};

const kpiGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2, minmax(0,1fr))",
        lg: "repeat(3, minmax(0,1fr))",
        xl: "repeat(6, minmax(0,1fr))",
    },
    gap: "10px",
};

const kpiCardSx = {
    position: "relative",
    minHeight: 104,
    p: "13px",
    borderRadius: "14px",
    background:
        "linear-gradient(180deg, rgba(30,41,59,.78), rgba(15,23,42,.78))",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 16px 34px rgba(2,6,23,.32)",
    color: "#fff",
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
};

const kpiIconSx = (accent) => ({
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: `${accent}22`,
    color: accent,
    border: `1px solid ${accent}44`,
    flexShrink: 0,
});

const kpiTitleSx = {
    color: "rgba(255,255,255,.70)",
    fontSize: 11,
    fontWeight: 900,
};

const kpiValueRowSx = {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    mt: "5px",
};

const kpiValueSx = {
    color: "#fff",
    fontSize: 26,
    fontWeight: 950,
    lineHeight: 1,
};

const kpiSuffixSx = {
    color: "rgba(255,255,255,.70)",
    fontSize: 12,
    fontWeight: 800,
};

const kpiTrendSx = (accent) => ({
    mt: "5px",
    color: accent,
    fontSize: 10.5,
    fontWeight: 800,
});

const sparkBoxSx = {
    position: "absolute",
    right: 12,
    bottom: 8,
    width: 88,
    opacity: 0.86,
};

const filterPanelSx = {
    p: "12px",
    borderRadius: "14px",
    background: "rgba(15,23,42,.70)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 16px 34px rgba(2,6,23,.28)",
};

const filterGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        md: "2fr 1fr 1fr 1fr 1fr auto",
    },
    gap: "10px",
    alignItems: "center",
};

const filterButtonRowSx = {
    display: "flex",
    gap: "8px",
    alignItems: "center",
};

const clearBtnSx = {
    borderRadius: "12px",
    textTransform: "none",
    fontWeight: 850,
    color: "#94a3b8",
    "&:hover": {
        background: "rgba(255,255,255,.05)",
    },
};

const mainGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        xl: "minmax(500px,.9fr) minmax(640px,1.25fr)",
    },
    gap: "10px",
    alignItems: "stretch",
};

const masterPanelSx = {
    borderRadius: "14px",
    background: "rgba(15,23,42,.72)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 18px 42px rgba(2,6,23,.34)",
    overflow: "hidden",
    color: "#fff",
    minHeight: 620,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
};

const masterHeaderSx = {
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    px: 2,
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const masterTitleSx = {
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
};

const columnsBtnSx = {
    height: 32,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 850,
    color: "#cbd5e1",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.08)",
};

const listScrollSx = {
    width: "100%",
    minWidth: 0,
    overflowX: "auto",
    overflowY: "hidden",
    background: "rgba(2,6,23,.10)",
    ...premiumScrollbarSx,

    "&::-webkit-scrollbar": {
        height: 9,
    },

    "&::-webkit-scrollbar-track": {
        background:
            "linear-gradient(90deg, rgba(15,23,42,.82), rgba(30,41,59,.74), rgba(15,23,42,.82))",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.07)",
    },

    "&::-webkit-scrollbar-thumb": {
        borderRadius: 999,
        background:
            "linear-gradient(90deg, rgba(56,189,248,.95), rgba(59,130,246,.96), rgba(37,99,235,.96))",
        border: "2px solid rgba(15,23,42,.96)",
        boxShadow:
            "0 0 14px rgba(59,130,246,.34), inset 0 1px 0 rgba(255,255,255,.22)",
    },
};

const listHeadSx = {
    display: "grid",
    gridTemplateColumns: "36px 1.1fr 1.4fr .9fr .7fr .9fr 28px",
    gap: "10px",
    alignItems: "center",
    width: "max(100%, 780px)",
    height: 42,
    px: 1.6,
    borderBottom: "1px solid rgba(255,255,255,.07)",
    background: "rgba(2,6,23,.34)",
};

const listLoadingSx = {
    width: "max(100%, 780px)",
    minHeight: 482,
    display: "grid",
    placeItems: "center",
    color: "#60a5fa",

    "& .MuiCircularProgress-root": {
        color: "#60a5fa",
    },
};

const listBodySx = {
    width: "max(100%, 780px)",
    maxHeight: 482,
    overflowY: "auto",
    overflowX: "hidden",
    ...premiumScrollbarSx,
};

const listRowSx = (selected) => ({
    display: "grid",
    gridTemplateColumns: "36px 1.1fr 1.4fr .9fr .7fr .9fr 28px",
    gap: "10px",
    alignItems: "center",
    width: "100%",
    minHeight: 62,
    px: 1.6,
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: selected
        ? "linear-gradient(90deg, rgba(37,99,235,.30), rgba(59,130,246,.08))"
        : "rgba(255,255,255,.015)",
    borderLeft: selected
        ? "3px solid #3b82f6"
        : "3px solid transparent",
    boxSizing: "border-box",

    "&:hover": {
        background: selected
            ? "linear-gradient(90deg, rgba(37,99,235,.32), rgba(59,130,246,.10))"
            : "rgba(59,130,246,.08)",
    },
});

const checkboxSx = (selected) => ({
    width: 17,
    height: 17,
    borderRadius: "4px",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontSize: 11,
    fontWeight: 950,
    border: selected
        ? "1px solid #3b82f6"
        : "1px solid rgba(255,255,255,.20)",
    background: selected
        ? "linear-gradient(135deg,#2563eb,#3b82f6)"
        : "transparent",
});

const reqIdSx = {
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const smallMutedSx = {
    color: "rgba(255,255,255,.48)",
    fontSize: 10.5,
    fontWeight: 650,
    mt: 0.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const itemTitleSx = {
    color: "#fff",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const statusChipSx = (stage) => {
    const text = getStatusText({ stage });

    if (text.includes("Completed") || text.includes("Ready")) {
        return chipBase("#22c55e");
    }

    if (text.includes("PO")) {
        return chipBase("#3b82f6");
    }

    if (text.includes("Store")) {
        return chipBase("#38bdf8");
    }

    if (text.includes("Production") || text.includes("Processing")) {
        return chipBase("#22c55e");
    }

    if (text.includes("Purchase")) {
        return chipBase("#f59e0b");
    }

    return chipBase("#64748b");
};

const priorityChipSx = (priority) => {
    if (priority === "High") return chipBase("#ef4444");
    if (priority === "Medium") return chipBase("#f59e0b");

    return chipBase("#22c55e");
};

const chipBase = (color) => ({
    height: 22,
    borderRadius: 999,
    background: `${color}22`,
    color,
    border: `1px solid ${color}33`,
    fontWeight: 900,
    fontSize: 10,
});

const emptySx = {
    color: "#94a3b8",
    fontWeight: 750,
    textAlign: "center",
    py: 5,
};

const paginationWrapSx = {
    minHeight: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    px: 2,
    borderTop: "1px solid rgba(255,255,255,.07)",
    background: "rgba(2,6,23,.22)",
    overflow: "hidden",
    minWidth: 0,
    flexShrink: 0,
};

const showingTextSx = {
    color: "rgba(255,255,255,.58)",
    fontSize: 12,
    fontWeight: 750,
    whiteSpace: "nowrap",
    flexShrink: 0,
};

const paginationSx = {
    color: "#cbd5e1",
    flexShrink: 0,
    overflow: "hidden",
    minWidth: 0,

    "& .MuiTablePagination-toolbar": {
        minHeight: 54,
        p: 0,
        pl: 0,
        pr: 0,
        gap: "8px",
        overflow: "hidden",
    },

    "& .MuiTablePagination-spacer": {
        display: "none",
    },

    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
        color: "#94a3b8",
        fontWeight: 800,
        fontSize: 12,
        m: 0,
        whiteSpace: "nowrap",
    },

    "& .MuiTablePagination-select": {
        color: "#fff",
        fontWeight: 850,
        background: "rgba(59,130,246,.10)",
        border: "1px solid rgba(59,130,246,.22)",
        borderRadius: "10px",
        px: 1.2,
        py: 0.4,
    },

    "& .MuiTablePagination-selectIcon": {
        color: "#93c5fd",
    },

    "& .MuiTablePagination-actions": {
        ml: 0,
        display: "flex",
        alignItems: "center",
        gap: "4px",
    },

    "& .MuiTablePagination-actions button": {
        width: 32,
        height: 32,
        borderRadius: "10px",
        color: "#cbd5e1",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.07)",
        transition: "all .2s ease",

        "&:hover": {
            background: "rgba(59,130,246,.16)",
            borderColor: "rgba(59,130,246,.32)",
            color: "#fff",
        },

        "&.Mui-disabled": {
            color: "rgba(255,255,255,.24)",
            background: "rgba(255,255,255,.025)",
            borderColor: "rgba(255,255,255,.04)",
        },
    },

    "& .MuiSvgIcon-root": {
        color: "inherit",
    },
};

const detailPanelSx = {
    borderRadius: "14px",
    background: "rgba(15,23,42,.72)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "0 18px 42px rgba(2,6,23,.34)",
    overflow: "hidden",
    color: "#fff",
    minHeight: 620,
};

const emptyDetailSx = {
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    fontWeight: 800,
};

const detailContentSx = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
};

const detailHeaderSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    p: 2,
    background: "linear-gradient(180deg, rgba(30,41,59,.72), rgba(15,23,42,.72))",
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const detailDocIconSx = {
    width: 56,
    height: 56,
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    color: "#bfdbfe",
    background: "rgba(59,130,246,.18)",
    border: "1px solid rgba(59,130,246,.32)",
    flexShrink: 0,
};

const detailTitleRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexWrap: "wrap",
};

const detailTitleSx = {
    color: "#fff",
    fontSize: 23,
    fontWeight: 950,
    lineHeight: 1,
};

const detailSubSx = {
    mt: 0.6,
    color: "#fff",
    fontSize: 13,
    fontWeight: 850,
};

const detailMetaSx = {
    mt: 0.5,
    color: "rgba(255,255,255,.56)",
    fontSize: 11,
    fontWeight: 700,
};

const detailHeaderRightSx = {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexWrap: "wrap",
    justifyContent: "flex-end",
};

const infoBlockLabelSx = {
    color: "rgba(255,255,255,.52)",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const infoBlockValueSx = {
    mt: 0.5,
    color: "#fff",
    fontSize: 12,
    fontWeight: 850,
};

const trackerPanelSx = {
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const detailGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        lg: "1fr 1fr .9fr",
    },
    gap: "10px",
    p: "10px",
};

const innerCardSx = {
    p: "14px",
    borderRadius: "12px",
    background: "rgba(2,6,23,.24)",
    border: "1px solid rgba(255,255,255,.07)",
    boxShadow: "none",
    color: "#fff",
};

const innerTitleSx = {
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
    mb: 1.2,
};

const donutWrapSx = {
    display: "flex",
    alignItems: "center",
    gap: 2,
};

const donutSx = (percent) => ({
    width: 118,
    height: 118,
    borderRadius: "50%",
    background: `conic-gradient(#22c55e ${percent}%, rgba(148,163,184,.22) ${percent}% 100%)`,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
});

const donutInnerSx = {
    width: 78,
    height: 78,
    borderRadius: "50%",
    background: "rgba(15,23,42,.94)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
};

const donutValueSx = {
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
    lineHeight: 1,
};

const donutLabelSx = {
    color: "rgba(255,255,255,.62)",
    fontSize: 10,
    fontWeight: 800,
};

const legendSx = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 0.8,
};

const legendRowSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 1,
};

const legendNameSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.8,
    color: "rgba(255,255,255,.72)",
    fontSize: 11,
    fontWeight: 750,
};

const legendValueSx = {
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
};

const detailRowSx = {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 1,
    alignItems: "center",
    py: 0.45,
};

const detailRowLabelSx = {
    color: "rgba(255,255,255,.52)",
    fontSize: 11,
    fontWeight: 800,
};

const detailRowValueSx = {
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    minWidth: 0,
};

const insightBoxSx = {
    p: 1.2,
    borderRadius: "10px",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.06)",
    mb: 1,
    position: "relative",
    overflow: "hidden",
    minHeight: 74,
};

const insightLabelSx = {
    color: "rgba(255,255,255,.58)",
    fontSize: 11,
    fontWeight: 850,
};

const insightValueSx = {
    mt: 0.6,
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
};

const tabsRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 2.5,
    px: 2,
    borderTop: "1px solid rgba(255,255,255,.07)",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    height: 44,
};

const tabActiveSx = {
    height: 44,
    display: "flex",
    alignItems: "center",
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 950,
    borderBottom: "2px solid #3b82f6",
};

const tabSx = {
    height: 44,
    display: "flex",
    alignItems: "center",
    color: "rgba(255,255,255,.62)",
    fontSize: 12,
    fontWeight: 800,
};

const bottomGridSx = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        lg: "1.2fr .9fr",
    },
    gap: "10px",
    p: "10px",
};

const timelineCardSx = {
    p: "14px",
    borderRadius: "12px",
    background: "rgba(2,6,23,.24)",
    border: "1px solid rgba(255,255,255,.07)",
    color: "#fff",
};

const commentsCardSx = {
    ...timelineCardSx,
};

const emptyTimelineSx = {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 750,
};

const timelineItemSx = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: 1.2,
    pb: 1.3,
};

const timelineDotSx = {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#3b82f6",
    mt: 0.5,
    boxShadow: "0 0 0 4px rgba(59,130,246,.14)",
};

const timelineDateSx = {
    color: "rgba(255,255,255,.55)",
    fontSize: 11,
    fontWeight: 800,
};

const timelineTitleSx = {
    mt: 0.4,
    color: "#fff",
    fontSize: 12,
    fontWeight: 900,
};

const timelineMsgSx = {
    mt: 0.3,
    color: "rgba(255,255,255,.58)",
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.45,
};

const commentHeaderSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
};

const smallLinkBtnSx = {
    textTransform: "none",
    color: "#60a5fa",
    fontWeight: 900,
    fontSize: 12,
};

const remarkTextSx = {
    color: "rgba(255,255,255,.66)",
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.6,
    minHeight: 58,
};

const statusPreviewSx = {
    display: "flex",
    gap: 1,
    alignItems: "center",
};