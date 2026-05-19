import { useEffect, useState } from "react";
import API from "../../services/api";

function ScheduledReports() {

  const [rows,setRows] = useState([]);
  const [email,setEmail] = useState("");
  const [type,setType] = useState("packing");
  const [time,setTime] = useState("18:00");

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

    await API.post("/report-schedules",{
      email,
      reportType:type,
      sendTime:time
    });

    setEmail("");
    load();
  };

  const remove = async(id)=>{
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
          onChange={e=>setEmail(e.target.value)}
          style={input}
        />

        <select value={type} onChange={e=>setType(e.target.value)} style={input}>
          <option value="packing">Packing</option>
          <option value="dispatch">Dispatch</option>
          <option value="combined">Combined</option>
        </select>

        <input
          type="time"
          value={time}
          onChange={e=>setTime(e.target.value)}
          style={input}
        />

        <button onClick={create} style={btn}>Add</button>

      </div>

      {rows.map(r=>(
        <div key={r.id} style={row}>

          <span>{r.email}</span>
          <span>{r.reportType}</span>
          <span>{r.sendTime}</span>

          <button
            style={deleteBtn}
            onClick={()=>remove(r.id)}
          >
            Delete
          </button>

        </div>
      ))}

    </div>
  );
}

const wrap = {
  marginTop:20,
  background:"rgba(255,255,255,0.15)",
  padding:16,
  borderRadius:14
};

const title = {
  marginBottom:10,
  fontSize:16,
  fontWeight:700,
  color:"#fff"
};

const form = {
  display:"flex",
  gap:8,
  marginBottom:10
};

const input = {
  padding:6,
  borderRadius:6,
  border:"none"
};

const btn = {
  padding:"6px 12px",
  borderRadius:6,
  border:"none",
  cursor:"pointer"
};

const row = {
  display:"flex",
  justifyContent:"space-between",
  marginTop:6,
  fontSize:13,
  color:"#fff"
};

const deleteBtn = {
  border:"none",
  background:"#ff4444",
  color:"#fff",
  padding:"2px 6px",
  borderRadius:6,
  cursor:"pointer"
};

export default ScheduledReports;