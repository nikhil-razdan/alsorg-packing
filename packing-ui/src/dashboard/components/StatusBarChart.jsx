function StatusBarChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const items = [
    {
      key: "warehouse",
      label: "Warehouse",
      short: "WH",
      value: Number(
        warehouse || 0
      ),
      color: "#38bdf8",
      gradientId:
        "inventoryBarWarehouse",
    },
    {
      key: "readyToDispatch",
      label:
        "Ready to Dispatch",
      short: "RTD",
      value: Number(
        readyToDispatch || 0
      ),
      color: "#f97316",
      gradientId:
        "inventoryBarDispatch",
    },
    {
      key: "ready",
      label: "Ready",
      short: "RDY",
      value: Number(
        ready || 0
      ),
      color: "#22c55e",
      gradientId:
        "inventoryBarReady",
    },
  ];

  const total =
    items.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

  const max =
    Math.max(
      ...items.map(
        (item) =>
          item.value
      ),
      1
    );

  const highest =
    [...items].sort(
      (a, b) =>
        b.value -
        a.value
    )[0];

  const baseY = 185;
  const maxBarHeight = 120;

  if (total <= 0) {
    return (
      <div style={emptyState}>
        No inventory volume available
      </div>
    );
  }

  return (
    <div style={root}>
      <div style={summaryStrip}>
        <div>
          <div style={summaryLabel}>
            Largest Stock Bucket
          </div>
          <div style={summaryValue}>
            {highest.label}
          </div>
        </div>

        <div style={summaryRight}>
          <div style={summaryMetric}>
            <span>Total</span>
            <strong>
              {total}
            </strong>
          </div>

          <div style={summaryMetric}>
            <span>Largest</span>
            <strong>
              {highest.value}
            </strong>
          </div>
        </div>
      </div>

      <div style={chartLayout}>
        <div style={barWrap}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 260 230"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient
                id="inventoryBarWarehouse"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#7dd3fc"
                />
                <stop
                  offset="100%"
                  stopColor="#0284c7"
                />
              </linearGradient>

              <linearGradient
                id="inventoryBarDispatch"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#fdba74"
                />
                <stop
                  offset="100%"
                  stopColor="#ea580c"
                />
              </linearGradient>

              <linearGradient
                id="inventoryBarReady"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#86efac"
                />
                <stop
                  offset="100%"
                  stopColor="#16a34a"
                />
              </linearGradient>
            </defs>

            {[65, 95, 125, 155, 185].map(
              (y) => (
                <line
                  key={y}
                  x1="30"
                  y1={y}
                  x2="232"
                  y2={y}
                  stroke="rgba(148,163,184,.08)"
                  strokeDasharray="4 6"
                />
              )
            )}

            <line
              x1="30"
              y1={baseY}
              x2="232"
              y2={baseY}
              stroke="rgba(148,163,184,.16)"
            />

            {items.map(
              (item, index) => {
                const x =
                  53 +
                  index * 67;

                const height =
                  item.value === 0
                    ? 4
                    : Math.max(
                      (
                        item.value /
                        max
                      ) *
                      maxBarHeight,
                      8
                    );

                const y =
                  baseY -
                  height;

                return (
                  <g
                    key={item.key}
                  >
                    <rect
                      x={x - 7}
                      y="58"
                      width="42"
                      height="127"
                      rx="12"
                      fill="rgba(148,163,184,.025)"
                      stroke="rgba(148,163,184,.045)"
                    />

                    <rect
                      x={x}
                      y={y}
                      width="28"
                      height={
                        height
                      }
                      rx="8"
                      fill={`url(#${item.gradientId})`}
                    />

                    <text
                      x={x + 14}
                      y={y - 8}
                      textAnchor="middle"
                      fill="var(--pf-text)"
                      fontSize="10"
                      fontWeight="900"
                    >
                      {item.value}
                    </text>

                    <text
                      x={x + 14}
                      y="211"
                      textAnchor="middle"
                      fill="var(--pf-text-dim)"
                      fontSize="8.5"
                      fontWeight="900"
                    >
                      {item.short}
                    </text>
                  </g>
                );
              }
            )}
          </svg>
        </div>

        <div style={legendPanel}>
          {items.map((item) => {
            const share =
              (
                item.value /
                total
              ) *
              100;

            return (
              <div
                key={item.key}
                style={legendRow}
              >
                <div style={legendTop}>
                  <div style={legendIdentity}>
                    <span
                      style={{
                        ...legendDot,
                        background:
                          item.color,
                        boxShadow:
                          `0 0 8px ${item.color}55`,
                      }}
                    />

                    <span style={legendLabel}>
                      {item.label}
                    </span>
                  </div>

                  <div style={legendNumbers}>
                    <strong>
                      {item.value}
                    </strong>
                    <span>
                      {share.toFixed(
                        share >= 10
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
                        `${share}%`,
                      background:
                        item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const root = {
  width: "100%",
  height: "100%",
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
};

const summaryStrip = {
  minHeight: 43,
  padding: "0 4px 7px",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 10,
  borderBottom:
    "1px solid rgba(148,163,184,.055)",
};

const summaryLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 8,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".075em",
};

const summaryValue = {
  marginTop: 3,
  color: "var(--pf-text-strong)",
  fontSize: 10.1,
  fontWeight: 900,
};

const summaryRight = {
  display: "flex",
  alignItems: "center",
  gap: 15,
};

const summaryMetric = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 800,
};

const chartLayout = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
  alignItems: "center",
};

const barWrap = {
  height: 260,
  minWidth: 0,
};

const legendPanel = {
  minWidth: 0,
  padding: 10,
  borderRadius: 13,
  background:
    "rgba(var(--pf-surface-deep-rgb),.22)",
  border:
    "1px solid rgba(148,163,184,.05)",
};

const legendRow = {
  padding: "9px 0",
  borderBottom:
    "1px solid rgba(148,163,184,.045)",
};

const legendTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const legendIdentity = {
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

const legendLabel = {
  color: "var(--pf-text)",
  fontSize: 9.1,
  fontWeight: 850,
};

const legendNumbers = {
  flexShrink: 0,
  display: "flex",
  alignItems: "baseline",
  gap: 4,
  color: "var(--pf-text-soft)",
  fontSize: 8,
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

const emptyState = {
  width: "100%",
  minHeight: 280,
  display: "grid",
  placeItems: "center",
  color: "var(--pf-text-muted)",
  fontSize: 10.1,
  fontWeight: 800,
};

export default StatusBarChart;
