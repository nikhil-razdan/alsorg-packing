import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDashboardStats,
  fetchPackingReport,
  fetchDispatchReport,
  fetchCombinedReport,
  fetchInventoryAging,
  fetchMasterItemReport,
} from "../../api/dashboardApi";

import {
  fetchPackingVolumeReport,
} from "../../api/packingReportApi";

const REPORT_CACHE_TTL_MS = 2 * 60 * 1000;
const reportSnapshotCache = new Map();

const DEFAULT_TABLE_PAGE_SIZE = 50;
const TABLE_PAGE_SIZE_OPTIONS = [50, 100, 250];

const getReportRangeCacheKey = (from, to) =>
  `${from || ""}|${to || ""}`;

const readReportSnapshot = (key) => {
  const entry = reportSnapshotCache.get(key);

  if (!entry) return null;

  if (Date.now() - Number(entry.cachedAt || 0) > REPORT_CACHE_TTL_MS) {
    reportSnapshotCache.delete(key);
    return null;
  }

  return entry;
};

const writeReportSnapshot = (key, patch) => {
  const previous = reportSnapshotCache.get(key) || {};

  const next = {
    ...previous,
    ...patch,
    cachedAt: Date.now(),
  };

  reportSnapshotCache.set(key, next);
  return next;
};

const scheduleWhenIdle = (callback) => {
  if (typeof window === "undefined") {
    callback();
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 700 });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 40);
  return () => window.clearTimeout(id);
};

const pad = (value) =>
  String(value).padStart(2, "0");

const todayDate = () => {
  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const monthStartDate = () => {
  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-01`;
};

const toStartDateTime = (date) =>
  `${date}T00:00:00`;

const toEndDateTime = (date) =>
  `${date}T23:59:59`;

const numberValue = (value) =>
  Number(value || 0);

const round = (value) =>
  Math.round(numberValue(value) * 100) / 100;

const safeDivide = (a, b) =>
  b ? a / b : 0;

const formatPercent = (value) =>
  `${Math.round(value * 100)}%`;

const roundCbm = (value) =>
  Math.round(numberValue(value) * 1000) / 1000;

const formatCbm = (value) =>
  roundCbm(value).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

const hasMeasuredVolume = (row) => {
  const raw = row?.volumeCbm;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return false;
  }

  const value = Number(raw);

  return Number.isFinite(value) && value >= 0;
};

const getVolumeCbm = (row) =>
  hasMeasuredVolume(row)
    ? Number(row.volumeCbm)
    : 0;

const rowValue = (
  row,
  keys,
  fallback = "-"
) => {
  for (const key of keys) {
    if (
      row?.[key] !== undefined &&
      row?.[key] !== null &&
      row?.[key] !== ""
    ) {
      return row[key];
    }
  }

  return fallback;
};

const formatDate = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "-";
  }
};

const getDateKey = (value) => {
  if (!value) return "-";

  try {
    const date = new Date(value);

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())}`;
  } catch {
    return "-";
  }
};

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

const normalizeStats = (data) => {
  const warehouseItems = numberValue(
    data?.warehouseItems ??
    data?.warehouse ??
    data?.warehouseStock
  );

  const readyToDispatchItems =
    numberValue(
      data?.readyToDispatchItems ??
      data?.readyToDispatch
    );

  const readyItems = numberValue(
    data?.readyItems ??
    data?.ready
  );

  const inventoryTotal =
    warehouseItems +
    readyToDispatchItems +
    readyItems;

  return {
    warehouseItems,
    readyToDispatchItems,
    readyItems,

    totalItems:
      inventoryTotal ||
      numberValue(data?.totalItems),

    packedItems: numberValue(
      data?.packedItems ??
      data?.packed
    ),

    dispatchedItems: numberValue(
      data?.dispatchedItems ??
      data?.dispatched
    ),

    pendingItems: numberValue(
      data?.pendingItems ??
      data?.pending
    ),

    stickersGenerated: numberValue(
      data?.stickersGenerated ??
      data?.stickers
    ),

    todayStickerGenerated: numberValue(
      data?.todayStickerGenerated
    ),

    todayChallanGenerated: numberValue(
      data?.todayChallanGenerated
    ),

    masterItems: numberValue(data?.masterItems),
    totalPackets: numberValue(data?.totalPackets),
    packetItems: numberValue(data?.packetItems),

    fullyPackedMasterItems: numberValue(data?.fullyPackedMasterItems),
    partiallyPackedMasterItems: numberValue(data?.partiallyPackedMasterItems),
    unpackedMasterItems: numberValue(data?.unpackedMasterItems),

    packedPackets: numberValue(data?.packedPackets),
    pendingPackets: numberValue(data?.pendingPackets),

    packetItemsWithSticker: numberValue(data?.packetItemsWithSticker),
    packetItemsPendingSticker: numberValue(data?.packetItemsPendingSticker),
    stickerReprints: numberValue(data?.stickerReprints),

    readyToStoreItems: numberValue(data?.readyToStoreItems),
    warehouseRequestedItems: numberValue(data?.warehouseRequestedItems),
    returnRequestedItems: numberValue(data?.returnRequestedItems),
    queuedItems: numberValue(data?.queuedItems),
    pkdItems: numberValue(data?.pkdItems),
    fgItems: numberValue(data?.fgItems),

    normalDispatchChallans: numberValue(data?.normalDispatchChallans),
    todayDispatchChallans: numberValue(data?.todayDispatchChallans),
    runningTrips: numberValue(data?.runningTrips),
    endedTrips: numberValue(data?.endedTrips),

    customChallans: numberValue(data?.customChallans),
    todayCustomChallans: numberValue(data?.todayCustomChallans),
    customChallanItems: numberValue(data?.customChallanItems),

    exceptionsCount: numberValue(data?.exceptionsCount),
  };
};

const getAgeDays = (row) => {
  const direct = rowValue(
    row,
    [
      "ageDays",
      "agingDays",
      "daysInInventory",
      "days",
    ],
    null
  );

  if (direct !== null) {
    return numberValue(direct);
  }

  const createdAt = rowValue(
    row,
    [
      "createdAt",
      "receivedAt",
      "packedAt",
      "date",
    ],
    null
  );

  if (!createdAt) return 0;

  const start = new Date(createdAt);
  const now = new Date();

  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  return Math.max(
    Math.floor(
      (now.getTime() - start.getTime()) /
      86400000
    ),
    0
  );
};

const getAgingBucket = (row) => {
  const bucket = rowValue(
    row,
    [
      "agingBucket",
      "bucket",
      "ageBucket",
    ],
    null
  );

  if (bucket) {
    return String(bucket);
  }

  const days = getAgeDays(row);

  if (days <= 7) return "0-7 Days";
  if (days <= 30) return "8-30 Days";
  if (days <= 90) return "31-90 Days";

  return "90+ Days";
};

const getPacketNumber = (row) =>
  rowValue(
    row,
    [
      "packetNumber",
      "packetNo",
      "packetCode",
      "packetId",
      "packetName",
    ],
    "-"
  );

const getPacketName = (row) =>
  rowValue(
    row,
    [
      "packetName",
      "packetTitle",
      "packetDescription",
      "packetType",
    ],
    "-"
  );

const getPdNo = (row) =>
  rowValue(
    row,
    [
      "pdNo",
      "pdNumber",
    ],
    "-"
  );

const getDrawingNo = (row) =>
  rowValue(
    row,
    [
      "drawingNo",
      "drawingName",
      "dwgNo",
    ],
    "-"
  );

const getArea = (row) =>
  rowValue(
    row,
    [
      "area",
      "currentLocationCode",
      "location",
      "fgAreaCode",
      "packedAreaCode",
      "warehouseCode",
    ],
    "-"
  );

const getItemStatus = (row, fallback = "-") =>
  rowValue(
    row,
    [
      "status",
      "itemStatus",
      "currentStatus",
      "dispatchStatus",
    ],
    fallback
  );

const isBlankReportValue = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return true;
  }

  const text = String(value).trim();

  return (
    !text ||
    text === "-" ||
    text.toUpperCase() === "NULL" ||
    text.toUpperCase() === "UNASSIGNED"
  );
};

const parseReportDateMs = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.getTime();
};

const medianNumber = (values = []) => {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (clean.length === 0) return 0;

  const middle = Math.floor(clean.length / 2);

  if (clean.length % 2 === 0) {
    return (
      clean[middle - 1] +
      clean[middle]
    ) / 2;
  }

  return clean[middle];
};

const formatOneDecimal = (value) =>
  Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  );

const formatSignedPercent = (value) => {
  const number = Number(value || 0);
  const prefix = number > 0 ? "+" : "";

  return `${prefix}${(
    number * 100
  ).toFixed(1)}%`;
};

const parseYmdLocal = (value) => {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );
};

const toYmdLocal = (date) => {
  if (!(date instanceof Date)) return "";

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const addDaysYmd = (value, days) => {
  const date = parseYmdLocal(value);

  if (!date) return value;

  date.setDate(date.getDate() + days);

  return toYmdLocal(date);
};

const enumerateDateKeys = (
  from,
  to
) => {
  const start = parseYmdLocal(from);
  const end = parseYmdLocal(to);

  if (!start || !end || start > end) {
    return [];
  }

  const result = [];
  const current = new Date(start);

  while (current <= end) {
    result.push(toYmdLocal(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
};

const formatShortDateKey = (value) => {
  const date = parseYmdLocal(value);

  if (!date) return value || "-";

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
    }
  );
};

const normalizeClientIdentity = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const getDirectorStatus = (row) =>
  String(
    getItemStatus(row, "UNKNOWN")
  )
    .trim()
    .toUpperCase();

const formatDirectorSnapshot = () =>
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

const createDirectorLineChartPng = ({
  title,
  rows,
  width = 960,
  height = 360,
}) => {
  if (
    typeof document === "undefined" ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const scale = 2;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 26);

  const margin = {
    left: 54,
    right: 24,
    top: 52,
    bottom: 54,
  };

  const plotWidth =
    width - margin.left - margin.right;
  const plotHeight =
    height - margin.top - margin.bottom;

  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [
      Number(row.packed || 0),
      Number(row.dispatched || 0),
    ])
  );

  ctx.strokeStyle = "#d7dee8";
  ctx.lineWidth = 1;
  ctx.fillStyle = "var(--pf-text-muted)";
  ctx.font = "11px Arial";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i += 1) {
    const value = maximum * (i / 4);
    const y =
      margin.top +
      plotHeight -
      plotHeight * (i / 4);

    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(
      width - margin.right,
      y
    );
    ctx.stroke();
    ctx.fillText(
      Math.round(value).toString(),
      margin.left - 8,
      y + 4
    );
  }

  const getX = (index) => {
    if (rows.length <= 1) {
      return margin.left + plotWidth / 2;
    }

    return (
      margin.left +
      (index / (rows.length - 1)) *
        plotWidth
    );
  };

  const getY = (value) =>
    margin.top +
    plotHeight -
    (Number(value || 0) / maximum) *
      plotHeight;

  const drawSeries = (
    key,
    strokeStyle
  ) => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    rows.forEach((row, index) => {
      const x = getX(index);
      const y = getY(row[key]);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  drawSeries("packed", "#136f8a");
  drawSeries("dispatched", "#f97316");

  const labelStep = Math.max(
    1,
    Math.ceil(rows.length / 10)
  );

  ctx.fillStyle = "var(--pf-text-muted)";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";

  rows.forEach((row, index) => {
    if (
      index % labelStep !== 0 &&
      index !== rows.length - 1
    ) {
      return;
    }

    ctx.fillText(
      row.shortLabel || row.label || row.key,
      getX(index),
      height - 24
    );
  });

  const legendY = height - 7;
  ctx.textAlign = "left";
  ctx.fillStyle = "#136f8a";
  ctx.fillRect(width / 2 - 92, legendY - 8, 18, 3);
  ctx.fillStyle = "#475569";
  ctx.fillText("Packed", width / 2 - 68, legendY - 4);

  ctx.fillStyle = "#f97316";
  ctx.fillRect(width / 2 + 12, legendY - 8, 18, 3);
  ctx.fillStyle = "#475569";
  ctx.fillText("Dispatched", width / 2 + 36, legendY - 4);

  return canvas.toDataURL("image/png");
};

const createDirectorBarChartPng = ({
  title,
  rows,
  width = 960,
  height = 360,
}) => {
  if (
    typeof document === "undefined" ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const scale = 2;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 26);

  const margin = {
    left: 58,
    right: 24,
    top: 52,
    bottom: 66,
  };

  const plotWidth =
    width - margin.left - margin.right;
  const plotHeight =
    height - margin.top - margin.bottom;

  const maximum = Math.max(
    1,
    ...rows.map((row) =>
      Number(row.value || 0)
    )
  );

  ctx.strokeStyle = "#d7dee8";
  ctx.lineWidth = 1;
  ctx.fillStyle = "var(--pf-text-muted)";
  ctx.font = "11px Arial";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i += 1) {
    const value = maximum * (i / 4);
    const y =
      margin.top +
      plotHeight -
      plotHeight * (i / 4);

    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(
      width - margin.right,
      y
    );
    ctx.stroke();
    ctx.fillText(
      Math.round(value).toString(),
      margin.left - 8,
      y + 4
    );
  }

  const slotWidth =
    plotWidth / Math.max(rows.length, 1);
  const barWidth = Math.min(
    88,
    slotWidth * 0.58
  );

  rows.forEach((row, index) => {
    const value = Number(row.value || 0);
    const barHeight =
      (value / maximum) * plotHeight;
    const x =
      margin.left +
      index * slotWidth +
      (slotWidth - barWidth) / 2;
    const y =
      margin.top +
      plotHeight -
      barHeight;

    ctx.fillStyle = "#176b87";
    ctx.fillRect(
      x,
      y,
      barWidth,
      barHeight
    );

    ctx.fillStyle = "#334155";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      String(row.label || "-").slice(0, 18),
      x + barWidth / 2,
      height - 34
    );
  });

  return canvas.toDataURL("image/png");
};

const volumeDetailColumns = [
  ["serialNumber", "S.No."],
  ["packedAt", "Packing Date / Time"],
  ["packedBy", "Packed By"],
  ["plantCode", "Plant"],
  ["clientName", "Client"],
  ["pdNo", "PD No."],
  ["drawingNo", "Dwg No."],
  ["sku", "SKU / Code"],
  ["itemName", "Item Name"],
  ["packetNumber", "Packet No."],
  ["quantity", "Qty"],
  ["dimensions", "Dimensions (L × B × H in)"],
  ["volumeCbm", "Packed Volume (m³)"],
  ["status", "Status"],
  ["stickerNumber", "Sticker No."],
];

const itemPacketColumns = [
  ["module", "Module"],
  ["zohoItemId", "Zoho Item ID"],
  ["itemName", "Item Name"],
  ["clientName", "Client"],
  ["packetNumber", "Packet No"],
  ["packetName", "Packet Name"],
  ["status", "Status"],
  ["actionAt", "Action At"],
  ["actionBy", "Action By"],
  ["ageDays", "Age Days"],
];

const dispatchDetailColumns = [
  ["serialNumber", "S.No."],
  ["zohoItemId", "Zoho Item ID"],
  ["pdNo", "PD No."],
  ["drawingNo", "Dwg No."],
  ["sku", "SKU / Code"],
  ["itemName", "Item Name"],
  ["description", "Description"],
  ["clientName", "Client"],
  ["clientAddress", "Client Address"],
  ["plantCode", "Plant"],
  ["floor", "Floor"],
  ["area", "Area"],
  ["warehouseCode", "Warehouse"],
  ["packetNumber", "Pkt No."],
  ["packetName", "Packet Name"],
  ["quantity", "Qty"],
  ["status", "Status"],
  ["packedAt", "Packing Date"],
  ["packedBy", "Packed By"],
  ["dispatchedAt", "Dispatch Date"],
  ["dispatchedBy", "Dispatched By"],
  ["challanNumber", "Challan No."],
  ["driverName", "Driver"],
  ["vehicleNumber", "Vehicle"],
  ["remarks", "Remarks"],
];

const buildPackingItemPacketRow = (
  row,
  index
) => ({
  key: `packing-${rowValue(
    row,
    ["zohoItemId", "id"],
    index
  )}-${index}`,
  module: "Packing",
  zohoItemId: rowValue(row, [
    "zohoItemId",
    "itemId",
  ]),
  itemName: rowValue(row, [
    "itemName",
    "name",
  ]),
  clientName: rowValue(row, [
    "clientName",
    "client",
  ]),
  packetNumber: getPacketNumber(row),
  packetName: getPacketName(row),
  status: "PACKED",
  actionAt: getExcelDateTime(
    rowValue(row, ["packedAt"], null)
  ),
  actionBy: rowValue(row, [
    "packedBy",
    "createdBy",
  ]),
  ageDays: "-",
});

const buildDispatchItemPacketRow = (
  row,
  index
) => ({
  key: `dispatch-${rowValue(
    row,
    [
      "challanNumber",
      "zohoItemId",
      "id",
    ],
    index
  )}-${rowValue(
    row,
    ["dispatchedAt"],
    "date"
  )}-${index}`,

  serialNumber: index + 1,

  module: "Dispatch",

  zohoItemId: rowValue(
    row,
    [
      "zohoItemId",
      "itemId",
    ],
    "-"
  ),

  pdNo: getPdNo(row),

  drawingNo:
    getDrawingNo(row),

  sku: rowValue(
    row,
    [
      "sku",
      "codeSku",
      "code",
    ],
    "-"
  ),

  itemName: rowValue(
    row,
    [
      "itemName",
      "name",
    ],
    "-"
  ),

  description: rowValue(
    row,
    [
      "description",
      "itemDescription",
    ],
    "-"
  ),

  clientName: rowValue(
    row,
    [
      "clientName",
      "client",
    ],
    "-"
  ),

  clientAddress: rowValue(
    row,
    [
      "clientAddress",
      "address",
    ],
    "-"
  ),

  plantCode: rowValue(
    row,
    [
      "plantCode",
      "plant",
    ],
    "-"
  ),

  floor: rowValue(
    row,
    [
      "floor",
      "factoryFloor",
    ],
    "-"
  ),

  area: getArea(row),

  warehouseCode: rowValue(
    row,
    [
      "warehouseCode",
      "warehouse",
    ],
    "-"
  ),

  packetNumber:
    getPacketNumber(row),

  packetName:
    getPacketName(row),

  quantity: numberValue(
    rowValue(
      row,
      [
        "quantity",
        "qty",
      ],
      1
    )
  ),

  status: getItemStatus(
    row,
    "DISPATCHED"
  ),

  packedAt: getExcelDateTime(
    rowValue(
      row,
      [
        "packedAt",
        "packingDate",
      ],
      null
    )
  ),

  packedBy: rowValue(
    row,
    [
      "packedBy",
      "createdBy",
    ],
    "-"
  ),

  dispatchedAt:
    getExcelDateTime(
      rowValue(
        row,
        [
          "dispatchedAt",
          "dispatchDate",
        ],
        null
      )
    ),

  dispatchedBy: rowValue(
    row,
    [
      "dispatchedBy",
      "createdBy",
    ],
    "-"
  ),

  challanNumber: rowValue(
    row,
    [
      "challanNumber",
      "chalaanNumber",
    ],
    "-"
  ),

  driverName: rowValue(
    row,
    [
      "driverName",
      "driver",
    ],
    "-"
  ),

  vehicleNumber: rowValue(
    row,
    [
      "vehicleNumber",
      "vehicleNo",
    ],
    "-"
  ),

  remarks: rowValue(
    row,
    [
      "remarks",
      "remark",
    ],
    "-"
  ),

  /*
   * Existing compact item/packet fields remain available.
   */
  actionAt: getExcelDateTime(
    rowValue(
      row,
      ["dispatchedAt"],
      null
    )
  ),

  actionBy: rowValue(
    row,
    [
      "dispatchedBy",
      "createdBy",
    ],
    "-"
  ),

  ageDays: "-",
});

