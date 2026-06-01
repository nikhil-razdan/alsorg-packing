import { useState } from "react";

import {
  createVehicle,
} from "../../../api/logisticsApi";

import {
  getBackendMessage,
} from "../logisticsAlertUtils";

function CreateVehicleModal({
  open,
  onClose,
  onCreated,
  showAlert = () => {},
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
    if (saving) return;

    try {
      setSaving(true);

      if (!form.vehicleNumber) {
        throw new Error(
          "Vehicle number is required"
        );
      }

      if (!form.vehicleType) {
        throw new Error(
          "Vehicle type is required"
        );
      }

      await createVehicle(form);

      showAlert(
        "Vehicle created successfully",
        "success"
      );

      await onCreated?.();

      onClose();

      setForm({
        vehicleNumber: "",
        vehicleType: "",
        fuelCapacity: "",
        status: "ACTIVE",
      });

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Vehicle creation failed"
        ),
        "error"
      );

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
                Number(e.target.value)
              )
            }
          />
        </div>

        <div style={footer}>
          <button
            style={cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            style={{
              ...saveBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={submit}
            disabled={saving}
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

  cursor: "pointer",
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