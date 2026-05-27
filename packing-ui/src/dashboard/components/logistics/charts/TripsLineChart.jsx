import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function TripsLineChart({
  logistics,
}) {
  const data = Object.entries(
    logistics?.tripsOverTime || {}
  ).map(([date, trips]) => ({
    date,
    trips,
  }));

  return (
    <div style={card}>
      <div style={title}>
        Trips Over Time
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
            />

            <XAxis dataKey="date" />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="trips"
              stroke="#3b82f6"
              strokeWidth={3}
            />
          </LineChart>
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

export default TripsLineChart;