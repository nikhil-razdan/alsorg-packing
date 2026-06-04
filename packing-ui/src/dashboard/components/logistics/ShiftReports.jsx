import {
  useEffect,
  useMemo,
  useState,
} from "react";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import {
  fetchDrivers,
  fetchShifts,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  formatShiftDate,
  formatShiftTimeRange,
  getSafeShiftHours,
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

const safeDivide = (a, b) =>
  b ? a / b : 0;

const formatPercent = (value) =>
  `${Math.round(value * 100)}%`;

const getExcelDateTime = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "-";
  }
};

const styleTitleRow = (worksheet, title) => {
  worksheet.mergeCells("A1:L1");

  const cell = worksheet.getCell("A1");

  cell.value = title;
  cell.font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  cell.alignment = {
    vertical: "middle",
  };

  worksheet.getRow(1).height = 28;
};

const styleHeaderRow = (row) => {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    cell.border = {
      top: {
        style: "thin",
        color: { argb: "FFCBD5E1" },
      },
      left: {
        style: "thin",
        color: { argb: "FFCBD5E1" },
      },
      bottom: {
        style: "thin",
        color: { argb: "FFCBD5E1" },
      },
      right: {
        style: "thin",
        color: { argb: "FFCBD5E1" },
      },
    };
  });
};

const autoFitColumns = (worksheet) => {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;

    column.eachCell(
      { includeEmpty: true },
      (cell) => {
        const value =
          cell.value == null
            ? ""
            : String(cell.value);

        maxLength = Math.max(
          maxLength,
          value.length + 2
        );
      }
    );

    column.width = Math.min(
      Math.max(maxLength, 12),
      32
    );
  });
};

