import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#22c55e",
  "#ef4444",
  "#f59e0b",
];

function StatusDistributionChart({
  logistics,
}) {
  const data = Object.entries(
    logistics.shiftPerformance || {}
  ).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div style={card}>
      <div style={title}>
        Status Distribution
      </div>

      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={70}
              outerRadius={110}
            >
              {data.map(
                (_, index) => (
                  <Cell
                    key={index}
                    fill={
                      COLORS[index]
                    }
                  />
                )
              )}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const card = {
  background:
    "rgba(15,23,42,.72)",

  borderRadius: 24,

  padding: 20,

  border:
    "1px solid rgba(255,255,255,.06)",
};

const title = {
  color: "#fff",

  fontWeight: 800,

  marginBottom: 20,
};

export default StatusDistributionChart;