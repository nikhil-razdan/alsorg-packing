import { useState } from "react";

function VehicleManagement() {
  const [vehicles] = useState([
    {
      id: 1,
      number: "HR55AB1234",
      type: "Truck",
      status: "ACTIVE",
      fuel: "78%",
    },
    {
      id: 2,
      number: "DL01XY8899",
      type: "Mini Truck",
      status: "MAINTENANCE",
      fuel: "41%",
    },
  ]);

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Fleet Management
          </div>

          <div style={subtitle}>
            Vehicles, fuel and maintenance
          </div>
        </div>

        <button style={button}>
          + Add Vehicle
        </button>
      </div>

      <div style={table}>
        <div style={tableHead}>
          <div>Vehicle</div>
          <div>Type</div>
          <div>Status</div>
          <div>Fuel</div>
        </div>

        {vehicles.map((v) => (
          <div
            key={v.id}
            style={tableRow}
          >
            <div>{v.number}</div>
            <div>{v.type}</div>
            <div>{v.status}</div>
            <div>{v.fuel}</div>
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

const tableHead = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",
  padding: 16,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

export default VehicleManagement;