import { useCallback, useEffect, useState } from "react";
import StatusDonutChart from "../dashboard/components/StatusDonutChart";
import StatusBarChart from "../dashboard/components/StatusBarChart";
import ActivityFeed from "../dashboard/components/ActivityFeed";
import InventoryReports from "../dashboard/components/inventory/InventoryReports";
import ScheduledReports from "../dashboard/components/ScheduledReports";
import {
  fetchDashboardStats,
  fetchDashboardActivity,
  fetchDailyThroughputUsers,
  fetchDashboardTrace,
} from "../dashboard/api/dashboardApi";

import LogisticsDashboard from "../dashboard/components/logistics/LogisticsDashboard";
import InventorySidebar from
  "../dashboard/components/inventory/InventorySidebar";
import { useAuth } from "../auth/AuthContext";
import InventoryCommandCenter from
  "../dashboard/components/inventory/InventoryCommandCenter";
import MasterItemsModal from
  "../dashboard/components/inventory/MasterItemsModal";
import StatusCorporateChart from "../dashboard/components/StatusCorporateChart";
import AdminCenter from
  "../dashboard/components/admin/AdminCenter";

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

function InventoryStatCard({
  title,
  value,
  subtle,
  accent = "#60a5fa",
  icon = "◇",
  trend,
  trendLabel,
  onClick,
  active = false,
  progress,
  progressLabel,
}) {
  const clickable = Boolean(onClick);

  const normalizedProgress =
    Number.isFinite(Number(progress))
      ? Math.max(
        0,
        Math.min(
          100,
          Number(progress)
        )
      )
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={inventoryStatCard(
        accent,
        clickable,
        active
      )}
    >
      <div style={inventoryCardAmbient(accent)} />
      <div style={inventoryCardTopLine(accent)} />

      <div style={inventoryStatTopRow}>
        <div style={inventoryStatIdentity}>
          <div style={inventoryStatIcon(accent)}>
            {icon}
          </div>

          <div style={inventoryStatTitle}>
            {title}
          </div>
        </div>

        {trend !== undefined &&
          trend !== null && (
            <div style={inventoryTrendPill(accent)}>
              {trend}
            </div>
          )}
      </div>

      <div style={inventoryStatValueRow}>
        <div style={inventoryStatValue}>
          {value}
        </div>

        {clickable && (
          <div style={inventoryOpenIndicator(active)}>
            {active ? "−" : "↗"}
          </div>
        )}
      </div>

      {subtle && (
        <div style={inventoryStatSubtle}>
          {subtle}
        </div>
      )}

      {normalizedProgress !== null && (
        <div style={inventoryProgressWrap}>
          <div style={inventoryProgressMeta}>
            <span>
              {progressLabel ||
                "Progress"}
            </span>
            <strong>
              {Math.round(
                normalizedProgress
              )}
              %
            </strong>
          </div>

          <div style={inventoryProgressTrack}>
            <div
              style={inventoryProgressFill(
                accent,
                normalizedProgress
              )}
            />
          </div>
        </div>
      )}

      <div style={inventoryStatFooter}>
        <div style={inventoryTrendLabel}>
          {trendLabel ||
            (clickable
              ? "Open detailed breakdown"
              : "Live inventory metric")}
        </div>

        {clickable ? (
          <div style={inventoryAnalyzePill(accent, active)}>
            {active ? "OPEN" : "ANALYZE ↗"}
          </div>
        ) : (
          <div style={inventoryLiveDotWrap}>
            <span style={inventoryLiveDot(accent)} />
            LIVE
          </div>
        )}
      </div>
    </button>
  );
}

function InventoryPulseMetric({
  label,
  value,
  detail,
  accent = "#60a5fa",
  progress,
}) {
  const normalizedProgress =
    Number.isFinite(Number(progress))
      ? Math.max(
        0,
        Math.min(
          100,
          Number(progress)
        )
      )
      : null;

  return (
    <div style={inventoryPulseMetric(accent)}>
      <div style={inventoryPulseMetricTop}>
        <div style={inventoryPulseMetricLabel}>
          {label}
        </div>

        <span style={inventoryPulseDot(accent)} />
      </div>

      <div style={inventoryPulseMetricValue}>
        {value}
      </div>

      <div style={inventoryPulseMetricDetail}>
        {detail}
      </div>

      {normalizedProgress !== null && (
        <div style={inventoryPulseTrack}>
          <div
            style={inventoryPulseFill(
              accent,
              normalizedProgress
            )}
          />
        </div>
      )}
    </div>
  );
}

function ChartStatusMetric({
  label,
  value,
  share,
  accent,
  icon,
}) {
  return (
    <div style={chartStatusMetric(accent)}>
      <div style={chartStatusIcon(accent)}>
        {icon}
      </div>

      <div style={chartStatusCopy}>
        <div style={chartStatusLabel}>
          {label}
        </div>

        <div style={chartStatusValueRow}>
          <strong style={chartStatusValue}>
            {value}
          </strong>
          <span>
            {Math.round(share || 0)}%
          </span>
        </div>
      </div>

      <div style={chartStatusProgress}>
        <div
          style={chartStatusProgressFill(
            accent,
            share
          )}
        />
      </div>
    </div>
  );
}

function ActivitySignal({
  label,
  value,
  accent,
}) {
  return (
    <div style={activitySignal}>
      <span style={activitySignalDot(accent)} />

      <div>
        <div style={activitySignalLabel}>
          {label}
        </div>
        <div style={activitySignalValue}>
          {value}
        </div>
      </div>
    </div>
  );
}

const getActivityText = (activity) => {
  try {
    return JSON.stringify(
      activity || {}
    ).toUpperCase();
  } catch {
    return String(
      activity || ""
    ).toUpperCase();
  }
};

const getActivityTimestamp = (activity) =>
  activity?.createdAt ||
  activity?.updatedAt ||
  activity?.timestamp ||
  activity?.activityAt ||
  activity?.time ||
  activity?.date ||
  null;

const formatActivityRefreshTime = (value) => {
  if (!value) return "Not refreshed yet";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  ).format(date);
};

function DetailStatCard({
  title,
  subtitle,
  accent = "#60a5fa",
  rows = [],
  totalLabel,
  totalValue,
  onInspect,
  inspectLabel = "Inspect exact records",
}) {
  return (
    <div style={detailCard(accent)}>
      <div style={detailHeader}>
        <div>
          <div style={detailTitle}>{title}</div>
          {subtitle && <div style={detailSubtitle}>{subtitle}</div>}
        </div>

        <div style={detailHeaderActions}>
          {onInspect && (
            <button
              type="button"
              onClick={onInspect}
              style={detailInspectButton(accent)}
            >
              {inspectLabel} ↗
            </button>
          )}

          {totalLabel && (
            <div style={detailTotalBox}>
              <span>{totalLabel}</span>
              <strong>{totalValue}</strong>
            </div>
          )}
        </div>
      </div>

      <div style={detailGrid}>
        {rows.map((row) => {
          const clickable = Boolean(row.onClick);

          return (
            <button
              type="button"
              key={row.label}
              onClick={row.onClick}
              disabled={!clickable}
              style={detailItemButton(
                accent,
                clickable
              )}
            >
              <div style={detailItemLabel}>{row.label}</div>
              <div style={detailItemValue}>{row.value}</div>
              {row.subtle && (
                <div style={detailItemSubtle}>{row.subtle}</div>
              )}
              {clickable && (
                <div style={detailItemOpenHint}>
                  Pinpoint records →
                </div>
              )}
            </button>
          );
        })}
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


/* =========================================================
 * FAST DASHBOARD DATA LAYER
 *
 * - Shows the last successful dashboard snapshot immediately.
 * - Revalidates in the background so data stays current.
 * - De-duplicates simultaneous stats/activity requests.
 * - Keeps stats and activity independent, so the faster API
 *   paints immediately instead of waiting for the slower one.
 * ========================================================= */

const DASHBOARD_CACHE_KEY =
  "packflow:inventory-dashboard:v3";

const DASHBOARD_CACHE_MAX_AGE_MS =
  5 * 60 * 1000;

let dashboardMemoryCache = null;
let dashboardStatsInFlight = null;
let dashboardActivityInFlight = null;

function readDashboardCache() {
  const now = Date.now();

  if (
    dashboardMemoryCache &&
    now -
    Number(
      dashboardMemoryCache.cachedAt ||
      0
    ) <=
    DASHBOARD_CACHE_MAX_AGE_MS
  ) {
    return dashboardMemoryCache;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        DASHBOARD_CACHE_KEY
      );

    if (!raw) return null;

    const parsed =
      JSON.parse(raw);

    const cachedAt =
      Number(
        parsed?.cachedAt || 0
      );

    if (
      !cachedAt ||
      now - cachedAt >
      DASHBOARD_CACHE_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(
        DASHBOARD_CACHE_KEY
      );

      return null;
    }

    dashboardMemoryCache =
      parsed;

    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardCache(
  patch = {}
) {
  const previous =
    readDashboardCache() || {};

  const next = {
    ...previous,
    ...patch,
    cachedAt: Date.now(),
  };

  dashboardMemoryCache =
    next;

  try {
    window.sessionStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify(next)
    );
  } catch {
    // Cache is only a speed optimisation.
    // Dashboard must keep working even if storage is unavailable.
  }

  return next;
}

function requestDashboardStatsFast() {
  if (
    dashboardStatsInFlight
  ) {
    return dashboardStatsInFlight;
  }

  dashboardStatsInFlight =
    fetchDashboardStats()
      .finally(() => {
        dashboardStatsInFlight =
          null;
      });

  return dashboardStatsInFlight;
}

function requestDashboardActivityFast() {
  if (
    dashboardActivityInFlight
  ) {
    return dashboardActivityInFlight;
  }

  dashboardActivityInFlight =
    fetchDashboardActivity(100)
      .finally(() => {
        dashboardActivityInFlight =
          null;
      });

  return dashboardActivityInFlight;
}

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


const DASHBOARD_DRILLDOWN_BATCH_SIZE = 500;
const DASHBOARD_DRILLDOWN_MAX_ROWS = 10000;
const DASHBOARD_DRILLDOWN_PAGE_SIZES = [10, 20, 50];

const dashboardPad = (value) =>
  String(value).padStart(2, "0");

const dashboardToDateTime = (
  date,
  time,
  endOfDay = false
) => {
  if (!date) return undefined;

  const finalTime =
    time ||
    (endOfDay
      ? "23:59:59"
      : "00:00:00");

  return `${date}T${finalTime.length === 5
      ? `${finalTime}:00`
      : finalTime
    }`;
};

const dashboardFormatDateTime = (value) => {
  if (!value) return "—";

  try {
    const raw = String(value)
      .trim()
      .replace(" ", "T");

    let date;

    const localMatch = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );

    if (
      localMatch &&
      !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
    ) {
      date = new Date(
        Number(localMatch[1]),
        Number(localMatch[2]) - 1,
        Number(localMatch[3]),
        Number(localMatch[4]),
        Number(localMatch[5]),
        Number(localMatch[6] || 0)
      );
    } else {
      date = new Date(raw);
    }

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }
    );
  } catch {
    return String(value);
  }
};

