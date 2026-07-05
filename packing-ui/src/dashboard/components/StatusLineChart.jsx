function StatusLineChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const points = [
    {
      key: "warehouse",
      label: "Warehouse",
      value: Number(warehouse || 0),
      color: "#60a5fa",
      soft: "rgba(96,165,250,.16)",
    },
    {
      key: "readyToDispatch",
      label: "Ready to Dispatch",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
      soft: "rgba(245,158,11,.16)",
    },
    {
      key: "ready",
      label: "Ready",
      value: Number(ready || 0),
      color: "#34d399",
      soft: "rgba(52,211,153,.16)",
    },
  ];

  const total = points.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const max = Math.max(
    ...points.map((item) => item.value),
    1
  );

  const scaleY = (value) =>
    168 - (value / max) * 104;

  const coords = [
    {
      x: 40,
      y: scaleY(points[0].value),
      ...points[0],
    },
    {
      x: 110,
      y: scaleY(points[1].value),
      ...points[1],
    },
    {
      x: 180,
      y: scaleY(points[2].value),
      ...points[2],
    },
  ];

  const path = `
    M ${coords[0].x} ${coords[0].y}
    C 66 ${coords[0].y}, 80 ${coords[1].y}, ${coords[1].x} ${coords[1].y}
    C 140 ${coords[1].y}, 152 ${coords[2].y}, ${coords[2].x} ${coords[2].y}
  `;

  const areaPath = `${path} L 180 178 L 40 178 Z`;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>Status Flow</div>

          <div style={chartSubtitle}>
            Movement trend across warehouse, ready, and dispatch stages
          </div>
        </div>

        <div style={chartBadge}>
          {total}
        </div>
      </div>

      <div style={lineLayout}>
        <div style={lineWrap}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 220 220"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient
                id="lineAreaGradient"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="rgba(96,165,250,.28)"
                />

                <stop
                  offset="100%"
                  stopColor="rgba(96,165,250,0)"
                />
              </linearGradient>

              <linearGradient
                id="statusLineGradient"
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="52%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>

              <filter
                id="lineGlow"
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

            {[64, 92, 120, 148, 176].map((y) => (
              <line
                key={y}
                x1="26"
                y1={y}
                x2="196"
                y2={y}
                stroke="rgba(255,255,255,.07)"
                strokeDasharray="4 7"
              />
            ))}

            <line
              x1="26"
              y1="178"
              x2="196"
              y2="178"
              stroke="rgba(255,255,255,.16)"
            />

            <path
              d={areaPath}
              fill="url(#lineAreaGradient)"
            />

            <path
              d={path}
              fill="none"
              stroke="url(#statusLineGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />

            {coords.map((point) => (
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  fill="rgba(15,23,42,.96)"
                  stroke={point.color}
                  strokeWidth="4"
                />

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={point.color}
                />

                <text
                  x={point.x}
                  y={point.y - 16}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="900"
                >
                  {point.value}
                </text>

                <text
                  x={point.x}
                  y="205"
                  textAnchor="middle"
                  fill="rgba(255,255,255,.58)"
                  fontSize="10"
                  fontWeight="900"
                >
                  {shortLabel(point.label)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div style={legendPanel}>
          {points.map((item) => {
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

const lineLayout = {
  flex: 1,

  minHeight: 0,

  display: "grid",

  gridTemplateColumns: "minmax(210px,240px) minmax(0,1fr)",

  gap: 24,

  alignItems: "center",
};

const lineWrap = {
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

export default StatusLineChart;