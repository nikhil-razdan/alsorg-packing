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
  {
    key: "registrationDate",
    label: "Registration Date",
  },
  {
    key: "fitnessValidUpto",
    label: "Fitness Valid Upto",
  },
  {
    key: "insuranceValidUpto",
    label: "Insurance Valid Upto",
  },
  {
    key: "taxValidUpto",
    label: "Tax Valid Upto",
  },
  {
    key: "permitValidUpto",
    label: "Permit Valid Upto",
  },
  {
    key: "puccValidUpto",
    label: "PUCC Valid Upto",
  },
  {
    key: "nationalPermitValidUpto",
    label: "National Permit Valid Upto",
  },
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
  showAlert = () => { },
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

  const buildPayload = () => {
    return {
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
    };
  };

  const saveVehicle = async () => {
    if (!form.vehicleNumber?.trim()) {
      showAlert("Vehicle No. is required", "error");
      return;
    }

    if (!form.vehicleType?.trim()) {
      showAlert("Vehicle Type is required", "error");
      return;
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
      console.error(e);

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
      PaperProps={{
        sx: dialogPaperSx,
      }}
    >
      <DialogTitle sx={dialogTitleSx}>
        <Box>
          <Box sx={dialogMainTitleSx}>
            {title}
          </Box>

          <Box sx={dialogSubTitleSx}>
            {subtitle}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={dialogContentSx}>
        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>
            Vehicle Identity
          </Box>

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
          <Box sx={sectionTitleSx}>
            Technical Details
          </Box>

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
                <MenuItem
                  key={status}
                  value={status}
                >
                  {status}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>
            Document Validity
          </Box>

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
                InputLabelProps={{
                  shrink: true,
                }}
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

  if (digits.length <= 2) {
    return digits;
  }

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
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
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

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");

  let year = match[3];

  if (year.length === 2) {
    year = Number(year) > 50
      ? `19${year}`
      : `20${year}`;
  }

  return `${year}-${month}-${day}`;
}

const dialogPaperSx = {
  borderRadius: "26px",
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow:
    "0 26px 70px rgba(0,0,0,.45)",
};

const dialogTitleSx = {
  px: 3,
  pt: 3,
  pb: 1,
};

const dialogMainTitleSx = {
  fontSize: 24,
  fontWeight: 900,
};

const dialogSubTitleSx = {
  mt: 0.6,
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 600,
};

const dialogContentSx = {
  px: 3,
  py: 2,
};

const sectionCardSx = {
  p: 2,
  mb: 2,
  borderRadius: "20px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.08)",
};

const sectionTitleSx = {
  mb: 1.6,
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".1em",
};

const fieldGridSx = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 1.4,
};

const inputSx = {
  "& .MuiInputBase-root": {
    borderRadius: "14px",
    background: "rgba(15,23,42,.72)",
    color: "#fff",
  },

  "& .MuiInputLabel-root": {
    color: "#94a3b8",
    fontWeight: 700,
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: "#60a5fa",
  },

  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,.10)",
  },

  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(96,165,250,.35)",
  },

  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#60a5fa",
  },

  "& input": {
    color: "#fff",
  },
};

const dialogActionsSx = {
  px: 3,
  pb: 3,
  pt: 1,
};

const cancelButtonSx = {
  borderRadius: "14px",
  textTransform: "none",
  fontWeight: 800,
  color: "#fff",
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.08)",

  "&:hover": {
    background: "rgba(255,255,255,.10)",
  },
};

const saveButtonSx = {
  px: 2.4,
  borderRadius: "14px",
  textTransform: "none",
  fontWeight: 900,
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow:
    "0 12px 28px rgba(37,99,235,.32)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },

  "&.Mui-disabled": {
    color: "rgba(255,255,255,.5)",
    background: "rgba(148,163,184,.16)",
    boxShadow: "none",
  },
};

export default CreateVehicleModal;