const dashboardSafeText = (
  value,
  fallback = "—"
) => {
  const text =
    String(value ?? "")
      .trim();

  return text || fallback;
};

const dashboardTraceActionDate = (row) =>
  row?.dispatchedAt ||
  row?.generatedAt ||
  row?.packedAt ||
  row?.tripStartedAt ||
  row?.createdAt ||
  row?.updatedAt ||
  null;

const dashboardTraceCreatedBy = (row) =>
  row?.createdBy ||
  row?.raisedBy ||
  row?.generatedBy ||
  "—";

const dashboardTracePackedBy = (row) =>
  row?.packedBy ||
  row?.stickerGeneratedBy ||
  row?.generatedBy ||
  "—";

const dashboardTraceDispatchedBy = (row) =>
  row?.dispatchedBy ||
  row?.dispatchBy ||
  row?.tripStartedBy ||
  "—";

const dashboardFieldLabel = (value) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );

const dashboardFieldValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

function DashboardRecordDetailModal({
  row,
  title,
  onClose,
}) {
  if (!row) return null;

  const fields =
    Object.entries(row)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      );

  return (
    <div
      style={dashboardRecordOverlay}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <div style={dashboardRecordModal}>
        <div style={dashboardRecordHeader}>
          <div>
            <div style={dashboardRecordEyebrow}>
              PINPOINT RECORD INSPECTOR
            </div>

            <div style={dashboardRecordTitle}>
              {dashboardSafeText(
                row.itemName ||
                row.masterItemName ||
                row.packetNumber ||
                row.challanNumber ||
                row.stickerNumber,
                title ||
                "Selected Record"
              )}
            </div>

            <div style={dashboardRecordSub}>
              {dashboardSafeText(
                row.sourceType
              )}{" "}
              •{" "}
              {dashboardSafeText(
                row.status ||
                row.movementType
              )}{" "}
              •{" "}
              {dashboardFormatDateTime(
                dashboardTraceActionDate(
                  row
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={dashboardRecordClose}
          >
            ×
          </button>
        </div>

        <div style={dashboardRecordActorGrid}>
          <div style={dashboardRecordActor}>
            <span>Created By</span>
            <strong>
              {dashboardSafeText(
                dashboardTraceCreatedBy(
                  row
                )
              )}
            </strong>
          </div>

          <div style={dashboardRecordActor}>
            <span>Packed By</span>
            <strong>
              {dashboardSafeText(
                dashboardTracePackedBy(
                  row
                )
              )}
            </strong>
          </div>

          <div style={dashboardRecordActor}>
            <span>Dispatched By</span>
            <strong>
              {dashboardSafeText(
                dashboardTraceDispatchedBy(
                  row
                )
              )}
            </strong>
          </div>

          <div style={dashboardRecordActor}>
            <span>Action Date / Time</span>
            <strong>
              {dashboardFormatDateTime(
                dashboardTraceActionDate(
                  row
                )
              )}
            </strong>
          </div>
        </div>

        <div
          style={dashboardRecordFields}
          className="dashboard-drill-scroll"
        >
          {fields.map(
            ([key, value]) => (
              <div
                key={key}
                style={dashboardRecordField}
              >
                <div
                  style={
                    dashboardRecordFieldLabel
                  }
                >
                  {dashboardFieldLabel(
                    key
                  )}
                </div>

                <div
                  style={
                    dashboardRecordFieldValue
                  }
                >
                  {dashboardFieldValue(
                    value
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function StatDrilldownModal({
  open,
  config,
  onClose,
}) {
  const [rows, setRows] =
    useState([]);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [fromDate, setFromDate] =
    useState("");
  const [toDate, setToDate] =
    useState("");
  const [fromTime, setFromTime] =
    useState("");
  const [toTime, setToTime] =
    useState("");
  const [page, setPage] =
    useState(0);
  const [pageSize, setPageSize] =
    useState(20);
  const [selectedRow, setSelectedRow] =
    useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch(
      String(
        config?.search || ""
      )
    );
    setFromDate("");
    setToDate("");
    setFromTime("");
    setToTime("");
    setPage(0);
    setSelectedRow(null);
  }, [
    open,
    config?.key,
    config?.search,
  ]);

  const loadRows = useCallback(
    async (overrides = {}) => {
      if (!open) return;

      const effectiveSearch =
        Object.prototype.hasOwnProperty.call(
          overrides,
          "search"
        )
          ? overrides.search
          : search;

      const effectiveFromDate =
        Object.prototype.hasOwnProperty.call(
          overrides,
          "fromDate"
        )
          ? overrides.fromDate
          : fromDate;

      const effectiveFromTime =
        Object.prototype.hasOwnProperty.call(
          overrides,
          "fromTime"
        )
          ? overrides.fromTime
          : fromTime;

      const effectiveToDate =
        Object.prototype.hasOwnProperty.call(
          overrides,
          "toDate"
        )
          ? overrides.toDate
          : toDate;

      const effectiveToTime =
        Object.prototype.hasOwnProperty.call(
          overrides,
          "toTime"
        )
          ? overrides.toTime
          : toTime;

      try {
        setLoading(true);
        setError("");

        const sourceRows = [];
        const pageSignatures =
          new Set();

        for (
          let offset = 0;
          offset < DASHBOARD_DRILLDOWN_MAX_ROWS;
          offset += DASHBOARD_DRILLDOWN_BATCH_SIZE
        ) {
          const data =
            await fetchDashboardTrace({
              type:
                config?.type ||
                "all",
              from:
                dashboardToDateTime(
                  effectiveFromDate,
                  effectiveFromTime,
                  false
                ),
              to:
                dashboardToDateTime(
                  effectiveToDate,
                  effectiveToTime,
                  true
                ),
              search:
                String(
                  effectiveSearch ||
                  ""
                ).trim(),
              limit:
                DASHBOARD_DRILLDOWN_BATCH_SIZE,
              offset,
            });

          const batch =
            Array.isArray(data)
              ? data
              : Array.isArray(
                data?.content
              )
                ? data.content
                : [];

          if (batch.length === 0) {
            break;
          }

          const signature =
            batch
              .slice(0, 12)
              .map(
                (row) =>
                  row?.packetItemId ||
                  row?.masterItemId ||
                  row?.challanNumber ||
                  row?.stickerNumber ||
                  row?.id ||
                  ""
              )
              .join("|");

          if (
            signature &&
            pageSignatures.has(
              signature
            )
          ) {
            console.warn(
              "Dashboard trace endpoint repeated a page; stopping drill-down pagination."
            );
            break;
          }

          if (signature) {
            pageSignatures.add(
              signature
            );
          }

          sourceRows.push(...batch);

          if (
            batch.length <
            DASHBOARD_DRILLDOWN_BATCH_SIZE
          ) {
            break;
          }
        }

        const statuses =
          Array.isArray(
            config?.statuses
          )
            ? config.statuses.map(
              (value) =>
                String(
                  value || ""
                )
                  .trim()
                  .toUpperCase()
            )
            : [];

        const filtered =
          statuses.length === 0
            ? sourceRows
            : sourceRows.filter(
              (row) =>
                statuses.includes(
                  String(
                    row?.status ||
                    row?.movementType ||
                    ""
                  )
                    .trim()
                    .toUpperCase()
                )
            );

        setRows(filtered);
        setPage(0);
      } catch (loadError) {
        console.error(
          loadError
        );

        setRows([]);
        setPage(0);
        setError(
          loadError?.message ||
          "Unable to load exact records for this metric."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      open,
      config?.type,
      config?.statuses,
      fromDate,
      fromTime,
      toDate,
      toTime,
      search,
    ]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    loadRows({
      search:
        String(
          config?.search ||
          ""
        ),
      fromDate: "",
      fromTime: "",
      toDate: "",
      toTime: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    config?.key,
  ]);

  if (!open) return null;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        pageSize
      )
    );

  const safePage =
    Math.min(
      page,
      totalPages - 1
    );

  const pageRows =
    rows.slice(
      safePage * pageSize,
      safePage * pageSize +
      pageSize
    );

  const accent =
    config?.accent ||
    "#60a5fa";

  return (
    <div
      style={dashboardDrillOverlay}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <style>{`
        .dashboard-drill-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .dashboard-drill-scroll::-webkit-scrollbar-track {
          background: rgba(15,23,42,.92);
          border-radius: 999px;
        }
        .dashboard-drill-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg,#2563eb,#60a5fa);
          border-radius: 999px;
          border: 2px solid rgba(15,23,42,.95);
        }
        .dashboard-drill-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg,#3b82f6,#93c5fd);
        }
      `}</style>

      <div style={dashboardDrillModal}>
        <div
          style={
            dashboardDrillHeader(
              accent
            )
          }
        >
          <div>
            <div style={dashboardDrillEyebrow}>
              EXACT RECORD ANALYSIS
            </div>

            <div style={dashboardDrillTitle}>
              {config?.title ||
                "Metric Details"}
            </div>

            <div style={dashboardDrillSubtitle}>
              {config?.subtitle ||
                "Pinpoint the exact records contributing to this dashboard metric."}
            </div>
          </div>

          <div style={dashboardDrillHeaderRight}>
            <div
              style={
                dashboardDrillCount(
                  accent
                )
              }
            >
              {rows.length} records
            </div>

            <button
              type="button"
              onClick={onClose}
              style={dashboardRecordClose}
            >
              ×
            </button>
          </div>
        </div>

        <div style={dashboardDrillFilters}>
          <label style={dashboardDrillField}>
            <span>Search</span>
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  loadRows();
                }
              }}
              placeholder={
                config?.searchPlaceholder ||
                "Item, packet, PD, sticker, challan, client, user..."
              }
              style={dashboardDrillInput}
            />
          </label>

          <label style={dashboardDrillField}>
            <span>From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value
                )
              }
              style={dashboardDrillInput}
            />
          </label>

          <label style={dashboardDrillField}>
            <span>From Time</span>
            <input
              type="time"
              value={fromTime}
              onChange={(event) =>
                setFromTime(
                  event.target.value
                )
              }
              style={dashboardDrillInput}
            />
          </label>

          <label style={dashboardDrillField}>
            <span>To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value
                )
              }
              style={dashboardDrillInput}
            />
          </label>

          <label style={dashboardDrillField}>
            <span>To Time</span>
            <input
              type="time"
              value={toTime}
              onChange={(event) =>
                setToTime(
                  event.target.value
                )
              }
              style={dashboardDrillInput}
            />
          </label>

          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            style={
              dashboardDrillApply(
                accent
              )
            }
          >
            {loading
              ? "Loading..."
              : "Apply"}
          </button>
        </div>

        {error && (
          <div style={dashboardDrillError}>
            {error}
          </div>
        )}

        <div
          style={dashboardDrillTableWrap}
          className="dashboard-drill-scroll"
        >
          <table style={dashboardDrillTable}>
            <thead>
              <tr>
                <th style={dashboardDrillTh}>
                  Flow
                </th>
                <th style={dashboardDrillTh}>
                  Item / Packet
                </th>
                <th style={dashboardDrillTh}>
                  Client
                </th>
                <th style={dashboardDrillTh}>
                  PD / DWG
                </th>
                <th style={dashboardDrillTh}>
                  Sticker
                </th>
                <th style={dashboardDrillTh}>
                  Challan
                </th>
                <th style={dashboardDrillTh}>
                  Status
                </th>
                <th style={dashboardDrillTh}>
                  Actors
                </th>
                <th style={dashboardDrillTh}>
                  Date / Time
                </th>
                <th style={dashboardDrillTh}>
                  Location / Vehicle
                </th>
                <th style={dashboardDrillTh}>
                  Exception
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={11}
                    style={
                      dashboardDrillEmpty
                    }
                  >
                    Loading exact records...
                  </td>
                </tr>
              )}

              {!loading &&
                pageRows.length ===
                0 && (
                  <tr>
                    <td
                      colSpan={11}
                      style={
                        dashboardDrillEmpty
                      }
                    >
                      No exact records matched the current metric filters.
                    </td>
                  </tr>
                )}

              {!loading &&
                pageRows.map(
                  (row, index) => (
                    <tr
                      key={
                        row.packetItemId ||
                        row.masterItemId ||
                        row.challanNumber ||
                        row.stickerNumber ||
                        row.id ||
                        index
                      }
                      onClick={() =>
                        setSelectedRow(
                          row
                        )
                      }
                      style={
                        dashboardDrillRow
                      }
                    >
                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.sourceType
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTdStrong
                        }
                      >
                        {dashboardSafeText(
                          row.itemName ||
                          row.masterItemName
                        )}
                        <div
                          style={
                            dashboardDrillSub
                          }
                        >
                          Packet:{" "}
                          {dashboardSafeText(
                            row.packetNumber
                          )}
                        </div>
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.clientName
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        PD{" "}
                        {dashboardSafeText(
                          row.pdNo
                        )}
                        <div
                          style={
                            dashboardDrillSub
                          }
                        >
                          DWG{" "}
                          {dashboardSafeText(
                            row.drawingNo
                          )}
                        </div>
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.stickerNumber
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.challanNumber ||
                          row.chalaanNumber
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.status ||
                          row.movementType
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        <div>
                          C:{" "}
                          {dashboardSafeText(
                            dashboardTraceCreatedBy(
                              row
                            )
                          )}
                        </div>

                        {(
                          row.packedBy ||
                          row.packedAt ||
                          row.stickerNumber
                        ) && (
                            <div
                              style={
                                dashboardDrillSub
                              }
                            >
                              P:{" "}
                              {dashboardSafeText(
                                dashboardTracePackedBy(
                                  row
                                )
                              )}
                            </div>
                          )}

                        {(
                          row.dispatchedBy ||
                          row.dispatchedAt ||
                          row.challanNumber
                        ) && (
                            <div
                              style={
                                dashboardDrillSub
                              }
                            >
                              D:{" "}
                              {dashboardSafeText(
                                dashboardTraceDispatchedBy(
                                  row
                                )
                              )}
                            </div>
                          )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardFormatDateTime(
                          dashboardTraceActionDate(
                            row
                          )
                        )}
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {dashboardSafeText(
                          row.currentLocationCode ||
                          row.warehouseCode ||
                          row.plantCode
                        )}
                        <div
                          style={
                            dashboardDrillSub
                          }
                        >
                          {dashboardSafeText(
                            row.vehicleNumber
                          )}
                        </div>
                      </td>

                      <td
                        style={
                          dashboardDrillTd
                        }
                      >
                        {row.exceptionReason ? (
                          <span
                            style={
                              dashboardException
                            }
                          >
                            {row.exceptionReason}
                          </span>
                        ) : (
                          <span
                            style={
                              dashboardClear
                            }
                          >
                            Clear
                          </span>
                        )}
                        <div
                          style={
                            dashboardOpenHint
                          }
                        >
                          Open ↗
                        </div>
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>

        <div style={dashboardDrillPager}>
          <div style={dashboardDrillPagerMeta}>
            {rows.length > 0
              ? `Showing ${safePage *
              pageSize +
              1
              }–${Math.min(
                (safePage + 1) *
                pageSize,
                rows.length
              )} of ${rows.length}`
              : "No rows"}
          </div>

          <div style={dashboardDrillPagerControls}>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(
                  Number(
                    event.target.value
                  ) || 20
                );
                setPage(0);
              }}
              style={dashboardDrillPageSize}
            >
              {DASHBOARD_DRILLDOWN_PAGE_SIZES.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value} / page
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={() =>
                setPage(0)
              }
              disabled={
                safePage === 0
              }
              style={dashboardDrillPageButton(
                safePage === 0
              )}
            >
              «
            </button>

            <button
              type="button"
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      0,
                      current - 1
                    )
                )
              }
              disabled={
                safePage === 0
              }
              style={dashboardDrillPageButton(
                safePage === 0
              )}
            >
              ‹
            </button>

            <div
              style={
                dashboardDrillPageIndicator
              }
            >
              {safePage + 1} /{" "}
              {totalPages}
            </div>

            <button
              type="button"
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages - 1,
                      current + 1
                    )
                )
              }
              disabled={
                safePage >=
                totalPages - 1
              }
              style={dashboardDrillPageButton(
                safePage >=
                totalPages - 1
              )}
            >
              ›
            </button>

            <button
              type="button"
              onClick={() =>
                setPage(
                  totalPages - 1
                )
              }
              disabled={
                safePage >=
                totalPages - 1
              }
              style={dashboardDrillPageButton(
                safePage >=
                totalPages - 1
              )}
            >
              »
            </button>
          </div>
        </div>
      </div>

      <DashboardRecordDetailModal
        row={selectedRow}
        title={config?.title}
        onClose={() =>
          setSelectedRow(null)
        }
      />
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] =
    useState(() => {
      const cached =
        readDashboardCache();

      return (
        cached?.stats ||
        emptyDashboardStats
      );
    });

  const [activityLogs, setActivityLogs] =
    useState(() => {
      const cached =
        readDashboardCache();

      return Array.isArray(
        cached?.activityLogs
      )
        ? cached.activityLogs
        : [];
    });
  const [chartType, setChartType] = useState("donut");

  const [
    dashboardRefreshing,
    setDashboardRefreshing,
  ] = useState(false);

  const [
    lastDashboardRefresh,
    setLastDashboardRefresh,
  ] = useState(() => {
    const cached =
      readDashboardCache();

    return cached?.cachedAt
      ? new Date(
        cached.cachedAt
      )
      : null;
  });
  const [mode, setMode] = useState("inventory");
  const [inventorySection, setInventorySection] =
    useState("summary");

  const [activeStatCard, setActiveStatCard] = useState(null);

  const [statDrilldown, setStatDrilldown] =
    useState({
      open: false,
      key: "",
      title: "",
      subtitle: "",
      type: "all",
      statuses: [],
      search: "",
      accent: "#60a5fa",
    });

  const [throughputModal, setThroughputModal] = useState({
    open: false,
    type: null,
    title: "",
    rows: [],
    loading: false,
    error: "",
  });

  const [
    masterItemsRefreshKey,
    setMasterItemsRefreshKey,
  ] = useState(0);

  const [
    adminCenterOpen,
    setAdminCenterOpen,
  ] = useState(false);

  const [masterItemsModalOpen, setMasterItemsModalOpen] =
    useState(false);

  const {
    user,
    hasRole,
    hasAnyRole,
  } = useAuth();

  const isAdmin =
    hasRole("ADMIN");

  const isPacking =
    hasRole("PACKING");

  const isDispatch =
    hasRole("DISPATCH");

  const isWarehouse =
    hasRole("WAREHOUSE");

  const isLogistics =
    hasRole("LOGISTICS");

  const isHardwareOnly =
    hasRole("HARDWARE_PACKING") &&
    !hasAnyRole(
      "ADMIN",
      "PACKING",
      "WAREHOUSE",
      "DISPATCH",
      "LOGISTICS"
    );

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

  const warehouseShare =
    finalInventoryTotal === 0
      ? 0
      : (
        Number(stats.warehouseItems || 0) /
        finalInventoryTotal
      ) * 100;

  const readyToDispatchShare =
    finalInventoryTotal === 0
      ? 0
      : (
        Number(
          stats.readyToDispatchItems ||
          0
        ) /
        finalInventoryTotal
      ) * 100;

  const readyShare =
    finalInventoryTotal === 0
      ? 0
      : (
        Number(stats.readyItems || 0) /
        finalInventoryTotal
      ) * 100;

  const masterCompletionRate =
    Number(stats.masterItems || 0) ===
      0
      ? 0
      : (
        Number(
          stats.fullyPackedMasterItems ||
          0
        ) /
        Number(stats.masterItems || 0)
      ) * 100;

  const tripCloseRate =
    Number(stats.runningTrips || 0) +
      Number(stats.endedTrips || 0) ===
      0
      ? 100
      : (
        Number(stats.endedTrips || 0) /
        (
          Number(stats.runningTrips || 0) +
          Number(stats.endedTrips || 0)
        )
      ) * 100;

  const activitySignals =
    activityLogs.reduce(
      (result, activity) => {
        const text =
          getActivityText(activity);

        if (
          text.includes("PACK") ||
          text.includes("STICKER")
        ) {
          result.packing += 1;
        }

        if (
          text.includes("DISPATCH") ||
          text.includes("CHALLAN")
        ) {
          result.dispatch += 1;
        }

        if (
          text.includes("WAREHOUSE") ||
          text.includes("FG") ||
          text.includes("MOVE") ||
          text.includes("TRANSFER")
        ) {
          result.movement += 1;
        }

        return result;
      },
      {
        packing: 0,
        dispatch: 0,
        movement: 0,
      }
    );

  const latestActivityAt =
    activityLogs.length > 0
      ? getActivityTimestamp(
        activityLogs[0]
      )
      : null;

  const dataHealthLabel =
    currentInventoryExceptions === 0
      ? "Healthy"
      : currentInventoryExceptions <= 5
        ? "Monitor"
        : "Attention";

  const dataHealthAccent =
    currentInventoryExceptions === 0
      ? "#22c55e"
      : currentInventoryExceptions <= 5
        ? "#f59e0b"
        : "#ef4444";

  const chartMeta = {
    donut: {
      eyebrow: "STOCK COMPOSITION",
      title: "Inventory Position",
      subtitle:
        "Share of live inventory across warehouse, dispatch-ready and ready stock.",
    },
    bar: {
      eyebrow: "STATUS COMPARISON",
      title: "Inventory Volume",
      subtitle:
        "Compare operational stock buckets side by side for faster management review.",
    },
    corporate: {
      eyebrow: "OPERATIONAL FLOW",
      title: "Inventory Flow",
      subtitle:
        "Management view of how current inventory is distributed through the active flow.",
    },
  }[chartType];

  const loadInventoryDashboard =
    useCallback(
      async ({
        showRefreshing = false,
      } = {}) => {
        if (showRefreshing) {
          setDashboardRefreshing(
            true
          );
        }

        /*
         * Start both requests together, but update each section
         * independently as soon as its own API returns.
         *
         * Previously the dashboard waited for BOTH API calls before
         * painting either result.
         */
        const statsTask =
          requestDashboardStatsFast()
            .then((data) => {
              if (!data) return;

              const normalized =
                normalizeStats(
                  data
                );

              setStats(
                normalized
              );

              writeDashboardCache({
                stats:
                  normalized,
              });
            })
            .catch((error) => {
              console.error(
                error
              );
            });

        const activityTask =
          requestDashboardActivityFast()
            .then((data) => {
              const rows =
                Array.isArray(data)
                  ? data
                  : [];

              setActivityLogs(
                rows
              );

              writeDashboardCache({
                activityLogs:
                  rows,
              });
            })
            .catch((error) => {
              console.error(
                error
              );

              /*
               * Keep cached/current activity visible on a temporary
               * network failure instead of blanking the panel.
               */
            });

        await Promise.allSettled([
          statsTask,
          activityTask,
        ]);

        const refreshedAt =
          new Date();

        setLastDashboardRefresh(
          refreshedAt
        );

        if (showRefreshing) {
          setDashboardRefreshing(
            false
          );
        }
      },
      []
    );

  const refreshInventoryDashboard =
    useCallback(
      () =>
        loadInventoryDashboard({
          showRefreshing: true,
        }),
      [
        loadInventoryDashboard,
      ]
    );

  const handleAdminCenterChanged =
    useCallback(
      async (result) => {
        await refreshInventoryDashboard();

        setMasterItemsRefreshKey(
          (current) => current + 1
        );

        window.dispatchEvent(
          new CustomEvent(
            "packflow:admin-record-changed",
            {
              detail: {
                source:
                  "ADMIN_CENTER",

                targetType:
                  result?.targetType,

                targetId:
                  result?.targetId,

                displayName:
                  result?.displayName,

                deletionAuditId:
                  result?.deletionAuditId,

                deletedRows:
                  result?.deletedRows,
              },
            }
          )
        );
      },
      [refreshInventoryDashboard]
    );

  useEffect(() => {
    /*
     * Cached data is already on screen from the useState initializers.
     * Revalidate immediately in the background without forcing the
     * dashboard into a visible loading state.
     */
    loadInventoryDashboard({
      showRefreshing: false,
    });
  }, [
    loadInventoryDashboard,
  ]);

  const toggleStatCard = (key) => {
    setActiveStatCard((current) =>
      current === key ? null : key
    );
  };

  const openStatDrilldown = (config = {}) => {
    setStatDrilldown({
      open: true,
      key:
        config.key ||
        `${config.type || "all"}-${config.title || "metric"}-${Date.now()}`,
      title:
        config.title ||
        "Metric Details",
      subtitle:
        config.subtitle ||
        "Pinpoint the exact records contributing to this metric.",
      type:
        config.type ||
        "all",
      statuses:
        Array.isArray(config.statuses)
          ? config.statuses
          : [],
      search:
        config.search ||
        "",
      accent:
        config.accent ||
        "#60a5fa",
      searchPlaceholder:
        config.searchPlaceholder ||
        "Item, packet, PD, sticker, challan, client, user...",
    });
  };

  const closeStatDrilldown = () => {
    setStatDrilldown((current) => ({
      ...current,
      open: false,
    }));
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
      progress: packetCompletionRate,
      progressLabel: "Packing completion",
      active: activeStatCard === "inventoryItems",
      onClick: () => toggleStatCard("inventoryItems"),
    },
    isAdmin && {
      key: "adminCenter",
      icon: "🛡️",
      accent: "#ef4444",
      title: "Admin Center",
      value: "ADMIN",
      subtle: "Lifecycle correction and permanent deletion",
      trend: "Restricted",
      trendLabel: "Move back, review impact or delete",
      active: adminCenterOpen,
      onClick: () => setAdminCenterOpen(true),
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
      progress: masterCompletionRate,
      progressLabel: "Fully packed masters",
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
      progress: packetCompletionRate,
      progressLabel: "Sticker completion",
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
      progress: packetCompletionRate,
      progressLabel: "Packet items stickered",
      active: statDrilldown.open && statDrilldown.key === "stickers",
      onClick: () =>
        openStatDrilldown({
          key: "stickers",
          title: "Sticker Generation Records",
          subtitle: "Exact packet items and sticker records contributing to the sticker metric.",
          type: "generated",
          accent: "#f472b6",
        }),
    },

    {
      key: "packed",
      icon: "✅",
      accent: "#34d399",
      title: "Packed Items",
      value: Number(stats.packedItems || 0),
      subtle: "Sticker / packed packet items",
      trend: percentLabel(packetCompletionRate),
      progress: packetCompletionRate,
      progressLabel: "Packing completion",
      active: statDrilldown.open && statDrilldown.key === "packed",
      onClick: () =>
        openStatDrilldown({
          key: "packed",
          title: "Packed Item Records",
          subtitle: "Exact packed packet items with packing users, timestamps and sticker references.",
          type: "packed",
          accent: "#34d399",
        }),
    },

    {
      key: "pending",
      icon: "⏳",
      accent: "#f59e0b",
      title: "Pending Items",
      value: pending,
      subtle: "Packet items pending sticker",
      trend: `${Number(stats.packetItemsPendingSticker || 0)} pending`,
      progress:
        Number(stats.packetItems || 0) === 0
          ? 0
          : (
            Number(stats.pendingItems || 0) /
            Number(stats.packetItems || 0)
          ) * 100,
      progressLabel: "Pending share",
      active: statDrilldown.open && statDrilldown.key === "pending",
      onClick: () =>
        openStatDrilldown({
          key: "pending",
          title: "Pending Item Records",
          subtitle: "Exact packet items still awaiting packing / sticker completion.",
          type: "pending",
          accent: "#f59e0b",
        }),
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
      progress: readyToDispatchShare,
      progressLabel: "Share of live inventory",
      active: statDrilldown.open && statDrilldown.key === "readyToDispatch",
      onClick: () =>
        openStatDrilldown({
          key: "readyToDispatch",
          title: "Ready to Dispatch Queue",
          subtitle: "Exact items currently waiting for dispatch action.",
          type: "all",
          statuses: ["READY_TO_DISPATCH"],
          accent: "#ef4444",
        }),
    },

    {
      key: "accuracy",
      icon: "🎯",
      accent: "#22c55e",
      title: "Inventory Accuracy",
      value: percentLabel(inventoryAccuracy),
      subtle: "Based on current exceptions",
      trend: `${currentInventoryExceptions} issues`,
      progress: inventoryAccuracy,
      progressLabel: "Data health",
      active: statDrilldown.open && statDrilldown.key === "accuracy",
      onClick: () =>
        openStatDrilldown({
          key: "accuracy",
          title: "Inventory Accuracy Exceptions",
          subtitle: "Exact linked records reducing the inventory accuracy score.",
          type: "errored",
          accent: "#22c55e",
        }),
    },

    {
      key: "challans",
      icon: "📄",
      accent: "#8b5cf6",
      title: "Dispatch Challans",
      value: Number(stats.normalDispatchChallans || 0),
      subtle: `${Number(stats.runningTrips || 0)} running trips`,
      trend: `${Number(stats.todayDispatchChallans || 0)} today`,
      progress: tripCloseRate,
      progressLabel: "Trip closure",
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
      progress: operationalEfficiency,
      progressLabel: "Dispatch conversion",
      active: statDrilldown.open && statDrilldown.key === "efficiency",
      onClick: () =>
        openStatDrilldown({
          key: "efficiency",
          title: "Dispatch Conversion Records",
          subtitle: "Exact dispatched records behind the operational efficiency metric.",
          type: "dispatched",
          accent: "#14b8a6",
        }),
    },
  ].filter(Boolean);

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
                  <div style={inventorySectionHeader}>
                    <div>
                      <div style={inventorySectionEyebrow}>
                        LIVE MANAGEMENT METRICS
                      </div>
                      <div style={inventorySectionTitle}>
                        Inventory KPIs
                      </div>
                    </div>

                    <div style={inventorySectionCount}>
                      {summaryKpis.length} live metrics
                    </div>
                  </div>

                  <div style={kpiGrid}>
                    {summaryKpis.map((card) => (
                      <InventoryStatCard
                        key={card.key}
                        icon={card.icon}
                        accent={card.accent}
                        title={card.title}
                        value={card.value}
                        subtle={card.subtle}
                        trend={card.trend}
                        trendLabel={card.trendLabel}
                        progress={card.progress}
                        progressLabel={card.progressLabel}
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

                        <div style={detailHeaderActions}>
                          <button
                            type="button"
                            onClick={() =>
                              openStatDrilldown({
                                key: "dailyThroughput",
                                title: "Today’s Throughput Records",
                                subtitle: "Exact packing and dispatch activity behind today’s throughput.",
                                type: "all",
                                accent: "#06b6d4",
                              })
                            }
                            style={detailInspectButton("#06b6d4")}
                          >
                            Inspect exact records ↗
                          </button>

                          <div style={detailTotalBox}>
                            <span>Total Today</span>
                            <strong>{dailyThroughput}</strong>
                          </div>
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
                      onInspect={() =>
                        openStatDrilldown({
                          key: "inventoryItems",
                          title: "Inventory Item Records",
                          subtitle: "Exact live inventory rows across warehouse, ready-to-dispatch and ready stock.",
                          type: "all",
                          accent: "#60a5fa",
                        })
                      }
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
                      onInspect={() =>
                        openStatDrilldown({
                          key: "packetItems",
                          title: "Packet Item Records",
                          subtitle: "Exact packet-level rows with sticker, client, PD, location and lifecycle actor details.",
                          type: "all",
                          accent: "#38bdf8",
                        })
                      }
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
                      onInspect={() =>
                        openStatDrilldown({
                          key: "challans",
                          title: "Dispatch Challan Records",
                          subtitle: "Exact challaned records including driver, vehicle, trip status and dispatch users.",
                          type: "challaned",
                          accent: "#8b5cf6",
                        })
                      }
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
                      onInspect={() =>
                        openStatDrilldown({
                          key: "customChallans",
                          title: "Custom Challan Records",
                          subtitle: "Exact manual movement challan records and related user/date information.",
                          type: "custom",
                          accent: "#ec4899",
                        })
                      }
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
                      onInspect={() =>
                        openStatDrilldown({
                          key: "exceptions",
                          title: "Data Exception Records",
                          subtitle: "Pinpoint exact packet, sticker, dispatch and master-link exceptions requiring correction.",
                          type: "errored",
                          accent: "#f97316",
                        })
                      }
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
                          <div style={inventorySectionEyebrow}>
                            {chartMeta.eyebrow}
                          </div>

                          <div style={chartPanelTitle}>
                            {chartMeta.title}
                          </div>

                          <div style={chartPanelSubtitle}>
                            {chartMeta.subtitle}
                          </div>
                        </div>

                        <div style={chartToggleWrap}>
                          <button
                            type="button"
                            style={chartModeBtn(
                              chartType === "donut"
                            )}
                            onClick={() =>
                              setChartType("donut")
                            }
                          >
                            <DonutIcon />
                            <span>Composition</span>
                          </button>

                          <button
                            type="button"
                            style={chartModeBtn(
                              chartType === "bar"
                            )}
                            onClick={() =>
                              setChartType("bar")
                            }
                          >
                            <BarIcon />
                            <span>Volume</span>
                          </button>

                          <button
                            type="button"
                            style={chartModeBtn(
                              chartType === "corporate"
                            )}
                            onClick={() =>
                              setChartType(
                                "corporate"
                              )
                            }
                          >
                            <CorporateIcon />
                            <span>Flow</span>
                          </button>
                        </div>
                      </div>

                      <div style={chartStatusStrip}>
                        <ChartStatusMetric
                          label="Warehouse"
                          value={Number(
                            stats.warehouseItems || 0
                          )}
                          share={warehouseShare}
                          accent="#38bdf8"
                          icon="🏢"
                        />

                        <ChartStatusMetric
                          label="Ready to Dispatch"
                          value={Number(
                            stats.readyToDispatchItems ||
                            0
                          )}
                          share={readyToDispatchShare}
                          accent="#f97316"
                          icon="🚚"
                        />

                        <ChartStatusMetric
                          label="Ready"
                          value={Number(
                            stats.readyItems || 0
                          )}
                          share={readyShare}
                          accent="#22c55e"
                          icon="✓"
                        />
                      </div>

                      <div style={chartPanelBody}>
                        {chartType === "donut" && (
                          <StatusDonutChart
                            warehouse={
                              stats.warehouseItems
                            }
                            readyToDispatch={
                              stats.readyToDispatchItems
                            }
                            ready={
                              stats.readyItems
                            }
                          />
                        )}

                        {chartType === "bar" && (
                          <StatusBarChart
                            warehouse={
                              stats.warehouseItems
                            }
                            readyToDispatch={
                              stats.readyToDispatchItems
                            }
                            ready={
                              stats.readyItems
                            }
                          />
                        )}

                        {chartType ===
                          "corporate" && (
                            <StatusCorporateChart
                              warehouse={
                                stats.warehouseItems
                              }
                              readyToDispatch={
                                stats.readyToDispatchItems
                              }
                              ready={
                                stats.readyItems
                              }
                            />
                          )}
                      </div>

                      <div style={chartInsightFooter}>
                        <div style={chartInsightItem}>
                          <span style={chartInsightDot("#60a5fa")} />
                          <span>
                            <strong>{finalInventoryTotal}</strong>{" "}
                            tracked inventory items
                          </span>
                        </div>

                        <div style={chartInsightItem}>
                          <span style={chartInsightDot("#f97316")} />
                          <span>
                            <strong>
                              {Math.round(
                                readyToDispatchShare
                              )}
                              %
                            </strong>{" "}
                            currently dispatch-ready
                          </span>
                        </div>

                        <div style={chartInsightItem}>
                          <span style={chartInsightDot("#22c55e")} />
                          <span>
                            <strong>
                              {percentLabel(
                                packetCompletionRate
                              )}
                            </strong>{" "}
                            packing completion
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={activityPanelSurface}>
                      <div style={activityPanelHeader}>
                        <div>
                          <div style={inventorySectionEyebrow}>
                            LIVE EVENT STREAM
                          </div>

                          <div style={activityPanelTitle}>
                            Recent Activity
                          </div>

                          <div style={activityPanelSubtitle}>
                            Latest packing, dispatch and inventory movement events.
                          </div>
                        </div>

                        <div style={activityHeaderActions}>
                          <div style={activityLiveBadge}>
                            <span style={activityLivePulse} />
                            LIVE
                          </div>

                          <button
                            type="button"
                            style={activityRefreshBtn}
                            onClick={
                              refreshInventoryDashboard
                            }
                            disabled={
                              dashboardRefreshing
                            }
                          >
                            {dashboardRefreshing
                              ? "Refreshing…"
                              : "↻ Refresh"}
                          </button>
                        </div>
                      </div>

                      <div style={activitySignalsRow}>
                        <ActivitySignal
                          label="Events"
                          value={
                            activityLogs.length
                          }
                          accent="#60a5fa"
                        />

                        <ActivitySignal
                          label="Packing"
                          value={
                            activitySignals.packing
                          }
                          accent="#22c55e"
                        />

                        <ActivitySignal
                          label="Dispatch"
                          value={
                            activitySignals.dispatch
                          }
                          accent="#f97316"
                        />

                        <ActivitySignal
                          label="Movement"
                          value={
                            activitySignals.movement
                          }
                          accent="#a78bfa"
                        />
                      </div>

                      <div style={activityLatestMeta}>
                        <span>
                          Latest event:{" "}
                          <strong>
                            {formatActivityRefreshTime(
                              latestActivityAt
                            )}
                          </strong>
                        </span>

                        <span>
                          Showing latest{" "}
                          <strong>
                            {activityLogs.length}
                          </strong>{" "}
                          records
                        </span>
                      </div>

                      <div style={activityFeedShell}>
                        <ActivityFeed
                          logs={activityLogs}
                          onInspectRecord={
                            openStatDrilldown
                          }
                        />
                      </div>
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
            StatCard={StatCard}
          />
        )}

      </div>
      <ThroughputUserModal
        open={throughputModal.open}
        title={throughputModal.title}
        rows={throughputModal.rows}
        loading={throughputModal.loading}
        error={throughputModal.error}
        onClose={closeThroughputUserModal}
      />

      <StatDrilldownModal
        open={statDrilldown.open}
        config={statDrilldown}
        onClose={closeStatDrilldown}
      />

      <MasterItemsModal
        key={masterItemsRefreshKey}
        open={masterItemsModalOpen}
        onClose={() =>
          setMasterItemsModalOpen(false)
        }
      />

      <AdminCenter
        open={adminCenterOpen}
        onClose={() => setAdminCenterOpen(false)}
        onChanged={handleAdminCenterChanged}
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
  fontSize: 15,
  color: "#d6e0ee",
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
    "repeat(auto-fit,minmax(215px,1fr))",
  gap: 13,
};

