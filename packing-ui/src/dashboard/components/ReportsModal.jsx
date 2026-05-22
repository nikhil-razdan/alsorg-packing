import ReportTable from "./ReportTable";
import ReportToolbar from "./ReportToolbar";

function ReportsModal({ title, rows, columns, onClose, onExport }) {
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <h3 style={titleStyle}>{title}</h3>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        <ReportToolbar onExport={onExport} />

        <ReportTable rows={rows} columns={columns} />
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
  zIndex: 999,
};

const modal = {
  maxWidth: 1000,
  margin: "6vh auto",
  background: "#ffffff",
  borderRadius: 16,
  padding: 20,
  color: "#111827",
  boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 700,
};

const closeBtn = {
  background: "#f3f4f6",
  border: "none",
  color: "#111",
  fontSize: 18,
  cursor: "pointer",
  borderRadius: 6,
  padding: "4px 8px",
};

export default ReportsModal;
