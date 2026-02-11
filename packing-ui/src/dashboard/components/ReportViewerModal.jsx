import { useEffect, useState } from "react";

function ReportViewerModal({
  open,
  onClose,
  title,
  fetchUrl,
  exportCsvUrl,
  exportExcelUrl
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });

  const [to, setTo] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );

  useEffect(() => {
    if (!open) return;

    loadReport();
  }, [open]);

  const loadReport = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${fetchUrl}?from=${from}:00&to=${to}:00`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to load report");

      const data = await res.json();
      setRows(data);
    } catch (err) {
      console.error("Report load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const exportFile = (url) => {
    window.open(
      `${url}?from=${from}:00&to=${to}:00`,
      "_blank"
    );
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <h3 style={titleStyle}>{title}</h3>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Date Controls */}
        <div style={controls}>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={input}
          />
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={input}
          />

          <button style={actionBtn} onClick={loadReport}>
            Load
          </button>

          <button
            style={actionBtn}
            onClick={() => exportFile(exportCsvUrl)}
          >
            CSV
          </button>

          <button
            style={actionBtn}
            onClick={() => exportFile(exportExcelUrl)}
          >
            Excel
          </button>
        </div>

        {/* Table */}
        <div style={tableWrapper}>
          {loading && <p>Loading...</p>}

          {!loading && rows.length === 0 && (
            <p>No data found.</p>
          )}

          {!loading && rows.length > 0 && (
            <table style={table}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={th}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={td}>
                        {String(val ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999
};

const modal = {
  width: "85%",
  maxHeight: "85vh",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))",
  borderRadius: 20,
  padding: 24,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  color: "#fff"
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18
};

const titleStyle = {
  margin: 0
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 20,
  cursor: "pointer"
};

const controls = {
  display: "flex",
  gap: 12,
  marginBottom: 18,
  flexWrap: "wrap"
};

const input = {
  padding: 6,
  borderRadius: 6,
  border: "none"
};

const actionBtn = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  background: "#fff",
  color: "#111",
  fontWeight: 600
};

const tableWrapper = {
  overflowY: "auto",
  flex: 1
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13
};

const th = {
  borderBottom: "1px solid rgba(255,255,255,0.3)",
  padding: 8,
  textAlign: "left"
};

const td = {
  padding: 8,
  borderBottom: "1px solid rgba(255,255,255,0.15)"
};

export default ReportViewerModal;
