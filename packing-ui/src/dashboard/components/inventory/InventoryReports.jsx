import {
  useEffect,
  useMemo,
  useState,
} from "react";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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
    useState("DATE");

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

  useEffect(() => {
    let active = true;

    const from =
      toStartDateTime(monthStartDate());

    const to =
      toEndDateTime(todayDate());

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
      fetchCombinedReport(from, to).catch(() => []),
      fetchInventoryAging().catch(() => []),
      fetchMasterItemReport({
        from,
        to,
        limit: 1000,
      }).catch(() => []),
    ])
      .then(
        ([
          statsData,
          packingData,
          packingVolumeData,
          dispatchData,
          combinedData,
          agingData,
          masterData,
        ]) => {
          if (!active) return;

          setStats(
            normalizeStats(statsData || {})
          );
          setPackingRows(
            Array.isArray(packingData)
              ? packingData
              : []
          );
          setPackingVolumeRows(
            Array.isArray(packingVolumeData)
              ? packingVolumeData
              : []
          );
          setDispatchRows(
            Array.isArray(dispatchData)
              ? dispatchData
              : []
          );
          setCombinedRows(
            Array.isArray(combinedData)
              ? combinedData
              : []
          );
          setAgingRows(
            Array.isArray(agingData)
              ? agingData
              : []
          );
          setMasterRows(
            extractReportRows(
              masterData
            )
          );
        }
      )
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
    };
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");
      setVolumeError("");

      const from =
        toStartDateTime(fromDate);

      const to =
        toEndDateTime(toDate);

      const [
        statsData,
        packingData,
        packingVolumeData,
        dispatchData,
        combinedData,
        agingData,
        masterData,
      ] = await Promise.all([
        fetchDashboardStats().catch(() => ({})),
        fetchPackingReport(from, to).catch(() => []),
        fetchPackingVolumeReport(from, to).catch((volumeLoadError) => {
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
        fetchCombinedReport(from, to).catch(() => []),
        fetchInventoryAging().catch(() => []),
        fetchMasterItemReport({
          from,
          to,
          limit: 1000,
        }).catch(() => []),
      ]);

      setStats(
        normalizeStats(statsData || {})
      );
      setPackingRows(
        Array.isArray(packingData)
          ? packingData
          : []
      );
      setPackingVolumeRows(
        Array.isArray(packingVolumeData)
          ? packingVolumeData
          : []
      );
      setDispatchRows(
        Array.isArray(dispatchData)
          ? dispatchData
          : []
      );
      setCombinedRows(
        Array.isArray(combinedData)
          ? combinedData
          : []
      );
      setAgingRows(
        Array.isArray(agingData)
          ? agingData
          : []
      );
      setMasterRows(
        extractReportRows(
          masterData
        )
      );
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

  const activeConfig =
    tableConfigs[reportMode];

  const searchTerm =
    search.trim().toLowerCase();

  const visibleRows = useMemo(() => {
    const rows =
      activeConfig?.rows || [];

    if (!searchTerm) return rows;

    return rows.filter((row) =>
      makeSearchText(row).includes(
        searchTerm
      )
    );
  }, [activeConfig, searchTerm]);

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
      const pageSize = 100;
      const maximumPages = 500;

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

            column.eachCell(
              {
                includeEmpty: true,
              },
              (cell) => {
                const rawValue =
                  cell.value;

                let text = "";

                if (
                  rawValue === null ||
                  rawValue === undefined
                ) {
                  text = "";
                } else if (
                  typeof rawValue ===
                  "object"
                ) {
                  text =
                    rawValue?.text ||
                    rawValue?.result ||
                    String(rawValue);
                } else {
                  text =
                    String(rawValue);
                }

                /*
                 * Use the longest individual line, not the
                 * complete paragraph length.
                 */
                const longestLine =
                  text
                    .split(/\r?\n/)
                    .reduce(
                      (
                        longest,
                        current
                      ) =>
                        Math.max(
                          longest,
                          current.length
                        ),
                      0
                    );

                maximumLength =
                  Math.max(
                    maximumLength,
                    longestLine + 2
                  );
              }
            );

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

        await buildExcelReport();
      } catch (error) {
        console.error(
          "Inventory Excel export failed:",
          error
        );

        const message =
          error?.message ||
          "Failed to generate Inventory Excel report";

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
            KPI, cubic-metre volume, user/date/client/plant productivity and aging reporting
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
            : "Download Excel Report"}
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

      <div style={modeTabs}>
        {[
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

      <div style={tableHeader}>
        <div>
          <div style={tableTitle}>
            {activeConfig.title}
          </div>

          <div style={tableSubtitle}>
            Showing {visibleRows.length} rows
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
              visibleRows.map((row) => (
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
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
  accent = "#60a5fa",
}) {
  return (
    <div style={summaryCard}>
      <div style={summaryAccent(accent)} />
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

const wrap = {
  padding: 22,
  borderRadius: 24,
  background:
    "rgba(15,23,42,.78)",
  border:
    "1px solid rgba(255,255,255,.06)",
  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",
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
  color: "#fff",
};

const subtitle = {
  marginTop: 5,
  color: "rgba(255,255,255,.58)",
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
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.06)",
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
  color: "#fff",
  padding: "0 14px",
  fontWeight: 900,
  cursor: "pointer",
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
  color: "#fca5a5",
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
    "radial-gradient(circle at 0% 0%, rgba(34,197,94,.12), transparent 34%), linear-gradient(135deg, rgba(15,23,42,.96), rgba(8,15,30,.94))",
  border:
    "1px solid rgba(34,197,94,.18)",
  boxShadow:
    "0 16px 34px rgba(2,6,23,.24)",
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
  color: "#86efac",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const volumeInsightTitle = {
  marginTop: 4,
  color: "#fff",
  fontSize: 19,
  fontWeight: 950,
};

const volumeInsightSubtitle = {
  marginTop: 5,
  maxWidth: 760,
  color: "rgba(255,255,255,.58)",
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
    : "rgba(255,255,255,.035)",
  border: warning
    ? "1px solid rgba(245,158,11,.20)"
    : "1px solid rgba(255,255,255,.06)",
});

const volumeInsightCardLabel = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".055em",
};

const volumeInsightCardValue = {
  marginTop: 7,
  color: "#fff",
  fontSize: 20,
  fontWeight: 950,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const volumeInsightCardDetail = {
  marginTop: 5,
  color: "rgba(255,255,255,.58)",
  fontSize: 10.5,
  lineHeight: 1.45,
};

const volumeWarningBox = {
  padding: 13,
  borderRadius: 14,
  background:
    "rgba(245,158,11,.09)",
  color: "#fde68a",
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
    "repeat(auto-fit,minmax(160px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryCard = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 18,
  padding: 16,
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.06)",
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
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
};

const summaryValue = {
  marginTop: 8,
  color: "#fff",
  fontSize: 26,
  fontWeight: 900,
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
    : "1px solid rgba(255,255,255,.07)",
  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "rgba(255,255,255,.04)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
});

const tableHeader = {
  marginBottom: 10,
};

const tableTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 18,
};

const tableSubtitle = {
  marginTop: 4,
  color: "rgba(255,255,255,.55)",
  fontSize: 12,
};

const tableWrap = {
  maxHeight: "58vh",
  overflow: "auto",
  borderRadius: 18,
  border:
    "1px solid rgba(255,255,255,.06)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
  textAlign: "left",
  padding: "13px 12px",
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 900,
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderBottom:
    "1px solid rgba(255,255,255,.06)",
  minWidth: 110,
  whiteSpace: "nowrap",
};

const td = {
  padding: "11px 12px",
  color: "rgba(255,255,255,.84)",
  borderBottom:
    "1px solid rgba(255,255,255,.045)",
  verticalAlign: "top",
  minWidth: 110,
  maxWidth: 320,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const empty = {
  padding: 24,
  textAlign: "center",
  color: "#94a3b8",
  fontWeight: 700,
};

export default InventoryReports;