const inventoryPulsePanel = {
  position: "relative",
  overflow: "hidden",
  padding: 18,
  borderRadius: 24,
  background:
    "radial-gradient(circle at 0% 0%,rgba(59,130,246,.16),transparent 30%), radial-gradient(circle at 100% 100%,rgba(14,165,233,.09),transparent 28%), linear-gradient(135deg,rgba(15,23,42,.96),rgba(8,15,30,.92))",
  border:
    "1px solid rgba(148,163,184,.10)",
  boxShadow:
    "0 20px 48px rgba(2,6,23,.30), inset 0 1px 0 rgba(255,255,255,.025)",
};

const inventoryPulseHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 14,
};

const inventorySectionEyebrow = {
  color: "#93c5fd",
  fontSize: 10.5,
  fontWeight: 950,
  letterSpacing: ".13em",
  textTransform: "uppercase",
};

const inventoryPulseTitle = {
  marginTop: 4,
  color: "#f8fafc",
  fontSize: 21,
  fontWeight: 950,
  letterSpacing: "-.025em",
};

const inventoryPulseSubtitle = {
  maxWidth: 720,
  marginTop: 5,
  color: "#94a3b8",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.55,
};

const inventoryPulseHeaderRight = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const inventoryHealthBadge = (accent) => ({
  minHeight: 29,
  padding: "0 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#e2e8f0",
  background: `${accent}14`,
  border: `1px solid ${accent}35`,
  fontSize: 9.5,
  fontWeight: 900,
});

