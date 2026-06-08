function StatusBarChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const items = [
    {
      label: "Warehouse",
      short: "WH",
      value: Number(warehouse || 0),
      color: "#60a5fa",
      gradientId: "barWarehouseGradient",
    },
    {
      label: "Ready to Dispatch",
      short: "RTD",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
      gradientId: "barDispatchGradient",
    },
    {
      label: "Ready",
      short: "RDY",
      value: Number(ready || 0),
      color: "#34d399",
      gradientId: "barReadyGradient",
    },
  ];

  const max = Math.max(...items.map((item) => item.value), 1);

  const chartHeight = 190;
  const baseY = 170;
  const maxBarHeight = 120;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>Status Volume</div>
          <div style={chartSubtitle}>
            Inventory count comparison by stage
          </div>
        </div>

        <div style={maxBadge}>
          Max {max}
        </div>
      </div>

      <svg
        width="100%"
        height={chartHeight}
        viewBox="0 0 360 190"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="barWarehouseGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          <linearGradient id="barDispatchGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          <linearGradient id="barReadyGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          <filter id="barGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[50, 90, 130, 170].map((y) => (
          <line
            key={y}
            x1="24"
            y1={y}
            x2="338"
            y2={y}
            stroke="rgba(255,255,255,.07)"
            strokeDasharray="5 7"
          />
        ))}

        <line
          x1="24"
          y1={baseY}
          x2="338"
          y2={baseY}
          stroke="rgba(255,255,255,.16)"
        />

        {items.map((item, index) => {
          const x = 62 + index * 102;
          const height =
            item.value === 0
              ? 4
              : Math.max((item.value / max) * maxBarHeight, 8);

          const y = baseY - height;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width="54"
                height={height}
                rx="14"
                fill={`url(#${item.gradientId})`}
                filter="url(#barGlow)"
              />

              <text
                x={x + 27}
                y={y - 10}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="15"
                fontWeight="900"
              >
                {item.value}
              </text>

              <text
                x={x + 27}
                y="187"
                textAnchor="middle"
                fill="rgba(255,255,255,.62)"
                fontSize="12"
                fontWeight="800"
              >
                {item.short}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={legendGrid}>
        {items.map((item) => (
          <div key={item.label} style={legendChip}>
            <span
              style={{
                ...legendDot,
                background: item.color,
                boxShadow: `0 0 16px ${item.color}66`,
              }}
            />

            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const chartCard = {
  width: "100%",
  height: "100%",
  color: "#fff",
};

const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 14,
};

const chartTitle = {
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const chartSubtitle = {
  marginTop: 5,
  fontSize: 12,
  color: "rgba(255,255,255,.56)",
};

const maxBadge = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.08)",
  color: "rgba(255,255,255,.72)",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const legendGrid = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 12,
};

const legendChip = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,.045)",
  border: "1px solid rgba(255,255,255,.07)",
  color: "rgba(255,255,255,.72)",
  fontSize: 12,
  fontWeight: 800,
};

const legendDot = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

export default StatusBarChart;