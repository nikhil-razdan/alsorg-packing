function StatusLineChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const points = [
    {
      label: "Warehouse",
      short: "Warehouse",
      value: Number(warehouse || 0),
      color: "#60a5fa",
    },
    {
      label: "Ready to Dispatch",
      short: "Dispatch",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
    },
    {
      label: "Ready",
      short: "Ready",
      value: Number(ready || 0),
      color: "#34d399",
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
    160 - (value / max) * 110;

  const coords = [
    {
      x: 56,
      y: scaleY(points[0].value),
      ...points[0],
    },
    {
      x: 180,
      y: scaleY(points[1].value),
      ...points[1],
    },
    {
      x: 304,
      y: scaleY(points[2].value),
      ...points[2],
    },
  ];

  const path = `
    M ${coords[0].x} ${coords[0].y}
    C 100 ${coords[0].y}, 118 ${coords[1].y}, ${coords[1].x} ${coords[1].y}
    C 232 ${coords[1].y}, 250 ${coords[2].y}, ${coords[2].x} ${coords[2].y}
  `;

  const areaPath = `${path} L 304 170 L 56 170 Z`;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>
            Status Flow
          </div>

          <div style={chartSubtitle}>
            Inventory movement across stages
          </div>
        </div>

        <div style={topBadge}>
          {total}
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
              id="lineAreaGradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="rgba(96,165,250,.30)"
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
                stdDeviation="4"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[55, 90, 125, 160].map((y) => (
            <line
              key={y}
              x1="34"
              y1={y}
              x2="328"
              y2={y}
              stroke="rgba(255,255,255,.075)"
              strokeDasharray="5 7"
            />
          ))}

          <line
            x1="34"
            y1="170"
            x2="328"
            y2="170"
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
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="rgba(15,23,42,.96)"
                stroke={point.color}
                strokeWidth="4"
              />

              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill={point.color}
              />

              <text
                x={point.x}
                y={point.y - 18}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="15"
                fontWeight="900"
              >
                {point.value}
              </text>

              <text
                x={point.x}
                y="202"
                textAnchor="middle"
                fill="rgba(255,255,255,.62)"
                fontSize="12"
                fontWeight="800"
              >
                {point.short}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div style={summaryStrip}>
        {points.map((item) => (
          <div key={item.label} style={summaryItem}>
            <span
              style={{
                ...summaryDot,
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
  minWidth: 44,
  height: 44,

  borderRadius: 16,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  boxShadow:
    "0 14px 30px rgba(37,99,235,.32)",

  color: "#fff",

  fontSize: 15,

  fontWeight: 900,
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

const summaryStrip = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 14,
};

const summaryItem = {
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

const summaryDot = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

export default StatusLineChart;