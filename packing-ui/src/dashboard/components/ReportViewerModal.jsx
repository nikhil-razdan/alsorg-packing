import { useCallback, useEffect, useMemo, useState } from "react";
import usePackFlowDataRefresh from "../hooks/usePackFlowDataRefresh";
import { API_BASE_URL } from "../../config";
import { secureFetch } from "../../services/api";

const toLocalDateTimeInput = (value) => {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMinutes(
    date.getMinutes() -
    date.getTimezoneOffset()
  );

  return date
    .toISOString()
    .slice(0, 16);
};

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
    return toLocalDateTimeInput(d);
  });

  const [to, setTo] = useState(() =>
    toLocalDateTimeInput(new Date())
  );

  const [followNow, setFollowNow] =
    useState(true);

  const authHeaders = () => ({});

  const loadReport = useCallback(
    async ({
      background = false,
    } = {}) => {
      const effectiveTo =
        followNow
          ? toLocalDateTimeInput(
            new Date()
          )
          : to;

      if (
        followNow &&
        effectiveTo !== to
      ) {
        setTo(effectiveTo);
      }

      try {
        if (!background) {
          setLoading(true);
        }

        const res = await secureFetch(
          `${API_BASE_URL}${fetchUrl}?from=${encodeURIComponent(
            from
          )}&to=${encodeURIComponent(
            effectiveTo
          )}`,
          {
            credentials: "include",
            headers: authHeaders(),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            text ||
            "Failed to load report"
          );
        }

        const data = await res.json();
        setRows(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        if (!background) {
          console.error(
            "Report load failed",
            err
          );
          setRows([]);
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [
      fetchUrl,
      followNow,
      from,
      to,
    ]
  );

  useEffect(() => {
    if (!open) return;

    void loadReport();
    // Opening the modal triggers the foreground load. Live polling handles
    // subsequent revalidation without turning each "follow now" tick into a
    // second visible request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  usePackFlowDataRefresh(
    "reports",
    async () => {
      if (!open) {
        return;
      }

      await loadReport({
        background: true,
      });
    },
    {
      enabled: open,
      intervalMs: 10000,
    }
  );

  const exportFile = async (url, filename) => {
    try {
      const res = await secureFetch(
        `${API_BASE_URL}${url}?from=${encodeURIComponent(
          from
        )}&to=${encodeURIComponent(to)}`,
        {
          credentials: "include",
          headers: authHeaders(),
        }
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
            onChange={(e) => {
              setFollowNow(false);
              setTo(e.target.value);
            }}
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
  zIndex: 16000,
  padding: 18,
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "rgba(15,23,42,.42)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const modal = {
  width: "min(1180px, calc(100vw - 36px))",
  height: "min(88vh, 860px)",
  maxHeight: "calc(100vh - 36px)",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
  color: "var(--pf-text-strong)",
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.07),transparent 34%),linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 30px 90px rgba(var(--pf-shadow-rgb),.24)",
};

const modalGlow = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 96,
  background:
    "linear-gradient(180deg,rgba(59,130,246,.05),transparent)",
  pointerEvents: "none",
};

const header = {
  flexShrink: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 14,
  gap: 12,
  position: "relative",
  zIndex: 1,
};

const titleStyle = {
  margin: 0,
  fontSize: 23,
  lineHeight: 1.15,
  fontWeight: 950,
  color: "var(--pf-text-strong)",
};

const subtitle = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--pf-text-muted)",
  fontWeight: 650,
};

const closeBtn = {
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border)",
  color: "var(--pf-text)",
  fontSize: 16,
  fontWeight: 850,
  cursor: "pointer",
  width: 36,
  height: 36,
  borderRadius: 10,
};

const controls = {
  flexShrink: 0,
  display: "flex",
  flexWrap: "wrap",
  gap: 9,
  marginBottom: 14,
  position: "relative",
  zIndex: 1,
  alignItems: "center",
};

const input = {
  flex: "1 1 210px",
  minWidth: 180,
  height: 38,
  padding: "0 11px",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  outline: "none",
  fontFamily: "inherit",
  fontWeight: 750,
  colorScheme: "var(--pf-color-scheme)",
};

const actionBtn = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(37,99,235,.28)",
  cursor: "pointer",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 900,
  fontFamily: "inherit",
  boxShadow: "0 7px 16px rgba(37,99,235,.15)",
  whiteSpace: "nowrap",
};

const tableWrapper = {
  minHeight: 0,
  overflow: "auto",
  flex: 1,
  borderRadius: 14,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border)",
  scrollbarWidth: "thin",
  scrollbarColor: "#3b82f6 var(--pf-surface-alt)",
};

const table = {
  width: "100%",
  minWidth: 760,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

const th = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  borderBottom: "1px solid var(--pf-border)",
  padding: "11px 10px",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontSize: 10,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 10px",
  borderBottom: "1px solid var(--pf-border-soft)",
  color: "var(--pf-text)",
  whiteSpace: "nowrap",
};

const statusText = {
  padding: 20,
  color: "var(--pf-text-muted)",
  fontWeight: 700,
};

export default ReportViewerModal;
