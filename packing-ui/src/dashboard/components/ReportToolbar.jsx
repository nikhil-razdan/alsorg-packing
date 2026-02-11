function ReportToolbar({ onExport }) {
  return (
    <div style={bar}>
      <button style={btn} onClick={() => onExport("csv")}>CSV</button>
      <button style={btn} onClick={() => onExport("excel")}>Excel</button>
      <button style={btn} disabled>PDF</button>
    </div>
  );
}

/* ===================== STYLES ===================== */

const bar = {
  display: "flex",
  gap: 10,
  marginBottom: 10,
};

const btn = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))",
  color: "#111",
  fontWeight: 600,
};

export default ReportToolbar;
