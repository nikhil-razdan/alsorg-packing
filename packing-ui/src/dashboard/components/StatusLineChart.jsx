function StatusLineChart({ warehouse = 0, readyToDispatch = 0, ready = 0 }) {
  const max = Math.max(warehouse, readyToDispatch, ready, 1);

  const scaleY = (value) => 140 - (value / max) * 100;

  return (
    <div style={card}>
      <h3 style={title}>Inventory Status</h3>

      <svg width="220" height="160">
        <line
          x1="30"
          y1="140"
          x2="190"
          y2="140"
          stroke="rgba(148,163,184,0.25)"
        />

        <line
          x1="30"
          y1="40"
          x2="190"
          y2="40"
          stroke="rgba(148,163,184,0.16)"
        />

        <polyline
          stroke="rgba(96,165,250,0.95)"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`
            50,${scaleY(warehouse)}
            110,${scaleY(readyToDispatch)}
            170,${scaleY(ready)}
          `}
        />

        <circle
          cx="50"
          cy={scaleY(warehouse)}
          r="4"
          fill="rgba(96,165,250,0.95)"
        />

        <circle
          cx="110"
          cy={scaleY(readyToDispatch)}
          r="4"
          fill="rgba(251,191,36,0.95)"
        />

        <circle
          cx="170"
          cy={scaleY(ready)}
          r="4"
          fill="rgba(52,211,153,0.95)"
        />
      </svg>

      <div style={legend}>
        <Legend
          color="rgba(96,165,250,0.95)"
          label={`Warehouse (${warehouse})`}
        />

        <Legend
          color="rgba(251,191,36,0.95)"
          label={`Ready to Dispatch (${readyToDispatch})`}
        />

        <Legend
          color="rgba(52,211,153,0.95)"
          label={`Ready (${ready})`}
        />
      </div>
    </div>
  );
}

function Legend({ color, label}) {
  return (
    <div style={legendItem}>
      <span style={{ ...dot, background: color }} />
      <span style={{ color: "rgba(255,255,255,.72)"}}>{label}</span>
    </div>
  );
}

const card = {
  width: "100%",
  height: "100%",

  display: "flex",
  flexDirection: "column",

  alignItems: "center",
  justifyContent: "center",

  textAlign: "center",

  color: "#fff",
};

const title = {
  marginBottom: 20,

  fontSize: 22,

  fontWeight: 900,

  color: "#fff",

  letterSpacing: 0.3,
};

const legend = {
  marginTop: 12,
  display: "flex",
  justifyContent: "center",
  gap: 14,
  fontSize: 12,
  flexWrap: "wrap",
};

const legendItem = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const dot = {
  width: 10,
  height: 10,
  borderRadius: "50%",
};

export default StatusLineChart;