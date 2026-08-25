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
  flex: 1,
  minHeight: 0,
  maxHeight: "62vh",
  overflow: "auto",
  marginTop: 10,
  borderRadius: 14,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
  scrollbarWidth: "thin",
  scrollbarColor: "#3b82f6 var(--pf-surface-alt)",
};

const table = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "collapse",
  fontSize: 12.5,
};

const th = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  textAlign: "left",
  padding: "11px 12px",
  borderBottom: "1px solid var(--pf-border)",
  fontWeight: 950,
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  whiteSpace: "nowrap",
};

const td = {
  background: "var(--pf-surface)",
  padding: "10px 12px",
  borderBottom: "1px solid var(--pf-border-soft)",
  color: "var(--pf-text)",
  verticalAlign: "top",
};

const empty = {
  textAlign: "center",
  padding: 26,
  color: "var(--pf-text-muted)",
  fontWeight: 750,
};

export default ReportTable;
