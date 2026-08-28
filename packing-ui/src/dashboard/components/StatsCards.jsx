const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function StatCard({
  title,
  value,
  subtitle,
  accent,
  signal,
  onClick,
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} style={{ ...statCard(accent), ...(onClick ? clickableCard : {}) }}>
      <div style={topLine(accent)} />
      <div style={headerRow}>
        <span style={signalPill(accent)}>{signal}</span>
        <span style={liveLabel}>LIVE</span>
      </div>
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>{value}</div>
      <div style={subtitleStyle}>{subtitle}</div>
      {onClick && <div style={inspectHint}>Inspect →</div>}
    </Tag>
  );
}

function StatsCards({ stats = {}, onInspectMetric }) {
  const exceptions =
    safeNumber(stats.masterItemsWithoutPackets) +
    safeNumber(stats.packetsWithoutPacketItems) +
    safeNumber(stats.packetItemsWithoutMaster) +
    safeNumber(stats.duplicateCurrentStickers) +
    safeNumber(stats.readyItemsStillInPkd) +
    safeNumber(stats.dispatchedWithoutPacketItem) +
    safeNumber(stats.dispatchedWithoutChallan) +
    safeNumber(stats.dispatchedWithoutDriver);

  const packingBacklog = safeNumber(
    stats.packetItemsPendingSticker ?? stats.pendingItems
  );

  return (
    <div style={grid}>
      <StatCard
        title="Control Exceptions"
        value={exceptions}
        subtitle="Current + legacy linkage/control exceptions"
        accent={exceptions > 0 ? "#dc2626" : "#16a34a"}
        signal={exceptions > 0 ? "ACTION" : "CLEAR"}
        onClick={onInspectMetric ? () => onInspectMetric("exceptions") : undefined}
      />

      <StatCard
        title="Packing Backlog"
        value={packingBacklog}
        subtitle="Packet items still awaiting sticker completion"
        accent="#d97706"
        signal={packingBacklog > 0 ? "OPEN" : "CLEAR"}
        onClick={onInspectMetric ? () => onInspectMetric("pending") : undefined}
      />

      <StatCard
        title="Ready To Dispatch"
        value={safeNumber(stats.readyToDispatchItems)}
        subtitle="Finished-goods items available for outbound conversion"
        accent="#2563eb"
        signal="FG"
        onClick={onInspectMetric ? () => onInspectMetric("readyToDispatch") : undefined}
      />

      <StatCard
        title="Today Throughput"
        value={
          safeNumber(stats.todayStickerGenerated) +
          safeNumber(stats.todayDispatchChallans)
        }
        subtitle={`${safeNumber(stats.todayStickerGenerated)} stickers • ${safeNumber(stats.todayDispatchChallans)} dispatch challans`}
        accent="#0f766e"
        signal="TODAY"
        onClick={onInspectMetric ? () => onInspectMetric("dailyThroughput") : undefined}
      />
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 10,
};

const statCard = (accent) => ({
  position: "relative",
  minWidth: 0,
  minHeight: 128,
  overflow: "hidden",
  padding: 14,
  borderRadius: 12,
  color: "var(--pf-text-strong)",
  background:
    `radial-gradient(circle at 100% 0%,${accent}0D,transparent 44%),linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))`,
  border: "1px solid var(--pf-border)",
  boxShadow: "0 8px 20px rgba(var(--pf-shadow-rgb),.055)",
});

const topLine = (accent) => ({
  position: "absolute",
  inset: "0 14px auto 14px",
  height: 2,
  borderRadius: "0 0 999px 999px",
  background: accent,
  opacity: .8,
});

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const signalPill = (accent) => ({
  display: "inline-flex",
  minHeight: 21,
  alignItems: "center",
  padding: "0 8px",
  borderRadius: 999,
  color: accent,
  background: `${accent}0D`,
  border: `1px solid ${accent}22`,
  fontSize: 7.5,
  fontWeight: 950,
  letterSpacing: ".08em",
});

const liveLabel = {
  color: "var(--pf-text-dim)",
  fontSize: 7.5,
  fontWeight: 950,
  letterSpacing: ".08em",
};

const titleStyle = {
  marginTop: 11,
  color: "var(--pf-text-muted)",
  fontSize: 8.7,
  fontWeight: 950,
  letterSpacing: ".055em",
  textTransform: "uppercase",
};

const valueStyle = {
  marginTop: 6,
  color: "var(--pf-text-strong)",
  fontSize: 29,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-.035em",
};

const subtitleStyle = {
  marginTop: 7,
  color: "var(--pf-text-muted)",
  fontSize: 9.2,
  fontWeight: 700,
  lineHeight: 1.45,
};

export default StatsCards;

const clickableCard = { width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
const inspectHint = { marginTop: 7, color: "#2563eb", fontSize: 8.2, fontWeight: 900 };
