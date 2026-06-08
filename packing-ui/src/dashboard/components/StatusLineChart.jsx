function StatusLineChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const points = [
    {
      label: "Warehouse",
      value: Number(warehouse || 0),
      color: "#60a5fa",
    },
    {
      label: "Ready to Dispatch",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
    },
    {
      label: "Ready",
      value: Number(ready || 0),
      color: "#34d399",
    },
  ];

  const max = Math.max(...points.map((item) => item.value), 1);

  const scaleY = (value) =>
    150 - (value / max) * 105;

  const coords = [
    {
      x: 52,
      y: scaleY(points[0].value),
      ...points[0],
    },
    {
      x: 180,
      y: scaleY(points[1].value),
      ...points[1],
    },
    {
      x: 308,
      y: scaleY(points[2].value),
      ...points[2],
    },
  ];

  const path = `M ${coords[0].x} ${coords[0].y}
    C 105 ${coords[0].y}, 120 ${coords[1].y}, ${coords[1].x} ${coords[1].y}
    C 230 ${coords[1].y}, 250 ${coords[2].y}, ${coords[2].x} ${coords[2].y}`;

  const areaPath = `${path} L 308 160 L 52 160 Z`;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>Status Flow</div>
          <div style={chartSubtitle}>
            Movement distribution across inventory stages
          </div>
        </div>

        <div style={flowBadge}>
          Live
        </div>
      </div>

      <svg
        width="100%"
        height="205"
        viewBox="0 0 360 205"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(96,165,250,.36)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0)" />
          </linearGradient>

          <linearGradient id="statusLineGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>

          <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[55, 90, 125, 160].map((y) => (
          <line
            key={y}
            x1="32"
            y1={y}
            x2="330"
            y2={y}
            stroke="rgba(255,255,255,.07)"
            strokeDasharray="5 7"
          />
        ))}

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
              r="8"
              fill={point.color}
              stroke="#0f172a"
              strokeWidth="4"
            />

            <text
              x={point.x}
              y={point.y - 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="14"
              fontWeight="900"
            >
              {point.value}
            </text>

            <text
              x={point.x}
              y="195"
              textAnchor="middle"
              fill="rgba(255,255,255,.62)"
              fontSize="11"
              fontWeight="800"
            >
              {shortLabel(point.label)}
            </text>
          </g>
        ))}
      </svg>

      <div style={summaryStrip}>
        {points.map((item) => (
          <div key={item.label} style={summaryItem}>
            <span
              style={{
                ...summaryDot,
                background: item.color,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const shortLabel = (label) => {
  if (label === "Ready to Dispatch") return "Dispatch";
  return label;
};

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

const flowBadge = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(34,197,94,.12)",
  border: "1px solid rgba(34,197,94,.22)",
  color: "#86efac",
  fontSize: 12,
  fontWeight: 900,
};

const summaryStrip = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 8,
};

const summaryItem = {
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

const summaryDot = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

export default StatusLineChart;