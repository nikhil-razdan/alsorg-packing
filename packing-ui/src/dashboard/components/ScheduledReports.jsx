import { useEffect, useState } from "react";
import API from "../../services/api";

function ScheduledReports() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [type, setType] = useState("packing");
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
            Auto-send inventory reports to selected users
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
              <option style={option} value="packing">
                📦 Packing Report
              </option>

              <option style={option} value="dispatch">
                🚚 Dispatch Report
              </option>

              <option style={option} value="combined">
                📊 Combined Report
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
  if (value === "packing") return "📦 Packing";
  if (value === "dispatch") return "🚚 Dispatch";
  if (value === "combined") return "📊 Combined";
  return value;
};

const wrap = {
  background:
    "linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.68))",

  border:
    "1px solid rgba(255,255,255,.07)",

  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",

  padding: 20,

  borderRadius: 24,

  backdropFilter: "blur(18px)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 18,
};

const title = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const subtitle = {
  marginTop: 5,
  fontSize: 12,
  color: "rgba(255,255,255,.56)",
};

const countBadge = {
  minWidth: 36,
  height: 36,

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontSize: 13,
  fontWeight: 900,

  boxShadow:
    "0 10px 24px rgba(37,99,235,.28)",
};

const form = {
  display: "grid",
  gridTemplateColumns:
    "minmax(240px,1.4fr) minmax(210px,.9fr) minmax(150px,.55fr) auto",
  gap: 12,
  marginBottom: 16,
  alignItems: "end",
};

const fieldGroup = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const label = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,.58)",
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const input = {
  height: 44,

  padding: "0 14px",

  borderRadius: 15,

  border:
    "1px solid rgba(255,255,255,.08)",

  background:
    "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.035))",

  color: "#fff",

  outline: "none",

  fontSize: 13,

  fontWeight: 700,

  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.06)",
};

const selectWrap = {
  position: "relative",
  height: 44,
};

const select = {
  width: "100%",
  height: 44,

  padding: "0 42px 0 14px",

  borderRadius: 15,

  border:
    "1px solid rgba(59,130,246,.22)",

  background:
    "linear-gradient(180deg, rgba(30,41,59,.96), rgba(15,23,42,.96))",

  color: "#fff",

  outline: "none",

  fontSize: 13,

  fontWeight: 800,

  cursor: "pointer",

  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",

  boxShadow:
    "0 12px 28px rgba(2,6,23,.28), inset 0 1px 0 rgba(255,255,255,.07)",
};

const option = {
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
};

const selectArrow = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-56%)",

  color: "#93c5fd",

  fontSize: 20,
  fontWeight: 900,

  pointerEvents: "none",
};

const btn = {
  height: 44,

  padding: "0 16px",

  borderRadius: 15,

  border: "none",

  cursor: "pointer",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 900,

  whiteSpace: "nowrap",

  boxShadow:
    "0 12px 28px rgba(37,99,235,.32)",

  transition: "all .25s ease",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const row = {
  display: "flex",

  justifyContent: "space-between",

  gap: 14,

  alignItems: "center",

  padding: "14px 14px",

  borderRadius: 18,

  background:
    "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.025))",

  border:
    "1px solid rgba(255,255,255,.06)",

  color: "#e2e8f0",

  flexWrap: "wrap",
};

const rowInfo = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const emailText = {
  fontSize: 13,
  fontWeight: 800,
  color: "#fff",
};

const metaRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const typeChip = {
  padding: "5px 10px",

  borderRadius: 999,

  background:
    "rgba(59,130,246,.16)",

  border:
    "1px solid rgba(59,130,246,.22)",

  color: "#93c5fd",

  fontSize: 11,
  fontWeight: 800,
};

const timeChip = {
  padding: "5px 10px",

  borderRadius: 999,

  background:
    "rgba(255,255,255,.05)",

  border:
    "1px solid rgba(255,255,255,.07)",

  color: "rgba(255,255,255,.74)",

  fontSize: 11,
  fontWeight: 800,
};

const deleteBtn = {
  border: "none",

  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",

  color: "#fff",

  padding: "8px 12px",

  borderRadius: 12,

  cursor: "pointer",

  fontSize: 12,

  fontWeight: 900,

  boxShadow:
    "0 10px 22px rgba(239,68,68,.24)",
};

const emptyState = {
  padding: "16px 14px",

  borderRadius: 18,

  background: "rgba(255,255,255,.035)",

  border:
    "1px dashed rgba(255,255,255,.12)",

  color: "rgba(255,255,255,.55)",

  fontSize: 13,

  fontWeight: 700,
};

export default ScheduledReports;