import ReportTable from "./ReportTable";
import ReportToolbar from "./ReportToolbar";

function ReportsModal({ title, rows, columns, onClose, onExport }) {
  return (
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        style={modal}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Report"}
      >
        <div style={header}>
          <div>
            <div style={eyebrow}>PACKFLOW REPORT</div>
            <h3 style={titleStyle}>{title}</h3>
          </div>

          <button
            type="button"
            style={closeBtn}
            onClick={onClose}
            aria-label="Close report"
          >
            ✕
          </button>
        </div>

        <ReportToolbar onExport={onExport} />
        <ReportTable rows={rows} columns={columns} />
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 15000,
  padding: 18,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(var(--pf-surface-deep-rgb),.76)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const modal = {
  width: "min(1120px, calc(100vw - 36px))",
  maxHeight: "min(88vh, 860px)",
  minHeight: 320,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
  color: "var(--pf-text-strong)",
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.07),transparent 32%),linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 28px 80px rgba(var(--pf-shadow-rgb),.24)",
};

const header = {
  flexShrink: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 14,
};

const eyebrow = {
  color: "#2563eb",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".10em",
};

const titleStyle = {
  margin: "4px 0 0",
  color: "var(--pf-text-strong)",
  fontSize: 22,
  lineHeight: 1.15,
  fontWeight: 950,
};

const closeBtn = {
  width: 36,
  height: 36,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border)",
  color: "var(--pf-text)",
  fontSize: 16,
  cursor: "pointer",
  borderRadius: 10,
};

export default ReportsModal;
