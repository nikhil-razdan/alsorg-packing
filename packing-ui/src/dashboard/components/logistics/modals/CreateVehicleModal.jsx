import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  MenuItem,
} from "@mui/material";

import {
  createVehicle,
  updateVehicle,
} from "../../../api/logisticsApi";

import {
  getBackendMessage,
} from "../logisticsAlertUtils";

import {
  parseVehicleDate,
} from "../vehicleComplianceUtils";

const emptyVehicleForm = {
  vehicleNumber: "",
  vehicleType: "",
  driverName: "",
  ownerName: "",
  registeringAuthority: "",
  vehicleClass: "",
  fuelType: "",
  fuelCapacity: "",
  emissionNorm: "",
  vehicleAge: "",
  status: "Active",
  registrationDate: "",
  fitnessValidUpto: "",
  insuranceValidUpto: "",
  taxValidUpto: "",
  permitValidUpto: "",
  puccValidUpto: "",
  nationalPermitValidUpto: "",
};

const basicFields = [
  {
    key: "vehicleNumber",
    label: "Vehicle No.",
    required: true,
    placeholder: "HR55AY3512",
  },
  {
    key: "vehicleType",
    label: "Vehicle Type",
    required: true,
    placeholder: "Canter / Pickup / Eeco",
  },
  {
    key: "driverName",
    label: "Driver Name",
    placeholder: "Assigned driver name",
  },
  {
    key: "ownerName",
    label: "Owner Name",
    placeholder: "Vehicle owner/company name",
  },
  {
    key: "registeringAuthority",
    label: "Registering Authority",
    placeholder: "RTA Gurgaon / SDM Gurugram",
  },
  {
    key: "vehicleClass",
    label: "Vehicle Class",
    placeholder: "Goods Carrier (LGV) / Motor Car (LMV)",
  },
];

const technicalFields = [
  {
    key: "fuelType",
    label: "Fuel Type",
    placeholder: "CNG / Diesel / Petrol / Electric",
  },
  {
    key: "fuelCapacity",
    label: "Fuel Capacity",
    placeholder: "Optional fuel capacity",
  },
  {
    key: "emissionNorm",
    label: "Emission Norm",
    placeholder: "Bharat Stage VI",
  },
  {
    key: "vehicleAge",
    label: "Vehicle Age",
    placeholder: "4 years 2 months",
  },
];

const validityFields = [
  { key: "registrationDate", label: "Registration Date" },
  { key: "fitnessValidUpto", label: "Fitness Valid Upto" },
  { key: "insuranceValidUpto", label: "Insurance Valid Upto" },
  { key: "taxValidUpto", label: "Tax Valid Upto" },
  { key: "permitValidUpto", label: "Permit Valid Upto" },
  { key: "puccValidUpto", label: "PUCC Valid Upto" },
  { key: "nationalPermitValidUpto", label: "National Permit Valid Upto" },
];

const statusOptions = [
  "Active",
  "Fitness expired",
  "Insurance expired",
  "Under Maintenance",
  "Inactive",
];

