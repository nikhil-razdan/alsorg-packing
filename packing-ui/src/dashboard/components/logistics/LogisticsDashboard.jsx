import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import RefreshIcon from "@mui/icons-material/Refresh";

import ExecutiveSidebar from "./panels/ExecutiveSidebar";
import TripsLineChart from "./charts/TripsLineChart";
import StatusDistributionChart from "./charts/StatusDistributionChart";

import {
  fetchDispatchChallans,
  fetchDrivers,
  fetchShifts,
  fetchVehicles,
} from "../../api/logisticsApi";

import {
  parseBusinessDateTime,
} from "./logisticsUnifiedUtils";

import {
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

const COMPLETED_CHALLAN_STATUSES = new Set([
  "ENDED",
  "COMPLETED",
  "DELIVERED",
]);

const PERIOD_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 Days" },
  { value: "30D", label: "Last 30 Days" },
  { value: "ALL", label: "All Time" },
];

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isMissingValue = (value) => {
  const text = normalizeText(value);
  return (
    !text ||
    text === "-" ||
    text === "—" ||
    text === "NULL" ||
    text === "UNDEFINED"
  );
};

const getChallanLifecycleStatus = (challan) => {
  const status = normalizeStatus(
    challan?.tripStatus
  );

  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  if (
    challan?.tripEndedAt ||
    COMPLETED_CHALLAN_STATUSES.has(status)
  ) {
    return "COMPLETED";
  }

  return "RUNNING";
};

const getChallanStart = (challan) =>
  challan?.tripStartedAt ||
  challan?.dispatchedAt ||
  challan?.generatedAt ||
  challan?.createdAt ||
  null;

const getShiftStart = (shift) =>
  shift?.shiftStart ||
  shift?.date ||
  shift?.createdAt ||
  null;

const getDateKey = (value) => {
  const date = parseBusinessDateTime(value);
  if (!date) return "";

  const pad = (number) =>
    String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const formatChartDate = (dateKey) => {
  if (!dateKey) return "";
  const parts = dateKey.split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}`
    : dateKey;
};

const formatDateTime = (value) => {
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
};

const calculateRunningMinutes = (startValue) => {
  const start = parseBusinessDateTime(startValue);
  if (!start) return 0;

  return Math.max(
    0,
    Math.round(
      (Date.now() - start.getTime()) / 60000
    )
  );
};

const calculateDurationMinutes = (
  startValue,
  endValue,
  explicit
) => {
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
};

const formatDuration = (minutes) => {
  const total = safeNumber(minutes);
  if (total <= 0) return "—";

  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);

  if (hours <= 0) return `${mins} min`;
  if (mins <= 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

const periodStartDate = (period) => {
  if (period === "ALL") return null;

  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  if (period === "7D") {
    start.setDate(start.getDate() - 6);
  }

  if (period === "30D") {
    start.setDate(start.getDate() - 29);
  }

  return start;
};

const isInPeriod = (value, period) => {
  if (period === "ALL") return true;

  const date = parseBusinessDateTime(value);
  if (!date) return false;

  const start = periodStartDate(period);
  return !start || date.getTime() >= start.getTime();
};

const getPeriodLabel = (period) =>
  PERIOD_OPTIONS.find(
    (option) => option.value === period
  )?.label || "Selected Period";

const buildDriverLookup = (drivers) => {
  const byId = new Map();
  const byName = new Map();

  drivers.forEach((driver) => {
    if (driver?.id) {
      byId.set(String(driver.id), driver);
    }

    const nameKey = normalizeText(driver?.name);
    if (nameKey) {
      byName.set(nameKey, driver);
    }
  });

  return { byId, byName };
};

const buildVehicleLookup = (vehicles) => {
  const byId = new Map();
  const byNumber = new Map();

  vehicles.forEach((vehicle) => {
    if (vehicle?.id) {
      byId.set(String(vehicle.id), vehicle);
    }

    const numberKey = normalizeText(
      vehicle?.vehicleNumber
    );

    if (numberKey) {
      byNumber.set(numberKey, vehicle);
    }
  });

  return { byId, byNumber };
};

const getDriverIdentity = (
  driverId,
  driverName,
  lookup
) => {
  const idText = String(driverId || "").trim();
  const nameText = String(driverName || "").trim();

  const master =
    (idText && lookup.byId.get(idText)) ||
    (nameText &&
      lookup.byName.get(normalizeText(nameText))) ||
    null;

  if (master) {
    return {
      key: `DRIVER:${master.id}`,
      id: master.id,
      name: master.name || nameText || "Unknown Driver",
      master,
    };
  }

  if (idText) {
    return {
      key: `DRIVER:ID:${idText}`,
      id: idText,
      name: nameText || "Unknown Driver",
      master: null,
    };
  }

  if (nameText) {
    return {
      key: `DRIVER:NAME:${normalizeText(nameText)}`,
      id: "",
      name: nameText,
      master: null,
    };
  }

  return null;
};

const getVehicleIdentity = (
  vehicleId,
  vehicleNumber,
  lookup
) => {
  const idText = String(vehicleId || "").trim();
  const numberText = String(
    vehicleNumber || ""
  ).trim();

  const master =
    (idText && lookup.byId.get(idText)) ||
    (numberText &&
      lookup.byNumber.get(
        normalizeText(numberText)
      )) ||
    null;

  if (master) {
    return {
      key: `VEHICLE:${master.id}`,
      id: master.id,
      number:
        master.vehicleNumber ||
        numberText ||
        "Unknown Vehicle",
      master,
    };
  }

  if (idText) {
    return {
      key: `VEHICLE:ID:${idText}`,
      id: idText,
      number: numberText || "Unknown Vehicle",
      master: null,
    };
  }

  if (numberText) {
    return {
      key: `VEHICLE:NUMBER:${normalizeText(
        numberText
      )}`,
      id: "",
      number: numberText,
      master: null,
    };
  }

  return null;
};


const REPORT_SOURCE = Object.freeze({
  CHALLAN: "Dispatch Challan",
  MANUAL: "Manual / Legacy",
});

const buildReportOperationRows = (
  periodChallans,
  periodShifts,
  driverLookup,
  vehicleLookup
) => {
  const rows = [];

  periodChallans.forEach((challan, index) => {
    const driver = getDriverIdentity(
      challan?.driverId || challan?.driver?.id,
      challan?.driverName || challan?.driver?.name,
      driverLookup
    );

    const vehicle = getVehicleIdentity(
      challan?.vehicleId || challan?.vehicle?.id,
      challan?.vehicleNumber ||
      challan?.vehicle?.vehicleNumber,
      vehicleLookup
    );

    const startAt = getChallanStart(challan);
    const endAt =
      challan?.tripEndedAt ||
      challan?.deliveredAt ||
      null;

    const lifecycle =
      getChallanLifecycleStatus(challan);

    rows.push({
      key:
        `CHALLAN:${challan?.challanNumber || challan?.id || index}`,
      source: REPORT_SOURCE.CHALLAN,
      recordId:
        challan?.challanNumber ||
        challan?.chalaanNumber ||
        challan?.id ||
        `Challan ${index + 1}`,
      challanNumber:
        challan?.challanNumber ||
        challan?.chalaanNumber ||
        "",
      driverKey: driver?.key || "",
      driverName:
        driver?.name ||
        challan?.driverName ||
        "Unassigned",
      vehicleKey: vehicle?.key || "",
      vehicleNumber:
        vehicle?.number ||
        challan?.vehicleNumber ||
        "Unassigned",
      startAt,
      endAt,
      durationMinutes:
        lifecycle === "RUNNING"
          ? calculateRunningMinutes(startAt)
          : calculateDurationMinutes(
            startAt,
            endAt,
            challan?.tripDurationMinutes
          ),
      status: lifecycle,
      itemCount:
        safeNumber(challan?.totalItems) ||
        (Array.isArray(challan?.items)
          ? challan.items.length
          : 0),
      tripCount: 1,
      helperCount:
        safeNumber(
          challan?.helperLoaderCount ??
          challan?.helpers ??
          challan?.totalHelpers
        ),
      routeCategory:
        challan?.routeCategory ||
        challan?.destination ||
        challan?.toLocation ||
        "",
      distance: 0,
      fuel: 0,
      overtimeHours: 0,
      dispatchedBy:
        challan?.dispatchedBy ||
        challan?.generatedBy ||
        "",
      remarks:
        challan?.remarks ||
        challan?.deliveryRemarks ||
        "",
      rawItems:
        Array.isArray(challan?.items)
          ? challan.items
          : [],
    });
  });

  periodShifts.forEach((shift, index) => {
    const driver = getDriverIdentity(
      shift?.driver?.id || shift?.driverId,
      shift?.driver?.name || shift?.driverName,
      driverLookup
    );

    const vehicle = getVehicleIdentity(
      shift?.vehicle?.id || shift?.vehicleId,
      shift?.vehicle?.vehicleNumber ||
      shift?.vehicleNumber,
      vehicleLookup
    );

    const startAt = getShiftStart(shift);
    const endAt =
      shift?.shiftEnd ||
      shift?.tripEnd ||
      null;

    rows.push({
      key:
        `MANUAL:${shift?.id || startAt || index}`,
      source: REPORT_SOURCE.MANUAL,
      recordId:
        shift?.id
          ? `MANUAL-${shift.id}`
          : `Manual ${index + 1}`,
      challanNumber: "",
      driverKey: driver?.key || "",
      driverName:
        driver?.name ||
        shift?.driver?.name ||
        shift?.driverName ||
        "Unassigned",
      vehicleKey: vehicle?.key || "",
      vehicleNumber:
        vehicle?.number ||
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber ||
        "Unassigned",
      startAt,
      endAt,
      durationMinutes:
        calculateDurationMinutes(
          startAt,
          endAt,
          null
        ),
      status:
        normalizeStatus(
          shift?.status || "WORKING"
        ),
      itemCount: 0,
      tripCount:
        safeNumber(shift?.totalTrips),
      helperCount:
        safeNumber(
          shift?.totalLoaders ??
          shift?.totalHelpers
        ),
      routeCategory:
        shift?.routeCategory || "",
      distance:
        safeNumber(shift?.totalDistance),
      fuel:
        safeNumber(shift?.fuelUsed),
      overtimeHours:
        safeNumber(shift?.overtimeHours),
      dispatchedBy: "",
      remarks: shift?.remarks || "",
      rawItems: [],
    });
  });

  return rows.sort((a, b) => {
    const aTime =
      parseBusinessDateTime(a.startAt)
        ?.getTime() || 0;
    const bTime =
      parseBusinessDateTime(b.startAt)
        ?.getTime() || 0;

    return bTime - aTime;
  });
};

const aggregateReportRows = (
  operationRows,
  dimension
) => {
  const isDriver =
    dimension === "DRIVER";

  const map = new Map();

  operationRows.forEach((operation) => {
    const key = isDriver
      ? operation.driverKey ||
      `DRIVER:${normalizeText(
        operation.driverName
      )}`
      : operation.vehicleKey ||
      `VEHICLE:${normalizeText(
        operation.vehicleNumber
      )}`;

    const label = isDriver
      ? operation.driverName
      : operation.vehicleNumber;

    if (!key || isMissingValue(label)) {
      return;
    }

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        challans: 0,
        completedChallans: 0,
        runningChallans: 0,
        cancelledChallans: 0,
        dispatchedItems: 0,
        manualOperations: 0,
        manualTrips: 0,
        helpers: 0,
        distance: 0,
        fuel: 0,
        overtimeHours: 0,
        durationTotal: 0,
        durationCount: 0,
        lastActivityAt: null,
      });
    }

    const row = map.get(key);

    if (
      operation.source ===
      REPORT_SOURCE.CHALLAN
    ) {
      row.challans += 1;
      row.dispatchedItems +=
        safeNumber(operation.itemCount);

      if (
        operation.status ===
        "COMPLETED"
      ) {
        row.completedChallans += 1;
      } else if (
        operation.status ===
        "RUNNING"
      ) {
        row.runningChallans += 1;
      } else if (
        operation.status ===
        "CANCELLED"
      ) {
        row.cancelledChallans += 1;
      }
    } else {
      row.manualOperations += 1;
      row.manualTrips +=
        safeNumber(operation.tripCount);
      row.helpers +=
        safeNumber(operation.helperCount);
      row.distance +=
        safeNumber(operation.distance);
      row.fuel +=
        safeNumber(operation.fuel);
      row.overtimeHours +=
        safeNumber(operation.overtimeHours);
    }

    if (
      safeNumber(operation.durationMinutes) >
      0
    ) {
      row.durationTotal +=
        safeNumber(
          operation.durationMinutes
        );
      row.durationCount += 1;
    }

    const activityAt =
      parseBusinessDateTime(
        operation.startAt
      );

    if (
      activityAt &&
      (
        !row.lastActivityAt ||
        activityAt.getTime() >
        row.lastActivityAt.getTime()
      )
    ) {
      row.lastActivityAt =
        activityAt;
    }
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      completionRate:
        row.challans > 0
          ? (
            row.completedChallans /
            row.challans
          ) * 100
          : 0,
      averageDurationMinutes:
        row.durationCount > 0
          ? row.durationTotal /
          row.durationCount
          : 0,
      totalActivities:
        row.challans +
        row.manualOperations,
    }))
    .sort((a, b) =>
      b.totalActivities -
      a.totalActivities ||
      b.dispatchedItems -
      a.dispatchedItems ||
      a.label.localeCompare(b.label)
    );
};

const createReportFilterSummary = ({
  periodLabel,
  driverLabel,
  vehicleLabel,
  status,
  search,
}) => {
  return [
    `Period: ${periodLabel}`,
    `Driver: ${driverLabel || "All Drivers"}`,
    `Vehicle: ${vehicleLabel || "All Vehicles"}`,
    `Status: ${status === "ALL" ? "All Statuses" : status}`,
    search
      ? `Search: ${search}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
};

