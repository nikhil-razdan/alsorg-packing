import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./logisticsScrollbars.css";

import {
  fetchDrivers,
  fetchVehicles,
  fetchShifts,
  fetchDispatchChallans,
  fetchLogisticsTrips,
  endDispatchChallanTrip,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import LogisticsPagination from "./LogisticsPagination";
import useLogisticsLiveRefresh from "./useLogisticsLiveRefresh";

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


const TRIP_END_IMPORT_STATUS = Object.freeze({
  READY: "READY",
  FUTURE: "FUTURE",
  NO_CHANGE: "NO_CHANGE",
  BLANK_END: "BLANK_END",
  INVALID_END: "INVALID_END",
  NOT_FOUND: "NOT_FOUND",
  BEFORE_START: "BEFORE_START",
  UNSUPPORTED_SOURCE: "UNSUPPORTED_SOURCE",
  DUPLICATE: "DUPLICATE",
  INVALID_CHALLAN: "INVALID_CHALLAN",
  UPDATED: "UPDATED",
  FAILED: "FAILED",
});

const TRIP_END_IMPORT_REQUIRED_ALIASES = Object.freeze({
  challan: [
    "CHALLAN / OPERATION",
    "CHALLAN",
    "CHALLAN NUMBER",
    "CHALLAN NO",
  ],
  end: [
    "END",
    "TRIP END",
    "END TIME",
    "TRIP END TIME",
  ],
});

const TRIP_END_IMPORT_OPTIONAL_ALIASES = Object.freeze({
  source: ["SOURCE"],
  driver: ["DRIVER"],
  vehicle: ["VEHICLE"],
  start: [
    "START",
    "TRIP START",
    "START TIME",
    "TRIP START TIME",
  ],
  status: ["STATUS"],
});

const IMPORT_MONTHS = Object.freeze({
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  SEPT: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
});

const padTripEndImport = (value) =>
  String(value).padStart(2, "0");

function normalizeTripEndImportHeader(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanTripEndImportText(value) {
  const text = String(value ?? "").trim();

  if (
    !text ||
    ["—", "-", "–", "NULL", "UNDEFINED"].includes(
      text.toUpperCase()
    )
  ) {
    return "";
  }

  return text;
}

function readTripEndImportCellValue(cell) {
  if (!cell) return null;

  let value = cell.value;

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        "result"
      ) &&
      value.result !== undefined &&
      value.result !== null
    ) {
      value = value.result;
    } else if (Array.isArray(value.richText)) {
      value = value.richText
        .map((part) => part?.text || "")
        .join("");
    } else if (value.text !== undefined) {
      value = value.text;
    }
  }

  return value;
}

