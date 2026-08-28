import { useMemo, useState } from "react";

import ActivityFeed from "./ActivityFeed";
import StatusCorporateChart from "./StatusCorporateChart";
import InventoryCommandCenter from "./inventory/InventoryCommandCenter";
import InventoryReports from "./inventory/InventoryReports";
import DailyThroughputDrilldown from "./inventory/DailyThroughputDrilldown";
import DashboardRecordInspector from "./inventory/DashboardRecordInspector";
import ScheduledReports from "./ScheduledReports";
import LogisticsDashboard from "./logistics/LogisticsDashboard";
import AdminCenter from "./admin/AdminCenter";

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = (numerator, denominator, empty = 0) => {
  const base = number(denominator);
  if (base <= 0) return empty;
  return Math.max(0, Math.min(100, (number(numerator) / base) * 100));
};

function MetricCard({ label, value, detail, accent = "#2563eb", signal, onClick }) {
  const content = (
    <>
      <div style={metricAccent(accent)} />
      <div style={metricTop}>
        <div style={metricLabel}>{label}</div>
        {signal && <div style={metricSignal(accent)}>{signal}</div>}
      </div>
      <div style={metricValue}>{value}</div>
      <div style={metricDetail}>{detail}</div>
      {onClick && <div style={metricInspectHint}>Inspect records →</div>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...metricCard(accent), ...metricButton }}>
        {content}
      </button>
    );
  }

  return <div style={metricCard(accent)}>{content}</div>;
}

function LegacyStatCard({
  title,
  value,
  subtle,
  accent = "#2563eb",
  icon = "•",
  trend,
  trendLabel,
  onClick,
}) {
  return (
    <button type="button" onClick={onClick} style={legacyCard(accent, Boolean(onClick))}>
      <div style={legacyHead}>
        <span style={legacyIcon(accent)}>{icon}</span>
        {trend !== undefined && trend !== null && (
          <span style={legacyTrend(accent)}>{trend}</span>
        )}
      </div>
      <div style={legacyTitle}>{title}</div>
      <div style={legacyValue}>{value}</div>
      {subtle && <div style={legacySubtle}>{subtle}</div>}
      {trendLabel && <div style={legacyTrendLabel}>{trendLabel}</div>}
    </button>
  );
}

function ExceptionRow({ label, value, severity = "medium", detail }) {
  const tone = severityTone[severity] || severityTone.medium;
  return (
    <div style={exceptionRow}>
      <div style={exceptionIdentity}>
        <span style={{ ...severityDot, background: tone.accent }} />
        <div>
          <div style={exceptionLabel}>{label}</div>
          <div style={exceptionDetail}>{detail}</div>
        </div>
      </div>
      <div style={exceptionValue(tone)}>{number(value)}</div>
    </div>
  );
}

