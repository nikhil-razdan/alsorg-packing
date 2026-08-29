import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    Button,
    Chip,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddRoadOutlinedIcon from "@mui/icons-material/AddRoadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";

import DispatchChallans from "./DispatchChallans";
import ShiftOperations from "./ShiftOperations";
import ShiftHistory from "./ShiftHistory";
import LogisticsPagination from "./LogisticsPagination";
import useLogisticsLiveRefresh from "./useLogisticsLiveRefresh";

import {
    getCachedDispatchChallanWindow,
    getCachedDispatchChallans,
    getCachedShifts,
    mergeChallanRows,
    scheduleLogisticsIdleWork,
} from "./logisticsReadCache";

import {
    OPERATION_SOURCE,
    buildUnifiedOperations,
    formatOperationDateTime,
    formatOperationDuration,
    isActiveOperation,
    isCompletedOperation,
} from "./logisticsUnifiedUtils";

const VIEW = Object.freeze({
    OVERVIEW: "overview",
    CHALLANS: "challans",
    MANUAL: "manual",
    HISTORY: "history",
});

function LogisticsOperationsHub({
    showAlert = () => { },
    liveRefreshToken = null,
    cacheScope = "",
}) {
    const [view, setView] =
        useState(VIEW.OVERVIEW);

    const [challans, setChallans] =
        useState([]);

    const [shifts, setShifts] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [sourceFilter, setSourceFilter] =
        useState("ALL");

    const [statusFilter, setStatusFilter] =
        useState("ACTIVE");

    const [pageNo, setPageNo] =
        useState(1);

    const [pageSize, setPageSize] =
        useState(25);

    const [
        manualCreateToken,
        setManualCreateToken,
    ] = useState(0);

    const loadOverview =
        useCallback(async ({
            background = false,
        } = {}) => {
            try {
                if (!background) {
                    setLoading(true);
                }

                const [
                    challanResult,
                    shiftResult,
                ] = await Promise.allSettled([
                    getCachedDispatchChallanWindow(cacheScope, {
                        pages: 2,
                        size: 100,
                        force: !background,
                    }),
                    getCachedShifts(cacheScope, {
                        force: !background,
                    }),
                ]);

                if (
                    challanResult.status ===
                    "fulfilled"
                ) {
                    setChallans((current) => {
                        const freshRows = Array.isArray(
                            challanResult.value?.rows
                        )
                            ? challanResult.value.rows
                            : [];

                        return background
                            ? mergeChallanRows(freshRows, current)
                            : freshRows;
                    });
                } else if (!background) {
                    setChallans([]);

                    showAlert(
                        challanResult.reason
                            ?.message ||
                        "Dispatch challans could not be loaded",
                        "warning"
                    );
                }

                if (
                    shiftResult.status ===
                    "fulfilled"
                ) {
                    setShifts(
                        Array.isArray(
                            shiftResult.value
                        )
                            ? shiftResult.value
                            : []
                    );
                } else if (!background) {
                    setShifts([]);

                    showAlert(
                        shiftResult.reason
                            ?.message ||
                        "Manual operations could not be loaded",
                        "warning"
                    );
                }

                if (
                    challanResult.status ===
                    "rejected" &&
                    shiftResult.status ===
                    "rejected" &&
                    !background
                ) {
                    throw new Error(
                        "Unable to load logistics operations"
                    );
                }
            } catch (error) {
                if (!background) {
                    showAlert(
                        error?.message ||
                        "Unable to load logistics operations",
                        "error"
                    );
                }
            } finally {
                if (!background) {
                    setLoading(false);
                }
            }
        }, [showAlert]);

    useLogisticsLiveRefresh(
        liveRefreshToken,
        async () => {
            if (view !== VIEW.OVERVIEW) {
                return;
            }

            await loadOverview({
                background: true,
            });
        },
        {
            enabled:
                view === VIEW.OVERVIEW,
        }
    );

    useEffect(() => {
        if (view !== VIEW.OVERVIEW) {
            return undefined;
        }

        void loadOverview();

        const cancelHydration = scheduleLogisticsIdleWork(() => {
            void getCachedDispatchChallans(cacheScope)
                .then((fullRows) => {
                    if (Array.isArray(fullRows)) {
                        setChallans(fullRows);
                    }
                })
                .catch(() => {
                    /* Recent operational window stays usable if history hydration fails. */
                });
        }, 1400);

        return cancelHydration;
    }, [view, loadOverview, cacheScope]);

    const operations =
        useMemo(
            () =>
                buildUnifiedOperations(
                    challans,
                    shifts
                ),
            [challans, shifts]
        );

    const summary =
        useMemo(() => {
            return operations.reduce(
                (result, operation) => {
                    if (
                        operation.source ===
                        OPERATION_SOURCE
                            .DISPATCH_CHALLAN
                    ) {
                        result.totalChallans += 1;

                        result.dispatchedItems +=
                            Number(
                                operation.itemCount || 0
                            );

                        if (
                            isActiveOperation(
                                operation
                            )
                        ) {
                            result.runningChallans +=
                                1;
                        } else if (
                            isCompletedOperation(
                                operation
                            )
                        ) {
                            result.completedChallans +=
                                1;
                        }
                    } else {
                        result.manualRecords += 1;

                        if (
                            operation.status ===
                            "WORKING"
                        ) {
                            result.activeManual += 1;
                        }
                    }

                    return result;
                },
                {
                    totalChallans: 0,
                    runningChallans: 0,
                    completedChallans: 0,
                    dispatchedItems: 0,
                    manualRecords: 0,
                    activeManual: 0,
                }
            );
        }, [operations]);

    const filteredOperations =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase();

            return operations.filter(
                (operation) => {
                    if (
                        sourceFilter ===
                        "CHALLAN" &&
                        operation.source !==
                        OPERATION_SOURCE
                            .DISPATCH_CHALLAN
                    ) {
                        return false;
                    }

                    if (
                        sourceFilter ===
                        "MANUAL" &&
                        operation.source !==
                        OPERATION_SOURCE
                            .MANUAL_SHIFT
                    ) {
                        return false;
                    }

                    if (
                        statusFilter ===
                        "ACTIVE" &&
                        !isActiveOperation(
                            operation
                        )
                    ) {
                        return false;
                    }

                    if (
                        statusFilter ===
                        "COMPLETED" &&
                        !isCompletedOperation(
                            operation
                        )
                    ) {
                        return false;
                    }

                    if (
                        statusFilter ===
                        "AVAILABILITY" &&
                        ![
                            "OFF",
                            "ON_LEAVE",
                        ].includes(
                            operation.status
                        )
                    ) {
                        return false;
                    }

                    if (
                        query &&
                        !operation.searchableText.includes(
                            query
                        ) &&
                        !String(
                            operation.title || ""
                        )
                            .toLowerCase()
                            .includes(query)
                    ) {
                        return false;
                    }

                    return true;
                }
            );
        }, [
            operations,
            search,
            sourceFilter,
            statusFilter,
        ]);

    useEffect(() => {
        setPageNo(1);
    }, [
        search,
        sourceFilter,
        statusFilter,
        pageSize,
    ]);

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredOperations.length /
                pageSize
            )
        );

    const currentPage =
        Math.min(
            pageNo,
            totalPages
        );

    const paginatedRows =
        filteredOperations.slice(
            (currentPage - 1) *
            pageSize,
            currentPage * pageSize
        );

    const openManualCreate = () => {
        setManualCreateToken(
            Date.now()
        );

        setView(VIEW.MANUAL);
    };

    return (
        <Box sx={hubWrap}>
            <Box sx={workspaceToolbar}>
                <Box sx={workspaceTopRow}>
                    <Box sx={workspaceIdentity}>
                        <Box sx={workspaceIcon}>
                            🚚
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                            <Box sx={workspaceEyebrow}>
                                OPERATIONS WORKSPACE
                            </Box>

                            <Box sx={workspaceDescription}>
                                Dispatch challans and non-challan vehicle movements
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={workspaceActions}>
                        {view === VIEW.OVERVIEW && (
                            <Button
                                startIcon={<RefreshIcon />}
                                onClick={loadOverview}
                                disabled={loading}
                                sx={secondaryButton}
                            >
                                {loading
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </Button>
                        )}

                        <Button
                            startIcon={<AddRoadOutlinedIcon />}
                            onClick={openManualCreate}
                            sx={primaryButton}
                        >
                            Add Manual Operation
                        </Button>
                    </Box>
                </Box>

                <Box sx={workspaceBottomRow}>
                    <Box sx={innerTabs}>
                        <InnerTab
                            active={
                                view === VIEW.OVERVIEW
                            }
                            icon="◉"
                            label="Overview"
                            onClick={() =>
                                setView(VIEW.OVERVIEW)
                            }
                        />

                        <InnerTab
                            active={
                                view === VIEW.CHALLANS
                            }
                            icon="📄"
                            label="Dispatch Challans"
                            onClick={() =>
                                setView(VIEW.CHALLANS)
                            }
                        />

                        <InnerTab
                            active={
                                view === VIEW.MANUAL
                            }
                            icon="🛣️"
                            label="Manual / Legacy"
                            onClick={() =>
                                setView(VIEW.MANUAL)
                            }
                        />

                        <InnerTab
                            active={
                                view === VIEW.HISTORY
                            }
                            icon="🕘"
                            label="Manual History"
                            onClick={() =>
                                setView(VIEW.HISTORY)
                            }
                        />
                    </Box>

                    <Box sx={compactFlowNotice}>
                        <Box sx={compactNoticeIcon}>
                            <DescriptionOutlinedIcon
                                sx={{
                                    fontSize: 17,
                                }}
                            />
                        </Box>

                        <Box sx={compactNoticeText}>
                            Item-based trips are created from the Dispatch page.
                            Manual Operation is only for movements without dispatched packet items.
                        </Box>
                    </Box>
                </Box>
            </Box>

            {view === VIEW.OVERVIEW && (
                <>
                    <Box sx={summaryGrid}>
                        <SummaryCard
                            icon={
                                <LocalShippingOutlinedIcon />
                            }
                            label="Running Challan Trips"
                            value={
                                summary.runningChallans
                            }
                            detail="Current item dispatches"
                        />

                        <SummaryCard
                            icon={
                                <AddRoadOutlinedIcon />
                            }
                            label="Active Manual Operations"
                            value={
                                summary.activeManual
                            }
                            detail="Non-challan movements"
                        />

                        <SummaryCard
                            icon={
                                <DescriptionOutlinedIcon />
                            }
                            label="Dispatched Items"
                            value={
                                summary.dispatchedItems
                            }
                            detail="Across all challans"
                        />

                        <SummaryCard
                            icon={<HistoryOutlinedIcon />}
                            label="Manual / Legacy Records"
                            value={
                                summary.manualRecords
                            }
                            detail="Existing shift records preserved"
                        />
                    </Box>

                    <Box sx={filters}>
                        <Box sx={searchBox}>
                            <SearchIcon
                                sx={{
                                    color:
                                        "rgba(var(--pf-fg-rgb),.42)",
                                }}
                            />

                            <TextField
                                variant="standard"
                                placeholder="Search challan, driver, vehicle, item, route or status..."
                                value={search}
                                onChange={(event) =>
                                    setSearch(
                                        event.target.value
                                    )
                                }
                                InputProps={{
                                    disableUnderline: true,
                                }}
                                sx={searchField}
                            />
                        </Box>

                        <Select
                            value={sourceFilter}
                            onChange={(event) =>
                                setSourceFilter(
                                    event.target.value
                                )
                            }
                            size="small"
                            sx={filterSelect}
                        >
                            <MenuItem value="ALL">
                                All Sources
                            </MenuItem>

                            <MenuItem value="CHALLAN">
                                Dispatch Challans
                            </MenuItem>

                            <MenuItem value="MANUAL">
                                Manual / Legacy
                            </MenuItem>
                        </Select>

                        <Select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value
                                )
                            }
                            size="small"
                            sx={filterSelect}
                        >
                            <MenuItem value="ACTIVE">
                                Active Operations
                            </MenuItem>

                            <MenuItem value="COMPLETED">
                                Completed / Cancelled
                            </MenuItem>

                            <MenuItem value="AVAILABILITY">
                                Off / On Leave
                            </MenuItem>

                            <MenuItem value="ALL">
                                All Statuses
                            </MenuItem>
                        </Select>
                    </Box>

                    {loading && (
                        <Box sx={emptyState}>
                            Loading combined operations...
                        </Box>
                    )}

                    {!loading &&
                        paginatedRows.length ===
                        0 && (
                            <Box sx={emptyState}>
                                No logistics operations
                                matched the selected
                                filters.
                            </Box>
                        )}

                    {!loading &&
                        paginatedRows.map(
                            (operation) => (
                                <OperationCard
                                    key={operation.key}
                                    operation={operation}
                                    onManage={() => {
                                        if (
                                            operation.source ===
                                            OPERATION_SOURCE
                                                .DISPATCH_CHALLAN
                                        ) {
                                            setView(
                                                VIEW.CHALLANS
                                            );
                                        } else {
                                            setView(
                                                VIEW.MANUAL
                                            );
                                        }
                                    }}
                                />
                            )
                        )}

                    {!loading &&
                        filteredOperations.length >
                        0 && (
                            <LogisticsPagination
                                pageNo={currentPage}
                                setPageNo={setPageNo}
                                pageSize={pageSize}
                                setPageSize={
                                    setPageSize
                                }
                                totalItems={
                                    filteredOperations.length
                                }
                            />
                        )}
                </>
            )}

            {view === VIEW.CHALLANS && (
                <DispatchChallans
                    showAlert={showAlert}
                    liveRefreshToken={liveRefreshToken}
                    cacheScope={cacheScope}
                />
            )}

            {view === VIEW.MANUAL && (
                <ShiftOperations
                    showAlert={showAlert}
                    openCreateToken={
                        manualCreateToken
                    }
                    liveRefreshToken={liveRefreshToken}
                    cacheScope={cacheScope}
                />
            )}

            {view === VIEW.HISTORY && (
                <ShiftHistory
                    showAlert={showAlert}
                    liveRefreshToken={liveRefreshToken}
                    cacheScope={cacheScope}
                />
            )}
        </Box>
    );
}