function parseTripEndImportDateTime(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getTime());
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;

    /* Excel 1900 date system. Build a local Date from UTC parts so
     * the business LocalDateTime is not shifted by timezone parsing. */
    const milliseconds = Math.round(
      (value - 25569) * 86400 * 1000
    );
    const utcDate = new Date(milliseconds);

    if (Number.isNaN(utcDate.getTime())) {
      return null;
    }

    return new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes(),
      utcDate.getUTCSeconds(),
      0
    );
  }

  const text = cleanTripEndImportText(value);
  if (!text) return null;

  const businessParsed = parseBusinessDateTime(text);
  if (businessParsed) {
    return businessParsed;
  }

  const reportMatch = text.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );

  if (reportMatch) {
    const month =
      IMPORT_MONTHS[
      String(reportMatch[2])
        .slice(0, 4)
        .toUpperCase()
      ] ??
      IMPORT_MONTHS[
      String(reportMatch[2])
        .slice(0, 3)
        .toUpperCase()
      ];

    if (month === undefined) return null;

    let hour = Number(reportMatch[4]);
    const minute = Number(reportMatch[5]);
    const second = Number(reportMatch[6] || 0);
    const meridiem = reportMatch[7].toUpperCase();

    if (hour === 12) hour = 0;
    if (meridiem === "PM") hour += 12;

    const parsed = new Date(
      Number(reportMatch[3]),
      month,
      Number(reportMatch[1]),
      hour,
      minute,
      second,
      0
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const slashMatch = text.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i
  );

  if (slashMatch) {
    let hour = Number(slashMatch[4]);
    const meridiem = String(
      slashMatch[7] || ""
    ).toUpperCase();

    if (meridiem) {
      if (hour === 12) hour = 0;
      if (meridiem === "PM") hour += 12;
    }

    const parsed = new Date(
      Number(slashMatch[3]),
      Number(slashMatch[2]) - 1,
      Number(slashMatch[1]),
      hour,
      Number(slashMatch[5]),
      Number(slashMatch[6] || 0),
      0
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  return null;
}

function toTripEndBackendLocalDateTime(value) {
  const date =
    value instanceof Date
      ? value
      : parseTripEndImportDateTime(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padTripEndImport(
    date.getMonth() + 1
  )}-${padTripEndImport(
    date.getDate()
  )}T${padTripEndImport(
    date.getHours()
  )}:${padTripEndImport(
    date.getMinutes()
  )}`;
}

function tripEndMinuteKey(value) {
  return toTripEndBackendLocalDateTime(value);
}

function formatTripEndImportRaw(value) {
  const text = cleanTripEndImportText(value);
  if (text) return text;

  if (value instanceof Date) {
    return formatDateTime(value);
  }

  return "—";
}

function findTripEndImportColumn(
  normalizedHeaders,
  aliases
) {
  for (const alias of aliases) {
    const index = normalizedHeaders.indexOf(
      normalizeTripEndImportHeader(alias)
    );

    if (index >= 0) return index + 1;
  }

  return 0;
}

function findTripEndImportRegister(workbook) {
  const preferred = workbook.getWorksheet(
    "Trip Challan Register"
  );

  const candidates = preferred
    ? [
      preferred,
      ...workbook.worksheets.filter(
        (sheet) => sheet !== preferred
      ),
    ]
    : workbook.worksheets;

  for (const worksheet of candidates) {
    const maxHeaderRows = Math.min(
      Number(worksheet.rowCount || 0),
      25
    );

    for (
      let rowNumber = 1;
      rowNumber <= maxHeaderRows;
      rowNumber += 1
    ) {
      const row = worksheet.getRow(rowNumber);
      const normalizedHeaders = [];

      for (
        let column = 1;
        column <= Math.max(
          Number(worksheet.columnCount || 0),
          20
        );
        column += 1
      ) {
        normalizedHeaders.push(
          normalizeTripEndImportHeader(
            readTripEndImportCellValue(
              row.getCell(column)
            )
          )
        );
      }

      const challanColumn =
        findTripEndImportColumn(
          normalizedHeaders,
          TRIP_END_IMPORT_REQUIRED_ALIASES
            .challan
        );

      const endColumn =
        findTripEndImportColumn(
          normalizedHeaders,
          TRIP_END_IMPORT_REQUIRED_ALIASES.end
        );

      if (!challanColumn || !endColumn) {
        continue;
      }

      const columns = {
        challan: challanColumn,
        end: endColumn,
      };

      Object.entries(
        TRIP_END_IMPORT_OPTIONAL_ALIASES
      ).forEach(([key, aliases]) => {
        columns[key] =
          findTripEndImportColumn(
            normalizedHeaders,
            aliases
          );
      });

      return {
        worksheet,
        headerRowNumber: rowNumber,
        columns,
      };
    }
  }

  return null;
}

function tripEndImportStatusMeta(status) {
  switch (status) {
    case TRIP_END_IMPORT_STATUS.READY:
      return {
        label: "Ready",
        color: "#16a34a",
        background: "rgba(34,197,94,.12)",
      };
    case TRIP_END_IMPORT_STATUS.FUTURE:
      return {
        label: "Future time",
        color: "#d97706",
        background: "rgba(245,158,11,.12)",
      };
    case TRIP_END_IMPORT_STATUS.NO_CHANGE:
      return {
        label: "No change",
        color: "#2563eb",
        background: "rgba(59,130,246,.10)",
      };
    case TRIP_END_IMPORT_STATUS.BLANK_END:
      return {
        label: "Blank / skipped",
        color: "var(--pf-text-muted)",
        background: "rgba(148,163,184,.10)",
      };
    case TRIP_END_IMPORT_STATUS.UPDATED:
      return {
        label: "Updated",
        color: "#16a34a",
        background: "rgba(34,197,94,.14)",
      };
    case TRIP_END_IMPORT_STATUS.FAILED:
      return {
        label: "Failed",
        color: "#dc2626",
        background: "rgba(239,68,68,.12)",
      };
    default:
      return {
        label: "Blocked",
        color: "#dc2626",
        background: "rgba(239,68,68,.10)",
      };
  }
}

function buildTripEndImportPreview({
  parsedRows,
  liveChallans,
}) {
  const liveByChallan = new Map();

  (Array.isArray(liveChallans)
    ? liveChallans
    : []
  ).forEach((challan) => {
    const key = normalizeText(
      challan?.challanNumber ||
      challan?.chalaanNumber
    );

    if (key) {
      liveByChallan.set(key, challan);
    }
  });

  const counts = new Map();

  parsedRows.forEach((row) => {
    const key = normalizeText(
      row.challanNumber
    );

    if (key) {
      counts.set(
        key,
        (counts.get(key) || 0) + 1
      );
    }
  });

  const now = new Date();

  return parsedRows.map((row) => {
    const challanNumber =
      cleanTripEndImportText(
        row.challanNumber
      );

    const source =
      cleanTripEndImportText(
        row.source
      );

    const workbookEndText =
      formatTripEndImportRaw(
        row.endValue
      );

    const base = {
      ...row,
      challanNumber,
      source,
      workbookEndText,
      proposedEnd: "",
      currentEnd: "",
      liveStart: "",
      reason: "",
      actionable: false,
      future: false,
    };

    if (!challanNumber) {
      return {
        ...base,
        status:
          TRIP_END_IMPORT_STATUS.INVALID_CHALLAN,
        reason: "Challan / Operation is blank.",
      };
    }

    const challanKey = normalizeText(
      challanNumber
    );

    if ((counts.get(challanKey) || 0) > 1) {
      return {
        ...base,
        status:
          TRIP_END_IMPORT_STATUS.DUPLICATE,
        reason:
          "The same challan appears more than once in the workbook.",
      };
    }

    if (
      source &&
      ![
        "DISPATCH CHALLAN",
        "CHALLAN",
      ].includes(normalizeText(source))
    ) {
      return {
        ...base,
        status:
          TRIP_END_IMPORT_STATUS
            .UNSUPPORTED_SOURCE,
        reason:
          "Only current Dispatch Challan rows can update trip end time. Manual / legacy rows are ignored.",
      };
    }

    const rawEnd =
      cleanTripEndImportText(
        row.endValue
      );

    if (!rawEnd && !(row.endValue instanceof Date)) {
      return {
        ...base,
        status:
          TRIP_END_IMPORT_STATUS.BLANK_END,
        reason:
          "End is blank, so this row will not change anything.",
      };
    }

    const proposedDate =
      parseTripEndImportDateTime(
        row.endValue
      );

    if (!proposedDate) {
      return {
        ...base,
        status:
          TRIP_END_IMPORT_STATUS.INVALID_END,
        reason:
          "End value could not be read as a valid date/time.",
      };
    }

    const live = liveByChallan.get(
      challanKey
    );

    if (!live) {
      return {
        ...base,
        proposedEnd:
          toTripEndBackendLocalDateTime(
            proposedDate
          ),
        status:
          TRIP_END_IMPORT_STATUS.NOT_FOUND,
        reason:
          "This challan was not found in the current Dispatch Challans data visible to your account.",
      };
    }

    const liveStartDate =
      parseTripEndImportDateTime(
        live?.tripStartedAt ||
        live?.dispatchedAt ||
        live?.generatedAt ||
        row.startValue
      );

    const currentEndDate =
      parseTripEndImportDateTime(
        live?.tripEndedAt
      );

    const proposedEnd =
      toTripEndBackendLocalDateTime(
        proposedDate
      );

    const currentEnd =
      currentEndDate
        ? toTripEndBackendLocalDateTime(
          currentEndDate
        )
        : "";

    const liveStart =
      liveStartDate
        ? toTripEndBackendLocalDateTime(
          liveStartDate
        )
        : "";

    const matchedBase = {
      ...base,
      live,
      proposedEnd,
      currentEnd,
      liveStart,
      currentEndDisplay:
        currentEndDate
          ? formatDateTime(currentEndDate)
          : "—",
      proposedEndDisplay:
        formatDateTime(proposedDate),
      liveStartDisplay:
        liveStartDate
          ? formatDateTime(liveStartDate)
          : "—",
    };

    if (
      liveStartDate &&
      proposedDate.getTime() <
      liveStartDate.getTime()
    ) {
      return {
        ...matchedBase,
        status:
          TRIP_END_IMPORT_STATUS.BEFORE_START,
        reason:
          "End time is before this challan's trip/dispatch start time.",
      };
    }

    if (
      currentEndDate &&
      tripEndMinuteKey(currentEndDate) ===
      tripEndMinuteKey(proposedDate)
    ) {
      return {
        ...matchedBase,
        status:
          TRIP_END_IMPORT_STATUS.NO_CHANGE,
        reason:
          "The live trip end time already matches the workbook.",
      };
    }

    if (
      proposedDate.getTime() >
      now.getTime()
    ) {
      return {
        ...matchedBase,
        status:
          TRIP_END_IMPORT_STATUS.FUTURE,
        reason:
          "The workbook End is in the future. It will only be applied if you explicitly include future end times.",
        actionable: true,
        future: true,
      };
    }

    return {
      ...matchedBase,
      status:
        TRIP_END_IMPORT_STATUS.READY,
      reason:
        currentEndDate
          ? "Existing trip end time will be replaced by the workbook End value."
          : "Trip end time will be set from the workbook End value.",
      actionable: true,
    };
  });
}

function summarizeTripEndImport(rows) {
  const result = {
    total: rows.length,
    ready: 0,
    future: 0,
    noChange: 0,
    blank: 0,
    blocked: 0,
    updated: 0,
    failed: 0,
  };

  rows.forEach((row) => {
    switch (row.status) {
      case TRIP_END_IMPORT_STATUS.READY:
        result.ready += 1;
        break;
      case TRIP_END_IMPORT_STATUS.FUTURE:
        result.future += 1;
        break;
      case TRIP_END_IMPORT_STATUS.NO_CHANGE:
        result.noChange += 1;
        break;
      case TRIP_END_IMPORT_STATUS.BLANK_END:
        result.blank += 1;
        break;
      case TRIP_END_IMPORT_STATUS.UPDATED:
        result.updated += 1;
        break;
      case TRIP_END_IMPORT_STATUS.FAILED:
        result.failed += 1;
        break;
      default:
        result.blocked += 1;
        break;
    }
  });

  return result;
}

function TripEndImportModal({
  state,
  onClose,
  includeFuture,
  setIncludeFuture,
  confirmed,
  setConfirmed,
  applying,
  progress,
  onConfirm,
}) {
  if (!state.open) return null;

  const summary = summarizeTripEndImport(
    state.rows
  );

  const eligibleCount =
    summary.ready +
    (includeFuture ? summary.future : 0);

  return (
    <div
      style={tripEndImportOverlay}
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !applying
        ) {
          onClose();
        }
      }}
    >
      <div style={tripEndImportModal}>
        <div style={tripEndImportHeader}>
          <div>
            <div style={tripEndImportEyebrow}>
              XLSX TRIP END-TIME UPDATE
            </div>
            <div style={tripEndImportTitle}>
              Preview Before Updating Trips
            </div>
            <div style={tripEndImportSubtitle}>
              {state.fileName || "Uploaded workbook"}
              {state.sheetName
                ? ` • ${state.sheetName}`
                : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            style={tripEndImportClose}
          >
            ×
          </button>
        </div>

        <div style={tripEndImportRuleBox}>
          <strong>Import rule:</strong> Challan / Operation is the exact matching key. Only the <strong>End</strong> value is written back. Status, Duration, Driver, Vehicle, Items, Helpers, Route, Fuel and all other spreadsheet values are never imported. Blank End rows are ignored.
        </div>

        {state.error && (
          <div style={tripEndImportErrorBox}>
            {state.error}
          </div>
        )}

        <div style={tripEndImportSummaryGrid}>
          <TripEndImportSummary
            label="Rows Read"
            value={summary.total}
          />
          <TripEndImportSummary
            label="Ready"
            value={summary.ready}
            accent="#22c55e"
          />
          <TripEndImportSummary
            label="Future Warning"
            value={summary.future}
            accent="#f59e0b"
          />
          <TripEndImportSummary
            label="No Change"
            value={summary.noChange}
            accent="#60a5fa"
          />
          <TripEndImportSummary
            label="Blank / Skipped"
            value={summary.blank}
            accent="var(--pf-text-muted)"
          />
          <TripEndImportSummary
            label="Blocked"
            value={summary.blocked}
            accent="#ef4444"
          />
          {(summary.updated > 0 ||
            summary.failed > 0) && (
              <>
                <TripEndImportSummary
                  label="Updated"
                  value={summary.updated}
                  accent="#22c55e"
                />
                <TripEndImportSummary
                  label="Failed"
                  value={summary.failed}
                  accent="#ef4444"
                />
              </>
            )}
        </div>

        {summary.future > 0 && (
          <label style={tripEndImportFutureToggle}>
            <input
              type="checkbox"
              checked={includeFuture}
              disabled={applying}
              onChange={(event) => {
                setIncludeFuture(
                  event.target.checked
                );
                setConfirmed(false);
              }}
            />
            <span>
              Include {summary.future} future End time{summary.future === 1 ? "" : "s"}. These rows are excluded by default because a future End immediately makes the challan look ended.
            </span>
          </label>
        )}

        <div
          style={tripEndImportTableWrap}
          className="logistics-scrollbar logistics-scrollbar-x logistics-scrollbar-y logistics-scrollbar-stable"
        >
          <div style={tripEndImportTableHead}>
            <div>Row</div>
            <div>Challan / Operation</div>
            <div>Driver / Vehicle</div>
            <div>Live Start</div>
            <div>Current End</div>
            <div>Workbook End</div>
            <div>Preview Result</div>
          </div>

          {state.rows.map((row) => {
            const meta =
              tripEndImportStatusMeta(
                row.status
              );

            return (
              <div
                key={`${row.rowNumber}:${row.challanNumber}`}
                style={tripEndImportTableRow}
              >
                <div style={tripEndImportMuted}>
                  {row.rowNumber}
                </div>
                <div>
                  <div style={tripEndImportChallan}>
                    {row.challanNumber || "—"}
                  </div>
                  <div style={tripEndImportSmall}>
                    {row.source || "Dispatch Challan"}
                  </div>
                </div>
                <div>
                  <div>
                    {row.driver ||
                      row.live?.driverName ||
                      "—"}
                  </div>
                  <div style={tripEndImportSmall}>
                    {row.vehicle ||
                      row.live?.vehicleNumber ||
                      "—"}
                  </div>
                </div>
                <div style={tripEndImportDateCell}>
                  {row.liveStartDisplay || "—"}
                </div>
                <div style={tripEndImportDateCell}>
                  {row.currentEndDisplay || "—"}
                </div>
                <div style={tripEndImportDateCellStrong}>
                  {row.proposedEndDisplay ||
                    row.workbookEndText ||
                    "—"}
                </div>
                <div>
                  <span
                    style={{
                      ...tripEndImportStatusPill,
                      color: meta.color,
                      background: meta.background,
                    }}
                  >
                    {meta.label}
                  </span>
                  <div style={tripEndImportReason}>
                    {row.reason}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {applying && (
          <div style={tripEndImportProgressBox}>
            Updating trip end times… {progress.done}/{progress.total}
          </div>
        )}

        <div style={tripEndImportFooter}>
          <label style={tripEndImportConfirmCheck}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={
                applying ||
                eligibleCount === 0
              }
              onChange={(event) =>
                setConfirmed(
                  event.target.checked
                )
              }
            />
            <span>
              I reviewed the preview and confirm the eligible End-time updates.
            </span>
          </label>

          <div style={tripEndImportFooterActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              style={tripEndImportCancelBtn}
            >
              Close
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={
                applying ||
                !confirmed ||
                eligibleCount === 0
              }
              style={tripEndImportConfirmBtn(
                applying ||
                !confirmed ||
                eligibleCount === 0
              )}
            >
              {applying
                ? `Updating ${progress.done}/${progress.total}`
                : `Confirm & Update ${eligibleCount} Trip${eligibleCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripEndImportSummary({
  label,
  value,
  accent = "var(--pf-text)",
}) {
  return (
    <div
      style={{
        ...tripEndImportSummaryCard,
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div style={tripEndImportSummaryLabel}>
        {label}
      </div>
      <div style={tripEndImportSummaryValue}>
        {value}
      </div>
    </div>
  );
}

function ShiftReports({
  showAlert = () => { },
  liveRefreshToken = null,
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

  const [reportPageNo, setReportPageNo] =
    useState(1);
  const [reportPageSize, setReportPageSize] =
    useState(15);

  const tripEndFileInputRef =
    useRef(null);

  const [tripEndImport, setTripEndImport] =
    useState({
      open: false,
      fileName: "",
      sheetName: "",
      rows: [],
      error: "",
    });

  const [tripEndImportParsing, setTripEndImportParsing] =
    useState(false);

  const [tripEndImportApplying, setTripEndImportApplying] =
    useState(false);

  const [tripEndImportIncludeFuture, setTripEndImportIncludeFuture] =
    useState(false);

  const [tripEndImportConfirmed, setTripEndImportConfirmed] =
    useState(false);

  const [tripEndImportProgress, setTripEndImportProgress] =
    useState({
      done: 0,
      total: 0,
    });

  async function loadReports({
    background = false,
  } = {}) {
    try {
      if (!background) {
        setLoading(true);
        setLoadWarning("");
      }

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
        failed.push("drivers");
        if (!background) setDrivers([]);
      }

      if (vehicleResult.status === "fulfilled") {
        setVehicles(
          Array.isArray(vehicleResult.value)
            ? vehicleResult.value
            : []
        );
      } else {
        failed.push("vehicles");
        if (!background) setVehicles([]);
      }

      if (shiftResult.status === "fulfilled") {
        setShifts(
          Array.isArray(shiftResult.value)
            ? shiftResult.value
            : []
        );
      } else {
        failed.push("manual operations");
        if (!background) setShifts([]);
      }

      if (challanResult.status === "fulfilled") {
        setChallans(
          Array.isArray(challanResult.value)
            ? challanResult.value
            : []
        );
      } else {
        failed.push("dispatch challans");
        if (!background) setChallans([]);
      }

      if (legacyTripResult.status === "fulfilled") {
        setLegacyTrips(
          Array.isArray(legacyTripResult.value)
            ? legacyTripResult.value
            : []
        );
      } else {
        failed.push("legacy trips");
        if (!background) setLegacyTrips([]);
      }

      if (failed.length === 0) {
        setLoadWarning("");
      } else if (!background) {
        setLoadWarning(
          `Some report sources could not be loaded: ${failed.join(
            ", "
          )}. Available data is still shown.`
        );
      }
    } catch (error) {
      if (!background) {
        showAlert(
          getBackendMessage(
            error,
            "Failed to load logistics reports"
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
      await loadReports({
        background: true,
      });
    }
  );

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

  useEffect(() => {
    setReportPageNo(1);
  }, [
    reportMode,
    driverId,
    vehicleId,
    sourceFilter,
    statusFilter,
    fromDate,
    toDate,
    search,
    reportPageSize,
  ]);

  const clearFilters = () => {
    setDriverId("");
    setVehicleId("");
    setSourceFilter("ALL");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
    setSearch("");
  };


  const closeTripEndImport = () => {
    if (tripEndImportApplying) return;

    setTripEndImport({
      open: false,
      fileName: "",
      sheetName: "",
      rows: [],
      error: "",
    });
    setTripEndImportIncludeFuture(false);
    setTripEndImportConfirmed(false);
    setTripEndImportProgress({
      done: 0,
      total: 0,
    });
  };

  async function previewTripEndWorkbook(file) {
    if (!file) return;

    const fileName = String(
      file.name || ""
    );

    if (!/\.xlsx$/i.test(fileName)) {
      showAlert(
        "Please upload an .xlsx file exported from Logistics Reports.",
        "error"
      );
      return;
    }

    try {
      setTripEndImportParsing(true);
      setTripEndImportConfirmed(false);
      setTripEndImportIncludeFuture(false);

      const excelModule =
        await import("exceljs");

      const ExcelJS =
        excelModule.default || excelModule;

      const workbook =
        new ExcelJS.Workbook();

      const buffer =
        await file.arrayBuffer();

      await workbook.xlsx.load(buffer);

      const register =
        findTripEndImportRegister(
          workbook
        );

      if (!register) {
        throw new Error(
          "Trip Challan Register columns were not found. Upload a Current View / Management Workbook containing 'Challan / Operation' and 'End'."
        );
      }

      const {
        worksheet,
        headerRowNumber,
        columns,
      } = register;

      const parsedRows = [];

      for (
        let rowNumber = headerRowNumber + 1;
        rowNumber <= worksheet.rowCount;
        rowNumber += 1
      ) {
        const row =
          worksheet.getRow(rowNumber);

        const challanNumber =
          columns.challan
            ? readTripEndImportCellValue(
              row.getCell(
                columns.challan
              )
            )
            : "";

        const endValue =
          columns.end
            ? readTripEndImportCellValue(
              row.getCell(
                columns.end
              )
            )
            : null;

        const source =
          columns.source
            ? readTripEndImportCellValue(
              row.getCell(
                columns.source
              )
            )
            : "Dispatch Challan";

        const startValue =
          columns.start
            ? readTripEndImportCellValue(
              row.getCell(
                columns.start
              )
            )
            : null;

        const driver =
          columns.driver
            ? cleanTripEndImportText(
              readTripEndImportCellValue(
                row.getCell(
                  columns.driver
                )
              )
            )
            : "";

        const vehicle =
          columns.vehicle
            ? cleanTripEndImportText(
              readTripEndImportCellValue(
                row.getCell(
                  columns.vehicle
                )
              )
            )
            : "";

        const rowHasAnything = Boolean(
          cleanTripEndImportText(
            challanNumber
          ) ||
          cleanTripEndImportText(
            endValue
          ) ||
          cleanTripEndImportText(
            source
          )
        );

        if (!rowHasAnything) {
          continue;
        }

        parsedRows.push({
          rowNumber,
          source:
            cleanTripEndImportText(
              source
            ),
          challanNumber:
            cleanTripEndImportText(
              challanNumber
            ),
          driver,
          vehicle,
          startValue,
          endValue,
        });
      }

      if (parsedRows.length === 0) {
        throw new Error(
          "No report data rows were found below the Trip Challan Register header."
        );
      }

      /* Re-read current challans before preview. This ensures matching and
       * current End comparisons are based on live data, not stale report state. */
      const liveData =
        await fetchDispatchChallans();

      const liveChallans =
        Array.isArray(liveData)
          ? liveData
          : [];

      setChallans(liveChallans);

      const previewRows =
        buildTripEndImportPreview({
          parsedRows,
          liveChallans,
        });

      setTripEndImport({
        open: true,
        fileName,
        sheetName: worksheet.name,
        rows: previewRows,
        error: "",
      });
    } catch (error) {
      console.error(error);

      setTripEndImport({
        open: true,
        fileName,
        sheetName: "",
        rows: [],
        error:
          getBackendMessage(
            error,
            "Unable to read trip end-time workbook"
          ),
      });

      showAlert(
        getBackendMessage(
          error,
          "Unable to read trip end-time workbook"
        ),
        "error"
      );
    } finally {
      setTripEndImportParsing(false);
    }
  }

  async function handleTripEndFileChange(
    event
  ) {
    const file =
      event.target.files?.[0] || null;

    /* Reset so the same workbook can be selected again after correction. */
    event.target.value = "";

    if (!file) return;

    await previewTripEndWorkbook(file);
  }

  async function confirmTripEndImport() {
    if (
      tripEndImportApplying ||
      !tripEndImportConfirmed
    ) {
      return;
    }

    const updates =
      tripEndImport.rows.filter(
        (row) =>
          row.status ===
          TRIP_END_IMPORT_STATUS.READY ||
          (
            tripEndImportIncludeFuture &&
            row.status ===
            TRIP_END_IMPORT_STATUS.FUTURE
          )
      );

    if (updates.length === 0) {
      showAlert(
        "There are no eligible trip end-time changes to apply.",
        "warning"
      );
      return;
    }

    try {
      setTripEndImportApplying(true);
      setTripEndImportProgress({
        done: 0,
        total: updates.length,
      });

      const outcomes = new Map();
      let cursor = 0;
      let completed = 0;

      const worker = async () => {
        while (true) {
          const index = cursor;
          cursor += 1;

          if (index >= updates.length) {
            return;
          }

          const row = updates[index];

          try {
            const response =
              await endDispatchChallanTrip(
                row.challanNumber,
                row.proposedEnd
              );

            outcomes.set(
              normalizeText(
                row.challanNumber
              ),
              {
                ok: true,
                response,
              }
            );
          } catch (error) {
            console.error(
              "Trip end-time XLSX update failed",
              row.challanNumber,
              error
            );

            outcomes.set(
              normalizeText(
                row.challanNumber
              ),
              {
                ok: false,
                error:
                  getBackendMessage(
                    error,
                    "Trip end-time update failed"
                  ),
              }
            );
          } finally {
            completed += 1;
            setTripEndImportProgress({
              done: completed,
              total: updates.length,
            });
          }
        }
      };

      const workerCount = Math.min(
        4,
        updates.length
      );

      await Promise.all(
        Array.from(
          { length: workerCount },
          () => worker()
        )
      );

      let successCount = 0;
      let failureCount = 0;

      const resultRows =
        tripEndImport.rows.map((row) => {
          const outcome = outcomes.get(
            normalizeText(
              row.challanNumber
            )
          );

          if (!outcome) {
            return row;
          }

          if (outcome.ok) {
            successCount += 1;

            return {
              ...row,
              status:
                TRIP_END_IMPORT_STATUS.UPDATED,
              currentEnd:
                row.proposedEnd,
              currentEndDisplay:
                row.proposedEndDisplay,
              reason:
                "Trip end time updated successfully from the workbook.",
              actionable: false,
            };
          }

          failureCount += 1;

          return {
            ...row,
            status:
              TRIP_END_IMPORT_STATUS.FAILED,
            reason:
              outcome.error ||
              "Trip end-time update failed.",
            actionable: false,
          };
        });

      setTripEndImport((current) => ({
        ...current,
        rows: resultRows,
      }));

      setTripEndImportConfirmed(false);

      await loadReports();

      if (failureCount === 0) {
        showAlert(
          `${successCount} trip end time${successCount === 1 ? "" : "s"} updated successfully from XLSX.`,
          "success"
        );
      } else {
        showAlert(
          `${successCount} updated, ${failureCount} failed. Review the preview result column for the failed challans.`,
          "warning"
        );
      }
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          "Unable to apply trip end-time workbook"
        ),
        "error"
      );
    } finally {
      setTripEndImportApplying(false);
    }
  }

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
    <div className="logistics-scroll-scope" style={wrap}>
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

          <input
            ref={tripEndFileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleTripEndFileChange}
            style={{ display: "none" }}
          />

          <button
            type="button"
            style={uploadTripEndBtn}
            disabled={
              loading ||
              tripEndImportParsing ||
              tripEndImportApplying
            }
            onClick={() =>
              tripEndFileInputRef.current?.click()
            }
          >
            {tripEndImportParsing
              ? "Reading XLSX..."
              : "Upload Trip End Times"}
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
          pageNo={reportPageNo}
          setPageNo={setReportPageNo}
          pageSize={reportPageSize}
          setPageSize={setReportPageSize}
        />
      )}

      <TripEndImportModal
        state={tripEndImport}
        onClose={closeTripEndImport}
        includeFuture={tripEndImportIncludeFuture}
        setIncludeFuture={setTripEndImportIncludeFuture}
        confirmed={tripEndImportConfirmed}
        setConfirmed={setTripEndImportConfirmed}
        applying={tripEndImportApplying}
        progress={tripEndImportProgress}
        onConfirm={confirmTripEndImport}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = "var(--pf-text-muted)",
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
  pageNo,
  setPageNo,
  pageSize,
  setPageSize,
}) {
  if (reportMode === "OVERVIEW") {
    return (
      <div style={overviewGrid}>
        <PerformanceTable
          title="Top Driver Activity"
          identityLabel="Driver"
          rows={driverRows.slice(0, 8)}
          totalRows={driverRows.length}
          compact
        />

        <PerformanceTable
          title="Top Vehicle Activity"
          identityLabel="Vehicle"
          rows={vehicleRows.slice(0, 8)}
          totalRows={vehicleRows.length}
          compact
        />

        <TripTable
          title="Recent Unified Operations"
          records={records.slice(0, 12)}
          totalRows={records.length}
          compact
        />

        <ComplianceTable
          rows={complianceRows
            .filter(
              (row) =>
                row.compliance.alertCount > 0
            )
            .slice(0, 10)}
          totalRows={
            complianceRows.filter(
              (row) =>
                row.compliance.alertCount > 0
            ).length
          }
          compact
        />
      </div>
    );
  }

  let sourceRows = [];
  let label = "records";

  if (reportMode === "DRIVER") {
    sourceRows = driverRows;
    label = "drivers";
  } else if (reportMode === "VEHICLE") {
    sourceRows = vehicleRows;
    label = "vehicles";
  } else if (reportMode === "TRIP") {
    sourceRows = records;
    label = "operations";
  } else if (reportMode === "MANUAL") {
    sourceRows = manualRecords;
    label = "operations";
  } else if (reportMode === "COMPLIANCE") {
    sourceRows = complianceRows;
    label = "vehicles";
  }

  const totalPages = Math.max(
    1,
    Math.ceil(
      sourceRows.length /
      pageSize
    )
  );

  const currentPage = Math.min(
    Math.max(
      1,
      Number(pageNo || 1)
    ),
    totalPages
  );

  const pageRows = sourceRows.slice(
    (currentPage - 1) *
    pageSize,
    currentPage *
    pageSize
  );

  const pager = sourceRows.length > 0 ? (
    <LogisticsPagination
      pageNo={currentPage}
      setPageNo={setPageNo}
      pageSize={pageSize}
      setPageSize={setPageSize}
      totalItems={sourceRows.length}
      label={label}
      pageSizeOptions={[10, 15, 25, 50, 100]}
    />
  ) : null;

  if (reportMode === "DRIVER") {
    return (
      <div style={reportTableWithPager}>
        <PerformanceTable
          title="Driver Performance"
          identityLabel="Driver"
          rows={pageRows}
          totalRows={sourceRows.length}
        />
        {pager}
      </div>
    );
  }

  if (reportMode === "VEHICLE") {
    return (
      <div style={reportTableWithPager}>
        <PerformanceTable
          title="Vehicle Performance"
          identityLabel="Vehicle"
          rows={pageRows}
          totalRows={sourceRows.length}
        />
        {pager}
      </div>
    );
  }

  if (reportMode === "TRIP") {
    return (
      <div style={reportTableWithPager}>
        <TripTable
          title="Trip / Challan Register"
          records={pageRows}
          totalRows={sourceRows.length}
        />
        {pager}
      </div>
    );
  }

  if (reportMode === "MANUAL") {
    return (
      <div style={reportTableWithPager}>
        <TripTable
          title="Manual / Legacy Operations"
          records={pageRows}
          totalRows={sourceRows.length}
        />
        {pager}
      </div>
    );
  }

  if (reportMode === "COMPLIANCE") {
    return (
      <div style={reportTableWithPager}>
        <ComplianceTable
          rows={pageRows}
          totalRows={sourceRows.length}
        />
        {pager}
      </div>
    );
  }

  return null;
}

function PerformanceTable({
  title,
  identityLabel,
  rows,
  totalRows = rows.length,
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
            {compact && totalRows > rows.length
              ? `Showing ${rows.length} of ${totalRows} record(s)`
              : `${totalRows} record(s)`}
          </div>
        </div>
      </div>

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={scrollTable}>
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
  totalRows = records.length,
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
            {compact && totalRows > records.length
              ? `Showing ${records.length} of ${totalRows} operation(s)`
              : `${totalRows} operation(s)`}
          </div>
        </div>
      </div>

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={scrollTable}>
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
  totalRows = rows.length,
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
            {compact && totalRows > rows.length
              ? ` • Showing ${rows.length} of ${totalRows}`
              : totalRows > 0
                ? ` • ${totalRows} vehicle(s)`
                : ""}
          </div>
        </div>
      </div>

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={scrollTable}>
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
  color: "var(--pf-text-strong)",
  fontSize: 25,
  fontWeight: 950,
};

const subtitle = {
  color: "var(--pf-text-muted)",
  marginTop: 6,
  maxWidth: 760,
  lineHeight: 1.5,
  fontSize: 12.5,
};

const refreshBtn = {
  height: 40,
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  background:
    "rgba(var(--pf-fg-rgb),.04)",
  color: "var(--pf-text)",
  WebkitTextFillColor: "var(--pf-text)",
  padding: "0 15px",
  fontWeight: 800,
  cursor: "pointer",
};


const uploadTripEndBtn = {
  height: 40,
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#d97706,#f59e0b)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  padding: "0 15px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 7px 16px rgba(245,158,11,.18)",
};

const tripEndImportOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1600,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "var(--pf-overlay)",
  backdropFilter: "blur(8px)",
};

const tripEndImportModal = {
  width: "min(1420px,96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 16,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 34px 90px rgba(var(--pf-shadow-rgb),.20)",
  color: "var(--pf-text)",
};

const tripEndImportHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: "18px 20px 14px",
  borderBottom:
    "1px solid rgba(148,163,184,.10)",
};

const tripEndImportEyebrow = {
  color: "#60a5fa",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".12em",
};

const tripEndImportTitle = {
  marginTop: 5,
  color: "var(--pf-text-strong)",
  fontSize: 21,
  fontWeight: 950,
};

const tripEndImportSubtitle = {
  marginTop: 5,
  color: "var(--pf-text-dim)",
  fontSize: 10.5,
  fontWeight: 750,
};

const tripEndImportClose = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border:
    "1px solid rgba(148,163,184,.12)",
  background:
    "rgba(var(--pf-fg-rgb),.035)",
  color: "var(--pf-text)",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const tripEndImportRuleBox = {
  margin: "14px 20px 0",
  padding: "11px 13px",
  borderRadius: 12,
  color: "var(--pf-text)",
  background:
    "rgba(59,130,246,.065)",
  border:
    "1px solid rgba(96,165,250,.13)",
  fontSize: 10.5,
  lineHeight: 1.55,
};

const tripEndImportErrorBox = {
  margin: "12px 20px 0",
  padding: 12,
  borderRadius: 12,
  color: "#dc2626",
  background:
    "rgba(239,68,68,.10)",
  border:
    "1px solid rgba(239,68,68,.18)",
  fontSize: 10.5,
  fontWeight: 800,
};

const tripEndImportSummaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(115px,1fr))",
  gap: 8,
  margin: "12px 20px 0",
};

const tripEndImportSummaryCard = {
  padding: "9px 10px",
  borderRadius: 10,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const tripEndImportSummaryLabel = {
  color: "var(--pf-text-dim)",
  fontSize: 8,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const tripEndImportSummaryValue = {
  marginTop: 3,
  color: "var(--pf-text-strong)",
  fontSize: 18,
  fontWeight: 950,
};

const tripEndImportFutureToggle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  margin: "12px 20px 0",
  padding: "10px 12px",
  borderRadius: 11,
  color: "#d97706",
  background:
    "rgba(245,158,11,.075)",
  border:
    "1px solid rgba(245,158,11,.16)",
  fontSize: 10,
  lineHeight: 1.5,
  fontWeight: 750,
};

const tripEndImportTableWrap = {
  flex: "1 1 auto",
  minHeight: 220,
  maxHeight: "46vh",
  margin: "12px 20px 0",
  overflow: "auto",
  borderRadius: 12,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface-alt)",
};

const tripEndImportGridColumns =
  ".42fr 1.28fr 1.05fr 1.05fr 1.05fr 1.05fr 1.55fr";

const tripEndImportTableHead = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  minWidth: 1180,
  display: "grid",
  gridTemplateColumns:
    tripEndImportGridColumns,
  gap: 8,
  padding: "9px 10px",
  color: "var(--pf-text-muted)",
  background: "var(--pf-surface)",
  borderBottom:
    "1px solid rgba(148,163,184,.10)",
  fontSize: 8.5,
  fontWeight: 950,
  textTransform: "uppercase",
};

