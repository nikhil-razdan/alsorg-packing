import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import usePackFlowDataRefresh from "../dashboard/hooks/usePackFlowDataRefresh";
import {
  fetchDashboardActivity,
  fetchDashboardStats,
  fetchLogisticsStats,
} from "../dashboard/api/dashboardApi";
import AdminOperationsDashboard from "../dashboard/components/AdminOperationsDashboard";
import DirectorExecutiveDashboard from "../dashboard/components/DirectorExecutiveDashboard";

const REFRESH_INTERVAL_MS = 10000;

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const EMPTY_STATS = Object.freeze({
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
});

function normalizeStats(data) {
  const warehouseItems = n(
    data?.warehouseItems ?? data?.warehouse ?? data?.warehouseStock ?? data?.inWarehouse
  );
  const readyToDispatchItems = n(
    data?.readyToDispatchItems ?? data?.readyToDispatch ?? data?.readyToDispatchCount
  );
  const readyItems = n(data?.readyItems ?? data?.ready ?? data?.readyCount);
  const inventoryTotal = warehouseItems + readyToDispatchItems + readyItems;

  return {
    ...EMPTY_STATS,
    totalItems: inventoryTotal || n(data?.totalItems ?? data?.total ?? data?.inventoryItems),
    warehouseItems,
    readyToDispatchItems,
    readyItems,
    packedItems: n(data?.packedItems ?? data?.packed),
    dispatchedItems: n(data?.dispatchedItems ?? data?.dispatched),
    pendingItems: n(data?.pendingItems ?? data?.pending),
    stickersGenerated: n(data?.stickersGenerated ?? data?.stickers),
    todayStickerGenerated: n(
      data?.todayStickerGenerated ?? data?.todayStickersGenerated ?? data?.stickersGeneratedToday
    ),
    todayChallanGenerated: n(
      data?.todayChallanGenerated ?? data?.todayChallansGenerated ?? data?.challansGeneratedToday
    ),
    masterItems: n(data?.masterItems),
    totalPackets: n(data?.totalPackets),
    packetItems: n(data?.packetItems),
    fullyPackedMasterItems: n(data?.fullyPackedMasterItems),
    partiallyPackedMasterItems: n(data?.partiallyPackedMasterItems),
    unpackedMasterItems: n(data?.unpackedMasterItems),
    packedPackets: n(data?.packedPackets),
    pendingPackets: n(data?.pendingPackets),
    packetItemsWithSticker: n(data?.packetItemsWithSticker),
    packetItemsPendingSticker: n(data?.packetItemsPendingSticker),
    stickerReprints: n(data?.stickerReprints),
    readyToStoreItems: n(data?.readyToStoreItems),
    warehouseRequestedItems: n(data?.warehouseRequestedItems),
    returnRequestedItems: n(data?.returnRequestedItems),
    queuedItems: n(data?.queuedItems),
    pkdItems: n(data?.pkdItems),
    fgItems: n(data?.fgItems),
    normalDispatchChallans: n(data?.normalDispatchChallans),
    todayDispatchChallans: n(data?.todayDispatchChallans),
    runningTrips: n(data?.runningTrips),
    endedTrips: n(data?.endedTrips),
    customChallans: n(data?.customChallans),
    todayCustomChallans: n(data?.todayCustomChallans),
    customChallanItems: n(data?.customChallanItems),
    activeDrivers: n(data?.activeDrivers),
    activeVehicles: n(data?.activeVehicles),
    expiredFitness: n(data?.expiredFitness),
    expiredInsurance: n(data?.expiredInsurance),
    expiredPucc: n(data?.expiredPucc),
    exceptionsCount: n(data?.exceptionsCount),
    masterItemsWithoutPackets: n(data?.masterItemsWithoutPackets),
    packetsWithoutPacketItems: n(data?.packetsWithoutPacketItems),
    packetItemsWithoutMaster: n(data?.packetItemsWithoutMaster),
    dispatchedWithoutPacketItem: n(data?.dispatchedWithoutPacketItem),
    dispatchedWithoutChallan: n(data?.dispatchedWithoutChallan),
    dispatchedWithoutDriver: n(data?.dispatchedWithoutDriver),
    duplicateCurrentStickers: n(data?.duplicateCurrentStickers),
    readyItemsStillInPkd: n(data?.readyItemsStillInPkd),
  };
}

function operationalLanding(user, hasRole) {
  const primaryRole = String(user?.role || "")
    .replace(/^ROLE_/i, "")
    .trim()
    .toUpperCase();

  const routeForRole = (role) => {
    switch (role) {
      case "PACKING":
        return "/packflow/zoho-items?view=normal";
      case "HARDWARE_PACKING":
        return "/packflow/zoho-items?view=hardware";
      case "WAREHOUSE":
        return "/packflow/warehouse";
      case "DISPATCH":
        return "/packflow/dispatched-items";
      case "LOGISTICS":
        return "/packflow/logistics";
      default:
        return null;
    }
  };

  const primaryRoute = routeForRole(primaryRole);
  if (primaryRoute) return primaryRoute;

  for (const role of ["PACKING", "HARDWARE_PACKING", "WAREHOUSE", "DISPATCH", "LOGISTICS"]) {
    if (hasRole(role)) return routeForRole(role);
  }

  return "/modules";
}