const styleReportTitle = (
  worksheet,
  title,
  subtitle,
  columnCount
) => {
  const endColumn =
    worksheet.getColumn(columnCount).letter;

  worksheet.mergeCells(
    `A1:${endColumn}1`
  );

  const titleCell =
    worksheet.getCell("A1");

  titleCell.value = title;
  titleCell.font = {
    bold: true,
    size: 18,
    color: {
      argb: "FFFFFFFF",
    },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF0F172A",
    },
  };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(
    `A2:${endColumn}2`
  );

  const subtitleCell =
    worksheet.getCell("A2");

  subtitleCell.value = subtitle;
  subtitleCell.font = {
    italic: true,
    size: 10,
    color: {
      argb: "FF475569",
    },
  };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FFF8FAFC",
    },
  };
  subtitleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  worksheet.getRow(2).height = 24;
};

const styleReportHeader = (
  row
) => {
  row.height = 24;

  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
      size: 10,
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1D4ED8",
      },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    cell.border = {
      top: {
        style: "thin",
        color: {
          argb: "FFBFDBFE",
        },
      },
      bottom: {
        style: "thin",
        color: {
          argb: "FFBFDBFE",
        },
      },
      left: {
        style: "thin",
        color: {
          argb: "FFBFDBFE",
        },
      },
      right: {
        style: "thin",
        color: {
          argb: "FFBFDBFE",
        },
      },
    };
  });
};

const styleReportBody = (
  worksheet,
  startRow,
  endRow
) => {
  for (
    let rowNumber = startRow;
    rowNumber <= endRow;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(rowNumber);

    row.height = 22;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };

      cell.border = {
        bottom: {
          style: "hair",
          color: {
            argb: "FFE2E8F0",
          },
        },
      };

      if (rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFF8FAFC",
          },
        };
      }
    });
  }
};

const finalizeReportSheet = (
  worksheet,
  {
    headerRow,
    columnWidths = [],
    landscape = true,
  }
) => {
  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRow,
    },
  ];

  if (
    worksheet.rowCount >= headerRow
  ) {
    worksheet.autoFilter = {
      from: {
        row: headerRow,
        column: 1,
      },
      to: {
        row: headerRow,
        column:
          worksheet.columnCount,
      },
    };
  }

  columnWidths.forEach(
    (width, index) => {
      worksheet.getColumn(
        index + 1
      ).width = width;
    }
  );

  worksheet.pageSetup = {
    orientation:
      landscape
        ? "landscape"
        : "portrait",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.headerFooter = {
    oddFooter:
      "&LALSORG Logistics&RPage &P of &N",
  };
};

const styleStatusCell = (
  cell,
  status
) => {
  const normalized =
    normalizeStatus(status);

  const map = {
    COMPLETED: {
      bg: "FFDCFCE7",
      fg: "FF166534",
    },
    RUNNING: {
      bg: "FFDBEAFE",
      fg: "FF1D4ED8",
    },
    WORKING: {
      bg: "FFEDE9FE",
      fg: "FF6D28D9",
    },
    CANCELLED: {
      bg: "FFFEE2E2",
      fg: "FFB91C1C",
    },
    OFF: {
      bg: "FFFEF3C7",
      fg: "FF92400E",
    },
    ON_LEAVE: {
      bg: "FFFEF3C7",
      fg: "FF92400E",
    },
  };

  const tone =
    map[normalized];

  if (!tone) {
    return;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: tone.bg,
    },
  };

  cell.font = {
    bold: true,
    color: {
      argb: tone.fg,
    },
  };

  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };
};


function LogisticsDashboardScrollStyles() {
  return (
    <style>
      {`
        .logistics-pro-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(96,165,250,.72) rgba(15,23,42,.32);
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
        }

        .logistics-pro-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .logistics-pro-scroll::-webkit-scrollbar-track {
          background: rgba(15,23,42,.34);
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(148,163,184,.045);
        }

        .logistics-pro-scroll::-webkit-scrollbar-thumb {
          min-height: 34px;
          min-width: 34px;
          border-radius: 999px;
          border: 2px solid rgba(15,23,42,.72);
          background:
            linear-gradient(
              135deg,
              rgba(71,85,105,.96) 0%,
              rgba(59,130,246,.92) 52%,
              rgba(96,165,250,.92) 100%
            );
          box-shadow:
            0 0 0 1px rgba(96,165,250,.12),
            0 0 12px rgba(59,130,246,.18);
        }

        .logistics-pro-scroll::-webkit-scrollbar-thumb:hover {
          background:
            linear-gradient(
              135deg,
              rgba(96,165,250,1) 0%,
              rgba(37,99,235,1) 100%
            );
          box-shadow:
            0 0 0 1px rgba(147,197,253,.24),
            0 0 16px rgba(59,130,246,.34);
        }

        .logistics-pro-scroll::-webkit-scrollbar-corner {
          background: transparent;
        }

        .logistics-pro-scroll-x {
          padding-bottom: 4px;
        }

        .logistics-pro-scroll-y {
          padding-right: 4px;
        }

        .logistics-pro-scroll-soft::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        @media (max-width: 720px) {
          .logistics-pro-scroll::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }
        }
      `}
    </style>
  );
}

const buildPaginationItems = (
  currentPage,
  totalPages,
  siblingCount = 1
) => {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage,
  ]);

  for (
    let offset = 1;
    offset <= siblingCount;
    offset += 1
  ) {
    pages.add(
      currentPage - offset
    );
    pages.add(
      currentPage + offset
    );
  }

  const validPages =
    Array.from(pages)
      .filter(
        (page) =>
          page >= 1 &&
          page <= totalPages
      )
      .sort((a, b) => a - b);

  const result = [];

  validPages.forEach(
    (page, index) => {
      const previous =
        validPages[index - 1];

      if (
        index > 0 &&
        page - previous > 1
      ) {
        result.push(
          `ellipsis-${previous}-${page}`
        );
      }

      result.push(page);
    }
  );

  return result;
};

function ProfessionalPagination({
  page = 1,
  setPage,
  pageSize = 10,
  setPageSize,
  totalItems = 0,
  label = "records",
  pageSizeOptions = [
    5,
    10,
    25,
    50,
  ],
  compact = false,
}) {
  const safeTotal =
    Math.max(
      0,
      Number(totalItems || 0)
    );

  const safePageSize =
    Math.max(
      1,
      Number(pageSize || 1)
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        safeTotal /
        safePageSize
      )
    );

  const currentPage =
    Math.min(
      totalPages,
      Math.max(
        1,
        Number(page || 1)
      )
    );

  useEffect(() => {
    if (
      currentPage !== page &&
      typeof setPage ===
      "function"
    ) {
      setPage(currentPage);
    }
  }, [
    currentPage,
    page,
    setPage,
  ]);

  const pageItems =
    useMemo(
      () =>
        buildPaginationItems(
          currentPage,
          totalPages
        ),
      [
        currentPage,
        totalPages,
      ]
    );

  if (safeTotal <= 0) {
    return null;
  }

  const from =
    (
      currentPage - 1
    ) *
    safePageSize +
    1;

  const to =
    Math.min(
      currentPage *
      safePageSize,
      safeTotal
    );

  const goToPage = (
    nextPage
  ) => {
    if (
      typeof setPage !==
      "function"
    ) {
      return;
    }

    setPage(
      Math.min(
        totalPages,
        Math.max(
          1,
          Number(nextPage || 1)
        )
      )
    );
  };

  const handlePageSize =
    (event) => {
      const nextSize =
        Number(
          event.target.value
        );

      if (
        typeof setPageSize ===
        "function" &&
        Number.isFinite(
          nextSize
        ) &&
        nextSize > 0
      ) {
        setPageSize(
          nextSize
        );
      }

      if (
        typeof setPage ===
        "function"
      ) {
        setPage(1);
      }
    };

  return (
    <div
      style={{
        ...professionalPager,
        ...(compact
          ? professionalPagerCompact
          : {}),
      }}
    >
      <div style={pagerInfo}>
        <div style={pagerRange}>
          Showing{" "}
          <strong>
            {from}–{to}
          </strong>{" "}
          of{" "}
          <strong>
            {safeTotal}
          </strong>{" "}
          {label}
        </div>

        <div style={pagerMeta}>
          Page{" "}
          <strong>
            {currentPage}
          </strong>{" "}
          of{" "}
          <strong>
            {totalPages}
          </strong>
        </div>
      </div>

      <div style={pagerControls}>
        {typeof setPageSize ===
          "function" && (
            <label
              style={{
                ...pagerRowsControl,
                ...(compact
                  ? pagerRowsControlCompact
                  : {}),
              }}
            >
              <span style={pagerRowsLabel}>
                Rows
              </span>

              <select
                value={safePageSize}
                onChange={
                  handlePageSize
                }
                style={pagerSelect}
                aria-label="Rows per page"
              >
                {pageSizeOptions.map(
                  (size) => (
                    <option
                      key={size}
                      value={size}
                    >
                      {size}
                    </option>
                  )
                )}
              </select>
            </label>
          )}

        <div style={pagerDivider} />

        <div style={pagerButtons}>
          <PagerButton
            title="First page"
            disabled={
              currentPage === 1
            }
            onClick={() =>
              goToPage(1)
            }
            compact={compact}
          >
            «
          </PagerButton>

          <PagerButton
            title="Previous page"
            disabled={
              currentPage === 1
            }
            onClick={() =>
              goToPage(
                currentPage - 1
              )
            }
            compact={compact}
          >
            ‹
          </PagerButton>

          {pageItems.map(
            (item) => {
              if (
                typeof item !==
                "number"
              ) {
                return (
                  <span
                    key={item}
                    style={pagerEllipsis}
                  >
                    …
                  </span>
                );
              }

              return (
                <PagerButton
                  key={item}
                  title={`Page ${item}`}
                  active={
                    item ===
                    currentPage
                  }
                  onClick={() =>
                    goToPage(item)
                  }
                  compact={compact}
                >
                  {item}
                </PagerButton>
              );
            }
          )}

          <PagerButton
            title="Next page"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              goToPage(
                currentPage + 1
              )
            }
            compact={compact}
          >
            ›
          </PagerButton>

          <PagerButton
            title="Last page"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              goToPage(
                totalPages
              )
            }
            compact={compact}
          >
            »
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function PagerButton({
  children,
  title,
  disabled = false,
  active = false,
  onClick,
  compact = false,
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-current={
        active
          ? "page"
          : undefined
      }
      onClick={onClick}
      style={{
        ...pagerButton,
        ...(compact
          ? pagerButtonCompact
          : {}),
        ...(active
          ? pagerButtonActive
          : {}),
        ...(disabled
          ? pagerButtonDisabled
          : {}),
      }}
    >
      {children}
    </button>
  );
}