const tripEndImportTableRow = {
  minWidth: 1180,
  display: "grid",
  gridTemplateColumns:
    tripEndImportGridColumns,
  gap: 8,
  padding: "9px 10px",
  alignItems: "center",
  color: "var(--pf-text)",
  borderTop:
    "1px solid rgba(148,163,184,.06)",
  fontSize: 9.5,
};

const tripEndImportMuted = {
  color: "var(--pf-text-dim)",
  fontWeight: 800,
};

const tripEndImportChallan = {
  color: "var(--pf-text-strong)",
  fontWeight: 900,
  fontFamily: "monospace",
};

const tripEndImportSmall = {
  marginTop: 3,
  color: "var(--pf-text-dim)",
  fontSize: 8.5,
  fontWeight: 700,
};

const tripEndImportDateCell = {
  color: "var(--pf-text-muted)",
  fontSize: 9,
  fontWeight: 750,
};

const tripEndImportDateCellStrong = {
  color: "var(--pf-text)",
  fontSize: 9,
  fontWeight: 900,
};

const tripEndImportStatusPill = {
  display: "inline-flex",
  padding: "4px 7px",
  borderRadius: 999,
  fontSize: 8,
  fontWeight: 950,
};

const tripEndImportReason = {
  marginTop: 4,
  color: "var(--pf-text-muted)",
  fontSize: 8.5,
  lineHeight: 1.35,
};

