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
  IconButton,
} from "@mui/material";

import {
  fetchVehicleExpenses,
  createVehicleExpense,
} from "../../../api/logisticsApi";

import {
  getBackendMessage,
} from "../logisticsAlertUtils";

const emptyField = {
  fieldName: "",
  fieldType: "NUMBER",
  fieldValue: "",
};

function VehicleExpenseModal({
  open,
  onClose,
  vehicle,
  showAlert = () => {},
}) {
  const [expenseMonth, setExpenseMonth] =
    useState(getCurrentMonth());

  const [notes, setNotes] =
    useState("");

  const [fields, setFields] =
    useState([
      {
        fieldName: "Fuel",
        fieldType: "NUMBER",
        fieldValue: "",
      },
      {
        fieldName: "Maintenance",
        fieldType: "NUMBER",
        fieldValue: "",
      },
    ]);

  const [history, setHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const totalAmount = useMemo(() => {
    return fields.reduce((sum, field) => {
      if (field.fieldType !== "NUMBER") {
        return sum;
      }

      const value =
        Number(field.fieldValue || 0);

      return Number.isFinite(value)
        ? sum + value
        : sum;
    }, 0);
  }, [fields]);

  const loadExpenses = async () => {
    if (!vehicle?.id) return;

    try {
      setLoading(true);

      const data =
        await fetchVehicleExpenses(vehicle.id);

      setHistory(
        Array.isArray(data) ? data : []
      );
    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Failed to load vehicle expenses"
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    setExpenseMonth(getCurrentMonth());
    setNotes("");
    setFields([
      {
        fieldName: "Fuel",
        fieldType: "NUMBER",
        fieldValue: "",
      },
      {
        fieldName: "Maintenance",
        fieldType: "NUMBER",
        fieldValue: "",
      },
    ]);

    loadExpenses();
  }, [open, vehicle?.id]);

  const updateField = (
    index,
    key,
    value
  ) => {
    setFields((prev) =>
      prev.map((field, i) =>
        i === index
          ? {
              ...field,
              [key]: value,
            }
          : field
      )
    );
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        ...emptyField,
      },
    ]);
  };

  const removeField = (index) => {
    setFields((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  const saveExpense = async () => {
    if (!vehicle?.id) {
      showAlert(
        "Vehicle id missing",
        "error"
      );

      return;
    }

    const validFields =
      fields.filter((field) =>
        field.fieldName?.trim()
      );

    if (validFields.length === 0) {
      showAlert(
        "Add at least one expense field",
        "error"
      );

      return;
    }

    try {
      setSaving(true);

      await createVehicleExpense(
        vehicle.id,
        {
          expenseMonth: `${expenseMonth}-01`,
          notes,
          fields: validFields,
        }
      );

      showAlert(
        "Vehicle expense added successfully",
        "success"
      );

      setNotes("");
      setFields([
        {
          fieldName: "Fuel",
          fieldType: "NUMBER",
          fieldValue: "",
        },
        {
          fieldName: "Maintenance",
          fieldType: "NUMBER",
          fieldValue: "",
        },
      ]);

      await loadExpenses();
    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Vehicle expense save failed"
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
            Vehicle Expense
          </Box>

          <Box sx={dialogSubTitleSx}>
            {vehicle?.vehicleNumber || "-"} • Add monthly custom expense fields
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={dialogContentSx}>
        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>
            Add Monthly Expense
          </Box>

          <Box sx={topGridSx}>
            <TextField
              label="Expense Month"
              type="month"
              value={expenseMonth}
              onChange={(e) =>
                setExpenseMonth(e.target.value)
              }
              sx={inputSx}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <Box sx={totalCardSx}>
              <span>Total Numeric Expense</span>
              <b>₹ {formatAmount(totalAmount)}</b>
            </Box>
          </Box>

          <Box sx={expenseFieldWrapSx}>
            {fields.map((field, index) => (
              <Box
                key={index}
                sx={expenseFieldRowSx}
              >
                <TextField
                  label="Field Name"
                  placeholder="Fuel / Toll / Repair"
                  value={field.fieldName}
                  onChange={(e) =>
                    updateField(
                      index,
                      "fieldName",
                      e.target.value
                    )
                  }
                  sx={inputSx}
                />

                <TextField
                  select
                  label="Type"
                  value={field.fieldType}
                  onChange={(e) =>
                    updateField(
                      index,
                      "fieldType",
                      e.target.value
                    )
                  }
                  sx={inputSx}
                >
                  <MenuItem value="NUMBER">
                    Number
                  </MenuItem>

                  <MenuItem value="TEXT">
                    Text
                  </MenuItem>
                </TextField>

                <TextField
                  label="Value"
                  placeholder={
                    field.fieldType === "NUMBER"
                      ? "Enter amount"
                      : "Enter text"
                  }
                  type={
                    field.fieldType === "NUMBER"
                      ? "number"
                      : "text"
                  }
                  value={field.fieldValue}
                  onChange={(e) =>
                    updateField(
                      index,
                      "fieldValue",
                      e.target.value
                    )
                  }
                  sx={inputSx}
                />

                <IconButton
                  onClick={() =>
                    removeField(index)
                  }
                  sx={removeButtonSx}
                >
                  ×
                </IconButton>
              </Box>
            ))}
          </Box>

          <Button
            onClick={addField}
            sx={addFieldButtonSx}
          >
            + Add More Field
          </Button>

          <TextField
            label="Notes"
            placeholder="Optional monthly notes"
            multiline
            minRows={2}
            fullWidth
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            sx={{
              ...inputSx,
              mt: 2,
            }}
          />
        </Box>

        <Box sx={sectionCardSx}>
          <Box sx={sectionTitleSx}>
            Previous Expense History
          </Box>

          {loading && (
            <Box sx={emptyStateSx}>
              Loading expense history...
            </Box>
          )}

          {!loading && history.length === 0 && (
            <Box sx={emptyStateSx}>
              No previous expense entries found.
            </Box>
          )}

          {!loading &&
            history.map((item) => (
              <Box
                key={item.id}
                sx={historyCardSx}
              >
                <Box sx={historyHeaderSx}>
                  <Box>
                    <Box sx={historyMonthSx}>
                      {formatMonth(item.expenseMonth)}
                    </Box>

                    <Box sx={historyCreatedSx}>
                      Added: {formatDateTime(item.createdAt)}
                    </Box>
                  </Box>

                  <Box sx={historyTotalSx}>
                    ₹ {formatAmount(item.totalAmount)}
                  </Box>
                </Box>

                <Box sx={historyFieldsSx}>
                  {(item.fields || []).map((field, index) => (
                    <Box
                      key={`${item.id}-${index}`}
                      sx={historyFieldChipSx}
                    >
                      <span>{field.fieldName}</span>
                      <b>{field.fieldValue || "-"}</b>
                    </Box>
                  ))}
                </Box>

                {item.notes && (
                  <Box sx={historyNotesSx}>
                    Notes: {item.notes}
                  </Box>
                )}
              </Box>
            ))}
        </Box>
      </DialogContent>

      <DialogActions sx={dialogActionsSx}>
        <Button
          disabled={saving}
          onClick={onClose}
          sx={cancelButtonSx}
        >
          Close
        </Button>

        <Button
          disabled={saving}
          onClick={saveExpense}
          sx={saveButtonSx}
        >
          {saving
            ? "Saving..."
            : "Save Expense"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatAmount(value) {
  const number =
    Number(value || 0);

  return number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatMonth(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        month: "long",
        year: "numeric",
      }
    );
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return value;
  }
}

const dialogPaperSx = {
  borderRadius: "18px",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  border: "1px solid var(--pf-border)",
  boxShadow:
    "0 28px 70px rgba(var(--pf-shadow-rgb),.20)",
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

const topGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "1fr 1fr",
  },
  gap: 1.25,
  mb: 1.5,
};

const expenseFieldWrapSx = {
  display: "flex",
  flexDirection: "column",
  gap: 1.1,
};

const expenseFieldRowSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "1.3fr .75fr 1fr 42px",
  },
  gap: 1,
  alignItems: "center",
};

const totalCardSx = {
  minHeight: 54,
  px: 1.5,
  borderRadius: "11px",
  background:
    "linear-gradient(135deg,rgba(34,197,94,.11),var(--pf-surface-raised))",
  border: "1px solid rgba(22,163,74,.22)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",

  "& span": {
    color: "var(--pf-text-muted)",
    fontSize: 11,
    fontWeight: 800,
  },

  "& b": {
    color: "#15803d",
    fontSize: 18,
    fontWeight: 950,
    marginTop: 2,
  },
};

const inputSx = {
  "& .MuiInputBase-root": {
    borderRadius: "11px",
    background: "var(--pf-input)",
    color: "var(--pf-text-strong)",
    colorScheme: "var(--pf-color-scheme)",
  },

  "& .MuiInputBase-input, & textarea": {
    color: "var(--pf-text-strong)",
    WebkitTextFillColor: "var(--pf-text-strong)",
    fontSize: 13,
    fontWeight: 650,
  },

  "& .MuiInputBase-input::placeholder, & textarea::placeholder": {
    color: "var(--pf-text-dim)",
    WebkitTextFillColor: "var(--pf-text-dim)",
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
};

const removeButtonSx = {
  width: 38,
  height: 38,
  justifySelf: { xs: "end", sm: "stretch" },
  color: "#b91c1c",
  background: "rgba(239,68,68,.10)",
  border: "1px solid rgba(220,38,38,.24)",

  "&:hover": {
    color: "#991b1b",
    background: "rgba(239,68,68,.16)",
  },
};

const addFieldButtonSx = {
  mt: 1.3,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 900,
  color: "#1d4ed8",
  background: "rgba(37,99,235,.09)",
  border: "1px solid rgba(37,99,235,.20)",

  "&:hover": {
    background: "rgba(37,99,235,.14)",
    borderColor: "rgba(37,99,235,.30)",
  },
};

const historyCardSx = {
  p: 1.4,
  mb: 1.1,
  borderRadius: "12px",
  background: "var(--pf-surface)",
  border: "1px solid var(--pf-border-soft)",
  boxShadow: "0 5px 14px rgba(var(--pf-shadow-rgb),.04)",
};

const historyHeaderSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
  mb: 1.1,
};

const historyMonthSx = {
  color: "var(--pf-text-strong)",
  fontSize: 14,
  fontWeight: 950,
};

const historyCreatedSx = {
  mt: 0.3,
  color: "var(--pf-text-muted)",
  fontSize: 10.5,
  fontWeight: 700,
};

const historyTotalSx = {
  color: "#15803d",
  fontSize: 15,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const historyFieldsSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.7,
};

const historyFieldChipSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.8,
  px: 1,
  py: 0.6,
  borderRadius: "999px",
  background: "var(--pf-surface-alt)",
  border: "1px solid var(--pf-border-soft)",

  "& span": {
    color: "#2563eb",
    fontSize: 10.5,
    fontWeight: 900,
  },

  "& b": {
    color: "var(--pf-text-strong)",
    fontSize: 10.5,
    fontWeight: 900,
  },
};

const historyNotesSx = {
  mt: 1,
  color: "var(--pf-text)",
  fontSize: 11.5,
  lineHeight: 1.5,
};

const emptyStateSx = {
  py: 2,
  color: "var(--pf-text-muted)",
  textAlign: "center",
  fontSize: 12.5,
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
  },
};

const saveButtonSx = {
  minHeight: 39,
  px: 2.2,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 900,
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow:
    "0 8px 20px rgba(37,99,235,.24)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },

  "&.Mui-disabled": {
    color: "var(--pf-text-dim)",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
    boxShadow: "none",
  },
};

export default VehicleExpenseModal;