function ProgressRow({ label, value, accent, detail }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={progressRow}>
      <div style={progressHeader}>
        <div>
          <div style={progressLabel}>{label}</div>
          <div style={progressDetail}>{detail}</div>
        </div>
        <strong style={progressValue}>{Math.round(safe)}%</strong>
      </div>
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${safe}%`, background: accent }} />
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div style={sectionHeader}>
      <div>
        <div style={sectionEyebrow}>{eyebrow}</div>
        <div style={sectionTitle}>{title}</div>
        {subtitle && <div style={sectionSubtitle}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function InventoryDashboard({
  stats,
  activityLogs,
  refreshing,
  onRefresh,
  onInspectMetric,
}) {
  const [workspace, setWorkspace] = useState("overview");

  const currentExceptions =
    number(stats.masterItemsWithoutPackets) +
    number(stats.packetsWithoutPacketItems) +
    number(stats.packetItemsWithoutMaster) +
    number(stats.duplicateCurrentStickers) +
    number(stats.readyItemsStillInPkd);

  const legacyDispatchExceptions =
    number(stats.dispatchedWithoutPacketItem) +
    number(stats.dispatchedWithoutChallan) +
    number(stats.dispatchedWithoutDriver);

  const totalExceptions = Math.max(
    number(stats.exceptionsCount),
    currentExceptions + legacyDispatchExceptions
  );

  const packingCompletion = percent(stats.packetItemsWithSticker, stats.packetItems, 0);
  const masterCompletion = percent(stats.fullyPackedMasterItems, stats.masterItems, 0);
  const tripClosure = percent(
    stats.endedTrips,
    number(stats.endedTrips) + number(stats.runningTrips),
    100
  );

  const inventoryBase =
    number(stats.warehouseItems) +
    number(stats.readyToDispatchItems) +
    number(stats.readyItems);

  const dispatchReadyShare = percent(stats.readyToDispatchItems, inventoryBase, 0);

  const actionSignals = useMemo(() => {
    const rows = [];

    if (totalExceptions > 0) {
      rows.push({
        tone: "critical",
        title: `${totalExceptions} data-integrity exception${totalExceptions === 1 ? "" : "s"}`,
        text: "Reconcile broken packet/master/sticker/dispatch links before relying on downstream operational counts.",
      });
    }

    if (number(stats.readyToDispatchItems) > 0) {
      rows.push({
        tone: "info",
        title: `${number(stats.readyToDispatchItems)} finished-goods items ready for dispatch`,
        text: "Watch this outbound-ready queue for dwell and challan conversion delay.",
      });
    }

    if (number(stats.packetItemsPendingSticker) > 0) {
      rows.push({
        tone: "warning",
        title: `${number(stats.packetItemsPendingSticker)} packet items still need sticker completion`,
        text: "This is current packing work that has not reached complete packet identity readiness.",
      });
    }

    if (number(stats.warehouseRequestedItems) + number(stats.returnRequestedItems) > 0) {
      rows.push({
        tone: "warning",
        title: `${number(stats.warehouseRequestedItems) + number(stats.returnRequestedItems)} warehouse decisions pending`,
        text: "Includes inbound warehouse approvals and return-to-dispatch requests awaiting action.",
      });
    }

    if (rows.length === 0) {
      rows.push({
        tone: "good",
        title: "No priority Inventory/Dispatch control exception in the current snapshot",
        text: "Continue monitoring packing completion, FG readiness, warehouse handoff and dispatch conversion.",
      });
    }

    return rows.slice(0, 4);
  }, [stats, totalExceptions]);

  const exceptionRows = [
    ["Master items without packets", stats.masterItemsWithoutPackets, "high", "Parent manufacturing items missing packet structure."],
    ["Packets without packet items", stats.packetsWithoutPacketItems, "high", "Packet shells that cannot represent physical packed contents."],
    ["Packet items without master link", stats.packetItemsWithoutMaster, "high", "Orphan packet rows weaken item traceability."],
    ["Duplicate current stickers", stats.duplicateCurrentStickers, "high", "Current sticker identity collision requiring reconciliation."],
    ["Ready items still in PKD", stats.readyItemsStillInPkd, "medium", "Status/location mismatch between readiness and physical flow."],
    ["Dispatched without packet item", stats.dispatchedWithoutPacketItem, "medium", "Legacy dispatch rows missing packet-level lineage."],
    ["Dispatched without challan", stats.dispatchedWithoutChallan, "high", "Outbound record without expected dispatch document linkage."],
    ["Dispatched without driver / vehicle", stats.dispatchedWithoutDriver, "medium", "Transport attribution is incomplete on dispatched records."],
  ];

  return (
    <>
      <section style={metricGrid}>
        <MetricCard
          label="Inventory Items"
          value={number(stats.totalItems)}
          detail="Warehouse + Ready to Dispatch + Ready"
          accent="#2563eb"
          signal="LIVE"
          onClick={() =>
            onInspectMetric?.({
              key: "inventory-items",
              title: "Inventory items",
              subtitle: `${number(stats.warehouseItems)} warehouse • ${number(stats.readyToDispatchItems)} ready to dispatch • ${number(stats.readyItems)} ready. Inspect the current tracked inventory records behind these buckets.`,
              accent: "#2563eb",
              type: "all",
              statuses: ["WAREHOUSE", "READY_TO_DISPATCH", "READY"],
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Master Items"
          value={number(stats.masterItems)}
          detail={`${number(stats.fullyPackedMasterItems)} fully packed • ${number(stats.partiallyPackedMasterItems)} partial • ${number(stats.unpackedMasterItems)} unpacked`}
          accent="#7c3aed"
          signal={`${Math.round(masterCompletion)}%`}
          onClick={() =>
            onInspectMetric?.({
              key: "master-items",
              title: "Master item execution",
              subtitle: `${number(stats.fullyPackedMasterItems)} fully packed • ${number(stats.partiallyPackedMasterItems)} partially packed • ${number(stats.unpackedMasterItems)} unpacked.`,
              accent: "#7c3aed",
              source: "master",
              packingStatus: "ALL",
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Packet Items"
          value={number(stats.packetItems)}
          detail={`${number(stats.packetItemsWithSticker)} sticker-ready • ${number(stats.packetItemsPendingSticker)} pending`}
          accent="#0284c7"
          signal={`${Math.round(packingCompletion)}%`}
          onClick={() =>
            onInspectMetric?.({
              key: "packet-items",
              title: "Packet item execution",
              subtitle: `${number(stats.packetItemsWithSticker)} sticker-complete packet items and ${number(stats.packetItemsPendingSticker)} still pending sticker completion.`,
              accent: "#0284c7",
              type: "all",
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Warehouse"
          value={number(stats.warehouseItems)}
          detail={`${number(stats.warehouseRequestedItems)} inbound approvals • ${number(stats.returnRequestedItems)} return requests`}
          accent="#9333ea"
          signal="STOCK"
          onClick={() =>
            onInspectMetric?.({
              key: "warehouse-items",
              title: "Warehouse stock",
              subtitle: `${number(stats.warehouseItems)} currently stored items • ${number(stats.warehouseRequestedItems)} inbound approvals • ${number(stats.returnRequestedItems)} return requests.`,
              accent: "#9333ea",
              type: "all",
              statuses: ["WAREHOUSE"],
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Ready to Dispatch"
          value={number(stats.readyToDispatchItems)}
          detail={`${Math.round(dispatchReadyShare)}% of current FG inventory position`}
          accent="#059669"
          signal="FG"
          onClick={() =>
            onInspectMetric?.({
              key: "ready-to-dispatch",
              title: "Ready-to-dispatch finished goods",
              subtitle: `${number(stats.readyToDispatchItems)} items are currently available for outbound conversion, representing ${Math.round(dispatchReadyShare)}% of the tracked FG position.`,
              accent: "#059669",
              type: "all",
              statuses: ["READY_TO_DISPATCH"],
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Dispatch Challans"
          value={number(stats.normalDispatchChallans)}
          detail={`${number(stats.todayDispatchChallans)} distinct challans today • ${number(stats.runningTrips)} running trips`}
          accent="#0f766e"
          signal="OUTBOUND"
          onClick={() =>
            onInspectMetric?.({
              key: "dispatch-challans",
              title: "Dispatch challan execution",
              subtitle: `${number(stats.normalDispatchChallans)} normal dispatch challans • ${number(stats.todayDispatchChallans)} today • ${number(stats.runningTrips)} running trips • ${number(stats.endedTrips)} ended trips.`,
              accent: "#0f766e",
              type: "challaned",
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Custom Challans"
          value={number(stats.customChallans)}
          detail={`${number(stats.todayCustomChallans)} generated today • ${number(stats.customChallanItems)} item rows`}
          accent="#ca8a04"
          signal="CUSTOM"
          onClick={() =>
            onInspectMetric?.({
              key: "custom-challans",
              title: "Custom challans",
              subtitle: `${number(stats.customChallans)} custom challans • ${number(stats.todayCustomChallans)} generated today • ${number(stats.customChallanItems)} linked item rows.`,
              accent: "#ca8a04",
              type: "custom",
              limit: 1000,
            })
          }
        />
        <MetricCard
          label="Exceptions"
          value={totalExceptions}
          detail={`${currentExceptions} current-chain • ${legacyDispatchExceptions} legacy outbound`}
          accent={totalExceptions ? "#dc2626" : "#16a34a"}
          signal={totalExceptions ? "ACTION" : "CLEAR"}
          onClick={() =>
            onInspectMetric?.({
              key: "exceptions",
              title: "PackFlow integrity exceptions",
              subtitle: `${currentExceptions} current-chain exceptions • ${legacyDispatchExceptions} legacy outbound exceptions. Inspect exact exception records exposed by the ADMIN trace endpoint.`,
              accent: totalExceptions ? "#dc2626" : "#16a34a",
              type: "errored",
              limit: 1000,
            })
          }
        />
        <DailyThroughputDrilldown asMetricCard />
      </section>

      <section style={overviewGrid}>
        <div style={panel}>
          <SectionHeader
            eyebrow="PRIORITY ACTIONS"
            title="Management attention queue"
            subtitle="Exception-first signals grounded in current PackFlow state."
          />
          <div style={signalList}>
            {actionSignals.map((row) => {
              const tone = actionTone[row.tone] || actionTone.info;
              return (
                <div key={row.title} style={signalCard(tone)}>
                  <div style={signalCardTop}>
                    <span style={{ ...severityDot, background: tone.accent }} />
                    <strong>{row.title}</strong>
                  </div>
                  <div style={signalText}>{row.text}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={panel}>
          <SectionHeader
            eyebrow="CONTROL RATIOS"
            title="Execution quality gates"
            subtitle="Completion and conversion ratios calculated directly from PackFlow counts."
          />
          <div style={progressList}>
            <ProgressRow label="Packet sticker completion" value={packingCompletion} accent="#2563eb" detail={`${number(stats.packetItemsWithSticker)} of ${number(stats.packetItems)} packet items`} />
            <ProgressRow label="Fully packed master items" value={masterCompletion} accent="#7c3aed" detail={`${number(stats.fullyPackedMasterItems)} of ${number(stats.masterItems)} master items`} />
            <ProgressRow label="Dispatch-ready share" value={dispatchReadyShare} accent="#059669" detail={`${number(stats.readyToDispatchItems)} of ${inventoryBase} current FG-position items`} />
            <ProgressRow label="Trip closure" value={tripClosure} accent="#0f766e" detail={`${number(stats.endedTrips)} ended • ${number(stats.runningTrips)} running`} />
          </div>
        </div>
      </section>

      <section style={twoColumn}>
        <div style={panel}>
          <SectionHeader
            eyebrow="FINISHED GOODS POSITION"
            title="Live warehouse & dispatch composition"
            subtitle="Current tracked inventory position only."
          />
          <div style={chartBody}>
            <StatusCorporateChart warehouse={stats.warehouseItems} readyToDispatch={stats.readyToDispatchItems} ready={stats.readyItems} />
          </div>
        </div>

        <div style={panel}>
          <SectionHeader
            eyebrow="EXCEPTION REGISTER"
            title="Where the data chain can break"
            subtitle="ADMIN-only control detail; Director receives only aggregate risk indicators."
          />
          <div style={exceptionList}>
            {exceptionRows.map(([label, value, severity, detail]) => (
              <ExceptionRow key={label} label={label} value={value} severity={severity} detail={detail} />
            ))}
          </div>
        </div>
      </section>

      <section style={workspacePanel}>
        <div style={workspaceHeader}>
          <div>
            <div style={sectionEyebrow}>INVENTORY ADMIN WORKSPACE</div>
            <div style={sectionTitle}>Investigate, trace and report</div>
          </div>
          <div style={tabs}>
            {[
              ["overview", "Activity"],
              ["trace", "Traceability"],
              ["reports", "Reports"],
            ].map(([key, label]) => (
              <button type="button" key={key} style={tabButton(workspace === key)} onClick={() => setWorkspace(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {workspace === "overview" && (
          <div>
            <SectionHeader
              eyebrow="AUDIT STREAM"
              title="Recent PackFlow activity"
              subtitle="Raw activity is ADMIN-only and is never sent to the Director dashboard."
              action={
                <button type="button" style={secondaryButton} onClick={onRefresh} disabled={refreshing}>
                  {refreshing ? "Refreshing…" : "Refresh events"}
                </button>
              }
            />
            <ActivityFeed logs={activityLogs} />
          </div>
        )}

        {workspace === "trace" && <InventoryCommandCenter stats={stats} />}

        {workspace === "reports" && (
          <div style={stack}>
            <InventoryReports />
            <ScheduledReports />
          </div>
        )}
      </section>
    </>
  );
}

export default function AdminOperationsDashboard({
  stats = {},
  logistics,
  activityLogs = [],
  refreshing,
  onRefresh,
}) {
  const [mode, setMode] = useState("inventory");
  const [adminCenterOpen, setAdminCenterOpen] = useState(false);
  const [metricInspector, setMetricInspector] = useState(null);

  return (
    <>
      <section style={modeBar}>
        <div>
          <div style={sectionEyebrow}>ADMIN DASHBOARD MODE</div>
          <div style={modeTitle}>One management dashboard. Two operating lenses.</div>
          <div style={modeSub}>
            Inventory mode covers packing, FG, warehouse and dispatch. Logistics mode covers trips, drivers, vehicles and route/resource analytics.
          </div>
        </div>
        <div style={modeActions}>
          <div style={modeSwitch}>
            <button type="button" style={modeButton(mode === "inventory")} onClick={() => setMode("inventory")}>
              Inventory & Dispatch
            </button>
            <button type="button" style={modeButton(mode === "logistics")} onClick={() => setMode("logistics")}>
              Logistics
            </button>
          </div>
          <button type="button" style={adminCenterButton} onClick={() => setAdminCenterOpen(true)}>
            Admin Center
          </button>
        </div>
      </section>

      {mode === "inventory" ? (
        <InventoryDashboard
          stats={stats}
          activityLogs={activityLogs}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onInspectMetric={(config) => setMetricInspector({ open: true, ...config })}
        />
      ) : (
        <section style={logisticsShell}>
          <LogisticsDashboard StatCard={LegacyStatCard} initialData={logistics} />
        </section>
      )}


      <DashboardRecordInspector
        config={metricInspector}
        onClose={() => setMetricInspector(null)}
      />

      <AdminCenter
        open={adminCenterOpen}
        onClose={() => setAdminCenterOpen(false)}
        onChanged={async () => {
          // Keep the Admin Center open after a completed action.
          // The modal owns its current tab/search state; the parent only refreshes
          // the dashboard data behind it. Closing remains an explicit user action.
          await onRefresh?.();
        }}
      />
    </>
  );
}

const severityTone = {
  high: { accent: "#dc2626", soft: "rgba(220,38,38,.08)", border: "rgba(220,38,38,.18)" },
  medium: { accent: "#d97706", soft: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.18)" },
  low: { accent: "#2563eb", soft: "rgba(37,99,235,.08)", border: "rgba(37,99,235,.18)" },
};

const actionTone = {
  critical: severityTone.high,
  warning: severityTone.medium,
  info: severityTone.low,
  good: { accent: "#16a34a", soft: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.18)" },
};

const modeBar = { marginBottom: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", borderRadius: 13, background: "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))", border: "1px solid var(--pf-border)", boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.05)" };
const modeTitle = { marginTop: 4, color: "var(--pf-text-strong)", fontSize: 17, fontWeight: 950 };
const modeSub = { maxWidth: 760, marginTop: 4, color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 650, lineHeight: 1.5 };
const modeActions = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const modeSwitch = { display: "flex", gap: 5, padding: 4, borderRadius: 11, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const modeButton = (active) => ({ minHeight: 38, padding: "0 14px", borderRadius: 8, border: active ? "1px solid rgba(37,99,235,.28)" : "1px solid transparent", background: active ? "linear-gradient(135deg,#2563eb,#3b82f6)" : "transparent", color: active ? "#fff" : "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 900 });
const adminCenterButton = { minHeight: 46, padding: "0 15px", borderRadius: 10, border: "1px solid rgba(220,38,38,.25)", background: "linear-gradient(135deg,#b91c1c,#dc2626)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 900, boxShadow: "0 7px 16px rgba(185,28,28,.14)" };
const logisticsShell = { minWidth: 0 };
const metricGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 10 };
const metricCard = (accent) => ({ position: "relative", overflow: "hidden", minHeight: 118, padding: 14, borderRadius: 12, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 6px 20px rgba(var(--pf-shadow-rgb),.05)", textAlign: "left", color: "var(--pf-text-strong)", fontFamily: "inherit" });
const metricButton = { width: "100%", cursor: "pointer" };
const metricAccent = (accent) => ({ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent });
const metricTop = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const metricLabel = { color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" };
const metricSignal = (accent) => ({ padding: "3px 6px", borderRadius: 6, color: accent, background: `${accent}10`, border: `1px solid ${accent}20`, fontSize: 7.5, fontWeight: 950, letterSpacing: ".05em" });
const metricValue = { marginTop: 10, fontSize: 28, lineHeight: 1, fontWeight: 950, letterSpacing: "-.04em", color: "var(--pf-text-strong)" };
const metricDetail = { marginTop: 8, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700, lineHeight: 1.45 };
const metricInspectHint = { marginTop: 7, color: "#2563eb", fontSize: 8.4, fontWeight: 900 };
const overviewGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 };
const twoColumn = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(390px,1fr))", gap: 12 };
const panel = { minWidth: 0, padding: 16, borderRadius: 13, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.055)" };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 13, flexWrap: "wrap" };
const sectionEyebrow = { color: "#2563eb", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" };
const sectionTitle = { marginTop: 4, color: "var(--pf-text-strong)", fontSize: 16, fontWeight: 950, letterSpacing: "-.02em" };
const sectionSubtitle = { maxWidth: 720, marginTop: 4, color: "var(--pf-text-muted)", fontSize: 10, fontWeight: 650, lineHeight: 1.5 };
const signalList = { display: "grid", gap: 8 };
const signalCard = (tone) => ({ padding: 11, borderRadius: 10, background: tone.soft, border: `1px solid ${tone.border}` });
const signalCardTop = { display: "flex", alignItems: "center", gap: 8, color: "var(--pf-text-strong)", fontSize: 10.5 };
const signalText = { marginTop: 5, paddingLeft: 15, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 650, lineHeight: 1.45 };
const severityDot = { width: 7, height: 7, flexShrink: 0, borderRadius: "50%" };
const progressList = { display: "grid", gap: 13 };
const progressRow = {};
const progressHeader = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" };
const progressLabel = { color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 900 };
const progressDetail = { marginTop: 3, color: "var(--pf-text-muted)", fontSize: 9, fontWeight: 650 };
const progressValue = { color: "var(--pf-text-strong)", fontSize: 12 };
const progressTrack = { height: 6, marginTop: 8, overflow: "hidden", borderRadius: 999, background: "var(--pf-surface-alt)" };
const progressFill = { height: "100%", borderRadius: 999 };
const chartBody = { minHeight: 250 };
const exceptionList = { display: "grid", gap: 7 };
const exceptionRow = { minHeight: 52, padding: "8px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 9, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const exceptionIdentity = { display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 };
const exceptionLabel = { color: "var(--pf-text-strong)", fontSize: 9.5, fontWeight: 900 };
const exceptionDetail = { marginTop: 3, color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 650, lineHeight: 1.35 };
const exceptionValue = (tone) => ({ minWidth: 34, height: 28, padding: "0 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: tone.accent, background: tone.soft, border: `1px solid ${tone.border}`, fontSize: 12, fontWeight: 950 });
const workspacePanel = { marginTop: 12, padding: 16, borderRadius: 13, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.055)" };
const workspaceHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" };
const tabs = { display: "flex", gap: 5, flexWrap: "wrap" };
const tabButton = (active) => ({ minHeight: 34, padding: "0 11px", borderRadius: 8, border: active ? "1px solid rgba(37,99,235,.25)" : "1px solid var(--pf-border-soft)", background: active ? "rgba(37,99,235,.09)" : "var(--pf-surface-alt)", color: active ? "#2563eb" : "var(--pf-text)", cursor: "pointer", fontFamily: "inherit", fontSize: 9.5, fontWeight: 900 });
const secondaryButton = { minHeight: 34, padding: "0 11px", borderRadius: 8, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit", fontSize: 9.5, fontWeight: 850 };
const stack = { display: "grid", gap: 14 };
const legacyCard = (accent, clickable) => ({ minWidth: 0, padding: 13, borderRadius: 12, border: "1px solid var(--pf-border)", background: "var(--pf-surface)", color: "var(--pf-text-strong)", textAlign: "left", fontFamily: "inherit", cursor: clickable ? "pointer" : "default" });
const legacyHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const legacyIcon = (accent) => ({ color: accent, fontWeight: 950 });
const legacyTrend = (accent) => ({ color: accent, fontSize: 8.5, fontWeight: 900 });
const legacyTitle = { marginTop: 8, color: "var(--pf-text-muted)", fontSize: 9, fontWeight: 850 };
const legacyValue = { marginTop: 5, fontSize: 24, fontWeight: 950 };
const legacySubtle = { marginTop: 5, color: "var(--pf-text-muted)", fontSize: 9 };
const legacyTrendLabel = { marginTop: 3, color: "var(--pf-text-dim)", fontSize: 8.5 };
