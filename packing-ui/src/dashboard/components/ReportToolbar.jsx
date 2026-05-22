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
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.22)",
  cursor: "pointer",
  background: "linear-gradient(180deg, #ffffff, #e2e8f0)",
  color: "#0f172a",
  fontWeight: 800,
  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
};

export default ReportToolbar;