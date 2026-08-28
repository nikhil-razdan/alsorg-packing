import React from "react";

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const entries = (data = {}, limit = 8) =>
  Object.entries(data || {})
    .map(([label, value]) => [label, number(value)])
    .filter(([, value]) => value !== 0)
    .slice(-limit);

function LineChart({ data = {} }) {
  const rows = entries(data, 12);
  const max = Math.max(...rows.map(([, value]) => value), 1);

  if (rows.length === 0) {
    return <Empty text="No trip history available" />;
  }

  const points = rows
    .map(([, value], index) => {
      const x = 22 + (index / Math.max(rows.length - 1, 1)) * 516;
      const y = 174 - (value / max) * 128;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div style={lineWrap}>
      <svg width="100%" height="210" viewBox="0 0 560 210" preserveAspectRatio="none">
        {[46, 78, 110, 142, 174].map((y) => (
          <line
            key={y}
            x1="22"
            y1={y}
            x2="538"
            y2={y}
            stroke="rgba(148,163,184,.10)"
            strokeDasharray="4 6"
          />
        ))}
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {rows.map(([, value], index) => {
          const x = 22 + (index / Math.max(rows.length - 1, 1)) * 516;
          const y = 174 - (value / max) * 128;
          return <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#2563eb" />;
        })}
      </svg>
      <div style={axisLabels}>
        {rows.map(([label]) => (
          <span key={label}>{String(label).slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

function Bars({ data = {}, emptyText = "No data available" }) {
  const rows = entries(data, 7).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, value]) => value), 1);

  if (rows.length === 0) {
    return <Empty text={emptyText} />;
  }

  return (
    <div style={barsWrap}>
      {rows.map(([label, value]) => (
        <div key={label} style={barRow}>
          <div style={barTop}>
            <span style={barLabel} title={label}>{label}</span>
            <strong style={barValue}>{value}</strong>
          </div>
          <div style={track}>
            <div style={{ ...fill, width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div style={metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Empty({ text }) {
  return <div style={empty}>{text}</div>;
}

function AnalyticsGrid({ data }) {
  if (!data) return null;

  return (
    <div style={grid}>
      <div style={summaryCard}>
        <div style={sectionHead}>
          <div>
            <div style={eyebrow}>LOGISTICS FACT BASE</div>
            <div style={title}>Recorded operating position</div>
          </div>
          <div style={note}>No invented efficiency threshold</div>
        </div>

        <div style={metricGrid}>
          <Metric label="Trips" value={number(data.totalTrips)} detail="Recorded shift trips" />
          <Metric label="Loaders" value={number(data.totalLoaders)} detail="Recorded loader count" />
          <Metric label="Drivers" value={number(data.activeDrivers)} detail="Driver master records" />
          <Metric label="Vehicles" value={number(data.activeVehicles)} detail="Vehicle master records" />
          <Metric
            label="Trips / Driver"
            value={number(data.averageTripsPerDriver).toFixed(1)}
            detail="Historical aggregate"
          />
          <Metric
            label="Trips / Vehicle"
            value={number(data.averageTripsPerVehicle).toFixed(1)}
            detail="Historical aggregate"
          />
        </div>
      </div>

      <div style={wideCard}>
        <div style={cardTitle}>Trips over time</div>
        <div style={cardSub}>Database-recorded shift trip totals by date</div>
        <LineChart data={data.tripsOverTime} />
      </div>

      <div style={card}>
        <div style={cardTitle}>Route mix</div>
        <div style={cardSub}>Trips grouped by route category</div>
        <Bars data={data.tripsByLocation} emptyText="No route distribution available" />
      </div>

      <div style={card}>
        <div style={cardTitle}>Vehicle trip utilization</div>
        <div style={cardSub}>Recorded trips by vehicle</div>
        <Bars data={data.vehicleUtilization} emptyText="No vehicle utilization available" />
      </div>

      <div style={card}>
        <div style={cardTitle}>Shift status mix</div>
        <div style={cardSub}>Trip totals grouped by current shift status</div>
        <Bars data={data.shiftPerformance} emptyText="No shift-status data available" />
      </div>
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 12,
};

const cardBase = {
  minWidth: 0,
  padding: 16,
  borderRadius: 12,
  background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 8px 22px rgba(var(--pf-shadow-rgb),.055)",
  color: "var(--pf-text-strong)",
};

const card = { ...cardBase };
const wideCard = { ...cardBase, gridColumn: "1 / -1" };
const summaryCard = { ...cardBase, gridColumn: "1 / -1" };

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrow = {
  color: "#2563eb",
  fontSize: 8,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const title = {
  marginTop: 4,
  fontSize: 15,
  fontWeight: 950,
};

const note = {
  color: "var(--pf-text-muted)",
  fontSize: 9.5,
  fontWeight: 750,
};

const metricGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
  gap: 8,
  marginTop: 14,
};

const metric = {
  minWidth: 0,
  padding: 11,
  borderRadius: 9,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "var(--pf-text-muted)",
  fontSize: 8.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const cardTitle = {
  color: "var(--pf-text-strong)",
  fontSize: 13,
  fontWeight: 950,
};

const cardSub = {
  marginTop: 4,
  marginBottom: 12,
  color: "var(--pf-text-muted)",
  fontSize: 9.5,
  fontWeight: 700,
};

const lineWrap = { minHeight: 220 };
const axisLabels = {
  display: "flex",
  justifyContent: "space-between",
  gap: 4,
  color: "var(--pf-text-dim)",
  fontSize: 8,
  fontWeight: 750,
  overflow: "hidden",
};

const barsWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 11,
};

const barRow = { minWidth: 0 };
const barTop = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 5,
};
const barLabel = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--pf-text)",
  fontSize: 9.5,
  fontWeight: 800,
};
const barValue = {
  color: "var(--pf-text-strong)",
  fontSize: 9.5,
  fontWeight: 950,
};
const track = {
  height: 5,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(var(--pf-fg-rgb),.07)",
};
const fill = {
  height: "100%",
  minWidth: 3,
  borderRadius: 999,
  background: "linear-gradient(90deg,#60a5fa,#2563eb)",
};
const empty = {
  minHeight: 120,
  display: "grid",
  placeItems: "center",
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 750,
};

export default AnalyticsGrid;