function CreateVehicleModal({
  open,
  onClose,
  onCreated,
  showAlert = () => {},
  initialData = null,
}) {
  const isEdit = Boolean(initialData?.id);

  const [form, setForm] =
    useState(emptyVehicleForm);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    setForm({
      ...emptyVehicleForm,
      ...(initialData || {}),
      registrationDate: toDisplayDate(initialData?.registrationDate),
      fitnessValidUpto: toDisplayDate(initialData?.fitnessValidUpto),
      insuranceValidUpto: toDisplayDate(initialData?.insuranceValidUpto),
      taxValidUpto: toDisplayDate(initialData?.taxValidUpto),
      permitValidUpto: toDisplayDate(initialData?.permitValidUpto),
      puccValidUpto: toDisplayDate(initialData?.puccValidUpto),
      nationalPermitValidUpto: toDisplayDate(initialData?.nationalPermitValidUpto),
    });
  }, [open, initialData]);

  const title = useMemo(() => {
    return isEdit
      ? "Edit Vehicle Details"
      : "Add Vehicle Details";
  }, [isEdit]);

  const subtitle = useMemo(() => {
    return isEdit
      ? "Update fleet, document validity and operational information"
      : "Add complete fleet, document validity and operational information";
  }, [isEdit]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const buildPayload = () => ({
    ...form,
    vehicleNumber: form.vehicleNumber?.trim(),
    vehicleType: form.vehicleType?.trim(),
    driverName: form.driverName?.trim(),
    ownerName: form.ownerName?.trim(),
    registeringAuthority: form.registeringAuthority?.trim(),
    vehicleClass: form.vehicleClass?.trim(),
    fuelType: form.fuelType?.trim(),
    fuelCapacity: form.fuelCapacity?.trim(),
    emissionNorm: form.emissionNorm?.trim(),
    vehicleAge: form.vehicleAge?.trim(),
    status: form.status || "Active",
    registrationDate: toBackendDate(form.registrationDate),
    fitnessValidUpto: toBackendDate(form.fitnessValidUpto),
    insuranceValidUpto: toBackendDate(form.insuranceValidUpto),
    taxValidUpto: toBackendDate(form.taxValidUpto),
    permitValidUpto: toBackendDate(form.permitValidUpto),
    puccValidUpto: toBackendDate(form.puccValidUpto),
    nationalPermitValidUpto: toBackendDate(form.nationalPermitValidUpto),
  });

  const saveVehicle = async () => {
    if (!form.vehicleNumber?.trim()) {
      showAlert("Vehicle No. is required", "error");
      return;
    }

    if (!form.vehicleType?.trim()) {
      showAlert("Vehicle Type is required", "error");
      return;
    }

    for (const field of validityFields) {
      const value =
        String(form[field.key] || "").trim();

      if (value && !parseVehicleDate(value)) {
        showAlert(
          `${field.label} is not a valid calendar date. Use dd/mm/yy.`,
          "error"
        );
        return;
      }
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (isEdit) {
        await updateVehicle(initialData.id, payload);
      } else {
        await createVehicle(payload);
      }

      showAlert(
        isEdit
          ? "Vehicle updated successfully"
          : "Vehicle added successfully",
        "success"
      );

      await onCreated?.();
      onClose?.();
    } catch (e) {
      showAlert(
        getBackendMessage(
          e,
          isEdit
            ? "Vehicle update failed"
            : "Vehicle create failed"
        ),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={dialogTitleSx}>
        <Box>
          <Box sx={dialogMainTitleSx}>{title}</Box>
          <Box sx={dialogSubTitleSx}>{subtitle}</Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={dialogContentSx}>
        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>Vehicle Identity</Box>
          <Box sx={fieldGridSx}>
            {basicFields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                required={field.required}
                value={form[field.key] || ""}
                onChange={(e) =>
                  updateField(field.key, e.target.value)
                }
                sx={inputSx}
              />
            ))}
          </Box>
        </Box>

        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>Technical Details</Box>
          <Box sx={fieldGridSx}>
            {technicalFields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                value={form[field.key] || ""}
                onChange={(e) =>
                  updateField(field.key, e.target.value)
                }
                sx={inputSx}
              />
            ))}

            <TextField
              select
              label="Vehicle Status"
              value={form.status || "Active"}
              onChange={(e) =>
                updateField("status", e.target.value)
              }
              sx={inputSx}
            >
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>Document Validity</Box>
          <Box sx={fieldGridSx}>
            {validityFields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                placeholder="dd/mm/yy"
                value={form[field.key] || ""}
                onChange={(e) =>
                  updateField(
                    field.key,
                    formatDateTyping(e.target.value)
                  )
                }
                sx={inputSx}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  inputMode: "numeric",
                  maxLength: 8,
                }}
                helperText="Format: dd/mm/yy"
              />
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={dialogActionsSx}>
        <Button
          disabled={saving}
          onClick={onClose}
          sx={cancelButtonSx}
        >
          Cancel
        </Button>

        <Button
          disabled={saving}
          onClick={saveVehicle}
          sx={saveButtonSx}
        >
          {saving
            ? "Saving..."
            : isEdit
              ? "Update Vehicle"
              : "Add Vehicle"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatDateTyping(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toDisplayDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3].slice(-2);
    return `${day}/${month}/${year}`;
  }

  const dashMonthMatch = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);

  if (dashMonthMatch) {
    const day = dashMonthMatch[1].padStart(2, "0");
    const monthMap = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const month = monthMap[dashMonthMatch[2].slice(0, 3)];
    if (!month) return "";
    const year = dashMonthMatch[3].slice(-2);
    return `${day}/${month}/${year}`;
  }

  return "";
}

