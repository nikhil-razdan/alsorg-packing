function ReportTable({ rows = [], columns = [] }) {
  return (
    <div style={wrap}>
      <table style={table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={th}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length || 1} style={empty}>
                No data available
              </td>
            </tr>
          )}

          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.key} style={td}>
                  {row[col.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const wrap = {
  maxHeight: "55vh",
  overflow: "auto",
  marginTop: 12,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.68)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
  textAlign: "left",
  padding: "12px 12px",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
  fontWeight: 800,
  background: "#f8fafc",
  color: "#334155",
  position: "sticky",
  top: 0,
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148,163,184,0.12)",
  color: "#0f172a",
};

const empty = {
  textAlign: "center",
  padding: 20,
  opacity: 0.75,
  color: "#64748b",
};

export default ReportTable;