function InnerTab({
    active,
    icon,
    label,
    onClick,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                ...innerTabButton,

                background: active
                    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                    : "transparent",

                borderColor: active
                    ? "rgba(96,165,250,.52)"
                    : "transparent",

                color: active
                    ? "#fff"
                    : "var(--pf-text-muted)",

                boxShadow: active
                    ? "0 8px 22px rgba(37,99,235,.24)"
                    : "none",
            }}
        >
            <span
                style={{
                    ...innerTabIcon,
                    background: active
                        ? "rgba(var(--pf-fg-rgb),.14)"
                        : "rgba(var(--pf-fg-rgb),.045)",

                    color: active
                        ? "#fff"
                        : "var(--pf-text-muted)",
                }}
            >
                {icon}
            </span>

            <span>
                {label}
            </span>
        </button>
    );
}

function SummaryCard({
    icon,
    label,
    value,
    detail,
}) {
    return (
        <Box sx={summaryCard}>
            <Box sx={summaryIcon}>
                {icon}
            </Box>

            <Box sx={{ minWidth: 0 }}>
                <Box sx={summaryValue}>
                    {value}
                </Box>

                <Box sx={summaryLabel}>
                    {label}
                </Box>

                <Box sx={summaryDetail}>
                    {detail}
                </Box>
            </Box>
        </Box>
    );
}

