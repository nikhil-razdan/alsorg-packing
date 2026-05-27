function DriverManagement() {
  const drivers = [
    {
      id: 1,
      name: "Ramesh",
      phone: "9876543210",
      status: "AVAILABLE",
    },
    {
      id: 2,
      name: "Suresh",
      phone: "9898989898",
      status: "ON_TRIP",
    },
  ];

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Driver Management
          </div>

          <div style={subtitle}>
            Driver operations and status
          </div>
        </div>

        <button style={button}>
          + Add Driver
        </button>
      </div>

      <div style={table}>
        <div style={head}>
          <div>Name</div>
          <div>Phone</div>
          <div>Status</div>
        </div>

        {drivers.map((d) => (
          <div
            key={d.id}
            style={row}
          >
            <div>{d.name}</div>
            <div>{d.phone}</div>
            <div>{d.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
};

const button = {
  height: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 700,
};

const table = {
  borderRadius: 18,
  overflow: "hidden",
};

const head = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",
  padding: 16,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

export default DriverManagement;
