import React from "react";

/* ===================== SIMPLE BAR ===================== */
function SimpleBar({ data = {} }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(e => e[1]), 1);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 120 }}>
      {entries.map(([key, value], i) => (
        <div key={i} style={{ textAlign: "center", flex: 1 }}>
          <div
            style={{
              height: `${(value / max) * 100}%`,
              background: "rgba(99,102,241,0.8)",
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 10, marginTop: 4 }}>{key}</div>
        </div>
      ))}
    </div>
  );
}

/* ===================== SIMPLE LINE ===================== */
function SimpleLine({ data = {} }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(e => e[1]), 1);

  return (
    <svg width="100%" height="140">
      {entries.map(([, value], i) => {
        const x = (i / (entries.length - 1 || 1)) * 200;
        const y = 120 - (value / max) * 100;
        return <circle key={i} cx={x} cy={y} r="4" fill="#6366f1" />;
      })}

      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        points={entries
          .map(([, value], i) => {
            const x = (i / (entries.length - 1 || 1)) * 200;
            const y = 120 - (value / max) * 100;
            return `${x},${y}`;
          })
          .join(" ")}
      />
    </svg>
  );
}

/* ===================== MAIN GRID ===================== */

function AnalyticsGrid({ data }) {
  if (!data) return null;

  return (
    <div style={grid}>
      <div style={card}>
        <h3>Trips Over Time</h3>
        <SimpleLine data={data.tripsOverTime} />
      </div>

      <div style={card}>
        <h3>Top Drivers</h3>
        <SimpleBar data={data.drivers} />
      </div>

      <div style={card}>
        <h3>Trips by Location</h3>
        <SimpleBar data={data.tripsByLocation} />
      </div>

      <div style={card}>
        <h3>Efficiency</h3>
        <div style={{ fontSize: 32 }}>
          {Number(data.efficiency || 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 14,
  marginBottom: 14,
};

const card = {
  padding: 16,
  borderRadius: 14,
  background: "rgba(255,255,255,0.2)",
  backdropFilter: "blur(10px)",
  color: "#fff",
};

export default AnalyticsGrid;