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
  padding: 24,

  borderRadius: 24,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 40px rgba(2,6,23,.34)",

  backdropFilter: "blur(18px)",
};

const title = {
  marginBottom: 18,

  fontSize: 22,

  fontWeight: 900,

  color: "#fff",
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
  marginTop: 8,

  fontSize: 11,

  color: "rgba(255,255,255,.65)",
};

export default StickerTrendChart;