const styleWorksheet = (worksheet) => {
  worksheet.views = [
    {
      state: "frozen",
      ySplit: 2,
    },
  ];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;

    row.eachCell((cell) => {
      cell.border = {
        top: {
          style: "thin",
          color: { argb: "FFE2E8F0" },
        },
        left: {
          style: "thin",
          color: { argb: "FFE2E8F0" },
        },
        bottom: {
          style: "thin",
          color: { argb: "FFE2E8F0" },
        },
        right: {
          style: "thin",
          color: { argb: "FFE2E8F0" },
        },
      };
    });
  });

  autoFitColumns(worksheet);
};

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
		  getSafeShiftHours(shift);

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
	    getSafeShiftHours(shift);

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
	    getSafeShiftHours(shift);

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
  
  const downloadExcelReport = async () => {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "ALSORG Logistics Portal";
    workbook.created = new Date();

    const completed =
      summary.statusCount.COMPLETED || 0;

    const cancelled =
      summary.statusCount.CANCELLED || 0;

    const active =
      summary.totalShifts -
      completed -
      cancelled;

    const completionRate = safeDivide(
      completed,
      summary.totalShifts
    );

    const overShiftRate = safeDivide(
      summary.overShiftCount,
      summary.totalShifts
    );

    const avgTrips = safeDivide(
      summary.totalTrips,
      summary.totalShifts
    );

    const avgHours = safeDivide(
      summary.totalHours,
      summary.totalShifts
    );

    const avgFuel = safeDivide(
      summary.totalFuel,
      summary.totalShifts
    );

    const avgDistance = safeDivide(
      summary.totalDistance,
      summary.totalShifts
    );

    const topTripDriver =
      [...driverWiseRows].sort(
        (a, b) =>
          b.totalTrips - a.totalTrips
      )[0];

    const topOverShiftDriver =
      [...driverWiseRows].sort(
        (a, b) =>
          b.overShiftCount -
          a.overShiftCount
      )[0];

    const busiestDate =
      [...dateWiseRows].sort(
        (a, b) =>
          b.totalShifts - a.totalShifts
      )[0];

    const topTripDate =
      [...dateWiseRows].sort(
        (a, b) =>
          b.totalTrips - a.totalTrips
      )[0];

    /*
    ========================================
    KPI SUMMARY SHEET
    ========================================
    */

    const kpiSheet =
      workbook.addWorksheet("KPI Summary");

    styleTitleRow(
      kpiSheet,
      "Logistics Shift KPI Summary"
    );

    kpiSheet.addRow([]);

    const kpiHeader = kpiSheet.addRow([
      "KPI",
      "Value",
      "Insight",
    ]);

    styleHeaderRow(kpiHeader);

    const kpiRows = [
      [
        "Total Shifts",
        summary.totalShifts,
        "Total shifts in selected filters",
      ],
      [
        "Total Trips",
        summary.totalTrips,
        "Total completed/active trip count",
      ],
      [
        "Helpers / Loaders",
        summary.totalLoaders,
        "Total manpower used in shifts",
      ],
      [
        "Total Hours",
        round(summary.totalHours),
        "Safe hours calculation; negative values ignored",
      ],
      [
        "Over Shift Count",
        summary.overShiftCount,
        "Shifts ending after 06:00 PM",
      ],
      [
        "Completed",
        completed,
        "Completed shift count",
      ],
      [
        "Active",
        active,
        "Working / Off / On Leave shifts",
      ],
      [
        "Cancelled",
        cancelled,
        "Cancelled shift count",
      ],
      [
        "Completion Rate",
        formatPercent(completionRate),
        "Completed shifts divided by total shifts",
      ],
      [
        "Over Shift Rate",
        formatPercent(overShiftRate),
        "Over-shift shifts divided by total shifts",
      ],
      [
        "Average Trips / Shift",
        round(avgTrips),
        "Trip productivity indicator",
      ],
      [
        "Average Hours / Shift",
        round(avgHours),
        "Average working duration",
      ],
      [
        "Average Fuel / Shift",
        round(avgFuel),
        "Fuel usage trend",
      ],
      [
        "Average Distance / Shift",
        round(avgDistance),
        "Average route distance",
      ],
    ];

    kpiRows.forEach((row) =>
      kpiSheet.addRow(row)
    );

    styleWorksheet(kpiSheet);

    /*
    ========================================
    DRIVER WISE SHEET
    ========================================
    */

    const driverSheet =
      workbook.addWorksheet("Driver Wise");

    styleTitleRow(
      driverSheet,
      "Driver Wise Shift Report"
    );

    driverSheet.addRow([]);

    const driverHeader = driverSheet.addRow([
      "Driver",
      "Total Shifts",
      "Trips",
      "Helpers",
      "Hours",
      "Distance",
      "Fuel",
      "Over Shift",
      "Completed",
      "Active",
      "Cancelled",
      "Trips / Shift",
    ]);

    styleHeaderRow(driverHeader);

    driverWiseRows.forEach((row) => {
      const excelRow = driverSheet.addRow([
        row.label,
        row.totalShifts,
        row.totalTrips,
        row.totalLoaders,
        round(row.totalHours),
        round(row.totalDistance),
        round(row.totalFuel),
        row.overShiftCount,
        row.completed,
        row.active,
        row.cancelled,
        round(
          safeDivide(
            row.totalTrips,
            row.totalShifts
          )
        ),
      ]);

      if (row.overShiftCount > 0) {
        excelRow.getCell(8).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF3CD" },
        };
      }
    });

    styleWorksheet(driverSheet);

    /*
    ========================================
    DATE WISE SHEET
    ========================================
    */

    const dateSheet =
      workbook.addWorksheet("Date Wise");

    styleTitleRow(
      dateSheet,
      "Date Wise Shift Report"
    );

    dateSheet.addRow([]);

    const dateHeader = dateSheet.addRow([
      "Date",
      "Drivers",
      "Total Shifts",
      "Trips",
      "Helpers",
      "Hours",
      "Distance",
      "Fuel",
      "Over Shift",
      "Completed",
      "Active",
      "Cancelled",
    ]);

    styleHeaderRow(dateHeader);

    dateWiseRows.forEach((row) => {
      const excelRow = dateSheet.addRow([
        row.label,
        row.driverCount,
        row.totalShifts,
        row.totalTrips,
        row.totalLoaders,
        round(row.totalHours),
        round(row.totalDistance),
        round(row.totalFuel),
        row.overShiftCount,
        row.completed,
        row.active,
        row.cancelled,
      ]);

      if (row.overShiftCount > 0) {
        excelRow.getCell(9).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF3CD" },
        };
      }
    });

    styleWorksheet(dateSheet);

    /*
    ========================================
    RAW SHIFT DATA SHEET
    ========================================
    */

    const rawSheet =
      workbook.addWorksheet("Raw Shift Data");

    styleTitleRow(
      rawSheet,
      "Raw Shift Data"
    );

    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow([
      "Driver",
      "Vehicle",
      "Date",
      "Time Range",
      "Shift Start",
      "Shift End",
      "Safe Hours",
      "Trips",
      "Helpers",
      "Distance",
      "Fuel",
      "Route",
      "Status",
      "Over Shift",
      "Remarks",
    ]);

    styleHeaderRow(rawHeader);

    filteredShifts.forEach((shift) => {
      const overShift =
        isShiftOverSixPm(shift);

      const excelRow = rawSheet.addRow([
        shift.driver?.name || "-",
        shift.vehicle?.vehicleNumber || "-",
        formatShiftDate(shift),
        formatShiftTimeRange(shift),
        getExcelDateTime(shift.shiftStart),
        getExcelDateTime(shift.shiftEnd),
        round(getSafeShiftHours(shift)),
        numberValue(shift.totalTrips),
        numberValue(
          shift.totalLoaders ??
            shift.totalHelpers
        ),
        numberValue(shift.totalDistance),
        numberValue(shift.fuelUsed),
        shift.routeCategory || "-",
        normalizeStatus(shift.status),
        overShift ? "YES" : "NO",
        shift.remarks || "",
      ]);

      if (overShift) {
        excelRow.getCell(14).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF3CD" },
        };
      }
    });

    styleWorksheet(rawSheet);

    /*
    ========================================
    INSIGHTS SHEET
    ========================================
    */

    const insightSheet =
      workbook.addWorksheet("Insights");

    styleTitleRow(
      insightSheet,
      "Logistics Insights"
    );

    insightSheet.addRow([]);

    const insightHeader =
      insightSheet.addRow([
        "Insight",
        "Value",
        "Recommendation",
      ]);

    styleHeaderRow(insightHeader);

    const insightRows = [
      [
        "Top Driver by Trips",
        topTripDriver
          ? `${topTripDriver.label} - ${topTripDriver.totalTrips} trips`
          : "-",
        "Use this driver as benchmark for route productivity.",
      ],
      [
        "Highest Over Shift Driver",
        topOverShiftDriver
          ? `${topOverShiftDriver.label} - ${topOverShiftDriver.overShiftCount} over-shifts`
          : "-",
        "Review route allocation, waiting time, or vehicle delay for this driver.",
      ],
      [
        "Busiest Date",
        busiestDate
          ? `${busiestDate.label} - ${busiestDate.totalShifts} shifts`
          : "-",
        "Check whether manpower and vehicles were planned correctly on this date.",
      ],
      [
        "Highest Trip Date",
        topTripDate
          ? `${topTripDate.label} - ${topTripDate.totalTrips} trips`
          : "-",
        "Study route pattern and repeat efficient planning.",
      ],
      [
        "Completion Rate",
        formatPercent(completionRate),
        completionRate >= 0.8
          ? "Completion rate is healthy."
          : "Completion rate needs attention.",
      ],
      [
        "Over Shift Rate",
        formatPercent(overShiftRate),
        overShiftRate > 0.2
          ? "High over-shift rate. Review dispatch timings and route planning."
          : "Over-shift rate is under control.",
      ],
      [
        "Average Trips per Shift",
        round(avgTrips),
        "Track this weekly to improve driver productivity.",
      ],
      [
        "Average Hours per Shift",
        round(avgHours),
        "Compare this with standard 9-hour shift window.",
      ],
    ];

    insightRows.forEach((row) =>
      insightSheet.addRow(row)
    );

    styleWorksheet(insightSheet);

    const buffer =
      await workbook.xlsx.writeBuffer();

    const fileName = `Logistics_Shift_Report_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    saveAs(
      new Blob([buffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName
    );
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
		
		<button
		  style={downloadBtn}
		  onClick={downloadExcelReport}
		  disabled={loading}
		>
		  Download Excel Report
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

const downloadBtn = {
  height: 38,
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#16a34a,#22c55e)",
  color: "#fff",
  padding: "0 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyRow = {
  minWidth: 1100,
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
};

export default ShiftReports;