function LogisticsDashboard({
  StatCard,
}) {
  const [section, setSection] =
    useState("summary");
  const [period, setPeriod] =
    useState("7D");
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [loadError, setLoadError] =
    useState("");
  const [challans, setChallans] =
    useState([]);
  const [shifts, setShifts] =
    useState([]);
  const [drivers, setDrivers] =
    useState([]);
  const [vehicles, setVehicles] =
    useState([]);

  const [
    reportDriverKey,
    setReportDriverKey,
  ] = useState("");

  const [
    reportVehicleKey,
    setReportVehicleKey,
  ] = useState("");

  const [
    reportStatus,
    setReportStatus,
  ] = useState("ALL");

  const [
    reportSearch,
    setReportSearch,
  ] = useState("");

  const [
    reportGenerating,
    setReportGenerating,
  ] = useState("");

  const mountedRef = useRef(true);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(
    async ({ refresh = false } = {}) => {
      const requestId =
        latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setLoadError("");

        const results = await Promise.allSettled([
          fetchDispatchChallans(),
          fetchShifts(),
          fetchDrivers(),
          fetchVehicles(),
        ]);

        if (
          !mountedRef.current ||
          requestId !== latestRequestRef.current
        ) {
          return;
        }

        const [
          challanResult,
          shiftResult,
          driverResult,
          vehicleResult,
        ] = results;

        const failedSources = [];

        if (challanResult.status === "fulfilled") {
          setChallans(
            Array.isArray(challanResult.value)
              ? challanResult.value
              : []
          );
        } else {
          console.error(
            "Dispatch challan dashboard load failed",
            challanResult.reason
          );
          failedSources.push("dispatch challans");
        }

        if (shiftResult.status === "fulfilled") {
          setShifts(
            Array.isArray(shiftResult.value)
              ? shiftResult.value
              : []
          );
        } else {
          console.error(
            "Manual shift dashboard load failed",
            shiftResult.reason
          );
          failedSources.push("manual operations");
        }

        if (driverResult.status === "fulfilled") {
          setDrivers(
            Array.isArray(driverResult.value)
              ? driverResult.value
              : []
          );
        } else {
          console.error(
            "Driver dashboard load failed",
            driverResult.reason
          );
          failedSources.push("drivers");
        }

        if (vehicleResult.status === "fulfilled") {
          setVehicles(
            Array.isArray(vehicleResult.value)
              ? vehicleResult.value
              : []
          );
        } else {
          console.error(
            "Vehicle dashboard load failed",
            vehicleResult.reason
          );
          failedSources.push("vehicles");
        }

        if (
          failedSources.length ===
          results.length
        ) {
          throw new Error(
            "Unable to load logistics dashboard"
          );
        }

        if (failedSources.length > 0) {
          setLoadError(
            `Unable to refresh ${failedSources.join(
              ", "
            )}. Other available logistics data is still shown.`
          );
        }
      } catch (error) {
        console.error(error);

        if (
          mountedRef.current &&
          requestId === latestRequestRef.current
        ) {
          setLoadError(
            error?.message ||
            "Unable to load logistics dashboard"
          );
        }
      } finally {
        if (
          mountedRef.current &&
          requestId === latestRequestRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const driverLookup = useMemo(
    () => buildDriverLookup(drivers),
    [drivers]
  );

  const vehicleLookup = useMemo(
    () => buildVehicleLookup(vehicles),
    [vehicles]
  );

  const runningChallans = useMemo(
    () =>
      challans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "RUNNING"
      ),
    [challans]
  );

  const activeManualShifts = useMemo(
    () =>
      shifts.filter(
        (shift) =>
          normalizeStatus(shift?.status) ===
          "WORKING"
      ),
    [shifts]
  );

  const periodChallans = useMemo(
    () =>
      challans.filter((challan) =>
        isInPeriod(
          getChallanStart(challan),
          period
        )
      ),
    [challans, period]
  );

  const periodShifts = useMemo(
    () =>
      shifts.filter((shift) =>
        isInPeriod(getShiftStart(shift), period)
      ),
    [shifts, period]
  );

  const analytics = useMemo(() => {
    const completedPeriodChallans =
      periodChallans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "COMPLETED"
      );

    const cancelledPeriodChallans =
      periodChallans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "CANCELLED"
      );

    const completedManual = periodShifts.filter(
      (shift) =>
        normalizeStatus(shift?.status) ===
        "COMPLETED"
    );

    const cancelledManual = periodShifts.filter(
      (shift) =>
        normalizeStatus(shift?.status) ===
        "CANCELLED"
    );

    const offManual = periodShifts.filter(
      (shift) =>
        ["OFF", "ON_LEAVE"].includes(
          normalizeStatus(shift?.status)
        )
    );

    const operationalManual = periodShifts.filter(
      (shift) =>
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
    );

    const totalDispatchedItems =
      periodChallans.reduce(
        (sum, challan) =>
          sum + safeNumber(challan?.totalItems),
        0
      );

    const activeDispatchedItems =
      runningChallans.reduce(
        (sum, challan) =>
          sum + safeNumber(challan?.totalItems),
        0
      );

    const totalHelpers = operationalManual.reduce(
      (sum, shift) =>
        sum +
        safeNumber(
          shift?.totalLoaders ??
          shift?.totalHelpers
        ),
      0
    );

    const totalFuel = operationalManual.reduce(
      (sum, shift) =>
        sum + safeNumber(shift?.fuelUsed),
      0
    );

    const totalDistance =
      operationalManual.reduce(
        (sum, shift) =>
          sum + safeNumber(shift?.totalDistance),
        0
      );

    const manualTripEntries =
      operationalManual.reduce(
        (sum, shift) =>
          sum + safeNumber(shift?.totalTrips),
        0
      );

    const activeDriverKeys = new Set();
    const activeVehicleKeys = new Set();

    runningChallans.forEach((challan) => {
      const driver = getDriverIdentity(
        challan?.driverId ||
        challan?.driver?.id,
        challan?.driverName ||
        challan?.driver?.name,
        driverLookup
      );

      const vehicle = getVehicleIdentity(
        challan?.vehicleId ||
        challan?.vehicle?.id,
        challan?.vehicleNumber ||
        challan?.vehicle?.vehicleNumber,
        vehicleLookup
      );

      if (driver) activeDriverKeys.add(driver.key);
      if (vehicle) activeVehicleKeys.add(vehicle.key);
    });

    activeManualShifts.forEach((shift) => {
      const driver = getDriverIdentity(
        shift?.driver?.id || shift?.driverId,
        shift?.driver?.name ||
        shift?.driverName,
        driverLookup
      );

      const vehicle = getVehicleIdentity(
        shift?.vehicle?.id ||
        shift?.vehicleId,
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber,
        vehicleLookup
      );

      if (driver) activeDriverKeys.add(driver.key);
      if (vehicle) activeVehicleKeys.add(vehicle.key);
    });

    const challansMissingDriver =
      runningChallans.filter(
        (challan) =>
          isMissingValue(challan?.driverName)
      ).length;

    const challansMissingVehicle =
      runningChallans.filter(
        (challan) =>
          isMissingValue(challan?.vehicleNumber)
      ).length;

    const longRunningChallans =
      runningChallans.filter(
        (challan) =>
          calculateRunningMinutes(
            getChallanStart(challan)
          ) >
          12 * 60
      ).length;

    const noStartTimeChallans =
      runningChallans.filter(
        (challan) =>
          !parseBusinessDateTime(
            getChallanStart(challan)
          )
      ).length;

    const completedDurations =
      completedPeriodChallans
        .map((challan) =>
          calculateDurationMinutes(
            getChallanStart(challan),
            challan?.tripEndedAt,
            challan?.tripDurationMinutes
          )
        )
        .filter((minutes) => minutes > 0);

    const avgTripDuration =
      completedDurations.length > 0
        ? completedDurations.reduce(
          (sum, value) => sum + value,
          0
        ) / completedDurations.length
        : 0;

    const completionRate =
      periodChallans.length > 0
        ? (completedPeriodChallans.length /
          periodChallans.length) *
        100
        : 0;

    const averageItemsPerChallan =
      periodChallans.length > 0
        ? totalDispatchedItems /
        periodChallans.length
        : 0;

    const activeDrivers = activeDriverKeys.size;
    const activeVehicles = activeVehicleKeys.size;

    const driverAssignmentRate =
      drivers.length > 0
        ? Math.min(
          100,
          (activeDrivers / drivers.length) *
          100
        )
        : 0;

    const vehicleUtilization =
      vehicles.length > 0
        ? Math.min(
          100,
          (activeVehicles / vehicles.length) *
          100
        )
        : 0;

    const routeCounts = {
      FACTORY: 0,
      RESIDENTIAL: 0,
      WAREHOUSE: 0,
      MALL: 0,
      OTHER: 0,
    };

    operationalManual.forEach((shift) => {
      const route = normalizeStatus(
        shift?.routeCategory
      );

      if (
        Object.prototype.hasOwnProperty.call(
          routeCounts,
          route
        )
      ) {
        routeCounts[route] += 1;
      } else {
        routeCounts.OTHER += 1;
      }
    });

    return {
      periodLabel: getPeriodLabel(period),
      totalChallans: periodChallans.length,
      runningChallans: runningChallans.length,
      completedChallans:
        completedPeriodChallans.length,
      cancelledChallans:
        cancelledPeriodChallans.length,
      totalDispatchedItems,
      activeDispatchedItems,
      averageItemsPerChallan,
      completionRate,
      avgTripDuration,
      totalManualRecords: periodShifts.length,
      activeManualOperations:
        activeManualShifts.length,
      completedManualOperations:
        completedManual.length,
      cancelledManualOperations:
        cancelledManual.length,
      availabilityRecords: offManual.length,
      manualTripEntries,
      totalHelpers,
      totalFuel,
      totalDistance,
      overShiftManualCount:
        operationalManual.filter(
          isShiftOverSixPm
        ).length,
      totalDrivers: drivers.length,
      activeDrivers,
      driverAssignmentRate,
      totalVehicles: vehicles.length,
      activeVehicles,
      vehicleUtilization,
      challansMissingDriver,
      challansMissingVehicle,
      longRunningChallans,
      noStartTimeChallans,
      attentionCount:
        challansMissingDriver +
        challansMissingVehicle +
        longRunningChallans +
        noStartTimeChallans,
      routeCounts,
    };
  }, [
    period,
    periodChallans,
    periodShifts,
    runningChallans,
    activeManualShifts,
    drivers,
    vehicles,
    driverLookup,
    vehicleLookup,
  ]);

  const driverPerformance = useMemo(() => {
    const map = new Map();

    const ensureDriver = (
      driverId,
      driverName
    ) => {
      const identity = getDriverIdentity(
        driverId,
        driverName,
        driverLookup
      );

      if (!identity) return null;

      if (!map.has(identity.key)) {
        map.set(identity.key, {
          key: identity.key,
          name: identity.name,
          challans: 0,
          completedChallans: 0,
          activeChallans: 0,
          dispatchedItems: 0,
          manualOperations: 0,
          manualTrips: 0,
          lastActivityAt: null,
        });
      }

      return map.get(identity.key);
    };

    periodChallans.forEach((challan) => {
      const row = ensureDriver(
        challan?.driverId ||
        challan?.driver?.id,
        challan?.driverName ||
        challan?.driver?.name
      );

      if (!row) return;

      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );

      const lifecycle =
        getChallanLifecycleStatus(challan);

      if (lifecycle === "COMPLETED") {
        row.completedChallans += 1;
      }

      if (lifecycle === "RUNNING") {
        row.activeChallans += 1;
      }

      const start = parseBusinessDateTime(
        getChallanStart(challan)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    periodShifts.forEach((shift) => {
      const row = ensureDriver(
        shift?.driver?.id || shift?.driverId,
        shift?.driver?.name ||
        shift?.driverName
      );

      if (!row) return;

      if (
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        row.manualOperations += 1;
        row.manualTrips += safeNumber(
          shift?.totalTrips
        );
      }

      const start = parseBusinessDateTime(
        getShiftStart(shift)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        activityCount:
          row.challans +
          row.manualOperations,
      }))
      .sort((a, b) =>
        b.activityCount - a.activityCount ||
        b.dispatchedItems -
        a.dispatchedItems ||
        a.name.localeCompare(b.name)
      );
  }, [
    periodChallans,
    periodShifts,
    driverLookup,
  ]);

  const vehiclePerformance = useMemo(() => {
    const map = new Map();

    const ensureVehicle = (
      vehicleId,
      vehicleNumber
    ) => {
      const identity = getVehicleIdentity(
        vehicleId,
        vehicleNumber,
        vehicleLookup
      );

      if (!identity) return null;

      if (!map.has(identity.key)) {
        map.set(identity.key, {
          key: identity.key,
          number: identity.number,
          challans: 0,
          completedChallans: 0,
          activeChallans: 0,
          dispatchedItems: 0,
          manualOperations: 0,
          manualTrips: 0,
          lastActivityAt: null,
        });
      }

      return map.get(identity.key);
    };

    periodChallans.forEach((challan) => {
      const row = ensureVehicle(
        challan?.vehicleId ||
        challan?.vehicle?.id,
        challan?.vehicleNumber ||
        challan?.vehicle?.vehicleNumber
      );

      if (!row) return;

      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );

      const lifecycle =
        getChallanLifecycleStatus(challan);

      if (lifecycle === "COMPLETED") {
        row.completedChallans += 1;
      }

      if (lifecycle === "RUNNING") {
        row.activeChallans += 1;
      }

      const start = parseBusinessDateTime(
        getChallanStart(challan)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    periodShifts.forEach((shift) => {
      const row = ensureVehicle(
        shift?.vehicle?.id ||
        shift?.vehicleId,
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber
      );

      if (!row) return;

      if (
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        row.manualOperations += 1;
        row.manualTrips += safeNumber(
          shift?.totalTrips
        );
      }

      const start = parseBusinessDateTime(
        getShiftStart(shift)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        activityCount:
          row.challans +
          row.manualOperations,
      }))
      .sort((a, b) =>
        b.activityCount - a.activityCount ||
        b.dispatchedItems -
        a.dispatchedItems ||
        a.number.localeCompare(b.number)
      );
  }, [
    periodChallans,
    periodShifts,
    vehicleLookup,
  ]);

  const reportOperationRows =
    useMemo(
      () =>
        buildReportOperationRows(
          periodChallans,
          periodShifts,
          driverLookup,
          vehicleLookup
        ),
      [
        periodChallans,
        periodShifts,
        driverLookup,
        vehicleLookup,
      ]
    );

  const reportDriverOptions =
    useMemo(
      () =>
        aggregateReportRows(
          reportOperationRows,
          "DRIVER"
        ),
      [reportOperationRows]
    );

  const reportVehicleOptions =
    useMemo(
      () =>
        aggregateReportRows(
          reportOperationRows,
          "VEHICLE"
        ),
      [reportOperationRows]
    );

  const filteredReportOperations =
    useMemo(() => {
      const searchTerm =
        reportSearch
          .trim()
          .toLowerCase();

      return reportOperationRows.filter(
        (operation) => {
          if (
            reportDriverKey &&
            operation.driverKey !==
            reportDriverKey
          ) {
            return false;
          }

          if (
            reportVehicleKey &&
            operation.vehicleKey !==
            reportVehicleKey
          ) {
            return false;
          }

          if (
            reportStatus !== "ALL" &&
            normalizeStatus(
              operation.status
            ) !== reportStatus
          ) {
            return false;
          }

          if (searchTerm) {
            const searchable = [
              operation.source,
              operation.recordId,
              operation.challanNumber,
              operation.driverName,
              operation.vehicleNumber,
              operation.routeCategory,
              operation.status,
              operation.dispatchedBy,
              operation.remarks,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            if (
              !searchable.includes(
                searchTerm
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      reportOperationRows,
      reportDriverKey,
      reportVehicleKey,
      reportStatus,
      reportSearch,
    ]);

  const reportDriverRows =
    useMemo(
      () =>
        aggregateReportRows(
          filteredReportOperations,
          "DRIVER"
        ),
      [filteredReportOperations]
    );

  const reportVehicleRows =
    useMemo(
      () =>
        aggregateReportRows(
          filteredReportOperations,
          "VEHICLE"
        ),
      [filteredReportOperations]
    );

  const reportItemRows =
    useMemo(() => {
      const rows = [];

      filteredReportOperations
        .filter(
          (operation) =>
            operation.source ===
            REPORT_SOURCE.CHALLAN
        )
        .forEach((operation) => {
          const items =
            Array.isArray(
              operation.rawItems
            )
              ? operation.rawItems
              : [];

          items.forEach(
            (item, index) => {
              rows.push({
                key:
                  `${operation.key}:ITEM:${item?.id || item?.zohoItemId || index}`,
                challanNumber:
                  operation.challanNumber ||
                  operation.recordId,
                dispatchAt:
                  operation.startAt,
                driverName:
                  operation.driverName,
                vehicleNumber:
                  operation.vehicleNumber,
                itemName:
                  item?.name ||
                  item?.itemName ||
                  "—",
                sku:
                  item?.sku ||
                  item?.codeSku ||
                  "—",
                pdNo:
                  item?.pdNo ||
                  item?.packetNo ||
                  "—",
                drawingNo:
                  item?.drawingNo ||
                  item?.dwgNo ||
                  "—",
                clientName:
                  item?.clientName ||
                  item?.customerName ||
                  "—",
                plantCode:
                  item?.plantCode ||
                  item?.plant ||
                  "—",
                description:
                  item?.description ||
                  "—",
                status:
                  item?.status ||
                  operation.status,
              });
            }
          );
        });

      return rows;
    }, [filteredReportOperations]);

  const reportFilterSummary =
    useMemo(() => {
      const driverLabel =
        reportDriverOptions.find(
          (row) =>
            row.key ===
            reportDriverKey
        )?.label || "";

      const vehicleLabel =
        reportVehicleOptions.find(
          (row) =>
            row.key ===
            reportVehicleKey
        )?.label || "";

      return createReportFilterSummary({
        periodLabel:
          analytics.periodLabel,
        driverLabel,
        vehicleLabel,
        status: reportStatus,
        search: reportSearch.trim(),
      });
    }, [
      analytics.periodLabel,
      reportDriverOptions,
      reportVehicleOptions,
      reportDriverKey,
      reportVehicleKey,
      reportStatus,
      reportSearch,
    ]);

  const clearReportFilters = () => {
    setReportDriverKey("");
    setReportVehicleKey("");
    setReportStatus("ALL");
    setReportSearch("");
  };

  const downloadLogisticsWorkbook =
    async (mode) => {
      if (reportGenerating) {
        return;
      }

      try {
        setReportGenerating(mode);

        const [
          excelModule,
          fileSaverModule,
        ] = await Promise.all([
          import("exceljs"),
          import("file-saver"),
        ]);

        const ExcelJS =
          excelModule.default ||
          excelModule;

        const saveAs =
          fileSaverModule.saveAs ||
          fileSaverModule.default
            ?.saveAs ||
          fileSaverModule.default;

        if (
          !ExcelJS?.Workbook ||
          typeof saveAs !==
          "function"
        ) {
          throw new Error(
            "Excel export dependencies are unavailable"
          );
        }

        const workbook =
          new ExcelJS.Workbook();

        workbook.creator =
          "ALSORG Logistics Management";
        workbook.company =
          "ALSORG";
        workbook.subject =
          "Logistics Management Report";
        workbook.title =
          "ALSORG Logistics Management Report";
        workbook.created =
          new Date();

        const generatedAt =
          new Intl.DateTimeFormat(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }
          ).format(new Date());

        const reportTitle =
          mode === "DRIVER"
            ? "Driver Performance Report"
            : mode === "VEHICLE"
              ? "Vehicle Performance Report"
              : mode === "TRIP"
                ? "Trip & Challan Register"
                : "Logistics Management Pack";

        const subtitle =
          `${reportFilterSummary} • Generated: ${generatedAt}`;

        const addExecutiveSummary =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Executive Summary"
              );

            styleReportTitle(
              sheet,
              "ALSORG Logistics Management Summary",
              subtitle,
              4
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "KPI",
              "Value",
              "Business Meaning",
              "Scope",
            ];

            styleReportHeader(
              header
            );

            const completed =
              filteredReportOperations.filter(
                (row) =>
                  row.source ===
                  REPORT_SOURCE.CHALLAN &&
                  row.status ===
                  "COMPLETED"
              ).length;

            const challanCount =
              filteredReportOperations.filter(
                (row) =>
                  row.source ===
                  REPORT_SOURCE.CHALLAN
              ).length;

            const running =
              filteredReportOperations.filter(
                (row) =>
                  row.source ===
                  REPORT_SOURCE.CHALLAN &&
                  row.status ===
                  "RUNNING"
              ).length;

            const dispatchedItems =
              filteredReportOperations.reduce(
                (sum, row) =>
                  sum +
                  safeNumber(
                    row.itemCount
                  ),
                0
              );

            const manualOps =
              filteredReportOperations.filter(
                (row) =>
                  row.source ===
                  REPORT_SOURCE.MANUAL
              );

            const manualTrips =
              manualOps.reduce(
                (sum, row) =>
                  sum +
                  safeNumber(
                    row.tripCount
                  ),
                0
              );

            const totalDistance =
              manualOps.reduce(
                (sum, row) =>
                  sum +
                  safeNumber(
                    row.distance
                  ),
                0
              );

            const totalFuel =
              manualOps.reduce(
                (sum, row) =>
                  sum +
                  safeNumber(
                    row.fuel
                  ),
                0
              );

            const summaryRows = [
              [
                "Dispatch Challans",
                challanCount,
                "Item-based dispatch trips in selected report filters",
                analytics.periodLabel,
              ],
              [
                "Completed Challans",
                completed,
                "Challans with trip end/completed status",
                analytics.periodLabel,
              ],
              [
                "Running Challans",
                running,
                "Open challan trips requiring operational tracking",
                "Live + selected filters",
              ],
              [
                "Completion Rate",
                challanCount
                  ? completed /
                  challanCount
                  : 0,
                "Completed challans divided by dispatch challans",
                analytics.periodLabel,
              ],
              [
                "Dispatched Items",
                dispatchedItems,
                "Total packet/item rows carried by dispatch challans",
                analytics.periodLabel,
              ],
              [
                "Drivers Represented",
                reportDriverRows.length,
                "Drivers with activity in filtered report",
                analytics.periodLabel,
              ],
              [
                "Vehicles Represented",
                reportVehicleRows.length,
                "Vehicles with activity in filtered report",
                analytics.periodLabel,
              ],
              [
                "Manual Operations",
                manualOps.length,
                "Non-challan / legacy movement records",
                analytics.periodLabel,
              ],
              [
                "Manual Trip Entries",
                manualTrips,
                "Trip count recorded inside manual operations",
                "Manual records only",
              ],
              [
                "Manual Distance",
                totalDistance,
                "Distance recorded in manual operations",
                "Manual records only",
              ],
              [
                "Manual Fuel",
                totalFuel,
                "Fuel recorded in manual operations",
                "Manual records only",
              ],
            ];

            summaryRows.forEach(
              (values) => {
                sheet.addRow(values);
              }
            );

            sheet.getColumn(2)
              .numFmt = "0.00";

            const completionRow =
              sheet.getRow(8);

            completionRow.getCell(2)
              .numFmt = "0.0%";

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  26,
                  16,
                  52,
                  24,
                ],
                landscape: false,
              }
            );
          };

        const addDriverSheet =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Driver Performance"
              );

            styleReportTitle(
              sheet,
              "Driver Performance Report",
              subtitle,
              14
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "Driver",
              "Activities",
              "Challans",
              "Completed",
              "Running",
              "Completion %",
              "Dispatched Items",
              "Manual Ops",
              "Manual Trips",
              "Helpers",
              "Distance",
              "Fuel",
              "Avg Duration",
              "Last Activity",
            ];

            styleReportHeader(
              header
            );

            reportDriverRows.forEach(
              (row) => {
                const excelRow =
                  sheet.addRow([
                    row.label,
                    row.totalActivities,
                    row.challans,
                    row.completedChallans,
                    row.runningChallans,
                    row.completionRate /
                    100,
                    row.dispatchedItems,
                    row.manualOperations,
                    row.manualTrips,
                    row.helpers,
                    row.distance,
                    row.fuel,
                    formatDuration(
                      row.averageDurationMinutes
                    ),
                    row.lastActivityAt
                      ? formatDateTime(
                        row.lastActivityAt
                      )
                      : "—",
                  ]);

                excelRow.getCell(6)
                  .numFmt =
                  "0.0%";
                excelRow.getCell(11)
                  .numFmt =
                  "0.00";
                excelRow.getCell(12)
                  .numFmt =
                  "0.00";
              }
            );

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  24,
                  12,
                  11,
                  11,
                  10,
                  14,
                  16,
                  13,
                  13,
                  10,
                  12,
                  10,
                  16,
                  22,
                ],
              }
            );
          };

        const addVehicleSheet =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Vehicle Performance"
              );

            styleReportTitle(
              sheet,
              "Vehicle Performance Report",
              subtitle,
              14
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "Vehicle",
              "Activities",
              "Challans",
              "Completed",
              "Running",
              "Completion %",
              "Dispatched Items",
              "Manual Ops",
              "Manual Trips",
              "Helpers",
              "Distance",
              "Fuel",
              "Avg Duration",
              "Last Activity",
            ];

            styleReportHeader(
              header
            );

            reportVehicleRows.forEach(
              (row) => {
                const excelRow =
                  sheet.addRow([
                    row.label,
                    row.totalActivities,
                    row.challans,
                    row.completedChallans,
                    row.runningChallans,
                    row.completionRate /
                    100,
                    row.dispatchedItems,
                    row.manualOperations,
                    row.manualTrips,
                    row.helpers,
                    row.distance,
                    row.fuel,
                    formatDuration(
                      row.averageDurationMinutes
                    ),
                    row.lastActivityAt
                      ? formatDateTime(
                        row.lastActivityAt
                      )
                      : "—",
                  ]);

                excelRow.getCell(6)
                  .numFmt =
                  "0.0%";
                excelRow.getCell(11)
                  .numFmt =
                  "0.00";
                excelRow.getCell(12)
                  .numFmt =
                  "0.00";
              }
            );

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  22,
                  12,
                  11,
                  11,
                  10,
                  14,
                  16,
                  13,
                  13,
                  10,
                  12,
                  10,
                  16,
                  22,
                ],
              }
            );
          };

        const addTripSheet =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Trip Register"
              );

            styleReportTitle(
              sheet,
              "Trip / Challan Activity Register",
              subtitle,
              17
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "Source",
              "Record / Challan",
              "Driver",
              "Vehicle",
              "Start Date & Time",
              "End Date & Time",
              "Duration",
              "Status",
              "Items",
              "Trips",
              "Helpers",
              "Route",
              "Distance",
              "Fuel",
              "Overtime",
              "Dispatched By",
              "Remarks",
            ];

            styleReportHeader(
              header
            );

            filteredReportOperations.forEach(
              (operation) => {
                const excelRow =
                  sheet.addRow([
                    operation.source,
                    operation.recordId,
                    operation.driverName,
                    operation.vehicleNumber,
                    formatDateTime(
                      operation.startAt
                    ),
                    formatDateTime(
                      operation.endAt
                    ),
                    formatDuration(
                      operation.durationMinutes
                    ),
                    operation.status,
                    operation.itemCount,
                    operation.tripCount,
                    operation.helperCount,
                    operation.routeCategory ||
                    "—",
                    operation.distance,
                    operation.fuel,
                    operation.overtimeHours,
                    operation.dispatchedBy ||
                    "—",
                    operation.remarks ||
                    "—",
                  ]);

                styleStatusCell(
                  excelRow.getCell(8),
                  operation.status
                );

                excelRow.getCell(13)
                  .numFmt =
                  "0.00";
                excelRow.getCell(14)
                  .numFmt =
                  "0.00";
                excelRow.getCell(15)
                  .numFmt =
                  "0.00";
              }
            );

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  18,
                  22,
                  22,
                  18,
                  23,
                  23,
                  16,
                  14,
                  10,
                  10,
                  10,
                  18,
                  12,
                  10,
                  12,
                  20,
                  36,
                ],
              }
            );
          };

        const addItemSheet =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Dispatch Item Detail"
              );

            styleReportTitle(
              sheet,
              "Dispatch Item Detail",
              subtitle,
              12
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "Challan",
              "Dispatch Date & Time",
              "Driver",
              "Vehicle",
              "Item",
              "SKU",
              "PD No.",
              "DWG No.",
              "Client",
              "Plant",
              "Description",
              "Status",
            ];

            styleReportHeader(
              header
            );

            reportItemRows.forEach(
              (item) => {
                const excelRow =
                  sheet.addRow([
                    item.challanNumber,
                    formatDateTime(
                      item.dispatchAt
                    ),
                    item.driverName,
                    item.vehicleNumber,
                    item.itemName,
                    item.sku,
                    item.pdNo,
                    item.drawingNo,
                    item.clientName,
                    item.plantCode,
                    item.description,
                    item.status,
                  ]);

                styleStatusCell(
                  excelRow.getCell(12),
                  item.status
                );
              }
            );

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  22,
                  23,
                  22,
                  18,
                  30,
                  22,
                  16,
                  16,
                  24,
                  14,
                  42,
                  14,
                ],
              }
            );
          };

        const addDefinitionsSheet =
          () => {
            const sheet =
              workbook.addWorksheet(
                "Report Notes"
              );

            styleReportTitle(
              sheet,
              "ALSORG Logistics Report Definitions",
              subtitle,
              3
            );

            const header =
              sheet.getRow(4);

            header.values = [
              "Metric / Source",
              "Definition",
              "Important Note",
            ];

            styleReportHeader(
              header
            );

            [
              [
                "Dispatch Challan",
                "Current item-based trip created from dispatched packet/item rows.",
                "Primary current trip source.",
              ],
              [
                "Manual / Legacy",
                "Non-challan movement or historical shift record.",
                "Used for route, fuel, distance, helper and overtime metrics.",
              ],
              [
                "Completion Rate",
                "Completed dispatch challans divided by dispatch challans in the filtered report.",
                "Manual records are not included in this percentage.",
              ],
              [
                "Fuel / Distance / Overtime",
                "Values recorded on manual operations.",
                "Not inferred for dispatch challans where backend data does not provide them.",
              ],
              [
                "Driver / Vehicle Matching",
                "Master ID is used first; normalized name/vehicle number is used as fallback.",
                "This prevents duplicate identities where possible.",
              ],
              [
                "Report Filters",
                reportFilterSummary,
                "Every workbook sheet uses the same active filters.",
              ],
            ].forEach(
              (values) =>
                sheet.addRow(values)
            );

            styleReportBody(
              sheet,
              5,
              sheet.rowCount
            );

            finalizeReportSheet(
              sheet,
              {
                headerRow: 4,
                columnWidths: [
                  28,
                  62,
                  62,
                ],
                landscape: false,
              }
            );
          };

        if (mode === "ALL") {
          addExecutiveSummary();
          addDriverSheet();
          addVehicleSheet();
          addTripSheet();
          addItemSheet();
          addDefinitionsSheet();
        } else if (
          mode === "DRIVER"
        ) {
          addDriverSheet();
          addTripSheet();
          addDefinitionsSheet();
        } else if (
          mode === "VEHICLE"
        ) {
          addVehicleSheet();
          addTripSheet();
          addDefinitionsSheet();
        } else {
          addTripSheet();
          addItemSheet();
          addDefinitionsSheet();
        }

        const buffer =
          await workbook.xlsx
            .writeBuffer();

        const dateStamp =
          new Date()
            .toISOString()
            .slice(0, 10);

        const fileName =
          `ALSORG_Logistics_${mode}_${analytics.periodLabel.replace(/\s+/g, "_")}_${dateStamp}.xlsx`;

        saveAs(
          new Blob([buffer], {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          fileName
        );
      } catch (error) {
        console.error(
          "Logistics report export failed",
          error
        );

        window.alert(
          error?.message ||
          "Unable to generate logistics Excel report"
        );
      } finally {
        setReportGenerating("");
      }
    };

  const attentionRows = useMemo(() => {
    const rows = [];

    runningChallans.forEach((challan) => {
      const startAt = getChallanStart(challan);
      const runningMinutes =
        calculateRunningMinutes(startAt);
      const challanNumber =
        challan?.challanNumber || "—";

      if (runningMinutes > 12 * 60) {
        rows.push({
          key: `LONG:${challanNumber}`,
          severity: "HIGH",
          title: "Long running challan trip",
          detail: `${challanNumber} • ${formatDuration(
            runningMinutes
          )} running • ${challan?.driverName || "No driver"
            } • ${challan?.vehicleNumber || "No vehicle"
            }`,
          startedAt: startAt,
        });
      }

      if (isMissingValue(challan?.driverName)) {
        rows.push({
          key: `DRIVER:${challanNumber}`,
          severity: "MEDIUM",
          title: "Driver missing",
          detail: `${challanNumber} has no driver assigned`,
          startedAt: startAt,
        });
      }

      if (isMissingValue(challan?.vehicleNumber)) {
        rows.push({
          key: `VEHICLE:${challanNumber}`,
          severity: "MEDIUM",
          title: "Vehicle missing",
          detail: `${challanNumber} has no vehicle assigned`,
          startedAt: startAt,
        });
      }

      if (!parseBusinessDateTime(startAt)) {
        rows.push({
          key: `START:${challanNumber}`,
          severity: "MEDIUM",
          title: "Trip start time missing",
          detail: `${challanNumber} is running without a valid start timestamp`,
          startedAt: null,
        });
      }
    });

    return rows.sort((a, b) => {
      const severityRank = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };

      const rankDiff =
        (severityRank[b.severity] || 0) -
        (severityRank[a.severity] || 0);

      if (rankDiff !== 0) return rankDiff;

      const aTime =
        parseBusinessDateTime(a.startedAt)
          ?.getTime() || 0;
      const bTime =
        parseBusinessDateTime(b.startedAt)
          ?.getTime() || 0;

      return aTime - bTime;
    });
  }, [runningChallans]);

  const recentActivity = useMemo(() => {
    const rows = [];

    periodChallans.forEach((challan) => {
      rows.push({
        key: `CHALLAN:${challan?.challanNumber || getChallanStart(challan) || challan?.driverName || "UNKNOWN"}`,
        source: "Dispatch Challan",
        title:
          challan?.challanNumber ||
          "Dispatch Challan",
        subtitle: `${challan?.driverName || "No driver"} • ${challan?.vehicleNumber || "No vehicle"} • ${safeNumber(challan?.totalItems)} items`,
        status:
          getChallanLifecycleStatus(challan),
        at: getChallanStart(challan),
      });
    });

    periodShifts.forEach((shift) => {
      rows.push({
        key: `MANUAL:${shift?.id || getShiftStart(shift) || shift?.driver?.name || shift?.driverName || "UNKNOWN"}`,
        source: "Manual / Legacy",
        title:
          shift?.routeCategory ||
          "Manual Operation",
        subtitle: `${shift?.driver?.name || shift?.driverName || "No driver"} • ${shift?.vehicle?.vehicleNumber || shift?.vehicleNumber || "No vehicle"} • ${safeNumber(shift?.totalTrips)} trips`,
        status: normalizeStatus(
          shift?.status || "WORKING"
        ),
        at: getShiftStart(shift),
      });
    });

    return rows
      .sort((a, b) => {
        const aTime =
          parseBusinessDateTime(a.at)
            ?.getTime() || 0;
        const bTime =
          parseBusinessDateTime(b.at)
            ?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [periodChallans, periodShifts]);

  const timelineData = useMemo(() => {
    const map = new Map();

    const ensureRow = (dateKey) => {
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          date: formatChartDate(dateKey),
          challans: 0,
          manualOperations: 0,
          dispatchedItems: 0,
        });
      }

      return map.get(dateKey);
    };

    periodChallans.forEach((challan) => {
      const dateKey = getDateKey(
        getChallanStart(challan)
      );
      if (!dateKey) return;

      const row = ensureRow(dateKey);
      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );
    });

    periodShifts.forEach((shift) => {
      if (
        !["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        return;
      }

      const dateKey = getDateKey(
        getShiftStart(shift)
      );
      if (!dateKey) return;

      const row = ensureRow(dateKey);
      row.manualOperations += 1;
    });

    return Array.from(map.values())
      .sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey)
      )
      .slice(-14);
  }, [periodChallans, periodShifts]);

  const statusData = useMemo(
    () => [
      {
        name: "Running Challans",
        value: analytics.runningChallans,
        color: "#22c55e",
      },
      {
        name: "Completed Challans",
        value: analytics.completedChallans,
        color: "#3b82f6",
      },
      {
        name: "Active Manual",
        value: analytics.activeManualOperations,
        color: "#8b5cf6",
      },
      {
        name: "Completed Manual",
        value: analytics.completedManualOperations,
        color: "#06b6d4",
      },
      {
        name: "Cancelled",
        value:
          analytics.cancelledManualOperations +
          analytics.cancelledChallans,
        color: "#ef4444",
      },
      {
        name: "Off / Leave",
        value: analytics.availabilityRecords,
        color: "#f59e0b",
      },
    ].filter((entry) => entry.value > 0),
    [analytics]
  );

  const sectionData = useMemo(() => {
    switch (section) {
      case "dispatch":
        return {
          title: "Dispatch Challan Intelligence",
          subtitle: `${analytics.periodLabel} item-dispatch activity, completion and trip load`,
          cards: [
            {
              title: "Challans in Period",
              value: analytics.totalChallans,
              subtle: analytics.periodLabel,
              accent: "#60a5fa",
            },
            {
              title: "Running Now",
              value: analytics.runningChallans,
              subtle: "Awaiting trip end time",
              accent: "#22c55e",
            },
            {
              title: "Completion Rate",
              value: `${analytics.completionRate.toFixed(0)}%`,
              subtle: `${analytics.completedChallans} completed`,
              accent: "#3b82f6",
            },
            {
              title: "Dispatched Items",
              value: analytics.totalDispatchedItems,
              subtle: `${analytics.averageItemsPerChallan.toFixed(1)} avg / challan`,
              accent: "#8b5cf6",
            },
          ],
        };

      case "drivers":
        return {
          title: "Driver Operations Intelligence",
          subtitle: "Current assignments plus period-wise driver workload and dispatch output",
          cards: [
            {
              title: "Registered Drivers",
              value: analytics.totalDrivers,
              subtle: "Driver master records",
              accent: "#8b5cf6",
            },
            {
              title: "Drivers Active Now",
              value: analytics.activeDrivers,
              subtle: "Challan + manual operations",
              accent: "#22c55e",
            },
            {
              title: "Assignment Rate",
              value: `${analytics.driverAssignmentRate.toFixed(0)}%`,
              subtle: "Active / registered",
              accent: "#3b82f6",
            },
            {
              title: "Missing Driver",
              value: analytics.challansMissingDriver,
              subtle: "Running challans needing review",
              accent: "#ef4444",
            },
          ],
        };

      case "vehicles":
        return {
          title: "Vehicle Utilization Intelligence",
          subtitle: "Fleet usage, current assignments and period dispatch throughput",
          cards: [
            {
              title: "Registered Vehicles",
              value: analytics.totalVehicles,
              subtle: "Vehicle master records",
              accent: "#8b5cf6",
            },
            {
              title: "Vehicles Active Now",
              value: analytics.activeVehicles,
              subtle: "Current operational usage",
              accent: "#22c55e",
            },
            {
              title: "Fleet Utilization",
              value: `${analytics.vehicleUtilization.toFixed(0)}%`,
              subtle: "Active / registered",
              accent: "#3b82f6",
            },
            {
              title: "Missing Vehicle",
              value: analytics.challansMissingVehicle,
              subtle: "Running challans needing review",
              accent: "#ef4444",
            },
          ],
        };

      case "manual":
        return {
          title: "Manual & Legacy Operations",
          subtitle: `${analytics.periodLabel} non-challan activity kept separate from dispatch challans`,
          cards: [
            {
              title: "Manual Records",
              value: analytics.totalManualRecords,
              subtle: analytics.periodLabel,
              accent: "#8b5cf6",
            },
            {
              title: "Active Manual Ops",
              value: analytics.activeManualOperations,
              subtle: "Currently WORKING",
              accent: "#22c55e",
            },
            {
              title: "Manual Trip Entries",
              value: analytics.manualTripEntries,
              subtle: "Recorded trip count",
              accent: "#3b82f6",
            },
            {
              title: "Over Shift Records",
              value: analytics.overShiftManualCount,
              subtle: "Ended after 06:00 PM",
              accent: "#f59e0b",
            },
          ],
        };

      case "resources":
        return {
          title: "Manual Resource Analytics",
          subtitle: `${analytics.periodLabel} fuel, distance and helper metrics from manual records`,
          cards: [
            {
              title: "Helpers / Loaders",
              value: analytics.totalHelpers,
              subtle: "Manual records only",
              accent: "#22c55e",
            },
            {
              title: "Fuel Used",
              value: Number(analytics.totalFuel).toFixed(1),
              subtle: "Manual records only",
              accent: "#ef4444",
            },
            {
              title: "Distance Covered",
              value: Number(analytics.totalDistance).toFixed(1),
              subtle: "Manual records only",
              accent: "#3b82f6",
            },
            {
              title: "Completed Manual Ops",
              value: analytics.completedManualOperations,
              subtle: analytics.periodLabel,
              accent: "#8b5cf6",
            },
          ],
        };

      case "alerts":
        return {
          title: "Operational Attention Center",
          subtitle: "Live exceptions that management should review before they become delays",
          cards: [
            {
              title: "Attention Items",
              value: analytics.attentionCount,
              subtle: "Current live exceptions",
              accent: "#ef4444",
            },
            {
              title: "Long Running Trips",
              value: analytics.longRunningChallans,
              subtle: "Over 12 hours",
              accent: "#ef4444",
            },
            {
              title: "Missing Assignments",
              value:
                analytics.challansMissingDriver +
                analytics.challansMissingVehicle,
              subtle: "Driver / vehicle gaps",
              accent: "#f59e0b",
            },
            {
              title: "Missing Start Time",
              value: analytics.noStartTimeChallans,
              subtle: "Running challan data quality",
              accent: "#f59e0b",
            },
          ],
        };

      case "routes":
        return {
          title: "Manual Route Analysis",
          subtitle: `${analytics.periodLabel} route distribution from manual / legacy shifts`,
          cards: [
            {
              title: "Factory",
              value: analytics.routeCounts.FACTORY,
              subtle: "Manual route records",
              accent: "#3b82f6",
            },
            {
              title: "Residential",
              value: analytics.routeCounts.RESIDENTIAL,
              subtle: "Manual route records",
              accent: "#22c55e",
            },
            {
              title: "Warehouse",
              value: analytics.routeCounts.WAREHOUSE,
              subtle: "Manual route records",
              accent: "#f59e0b",
            },
            {
              title: "Mall / Other",
              value:
                analytics.routeCounts.MALL +
                analytics.routeCounts.OTHER,
              subtle: "Other manual routes",
              accent: "#8b5cf6",
            },
          ],
        };

      case "reports":
        return {
          title: "Logistics Reports & Excel Center",
          subtitle: `${analytics.periodLabel} professional management reporting by driver, vehicle and trip`,
          cards: [
            {
              title: "Filtered Activities",
              value:
                filteredReportOperations.length,
              subtle:
                "Challan + manual records",
              accent: "#60a5fa",
            },
            {
              title: "Drivers in Report",
              value:
                reportDriverRows.length,
              subtle:
                "Matched operational drivers",
              accent: "#8b5cf6",
            },
            {
              title: "Vehicles in Report",
              value:
                reportVehicleRows.length,
              subtle:
                "Matched fleet records",
              accent: "#22c55e",
            },
            {
              title: "Dispatch Item Rows",
              value:
                reportItemRows.length,
              subtle:
                "Item-level challan detail",
              accent: "#f59e0b",
            },
          ],
        };

      default:
        return {
          title: "Unified Logistics Command Center",
          subtitle: `${analytics.periodLabel} management view with live dispatch, driver, fleet and exception intelligence`,
          cards: [
            {
              title: "Live Operations",
              value:
                analytics.runningChallans +
                analytics.activeManualOperations,
              subtle: `${analytics.runningChallans} challan • ${analytics.activeManualOperations} manual`,
              accent: "#22c55e",
            },
            {
              title: "Period Challans",
              value: analytics.totalChallans,
              subtle: analytics.periodLabel,
              accent: "#60a5fa",
            },
            {
              title: "Dispatched Items",
              value: analytics.totalDispatchedItems,
              subtle: `${analytics.averageItemsPerChallan.toFixed(1)} avg / challan`,
              accent: "#8b5cf6",
            },
            {
              title: "Management Alerts",
              value: analytics.attentionCount,
              subtle: "Live attention items",
              accent:
                analytics.attentionCount > 0
                  ? "#ef4444"
                  : "#22c55e",
            },
          ],
        };
    }
  }, [
    section,
    analytics,
    filteredReportOperations.length,
    reportDriverRows.length,
    reportVehicleRows.length,
    reportItemRows.length,
  ]);

  const CardComponent =
    StatCard || DashboardStatCard;

  const showDriverPanel =
    section === "summary" ||
    section === "drivers";
  const showVehiclePanel =
    section === "vehicles";
  const showAttentionPanel =
    section === "summary" ||
    section === "alerts";
  const showRecentPanel =
    ["summary", "dispatch"].includes(section);

  return (
    <div
      style={layout}
      className="logistics-dashboard-shell"
    >
      <LogisticsDashboardScrollStyles />

      <ExecutiveSidebar
        section={section}
        setSection={setSection}
      />

      <div style={main}>
        <div style={topBar}>
          <div>
            <div style={header}>
              {sectionData.title}
            </div>
            <div style={subtitle}>
              {sectionData.subtitle}
            </div>
          </div>

          <div style={topActions}>
            <div style={periodSwitcher}>
              {PERIOD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() =>
                    setPeriod(option.value)
                  }
                  style={{
                    ...periodButton,
                    ...(period === option.value
                      ? periodButtonActive
                      : {}),
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setSection(
                  section === "reports"
                    ? "summary"
                    : "reports"
                )
              }
              style={{
                ...reportsNavButton,
                ...(section === "reports"
                  ? reportsNavButtonActive
                  : {}),
              }}
            >
              {section === "reports"
                ? "← Management Overview"
                : "📊 Reports & Excel"}
            </button>

            <button
              type="button"
              style={{
                ...refreshButton,
                opacity:
                  refreshing || loading
                    ? 0.65
                    : 1,
                cursor:
                  refreshing || loading
                    ? "not-allowed"
                    : "pointer",
              }}
              onClick={() =>
                loadDashboard({ refresh: true })
              }
              disabled={refreshing || loading}
            >
              <RefreshIcon
                sx={{ fontSize: 17 }}
              />
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <div style={liveBadge}>
              <span style={liveDot} />
              LIVE
            </div>
          </div>
        </div>

        {loadError && (
          <div style={warningBox}>
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={loadingBox}>
            Loading unified logistics analytics...
          </div>
        ) : (
          <>
            <div style={kpiGrid}>
              {sectionData.cards.map((card) => (
                <CardComponent
                  key={card.title}
                  accent={card.accent}
                  title={card.title}
                  value={card.value}
                  subtle={card.subtle}
                />
              ))}
            </div>

            {section === "reports" ? (
              <LogisticsReportCenter
                periodLabel={
                  analytics.periodLabel
                }
                filterSummary={
                  reportFilterSummary
                }
                driverOptions={
                  reportDriverOptions
                }
                vehicleOptions={
                  reportVehicleOptions
                }
                driverKey={
                  reportDriverKey
                }
                vehicleKey={
                  reportVehicleKey
                }
                status={
                  reportStatus
                }
                search={
                  reportSearch
                }
                onDriverChange={
                  setReportDriverKey
                }
                onVehicleChange={
                  setReportVehicleKey
                }
                onStatusChange={
                  setReportStatus
                }
                onSearchChange={
                  setReportSearch
                }
                onClear={
                  clearReportFilters
                }
                operationRows={
                  filteredReportOperations
                }
                driverRows={
                  reportDriverRows
                }
                vehicleRows={
                  reportVehicleRows
                }
                itemRowCount={
                  reportItemRows.length
                }
                generating={
                  reportGenerating
                }
                onDownload={
                  downloadLogisticsWorkbook
                }
              />
            ) : (
              <>
                <div style={managementPulseGrid}>
                  <PulseMetric
                    label="Completion Rate"
                    value={`${analytics.completionRate.toFixed(0)}%`}
                    detail={`${analytics.completedChallans}/${analytics.totalChallans || 0} challans`}
                  />
                  <PulseMetric
                    label="Avg Trip Duration"
                    value={formatDuration(
                      analytics.avgTripDuration
                    )}
                    detail="Completed challans"
                  />
                  <PulseMetric
                    label="Driver Assignment"
                    value={`${analytics.driverAssignmentRate.toFixed(0)}%`}
                    detail={`${analytics.activeDrivers}/${analytics.totalDrivers} active now`}
                  />
                  <PulseMetric
                    label="Fleet Utilization"
                    value={`${analytics.vehicleUtilization.toFixed(0)}%`}
                    detail={`${analytics.activeVehicles}/${analytics.totalVehicles} active now`}
                  />
                  <PulseMetric
                    label="Items Running"
                    value={analytics.activeDispatchedItems}
                    detail="On active challans"
                  />
                </div>

                <div style={sourceNote}>
                  <strong>Management data model:</strong> current item-based trips come from Dispatch Challans. Manual / legacy operations remain separate for fuel, distance, route, helper and overtime analytics, preventing double counting.
                </div>

                <div style={chartsGrid}>
                  <TripsLineChart data={timelineData} />
                  <StatusDistributionChart
                    data={statusData}
                  />
                </div>

                {(showDriverPanel ||
                  showVehiclePanel ||
                  showAttentionPanel) && (
                    <div style={managementPanelsGrid}>
                      {showDriverPanel && (
                        <RankingPanel
                          title="Driver Activity & Output"
                          subtitle={`${analytics.periodLabel} • challans, items and manual work`}
                          rows={driverPerformance.slice(0, 8)}
                          type="DRIVER"
                        />
                      )}

                      {showVehiclePanel && (
                        <RankingPanel
                          title="Fleet Activity & Throughput"
                          subtitle={`${analytics.periodLabel} • challans, items and manual work`}
                          rows={vehiclePerformance.slice(0, 10)}
                          type="VEHICLE"
                        />
                      )}

                      {showAttentionPanel && (
                        <AttentionPanel
                          rows={attentionRows}
                        />
                      )}
                    </div>
                  )}

                {showRecentPanel && (
                  <RecentActivityPanel
                    rows={recentActivity}
                    periodLabel={analytics.periodLabel}
                  />
                )}

                {section === "drivers" && (
                  <RankingPanel
                    title="Complete Driver Workload Table"
                    subtitle={`${analytics.periodLabel} driver-wise operational contribution`}
                    rows={driverPerformance}
                    type="DRIVER"
                    fullWidth
                  />
                )}

                {section === "vehicles" && (
                  <RankingPanel
                    title="Complete Vehicle Workload Table"
                    subtitle={`${analytics.periodLabel} vehicle-wise operational contribution`}
                    rows={vehiclePerformance}
                    type="VEHICLE"
                    fullWidth
                  />
                )}

                {section === "alerts" && (
                  <AttentionPanel
                    rows={attentionRows}
                    fullWidth
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PulseMetric({
  label,
  value,
  detail,
}) {
  return (
    <div style={pulseCard}>
      <div style={pulseLabel}>{label}</div>
      <div style={pulseValue}>{value}</div>
      <div style={pulseDetail}>{detail}</div>
    </div>
  );
}

function RankingPanel({
  title,
  subtitle,
  rows,
  type,
  fullWidth = false,
}) {
  const isDriver =
    type === "DRIVER";

  const [page, setPage] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(
    fullWidth ? 10 : 5
  );

  useEffect(() => {
    setPage(1);
  }, [
    rows.length,
    title,
    type,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        pageSize
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const visibleRows =
    rows.slice(
      (
        currentPage - 1
      ) *
      pageSize,
      currentPage *
      pageSize
    );

  return (
    <div
      style={{
        ...panelCard,
        ...(fullWidth
          ? {
            gridColumn:
              "1 / -1",
            marginTop: 20,
          }
          : {}),
      }}
    >
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            {title}
          </div>

          <div style={panelSubtitle}>
            {subtitle}
          </div>
        </div>

        <div style={panelCountBadge}>
          {rows.length} records
        </div>
      </div>

      <div
        style={rankingTableWrap}
        className="logistics-pro-scroll logistics-pro-scroll-x"
      >
        <div style={rankingHead}>
          <div>
            {isDriver
              ? "Driver"
              : "Vehicle"}
          </div>
          <div>Challans</div>
          <div>Items</div>
          <div>Active</div>
          <div>Manual</div>
          <div>
            Last Activity
          </div>
        </div>

        {rows.length === 0 && (
          <div style={panelEmpty}>
            No activity available for this period.
          </div>
        )}

        {visibleRows.map(
          (row, index) => (
            <div
              key={row.key}
              style={rankingRow}
            >
              <div style={rankingIdentity}>
                <span style={rankingNo}>
                  {
                    (
                      currentPage -
                      1
                    ) *
                    pageSize +
                    index +
                    1
                  }
                </span>

                <span>
                  {isDriver
                    ? row.name
                    : row.number}
                </span>
              </div>

              <div>
                {row.challans}
              </div>

              <div style={importantValue}>
                {
                  row.dispatchedItems
                }
              </div>

              <div>
                {
                  row.activeChallans
                }
              </div>

              <div>
                {
                  row.manualOperations
                }
                {row.manualTrips > 0
                  ? ` / ${row.manualTrips} trips`
                  : ""}
              </div>

              <div style={lastActivityText}>
                {row.lastActivityAt
                  ? formatDateTime(
                    row.lastActivityAt
                  )
                  : "—"}
              </div>
            </div>
          )
        )}
      </div>

      <ProfessionalPagination
        page={currentPage}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={
          setPageSize
        }
        totalItems={
          rows.length
        }
        label={
          isDriver
            ? "drivers"
            : "vehicles"
        }
        pageSizeOptions={
          fullWidth
            ? [10, 25, 50]
            : [5, 10, 25]
        }
        compact={!fullWidth}
      />
    </div>
  );
}

function AttentionPanel({
  rows,
  fullWidth = false,
}) {
  const [page, setPage] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(
    fullWidth ? 10 : 5
  );

  useEffect(() => {
    setPage(1);
  }, [
    rows.length,
    fullWidth,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        pageSize
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const visibleRows =
    rows.slice(
      (
        currentPage - 1
      ) *
      pageSize,
      currentPage *
      pageSize
    );

  return (
    <div
      style={{
        ...panelCard,
        ...(fullWidth
          ? {
            gridColumn:
              "1 / -1",
            marginTop: 20,
          }
          : {}),
      }}
    >
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            Management Attention Queue
          </div>

          <div style={panelSubtitle}>
            Live exceptions from running dispatch challans
          </div>
        </div>

        <div
          style={{
            ...panelCountBadge,
            color:
              rows.length > 0
                ? "#f87171"
                : "#4ade80",
          }}
        >
          {rows.length} issues
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={healthyBox}>
          ✓ No current dispatch exceptions need management attention.
        </div>
      ) : (
        <>
          <div
            style={attentionList}
            className="logistics-pro-scroll logistics-pro-scroll-y logistics-pro-scroll-soft"
          >
            {visibleRows.map(
              (row) => (
                <div
                  key={row.key}
                  style={attentionRow}
                >
                  <span
                    style={severityPill(
                      row.severity
                    )}
                  >
                    {row.severity}
                  </span>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div style={attentionTitle}>
                      {row.title}
                    </div>

                    <div style={attentionDetail}>
                      {row.detail}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <ProfessionalPagination
            page={currentPage}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={
              setPageSize
            }
            totalItems={
              rows.length
            }
            label="issues"
            pageSizeOptions={
              fullWidth
                ? [10, 20, 50]
                : [5, 10, 20]
            }
            compact={!fullWidth}
          />
        </>
      )}
    </div>
  );
}

function RecentActivityPanel({
  rows,
  periodLabel,
}) {
  const [page, setPage] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(4);

  useEffect(() => {
    setPage(1);
  }, [
    rows.length,
    periodLabel,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        pageSize
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const visibleRows =
    rows.slice(
      (
        currentPage - 1
      ) *
      pageSize,
      currentPage *
      pageSize
    );

  return (
    <div style={recentPanel}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            Recent Logistics Activity
          </div>

          <div style={panelSubtitle}>
            Latest unified operations in {periodLabel}
          </div>
        </div>

        <div style={panelCountBadge}>
          {rows.length} records
        </div>
      </div>

      <div
        style={recentGrid}
        className="logistics-pro-scroll logistics-pro-scroll-y logistics-pro-scroll-soft"
      >
        {rows.length === 0 && (
          <div style={panelEmpty}>
            No recent activity in the selected period.
          </div>
        )}

        {visibleRows.map(
          (row) => (
            <div
              key={row.key}
              style={recentRow}
            >
              <div style={recentDot} />

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div style={recentTitleRow}>
                  <span style={recentTitle}>
                    {row.title}
                  </span>

                  <span style={recentSource}>
                    {row.source}
                  </span>
                </div>

                <div style={recentSubtitle}>
                  {row.subtitle}
                </div>

                <div style={recentTime}>
                  {formatDateTime(
                    row.at
                  )}{" "}
                  • {row.status}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <ProfessionalPagination
        page={currentPage}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={
          setPageSize
        }
        totalItems={
          rows.length
        }
        label="activities"
        pageSizeOptions={[
          4,
          6,
          10,
        ]}
        compact
      />
    </div>
  );
}


function LogisticsReportCenter({
  periodLabel,
  filterSummary,
  driverOptions,
  vehicleOptions,
  driverKey,
  vehicleKey,
  status,
  search,
  onDriverChange,
  onVehicleChange,
  onStatusChange,
  onSearchChange,
  onClear,
  operationRows,
  driverRows,
  vehicleRows,
  itemRowCount,
  generating,
  onDownload,
}) {
  const challanRows =
    operationRows.filter(
      (row) =>
        row.source ===
        REPORT_SOURCE.CHALLAN
    );

  const manualRows =
    operationRows.filter(
      (row) =>
        row.source ===
        REPORT_SOURCE.MANUAL
    );

  const [
    tripPreviewPage,
    setTripPreviewPage,
  ] = useState(1);

  const [
    tripPreviewPageSize,
    setTripPreviewPageSize,
  ] = useState(8);

  useEffect(() => {
    setTripPreviewPage(1);
  }, [
    operationRows,
  ]);

  const tripPreviewTotalPages =
    Math.max(
      1,
      Math.ceil(
        operationRows.length /
        tripPreviewPageSize
      )
    );

  const currentTripPreviewPage =
    Math.min(
      tripPreviewPage,
      tripPreviewTotalPages
    );

  const visibleTripPreviewRows =
    operationRows.slice(
      (
        currentTripPreviewPage -
        1
      ) *
      tripPreviewPageSize,
      currentTripPreviewPage *
      tripPreviewPageSize
    );

  const completedChallans =
    challanRows.filter(
      (row) =>
        row.status === "COMPLETED"
    ).length;

  const completionRate =
    challanRows.length > 0
      ? (
        completedChallans /
        challanRows.length
      ) * 100
      : 0;

  return (
    <div style={reportCenter}>
      <div style={reportHero}>
        <div>
          <div style={reportEyebrow}>
            MANAGEMENT REPORTING
          </div>

          <div style={reportHeroTitle}>
            Logistics Reports & Excel Downloads
          </div>

          <div style={reportHeroSub}>
            Driver, vehicle and trip-level reporting from the same live data powering this management dashboard.
          </div>
        </div>

        <div style={reportPeriodBadge}>
          {periodLabel}
        </div>
      </div>

      <div style={reportFilterCard}>
        <div style={reportFilterGrid}>
          <label style={reportField}>
            <span>Driver</span>
            <select
              value={driverKey}
              onChange={(event) =>
                onDriverChange(
                  event.target.value
                )
              }
              style={reportInput}
            >
              <option value="">
                All Drivers
              </option>

              {driverOptions.map(
                (row) => (
                  <option
                    key={row.key}
                    value={row.key}
                  >
                    {row.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label style={reportField}>
            <span>Vehicle</span>
            <select
              value={vehicleKey}
              onChange={(event) =>
                onVehicleChange(
                  event.target.value
                )
              }
              style={reportInput}
            >
              <option value="">
                All Vehicles
              </option>

              {vehicleOptions.map(
                (row) => (
                  <option
                    key={row.key}
                    value={row.key}
                  >
                    {row.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label style={reportField}>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) =>
                onStatusChange(
                  event.target.value
                )
              }
              style={reportInput}
            >
              <option value="ALL">
                All Statuses
              </option>
              <option value="RUNNING">
                Running Challans
              </option>
              <option value="COMPLETED">
                Completed
              </option>
              <option value="CANCELLED">
                Cancelled
              </option>
              <option value="WORKING">
                Manual Working
              </option>
              <option value="OFF">
                Off
              </option>
              <option value="ON_LEAVE">
                On Leave
              </option>
            </select>
          </label>

          <label style={reportField}>
            <span>Search</span>
            <input
              value={search}
              onChange={(event) =>
                onSearchChange(
                  event.target.value
                )
              }
              placeholder="Challan, driver, vehicle, route..."
              style={reportInput}
            />
          </label>
        </div>

        <div style={reportFilterFooter}>
          <div style={reportFilterSummaryText}>
            {filterSummary}
          </div>

          <button
            type="button"
            onClick={onClear}
            style={reportClearButton}
          >
            Clear Report Filters
          </button>
        </div>
      </div>

      <div style={reportSnapshotGrid}>
        <ReportSnapshot
          label="Dispatch Challans"
          value={challanRows.length}
          detail={`${completedChallans} completed`}
        />
        <ReportSnapshot
          label="Completion Rate"
          value={`${completionRate.toFixed(0)}%`}
          detail="Filtered challans"
        />
        <ReportSnapshot
          label="Manual Operations"
          value={manualRows.length}
          detail="Legacy / non-challan"
        />
        <ReportSnapshot
          label="Drivers"
          value={driverRows.length}
          detail="In current report"
        />
        <ReportSnapshot
          label="Vehicles"
          value={vehicleRows.length}
          detail="In current report"
        />
        <ReportSnapshot
          label="Item Detail Rows"
          value={itemRowCount}
          detail="Available challan items"
        />
      </div>

      <div style={downloadGrid}>
        <ReportDownloadCard
          icon="📘"
          title="Management Pack"
          description="Executive summary, driver performance, vehicle performance, trip register, dispatch item detail and report definitions."
          buttonText="Download Complete Workbook"
          generating={
            generating === "ALL"
          }
          disabled={Boolean(generating)}
          onClick={() =>
            onDownload("ALL")
          }
        />

        <ReportDownloadCard
          icon="👤"
          title="Driver Performance"
          description="Driver-wise challans, completion, dispatched items, manual trips, helpers, distance, fuel and average duration."
          buttonText="Download Driver Report"
          generating={
            generating === "DRIVER"
          }
          disabled={Boolean(generating)}
          onClick={() =>
            onDownload("DRIVER")
          }
        />

        <ReportDownloadCard
          icon="🚚"
          title="Vehicle Performance"
          description="Vehicle-wise activity, challan throughput, active/completed work, manual trips, distance, fuel and utilization detail."
          buttonText="Download Vehicle Report"
          generating={
            generating === "VEHICLE"
          }
          disabled={Boolean(generating)}
          onClick={() =>
            onDownload("VEHICLE")
          }
        />

        <ReportDownloadCard
          icon="📄"
          title="Trip / Challan Register"
          description="Detailed activity register with source, challan, driver, vehicle, start/end, duration, status, items, helpers and route."
          buttonText="Download Trip Report"
          generating={
            generating === "TRIP"
          }
          disabled={Boolean(generating)}
          onClick={() =>
            onDownload("TRIP")
          }
        />
      </div>

      <div style={reportPreviewGrid}>
        <ReportPreviewTable
          title="Driver Report Preview"
          identityLabel="Driver"
          rows={driverRows}
        />

        <ReportPreviewTable
          title="Vehicle Report Preview"
          identityLabel="Vehicle"
          rows={vehicleRows}
        />
      </div>

      <div style={tripPreviewCard}>
        <div style={panelHeader}>
          <div>
            <div style={panelTitle}>
              Trip / Challan Preview
            </div>
            <div style={panelSubtitle}>
              Latest filtered activity rows before Excel export
            </div>
          </div>
          <div style={panelCountBadge}>
            {operationRows.length} records
          </div>
        </div>

        <div
          style={tripPreviewScroll}
          className="logistics-pro-scroll logistics-pro-scroll-x"
        >
          <div style={tripPreviewHead}>
            <div>Source</div>
            <div>Record</div>
            <div>Driver</div>
            <div>Vehicle</div>
            <div>Start</div>
            <div>Status</div>
            <div>Load</div>
          </div>

          {operationRows.length === 0 && (
            <div style={panelEmpty}>
              No operations match the selected report filters.
            </div>
          )}

          {visibleTripPreviewRows
            .map((row) => (
              <div
                key={row.key}
                style={tripPreviewRow}
              >
                <div style={reportSourceText}>
                  {row.source}
                </div>
                <div style={reportRecordText}>
                  {row.recordId}
                </div>
                <div>{row.driverName}</div>
                <div>{row.vehicleNumber}</div>
                <div style={lastActivityText}>
                  {formatDateTime(
                    row.startAt
                  )}
                </div>
                <div>
                  <span
                    style={reportStatusPill(
                      row.status
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                <div>
                  {row.source ===
                    REPORT_SOURCE.CHALLAN
                    ? `${row.itemCount} items`
                    : `${row.tripCount} trips`}
                </div>
              </div>
            ))}
        </div>

        <ProfessionalPagination
          page={
            currentTripPreviewPage
          }
          setPage={
            setTripPreviewPage
          }
          pageSize={
            tripPreviewPageSize
          }
          setPageSize={
            setTripPreviewPageSize
          }
          totalItems={
            operationRows.length
          }
          label="operations"
          pageSizeOptions={[
            8,
            12,
            25,
            50,
          ]}
          compact
        />
      </div>
    </div>
  );
}

function ReportSnapshot({
  label,
  value,
  detail,
}) {
  return (
    <div style={reportSnapshotCard}>
      <div style={reportSnapshotLabel}>
        {label}
      </div>
      <div style={reportSnapshotValue}>
        {value}
      </div>
      <div style={reportSnapshotDetail}>
        {detail}
      </div>
    </div>
  );
}

function ReportDownloadCard({
  icon,
  title,
  description,
  buttonText,
  generating,
  disabled,
  onClick,
}) {
  return (
    <div style={downloadCard}>
      <div style={downloadCardIcon}>
        {icon}
      </div>

      <div style={downloadCardTitle}>
        {title}
      </div>

      <div style={downloadCardText}>
        {description}
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          ...downloadButton,
          opacity:
            disabled ? 0.62 : 1,
          cursor:
            disabled
              ? "not-allowed"
              : "pointer",
        }}
      >
        {generating
          ? "Generating Excel..."
          : buttonText}
      </button>
    </div>
  );
}

function ReportPreviewTable({
  title,
  identityLabel,
  rows,
}) {
  const [page, setPage] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(5);

  useEffect(() => {
    setPage(1);
  }, [
    rows,
    title,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        pageSize
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const visibleRows =
    rows.slice(
      (
        currentPage - 1
      ) *
      pageSize,
      currentPage *
      pageSize
    );

  return (
    <div style={panelCard}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            {title}
          </div>

          <div style={panelSubtitle}>
            Filter-aware management summary
          </div>
        </div>

        <div style={panelCountBadge}>
          {rows.length} records
        </div>
      </div>

      <div
        style={reportPreviewScroll}
        className="logistics-pro-scroll logistics-pro-scroll-x"
      >
        <div style={reportPreviewHead}>
          <div>{identityLabel}</div>
          <div>Challans</div>
          <div>Items</div>
          <div>Completion</div>
          <div>Manual</div>
        </div>

        {rows.length === 0 && (
          <div style={panelEmpty}>
            No data for the current report filters.
          </div>
        )}

        {visibleRows.map(
          (row) => (
            <div
              key={row.key}
              style={reportPreviewRow}
            >
              <div style={rankingIdentity}>
                {row.label}
              </div>

              <div>
                {row.challans}
              </div>

              <div style={importantValue}>
                {row.dispatchedItems}
              </div>

              <div>
                {row.completionRate.toFixed(
                  0
                )}
                %
              </div>

              <div>
                {row.manualOperations}
              </div>
            </div>
          )
        )}
      </div>

      <ProfessionalPagination
        page={currentPage}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={
          setPageSize
        }
        totalItems={
          rows.length
        }
        label={
          identityLabel ===
            "Driver"
            ? "drivers"
            : "vehicles"
        }
        pageSizeOptions={[
          5,
          10,
          25,
        ]}
        compact
      />
    </div>
  );
}

function DashboardStatCard({
  title,
  value,
  subtle,
  accent = "#60a5fa",
}) {
  return (
    <div
      style={{
        ...fallbackCard,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div style={fallbackCardTitle}>{title}</div>
      <div style={fallbackCardValue}>{value}</div>
      <div style={fallbackCardSubtle}>{subtle}</div>
    </div>
  );
}

const layout = {
  display: "flex",
  gap: 20,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const main = {
  flex: "1 1 760px",
  minWidth: 0,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 22,
  flexWrap: "wrap",
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexWrap: "wrap",
};

const periodSwitcher = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: "rgba(2,6,23,.52)",
  border: "1px solid rgba(255,255,255,.06)",
};

const periodButton = {
  height: 32,
  padding: "0 10px",
  borderRadius: 9,
  border: "1px solid transparent",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: 10.5,
  fontWeight: 850,
};

const periodButtonActive = {
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  border:
    "1px solid rgba(96,165,250,.35)",
  boxShadow:
    "0 6px 16px rgba(37,99,235,.22)",
};

const refreshButton = {
  height: 40,
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  gap: 7,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  color: "#fff",
  background:
    "rgba(255,255,255,.045)",
  fontWeight: 800,
  fontFamily: "inherit",
};

const liveBadge = {
  height: 40,
  padding: "0 13px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  gap: 7,
  background:
    "rgba(34,197,94,.13)",
  color: "#4ade80",
  fontWeight: 900,
  letterSpacing: 0.8,
  border:
    "1px solid rgba(34,197,94,.22)",
  fontSize: 10.5,
};

const liveDot = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 12px rgba(34,197,94,.8)",
};

const header = {
  color: "#fff",
  fontSize: 29,
  fontWeight: 950,
  marginBottom: 6,
  lineHeight: 1.2,
};

const subtitle = {
  color: "rgba(255,255,255,.60)",
  fontSize: 13,
  fontWeight: 600,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
};

const managementPulseGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 10,
  marginTop: 12,
};

const pulseCard = {
  padding: "12px 13px",
  borderRadius: 14,
  background: "rgba(2,6,23,.38)",
  border: "1px solid rgba(255,255,255,.055)",
};

const pulseLabel = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const pulseValue = {
  marginTop: 5,
  color: "#e2e8f0",
  fontSize: 18,
  fontWeight: 950,
};

const pulseDetail = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 700,
};

const chartsGrid = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(320px,1fr))",
  gap: 16,
};

const managementPanelsGrid = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(360px,1fr))",
  gap: 16,
};

const sourceNote = {
  marginTop: 14,
  padding: "11px 13px",
  borderRadius: 13,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 650,
  lineHeight: 1.5,
  background:
    "rgba(59,130,246,.06)",
  border:
    "1px solid rgba(59,130,246,.12)",
};

const panelCard = {
  minWidth: 0,
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.60))",
  border:
    "1px solid rgba(255,255,255,.065)",
};

const panelHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 13,
};

const panelTitle = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const panelSubtitle = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  marginTop: 4,
};

const panelCountBadge = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  color: "#94a3b8",
  fontSize: 9.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const rankingTableWrap = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.05)",
};

const rankingHead = {
  minWidth: 690,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .55fr .55fr .55fr .8fr 1fr",
  gap: 8,
  padding: "9px 10px",
  background: "rgba(2,6,23,.70)",
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const rankingRow = {
  minWidth: 690,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .55fr .55fr .55fr .8fr 1fr",
  gap: 8,
  padding: "10px 10px",
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 10.5,
  borderTop: "1px solid rgba(255,255,255,.045)",
};

const rankingIdentity = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#fff",
  fontWeight: 850,
};

const rankingNo = {
  width: 22,
  height: 22,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "rgba(59,130,246,.10)",
  color: "#60a5fa",
  fontSize: 9,
  fontWeight: 900,
};

const importantValue = {
  color: "#93c5fd",
  fontWeight: 900,
};

const lastActivityText = {
  color: "#94a3b8",
  fontSize: 9.5,
};

const panelEmpty = {
  padding: 22,
  color: "#64748b",
  textAlign: "center",
  fontSize: 11,
  fontWeight: 750,
};

const attentionList = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  maxHeight: 385,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  overscrollBehavior: "contain",
};

const attentionRow = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 9,
  padding: 10,
  borderRadius: 11,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.045)",
};

const severityPill = (severity) => ({
  alignSelf: "start",
  padding: "4px 6px",
  borderRadius: 999,
  fontSize: 8.5,
  fontWeight: 950,
  color:
    severity === "HIGH"
      ? "#f87171"
      : "#fbbf24",
  background:
    severity === "HIGH"
      ? "rgba(239,68,68,.12)"
      : "rgba(245,158,11,.12)",
});

const attentionTitle = {
  color: "#e2e8f0",
  fontSize: 10.5,
  fontWeight: 850,
};

const attentionDetail = {
  color: "#64748b",
  fontSize: 9.5,
  marginTop: 3,
  lineHeight: 1.4,
};

const healthyBox = {
  padding: 18,
  borderRadius: 12,
  color: "#4ade80",
  background: "rgba(34,197,94,.07)",
  border: "1px solid rgba(34,197,94,.12)",
  fontSize: 11,
  fontWeight: 800,
};

const recentPanel = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.75),rgba(2,6,23,.58))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const recentGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(280px,1fr))",
  gap: 8,
  maxHeight: 360,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  overscrollBehavior: "contain",
};

const recentRow = {
  display: "grid",
  gridTemplateColumns: "10px 1fr",
  gap: 9,
  padding: 11,
  borderRadius: 12,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.045)",
};

const recentDot = {
  width: 7,
  height: 7,
  marginTop: 5,
  borderRadius: "50%",
  background: "#60a5fa",
  boxShadow: "0 0 10px rgba(96,165,250,.45)",
};

const recentTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const recentTitle = {
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
};

const recentSource = {
  color: "#60a5fa",
  fontSize: 8.5,
  fontWeight: 900,
};

const recentSubtitle = {
  color: "#94a3b8",
  fontSize: 9.5,
  marginTop: 4,
  lineHeight: 1.4,
};

const recentTime = {
  color: "#64748b",
  fontSize: 8.5,
  marginTop: 5,
  fontWeight: 700,
};

const reportsNavButton = {
  height: 40,
  padding: "0 14px",
  borderRadius: 11,
  border:
    "1px solid rgba(96,165,250,.18)",
  color: "#93c5fd",
  background:
    "rgba(59,130,246,.08)",
  fontWeight: 850,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const reportsNavButtonActive = {
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  border:
    "1px solid rgba(96,165,250,.42)",
  boxShadow:
    "0 8px 20px rgba(37,99,235,.24)",
};

const reportCenter = {
  marginTop: 14,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const reportHero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  padding: 18,
  borderRadius: 18,
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.16),transparent 40%),linear-gradient(135deg,rgba(15,23,42,.92),rgba(2,6,23,.72))",
  border:
    "1px solid rgba(96,165,250,.15)",
};

const reportEyebrow = {
  color: "#60a5fa",
  fontSize: 9.5,
  fontWeight: 950,
  letterSpacing: ".12em",
};

const reportHeroTitle = {
  marginTop: 5,
  color: "#fff",
  fontSize: 20,
  fontWeight: 950,
};

const reportHeroSub = {
  marginTop: 5,
  maxWidth: 760,
  color: "#94a3b8",
  fontSize: 11,
  lineHeight: 1.55,
  fontWeight: 650,
};

const reportPeriodBadge = {
  padding: "8px 12px",
  borderRadius: 999,
  color: "#bfdbfe",
  background:
    "rgba(59,130,246,.12)",
  border:
    "1px solid rgba(96,165,250,.20)",
  fontSize: 10,
  fontWeight: 900,
};

const reportFilterCard = {
  padding: 14,
  borderRadius: 16,
  background:
    "rgba(15,23,42,.72)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const reportFilterGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const reportField = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const reportInput = {
  width: "100%",
  height: 40,
  padding: "0 11px",
  boxSizing: "border-box",
  borderRadius: 10,
  outline: "none",
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#020617",
  color: "#e2e8f0",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 750,
};

const reportFilterFooter = {
  marginTop: 11,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const reportFilterSummaryText = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 700,
  lineHeight: 1.45,
};

const reportClearButton = {
  height: 32,
  padding: "0 11px",
  borderRadius: 9,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.035)",
  color: "#cbd5e1",
  fontSize: 9.5,
  fontWeight: 850,
  cursor: "pointer",
};

const reportSnapshotGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(135px,1fr))",
  gap: 9,
};

const reportSnapshotCard = {
  padding: 12,
  borderRadius: 13,
  background:
    "rgba(2,6,23,.42)",
  border:
    "1px solid rgba(255,255,255,.055)",
};

const reportSnapshotLabel = {
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const reportSnapshotValue = {
  marginTop: 4,
  color: "#fff",
  fontSize: 20,
  fontWeight: 950,
};

const reportSnapshotDetail = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 700,
};

const downloadGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 11,
};

const downloadCard = {
  display: "flex",
  flexDirection: "column",
  minHeight: 190,
  padding: 15,
  borderRadius: 16,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.78),rgba(15,23,42,.78))",
  border:
    "1px solid rgba(255,255,255,.065)",
};

