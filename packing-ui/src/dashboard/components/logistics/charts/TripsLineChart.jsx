import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

function TripsLineChart({
  data = [],
}) {
  return (
    <div style={card}>
      <div style={titleRow}>
        <div>
          <div style={title}>
            Operations Over Time
          </div>

          <div style={subtitle}>
            Last 14 operational dates
          </div>
        </div>
      </div>

      <div style={{ height: 320 }}>
        {data.length === 0 ? (
          <div style={emptyState}>
            No operation timeline data
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: 15,
                left: -15,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,.12)"
              />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />

              <YAxis
                allowDecimals={false}
                stroke="#64748b"
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />

              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border:
                    "1px solid rgba(255,255,255,.10)",
                  borderRadius: 12,
                  color: "#fff",
                }}
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="challans"
                name="Dispatch Challans"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                }}
              />

              <Line
                type="monotone"
                dataKey="manualOperations"
                name="Manual Operations"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const card = {
  background:
    "rgba(15,23,42,.76)",
  borderRadius: 24,
  padding: 20,
  border:
    "1px solid rgba(255,255,255,.06)",
  minWidth: 0,
};

const titleRow = {
  display: "flex",
  justifyContent:
    "space-between",
  marginBottom: 18,
};

const title = {
  color: "#fff",
  fontSize: 16,
  fontWeight: 900,
};

const subtitle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  marginTop: 4,
};

const emptyState = {
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "#64748b",
  fontWeight: 750,
};

export default TripsLineChart;