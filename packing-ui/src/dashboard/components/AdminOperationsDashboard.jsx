import { useMemo, useState } from "react";

import ActivityFeed from "./ActivityFeed";
import StatusCorporateChart from "./StatusCorporateChart";
import InventoryCommandCenter from "./inventory/InventoryCommandCenter";
import InventoryReports from "./inventory/InventoryReports";
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

function MetricCard({ label, value, detail, accent = "#2563eb", signal }) {
  return (
    <div style={metricCard(accent)}>
      <div style={metricAccent(accent)} />
      <div style={metricTop}>
        <div style={metricLabel}>{label}</div>
        {signal && <div style={metricSignal(accent)}>{signal}</div>}
      </div>
      <div style={metricValue}>{value}</div>
      <div style={metricDetail}>{detail}</div>
    </div>
  );
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

export default function AdminOperationsDashboard({
  stats = {},
  logistics,
  activityLogs = [],
  refreshing,
  onRefresh,
}) {
  const [workspace, setWorkspace] = useState("control");
  const [adminCenterOpen, setAdminCenterOpen] = useState(false);

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
  const movementQueue =
    number(stats.warehouseRequestedItems) +
    number(stats.returnRequestedItems) +
    number(stats.queuedItems) +
    number(stats.readyToStoreItems);
  const complianceFlags =
    number(stats.expiredFitness) +
    number(stats.expiredInsurance) +
    number(stats.expiredPucc);
  const todayThroughput =
    number(stats.todayStickerGenerated) + number(stats.todayChallanGenerated);

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
        text: "Reconcile broken packet/master/sticker/dispatch links before relying on downstream counts.",
      });
    }
    if (number(stats.readyToDispatchItems) > 0) {
      rows.push({
        tone: "info",
        title: `${number(stats.readyToDispatchItems)} items waiting for outbound conversion`,
        text: "This is the current finished-goods dispatch-ready queue and should be watched for dwell accumulation.",
      });
    }
    if (number(stats.packetItemsPendingSticker) > 0) {
      rows.push({
        tone: "warning",
        title: `${number(stats.packetItemsPendingSticker)} packet items still need sticker completion`,
        text: "Open packing work remains in the packet-level execution queue.",
      });
    }
    if (complianceFlags > 0) {
      rows.push({
        tone: "warning",
        title: `${complianceFlags} fleet-document compliance flag${complianceFlags === 1 ? "" : "s"}`,
        text: "Fitness, insurance and/or PUCC expiry records require administrative review before vehicle assignment.",
      });
    }
    if (rows.length === 0) {
      rows.push({
        tone: "good",
        title: "No priority control exception in the current snapshot",
        text: "Continue monitoring packing completion, dispatch-ready dwell and warehouse handoff queues.",
      });
    }
    return rows.slice(0, 4);
  }, [complianceFlags, stats, totalExceptions]);

  const exceptionRows = [
    {
      label: "Master items without packets",
      value: stats.masterItemsWithoutPackets,
      severity: "high",
      detail: "Parent manufacturing items missing packet structure.",
    },
    {
      label: "Packets without packet items",
      value: stats.packetsWithoutPacketItems,
      severity: "high",
      detail: "Packet shells that cannot represent physical packed contents.",
    },
    {
      label: "Packet items without master link",
      value: stats.packetItemsWithoutMaster,
      severity: "high",
      detail: "Orphan packet rows weaken project/product traceability.",
    },
    {
      label: "Duplicate current stickers",
      value: stats.duplicateCurrentStickers,
      severity: "high",
      detail: "Current sticker identity collision requiring reconciliation.",
    },
    {
      label: "Ready items still in PKD",
      value: stats.readyItemsStillInPkd,
      severity: "medium",
      detail: "Status/location mismatch between readiness and physical flow.",
    },
    {
      label: "Dispatched without packet item",
      value: stats.dispatchedWithoutPacketItem,
      severity: "medium",
      detail: "Legacy dispatch rows missing packet-level lineage.",
    },
    {
      label: "Dispatched without challan",
      value: stats.dispatchedWithoutChallan,
      severity: "high",
      detail: "Outbound record without the expected dispatch document link.",
    },
    {
      label: "Dispatched without driver / vehicle",
      value: stats.dispatchedWithoutDriver,
      severity: "medium",
      detail: "Transport attribution is incomplete on dispatched records.",
    },
  ];

  return (
    <>
      <section style={hero}>
        <div style={heroCopy}>
          <div style={heroEyebrow}>ADMIN • OPERATIONAL CONTROL TOWER</div>
          <h1 style={heroTitle}>Exceptions first. Throughput second.</h1>
          <p style={heroText}>
            Control-focused PackFlow view for custom interior manufacturing: data integrity,
            packing backlog, finished-goods readiness, warehouse handoff, dispatch execution and
            fleet compliance in one management surface.
          </p>
        </div>

        <div style={heroActions}>
          <div style={healthBlock(totalExceptions)}>
            <span style={healthLabel}>CONTROL HEALTH</span>
            <strong>{totalExceptions === 0 ? "CLEAR" : "ACTION"}</strong>
            <small>{totalExceptions} integrity exceptions</small>
          </div>
          <button type="button" style={dangerAction} onClick={() => setAdminCenterOpen(true)}>
            Admin Center
          </button>
        </div>
      </section>

      <section style={metricGrid}>
        <MetricCard
          label="Integrity exceptions"
          value={totalExceptions}
          detail={`${currentExceptions} current • ${legacyDispatchExceptions} legacy dispatch`}
          accent={totalExceptions > 0 ? "#dc2626" : "#16a34a"}
          signal={totalExceptions > 0 ? "ACTION" : "CLEAR"}
        />
        <MetricCard
          label="Packing backlog"
          value={number(stats.packetItemsPendingSticker || stats.pendingItems)}
          detail={`${Math.round(packingCompletion)}% packet-item sticker completion`}
          accent="#d97706"
          signal="WIP"
        />
        <MetricCard
          label="Dispatch-ready FG"
          value={number(stats.readyToDispatchItems)}
          detail={`${Math.round(dispatchReadyShare)}% of live finished-goods position`}
          accent="#2563eb"
          signal="OUTBOUND"
        />
        <MetricCard
          label="Movement / approval queue"
          value={movementQueue}
          detail={`${number(stats.warehouseRequestedItems)} warehouse • ${number(stats.returnRequestedItems)} return requests`}
          accent="#7c3aed"
          signal="QUEUE"
        />
        <MetricCard
          label="Fleet compliance flags"
          value={complianceFlags}
          detail={`${number(stats.expiredFitness)} fitness • ${number(stats.expiredInsurance)} insurance • ${number(stats.expiredPucc)} PUCC`}
          accent={complianceFlags > 0 ? "#dc2626" : "#16a34a"}
          signal="DOCUMENTS"
        />
        <MetricCard
          label="Today throughput"
          value={todayThroughput}
          detail={`${number(stats.todayStickerGenerated)} stickers • ${number(stats.todayChallanGenerated)} challans`}
          accent="#0f766e"
          signal="TODAY"
        />
      </section>

      <section style={overviewGrid}>
        <div style={panel}>
          <SectionHeader
            eyebrow="PRIORITY ACTIONS"
            title="Management attention queue"
            subtitle="Data-backed control signals only; no invented thresholds or external benchmarks."
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
            subtitle="Completion and closure ratios calculated directly from PackFlow counts."
          />
          <div style={progressList}>
            <ProgressRow
              label="Packet sticker completion"
              value={packingCompletion}
              accent="#2563eb"
              detail={`${number(stats.packetItemsWithSticker)} of ${number(stats.packetItems)} packet items`}
            />
            <ProgressRow
              label="Fully packed master items"
              value={masterCompletion}
              accent="#7c3aed"
              detail={`${number(stats.fullyPackedMasterItems)} of ${number(stats.masterItems)} manufacturing items`}
            />
            <ProgressRow
              label="Trip closure"
              value={tripClosure}
              accent="#0f766e"
              detail={`${number(stats.endedTrips)} ended • ${number(stats.runningTrips)} running`}
            />
          </div>
        </div>
      </section>

      <section style={twoColumn}>
        <div style={panel}>
          <SectionHeader
            eyebrow="FINISHED GOODS POSITION"
            title="Live warehouse & dispatch composition"
            subtitle="Current tracked inventory only."
          />
          <div style={chartBody}>
            <StatusCorporateChart
              warehouse={stats.warehouseItems}
              readyToDispatch={stats.readyToDispatchItems}
              ready={stats.readyItems}
            />
          </div>
        </div>

        <div style={panel}>
          <SectionHeader
            eyebrow="EXCEPTION REGISTER"
            title="Where the data chain can break"
            subtitle="These controls are intentionally more prominent on the ADMIN dashboard."
          />
          <div style={exceptionList}>
            {exceptionRows.map((row) => (
              <ExceptionRow key={row.label} {...row} />
            ))}
          </div>
        </div>
      </section>

      <section style={workspacePanel}>
        <div style={workspaceHeader}>
          <div>
            <div style={sectionEyebrow}>ADMIN WORKSPACE</div>
            <div style={sectionTitle}>Investigate, report and control</div>
          </div>

          <div style={tabs}>
            {[
              ["control", "Activity"],
              ["trace", "Traceability"],
              ["reports", "Reports"],
              ["logistics", "Logistics"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                style={tabButton(workspace === key)}
                onClick={() => setWorkspace(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {workspace === "control" && (
          <div>
            <SectionHeader
              eyebrow="AUDIT STREAM"
              title="Recent PackFlow activity"
              subtitle="Raw activity is intentionally ADMIN-only and is not exposed to the Director dashboard."
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

        {workspace === "logistics" && (
          <LogisticsDashboard StatCard={LegacyStatCard} initialData={logistics} />
        )}
      </section>

      <AdminCenter
        open={adminCenterOpen}
        onClose={() => setAdminCenterOpen(false)}
        onChanged={async () => {
          setAdminCenterOpen(false);
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

const hero = {
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: 18,
  padding: "22px clamp(18px,2.5vw,32px)",
  border: "1px solid var(--pf-border)",
  borderRadius: 14,
  background:
    "linear-gradient(120deg,var(--pf-surface) 0%,var(--pf-surface) 68%,color-mix(in srgb,#2563eb 7%,var(--pf-surface-alt)) 100%)",
  boxShadow: "0 12px 34px rgba(var(--pf-shadow-rgb),.07)",
  flexWrap: "wrap",
};

const heroCopy = { flex: "1 1 680px", minWidth: 0 };
const heroEyebrow = { color: "#2563eb", fontSize: 9, fontWeight: 950, letterSpacing: ".14em" };
const heroTitle = { margin: "7px 0 0", fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.02, letterSpacing: "-.045em", fontWeight: 950, color: "var(--pf-text-strong)" };
const heroText = { maxWidth: 890, margin: "10px 0 0", color: "var(--pf-text-muted)", fontSize: 12, fontWeight: 650, lineHeight: 1.65 };
const heroActions = { display: "flex", alignItems: "stretch", gap: 9, flexWrap: "wrap" };
const healthBlock = (exceptions) => ({ minWidth: 150, padding: "11px 13px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", background: exceptions > 0 ? "rgba(220,38,38,.07)" : "rgba(22,163,74,.07)", border: `1px solid ${exceptions > 0 ? "rgba(220,38,38,.18)" : "rgba(22,163,74,.18)"}` });
const healthLabel = { fontSize: 8, fontWeight: 950, letterSpacing: ".1em", color: "var(--pf-text-muted)" };
const dangerAction = { minHeight: 46, alignSelf: "center", padding: "0 15px", borderRadius: 9, border: "1px solid rgba(220,38,38,.25)", background: "linear-gradient(135deg,#b91c1c,#dc2626)", color: "#fff", fontSize: 10.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" };

const metricGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 10 };
const metricCard = (accent) => ({ position: "relative", overflow: "hidden", minHeight: 122, padding: 14, borderRadius: 12, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 6px 20px rgba(var(--pf-shadow-rgb),.05)" });
const metricAccent = (accent) => ({ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent });
const metricTop = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const metricLabel = { color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" };
const metricSignal = (accent) => ({ padding: "3px 6px", borderRadius: 6, color: accent, background: `${accent}10`, border: `1px solid ${accent}20`, fontSize: 7.5, fontWeight: 950, letterSpacing: ".05em" });
const metricValue = { marginTop: 10, fontSize: 28, lineHeight: 1, fontWeight: 950, letterSpacing: "-.04em", color: "var(--pf-text-strong)" };
const metricDetail = { marginTop: 8, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700, lineHeight: 1.45 };

const overviewGrid = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 };
const twoColumn = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(390px,1fr))", gap: 12 };
const panel = { minWidth: 0, padding: 16, borderRadius: 13, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.055)" };
const sectionHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 13, flexWrap: "wrap" };
const sectionEyebrow = { color: "#2563eb", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" };
const sectionTitle = { marginTop: 4, color: "var(--pf-text-strong)", fontSize: 16, fontWeight: 950, letterSpacing: "-.02em" };
const sectionSubtitle = { marginTop: 4, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 650, lineHeight: 1.5 };
const signalList = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(225px,1fr))", gap: 8 };
const signalCard = (tone) => ({ padding: 11, borderRadius: 9, background: tone.soft, border: `1px solid ${tone.border}` });
const signalCardTop = { display: "flex", alignItems: "center", gap: 7, color: "var(--pf-text-strong)", fontSize: 10.5 };
const signalText = { marginTop: 6, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 650, lineHeight: 1.5 };
const severityDot = { width: 7, height: 7, flexShrink: 0, borderRadius: "50%" };
const progressList = { display: "flex", flexDirection: "column", gap: 12 };
const progressRow = { paddingBottom: 10, borderBottom: "1px solid var(--pf-border-soft)" };
const progressHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const progressLabel = { color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 900 };
const progressDetail = { marginTop: 2, color: "var(--pf-text-muted)", fontSize: 8.7, fontWeight: 650 };
const progressValue = { color: "var(--pf-text-strong)", fontSize: 12 };
const progressTrack = { height: 5, marginTop: 8, borderRadius: 999, overflow: "hidden", background: "rgba(var(--pf-fg-rgb),.07)" };
const progressFill = { height: "100%", borderRadius: 999 };
const chartBody = { minHeight: 325 };
const exceptionList = { display: "flex", flexDirection: "column", gap: 2 };
const exceptionRow = { minHeight: 52, padding: "8px 3px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: "1px solid var(--pf-border-soft)" };
const exceptionIdentity = { display: "flex", alignItems: "center", gap: 9, minWidth: 0 };
const exceptionLabel = { color: "var(--pf-text-strong)", fontSize: 9.8, fontWeight: 900 };
const exceptionDetail = { marginTop: 2, color: "var(--pf-text-muted)", fontSize: 8.4, fontWeight: 650, lineHeight: 1.35 };
const exceptionValue = (tone) => ({ minWidth: 34, height: 28, padding: "0 7px", display: "grid", placeItems: "center", borderRadius: 7, color: tone.accent, background: tone.soft, border: `1px solid ${tone.border}`, fontSize: 11, fontWeight: 950 });

const workspacePanel = { marginTop: 12, padding: 16, borderRadius: 13, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 10px 28px rgba(var(--pf-shadow-rgb),.06)" };
const workspaceHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" };
const tabs = { display: "flex", gap: 4, padding: 3, borderRadius: 9, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border)", flexWrap: "wrap" };
const tabButton = (active) => ({ minHeight: 31, padding: "0 10px", borderRadius: 6, border: active ? "1px solid rgba(37,99,235,.2)" : "1px solid transparent", background: active ? "var(--pf-surface)" : "transparent", color: active ? "#2563eb" : "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" });
const secondaryButton = { minHeight: 34, padding: "0 11px", borderRadius: 8, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", fontSize: 9.5, fontWeight: 850, cursor: "pointer", fontFamily: "inherit" };
const stack = { display: "flex", flexDirection: "column", gap: 12 };

const legacyCard = (accent, clickable) => ({ minWidth: 0, minHeight: 110, padding: 13, textAlign: "left", borderRadius: 11, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", color: "var(--pf-text-strong)", cursor: clickable ? "pointer" : "default", fontFamily: "inherit" });
const legacyHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const legacyIcon = (accent) => ({ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 8, color: accent, background: `${accent}10`, border: `1px solid ${accent}20`, fontSize: 10, fontWeight: 950 });
const legacyTrend = (accent) => ({ color: accent, fontSize: 9, fontWeight: 900 });
const legacyTitle = { marginTop: 9, color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".06em" };
const legacyValue = { marginTop: 4, color: "var(--pf-text-strong)", fontSize: 24, fontWeight: 950 };
const legacySubtle = { marginTop: 4, color: "var(--pf-text-muted)", fontSize: 8.7, fontWeight: 650 };
const legacyTrendLabel = { marginTop: 4, color: "var(--pf-text-dim)", fontSize: 8.2, fontWeight: 650 };
