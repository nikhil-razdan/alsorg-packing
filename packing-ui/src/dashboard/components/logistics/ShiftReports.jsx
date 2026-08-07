import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDrivers,
  fetchVehicles,
  fetchShifts,
  fetchDispatchChallans,
  fetchLogisticsTrips,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  formatVehicleDate,
  getVehicleAgeFromRegistration,
  getVehicleCompliance,
} from "./vehicleComplianceUtils";

const SOURCE = Object.freeze({
  CHALLAN: "CHALLAN",
  MANUAL: "MANUAL",
  LEGACY_TRIP: "LEGACY_TRIP",
});

const REPORT_MODES = [
  { value: "OVERVIEW", label: "Management Overview" },
  { value: "DRIVER", label: "Driver Wise" },
  { value: "VEHICLE", label: "Vehicle Wise" },
  { value: "TRIP", label: "Trip / Challan Register" },
  { value: "MANUAL", label: "Manual / Legacy Operations" },
  { value: "COMPLIANCE", label: "Fleet Compliance" },
];

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) =>
  Math.round(safeNumber(value) * 100) / 100;

function parseBusinessDateTime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getTime());
  }

  const raw = String(value)
    .trim()
    .replace(" ", "T");

  if (!raw) return null;

  const hasTimezone =
    /[zZ]$/.test(raw) ||
    /[+-]\d{2}:?\d{2}$/.test(raw);

  if (hasTimezone) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
  );

  if (match) {
    const milliseconds = Number(
      String(match[7] || "0")
        .slice(0, 3)
        .padEnd(3, "0")
    );

    const parsed = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
      milliseconds
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime())
    ? null
    : fallback;
}

function formatDateTime(value) {
  const date = parseBusinessDateTime(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getDateKey(value) {
  const date = parseBusinessDateTime(value);
  if (!date) return "";

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function durationMinutes(startValue, endValue, explicit) {
  const explicitNumber = Number(explicit);

  if (
    Number.isFinite(explicitNumber) &&
    explicitNumber > 0
  ) {
    return explicitNumber;
  }

  const start = parseBusinessDateTime(startValue);
  const end = parseBusinessDateTime(endValue);

  if (!start || !end) return 0;

  return Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) /
      60000
    )
  );
}

