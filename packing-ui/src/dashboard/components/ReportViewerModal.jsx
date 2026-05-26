import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config";

function ReportViewerModal({
  open,
  onClose,
  title,
  fetchUrl,
  exportCsvUrl,
  exportExcelUrl,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });

  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    }),
    []
  );

  const loadReport = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE_URL}${fetchUrl}?from=${encodeURIComponent(
          from
        )}&to=${encodeURIComponent(to)}`,
        { headers: authHeaders }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load report");
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Report load failed", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const exportFile = async (url, filename) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}${url}?from=${encodeURIComponent(
          from
        )}&to=${encodeURIComponent(to)}`,
        { headers: authHeaders }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Export error:", text);
        throw new Error(text || "Export failed");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to download report");
    }
  };

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalGlow} />
        <div style={header}>
          <div>
            <h3 style={titleStyle}>{title}</h3>
            <div style={subtitle}>
              Select a date range, load the report, or export it directly.
            </div>
          </div>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

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
            onClick={() => exportFile(exportCsvUrl, "report.csv")}
          >
            CSV
          </button>

          <button
            style={actionBtn}
            onClick={() => exportFile(exportExcelUrl, "report.xlsx")}
          >
            Excel
          </button>
        </div>

        <div style={tableWrapper}>
          {loading && <p style={statusText}>Loading...</p>}

          {!loading && rows.length === 0 && (
            <p style={statusText}>No data found.</p>
          )}

          {!loading && rows.length > 0 && (
            <table style={table}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={th}>
                      {key}
                    </th>
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

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
  padding: 16,
};

const modal = {
  width: "min(1180px, 94vw)",
  maxHeight: "88vh",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 28,
  padding: 24,
  color: "#0f172a",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.82))",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.38)",
  boxShadow:
    "0 35px 90px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.7)",
};

const modalGlow = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 120,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(255,255,255,0.14), transparent)",
  pointerEvents: "none",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 18,
  gap: 12,
  position: "relative",
  zIndex: 1,
};

const titleStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitle = {
  marginTop: 6,
  fontSize: 13,
  color: "#64748b",
  fontWeight: 500,
};

const closeBtn = {
  background: "rgba(15,23,42,0.06)",
  border: "none",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
  width: 36,
  height: 36,
  borderRadius: 999,
};

const controls = {
  display: "flex",
  gap: 12,
  marginBottom: 18,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 1,
};

const input = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
};

const actionBtn = {
  padding: "10px 16px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(180deg, #0f172a, #111827)",
  color: "#fff",
  fontWeight: 800,
  boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
};

const tableWrapper = {
  overflow: "auto",
  flex: 1,
  borderRadius: 18,
  background: "rgba(255,255,255,0.64)",
  border: "1px solid rgba(148,163,184,0.18)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "#f8fafc",
  color: "#334155",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
  padding: "12px 10px",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontSize: 11,
  fontWeight: 800,
};

const td = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(148,163,184,0.14)",
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const statusText = {
  padding: 16,
  color: "#64748b",
  fontWeight: 600,
};

export default ReportViewerModal;