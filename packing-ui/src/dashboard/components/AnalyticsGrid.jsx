import React from "react";

/*
========================================
HELPERS
========================================
*/

function formatMap(data = {}) {
  return Object.entries(data || {}).slice(0, 10);
}

/*
========================================
LINE CHART
========================================
*/

function TripsLineChart({ data = {} }) {
  const entries = formatMap(data);

  const max = Math.max(
    ...entries.map((e) => Number(e[1] || 0)),
    1
  );

  const points = entries
    .map(([_, value], i) => {
      const x =
        (i / Math.max(entries.length - 1, 1)) * 540;

      const y =
        180 - ((value || 0) / max) * 140;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height="220"
      viewBox="0 0 560 220"
    >
      <polyline
        fill="none"
        stroke="#3b82f6"
        strokeWidth="4"
        points={points}
        strokeLinecap="round"
      />
    </svg>
  );
}

/*
========================================
HORIZONTAL BAR
========================================
*/

function HorizontalBars({
  data = {},
  color = "#3b82f6",
}) {
  const entries = formatMap(data);

  const max = Math.max(
    ...entries.map((e) => Number(e[1] || 0)),
    1
  );

  return (
    <div style={barsWrap}>
      {entries.map(([key, value]) => (
        <div key={key} style={barRow}>
          <div style={barLabel}>
            {key}
          </div>

          <div style={barTrack}>
            <div
              style={{
                ...barFill(color),
                width: `${(value / max) * 100}%`,
              }}
            />
          </div>

          <div style={barValue}>
            {Number(value || 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

/*
========================================
DONUT
========================================
*/

function RouteDistribution({ data = {} }) {
  const entries = formatMap(data);

  const total =
    entries.reduce(
      (acc, [, value]) => acc + Number(value || 0),
      0
    ) || 1;

  const colors = [
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#22c55e",
    "#ef4444",
  ];


  return (
    <div style={donutWrap}>
      <svg width="220" height="220">
	  {entries.map(([key, value], index) => {
	    const percentage =
	      Number(value || 0) / total;

	    const dash =
	      percentage * 565;

	    const offset = entries
	      .slice(0, index)
	      .reduce((acc, [, val]) => {
	        return (
	          acc +
	          (Number(val || 0) / total) * 565
	        );
	      }, 0);

	    return (
	      <circle
	        key={key}
	        r="90"
	        cx="110"
	        cy="110"
	        fill="transparent"
	        stroke={colors[index % colors.length]}
	        strokeWidth="22"
	        strokeDasharray={`${dash} ${565 - dash}`}
	        strokeDashoffset={-offset}
	        transform="rotate(-90 110 110)"
	      />
	    );
	  })}
      </svg>

      <div style={legendWrap}>
        {entries.map(([key], index) => (
          <div key={key} style={legendRow}>
            <div
              style={{
                ...legendDot,
                background:
                  colors[index % colors.length],
              }}
            />
            <span>{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
========================================
ALERTS
========================================
*/

function AlertsPanel({ data }) {
  const alerts = [];

  if (data?.efficiency < 70) {
    alerts.push(
      "Average loaders per trip is low"
    );
  }

  if (
    Number(data?.averageTripsPerDriver || 0) >
    20
  ) {
    alerts.push(
      "Driver workload is high"
    );
  }

  if (
    Number(data?.activeVehicles || 0) < 2
  ) {
    alerts.push(
      "Low active fleet count"
    );
  }

  return (
    <div style={alertsWrap}>
      {alerts.length === 0 && (
        <div style={goodAlert}>
          ✅ Operations running normally
        </div>
      )}

      {alerts.map((a, i) => (
        <div key={i} style={alertItem}>
          ⚠ {a}
        </div>
      ))}
    </div>
  );
}

/*
========================================
MAIN
========================================
*/

function AnalyticsGrid({ data }) {
  if (!data) return null;

  return (
    <div style={grid}>
      <div style={wideCard}>
        <div style={title}>
          Trips Over Time
        </div>

        <TripsLineChart
          data={data.tripsOverTime}
        />
      </div>

      <div style={card}>
        <div style={title}>
          Driver Performance
        </div>

        <HorizontalBars
          data={data.driverPerformance}
          color="#22c55e"
        />
      </div>

      <div style={card}>
        <div style={title}>
          Vehicle Utilization
        </div>

        <HorizontalBars
          data={data.vehicleUtilization}
          color="#f59e0b"
        />
      </div>

      <div style={card}>
        <div style={title}>
          Trips By Route
        </div>

        <RouteDistribution
          data={data.tripsByLocation}
        />
      </div>

      <div style={card}>
        <div style={title}>
          Shift Performance
        </div>

        <HorizontalBars
          data={data.shiftPerformance}
          color="#8b5cf6"
        />
      </div>

      <div style={card}>
        <div style={title}>
          Alerts & Insights
        </div>

        <AlertsPanel data={data} />
      </div>
    </div>
  );
}

/*
========================================
STYLES
========================================
*/

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 14,
  alignItems: "stretch",
};

const card = {
  minWidth: 0,
  background:
    "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  borderRadius: 16,
  padding: 18,
  border: "1px solid var(--pf-border)",
  boxShadow: "0 10px 26px rgba(var(--pf-shadow-rgb),.07)",
  color: "var(--pf-text-strong)",
};

const wideCard = {
  ...card,
  gridColumn: "1 / -1",
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 18,
};

const barsWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const barRow = {
  display: "grid",
  gridTemplateColumns:
    "120px 1fr 40px",
  gap: 12,
  alignItems: "center",
};

const barLabel = {
  color: "var(--pf-text)",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barTrack = {
  height: 10,
  borderRadius: 999,
  background: "rgba(var(--pf-fg-rgb),.08)",
  overflow: "hidden",
};

const barFill = (color) => ({
  height: "100%",
  borderRadius: 999,
  background: color,
});

const barValue = {
  color: "var(--pf-text-strong)",
  fontSize: 12,
  fontWeight: 700,
};

const donutWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
};

const legendWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const legendRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--pf-text)",
  fontSize: 12,
};

const legendDot = {
  width: 12,
  height: 12,
  borderRadius: 999,
};

const alertsWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const alertItem = {
  padding: 12,
  borderRadius: 12,
  background:
    "rgba(239,68,68,0.15)",
  border:
    "1px solid rgba(239,68,68,0.3)",
  color: "color-mix(in srgb,#dc2626 78%,var(--pf-text-strong))",
  fontSize: 13,
  fontWeight: 700,
};

const goodAlert = {
  padding: 12,
  borderRadius: 12,
  background:
    "rgba(34,197,94,0.15)",
  border:
    "1px solid rgba(34,197,94,0.3)",
  color: "color-mix(in srgb,#059669 78%,var(--pf-text-strong))",
  fontSize: 13,
  fontWeight: 700,
};

export default AnalyticsGrid;