function formatDuration(minutes) {
  const total = safeNumber(minutes);
  if (total <= 0) return "—";

  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);

  if (hours <= 0) return `${mins} min`;
  if (mins <= 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function getChallanStatus(challan) {
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
}

function getRecordStatusBucket(status) {
  const value = normalizeText(status);

  if (
    [
      "RUNNING",
      "WORKING",
      "OUT_FOR_DELIVERY",
      "ACTIVE",
    ].includes(value)
  ) {
    return "ACTIVE";
  }

  if (
    [
      "COMPLETED",
      "ENDED",
      "DELIVERED",
    ].includes(value)
  ) {
    return "COMPLETED";
  }

  if (value === "CANCELLED") {
    return "CANCELLED";
  }

  return "OTHER";
}

function buildUnifiedRecords({
  challans,
  shifts,
  legacyTrips,
}) {
  const records = [];
  const currentChallanNumbers = new Set();

  challans.forEach((challan, index) => {
    const challanNumber = String(
      challan?.challanNumber || ""
    ).trim();

    if (challanNumber) {
      currentChallanNumbers.add(
        normalizeText(challanNumber)
      );
    }

    const startAt =
      challan?.tripStartedAt ||
      challan?.dispatchedAt ||
      challan?.generatedAt ||
      challan?.createdAt ||
      null;

    const items = Array.isArray(
      challan?.items
    )
      ? challan.items
      : [];

    records.push({
      key: `CHALLAN:${challanNumber || index}`,
      source: SOURCE.CHALLAN,
      sourceLabel: "Dispatch Challan",
      challanNumber: challanNumber || "—",
      driverId:
        challan?.driverId ||
        challan?.driver?.id ||
        "",
      driverName:
        challan?.driverName ||
        challan?.driver?.name ||
        "Unknown Driver",
      vehicleId:
        challan?.vehicleId ||
        challan?.vehicle?.id ||
        "",
      vehicleNumber:
        challan?.vehicleNumber ||
        challan?.vehicle?.vehicleNumber ||
        "Unknown Vehicle",
      startAt,
      endAt: challan?.tripEndedAt || null,
      status: getChallanStatus(challan),
      statusBucket: getRecordStatusBucket(
        getChallanStatus(challan)
      ),
      items:
        safeNumber(challan?.totalItems) ||
        items.length,
      trips: 1,
      helpers: safeNumber(
        challan?.helperLoaderCount
      ),
      distance: 0,
      fuel: 0,
      overtime: 0,
      route: "Dispatch Challan",
      remarks: "",
      durationMinutes: durationMinutes(
        startAt,
        challan?.tripEndedAt,
        challan?.tripDurationMinutes
      ),
      rawItems: items,
      raw: challan,
    });
  });

  shifts.forEach((shift, index) => {
    const startAt =
      shift?.shiftStart ||
      shift?.date ||
      shift?.createdAt ||
      null;

    const endAt = shift?.shiftEnd || null;
    const status = normalizeText(
      shift?.status || "WORKING"
    );

    records.push({
      key: `MANUAL:${shift?.id || index}`,
      source: SOURCE.MANUAL,
      sourceLabel: "Manual / Legacy Shift",
      challanNumber:
        shift?.referenceNo ||
        shift?.tripNo ||
        "Manual Operation",
      driverId:
        shift?.driver?.id ||
        shift?.driverId ||
        "",
      driverName:
        shift?.driver?.name ||
        shift?.driverName ||
        "Unknown Driver",
      vehicleId:
        shift?.vehicle?.id ||
        shift?.vehicleId ||
        "",
      vehicleNumber:
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber ||
        "Unknown Vehicle",
      startAt,
      endAt,
      status,
      statusBucket:
        getRecordStatusBucket(status),
      items: 0,
      trips: safeNumber(
        shift?.totalTrips
      ),
      helpers: safeNumber(
        shift?.totalLoaders ??
        shift?.totalHelpers
      ),
      distance: safeNumber(
        shift?.totalDistance
      ),
      fuel: safeNumber(shift?.fuelUsed),
      overtime: safeNumber(
        shift?.overtimeHours
      ),
      route:
        shift?.routeCategory ||
        "Manual Operation",
      remarks: shift?.remarks || "",
      durationMinutes: durationMinutes(
        startAt,
        endAt
      ),
      rawItems: [],
      raw: shift,
    });
  });

  legacyTrips.forEach((trip, index) => {
    const challanNumber = String(
      trip?.challanNumber || ""
    ).trim();

    if (
      challanNumber &&
      currentChallanNumbers.has(
        normalizeText(challanNumber)
      )
    ) {
      return;
    }

    const startAt =
      trip?.tripStart ||
      trip?.tripStartedAt ||
      trip?.createdAt ||
      null;

    const endAt =
      trip?.tripEnd ||
      trip?.tripEndedAt ||
      trip?.deliveredAt ||
      null;

    const status = normalizeText(
      trip?.status ||
      (endAt ? "DELIVERED" : "OUT_FOR_DELIVERY")
    );

    records.push({
      key: `LEGACY:${trip?.id || challanNumber || index}`,
      source: SOURCE.LEGACY_TRIP,
      sourceLabel: "Legacy Trip",
      challanNumber:
        challanNumber || "Legacy Trip",
      driverId:
        trip?.driver?.id ||
        trip?.driverId ||
        "",
      driverName:
        trip?.driver?.name ||
        trip?.driverName ||
        "Unknown Driver",
      vehicleId:
        trip?.vehicle?.id ||
        trip?.vehicleId ||
        "",
      vehicleNumber:
        trip?.vehicle?.vehicleNumber ||
        trip?.vehicleNumber ||
        "Unknown Vehicle",
      startAt,
      endAt,
      status,
      statusBucket:
        getRecordStatusBucket(status),
      items: safeNumber(trip?.totalItems),
      trips: 1,
      helpers: safeNumber(
        trip?.helperLoaderCount ??
        trip?.totalHelpers
      ),
      distance: safeNumber(
        trip?.totalDistance
      ),
      fuel: safeNumber(trip?.fuelUsed),
      overtime: safeNumber(
        trip?.overtimeHours
      ),
      route:
        trip?.routeCategory ||
        "Legacy Trip",
      remarks:
        trip?.remarks ||
        trip?.deliveryRemarks ||
        "",
      durationMinutes: durationMinutes(
        startAt,
        endAt,
        trip?.tripDurationMinutes
      ),
      rawItems: [],
      raw: trip,
    });
  });

  return records.sort((a, b) => {
    const aTime =
      parseBusinessDateTime(a.startAt)
        ?.getTime() || 0;
    const bTime =
      parseBusinessDateTime(b.startAt)
        ?.getTime() || 0;

    return bTime - aTime;
  });
}

function identityMatches(
  selectedId,
  selectedLabel,
  recordId,
  recordLabel
) {
  if (!selectedId) return true;

  const selectedIdText = String(
    selectedId
  ).trim();
  const recordIdText = String(
    recordId || ""
  ).trim();

  if (
    selectedIdText &&
    recordIdText &&
    selectedIdText === recordIdText
  ) {
    return true;
  }

  return Boolean(
    normalizeText(selectedLabel) &&
    normalizeText(selectedLabel) ===
    normalizeText(recordLabel)
  );
}

function aggregateByIdentity(
  records,
  type
) {
  const map = new Map();
  const driverMode = type === "DRIVER";

  records.forEach((record) => {
    const id = driverMode
      ? record.driverId
      : record.vehicleId;
    const label = driverMode
      ? record.driverName
      : record.vehicleNumber;

    const key = id
      ? `${type}:ID:${id}`
      : `${type}:LABEL:${normalizeText(label)}`;

    if (!normalizeText(label)) return;

    const current = map.get(key) || {
      key,
      label,
      records: 0,
      challans: 0,
      running: 0,
      completed: 0,
      cancelled: 0,
      manualOperations: 0,
      legacyTrips: 0,
      items: 0,
      trips: 0,
      helpers: 0,
      distance: 0,
      fuel: 0,
      overtime: 0,
      totalMinutes: 0,
      durationCount: 0,
      lastActivityAt: null,
    };

    current.records += 1;
    current.items += record.items;
    current.trips += record.trips;
    current.helpers += record.helpers;
    current.distance += record.distance;
    current.fuel += record.fuel;
    current.overtime += record.overtime;

    if (record.source === SOURCE.CHALLAN) {
      current.challans += 1;
    }
    if (record.source === SOURCE.MANUAL) {
      current.manualOperations += 1;
    }
    if (record.source === SOURCE.LEGACY_TRIP) {
      current.legacyTrips += 1;
    }

    if (record.statusBucket === "ACTIVE") {
      current.running += 1;
    } else if (
      record.statusBucket === "COMPLETED"
    ) {
      current.completed += 1;
    } else if (
      record.statusBucket === "CANCELLED"
    ) {
      current.cancelled += 1;
    }

    if (record.durationMinutes > 0) {
      current.totalMinutes +=
        record.durationMinutes;
      current.durationCount += 1;
    }

    const activityAt =
      parseBusinessDateTime(record.startAt);

    if (
      activityAt &&
      (!current.lastActivityAt ||
        activityAt.getTime() >
        current.lastActivityAt.getTime())
    ) {
      current.lastActivityAt = activityAt;
    }

    map.set(key, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      averageDurationMinutes:
        row.durationCount > 0
          ? row.totalMinutes /
          row.durationCount
          : 0,
      completionRate:
        row.records > 0
          ? (row.completed / row.records) * 100
          : 0,
    }))
    .sort((a, b) =>
      b.records - a.records ||
      b.items - a.items ||
      a.label.localeCompare(b.label)
    );
}

function ShiftReports({
  showAlert = () => { },
}) {
  const [loading, setLoading] =
    useState(true);
  const [downloading, setDownloading] =
    useState(false);
  const [loadWarning, setLoadWarning] =
    useState("");

  const [drivers, setDrivers] =
    useState([]);
  const [vehicles, setVehicles] =
    useState([]);
  const [shifts, setShifts] =
    useState([]);
  const [challans, setChallans] =
    useState([]);
  const [legacyTrips, setLegacyTrips] =
    useState([]);

  const [reportMode, setReportMode] =
    useState("OVERVIEW");
  const [driverId, setDriverId] =
    useState("");
  const [vehicleId, setVehicleId] =
    useState("");
  const [sourceFilter, setSourceFilter] =
    useState("ALL");
  const [statusFilter, setStatusFilter] =
    useState("ALL");
  const [fromDate, setFromDate] =
    useState("");
  const [toDate, setToDate] =
    useState("");
  const [search, setSearch] =
    useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setLoadWarning("");

      const results = await Promise.allSettled([
        fetchDrivers(),
        fetchVehicles(),
        fetchShifts(),
        fetchDispatchChallans(),
        fetchLogisticsTrips(),
      ]);

      const [
        driverResult,
        vehicleResult,
        shiftResult,
        challanResult,
        legacyTripResult,
      ] = results;

      const failed = [];

      if (driverResult.status === "fulfilled") {
        setDrivers(
          Array.isArray(driverResult.value)
            ? driverResult.value
            : []
        );
      } else {
        setDrivers([]);
        failed.push("drivers");
      }

      if (vehicleResult.status === "fulfilled") {
        setVehicles(
          Array.isArray(vehicleResult.value)
            ? vehicleResult.value
            : []
        );
      } else {
        setVehicles([]);
        failed.push("vehicles");
      }

      if (shiftResult.status === "fulfilled") {
        setShifts(
          Array.isArray(shiftResult.value)
            ? shiftResult.value
            : []
        );
      } else {
        setShifts([]);
        failed.push("manual operations");
      }

      if (challanResult.status === "fulfilled") {
        setChallans(
          Array.isArray(challanResult.value)
            ? challanResult.value
            : []
        );
      } else {
        setChallans([]);
        failed.push("dispatch challans");
      }

      if (
        legacyTripResult.status === "fulfilled"
      ) {
        setLegacyTrips(
          Array.isArray(legacyTripResult.value)
            ? legacyTripResult.value
            : []
        );
      } else {
        setLegacyTrips([]);
        failed.push("legacy trips");
      }

      if (failed.length > 0) {
        setLoadWarning(
          `Some report sources could not be loaded: ${failed.join(
            ", "
          )}. Available data is still shown.`
        );
      }
    } catch (error) {
      console.error(error);
      showAlert(
        getBackendMessage(
          error,
          "Failed to load logistics reports"
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unifiedRecords = useMemo(
    () =>
      buildUnifiedRecords({
        challans,
        shifts,
        legacyTrips,
      }),
    [challans, shifts, legacyTrips]
  );

  const selectedDriver = useMemo(
    () =>
      drivers.find(
        (driver) =>
          String(driver.id) ===
          String(driverId)
      ) || null,
    [drivers, driverId]
  );

  const selectedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) =>
          String(vehicle.id) ===
          String(vehicleId)
      ) || null,
    [vehicles, vehicleId]
  );

  const filteredRecords = useMemo(() => {
    const query = normalizeText(search);

    return unifiedRecords.filter(
      (record) => {
        if (
          sourceFilter !== "ALL" &&
          record.source !== sourceFilter
        ) {
          return false;
        }

        if (
          statusFilter !== "ALL" &&
          record.statusBucket !==
          statusFilter
        ) {
          return false;
        }

        if (
          !identityMatches(
            driverId,
            selectedDriver?.name,
            record.driverId,
            record.driverName
          )
        ) {
          return false;
        }

        if (
          !identityMatches(
            vehicleId,
            selectedVehicle?.vehicleNumber,
            record.vehicleId,
            record.vehicleNumber
          )
        ) {
          return false;
        }

        const dateKey = getDateKey(
          record.startAt
        );

        if (
          fromDate &&
          (!dateKey || dateKey < fromDate)
        ) {
          return false;
        }

        if (
          toDate &&
          (!dateKey || dateKey > toDate)
        ) {
          return false;
        }

        if (!query) return true;

        const searchable = normalizeText(
          [
            record.sourceLabel,
            record.challanNumber,
            record.driverName,
            record.vehicleNumber,
            record.status,
            record.route,
            record.remarks,
            ...record.rawItems.flatMap(
              (item) => [
                item?.name,
                item?.itemName,
                item?.sku,
                item?.pdNo,
                item?.drawingNo,
                item?.clientName,
                item?.description,
                item?.plantCode,
              ]
            ),
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchable.includes(query);
      }
    );
  }, [
    unifiedRecords,
    sourceFilter,
    statusFilter,
    driverId,
    vehicleId,
    selectedDriver,
    selectedVehicle,
    fromDate,
    toDate,
    search,
  ]);

  const driverRows = useMemo(
    () =>
      aggregateByIdentity(
        filteredRecords,
        "DRIVER"
      ),
    [filteredRecords]
  );

  const vehicleRows = useMemo(
    () =>
      aggregateByIdentity(
        filteredRecords,
        "VEHICLE"
      ),
    [filteredRecords]
  );

  const complianceRows = useMemo(() => {
    const query = normalizeText(search);

    return vehicles
      .filter((vehicle) => {
        if (
          vehicleId &&
          String(vehicle.id) !==
          String(vehicleId)
        ) {
          return false;
        }

        if (!query) return true;

        return normalizeText(
          [
            vehicle?.vehicleNumber,
            vehicle?.driverName,
            vehicle?.ownerName,
            vehicle?.vehicleType,
            vehicle?.status,
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(query);
      })
      .map((vehicle) => ({
        vehicle,
        age: getVehicleAgeFromRegistration(
          vehicle?.registrationDate
        ),
        compliance:
          getVehicleCompliance(vehicle),
      }))
      .sort((a, b) => {
        const rank = {
          DANGER: 3,
          WARNING: 2,
          OK: 1,
        };

        return (
          (rank[b.compliance.severity] || 0) -
          (rank[a.compliance.severity] || 0) ||
          String(
            a.vehicle?.vehicleNumber || ""
          ).localeCompare(
            String(
              b.vehicle?.vehicleNumber || ""
            )
          )
        );
      });
  }, [vehicles, vehicleId, search]);

  const summary = useMemo(() => {
    const result = {
      records: filteredRecords.length,
      challans: 0,
      manual: 0,
      legacy: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      items: 0,
      trips: 0,
      helpers: 0,
      distance: 0,
      fuel: 0,
      durationMinutes: 0,
      durationCount: 0,
      uniqueDrivers: new Set(),
      uniqueVehicles: new Set(),
      fleetAlerts: 0,
    };

    filteredRecords.forEach((record) => {
      if (record.source === SOURCE.CHALLAN) {
        result.challans += 1;
      } else if (
        record.source === SOURCE.MANUAL
      ) {
        result.manual += 1;
      } else if (
        record.source === SOURCE.LEGACY_TRIP
      ) {
        result.legacy += 1;
      }

      if (record.statusBucket === "ACTIVE") {
        result.active += 1;
      } else if (
        record.statusBucket === "COMPLETED"
      ) {
        result.completed += 1;
      } else if (
        record.statusBucket === "CANCELLED"
      ) {
        result.cancelled += 1;
      }

      result.items += record.items;
      result.trips += record.trips;
      result.helpers += record.helpers;
      result.distance += record.distance;
      result.fuel += record.fuel;

      if (record.durationMinutes > 0) {
        result.durationMinutes +=
          record.durationMinutes;
        result.durationCount += 1;
      }

      if (normalizeText(record.driverName)) {
        result.uniqueDrivers.add(
          normalizeText(record.driverName)
        );
      }

      if (normalizeText(record.vehicleNumber)) {
        result.uniqueVehicles.add(
          normalizeText(record.vehicleNumber)
        );
      }
    });

    result.fleetAlerts =
      complianceRows.reduce(
        (sum, row) =>
          sum + row.compliance.alertCount,
        0
      );

    return {
      ...result,
      uniqueDrivers:
        result.uniqueDrivers.size,
      uniqueVehicles:
        result.uniqueVehicles.size,
      averageDurationMinutes:
        result.durationCount > 0
          ? result.durationMinutes /
          result.durationCount
          : 0,
      completionRate:
        result.records > 0
          ? (result.completed /
            result.records) *
          100
          : 0,
    };
  }, [filteredRecords, complianceRows]);

  const manualRecords = useMemo(
    () =>
      filteredRecords.filter(
        (record) =>
          record.source !== SOURCE.CHALLAN
      ),
    [filteredRecords]
  );

  const clearFilters = () => {
    setDriverId("");
    setVehicleId("");
    setSourceFilter("ALL");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
    setSearch("");
  };

  async function downloadExcelReport(
    scope = "FULL"
  ) {
    if (downloading) return;

    try {
      setDownloading(true);

      const [excelModule, saverModule] =
        await Promise.all([
          import("exceljs"),
          import("file-saver"),
        ]);

      const ExcelJS =
        excelModule.default || excelModule;
      const saveAs =
        saverModule.saveAs ||
        saverModule.default;

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "ALSORG Logistics Portal";
      workbook.company = "ALSORG";
      workbook.created = new Date();
      workbook.modified = new Date();

      const filterDescription = [
        driverId
          ? `Driver: ${selectedDriver?.name || driverId}`
          : "All Drivers",
        vehicleId
          ? `Vehicle: ${selectedVehicle?.vehicleNumber || vehicleId}`
          : "All Vehicles",
        sourceFilter === "ALL"
          ? "All Sources"
          : sourceFilter,
        statusFilter === "ALL"
          ? "All Statuses"
          : statusFilter,
        fromDate || toDate
          ? `${fromDate || "Start"} to ${toDate || "Today"}`
          : "All Dates",
        search
          ? `Search: ${search}`
          : "",
      ]
        .filter(Boolean)
        .join(" • ");

      function addTitle(
        sheet,
        title,
        columnCount,
        subtitle
      ) {
        const lastColumn =
          sheet.getColumn(columnCount).letter;

        sheet.mergeCells(
          `A1:${lastColumn}1`
        );
        sheet.mergeCells(
          `A2:${lastColumn}2`
        );
        sheet.mergeCells(
          `A3:${lastColumn}3`
        );

        const titleCell = sheet.getCell("A1");
        titleCell.value = title;
        titleCell.font = {
          bold: true,
          size: 18,
          color: { argb: "FFFFFFFF" },
        };
        titleCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" },
        };
        titleCell.alignment = {
          vertical: "middle",
        };

        sheet.getCell("A2").value =
          subtitle ||
          "ALSORG Logistics Management Report";
        sheet.getCell("A2").font = {
          italic: true,
          color: { argb: "FF475569" },
        };

        sheet.getCell("A3").value =
          `Filters: ${filterDescription}`;
        sheet.getCell("A3").font = {
          color: { argb: "FF64748B" },
          size: 10,
        };

        sheet.getRow(1).height = 28;
      }

      function styleHeader(row) {
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
            wrapText: true,
          };
        });
        row.height = 24;
      }

      function finishSheet(
        sheet,
        headerRowNumber,
        columnWidths = []
      ) {
        sheet.views = [
          {
            state: "frozen",
            ySplit: headerRowNumber,
          },
        ];

        sheet.autoFilter = {
          from: {
            row: headerRowNumber,
            column: 1,
          },
          to: {
            row: headerRowNumber,
            column:
              sheet.columnCount,
          },
        };

        sheet.pageSetup = {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.5,
            bottom: 0.5,
            header: 0.2,
            footer: 0.2,
          },
        };

        sheet.headerFooter.oddFooter =
          "ALSORG Logistics • &D &T • Page &P of &N";

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNumber) {
            return;
          }

          row.eachCell((cell) => {
            cell.border = {
              top: {
                style: "hair",
                color: { argb: "FFE2E8F0" },
              },
              bottom: {
                style: "hair",
                color: { argb: "FFE2E8F0" },
              },
            };
            cell.alignment = {
              vertical: "top",
              wrapText: true,
            };
          });

          if (
            (rowNumber - headerRowNumber) %
            2 ===
            0
          ) {
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: "FFF8FAFC",
                },
              };
            });
          }
        });

        sheet.columns.forEach(
          (column, index) => {
            column.width =
              columnWidths[index] || 16;
          }
        );
      }

      function addExecutiveSummary() {
        const sheet =
          workbook.addWorksheet(
            "Executive Summary"
          );

        addTitle(
          sheet,
          "ALSORG Logistics Executive Summary",
          4,
          "Unified current dispatch challans + manual / legacy operations"
        );

        sheet.addRow([]);
        const header = sheet.addRow([
          "KPI",
          "Value",
          "Management Meaning",
          "Scope",
        ]);
        styleHeader(header);

        const rows = [
          [
            "Operational Records",
            summary.records,
            "Unified records matching current filters",
            "Current + Manual + Legacy",
          ],
          [
            "Dispatch Challans",
            summary.challans,
            "Current item-based dispatch challans",
            "Current challan flow",
          ],
          [
            "Active Operations",
            summary.active,
            "Trips / operations not yet closed",
            "Unified",
          ],
          [
            "Completed Operations",
            summary.completed,
            "Closed operations",
            "Unified",
          ],
          [
            "Completion Rate",
            `${summary.completionRate.toFixed(1)}%`,
            "Completed divided by filtered records",
            "Unified",
          ],
          [
            "Dispatched Items",
            summary.items,
            "Item volume carried by current / legacy challans",
            "Challan sources",
          ],
          [
            "Manual Operations",
            summary.manual,
            "Non-challan operational shifts",
            "Manual / legacy shifts",
          ],
          [
            "Legacy Trips",
            summary.legacy,
            "Older trip records not duplicated by current challans",
            "Legacy trip source",
          ],
          [
            "Helpers / Loaders",
            summary.helpers,
            "Recorded manpower",
            "Where available",
          ],
          [
            "Distance",
            round(summary.distance),
            "Recorded manual / legacy distance",
            "Manual / legacy",
          ],
          [
            "Fuel",
            round(summary.fuel),
            "Recorded manual / legacy fuel",
            "Manual / legacy",
          ],
          [
            "Average Duration",
            formatDuration(
              summary.averageDurationMinutes
            ),
            "Average closed-record duration",
            "Where start/end exist",
          ],
          [
            "Drivers Active in Report",
            summary.uniqueDrivers,
            "Unique drivers represented",
            "Filtered records",
          ],
          [
            "Vehicles Active in Report",
            summary.uniqueVehicles,
            "Unique vehicles represented",
            "Filtered records",
          ],
          [
            "Fleet Document Alerts",
            summary.fleetAlerts,
            "Fitness / Insurance / PUCC attention items",
            "Vehicle master",
          ],
        ];

        rows.forEach((row) =>
          sheet.addRow(row)
        );

        finishSheet(sheet, 5, [
          26,
          18,
          48,
          25,
        ]);
      }

      function addDriverSheet() {
        const sheet =
          workbook.addWorksheet(
            "Driver Performance"
          );

        addTitle(
          sheet,
          "Driver Performance Report",
          16,
          "Driver-wise current challan and manual / legacy contribution"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Driver",
          "Records",
          "Dispatch Challans",
          "Active",
          "Completed",
          "Completion %",
          "Items",
          "Trips",
          "Manual Ops",
          "Legacy Trips",
          "Helpers",
          "Distance",
          "Fuel",
          "Overtime",
          "Avg Duration",
          "Last Activity",
        ]);
        styleHeader(header);

        driverRows.forEach((row) => {
          sheet.addRow([
            row.label,
            row.records,
            row.challans,
            row.running,
            row.completed,
            `${row.completionRate.toFixed(1)}%`,
            row.items,
            row.trips,
            row.manualOperations,
            row.legacyTrips,
            row.helpers,
            round(row.distance),
            round(row.fuel),
            round(row.overtime),
            formatDuration(
              row.averageDurationMinutes
            ),
            formatDateTime(
              row.lastActivityAt
            ),
          ]);
        });

        finishSheet(sheet, 5, [
          24, 10, 14, 10, 11, 13, 10, 10,
          12, 12, 10, 12, 10, 11, 15, 20,
        ]);
      }

      function addVehicleSheet() {
        const sheet =
          workbook.addWorksheet(
            "Vehicle Performance"
          );

        addTitle(
          sheet,
          "Vehicle Performance Report",
          16,
          "Vehicle-wise current challan and manual / legacy utilization"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Vehicle",
          "Records",
          "Dispatch Challans",
          "Active",
          "Completed",
          "Completion %",
          "Items",
          "Trips",
          "Manual Ops",
          "Legacy Trips",
          "Helpers",
          "Distance",
          "Fuel",
          "Overtime",
          "Avg Duration",
          "Last Activity",
        ]);
        styleHeader(header);

        vehicleRows.forEach((row) => {
          sheet.addRow([
            row.label,
            row.records,
            row.challans,
            row.running,
            row.completed,
            `${row.completionRate.toFixed(1)}%`,
            row.items,
            row.trips,
            row.manualOperations,
            row.legacyTrips,
            row.helpers,
            round(row.distance),
            round(row.fuel),
            round(row.overtime),
            formatDuration(
              row.averageDurationMinutes
            ),
            formatDateTime(
              row.lastActivityAt
            ),
          ]);
        });

        finishSheet(sheet, 5, [
          20, 10, 14, 10, 11, 13, 10, 10,
          12, 12, 10, 12, 10, 11, 15, 20,
        ]);
      }

      function addTripSheet() {
        const sheet =
          workbook.addWorksheet(
            "Trip Challan Register"
          );

        addTitle(
          sheet,
          "Trip / Challan Register",
          18,
          "Unified operational ledger with source clearly identified"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Source",
          "Challan / Operation",
          "Driver",
          "Vehicle",
          "Start",
          "End",
          "Duration",
          "Status",
          "Items",
          "Trips",
          "Helpers",
          "Route",
          "Distance",
          "Fuel",
          "Overtime",
          "Receiver",
          "POD",
          "Remarks",
        ]);
        styleHeader(header);

        filteredRecords.forEach((record) => {
          sheet.addRow([
            record.sourceLabel,
            record.challanNumber,
            record.driverName,
            record.vehicleNumber,
            formatDateTime(record.startAt),
            formatDateTime(record.endAt),
            formatDuration(
              record.durationMinutes
            ),
            record.status,
            record.items,
            record.trips,
            record.helpers,
            record.route,
            round(record.distance),
            round(record.fuel),
            round(record.overtime),
            record.raw?.receiverName || "",
            record.raw?.podUrl
              ? "Attached"
              : "",
            record.remarks,
          ]);
        });

        finishSheet(sheet, 5, [
          18, 22, 22, 18, 20, 20, 14, 13, 9,
          9, 10, 18, 11, 10, 10, 18, 10, 36,
        ]);
      }

      function addManualSheet() {
        const sheet =
          workbook.addWorksheet(
            "Manual Legacy Ops"
          );

        addTitle(
          sheet,
          "Manual / Legacy Operations",
          15,
          "Non-current-challan operations, kept separate to avoid double counting"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Source",
          "Driver",
          "Vehicle",
          "Start",
          "End",
          "Status",
          "Trips",
          "Helpers",
          "Route",
          "Distance",
          "Fuel",
          "Overtime",
          "Duration",
          "Reference",
          "Remarks",
        ]);
        styleHeader(header);

        manualRecords.forEach((record) => {
          sheet.addRow([
            record.sourceLabel,
            record.driverName,
            record.vehicleNumber,
            formatDateTime(record.startAt),
            formatDateTime(record.endAt),
            record.status,
            record.trips,
            record.helpers,
            record.route,
            round(record.distance),
            round(record.fuel),
            round(record.overtime),
            formatDuration(
              record.durationMinutes
            ),
            record.challanNumber,
            record.remarks,
          ]);
        });

        finishSheet(sheet, 5, [
          18, 22, 18, 20, 20, 13, 9, 10, 18,
          11, 10, 10, 14, 20, 36,
        ]);
      }

      function addComplianceSheet() {
        const sheet =
          workbook.addWorksheet(
            "Fleet Compliance"
          );

        addTitle(
          sheet,
          "Fleet Compliance Report",
          14,
          "Registration age plus Fitness, Insurance and PUCC validity alerts"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Vehicle",
          "Driver",
          "Owner",
          "Status",
          "Registration Date",
          "Vehicle Age",
          "Fitness Valid Upto",
          "Fitness Status",
          "Insurance Valid Upto",
          "Insurance Status",
          "PUCC Valid Upto",
          "PUCC Status",
          "Compliance",
          "Alert Count",
        ]);
        styleHeader(header);

        complianceRows.forEach((rowData) => {
          const byKey = new Map(
            rowData.compliance.documents.map(
              (document) => [
                document.key,
                document,
              ]
            )
          );

          const fitness = byKey.get("FITNESS");
          const insurance = byKey.get("INSURANCE");
          const pucc = byKey.get("PUCC");

          sheet.addRow([
            rowData.vehicle?.vehicleNumber || "—",
            rowData.vehicle?.driverName || "—",
            rowData.vehicle?.ownerName || "—",
            rowData.vehicle?.status || "Active",
            formatVehicleDate(
              rowData.vehicle?.registrationDate
            ),
            rowData.age,
            fitness?.formattedDate || "—",
            fitness?.statusText || "—",
            insurance?.formattedDate || "—",
            insurance?.statusText || "—",
            pucc?.formattedDate || "—",
            pucc?.statusText || "—",
            rowData.compliance.severity,
            rowData.compliance.alertCount,
          ]);
        });

        finishSheet(sheet, 5, [
          18, 20, 20, 12, 16, 18, 16, 20, 16, 20,
          16, 20, 13, 10,
        ]);
      }

      function addDispatchItemSheet() {
        const itemRows = [];

        filteredRecords
          .filter(
            (record) =>
              record.source === SOURCE.CHALLAN
          )
          .forEach((record) => {
            record.rawItems.forEach(
              (item) => {
                itemRows.push({
                  record,
                  item,
                });
              }
            );
          });

        if (itemRows.length === 0) {
          return;
        }

        const sheet =
          workbook.addWorksheet(
            "Dispatch Item Detail"
          );

        addTitle(
          sheet,
          "Dispatch Item Detail",
          13,
          "Packet/item detail available on current dispatch challans"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Challan",
          "Dispatch Date / Time",
          "Driver",
          "Vehicle",
          "Item",
          "SKU",
          "PD No",
          "DWG No",
          "Client",
          "Plant",
          "Description",
          "Status",
          "Helpers",
        ]);
        styleHeader(header);

        itemRows.forEach(({ record, item }) => {
          sheet.addRow([
            record.challanNumber,
            formatDateTime(record.startAt),
            record.driverName,
            record.vehicleNumber,
            item?.name ||
            item?.itemName ||
            "—",
            item?.sku || "—",
            item?.pdNo || "—",
            item?.drawingNo || "—",
            item?.clientName || "—",
            item?.plantCode || "—",
            item?.description || "—",
            item?.status || record.status,
            record.helpers,
          ]);
        });

        finishSheet(sheet, 5, [
          20, 20, 20, 18, 26, 20, 14, 14, 22, 12,
          38, 14, 10,
        ]);
      }

      function addNotesSheet() {
        const sheet =
          workbook.addWorksheet("Report Notes");

        addTitle(
          sheet,
          "Report Definitions & Data Rules",
          3,
          "How ALSORG Logistics data is combined without double counting"
        );
        sheet.addRow([]);

        const header = sheet.addRow([
          "Topic",
          "Definition",
          "Management Rule",
        ]);
        styleHeader(header);

        [
          [
            "Dispatch Challans",
            "Current item-based dispatch source from /api/dispatched/challans.",
            "Used for current challan, item volume, trip start/end and helper reporting.",
          ],
          [
            "Manual / Legacy Shifts",
            "Non-challan operational records from logistics shifts.",
            "Used for fuel, distance, route, overtime and manual operation analytics.",
          ],
          [
            "Legacy Trips",
            "Older /api/logistics/trips records.",
            "Excluded when the same challan number already exists in current Dispatch Challans.",
          ],
          [
            "Vehicle Compliance",
            "Fitness, Insurance and PUCC dates from the vehicle master.",
            "Expiry within 30 days is attention; within 7 days / expired is critical.",
          ],
          [
            "Vehicle Age",
            "Calculated at runtime from registrationDate.",
            "Stored vehicleAge is not required for the displayed age.",
          ],
        ].forEach((row) =>
          sheet.addRow(row)
        );

        finishSheet(sheet, 5, [
          24, 62, 62,
        ]);
      }

      if (scope === "FULL") {
        addExecutiveSummary();
        addDriverSheet();
        addVehicleSheet();
        addTripSheet();
        addManualSheet();
        addComplianceSheet();
        addDispatchItemSheet();
        addNotesSheet();
      } else {
        if (reportMode === "DRIVER") {
          addDriverSheet();
        } else if (reportMode === "VEHICLE") {
          addVehicleSheet();
        } else if (reportMode === "TRIP") {
          addTripSheet();
        } else if (reportMode === "MANUAL") {
          addManualSheet();
        } else if (
          reportMode === "COMPLIANCE"
        ) {
          addComplianceSheet();
        } else {
          addExecutiveSummary();
        }
      }

      const buffer =
        await workbook.xlsx.writeBuffer();

      const safeDate = new Date()
        .toISOString()
        .slice(0, 10);

      const fileName =
        scope === "FULL"
          ? `ALSORG_Logistics_Management_Report_${safeDate}.xlsx`
          : `ALSORG_Logistics_${reportMode}_Report_${safeDate}.xlsx`;

      saveAs(
        new Blob([buffer], {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        fileName
      );

      showAlert(
        "Logistics Excel report generated successfully",
        "success"
      );
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          "Unable to generate Excel report"
        ),
        "error"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Logistics Reports & Intelligence
          </div>

          <div style={subtitle}>
            Unified reporting across Dispatch Challans, driver activity, vehicle utilization, manual/legacy operations and fleet compliance.
          </div>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            style={refreshBtn}
            onClick={loadReports}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            style={downloadCurrentBtn}
            disabled={loading || downloading}
            onClick={() =>
              downloadExcelReport("VIEW")
            }
          >
            {downloading
              ? "Preparing..."
              : "Download Current View"}
          </button>

          <button
            type="button"
            style={downloadBtn}
            disabled={loading || downloading}
            onClick={() =>
              downloadExcelReport("FULL")
            }
          >
            {downloading
              ? "Preparing..."
              : "Download Management Workbook"}
          </button>
        </div>
      </div>

      {loadWarning && (
        <div style={warningBox}>
          {loadWarning}
        </div>
      )}

      <div style={sourceNote}>
        <strong>Reporting model:</strong> current item dispatches come from Dispatch Challans. Manual / legacy shifts remain the source for recorded fuel, distance, route and overtime. Older logistics trips are de-duplicated when the same challan exists in the current flow.
      </div>

      <div style={filters}>
        <select
          value={reportMode}
          onChange={(event) =>
            setReportMode(
              event.target.value
            )
          }
          style={input}
        >
          {REPORT_MODES.map((mode) => (
            <option
              key={mode.value}
              value={mode.value}
            >
              {mode.label}
            </option>
          ))}
        </select>

        <select
          value={driverId}
          onChange={(event) =>
            setDriverId(
              event.target.value
            )
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

        <select
          value={vehicleId}
          onChange={(event) =>
            setVehicleId(
              event.target.value
            )
          }
          style={input}
        >
          <option value="">
            All Vehicles
          </option>
          {vehicles.map((vehicle) => (
            <option
              key={vehicle.id}
              value={vehicle.id}
            >
              {vehicle.vehicleNumber}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(
              event.target.value
            )
          }
          style={input}
        >
          <option value="ALL">
            All Sources
          </option>
          <option value={SOURCE.CHALLAN}>
            Dispatch Challans
          </option>
          <option value={SOURCE.MANUAL}>
            Manual Shifts
          </option>
          <option value={SOURCE.LEGACY_TRIP}>
            Legacy Trips
          </option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          style={input}
        >
          <option value="ALL">
            All Status
          </option>
          <option value="ACTIVE">
            Active / Running
          </option>
          <option value="COMPLETED">
            Completed
          </option>
          <option value="CANCELLED">
            Cancelled
          </option>
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(event) =>
            setFromDate(event.target.value)
          }
          style={input}
          title="From date"
        />

        <input
          type="date"
          value={toDate}
          onChange={(event) =>
            setToDate(event.target.value)
          }
          style={input}
          title="To date"
        />

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search challan, driver, vehicle, client, PD, route..."
          style={searchInput}
        />

        <button
          type="button"
          style={clearBtn}
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      <div style={summaryGrid}>
        <SummaryCard
          label="Records"
          value={summary.records}
        />
        <SummaryCard
          label="Dispatch Challans"
          value={summary.challans}
          accent="#60a5fa"
        />
        <SummaryCard
          label="Active"
          value={summary.active}
          accent="#22c55e"
        />
        <SummaryCard
          label="Completed"
          value={summary.completed}
          accent="#3b82f6"
        />
        <SummaryCard
          label="Dispatched Items"
          value={summary.items}
          accent="#8b5cf6"
        />
        <SummaryCard
          label="Fleet Alerts"
          value={summary.fleetAlerts}
          accent={
            summary.fleetAlerts > 0
              ? "#ef4444"
              : "#22c55e"
          }
        />
      </div>

      <div style={managementStrip}>
        <MiniMetric
          label="Completion Rate"
          value={`${summary.completionRate.toFixed(0)}%`}
        />
        <MiniMetric
          label="Avg Duration"
          value={formatDuration(
            summary.averageDurationMinutes
          )}
        />
        <MiniMetric
          label="Drivers"
          value={summary.uniqueDrivers}
        />
        <MiniMetric
          label="Vehicles"
          value={summary.uniqueVehicles}
        />
        <MiniMetric
          label="Manual Ops"
          value={summary.manual}
        />
        <MiniMetric
          label="Distance"
          value={round(summary.distance)}
        />
        <MiniMetric
          label="Fuel"
          value={round(summary.fuel)}
        />
      </div>

      {loading ? (
        <div style={emptyRow}>
          Loading unified logistics reports...
        </div>
      ) : (
        <ReportBody
          reportMode={reportMode}
          records={filteredRecords}
          driverRows={driverRows}
          vehicleRows={vehicleRows}
          manualRecords={manualRecords}
          complianceRows={complianceRows}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = "#94a3b8",
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

function MiniMetric({ label, value }) {
  return (
    <div style={miniMetric}>
      <div style={miniMetricLabel}>
        {label}
      </div>
      <div style={miniMetricValue}>
        {value}
      </div>
    </div>
  );
}

function ReportBody({
  reportMode,
  records,
  driverRows,
  vehicleRows,
  manualRecords,
  complianceRows,
}) {
  if (reportMode === "DRIVER") {
    return (
      <PerformanceTable
        title="Driver Performance"
        identityLabel="Driver"
        rows={driverRows}
      />
    );
  }

  if (reportMode === "VEHICLE") {
    return (
      <PerformanceTable
        title="Vehicle Performance"
        identityLabel="Vehicle"
        rows={vehicleRows}
      />
    );
  }

  if (reportMode === "TRIP") {
    return (
      <TripTable
        title="Trip / Challan Register"
        records={records}
      />
    );
  }

  if (reportMode === "MANUAL") {
    return (
      <TripTable
        title="Manual / Legacy Operations"
        records={manualRecords}
      />
    );
  }

  if (reportMode === "COMPLIANCE") {
    return (
      <ComplianceTable
        rows={complianceRows}
      />
    );
  }

  return (
    <div style={overviewGrid}>
      <PerformanceTable
        title="Top Driver Activity"
        identityLabel="Driver"
        rows={driverRows.slice(0, 8)}
        compact
      />

      <PerformanceTable
        title="Top Vehicle Activity"
        identityLabel="Vehicle"
        rows={vehicleRows.slice(0, 8)}
        compact
      />

      <TripTable
        title="Recent Unified Operations"
        records={records.slice(0, 12)}
        compact
      />

      <ComplianceTable
        rows={complianceRows
          .filter(
            (row) =>
              row.compliance.alertCount > 0
          )
          .slice(0, 10)}
        compact
      />
    </div>
  );
}

function PerformanceTable({
  title,
  identityLabel,
  rows,
  compact = false,
}) {
  return (
    <div
      style={{
        ...tableCard,
        ...(compact
          ? {}
          : { gridColumn: "1 / -1" }),
      }}
    >
      <div style={tableTitleRow}>
        <div>
          <div style={tableTitle}>{title}</div>
          <div style={tableSub}>
            {rows.length} record(s)
          </div>
        </div>
      </div>

      <div style={scrollTable}>
        <div style={performanceHead}>
          <div>{identityLabel}</div>
          <div>Records</div>
          <div>Challans</div>
          <div>Active</div>
          <div>Completed</div>
          <div>Items</div>
          <div>Trips</div>
          <div>Manual</div>
          <div>Distance</div>
          <div>Fuel</div>
          <div>Avg Duration</div>
          <div>Last Activity</div>
        </div>

        {rows.length === 0 && (
          <div style={tableEmpty}>
            No data available for the selected filters.
          </div>
        )}

        {rows.map((row) => (
          <div
            key={row.key}
            style={performanceRow}
          >
            <div style={nameCell}>
              {row.label}
            </div>
            <div>{row.records}</div>
            <div>{row.challans}</div>
            <div>
              <span style={activePill}>
                {row.running}
              </span>
            </div>
            <div>{row.completed}</div>
            <div style={importantValue}>
              {row.items}
            </div>
            <div>{row.trips}</div>
            <div>{row.manualOperations}</div>
            <div>{round(row.distance)}</div>
            <div>{round(row.fuel)}</div>
            <div>
              {formatDuration(
                row.averageDurationMinutes
              )}
            </div>
            <div style={mutedCell}>
              {formatDateTime(
                row.lastActivityAt
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TripTable({
  title,
  records,
  compact = false,
}) {
  return (
    <div
      style={{
        ...tableCard,
        ...(compact
          ? {}
          : { gridColumn: "1 / -1" }),
      }}
    >
      <div style={tableTitleRow}>
        <div>
          <div style={tableTitle}>{title}</div>
          <div style={tableSub}>
            {records.length} operation(s)
          </div>
        </div>
      </div>

      <div style={scrollTable}>
        <div style={tripHead}>
          <div>Source</div>
          <div>Challan / Operation</div>
          <div>Driver</div>
          <div>Vehicle</div>
          <div>Start</div>
          <div>End</div>
          <div>Load</div>
          <div>Status</div>
          <div>Helpers</div>
          <div>Route</div>
        </div>

        {records.length === 0 && (
          <div style={tableEmpty}>
            No operations matched the selected filters.
          </div>
        )}

        {records.map((record) => (
          <div
            key={record.key}
            style={tripRow}
          >
            <div>
              <span
                style={sourcePill(
                  record.source
                )}
              >
                {record.sourceLabel}
              </span>
            </div>
            <div style={challanCell}>
              {record.challanNumber}
            </div>
            <div>{record.driverName}</div>
            <div>{record.vehicleNumber}</div>
            <div style={mutedCell}>
              {formatDateTime(record.startAt)}
            </div>
            <div style={mutedCell}>
              {formatDateTime(record.endAt)}
            </div>
            <div>
              {record.source === SOURCE.MANUAL
                ? `${record.trips} trip(s)`
                : `${record.items} item(s)`}
            </div>
            <div>
              <span
                style={statusPill(
                  record.statusBucket
                )}
              >
                {record.status}
              </span>
            </div>
            <div>{record.helpers || "—"}</div>
            <div>{record.route || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceTable({
  rows,
  compact = false,
}) {
  return (
    <div
      style={{
        ...tableCard,
        ...(compact
          ? {}
          : { gridColumn: "1 / -1" }),
      }}
    >
      <div style={tableTitleRow}>
        <div>
          <div style={tableTitle}>
            Fleet Compliance
          </div>
          <div style={tableSub}>
            Registration age + Fitness / Insurance / PUCC validity
          </div>
        </div>
      </div>

      <div style={scrollTable}>
        <div style={complianceHead}>
          <div>Vehicle</div>
          <div>Age</div>
          <div>Fitness</div>
          <div>Insurance</div>
          <div>PUCC</div>
          <div>Compliance</div>
        </div>

        {rows.length === 0 && (
          <div style={tableEmpty}>
            No fleet compliance alerts for the selected filters.
          </div>
        )}

        {rows.map((rowData) => {
          const byKey = new Map(
            rowData.compliance.documents.map(
              (document) => [
                document.key,
                document,
              ]
            )
          );

          return (
            <div
              key={rowData.vehicle?.id}
              style={complianceRow}
            >
              <div style={nameCell}>
                {rowData.vehicle
                  ?.vehicleNumber || "—"}
              </div>
              <div>{rowData.age}</div>
              <ComplianceDocument
                document={byKey.get("FITNESS")}
              />
              <ComplianceDocument
                document={byKey.get("INSURANCE")}
              />
              <ComplianceDocument
                document={byKey.get("PUCC")}
              />
              <div>
                <span
                  style={compliancePill(
                    rowData.compliance.severity
                  )}
                >
                  {rowData.compliance.severity ===
                    "OK"
                    ? "COMPLIANT"
                    : `${rowData.compliance.alertCount} ALERT(S)`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplianceDocument({ document }) {
  if (!document) {
    return <div>—</div>;
  }

  return (
    <div>
      <div style={documentDate}>
        {document.formattedDate}
      </div>
      <div
        style={documentStatus(
          document.severity
        )}
      >
        {document.statusText}
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
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const title = {
  color: "#fff",
  fontSize: 25,
  fontWeight: 950,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
  maxWidth: 760,
  lineHeight: 1.5,
  fontSize: 12.5,
};

const refreshBtn = {
  height: 38,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#cbd5e1",
  padding: "0 13px",
  fontWeight: 850,
  cursor: "pointer",
};

const downloadCurrentBtn = {
  height: 38,
  borderRadius: 11,
  border:
    "1px solid rgba(96,165,250,.20)",
  background:
    "rgba(59,130,246,.10)",
  color: "#93c5fd",
  padding: "0 13px",
  fontWeight: 850,
  cursor: "pointer",
};

const downloadBtn = {
  height: 38,
  borderRadius: 11,
  border: "none",
  background:
    "linear-gradient(135deg,#16a34a,#22c55e)",
  color: "#fff",
  padding: "0 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const warningBox = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 13,
  color: "#fbbf24",
  background: "rgba(245,158,11,.08)",
  border:
    "1px solid rgba(245,158,11,.18)",
  fontSize: 10.5,
  fontWeight: 750,
};

const sourceNote = {
  marginBottom: 14,
  padding: 12,
  borderRadius: 13,
  color: "#94a3b8",
  background:
    "rgba(59,130,246,.055)",
  border:
    "1px solid rgba(59,130,246,.12)",
  fontSize: 10.5,
  fontWeight: 650,
  lineHeight: 1.55,
};

const filters = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 14,
  padding: 11,
  borderRadius: 15,
  background:
    "rgba(255,255,255,.03)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const input = {
  height: 37,
  minWidth: 150,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
  fontWeight: 700,
  colorScheme: "dark",
};

const searchInput = {
  ...input,
  flex: "1 1 260px",
  minWidth: 230,
};

const clearBtn = {
  height: 37,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  padding: "0 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(145px,1fr))",
  gap: 10,
  marginBottom: 10,
};

const summaryCard = {
  minHeight: 76,
  padding: 13,
  borderRadius: 14,
  background:
    "rgba(2,6,23,.38)",
  border:
    "1px solid rgba(255,255,255,.055)",
};

const summaryLabel = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue = {
  marginTop: 6,
  color: "#fff",
  fontSize: 23,
  fontWeight: 950,
};

const managementStrip = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(125px,1fr))",
  gap: 8,
  marginBottom: 16,
};

const miniMetric = {
  padding: "10px 11px",
  borderRadius: 12,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px solid rgba(255,255,255,.05)",
};

const miniMetricLabel = {
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const miniMetricValue = {
  marginTop: 4,
  color: "#e2e8f0",
  fontSize: 16,
  fontWeight: 950,
};

const overviewGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(430px,1fr))",
  gap: 14,
};

const tableCard = {
  minWidth: 0,
  padding: 15,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.58))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const tableTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const tableTitle = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const tableSub = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 700,
};

const scrollTable = {
  overflowX: "auto",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.05)",
};

const performanceHead = {
  minWidth: 1140,
  display: "grid",
  gridTemplateColumns:
    "1.3fr .55fr .65fr .55fr .65fr .55fr .55fr .55fr .65fr .55fr .8fr 1fr",
  gap: 7,
  padding: "9px 10px",
  background: "#111827",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
};

const performanceRow = {
  minWidth: 1140,
  display: "grid",
  gridTemplateColumns:
    "1.3fr .55fr .65fr .55fr .65fr .55fr .55fr .55fr .65fr .55fr .8fr 1fr",
  gap: 7,
  padding: "10px 10px",
  color: "#cbd5e1",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(255,255,255,.045)",
};

const tripHead = {
  minWidth: 1180,
  display: "grid",
  gridTemplateColumns:
    ".85fr 1.05fr 1fr .9fr 1.15fr 1.15fr .7fr .8fr .55fr .9fr",
  gap: 7,
  padding: "9px 10px",
  background: "#111827",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
};

const tripRow = {
  minWidth: 1180,
  display: "grid",
  gridTemplateColumns:
    ".85fr 1.05fr 1fr .9fr 1.15fr 1.15fr .7fr .8fr .55fr .9fr",
  gap: 7,
  padding: "10px 10px",
  color: "#cbd5e1",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(255,255,255,.045)",
};

const complianceHead = {
  minWidth: 920,
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr 1.2fr 1.2fr 1.2fr 1fr",
  gap: 8,
  padding: "9px 10px",
  background: "#111827",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
};

const complianceRow = {
  minWidth: 920,
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr 1.2fr 1.2fr 1.2fr 1fr",
  gap: 8,
  padding: "10px 10px",
  color: "#cbd5e1",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(255,255,255,.045)",
};

const nameCell = {
  color: "#fff",
  fontWeight: 850,
};

const challanCell = {
  color: "#fff",
  fontWeight: 850,
  fontFamily: "monospace",
};

const importantValue = {
  color: "#93c5fd",
  fontWeight: 900,
};

const mutedCell = {
  color: "#94a3b8",
  fontSize: 9,
};

const activePill = {
  display: "inline-flex",
  minWidth: 24,
  justifyContent: "center",
  padding: "4px 6px",
  borderRadius: 999,
  color: "#4ade80",
  background:
    "rgba(34,197,94,.10)",
  fontWeight: 900,
};

const sourcePill = (source) => ({
  display: "inline-flex",
  padding: "4px 6px",
  borderRadius: 999,
  fontSize: 8,
  fontWeight: 900,
  color:
    source === SOURCE.CHALLAN
      ? "#4ade80"
      : source === SOURCE.MANUAL
        ? "#c4b5fd"
        : "#fbbf24",
  background:
    source === SOURCE.CHALLAN
      ? "rgba(34,197,94,.10)"
      : source === SOURCE.MANUAL
        ? "rgba(139,92,246,.10)"
        : "rgba(245,158,11,.10)",
});

const statusPill = (bucket) => ({
  display: "inline-flex",
  padding: "4px 6px",
  borderRadius: 999,
  fontSize: 8,
  fontWeight: 900,
  color:
    bucket === "ACTIVE"
      ? "#4ade80"
      : bucket === "COMPLETED"
        ? "#60a5fa"
        : bucket === "CANCELLED"
          ? "#f87171"
          : "#cbd5e1",
  background:
    bucket === "ACTIVE"
      ? "rgba(34,197,94,.10)"
      : bucket === "COMPLETED"
        ? "rgba(59,130,246,.10)"
        : bucket === "CANCELLED"
          ? "rgba(239,68,68,.10)"
          : "rgba(148,163,184,.10)",
});

const compliancePill = (severity) => ({
  display: "inline-flex",
  padding: "5px 7px",
  borderRadius: 999,
  fontSize: 8,
  fontWeight: 900,
  color:
    severity === "DANGER"
      ? "#f87171"
      : severity === "WARNING"
        ? "#fbbf24"
        : "#4ade80",
  background:
    severity === "DANGER"
      ? "rgba(239,68,68,.10)"
      : severity === "WARNING"
        ? "rgba(245,158,11,.10)"
        : "rgba(34,197,94,.10)",
});

const documentDate = {
  color: "#e2e8f0",
  fontSize: 9.5,
  fontWeight: 800,
};

const documentStatus = (severity) => ({
  marginTop: 3,
  color:
    severity === "DANGER"
      ? "#f87171"
      : severity === "WARNING"
        ? "#fbbf24"
        : "#4ade80",
  fontSize: 8.5,
  fontWeight: 850,
});

const tableEmpty = {
  padding: 22,
  color: "#64748b",
  textAlign: "center",
  fontSize: 10.5,
  fontWeight: 750,
};

const emptyRow = {
  padding: 30,
  borderRadius: 16,
  color: "#94a3b8",
  textAlign: "center",
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px dashed rgba(255,255,255,.08)",
  fontWeight: 800,
};

export default ShiftReports;
