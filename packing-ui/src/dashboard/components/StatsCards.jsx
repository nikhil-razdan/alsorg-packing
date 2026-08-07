const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

function StatCard({
  title,
  value,
  subtitle,
  accent,
  icon,
}) {
  return (
    <div style={statCard(accent)}>
      <div style={topAccent(accent)} />

      <div style={cardHeader}>
        <div style={iconBox(accent)}>
          {icon}
        </div>

        <div style={liveBadge}>
          <span style={liveDot(accent)} />
          LIVE
        </div>
      </div>

      <div style={statTitle}>
        {title}
      </div>

      <div style={statValue}>
        {value}
      </div>

      <div style={statSubtitle}>
        {subtitle}
      </div>
    </div>
  );
}

function StatsCards({
  stats = {},
}) {
  return (
    <div style={statsRow}>
      <StatCard
        title="Dispatch Warehouse Inventory"
        value={safeNumber(
          stats.totalItems
        )}
        subtitle="Current tracked inventory"
        accent="#60a5fa"
        icon="▣"
      />

      <StatCard
        title="Stickers Generated"
        value={safeNumber(
          stats.stickersGenerated
        )}
        subtitle="Sticker history records"
        accent="#22c55e"
        icon="◇"
      />

      <StatCard
        title="Pending Stickers"
        value={safeNumber(
          stats.pendingItems
        )}
        subtitle="Items awaiting sticker generation"
        accent="#f59e0b"
        icon="◷"
      />
    </div>
  );
}

const statsRow = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: 12,
};

const statCard = (accent) => ({
  position: "relative",
  minWidth: 0,
  minHeight: 138,
  overflow: "hidden",
  padding: 14,
  borderRadius: 17,
  color: "#fff",
  background:
    `radial-gradient(circle at 100% 0%,${accent}12,transparent 42%),linear-gradient(160deg,rgba(30,41,59,.72),rgba(15,23,42,.92))`,
  border:
    "1px solid rgba(148,163,184,.09)",
  boxShadow:
    "0 12px 28px rgba(2,6,23,.20), inset 0 1px 0 rgba(255,255,255,.02)",
});

const topAccent = (accent) => ({
  position: "absolute",
  top: 0,
  left: 18,
  right: 18,
  height: 2,
  borderRadius:
    "0 0 999px 999px",
  background:
    `linear-gradient(90deg,transparent,${accent},transparent)`,
});

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const iconBox = (accent) => ({
  width: 31,
  height: 31,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  color: accent,
  background: `${accent}10`,
  border: `1px solid ${accent}20`,
  fontSize: 11,
  fontWeight: 950,
});

const liveBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "#536177",
  fontSize: 6.7,
  fontWeight: 950,
  letterSpacing: ".05em",
};

const liveDot = (accent) => ({
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: accent,
  boxShadow:
    `0 0 7px ${accent}55`,
});

const statTitle = {
  marginTop: 12,
  color: "#8b9aaf",
  fontSize: 8.4,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const statValue = {
  marginTop: 6,
  color: "#fff",
  fontSize: 27,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-.035em",
};

const statSubtitle = {
  marginTop: 7,
  color: "#536177",
  fontSize: 8,
  fontWeight: 700,
  lineHeight: 1.4,
};

export default StatsCards;
