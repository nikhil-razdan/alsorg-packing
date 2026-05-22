function StatusBarChart({ packed, dispatched, pending, darkMode = false }) {
  const max = Math.max(packed, dispatched, pending, 1);

  const scaleH = (value) => (value / max) * 90;

  return (
    <div style={card(darkMode)}>
      <h3 style={title(darkMode)}>Warehouse Status</h3>

      <svg width="220" height="160">
        <rect
          x="40"
          y={140 - scaleH(packed)}
          width="30"
          height={scaleH(packed)}
          rx="6"
          fill="rgba(96,165,250,0.95)"
        />

        <rect
          x="95"
          y={140 - scaleH(dispatched)}
          width="30"
          height={scaleH(dispatched)}
          rx="6"
          fill="rgba(52,211,153,0.95)"
        />

        <rect
          x="150"
          y={140 - scaleH(pending)}
          width="30"
          height={scaleH(pending)}
          rx="6"
          fill="rgba(251,191,36,0.95)"
        />

        <line
          x1="30"
          y1="140"
          x2="190"
          y2="140"
          stroke={darkMode ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)"}
        />
      </svg>

      <div style={legend}>
        <Legend color="rgba(96,165,250,0.95)" label={`Packed (${packed})`} darkMode={darkMode} />
        <Legend color="rgba(52,211,153,0.95)" label={`Dispatched (${dispatched})`} darkMode={darkMode} />
        <Legend color="rgba(251,191,36,0.95)" label={`Pending (${pending})`} darkMode={darkMode} />
      </div>
    </div>
  );
}

function Legend({ color, label, darkMode }) {
  return (
    <div style={legendItem}>
      <span style={{ ...dot, background: color }} />
      <span style={{ color: darkMode ? "#334155" : "#475569" }}>{label}</span>
    </div>
  );
}

const card = (darkMode) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  stroke: "#6366f1",
  fill: "#6366f1",
  textAlign: "center",
});

const title = (darkMode) => ({
  marginBottom: 18,
  fontSize: 20,
  fontWeight: 800,
  stroke: "#6366f1",
  fill: "#6366f1"
});

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

export default StatusBarChart;