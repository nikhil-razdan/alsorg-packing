import { useState } from "react";

import {
  createVehicle,
} from "../../../api/logisticsApi";

function CreateVehicleModal({
  open,
  onClose,
  onCreated,
}) {
  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState({
      vehicleNumber: "",
      vehicleType: "",
      fuelCapacity: "",
      status: "ACTIVE",
    });

  if (!open) return null;

  const update = (
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const submit = async () => {
    try {
      setSaving(true);

      await createVehicle(form);

      alert(
        "Vehicle created successfully"
      );

      onCreated?.();

      onClose();

    } catch (e) {
      console.error(e);

      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={title}>
          Add Vehicle
        </div>

        <div style={grid}>
          <input
            placeholder="Vehicle Number"
            style={input}
            value={form.vehicleNumber}
            onChange={(e) =>
              update(
                "vehicleNumber",
                e.target.value
              )
            }
          />

          <input
            placeholder="Vehicle Type"
            style={input}
            value={form.vehicleType}
            onChange={(e) =>
              update(
                "vehicleType",
                e.target.value
              )
            }
          />

          <input
            type="number"
            placeholder="Fuel Capacity"
            style={input}
            value={form.fuelCapacity}
            onChange={(e) =>
              update(
                "fuelCapacity",
                Number(
                  e.target.value
                )
              )
            }
          />
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
          >
            {saving
              ? "Saving..."
              : "Create Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background:
    "rgba(0,0,0,.6)",

  display: "flex",

  justifyContent: "center",

  alignItems: "center",

  zIndex: 9999,
};

const modal = {
  width: 500,

  background:
    "linear-gradient(180deg,#020617,#0f172a)",

  borderRadius: 24,

  padding: 24,

  border:
    "1px solid rgba(255,255,255,.08)",
};

const title = {
  color: "#fff",

  fontSize: 24,

  fontWeight: 800,

  marginBottom: 20,
};

const grid = {
  display: "grid",

  gap: 16,
};

const input = {
  height: 48,

  borderRadius: 14,

  border:
    "1px solid rgba(255,255,255,.08)",

  background: "#111827",

  color: "#fff",

  padding: "0 14px",
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

  background: "#1e293b",

  border: "none",

  color: "#fff",
};

const saveBtn = {
  height: 44,

  padding: "0 20px",

  borderRadius: 12,

  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 700,
};

export default CreateVehicleModal;