const inventoryHealthDot = (accent) => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: accent,
  boxShadow: `0 0 10px ${accent}80`,
});

const inventoryRefreshMeta = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 750,
};

const inventoryPulseGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(175px,1fr))",
  gap: 9,
};

const inventoryPulseMetric = (accent) => ({
  minWidth: 0,
  minHeight: 105,
  padding: 12,
  borderRadius: 15,
  background:
    `radial-gradient(circle at 100% 0%,${accent}16,transparent 42%), rgba(2,6,23,.34)`,
  border: `1px solid ${accent}20`,
});

const inventoryPulseMetricTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const inventoryPulseMetricLabel = {
  color: "#94a3b8",
  fontSize: 8.8,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".065em",
};

const inventoryPulseDot = (accent) => ({
  width: 7,
  height: 7,
  flexShrink: 0,
  borderRadius: "50%",
  background: accent,
  boxShadow: `0 0 9px ${accent}66`,
});

const inventoryPulseMetricValue = {
  marginTop: 7,
  color: "#fff",
  fontSize: 24,
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: "-.025em",
};

const inventoryPulseMetricDetail = {
  minHeight: 27,
  marginTop: 6,
  color: "#64748b",
  fontSize: 9.3,
  fontWeight: 700,
  lineHeight: 1.4,
};

