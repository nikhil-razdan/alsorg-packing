import { useEffect, useState } from "react";
import API from "../../services/api";

function ScheduledReports() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [type, setType] = useState("inventory");
  const [time, setTime] = useState("18:00");

  const load = async () => {
    const res = await API.get("/report-schedules");
    setRows(res.data || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await API.get("/report-schedules");
        setRows(res.data || []);
      } catch (e) {
        console.error(e);
      }
    };

    init();
  }, []);

  const create = async () => {
    if (!email.trim()) return;

    await API.post("/report-schedules", {
      email,
      reportType: type,
      sendTime: time,
    });

    setEmail("");
    load();
  };

  const remove = async (id) => {
    await API.delete(`/report-schedules/${id}`);
    load();
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <h3 style={title}>Scheduled Reports</h3>
          <div style={subtitle}>
            Auto-send professional KPI Excel reports to selected users
          </div>
        </div>

        <div style={countBadge}>
          {rows.length}
        </div>
      </div>

      <div style={form}>
        <div style={fieldGroup}>
          <label style={label}>Email</label>
          <input
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label}>Report Type</label>

          <div style={selectWrap}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={select}
            >
			<option style={option} value="inventory">
			  📊 Inventory Professional Report
			</option>

			<option style={option} value="packing">
			  📦 Packing Professional Report
			</option>

			<option style={option} value="dispatch">
			  🚚 Dispatch Professional Report
			</option>
            </select>

            <span style={selectArrow}>⌄</span>
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={label}>Send Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={input}
          />
        </div>

        <button onClick={create} style={btn}>
          + Add Schedule
        </button>
      </div>

      <div style={list}>
        {rows.map((r) => (
          <div key={r.id} style={row}>
            <div style={rowInfo}>
              <div style={emailText}>{r.email}</div>

              <div style={metaRow}>
                <span style={typeChip}>
                  {formatReportType(r.reportType)}
                </span>

                <span style={timeChip}>
                  ⏰ {r.sendTime}
                </span>
              </div>
            </div>

            <button style={deleteBtn} onClick={() => remove(r.id)}>
              Delete
            </button>
          </div>
        ))}

        {rows.length === 0 && (
          <div style={emptyState}>
            No scheduled reports added yet.
          </div>
        )}
      </div>
    </div>
  );
}

const formatReportType = (value) => {
  if (value === "inventory") {
    return "📊 Inventory Professional";
  }

  if (value === "packing") {
    return "📦 Packing Professional";
  }

  if (value === "dispatch") {
    return "🚚 Dispatch Professional";
  }

  if (value === "combined") {
    return "📊 Inventory Professional";
  }

  return value;
};

const wrap = {
  background:
    "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 10px 26px rgba(var(--pf-shadow-rgb),.07)",
  padding: 18,
  borderRadius: 16,
  color: "var(--pf-text-strong)",
  colorScheme: "var(--pf-color-scheme)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
};

const title = {
  margin: 0,
  fontSize: 18,
  fontWeight: 950,
  color: "var(--pf-text-strong)",
};

const subtitle = {
  marginTop: 5,
  fontSize: 12,
  color: "var(--pf-text-muted)",
  fontWeight: 650,
};

const countBadge = {
  minWidth: 34,
  height: 34,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 950,
  boxShadow: "0 7px 16px rgba(37,99,235,.16)",
};

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 10,
  marginBottom: 16,
  alignItems: "end",
};

const fieldGroup = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const label = {
  fontSize: 10,
  fontWeight: 900,
  color: "var(--pf-text-muted)",
  textTransform: "uppercase",
  letterSpacing: ".07em",
};

const input = {
  width: "100%",
  minWidth: 0,
  height: 42,
  padding: "0 12px",
  boxSizing: "border-box",
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  outline: "none",
  fontSize: 12.5,
  fontWeight: 750,
  fontFamily: "inherit",
  colorScheme: "var(--pf-color-scheme)",
};

const selectWrap = {
  position: "relative",
  height: 42,
};

const select = {
  width: "100%",
  height: 42,
  padding: "0 38px 0 12px",
  borderRadius: 11,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  outline: "none",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  boxShadow: "none",
  colorScheme: "var(--pf-color-scheme)",
};

const option = {
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  fontWeight: 700,
};

const selectArrow = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-54%)",
  color: "var(--pf-text-muted)",
  fontSize: 18,
  fontWeight: 900,
  pointerEvents: "none",
};

const btn = {
  height: 42,
  padding: "0 15px",
  borderRadius: 11,
  border: "1px solid rgba(37,99,235,.28)",
  cursor: "pointer",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 900,
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  width: "100%",
  boxShadow: "0 7px 16px rgba(37,99,235,.16)",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  padding: "12px 13px",
  borderRadius: 13,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
  color: "var(--pf-text)",
  flexWrap: "wrap",
};

const rowInfo = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const emailText = {
  fontSize: 12.5,
  fontWeight: 850,
  color: "var(--pf-text-strong)",
  overflowWrap: "anywhere",
};

const metaRow = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const typeChip = {
  padding: "4px 9px",
  borderRadius: 999,
  background: "rgba(59,130,246,.09)",
  border: "1px solid rgba(59,130,246,.18)",
  color: "color-mix(in srgb,#2563eb 78%,var(--pf-text-strong))",
  fontSize: 10.5,
  fontWeight: 850,
};

const timeChip = {
  padding: "4px 9px",
  borderRadius: 999,
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border-soft)",
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  fontWeight: 850,
};

const deleteBtn = {
  border: "1px solid rgba(220,38,38,.24)",
  background: "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  padding: "7px 11px",
  borderRadius: 9,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 900,
  fontFamily: "inherit",
  boxShadow: "0 5px 12px rgba(220,38,38,.14)",
};

const emptyState = {
  padding: "16px 14px",
  borderRadius: 13,
  background: "var(--pf-surface-alt)",
  border: "1px dashed var(--pf-border)",
  color: "var(--pf-text-muted)",
  fontSize: 12,
  fontWeight: 700,
};

export default ScheduledReports;
