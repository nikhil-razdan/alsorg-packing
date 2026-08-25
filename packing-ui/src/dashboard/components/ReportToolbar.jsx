function ReportToolbar({ onExport }) {
  return (
    <div style={bar}>
      <button style={csvBtn} onClick={() => onExport("csv")}>
        CSV
      </button>
      <button style={excelBtn} onClick={() => onExport("excel")}>
        Excel
      </button>
      <button style={disabledBtn} disabled>
        PDF
      </button>
    </div>
  );
}

const bar = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  flexWrap: "wrap",
};

const baseBtn = {
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  color: "#fff",
  fontWeight: 900,
  fontFamily: "inherit",
  boxShadow: "0 7px 16px rgba(var(--pf-shadow-rgb),.08)",
};

const csvBtn = {
  ...baseBtn,
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  borderColor: "rgba(37,99,235,.28)",
};

const excelBtn = {
  ...baseBtn,
  background: "linear-gradient(135deg,#059669,#10b981)",
  borderColor: "rgba(5,150,105,.28)",
};

const disabledBtn = {
  ...baseBtn,
  cursor: "not-allowed",
  color: "var(--pf-text-dim)",
  background: "var(--pf-surface-alt)",
  borderColor: "var(--pf-border)",
  boxShadow: "none",
  opacity: 0.72,
};

export default ReportToolbar;
