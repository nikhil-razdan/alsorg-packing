import { useEffect, useState } from "react";
import API from "../../services/api";

function ScheduledReports({ darkMode = false }) {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [type, setType] = useState("packing");
  const [time, setTime] = useState("18:00");

  const load = async () => {
    const res = await API.get("/report-schedules");
    setRows(res.data);
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
    <div style={wrap(darkMode)}>
      <h3 style={title(darkMode)}>Scheduled Reports</h3>

      <div style={form}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input(darkMode)}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={input(darkMode)}
        >
          <option value="packing">Packing</option>
          <option value="dispatch">Dispatch</option>
          <option value="combined">Combined</option>
        </select>

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={input(darkMode)}
        />

        <button onClick={create} style={btn(darkMode)}>
          Add
        </button>
      </div>

      <div style={list}>
        {rows.map((r) => (
          <div key={r.id} style={row(darkMode)}>
            <span>{r.email}</span>
            <span>{r.reportType}</span>
            <span>{r.sendTime}</span>

            <button style={deleteBtn} onClick={() => remove(r.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const wrap = (darkMode) => ({
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  padding: 16,
  borderRadius: 18,
});

const title = (darkMode) => ({
  marginBottom: 10,
  fontSize: 16,
  fontWeight: 800,
  color: darkMode ? "#f8fafc" : "#0f172a",
});

const form = {
  display: "flex",
  gap: 8,
  marginBottom: 10,
  flexWrap: "wrap",
};

const input = (darkMode) => ({
  padding: "8px 10px",
  borderRadius: 10,
  border: darkMode
    ? "1px solid rgba(148,163,184,0.20)"
    : "1px solid rgba(148,163,184,0.24)",
  background: darkMode ? "rgba(15,23,42,0.9)" : "#fff",
  color: darkMode ? "#fff" : "#0f172a",
  outline: "none",
});

const btn = (darkMode) => ({
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: darkMode ? "#e2e8f0" : "#0f172a",
  color: darkMode ? "#0f172a" : "#fff",
  fontWeight: 800,
});

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const row = (darkMode) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  fontSize: 13,
  color: darkMode ? "#e2e8f0" : "#334155",
  padding: "10px 0",
  borderBottom: darkMode
    ? "1px solid rgba(148,163,184,0.14)"
    : "1px solid rgba(148,163,184,0.18)",
  flexWrap: "wrap",
});

const deleteBtn = {
  border: "none",
  background: "#ef4444",
  color: "#fff",
  padding: "4px 10px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

export default ScheduledReports;