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
      <div style={header}>
        <div>
          <div style={title}>Corporate Inventory Mix</div>
          <div style={subtitle}>
            Clean board-room view of stock distribution
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
              <div key={row.key} style={barRow}>
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
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const title = {
  fontSize: 17,
  fontWeight: 950,
  color: "#fff",
};

const subtitle = {
  marginTop: 4,
  fontSize: 11,
  color: "rgba(255,255,255,.54)",
  fontWeight: 650,
};

const totalBadge = {
  minWidth: 78,
  padding: "8px 10px",
  borderRadius: 14,
  background: "rgba(37,99,235,.14)",
  border: "1px solid rgba(96,165,250,.22)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  textAlign: "right",
};

const body = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(210px,.82fr) minmax(0,1.18fr)",
  gap: 14,
  alignItems: "stretch",
};

const scoreGrid = {
  display: "grid",
  gridTemplateRows: "repeat(3,1fr)",
  gap: 9,
};

const scoreCard = (accent) => ({
  padding: 11,
  borderRadius: 15,
  background:
    `radial-gradient(circle at top right, ${accent}20, transparent 42%), rgba(255,255,255,.035)`,
  border: `1px solid ${accent}30`,
  minHeight: 0,
});

const scoreTop = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "rgba(255,255,255,.62)",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: ".07em",
};

const scoreDot = (accent) => ({
  width: 8,
  height: 8,
  borderRadius: 999,
  background: accent,
  boxShadow: `0 0 14px ${accent}88`,
  flexShrink: 0,
});

const scoreValue = {
  marginTop: 6,
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 950,
};

const scoreLabel = {
  marginTop: 5,
  color: "rgba(255,255,255,.48)",
  fontSize: 10.5,
  fontWeight: 700,
};

const barPanel = {
  padding: 12,
  borderRadius: 16,
  background: "rgba(2,6,23,.30)",
  border: "1px solid rgba(255,255,255,.055)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 15,
};

const barRow = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
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
  fontSize: 12,
  fontWeight: 900,
};

const barValue = {
  color: "rgba(255,255,255,.58)",
  fontSize: 11,
  fontWeight: 850,
};

const track = {
  height: 9,
  borderRadius: 999,
  background: "rgba(255,255,255,.07)",
  overflow: "hidden",
};

const fill = (accent) => ({
  height: "100%",
  borderRadius: 999,
  background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
  boxShadow: `0 0 18px ${accent}55`,
});

export default StatusCorporateChart;