const downloadCardIcon = {
  width: 36,
  height: 36,
  display: "grid",
  placeItems: "center",
  borderRadius: 11,
  background:
    "rgba(59,130,246,.12)",
  fontSize: 16,
};

const downloadCardTitle = {
  marginTop: 10,
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
};

const downloadCardText = {
  marginTop: 5,
  flex: 1,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 650,
  lineHeight: 1.5,
};

const downloadButton = {
  marginTop: 12,
  height: 36,
  borderRadius: 10,
  border: "none",
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  fontSize: 10,
  fontWeight: 900,
  fontFamily: "inherit",
};

const reportPreviewGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(340px,1fr))",
  gap: 12,
};

const reportPreviewScroll = {
  overflowX: "auto",
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.045)",
};

const reportPreviewHead = {
  minWidth: 560,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .65fr .65fr .8fr .65fr",
  gap: 8,
  padding: "9px 10px",
  background: "rgba(2,6,23,.72)",
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const reportPreviewRow = {
  minWidth: 560,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .65fr .65fr .8fr .65fr",
  gap: 8,
  padding: "9px 10px",
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 9.5,
  borderTop:
    "1px solid rgba(255,255,255,.04)",
};

const tripPreviewCard = {
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.60))",
  border:
    "1px solid rgba(255,255,255,.065)",
};