const inventoryPulseTrack = {
  height: 3,
  marginTop: 8,
  overflow: "hidden",
  borderRadius: 999,
  background:
    "rgba(148,163,184,.10)",
};

const inventoryPulseFill = (
  accent,
  progress
) => ({
  width: `${Math.max(
    0,
    Math.min(
      100,
      Number(progress || 0)
    )
  )}%`,
  height: "100%",
  borderRadius: 999,
  background:
    `linear-gradient(90deg,${accent}A8,${accent})`,
  boxShadow:
    `0 0 9px ${accent}60`,
});

const inventorySectionHeader = {
  marginTop: 4,
  marginBottom: 2,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
};

const inventorySectionTitle = {
  marginTop: 3,
  color: "#ffffff",
  fontSize: 29,
  fontWeight: 950,
  lineHeight: 1.2,
};

const inventorySectionCount = {
  padding: "6px 9px",
  borderRadius: 999,
  color: "#dbeafe",
  background:
    "rgba(148,163,184,.06)",
  border:
    "1px solid rgba(148,163,184,.09)",
  fontSize: 9,
  fontWeight: 850,
};

const inventoryStatCard = (
  accent,
  clickable = false,
  active = false
) => ({
  position: "relative",
  minWidth: 0,
  minHeight: 172,
  overflow: "hidden",
  padding: 14,
  borderRadius: 18,
  textAlign: "left",
  width: "100%",
  color: "#fff",
  fontFamily: "inherit",
  cursor: clickable
    ? "pointer"
    : "default",

  background: active
    ? `linear-gradient(160deg,${accent}16,rgba(15,23,42,.96) 44%,rgba(8,15,30,.94))`
    : "linear-gradient(160deg,rgba(30,41,59,.72),rgba(15,23,42,.90) 48%,rgba(8,15,30,.90))",

  border: active
    ? `1px solid ${accent}55`
    : "1px solid rgba(148,163,184,.09)",

  boxShadow: active
    ? `0 18px 38px ${accent}1D, inset 0 1px 0 rgba(255,255,255,.035)`
    : "0 12px 28px rgba(2,6,23,.22), inset 0 1px 0 rgba(255,255,255,.018)",

  backdropFilter: "blur(18px)",

  transition:
    "transform .18s ease,border-color .18s ease,box-shadow .18s ease",
});

