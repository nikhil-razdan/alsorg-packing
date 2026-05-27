function ReportToolbar({ onExport }) {
  return (
    <div style={bar}>
      <button style={btn} onClick={() => onExport("csv")}>
        CSV
      </button>
      <button style={btn} onClick={() => onExport("excel")}>
        Excel
      </button>
      <button style={{ ...btn, opacity: 0.5, cursor: "not-allowed" }} disabled>
        PDF
      </button>
    </div>
  );
}

const bar = {
  display: "flex",
  gap: 10,
  marginBottom: 10,
  flexWrap: "wrap",
};

const btn = {
  padding: "10px 16px",

  borderRadius: 14,

  border:
    "1px solid rgba(255,255,255,.08)",

  cursor: "pointer",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 800,

  boxShadow:
    "0 10px 24px rgba(37,99,235,.28)",

  transition: "all .25s ease",
};

export default ReportToolbar;