const buildInventoryItemPacketRow = (
  row,
  index
) => ({
  key: `inventory-${rowValue(
    row,
    ["zohoItemId", "itemId", "id"],
    index
  )}-${index}`,
  module: "Inventory",
  zohoItemId: rowValue(row, [
    "zohoItemId",
    "itemId",
  ]),
  itemName: rowValue(row, [
    "itemName",
    "name",
  ]),
  clientName: rowValue(row, [
    "clientName",
    "client",
  ]),
  packetNumber: getPacketNumber(row),
  packetName: getPacketName(row),
  status: getItemStatus(row, "INVENTORY"),
  actionAt: getExcelDateTime(
    rowValue(
      row,
      [
        "createdAt",
        "receivedAt",
        "packedAt",
        "date",
      ],
      null
    )
  ),
  actionBy: rowValue(row, [
    "createdBy",
    "packedBy",
    "dispatchedBy",
  ]),
  ageDays: getAgeDays(row),
});

const groupBy = (
  rows,
  keyGetter,
  initialFactory,
  update
) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = keyGetter(row);

    const current =
      map.get(key) ||
      initialFactory(key, row);

    update(current, row);

    map.set(key, current);
  });

  return Array.from(map.values());
};

const makeSearchText = (row) =>
  Object.values(row || {})
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const formatReportCell = (key, value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  if (
    key === "volumeCbm" ||
    key === "avgCbmPerPacket"
  ) {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return formatCbm(numeric);
    }
  }

  return value;
};

const extractReportRows = (
  payload
) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    Array.isArray(
      payload?.rows
    )
  ) {
    return payload.rows;
  }

  if (
    Array.isArray(
      payload?.content
    )
  ) {
    return payload.content;
  }

  if (
    Array.isArray(
      payload?.items
    )
  ) {
    return payload.items;
  }

  if (
    Array.isArray(
      payload?.data
    )
  ) {
    return payload.data;
  }

  return [];
};

const formatMasterReportRows = (
  rows,
  keyPrefix = "master"
) => {
  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  return sourceRows.map(
    (row, index) => ({
      key:
        row?.masterItemId ||
        `${keyPrefix}-${index}`,

      ...row,

      drawingName:
        row?.drawingName ||
        row?.drawingNo ||
        "-",

      packingProgress:
        row?.packingProgress !== undefined &&
          row?.packingProgress !== null
          ? `${Math.round(
            Number(
              row.packingProgress ||
              0
            )
          )}%`
          : "0%",

      exceptionReason:
        row?.exceptionReason ||
        "Clear",
    })
  );
};

