import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDrivers,
  fetchShifts,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  calculateShiftHours,
  formatShiftDate,
  getShiftDateKey,
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

const normalizeStatus = (status) =>
  String(status || "WORKING")
    .trim()
    .toUpperCase();

const numberValue = (value) =>
  Number(value || 0);

const round = (value) =>
  Math.round(numberValue(value) * 100) / 100;

function ShiftReports({
  showAlert = () => {},
}) {
  const [loading, setLoading] =
    useState(true);

  const [drivers, setDrivers] =
    useState([]);

  const [shifts, setShifts] =
    useState([]);

  const [reportMode, setReportMode] =
    useState("DRIVER");

  const [driverId, setDriverId] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

	useEffect(() => {
	  let active = true;

	  Promise.all([
	    fetchDrivers(),
	    fetchShifts(),
	  ])
	    .then(([driverData, shiftData]) => {
	      if (!active) return;

	      setDrivers(driverData || []);
	      setShifts(shiftData || []);
	    })
	    .catch((e) => {
	      if (!active) return;

	      console.error(e);

	      showAlert(
	        getBackendMessage(
	          e,
	          "Failed to load shift reports"
	        ),
	        "error"
	      );
	    })
	    .finally(() => {
	      if (!active) return;

	      setLoading(false);
	    });

	  return () => {
	    active = false;
	  };
	}, [showAlert]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const dateKey =
        getShiftDateKey(shift);

      const shiftDriverId =
        shift.driver?.id ||
        shift.driverId ||
        "";

      if (
        driverId &&
        String(shiftDriverId) !==
          String(driverId)
      ) {
        return false;
      }

      if (
        fromDate &&
        dateKey < fromDate
      ) {
        return false;
      }

      if (
        toDate &&
        dateKey > toDate
      ) {
        return false;
      }

      return true;
    });
  }, [
    shifts,
    driverId,
    fromDate,
    toDate,
  ]);

  const summary = useMemo(() => {
    return filteredShifts.reduce(
      (acc, shift) => {
        const status =
          normalizeStatus(shift.status);

        acc.totalShifts += 1;
        acc.totalTrips += numberValue(
          shift.totalTrips
        );
        acc.totalLoaders += numberValue(
          shift.totalLoaders ??
            shift.totalHelpers
        );
        acc.totalDistance += numberValue(
          shift.totalDistance
        );
        acc.totalFuel += numberValue(
          shift.fuelUsed
        );
        acc.totalHours +=
          numberValue(
            shift.totalWorkingHours
          ) ||
          calculateShiftHours(shift);

        if (isShiftOverSixPm(shift)) {
          acc.overShiftCount += 1;
        }

        acc.statusCount[status] =
          (acc.statusCount[status] || 0) +
          1;

        return acc;
      },
      {
        totalShifts: 0,
        totalTrips: 0,
        totalLoaders: 0,
        totalDistance: 0,
        totalFuel: 0,
        totalHours: 0,
        overShiftCount: 0,
        statusCount: {},
      }
    );
  }, [filteredShifts]);

  const driverWiseRows = useMemo(() => {
    const map = new Map();

    filteredShifts.forEach((shift) => {
      const id =
        shift.driver?.id ||
        shift.driverId ||
        "unknown";

      const name =
        shift.driver?.name ||
        "Unknown Driver";

      const current =
        map.get(id) || {
          key: id,
          label: name,
          totalShifts: 0,
          totalTrips: 0,
          totalLoaders: 0,
          totalDistance: 0,
          totalFuel: 0,
          totalHours: 0,
          overShiftCount: 0,
          completed: 0,
          cancelled: 0,
          active: 0,
        };

      const status =
        normalizeStatus(shift.status);

      current.totalShifts += 1;
      current.totalTrips += numberValue(
        shift.totalTrips
      );
      current.totalLoaders += numberValue(
        shift.totalLoaders ??
          shift.totalHelpers
      );
      current.totalDistance += numberValue(
        shift.totalDistance
      );
      current.totalFuel += numberValue(
        shift.fuelUsed
      );
      current.totalHours +=
        numberValue(
          shift.totalWorkingHours
        ) ||
        calculateShiftHours(shift);

      if (isShiftOverSixPm(shift)) {
        current.overShiftCount += 1;
      }

      if (status === "COMPLETED") {
        current.completed += 1;
      } else if (status === "CANCELLED") {
        current.cancelled += 1;
      } else {
        current.active += 1;
      }

      map.set(id, current);
    });

    return Array.from(map.values());
  }, [filteredShifts]);

  const dateWiseRows = useMemo(() => {
    const map = new Map();

    filteredShifts.forEach((shift) => {
      const key = getShiftDateKey(shift);

      const current =
        map.get(key) || {
          key,
          label: formatShiftDate(shift),
          totalShifts: 0,
          totalTrips: 0,
          totalLoaders: 0,
          totalDistance: 0,
          totalFuel: 0,
          totalHours: 0,
          overShiftCount: 0,
          completed: 0,
          cancelled: 0,
          active: 0,
          drivers: new Set(),
        };

      const status =
        normalizeStatus(shift.status);

      current.totalShifts += 1;
      current.totalTrips += numberValue(
        shift.totalTrips
      );
      current.totalLoaders += numberValue(
        shift.totalLoaders ??
          shift.totalHelpers
      );
      current.totalDistance += numberValue(
        shift.totalDistance
      );
      current.totalFuel += numberValue(
        shift.fuelUsed
      );
      current.totalHours +=
        numberValue(
          shift.totalWorkingHours
        ) ||
        calculateShiftHours(shift);

      current.drivers.add(
        shift.driver?.name ||
          shift.driverId ||
          "Unknown"
      );

      if (isShiftOverSixPm(shift)) {
        current.overShiftCount += 1;
      }

      if (status === "COMPLETED") {
        current.completed += 1;
      } else if (status === "CANCELLED") {
        current.cancelled += 1;
      } else {
        current.active += 1;
      }

      map.set(key, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        driverCount: row.drivers.size,
      }))
      .sort((a, b) =>
        b.key.localeCompare(a.key)
      );
  }, [filteredShifts]);

  const rows =
    reportMode === "DRIVER"
      ? driverWiseRows
      : dateWiseRows;

  const clearFilters = () => {
    setDriverId("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Shift Reports
          </div>

          <div style={subtitle}>
            Driver-wise and date-wise shift performance reporting
          </div>
        </div>

        <div style={shiftBadge}>
          General Shift: 09:00 AM - 06:00 PM
        </div>
      </div>

      <div style={filters}>
        <select
          value={reportMode}
          onChange={(e) =>
            setReportMode(e.target.value)
          }
          style={input}
        >
          <option value="DRIVER">
            Driver Wise
          </option>

          <option value="DATE">
            Date Wise
          </option>
        </select>

        <select
          value={driverId}
          onChange={(e) =>
            setDriverId(e.target.value)
          }
          style={input}
        >
          <option value="">
            All Drivers
          </option>

          {drivers.map((driver) => (
            <option
              key={driver.id}
              value={driver.id}
            >
              {driver.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) =>
            setFromDate(e.target.value)
          }
          style={input}
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) =>
            setToDate(e.target.value)
          }
          style={input}
        />

        <button
          style={clearBtn}
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      <div style={summaryGrid}>
        <SummaryCard
          label="Total Shifts"
          value={summary.totalShifts}
        />

        <SummaryCard
          label="Total Trips"
          value={summary.totalTrips}
        />

        <SummaryCard
          label="Helpers / Loaders"
          value={summary.totalLoaders}
        />

        <SummaryCard
          label="Total Hours"
          value={round(summary.totalHours)}
        />

        <SummaryCard
          label="Over Shift"
          value={summary.overShiftCount}
          warning
        />

        <SummaryCard
          label="Completed"
          value={
            summary.statusCount.COMPLETED || 0
          }
        />
      </div>

      <div style={table}>
	  <div style={head}>
	    <div>
	      {reportMode === "DRIVER"
	        ? "Driver"
	        : "Date"}
	    </div>

	    <div>
	      {reportMode === "DATE"
	        ? "Drivers"
	        : "Driver ID"}
	    </div>

	    <div>Shifts</div>
	    <div>Trips</div>
	    <div>Helpers</div>
	    <div>Hours</div>
	    <div>Distance</div>
	    <div>Fuel</div>
	    <div>Over Shift</div>
	    <div>Completed</div>
	    <div>Active</div>
	    <div>Cancelled</div>
	  </div>

        {loading && (
          <div style={emptyRow}>
            Loading reports...
          </div>
        )}

        {!loading &&
          rows.length === 0 && (
            <div style={emptyRow}>
              No report data found
            </div>
          )}

        {!loading &&
          rows.map((row) => (
            <div
              key={row.key}
              style={bodyRow}
            >
			<div style={nameCell}>
			  {row.label}
			</div>

			<div>
			  {reportMode === "DATE"
			    ? row.driverCount
			    : "-"}
			</div>

              <div>{row.totalShifts}</div>
              <div>{row.totalTrips}</div>
              <div>{row.totalLoaders}</div>
              <div>{round(row.totalHours)}</div>
              <div>{round(row.totalDistance)}</div>
              <div>{round(row.totalFuel)}</div>

              <div>
                <span
                  style={
                    row.overShiftCount > 0
                      ? warningPill
                      : neutralPill
                  }
                >
                  {row.overShiftCount}
                </span>
              </div>

              <div>{row.completed}</div>
              <div>{row.active}</div>
              <div>{row.cancelled}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
}) {
  return (
    <div style={summaryCard}>
      <div style={summaryLabel}>
        {label}
      </div>

      <div
        style={{
          ...summaryValue,
          color: warning
            ? "#fbbf24"
            : "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
};

const shiftBadge = {
  padding: "9px 13px",
  borderRadius: 999,
  background:
    "rgba(59,130,246,.14)",
  color: "#60a5fa",
  fontSize: 12,
  fontWeight: 900,
  border:
    "1px solid rgba(59,130,246,.25)",
};

const filters = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
  padding: 12,
  borderRadius: 16,
  background:
    "rgba(255,255,255,0.035)",
  border:
    "1px solid rgba(255,255,255,0.06)",
};

const input = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
  fontWeight: 700,
};

const clearBtn = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(6, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const summaryCard = {
  borderRadius: 18,
  padding: 16,
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const summaryLabel = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
};

const summaryValue = {
  marginTop: 8,
  color: "#fff",
  fontSize: 24,
  fontWeight: 900,
};

const table = {
  borderRadius: 18,
  overflowX: "auto",
  border:
    "1px solid rgba(255,255,255,0.06)",
};

const head = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr .65fr .65fr .65fr .65fr .75fr .75fr .75fr .75fr .75fr .75fr .75fr",
  minWidth: 1100,
  padding: 14,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 800,
  fontSize: 12,
};

const bodyRow = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr .65fr .65fr .65fr .65fr .75fr .75fr .75fr .75fr .75fr .75fr .75fr",
  minWidth: 1100,
  padding: 14,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
  fontSize: 13,
};

const nameCell = {
  color: "#fff",
  fontWeight: 900,
};

const warningPill = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background:
    "rgba(245,158,11,.16)",
  color: "#fbbf24",
  border:
    "1px solid rgba(245,158,11,.28)",
  fontWeight: 900,
};

const neutralPill = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background:
    "rgba(148,163,184,.12)",
  color: "#cbd5e1",
  border:
    "1px solid rgba(148,163,184,.18)",
  fontWeight: 900,
};

const emptyRow = {
  minWidth: 1100,
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
};

export default ShiftReports;