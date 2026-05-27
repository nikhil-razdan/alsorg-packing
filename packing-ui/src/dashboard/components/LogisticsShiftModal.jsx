import {
  useEffect,
  useState,
} from "react";

import {
  fetchDrivers,
  fetchVehicles,
  createShift,
} from "../api/logisticsApi";


function LogisticsShiftModal({
  open,
  onClose,
  onCreated,
}) {
  const [drivers, setDrivers] =
    useState([]);

  const [vehicles, setVehicles] =
    useState([]);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] = useState({
    driverId: "",
    vehicleId: "",
    shiftStart: "",
    shiftEnd: "",
    overtimeHours: 0,
    totalTrips: 0,
    totalLoaders: 0,
    fuelUsed: 0,
    totalDistance: 0,
    routeCategory: "Factory",
    remarks: "",
    status: "WORKING",
  });

  useEffect(() => {
    if (!open) return;

    fetchDrivers().then(setDrivers);

    fetchVehicles().then(setVehicles);
  }, [open]);

  if (!open) return null;

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const submit = async () => {
    try {
      setSaving(true);

	  const payload = {
	    ...form,

	    shiftStart:
	      form.shiftStart + ":00",

	    shiftEnd:
	      form.shiftEnd + ":00",
	  };

	  await createShift(payload);

      alert(
        "Shift created successfully"
      );

      onCreated?.();

      onClose();

    } catch (e) {
	    console.error(e);

	    const message =
	      e?.message ||
	      "Unknown error";

	    alert(
	      `Failed to create shift: ${message}`
	    );
	  } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <div>
            <div style={title}>
              Logistics Shift Entry
            </div>

            <div style={subtitle}>
              Driver and vehicle
              operations management
            </div>
          </div>

          <button
            onClick={onClose}
            style={closeBtn}
          >
            ✕
          </button>
        </div>

        <div style={grid}>
          <Field label="Driver">
            <select
              value={form.driverId}
              onChange={(e) =>
                update(
                  "driverId",
                  e.target.value
                )
              }
              style={input}
            >
              <option value="">
                Select Driver
              </option>

              {drivers.map((d) => (
                <option
                  key={d.id}
                  value={d.id}
                >
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vehicle">
            <select
              value={form.vehicleId}
              onChange={(e) =>
                update(
                  "vehicleId",
                  e.target.value
                )
              }
              style={input}
            >
              <option value="">
                Select Vehicle
              </option>

              {vehicles.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                >
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Shift Start">
            <input
              type="datetime-local"
              style={input}
              value={form.shiftStart}
              onChange={(e) =>
                update(
                  "shiftStart",
                  e.target.value
                )
              }
            />
          </Field>

          <Field label="Shift End">
            <input
              type="datetime-local"
              style={input}
              value={form.shiftEnd}
              onChange={(e) =>
                update(
                  "shiftEnd",
                  e.target.value
                )
              }
            />
          </Field>

          <Field label="Trips">
            <input
              type="number"
              style={input}
              value={form.totalTrips}
              onChange={(e) =>
                update(
                  "totalTrips",
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </Field>

          <Field label="Loaders">
            <input
              type="number"
              style={input}
              value={form.totalLoaders}
              onChange={(e) =>
                update(
                  "totalLoaders",
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </Field>

          <Field label="Fuel Used">
            <input
              type="number"
              style={input}
              value={form.fuelUsed}
              onChange={(e) =>
                update(
                  "fuelUsed",
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </Field>

          <Field label="Distance">
            <input
              type="number"
              style={input}
              value={form.totalDistance}
              onChange={(e) =>
                update(
                  "totalDistance",
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </Field>

          <Field label="Overtime">
            <input
              type="number"
              style={input}
              value={form.overtimeHours}
              onChange={(e) =>
                update(
                  "overtimeHours",
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </Field>

          <Field label="Route">
            <select
              style={input}
              value={
                form.routeCategory
              }
              onChange={(e) =>
                update(
                  "routeCategory",
                  e.target.value
                )
              }
            >
              <option>
                Factory
              </option>

              <option>
                Residential
              </option>

              <option>
                Mall
              </option>

              <option>
                Warehouse
              </option>
            </select>
          </Field>

          <Field label="Status">
            <select
              style={input}
              value={form.status}
              onChange={(e) =>
                update(
                  "status",
                  e.target.value
                )
              }
            >
              <option>
                WORKING
              </option>

              <option>
                OFF
              </option>

              <option>
                ON_LEAVE
              </option>
            </select>
          </Field>

          <Field label="Remarks">
            <textarea
              rows={3}
              style={textarea}
              value={form.remarks}
              onChange={(e) =>
                update(
                  "remarks",
                  e.target.value
                )
              }
            />
          </Field>
        </div>

        <div style={footer}>
          <button
            style={cancelBtn}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            style={saveBtn}
            onClick={submit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Create Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div style={field}>
      <div style={label}>
        {label}
      </div>

      {children}
    </div>
  );
}

/*
========================================
STYLES
========================================
*/

const overlay = {
  position: "fixed",
  inset: 0,
  background:
    "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modal = {
  width: "95%",
  maxWidth: 1100,
  borderRadius: 24,
  padding: 24,
  background:
    "linear-gradient(180deg,#020617,#0f172a)",
  border:
    "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "0 20px 60px rgba(0,0,0,0.45)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 22,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 900,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  cursor: "pointer",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0,1fr))",
  gap: 18,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const label = {
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 700,
};

const input = {
  height: 46,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 14px",
  outline: "none",
};

const textarea = {
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: 14,
  outline: "none",
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
};

const cancelBtn = {
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#1e293b",
  color: "#fff",
  cursor: "pointer",
};

const saveBtn = {
  height: 44,
  padding: "0 22px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

export default LogisticsShiftModal;