const inventoryCardAmbient = (accent) => ({
  position: "absolute",
  width: 130,
  height: 130,
  top: -70,
  right: -48,
  borderRadius: "50%",
  background: accent,
  opacity: 0.08,
  filter: "blur(28px)",
  pointerEvents: "none",
});

const inventoryCardTopLine = (accent) => ({
  position: "absolute",
  top: 0,
  left: 18,
  right: 18,
  height: 2,
  borderRadius:
    "0 0 999px 999px",
  background:
    `linear-gradient(90deg,transparent,${accent},transparent)`,
  opacity: 0.85,
});

const inventoryStatTopRow = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const inventoryStatIdentity = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const inventoryStatIcon = (accent) => ({
  width: 31,
  height: 31,
  flexShrink: 0,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  color: "#fff",
  background: `${accent}17`,
  border: `1px solid ${accent}2E`,
  fontSize: 14,
  boxShadow:
    `inset 0 1px 0 ${accent}18`,
});

const inventoryStatTitle = {
  minWidth: 0,
  color: "#f1f5f9",
  fontSize: 10.4,
  fontWeight: 950,
  letterSpacing: ".055em",
  textTransform: "uppercase",
  lineHeight: 1.3,
};

const inventoryTrendPill = (accent) => ({
  flexShrink: 0,
  maxWidth: 92,
  minHeight: 23,
  padding: "0 7px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: accent,
  background: `${accent}12`,
  border: `1px solid ${accent}29`,
  fontSize: 9.2,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const inventoryStatValueRow = {
  position: "relative",
  zIndex: 1,
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const inventoryStatValue = {
  color: "#fff",
  fontSize: 29,
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: "-.035em",
};

const inventoryOpenIndicator = (active) => ({
  width: 27,
  height: 27,
  flexShrink: 0,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  color: active
    ? "#bfdbfe"
    : "#64748b",
  background: active
    ? "rgba(59,130,246,.14)"
    : "rgba(148,163,184,.055)",
  border:
    "1px solid rgba(148,163,184,.08)",
  fontSize: 12,
  fontWeight: 950,
});

const inventoryStatSubtle = {
  position: "relative",
  zIndex: 1,
  minHeight: 29,
  marginTop: 6,
  color: "#bcc8d8",
  fontSize: 10.5,
  fontWeight: 700,
  lineHeight: 1.42,
};

const inventoryProgressWrap = {
  position: "relative",
  zIndex: 1,
  marginTop: 8,
};

const inventoryProgressMeta = {
  marginBottom: 5,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  color: "#aebdd0",
  fontSize: 9.4,
  fontWeight: 800,
};

const inventoryProgressTrack = {
  height: 4,
  overflow: "hidden",
  borderRadius: 999,
  background:
    "rgba(148,163,184,.10)",
};

const inventoryProgressFill = (
  accent,
  progress
) => ({
  width: `${progress}%`,
  height: "100%",
  borderRadius: 999,
  background:
    `linear-gradient(90deg,${accent}A6,${accent})`,
  boxShadow:
    `0 0 10px ${accent}55`,
});

const inventoryStatFooter = {
  position: "relative",
  zIndex: 1,
  marginTop: 10,
  paddingTop: 8,
  borderTop:
    "1px solid rgba(148,163,184,.065)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const inventoryTrendLabel = {
  minWidth: 0,
  color: "#9fb0c6",
  fontSize: 9.3,
  fontWeight: 750,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const inventoryAnalyzePill = (accent, active) => ({
  minHeight: 22,
  padding: "0 7px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  color: active ? "#fff" : accent,
  background: active
    ? `${accent}28`
    : `${accent}10`,
  border: `1px solid ${accent}2E`,
  fontSize: 7.4,
  fontWeight: 950,
  letterSpacing: ".04em",
});

const inventoryLiveDotWrap = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "#9fb0c6",
  fontSize: 8.5,
  fontWeight: 950,
  letterSpacing: ".055em",
};

const inventoryLiveDot = (accent) => ({
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: accent,
  boxShadow: `0 0 7px ${accent}66`,
});

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
  color: "rgba(255,255,255,.68)",
  fontSize: 11.2,
  fontWeight: 750,
};

const sectionTitle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#fff",
};

const sectionSubtitle = {
  fontSize: 14,
  marginTop: 4,
  color: "rgba(255,255,255,.82)",
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
  color: "rgba(255,255,255,.82)",
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
  fontSize: 11,
  fontWeight: 750,
  color: "rgba(255,255,255,.74)",
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
  fontSize: 13.5,
  color: "rgba(255,255,255,.78)",
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

  color: "rgba(255,255,255,.84)",

  fontSize: 12.5,
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

const detailHeaderActions = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const detailInspectButton = (accent) => ({
  height: 38,
  padding: "0 14px",
  borderRadius: 12,
  border: `1px solid ${accent}42`,
  background: `${accent}16`,
  color: "#fff",
  fontFamily: "inherit",
  fontSize: 10.5,
  fontWeight: 950,
  cursor: "pointer",
});

const detailItemButton = (
  accent,
  clickable
) => ({
  padding: 16,
  borderRadius: 18,
  background:
    "rgba(255,255,255,.04)",
  border: clickable
    ? `1px solid ${accent}36`
    : "1px solid rgba(255,255,255,.06)",
  color: "#fff",
  textAlign: "left",
  fontFamily: "inherit",
  cursor: clickable
    ? "pointer"
    : "default",
  opacity: 1,
});

const detailItemOpenHint = {
  marginTop: 9,
  color: "#93c5fd",
  fontSize: 10,
  fontWeight: 900,
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
  fontSize: 13.5,
  color: "rgba(255,255,255,.78)",
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
  fontSize: 12.5,
  fontWeight: 850,
  color: "rgba(255,255,255,.82)",
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
  fontSize: 12.3,
  color: "rgba(255,255,255,.72)",
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

  color: "rgba(255,255,255,.78)",

  fontSize: 13.5,
  fontWeight: 650,
  lineHeight: 1.5,
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

  color: "rgba(255,255,255,.92)",

  fontSize: 14,

  fontWeight: 650,

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
  fontSize: 12.3,
  fontWeight: 750,
  color: "rgba(255,255,255,.76)",
};

const throughputMiniHint = {
  marginTop: 12,
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,.72)",
};

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(360px,1fr))",
  gap: 14,
  alignItems: "stretch",
};