function toBackendDate(value) {
  if (!value) return null;

  const date = parseVehicleDate(value);
  if (!date) return null;

  const pad = (part) =>
    String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

const dialogPaperSx = {
  borderRadius: "18px",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  border: "1px solid var(--pf-border)",
  boxShadow: "0 28px 70px rgba(var(--pf-shadow-rgb),.20)",
  overflow: "hidden",
};

const dialogTitleSx = {
  px: { xs: 2, sm: 2.5 },
  pt: { xs: 2, sm: 2.5 },
  pb: 1,
  borderBottom: "1px solid var(--pf-border-soft)",
  background:
    "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface))",
};

const dialogMainTitleSx = {
  color: "var(--pf-text-strong)",
  fontSize: { xs: 20, sm: 23 },
  fontWeight: 950,
  letterSpacing: "-.015em",
};

const dialogSubTitleSx = {
  mt: 0.55,
  color: "var(--pf-text-muted)",
  fontSize: 12.5,
  lineHeight: 1.5,
  fontWeight: 650,
};

const dialogContentSx = {
  px: { xs: 2, sm: 2.5 },
  py: 2,
  background: "var(--pf-surface)",
  colorScheme: "var(--pf-color-scheme)",
};

const sectionCardSx = {
  p: { xs: 1.5, sm: 1.8 },
  mb: 1.5,
  borderRadius: "14px",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",
};

const sectionTitleSx = {
  mb: 1.4,
  color: "#2563eb",
  fontSize: 10.5,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".09em",
};

const fieldGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
  },
  gap: 1.25,
};

const inputSx = {
  "& .MuiInputBase-root": {
    borderRadius: "11px",
    background: "var(--pf-input)",
    color: "var(--pf-text-strong)",
    colorScheme: "var(--pf-color-scheme)",
  },
  "& .MuiInputBase-input": {
    color: "var(--pf-text-strong)",
    WebkitTextFillColor: "var(--pf-text-strong)",
    fontSize: 13,
    fontWeight: 650,
  },
  "& .MuiInputBase-input::placeholder": {
    color: "var(--pf-text-dim)",
    opacity: 1,
  },
  "& .MuiInputLabel-root": {
    color: "var(--pf-text-muted)",
    fontWeight: 750,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#2563eb",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--pf-border)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(37,99,235,.38)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#2563eb",
    borderWidth: "1.5px",
  },
  "& .MuiSelect-select": {
    color: "var(--pf-text-strong)",
    WebkitTextFillColor: "var(--pf-text-strong)",
  },
  "& .MuiSelect-icon": {
    color: "var(--pf-text-muted)",
  },
  "& .MuiFormHelperText-root": {
    color: "var(--pf-text-dim)",
    marginLeft: 0.5,
    fontSize: 10,
  },
};

const dialogActionsSx = {
  px: { xs: 2, sm: 2.5 },
  pb: { xs: 2, sm: 2.5 },
  pt: 1.2,
  gap: 0.75,
  borderTop: "1px solid var(--pf-border-soft)",
  background: "var(--pf-surface)",
};

const cancelButtonSx = {
  minHeight: 39,
  px: 2,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 850,
  color: "var(--pf-text)",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border)",
  "&:hover": {
    color: "var(--pf-text-strong)",
    background: "var(--pf-surface-hover)",
    borderColor: "rgba(37,99,235,.24)",
  },
};

const saveButtonSx = {
  minHeight: 39,
  px: 2.2,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 900,
  color: "#fff",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow: "0 8px 20px rgba(37,99,235,.24)",
  "&:hover": {
    background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    boxShadow: "0 10px 24px rgba(37,99,235,.30)",
  },
  "&.Mui-disabled": {
    color: "var(--pf-text-dim)",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
    boxShadow: "none",
  },
};

export default CreateVehicleModal;
