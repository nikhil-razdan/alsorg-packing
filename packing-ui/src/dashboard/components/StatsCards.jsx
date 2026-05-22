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
  padding: "18px 20px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
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
  fontSize: 12,
  color: "#64748b",
  fontWeight: 600,
};

const statValue = {
  fontSize: 22,
  fontWeight: 700,
  color: "#0f172a",
};

export default StatsCards;
