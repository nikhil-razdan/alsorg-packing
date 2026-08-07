import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

function StatusDistributionChart({
  data = [],
}) {
  const normalizedData =
    data
      .map((item) => ({
        ...item,
        value: safeNumber(item?.value),
      }))
      .filter((item) => item.value > 0);

  const total =
    normalizedData.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

  return (
    <div style={card}>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>
            OPERATIONS SNAPSHOT
          </div>

          <div style={title}>
            Operation Status Mix
          </div>

          <div style={subtitle}>
            Clear split between current dispatch challans and manual / legacy operations.
          </div>
        </div>

        <div style={totalBadge}>
          <span style={totalBadgeLabel}>
            Total Records
          </span>

          <strong style={totalBadgeValue}>
            {total}
          </strong>
        </div>
      </div>

      {normalizedData.length === 0 ? (
        <div style={emptyState}>
          <div style={emptyIcon}>◌</div>
          <div style={emptyTitle}>
            No status data available
          </div>
          <div style={emptyText}>
            Status distribution will appear here once logistics activity is available.
          </div>
        </div>
      ) : (
        <div style={contentRow}>
          <div style={chartColumn}>
            <div style={chartShell}>
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={normalizedData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={76}
                    outerRadius={112}
                    paddingAngle={4}
                    cornerRadius={8}
                    stroke="rgba(15,23,42,.9)"
                    strokeWidth={3}
                  >
                    {normalizedData.map(
                      (entry) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.color ||
                            "#60a5fa"
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    content={
                      <StatusTooltip
                        total={total}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              <div style={centerSummary}>
                <div style={centerLabel}>
                  Total
                </div>

                <div style={centerValue}>
                  {total}
                </div>

                <div style={centerSubtle}>
                  operations
                </div>
              </div>
            </div>
          </div>

          <div style={legendColumn}>
            <div style={legendHeader}>
              Status Breakdown
            </div>

            <div style={legendList}>
              {normalizedData.map(
                (item) => {
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
                      key={item.name}
                      style={legendItem}
                    >
                      <div style={legendIdentity}>
                        <span
                          style={{
                            ...legendDot,
                            background:
                              item.color ||
                              "#60a5fa",
                            boxShadow:
                              `0 0 14px ${item.color ||
                              "#60a5fa"
                              }55`,
                          }}
                        />

                        <div style={legendTextWrap}>
                          <div style={legendName}>
                            {item.name}
                          </div>

                          <div style={legendPercent}>
                            {percentage.toFixed(
                              percentage >= 10
                                ? 0
                                : 1
                            )}% of operations
                          </div>
                        </div>
                      </div>

                      <div style={legendValue}>
                        {item.value}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div style={legendFooter}>
              <span style={legendFooterDot} />
              Live values from the selected logistics period
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusTooltip({
  active,
  payload,
  total,
}) {
  if (
    !active ||
    !Array.isArray(payload) ||
    payload.length === 0
  ) {
    return null;
  }

  const item =
    payload[0]?.payload || {};

  const value =
    safeNumber(item.value);

  const percentage =
    total > 0
      ? (
        value /
        total
      ) *
      100
      : 0;

  return (
    <div style={tooltipCard}>
      <div style={tooltipTitleRow}>
        <span
          style={{
            ...tooltipDot,
            background:
              item.color ||
              "#60a5fa",
          }}
        />

        <span style={tooltipTitle}>
          {item.name || "Status"}
        </span>
      </div>

      <div style={tooltipValueRow}>
        <strong style={tooltipValue}>
          {value}
        </strong>

        <span style={tooltipPercent}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div style={tooltipCaption}>
        operational record{value === 1 ? "" : "s"}
      </div>
    </div>
  );
}

const card = {
  minWidth: 0,
  padding: 22,
  borderRadius: 24,
  color: "#fff",
  background:
    "radial-gradient(circle at 10% 0%,rgba(59,130,246,.13),transparent 32%), linear-gradient(180deg,rgba(15,23,42,.96),rgba(8,15,30,.96))",
  border:
    "1px solid rgba(148,163,184,.12)",
  boxShadow:
    "0 22px 55px rgba(2,6,23,.30)",
  overflow: "hidden",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrow = {
  color: "#60a5fa",
  fontSize: 9.5,
  fontWeight: 950,
  letterSpacing: ".13em",
};

const title = {
  marginTop: 5,
  color: "#f8fafc",
  fontSize: 18,
  fontWeight: 950,
  letterSpacing: "-.02em",
};

const subtitle = {
  maxWidth: 500,
  marginTop: 6,
  color: "#a8b4c7",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.55,
};

const totalBadge = {
  minWidth: 105,
  padding: "10px 13px",
  borderRadius: 15,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  alignItems: "flex-end",
  background:
    "rgba(59,130,246,.10)",
  border:
    "1px solid rgba(96,165,250,.20)",
};

const totalBadgeLabel = {
  color: "#93c5fd",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: ".06em",
  textTransform: "uppercase",
};

const totalBadgeValue = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
};

const contentRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 18,
  alignItems: "stretch",
  marginTop: 18,
};

const chartColumn = {
  flex: "1 1 300px",
  minWidth: 260,
};

const chartShell = {
  position: "relative",
  height: 300,
  borderRadius: 20,
  background:
    "radial-gradient(circle at 50% 50%,rgba(59,130,246,.08),transparent 44%), rgba(2,6,23,.26)",
  border:
    "1px solid rgba(255,255,255,.045)",
};

const centerSummary = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform:
    "translate(-50%,-50%)",
  width: 118,
  textAlign: "center",
  pointerEvents: "none",
};

const centerLabel = {
  color: "#94a3b8",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const centerValue = {
  marginTop: 3,
  color: "#fff",
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 950,
};

const centerSubtle = {
  marginTop: 5,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 750,
};

const legendColumn = {
  flex: "1 1 250px",
  minWidth: 230,
  padding: 14,
  borderRadius: 18,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px solid rgba(255,255,255,.05)",
};

const legendHeader = {
  color: "#dbeafe",
  fontSize: 11,
  fontWeight: 900,
  marginBottom: 8,
};

const legendList = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const legendItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 51,
  padding: "9px 10px",
  borderRadius: 13,
  background:
    "rgba(2,6,23,.35)",
  border:
    "1px solid rgba(255,255,255,.045)",
};

const legendIdentity = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const legendDot = {
  width: 9,
  height: 9,
  flexShrink: 0,
  borderRadius: "50%",
};

const legendTextWrap = {
  minWidth: 0,
};

const legendName = {
  color: "#f8fafc",
  fontSize: 10.5,
  fontWeight: 850,
  lineHeight: 1.3,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const legendPercent = {
  marginTop: 3,
  color: "#7c8ba1",
  fontSize: 9,
  fontWeight: 700,
};

const legendValue = {
  flexShrink: 0,
  color: "#fff",
  fontSize: 16,
  fontWeight: 950,
};

const legendFooter = {
  marginTop: 10,
  paddingTop: 10,
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#64748b",
  borderTop:
    "1px solid rgba(255,255,255,.05)",
  fontSize: 8.8,
  fontWeight: 700,
};

const legendFooterDot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 10px rgba(34,197,94,.6)",
};

const tooltipCard = {
  minWidth: 150,
  padding: 12,
  borderRadius: 14,
  color: "#fff",
  background:
    "rgba(2,6,23,.97)",
  border:
    "1px solid rgba(148,163,184,.16)",
  boxShadow:
    "0 18px 38px rgba(2,6,23,.48)",
};

const tooltipTitleRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const tooltipDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const tooltipTitle = {
  color: "#e2e8f0",
  fontSize: 11,
  fontWeight: 850,
};

const tooltipValueRow = {
  marginTop: 9,
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const tooltipValue = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
};

const tooltipPercent = {
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 900,
};

const tooltipCaption = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
};

const emptyState = {
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 24,
  borderRadius: 18,
  background:
    "rgba(2,6,23,.28)",
  border:
    "1px dashed rgba(148,163,184,.12)",
};

const emptyIcon = {
  color: "#60a5fa",
  fontSize: 32,
  lineHeight: 1,
};

const emptyTitle = {
  marginTop: 10,
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
};

const emptyText = {
  maxWidth: 300,
  marginTop: 5,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.5,
};

export default StatusDistributionChart;
