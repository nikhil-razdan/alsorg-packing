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

import {
  fetchDispatchChallans,
  fetchShifts,
} from "../../api/logisticsApi";

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
  showAlert = () => {},
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
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          challanResult,
          shiftResult,
        ] = await Promise.allSettled([
          fetchDispatchChallans(),
          fetchShifts(),
        ]);

        if (
          challanResult.status ===
          "fulfilled"
        ) {
          setChallans(
            Array.isArray(
              challanResult.value
            )
              ? challanResult.value
              : []
          );
        } else {
          console.error(
            challanResult.reason
          );

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
        } else {
          console.error(
            shiftResult.reason
          );

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
            "rejected"
        ) {
          throw new Error(
            "Unable to load logistics operations"
          );
        }
      } catch (error) {
        console.error(error);

        showAlert(
          error.message ||
            "Unable to load logistics operations",
          "error"
        );
      } finally {
        setLoading(false);
      }
    }, [showAlert]);

  useEffect(() => {
    if (view !== VIEW.OVERVIEW) {
      return;
    }

    loadOverview();
  }, [view, loadOverview]);

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
      <Box sx={headerRow}>
        <Box>
          <Box sx={title}>
            🚚 Trip Operations
          </Box>

          <Box sx={subtitle}>
            One control center for
            dispatched-item challans and
            manual non-challan operations
          </Box>
        </Box>

        <Box sx={headerActions}>
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
            startIcon={
              <AddRoadOutlinedIcon />
            }
            onClick={openManualCreate}
            sx={primaryButton}
          >
            Add Manual Operation
          </Button>
        </Box>
      </Box>

      <Box sx={flowNotice}>
        <Box sx={flowNoticeIcon}>
          <DescriptionOutlinedIcon />
        </Box>

        <Box>
          <Box sx={flowNoticeTitle}>
            Item dispatches are created
            only from the Dispatch page
          </Box>

          <Box sx={flowNoticeText}>
            Use “Add Manual Operation”
            only for trips without packet
            items or challans, such as
            pickups, empty returns, vehicle
            transfers, site visits or
            internal movements.
          </Box>
        </Box>
      </Box>

      <Box sx={innerTabs}>
        <InnerTab
          active={
            view === VIEW.OVERVIEW
          }
          icon="◉"
          label="Operations Overview"
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
                    "rgba(255,255,255,.42)",
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
        />
      )}

      {view === VIEW.MANUAL && (
        <ShiftOperations
          showAlert={showAlert}
          openCreateToken={
            manualCreateToken
          }
        />
      )}

      {view === VIEW.HISTORY && (
        <ShiftHistory
          showAlert={showAlert}
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
          : "rgba(255,255,255,.035)",

        borderColor: active
          ? "rgba(96,165,250,.55)"
          : "rgba(255,255,255,.07)",

        boxShadow: active
          ? "0 12px 30px rgba(37,99,235,.22)"
          : "none",
      }}
    >
      <span>{icon}</span>
      {label}
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
  borderRadius: "24px",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 2,
  mb: 2,
  flexWrap: "wrap",
};

const title = {
  color: "#fff",
  fontSize: {
    xs: 23,
    md: 28,
  },
  fontWeight: 950,
};

const subtitle = {
  color: "#94a3b8",
  mt: 0.6,
  fontSize: 13,
  fontWeight: 650,
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
};

const primaryButton = {
  height: 42,
  px: 2,
  borderRadius: "12px",
  textTransform: "none",
  color: "#fff",
  fontWeight: 900,
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const secondaryButton = {
  height: 42,
  px: 2,
  borderRadius: "12px",
  textTransform: "none",
  color: "#cbd5e1",
  fontWeight: 850,
  background:
    "rgba(255,255,255,.05)",
  border:
    "1px solid rgba(255,255,255,.08)",
};

const flowNotice = {
  mb: 2,
  p: 1.8,
  display: "flex",
  alignItems: "flex-start",
  gap: 1.4,
  borderRadius: "16px",
  background:
    "linear-gradient(135deg,rgba(37,99,235,.13),rgba(15,23,42,.55))",
  border:
    "1px solid rgba(96,165,250,.18)",
};

const flowNoticeIcon = {
  width: 38,
  height: 38,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  borderRadius: "12px",
  color: "#93c5fd",
  background:
    "rgba(59,130,246,.14)",
};

const flowNoticeTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
};

