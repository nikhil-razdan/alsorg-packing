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
    ["zohoItemId", "id"],
    index
  )}-${index}`,
  module: "Dispatch",
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
  status: "DISPATCHED",
  actionAt: getExcelDateTime(
    rowValue(row, ["dispatchedAt"], null)
  ),
  actionBy: rowValue(row, [
    "dispatchedBy",
    "createdBy",
  ]),
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

      const from =
        toStartDateTime(fromDate);

      const to =
        toEndDateTime(toDate);

      const [
        statsData,
        packingData,
        dispatchData,
        combinedData,
        agingData,
        masterData,
      ] = await Promise.all([
        fetchDashboardStats().catch(() => ({})),
        fetchPackingReport(from, to).catch(() => []),
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
      title: "Dispatch Item / Packet Detail",
      columns: itemPacketColumns,
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

        finishSheet(sheet);

        return sheet;
      };

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
        dispatchRows.map((row) => ({
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

          dispatchedAt: getExcelDateTime(
            rowValue(row, [
              "dispatchedAt",
            ], null)
          ),

          dispatchedBy: rowValue(row, [
            "dispatchedBy",
            "createdBy",
          ]),
        }));

      addRowsSheet(
        "Raw Dispatch",
        "Raw Dispatch Data",
        [
          ["zohoItemId", "Zoho Item ID"],
          ["itemName", "Item Name"],
          ["clientName", "Client"],
          ["packetNumber", "Packet No"],
          ["packetName", "Packet Name"],
          ["dispatchedAt", "Dispatched At"],
          ["dispatchedBy", "Dispatched By"],
        ],
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
            KPI, user-wise, date-wise, client-wise and aging reporting
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

      <div style={modeTabs}>
        {[
          ["DATE", "Date Wise"],
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
        <table style={table}>
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
                        {row[key] ?? "-"}
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(160px,1fr))",
  gap: 12,
  marginBottom: 16,
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
};

const td = {
  padding: "11px 12px",
  color: "rgba(255,255,255,.84)",
  borderBottom:
    "1px solid rgba(255,255,255,.045)",
};

const empty = {
  padding: 24,
  textAlign: "center",
  color: "#94a3b8",
  fontWeight: 700,
};

export default InventoryReports;