function InventoryReports() {
  const [loading, setLoading] =
    useState(true);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [volumeError, setVolumeError] =
    useState("");

  const [fromDate, setFromDate] =
    useState(monthStartDate());

  const [toDate, setToDate] =
    useState(todayDate());

  const [search, setSearch] =
    useState("");

  const [reportMode, setReportMode] =
    useState("DIRECTOR_DASHBOARD");

  const [stats, setStats] =
    useState({});

  const [packingRows, setPackingRows] =
    useState([]);

  const [packingVolumeRows, setPackingVolumeRows] =
    useState([]);

  const [dispatchRows, setDispatchRows] =
    useState([]);

  const [combinedRows, setCombinedRows] =
    useState([]);

  const [agingRows, setAgingRows] =
    useState([]);

  const [masterRows, setMasterRows] =
    useState([]);

  const [supplementalLoading, setSupplementalLoading] =
    useState(false);

  const [tablePage, setTablePage] =
    useState(0);

  const [tablePageSize, setTablePageSize] =
    useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    let active = true;
    let cancelSupplemental = () => {};

    const from =
      toStartDateTime(monthStartDate());

    const to =
      toEndDateTime(todayDate());

    const cacheKey =
      getReportRangeCacheKey(from, to);

    const applyCore = (snapshot) => {
      if (!active || !snapshot) return;

      setStats(normalizeStats(snapshot.statsData || {}));
      setPackingRows(Array.isArray(snapshot.packingData) ? snapshot.packingData : []);
      setPackingVolumeRows(Array.isArray(snapshot.packingVolumeData) ? snapshot.packingVolumeData : []);
      setDispatchRows(Array.isArray(snapshot.dispatchData) ? snapshot.dispatchData : []);
      setAgingRows(Array.isArray(snapshot.agingData) ? snapshot.agingData : []);

      if (Array.isArray(snapshot.combinedData)) {
        setCombinedRows(snapshot.combinedData);
      }

      if (snapshot.masterData !== undefined) {
        setMasterRows(extractReportRows(snapshot.masterData));
      }
    };

    const loadSupplemental = (coreSnapshot) => {
      cancelSupplemental = scheduleWhenIdle(async () => {
        if (!active) return;

        try {
          setSupplementalLoading(true);

          const shouldLoadCombined =
            !Array.isArray(coreSnapshot?.agingData) ||
            coreSnapshot.agingData.length === 0;

          const [masterData, combinedData] = await Promise.all([
            fetchMasterItemReport({
              from,
              to,
              limit: 700,
            }).catch(() => []),
            shouldLoadCombined
              ? fetchCombinedReport(from, to).catch(() => [])
              : Promise.resolve([]),
          ]);

          if (!active) return;

          setMasterRows(extractReportRows(masterData));

          if (shouldLoadCombined) {
            setCombinedRows(Array.isArray(combinedData) ? combinedData : []);
          }

          writeReportSnapshot(cacheKey, {
            masterData,
            ...(shouldLoadCombined ? { combinedData } : {}),
          });
        } finally {
          if (active) {
            setSupplementalLoading(false);
          }
        }
      });
    };

    const cached =
      readReportSnapshot(cacheKey);

    if (cached) {
      applyCore(cached);
      setLoading(false);

      const cachedNeedsCombined =
        (!Array.isArray(cached.agingData) || cached.agingData.length === 0) &&
        !Array.isArray(cached.combinedData);

      if (cached.masterData === undefined || cachedNeedsCombined) {
        loadSupplemental(cached);
      }

      return () => {
        active = false;
        cancelSupplemental();
      };
    }

    setLoading(true);

    Promise.all([
      fetchDashboardStats().catch(() => ({})),
      fetchPackingReport(from, to).catch(() => []),
      fetchPackingVolumeReport(from, to).catch((volumeLoadError) => {
        console.error(
          "Packing volume report load failed:",
          volumeLoadError
        );

        if (active) {
          setVolumeError(
            "Packing volume data could not be loaded. Deploy the /api/reports/packing/volume backend fix to enable cubic-metre reporting."
          );
        }

        return [];
      }),
      fetchDispatchReport(from, to).catch(() => []),
      fetchInventoryAging().catch(() => []),
    ])
      .then(([
        statsData,
        packingData,
        packingVolumeData,
        dispatchData,
        agingData,
      ]) => {
        if (!active) return;

        const coreSnapshot = {
          statsData,
          packingData,
          packingVolumeData,
          dispatchData,
          agingData,
        };

        applyCore(coreSnapshot);
        writeReportSnapshot(cacheKey, coreSnapshot);
        loadSupplemental(coreSnapshot);
      })
      .catch((e) => {
        if (!active) return;

        console.error(e);
        setError(
          "Failed to load inventory reports"
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      cancelSupplemental();
    };
  }, []);

  const loadReports = async () => {
    const from =
      toStartDateTime(fromDate);

    const to =
      toEndDateTime(toDate);

    const cacheKey =
      getReportRangeCacheKey(from, to);

    try {
      setLoading(true);
      setError("");
      setVolumeError("");
      setTablePage(0);

      /*
       * Fast path: only the datasets required for the visible Director/
       * throughput/volume experience block the loading state. The large
       * master/combined registers are deliberately loaded after paint.
       */
      const [
        statsData,
        packingData,
        packingVolumeData,
        dispatchData,
        agingData,
      ] = await Promise.all([
        fetchDashboardStats().catch(() => ({})),
        fetchPackingReport(from, to).catch(() => []),
        fetchPackingVolumeReport(from, to, { forceRefresh: true }).catch((volumeLoadError) => {
          console.error(
            "Packing volume report load failed:",
            volumeLoadError
          );
          setVolumeError(
            "Packing volume data could not be loaded. Deploy the /api/reports/packing/volume backend fix to enable cubic-metre reporting."
          );
          return [];
        }),
        fetchDispatchReport(from, to).catch(() => []),
        fetchInventoryAging().catch(() => []),
      ]);

      setStats(normalizeStats(statsData || {}));
      setPackingRows(Array.isArray(packingData) ? packingData : []);
      setPackingVolumeRows(Array.isArray(packingVolumeData) ? packingVolumeData : []);
      setDispatchRows(Array.isArray(dispatchData) ? dispatchData : []);
      setAgingRows(Array.isArray(agingData) ? agingData : []);

      /* Old supplemental rows belong to the previous date range. */
      setCombinedRows([]);
      setMasterRows([]);

      const coreSnapshot = {
        statsData,
        packingData,
        packingVolumeData,
        dispatchData,
        agingData,
      };

      writeReportSnapshot(cacheKey, coreSnapshot);

      /*
       * Do not keep the page spinner alive for large detail registers.
       * They fill in immediately afterwards and are cached for revisits.
       */
      scheduleWhenIdle(async () => {
        try {
          setSupplementalLoading(true);

          const shouldLoadCombined =
            !Array.isArray(agingData) || agingData.length === 0;

          const [masterData, combinedData] = await Promise.all([
            fetchMasterItemReport({
              from,
              to,
              limit: 700,
            }).catch(() => []),
            shouldLoadCombined
              ? fetchCombinedReport(from, to).catch(() => [])
              : Promise.resolve([]),
          ]);

          setMasterRows(extractReportRows(masterData));

          if (shouldLoadCombined) {
            setCombinedRows(Array.isArray(combinedData) ? combinedData : []);
          }

          writeReportSnapshot(cacheKey, {
            masterData,
            ...(shouldLoadCombined ? { combinedData } : {}),
          });
        } finally {
          setSupplementalLoading(false);
        }
      });
    } catch (e) {
      console.error(e);

      setError(
        "Failed to load inventory reports"
      );
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFromDate(monthStartDate());
    setToDate(todayDate());
    setSearch("");
  };

  const dateWiseRows = useMemo(() => {
    const map = new Map();

    packingRows.forEach((row) => {
      const dateValue = rowValue(
        row,
        ["packedAt", "date"],
        null
      );

      const key = getDateKey(dateValue);

      const current =
        map.get(key) || {
          key,
          label: formatDate(dateValue),
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.packed += 1;
      current.total += 1;

      map.set(key, current);
    });

    dispatchRows.forEach((row) => {
      const dateValue = rowValue(
        row,
        ["dispatchedAt", "date"],
        null
      );

      const key = getDateKey(dateValue);

      const current =
        map.get(key) || {
          key,
          label: formatDate(dateValue),
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.dispatched += 1;
      current.total += 1;

      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) =>
        b.key.localeCompare(a.key)
      );
  }, [packingRows, dispatchRows]);

  const packingUserRows = useMemo(() => {
    return groupBy(
      packingRows,
      (row) =>
        String(
          rowValue(
            row,
            ["packedBy", "createdBy"],
            "UNKNOWN"
          )
        ),
      (key) => ({
        key,
        user: key,
        count: 0,
        clients: new Set(),
      }),
      (current, row) => {
        current.count += 1;
        current.clients.add(
          rowValue(row, [
            "clientName",
            "client",
          ])
        );
      }
    )
      .map((row) => ({
        ...row,
        clientCount:
          row.clients.size,
      }))
      .sort((a, b) =>
        b.count - a.count
      );
  }, [packingRows]);

  const dispatchUserRows = useMemo(() => {
    return groupBy(
      dispatchRows,
      (row) =>
        String(
          rowValue(
            row,
            ["dispatchedBy", "createdBy"],
            "UNKNOWN"
          )
        ),
      (key) => ({
        key,
        user: key,
        count: 0,
        clients: new Set(),
      }),
      (current, row) => {
        current.count += 1;
        current.clients.add(
          rowValue(row, [
            "clientName",
            "client",
          ])
        );
      }
    )
      .map((row) => ({
        ...row,
        clientCount:
          row.clients.size,
      }))
      .sort((a, b) =>
        b.count - a.count
      );
  }, [dispatchRows]);

  const clientWiseRows = useMemo(() => {
    const map = new Map();

    packingRows.forEach((row) => {
      const client = String(
        rowValue(row, [
          "clientName",
          "client",
        ])
      );

      const current =
        map.get(client) || {
          key: client,
          client,
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.packed += 1;
      current.total += 1;

      map.set(client, current);
    });

    dispatchRows.forEach((row) => {
      const client = String(
        rowValue(row, [
          "clientName",
          "client",
        ])
      );

      const current =
        map.get(client) || {
          key: client,
          client,
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.dispatched += 1;
      current.total += 1;

      map.set(client, current);
    });

    return Array.from(map.values())
      .sort((a, b) =>
        b.total - a.total
      );
  }, [packingRows, dispatchRows]);

  const volumeDetailRows = useMemo(() => {
    return packingVolumeRows.map(
      (row, index) => ({
        key:
          row?.packetItemId ||
          `packing-volume-${index}`,
        serialNumber: index + 1,
        packetItemId:
          row?.packetItemId || "-",
        zohoItemId: rowValue(
          row,
          ["zohoItemId"],
          "-"
        ),
        pdNo: getPdNo(row),
        drawingNo: getDrawingNo(row),
        sku: rowValue(
          row,
          ["sku"],
          "-"
        ),
        itemName: rowValue(
          row,
          ["itemName"],
          "-"
        ),
        description: rowValue(
          row,
          ["description"],
          "-"
        ),
        clientName: rowValue(
          row,
          ["clientName", "client"],
          "-"
        ),
        clientAddress: rowValue(
          row,
          ["clientAddress"],
          "-"
        ),
        plantCode: rowValue(
          row,
          ["plantCode"],
          "-"
        ),
        floor: rowValue(
          row,
          ["floor"],
          "-"
        ),
        packetNumber: getPacketNumber(row),
        quantity: numberValue(
          rowValue(row, ["quantity"], 1)
        ),
        dimensions: rowValue(
          row,
          ["dimensions"],
          "-"
        ),
        volumeCbm: hasMeasuredVolume(row)
          ? roundCbm(row.volumeCbm)
          : "-",
        packedAt: getExcelDateTime(
          rowValue(row, ["packedAt"], null)
        ),
        packedBy: rowValue(
          row,
          ["packedBy"],
          "UNKNOWN"
        ),
        status: getItemStatus(row, "PACKED"),
        stickerNumber: rowValue(
          row,
          ["stickerNumber"],
          "-"
        ),
      })
    );
  }, [packingVolumeRows]);

  const volumeDateRows = useMemo(() => {
    const map = new Map();

    packingVolumeRows.forEach((row) => {
      const packedAt = rowValue(
        row,
        ["packedAt"],
        null
      );
      const key = getDateKey(packedAt);
      const current = map.get(key) || {
        key,
        date: formatDate(packedAt),
        packets: 0,
        measuredPackets: 0,
        missingDimensions: 0,
        volumeCbm: 0,
        users: new Set(),
      };

      current.packets += 1;
      current.users.add(
        rowValue(row, ["packedBy"], "UNKNOWN")
      );

      if (hasMeasuredVolume(row)) {
        current.measuredPackets += 1;
        current.volumeCbm += getVolumeCbm(row);
      } else {
        current.missingDimensions += 1;
      }

      map.set(key, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        volumeCbm: roundCbm(row.volumeCbm),
        avgCbmPerPacket: roundCbm(
          safeDivide(
            row.volumeCbm,
            row.measuredPackets
          )
        ),
        userCount: row.users.size,
        dimensionCoverage: `${Math.round(
          safeDivide(
            row.measuredPackets,
            row.packets
          ) * 100
        )}%`,
      }))
      .sort((a, b) =>
        b.key.localeCompare(a.key)
      );
  }, [packingVolumeRows]);

  const volumeUserRows = useMemo(() => {
    const totalVolume = packingVolumeRows.reduce(
      (sum, row) =>
        sum + getVolumeCbm(row),
      0
    );

    return groupBy(
      packingVolumeRows,
      (row) =>
        String(
          rowValue(
            row,
            ["packedBy"],
            "UNKNOWN"
          )
        ),
      (key) => ({
        key,
        user: key,
        packets: 0,
        measuredPackets: 0,
        missingDimensions: 0,
        volumeCbm: 0,
        clients: new Set(),
        plants: new Set(),
      }),
      (current, row) => {
        current.packets += 1;
        current.clients.add(
          rowValue(row, ["clientName"], "-")
        );
        current.plants.add(
          rowValue(row, ["plantCode"], "-")
        );

        if (hasMeasuredVolume(row)) {
          current.measuredPackets += 1;
          current.volumeCbm += getVolumeCbm(row);
        } else {
          current.missingDimensions += 1;
        }
      }
    )
      .map((row) => ({
        ...row,
        volumeCbm: roundCbm(row.volumeCbm),
        avgCbmPerPacket: roundCbm(
          safeDivide(
            row.volumeCbm,
            row.measuredPackets
          )
        ),
        clientCount: row.clients.size,
        plantCount: row.plants.size,
        packetShare: `${Math.round(
          safeDivide(
            row.packets,
            packingVolumeRows.length
          ) * 100
        )}%`,
        volumeShare: `${Math.round(
          safeDivide(
            row.volumeCbm,
            totalVolume
          ) * 100
        )}%`,
        dimensionCoverage: `${Math.round(
          safeDivide(
            row.measuredPackets,
            row.packets
          ) * 100
        )}%`,
      }))
      .sort((a, b) =>
        b.volumeCbm - a.volumeCbm
      );
  }, [packingVolumeRows]);

  const volumeClientRows = useMemo(() => {
    return groupBy(
      packingVolumeRows,
      (row) =>
        String(
          rowValue(
            row,
            ["clientName"],
            "UNKNOWN"
          )
        ),
      (key) => ({
        key,
        client: key,
        packets: 0,
        measuredPackets: 0,
        volumeCbm: 0,
      }),
      (current, row) => {
        current.packets += 1;
        if (hasMeasuredVolume(row)) {
          current.measuredPackets += 1;
          current.volumeCbm += getVolumeCbm(row);
        }
      }
    )
      .map((row) => ({
        ...row,
        volumeCbm: roundCbm(row.volumeCbm),
        avgCbmPerPacket: roundCbm(
          safeDivide(
            row.volumeCbm,
            row.measuredPackets
          )
        ),
        dimensionCoverage: `${Math.round(
          safeDivide(
            row.measuredPackets,
            row.packets
          ) * 100
        )}%`,
      }))
      .sort((a, b) =>
        b.volumeCbm - a.volumeCbm
      );
  }, [packingVolumeRows]);

  const volumePlantRows = useMemo(() => {
    return groupBy(
      packingVolumeRows,
      (row) =>
        String(
          rowValue(
            row,
            ["plantCode"],
            "UNKNOWN"
          )
        ),
      (key) => ({
        key,
        plant: key,
        packets: 0,
        measuredPackets: 0,
        volumeCbm: 0,
        users: new Set(),
      }),
      (current, row) => {
        current.packets += 1;
        current.users.add(
          rowValue(row, ["packedBy"], "UNKNOWN")
        );
        if (hasMeasuredVolume(row)) {
          current.measuredPackets += 1;
          current.volumeCbm += getVolumeCbm(row);
        }
      }
    )
      .map((row) => ({
        ...row,
        volumeCbm: roundCbm(row.volumeCbm),
        avgCbmPerPacket: roundCbm(
          safeDivide(
            row.volumeCbm,
            row.measuredPackets
          )
        ),
        userCount: row.users.size,
        dimensionCoverage: `${Math.round(
          safeDivide(
            row.measuredPackets,
            row.packets
          ) * 100
        )}%`,
      }))
      .sort((a, b) =>
        b.volumeCbm - a.volumeCbm
      );
  }, [packingVolumeRows]);

  const agingBucketRows = useMemo(() => {
    return groupBy(
      agingRows,
      (row) => getAgingBucket(row),
      (key) => ({
        key,
        bucket: key,
        count: 0,
      }),
      (current) => {
        current.count += 1;
      }
    ).sort((a, b) =>
      b.count - a.count
    );
  }, [agingRows]);

  const packingItemPacketRows = useMemo(() => {
    return packingRows.map(
      buildPackingItemPacketRow
    );
  }, [packingRows]);

  const dispatchItemPacketRows = useMemo(() => {
    return dispatchRows.map(
      buildDispatchItemPacketRow
    );
  }, [dispatchRows]);

  const inventoryItemPacketRows = useMemo(() => {
    const agingBasedRows =
      agingRows.map(
        buildInventoryItemPacketRow
      );

    if (agingBasedRows.length > 0) {
      return agingBasedRows;
    }

    return combinedRows.map(
      buildInventoryItemPacketRow
    );
  }, [agingRows, combinedRows]);

  const allItemPacketRows = useMemo(() => {
    return [
      ...inventoryItemPacketRows,
      ...packingItemPacketRows,
      ...dispatchItemPacketRows,
    ];
  }, [
    inventoryItemPacketRows,
    packingItemPacketRows,
    dispatchItemPacketRows,
  ]);

  const kpis = useMemo(() => {
    const totalInventory =
      numberValue(stats.totalItems);

    const pending =
      numberValue(stats.pendingItems) ||
      Math.max(
        totalInventory -
        numberValue(stats.packedItems) -
        numberValue(
          stats.dispatchedItems
        ),
        0
      );

    const uniqueClients = new Set([
      ...packingRows.map((row) =>
        rowValue(row, [
          "clientName",
          "client",
        ])
      ),
      ...dispatchRows.map((row) =>
        rowValue(row, [
          "clientName",
          "client",
        ])
      ),
    ]);

    uniqueClients.delete("-");
    uniqueClients.delete("");

    const criticalAging =
      agingRows.filter(
        (row) => getAgeDays(row) > 30
      ).length;

    return {
      totalInventory,

      warehouseItems:
        numberValue(stats.warehouseItems),

      readyToDispatch:
        numberValue(
          stats.readyToDispatchItems
        ),

      readyItems:
        numberValue(stats.readyItems),

      packedItems:
        numberValue(stats.packedItems),

      dispatchedItems:
        numberValue(
          stats.dispatchedItems
        ),

      pendingItems: pending,

      stickersGenerated:
        numberValue(
          stats.stickersGenerated
        ),

      packedInRange: packingRows.length,

      packingVolumeRows:
        packingVolumeRows.length,

      measuredVolumePackets:
        packingVolumeRows.filter(
          hasMeasuredVolume
        ).length,

      missingDimensionPackets:
        packingVolumeRows.filter(
          (row) => !hasMeasuredVolume(row)
        ).length,

      totalPackedVolumeCbm: roundCbm(
        packingVolumeRows.reduce(
          (sum, row) =>
            sum + getVolumeCbm(row),
          0
        )
      ),

      avgPackedVolumeCbm: roundCbm(
        safeDivide(
          packingVolumeRows.reduce(
            (sum, row) =>
              sum + getVolumeCbm(row),
            0
          ),
          packingVolumeRows.filter(
            hasMeasuredVolume
          ).length
        )
      ),

      dimensionCoverageRate: safeDivide(
        packingVolumeRows.filter(
          hasMeasuredVolume
        ).length,
        packingVolumeRows.length
      ),

      dispatchedInRange:
        dispatchRows.length,

      combinedInRange:
        combinedRows.length,

      agingItems: agingRows.length,

      criticalAging,

      uniqueClients:
        uniqueClients.size,

      completionRate: safeDivide(
        numberValue(stats.dispatchedItems),
        Math.max(totalInventory, 1)
      ),

      itemPacketRows:
        allItemPacketRows.length,

      inventoryItemPacketRows:
        inventoryItemPacketRows.length,

      packingItemPacketRows:
        packingItemPacketRows.length,

      dispatchItemPacketRows:
        dispatchItemPacketRows.length,

      masterItems:
        numberValue(stats.masterItems),

      totalPackets:
        numberValue(stats.totalPackets),

      packetItems:
        numberValue(stats.packetItems),

      fullyPackedMasterItems:
        numberValue(stats.fullyPackedMasterItems),

      partiallyPackedMasterItems:
        numberValue(stats.partiallyPackedMasterItems),

      unpackedMasterItems:
        numberValue(stats.unpackedMasterItems),

      packedPackets:
        numberValue(stats.packedPackets),

      pendingPackets:
        numberValue(stats.pendingPackets),

      packetItemsWithSticker:
        numberValue(stats.packetItemsWithSticker),

      packetItemsPendingSticker:
        numberValue(stats.packetItemsPendingSticker),

      stickerReprints:
        numberValue(stats.stickerReprints),

      normalDispatchChallans:
        numberValue(stats.normalDispatchChallans),

      todayDispatchChallans:
        numberValue(stats.todayDispatchChallans),

      runningTrips:
        numberValue(stats.runningTrips),

      customChallans:
        numberValue(stats.customChallans),

      customChallanItems:
        numberValue(stats.customChallanItems),

      exceptionsCount:
        numberValue(stats.exceptionsCount),
    };
  }, [
    stats,
    packingRows,
    packingVolumeRows,
    dispatchRows,
    combinedRows,
    agingRows,
    allItemPacketRows,
    inventoryItemPacketRows,
    packingItemPacketRows,
    dispatchItemPacketRows,
  ]);

  const masterItemColumns = [
    ["itemName", "Master Item"],
    ["pdNo", "PD No"],
    ["drawingName", "Drawing"],
    ["clientName", "Client"],
    ["plantCode", "Plant"],
    ["floor", "Floor"],
    ["expectedPackets", "Expected Packets"],
    ["actualPackets", "Actual Packets"],
    ["packetItems", "Packet Items"],
    ["packedPacketItems", "Packed"],
    ["pendingPacketItems", "Pending"],
    ["dispatchedPacketItems", "Dispatched"],
    ["packingProgress", "Progress %"],
    ["packingStatus", "Packing Status"],
    ["latestStatus", "Latest Status"],
    ["stickerCount", "Stickers"],
    ["challanCount", "Challans"],
    ["lastPackedBy", "Last Packed By"],
    ["lastDispatchedBy", "Last Dispatched By"],
    ["exceptionReason", "Exception"],
  ];

  const formattedMasterRows =
    useMemo(
      () =>
        formatMasterReportRows(
          masterRows,
          "master"
        ),
      [masterRows]
    );

  const directorData = useMemo(() => {
    const selectedDateKeys =
      enumerateDateKeys(
        fromDate,
        toDate
      );

    const dailyMap = new Map(
      selectedDateKeys.map((key) => [
        key,
        {
          key,
          label: formatShortDateKey(key),
          shortLabel: formatShortDateKey(key),
          packed: 0,
          dispatched: 0,
          total: 0,
        },
      ])
    );

    packingRows.forEach((row) => {
      const key = getDateKey(
        rowValue(
          row,
          ["packedAt", "date"],
          null
        )
      );

      if (!key || key === "-") return;

      const current =
        dailyMap.get(key) || {
          key,
          label: formatShortDateKey(key),
          shortLabel: formatShortDateKey(key),
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.packed += 1;
      current.total += 1;
      dailyMap.set(key, current);
    });

    dispatchRows.forEach((row) => {
      const key = getDateKey(
        rowValue(
          row,
          ["dispatchedAt", "date"],
          null
        )
      );

      if (!key || key === "-") return;

      const current =
        dailyMap.get(key) || {
          key,
          label: formatShortDateKey(key),
          shortLabel: formatShortDateKey(key),
          packed: 0,
          dispatched: 0,
          total: 0,
        };

      current.dispatched += 1;
      current.total += 1;
      dailyMap.set(key, current);
    });

    const dailyRows = Array.from(
      dailyMap.values()
    ).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    const statusOrder = [
      "READY",
      "READY_TO_DISPATCH",
      "IN_WAREHOUSE",
      "WAREHOUSE_REQUESTED",
      "READY_TO_STORE",
    ];

    const statusMap = new Map(
      statusOrder.map((status) => [
        status,
        0,
      ])
    );

    agingRows.forEach((row) => {
      const status =
        getDirectorStatus(row);

      statusMap.set(
        status,
        (statusMap.get(status) || 0) + 1
      );
    });

    const statusBars = statusOrder.map(
      (status) => ({
        key: status,
        label: status.replaceAll("_", " "),
        value: statusMap.get(status) || 0,
      })
    );

    const coreInventory =
      (statusMap.get("READY") || 0) +
      (statusMap.get("READY_TO_DISPATCH") || 0) +
      (statusMap.get("IN_WAREHOUSE") || 0);

    const transitionInventory =
      (statusMap.get("WAREHOUSE_REQUESTED") || 0) +
      (statusMap.get("READY_TO_STORE") || 0);

    const currentInventoryPackets =
      agingRows.length ||
      inventoryItemPacketRows.length ||
      coreInventory + transitionInventory ||
      numberValue(stats.totalItems);

    const agingCounts = {
      zeroToSeven: 0,
      eightToThirty: 0,
      thirtyOneToNinety: 0,
      ninetyPlus: 0,
    };

    let ninetyPlusInWarehouse = 0;
    let agedReadyToDispatch = 0;

    agingRows.forEach((row) => {
      const days = getAgeDays(row);
      const status = getDirectorStatus(row);

      if (days <= 7) {
        agingCounts.zeroToSeven += 1;
      } else if (days <= 30) {
        agingCounts.eightToThirty += 1;
      } else if (days <= 90) {
        agingCounts.thirtyOneToNinety += 1;
      } else {
        agingCounts.ninetyPlus += 1;
      }

      if (
        days > 90 &&
        status === "IN_WAREHOUSE"
      ) {
        ninetyPlusInWarehouse += 1;
      }

      if (
        days > 30 &&
        days <= 90 &&
        status === "READY_TO_DISPATCH"
      ) {
        agedReadyToDispatch += 1;
      }
    });

    const agingBars = [
      {
        label: "0-7 Days",
        value: agingCounts.zeroToSeven,
      },
      {
        label: "8-30 Days",
        value: agingCounts.eightToThirty,
      },
      {
        label: "31-90 Days",
        value: agingCounts.thirtyOneToNinety,
      },
      {
        label: "90+ Days",
        value: agingCounts.ninetyPlus,
      },
    ];

    const agedOver30 =
      agingCounts.thirtyOneToNinety +
      agingCounts.ninetyPlus;

    const validPackToDispatchDays = [];
    let dispatchOverSevenDays = 0;
    let negativeDispatchTimestamps = 0;
    let missingPackingDateRows = 0;
    let missingVehicleRows = 0;
    let missingDriverRows = 0;

    const challanCounts = new Map();
    const dispatchPlantMap = new Map();

    dispatchRows.forEach((row) => {
      const packedValue = rowValue(
        row,
        ["packedAt", "packingDate"],
        null
      );
      const dispatchedValue = rowValue(
        row,
        ["dispatchedAt", "dispatchDate"],
        null
      );

      const packedMs =
        parseReportDateMs(packedValue);
      const dispatchedMs =
        parseReportDateMs(dispatchedValue);

      if (packedMs === null) {
        missingPackingDateRows += 1;
      }

      if (
        packedMs !== null &&
        dispatchedMs !== null
      ) {
        const days =
          (dispatchedMs - packedMs) /
          86400000;

        if (days < 0) {
          negativeDispatchTimestamps += 1;
        } else {
          validPackToDispatchDays.push(days);

          if (days > 7) {
            dispatchOverSevenDays += 1;
          }
        }
      }

      const vehicle = rowValue(
        row,
        ["vehicleNumber", "vehicleNo"],
        null
      );

      if (isBlankReportValue(vehicle)) {
        missingVehicleRows += 1;
      }

      const driver = rowValue(
        row,
        ["driverName", "driver"],
        null
      );

      if (isBlankReportValue(driver)) {
        missingDriverRows += 1;
      }

      const challan = rowValue(
        row,
        ["challanNumber", "chalaanNumber"],
        null
      );

      if (!isBlankReportValue(challan)) {
        const key = String(challan).trim();
        challanCounts.set(
          key,
          (challanCounts.get(key) || 0) + 1
        );
      }

      const plant = String(
        rowValue(
          row,
          ["plantCode", "plant"],
          "Unassigned"
        )
      ).trim() || "Unassigned";

      dispatchPlantMap.set(
        plant,
        (dispatchPlantMap.get(plant) || 0) + 1
      );
    });

    const medianPackToDispatchDays =
      medianNumber(
        validPackToDispatchDays
      );

    const averagePackToDispatchDays =
      safeDivide(
        validPackToDispatchDays.reduce(
          (sum, value) => sum + value,
          0
        ),
        validPackToDispatchDays.length
      );

    const challanPacketCounts =
      Array.from(challanCounts.values());

    const uniqueChallans =
      challanCounts.size;

    const averagePacketsPerChallan =
      safeDivide(
        challanPacketCounts.reduce(
          (sum, value) => sum + value,
          0
        ),
        challanPacketCounts.length
      );

    const medianPacketsPerChallan =
      medianNumber(
        challanPacketCounts
      );

    const dispatchPlantBars =
      Array.from(
        dispatchPlantMap.entries()
      )
        .map(([label, value]) => ({
          label,
          value,
        }))
        .sort((a, b) =>
          b.value - a.value
        )
        .slice(0, 8);

    const peakMovement =
      [...dailyRows]
        .sort(
          (a, b) => b.total - a.total
        )[0] || null;

    const peakPacking =
      [...dailyRows]
        .sort(
          (a, b) => b.packed - a.packed
        )[0] || null;

    const peakDispatch =
      [...dailyRows]
        .sort(
          (a, b) =>
            b.dispatched - a.dispatched
        )[0] || null;

    const comparisonEnd =
      toDate === todayDate()
        ? addDaysYmd(toDate, -1)
        : toDate;

    const latestStart =
      addDaysYmd(comparisonEnd, -6);
    const previousEnd =
      addDaysYmd(latestStart, -1);
    const previousStart =
      addDaysYmd(previousEnd, -6);

    const comparisonAvailable =
      Boolean(
        previousStart &&
        fromDate &&
        previousStart >= fromDate &&
        comparisonEnd <= toDate
      );

    const sumBetween = (
      field,
      start,
      end
    ) =>
      dailyRows.reduce((sum, row) => {
        if (
          row.key >= start &&
          row.key <= end
        ) {
          return sum + Number(row[field] || 0);
        }

        return sum;
      }, 0);

    const previousPacked =
      comparisonAvailable
        ? sumBetween(
          "packed",
          previousStart,
          previousEnd
        )
        : 0;

    const latestPacked =
      comparisonAvailable
        ? sumBetween(
          "packed",
          latestStart,
          comparisonEnd
        )
        : 0;

    const previousDispatched =
      comparisonAvailable
        ? sumBetween(
          "dispatched",
          previousStart,
          previousEnd
        )
        : 0;

    const latestDispatched =
      comparisonAvailable
        ? sumBetween(
          "dispatched",
          latestStart,
          comparisonEnd
        )
        : 0;

    const packingWow =
      comparisonAvailable &&
      previousPacked > 0
        ? (latestPacked - previousPacked) /
          previousPacked
        : 0;

    const dispatchWow =
      comparisonAvailable &&
      previousDispatched > 0
        ? (
          latestDispatched -
          previousDispatched
        ) /
          previousDispatched
        : 0;

    const previousThroughput =
      previousPacked + previousDispatched;
    const latestThroughput =
      latestPacked + latestDispatched;

    const throughputWow =
      comparisonAvailable &&
      previousThroughput > 0
        ? (
          latestThroughput -
          previousThroughput
        ) /
          previousThroughput
        : 0;

    const clientSourceRows = [
      ...agingRows,
      ...packingRows,
      ...dispatchRows,
    ];

    const rawClientLabels = new Set();
    const normalizedClientLabels =
      new Set();
    let placeholderClientRows = 0;

    clientSourceRows.forEach((row) => {
      const raw = rowValue(
        row,
        ["clientName", "client"],
        null
      );

      if (raw === null) return;

      const exact = String(raw);
      const normalized =
        normalizeClientIdentity(raw);

      if (exact.trim()) {
        rawClientLabels.add(exact);
      }

      if (normalized) {
        normalizedClientLabels.add(
          normalized
        );
      }

      if (!/[A-Z0-9]/i.test(exact)) {
        placeholderClientRows += 1;
      }
    });

    const masterZeroProgress =
      formattedMasterRows.filter((row) => {
        const value = row?.packingProgress;

        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return false;
        }

        return (
          Number(
            String(value).replace("%", "")
          ) === 0
        );
      }).length;

    const masterBlankLatestStatus =
      formattedMasterRows.filter((row) =>
        isBlankReportValue(
          row?.latestStatus
        )
      ).length;

    const netClearance =
      dispatchRows.length -
      packingRows.length;

    const packedPerDay = safeDivide(
      packingRows.length,
      Math.max(
        selectedDateKeys.length,
        1
      )
    );

    const dispatchPackingRatio =
      safeDivide(
        dispatchRows.length,
        packingRows.length
      );

    const agedOver30Share =
      safeDivide(
        agedOver30,
        currentInventoryPackets
      );

    const ninetyInWarehouseShare =
      safeDivide(
        ninetyPlusInWarehouse,
        agingCounts.ninetyPlus
      );

    const delayedDispatchShare =
      safeDivide(
        dispatchOverSevenDays,
        validPackToDispatchDays.length
      );

    const missingVehicleShare =
      safeDivide(
        missingVehicleRows,
        dispatchRows.length
      );

    const kpiCards = [
      {
        key: "currentInventory",
        title: "Current Inventory Packets",
        value: currentInventoryPackets,
        detail: `${coreInventory.toLocaleString("en-IN")} core states + ${transitionInventory.toLocaleString("en-IN")} transition-state rows`,
        tone: "blue",
      },
      {
        key: "packed",
        title: `Packed | ${formatShortDateKey(fromDate)}–${formatShortDateKey(toDate)}`,
        value: packingRows.length,
        detail: `${formatOneDecimal(packedPerDay)} packets/day • ${formatCbm(kpis.totalPackedVolumeCbm)} m³ packed`,
        tone: "green",
      },
      {
        key: "dispatched",
        title: `Dispatched | ${formatShortDateKey(fromDate)}–${formatShortDateKey(toDate)}`,
        value: dispatchRows.length,
        detail: `${formatOneDecimal(dispatchPackingRatio * 100)}% of period packing throughput`,
        tone: "green",
      },
      {
        key: "agedOver30",
        title: "Inventory >30 Days",
        value: agedOver30,
        detail: `${formatOneDecimal(agedOver30Share * 100)}% of current inventory packet rows`,
        tone: "red",
      },
      {
        key: "ninetyPlus",
        title: "Inventory 90+ Days",
        value: agingCounts.ninetyPlus,
        detail: `${ninetyPlusInWarehouse.toLocaleString("en-IN")} (${formatOneDecimal(ninetyInWarehouseShare * 100)}%) of 90+ rows are in warehouse`,
        tone: "red",
      },
      {
        key: "clearance",
        title: "Net Clearance",
        value: netClearance,
        detail:
          netClearance >= 0
            ? "More dispatched than packed in the selected period"
            : "Packing exceeded dispatch in the selected period",
        tone: "green",
      },
      {
        key: "leadTime",
        title: "Median Pack → Dispatch",
        value: `${formatOneDecimal(medianPackToDispatchDays)} d`,
        detail: `${dispatchOverSevenDays.toLocaleString("en-IN")} valid dispatches (${formatOneDecimal(delayedDispatchShare * 100)}%) took >7 days`,
        tone: "amber",
      },
      {
        key: "challans",
        title: "Unique Challans",
        value: uniqueChallans,
        detail: `Median ${formatOneDecimal(medianPacketsPerChallan)} packets/challan; average ${formatOneDecimal(averagePacketsPerChallan)}`,
        tone: "blue",
      },
    ];

    const completedPeriodsLabel =
      comparisonAvailable
        ? `${formatShortDateKey(previousStart)}–${formatShortDateKey(previousEnd)} vs ${formatShortDateKey(latestStart)}–${formatShortDateKey(comparisonEnd)}`
        : "Select at least 14 completed days for week-on-week comparison";

    const readouts = [
      {
        key: "clearance",
        title: "Clearance / Throughput",
        tone: "green",
        lines: [
          `${dispatchRows.length.toLocaleString("en-IN")} dispatched vs ${packingRows.length.toLocaleString("en-IN")} packed → net clearance of ${netClearance.toLocaleString("en-IN")}.`,
          comparisonAvailable
            ? `Latest completed week: dispatch ${formatSignedPercent(dispatchWow)}; packing ${formatSignedPercent(packingWow)}.`
            : completedPeriodsLabel,
          comparisonAvailable
            ? `Total throughput ${throughputWow >= 0 ? "increased" : "decreased"} ${Math.abs(throughputWow * 100).toFixed(1)}%.`
            : `Selected period volume: ${formatCbm(kpis.totalPackedVolumeCbm)} m³ with ${formatPercent(kpis.dimensionCoverageRate)} dimension coverage.`,
        ],
      },
      {
        key: "aging",
        title: "Aging / Cash & Space Risk",
        tone: "red",
        lines: [
          `${agedOver30.toLocaleString("en-IN")} inventory packet rows are >30 days (${formatOneDecimal(agedOver30Share * 100)}%).`,
          `${agingCounts.ninetyPlus.toLocaleString("en-IN")} are 90+ days; ${ninetyPlusInWarehouse.toLocaleString("en-IN")} are in warehouse.`,
          `${agedReadyToDispatch.toLocaleString("en-IN")} dispatch-ready rows are already 31–90 days old.`,
        ],
      },
      {
        key: "flow",
        title: "Flow / Capacity Signal",
        tone: "amber",
        lines: [
          peakMovement
            ? `Peak movement: ${peakMovement.label} with ${peakMovement.total.toLocaleString("en-IN")} movements.`
            : "No movement data in the selected period.",
          `Median pack-to-dispatch = ${formatOneDecimal(medianPackToDispatchDays)} days; average = ${formatOneDecimal(averagePackToDispatchDays)} days.`,
          comparisonAvailable
            ? `Dispatch ${formatSignedPercent(dispatchWow)} WoW; packing ${formatSignedPercent(packingWow)} WoW.`
            : `Peak packing ${peakPacking?.packed || 0}; peak dispatch ${peakDispatch?.dispatched || 0}.`,
        ],
      },
      {
        key: "controls",
        title: "Data / Control Signal",
        tone: "blue",
        lines: [
          `${negativeDispatchTimestamps.toLocaleString("en-IN")} dispatch rows have dispatch time before packing time.`,
          `${missingVehicleRows.toLocaleString("en-IN")} dispatch rows (${formatOneDecimal(missingVehicleShare * 100)}%) have no vehicle; ${missingDriverRows.toLocaleString("en-IN")} have no driver.`,
          `Client labels: ${rawClientLabels.size.toLocaleString("en-IN")} raw → ${normalizedClientLabels.size.toLocaleString("en-IN")} after case/space normalization.`,
        ],
      },
    ];

    const actions = [
      {
        priority:
          agingCounts.ninetyPlus > 0
            ? "CRITICAL"
            : "LOW",
        action:
          "Reconcile and disposition the 90+ day inventory",
        why: `${agingCounts.ninetyPlus.toLocaleString("en-IN")} rows are 90+ days; ${ninetyPlusInWarehouse.toLocaleString("en-IN")} are in warehouse`,
        owner: "Stores + Dispatch",
        timeframe: "72 hours",
      },
      {
        priority:
          agedReadyToDispatch > 0
            ? "HIGH"
            : "LOW",
        action:
          "Create a client-wise dispatch plan for aged READY_TO_DISPATCH",
        why: `${agedReadyToDispatch.toLocaleString("en-IN")} aged RTD rows are 31–90 days old`,
        owner: "Dispatch",
        timeframe: "48 hours",
      },
      {
        priority:
          agedOver30Share >= 0.25
            ? "HIGH"
            : agedOver30 > 0
              ? "MEDIUM"
              : "LOW",
        action:
          "Run >30-day inventory clean-out by top-risk clients",
        why: `${formatOneDecimal(agedOver30Share * 100)}% of inventory packet rows are >30 days`,
        owner: "Ops / Plant Heads",
        timeframe: "7 days",
      },
      {
        priority:
          negativeDispatchTimestamps > 0 ||
          missingVehicleShare >= 0.1
            ? "HIGH"
            : missingVehicleRows > 0 ||
              missingDriverRows > 0
              ? "MEDIUM"
              : "LOW",
        action:
          "Tighten dispatch data controls",
        why: `${negativeDispatchTimestamps.toLocaleString("en-IN")} negative timestamps; ${formatOneDecimal(missingVehicleShare * 100)}% vehicle field missing`,
        owner: "IT + Dispatch",
        timeframe: "Immediate",
      },
      {
        priority:
          comparisonAvailable &&
          packingWow < 0
            ? "MEDIUM"
            : "LOW",
        action:
          "Protect packing capacity while dispatch catches up",
        why: comparisonAvailable
          ? `Dispatch ${formatSignedPercent(dispatchWow)} WoW, packing ${formatSignedPercent(packingWow)}`
          : `${packingRows.length.toLocaleString("en-IN")} packets / ${formatCbm(kpis.totalPackedVolumeCbm)} m³ packed in selected period`,
        owner: "Packing",
        timeframe: "This week",
      },
      {
        priority:
          masterZeroProgress > 0 ||
          masterBlankLatestStatus > 0
            ? "MEDIUM"
            : "LOW",
        action:
          "Repair Master Items progress / latest-status logic",
        why: `${masterZeroProgress}/${formattedMasterRows.length} rows show 0% progress; latest status blank on ${masterBlankLatestStatus}`,
        owner: "IT / Product",
        timeframe: "This sprint",
      },
    ];

    return {
      selectedDateKeys,
      selectedCalendarDays:
        selectedDateKeys.length,
      currentInventoryPackets,
      totalPackedVolumeCbm:
        kpis.totalPackedVolumeCbm,
      dimensionCoverageRate:
        kpis.dimensionCoverageRate,
      coreInventory,
      transitionInventory,
      agedOver30,
      agedOver30Share,
      agingCounts,
      ninetyPlusInWarehouse,
      ninetyInWarehouseShare,
      agedReadyToDispatch,
      netClearance,
      packedPerDay,
      dispatchPackingRatio,
      medianPackToDispatchDays,
      averagePackToDispatchDays,
      validPackToDispatchRows:
        validPackToDispatchDays.length,
      dispatchOverSevenDays,
      delayedDispatchShare,
      uniqueChallans,
      averagePacketsPerChallan,
      medianPacketsPerChallan,
      missingVehicleRows,
      missingVehicleShare,
      missingDriverRows,
      negativeDispatchTimestamps,
      missingPackingDateRows,
      rawClientLabels:
        rawClientLabels.size,
      normalizedClientLabels:
        normalizedClientLabels.size,
      placeholderClientRows,
      peakMovement,
      peakPacking,
      peakDispatch,
      comparisonAvailable,
      comparison: {
        previousStart,
        previousEnd,
        latestStart,
        latestEnd: comparisonEnd,
        previousPacked,
        latestPacked,
        previousDispatched,
        latestDispatched,
        packingWow,
        dispatchWow,
        throughputWow,
        label: completedPeriodsLabel,
      },
      masterZeroProgress,
      masterBlankLatestStatus,
      dailyRows,
      agingBars,
      statusBars,
      dispatchPlantBars,
      kpiCards,
      readouts,
      actions,
      snapshotLabel:
        formatDirectorSnapshot(),
    };
  }, [
    fromDate,
    toDate,
    packingRows,
    dispatchRows,
    agingRows,
    inventoryItemPacketRows,
    stats,
    formattedMasterRows,
    kpis,
  ]);

  const tableConfigs = {
    DATE: {
      title: "Date-wise Throughput",
      columns: [
        ["label", "Date"],
        ["packed", "Packed"],
        ["dispatched", "Dispatched"],
        ["total", "Total"],
      ],
      rows: dateWiseRows,
    },

    MASTER_ITEMS: {
      title: "Master Item Register",
      columns: masterItemColumns,
      rows: formattedMasterRows,
    },

    PACKING_USER: {
      title: "Packing User-wise Report",
      columns: [
        ["user", "User"],
        ["count", "Packed"],
        ["clientCount", "Clients"],
      ],
      rows: packingUserRows,
    },

    VOLUME_USER: {
      title: "Packing Volume by User",
      columns: [
        ["user", "Packed By"],
        ["packets", "Packets"],
        ["measuredPackets", "Measured"],
        ["volumeCbm", "Packed Volume (m³)"],
        ["avgCbmPerPacket", "Avg m³ / Packet"],
        ["clientCount", "Clients"],
        ["plantCount", "Plants"],
        ["packetShare", "Packet Share"],
        ["volumeShare", "Volume Share"],
        ["dimensionCoverage", "Dimension Coverage"],
      ],
      rows: volumeUserRows,
    },

    VOLUME_DATE: {
      title: "Packing Volume by Date",
      columns: [
        ["date", "Date"],
        ["packets", "Packets Packed"],
        ["measuredPackets", "Measured"],
        ["volumeCbm", "Packed Volume (m³)"],
        ["avgCbmPerPacket", "Avg m³ / Packet"],
        ["userCount", "Packers"],
        ["missingDimensions", "Missing Dimensions"],
        ["dimensionCoverage", "Dimension Coverage"],
      ],
      rows: volumeDateRows,
    },

    VOLUME_CLIENT: {
      title: "Packing Volume by Client",
      columns: [
        ["client", "Client"],
        ["packets", "Packets"],
        ["measuredPackets", "Measured"],
        ["volumeCbm", "Packed Volume (m³)"],
        ["avgCbmPerPacket", "Avg m³ / Packet"],
        ["dimensionCoverage", "Dimension Coverage"],
      ],
      rows: volumeClientRows,
    },

    VOLUME_PLANT: {
      title: "Packing Volume by Plant",
      columns: [
        ["plant", "Plant"],
        ["packets", "Packets"],
        ["measuredPackets", "Measured"],
        ["volumeCbm", "Packed Volume (m³)"],
        ["avgCbmPerPacket", "Avg m³ / Packet"],
        ["userCount", "Packers"],
        ["dimensionCoverage", "Dimension Coverage"],
      ],
      rows: volumePlantRows,
    },

    VOLUME_DETAIL: {
      title: "Packing Volume Packet Register",
      columns: volumeDetailColumns,
      rows: volumeDetailRows,
    },

    DISPATCH_USER: {
      title: "Dispatch User-wise Report",
      columns: [
        ["user", "User"],
        ["count", "Dispatched"],
        ["clientCount", "Clients"],
      ],
      rows: dispatchUserRows,
    },

    CLIENT: {
      title: "Client-wise Movement",
      columns: [
        ["client", "Client"],
        ["packed", "Packed"],
        ["dispatched", "Dispatched"],
        ["total", "Total"],
      ],
      rows: clientWiseRows,
    },

    AGING: {
      title: "Inventory Aging Buckets",
      columns: [
        ["bucket", "Bucket"],
        ["count", "Items"],
      ],
      rows: agingBucketRows,
    },

    ALL_ITEMS: {
      title: "All Item / Packet Detail",
      columns: itemPacketColumns,
      rows: allItemPacketRows,
    },

    INVENTORY_ITEMS: {
      title: "Inventory Item / Packet Detail",
      columns: itemPacketColumns,
      rows: inventoryItemPacketRows,
    },

    PACKING_ITEMS: {
      title: "Packing Item / Packet Detail",
      columns: itemPacketColumns,
      rows: packingItemPacketRows,
    },

    DISPATCH_ITEMS: {
      title: "Detailed Dispatch Item Register",
      columns: dispatchDetailColumns,
      rows: dispatchItemPacketRows,
    },
  };

  const isDirectorDashboard =
    reportMode === "DIRECTOR_DASHBOARD";

  const activeConfig =
    tableConfigs[reportMode] ||
    tableConfigs.DATE;

  const searchTerm =
    search.trim().toLowerCase();

  const deferredSearchTerm =
    useDeferredValue(searchTerm);

  const activeRows =
    activeConfig?.rows || [];

  const visibleRows = useMemo(() => {
    if (!deferredSearchTerm) return activeRows;

    return activeRows.filter((row) =>
      makeSearchText(row).includes(
        deferredSearchTerm
      )
    );
  }, [activeRows, deferredSearchTerm]);

  useEffect(() => {
    setTablePage(0);
  }, [reportMode, deferredSearchTerm, tablePageSize]);

  const tablePageCount =
    Math.max(
      1,
      Math.ceil(
        visibleRows.length / tablePageSize
      )
    );

  const safeTablePage =
    Math.min(
      tablePage,
      tablePageCount - 1
    );

  const pagedVisibleRows = useMemo(() => {
    const start =
      safeTablePage * tablePageSize;

    return visibleRows.slice(
      start,
      start + tablePageSize
    );
  }, [visibleRows, safeTablePage, tablePageSize]);

  const topPacker =
    packingUserRows[0];

  const topVolumePacker =
    volumeUserRows.find(
      (row) => row.measuredPackets > 0
    );

  const peakVolumeDate =
    [...volumeDateRows]
      .filter(
        (row) => row.measuredPackets > 0
      )
      .sort(
        (a, b) => b.volumeCbm - a.volumeCbm
      )[0];

  const topVolumeClient =
    volumeClientRows.find(
      (row) => row.measuredPackets > 0
    );

  const topVolumePlant =
    volumePlantRows.find(
      (row) => row.measuredPackets > 0
    );

  const topDispatcher =
    dispatchUserRows[0];

  const busiestDate =
    dateWiseRows[0];

  const criticalBucket =
    agingBucketRows.find((row) =>
      String(row.bucket).includes("90")
    ) || agingBucketRows[0];

  const loadAllMasterItemRows =
    async () => {
      const pageSize = 700;
      const maximumPages = 100;

      const collected = [];

      let page = 0;
      let expectedTotal = null;

      while (
        page < maximumPages
      ) {
        const response =
          await fetchMasterItemReport({
            status: "ALL",

            from:
              toStartDateTime(
                fromDate
              ),

            to:
              toEndDateTime(
                toDate
              ),

            page,
            size: pageSize,

            limit: pageSize,
            offset:
              page *
              pageSize,
          });

        const batch =
          extractReportRows(
            response
          );

        collected.push(
          ...batch
        );

        /*
         * Do not default missing totals to zero.
         * Otherwise export would stop after page one.
         */
        const rawTotal =
          response?.total ??
          response?.totalElements ??
          response?.rowCount;

        if (
          rawTotal !== undefined &&
          rawTotal !== null &&
          rawTotal !== ""
        ) {
          const parsedTotal =
            Number(rawTotal);

          if (
            Number.isFinite(
              parsedTotal
            ) &&
            parsedTotal >= 0
          ) {
            expectedTotal =
              parsedTotal;
          }
        }

        if (
          batch.length === 0
        ) {
          break;
        }

        if (
          expectedTotal !== null &&
          collected.length >=
          expectedTotal
        ) {
          break;
        }

        if (
          batch.length <
          pageSize
        ) {
          break;
        }

        page += 1;
      }

      /*
       * Protect against accidental duplicate rows between pages.
       */
      const uniqueRows =
        new Map();

      collected.forEach(
        (row, index) => {
          const key =
            row?.masterItemId ||
            `master-row-${index}`;

          uniqueRows.set(
            key,
            row
          );
        }
      );

      return Array.from(
        uniqueRows.values()
      );
    };

  const buildExcelReport =
    async () => {

      /*
       * ExcelJS is intentionally code-split. It is a large dependency and
       * should never be parsed just because somebody opened Reports.
       */
      const [excelModule, fileSaverModule] =
        await Promise.all([
          import("exceljs"),
          import("file-saver"),
        ]);

      const ExcelJS =
        excelModule.default || excelModule;

      const saveAs =
        fileSaverModule.saveAs ||
        fileSaverModule.default?.saveAs ||
        fileSaverModule.default;

      const allMasterRows =
        await loadAllMasterItemRows();

      const exportMasterRows =
        formatMasterReportRows(
          allMasterRows,
          "master-export"
        );

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "ALSORG Inventory Dashboard";

      workbook.created = new Date();

      const addTitle = (
        sheet,
        title,
        colCount
      ) => {
        if (!sheet) {
          throw new Error(
            `Cannot add title "${title}" because worksheet is missing`
          );
        }

        const safeColumnCount =
          Math.max(
            Number(colCount || 1),
            1
          );

        sheet.mergeCells(
          1,
          1,
          1,
          safeColumnCount
        );

        const cell =
          sheet.getCell(1, 1);

        cell.value = title;

        cell.font = {
          bold: true,
          size: 18,
          color: {
            argb: "FFFFFFFF",
          },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FF0F172A",
          },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
        };

        sheet.getRow(1).height = 28;
      };

      const styleHeader = (row) => {
        row.eachCell((cell) => {
          cell.font = {
            bold: true,
            color: {
              argb: "FFFFFFFF",
            },
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
          };

          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      };

      const autoFit = (
        sheet
      ) => {
        sheet.columns.forEach(
          (column, columnIndex) => {
            let maximumLength = 12;

            /*
             * Scanning every cell in 10k+ row exports blocks the UI for no
             * visual benefit. Sample the header + first 500 data rows.
             */
            const scanLimit =
              Math.min(sheet.rowCount, 503);

            for (let rowIndex = 1; rowIndex <= scanLimit; rowIndex += 1) {
              const cell =
                sheet.getCell(rowIndex, columnIndex + 1);

              const rawValue = cell.value;
              let text = "";

              if (rawValue === null || rawValue === undefined) {
                text = "";
              } else if (typeof rawValue === "object") {
                text =
                  rawValue?.text ||
                  rawValue?.result ||
                  String(rawValue);
              } else {
                text = String(rawValue);
              }

              const longestLine =
                text
                  .split(/\r?\n/)
                  .reduce(
                    (longest, current) =>
                      Math.max(longest, current.length),
                    0
                  );

              maximumLength =
                Math.max(
                  maximumLength,
                  longestLine + 2
                );
            }

            /*
             * Wider maximum for descriptive columns.
             */
            const headerValue =
              String(
                sheet.getCell(
                  3,
                  columnIndex + 1
                ).value || ""
              ).toLowerCase();

            const isLongTextColumn =
              headerValue.includes(
                "item"
              ) ||
              headerValue.includes(
                "client"
              ) ||
              headerValue.includes(
                "exception"
              ) ||
              headerValue.includes(
                "insight"
              ) ||
              headerValue.includes(
                "recommendation"
              );

            const maximumWidth =
              isLongTextColumn
                ? 55
                : 36;

            column.width =
              Math.min(
                Math.max(
                  maximumLength,
                  12
                ),
                maximumWidth
              );
          }
        );
      };

      const finishSheet = (
        sheet
      ) => {
        sheet.views = [
          {
            state: "frozen",
            ySplit: 3,
          },
        ];

        autoFit(sheet);
      };

      const addRowsSheet = (
        name,
        title,
        columns = [],
        rows = []
      ) => {
        const cleanSheetName =
          String(name || "Report")
            .replace(
              /[\\/*?:[\]]/g,
              " "
            )
            .trim()
            .slice(0, 31) ||
          "Report";

        /*
         * Fail early with a meaningful error instead of
         * letting ExcelJS fail deep inside the workbook.
         */
        if (
          workbook.getWorksheet(
            cleanSheetName
          )
        ) {
          throw new Error(
            `Duplicate worksheet requested: ${cleanSheetName}`
          );
        }

        const safeColumns =
          Array.isArray(columns)
            ? columns
            : [];

        const safeRows =
          Array.isArray(rows)
            ? rows
            : [];

        const sheet =
          workbook.addWorksheet(
            cleanSheetName
          );

        addTitle(
          sheet,
          title,
          Math.max(
            safeColumns.length,
            1
          )
        );

        sheet.addRow([]);

        if (
          safeColumns.length === 0
        ) {
          sheet.addRow([
            "No columns configured",
          ]);

          finishSheet(sheet);

          return sheet;
        }

        const header =
          sheet.addRow(
            safeColumns.map(
              (column) =>
                column?.[1] ||
                column?.[0] ||
                "-"
            )
          );

        styleHeader(header);

        sheet.autoFilter = {
          from: {
            row: header.number,
            column: 1,
          },

          to: {
            row: header.number,
            column:
              safeColumns.length,
          },
        };

        if (
          safeRows.length === 0
        ) {
          const noDataRow =
            sheet.addRow([
              "No data available",
            ]);

          if (
            safeColumns.length > 1
          ) {
            sheet.mergeCells(
              noDataRow.number,
              1,
              noDataRow.number,
              safeColumns.length
            );
          }

          noDataRow.getCell(1)
            .alignment = {
            vertical: "middle",
            horizontal: "center",
          };
        } else {
          safeRows.forEach(
            (row) => {
              const worksheetRow =
                sheet.addRow(
                  safeColumns.map(
                    ([key]) => {
                      const value =
                        row?.[key];

                      if (
                        value === undefined ||
                        value === null ||
                        value === ""
                      ) {
                        return "-";
                      }

                      return value;
                    }
                  )
                );

              worksheetRow.eachCell(
                (cell) => {
                  cell.alignment = {
                    vertical: "top",
                    horizontal: "left",
                    wrapText: true,
                  };

                  cell.border = {
                    bottom: {
                      style: "hair",
                      color: {
                        argb:
                          "FFD1D5DB",
                      },
                    },
                  };
                }
              );
            }
          );
        }

        safeColumns.forEach(
          ([key, label], index) => {
            const normalized =
              `${key || ""} ${label || ""}`.toLowerCase();

            if (
              normalized.includes("volumecbm") ||
              normalized.includes("avgcbm") ||
              normalized.includes("m³") ||
              normalized.includes("m3")
            ) {
              sheet.getColumn(index + 1).numFmt =
                "0.000";
            }
          }
        );

        finishSheet(sheet);

        return sheet;
      };

      /*
       * =====================================================
       * DIRECTOR DASHBOARD
       * Mirrors the management hierarchy of the reference
       * Director Dashboard sheet while remaining live for the
       * currently selected report period.
       * =====================================================
       */

      const directorSheet =
        workbook.addWorksheet(
          "Director Dashboard"
        );

      directorSheet.pageSetup = {
        paperSize: 8,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        printArea: "A1:P68",
        margins: {
          left: 0.2,
          right: 0.2,
          top: 0.25,
          bottom: 0.25,
          header: 0.1,
          footer: 0.1,
        },
      };

      for (
        let column = 1;
        column <= 16;
        column += 1
      ) {
        directorSheet.getColumn(
          column
        ).width = 11.5;
      }

      const directorColors = {
        navy: "FF0B2339",
        blue: "FFE7F1F8",
        green: "FFE7F5EF",
        red: "FFFCEAEC",
        amber: "FFFFF3E3",
        paleBlue: "FFE9F2F8",
        headerBlue: "FF1D4F73",
        text: "FF0F2438",
        muted: "FF64748B",
        border: "FFD8E1EA",
        critical: "FFFDE8E8",
        high: "FFFFF4E5",
        medium: "FFEAF3F9",
        low: "FFECFDF3",
      };

      directorSheet.mergeCells("A1:P2");
      const directorTitleCell =
        directorSheet.getCell("A1");
      directorTitleCell.value =
        "DIRECTOR INVENTORY & DISPATCH PERFORMANCE REPORT";
      directorTitleCell.font = {
        bold: true,
        size: 21,
        color: { argb: "FFFFFFFF" },
      };
      directorTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: directorColors.navy,
        },
      };
      directorTitleCell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };
      directorSheet.getRow(1).height = 24;
      directorSheet.getRow(2).height = 12;

      directorSheet.mergeCells("A3:P3");
      const directorMeta =
        directorSheet.getCell("A3");
      directorMeta.value =
        `Reporting period: ${formatDate(
          toStartDateTime(fromDate)
        )} – ${formatDate(
          toEndDateTime(toDate)
        )}  |  Snapshot: ${directorData.snapshotLabel}  |  Source: PackFlow Reports`;
      directorMeta.font = {
        size: 9,
        color: { argb: "FFFFFFFF" },
      };
      directorMeta.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: directorColors.navy,
        },
      };
      directorMeta.alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      const directorKpiRanges = [
        "A5:D8",
        "E5:H8",
        "I5:L8",
        "M5:P8",
        "A10:D13",
        "E10:H13",
        "I10:L13",
        "M10:P13",
      ];

      const directorKpiFill = {
        blue: directorColors.blue,
        green: directorColors.green,
        red: directorColors.red,
        amber: directorColors.amber,
      };

      directorData.kpiCards.forEach(
        (card, index) => {
          const range =
            directorKpiRanges[index];

          if (!range) return;

          const [start, end] =
            range.split(":");
          const startColumn =
            start.match(/[A-Z]+/)[0];
          const endColumn =
            end.match(/[A-Z]+/)[0];
          const startRow = Number(
            start.match(/\d+/)[0]
          );
          const endRow = Number(
            end.match(/\d+/)[0]
          );

          directorSheet.mergeCells(
            `${startColumn}${startRow}:${endColumn}${startRow}`
          );
          directorSheet.mergeCells(
            `${startColumn}${startRow + 1}:${endColumn}${startRow + 2}`
          );
          directorSheet.mergeCells(
            `${startColumn}${endRow}:${endColumn}${endRow}`
          );

          const titleCell =
            directorSheet.getCell(
              `${startColumn}${startRow}`
            );
          const valueCell =
            directorSheet.getCell(
              `${startColumn}${startRow + 1}`
            );
          const detailCell =
            directorSheet.getCell(
              `${startColumn}${endRow}`
            );

          const fillColor =
            directorKpiFill[
              card.tone
            ] || directorColors.blue;

          for (
            let row = startRow;
            row <= endRow;
            row += 1
          ) {
            for (
              let column =
                directorSheet.getCell(
                  `${startColumn}${row}`
                ).col;
              column <=
                directorSheet.getCell(
                  `${endColumn}${row}`
                ).col;
              column += 1
            ) {
              const cell =
                directorSheet.getCell(
                  row,
                  column
                );
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: fillColor,
                },
              };
              cell.border = {
                bottom: {
                  style: "hair",
                  color: {
                    argb:
                      directorColors.border,
                  },
                },
              };
            }
          }

          titleCell.value =
            card.title.toUpperCase();
          titleCell.font = {
            bold: true,
            size: 9,
            color: {
              argb: directorColors.text,
            },
          };
          titleCell.alignment = {
            vertical: "middle",
            horizontal: "left",
          };

          valueCell.value =
            card.value;
          valueCell.font = {
            bold: true,
            size: 21,
            color: {
              argb: directorColors.text,
            },
          };
          valueCell.alignment = {
            vertical: "middle",
            horizontal: "center",
          };

          detailCell.value =
            card.detail;
          detailCell.font = {
            size: 8,
            color: {
              argb: directorColors.muted,
            },
          };
          detailCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
          };
        }
      );

      directorSheet.mergeCells("A15:P15");
      const readoutTitle =
        directorSheet.getCell("A15");
      readoutTitle.value =
        "EXECUTIVE READOUT — WHAT THE DIRECTOR NEEDS TO KNOW";
      readoutTitle.font = {
        bold: true,
        size: 10,
        color: { argb: "FFFFFFFF" },
      };
      readoutTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: directorColors.headerBlue,
        },
      };

      const readoutColumns = [
        ["A", "D"],
        ["E", "H"],
        ["I", "L"],
        ["M", "P"],
      ];

      directorData.readouts.forEach(
        (readout, index) => {
          const [startCol, endCol] =
            readoutColumns[index];
          const fillColor =
            directorKpiFill[
              readout.tone
            ] || directorColors.blue;

          directorSheet.mergeCells(
            `${startCol}16:${endCol}16`
          );
          directorSheet.mergeCells(
            `${startCol}17:${endCol}20`
          );

          const heading =
            directorSheet.getCell(
              `${startCol}16`
            );
          const body =
            directorSheet.getCell(
              `${startCol}17`
            );

          heading.value =
            readout.title.toUpperCase();
          heading.font = {
            bold: true,
            size: 9,
            color: {
              argb: directorColors.text,
            },
          };
          heading.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: fillColor,
            },
          };

          body.value = readout.lines
            .map((line) => `• ${line}`)
            .join("\n");
          body.font = {
            size: 8,
            color: {
              argb: directorColors.text,
            },
          };
          body.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: fillColor,
            },
          };
          body.alignment = {
            vertical: "top",
            horizontal: "left",
            wrapText: true,
          };
        }
      );

      const directorChartImages = [
        createDirectorLineChartPng({
          title:
            "Daily Packing vs Dispatch Throughput",
          rows: directorData.dailyRows,
        }),
        createDirectorBarChartPng({
          title: "Inventory Aging Profile",
          rows: directorData.agingBars,
        }),
        createDirectorBarChartPng({
          title:
            "Current Inventory Status Mix",
          rows: directorData.statusBars,
        }),
        createDirectorBarChartPng({
          title:
            "Selected-Period Dispatch by Plant",
          rows:
            directorData.dispatchPlantBars,
        }),
      ];

      const directorChartPositions = [
        {
          tl: { col: 0, row: 21 },
          ext: {
            width: 650,
            height: 285,
          },
        },
        {
          tl: { col: 8, row: 21 },
          ext: {
            width: 650,
            height: 285,
          },
        },
        {
          tl: { col: 0, row: 39 },
          ext: {
            width: 650,
            height: 285,
          },
        },
        {
          tl: { col: 8, row: 39 },
          ext: {
            width: 650,
            height: 285,
          },
        },
      ];

      directorChartImages.forEach(
        (base64, index) => {
          if (!base64) return;

          const imageId =
            workbook.addImage({
              base64,
              extension: "png",
            });

          directorSheet.addImage(
            imageId,
            directorChartPositions[index]
          );
        }
      );

      for (
        let row = 22;
        row <= 56;
        row += 1
      ) {
        directorSheet.getRow(row).height =
          15;
      }

      directorSheet.mergeCells("A58:P58");
      const actionTitleCell =
        directorSheet.getCell("A58");
      actionTitleCell.value =
        "DIRECTOR ACTION PRIORITIES";
      actionTitleCell.font = {
        bold: true,
        size: 10,
        color: { argb: "FFFFFFFF" },
      };
      actionTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: directorColors.headerBlue,
        },
      };

      const actionHeaderRanges = [
        ["A59:B59", "Priority"],
        ["C59:H59", "Decision / Action"],
        ["I59:L59", "Why Now"],
        ["M59:N59", "Owner"],
        ["O59:P59", "Suggested Timeframe"],
      ];

      actionHeaderRanges.forEach(
        ([range, value]) => {
          directorSheet.mergeCells(range);
          const cell =
            directorSheet.getCell(
              range.split(":")[0]
            );
          cell.value = value;
          cell.font = {
            bold: true,
            size: 8,
            color: {
              argb: directorColors.text,
            },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FFD9E6F0",
            },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
          };
        }
      );

      const actionFill = {
        CRITICAL: directorColors.critical,
        HIGH: directorColors.high,
        MEDIUM: directorColors.medium,
        LOW: directorColors.low,
      };

      directorData.actions.forEach(
        (action, index) => {
          const rowNumber = 60 + index;

          directorSheet.mergeCells(
            `A${rowNumber}:B${rowNumber}`
          );
          directorSheet.mergeCells(
            `C${rowNumber}:H${rowNumber}`
          );
          directorSheet.mergeCells(
            `I${rowNumber}:L${rowNumber}`
          );
          directorSheet.mergeCells(
            `M${rowNumber}:N${rowNumber}`
          );
          directorSheet.mergeCells(
            `O${rowNumber}:P${rowNumber}`
          );

          const rowFill =
            actionFill[
              action.priority
            ] || directorColors.medium;

          for (
            let column = 1;
            column <= 16;
            column += 1
          ) {
            const cell =
              directorSheet.getCell(
                rowNumber,
                column
              );
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: rowFill,
              },
            };
            cell.border = {
              bottom: {
                style: "hair",
                color: {
                  argb: directorColors.border,
                },
              },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              wrapText: true,
            };
            cell.font = {
              size: 8,
              color: {
                argb: directorColors.text,
              },
            };
          }

          directorSheet.getCell(
            `A${rowNumber}`
          ).value = action.priority;
          directorSheet.getCell(
            `A${rowNumber}`
          ).font = {
            bold: true,
            size: 8,
            color: {
              argb:
                action.priority ===
                "CRITICAL"
                  ? "FFDC2626"
                  : directorColors.text,
            },
          };
          directorSheet.getCell(
            `C${rowNumber}`
          ).value = action.action;
          directorSheet.getCell(
            `I${rowNumber}`
          ).value = action.why;
          directorSheet.getCell(
            `M${rowNumber}`
          ).value = action.owner;
          directorSheet.getCell(
            `O${rowNumber}`
          ).value = action.timeframe;
          directorSheet.getRow(
            rowNumber
          ).height = 24;
        }
      );

      directorSheet.mergeCells("A68:P68");
      const managementNote =
        directorSheet.getCell("A68");
      managementNote.value =
        directorData.comparisonAvailable
          ? `Management note: week-on-week comparison uses completed periods ${directorData.comparison.label}. If the selected end date is today, today's partial activity is excluded from the comparison.`
          : "Management note: select at least 14 completed days to enable a full two-week comparison. Current inventory aging remains a live snapshot.";
      managementNote.font = {
        italic: true,
        size: 8,
        color: {
          argb: directorColors.muted,
        },
      };
      managementNote.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };

      directorSheet.views = [
        {
          state: "frozen",
          ySplit: 4,
        },
      ];

      /*
       * =====================================================
       * PACKING VOLUME EXECUTIVE SUMMARY
       * =====================================================
       */

      const volumeExecutive =
        workbook.addWorksheet(
          "Volume Executive"
        );

      volumeExecutive.pageSetup = {
        paperSize: 8,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.4,
          bottom: 0.4,
          header: 0.2,
          footer: 0.2,
        },
      };

      volumeExecutive.mergeCells("A1:H1");
      volumeExecutive.getCell("A1").value =
        "PACKING VOLUME EXECUTIVE SUMMARY";
      volumeExecutive.getCell("A1").font = {
        bold: true,
        size: 20,
        color: { argb: "FFFFFFFF" },
      };
      volumeExecutive.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      volumeExecutive.getCell("A1").alignment = {
        vertical: "middle",
        horizontal: "left",
      };
      volumeExecutive.getRow(1).height = 30;

      volumeExecutive.mergeCells("A2:H2");
      volumeExecutive.getCell("A2").value =
        `Reporting Period: ${formatDate(
          toStartDateTime(fromDate)
        )} to ${formatDate(
          toEndDateTime(toDate)
        )}`;
      volumeExecutive.getCell("A2").font = {
        italic: true,
        color: { argb: "FF475569" },
      };

      const volumeSummaryRows = [
        [
          "Total Packed Volume",
          kpis.totalPackedVolumeCbm,
          "m³",
          "Measured physical cube packed in the selected range",
        ],
        [
          "Measured Packets",
          kpis.measuredVolumePackets,
          "packets",
          "Packets with valid L × B × H dimensions",
        ],
        [
          "Average Packet Cube",
          kpis.avgPackedVolumeCbm,
          "m³",
          "Average physical cube per measured packed packet",
        ],
        [
          "Dimension Coverage",
          formatPercent(
            kpis.dimensionCoverageRate
          ),
          "coverage",
          `${kpis.missingDimensionPackets} packed packets need dimension correction`,
        ],
        [
          "Top Packer by Volume",
          topVolumePacker?.user || "-",
          topVolumePacker
            ? `${formatCbm(
              topVolumePacker.volumeCbm
            )} m³`
            : "-",
          "Use cube handled alongside packet count for productivity review",
        ],
        [
          "Peak Volume Date",
          peakVolumeDate?.date || "-",
          peakVolumeDate
            ? `${formatCbm(
              peakVolumeDate.volumeCbm
            )} m³`
            : "-",
          "Useful for manpower and floor-capacity planning",
        ],
        [
          "Top Client by Packed Cube",
          topVolumeClient?.client || "-",
          topVolumeClient
            ? `${formatCbm(
              topVolumeClient.volumeCbm
            )} m³`
            : "-",
          "Highlights client workload by physical packing volume",
        ],
        [
          "Top Plant by Packed Cube",
          topVolumePlant?.plant || "-",
          topVolumePlant
            ? `${formatCbm(
              topVolumePlant.volumeCbm
            )} m³`
            : "-",
          "Highlights plant contribution to packed volume",
        ],
      ];

      const volumeHeader =
        volumeExecutive.addRow([
          "KPI",
          "Value",
          "Unit / Context",
          "Management Meaning",
        ]);
      volumeHeader.getCell(1).value = "KPI";
      volumeHeader.getCell(2).value = "Value";
      volumeHeader.getCell(3).value = "Unit / Context";
      volumeHeader.getCell(4).value = "Management Meaning";
      styleHeader(volumeHeader);

      volumeSummaryRows.forEach((values) => {
        const row = volumeExecutive.addRow(values);
        row.eachCell((cell) => {
          cell.alignment = {
            vertical: "top",
            wrapText: true,
          };
          cell.border = {
            bottom: {
              style: "hair",
              color: { argb: "FFD1D5DB" },
            },
          };
        });
      });

      volumeExecutive.getColumn(1).width = 28;
      volumeExecutive.getColumn(2).width = 22;
      volumeExecutive.getColumn(3).width = 20;
      volumeExecutive.getColumn(4).width = 58;
      volumeExecutive.views = [
        { state: "frozen", ySplit: 3 },
      ];

      addRowsSheet(
        "Volume Date Wise",
        "Packing Volume by Date",
        tableConfigs.VOLUME_DATE.columns,
        volumeDateRows
      );

      addRowsSheet(
        "Volume User Wise",
        "Packing Volume by User",
        tableConfigs.VOLUME_USER.columns,
        volumeUserRows
      );

      addRowsSheet(
        "Volume Client Wise",
        "Packing Volume by Client",
        tableConfigs.VOLUME_CLIENT.columns,
        volumeClientRows
      );

      addRowsSheet(
        "Volume Plant Wise",
        "Packing Volume by Plant",
        tableConfigs.VOLUME_PLANT.columns,
        volumePlantRows
      );

      addRowsSheet(
        "Packing Volume Detail",
        "Packing Volume Packet Register",
        volumeDetailColumns,
        volumeDetailRows
      );

      /*
      KPI SUMMARY
      */

      const kpiSheet =
        workbook.addWorksheet(
          "KPI Summary"
        );

      addTitle(
        kpiSheet,
        "Inventory KPI Summary",
        3
      );

      kpiSheet.addRow([]);

      const kpiHeader =
        kpiSheet.addRow([
          "KPI",
          "Value",
          "Insight",
        ]);

      styleHeader(kpiHeader);

      [
        [
          "Inventory Items",
          kpis.totalInventory,
          "Warehouse + Ready To Dispatch + Ready",
        ],
        [
          "Warehouse Items",
          kpis.warehouseItems,
          "Current warehouse stock",
        ],
        [
          "Ready To Dispatch",
          kpis.readyToDispatch,
          "Items waiting for dispatch",
        ],
        [
          "Ready Items",
          kpis.readyItems,
          "Ready / processed stock",
        ],
        [
          "Packed Items",
          kpis.packedItems,
          "Sticker generated / packed stock",
        ],
        [
          "Dispatched Items",
          kpis.dispatchedItems,
          "Challan generated / dispatched stock",
        ],
        [
          "Pending Items",
          kpis.pendingItems,
          "Items still pending in flow",
        ],
        [
          "Stickers Generated",
          kpis.stickersGenerated,
          "Total labels printed",
        ],
        [
          "Packing In Selected Range",
          kpis.packedInRange,
          "Date-filtered packing activity",
        ],
        [
          "Total Packed Volume (m³)",
          kpis.totalPackedVolumeCbm,
          "Physical cubic metre volume packed in selected range",
        ],
        [
          "Average Packet Volume (m³)",
          kpis.avgPackedVolumeCbm,
          "Average cube across packets with valid dimensions",
        ],
        [
          "Dimension Coverage",
          formatPercent(
            kpis.dimensionCoverageRate
          ),
          `${kpis.measuredVolumePackets} measured / ${kpis.packingVolumeRows} packed packet rows`,
        ],
        [
          "Missing Packet Dimensions",
          kpis.missingDimensionPackets,
          "Packed rows excluded from m³ totals because dimensions are missing or invalid",
        ],
        [
          "Dispatch In Selected Range",
          kpis.dispatchedInRange,
          "Date-filtered dispatch activity",
        ],
        [
          "Unique Clients",
          kpis.uniqueClients,
          "Clients involved in selected range",
        ],
        [
          "Critical Aging Items",
          kpis.criticalAging,
          "Items older than 30 days",
        ],
        [
          "Item / Packet Detail Rows",
          kpis.itemPacketRows,
          "Total item / packet rows across inventory, packing and dispatch",
        ],
        [
          "Inventory Item / Packet Rows",
          kpis.inventoryItemPacketRows,
          "Current inventory packet-level rows",
        ],
        [
          "Packing Item / Packet Rows",
          kpis.packingItemPacketRows,
          "Packed item / packet rows in selected range",
        ],
        [
          "Dispatch Item / Packet Rows",
          kpis.dispatchItemPacketRows,
          "Dispatched item / packet rows in selected range",
        ],
        [
          "Dispatch Completion Rate",
          formatPercent(
            kpis.completionRate
          ),
          "Dispatched items divided by inventory items",
        ],
      ].forEach((row) =>
        kpiSheet.addRow(row)
      );

      finishSheet(kpiSheet);

      /*
  MAIN REPORT SHEETS
  */

      addRowsSheet(
        "Master Items",
        "Master Item Register",
        masterItemColumns,
        exportMasterRows
      );

      addRowsSheet(
        "Date Wise",
        "Date-wise Inventory Throughput",
        tableConfigs.DATE.columns,
        dateWiseRows
      );

      addRowsSheet(
        "Packing User Wise",
        "Packing User-wise Report",
        tableConfigs.PACKING_USER.columns,
        packingUserRows
      );

      addRowsSheet(
        "Dispatch Register",
        "Detailed Dispatch Item Register",
        dispatchDetailColumns,
        dispatchItemPacketRows
      );

      addRowsSheet(
        "Dispatch User Wise",
        "Dispatch User-wise Report",
        tableConfigs.DISPATCH_USER.columns,
        dispatchUserRows
      );

      addRowsSheet(
        "Client Wise",
        "Client-wise Inventory Movement",
        tableConfigs.CLIENT.columns,
        clientWiseRows
      );

      addRowsSheet(
        "Inventory Aging",
        "Inventory Aging Bucket Report",
        tableConfigs.AGING.columns,
        agingBucketRows
      );

      addRowsSheet(
        "All Item Packets",
        "All Item / Packet Detail",
        itemPacketColumns,
        allItemPacketRows
      );

      addRowsSheet(
        "Inventory Item Packets",
        "Inventory Item / Packet Detail",
        itemPacketColumns,
        inventoryItemPacketRows
      );

      addRowsSheet(
        "Packing Item Packets",
        "Packing Item / Packet Detail",
        itemPacketColumns,
        packingItemPacketRows
      );

      addRowsSheet(
        "Dispatch Item Packets",
        "Dispatch Item / Packet Detail",
        itemPacketColumns,
        dispatchItemPacketRows
      );

      /*
      RAW PACKING DATA
      */

      const rawPacking =
        packingRows.map((row) => ({
          zohoItemId: rowValue(row, [
            "zohoItemId",
          ]),

          itemName: rowValue(row, [
            "itemName",
          ]),

          clientName: rowValue(row, [
            "clientName",
            "client",
          ]),

          packetNumber:
            getPacketNumber(row),

          packetName:
            getPacketName(row),

          packedAt: getExcelDateTime(
            rowValue(row, [
              "packedAt",
            ], null)
          ),

          packedBy: rowValue(row, [
            "packedBy",
            "createdBy",
          ]),
        }));

      addRowsSheet(
        "Raw Packing",
        "Raw Packing Data",
        [
          ["zohoItemId", "Zoho Item ID"],
          ["itemName", "Item Name"],
          ["clientName", "Client"],
          ["packetNumber", "Packet No"],
          ["packetName", "Packet Name"],
          ["packedAt", "Packed At"],
          ["packedBy", "Packed By"],
        ],
        rawPacking
      );

      /*
      RAW DISPATCH DATA
      */

      const rawDispatch =
        dispatchRows.map(
          (row, index) => ({
            serialNumber:
              index + 1,

            zohoItemId: rowValue(
              row,
              ["zohoItemId"],
              "-"
            ),

            pdNo:
              getPdNo(row),

            drawingNo:
              getDrawingNo(row),

            sku: rowValue(
              row,
              [
                "sku",
                "codeSku",
              ],
              "-"
            ),

            itemName: rowValue(
              row,
              ["itemName"],
              "-"
            ),

            description: rowValue(
              row,
              ["description"],
              "-"
            ),

            clientName: rowValue(
              row,
              [
                "clientName",
                "client",
              ],
              "-"
            ),

            clientAddress: rowValue(
              row,
              [
                "clientAddress",
                "address",
              ],
              "-"
            ),

            plantCode: rowValue(
              row,
              ["plantCode"],
              "-"
            ),

            floor: rowValue(
              row,
              ["floor"],
              "-"
            ),

            area:
              getArea(row),

            warehouseCode: rowValue(
              row,
              ["warehouseCode"],
              "-"
            ),

            packetNumber:
              getPacketNumber(row),

            packetName:
              getPacketName(row),

            quantity: numberValue(
              rowValue(
                row,
                [
                  "quantity",
                  "qty",
                ],
                1
              )
            ),

            status: getItemStatus(
              row,
              "DISPATCHED"
            ),

            packedAt: getExcelDateTime(
              rowValue(
                row,
                ["packedAt"],
                null
              )
            ),

            packedBy: rowValue(
              row,
              [
                "packedBy",
                "createdBy",
              ],
              "-"
            ),

            dispatchedAt:
              getExcelDateTime(
                rowValue(
                  row,
                  ["dispatchedAt"],
                  null
                )
              ),

            dispatchedBy: rowValue(
              row,
              [
                "dispatchedBy",
                "createdBy",
              ],
              "-"
            ),

            challanNumber: rowValue(
              row,
              [
                "challanNumber",
                "chalaanNumber",
              ],
              "-"
            ),

            driverName: rowValue(
              row,
              ["driverName"],
              "-"
            ),

            vehicleNumber: rowValue(
              row,
              ["vehicleNumber"],
              "-"
            ),

            remarks: rowValue(
              row,
              ["remarks"],
              "-"
            ),
          })
        );

      addRowsSheet(
        "Raw Dispatch",
        "Raw Dispatch Data",
        dispatchDetailColumns,
        rawDispatch
      );

      /*
      INSIGHTS
      */

      const insightsSheet =
        workbook.addWorksheet(
          "Insights"
        );

      addTitle(
        insightsSheet,
        "Inventory Insights",
        3
      );

      insightsSheet.addRow([]);

      const insightHeader =
        insightsSheet.addRow([
          "Insight",
          "Value",
          "Recommendation",
        ]);

      styleHeader(insightHeader);

      [
        [
          "Top Packing User",
          topPacker
            ? `${topPacker.user} - ${topPacker.count} packed`
            : "-",
          "Use this user as benchmark for packing productivity.",
        ],
        [
          "Top Packer by Volume",
          topVolumePacker
            ? `${topVolumePacker.user} - ${formatCbm(
              topVolumePacker.volumeCbm
            )} m³ across ${topVolumePacker.packets} packets`
            : "-",
          "Compare physical cube handled with packet count before judging productivity.",
        ],
        [
          "Peak Packing Volume Date",
          peakVolumeDate
            ? `${peakVolumeDate.date} - ${formatCbm(
              peakVolumeDate.volumeCbm
            )} m³`
            : "-",
          "Use peak cube days for manpower, floor-space and transport-capacity planning.",
        ],
        [
          "Dimension Coverage",
          formatPercent(
            kpis.dimensionCoverageRate
          ),
          kpis.missingDimensionPackets > 0
            ? `${kpis.missingDimensionPackets} packed packets need valid dimensions before volume reporting is complete.`
            : "All packed packet rows in the selected range have valid dimensions.",
        ],
        [
          "Top Dispatch User",
          topDispatcher
            ? `${topDispatcher.user} - ${topDispatcher.count} dispatched`
            : "-",
          "Review dispatch flow and replicate best practices.",
        ],
        [
          "Busiest Date",
          busiestDate
            ? `${busiestDate.label} - ${busiestDate.total} total movements`
            : "-",
          "Check manpower and vehicle allocation for this date.",
        ],
        [
          "Critical Aging Bucket",
          criticalBucket
            ? `${criticalBucket.bucket} - ${criticalBucket.count} items`
            : "-",
          "Prioritize old inventory for dispatch or warehouse review.",
        ],
        [
          "Pending Items",
          kpis.pendingItems,
          kpis.pendingItems > 0
            ? "Review pending queue and ownership."
            : "Pending inventory is under control.",
        ],
        [
          "Item / Packet Detail Rows",
          allItemPacketRows.length,
          "Use this sheet to audit every inventory, packing and dispatch packet-level movement.",
        ],
        [
          "Packing Item / Packet Rows",
          packingItemPacketRows.length,
          "Use this for user-wise packing verification and packet traceability.",
        ],
        [
          "Dispatch Item / Packet Rows",
          dispatchItemPacketRows.length,
          "Use this to verify dispatched packets against challan and client movement.",
        ],
        [
          "Dispatch Completion Rate",
          formatPercent(
            kpis.completionRate
          ),
          kpis.completionRate >= 0.8
            ? "Completion rate is healthy."
            : "Completion rate needs improvement.",
        ]
      ].forEach((row) =>
        insightsSheet.addRow(row)
      );

      finishSheet(insightsSheet);

      const buffer =
        await workbook.xlsx.writeBuffer();

      const fileName = `Inventory_Report_${fromDate}_to_${toDate}.xlsx`;

      saveAs(
        new Blob([buffer], {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        fileName
      );
    };

  const buildSelectedDirectorExport = () => {
    const rows = [];

    rows.push({
      section: "Report",
      metric: "Selected Range",
      value: `${fromDate} to ${toDate}`,
      detail:
        directorData?.snapshotLabel ||
        "Current Director dashboard snapshot",
      owner: "",
      timeframe: "",
    });

    (directorData?.kpiCards || []).forEach(
      (card) => {
        rows.push({
          section: "KPI",
          metric: card?.title || card?.key || "KPI",
          value: card?.value ?? "-",
          detail: card?.detail || "",
          owner: "",
          timeframe: "",
        });
      }
    );

    (directorData?.readouts || []).forEach(
      (readout) => {
        const lines =
          Array.isArray(readout?.lines)
            ? readout.lines
            : [];

        if (lines.length === 0) {
          rows.push({
            section: "Executive Readout",
            metric:
              readout?.title ||
              readout?.key ||
              "Readout",
            value: "",
            detail: "",
            owner: "",
            timeframe: "",
          });

          return;
        }

        lines.forEach((line, index) => {
          rows.push({
            section: "Executive Readout",
            metric:
              index === 0
                ? readout?.title ||
                  readout?.key ||
                  "Readout"
                : "",
            value: "",
            detail: line || "",
            owner: "",
            timeframe: "",
          });
        });
      }
    );

    (directorData?.actions || []).forEach(
      (action) => {
        rows.push({
          section: "Action Priority",
          metric: action?.action || "-",
          value: action?.priority || "-",
          detail: action?.why || "",
          owner: action?.owner || "",
          timeframe:
            action?.timeframe || "",
        });
      }
    );

    return {
      title:
        "Director Inventory & Dispatch Dashboard",
      columns: [
        ["section", "Section"],
        ["metric", "Metric / Action"],
        ["value", "Value / Priority"],
        ["detail", "Detail / Why"],
        ["owner", "Owner"],
        ["timeframe", "Timeframe"],
      ],
      rows,
    };
  };

  const buildSelectedExportConfig =
    async () => {
      if (
        reportMode ===
        "DIRECTOR_DASHBOARD"
      ) {
        return buildSelectedDirectorExport();
      }

      if (
        reportMode ===
        "MASTER_ITEMS"
      ) {
        /*
         * Master Items is already a paged report. Fetch all master pages
         * only because the user explicitly selected this report for export.
         * No unrelated Packing / Dispatch / Aging datasets are exported.
         */
        const allMasterRows =
          await loadAllMasterItemRows();

        let rows =
          formatMasterReportRows(
            allMasterRows,
            "master-selected-export"
          );

        if (deferredSearchTerm) {
          rows = rows.filter((row) =>
            makeSearchText(row).includes(
              deferredSearchTerm
            )
          );
        }

        return {
          title:
            tableConfigs.MASTER_ITEMS.title,
          columns:
            tableConfigs.MASTER_ITEMS.columns,
          rows,
        };
      }

      return {
        title:
          activeConfig?.title ||
          "Selected Inventory Report",
        columns:
          activeConfig?.columns || [],
        /*
         * Export the complete selected report after the current search filter,
         * never only the visible pagination slice.
         */
        rows: visibleRows,
      };
    };

  const excelExportValue = (
    key,
    value
  ) => {
    const formatted =
      formatReportCell(key, value);

    if (
      formatted === null ||
      formatted === undefined
    ) {
      return "";
    }

    if (
      typeof formatted === "number" ||
      typeof formatted === "boolean"
    ) {
      return formatted;
    }

    if (
      typeof formatted === "object"
    ) {
      try {
        return JSON.stringify(
          formatted
        );
      } catch {
        return String(formatted);
      }
    }

    return String(formatted);
  };

  const selectedExportColumnWidth = (
    label,
    key
  ) => {
    const text =
      `${label || ""} ${key || ""}`
        .toLowerCase();

    if (
      text.includes("description") ||
      text.includes("detail") ||
      text.includes("why") ||
      text.includes("address") ||
      text.includes("action")
    ) {
      return 42;
    }

    if (
      text.includes("item") ||
      text.includes("client") ||
      text.includes("user") ||
      text.includes("owner")
    ) {
      return 26;
    }

    if (
      text.includes("date") ||
      text.includes("time") ||
      text.includes("challan") ||
      text.includes("vehicle") ||
      text.includes("dimension")
    ) {
      return 22;
    }

    return Math.max(
      12,
      Math.min(
        20,
        String(label || key || "")
          .length + 4
      )
    );
  };

  const downloadExcelReport =
    async () => {
      if (
        exporting ||
        loading
      ) {
        return;
      }

      try {
        setExporting(true);
        setError("");

        /*
         * SELECTED REPORT ONLY
         *
         * The old implementation always called the backend's complete
         * inventory workbook endpoint. That forced Apache POI to materialize
         * Packing + Dispatch + Aging + Volume + Master datasets together even
         * when the user had selected one report tab.
         *
         * Manual export now happens in the browser from exactly the selected
         * UI report. The selected date range and current search filter are
         * preserved, and the backend no longer allocates the giant workbook.
         */
        const selected =
          await buildSelectedExportConfig();

        const columns =
          Array.isArray(
            selected?.columns
          )
            ? selected.columns
            : [];

        const rows =
          Array.isArray(
            selected?.rows
          )
            ? selected.rows
            : [];

        if (columns.length === 0) {
          throw new Error(
            "Selected report has no exportable columns"
          );
        }

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
          "ALSORG Inventory Reports";

        workbook.created =
          new Date();

        const safeMode =
          String(reportMode || "REPORT")
            .replace(
              /[^A-Za-z0-9_-]+/g,
              "_"
            )
            .replace(
              /^_+|_+$/g,
              ""
            ) || "REPORT";

        const sheetName =
          String(
            selected?.title ||
            safeMode
          )
            .replace(
              /[\\/*?:[\]]/g,
              " "
            )
            .trim()
            .slice(0, 31) ||
          "Report";

        const sheet =
          workbook.addWorksheet(
            sheetName
          );

        const title =
          selected?.title ||
          "Selected Inventory Report";

        sheet.mergeCells(
          1,
          1,
          1,
          columns.length
        );

        const titleCell =
          sheet.getCell(1, 1);

        titleCell.value =
          `ALSORG — ${title}`;

        titleCell.font = {
          bold: true,
          size: 16,
        };

        titleCell.alignment = {
          vertical: "middle",
          horizontal: "left",
        };

        sheet.getRow(1).height = 26;

        sheet.mergeCells(
          2,
          1,
          2,
          columns.length
        );

        const rangeCell =
          sheet.getCell(2, 1);

        rangeCell.value =
          `Selected range: ${fromDate} to ${toDate}` +
          (deferredSearchTerm
            ? ` | Search: ${search.trim()}`
            : "") +
          ` | Rows: ${rows.length}`;

        rangeCell.font = {
          italic: true,
          size: 10,
        };

        const headerRow =
          sheet.getRow(3);

        columns.forEach(
          ([key, label], index) => {
            const cell =
              headerRow.getCell(
                index + 1
              );

            cell.value =
              label || key;

            cell.font = {
              bold: true,
            };

            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
            };

            sheet.getColumn(
              index + 1
            ).width =
              selectedExportColumnWidth(
                label,
                key
              );
          }
        );

        headerRow.height = 22;

        rows.forEach((row) => {
          const values =
            columns.map(
              ([key]) =>
                excelExportValue(
                  key,
                  row?.[key]
                )
            );

          sheet.addRow(values);
        });

        sheet.views = [
          {
            state: "frozen",
            ySplit: 3,
          },
        ];

        sheet.autoFilter = {
          from: {
            row: 3,
            column: 1,
          },
          to: {
            row: 3,
            column:
              columns.length,
          },
        };

        const buffer =
          await workbook.xlsx.writeBuffer();

        const fileName =
          `ALSORG_${safeMode}_${fromDate}_to_${toDate}.xlsx`;

        saveAs(
          new Blob([buffer], {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          fileName
        );
      } catch (error) {
        console.error(
          "Selected Inventory Excel export failed:",
          error
        );

        const message =
          error?.message ||
          "Failed to export the selected Inventory report";

        setError(message);

        window.alert(
          message
        );
      } finally {
        setExporting(false);
      }
    };

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Inventory Reports
          </div>

          <div style={subtitle}>
            Director decision dashboard, cubic-metre workload, flow performance, aging risk and detailed operational reporting
          </div>
        </div>

        <button
          type="button"
          style={{
            ...downloadBtn,

            opacity:
              loading || exporting
                ? 0.65
                : 1,

            cursor:
              loading || exporting
                ? "not-allowed"
                : "pointer",
          }}
          onClick={
            downloadExcelReport
          }
          disabled={
            loading ||
            exporting
          }
        >
          {exporting
            ? "Generating Excel..."
            : "Export Selected Excel"}
        </button>
      </div>

      <div style={filters}>
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

        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search reports..."
          style={searchInput}
        />

        <button
          style={primaryBtn}
          onClick={loadReports}
          disabled={loading}
        >
          Apply Filters
        </button>

        <button
          style={clearBtn}
          onClick={clearFilters}
        >
          Clear
        </button>
      </div>

      {error && (
        <div style={errorBox}>
          {error}
        </div>
      )}

      {volumeError && (
        <div style={volumeWarningBox}>
          <strong>Volume reporting unavailable:</strong>{" "}
          {volumeError}
        </div>
      )}

      <div style={modeTabs}>
        {[
          ["DIRECTOR_DASHBOARD", "Director Dashboard"],
          ["DATE", "Date Wise"],
          ["VOLUME_USER", "Volume by User"],
          ["VOLUME_DATE", "Volume by Date"],
          ["VOLUME_CLIENT", "Volume by Client"],
          ["VOLUME_PLANT", "Volume by Plant"],
          ["VOLUME_DETAIL", "Volume Packet Register"],
          ["MASTER_ITEMS", "Master Items"],
          ["PACKING_USER", "Packing Users"],
          ["DISPATCH_USER", "Dispatch Users"],
          ["CLIENT", "Client Wise"],
          ["AGING", "Aging"],
          ["ALL_ITEMS", "All Items / Packets"],
          ["INVENTORY_ITEMS", "Inventory Items"],
          ["PACKING_ITEMS", "Packing Items"],
          ["DISPATCH_ITEMS", "Dispatch Items"],
        ].map(([key, label]) => (
          <button
            key={key}
            style={modeTab(
              reportMode === key
            )}
            onClick={() =>
              setReportMode(key)
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isDirectorDashboard ? (
        <DirectorDashboardView
          data={directorData}
          loading={loading}
          volumeError={volumeError}
          onOpenReport={setReportMode}
        />
      ) : (
        <>

      <div style={summaryGrid}>
        <SummaryCard
          label="Inventory Items"
          value={kpis.totalInventory}
        />

        <SummaryCard
          label="Master Items"
          value={kpis.masterItems}
        />

        <SummaryCard
          label="Total Packets"
          value={kpis.totalPackets}
        />

        <SummaryCard
          label="Packet Items"
          value={kpis.packetItems}
        />

        <SummaryCard
          label="Packed Packets"
          value={kpis.packedPackets}
        />

        <SummaryCard
          label="Pending Packets"
          value={kpis.pendingPackets}
          warning
        />

        <SummaryCard
          label="Warehouse"
          value={kpis.warehouseItems}
        />

        <SummaryCard
          label="Ready Dispatch"
          value={kpis.readyToDispatch}
        />

        <SummaryCard
          label="Packed Range"
          value={kpis.packedInRange}
        />

        <SummaryCard
          label="Packed Volume"
          value={`${formatCbm(
            kpis.totalPackedVolumeCbm
          )} m³`}
          accent="#22c55e"
        />

        <SummaryCard
          label="Avg Cube / Packet"
          value={`${formatCbm(
            kpis.avgPackedVolumeCbm
          )} m³`}
          accent="#38bdf8"
        />

        <SummaryCard
          label="Dimension Coverage"
          value={formatPercent(
            kpis.dimensionCoverageRate
          )}
          warning={
            kpis.dimensionCoverageRate < 1
          }
          accent="#a78bfa"
        />

        <SummaryCard
          label="Dispatch Range"
          value={kpis.dispatchedInRange}
        />

        <SummaryCard
          label="Custom Challans"
          value={kpis.customChallans}
        />

        <SummaryCard
          label="Data Exceptions"
          value={kpis.exceptionsCount}
          warning
        />
      </div>

      <div style={volumeInsightPanel}>
        <div style={volumeInsightHeader}>
          <div>
            <div style={volumeInsightEyebrow}>
              PACKING CUBE INTELLIGENCE
            </div>
            <div style={volumeInsightTitle}>
              Physical packing workload
            </div>
            <div style={volumeInsightSubtitle}>
              Packet count and cubic metres are shown together so large-volume work is not hidden behind simple item counts.
            </div>
          </div>

          <button
            type="button"
            style={volumeDetailBtn}
            onClick={() =>
              setReportMode("VOLUME_DETAIL")
            }
          >
            Open packet register ↗
          </button>
        </div>

        <div style={volumeInsightGrid}>
          <VolumeInsightCard
            label="Top Packer by m³"
            value={
              topVolumePacker?.user || "-"
            }
            detail={
              topVolumePacker
                ? `${formatCbm(
                  topVolumePacker.volumeCbm
                )} m³ • ${topVolumePacker.packets} packets`
                : "No measured packing volume"
            }
          />

          <VolumeInsightCard
            label="Peak Volume Date"
            value={
              peakVolumeDate?.date || "-"
            }
            detail={
              peakVolumeDate
                ? `${formatCbm(
                  peakVolumeDate.volumeCbm
                )} m³ packed`
                : "No measured packing volume"
            }
          />

          <VolumeInsightCard
            label="Top Client by m³"
            value={
              topVolumeClient?.client || "-"
            }
            detail={
              topVolumeClient
                ? `${formatCbm(
                  topVolumeClient.volumeCbm
                )} m³ • ${topVolumeClient.packets} packets`
                : "No measured packing volume"
            }
          />

          <VolumeInsightCard
            label="Missing Dimensions"
            value={
              kpis.missingDimensionPackets
            }
            detail={
              kpis.missingDimensionPackets > 0
                ? "Excluded from m³ total until dimensions are corrected"
                : "Volume coverage is complete"
            }
            warning={
              kpis.missingDimensionPackets > 0
            }
          />
        </div>
      </div>

      <div style={tableHeader}>
        <div>
          <div style={tableTitle}>
            {activeConfig.title}
          </div>

          <div style={tableSubtitle}>
            {visibleRows.length === 0
              ? "No rows"
              : `Showing ${safeTablePage * tablePageSize + 1}-${Math.min(
                (safeTablePage + 1) * tablePageSize,
                visibleRows.length
              )} of ${visibleRows.length} rows`}
            {supplementalLoading ? " • indexing detail data…" : ""}
          </div>
        </div>
      </div>

      <div style={tableWrap}>
        <table
          style={{
            ...table,

            minWidth: Math.max(
              1100,
              activeConfig.columns.length * 145
            ),
          }}
        >
          <thead>
            <tr>
              {activeConfig.columns.map(
                ([key, label]) => (
                  <th
                    key={key}
                    style={th}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={
                    activeConfig.columns.length
                  }
                  style={empty}
                >
                  Loading inventory reports...
                </td>
              </tr>
            )}

            {!loading &&
              visibleRows.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      activeConfig.columns.length
                    }
                    style={empty}
                  >
                    No report data found
                  </td>
                </tr>
              )}

            {!loading &&
              pagedVisibleRows.map((row) => (
                <tr key={row.key}>
                  {activeConfig.columns.map(
                    ([key]) => (
                      <td
                        key={key}
                        style={td}
                      >
                        {formatReportCell(
                          key,
                          row[key]
                        )}
                      </td>
                    )
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && visibleRows.length > 0 && (
        <div style={tablePager}>
          <div style={tablePagerMeta}>
            Page {safeTablePage + 1} of {tablePageCount}
          </div>

          <div style={tablePagerActions}>
            <select
              value={tablePageSize}
              onChange={(event) =>
                setTablePageSize(Number(event.target.value) || DEFAULT_TABLE_PAGE_SIZE)
              }
              style={tablePageSizeSelect}
            >
              {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setTablePage(0)}
              disabled={safeTablePage === 0}
              style={tablePageButton(safeTablePage === 0)}
            >
              «
            </button>

            <button
              type="button"
              onClick={() => setTablePage((page) => Math.max(0, page - 1))}
              disabled={safeTablePage === 0}
              style={tablePageButton(safeTablePage === 0)}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setTablePage((page) => Math.min(tablePageCount - 1, page + 1))}
              disabled={safeTablePage >= tablePageCount - 1}
              style={tablePageButton(safeTablePage >= tablePageCount - 1)}
            >
              ›
            </button>

            <button
              type="button"
              onClick={() => setTablePage(tablePageCount - 1)}
              disabled={safeTablePage >= tablePageCount - 1}
              style={tablePageButton(safeTablePage >= tablePageCount - 1)}
            >
              »
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
  accent = "#60a5fa",
}) {
  const valueText =
    String(value ?? "-");

  const responsiveFontSize =
    valueText.length > 20
      ? 15
      : valueText.length > 15
        ? 17
        : valueText.length > 11
          ? 20
          : 26;

  return (
    <div style={summaryCard} title={valueText}>
      <div style={summaryAccent(accent)} />
      <div style={summaryLabel}>
        {label}
      </div>

      <div
        style={{
          ...summaryValue,
          fontSize: responsiveFontSize,
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

function VolumeInsightCard({
  label,
  value,
  detail,
  warning = false,
}) {
  return (
    <div style={volumeInsightCard(warning)}>
      <div style={volumeInsightCardLabel}>
        {label}
      </div>
      <div style={volumeInsightCardValue}>
        {value}
      </div>
      <div style={volumeInsightCardDetail}>
        {detail}
      </div>
    </div>
  );
}

function DirectorKpiCard({
  title,
  value,
  detail,
  tone = "blue",
}) {
  const formattedValue =
    typeof value === "number"
      ? value.toLocaleString("en-IN")
      : String(value ?? "-");

  const responsiveFontSize =
    formattedValue.length > 18
      ? 16
      : formattedValue.length > 13
        ? 20
        : formattedValue.length > 9
          ? 24
          : 29;

  return (
    <div style={directorKpiCard(tone)} title={formattedValue}>
      <div style={directorKpiTitle}>
        {title}
      </div>

      <div style={{ ...directorKpiValue, fontSize: responsiveFontSize }}>
        {formattedValue}
      </div>

      <div style={directorKpiDetail}>
        {detail}
      </div>
    </div>
  );
}

function DirectorReadoutCard({
  title,
  lines = [],
  tone = "blue",
}) {
  return (
    <div style={directorReadoutCard(tone)}>
      <div style={directorReadoutTitle}>
        {title}
      </div>

      <div style={directorReadoutList}>
        {lines.map((line, index) => (
          <div
            key={`${title}-${index}`}
            style={directorReadoutLine}
          >
            <span style={directorBullet}>•</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectorLineChart({ rows = [] }) {
  const width = 900;
  const height = 300;
  const padding = {
    left: 52,
    right: 18,
    top: 18,
    bottom: 52,
  };

  if (rows.length === 0) {
    return (
      <div style={directorChartEmpty}>
        No throughput data in this period.
      </div>
    );
  }

  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [
      Number(row.packed || 0),
      Number(row.dispatched || 0),
    ])
  );

  const plotWidth =
    width - padding.left - padding.right;
  const plotHeight =
    height - padding.top - padding.bottom;

  const getX = (index) =>
    rows.length <= 1
      ? padding.left + plotWidth / 2
      : padding.left +
        (index / (rows.length - 1)) *
        plotWidth;

  const getY = (value) =>
    padding.top +
    plotHeight -
    (Number(value || 0) / maximum) *
    plotHeight;

  const packedPoints = rows
    .map(
      (row, index) =>
        `${getX(index)},${getY(row.packed)}`
    )
    .join(" ");

  const dispatchedPoints = rows
    .map(
      (row, index) =>
        `${getX(index)},${getY(row.dispatched)}`
    )
    .join(" ");

  const labelStep = Math.max(
    1,
    Math.ceil(rows.length / 10)
  );

  return (
    <div style={directorChartSvgWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily packing versus dispatch throughput"
        style={directorSvg}
      >
        {[0, 1, 2, 3, 4].map((step) => {
          const ratio = step / 4;
          const y =
            padding.top +
            plotHeight -
            plotHeight * ratio;
          const value =
            Math.round(maximum * ratio);

          return (
            <g key={step}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,.20)"
                strokeDasharray="5 5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--pf-text-muted)"
                fontSize="11"
              >
                {value}
              </text>
            </g>
          );
        })}

        <polyline
          points={packedPoints}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <polyline
          points={dispatchedPoints}
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {rows.map((row, index) => {
          if (
            index % labelStep !== 0 &&
            index !== rows.length - 1
          ) {
            return null;
          }

          return (
            <text
              key={row.key}
              x={getX(index)}
              y={height - 24}
              textAnchor="middle"
              fill="var(--pf-text-muted)"
              fontSize="10"
            >
              {row.shortLabel || row.label}
            </text>
          );
        })}
      </svg>

      <div style={directorLegend}>
        <span style={directorLegendItem}>
          <span style={directorLegendLine("#38bdf8")} />
          Packed
        </span>
        <span style={directorLegendItem}>
          <span style={directorLegendLine("#f97316")} />
          Dispatched
        </span>
      </div>
    </div>
  );
}

function DirectorBarChart({
  rows = [],
  maxBars = 8,
}) {
  const visibleRows = rows.slice(0, maxBars);
  const width = 900;
  const height = 300;
  const padding = {
    left: 54,
    right: 18,
    top: 18,
    bottom: 62,
  };

  if (visibleRows.length === 0) {
    return (
      <div style={directorChartEmpty}>
        No data available.
      </div>
    );
  }

  const maximum = Math.max(
    1,
    ...visibleRows.map((row) =>
      Number(row.value || 0)
    )
  );

  const plotWidth =
    width - padding.left - padding.right;
  const plotHeight =
    height - padding.top - padding.bottom;
  const slotWidth =
    plotWidth / visibleRows.length;
  const barWidth = Math.min(
    90,
    slotWidth * 0.58
  );

  return (
    <div style={directorChartSvgWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        style={directorSvg}
      >
        {[0, 1, 2, 3, 4].map((step) => {
          const ratio = step / 4;
          const y =
            padding.top +
            plotHeight -
            plotHeight * ratio;
          const value =
            Math.round(maximum * ratio);

          return (
            <g key={step}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,.20)"
                strokeDasharray="5 5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--pf-text-muted)"
                fontSize="11"
              >
                {value}
              </text>
            </g>
          );
        })}

        {visibleRows.map((row, index) => {
          const value = Number(row.value || 0);
          const barHeight =
            (value / maximum) * plotHeight;
          const x =
            padding.left +
            index * slotWidth +
            (slotWidth - barWidth) / 2;
          const y =
            padding.top +
            plotHeight -
            barHeight;

          return (
            <g key={`${row.label}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="5"
                fill="url(#directorBarGradient)"
              />
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 7, 12)}
                textAnchor="middle"
                fill="var(--pf-text)"
                fontSize="10"
                fontWeight="700"
              >
                {value.toLocaleString("en-IN")}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 30}
                textAnchor="middle"
                fill="var(--pf-text-muted)"
                fontSize="9.5"
              >
                {String(row.label || "-")
                  .replaceAll("_", " ")
                  .slice(0, 18)}
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient
            id="directorBarGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function DirectorChartPanel({
  title,
  subtitle,
  children,
}) {
  return (
    <div style={directorChartPanel}>
      <div style={directorChartPanelHeader}>
        <div style={directorChartPanelTitle}>
          {title}
        </div>
        {subtitle && (
          <div style={directorChartPanelSubtitle}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={directorChartPanelBody}>
        {children}
      </div>
    </div>
  );
}

function DirectorDashboardView({
  data,
  loading,
  volumeError,
  onOpenReport,
}) {
  if (loading) {
    return (
      <div style={directorDashboardLoading}>
        Loading Director Dashboard...
      </div>
    );
  }

  return (
    <div style={directorDashboardShell}>
      <div style={directorDashboardHero}>
        <div>
          <div style={directorDashboardEyebrow}>
            EXECUTIVE MANAGEMENT VIEW
          </div>
          <div style={directorDashboardTitle}>
            Director Inventory & Dispatch Performance Report
          </div>
          <div style={directorDashboardMeta}>
            Reporting period: {formatShortDateKey(data.selectedDateKeys?.[0])} – {formatShortDateKey(data.selectedDateKeys?.[data.selectedDateKeys.length - 1])}
            {" • "}
            Snapshot: {data.snapshotLabel}
            {" • "}
            Live PackFlow source
          </div>
        </div>

        <div style={directorHeroActions}>
          <div style={directorHeroVolume}>
            <span>Packed physical volume</span>
            <strong style={directorHeroVolumeValue}>
              {formatCbm(
                data.totalPackedVolumeCbm
              )} m³
            </strong>
          </div>

          <button
            type="button"
            style={directorHeroButton}
            onClick={() =>
              onOpenReport?.("VOLUME_DETAIL")
            }
          >
            Volume register ↗
          </button>
        </div>
      </div>

      {volumeError && (
        <div style={directorInlineWarning}>
          Volume context is temporarily unavailable; packet, flow, aging and dispatch intelligence remains active.
        </div>
      )}

      <div style={directorKpiGrid}>
        {data.kpiCards.map((card) => (
          <DirectorKpiCard
            key={card.key}
            {...card}
          />
        ))}
      </div>

      <div style={directorSectionBar}>
        Executive Readout — What the Director Needs to Know
      </div>

      <div style={directorReadoutGrid}>
        {data.readouts.map((readout) => (
          <DirectorReadoutCard
            key={readout.key}
            {...readout}
          />
        ))}
      </div>

      <div style={directorChartsGrid}>
        <DirectorChartPanel
          title="Daily Packing vs Dispatch Throughput"
          subtitle="Daily packet output across the selected reporting period"
        >
          <DirectorLineChart
            rows={data.dailyRows}
          />
        </DirectorChartPanel>

        <DirectorChartPanel
          title="Inventory Aging Profile"
          subtitle="Current inventory exposure by aging bucket"
        >
          <DirectorBarChart
            rows={data.agingBars}
            maxBars={4}
          />
        </DirectorChartPanel>

        <DirectorChartPanel
          title="Current Inventory Status Mix"
          subtitle="Live stock position across operational states"
        >
          <DirectorBarChart
            rows={data.statusBars}
            maxBars={5}
          />
        </DirectorChartPanel>

        <DirectorChartPanel
          title="Selected-Period Dispatch by Plant"
          subtitle="Plant contribution to dispatch throughput"
        >
          <DirectorBarChart
            rows={data.dispatchPlantBars}
            maxBars={8}
          />
        </DirectorChartPanel>
      </div>

      <div style={directorSectionBar}>
        Director Action Priorities
      </div>

      <div style={directorActionTableWrap}>
        <table style={directorActionTable}>
          <thead>
            <tr>
              <th style={directorActionTh}>
                Priority
              </th>
              <th style={directorActionTh}>
                Decision / Action
              </th>
              <th style={directorActionTh}>
                Why Now
              </th>
              <th style={directorActionTh}>
                Owner
              </th>
              <th style={directorActionTh}>
                Suggested Timeframe
              </th>
            </tr>
          </thead>

          <tbody>
            {data.actions.map((action, index) => (
              <tr
                key={`${action.action}-${index}`}
                style={directorActionRow(
                  action.priority
                )}
              >
                <td style={directorActionTd}>
                  <span
                    style={directorPriorityBadge(
                      action.priority
                    )}
                  >
                    {action.priority}
                  </span>
                </td>
                <td style={directorActionTdStrong}>
                  {action.action}
                </td>
                <td style={directorActionTd}>
                  {action.why}
                </td>
                <td style={directorActionTd}>
                  {action.owner}
                </td>
                <td style={directorActionTd}>
                  {action.timeframe}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={directorManagementNote}>
        {data.comparisonAvailable
          ? `Management note: week-on-week comparison uses completed periods ${data.comparison.label}. If the selected end date is today, today's partial activity is deliberately excluded from the comparison.`
          : "Management note: select at least 14 completed days to enable a full two-week comparison. Inventory aging remains a live current-state snapshot."}
      </div>
    </div>
  );
}

const wrap = {
  padding: 22,
  colorScheme: "var(--pf-color-scheme)",
  borderRadius: 24,
  background:
    "rgba(var(--pf-surface-rgb),.78)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
  boxShadow:
    "0 12px 28px rgba(var(--pf-shadow-rgb),.08)",
  backdropFilter: "blur(18px)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 16,
  flexWrap: "wrap",
};

const title = {
  fontSize: 24,
  fontWeight: 900,
  color: "var(--pf-text-strong)",
};

const subtitle = {
  marginTop: 5,
  color: "rgba(var(--pf-fg-rgb),.58)",
  fontSize: 13,
};

const filters = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
  padding: 12,
  borderRadius: 16,
  background:
    "rgba(var(--pf-fg-rgb),.035)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const input = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  padding: "0 12px",
  outline: "none",
  fontWeight: 700,
};

const searchInput = {
  ...input,
  minWidth: 260,
  flex: 1,
};

const primaryBtn = {
  height: 38,
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "var(--pf-text-strong)",
  padding: "0 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const clearBtn = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  background:
    "rgba(var(--pf-fg-rgb),.04)",
  color: "var(--pf-text-strong)",
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const downloadBtn = {
  height: 40,
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#16a34a,#22c55e)",
  color: "#fff",
  padding: "0 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const errorBox = {
  padding: 14,
  borderRadius: 16,
  background:
    "rgba(239,68,68,.10)",
  color: "color-mix(in srgb,#dc2626 80%,var(--pf-text-strong))",
  border:
    "1px solid rgba(239,68,68,.22)",
  marginBottom: 16,
  fontWeight: 800,
};

const volumeInsightPanel = {
  marginBottom: 16,
  padding: 16,
  borderRadius: 20,
  background:
    "radial-gradient(circle at 0% 0%, rgba(34,197,94,.12), transparent 34%), linear-gradient(135deg, rgba(var(--pf-surface-rgb),.96), rgba(8,15,30,.94))",
  border:
    "1px solid rgba(34,197,94,.18)",
  boxShadow:
    "0 16px 34px rgba(var(--pf-surface-rgb),.24)",
};

const volumeInsightHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 14,
};

const volumeInsightEyebrow = {
  color: "color-mix(in srgb,#059669 78%,var(--pf-text-strong))",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const volumeInsightTitle = {
  marginTop: 4,
  color: "var(--pf-text-strong)",
  fontSize: 19,
  fontWeight: 950,
};

const volumeInsightSubtitle = {
  marginTop: 5,
  maxWidth: 760,
  color: "rgba(var(--pf-fg-rgb),.58)",
  fontSize: 12,
  lineHeight: 1.5,
};

const volumeDetailBtn = {
  height: 36,
  padding: "0 13px",
  borderRadius: 12,
  border:
    "1px solid rgba(34,197,94,.28)",
  background:
    "rgba(34,197,94,.10)",
  color: "#bbf7d0",
  fontWeight: 900,
  cursor: "pointer",
};

const volumeInsightGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
};

const volumeInsightCard = (warning) => ({
  minWidth: 0,
  padding: 13,
  borderRadius: 16,
  background: warning
    ? "rgba(245,158,11,.08)"
    : "rgba(var(--pf-fg-rgb),.035)",
  border: warning
    ? "1px solid rgba(245,158,11,.20)"
    : "1px solid rgba(var(--pf-fg-rgb),.06)",
});

const volumeInsightCardLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".055em",
};

const volumeInsightCardValue = {
  marginTop: 7,
  color: "var(--pf-text-strong)",
  fontSize: 20,
  fontWeight: 950,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const volumeInsightCardDetail = {
  marginTop: 5,
  color: "rgba(var(--pf-fg-rgb),.58)",
  fontSize: 10.5,
  lineHeight: 1.45,
};

const volumeWarningBox = {
  padding: 13,
  borderRadius: 14,
  background:
    "rgba(245,158,11,.09)",
  color: "color-mix(in srgb,#d97706 78%,var(--pf-text-strong))",
  border:
    "1px solid rgba(245,158,11,.20)",
  marginBottom: 16,
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(185px,1fr))",
  gap: 12,
  alignItems: "stretch",
  marginBottom: 16,
};

const summaryCard = {
  position: "relative",
  minWidth: 0,
  minHeight: 104,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  overflow: "visible",
  borderRadius: 18,
  padding: 16,
  background:
    "rgba(var(--pf-fg-rgb),.035)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const summaryAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 14,
  right: 14,
  height: 2,
  borderRadius: "0 0 999px 999px",
  background:
    `linear-gradient(90deg,transparent,${accent},transparent)`,
});

const summaryLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 12,
  fontWeight: 800,
};

const summaryValue = {
  width: "100%",
  minWidth: 0,
  minHeight: 34,
  marginTop: 8,
  display: "flex",
  alignItems: "flex-end",
  color: "var(--pf-text-strong)",
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: "-.02em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const modeTabs = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 16,
};

const modeTab = (active) => ({
  height: 36,
  padding: "0 14px",
  borderRadius: 999,
  border: active
    ? "1px solid rgba(59,130,246,.40)"
    : "1px solid rgba(var(--pf-fg-rgb),.07)",
  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "rgba(var(--pf-fg-rgb),.04)",
  color: active ? "#fff" : "var(--pf-text)",
  fontWeight: 800,
  cursor: "pointer",
});

const tableHeader = {
  marginBottom: 10,
};

const tableTitle = {
  color: "var(--pf-text-strong)",
  fontWeight: 900,
  fontSize: 18,
};

const tableSubtitle = {
  marginTop: 4,
  color: "rgba(var(--pf-fg-rgb),.55)",
  fontSize: 12,
};

const tableWrap = {
  maxHeight: "58vh",
  overflow: "auto",
  borderRadius: 18,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
  textAlign: "left",
  padding: "13px 12px",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-muted)",
  fontWeight: 900,
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderBottom:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
  minWidth: 110,
  whiteSpace: "nowrap",
};

const td = {
  padding: "11px 12px",
  color: "rgba(var(--pf-fg-rgb),.84)",
  borderBottom:
    "1px solid rgba(var(--pf-fg-rgb),.045)",
  verticalAlign: "top",
  minWidth: 110,
  maxWidth: 320,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const empty = {
  padding: 24,
  textAlign: "center",
  color: "var(--pf-text-muted)",
  fontWeight: 700,
};

const tablePager = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const tablePagerMeta = {
  color: "var(--pf-text-muted)",
  fontSize: 11,
  fontWeight: 800,
};

const tablePagerActions = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const tablePageSizeSelect = {
  height: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid rgba(var(--pf-fg-rgb),.08)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text)",
  fontWeight: 800,
  outline: "none",
};

const tablePageButton = (disabled) => ({
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid rgba(var(--pf-fg-rgb),.08)",
  background: disabled
    ? "rgba(var(--pf-fg-rgb),.025)"
    : "rgba(59,130,246,.13)",
  color: disabled ? "#475569" : "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 950,
});

const directorTone = {
  blue: {
    background:
      "linear-gradient(180deg,rgba(30,64,90,.54),rgba(var(--pf-surface-rgb),.74))",
    border: "rgba(56,189,248,.23)",
    accent: "#38bdf8",
  },
  green: {
    background:
      "linear-gradient(180deg,rgba(20,83,65,.46),rgba(var(--pf-surface-rgb),.74))",
    border: "rgba(52,211,153,.22)",
    accent: "#34d399",
  },
  red: {
    background:
      "linear-gradient(180deg,rgba(92,38,48,.45),rgba(var(--pf-surface-rgb),.74))",
    border: "rgba(248,113,113,.24)",
    accent: "#fb7185",
  },
  amber: {
    background:
      "linear-gradient(180deg,rgba(91,64,26,.46),rgba(var(--pf-surface-rgb),.74))",
    border: "rgba(251,191,36,.24)",
    accent: "#fbbf24",
  },
};

const directorDashboardShell = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  borderRadius: 22,
  overflow: "hidden",
};

const directorDashboardLoading = {
  padding: 34,
  borderRadius: 20,
  background:
    "rgba(var(--pf-fg-rgb),.035)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.07)",
  color: "var(--pf-text)",
  textAlign: "center",
  fontWeight: 800,
};

const directorDashboardHero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  padding: "20px 22px",
  borderRadius: 20,
  background:
    "radial-gradient(circle at 85% 0%,rgba(56,189,248,.16),transparent 35%),linear-gradient(135deg,#081a2b,#0f2940 58%,#10263b)",
  border:
    "1px solid rgba(125,211,252,.16)",
  boxShadow:
    "0 18px 38px rgba(var(--pf-surface-rgb),.30)",
};

const directorDashboardEyebrow = {
  color: "#7dd3fc",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".13em",
};

const directorDashboardTitle = {
  marginTop: 5,
  color: "var(--pf-text-strong)",
  fontSize: 24,
  lineHeight: 1.15,
  fontWeight: 950,
  letterSpacing: "-.02em",
};

const directorDashboardMeta = {
  marginTop: 8,
  color: "#b9c8d8",
  fontSize: 11.5,
  lineHeight: 1.5,
  fontWeight: 650,
};

const directorHeroActions = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const directorHeroVolume = {
  minWidth: 170,
  padding: "10px 13px",
  borderRadius: 14,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  background:
    "rgba(var(--pf-fg-rgb),.055)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.09)",
  color: "#b8c8d8",
  fontSize: 9.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const directorHeroVolumeValue = {
  color: "var(--pf-text-strong)",
  fontSize: 18,
  fontWeight: 950,
  letterSpacing: "-.02em",
  textTransform: "none",
};

const directorHeroButton = {
  height: 38,
  padding: "0 14px",
  border: "none",
  borderRadius: 12,
  background:
    "linear-gradient(135deg,#0284c7,#38bdf8)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 10px 22px rgba(14,165,233,.25)",
};

const directorInlineWarning = {
  padding: "11px 14px",
  borderRadius: 14,
  background:
    "rgba(245,158,11,.10)",
  border:
    "1px solid rgba(245,158,11,.23)",
  color: "#fcd34d",
  fontSize: 11.5,
  fontWeight: 750,
};

const directorKpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(225px,1fr))",
  gap: 10,
};

const directorKpiCard = (tone) => {
  const palette =
    directorTone[tone] ||
    directorTone.blue;

  return {
    position: "relative",
    minHeight: 126,
    padding: "14px 15px",
    borderRadius: 15,
    overflow: "visible",
    background: palette.background,
    border:
      `1px solid ${palette.border}`,
    boxShadow:
      "inset 0 1px 0 rgba(var(--pf-fg-rgb),.025)",
  };
};

const directorKpiTitle = {
  color: "#dbe7f2",
  fontSize: 9.5,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".07em",
};

const directorKpiValue = {
  width: "100%",
  minWidth: 0,
  marginTop: 10,
  color: "var(--pf-text-strong)",
  fontSize: 29,
  fontWeight: 950,
  lineHeight: 1.05,
  letterSpacing: "-.03em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const directorKpiDetail = {
  marginTop: 10,
  color: "#9fb0c2",
  fontSize: 10,
  lineHeight: 1.4,
  fontWeight: 650,
};

const directorSectionBar = {
  padding: "8px 12px",
  borderRadius: 10,
  background:
    "linear-gradient(90deg,#164b70,#1d5e85)",
  color: "#fff",
  fontSize: 10.5,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".055em",
};

const directorReadoutGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: 10,
};

const directorReadoutCard = (tone) => {
  const palette =
    directorTone[tone] ||
    directorTone.blue;

  return {
    minHeight: 142,
    padding: 14,
    borderRadius: 15,
    background: palette.background,
    border:
      `1px solid ${palette.border}`,
  };
};

const directorReadoutTitle = {
  color: "#f1f5f9",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const directorReadoutList = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  marginTop: 10,
};

const directorReadoutLine = {
  display: "flex",
  gap: 7,
  alignItems: "flex-start",
  color: "#cad6e2",
  fontSize: 10.3,
  fontWeight: 650,
  lineHeight: 1.45,
};

const directorBullet = {
  color: "#7dd3fc",
  fontWeight: 950,
};

const directorChartsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(430px,1fr))",
  gap: 12,
};

const directorChartPanel = {
  minWidth: 0,
  borderRadius: 17,
  overflow: "hidden",
  background:
    "linear-gradient(180deg,rgba(var(--pf-surface-rgb),.86),rgba(7,15,28,.78))",
  border:
    "1px solid rgba(148,163,184,.10)",
  boxShadow:
    "0 14px 30px rgba(var(--pf-surface-rgb),.20)",
};

const directorChartPanelHeader = {
  padding: "13px 14px 6px",
};

const directorChartPanelTitle = {
  color: "var(--pf-text-strong)",
  fontSize: 14,
  fontWeight: 900,
};

const directorChartPanelSubtitle = {
  marginTop: 4,
  color: "#7f91a5",
  fontSize: 9.5,
  fontWeight: 650,
};

const directorChartPanelBody = {
  padding: "0 8px 8px",
};

const directorChartSvgWrap = {
  width: "100%",
  minHeight: 275,
  overflow: "hidden",
};

const directorSvg = {
  width: "100%",
  height: 285,
  display: "block",
};

const directorChartEmpty = {
  minHeight: 260,
  display: "grid",
  placeItems: "center",
  color: "var(--pf-text-muted)",
  fontSize: 11,
  fontWeight: 750,
};

const directorLegend = {
  display: "flex",
  justifyContent: "center",
  gap: 16,
  marginTop: -14,
  paddingBottom: 7,
};

const directorLegendItem = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "var(--pf-text-muted)",
  fontSize: 9.5,
  fontWeight: 750,
};

const directorLegendLine = (color) => ({
  width: 18,
  height: 3,
  borderRadius: 999,
  background: color,
});

const directorActionTableWrap = {
  overflowX: "auto",
  borderRadius: 14,
  border:
    "1px solid rgba(148,163,184,.10)",
};

const directorActionTable = {
  width: "100%",
  minWidth: 920,
  borderCollapse: "collapse",
  fontSize: 10.5,
};

const directorActionTh = {
  padding: "10px 12px",
  textAlign: "left",
  background: "#18344d",
  color: "#d8e5f0",
  fontWeight: 900,
  borderBottom:
    "1px solid rgba(148,163,184,.14)",
};

const directorActionRow = (priority) => {
  const backgrounds = {
    CRITICAL: "rgba(127,29,29,.22)",
    HIGH: "rgba(146,64,14,.18)",
    MEDIUM: "rgba(30,64,175,.12)",
    LOW: "rgba(22,101,52,.10)",
  };

  return {
    background:
      backgrounds[priority] ||
      "rgba(var(--pf-fg-rgb),.025)",
  };
};

const directorActionTd = {
  padding: "11px 12px",
  color: "#bac8d7",
  verticalAlign: "top",
  borderBottom:
    "1px solid rgba(148,163,184,.08)",
  lineHeight: 1.4,
};

const directorActionTdStrong = {
  ...directorActionTd,
  color: "#f1f5f9",
  fontWeight: 800,
};

const directorPriorityBadge = (priority) => {
  const colors = {
    CRITICAL: {
      color: "color-mix(in srgb,#dc2626 78%,var(--pf-text-strong))",
      background: "rgba(239,68,68,.17)",
      border: "rgba(239,68,68,.27)",
    },
    HIGH: {
      color: "#fed7aa",
      background: "rgba(249,115,22,.14)",
      border: "rgba(249,115,22,.24)",
    },
    MEDIUM: {
      color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
      background: "rgba(59,130,246,.14)",
      border: "rgba(59,130,246,.24)",
    },
    LOW: {
      color: "#bbf7d0",
      background: "rgba(34,197,94,.12)",
      border: "rgba(34,197,94,.22)",
    },
  };

  const palette =
    colors[priority] ||
    colors.MEDIUM;

  return {
    display: "inline-flex",
    minWidth: 72,
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    color: palette.color,
    background: palette.background,
    border:
      `1px solid ${palette.border}`,
    fontSize: 8.5,
    fontWeight: 950,
    letterSpacing: ".05em",
  };
};

const directorManagementNote = {
  padding: "10px 12px",
  borderRadius: 12,
  background:
    "rgba(var(--pf-fg-rgb),.025)",
  border:
    "1px solid rgba(148,163,184,.08)",
  color: "#75879b",
  fontSize: 9.5,
  fontStyle: "italic",
  lineHeight: 1.45,
};

export default InventoryReports;