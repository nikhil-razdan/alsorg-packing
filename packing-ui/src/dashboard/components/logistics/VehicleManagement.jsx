import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./logisticsScrollbars.css";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Box,
} from "@mui/material";

import {
  deleteVehicle,
} from "../../api/logisticsApi";

import {
  getCachedVehicles,
  invalidateLogisticsResources,
} from "./logisticsReadCache";

import VehicleExpenseModal from "./modals/VehicleExpenseModal";
import CreateVehicleModal from "./modals/CreateVehicleModal";
import LogisticsPagination from "./LogisticsPagination";
import useLogisticsLiveRefresh from "./useLogisticsLiveRefresh";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  VEHICLE_DOCUMENT_WARNING_DAYS,
  formatVehicleDate,
  getVehicleAgeFromRegistration,
  getVehicleCompliance,
} from "./vehicleComplianceUtils";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

function VehicleManagement({
  showAlert = () => { },
  liveRefreshToken = null,
  cacheScope = "",
}) {
  const [vehicles, setVehicles] =
    useState([]);
  const [loading, setLoading] =
    useState(true);

  const [expenseOpen, setExpenseOpen] =
    useState(false);
  const [expenseVehicle, setExpenseVehicle] =
    useState(null);

  const [open, setOpen] =
    useState(false);
  const [editingVehicle, setEditingVehicle] =
    useState(null);

  const [deleteOpen, setDeleteOpen] =
    useState(false);
  const [deleteVehicleId, setDeleteVehicleId] =
    useState(null);

  const [pageNo, setPageNo] =
    useState(1);
  const [pageSize, setPageSize] =
    useState(25);

  const [search, setSearch] =
    useState("");
  const [complianceFilter, setComplianceFilter] =
    useState("ALL");

  async function loadVehicles({
    background = false,
    force = false,
  } = {}) {
    try {
      if (!background) {
        setLoading(true);
      }

      const data = await getCachedVehicles(cacheScope, { force });

      setVehicles(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      if (!background) {
        showAlert(
          getBackendMessage(
            error,
            "Failed to load vehicles"
          ),
          "error"
        );
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }

  useLogisticsLiveRefresh(
    liveRefreshToken,
    async () => {
      await loadVehicles({
        background: true,
        force: false,
      });
    }
  );

  useEffect(() => {
    void loadVehicles({ force: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enrichedVehicles = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        vehicle,
        age: getVehicleAgeFromRegistration(
          vehicle?.registrationDate
        ),
        compliance:
          getVehicleCompliance(vehicle),
      })),
    [vehicles]
  );

  const summary = useMemo(() => {
    return enrichedVehicles.reduce(
      (result, rowData) => {
        result.total += 1;

        if (
          rowData.compliance.severity ===
          "DANGER"
        ) {
          result.criticalVehicles += 1;
        } else if (
          rowData.compliance.severity ===
          "WARNING"
        ) {
          result.warningVehicles += 1;
        } else {
          result.compliantVehicles += 1;
        }

        result.expiredDocuments +=
          rowData.compliance.expiredCount;
        result.expiringSoonDocuments +=
          rowData.compliance.criticalCount +
          rowData.compliance.expiringSoonCount;
        result.missingDocuments +=
          rowData.compliance.missingCount;

        return result;
      },
      {
        total: 0,
        criticalVehicles: 0,
        warningVehicles: 0,
        compliantVehicles: 0,
        expiredDocuments: 0,
        expiringSoonDocuments: 0,
        missingDocuments: 0,
      }
    );
  }, [enrichedVehicles]);

  const filteredVehicles = useMemo(() => {
    const query = normalizeText(search);

    return enrichedVehicles.filter(
      (rowData) => {
        const { vehicle, compliance } =
          rowData;

        if (
          complianceFilter !== "ALL" &&
          compliance.severity !==
          complianceFilter
        ) {
          return false;
        }

        if (!query) return true;

        const searchable = normalizeText(
          [
            vehicle?.vehicleNumber,
            vehicle?.driverName,
            vehicle?.ownerName,
            vehicle?.vehicleType,
            vehicle?.vehicleClass,
            vehicle?.fuelType,
            vehicle?.fuel,
            vehicle?.status,
            vehicle?.registeringAuthority,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchable.includes(query);
      }
    );
  }, [
    enrichedVehicles,
    search,
    complianceFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredVehicles.length / pageSize
    )
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedVehicles =
    filteredVehicles.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  useEffect(() => {
    setPageNo(1);
  }, [pageSize, search, complianceFilter]);

  function openCreate() {
    setEditingVehicle(null);
    setOpen(true);
  }

  function openEdit(vehicle) {
    setEditingVehicle(vehicle);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditingVehicle(null);
  }

  function openDelete(id) {
    setDeleteVehicleId(id);
    setDeleteOpen(true);
  }

  function closeDelete() {
    setDeleteOpen(false);
    setDeleteVehicleId(null);
  }

  function openExpense(vehicle) {
    setExpenseVehicle(vehicle);
    setExpenseOpen(true);
  }

  function closeExpense() {
    setExpenseOpen(false);
    setExpenseVehicle(null);
  }

  async function confirmDelete() {
    if (!deleteVehicleId) return;

    try {
      await deleteVehicle(deleteVehicleId);
      invalidateLogisticsResources(cacheScope, ["vehicles"]);
      await loadVehicles({ force: true });

      showAlert(
        "Vehicle deleted successfully",
        "success"
      );

      closeDelete();
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          "Vehicle delete failed"
        ),
        "error"
      );
    }
  }

  return (
    <div className="logistics-scroll-scope" style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Fleet Management
          </div>

          <div style={subtitle}>
            Vehicle age is calculated live from registration date. Fitness, Insurance and PUCC are continuously checked for expiry risk.
          </div>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            style={refreshBtn}
            onClick={() => loadVehicles({ force: true })}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            style={button}
            onClick={openCreate}
          >
            + Add Vehicle
          </button>
        </div>
      </div>

      <div style={summaryGrid}>
        <FleetSummary
          label="Total Fleet"
          value={summary.total}
          accent="#60a5fa"
        />
        <FleetSummary
          label="Compliant"
          value={summary.compliantVehicles}
          accent="#22c55e"
        />
        <FleetSummary
          label="Attention Vehicles"
          value={
            summary.warningVehicles +
            summary.criticalVehicles
          }
          accent="#f59e0b"
        />
        <FleetSummary
          label="Expired Documents"
          value={summary.expiredDocuments}
          accent="#ef4444"
        />
        <FleetSummary
          label={`Expiring ≤ ${VEHICLE_DOCUMENT_WARNING_DAYS} Days`}
          value={
            summary.expiringSoonDocuments
          }
          accent="#f97316"
        />
        <FleetSummary
          label="Missing Validity"
          value={summary.missingDocuments}
          accent="#a78bfa"
        />
      </div>

      <div style={complianceNotice}>
        <div style={complianceNoticeTitle}>
          Fleet compliance rule
        </div>
        <div style={complianceNoticeText}>
          Red = expired / expires today / critical within 7 days. Amber = expiry within {VEHICLE_DOCUMENT_WARNING_DAYS} days or validity date missing. These same vehicle alerts are surfaced in the PackFlow Header notifications.
        </div>
      </div>

      <div style={filtersRow}>
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search vehicle, driver, owner, class, fuel or status..."
          style={searchInput}
        />

        <select
          value={complianceFilter}
          onChange={(event) =>
            setComplianceFilter(
              event.target.value
            )
          }
          style={filterSelect}
        >
          <option value="ALL">
            All Compliance Status
          </option>
          <option value="DANGER">
            Critical / Expired
          </option>
          <option value="WARNING">
            Expiring / Missing
          </option>
          <option value="OK">
            Fully Compliant
          </option>
        </select>

        <div style={resultCount}>
          {filteredVehicles.length} vehicle(s)
        </div>
      </div>

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={table}>
        <div style={tableHead}>
          <div>Vehicle</div>
          <div>Driver</div>
          <div>Owner</div>
          <div>Type / Class</div>
          <div>Fuel / Norm</div>
          <div>Status / Age</div>
          <div>Document Validity</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div style={emptyState}>
            Loading fleet records...
          </div>
        )}

        {!loading &&
          paginatedVehicles.length === 0 && (
            <div style={emptyState}>
              No vehicles matched the selected filters.
            </div>
          )}

        {!loading &&
          paginatedVehicles.map(
            ({
              vehicle: v,
              age,
              compliance,
            }) => (
              <div
                key={v.id}
                style={{
                  ...tableRow,
                  ...getComplianceRowStyle(
                    compliance.severity
                  ),
                }}
              >
                <div style={mainCell}>
                  <span style={vehicleNoText}>
                    {v.vehicleNumber || "-"}
                  </span>

                  <span style={subText}>
                    Reg: {formatVehicleDate(
                      v.registrationDate
                    )}
                  </span>

                  <span style={subText}>
                    {v.registeringAuthority ||
                      "-"}
                  </span>
                </div>

                <div style={normalCell}>
                  {v.driverName || "-"}
                </div>

                <div style={normalCell}>
                  {v.ownerName || "-"}
                </div>

                <div style={mainCell}>
                  <span style={normalText}>
                    {v.vehicleType || "-"}
                  </span>

                  <span style={subText}>
                    {v.vehicleClass || "-"}
                  </span>
                </div>

                <div style={mainCell}>
                  <span style={normalText}>
                    {v.fuelType ||
                      v.fuel ||
                      "-"}
                  </span>

                  <span style={subText}>
                    {v.emissionNorm || "-"}
                  </span>
                </div>

                <div style={statusAgeCell}>
                  <Chip
                    label={v.status || "Active"}
                    size="small"
                    sx={getStatusChipSx(
                      v.status
                    )}
                  />

                  <div style={ageLabel}>
                    Vehicle Age
                  </div>
                  <div style={ageValue}>
                    {age}
                  </div>

                  <ComplianceBadge
                    compliance={compliance}
                  />
                </div>

                <div style={validityCell}>
                  {compliance.documents.map(
                    (document) => (
                      <ValidityLine
                        key={document.key}
                        document={document}
                      />
                    )
                  )}
                </div>

                <div style={actionsCell}>
                  <button
                    type="button"
                    style={expenseBtn}
                    onClick={() =>
                      openExpense(v)
                    }
                  >
                    Expense
                  </button>

                  <button
                    type="button"
                    style={editBtn}
                    onClick={() => openEdit(v)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    style={deleteBtn}
                    onClick={() =>
                      openDelete(v.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
      </div>

      <LogisticsPagination
        pageNo={currentPage}
        setPageNo={setPageNo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={filteredVehicles.length}
      />

      <CreateVehicleModal
        open={open}
        onClose={closeForm}
        onCreated={() => loadVehicles({ force: true })}
        showAlert={showAlert}
        initialData={editingVehicle}
      />

      <VehicleExpenseModal
        open={expenseOpen}
        onClose={closeExpense}
        vehicle={expenseVehicle}
        showAlert={showAlert}
        liveRefreshToken={liveRefreshToken}
      />

      <Dialog
        open={deleteOpen}
        onClose={closeDelete}
        PaperProps={{
          className:
            "logistics-scrollbar logistics-scrollbar-y logistics-modal-scroll",
          sx: {
            background: "var(--pf-surface)",
            color: "var(--pf-text-strong)",
            borderRadius: "14px",
            border: "1px solid var(--pf-border)",
            boxShadow: "var(--pf-card-shadow)",
          },
        }}
      >
        <DialogTitle>
          Delete Vehicle
        </DialogTitle>

        <DialogContent>
          Are you sure you want to delete this vehicle?
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closeDelete}
            sx={actionSecondary}
          >
            Cancel
          </Button>

          <Button
            onClick={confirmDelete}
            sx={actionDanger}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function FleetSummary({
  label,
  value,
  accent,
}) {
  return (
    <div
      style={{
        ...summaryCard,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div style={summaryLabel}>{label}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

function ComplianceBadge({ compliance }) {
  const label =
    compliance.severity === "DANGER"
      ? `${compliance.alertCount} critical alert${compliance.alertCount === 1 ? "" : "s"}`
      : compliance.severity === "WARNING"
        ? `${compliance.alertCount} attention item${compliance.alertCount === 1 ? "" : "s"}`
        : "Documents compliant";

  return (
    <span
      style={complianceBadge(
        compliance.severity
      )}
    >
      {label}
    </span>
  );
}

function ValidityLine({ document }) {
  return (
    <Box
      sx={validityLineSx(
        document.severity
      )}
    >
      <Box sx={validityDocNameSx}>
        {document.documentLabel}
      </Box>

      <Box sx={validityDateSx}>
        {document.formattedDate}
      </Box>

      <Box
        sx={validityStatusSx(
          document.severity
        )}
      >
        {document.status === "VALID"
          ? "VALID"
          : document.status === "MISSING"
            ? "MISSING"
            : "ALERT"}
      </Box>

      <Box
        sx={validityMessageSx(
          document.severity
        )}
      >
        {document.statusText}
      </Box>
    </Box>
  );
}

function getStatusChipSx(status) {
  const value = String(
    status || "Active"
  ).toLowerCase();

  if (
    value.includes("expired") ||
    value.includes("inactive")
  ) {
    return statusDangerChipSx;
  }

  if (value.includes("maintenance")) {
    return statusWarningChipSx;
  }

  return statusActiveChipSx;
}

function getComplianceRowStyle(severity) {
  if (severity === "DANGER") {
    return {
      background:
        "linear-gradient(90deg,rgba(239,68,68,.08),transparent 42%)",
      borderLeft: "3px solid #ef4444",
    };
  }

  if (severity === "WARNING") {
    return {
      background:
        "linear-gradient(90deg,rgba(245,158,11,.07),transparent 42%)",
      borderLeft: "3px solid #f59e0b",
    };
  }

  return {};
}

const wrap = {
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  borderRadius: 18,
  padding: 22,
  border: "1px solid var(--pf-border)",
  boxShadow: "var(--pf-card-shadow)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 24,
  fontWeight: 900,
};

const subtitle = {
  color: "var(--pf-text-muted)",
  marginTop: 6,
  maxWidth: 760,
  lineHeight: 1.5,
};

const button = {
  height: 42,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const refreshBtn = {
  height: 42,
  padding: "0 15px",
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  background:
    "rgba(var(--pf-fg-rgb),.04)",
  color: "var(--pf-text)",
  fontWeight: 800,
  cursor: "pointer",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const summaryCard = {
  padding: 13,
  minHeight: 74,
  borderRadius: 14,
  background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 6px 16px rgba(var(--pf-shadow-rgb),.05)",
};

const summaryLabel = {
  color: "var(--pf-text-dim)",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue = {
  marginTop: 6,
  color: "var(--pf-text-strong)",
  fontSize: 24,
  fontWeight: 950,
};

const complianceNotice = {
  marginBottom: 14,
  padding: 13,
  borderRadius: 14,
  background:
    "linear-gradient(135deg,rgba(245,158,11,.08),rgba(59,130,246,.05))",
  border:
    "1px solid rgba(245,158,11,.16)",
};

const complianceNoticeTitle = {
  color: "var(--pf-text-strong)",
  fontSize: 12,
  fontWeight: 900,
};

const complianceNoticeText = {
  marginTop: 4,
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  lineHeight: 1.5,
  fontWeight: 650,
};

const filtersRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14,
  padding: 11,
  borderRadius: 14,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const searchInput = {
  flex: "1 1 320px",
  minWidth: 230,
  height: 38,
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 11px",
  outline: "none",
  fontWeight: 700,
  colorScheme: "var(--pf-color-scheme)",
};

const filterSelect = {
  height: 38,
  minWidth: 190,
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 10px",
  outline: "none",
  fontWeight: 750,
  colorScheme: "var(--pf-color-scheme)",
};

const resultCount = {
  color: "var(--pf-text-dim)",
  fontSize: 10.5,
  fontWeight: 800,
};

const table = {
  borderRadius: 18,
  overflowX: "auto",
  overflowY: "hidden",
  overscrollBehaviorX: "contain",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const tableHead = {
  display: "grid",
  gridTemplateColumns:
    "1.18fr 1.05fr 1.1fr 1.1fr 1fr 1.05fr 2.15fr 1.15fr",
  minWidth: 1620,
  padding: "16px 18px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-muted)",
  fontWeight: 900,
  fontSize: 12,
  columnGap: 18,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns:
    "1.18fr 1.05fr 1.1fr 1.1fr 1fr 1.05fr 2.15fr 1.15fr",
  minWidth: 1620,
  padding: "18px 18px",
  color: "var(--pf-text)",
  borderTop:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
  alignItems: "center",
  columnGap: 18,
};

const emptyState = {
  minWidth: 1620,
  padding: 24,
  color: "var(--pf-text-muted)",
  textAlign: "center",
  borderTop:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const mainCell = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const normalCell = {
  color: "var(--pf-text)",
  fontWeight: 700,
  fontSize: 13,
};

const vehicleNoText = {
  color: "var(--pf-text-strong)",
  fontWeight: 900,
  fontSize: 14,
  letterSpacing: ".03em",
};

const normalText = {
  color: "var(--pf-text-strong)",
  fontWeight: 800,
  fontSize: 13,
};

const subText = {
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  fontWeight: 650,
};

const statusAgeCell = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 5,
};

const ageLabel = {
  color: "var(--pf-text-dim)",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
  marginTop: 2,
};

const ageValue = {
  color: "var(--pf-text)",
  fontSize: 10.5,
  fontWeight: 850,
};

const complianceBadge = (severity) => ({
  marginTop: 3,
  display: "inline-flex",
  padding: "4px 7px",
  borderRadius: 999,
  fontSize: 8.5,
  fontWeight: 900,
  color:
    severity === "DANGER"
      ? "#dc2626"
      : severity === "WARNING"
        ? "#d97706"
        : "#16a34a",
  background:
    severity === "DANGER"
      ? "rgba(239,68,68,.13)"
      : severity === "WARNING"
        ? "rgba(245,158,11,.13)"
        : "rgba(34,197,94,.13)",
  border:
    severity === "DANGER"
      ? "1px solid rgba(239,68,68,.22)"
      : severity === "WARNING"
        ? "1px solid rgba(245,158,11,.22)"
        : "1px solid rgba(34,197,94,.22)",
});

const validityCell = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  minWidth: 300,
  paddingRight: 10,
};

const validityLineSx = (severity) => ({
  display: "grid",
  gridTemplateColumns:
    "74px 94px 70px minmax(150px,1fr)",
  alignItems: "center",
  gap: 1,
  minHeight: 38,
  px: 1,
  py: 0.65,
  borderRadius: "10px",
  background:
    severity === "DANGER"
      ? "rgba(239,68,68,.07)"
      : severity === "WARNING"
        ? "rgba(245,158,11,.07)"
        : "rgba(34,197,94,.045)",
  border:
    severity === "DANGER"
      ? "1px solid rgba(239,68,68,.16)"
      : severity === "WARNING"
        ? "1px solid rgba(245,158,11,.15)"
        : "1px solid rgba(34,197,94,.10)",
});

const validityDocNameSx = {
  color: "var(--pf-text)",
  fontSize: 10.5,
  fontWeight: 900,
};

const validityDateSx = {
  color: "var(--pf-text-strong)",
  fontSize: 10.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const validityStatusSx = (severity) => ({
  color:
    severity === "DANGER"
      ? "#dc2626"
      : severity === "WARNING"
        ? "#d97706"
        : "#16a34a",
  fontSize: 8.5,
  fontWeight: 950,
  textTransform: "uppercase",
});

const validityMessageSx = (severity) => ({
  color:
    severity === "DANGER"
      ? "#dc2626"
      : severity === "WARNING"
        ? "#d97706"
        : "#16a34a",
  fontSize: 9,
  fontWeight: 750,
});

const validityDetailSx = {
  display: "none",
};

const actionsCell = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-start",
  paddingLeft: 14,
  borderLeft:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
  flexWrap: "wrap",
};

const editBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 11,
};

const deleteBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 11,
};

const expenseBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#0891b2,#06b6d4)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 11,
};

const statusActiveChipSx = {
  color: "#16a34a",
  background: "rgba(34,197,94,.15)",
  border:
    "1px solid rgba(34,197,94,.25)",
  fontWeight: 900,
};

const statusWarningChipSx = {
  color: "#d97706",
  background: "rgba(245,158,11,.15)",
  border:
    "1px solid rgba(245,158,11,.25)",
  fontWeight: 900,
};

const statusDangerChipSx = {
  color: "#dc2626",
  background: "rgba(239,68,68,.15)",
  border:
    "1px solid rgba(239,68,68,.25)",
  fontWeight: 900,
};

const actionSecondary = {
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 700,
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text)",
  border: "1px solid var(--pf-border)",

  "&:hover": {
    background: "var(--pf-hover)",
  },
};

const actionDanger = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 700,
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  boxShadow:
    "0 10px 24px rgba(239,68,68,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#b91c1c,#dc2626)",
  },
};

export default VehicleManagement;