export default function DashboardPage() {
  const { user, hasRole, authLoading } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const isDirector = hasRole("PACKFLOW_DIRECTOR");
  const canViewDashboard = isAdmin || isDirector;

  const [view, setView] = useState(isAdmin ? "admin" : "director");
  const [stats, setStats] = useState(EMPTY_STATS);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logistics, setLogistics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      setView((current) => (current === "director" ? current : "admin"));
    } else if (isDirector) {
      setView("director");
    }
  }, [isAdmin, isDirector]);

  const loadDashboard = useCallback(
    async ({ foreground = false } = {}) => {
      if (!canViewDashboard) return;
      if (foreground) setRefreshing(true);

      const statsTask = fetchDashboardStats();
      const logisticsTask = fetchLogisticsStats();
      const activityTask = isAdmin
        ? fetchDashboardActivity(100)
        : Promise.resolve(null);

      const [statsResult, logisticsResult, activityResult] = await Promise.allSettled([
        statsTask,
        logisticsTask,
        activityTask,
      ]);

      const errors = [];

      if (statsResult.status === "fulfilled") {
        setStats(normalizeStats(statsResult.value || {}));
      } else {
        errors.push(statsResult.reason?.message || "Dashboard statistics failed");
      }

      if (logisticsResult.status === "fulfilled") {
        setLogistics(logisticsResult.value || null);
      } else {
        errors.push(logisticsResult.reason?.message || "Logistics analytics failed");
      }

      if (isAdmin) {
        if (activityResult.status === "fulfilled") {
          setActivityLogs(Array.isArray(activityResult.value) ? activityResult.value : []);
        } else {
          errors.push(activityResult.reason?.message || "Activity feed failed");
        }
      }

      setLoadError(errors.join(" • "));
      setLastRefresh(new Date());
      if (foreground) setRefreshing(false);
    },
    [canViewDashboard, isAdmin]
  );

  useEffect(() => {
    if (!canViewDashboard) return;
    void loadDashboard();
  }, [canViewDashboard, loadDashboard]);

  usePackFlowDataRefresh(
    "packflow-management-dashboard",
    async () => {
      await loadDashboard({ foreground: false });
    },
    {
      enabled: canViewDashboard,
      intervalMs: REFRESH_INTERVAL_MS,
    }
  );

  const refreshedLabel = useMemo(() => {
    if (!lastRefresh) return "Loading current operating snapshot";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(lastRefresh);
  }, [lastRefresh]);

  if (authLoading) return null;

  if (!canViewDashboard) {
    return <Navigate to={operationalLanding(user, hasRole)} replace />;
  }

  return (
    <div style={page}>
      <div style={shell}>
        <div style={topBar}>
          <div>
            <div style={brandEyebrow}>ALSORG • PACKFLOW MANAGEMENT</div>
            <div style={topBarSub}>
              Live internal operating data • {refreshedLabel}
            </div>
          </div>

          <div style={topActions}>
            {isAdmin && (
              <div style={switcher} aria-label="Dashboard view">
                <button
                  type="button"
                  style={switchButton(view === "admin")}
                  onClick={() => setView("admin")}
                >
                  Admin Control
                </button>
                <button
                  type="button"
                  style={switchButton(view === "director")}
                  onClick={() => setView("director")}
                >
                  Director Brief
                </button>
              </div>
            )}

            <button
              type="button"
              style={refreshButton}
              onClick={() => loadDashboard({ foreground: true })}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loadError && (
          <div style={warningStrip}>
            Some live panels could not refresh. Last successful values remain visible. {loadError}
          </div>
        )}

        {view === "admin" && isAdmin ? (
          <AdminOperationsDashboard
            stats={stats}
            logistics={logistics}
            activityLogs={activityLogs}
            refreshing={refreshing}
            onRefresh={() => loadDashboard({ foreground: true })}
          />
        ) : (
          <DirectorExecutiveDashboard
            stats={stats}
            logistics={logistics}
          />
        )}
      </div>
    </div>
  );
}

const page = {
  minHeight: "100%",
  colorScheme: "var(--pf-color-scheme)",
  color: "var(--pf-text-strong)",
  background:
    "radial-gradient(circle at 8% 0%,rgba(37,99,235,.08),transparent 26%),linear-gradient(180deg,var(--pf-bg),var(--pf-surface-alt))",
};

const shell = {
  width: "100%",
  maxWidth: 1680,
  margin: "0 auto",
  padding: "18px clamp(14px,2vw,28px) 34px",
  boxSizing: "border-box",
};

const topBar = {
  minHeight: 50,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 12,
  flexWrap: "wrap",
};

const brandEyebrow = {
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".14em",
  color: "#2563eb",
};

const topBarSub = {
  marginTop: 4,
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  fontWeight: 700,
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const switcher = {
  display: "flex",
  padding: 3,
  gap: 3,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface-alt)",
  borderRadius: 10,
};

const switchButton = (active) => ({
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 7,
  border: active ? "1px solid rgba(37,99,235,.22)" : "1px solid transparent",
  background: active ? "var(--pf-surface)" : "transparent",
  color: active ? "#2563eb" : "var(--pf-text-muted)",
  fontWeight: 900,
  fontSize: 10.5,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: active ? "0 3px 10px rgba(var(--pf-shadow-rgb),.06)" : "none",
});

const refreshButton = {
  minHeight: 38,
  padding: "0 14px",
  border: "1px solid rgba(37,99,235,.24)",
  borderRadius: 9,
  background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 10.5,
  cursor: "pointer",
  fontFamily: "inherit",
};

const warningStrip = {
  marginBottom: 12,
  padding: "9px 12px",
  borderRadius: 9,
  border: "1px solid rgba(245,158,11,.24)",
  background: "rgba(245,158,11,.08)",
  color: "color-mix(in srgb,#d97706 78%,var(--pf-text-strong))",
  fontSize: 10.5,
  fontWeight: 750,
};
