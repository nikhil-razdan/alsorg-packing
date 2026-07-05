function StatusBarChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const items = [
    {
      key: "warehouse",
      label: "Warehouse",
      value: Number(warehouse || 0),
      color: "#60a5fa",
      soft: "rgba(96,165,250,.16)",
      gradientId: "barWarehouseGradient",
    },
    {
      key: "readyToDispatch",
      label: "Ready to Dispatch",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
      soft: "rgba(245,158,11,.16)",
      gradientId: "barDispatchGradient",
    },
    {
      key: "ready",
      label: "Ready",
      value: Number(ready || 0),
      color: "#34d399",
      soft: "rgba(52,211,153,.16)",
      gradientId: "barReadyGradient",
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

  const baseY = 178;
  const maxBarHeight = 112;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>Status Volume</div>

          <div style={chartSubtitle}>
            Stage-wise count comparison across current stock status
          </div>
        </div>

        <div style={chartBadge}>
          {total}
        </div>
      </div>

      <div style={barLayout}>
        <div style={barWrap}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 220 220"
            preserveAspectRatio="xMidYMid meet"
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

            {[66, 94, 122, 150, 178].map((y) => (
              <line
                key={y}
                x1="26"
                y1={y}
                x2="198"
                y2={y}
                stroke="rgba(255,255,255,.07)"
                strokeDasharray="4 7"
              />
            ))}

            <line
              x1="26"
              y1={baseY}
              x2="198"
              y2={baseY}
              stroke="rgba(255,255,255,.16)"
            />

            {items.map((item, index) => {
              const x = 44 + index * 56;

              const height =
                item.value === 0
                  ? 5
                  : Math.max(
                    (item.value / max) * maxBarHeight,
                    9
                  );

              const y = baseY - height;

              return (
                <g key={item.key}>
                  <rect
                    x={x - 6}
                    y="58"
                    width="42"
                    height="120"
                    rx="14"
                    fill="rgba(255,255,255,.025)"
                    stroke="rgba(255,255,255,.045)"
                  />

                  <rect
                    x={x}
                    y={y}
                    width="30"
                    height={height}
                    rx="10"
                    fill={`url(#${item.gradientId})`}
                    filter="url(#barGlow)"
                  />

                  <text
                    x={x + 15}
                    y={y - 9}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="900"
                  >
                    {item.value}
                  </text>

                  <text
                    x={x + 15}
                    y="205"
                    textAnchor="middle"
                    fill="rgba(255,255,255,.58)"
                    fontSize="10"
                    fontWeight="900"
                  >
                    {shortLabel(item.label)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={legendPanel}>
          {items.map((item) => {
            const percentage =
              total > 0
                ? Math.round((item.value / total) * 100)
                : 0;

            return (
              <div key={item.key} style={legendRow}>
                <div style={legendLeft}>
                  <span
                    style={{
                      ...legendDot,
                      background: item.color,
                      boxShadow: `0 0 18px ${item.color}66`,
                    }}
                  />

                  <div style={legendTextWrap}>
                    <div style={legendLabel}>
                      {item.label}
                    </div>

                    <div style={legendPercent}>
                      {percentage}% of inventory
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...legendValue,
                    background: item.soft,
                    color: item.color,
                  }}
                >
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const shortLabel = (label) => {
  if (label === "Warehouse") return "WH";
  if (label === "Ready to Dispatch") return "RTD";
  return "RDY";
};

const chartCard = {
  width: "100%",
  height: "100%",

  minHeight: 0,

  color: "#fff",

  display: "flex",
  flexDirection: "column",
};

const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const chartTitle = {
  fontSize: 17,
  fontWeight: 950,
  color: "#fff",
};

const chartSubtitle = {
  marginTop: 4,
  fontSize: 11,
  color: "rgba(255,255,255,.52)",
  fontWeight: 650,
};

const chartBadge = {
  minWidth: 38,
  height: 38,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow: "0 10px 22px rgba(37,99,235,.26)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
};

const barLayout = {
  flex: 1,

  minHeight: 0,

  display: "grid",

  gridTemplateColumns: "minmax(210px,240px) minmax(0,1fr)",

  gap: 24,

  alignItems: "center",
};

const barWrap = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  maxHeight: 220,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const legendPanel = {
  display: "flex",

  flexDirection: "column",

  gap: 12,
};

const legendRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 11px",
  borderRadius: 14,
  background:
    "linear-gradient(180deg, rgba(255,255,255,.050), rgba(255,255,255,.022))",
  border: "1px solid rgba(255,255,255,.065)",
};

const legendLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const legendTextWrap = {
  minWidth: 0,
};

const legendDot = {
  width: 11,
  height: 11,
  borderRadius: 999,
  flex: "0 0 auto",
};

const legendLabel = {
  fontSize: 12,
  fontWeight: 950,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const legendPercent = {
  marginTop: 2,
  fontSize: 10,
  color: "rgba(255,255,255,.45)",
  fontWeight: 750,
};

const legendValue = {
  minWidth: 44,
  padding: "6px 9px",
  borderRadius: 999,
  textAlign: "center",
  fontSize: 12,
  fontWeight: 950,
};

export default StatusBarChart;