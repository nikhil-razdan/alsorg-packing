import { useEffect, useState } from "react";
import StatusDonutChart from "../dashboard/components/StatusDonutChart";
import StatusLineChart from "../dashboard/components/StatusLineChart";
import StatusBarChart from "../dashboard/components/StatusBarChart";
import ActivityFeed from "../dashboard/components/ActivityFeed";
import InventoryReports from "../dashboard/components/inventory/InventoryReports";
import ScheduledReports from "../dashboard/components/ScheduledReports";
import {
  fetchDashboardStats,
  fetchDashboardActivity,
  fetchLogisticsStats,
  fetchDailyThroughputUsers,
} from "../dashboard/api/dashboardApi";
import AnalyticsGrid from "../dashboard/components/AnalyticsGrid";
import LogisticsShiftModal from "../dashboard/components/logistics/LogisticsShiftModal";
import LogisticsDashboard from "../dashboard/components/logistics/LogisticsDashboard";
import InventorySidebar from
  "../dashboard/components/inventory/InventorySidebar";
import { useAuth } from "../auth/AuthContext";
import InventoryCommandCenter from
  "../dashboard/components/inventory/InventoryCommandCenter";
import MasterItemsModal from
  "../dashboard/components/inventory/MasterItemsModal";
import StatusCorporateChart from "../dashboard/components/StatusCorporateChart";

function StatCard({
  title,
  value,
  subtle,
  accent = "#60a5fa",
  icon = "◇",
  trend,
  trendLabel,
  onClick,
  active = false,
}) {
  const clickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      style={statCard(accent, clickable, active)}
    >
      <div style={cardGlow(accent)} />

      <div style={statTopRow}>
        <div style={statIconBox(accent)}>
          {icon}
        </div>

        {trend !== undefined && trend !== null && (
          <div style={trendPill(accent)}>
            {trend}
          </div>
        )}
      </div>

      <div style={statTitle}>{title}</div>

      <div style={statValue}>{value}</div>

      {subtle && (
        <div style={statSubtle}>
          {subtle}
        </div>
      )}

      {trendLabel && (
        <div style={trendLabelStyle}>
          {trendLabel}
        </div>
      )}

      {clickable && (
        <div style={statClickHint}>
          {active ? "Opened" : "View details"}
        </div>
      )}
    </button>
  );
}