function OperationCard({
    operation,
    onManage,
}) {
    const isChallan =
        operation.source ===
        OPERATION_SOURCE.DISPATCH_CHALLAN;

    return (
        <Box sx={operationCard}>
            <Box sx={operationMain}>
                <Box sx={operationIdentity}>
                    <Box sx={operationTitleRow}>
                        <Box sx={operationTitle}>
                            {operation.title}
                        </Box>

                        <Chip
                            size="small"
                            label={
                                operation.sourceLabel
                            }
                            sx={
                                isChallan
                                    ? challanSourceChip
                                    : manualSourceChip
                            }
                        />

                        <Chip
                            size="small"
                            label={operation.status}
                            sx={statusChip(
                                operation.status
                            )}
                        />
                    </Box>

                    <Box sx={operationMeta}>
                        <b>Driver:</b>{" "}
                        {operation.driverName}
                        {"  •  "}
                        <b>Vehicle:</b>{" "}
                        {operation.vehicleNumber}
                        {"  •  "}
                        <b>Route:</b>{" "}
                        {operation.routeCategory}
                    </Box>

                    <Box sx={operationMeta}>
                        <b>Start:</b>{" "}
                        {formatOperationDateTime(
                            operation.startAt
                        )}
                        {"  •  "}
                        <b>End:</b>{" "}
                        {formatOperationDateTime(
                            operation.endAt
                        )}
                        {"  •  "}
                        <b>Duration:</b>{" "}
                        {formatOperationDuration(
                            operation.durationMinutes
                        )}
                    </Box>
                </Box>

                <Box sx={operationRight}>
                    {isChallan ? (
                        <>
                            <Box sx={metricPill}>
                                {
                                    operation.itemCount
                                }{" "}
                                Items
                            </Box>

                            <Button
                                onClick={onManage}
                                sx={manageButton}
                            >
                                Open Challan
                            </Button>
                        </>
                    ) : (
                        <>
                            <Box sx={metricPill}>
                                {
                                    operation.tripCount
                                }{" "}
                                Trips
                            </Box>

                            <Button
                                onClick={onManage}
                                sx={manageButton}
                            >
                                Manage Manual Record
                            </Button>
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

const hubWrap = {
    borderRadius: "18px",
    minWidth: 0,
    color: "var(--pf-text-strong)",
};

const primaryButton = {
    height: 38,
    px: 1.7,

    borderRadius: "11px",

    textTransform: "none",

    color: "#fff",

    fontSize: 12,
    fontWeight: 900,

    whiteSpace: "nowrap",

    background:
        "linear-gradient(135deg,#2563eb,#3b82f6)",

    boxShadow:
        "0 9px 20px rgba(37,99,235,.24)",

    "&:hover": {
        background:
            "linear-gradient(135deg,#1d4ed8,#2563eb)",

        boxShadow:
            "0 11px 25px rgba(37,99,235,.30)",
    },
};

const secondaryButton = {
    height: 38,
    px: 1.5,

    borderRadius: "11px",

    textTransform: "none",

    color: "var(--pf-text)",

    fontSize: 12,
    fontWeight: 850,

    background:
        "rgba(var(--pf-fg-rgb),.045)",

    border:
        "1px solid rgba(var(--pf-fg-rgb),.08)",

    "&:hover": {
        color: "var(--pf-text-strong)",
        background: "var(--pf-hover)",
        borderColor: "rgba(59,130,246,.22)",
    },
};

const workspaceToolbar = {
    mb: 2,
    borderRadius: "16px",
    overflow: "hidden",
    background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
    border: "1px solid var(--pf-border)",
    boxShadow: "0 8px 22px rgba(var(--pf-shadow-rgb),.07)",
};

const workspaceTopRow = {
    minHeight: 66,
    px: 1.8,
    py: 1.3,

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    gap: 2,
    flexWrap: "wrap",

    borderBottom:
        "1px solid rgba(var(--pf-fg-rgb),.055)",
};

const workspaceIdentity = {
    display: "flex",
    alignItems: "center",
    gap: 1.2,
    minWidth: 0,
};

const workspaceIcon = {
    width: 38,
    height: 38,

    display: "grid",
    placeItems: "center",

    flexShrink: 0,

    borderRadius: "12px",

    color: "#2563eb",

    background:
        "linear-gradient(135deg,rgba(37,99,235,.18),rgba(59,130,246,.10))",

    border:
        "1px solid rgba(96,165,250,.18)",

    fontSize: 17,
};

const workspaceEyebrow = {
    color: "#60a5fa",

    fontSize: 10,
    fontWeight: 950,

    letterSpacing: ".12em",
    textTransform: "uppercase",
};

const workspaceDescription = {
    mt: 0.35,

    color: "var(--pf-text)",

    fontSize: 13,
    fontWeight: 750,

    whiteSpace: {
        xs: "normal",
        md: "nowrap",
    },
};

const workspaceActions = {
    display: "flex",
    alignItems: "center",

    gap: 1,
    flexWrap: "wrap",
};

const workspaceBottomRow = {
    px: 1.2,
    py: 1,

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    gap: 1.5,
    flexWrap: "wrap",
};

const innerTabs = {
    display: "flex",
    alignItems: "center",

    gap: 0.4,

    p: 0.4,

    overflowX: "auto",

    borderRadius: "13px",

    background: "var(--pf-surface)",
    border: "1px solid var(--pf-border-soft)",

    scrollbarWidth: "thin",
};

const innerTabButton = {
    minHeight: 38,

    padding: "0 13px",

    borderRadius: 10,
    border: "1px solid",

    cursor: "pointer",

    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 850,

    whiteSpace: "nowrap",

    display: "flex",
    alignItems: "center",
    gap: 7,

    transition:
        "background .2s ease,color .2s ease,border-color .2s ease,box-shadow .2s ease",
};

const innerTabIcon = {
    width: 23,
    height: 23,

    borderRadius: 7,

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    fontSize: 11,

    transition:
        "background .2s ease,color .2s ease",
};

const compactFlowNotice = {
    minHeight: 38,

    flex: "1 1 370px",
    maxWidth: 650,

    px: 1.2,
    py: 0.8,

    display: "flex",
    alignItems: "center",

    gap: 0.9,

    borderRadius: "12px",

    background:
        "rgba(59,130,246,.055)",

    border:
        "1px solid rgba(59,130,246,.11)",
};

const compactNoticeIcon = {
    width: 27,
    height: 27,

    flexShrink: 0,

    display: "grid",
    placeItems: "center",

    borderRadius: "8px",

    color: "#60a5fa",

    background:
        "rgba(59,130,246,.10)",
};

const compactNoticeText = {
    color: "var(--pf-text-muted)",

    fontSize: 10.5,
    fontWeight: 650,

    lineHeight: 1.45,
};

const summaryGrid = {
    display: "grid",

    gridTemplateColumns: {
        xs: "1fr",
        sm: "repeat(2,minmax(0,1fr))",
        xl: "repeat(4,minmax(0,1fr))",
    },

    gap: 1.25,
    mb: 1.6,
};

const summaryCard = {
    minHeight: 92,
    p: 1.7,
    display: "flex",
    alignItems: "center",
    gap: 1.4,
    borderRadius: "14px",
    background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
    border: "1px solid var(--pf-border-soft)",
    boxShadow: "0 6px 16px rgba(var(--pf-shadow-rgb),.05)",
};

const summaryIcon = {
    width: 44,
    height: 44,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    color: "#60a5fa",
    borderRadius: "14px",
    background:
        "rgba(59,130,246,.13)",
};

const summaryValue = {
    color: "var(--pf-text-strong)",
    fontSize: 25,
    fontWeight: 950,
};

const summaryLabel = {
    color: "var(--pf-text)",
    fontSize: 12,
    fontWeight: 850,
};

const summaryDetail = {
    color: "var(--pf-text-dim)",
    mt: 0.3,
    fontSize: 10.5,
    fontWeight: 700,
};

const filters = {
    display: "grid",
    gridTemplateColumns: {
        xs: "1fr",
        md: "minmax(260px,1fr) 190px 200px",
    },
    gap: 1,
    mb: 2,
    p: 1.2,
    borderRadius: "16px",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
};

const searchBox = {
    minHeight: 42,
    px: 1.4,
    display: "flex",
    alignItems: "center",
    gap: 1,
    borderRadius: "12px",
    background: "var(--pf-input)",
    border: "1px solid var(--pf-border)",
};

const searchField = {
    flex: 1,

    "& .MuiInputBase-root": {
        color: "var(--pf-text-strong)",
        fontSize: 13,
        fontWeight: 700,
    },

    "& input::placeholder": {
        color:
            "rgba(var(--pf-fg-rgb),.35)",
        opacity: 1,
    },
};

const filterSelect = {
    height: 42,
    color: "var(--pf-text-strong)",
    borderRadius: "10px",
    background: "var(--pf-input)",

    ".MuiOutlinedInput-notchedOutline": {
        borderColor: "var(--pf-border)",
    },
    ".MuiSvgIcon-root": {
        color: "var(--pf-text-muted)",
    },
};

const operationCard = {
    mb: 1.05,
    p: 1.7,
    borderRadius: "14px",
    background: "var(--pf-surface)",
    border: "1px solid var(--pf-border-soft)",
    boxShadow: "0 4px 14px rgba(var(--pf-shadow-rgb),.04)",

    "&:hover": {
        borderColor:
            "rgba(96,165,250,.22)",
        transform:
            "translateY(-1px)",
    },

    transition:
        "transform .18s ease,border-color .18s ease",
};

const operationMain = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    flexWrap: "wrap",
};

const operationIdentity = {
    minWidth: 0,
    flex: 1,
};

const operationTitleRow = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexWrap: "wrap",
};

const operationTitle = {
    color: "var(--pf-text-strong)",
    fontSize: 16,
    fontWeight: 950,
    fontFamily: "monospace",
};

const operationMeta = {
    mt: 0.7,
    color: "var(--pf-text-muted)",
    fontSize: 11.5,
    fontWeight: 650,
};

const operationRight = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 1,
    flexWrap: "wrap",
};

const metricPill = {
    px: 1.2,
    height: 32,
    display: "flex",
    alignItems: "center",
    borderRadius: "999px",
    color: "#059669",
    fontSize: 11,
    fontWeight: 900,
    background:
        "rgba(16,185,129,.12)",
    border:
        "1px solid rgba(16,185,129,.20)",
};

const manageButton = {
    height: 34,
    px: 1.5,
    borderRadius: "9px",
    textTransform: "none",
    color: "#2563eb",
    fontWeight: 850,
    background: "rgba(59,130,246,.09)",
    border:
        "1px solid rgba(59,130,246,.22)",
};

const challanSourceChip = {
    color: "#ca8a04",
    fontWeight: 900,
    background:
        "rgba(251,191,36,.12)",
    border:
        "1px solid rgba(251,191,36,.22)",
};

const manualSourceChip = {
    color: "#7c3aed",
    fontWeight: 900,
    background:
        "rgba(139,92,246,.13)",
    border:
        "1px solid rgba(139,92,246,.22)",
};

const statusChip = (status) => {
    const value =
        String(status || "")
            .trim()
            .toUpperCase();

    const palette = {
        RUNNING: [
            "#16a34a",
            "rgba(34,197,94,.13)",
            "rgba(34,197,94,.22)",
        ],

        WORKING: [
            "#16a34a",
            "rgba(34,197,94,.13)",
            "rgba(34,197,94,.22)",
        ],

        COMPLETED: [
            "#2563eb",
            "rgba(59,130,246,.13)",
            "rgba(59,130,246,.22)",
        ],

        CANCELLED: [
            "#dc2626",
            "rgba(239,68,68,.13)",
            "rgba(239,68,68,.22)",
        ],

        OFF: [
            "#d97706",
            "rgba(251,191,36,.13)",
            "rgba(251,191,36,.22)",
        ],

        ON_LEAVE: [
            "#d97706",
            "rgba(251,191,36,.13)",
            "rgba(251,191,36,.22)",
        ],
    };

    const selected =
        palette[value] || [
            "var(--pf-text)",
            "rgba(148,163,184,.13)",
            "rgba(148,163,184,.22)",
        ];

    return {
        color: selected[0],
        fontWeight: 900,
        background: selected[1],
        border:
            `1px solid ${selected[2]}`,
    };
};

const emptyState = {
    p: 4,
    color: "var(--pf-text-muted)",
    textAlign: "center",
    borderRadius: "18px",
    background:
        "rgba(var(--pf-fg-rgb),.025)",
    border:
        "1px dashed rgba(var(--pf-fg-rgb),.10)",
    fontWeight: 750,
};

export default LogisticsOperationsHub;