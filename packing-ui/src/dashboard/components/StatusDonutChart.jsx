function StatusDonutChart({ packed, dispatched, pending }) {
  const total = packed + dispatched + pending || 1;

  const radius = 70;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;

  const packedLen = (packed / total) * circumference;
  const dispatchedLen = (dispatched / total) * circumference;
  const pendingLen = (pending / total) * circumference;

  return (
    <div style={card}>
      <h3 style={title}>Warehouse Status</h3>

      <svg width="200" height="200" viewBox="0 0 200 200">
        <g transform="rotate(-90 100 100)">
          <circle
            cx="100"
            cy="100"
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={`${pendingLen} ${circumference}`}
            strokeDashoffset={0}
          />

          <circle
            cx="100"
            cy="100"
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={`${packedLen} ${circumference}`}
            strokeDashoffset={-pendingLen}
          />

          <circle
            cx="100"
            cy="100"
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={`${dispatchedLen} ${circumference}`}
            strokeDashoffset={-(pendingLen + packedLen)}
          />
        </g>
      </svg>

      <div style={legend}>
        <Legend color= "rgba(255,255,255,.72)" label={`Packed (${packed})`} />
        <Legend color= "rgba(255,255,255,.72)" label={`Dispatched (${dispatched})`} />
        <Legend color= "rgba(255,255,255,.72)" label={`Pending (${pending})`} />
      </div>
    </div>
  );
}

function Legend({ color, label}) {
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

export default StatusDonutChart;