const chartPanelSurface = {
  position: "relative",
  minWidth: 0,
  height: 555,
  minHeight: 555,
  padding: 17,
  borderRadius: 24,
  background:
    "radial-gradient(circle at 0% 0%,rgba(37,99,235,.14),transparent 31%), radial-gradient(circle at 100% 100%,rgba(34,197,94,.05),transparent 28%), linear-gradient(180deg,rgba(15,23,42,.95),rgba(8,15,30,.93))",
  border:
    "1px solid rgba(148,163,184,.10)",
  boxShadow:
    "0 20px 48px rgba(2,6,23,.30), inset 0 1px 0 rgba(255,255,255,.025)",
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
  flexWrap: "wrap",
  marginBottom: 12,
};

const chartPanelTitle = {
  marginTop: 3,
  fontSize: 18,
  fontWeight: 950,
  color: "#f8fafc",
  letterSpacing: "-.025em",
};

const chartPanelSubtitle = {
  maxWidth: 560,
  marginTop: 4,
  fontSize: 11.5,
  color: "#c0cad8",
  fontWeight: 650,
  lineHeight: 1.5,
};

const chartToggleWrap = {
  display: "inline-flex",
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background:
    "rgba(2,6,23,.52)",
  border:
    "1px solid rgba(148,163,184,.09)",
};

const chartModeBtn = (active) => ({
  height: 31,
  padding: "0 9px",
  borderRadius: 8,
  border: active
    ? "1px solid rgba(96,165,250,.26)"
    : "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: active
    ? "#ffffff"
    : "#b1bfd0",
  background: active
    ? "linear-gradient(135deg,rgba(37,99,235,.28),rgba(59,130,246,.13))"
    : "transparent",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 9.8,
  fontWeight: 900,
  transition:
    "background .16s ease,border-color .16s ease,color .16s ease",
});

const chartStatusStrip = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 7,
  marginBottom: 10,
};

const chartStatusMetric = (accent) => ({
  minWidth: 0,
  position: "relative",
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns:
    "31px minmax(0,1fr)",
  gap: 8,
  alignItems: "center",
  padding: "9px 10px 11px",
  borderRadius: 13,
  background:
    `linear-gradient(135deg,${accent}0D,rgba(2,6,23,.34))`,
  border: `1px solid ${accent}1C`,
});

const chartStatusIcon = (accent) => ({
  width: 31,
  height: 31,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  color: accent,
  background: `${accent}12`,
  border: `1px solid ${accent}25`,
  fontSize: 12,
  fontWeight: 950,
});

const chartStatusCopy = {
  minWidth: 0,
};

const chartStatusLabel = {
  color: "#d4deea",
  fontSize: 9.4,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: ".045em",
};

const chartStatusValueRow = {
  marginTop: 3,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 7,
  color: "#aebdd0",
  fontSize: 9.4,
  fontWeight: 800,
};

const chartStatusValue = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 950,
};

const chartStatusProgress = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 2,
  background:
    "rgba(148,163,184,.06)",
};

const chartStatusProgressFill = (
  accent,
  share
) => ({
  width: `${Math.max(
    0,
    Math.min(
      100,
      Number(share || 0)
    )
  )}%`,
  height: "100%",
  background: accent,
  boxShadow:
    `0 0 8px ${accent}66`,
});

const chartPanelBody = {
  flex: 1,
  minHeight: 330,
  overflow: "hidden",
  padding: 9,
  borderRadius: 17,
  background:
    "radial-gradient(circle at 50% 45%,rgba(59,130,246,.055),transparent 48%), linear-gradient(180deg,rgba(2,6,23,.34),rgba(2,6,23,.18))",
  border:
    "1px solid rgba(148,163,184,.07)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const chartInsightFooter = {
  marginTop: 10,
  minHeight: 37,
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "8px 10px",
  borderRadius: 12,
  background:
    "rgba(2,6,23,.28)",
  border:
    "1px solid rgba(148,163,184,.06)",
};

const chartInsightItem = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#b5c1d1",
  fontSize: 9.6,
  fontWeight: 700,
};

const chartInsightDot = (accent) => ({
  width: 6,
  height: 6,
  flexShrink: 0,
  borderRadius: "50%",
  background: accent,
  boxShadow:
    `0 0 8px ${accent}55`,
});

const activityPanelSurface = {
  minWidth: 0,
  height: 555,
  minHeight: 555,
  padding: 17,
  borderRadius: 24,
  background:
    "radial-gradient(circle at 100% 0%,rgba(34,211,238,.08),transparent 31%), linear-gradient(180deg,rgba(15,23,42,.95),rgba(8,15,30,.93))",
  border:
    "1px solid rgba(148,163,184,.10)",
  boxShadow:
    "0 20px 48px rgba(2,6,23,.30), inset 0 1px 0 rgba(255,255,255,.025)",
  backdropFilter: "blur(18px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const activityPanelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const activityPanelTitle = {
  marginTop: 3,
  color: "#f8fafc",
  fontSize: 18,
  fontWeight: 950,
  letterSpacing: "-.025em",
};

const activityPanelSubtitle = {
  maxWidth: 360,
  marginTop: 4,
  color: "#c0cad8",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.45,
};

const activityHeaderActions = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const activityLiveBadge = {
  height: 27,
  padding: "0 8px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "#86efac",
  background:
    "rgba(34,197,94,.08)",
  border:
    "1px solid rgba(34,197,94,.14)",
  fontSize: 7.8,
  fontWeight: 950,
  letterSpacing: ".06em",
};