const tripEndImportProgressBox = {
  margin: "10px 20px 0",
  padding: "9px 11px",
  borderRadius: 10,
  color: "#2563eb",
  background:
    "rgba(59,130,246,.08)",
  border:
    "1px solid rgba(59,130,246,.14)",
  fontSize: 10,
  fontWeight: 850,
};

const tripEndImportFooter = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: "14px 20px 18px",
  flexWrap: "wrap",
};

const tripEndImportConfirmCheck = {
  flex: "1 1 420px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 750,
};

const tripEndImportFooterActions = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const tripEndImportCancelBtn = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.10)",
  background:
    "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  WebkitTextFillColor: "var(--pf-text-strong)",
  fontWeight: 850,
  cursor: "pointer",
};

const tripEndImportConfirmBtn =
  (disabled) => ({
    height: 38,
    padding: "0 15px",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    WebkitTextFillColor: "#fff",
    background:
      disabled
        ? "rgba(var(--pf-fg-rgb),.16)"
        : "linear-gradient(135deg,#059669,#10b981)",
    opacity: disabled ? 0.58 : 1,
    cursor:
      disabled
        ? "not-allowed"
        : "pointer",
    fontWeight: 900,
    boxShadow:
      disabled
        ? "none"
        : "0 7px 16px rgba(5,150,105,.18)",
  });

