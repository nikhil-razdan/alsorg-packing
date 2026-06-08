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
      soft: "rgba(96,165,250,.14)",
    },
    {
      label: "Ready to Dispatch",
      short: "RTD",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
      gradientId: "barDispatchGradient",
      soft: "rgba(245,158,11,.14)",
    },
    {
      label: "Ready",
      short: "RDY",
      value: Number(ready || 0),
      color: "#34d399",
      gradientId: "barReadyGradient",
      soft: "rgba(52,211,153,.14)",
    },
  ];

  const total = items.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const max = Math.max(
    ...items.map((item) => item.value),
    1
  );

  const baseY = 174;
  const maxBarHeight = 124;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>
            Status Volume
          </div>

          <div style={chartSubtitle}>
            Inventory count comparison by stage
          </div>
        </div>

        <div style={topBadge}>
          Max {max}
        </div>
      </div>

      <div style={chartCanvas}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 360 215"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="barWarehouseGradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#bfdbfe" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            <linearGradient
              id="barDispatchGradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            <linearGradient
              id="barReadyGradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#a7f3d0" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <filter
              id="barGlow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur
                stdDeviation="3"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[54, 94, 134, 174].map((y) => (
            <line
              key={y}
              x1="30"
              y1={y}
              x2="330"
              y2={y}
              stroke="rgba(255,255,255,.075)"
              strokeDasharray="5 7"
            />
          ))}

          <line
            x1="30"
            y1={baseY}
            x2="330"
            y2={baseY}
            stroke="rgba(255,255,255,.16)"
          />

          {items.map((item, index) => {
            const x = 60 + index * 103;

            const height =
              item.value === 0
                ? 6
                : Math.max(
                    (item.value / max) * maxBarHeight,
                    10
                  );

            const y = baseY - height;

            return (
              <g key={item.label}>
                <rect
                  x={x - 8}
                  y="44"
                  width="70"
                  height="130"
                  rx="18"
                  fill="rgba(255,255,255,.025)"
                  stroke="rgba(255,255,255,.045)"
                />

                <rect
                  x={x}
                  y={y}
                  width="54"
                  height={height}
                  rx="16"
                  fill={`url(#${item.gradientId})`}
                  filter="url(#barGlow)"
                />

                <text
                  x={x + 27}
                  y={y - 12}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="15"
                  fontWeight="900"
                >
                  {item.value}
                </text>

                <text
                  x={x + 27}
                  y="204"
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
      </div>

      <div style={legendGrid}>
        {items.map((item) => {
          const percentage =
            total > 0
              ? Math.round((item.value / total) * 100)
              : 0;

          return (
            <div key={item.label} style={legendChip}>
              <span
                style={{
                  ...legendDot,
                  background: item.color,
                  boxShadow: `0 0 16px ${item.color}66`,
                }}
              />

              <span style={legendLabel}>
                {item.label}
              </span>

              <span
                style={{
                  ...legendValue,
                  color: item.color,
                  background: item.soft,
                }}
              >
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const chartCard = {
  width: "100%",
  height: "100%",

  display: "flex",
  flexDirection: "column",

  color: "#fff",
};

const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
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

const topBadge = {
  padding: "8px 12px",

  borderRadius: 999,

  background:
    "rgba(255,255,255,.06)",

  border:
    "1px solid rgba(255,255,255,.08)",

  color: "rgba(255,255,255,.72)",

  fontSize: 12,

  fontWeight: 900,

  whiteSpace: "nowrap",
};

const chartCanvas = {
  flex: 1,

  minHeight: 235,

  borderRadius: 22,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))",

  border:
    "1px solid rgba(255,255,255,.045)",

  padding: 8,
};

const legendGrid = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 14,
};

const legendChip = {
  display: "flex",
  alignItems: "center",
  gap: 7,

  padding: "7px 10px",

  borderRadius: 999,

  background: "rgba(255,255,255,.045)",

  border:
    "1px solid rgba(255,255,255,.07)",

  color: "rgba(255,255,255,.72)",

  fontSize: 12,

  fontWeight: 800,
};

const legendDot = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

const legendLabel = {
  whiteSpace: "nowrap",
};

const legendValue = {
  padding: "3px 7px",

  borderRadius: 999,

  fontSize: 10,

  fontWeight: 900,
};

export default StatusBarChart;