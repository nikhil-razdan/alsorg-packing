import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  formatShiftDate,
  formatShiftTimeRange,
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

import {
  fetchDrivers,
  fetchVehicles,
  fetchShifts,
  createShift,
  updateShift,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

const toDateTimeLocal = (value) => {
  if (!value) return "";

  if (
    typeof value === "string" &&
    value.includes("T")
  ) {
    return value.slice(0, 16);
  }

  try {
    return new Date(value)
      .toISOString()
      .slice(0, 16);
  } catch {
    return "";
  }
};

const toDateOnly = (value) => {
  if (!value) return "";

  try {
    return new Date(value)
      .toISOString()
      .slice(0, 10);
  } catch {
    return "";
  }
};

const todayDate = () => {
  return new Date()
    .toISOString()
    .slice(0, 10);
};

const buildInitialForm = ({
  initialDriverId,
  shift,
}) => {
  if (shift) {
    return {
      driverId:
        shift.driver?.id ||
        shift.driverId ||
        "",

      vehicleId:
        shift.vehicle?.id ||
        shift.vehicleId ||
        "",

      shiftStart: toDateTimeLocal(
        shift.shiftStart
      ),

      shiftEnd: toDateTimeLocal(
        shift.shiftEnd
      ),

      overtimeHours:
        shift.overtimeHours ?? 0,

      totalTrips:
        shift.totalTrips ?? 0,

      totalHelpers:
        shift.totalHelpers ??
        shift.totalLoaders ??
        0,

      fuelUsed:
        shift.fuelUsed ?? 0,

      totalDistance:
        shift.totalDistance ?? 0,

      routeCategory:
        shift.routeCategory || "Factory",

      remarks:
        shift.remarks || "",

      status:
        shift.status || "WORKING",
    };
  }

  return {
    driverId: initialDriverId || "",
    vehicleId: "",
    shiftStart: "",
    shiftEnd: "",
    overtimeHours: 0,
    totalTrips: 0,
    totalHelpers: 0,
    fuelUsed: 0,
    totalDistance: 0,
    routeCategory: "Factory",
    remarks: "",
    status: "WORKING",
  };
};

function LogisticsShiftModal({
  open,
  onClose,
  onCreated,
  onSaved,
  showAlert = () => {},

  mode = "create",
  shift = null,
  initialDriverId = "",
  lockDriver = false,

  showDriverHistory = false,
  driverName = "",
}) {
  const isEdit = mode === "edit";

  const [drivers, setDrivers] =
    useState([]);

  const [vehicles, setVehicles] =
    useState([]);

  const [allShifts, setAllShifts] =
    useState([]);

  const [saving, setSaving] =
    useState(false);

  const [historyPageNo, setHistoryPageNo] =
    useState(1);

  const [historyPageSize, setHistoryPageSize] =
    useState(5);

  const [historyFromDate, setHistoryFromDate] =
    useState("");

  const [historyToDate, setHistoryToDate] =
    useState("");

  const [form, setForm] =
    useState(() =>
      buildInitialForm({
        initialDriverId,
        shift,
      })
    );

  useEffect(() => {
    if (!open) return;

    setForm(
      buildInitialForm({
        initialDriverId,
        shift,
      })
    );

    setHistoryPageNo(1);

	setHistoryFromDate("");
	setHistoryToDate("");
  }, [
    open,
    initialDriverId,
    shift,
  ]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    Promise.all([
      fetchDrivers(),
      fetchVehicles(),
      fetchShifts(),
    ])
      .then(
        ([
          driverData,
          vehicleData,
          shiftData,
        ]) => {
          if (!active) return;

          setDrivers(driverData || []);
          setVehicles(vehicleData || []);
          setAllShifts(shiftData || []);
        }
      )
      .catch((e) => {
        if (!active) return;

        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to load logistics data"
          ),
          "error"
        );
      });

    return () => {
      active = false;
    };
  }, [open, showAlert]);

  const selectedDriverName =
    driverName ||
    drivers.find(
      (d) =>
        String(d.id) ===
        String(form.driverId)
    )?.name ||
    "Selected Driver";

  const driverHistoryRows = useMemo(() => {
    if (
      !showDriverHistory ||
      !form.driverId
    ) {
      return [];
    }

    return allShifts
      .filter((s) => {
        const shiftDriverId =
          s.driver?.id ||
          s.driverId;

        return (
          String(shiftDriverId) ===
          String(form.driverId)
        );
      })
      .filter((s) => {
        const shiftDate =
          toDateOnly(
            s.shiftStart ||
              s.date ||
              s.createdAt
          );

        if (!shiftDate) return false;

        if (
          historyFromDate &&
          shiftDate < historyFromDate
        ) {
          return false;
        }

        if (
          historyToDate &&
          shiftDate > historyToDate
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(
          a.shiftStart ||
            a.createdAt ||
            0
        ).getTime();

        const bTime = new Date(
          b.shiftStart ||
            b.createdAt ||
            0
        ).getTime();

        return bTime - aTime;
      });
  }, [
    allShifts,
    form.driverId,
    historyFromDate,
    historyToDate,
    showDriverHistory,
  ]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(
      driverHistoryRows.length /
        historyPageSize
    )
  );

  const historyCurrentPage = Math.min(
    historyPageNo,
    historyTotalPages
  );

  const paginatedHistoryRows =
    driverHistoryRows.slice(
      (historyCurrentPage - 1) *
        historyPageSize,
      historyCurrentPage *
        historyPageSize
    );

  if (!open) return null;

  const update = (
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const buildPayload = () => ({
    driverId: form.driverId,

    vehicleId: form.vehicleId,

    shiftStart: form.shiftStart,

    shiftEnd: form.shiftEnd,

    overtimeHours: Number(
      form.overtimeHours || 0
    ),

    totalTrips: Number(
      form.totalTrips || 0
    ),

    totalLoaders: Number(
      form.totalHelpers || 0
    ),

    fuelUsed: Number(
      form.fuelUsed || 0
    ),

    totalDistance: Number(
      form.totalDistance || 0
    ),

    routeCategory:
      form.routeCategory || "Factory",

    remarks: form.remarks || "",

    status: form.status || "WORKING",
  });

  const reloadShiftHistory = async () => {
    try {
      const shiftData =
        await fetchShifts();

      setAllShifts(shiftData || []);
    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Failed to refresh shift history"
        ),
        "error"
      );
    }
  };

  const submit = async () => {
    if (saving) return;

    try {
      setSaving(true);

      if (!form.driverId) {
        throw new Error(
          "Please select a driver"
        );
      }

      if (!form.vehicleId) {
        throw new Error(
          "Please select a vehicle"
        );
      }

      if (!form.shiftStart) {
        throw new Error(
          "Shift start is required"
        );
      }

      if (!form.shiftEnd) {
        throw new Error(
          "Shift end is required"
        );
      }

      const payload = buildPayload();

      if (isEdit) {
        await updateShift(
          shift.id,
          payload
        );

        showAlert(
          "Shift updated successfully",
          "success"
        );
      } else {
        await createShift(payload);

        showAlert(
          "Shift created successfully",
          "success"
        );
      }

      await reloadShiftHistory();

      const refreshFn =
        onSaved || onCreated;

      await refreshFn?.();

      if (!showDriverHistory) {
        onClose();
      } else {
        setForm(
          buildInitialForm({
            initialDriverId: form.driverId,
            shift: null,
          })
        );
      }

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          isEdit
            ? "Failed to update shift"
            : "Failed to create shift"
        ),
        "error"
      );

    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={overlay}
      onClick={onClose}
    >
      <div
        style={modal}
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div style={header}>
          <div>
            <div style={title}>
              {showDriverHistory
                ? `${selectedDriverName} Shift Control`
                : isEdit
                ? "Edit Logistics Shift"
                : "Logistics Shift Entry"}
            </div>

            <div style={subtitle}>
              {showDriverHistory
                ? "View previous shift operations and create a new shift"
                : isEdit
                ? "Update shift details and status"
                : "Driver and vehicle operations management"}
            </div>
          </div>

          <button
            onClick={onClose}
            style={closeBtn}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {showDriverHistory && (
          <section style={historySection}>
            <div style={sectionHeader}>
              <div>
                <div style={sectionTitle}>
                  Previous Shift Operations
                </div>

                <div style={sectionSub}>
                  Driver wise shift history for selected dates
                </div>
              </div>

              <div style={dateFilterRow}>
                <label style={dateLabel}>
                  From
                  <input
                    type="date"
                    value={historyFromDate}
                    onChange={(e) => {
                      setHistoryFromDate(
                        e.target.value
                      );
                      setHistoryPageNo(1);
                    }}
                    style={dateInput}
                  />
                </label>

                <label style={dateLabel}>
                  To
                  <input
                    type="date"
                    value={historyToDate}
                    onChange={(e) => {
                      setHistoryToDate(
                        e.target.value
                      );
                      setHistoryPageNo(1);
                    }}
                    style={dateInput}
                  />
                </label>

                <button
                  style={clearDateBtn}
                  onClick={() => {
                    setHistoryFromDate("");
                    setHistoryToDate("");
                    setHistoryPageNo(1);
                  }}
                >
                  All
                </button>
              </div>
            </div>

            <div style={historyTable}>
              <div style={historyHead}>
                <div>Date</div>
                <div>Vehicle</div>
                <div>Trips</div>
                <div>Route</div>
                <div>Status</div>
              </div>

              {paginatedHistoryRows.length ===
                0 && (
                <div style={historyEmpty}>
                  No previous shifts found for this driver in selected date range
                </div>
              )}

              {paginatedHistoryRows.map(
                (s) => (
					<div
					  key={s.id}
					  style={{
					    ...historyRow,
					    ...(isShiftOverSixPm(s)
					      ? historyLateRow
					      : {}),
					  }}
					>
					<div>
					  <div style={historyDateText}>
					    {formatShiftDate(s)}
					  </div>

					  <div
					    style={{
					      ...historyTimeText,
					      ...(isShiftOverSixPm(s)
					        ? historyLateTimeText
					        : {}),
					    }}
					  >
					    {formatShiftTimeRange(s)}
					  </div>

					  {isShiftOverSixPm(s) && (
					    <div style={historyLateBadge}>
					      After 6 PM
					    </div>
					  )}
					</div>

                    <div>
                      {s.vehicle
                        ?.vehicleNumber ||
                        "-"}
                    </div>

                    <div>
                      {s.totalTrips ?? "-"}
                    </div>

                    <div>
                      {s.routeCategory ||
                        "-"}
                    </div>

                    <div>
                      <span
                        style={historyStatus(
                          s.status
                        )}
                      >
                        {s.status || "-"}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>

            <div style={historyPagination}>
              <div style={historyCount}>
                Total: {driverHistoryRows.length}
              </div>

              <div style={historyPagerRight}>
                <select
                  value={historyPageSize}
                  onChange={(e) => {
                    setHistoryPageSize(
                      Number(e.target.value)
                    );
                    setHistoryPageNo(1);
                  }}
                  style={pageSizeSelect}
                >
                  <option value={5}>
                    5
                  </option>

                  <option value={10}>
                    10
                  </option>

                  <option value={25}>
                    25
                  </option>
                </select>

                <button
                  style={pagerBtn}
                  disabled={
                    historyCurrentPage === 1
                  }
                  onClick={() =>
                    setHistoryPageNo(
                      historyCurrentPage - 1
                    )
                  }
                >
                  ◀ Previous
                </button>

                <div style={pageBadge}>
                  Page{" "}
                  <span style={pageNoBlue}>
                    {historyCurrentPage}
                  </span>{" "}
                  of {historyTotalPages}
                </div>

                <button
                  style={pagerBtn}
                  disabled={
                    historyCurrentPage ===
                    historyTotalPages
                  }
                  onClick={() =>
                    setHistoryPageNo(
                      historyCurrentPage + 1
                    )
                  }
                >
                  Next ▶
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={createSection}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionTitle}>
                {isEdit
                  ? "Edit Shift Details"
                  : "Create New Shift"}
              </div>

              <div style={sectionSub}>
                Fill operations details for this shift
              </div>
            </div>
          </div>

          <div style={grid}>
            <Field label="Driver">
              <select
                value={form.driverId}
                disabled={lockDriver}
                onChange={(e) =>
                  update(
                    "driverId",
                    e.target.value
                  )
                }
                style={{
                  ...input,
                  opacity: lockDriver
                    ? 0.75
                    : 1,
                  cursor: lockDriver
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                <option value="">
                  Select Driver
                </option>

                {drivers.map((d) => (
                  <option
                    key={d.id}
                    value={d.id}
                  >
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Vehicle">
              <select
                value={form.vehicleId}
                onChange={(e) =>
                  update(
                    "vehicleId",
                    e.target.value
                  )
                }
                style={input}
              >
                <option value="">
                  Select Vehicle
                </option>

                {vehicles.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                  >
                    {v.vehicleNumber}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Shift Start">
              <input
                type="datetime-local"
                style={input}
                value={form.shiftStart}
                onChange={(e) =>
                  update(
                    "shiftStart",
                    e.target.value
                  )
                }
              />
            </Field>

            <Field label="Shift End">
              <input
                type="datetime-local"
                style={input}
                value={form.shiftEnd}
                onChange={(e) =>
                  update(
                    "shiftEnd",
                    e.target.value
                  )
                }
              />
            </Field>

            <Field label="Trips">
              <input
                type="number"
                style={input}
                value={form.totalTrips}
                onChange={(e) =>
                  update(
                    "totalTrips",
                    Number(e.target.value)
                  )
                }
              />
            </Field>

            <Field label="Helpers">
              <input
                type="number"
                style={input}
                value={form.totalHelpers}
                onChange={(e) =>
                  update(
                    "totalHelpers",
                    Number(e.target.value)
                  )
                }
              />
            </Field>

            <Field label="Fuel Used">
              <input
                type="number"
                style={input}
                value={form.fuelUsed}
                onChange={(e) =>
                  update(
                    "fuelUsed",
                    Number(e.target.value)
                  )
                }
              />
            </Field>

            <Field label="Distance">
              <input
                type="number"
                style={input}
                value={form.totalDistance}
                onChange={(e) =>
                  update(
                    "totalDistance",
                    Number(e.target.value)
                  )
                }
              />
            </Field>

            <Field label="Overtime">
              <input
                type="number"
                style={input}
                value={form.overtimeHours}
                onChange={(e) =>
                  update(
                    "overtimeHours",
                    Number(e.target.value)
                  )
                }
              />
            </Field>

            <Field label="Route">
              <select
                style={input}
                value={form.routeCategory}
                onChange={(e) =>
                  update(
                    "routeCategory",
                    e.target.value
                  )
                }
              >
                <option value="Factory">
                  Factory
                </option>

                <option value="Residential">
                  Residential
                </option>

                <option value="Mall">
                  Mall
                </option>

                <option value="Warehouse">
                  Warehouse
                </option>
              </select>
            </Field>

            <Field label="Status">
              <select
                style={input}
                value={form.status}
                onChange={(e) =>
                  update(
                    "status",
                    e.target.value
                  )
                }
              >
                <option value="WORKING">
                  WORKING
                </option>

                <option value="COMPLETED">
                  COMPLETED
                </option>

                <option value="OFF">
                  OFF
                </option>

                <option value="ON_LEAVE">
                  ON_LEAVE
                </option>

                <option value="CANCELLED">
                  CANCELLED
                </option>
              </select>
            </Field>

            <Field label="Remarks">
              <textarea
                rows={3}
                style={textarea}
                value={form.remarks}
                onChange={(e) =>
                  update(
                    "remarks",
                    e.target.value
                  )
                }
              />
            </Field>
          </div>
        </section>

        <div style={footer}>
          <button
            style={cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>

          <button
            style={{
              ...saveBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={submit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isEdit
              ? "Update Shift"
              : "Create Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div style={field}>
      <div style={fieldLabel}>
        {label}
      </div>

      {children}
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modal = {
  width: "95%",
  maxWidth: 1150,
  borderRadius: 24,
  padding: 24,
  background:
    "linear-gradient(180deg,#020617,#0f172a)",
  border:
    "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "0 20px 60px rgba(0,0,0,0.45)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 22,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 900,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  cursor: "pointer",
};

const historySection = {
  borderRadius: 20,
  padding: 18,
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.08)",
  marginBottom: 20,
};

const createSection = {
  borderRadius: 20,
  padding: 18,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
};

const sectionTitle = {
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
};

const sectionSub = {
  color: "#94a3b8",
  fontSize: 13,
  marginTop: 4,
};

const dateFilterRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const dateLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const dateInput = {
  height: 36,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
};

const clearDateBtn = {
  height: 36,
  alignSelf: "flex-end",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  fontWeight: 800,
  padding: "0 12px",
  cursor: "pointer",
};

const historyTable = {
  borderRadius: 16,
  overflow: "hidden",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const historyHead = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr .6fr 1fr .9fr",
  padding: 13,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 800,
  fontSize: 13,
};

const historyRow = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr .6fr 1fr .9fr",
  padding: 13,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
  alignItems: "center",
  fontSize: 13,
};

const historyEmpty = {
  padding: 24,
  color: "#94a3b8",
  textAlign: "center",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
};

const historyPagination = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 14,
};

const historyCount = {
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 700,
};

const historyDateText = {
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const historyTimeText = {
  color: "#94a3b8",
  fontSize: 11,
  marginTop: 4,
};

const historyPagerRight = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const pageSizeSelect = {
  height: 32,
  borderRadius: 10,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 8px",
};

const pagerBtn = {
  minWidth: 92,
  height: 32,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "linear-gradient(180deg,#1e293b,#0f172a)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
};

const pageBadge = {
  height: 32,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  borderRadius: 12,
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.06)",
  color: "#cbd5e1",
  fontSize: 11,
  fontWeight: 800,
};

const pageNoBlue = {
  color: "#60a5fa",
  marginLeft: 4,
  marginRight: 4,
};

const historyStatus = (value) => ({
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  background:
    value === "WORKING"
      ? "rgba(34,197,94,.14)"
      : value === "COMPLETED"
      ? "rgba(59,130,246,.14)"
      : value === "CANCELLED"
      ? "rgba(239,68,68,.14)"
      : "rgba(251,191,36,.14)",
  color:
    value === "WORKING"
      ? "#4ade80"
      : value === "COMPLETED"
      ? "#60a5fa"
      : value === "CANCELLED"
      ? "#f87171"
      : "#fbbf24",
});

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0,1fr))",
  gap: 18,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldLabel = {
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 700,
};

const input = {
  height: 46,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 14px",
  outline: "none",
};

const textarea = {
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: 14,
  outline: "none",
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
};

const cancelBtn = {
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#1e293b",
  color: "#fff",
  cursor: "pointer",
};

const historyLateRow = {
  background:
    "linear-gradient(90deg,rgba(245,158,11,.12),rgba(15,23,42,0))",
  borderLeft:
    "3px solid #f59e0b",
};

const historyLateTimeText = {
  color: "#fbbf24",
  fontWeight: 800,
};

const historyLateBadge = {
  display: "inline-flex",
  marginTop: 6,
  padding: "4px 8px",
  borderRadius: 999,
  background:
    "rgba(245,158,11,.16)",
  color: "#fbbf24",
  border:
    "1px solid rgba(245,158,11,.28)",
  fontSize: 10,
  fontWeight: 900,
};

const saveBtn = {
  height: 44,
  padding: "0 22px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 700,
};

export default LogisticsShiftModal;