const flowNoticeText = {
  color: "#94a3b8",
  mt: 0.4,
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.55,
};

const innerTabs = {
  display: "flex",
  gap: 1,
  mb: 2,
  overflowX: "auto",
  pb: 0.5,
};

const innerTabButton = {
  height: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 850,
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2,minmax(0,1fr))",
    xl: "repeat(4,minmax(0,1fr))",
  },
  gap: 1.5,
  mb: 2,
};

const summaryCard = {
  minHeight: 104,
  p: 1.8,
  display: "flex",
  alignItems: "center",
  gap: 1.4,
  borderRadius: "18px",
  background:
    "linear-gradient(180deg,rgba(30,41,59,.85),rgba(15,23,42,.85))",
  border:
    "1px solid rgba(255,255,255,.07)",
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
  color: "#fff",
  fontSize: 25,
  fontWeight: 950,
};

const summaryLabel = {
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 850,
};

const summaryDetail = {
  color: "#64748b",
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
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const searchBox = {
  minHeight: 42,
  px: 1.4,
  display: "flex",
  alignItems: "center",
  gap: 1,
  borderRadius: "12px",
  background:
    "rgba(2,6,23,.55)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const searchField = {
  flex: 1,

  "& .MuiInputBase-root": {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
  },

  "& input::placeholder": {
    color:
      "rgba(255,255,255,.35)",
    opacity: 1,
  },
};

const filterSelect = {
  height: 42,
  color: "#fff",
  borderRadius: "12px",
  background:
    "rgba(2,6,23,.55)",

  ".MuiOutlinedInput-notchedOutline": {
    borderColor:
      "rgba(255,255,255,.08)",
  },

  ".MuiSvgIcon-root": {
    color: "#fff",
  },
};

const operationCard = {
  mb: 1.2,
  p: 1.8,
  borderRadius: "18px",
  background:
    "linear-gradient(180deg,rgba(30,41,59,.72),rgba(15,23,42,.82))",
  border:
    "1px solid rgba(255,255,255,.07)",

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
  color: "#fff",
  fontSize: 16,
  fontWeight: 950,
  fontFamily: "monospace",
};

const operationMeta = {
  mt: 0.7,
  color: "#94a3b8",
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
  color: "#6ee7b7",
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
  borderRadius: "10px",
  textTransform: "none",
  color: "#fff",
  fontWeight: 850,
  background:
    "rgba(59,130,246,.16)",
  border:
    "1px solid rgba(59,130,246,.22)",
};

const challanSourceChip = {
  color: "#facc15",
  fontWeight: 900,
  background:
    "rgba(251,191,36,.12)",
  border:
    "1px solid rgba(251,191,36,.22)",
};

const manualSourceChip = {
  color: "#c4b5fd",
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
      "#4ade80",
      "rgba(34,197,94,.13)",
      "rgba(34,197,94,.22)",
    ],

    WORKING: [
      "#4ade80",
      "rgba(34,197,94,.13)",
      "rgba(34,197,94,.22)",
    ],

    COMPLETED: [
      "#60a5fa",
      "rgba(59,130,246,.13)",
      "rgba(59,130,246,.22)",
    ],

    CANCELLED: [
      "#f87171",
      "rgba(239,68,68,.13)",
      "rgba(239,68,68,.22)",
    ],

    OFF: [
      "#fbbf24",
      "rgba(251,191,36,.13)",
      "rgba(251,191,36,.22)",
    ],

    ON_LEAVE: [
      "#fbbf24",
      "rgba(251,191,36,.13)",
      "rgba(251,191,36,.22)",
    ],
  };

  const selected =
    palette[value] || [
      "#cbd5e1",
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
  color: "#94a3b8",
  textAlign: "center",
  borderRadius: "18px",
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px dashed rgba(255,255,255,.10)",
  fontWeight: 750,
};

export default LogisticsOperationsHub;