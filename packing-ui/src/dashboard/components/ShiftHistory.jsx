function ShiftHistory() {
  return (
    <div style={wrap}>
      <div style={title}>
        Shift History
      </div>

      <div style={subtitle}>
        Historical logistics operations
      </div>

      <div style={placeholder}>
        Shift history table will appear here
      </div>
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
  marginBottom: 24,
};

const placeholder = {
  height: 420,
  borderRadius: 18,
  border:
    "1px dashed rgba(255,255,255,0.08)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  color: "#94a3b8",
};

export default ShiftHistory;