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

  borderRadius: 24,

  padding: 24,

  color: "#fff",

  background:
    "linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92))",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 35px 90px rgba(0,0,0,.45)",

  backdropFilter: "blur(20px)",
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
  background:
    "rgba(255,255,255,.06)",

  border: "none",

  color: "#fff",

  fontSize: 18,

  cursor: "pointer",

  borderRadius: 10,

  padding: "6px 10px",
};

export default ReportsModal;
