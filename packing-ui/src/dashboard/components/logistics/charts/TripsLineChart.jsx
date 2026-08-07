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
            Operations & Dispatch Volume
          </div>

          <div style={subtitle}>
            Last 14 operational dates • challans, manual movements and item volume
          </div>
        </div>
      </div>

      <div style={{ height: 330 }}>
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
                right: 8,
                left: -8,
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
                  fontSize: 10,
                }}
              />

              <YAxis
                yAxisId="operations"
                allowDecimals={false}
                stroke="#64748b"
                tick={{
                  fill: "#94a3b8",
                  fontSize: 10,
                }}
              />

              <YAxis
                yAxisId="items"
                orientation="right"
                allowDecimals={false}
                stroke="#64748b"
                tick={{
                  fill: "#64748b",
                  fontSize: 9,
                }}
              />

              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border:
                    "1px solid rgba(255,255,255,.10)",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 11,
                }}
              />

              <Legend
                wrapperStyle={{
                  fontSize: 10,
                  color: "#cbd5e1",
                }}
              />

              <Line
                yAxisId="operations"
                type="monotone"
                dataKey="challans"
                name="Dispatch Challans"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              <Line
                yAxisId="operations"
                type="monotone"
                dataKey="manualOperations"
                name="Manual Operations"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              <Line
                yAxisId="items"
                type="monotone"
                dataKey="dispatchedItems"
                name="Dispatched Items"
                stroke="#22c55e"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 2.5 }}
                activeDot={{ r: 4.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={footNote}>
        Item volume uses the right-side scale so high packet counts do not flatten trip trends.
      </div>
    </div>
  );
}

const card = {
  background:
    "rgba(15,23,42,.76)",
  borderRadius: 20,
  padding: 18,
  border:
    "1px solid rgba(255,255,255,.06)",
  minWidth: 0,
};

const titleRow = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 14,
};

const title = {
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
};

const subtitle = {
  color: "#64748b",
  fontSize: 10,
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

const footNote = {
  marginTop: 5,
  color: "#475569",
  fontSize: 9,
  fontWeight: 700,
};

export default TripsLineChart;
