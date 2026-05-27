import { useState } from "react";
import LogisticsShiftModal from "./LogisticsShiftModal";

function ShiftOperations() {
  const [open, setOpen] =
    useState(false);

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Shift Operations
          </div>

          <div style={subtitle}>
            Manage logistics shifts
          </div>
        </div>

        <button
          style={button}
          onClick={() => setOpen(true)}
        >
          + Create Shift
        </button>
      </div>

      <div style={placeholder}>
        Active shifts table will go here
      </div>

      <LogisticsShiftModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",

  borderRadius: 22,

  padding: 24,

  border:
    "1px solid rgba(255,255,255,0.08)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
};

const button = {
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const placeholder = {
  height: 320,
  borderRadius: 18,
  background:
    "rgba(255,255,255,0.03)",
  border:
    "1px dashed rgba(255,255,255,0.1)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  color: "#94a3b8",
};

export default ShiftOperations;