const tripPreviewScroll = {
  overflowX: "auto",
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.045)",
};

const tripPreviewHead = {
  minWidth: 850,
  display: "grid",
  gridTemplateColumns:
    ".9fr 1.05fr 1.05fr .9fr 1.1fr .7fr .7fr",
  gap: 8,
  padding: "9px 10px",
  background: "rgba(2,6,23,.72)",
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const tripPreviewRow = {
  minWidth: 850,
  display: "grid",
  gridTemplateColumns:
    ".9fr 1.05fr 1.05fr .9fr 1.1fr .7fr .7fr",
  gap: 8,
  padding: "10px",
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 9.5,
  borderTop:
    "1px solid rgba(255,255,255,.04)",
};

const reportSourceText = {
  color: "#60a5fa",
  fontWeight: 850,
};

const reportRecordText = {
  color: "#fff",
  fontWeight: 850,
  fontFamily: "monospace",
};

const reportStatusPill = (
  value
) => {
  const normalized =
    normalizeStatus(value);

  const tone =
    normalized === "COMPLETED"
      ? {
        color: "#4ade80",
        background:
          "rgba(34,197,94,.12)",
      }
      : normalized === "RUNNING" ||
        normalized === "WORKING"
        ? {
          color: "#60a5fa",
          background:
            "rgba(59,130,246,.12)",
        }
        : normalized === "CANCELLED"
          ? {
            color: "#f87171",
            background:
              "rgba(239,68,68,.12)",
          }
          : {
            color: "#fbbf24",
            background:
              "rgba(245,158,11,.12)",
          };

  return {
    display: "inline-flex",
    padding: "4px 7px",
    borderRadius: 999,
    fontSize: 8.5,
    fontWeight: 900,
    ...tone,
  };
};

const warningBox = {
  marginBottom: 16,
  padding: 13,
  borderRadius: 13,
  color: "#fbbf24",
  background: "rgba(245,158,11,.10)",
  border: "1px solid rgba(245,158,11,.20)",
  fontWeight: 750,
  fontSize: 11,
};

const loadingBox = {
  minHeight: 260,
  display: "grid",
  placeItems: "center",
  color: "#94a3b8",
  borderRadius: 22,
  background: "rgba(255,255,255,.025)",
  border: "1px dashed rgba(255,255,255,.10)",
  fontWeight: 800,
};

const fallbackCard = {
  minHeight: 118,
  padding: 18,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.86),rgba(15,23,42,.90))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const fallbackCardTitle = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 850,
};

