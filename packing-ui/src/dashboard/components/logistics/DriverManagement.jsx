import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./logisticsScrollbars.css";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import LogisticsPagination from "./LogisticsPagination";

import {
  fetchDrivers,
  fetchDispatchChallans,
  fetchShifts,
  deleteDriver,
} from "../../api/logisticsApi";

import CreateDriverModal from "./modals/CreateDriverModal";
import LogisticsShiftModal from "./LogisticsShiftModal";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getChallanStatus = (challan) => {
  const status = normalizeText(
    challan?.tripStatus
  );

  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  if (
    challan?.tripEndedAt ||
    ["ENDED", "COMPLETED", "DELIVERED"].includes(
      status
    )
  ) {
    return "COMPLETED";
  }

  return "RUNNING";
};

function recordMatchesDriver(
  driver,
  recordDriverId,
  recordDriverName
) {
  const driverId = String(
    driver?.id || ""
  ).trim();

  const recordId = String(
    recordDriverId || ""
  ).trim();

  if (driverId && recordId) {
    return driverId === recordId;
  }

  const driverName = normalizeText(
    driver?.name
  );

  const candidateName = normalizeText(
    recordDriverName
  );

  return Boolean(
    driverName &&
    candidateName &&
    driverName === candidateName
  );
}

function DriverManagement({
  showAlert = () => { },
}) {
  const [drivers, setDrivers] =
    useState([]);
  const [challans, setChallans] =
    useState([]);
  const [shifts, setShifts] =
    useState([]);
  const [loading, setLoading] =
    useState(true);

  const [pageNo, setPageNo] =
    useState(1);
  const [pageSize, setPageSize] =
    useState(25);
  const [search, setSearch] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [open, setOpen] =
    useState(false);
  const [shiftOpen, setShiftOpen] =
    useState(false);
  const [selectedDriver, setSelectedDriver] =
    useState(null);

  async function loadDrivers() {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        fetchDrivers(),
        fetchDispatchChallans(),
        fetchShifts(),
      ]);

      const [
        driverResult,
        challanResult,
        shiftResult,
      ] = results;

      if (driverResult.status === "fulfilled") {
        setDrivers(
          Array.isArray(driverResult.value)
            ? driverResult.value
            : []
        );
      } else {
        throw driverResult.reason;
      }

      if (challanResult.status === "fulfilled") {
        setChallans(
          Array.isArray(challanResult.value)
            ? challanResult.value
            : []
        );
      } else {
        console.error(challanResult.reason);
        setChallans([]);
      }

      if (shiftResult.status === "fulfilled") {
        setShifts(
          Array.isArray(shiftResult.value)
            ? shiftResult.value
            : []
        );
      } else {
        console.error(shiftResult.reason);
        setShifts([]);
      }
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          "Failed to load drivers"
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driverRows = useMemo(() => {
    return drivers.map((driver) => {
      const driverChallans = challans.filter(
        (challan) =>
          recordMatchesDriver(
            driver,
            challan?.driverId ||
            challan?.driver?.id,
            challan?.driverName ||
            challan?.driver?.name
          )
      );

      const driverShifts = shifts.filter(
        (shift) =>
          recordMatchesDriver(
            driver,
            shift?.driver?.id ||
            shift?.driverId,
            shift?.driver?.name ||
            shift?.driverName
          )
      );

      const activeChallans =
        driverChallans.filter(
          (challan) =>
            getChallanStatus(challan) ===
            "RUNNING"
        ).length;

      const completedChallans =
        driverChallans.filter(
          (challan) =>
            getChallanStatus(challan) ===
            "COMPLETED"
        ).length;

      const dispatchedItems =
        driverChallans.reduce(
          (sum, challan) =>
            sum +
            Number(challan?.totalItems || 0),
          0
        );

      return {
        driver,
        challanCount: driverChallans.length,
        activeChallans,
        completedChallans,
        manualRecords: driverShifts.length,
        dispatchedItems,
        totalActivity:
          driverChallans.length +
          driverShifts.length,
      };
    });
  }, [drivers, challans, shifts]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);

    return driverRows.filter((row) => {
      const driver = row.driver;
      const status = normalizeText(
        driver?.status ||
        (driver?.active
          ? "ACTIVE"
          : "INACTIVE")
      );

      if (
        statusFilter !== "ALL" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = normalizeText(
        [
          driver?.name,
          driver?.phoneNumber,
          driver?.phone,
          driver?.licenseNumber,
          status,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchable.includes(query);
    });
  }, [
    driverRows,
    search,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    return driverRows.reduce(
      (result, row) => {
        result.total += 1;
        result.activeChallans +=
          row.activeChallans;
        result.dispatchChallans +=
          row.challanCount;
        result.dispatchedItems +=
          row.dispatchedItems;
        result.manualRecords +=
          row.manualRecords;
        return result;
      },
      {
        total: 0,
        activeChallans: 0,
        dispatchChallans: 0,
        dispatchedItems: 0,
        manualRecords: 0,
      }
    );
  }, [driverRows]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRows.length / pageSize
    )
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedDrivers =
    filteredRows.slice(
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
  }, [pageSize, search, statusFilter]);

  function openShiftForDriver(driver) {
    setSelectedDriver(driver);
    setShiftOpen(true);
  }

  function closeShiftForDriver() {
    setShiftOpen(false);
    setSelectedDriver(null);
  }

  async function remove(id) {
    try {
      await deleteDriver(id);
      await loadDrivers();

      showAlert(
        "Driver deleted successfully",
        "success"
      );
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          "Driver delete failed"
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
            Driver Management
          </div>
          <div style={subtitle}>
            Driver master, current dispatch assignments and unified trip history
          </div>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            style={secondaryButton}
            onClick={loadDrivers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            style={button}
            onClick={() => setOpen(true)}
          >
            + Add Driver
          </button>
        </div>
      </div>

      <div style={summaryGrid}>
        <DriverSummary
          label="Registered Drivers"
          value={summary.total}
          accent="#60a5fa"
        />
        <DriverSummary
          label="Active Challan Trips"
          value={summary.activeChallans}
          accent="#22c55e"
        />
        <DriverSummary
          label="Dispatch Challans"
          value={summary.dispatchChallans}
          accent="#8b5cf6"
        />
        <DriverSummary
          label="Items Dispatched"
          value={summary.dispatchedItems}
          accent="#f59e0b"
        />
      </div>

      <div style={filtersRow}>
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search driver, phone, license or status..."
          style={searchInput}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          style={statusSelect}
        >
          <option value="ALL">
            All Driver Status
          </option>
          <option value="ACTIVE">
            Active
          </option>
          <option value="INACTIVE">
            Inactive
          </option>
        </select>

        <div style={filterCount}>
          {filteredRows.length} driver(s)
        </div>
      </div>

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={table}>
        <div style={head}>
          <div>Driver</div>
          <div>Phone / License</div>
          <div>Active Trips</div>
          <div>Challans / Items</div>
          <div>Manual Records</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div style={emptyRow}>
            Loading driver operations...
          </div>
        )}

        {!loading &&
          paginatedDrivers.length === 0 && (
            <div style={emptyRow}>
              No drivers matched the selected filters.
            </div>
          )}

        {!loading &&
          paginatedDrivers.map((rowData) => {
            const driver = rowData.driver;
            const status =
              driver.status ||
              (driver.active
                ? "ACTIVE"
                : "INACTIVE");

            return (
              <div
                key={driver.id}
                style={row}
              >
                <div>
                  <span
                    role="button"
                    tabIndex={0}
                    style={driverNameBtn}
                    onClick={() =>
                      openShiftForDriver(
                        driver
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        openShiftForDriver(
                          driver
                        );
                      }
                    }}
                    title="Open unified driver activity"
                  >
                    <span style={driverNameText}>
                      {driver.name ||
                        driver.driverName ||
                        "Unnamed Driver"}
                    </span>
                  </span>
                  <div style={driverHint}>
                    360° trip & challan view
                  </div>
                </div>

                <div>
                  <div style={primaryText}>
                    {driver.phoneNumber ||
                      driver.phone ||
                      "—"}
                  </div>
                  <div style={secondaryText}>
                    License: {driver.licenseNumber || "—"}
                  </div>
                </div>

                <div>
                  <span
                    style={activeTripPill(
                      rowData.activeChallans
                    )}
                  >
                    {rowData.activeChallans}
                  </span>
                </div>

                <div>
                  <div style={metricStrong}>
                    {rowData.challanCount} challan(s)
                  </div>
                  <div style={secondaryText}>
                    {rowData.dispatchedItems} item(s)
                  </div>
                </div>

                <div>
                  {rowData.manualRecords}
                </div>

                <div>
                  <span style={driverStatus(status)}>
                    {status}
                  </span>
                </div>

                <div style={actions}>
                  <button
                    type="button"
                    style={viewBtn}
                    onClick={() =>
                      openShiftForDriver(
                        driver
                      )
                    }
                  >
                    360° View
                  </button>

                  <button
                    type="button"
                    style={deleteBtn}
                    onClick={() =>
                      remove(driver.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      <LogisticsPagination
        pageNo={currentPage}
        setPageNo={setPageNo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={filteredRows.length}
        label="drivers"
        pageSizeOptions={[10, 25, 50, 100]}
      />

      <CreateDriverModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={loadDrivers}
        showAlert={showAlert}
      />

      {shiftOpen && selectedDriver && (
        <LogisticsShiftModal
          open={shiftOpen}
          mode="create"
          initialDriverId={
            selectedDriver.id
          }
          driverName={
            selectedDriver.name
          }
          lockDriver={true}
          showDriverHistory={true}
          onClose={closeShiftForDriver}
          onSaved={loadDrivers}
          showAlert={showAlert}
        />
      )}
    </div>
  );
}

function DriverSummary({
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
      <div style={summaryLabel}>
        {label}
      </div>
      <div style={summaryValue}>
        {value}
      </div>
    </div>
  );
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
  gap: 9,
  alignItems: "center",
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: "-.015em",
};

const subtitle = {
  color: "var(--pf-text-muted)",
  marginTop: 6,
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.5,
};

const button = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 42,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(37,99,235,.20)",
};

const secondaryButton = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 42,
  padding: "0 15px",
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.10)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  WebkitTextFillColor:
    "var(--pf-text-strong)",
  fontWeight: 850,
  cursor: "pointer",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const summaryCard = {
  minHeight: 78,
  padding: 14,
  borderRadius: 13,
  background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 6px 16px rgba(var(--pf-shadow-rgb),.05)",
};

const summaryLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 850,
  letterSpacing: ".02em",
};

const summaryValue = {
  marginTop: 6,
  color: "var(--pf-text-strong)",
  fontSize: 24,
  fontWeight: 950,
};

const filtersRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 14,
  padding: 10,
  borderRadius: 13,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const searchInput = {
  flex: "1 1 280px",
  minWidth: 220,
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 11px",
  outline: "none",
  fontWeight: 700,
  colorScheme: "var(--pf-color-scheme)",
};

const statusSelect = {
  height: 38,
  minWidth: 170,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 10px",
  outline: "none",
  fontWeight: 750,
  colorScheme: "var(--pf-color-scheme)",
};

const filterCount = {
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  fontWeight: 800,
};

const table = {
  borderRadius: 14,
  overflowX: "auto",
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
};

const head = {
  minWidth: 1050,
  display: "grid",
  gridTemplateColumns: "1.15fr 1.15fr .7fr 1fr .7fr .75fr 1.05fr",
  padding: "13px 14px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-muted)",
  fontWeight: 850,
  fontSize: 11,
  borderBottom: "1px solid var(--pf-border)",
};

const row = {
  minWidth: 1050,
  display: "grid",
  gridTemplateColumns: "1.15fr 1.15fr .7fr 1fr .7fr .75fr 1.05fr",
  padding: "14px 14px",
  color: "var(--pf-text)",
  background: "var(--pf-surface)",
  borderTop: "1px solid var(--pf-border-soft)",
  alignItems: "center",
  fontSize: 12,
  lineHeight: 1.4,
};

const driverNameBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  maxWidth: "100%",
  border: "none",
  background: "transparent",
  color: "#1d4ed8",
  WebkitTextFillColor: "#1d4ed8",
  opacity: 1,
  visibility: "visible",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  lineHeight: 1.25,
  padding: 0,
  margin: 0,
  textAlign: "left",
  textIndent: 0,
  overflow: "visible",
  textDecoration: "none",
  textShadow: "none",
};

const driverNameText = {
  display: "inline-block",
  maxWidth: "100%",
  color: "#1d4ed8",
  WebkitTextFillColor: "#1d4ed8",
  opacity: 1,
  visibility: "visible",
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 950,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const driverHint = {
  marginTop: 3,
  color: "var(--pf-text-dim)",
  fontSize: 9.5,
  fontWeight: 700,
};

const primaryText = {
  color: "var(--pf-text)",
  fontWeight: 750,
};

const secondaryText = {
  marginTop: 3,
  color: "var(--pf-text-muted)",
  fontSize: 9.5,
};

const metricStrong = {
  color: "var(--pf-text-strong)",
  fontWeight: 850,
};

const activeTripPill = (count) => ({
  display: "inline-flex",
  minWidth: 34,
  justifyContent: "center",
  padding: "5px 8px",
  borderRadius: 999,
  color: count > 0 ? "#16a34a" : "var(--pf-text-muted)",
  background: count > 0 ? "rgba(34,197,94,.10)" : "rgba(148,163,184,.10)",
  border: count > 0 ? "1px solid rgba(34,197,94,.16)" : "1px solid var(--pf-border-soft)",
  fontWeight: 900,
});

const driverStatus = (statusValue) => {
  const status = normalizeText(statusValue);
  const active = status === "ACTIVE";

  return {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    color: active ? "#16a34a" : "var(--pf-text-muted)",
    background: active ? "rgba(34,197,94,.10)" : "rgba(148,163,184,.10)",
    border: active ? "1px solid rgba(34,197,94,.16)" : "1px solid var(--pf-border-soft)",
    fontSize: 9.5,
    fontWeight: 900,
  };
};

const actions = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const viewBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 32,
  padding: "0 12px",
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 10.5,
  opacity: 1,
  boxShadow:
    "0 6px 14px rgba(37,99,235,.18)",
};

const deleteBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 32,
  padding: "0 12px",
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 10.5,
  opacity: 1,
  boxShadow:
    "0 6px 14px rgba(239,68,68,.17)",
};

const emptyRow = {
  padding: 28,
  color: "var(--pf-text-muted)",
  textAlign: "center",
  background: "var(--pf-surface)",
};

export default DriverManagement;
