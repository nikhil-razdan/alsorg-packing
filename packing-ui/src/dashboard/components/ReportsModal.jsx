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
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18))",
  borderRadius: 22,
  padding: 28,
  color: "#fff",
  boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
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
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  cursor: "pointer",
};

export default ReportsModal;
