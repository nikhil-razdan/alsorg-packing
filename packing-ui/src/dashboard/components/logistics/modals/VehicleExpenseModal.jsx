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

const topGridSx = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1.4,
  mb: 1.5,
};

const expenseFieldWrapSx = {
  display: "flex",
  flexDirection: "column",
  gap: 1.2,
};

const expenseFieldRowSx = {
  display: "grid",
  gridTemplateColumns:
    "1.3fr .75fr 1fr 42px",
  gap: 1,
  alignItems: "center",
};

const totalCardSx = {
  minHeight: 54,
  px: 1.5,
  borderRadius: "14px",
  background:
    "linear-gradient(135deg, rgba(34,197,94,.14), rgba(15,23,42,.62))",
  border:
    "1px solid rgba(34,197,94,.22)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",

  "& span": {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 800,
  },

  "& b": {
    color: "#bbf7d0",
    fontSize: 18,
    fontWeight: 950,
    marginTop: 2,
  },
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

  "& input, & textarea": {
    color: "#fff",
  },
};

const removeButtonSx = {
  width: 38,
  height: 38,
  color: "#fecaca",
  background: "rgba(239,68,68,.14)",
  border: "1px solid rgba(239,68,68,.22)",

  "&:hover": {
    background: "rgba(239,68,68,.24)",
  },
};

const addFieldButtonSx = {
  mt: 1.4,
  borderRadius: "14px",
  textTransform: "none",
  fontWeight: 900,
  color: "#93c5fd",
  background: "rgba(59,130,246,.10)",
  border: "1px solid rgba(59,130,246,.20)",

  "&:hover": {
    background: "rgba(59,130,246,.18)",
  },
};

const historyCardSx = {
  p: 1.5,
  mb: 1.2,
  borderRadius: "16px",
  background: "rgba(15,23,42,.62)",
  border: "1px solid rgba(255,255,255,.07)",
};

const historyHeaderSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
  mb: 1.2,
};

const historyMonthSx = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 950,
};

const historyCreatedSx = {
  mt: 0.3,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 700,
};

const historyTotalSx = {
  color: "#bbf7d0",
  fontSize: 15,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const historyFieldsSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.8,
};

const historyFieldChipSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.8,
  px: 1,
  py: 0.6,
  borderRadius: "999px",
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.07)",

  "& span": {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 900,
  },

  "& b": {
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
  },
};

const historyNotesSx = {
  mt: 1,
  color: "#cbd5e1",
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyStateSx = {
  py: 2,
  color: "#94a3b8",
  textAlign: "center",
  fontSize: 13,
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

export default VehicleExpenseModal;