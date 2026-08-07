import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

function TripsLineChart({
  data = [],
}) {
  const totals =
    data.reduce(
      (result, row) => {
        result.challans +=
          safeNumber(
            row?.challans
          );

        result.manualOperations +=
          safeNumber(
            row?.manualOperations
          );

        result.dispatchedItems +=
          safeNumber(
            row?.dispatchedItems
          );

        return result;
      },
      {
        challans: 0,
        manualOperations: 0,
        dispatchedItems: 0,
      }
    );

  return (
    <div style={card}>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>
            LOGISTICS TREND
          </div>

          <div style={title}>
            Operations & Dispatch Volume
          </div>

          <div style={subtitle}>
            Last 14 operational dates with challans, manual movements and dispatched item volume.
          </div>
        </div>

        <div style={periodBadge}>
          14 Dates
        </div>
      </div>

      <div style={metricStrip}>
        <Metric
          label="Dispatch Challans"
          value={totals.challans}
          accent="#60a5fa"
        />

        <Metric
          label="Manual Operations"
          value={totals.manualOperations}
          accent="#a78bfa"
        />

        <Metric
          label="Dispatched Items"
          value={totals.dispatchedItems}
          accent="#4ade80"
        />
      </div>

      <div style={legendRow}>
        <LegendKey
          color="#3b82f6"
          label="Dispatch Challans"
        />

        <LegendKey
          color="#8b5cf6"
          label="Manual Operations"
        />

        <LegendKey
          color="#22c55e"
          label="Dispatched Items"
          dashed
        />
      </div>

      <div style={chartSurface}>
        {data.length === 0 ? (
          <div style={emptyState}>
            <div style={emptyIcon}>⌁</div>
            <div style={emptyTitle}>
              No operation timeline data
            </div>
            <div style={emptyText}>
              Trend lines will appear when logistics records exist in the selected period.
            </div>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={data}
              margin={{
                top: 18,
                right: 24,
                left: 2,
                bottom: 12,
              }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 5"
                stroke="rgba(148,163,184,.12)"
              />

              <XAxis
                dataKey="date"
                stroke="rgba(148,163,184,.42)"
                axisLine={{
                  stroke:
                    "rgba(148,163,184,.18)",
                }}
                tickLine={false}
                tickMargin={10}
                minTickGap={18}
                interval="preserveStartEnd"
                tick={{
                  fill: "#cbd5e1",
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              />

              <YAxis
                yAxisId="operations"
                allowDecimals={false}
                stroke="rgba(148,163,184,.38)"
                axisLine={false}
                tickLine={false}
                tickMargin={7}
                width={34}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              />

              <YAxis
                yAxisId="items"
                orientation="right"
                allowDecimals={false}
                stroke="rgba(74,222,128,.46)"
                axisLine={false}
                tickLine={false}
                tickMargin={7}
                width={40}
                tick={{
                  fill: "#86efac",
                  fontSize: 9.5,
                  fontWeight: 800,
                }}
              />

              <Tooltip
                content={
                  <OperationsTooltip />
                }
              />

              <Line
                yAxisId="operations"
                type="monotone"
                dataKey="challans"
                name="Dispatch Challans"
                stroke="#3b82f6"
                strokeWidth={3.2}
                dot={{
                  r: 3.2,
                  fill: "#0f172a",
                  stroke: "#60a5fa",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5.2,
                  fill: "#60a5fa",
                  stroke: "#dbeafe",
                  strokeWidth: 2,
                }}
                connectNulls
              />

              <Line
                yAxisId="operations"
                type="monotone"
                dataKey="manualOperations"
                name="Manual Operations"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{
                  r: 3,
                  fill: "#0f172a",
                  stroke: "#a78bfa",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  fill: "#a78bfa",
                  stroke: "#ede9fe",
                  strokeWidth: 2,
                }}
                connectNulls
              />

              <Line
                yAxisId="items"
                type="monotone"
                dataKey="dispatchedItems"
                name="Dispatched Items"
                stroke="#22c55e"
                strokeWidth={2.8}
                strokeDasharray="7 5"
                dot={{
                  r: 2.8,
                  fill: "#0f172a",
                  stroke: "#4ade80",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 4.8,
                  fill: "#4ade80",
                  stroke: "#dcfce7",
                  strokeWidth: 2,
                }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={footerRow}>
        <div style={axisGuide}>
          <span style={leftAxisDot} />
          Left scale: operations
        </div>

        <div style={axisGuide}>
          <span style={rightAxisDot} />
          Right scale: dispatched items
        </div>

        <div style={footNote}>
          Separate item scale keeps high packet volume from flattening trip trends.
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}) {
  return (
    <div
      style={{
        ...metricCard,
        border:
          `1px solid ${accent}2E`,
        background:
          `linear-gradient(135deg,${accent}14,rgba(2,6,23,.28))`,
      }}
    >
      <div style={metricLabel}>
        {label}
      </div>

      <div
        style={{
          ...metricValue,
          color: accent,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LegendKey({
  color,
  label,
  dashed = false,
}) {
  return (
    <div style={legendKey}>
      <span
        style={{
          ...legendLine,
          background:
            dashed
              ? `repeating-linear-gradient(90deg,${color} 0 8px,transparent 8px 13px)`
              : color,
        }}
      />

      <span>{label}</span>
    </div>
  );
}

function OperationsTooltip({
  active,
  payload,
  label,
}) {
  if (
    !active ||
    !Array.isArray(payload) ||
    payload.length === 0
  ) {
    return null;
  }

  const byKey =
    new Map(
      payload.map((item) => [
        item.dataKey,
        safeNumber(item.value),
      ])
    );

  return (
    <div style={tooltipCard}>
      <div style={tooltipDate}>
        {label || "Operational Date"}
      </div>

      <TooltipRow
        color="#60a5fa"
        label="Dispatch Challans"
        value={
          byKey.get("challans") || 0
        }
      />

      <TooltipRow
        color="#a78bfa"
        label="Manual Operations"
        value={
          byKey.get(
            "manualOperations"
          ) || 0
        }
      />

      <TooltipRow
        color="#4ade80"
        label="Dispatched Items"
        value={
          byKey.get(
            "dispatchedItems"
          ) || 0
        }
      />
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}) {
  return (
    <div style={tooltipRow}>
      <div style={tooltipIdentity}>
        <span
          style={{
            ...tooltipDot,
            background: color,
            boxShadow:
              `0 0 10px ${color}55`,
          }}
        />

        <span style={tooltipLabel}>
          {label}
        </span>
      </div>

      <strong style={tooltipValue}>
        {value}
      </strong>
    </div>
  );
}

const card = {
  minWidth: 0,
  padding: 22,
  borderRadius: 24,
  color: "#fff",
  background:
    "radial-gradient(circle at 0% 0%,rgba(37,99,235,.15),transparent 31%), linear-gradient(180deg,rgba(15,23,42,.96),rgba(8,15,30,.96))",
  border:
    "1px solid rgba(148,163,184,.12)",
  boxShadow:
    "0 22px 55px rgba(2,6,23,.30)",
  overflow: "hidden",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
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
  maxWidth: 590,
  marginTop: 6,
  color: "#a8b4c7",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.55,
};

const periodBadge = {
  padding: "7px 10px",
  borderRadius: 999,
  color: "#bfdbfe",
  background:
    "rgba(59,130,246,.10)",
  border:
    "1px solid rgba(96,165,250,.20)",
  fontSize: 9.5,
  fontWeight: 900,
};

const metricStrip = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 8,
  marginTop: 16,
};

const metricCard = {
  minWidth: 0,
  padding: "10px 11px",
  borderRadius: 13,
};

const metricLabel = {
  color: "#94a3b8",
  fontSize: 8.8,
  fontWeight: 850,
  lineHeight: 1.25,
};

const metricValue = {
  marginTop: 5,
  fontSize: 20,
  fontWeight: 950,
  lineHeight: 1,
};

const legendRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 14,
  marginBottom: 4,
  color: "#cbd5e1",
};

const legendKey = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#cbd5e1",
  fontSize: 9.5,
  fontWeight: 800,
};

const legendLine = {
  display: "inline-block",
  width: 24,
  height: 3,
  borderRadius: 999,
};

const chartSurface = {
  height: 340,
  marginTop: 6,
  padding: "5px 2px 0",
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(2,6,23,.34),rgba(2,6,23,.17))",
  border:
    "1px solid rgba(255,255,255,.045)",
  overflow: "hidden",
};

const tooltipCard = {
  minWidth: 190,
  padding: 12,
  borderRadius: 14,
  background:
    "rgba(2,6,23,.97)",
  border:
    "1px solid rgba(148,163,184,.16)",
  boxShadow:
    "0 18px 38px rgba(2,6,23,.48)",
};

const tooltipDate = {
  marginBottom: 8,
  paddingBottom: 8,
  color: "#fff",
  borderBottom:
    "1px solid rgba(255,255,255,.07)",
  fontSize: 11,
  fontWeight: 900,
};

const tooltipRow = {
  minHeight: 25,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const tooltipIdentity = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const tooltipDot = {
  width: 7,
  height: 7,
  borderRadius: "50%",
};

const tooltipLabel = {
  color: "#cbd5e1",
  fontSize: 9.5,
  fontWeight: 750,
};

const tooltipValue = {
  color: "#fff",
  fontSize: 11,
  fontWeight: 950,
};

const footerRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 10,
  color: "#64748b",
};

const axisGuide = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 8.8,
  fontWeight: 800,
};

const leftAxisDot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#60a5fa",
};

const rightAxisDot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#4ade80",
};

const footNote = {
  marginLeft: "auto",
  color: "#64748b",
  fontSize: 8.8,
  fontWeight: 700,
};

const emptyState = {
  height: "100%",
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 24,
};

const emptyIcon = {
  color: "#60a5fa",
  fontSize: 30,
  lineHeight: 1,
};

const emptyTitle = {
  marginTop: 8,
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
};

const emptyText = {
  maxWidth: 320,
  marginTop: 5,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.5,
};

export default TripsLineChart;
