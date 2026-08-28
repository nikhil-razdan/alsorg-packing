function StickerTrendChart({ data = [] }) {
  const rows = Array.isArray(data)
    ? data
        .map((row) => ({
          label: String(row?.label ?? ""),
          value: Number(row?.value ?? 0) || 0,
        }))
        .filter((row) => row.label)
    : [];

  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={eyebrow}>PACKING OUTPUT</div>
        <h3 style={title}>Sticker generation trend</h3>
        <div style={empty}>No sticker trend data available</div>
      </div>
    );
  }

  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div style={card}>
      <div style={header}>
        <div>
          <div style={eyebrow}>PACKING OUTPUT</div>
          <h3 style={title}>Sticker generation trend</h3>
        </div>
        <div style={totalBox}>
          <span>Period total</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div style={chart}>
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} style={barColumn}>
            <div style={valueLabel}>{row.value}</div>
            <div style={barTrack}>
              <div
                style={{
                  ...bar,
                  height: `${Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0)}%`,
                }}
              />
            </div>
            <span style={label} title={row.label}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const card = {
  minWidth: 0,
  padding: 16,
  borderRadius: 12,
  background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 8px 22px rgba(var(--pf-shadow-rgb),.055)",
  color: "var(--pf-text-strong)",
};

const header = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrow = {
  color: "#2563eb",
  fontSize: 8,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const title = {
  margin: "4px 0 0",
  fontSize: 14,
  fontWeight: 950,
};

const totalBox = {
  minWidth: 88,
  padding: "7px 9px",
  borderRadius: 9,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  color: "var(--pf-text-muted)",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
  fontSize: 8,
  fontWeight: 800,
};

const chart = {
  display: "flex",
  alignItems: "stretch",
  gap: 8,
  height: 190,
  marginTop: 14,
};

const barColumn = {
  flex: 1,
  minWidth: 22,
  display: "grid",
  gridTemplateRows: "18px 1fr 24px",
  alignItems: "end",
  textAlign: "center",
};

const valueLabel = {
  color: "var(--pf-text-muted)",
  fontSize: 8.5,
  fontWeight: 850,
};

const barTrack = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "flex-end",
  overflow: "hidden",
  borderRadius: "6px 6px 2px 2px",
  background: "rgba(var(--pf-fg-rgb),.035)",
};

const bar = {
  width: "100%",
  borderRadius: "6px 6px 2px 2px",
  background: "linear-gradient(180deg,#60a5fa,#2563eb)",
};

const label = {
  marginTop: 6,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--pf-text-muted)",
  fontSize: 8,
  fontWeight: 750,
};

const empty = {
  minHeight: 150,
  display: "grid",
  placeItems: "center",
  color: "var(--pf-text-muted)",
  fontSize: 10,
  fontWeight: 750,
};

export default StickerTrendChart;
