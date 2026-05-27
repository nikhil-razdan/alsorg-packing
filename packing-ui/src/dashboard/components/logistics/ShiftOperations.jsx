import {
  useEffect,
  useState,
} from "react";

import LogisticsShiftModal from "./LogisticsShiftModal";

import {
  fetchShifts,
  deleteShift,
} from "../../api/logisticsApi";

function ShiftOperations() {
	
	const remove = async (id) => {
	  try {
	    await deleteShift(id);

	    load();

	  } catch (e) {
	    console.error(e);

	    alert(e.message);
	  }
	};
	
  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [shifts, setShifts] =
    useState([]);

  const load = async () => {
    try {
      setLoading(true);

      const data =
        await fetchShifts();

      setShifts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Shift Operations
          </div>

          <div style={subtitle}>
            Real-time logistics shifts
          </div>
        </div>

        <button
          style={button}
          onClick={() => setOpen(true)}
        >
          + Create Shift
        </button>
      </div>

      <div style={table}>
        <div style={head}>
          <div>Driver</div>
          <div>Vehicle</div>
          <div>Trips</div>
          <div>Route</div>
          <div>Status</div>
        </div>

        {!loading &&
          shifts.map((s) => (
            <div
              key={s.id}
              style={row}
            >
              <div>
                {s.driver?.name}
              </div>

              <div>
                {
                  s.vehicle
                    ?.vehicleNumber
                }
              </div>

              <div>
                {s.totalTrips}
              </div>

              <div>
                {
                  s.routeCategory
                }
              </div>

			  <div
			    style={{
			      display: "flex",
			      gap: 10,
			      alignItems: "center",
			    }}
			  >
			    <span
			      style={status(
			        s.status
			      )}
			    >
			      {s.status}
			    </span>

			    <button
			      onClick={() =>
			        remove(s.id)
			      }
			      style={deleteBtn}
			    >
			      Delete
			    </button>
			  </div>
            </div>
          ))}
      </div>

      <LogisticsShiftModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
        onCreated={load}
      />
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
};

const header = {
  display: "flex",
  justifyContent:
    "space-between",
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
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const table = {
  overflow: "hidden",
  borderRadius: 18,
};

const head = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr .7fr 1fr .8fr",

  padding: 16,

  background: "#111827",

  color: "#94a3b8",

  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr .7fr 1fr .8fr",

  padding: 16,

  color: "#fff",

  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

const deleteBtn = {
  border: "none",

  background: "#ef4444",

  color: "#fff",

  borderRadius: 8,

  padding: "6px 10px",

  cursor: "pointer",

  fontWeight: 700,
};

const status = (value) => ({
  padding: "6px 10px",

  borderRadius: 999,

  fontSize: 12,

  background:
    value === "WORKING"
      ? "rgba(34,197,94,0.15)"
      : "rgba(239,68,68,0.15)",

  color:
    value === "WORKING"
      ? "#4ade80"
      : "#f87171",
});

export default ShiftOperations;