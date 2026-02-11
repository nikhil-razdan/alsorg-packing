function ReportTable({ rows, columns }) {
  return (
    <div style={wrap}>
      <table style={table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={th}>{col.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={empty}>
                No data available
              </td>
            </tr>
          )}

          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
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

/* ===================== STYLES ===================== */

const wrap = {
  maxHeight: "55vh",
  overflow: "auto",
  marginTop: 12,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.25)",
  fontWeight: 700,
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
};

const empty = {
  textAlign: "center",
  padding: 20,
  opacity: 0.75,
};

export default ReportTable;
