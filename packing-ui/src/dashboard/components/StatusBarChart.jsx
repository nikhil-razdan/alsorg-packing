function StatusBarChart({ packed, dispatched, pending}) {
  const max = Math.max(packed, dispatched, pending, 1);

  const scaleH = (value) => (value / max) * 90;

  return (
    <div style={card}>
      <h3 style={title}>Inventory Status</h3>

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
	    stroke="rgba(148,163,184,0.25)"
	  />
      </svg>

      <div style={legend}>
	  <Legend
	    color="rgba(96,165,250,0.95)"
	    label={`Packed (${packed})`}
	  />

	  <Legend
	    color="rgba(52,211,153,0.95)"
	    label={`Dispatched (${dispatched})`}
	  />

	  <Legend
	    color="rgba(251,191,36,0.95)"
	    label={`Pending (${pending})`}
	  />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={legendItem}>
      <span style={{ ...dot, background: color }} />
      <span style={{ color: "rgba(255,255,255,.72)" }}>{label}</span>
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

export default StatusBarChart;