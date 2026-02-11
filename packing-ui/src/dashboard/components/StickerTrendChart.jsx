function StickerTrendChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div style={card}>
        <h3 style={title}>Sticker Generation Trend</h3>
        <p style={{ opacity: 0.8 }}>No data available</p>
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
  padding: 26,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.16))",
  backdropFilter: "blur(18px)",
  boxShadow:
    "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
  color: "#fff",
};

const title = {
  marginBottom: 18,
  fontSize: 20,
  fontWeight: 700,
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
    "linear-gradient(180deg, rgba(191,219,254,0.95), rgba(147,197,253,0.95))",
};

const label = {
  marginTop: 6,
  fontSize: 11,
  opacity: 0.8,
};

export default StickerTrendChart;
