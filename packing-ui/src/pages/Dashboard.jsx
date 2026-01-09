function StatCard({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        flex: 1,
      }}
    >
      <p style={{ color: "#6b7280", marginBottom: 8 }}>{title}</p>
      <h2 style={{ margin: 0 }}>{value}</h2>
    </div>
  );
}

function DashboardPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <StatCard title="Total Zoho Items" value="—" />
        <StatCard title="Stickers Generated" value="—" />
        <StatCard title="Pending Stickers" value="—" />
      </div>

      {/* Placeholder Section */}
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3>Activity</h3>
        <p style={{ color: "#6b7280" }}>
          Recent activity will appear here.
        </p>
      </div>
    </div>
  );
}

export default DashboardPage;
