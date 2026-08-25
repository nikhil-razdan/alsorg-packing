import { useState } from "react";

import {
  getBackendMessage,
} from "../logisticsAlertUtils";

import {
  createDriver,
} from "../../../api/logisticsApi";

function CreateDriverModal({
  open,
  onClose,
  onCreated,
  showAlert = () => {},
}) {
  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState({
      name: "",
      phoneNumber: "",
      licenseNumber: "",
      status: "AVAILABLE",
    });

  if (!open) return null;

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      phoneNumber: "",
      licenseNumber: "",
      status: "AVAILABLE",
    });
  };

  const submit = async () => {
    if (saving) return;

    try {
      setSaving(true);

      if (!form.name.trim()) {
        throw new Error(
          "Driver name is required"
        );
      }

      if (!form.phoneNumber.trim()) {
        throw new Error(
          "Phone number is required"
        );
      }

      if (!form.licenseNumber.trim()) {
        throw new Error(
          "License number is required"
        );
      }

      await createDriver(form);

      showAlert(
        "Driver created successfully",
        "success"
      );

      await onCreated?.();

      resetForm();

      onClose();

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Driver creation failed"
        ),
        "error"
      );

    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div
        style={modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-driver-title"
      >
        <div style={header}>
          <div>
            <div style={eyebrow}>
              DRIVER MASTER
            </div>

            <div
              id="create-driver-title"
              style={title}
            >
              Add Driver
            </div>

            <div style={subtitle}>
              Add the driver's operational identity and availability status.
            </div>
          </div>

          <button
            type="button"
            style={closeBtn}
            onClick={onClose}
            disabled={saving}
            aria-label="Close add driver dialog"
          >
            ×
          </button>
        </div>

        <div style={sectionCard}>
          <div style={sectionTitle}>
            Driver Details
          </div>

          <div style={grid}>
            <Field label="Driver Name" required>
              <input
                placeholder="Enter driver name"
                style={input}
                value={form.name}
                onChange={(e) =>
                  update(
                    "name",
                    e.target.value
                  )
                }
              />
            </Field>

            <Field label="Phone Number" required>
              <input
                placeholder="Enter phone number"
                style={input}
                value={form.phoneNumber}
                onChange={(e) =>
                  update(
                    "phoneNumber",
                    e.target.value
                  )
                }
              />
            </Field>

            <Field label="License Number" required>
              <input
                placeholder="Enter license number"
                style={input}
                value={form.licenseNumber}
                onChange={(e) =>
                  update(
                    "licenseNumber",
                    e.target.value
                  )
                }
              />
            </Field>

            <Field label="Driver Status">
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
                <option value="AVAILABLE">
                  AVAILABLE
                </option>

                <option value="ON_TRIP">
                  ON_TRIP
                </option>

                <option value="OFF">
                  OFF
                </option>
              </select>
            </Field>
          </div>
        </div>

        <div style={footer}>
          <button
            type="button"
            style={cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            style={{
              ...saveBtn,
              opacity: saving ? 0.65 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={submit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Create Driver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>
        {label}
        {required && (
          <span style={requiredMark}> *</span>
        )}
      </span>
      {children}
    </label>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "var(--pf-overlay)",
  backdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 18,
  zIndex: 9999,
};

const modal = {
  width: "min(560px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  boxSizing: "border-box",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  borderRadius: 18,
  padding: 22,
  border: "1px solid var(--pf-border)",
  boxShadow:
    "0 28px 70px rgba(var(--pf-shadow-rgb),.20)",
};

const header = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const eyebrow = {
  color: "#2563eb",
  fontSize: 9.5,
  fontWeight: 950,
  letterSpacing: ".11em",
};

const title = {
  color: "var(--pf-text-strong)",
  fontSize: 23,
  fontWeight: 950,
  letterSpacing: "-.015em",
  marginTop: 4,
};

const subtitle = {
  color: "var(--pf-text-muted)",
  fontSize: 12,
  lineHeight: 1.5,
  marginTop: 5,
  maxWidth: 420,
};

const closeBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-muted)",
  WebkitTextFillColor: "var(--pf-text-muted)",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
};

const sectionCard = {
  padding: 16,
  borderRadius: 14,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const sectionTitle = {
  marginBottom: 13,
  color: "var(--pf-text-strong)",
  fontSize: 12,
  fontWeight: 900,
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: 13,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const fieldLabel = {
  color: "var(--pf-text)",
  fontSize: 11.5,
  fontWeight: 800,
};

const requiredMark = {
  color: "#dc2626",
};

const input = {
  width: "100%",
  height: 43,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-input)",
  color: "var(--pf-text-strong)",
  WebkitTextFillColor: "var(--pf-text-strong)",
  padding: "0 12px",
  outline: "none",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 650,
  colorScheme: "var(--pf-color-scheme)",
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};

const cancelBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border)",
  color: "var(--pf-text)",
  WebkitTextFillColor: "var(--pf-text)",
  fontWeight: 850,
  cursor: "pointer",
};

const saveBtn = {
  appearance: "none",
  WebkitAppearance: "none",
  height: 40,
  padding: "0 17px",
  borderRadius: 10,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  WebkitTextFillColor: "#fff",
  fontWeight: 900,
  boxShadow:
    "0 8px 18px rgba(37,99,235,.22)",
};

export default CreateDriverModal;
