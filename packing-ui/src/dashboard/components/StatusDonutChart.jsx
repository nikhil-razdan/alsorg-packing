function StatusDonutChart({ warehouse = 0, readyToDispatch = 0, ready = 0 }) {
  const total = warehouse + readyToDispatch + ready || 1;

  const radius = 70;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;

  const warehouseLen = (warehouse / total) * circumference;
  const readyToDispatchLen = (readyToDispatch / total) * circumference;
  const readyLen = (ready / total) * circumference;

  return (
    <div style={card}>
      <h3 style={title}>Inventory Status</h3>

      <svg width="200" height="200" viewBox="0 0 200 200">
        <g transform="rotate(-90 100 100)">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(96,165,250,0.95)"
            strokeWidth={stroke}
            strokeDasharray={`${warehouseLen} ${circumference}`}
            strokeDashoffset={0}
          />

          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(251,191,36,0.95)"
            strokeWidth={stroke}
            strokeDasharray={`${readyToDispatchLen} ${circumference}`}
            strokeDashoffset={-warehouseLen}
          />

          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(52,211,153,0.95)"
            strokeWidth={stroke}
            strokeDasharray={`${readyLen} ${circumference}`}
            strokeDashoffset={-(warehouseLen + readyToDispatchLen)}
          />
        </g>
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