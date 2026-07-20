import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function StatusDistributionChart({
  data = [],
}) {
  const total =
    data.reduce(
      (sum, item) =>
        sum +
        Number(item.value || 0),
      0
    );

  return (
    <div style={card}>
      <div style={title}>
        Operation Status Mix
      </div>

      <div style={subtitle}>
        Challan and manual records shown separately
      </div>

      <div style={{ height: 320 }}>
        {data.length === 0 ? (
          <div style={emptyState}>
            No status data available
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={104}
                paddingAngle={3}
              >
                {data.map(
                  (entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                    />
                  )
                )}
              </Pie>

              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border:
                    "1px solid rgba(255,255,255,.10)",
                  borderRadius: 12,
                  color: "#fff",
                }}
              />

              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "#cbd5e1",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={totalBox}>
        <div style={totalLabel}>
          Total operational records
        </div>

        <div style={totalValue}>
          {total}
        </div>
      </div>
    </div>
  );
}

const card = {
  position: "relative",
  background:
    "rgba(15,23,42,.76)",
  borderRadius: 24,
  padding: 20,
  border:
    "1px solid rgba(255,255,255,.06)",
  minWidth: 0,
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

const totalBox = {
  position: "absolute",
  top: 178,
  left: "50%",
  transform:
    "translate(-50%,-50%)",
  textAlign: "center",
  pointerEvents: "none",
};

const totalLabel = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 750,
  maxWidth: 90,
};

const totalValue = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  marginTop: 3,
};

export default StatusDistributionChart;