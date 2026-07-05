function StatusCorporateChart({
  warehouse = 0,
  readyToDispatch = 0,
  ready = 0,
}) {
  const rows = [
    {
      key: "warehouse",
      label: "Warehouse",
      short: "WH",
      value: Number(warehouse || 0),
      color: "#60a5fa",
      note: "Stored inventory",
    },
    {
      key: "readyToDispatch",
      label: "Ready to Dispatch",
      short: "RTD",
      value: Number(readyToDispatch || 0),
      color: "#f59e0b",
      note: "Dispatch pending",
    },
    {
      key: "ready",
      label: "Ready",
      short: "RDY",
      value: Number(ready || 0),
      color: "#34d399",
      note: "Operational ready stock",
    },
  ];

  const total =
    rows.reduce((sum, row) => sum + row.value, 0);

  const max =
    Math.max(...rows.map((row) => row.value), 1);

  return (
    <div style={card}>
      <div style={chartHeader}>
        <div>
          <div style={chartTitle}>
            Corporate Inventory Mix
          </div>

          <div style={chartSubtitle}>
            Board-room view of stock distribution
          </div>
        </div>

        <div style={totalBadge}>
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div style={body}>
        <div style={scoreGrid}>
          {rows.map((row) => {
            const percentage =
              total > 0
                ? Math.round((row.value / total) * 100)
                : 0;

            return (
              <div
                key={row.key}
                style={scoreCard(row.color)}
              >
                <div style={scoreTop}>
                  <span style={scoreDot(row.color)} />
                  <span>{row.short}</span>
                </div>

                <div style={scoreValue}>
                  {row.value}
                </div>

                <div style={scoreLabel}>
                  {percentage}% • {row.note}
                </div>
              </div>
            );
          })}
        </div>

        <div style={barPanel}>
          {rows.map((row) => {
            const width =
              Math.max(
                4,
                Math.round((row.value / max) * 100)
              );

            const percentage =
              total > 0
                ? Math.round((row.value / total) * 100)
                : 0;

            return (
              <div
                key={row.key}
                style={barRow}
              >
                <div style={barHead}>
                  <div style={barName}>
                    <span style={scoreDot(row.color)} />
                    {row.label}
                  </div>

                  <div style={barValue}>
                    {row.value} / {percentage}%
                  </div>
                </div>

                <div style={track}>
                  <div
                    style={{
                      ...fill(row.color),
                      width: `${width}%`,
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

const card = {
  width: "100%",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
};

const chartHeader = {
  flexShrink: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const chartTitle = {
  fontSize: 17,
  fontWeight: 950,
  color: "#fff",
  letterSpacing: "-.02em",
};

const chartSubtitle = {
  marginTop: 3,
  fontSize: 10.5,
  color: "rgba(255,255,255,.52)",
  fontWeight: 650,
};

const totalBadge = {
  minWidth: 66,
  padding: "7px 9px",
  borderRadius: 13,
  background: "rgba(37,99,235,.14)",
  border: "1px solid rgba(96,165,250,.24)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  textAlign: "right",
  color: "rgba(255,255,255,.72)",
  fontSize: 10,
  fontWeight: 850,
};

const body = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "minmax(190px,.72fr) minmax(0,1.28fr)",
  gap: 12,
  alignItems: "stretch",
};

const scoreGrid = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "repeat(3,minmax(0,1fr))",
  gap: 8,
};

const scoreCard = (accent) => ({
  minHeight: 0,
  overflow: "hidden",
  padding: "9px 10px",
  borderRadius: 14,
  background:
    `radial-gradient(circle at top right, ${accent}1F, transparent 42%), rgba(255,255,255,.034)`,
  border: `1px solid ${accent}30`,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
});

const scoreTop = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "rgba(255,255,255,.62)",
  fontSize: 9.5,
  fontWeight: 950,
  letterSpacing: ".07em",
};

const scoreDot = (accent) => ({
  width: 7,
  height: 7,
  borderRadius: 999,
  background: accent,
  boxShadow: `0 0 12px ${accent}88`,
  flexShrink: 0,
});

const scoreValue = {
  marginTop: 5,
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 950,
};

const scoreLabel = {
  marginTop: 4,
  color: "rgba(255,255,255,.46)",
  fontSize: 9.5,
  fontWeight: 750,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const barPanel = {
  minHeight: 0,
  overflow: "hidden",
  padding: 12,
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(2,6,23,.36), rgba(2,6,23,.22))",
  border: "1px solid rgba(255,255,255,.055)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 13,
};

const barRow = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const barHead = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const barName = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#fff",
  fontSize: 11.5,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const barValue = {
  color: "rgba(255,255,255,.58)",
  fontSize: 10.5,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const track = {
  height: 8,
  borderRadius: 999,
  background: "rgba(255,255,255,.07)",
  overflow: "hidden",
};

const fill = (accent) => ({
  height: "100%",
  borderRadius: 999,
  background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
  boxShadow: `0 0 16px ${accent}55`,
});

export default StatusCorporateChart;