const fallbackCardValue = {
  marginTop: 9,
  color: "#fff",
  fontSize: 28,
  fontWeight: 950,
};

const fallbackCardSubtle = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
};


const professionalPager = {
  marginTop: 12,
  minHeight: 58,
  padding: "10px 12px",
  borderRadius: 15,
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 11,
  flexWrap: "wrap",
  background:
    "radial-gradient(circle at 8% 0%,rgba(59,130,246,.10),transparent 34%),linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.66))",
  border:
    "1px solid rgba(148,163,184,.09)",
  boxShadow:
    "0 12px 28px rgba(2,6,23,.18),inset 0 1px 0 rgba(255,255,255,.02)",
};

const professionalPagerCompact = {
  minHeight: 49,
  padding: "8px 9px",
  borderRadius: 12,
  gap: 8,
};

const pagerInfo = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const pagerRange = {
  color: "#cbd5e1",
  fontSize: 9.5,
  fontWeight: 750,
  lineHeight: 1.35,
};

const pagerMeta = {
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 750,
};

const pagerControls = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "flex-end",
  gap: 7,
  flexWrap: "wrap",
};

const pagerRowsControl = {
  minHeight: 32,
  padding: "0 7px 0 9px",
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  gap: 6,
  background:
    "rgba(255,255,255,.032)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const pagerRowsControlCompact = {
  minHeight: 29,
  padding: "0 6px 0 7px",
};

