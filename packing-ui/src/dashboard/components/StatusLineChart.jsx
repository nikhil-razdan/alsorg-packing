function StatusLineChart({ packed, dispatched, pending }) {
  const max = Math.max(packed, dispatched, pending, 1);

  const scaleY = (value) => 140 - (value / max) * 100;

  return (
    <div style={card}>
      <h3 style={title}>Warehouse Status</h3>

      <svg width="220" height="160">
        {/* Grid */}
        <line x1="30" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.25)" />
        <line x1="30" y1="40" x2="190" y2="40" stroke="rgba(255,255,255,0.15)" />

        {/* Line */}
        <polyline
          fill="none"
          stroke="rgba(191,219,254,0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`
            50,${scaleY(packed)}
            110,${scaleY(dispatched)}
            170,${scaleY(pending)}
          `}
        />

        {/* Points */}
        <circle cx="50" cy={scaleY(packed)} r="4" fill="rgba(191,219,254,0.95)" />
        <circle cx="110" cy={scaleY(dispatched)} r="4" fill="rgba(167,243,208,0.95)" />
        <circle cx="170" cy={scaleY(pending)} r="4" fill="rgba(254,243,199,0.95)" />
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

export default StatusLineChart;
