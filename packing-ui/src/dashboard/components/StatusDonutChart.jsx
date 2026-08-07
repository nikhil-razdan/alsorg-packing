function StatusDonutChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const values = [
    {
      key: "warehouse",
      label: "Warehouse",
      detail: "Stored inventory",
      value: Number(warehouse || 0),
      color: "#38bdf8",
      soft: "rgba(56,189,248,.09)",
    },
    {
      key: "readyToDispatch",
      label: "Ready to Dispatch",
      detail: "Awaiting dispatch",
      value: Number(
        readyToDispatch || 0
      ),
      color: "#f97316",
      soft: "rgba(249,115,22,.09)",
    },
    {
      key: "ready",
      label: "Ready",
      detail: "Processed / ready stock",
      value: Number(ready || 0),
      color: "#22c55e",
      soft: "rgba(34,197,94,.09)",
    },
  ];

  const total =
    values.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

  const radius = 70;
  const stroke = 17;
  const circumference =
    2 * Math.PI * radius;

  let offset = 0;

  if (total <= 0) {
    return (
      <div style={emptyState}>
        <div style={emptyIcon}>
          ◌
        </div>
        <div style={emptyTitle}>
          No inventory distribution
        </div>
        <div style={emptyText}>
          Live stock composition will appear once inventory records are available.
        </div>
      </div>
    );
  }

  return (
    <div style={root}>
      <div style={donutSide}>
        <div style={donutWrap}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 220 220"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter
                id="inventoryDonutGlow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur
                  stdDeviation="2.3"
                  result="blur"
                />
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
              stroke="rgba(148,163,184,.07)"
              strokeWidth={stroke}
            />

            <g transform="rotate(-90 110 110)">
              {values.map(
                (item) => {
                  const length =
                    (
                      item.value /
                      total
                    ) *
                    circumference;

                  const gap =
                    Math.min(
                      6,
                      length *
                      0.13
                    );

                  const dashOffset =
                    -offset;

                  offset += length;

                  return (
                    <circle
                      key={item.key}
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="none"
                      stroke={
                        item.color
                      }
                      strokeWidth={
                        stroke
                      }
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(
                        length - gap,
                        0
                      )} ${circumference}`}
                      strokeDashoffset={
                        dashOffset
                      }
                      filter="url(#inventoryDonutGlow)"
                    />
                  );
                }
              )}
            </g>
          </svg>

          <div style={donutCenter}>
            <div style={donutCenterLabel}>
              Live Inventory
            </div>
            <div style={donutCenterValue}>
              {total}
            </div>
            <div style={donutCenterSub}>
              tracked items
            </div>
          </div>
        </div>
      </div>

      <div style={legendPanel}>
        <div style={legendEyebrow}>
          STATUS SHARE
        </div>

        {values.map((item) => {
          const percentage =
            total > 0
              ? (
                item.value /
                total
              ) *
              100
              : 0;

          return (
            <div
              key={item.key}
              style={legendRow}
            >
              <div style={legendTop}>
                <div style={legendLeft}>
                  <span
                    style={{
                      ...legendDot,
                      background:
                        item.color,
                      boxShadow:
                        `0 0 9px ${item.color}55`,
                    }}
                  />

                  <div style={legendTextWrap}>
                    <div style={legendLabel}>
                      {item.label}
                    </div>
                    <div style={legendDetail}>
                      {item.detail}
                    </div>
                  </div>
                </div>

                <div style={legendNumbers}>
                  <strong>
                    {item.value}
                  </strong>
                  <span>
                    {percentage.toFixed(
                      percentage >= 10
                        ? 0
                        : 1
                    )}
                    %
                  </span>
                </div>
              </div>

              <div style={shareTrack}>
                <div
                  style={{
                    ...shareFill,
                    width:
                      `${percentage}%`,
                    background:
                      item.color,
                    boxShadow:
                      `0 0 8px ${item.color}44`,
                  }}
                />
              </div>
            </div>
          );
        })}

        <div style={legendFooter}>
          Distribution of current Warehouse + Ready to Dispatch + Ready stock.
        </div>
      </div>
    </div>
  );
}

const root = {
  width: "100%",
  height: "100%",
  minHeight: 300,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
  alignItems: "center",
};

const donutSide = {
  minWidth: 0,
  display: "grid",
  placeItems: "center",
};

const donutWrap = {
  position: "relative",
  width: "100%",
  height: 285,
  maxWidth: 330,
};

const donutCenter = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};

const donutCenterLabel = {
  color: "#64748b",
  fontSize: 7.8,
  fontWeight: 950,
  letterSpacing: ".07em",
  textTransform: "uppercase",
};

const donutCenterValue = {
  marginTop: 3,
  color: "#fff",
  fontSize: 31,
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: "-.04em",
};

const donutCenterSub = {
  marginTop: 5,
  color: "#475569",
  fontSize: 7.5,
  fontWeight: 750,
};

const legendPanel = {
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  background:
    "rgba(2,6,23,.23)",
  border:
    "1px solid rgba(148,163,184,.055)",
};

const legendEyebrow = {
  marginBottom: 5,
  color: "#536177",
  fontSize: 7.2,
  fontWeight: 950,
  letterSpacing: ".09em",
};

const legendRow = {
  padding: "8px 0",
  borderBottom:
    "1px solid rgba(148,163,184,.05)",
};

const legendTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const legendLeft = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const legendDot = {
  width: 6,
  height: 6,
  flexShrink: 0,
  borderRadius: "50%",
};

const legendTextWrap = {
  minWidth: 0,
};

const legendLabel = {
  color: "#dbe4ef",
  fontSize: 8.6,
  fontWeight: 900,
};

const legendDetail = {
  marginTop: 2,
  color: "#475569",
  fontSize: 6.8,
  fontWeight: 700,
};

const legendNumbers = {
  flexShrink: 0,
  display: "flex",
  alignItems: "baseline",
  gap: 5,
  color: "#64748b",
  fontSize: 7.4,
  fontWeight: 800,
};

const shareTrack = {
  height: 3,
  marginTop: 6,
  overflow: "hidden",
  borderRadius: 999,
  background:
    "rgba(148,163,184,.07)",
};

const shareFill = {
  height: "100%",
  borderRadius: 999,
};

const legendFooter = {
  paddingTop: 7,
  color: "#475569",
  fontSize: 6.7,
  fontWeight: 650,
  lineHeight: 1.4,
};

const emptyState = {
  width: "100%",
  minHeight: 280,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const emptyIcon = {
  color: "#60a5fa",
  fontSize: 28,
};

const emptyTitle = {
  marginTop: 6,
  color: "#dbeafe",
  fontSize: 10,
  fontWeight: 900,
};

const emptyText = {
  maxWidth: 250,
  marginTop: 4,
  color: "#536177",
  fontSize: 7.6,
  lineHeight: 1.45,
  fontWeight: 700,
};

export default StatusDonutChart;
