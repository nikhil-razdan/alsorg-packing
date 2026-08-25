function FleetOverview({
  totalVehicles = 0,
  activeVehicles = 0,
  utilization = 0,
}) {
  return (
    <div style={wrap}>
      <div style={title}>
        Fleet Overview
      </div>

      <div style={grid}>
        <Card
          title="Registered Vehicles"
          value={totalVehicles}
        />

        <Card
          title="Vehicles Assigned"
          value={activeVehicles}
        />

        <Card
          title="Fleet Utilization"
          value={`${Number(
            utilization || 0
          ).toFixed(0)}%`}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}) {
  return (
    <div style={card}>
      <div style={cardTitle}>
        {title}
      </div>

      <div style={cardValue}>
        {value}
      </div>
    </div>
  );
}

const wrap = {
  marginTop: 20,
  padding: 20,
  borderRadius: 18,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
  boxShadow: "var(--pf-card-shadow)",
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 22,
  fontWeight: 900,
  marginBottom: 16,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
  gap: 12,
};

const card = {
  background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
  padding: 18,
  borderRadius: 14,
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 7px 18px rgba(var(--pf-shadow-rgb),.05)",
};

const cardTitle = {
  color: "var(--pf-text-muted)",
  fontWeight: 750,
  fontSize: 12,
};

const cardValue = {
  color: "var(--pf-text-strong)",
  fontSize: 28,
  fontWeight: 900,
  marginTop: 8,
};

export default FleetOverview;