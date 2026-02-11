function StatusBarChart({ packed, dispatched, pending }) {
  const max = Math.max(packed, dispatched, pending, 1);

  const scaleH = (value) => (value / max) * 90;

  return (
    <div style={card}>
      <h3 style={title}>Warehouse Status</h3>

      <svg width="220" height="160">
        {/* Packed */}
        <rect
          x="40"
          y={140 - scaleH(packed)}
          width="30"
          height={scaleH(packed)}
          rx="6"
          fill="rgba(191,219,254,0.95)"
        />

        {/* Dispatched */}
        <rect
          x="95"
          y={140 - scaleH(dispatched)}
          width="30"
          height={scaleH(dispatched)}
          rx="6"
          fill="rgba(167,243,208,0.95)"
        />

        {/* Pending */}
        <rect
          x="150"
          y={140 - scaleH(pending)}
          width="30"
          height={scaleH(pending)}
          rx="6"
          fill="rgba(254,243,199,0.95)"
        />

        {/* Base line */}
        <line
          x1="30"
          y1="140"
          x2="190"
          y2="140"
          stroke="rgba(255,255,255,0.25)"
        />
      </svg>

      <div style={legend}>
        <Legend color="rgba(191,219,254,0.95)" label={`Packed (${packed})`} />
        <Legend color="rgba(167,243,208,0.95)" label={`Dispatched (${dispatched})`} />
        <Legend color="rgba(254,243,199,0.95)" label={`Pending (${pending})`} />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={legendItem}>
      <span style={{ ...dot, background: color }} />
      {label}
    </div>
  );
}

/* ===================== STYLES ===================== */

const card = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  textAlign: "center",
};

const title = {
  marginBottom: 18,
  fontSize: 20,
  fontWeight: 700,
};

const legend = {
  marginTop: 12,
  display: "flex",
  justifyContent: "center",
  gap: 14,
  fontSize: 12,
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
