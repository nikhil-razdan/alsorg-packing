function StickerTrendChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div style={card}>
        <h3 style={title}>Sticker Generation Trend</h3>
        <p style={emptyText}>No data available</p>
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={card}>
      <h3 style={title}>Sticker Generation Trend</h3>

      <div style={chart}>
        {data.map((d, i) => (
          <div key={i} style={barWrapper}>
            <div
              style={{
                ...bar,
                height: `${(d.value / max) * 100}%`,
              }}
            />
            <span style={label}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const card = {
  padding: 24,

  borderRadius: 24,

  background:
    "rgba(var(--pf-surface-rgb),.78)",

  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",

  boxShadow:
    "0 18px 40px rgba(var(--pf-surface-deep-rgb),.34)",

  backdropFilter: "blur(18px)",
};

const title = {
  marginBottom: 18,

  fontSize: 22,

  fontWeight: 900,

  color: "var(--pf-text-strong)",
};

const chart = {
  display: "flex",
  alignItems: "flex-end",
  gap: 14,
  height: 160,
};

const barWrapper = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const bar = {
  width: "100%",
  borderRadius: 6,
  background:
    "linear-gradient(180deg,#3b82f6,#2563eb)",
};

const label = {
  marginTop: 8,
  fontSize: 11,
  color: "var(--pf-text-muted)",
  fontWeight: 750,
};

const emptyText = {
  margin: 0,
  color: "var(--pf-text-muted)",
  fontSize: 12,
  fontWeight: 700,
};

export default StickerTrendChart;