function DetailStatCard({
  title,
  subtitle,
  accent = "#60a5fa",
  rows = [],
  totalLabel,
  totalValue,
}) {
  return (
    <div style={detailCard(accent)}>
      <div style={detailHeader}>
        <div>
          <div style={detailTitle}>{title}</div>
          {subtitle && <div style={detailSubtitle}>{subtitle}</div>}
        </div>

        {totalLabel && (
          <div style={detailTotalBox}>
            <span>{totalLabel}</span>
            <strong>{totalValue}</strong>
          </div>
        )}
      </div>

      <div style={detailGrid}>
        {rows.map((row) => (
          <div key={row.label} style={detailItem}>
            <div style={detailItemLabel}>{row.label}</div>
            <div style={detailItemValue}>{row.value}</div>
            {row.subtle && (
              <div style={detailItemSubtle}>{row.subtle}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThroughputMiniCard({
  title,
  value,
  subtle,
  accent,
  active,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={throughputMiniCard(accent, active, disabled)}
    >
      <div style={throughputMiniTitle}>{title}</div>
      <div style={throughputMiniValue}>{value}</div>
      <div style={throughputMiniSubtle}>{subtle}</div>

      <div style={throughputMiniHint}>
        {disabled ? "Admin only" : active ? "Selected" : "View users"}
      </div>
    </button>
  );
}

const DonutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const LineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <polyline
      points="3,17 9,11 13,15 21,7"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
  </svg>
);

const BarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="10" width="4" height="10" fill="currentColor" />
    <rect x="10" y="6" width="4" height="14" fill="currentColor" />
    <rect x="16" y="3" width="4" height="17" fill="currentColor" />
  </svg>
);

const CorporateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5" width="16" height="4" rx="1.5" fill="currentColor" />
    <rect x="4" y="11" width="10" height="4" rx="1.5" fill="currentColor" />
    <rect x="4" y="17" width="14" height="4" rx="1.5" fill="currentColor" />
  </svg>
);

const toNumber = (value) => Number(value ?? 0) || 0;

const emptyDashboardStats = {
  totalItems: 0,

  warehouseItems: 0,
  readyToDispatchItems: 0,
  readyItems: 0,

  packedItems: 0,
  dispatchedItems: 0,
  pendingItems: 0,
  stickersGenerated: 0,

  todayStickerGenerated: 0,
  todayChallanGenerated: 0,

  masterItems: 0,
  totalPackets: 0,
  packetItems: 0,

  fullyPackedMasterItems: 0,
  partiallyPackedMasterItems: 0,
  unpackedMasterItems: 0,

  packedPackets: 0,
  pendingPackets: 0,

  packetItemsWithSticker: 0,
  packetItemsPendingSticker: 0,
  stickerReprints: 0,

  readyToStoreItems: 0,
  warehouseRequestedItems: 0,
  returnRequestedItems: 0,
  queuedItems: 0,

  pkdItems: 0,
  fgItems: 0,

  normalDispatchChallans: 0,
  todayDispatchChallans: 0,
  runningTrips: 0,
  endedTrips: 0,

  customChallans: 0,
  todayCustomChallans: 0,
  customChallanItems: 0,

  activeDrivers: 0,
  activeVehicles: 0,
  expiredFitness: 0,
  expiredInsurance: 0,
  expiredPucc: 0,

  exceptionsCount: 0,
  masterItemsWithoutPackets: 0,
  packetsWithoutPacketItems: 0,
  packetItemsWithoutMaster: 0,
  dispatchedWithoutPacketItem: 0,
  dispatchedWithoutChallan: 0,
  dispatchedWithoutDriver: 0,
  duplicateCurrentStickers: 0,
  readyItemsStillInPkd: 0,
};

const normalizeStats = (data) => {
  console.log("Dashboard stats API response:", data);

  const warehouseItems = toNumber(
    data?.warehouseItems ??
    data?.warehouse ??
    data?.warehouseStock ??
    data?.inWarehouse
  );

  const readyToDispatchItems = toNumber(
    data?.readyToDispatchItems ??
    data?.readyToDispatch ??
    data?.readyToDispatchCount
  );

  const readyItems = toNumber(
    data?.readyItems ??
    data?.ready ??
    data?.readyCount
  );

  const inventoryTotal =
    warehouseItems + readyToDispatchItems + readyItems;

  return {
    ...emptyDashboardStats,

    totalItems:
      inventoryTotal ||
      toNumber(data?.totalItems ?? data?.total ?? data?.inventoryItems),

    warehouseItems,
    readyToDispatchItems,
    readyItems,

    packedItems: toNumber(data?.packedItems ?? data?.packed),
    dispatchedItems: toNumber(data?.dispatchedItems ?? data?.dispatched),
    pendingItems: toNumber(data?.pendingItems ?? data?.pending),
    stickersGenerated: toNumber(data?.stickersGenerated ?? data?.stickers),

    todayStickerGenerated: toNumber(
      data?.todayStickerGenerated ??
      data?.todayStickersGenerated ??
      data?.stickersGeneratedToday
    ),

    todayChallanGenerated: toNumber(
      data?.todayChallanGenerated ??
      data?.todayChallansGenerated ??
      data?.challansGeneratedToday
    ),

    masterItems: toNumber(data?.masterItems),
    totalPackets: toNumber(data?.totalPackets),
    packetItems: toNumber(data?.packetItems),

    fullyPackedMasterItems: toNumber(data?.fullyPackedMasterItems),
    partiallyPackedMasterItems: toNumber(data?.partiallyPackedMasterItems),
    unpackedMasterItems: toNumber(data?.unpackedMasterItems),

    packedPackets: toNumber(data?.packedPackets),
    pendingPackets: toNumber(data?.pendingPackets),

    packetItemsWithSticker: toNumber(data?.packetItemsWithSticker),
    packetItemsPendingSticker: toNumber(data?.packetItemsPendingSticker),
    stickerReprints: toNumber(data?.stickerReprints),

    readyToStoreItems: toNumber(data?.readyToStoreItems),
    warehouseRequestedItems: toNumber(data?.warehouseRequestedItems),
    returnRequestedItems: toNumber(data?.returnRequestedItems),
    queuedItems: toNumber(data?.queuedItems),

    pkdItems: toNumber(data?.pkdItems),
    fgItems: toNumber(data?.fgItems),

    normalDispatchChallans: toNumber(data?.normalDispatchChallans),
    todayDispatchChallans: toNumber(data?.todayDispatchChallans),
    runningTrips: toNumber(data?.runningTrips),
    endedTrips: toNumber(data?.endedTrips),

    customChallans: toNumber(data?.customChallans),
    todayCustomChallans: toNumber(data?.todayCustomChallans),
    customChallanItems: toNumber(data?.customChallanItems),

    activeDrivers: toNumber(data?.activeDrivers),
    activeVehicles: toNumber(data?.activeVehicles),
    expiredFitness: toNumber(data?.expiredFitness),
    expiredInsurance: toNumber(data?.expiredInsurance),
    expiredPucc: toNumber(data?.expiredPucc),

    exceptionsCount: toNumber(data?.exceptionsCount),
    masterItemsWithoutPackets: toNumber(data?.masterItemsWithoutPackets),
    packetsWithoutPacketItems: toNumber(data?.packetsWithoutPacketItems),
    packetItemsWithoutMaster: toNumber(data?.packetItemsWithoutMaster),
    dispatchedWithoutPacketItem: toNumber(data?.dispatchedWithoutPacketItem),
    dispatchedWithoutChallan: toNumber(data?.dispatchedWithoutChallan),
    dispatchedWithoutDriver: toNumber(data?.dispatchedWithoutDriver),
    duplicateCurrentStickers: toNumber(data?.duplicateCurrentStickers),
    readyItemsStillInPkd: toNumber(data?.readyItemsStillInPkd),
  };
};

function ThroughputUserModal({
  open,
  title,
  rows = [],
  loading,
  error,
  onClose,
}) {
  if (!open) return null;

  const total = rows.reduce(
    (sum, row) => sum + Number(row.count || 0),
    0
  );

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <div style={modalTitle}>{title}</div>
            <div style={modalSubtitle}>
              Today’s completed work by user
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={modalCloseBtn}
          >
            ×
          </button>
        </div>

        <div style={modalTotalBox}>
          <span>Total Work</span>
          <strong>{total}</strong>
        </div>

        {loading && (
          <div style={modalEmpty}>
            Loading user-wise data...
          </div>
        )}

        {!loading && error && (
          <div style={modalError}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={modalEmpty}>
            No user-wise data found for today.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={modalUserList}>
            {rows.map((row, index) => (
              <div
                key={`${row.username}-${index}`}
                style={modalUserRow}
              >
                <div style={modalRank}>
                  {index + 1}
                </div>

                <div style={modalUserName}>
                  {row.username || "UNKNOWN"}
                </div>

                <div style={modalCount}>
                  {Number(row.count || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(emptyDashboardStats);

  const [activityLogs, setActivityLogs] = useState([]);
  const [logistics, setLogistics] = useState(null);
  const [chartType, setChartType] = useState("donut");
  const [mode, setMode] = useState("inventory");
  const [inventorySection, setInventorySection] =
    useState("summary");

  const [activeStatCard, setActiveStatCard] = useState(null);
  const [shiftModal, setShiftModal] =
    useState(false);

  const [throughputModal, setThroughputModal] = useState({
    open: false,
    type: null,
    title: "",
    rows: [],
    loading: false,
    error: "",
  });

  const [masterItemsModalOpen, setMasterItemsModalOpen] =
    useState(false);

  const { role } = useAuth();

  const cleanRole = String(role || "")
    .replace("ROLE_", "")
    .trim()
    .toUpperCase();

  const isAdmin = cleanRole === "ADMIN";

  const clampPercent = (value) => {
    if (!Number.isFinite(value)) return 0;

    return Math.max(
      0,
      Math.min(100, Math.round(value))
    );
  };

  const percentLabel = (value) =>
    `${clampPercent(value)}%`;

  const inventoryTotal =
    Number(stats.warehouseItems || 0) +
    Number(stats.readyToDispatchItems || 0) +
    Number(stats.readyItems || 0);

  const finalInventoryTotal =
    inventoryTotal || Number(stats.totalItems || 0);

  const pending =
    Number(stats.pendingItems || 0);

  const todayPackedItems =
    Number(stats.todayStickerGenerated || 0);

  const todayDispatchedItems =
    Number(stats.todayChallanGenerated || 0);

  const todayDistinctChallans =
    Number(stats.todayDispatchChallans || 0);

  const dailyThroughput =
    todayPackedItems + todayDispatchedItems;

  const packetCompletionRate =
    Number(stats.packetItems || 0) === 0
      ? 0
      : (
        Number(stats.packetItemsWithSticker || 0) /
        Number(stats.packetItems || 0)
      ) * 100;

  const currentInventoryExceptions =
    Number(stats.masterItemsWithoutPackets || 0) +
    Number(stats.packetsWithoutPacketItems || 0) +
    Number(stats.packetItemsWithoutMaster || 0) +
    Number(stats.duplicateCurrentStickers || 0) +
    Number(stats.readyItemsStillInPkd || 0);

  const legacyDispatchExceptions =
    Number(stats.dispatchedWithoutPacketItem || 0) +
    Number(stats.dispatchedWithoutChallan || 0) +
    Number(stats.dispatchedWithoutDriver || 0);

  const totalDataExceptions =
    currentInventoryExceptions + legacyDispatchExceptions;

  const inventoryAccuracy =
    Number(stats.packetItems || 0) === 0
      ? 100
      : (
        (
          Number(stats.packetItems || 0) -
          currentInventoryExceptions
        ) /
        Number(stats.packetItems || 0)
      ) * 100;

  const operationalEfficiency =
    Number(stats.packetItems || 0) === 0
      ? 0
      : (
        Number(stats.dispatchedItems || 0) /
        Number(stats.packetItems || 0)
      ) * 100;

  const chartIndex = {
    donut: 0,
    line: 1,
    bar: 2,
    corporate: 3,
  }[chartType] || 0;

  useEffect(() => {
    fetchLogisticsStats()
      .then((data) => {
        setLogistics(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;

    fetchDashboardStats()
      .then((data) => {
        if (!active || !data) return;
        setStats(normalizeStats(data));
      })
      .catch(console.error);

    fetchDashboardActivity(12)
      .then((logs) => {
        if (!active) return;
        setActivityLogs(logs || []);
      })
      .catch(() => setActivityLogs([]));

    return () => {
      active = false;
    };
  }, []);


  const toggleStatCard = (key) => {
    setActiveStatCard((current) =>
      current === key ? null : key
    );
  };

  const openThroughputUserModal = async (type) => {
    if (!isAdmin) return;

    const title =
      type === "packing"
        ? "User-wise Packing Work Today"
        : "User-wise Dispatch Work Today";

    setThroughputModal({
      open: true,
      type,
      title,
      rows: [],
      loading: true,
      error: "",
    });

    try {
      const data = await fetchDailyThroughputUsers(type);

      console.log("Throughput user data:", type, data);

      setThroughputModal({
        open: true,
        type,
        title,
        rows: Array.isArray(data) ? data : [],
        loading: false,
        error: "",
      });
    } catch (e) {
      console.error(e);

      setThroughputModal({
        open: true,
        type,
        title,
        rows: [],
        loading: false,
        error: "Unable to load user-wise data.",
      });
    }
  };

  const closeThroughputUserModal = () => {
    setThroughputModal({
      open: false,
      type: null,
      title: "",
      rows: [],
      loading: false,
      error: "",
    });
  };

  const summaryKpis = [
    {
      key: "inventoryItems",
      icon: "📦",
      accent: "#60a5fa",
      title: "Inventory Items",
      value: finalInventoryTotal,
      subtle: "Warehouse + Ready To Dispatch + Ready",
      trend: percentLabel(packetCompletionRate),
      trendLabel: "packet completion",
      active: activeStatCard === "inventoryItems",
      onClick: () => toggleStatCard("inventoryItems"),
    },

    {
      key: "masterItems",
      icon: "🧩",
      accent: "#a78bfa",
      title: "Master Items",
      value: Number(stats.masterItems || 0),
      subtle: "Parent item register",
      trend: `${Number(stats.fullyPackedMasterItems || 0)} full`,
      trendLabel: "click to open full list",
      active: masterItemsModalOpen,
      onClick: () => setMasterItemsModalOpen(true),
    },

    {
      key: "packetItems",
      icon: "📑",
      accent: "#38bdf8",
      title: "Packet Items",
      value: Number(stats.packetItems || 0),
      subtle: "Operational packet-level rows",
      trend: `${Number(stats.totalPackets || 0)} packets`,
      active: activeStatCard === "packetItems",
      onClick: () => toggleStatCard("packetItems"),
    },

    {
      key: "stickers",
      icon: "🏷️",
      accent: "#f472b6",
      title: "Stickers Generated",
      value: Number(stats.stickersGenerated || 0),
      subtle: "Sticker history records",
      trend: `${Number(stats.stickerReprints || 0)} reprints`,
    },

    {
      key: "packed",
      icon: "✅",
      accent: "#34d399",
      title: "Packed Items",
      value: Number(stats.packedItems || 0),
      subtle: "Sticker / packed packet items",
      trend: percentLabel(packetCompletionRate),
    },

    {
      key: "pending",
      icon: "⏳",
      accent: "#f59e0b",
      title: "Pending Items",
      value: pending,
      subtle: "Packet items pending sticker",
      trend: `${Number(stats.packetItemsPendingSticker || 0)} pending`,
    },

    {
      key: "dailyThroughput",
      icon: "⚡",
      accent: "#06b6d4",
      title: "Daily Throughput",
      value: dailyThroughput,
      subtle: "Today’s sticker + dispatch",
      trend: `${todayDistinctChallans} challans`,
      active: activeStatCard === "dailyThroughput",
      onClick: () => toggleStatCard("dailyThroughput"),
    },

    {
      key: "readyToDispatch",
      icon: "🚚",
      accent: "#ef4444",
      title: "Ready to Dispatch",
      value: Number(stats.readyToDispatchItems || 0),
      subtle: "Dispatch action pending",
      trend: `${Number(stats.queuedItems || 0)} queued`,
    },

    {
      key: "accuracy",
      icon: "🎯",
      accent: "#22c55e",
      title: "Inventory Accuracy",
      value: percentLabel(inventoryAccuracy),
      subtle: "Based on current exceptions",
      trend: `${currentInventoryExceptions} issues`,
    },

    {
      key: "challans",
      icon: "📄",
      accent: "#8b5cf6",
      title: "Dispatch Challans",
      value: Number(stats.normalDispatchChallans || 0),
      subtle: `${Number(stats.runningTrips || 0)} running trips`,
      trend: `${Number(stats.todayDispatchChallans || 0)} today`,
      active: activeStatCard === "challans",
      onClick: () => toggleStatCard("challans"),
    },

    {
      key: "customChallans",
      icon: "🧾",
      accent: "#ec4899",
      title: "Custom Challans",
      value: Number(stats.customChallans || 0),
      subtle: `${Number(stats.customChallanItems || 0)} manual items`,
      trend: `${Number(stats.todayCustomChallans || 0)} today`,
      active: activeStatCard === "customChallans",
      onClick: () => toggleStatCard("customChallans"),
    },

    {
      key: "exceptions",
      icon: "⚠️",
      accent: "#f97316",
      title: "Data Exceptions",
      value: totalDataExceptions,
      subtle: `${currentInventoryExceptions} current • ${legacyDispatchExceptions} legacy`,
      trend: "review",
      active: activeStatCard === "exceptions",
      onClick: () => toggleStatCard("exceptions"),
    },

    {
      key: "efficiency",
      icon: "📈",
      accent: "#14b8a6",
      title: "Operational Efficiency",
      value: percentLabel(operationalEfficiency),
      subtle: "Dispatched / packet items",
      trend: "live",
    },
  ];

  return (
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
        <div style={heroRow}>
          <div>
            <h2 style={heroTitle}>Dashboard</h2>
            <div style={heroSubtitle}>
              Inventory and logistics overview in one workspace
            </div>
          </div>

          <div style={heroActions}>
            <button
              onClick={() => setMode("inventory")}
              style={modeBtn(mode === "inventory")}
            >
              📦 Inventory
            </button>

            <button
              onClick={() => setMode("logistics")}
              style={modeBtn(mode === "logistics")}
            >
              🚚 Logistics
            </button>
          </div>
        </div>

        {mode === "inventory" && (
          <div style={inventoryLayout}>
            <InventorySidebar
              section={inventorySection}
              setSection={setInventorySection}
            />

            <div style={inventoryMain}>
              {inventorySection === "summary" && (
                <>
                  <div style={kpiGrid}>
                    {summaryKpis.map((card) => (
                      <StatCard
                        key={card.key}
                        icon={card.icon}
                        accent={card.accent}
                        title={card.title}
                        value={card.value}
                        subtle={card.subtle}
                        trend={card.trend}
                        trendLabel={card.trendLabel}
                        active={card.active}
                        onClick={card.onClick}
                      />
                    ))}
                  </div>

                  {activeStatCard === "dailyThroughput" && (
                    <div style={detailCard("#06b6d4")}>
                      <div style={detailHeader}>
                        <div>
                          <div style={detailTitle}>
                            Daily Throughput Details
                          </div>

                          <div style={detailSubtitle}>
                            Today’s packed and dispatched work summary
                          </div>
                        </div>

                        <div style={detailTotalBox}>
                          <span>Total Today</span>
                          <strong>{dailyThroughput}</strong>
                        </div>
                      </div>

                      <div style={detailGrid}>
                        <button
                          type="button"
                          onClick={() => openThroughputUserModal("packing")}
                          disabled={!isAdmin}
                          style={throughputClickCard("#34d399", isAdmin)}
                        >
                          <div style={detailItemLabel}>
                            Packed Items
                          </div>

                          <div style={detailItemValue}>
                            {todayPackedItems}
                          </div>

                          <div style={detailItemSubtle}>
                            Packed Today / Sticker Generated Today
                          </div>

                          <div style={throughputCardHint}>
                            {isAdmin
                              ? "Click to view user-wise packing"
                              : "Admin only"}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => openThroughputUserModal("dispatch")}
                          disabled={!isAdmin}
                          style={throughputClickCard("#f59e0b", isAdmin)}
                        >
                          <div style={detailItemLabel}>
                            Dispatched Items
                          </div>

                          <div style={detailItemValue}>
                            {todayDispatchedItems}
                          </div>

                          <div style={detailItemSubtle}>
                            {todayDistinctChallans} challan PDFs generated today
                          </div>

                          <div style={throughputCardHint}>
                            {isAdmin
                              ? "Click to view user-wise dispatch"
                              : "Admin only"}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStatCard === "inventoryItems" && (
                    <DetailStatCard
                      accent="#60a5fa"
                      title="Inventory Item Breakdown"
                      subtitle="Live stock position by operational status"
                      totalLabel="Inventory Total"
                      totalValue={finalInventoryTotal}
                      rows={[
                        {
                          label: "Warehouse Items",
                          value: Number(stats.warehouseItems || 0),
                          subtle: "Currently inside warehouse",
                        },
                        {
                          label: "Ready to Dispatch",
                          value: Number(stats.readyToDispatchItems || 0),
                          subtle: "Waiting for dispatch",
                        },
                        {
                          label: "Ready Items",
                          value: Number(stats.readyItems || 0),
                          subtle: "Ready / processed stock",
                        },
                      ]}
                    />
                  )}

                  {activeStatCard === "packetItems" && (
                    <DetailStatCard
                      accent="#38bdf8"
                      title="Packet Item Breakdown"
                      subtitle="Actual operational packet-level inventory structure"
                      totalLabel="Packet Items"
                      totalValue={Number(stats.packetItems || 0)}
                      rows={[
                        {
                          label: "Total Packets",
                          value: Number(stats.totalPackets || 0),
                          subtle: "Rows in packets table",
                        },
                        {
                          label: "Packed Packets",
                          value: Number(stats.packedPackets || 0),
                          subtle: "Packets where all packet items are packed",
                        },
                        {
                          label: "Pending Packets",
                          value: Number(stats.pendingPackets || 0),
                          subtle: "Packets pending full packing",
                        },
                        {
                          label: "Packet Items With Sticker",
                          value: Number(stats.packetItemsWithSticker || 0),
                          subtle: "Sticker generated / packed rows",
                        },
                        {
                          label: "Packet Items Pending Sticker",
                          value: Number(stats.packetItemsPendingSticker || 0),
                          subtle: "Still pending sticker generation",
                        },
                        {
                          label: "Sticker Reprints",
                          value: Number(stats.stickerReprints || 0),
                          subtle: "Sticker history with print iteration above 1",
                        },
                      ]}
                    />
                  )}

                  {activeStatCard === "challans" && (
                    <DetailStatCard
                      accent="#8b5cf6"
                      title="Dispatch Challan Breakdown"
                      subtitle="Normal dispatch challans generated from dispatched_items"
                      totalLabel="Total Challans"
                      totalValue={Number(stats.normalDispatchChallans || 0)}
                      rows={[
                        {
                          label: "Normal Dispatch Challans",
                          value: Number(stats.normalDispatchChallans || 0),
                          subtle: "Distinct chalaan_number in dispatched_items",
                        },
                        {
                          label: "Today Dispatch Challans",
                          value: Number(stats.todayDispatchChallans || 0),
                          subtle: "Distinct challans generated today",
                        },
                        {
                          label: "Today Dispatched Items",
                          value: Number(stats.todayChallanGenerated || 0),
                          subtle: "Total item rows dispatched today",
                        },
                        {
                          label: "Running Trips",
                          value: Number(stats.runningTrips || 0),
                          subtle: "Trip started but not ended",
                        },
                        {
                          label: "Ended Trips",
                          value: Number(stats.endedTrips || 0),
                          subtle: "Trip end time saved",
                        },
                        {
                          label: "Queued Items",
                          value: Number(stats.queuedItems || 0),
                          subtle: "Loaded / queued for dispatch",
                        },
                      ]}
                    />
                  )}

                  {activeStatCard === "customChallans" && (
                    <DetailStatCard
                      accent="#ec4899"
                      title="Custom Challan Breakdown"
                      subtitle="Manual customer care / site / hardware movement challans"
                      totalLabel="Custom Challans"
                      totalValue={Number(stats.customChallans || 0)}
                      rows={[
                        {
                          label: "Total Custom Challans",
                          value: Number(stats.customChallans || 0),
                          subtle: "Rows in custom_challans",
                        },
                        {
                          label: "Today Custom Challans",
                          value: Number(stats.todayCustomChallans || 0),
                          subtle: "Generated today",
                        },
                        {
                          label: "Custom Challan Items",
                          value: Number(stats.customChallanItems || 0),
                          subtle: "Rows in custom_challan_items",
                        },
                      ]}
                    />
                  )}

                  {activeStatCard === "exceptions" && (
                    <DetailStatCard
                      accent="#f97316"
                      title="Data Exception Breakdown"
                      subtitle="Data quality checks from master, packet, dispatch and sticker tables"
                      totalLabel="Total Exceptions"
                      totalValue={Number(stats.exceptionsCount || 0)}
                      rows={[
                        {
                          label: "Master Items Without Packets",
                          value: Number(stats.masterItemsWithoutPackets || 0),
                          subtle: "master_item exists but packet_items missing",
                        },
                        {
                          label: "Packets Without Packet Items",
                          value: Number(stats.packetsWithoutPacketItems || 0),
                          subtle: "packets row exists but no packet_items",
                        },
                        {
                          label: "Packet Items Without Master",
                          value: Number(stats.packetItemsWithoutMaster || 0),
                          subtle: "packet_items missing master_item link",
                        },
                        {
                          label: "Dispatched Without Packet Item",
                          value: Number(stats.dispatchedWithoutPacketItem || 0),
                          subtle: "dispatched_items missing packet_item_id link",
                        },
                        {
                          label: "Dispatched Without Challan",
                          value: Number(stats.dispatchedWithoutChallan || 0),
                          subtle: "DISPATCHED status but no chalaan_number",
                        },
                        {
                          label: "Dispatched Without Driver",
                          value: Number(stats.dispatchedWithoutDriver || 0),
                          subtle: "Missing driver / vehicle data",
                        },
                        {
                          label: "Duplicate Current Stickers",
                          value: Number(stats.duplicateCurrentStickers || 0),
                          subtle: "Same sticker_number used on multiple packet_items",
                        },
                        {
                          label: "Ready Items Still In PKD",
                          value: Number(stats.readyItemsStillInPkd || 0),
                          subtle: "Packed items still in packing area",
                        },
                      ]}
                    />
                  )}

                  <div style={workspaceGrid}>
                    <div style={chartPanelSurface}>
                      <div style={chartPanelTop}>
                        <div>
                          <div style={chartPanelTitle}>
                            Inventory Visualization
                          </div>

                          <div style={chartPanelSubtitle}>
                            Switch between donut, flow and volume charts
                          </div>
                        </div>

                        <div style={chartToggleWrap}>
                          <div
                            style={{
                              ...chartSlider,
                              transform: `translateX(${chartIndex * 40}px)`,
                            }}
                          />

                          <button
                            type="button"
                            title="Donut chart"
                            style={chartToggleBtn}
                            onClick={() => setChartType("donut")}
                          >
                            <DonutIcon />
                          </button>

                          <button
                            type="button"
                            title="Line chart"
                            style={chartToggleBtn}
                            onClick={() => setChartType("line")}
                          >
                            <LineIcon />
                          </button>

                          <button
                            type="button"
                            title="Bar chart"
                            style={chartToggleBtn}
                            onClick={() => setChartType("bar")}
                          >
                            <BarIcon />
                          </button>

                          <button
                            type="button"
                            title="Corporate chart"
                            style={chartToggleBtn}
                            onClick={() => setChartType("corporate")}
                          >
                            <CorporateIcon />
                          </button>
                        </div>
                      </div>

                      <div style={chartPanelBody}>
                        {chartType === "donut" && (
                          <StatusDonutChart
                            warehouse={stats.warehouseItems}
                            readyToDispatch={stats.readyToDispatchItems}
                            ready={stats.readyItems}
                          />
                        )}

                        {chartType === "line" && (
                          <StatusLineChart
                            warehouse={stats.warehouseItems}
                            readyToDispatch={stats.readyToDispatchItems}
                            ready={stats.readyItems}
                          />
                        )}

                        {chartType === "bar" && (
                          <StatusBarChart
                            warehouse={stats.warehouseItems}
                            readyToDispatch={stats.readyToDispatchItems}
                            ready={stats.readyItems}
                          />
                        )}

                        {chartType === "corporate" && (
                          <StatusCorporateChart
                            warehouse={stats.warehouseItems}
                            readyToDispatch={stats.readyToDispatchItems}
                            ready={stats.readyItems}
                          />
                        )}
                      </div>
                    </div>

                    <div style={panelSurface}>
                      <ActivityFeed logs={activityLogs} />
                    </div>
                  </div>
                </>
              )}
              {inventorySection === "traceability" && (
                <InventoryCommandCenter
                  stats={stats}
                />
              )}
              {inventorySection === "reports" && (
                <>
                  {isAdmin ? (
                    <>
                      <InventoryReports />

                      <div style={adminPanel}>
                        <ScheduledReports />
                      </div>
                    </>
                  ) : (
                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Reports
                      </div>

                      <div style={insightItem}>
                        Reports are available for ADMIN users only.
                      </div>
                    </div>
                  )}
                </>
              )}
              {inventorySection === "analytics" && (
                <div style={analyticsSection}>
                  <div style={analyticsHeader}>
                    <div>
                      <div style={sectionTitle}>
                        Inventory Intelligence
                      </div>

                      <div style={sectionSubtitle}>
                        Real analytics from master items, packet items, stickers,
                        dispatches, challans and exception checks.
                      </div>
                    </div>
                  </div>

                  <div style={analyticsGridLayout}>
                    <div style={analyticsCardLarge}>
                      <div style={analyticsCardTitle}>
                        Lifecycle Distribution
                      </div>

                      <div style={agingGrid}>
                        <div style={agingItem("#38bdf8")}>
                          <h2>{Number(stats.masterItems || 0)}</h2>
                          <span>Master Items</span>
                        </div>

                        <div style={agingItem("#a78bfa")}>
                          <h2>{Number(stats.packetItems || 0)}</h2>
                          <span>Packet Items</span>
                        </div>

                        <div style={agingItem("#22c55e")}>
                          <h2>{Number(stats.packetItemsWithSticker || 0)}</h2>
                          <span>Sticker Generated</span>
                        </div>

                        <div style={agingItem("#8b5cf6")}>
                          <h2>{Number(stats.dispatchedItems || 0)}</h2>
                          <span>Dispatched</span>
                        </div>
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Packet Completion Rate
                      </div>

                      <div style={metricValue}>
                        {percentLabel(packetCompletionRate)}
                      </div>

                      <div style={metricSubtle}>
                        Packet items with sticker divided by total packet items.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Dispatch Conversion
                      </div>

                      <div style={metricValue}>
                        {percentLabel(operationalEfficiency)}
                      </div>

                      <div style={metricSubtle}>
                        Dispatched items divided by packet items.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Reprint Load
                      </div>

                      <div style={metricValue}>
                        {Number(stats.stickerReprints || 0)}
                      </div>

                      <div style={metricSubtle}>
                        Sticker history entries where print iteration is above 1.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Dispatch Queue
                      </div>

                      <div style={metricValue}>
                        {Number(stats.readyToDispatchItems || 0)}
                      </div>

                      <div style={metricSubtle}>
                        Items ready and waiting for challan generation.
                      </div>
                    </div>

                    <div style={analyticsCardWide}>
                      <div style={analyticsCardTitle}>
                        Operational Insights
                      </div>

                      <div style={insightsList}>
                        <div style={insightItem}>
                          Packet completion is {percentLabel(packetCompletionRate)}.
                          {packetCompletionRate < 80
                            ? " Packing queue needs attention."
                            : " Packing flow is healthy."}
                        </div>

                        <div style={insightItem}>
                          Dispatch conversion is {percentLabel(operationalEfficiency)}.
                          {operationalEfficiency < 50
                            ? " Dispatch movement is slower than packing."
                            : " Dispatch movement is aligned with inventory flow."}
                        </div>

                        <div style={insightItem}>
                          Current inventory exceptions: {currentInventoryExceptions}.
                          {currentInventoryExceptions > 0
                            ? " Review Traceability → Exceptions."
                            : " Current inventory links are clean."}
                        </div>

                        <div style={insightItem}>
                          Running trips: {Number(stats.runningTrips || 0)}.
                          {Number(stats.runningTrips || 0) > 0
                            ? " Close trip end times from Dispatch Challans."
                            : " No open trip-end risk found."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inventorySection === "alerts" && (
                <div style={analyticsSection}>
                  <div style={analyticsHeader}>
                    <div>
                      <div style={sectionTitle}>
                        Inventory Risk & Exception Center
                      </div>

                      <div style={sectionSubtitle}>
                        Live operational risks from master items, packets, stickers,
                        challans, dispatch and vehicle compliance.
                      </div>
                    </div>
                  </div>

                  <div style={analyticsGridLayout}>
                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Current Inventory Exceptions
                      </div>

                      <div style={metricValue}>
                        {currentInventoryExceptions}
                      </div>

                      <div style={metricSubtle}>
                        Current packet/master/sticker issues affecting inventory accuracy.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Legacy Dispatch Gaps
                      </div>

                      <div style={metricValue}>
                        {legacyDispatchExceptions}
                      </div>

                      <div style={metricSubtle}>
                        Older dispatch rows that may not be linked with packet_item_id.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Running Trips
                      </div>

                      <div style={metricValue}>
                        {Number(stats.runningTrips || 0)}
                      </div>

                      <div style={metricSubtle}>
                        Challans where trip start exists but trip end is not closed.
                      </div>
                    </div>

                    <div style={analyticsCard}>
                      <div style={analyticsCardTitle}>
                        Expired Vehicle Docs
                      </div>

                      <div style={metricValue}>
                        {Number(stats.expiredFitness || 0) +
                          Number(stats.expiredInsurance || 0) +
                          Number(stats.expiredPucc || 0)}
                      </div>

                      <div style={metricSubtle}>
                        Fitness, insurance or PUCC expired for active vehicles.
                      </div>
                    </div>

                    <div style={analyticsCardWide}>
                      <div style={analyticsCardTitle}>
                        Exception Breakdown
                      </div>

                      <div style={insightsList}>
                        <div style={insightItem}>
                          ⚠ Master Items Without Packets:{" "}
                          {Number(stats.masterItemsWithoutPackets || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Packets Without Packet Items:{" "}
                          {Number(stats.packetsWithoutPacketItems || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Packet Items Without Master:{" "}
                          {Number(stats.packetItemsWithoutMaster || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Dispatched Without Packet Link:{" "}
                          {Number(stats.dispatchedWithoutPacketItem || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Dispatched Without Challan:{" "}
                          {Number(stats.dispatchedWithoutChallan || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Dispatched Without Driver / Vehicle:{" "}
                          {Number(stats.dispatchedWithoutDriver || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Duplicate Current Stickers:{" "}
                          {Number(stats.duplicateCurrentStickers || 0)}
                        </div>

                        <div style={insightItem}>
                          ⚠ Ready Items Still In PKD:{" "}
                          {Number(stats.readyItemsStillInPkd || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "logistics" && (
          <LogisticsDashboard
            logistics={logistics ?? emptyLogistics}
            setShiftModal={setShiftModal}
            StatCard={StatCard}
            AnalyticsGrid={AnalyticsGrid}
          />
        )}

      </div>
      <LogisticsShiftModal
        open={shiftModal}
        onClose={() =>
          setShiftModal(false)
        }
        onCreated={() => {
          fetchLogisticsStats()
            .then(setLogistics);
        }}
      />
      <ThroughputUserModal
        open={throughputModal.open}
        title={throughputModal.title}
        rows={throughputModal.rows}
        loading={throughputModal.loading}
        error={throughputModal.error}
        onClose={closeThroughputUserModal}
      />
      <MasterItemsModal
        open={masterItemsModalOpen}
        onClose={() => setMasterItemsModalOpen(false)}
      />
    </div>
  );
}

const page = {
  minHeight: "100vh",
  padding: 24,
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",

  background: `
    radial-gradient(circle at 10% 6%, rgba(59,130,246,.22), transparent 30%),
    radial-gradient(circle at 86% 12%, rgba(14,165,233,.14), transparent 24%),
    radial-gradient(circle at 72% 90%, rgba(168,85,247,.11), transparent 28%),
    linear-gradient(135deg,#020617 0%,#07111f 44%,#0f172a 100%)
  `,

  backgroundAttachment: "fixed",
};

const backgroundText = {
  position: "fixed",
  fontSize: 120,
  fontWeight: 950,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.010))",

  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",

  right: 32,
  bottom: 18,

  pointerEvents: "none",
  letterSpacing: 8,
  opacity: 0.45,
};

const emptyLogistics = {
  totalTrips: 0,
  totalLoaders: 0,
  efficiency: 0,
  activeDrivers: 0,
  activeVehicles: 0,
  averageTripsPerDriver: 0,
  averageTripsPerVehicle: 0,
  tripsOverTime: {},
  shiftPerformance: {},
  vehicleUtilization: {},
  driverTrips: {},
  driverPerformance: {},
  overtimeAnalytics: {},
  tripsByLocation: {},
};

const content = {
  position: "relative",
  zIndex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const heroRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 8,
  padding: "4px 2px",
};

const heroTitle = {
  margin: 0,
  fontSize: 36,
  fontWeight: 950,
  color: "#fff",
  letterSpacing: 0.2,
};

const heroSubtitle = {
  marginTop: 6,
  fontSize: 14,
  color: "rgba(255,255,255,.72)",
};

const heroActions = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const modeBtn = (active) => ({
  height: 44,
  padding: "0 18px",
  borderRadius: 999,

  border: active
    ? "1px solid rgba(96,165,250,.48)"
    : "1px solid rgba(255,255,255,.08)",

  cursor: "pointer",

  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "rgba(15,23,42,.70)",

  color: "#fff",
  fontWeight: 900,

  boxShadow: active
    ? "0 14px 30px rgba(37,99,235,.32)"
    : "0 12px 24px rgba(2,6,23,.18)",

  backdropFilter: "blur(16px)",
  transition: "all .25s ease",
});

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
};

const pulseWrap = {
  display: "grid",
  gridTemplateColumns: "minmax(280px,.9fr) minmax(420px,1.4fr)",
  gap: 16,
  alignItems: "stretch",
  padding: 20,
  borderRadius: 28,
  background:
    "linear-gradient(135deg, rgba(15,23,42,.92), rgba(15,23,42,.70))",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow: "0 24px 58px rgba(2,6,23,.36)",
  backdropFilter: "blur(22px)",
};

const pulseTitle = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 950,
};

const pulseSubtitle = {
  marginTop: 7,
  color: "rgba(255,255,255,.58)",
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.6,
};

const pulseGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: 12,
};

const pulseItem = (accent) => ({
  padding: 14,
  borderRadius: 18,
  background:
    `radial-gradient(circle at top right, ${accent}24, transparent 44%), rgba(255,255,255,.035)`,
  border: `1px solid ${accent}33`,
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "rgba(255,255,255,.60)",
  fontSize: 11,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: ".06em",
});

const cardGlow = (accent) => ({
  position: "absolute",
  inset: 0,
  background:
    `radial-gradient(circle at top right, ${accent}2B, transparent 42%)`,
  pointerEvents: "none",
});

const statTopRow = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 11,
};

const statIconBox = (accent) => ({
  width: 34,
  height: 34,
  borderRadius: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `${accent}1F`,
  border: `1px solid ${accent}3D`,
  fontSize: 16,
});

const trendPill = (accent) => ({
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  background: `${accent}1C`,
  border: `1px solid ${accent}36`,
  color: accent,
  fontSize: 10.5,
  fontWeight: 950,
});

const trendLabelStyle = {
  position: "relative",
  zIndex: 1,
  marginTop: 7,
  color: "rgba(255,255,255,.42)",
  fontSize: 11,
  fontWeight: 750,
};

const panelSurface = {
  display: "flex",
  flexDirection: "column",
  height: 430,
  minHeight: 360,
  padding: 16,
  borderRadius: 22,
  background:
    "radial-gradient(circle at top right, rgba(34,211,238,.10), transparent 34%), rgba(15,23,42,.78)",
  border: "1px solid rgba(255,255,255,.065)",
  boxShadow: "0 18px 42px rgba(2,6,23,.34)",
  overflow: "hidden",
  backdropFilter: "blur(18px)",
};

const chartToggleWrap = {
  position: "relative",
  display: "inline-flex",
  gap: 8,
  padding: 5,
  borderRadius: 999,
  background: "rgba(15,23,42,.92)",
  border: "1px solid rgba(255,255,255,.06)",
  width: "fit-content",
};

const chartToggleBtn = {
  width: 32,
  height: 32,

  borderRadius: "50%",

  border: "none",

  background: "transparent",

  color: "#fff",

  cursor: "pointer",

  zIndex: 1,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",
};

const chartSlider = {
  position: "absolute",

  top: 5,
  left: 5,

  width: 32,
  height: 32,

  borderRadius: "50%",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  transition:
    "transform .35s cubic-bezier(.4,0,.2,1)",
};

const sectionTitle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#fff",
};

const sectionSubtitle = {
  fontSize: 13,
  marginTop: 4,
  color: "rgba(255,255,255,.62)",
};


const cardAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  background: accent,
});

const statCard = (accent, clickable = false, active = false) => ({
  position: "relative",

  padding: 15,
  borderRadius: 20,

  background: active
    ? "linear-gradient(180deg, rgba(15,23,42,.96), rgba(15,23,42,.82))"
    : "linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.70))",

  border: active
    ? `1px solid ${accent}77`
    : "1px solid rgba(255,255,255,.075)",

  boxShadow: active
    ? `0 20px 42px ${accent}22`
    : "0 14px 32px rgba(2,6,23,.24)",

  overflow: "hidden",
  minHeight: 132,

  backdropFilter: "blur(22px)",

  cursor: clickable ? "pointer" : "default",
  textAlign: "left",
  width: "100%",
  color: "#fff",
  fontFamily: "inherit",

  transition:
    "transform .22s ease, border-color .22s ease, box-shadow .22s ease",
});

const statTitle = {
  position: "relative",
  zIndex: 1,
  color: "rgba(255,255,255,.56)",
  marginBottom: 7,
  fontSize: 10.5,
  fontWeight: 950,
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const statValue = {
  position: "relative",
  zIndex: 1,
  margin: 0,
  fontSize: 29,
  fontWeight: 950,
  lineHeight: 1,
  color: "#fff",
};

const statSubtle = {
  position: "relative",
  zIndex: 1,
  marginTop: 7,
  fontSize: 10.5,
  fontWeight: 700,
  color: "rgba(255,255,255,.50)",
};

const statClickHint = {
  position: "relative",
  zIndex: 1,
  marginTop: 8,
  fontSize: 10.5,
  fontWeight: 950,
  color: "rgba(255,255,255,.74)",
};

const detailCard = (accent) => ({
  padding: 20,

  borderRadius: 24,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.05), rgba(15,23,42,.82))",

  border: `1px solid ${accent}55`,

  boxShadow: `0 18px 40px ${accent}22`,

  backdropFilter: "blur(18px)",
});

const detailHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
  flexWrap: "wrap",
};

const detailTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const detailSubtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,.58)",
};

const detailTotalBox = {
  minWidth: 140,
  padding: "10px 14px",

  borderRadius: 16,

  background: "rgba(255,255,255,.05)",

  border: "1px solid rgba(255,255,255,.08)",

  display: "flex",
  flexDirection: "column",
  gap: 4,

  color: "rgba(255,255,255,.68)",

  fontSize: 12,
  fontWeight: 700,
};

const detailGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
};

const detailItem = {
  padding: 16,

  borderRadius: 18,

  background: "rgba(255,255,255,.04)",

  border: "1px solid rgba(255,255,255,.06)",
};

const throughputClickCard = (accent, enabled) => ({
  padding: 16,

  borderRadius: 18,

  background: "rgba(255,255,255,.04)",

  border: `1px solid ${accent}44`,

  cursor: enabled ? "pointer" : "not-allowed",

  opacity: enabled ? 1 : 0.7,

  textAlign: "left",

  fontFamily: "inherit",

  color: "#fff",

  transition: "all .25s ease",
});

const throughputCardHint = {
  marginTop: 10,
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,.68)",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,

  background: "rgba(2,6,23,.72)",

  backdropFilter: "blur(12px)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  padding: 20,
};

const modalCard = {
  width: "min(560px, 100%)",

  borderRadius: 26,

  padding: 22,

  background:
    "linear-gradient(180deg, rgba(15,23,42,.96), rgba(15,23,42,.88))",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 28px 70px rgba(2,6,23,.55)",

  color: "#fff",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
};

const modalTitle = {
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const modalSubtitle = {
  marginTop: 5,
  fontSize: 13,
  color: "rgba(255,255,255,.56)",
};

const modalCloseBtn = {
  width: 34,
  height: 34,

  borderRadius: "50%",

  border:
    "1px solid rgba(255,255,255,.10)",

  background: "rgba(255,255,255,.06)",

  color: "#fff",

  cursor: "pointer",

  fontSize: 22,
  lineHeight: 1,
};

const modalTotalBox = {
  marginBottom: 14,

  padding: "12px 14px",

  borderRadius: 18,

  background: "rgba(59,130,246,.13)",

  border: "1px solid rgba(59,130,246,.22)",

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",

  color: "rgba(255,255,255,.72)",

  fontSize: 13,
  fontWeight: 800,
};

const modalUserList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const modalUserRow = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0,1fr) auto",
  alignItems: "center",
  gap: 12,

  padding: "12px 14px",

  borderRadius: 16,

  background: "rgba(255,255,255,.045)",

  border: "1px solid rgba(255,255,255,.07)",
};

const modalRank = {
  width: 30,
  height: 30,

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background: "rgba(59,130,246,.16)",

  color: "#93c5fd",

  fontSize: 12,
  fontWeight: 900,
};

const modalUserName = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,

  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const modalCount = {
  color: "#fff",
  fontSize: 20,
  fontWeight: 900,
};

const modalEmpty = {
  padding: 16,

  borderRadius: 16,

  background: "rgba(255,255,255,.04)",

  color: "rgba(255,255,255,.58)",

  fontSize: 13,
  fontWeight: 700,
};

const modalError = {
  padding: 16,

  borderRadius: 16,

  background: "rgba(239,68,68,.10)",

  border: "1px solid rgba(239,68,68,.22)",

  color: "#fca5a5",

  fontSize: 13,
  fontWeight: 800,
};

const detailItemLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,.62)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const detailItemValue = {
  marginTop: 8,
  fontSize: 30,
  fontWeight: 900,
  color: "#fff",
};

const detailItemSubtle = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(255,255,255,.52)",
};

const adminPanel = {
  marginTop: 2,

  borderRadius: 24,

  padding: 18,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",

  backdropFilter: "blur(18px)",
};

const analyticsCardTitle = {
  fontSize: 16,

  fontWeight: 800,

  color: "#fff",

  marginBottom: 18,
};

const metricValue = {
  fontSize: 38,

  fontWeight: 900,

  color: "#fff",
};

const metricSubtle = {
  marginTop: 8,

  color: "rgba(255,255,255,.58)",

  fontSize: 13,
};

const agingGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",

  gap: 14,
};

const agingItem = (color) => ({
  padding: 18,

  borderRadius: 18,

  background:
    "rgba(255,255,255,.03)",

  border:
    `1px solid ${color}33`,

  textAlign: "center",
});

const insightsList = {
  display: "flex",

  flexDirection: "column",

  gap: 12,
};

const insightItem = {
  padding: "14px 16px",

  borderRadius: 16,

  background:
    "rgba(255,255,255,.04)",

  color: "rgba(255,255,255,.82)",

  fontSize: 14,

  fontWeight: 600,

  border:
    "1px solid rgba(255,255,255,.05)",
};

const analyticsCard = {
  padding: 22,

  borderRadius: 24,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 40px rgba(2,6,23,.34)",

  backdropFilter: "blur(18px)",
};

const analyticsCardLarge = {
  ...analyticsCard,

  gridColumn: "span 2",
};

const analyticsCardWide = {
  ...analyticsCard,

  gridColumn: "span 2",
};

const analyticsSection = {
  marginTop: 4,
};

const analyticsHeader = {
  marginBottom: 16,
};

const analyticsGridLayout = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",

  gap: 16,
};

const inventoryLayout = {
  display: "flex",

  gap: 20,

  alignItems: "flex-start",
};

const inventoryMain = {
  flex: 1,

  display: "flex",

  flexDirection: "column",

  gap: 18,
};

const throughputMiniCard = (
  accent,
  active = false,
  disabled = false
) => ({
  position: "relative",

  padding: 18,

  borderRadius: 20,

  border: active
    ? `1px solid ${accent}77`
    : "1px solid rgba(255,255,255,.07)",

  background: active
    ? `linear-gradient(180deg, ${accent}22, rgba(255,255,255,.035))`
    : "rgba(255,255,255,.04)",

  color: "#fff",

  textAlign: "left",

  cursor: disabled ? "not-allowed" : "pointer",

  opacity: disabled ? 0.72 : 1,

  boxShadow: active
    ? `0 16px 34px ${accent}22`
    : "none",

  transition: "all .25s ease",

  fontFamily: "inherit",
});

const throughputMiniTitle = {
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,.62)",
  letterSpacing: ".07em",
  textTransform: "uppercase",
};

const throughputMiniValue = {
  marginTop: 10,
  fontSize: 34,
  fontWeight: 900,
  color: "#fff",
};

const throughputMiniSubtle = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,.56)",
};

const throughputMiniHint = {
  marginTop: 12,
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,.72)",
};

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.05fr) minmax(360px,.72fr)",
  gap: 14,
  alignItems: "start",

  "@media (max-width: 1180px)": {
    gridTemplateColumns: "1fr",
  },
};

const chartPanelSurface = {
  position: "relative",
  height: 430,
  minHeight: 430,
  padding: 16,
  borderRadius: 22,
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,.15), transparent 32%), linear-gradient(180deg, rgba(15,23,42,.88), rgba(15,23,42,.70))",
  border: "1px solid rgba(255,255,255,.075)",
  boxShadow: "0 18px 42px rgba(2,6,23,.34)",
  backdropFilter: "blur(18px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const chartPanelTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const chartPanelTitle = {
  fontSize: 16,
  fontWeight: 950,
  color: "#fff",
  letterSpacing: "-.02em",
};

const chartPanelSubtitle = {
  marginTop: 4,
  fontSize: 11,
  color: "rgba(255,255,255,.54)",
  fontWeight: 650,
};

const chartPanelBody = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  padding: 12,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,.040), rgba(255,255,255,.018))",
  border: "1px solid rgba(255,255,255,.055)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default DashboardPage;