function FleetOverview() {
  return (
    <div style={wrap}>
      <div style={title}>
        Fleet Overview
      </div>

      <div style={grid}>
        <Card
          title="Vehicles Active"
          value="18"
        />

        <Card
          title="Maintenance Due"
          value="3"
        />

        <Card
          title="Fuel Efficiency"
          value="81%"
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
  marginTop: 24,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
  marginBottom: 18,
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 18,
};

const card = {
  background:
    "linear-gradient(180deg,#111827,#0f172a)",

  padding: 22,

  borderRadius: 20,
};

const cardTitle = {
  color: "#94a3b8",
};

const cardValue = {
  color: "#fff",
  fontSize: 30,
  fontWeight: 800,
  marginTop: 10,
};

export default FleetOverview;