const downloadCurrentBtn = {
  height: 40,
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  padding: "0 15px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 7px 16px rgba(37,99,235,.18)",
};

const downloadBtn = {
  height: 40,
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#059669,#10b981)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  padding: "0 16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 7px 16px rgba(5,150,105,.18)",
};

const warningBox = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 13,
  color: "#d97706",
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
  color: "var(--pf-text-muted)",
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
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const input = {
  height: 37,
  minWidth: 150,
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  padding: "0 10px",
  outline: "none",
  fontWeight: 700,
  colorScheme: "var(--pf-color-scheme)",
};

const searchInput = {
  ...input,
  flex: "1 1 260px",
  minWidth: 230,
};

const clearBtn = {
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  WebkitTextFillColor: "var(--pf-text-strong)",
  padding: "0 14px",
  fontWeight: 850,
  cursor: "pointer",
  boxShadow:
    "0 4px 10px rgba(var(--pf-shadow-rgb),.04)",
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
  borderRadius: 12,
  background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 5px 15px rgba(var(--pf-shadow-rgb),.04)",
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
    "rgba(var(--pf-fg-rgb),.025)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.05)",
};

const miniMetricLabel = {
  color: "var(--pf-text-dim)",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const miniMetricValue = {
  marginTop: 4,
  color: "var(--pf-text)",
  fontSize: 16,
  fontWeight: 950,
};

const overviewGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(430px,1fr))",
  gap: 14,
};

