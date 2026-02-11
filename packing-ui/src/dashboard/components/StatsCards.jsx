function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      <div style={cardHighlight} />
      <p style={statTitle}>{title}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function StatsCards({ stats }) {
  return (
    <div style={statsRow}>
      <StatCard
        title="Total Dispatch Warehouse Inventory"
        value={stats.totalItems}
      />
      <StatCard
        title="Stickers Generated"
        value={stats.stickersGenerated}
      />
      <StatCard
        title="Pending Stickers"
        value={stats.pendingItems}
      />
    </div>
  );
}

/* ===================== STYLES (COPIED, NOT CHANGED) ===================== */

const statsRow = {
  display: "flex",
  gap: 26,
  marginBottom: 48,
};

const statCard = {
  position: "relative",
  flex: 1,
  padding: "26px 28px",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.18))",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow:
    "0 22px 55px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.45)",
  color: "#fff",
  overflow: "hidden",
};

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 70,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), transparent)",
  pointerEvents: "none",
};

const statTitle = {
  color: "rgba(255,255,255,0.78)",
  marginBottom: 10,
  fontSize: 14,
  fontWeight: 600,
};

const statValue = {
  margin: 0,
  fontSize: 32,
  fontWeight: 800,
};

export default StatsCards;
