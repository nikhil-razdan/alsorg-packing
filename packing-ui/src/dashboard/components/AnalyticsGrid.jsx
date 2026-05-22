import React from "react";

/* ====================== BAR ====================== */

function SimpleBar({ data = {} }) {
  const entries = Object.entries(data);

  const max = Math.max(
    ...entries.map((e) => e[1]),
    1
  );

  return (
    <div style={barWrap}>
      {entries.map(([key, value], i) => (
        <div key={i} style={barCol}>
          <div
            style={{
              ...bar,
              height: `${(value / max) * 100}%`,
            }}
          />

          <div style={barLabel}>{key}</div>
        </div>
      ))}
    </div>
  );
}

/* ====================== LINE ====================== */

function SimpleLine({ data = {} }) {
  const entries = Object.entries(data);

  const max = Math.max(
    ...entries.map((e) => e[1]),
    1
  );

  const points = entries
    .map(([, value], i) => {
      const x =
        (i / (entries.length - 1 || 1)) * 280;

      const y =
        140 - (value / max) * 100;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height="170"
      viewBox="0 0 300 170"
    >
      <polyline
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/* ====================== MAIN ====================== */

function AnalyticsGrid({ data }) {
  if (!data) return null;

  return (
    <div style={grid}>
      <div style={card}>
        <div style={title}>Trips Over Time</div>
        <SimpleLine data={data.tripsOverTime} />
      </div>

      <div style={card}>
        <div style={title}>Top Drivers</div>
        <SimpleBar data={data.drivers} />
      </div>

      <div style={card}>
        <div style={title}>Trips By Location</div>
        <SimpleBar data={data.tripsByLocation} />
      </div>

      <div style={card}>
        <div style={title}>Efficiency</div>

        <div style={efficiency}>
          {Number(data.efficiency || 0).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

/* ====================== STYLES ====================== */

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 14,
  height: "100%",
};

const card = {
  borderRadius: 16,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  border: "1px solid rgba(0,0,0,0.05)",
  color: "#111827",
};

const title = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
  color: "#374151",
};

const barWrap = {
  display: "flex",
  alignItems: "flex-end",
  gap: 10,
  height: 140,
};

const barCol = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const bar = {
  width: "100%",
  borderRadius: 6,
  background: "#6366f1",
};

const barLabel = {
  marginTop: 8,
  fontSize: 10,
  opacity: 0.75,
};

const efficiency = {
  fontSize: 46,
  fontWeight: 900,
  marginTop: "auto",
};

export default AnalyticsGrid;