const reportTableWithPager = {
  minWidth: 0,
};

const tableCard = {
  minWidth: 0,
  padding: 14,
  borderRadius: 14,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 5px 15px rgba(var(--pf-shadow-rgb),.04)",
};

const tableTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const tableTitle = {
  color: "var(--pf-text-strong)",
  fontSize: 14,
  fontWeight: 900,
};

const tableSub = {
  marginTop: 3,
  color: "var(--pf-text-dim)",
  fontSize: 9.5,
  fontWeight: 700,
};

const scrollTable = {
  overflowX: "auto",
  overflowY: "hidden",
  overscrollBehaviorX: "contain",
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.05)",
};

const performanceHead = {
  minWidth: 1140,
  display: "grid",
  gridTemplateColumns:
    "1.3fr .55fr .65fr .55fr .65fr .55fr .55fr .55fr .65fr .55fr .8fr 1fr",
  gap: 7,
  padding: "9px 10px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-dim)",
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
  color: "var(--pf-text)",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(var(--pf-fg-rgb),.045)",
};

const tripHead = {
  minWidth: 1180,
  display: "grid",
  gridTemplateColumns:
    ".85fr 1.05fr 1fr .9fr 1.15fr 1.15fr .7fr .8fr .55fr .9fr",
  gap: 7,
  padding: "9px 10px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-dim)",
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
  color: "var(--pf-text)",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(var(--pf-fg-rgb),.045)",
};

