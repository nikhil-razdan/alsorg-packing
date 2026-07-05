function StatusDonutChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const values = [
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

  const total = values.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const radius = 70;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div style={chartCard}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>Status Overview</div>

          <div style={chartSubtitle}>
            Live stock distribution across operational stages
          </div>
        </div>

        <div style={chartBadge}>
          {total}
        </div>
      </div>

      <div style={donutLayout}>
        <div style={donutWrap}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 220 220"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter
                id="donutGlow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,.07)"
              strokeWidth={stroke}
            />

            <g transform="rotate(-90 110 110)">
              {total > 0 &&
                values.map((item) => {
                  const length =
                    (item.value / total) * circumference;

                  const dashOffset = -offset;

                  offset += length;

                  return (
                    <circle
                      key={item.key}
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(length - 6, 0)} ${circumference}`}
                      strokeDashoffset={dashOffset}
                      filter="url(#donutGlow)"
                    />
                  );
                })}
            </g>
          </svg>

          <div style={donutCenter}>
            <div style={donutCenterValue}>
              {total}
            </div>

            <div style={donutCenterLabel}>
              Total Items
            </div>
          </div>
        </div>

        <div style={legendPanel}>
          {values.map((item) => {
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

const donutLayout = {
  flex: 1,

  minHeight: 0,

  display: "grid",

  gridTemplateColumns: "minmax(210px,240px) minmax(0,1fr)",

  gap: 24,

  alignItems: "center",
};

const donutWrap = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  maxHeight: 220,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const donutCenter = {
  position: "absolute",

  inset: 0,

  display: "flex",

  flexDirection: "column",

  alignItems: "center",

  justifyContent: "center",
};

const donutCenterValue = {
  fontSize: 34,
  fontWeight: 900,
  color: "#fff",
};

const donutCenterLabel = {
  marginTop: 3,

  fontSize: 11,

  fontWeight: 800,

  color: "rgba(255,255,255,.52)",

  textTransform: "uppercase",

  letterSpacing: ".08em",
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

export default StatusDonutChart;