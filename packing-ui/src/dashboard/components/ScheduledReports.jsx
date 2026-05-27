import { useEffect, useState } from "react";
import API from "../../services/api";

function ScheduledReports() {
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
    <div style={wrap}>
      <h3 style={title}>Scheduled Reports</h3>

      <div style={form}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={input}
        >
          <option value="packing">Packing</option>
          <option value="dispatch">Dispatch</option>
          <option value="combined">Combined</option>
        </select>

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={input}
        />

        <button onClick={create} style={btn}>
          Add
        </button>
      </div>

      <div style={list}>
        {rows.map((r) => (
          <div key={r.id} style={row}>
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

const wrap = {
  background:
    "rgba(15,23,42,.72)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 18px 35px rgba(2,6,23,.32)",

  padding: 18,

  borderRadius: 22,

  backdropFilter: "blur(18px)",
};

const title = {
  marginBottom: 14,
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const form = {
  display: "flex",
  gap: 8,
  marginBottom: 10,
  flexWrap: "wrap",
};

const input = {
  padding: "10px 12px",

  borderRadius: 12,

  border:
    "1px solid rgba(255,255,255,.08)",

  background:
    "rgba(255,255,255,.04)",

  color: "#fff",

  outline: "none",
};

const btn = {
  padding: "10px 14px",

  borderRadius: 12,

  border: "none",

  cursor: "pointer",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 800,
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const row = {
  display: "flex",

  justifyContent: "space-between",

  gap: 12,

  alignItems: "center",

  fontSize: 13,

  color: "#e2e8f0",

  padding: "10px 0",

  borderBottom:
    "1px solid rgba(255,255,255,.08)",

  flexWrap: "wrap",
};

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