const complianceHead = {
  minWidth: 920,
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr 1.2fr 1.2fr 1.2fr 1fr",
  gap: 8,
  padding: "9px 10px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-dim)",
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
  color: "var(--pf-text)",
  fontSize: 10,
  alignItems: "center",
  borderTop:
    "1px solid rgba(var(--pf-fg-rgb),.045)",
};

const nameCell = {
  color: "var(--pf-text-strong)",
  fontWeight: 850,
};

const challanCell = {
  color: "var(--pf-text-strong)",
  fontWeight: 850,
  fontFamily: "monospace",
};

const importantValue = {
  color: "#2563eb",
  fontWeight: 900,
};

const mutedCell = {
  color: "var(--pf-text-muted)",
  fontSize: 9,
};

const activePill = {
  display: "inline-flex",
  minWidth: 24,
  justifyContent: "center",
  padding: "4px 6px",
  borderRadius: 999,
  color: "#16a34a",
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
      ? "#16a34a"
      : source === SOURCE.MANUAL
        ? "#7c3aed"
        : "#d97706",
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
      ? "#16a34a"
      : bucket === "COMPLETED"
        ? "#2563eb"
        : bucket === "CANCELLED"
          ? "#dc2626"
          : "var(--pf-text)",
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
      ? "#dc2626"
      : severity === "WARNING"
        ? "#d97706"
        : "#16a34a",
  background:
    severity === "DANGER"
      ? "rgba(239,68,68,.10)"
      : severity === "WARNING"
        ? "rgba(245,158,11,.10)"
        : "rgba(34,197,94,.10)",
});

const documentDate = {
  color: "var(--pf-text)",
  fontSize: 9.5,
  fontWeight: 800,
};

const documentStatus = (severity) => ({
  marginTop: 3,
  color:
    severity === "DANGER"
      ? "#dc2626"
      : severity === "WARNING"
        ? "#d97706"
        : "#16a34a",
  fontSize: 8.5,
  fontWeight: 850,
});

const tableEmpty = {
  padding: 22,
  color: "var(--pf-text-dim)",
  textAlign: "center",
  fontSize: 10.5,
  fontWeight: 750,
};

const emptyRow = {
  padding: 30,
  borderRadius: 16,
  color: "var(--pf-text-muted)",
  textAlign: "center",
  background:
    "rgba(var(--pf-fg-rgb),.025)",
  border:
    "1px dashed rgba(var(--pf-fg-rgb),.08)",
  fontWeight: 800,
};

export default ShiftReports;