const pagerRowsLabel = {
  color: "#718096",
  fontSize: 8,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const pagerSelect = {
  height: 25,
  minWidth: 50,
  padding: "0 5px",
  borderRadius: 7,
  outline: "none",
  color: "#e2e8f0",
  background: "#0f172a",
  border:
    "1px solid rgba(96,165,250,.16)",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 900,
  cursor: "pointer",
  colorScheme: "dark",
};

const pagerDivider = {
  width: 1,
  height: 26,
  background:
    "rgba(148,163,184,.10)",
};

const pagerButtons = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
};

const pagerButton = {
  minWidth: 31,
  height: 31,
  padding: "0 7px",
  borderRadius: 9,
  border:
    "1px solid rgba(148,163,184,.09)",
  background:
    "linear-gradient(180deg,rgba(30,41,59,.82),rgba(15,23,42,.86))",
  color: "#cbd5e1",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9.5,
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.02)",
  transition:
    "transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease",
};

const pagerButtonCompact = {
  minWidth: 28,
  height: 28,
  padding: "0 6px",
  borderRadius: 8,
  fontSize: 9,
};

const pagerButtonActive = {
  color: "#fff",
  border:
    "1px solid rgba(147,197,253,.46)",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow:
    "0 7px 16px rgba(37,99,235,.24),inset 0 1px 0 rgba(255,255,255,.11)",
};

const pagerButtonDisabled = {
  opacity: 0.28,
  cursor: "not-allowed",
  boxShadow: "none",
};

const pagerEllipsis = {
  minWidth: 16,
  color: "#64748b",
  textAlign: "center",
  fontSize: 11,
  fontWeight: 900,
  userSelect: "none",
};

export default LogisticsDashboard;