const activityLivePulse = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 9px rgba(34,197,94,.72)",
};

const activityRefreshBtn = {
  height: 27,
  padding: "0 8px",
  borderRadius: 8,
  border:
    "1px solid rgba(96,165,250,.12)",
  background:
    "rgba(59,130,246,.06)",
  color: "#93c5fd",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 850,
};

const activitySignalsRow = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: 6,
  marginTop: 12,
};

const activitySignal = {
  minWidth: 0,
  padding: "8px 9px",
  borderRadius: 11,
  display: "flex",
  alignItems: "center",
  gap: 7,
  background:
    "rgba(2,6,23,.31)",
  border:
    "1px solid rgba(148,163,184,.065)",
};

const activitySignalDot = (accent) => ({
  width: 6,
  height: 6,
  flexShrink: 0,
  borderRadius: "50%",
  background: accent,
  boxShadow:
    `0 0 8px ${accent}55`,
});

const activitySignalLabel = {
  color: "#aebdd0",
  fontSize: 8.5,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const activitySignalValue = {
  marginTop: 1,
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
};

const activityLatestMeta = {
  minHeight: 32,
  marginTop: 8,
  padding: "7px 9px",
  borderRadius: 9,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  color: "#aebdd0",
  background:
    "rgba(148,163,184,.025)",
  border:
    "1px solid rgba(148,163,184,.045)",
  fontSize: 8.9,
  fontWeight: 800,
};

const activityFeedShell = {
  flex: 1,
  minHeight: 0,
  marginTop: 8,
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  scrollbarColor:
    "#334155 transparent",
  borderRadius: 14,
  background:
    "rgba(2,6,23,.20)",
  border:
    "1px solid rgba(148,163,184,.055)",
};


const dashboardDrillOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 15000,
  padding: 18,
  display: "grid",
  placeItems: "center",
  background: "rgba(2,6,23,.84)",
  backdropFilter: "blur(14px)",
};

const dashboardDrillModal = {
  width: "min(1480px,100%)",
  height: "min(900px,calc(100vh - 36px))",
  minHeight: 620,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 28,
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.12),transparent 30%),linear-gradient(180deg,#0f172a,#07101d)",
  border: "1px solid rgba(96,165,250,.18)",
  boxShadow: "0 42px 120px rgba(0,0,0,.70)",
  color: "#fff",
};

const dashboardDrillHeader = (accent) => ({
  flexShrink: 0,
  minHeight: 82,
  padding: "18px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  background: `linear-gradient(135deg,${accent}10,rgba(255,255,255,.02))`,
  borderBottom: "1px solid rgba(148,163,184,.08)",
});

const dashboardDrillEyebrow = {
  color: "#93c5fd",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const dashboardDrillTitle = {
  marginTop: 4,
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: "-.02em",
};

const dashboardDrillSubtitle = {
  marginTop: 5,
  maxWidth: 860,
  color: "#94a3b8",
  fontSize: 11.5,
  fontWeight: 700,
  lineHeight: 1.5,
};

const dashboardDrillHeaderRight = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const dashboardDrillCount = (accent) => ({
  minHeight: 32,
  padding: "0 11px",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  color: "#fff",
  background: `${accent}16`,
  border: `1px solid ${accent}35`,
  fontSize: 10,
  fontWeight: 950,
});

const dashboardDrillFilters = {
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns:
    "minmax(260px,1.6fr) repeat(4,minmax(125px,.7fr)) auto",
  gap: 8,
  alignItems: "end",
  padding: 12,
  margin: 12,
  borderRadius: 16,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(148,163,184,.065)",
};

const dashboardDrillField = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#64748b",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const dashboardDrillInput = {
  width: "100%",
  minWidth: 0,
  height: 38,
  padding: "0 10px",
  boxSizing: "border-box",
  borderRadius: 11,
  border: "1px solid rgba(148,163,184,.09)",
  outline: "none",
  background: "#0f172a",
  color: "#e2e8f0",
  colorScheme: "dark",
  fontFamily: "inherit",
  fontSize: 10,
  fontWeight: 800,
};

const dashboardDrillApply = (accent) => ({
  height: 38,
  padding: "0 16px",
  borderRadius: 11,
  border: `1px solid ${accent}42`,
  background: `linear-gradient(135deg,${accent},#2563eb)`,
  color: "#fff",
  fontFamily: "inherit",
  fontSize: 10,
  fontWeight: 950,
  cursor: "pointer",
});

const dashboardDrillError = {
  flexShrink: 0,
  margin: "0 12px 10px",
  padding: 10,
  borderRadius: 12,
  color: "#fecaca",
  background: "rgba(239,68,68,.08)",
  border: "1px solid rgba(239,68,68,.18)",
  fontSize: 10,
  fontWeight: 800,
};

const dashboardDrillTableWrap = {
  flex: 1,
  minHeight: 0,
  margin: "0 12px",
  overflow: "auto",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,.07)",
  scrollbarWidth: "thin",
  scrollbarColor: "#3b82f6 rgba(15,23,42,.9)",
};

const dashboardDrillTable = {
  width: "100%",
  minWidth: 1580,
  borderCollapse: "collapse",
  fontSize: 10.5,
};

const dashboardDrillTh = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  padding: "11px 10px",
  textAlign: "left",
  background: "#0b1220",
  color: "#94a3b8",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(148,163,184,.09)",
};

const dashboardDrillTd = {
  padding: "11px 10px",
  verticalAlign: "top",
  color: "#cbd5e1",
  borderBottom: "1px solid rgba(148,163,184,.045)",
};

const dashboardDrillTdStrong = {
  ...dashboardDrillTd,
  color: "#fff",
  fontWeight: 850,
};

const dashboardDrillSub = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
};

const dashboardDrillRow = {
  cursor: "pointer",
};

const dashboardException = {
  color: "#fdba74",
  fontWeight: 850,
};

const dashboardClear = {
  color: "#4ade80",
  fontWeight: 900,
};

const dashboardOpenHint = {
  marginTop: 5,
  color: "#60a5fa",
  fontSize: 8.5,
  fontWeight: 900,
};

const dashboardDrillEmpty = {
  padding: 30,
  textAlign: "center",
  color: "#94a3b8",
  fontWeight: 800,
};

const dashboardDrillPager = {
  flexShrink: 0,
  minHeight: 54,
  padding: "10px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  borderTop: "1px solid rgba(148,163,184,.07)",
};

const dashboardDrillPagerMeta = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 800,
};

const dashboardDrillPagerControls = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const dashboardDrillPageSize = {
  height: 32,
  padding: "0 8px",
  borderRadius: 10,
  border: "1px solid rgba(96,165,250,.14)",
  background: "#0f172a",
  color: "#bfdbfe",
  colorScheme: "dark",
  fontFamily: "inherit",
  fontSize: 9,
  fontWeight: 850,
  outline: "none",
};

const dashboardDrillPageButton = (disabled) => ({
  minWidth: 34,
  height: 32,
  padding: "0 8px",
  borderRadius: 10,
  border: "1px solid rgba(96,165,250,.14)",
  background: "rgba(59,130,246,.06)",
  color: "#bfdbfe",
  opacity: disabled ? 0.35 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "inherit",
  fontWeight: 950,
});

const dashboardDrillPageIndicator = {
  minWidth: 64,
  height: 32,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(148,163,184,.04)",
  border: "1px solid rgba(148,163,184,.07)",
  color: "#e2e8f0",
  fontSize: 9.5,
  fontWeight: 900,
};

const dashboardRecordOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 17000,
  padding: 18,
  display: "grid",
  placeItems: "center",
  background: "rgba(2,6,23,.88)",
  backdropFilter: "blur(14px)",
};

const dashboardRecordModal = {
  width: "min(1080px,100%)",
  maxHeight: "min(880px,calc(100vh - 36px))",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 26,
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.13),transparent 30%),linear-gradient(180deg,#0f172a,#08101d)",
  border: "1px solid rgba(96,165,250,.18)",
  boxShadow: "0 40px 110px rgba(0,0,0,.70)",
  color: "#fff",
};

const dashboardRecordHeader = {
  flexShrink: 0,
  padding: "18px 20px",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px solid rgba(148,163,184,.08)",
};

const dashboardRecordEyebrow = {
  color: "#93c5fd",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".09em",
};

const dashboardRecordTitle = {
  marginTop: 4,
  color: "#fff",
  fontSize: 21,
  fontWeight: 950,
};

const dashboardRecordSub = {
  marginTop: 4,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 700,
};

const dashboardRecordClose = {
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,.10)",
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  fontSize: 20,
  cursor: "pointer",
};

const dashboardRecordActorGrid = {
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 8,
  padding: "12px 20px",
};

const dashboardRecordActor = {
  minWidth: 0,
  padding: 11,
  borderRadius: 13,
  background: "rgba(255,255,255,.035)",
  border: "1px solid rgba(148,163,184,.065)",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 850,
};

const dashboardRecordFields = {
  minHeight: 0,
  overflowY: "auto",
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
  gap: 8,
  padding: "0 20px 20px",
  scrollbarWidth: "thin",
  scrollbarColor: "#3b82f6 rgba(15,23,42,.72)",
};

const dashboardRecordField = {
  minWidth: 0,
  padding: 11,
  borderRadius: 12,
  background: "rgba(2,6,23,.34)",
  border: "1px solid rgba(148,163,184,.055)",
};

const dashboardRecordFieldLabel = {
  color: "#64748b",
  fontSize: 8,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const dashboardRecordFieldValue = {
  marginTop: 5,
  color: "#e2e8f0",
  fontSize: 10.5,
  fontWeight: 750,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
};

export default DashboardPage;