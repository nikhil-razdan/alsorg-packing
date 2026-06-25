import {
  useEffect,
  useState,
} from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Box,
} from "@mui/material";

import {
  fetchVehicles,
  deleteVehicle,
} from "../../api/logisticsApi";

import CreateVehicleModal from "./modals/CreateVehicleModal";
import LogisticsPagination from "./LogisticsPagination";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

function VehicleManagement({
  showAlert = () => { },
}) {
  const [vehicles, setVehicles] =
    useState([]);

  const [open, setOpen] =
    useState(false);

  const [editingVehicle, setEditingVehicle] =
    useState(null);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const [deleteVehicleId, setDeleteVehicleId] =
    useState(null);

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const loadVehicles = async () => {
    try {
      const data = await fetchVehicles();

      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Failed to load vehicles"
        ),
        "error"
      );
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const openCreate = () => {
    setEditingVehicle(null);
    setOpen(true);
  };

  const openEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setOpen(true);
  };

  const closeForm = () => {
    setOpen(false);
    setEditingVehicle(null);
  };

  const openDelete = (id) => {
    setDeleteVehicleId(id);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteVehicleId(null);
  };

  const confirmDelete = async () => {
    if (!deleteVehicleId) return;

    try {
      await deleteVehicle(deleteVehicleId);

      await loadVehicles();

      showAlert(
        "Vehicle deleted successfully",
        "success"
      );

      closeDelete();
    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Vehicle delete failed"
        ),
        "error"
      );
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(vehicles.length / pageSize)
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedVehicles =
    vehicles.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Fleet Management
          </div>

          <div style={subtitle}>
            Complete editable vehicle records, document validity and fleet status
          </div>
        </div>

        <button
          style={button}
          onClick={openCreate}
        >
          + Add Vehicle
        </button>
      </div>

      <div style={table}>
        <div style={tableHead}>
          <div>Vehicle</div>
          <div>Driver</div>
          <div>Owner</div>
          <div>Type / Class</div>
          <div>Fuel / Norm</div>
          <div>Status</div>
          <div>Document Validity</div>
          <div>Actions</div>
        </div>

        {paginatedVehicles.length === 0 && (
          <div style={emptyState}>
            No vehicles found.
          </div>
        )}

        {paginatedVehicles.map((v) => (
          <div
            key={v.id}
            style={tableRow}
          >
            <div style={mainCell}>
              <span style={vehicleNoText}>
                {v.vehicleNumber || "-"}
              </span>

              <span style={subText}>
                Reg: {formatDate(v.registrationDate)}
              </span>

              <span style={subText}>
                {v.registeringAuthority || "-"}
              </span>
            </div>

            <div style={normalCell}>
              {v.driverName || "-"}
            </div>

            <div style={normalCell}>
              {v.ownerName || "-"}
            </div>

            <div style={mainCell}>
              <span style={normalText}>
                {v.vehicleType || "-"}
              </span>

              <span style={subText}>
                {v.vehicleClass || "-"}
              </span>
            </div>

            <div style={mainCell}>
              <span style={normalText}>
                {v.fuelType ||
                  v.fuel ||
                  "-"}
              </span>

              <span style={subText}>
                {v.emissionNorm || "-"}
              </span>
            </div>

            <div>
              <Chip
                label={v.status || "Active"}
                size="small"
                sx={getStatusChipSx(v.status)}
              />

              {v.vehicleAge && (
                <div style={subText}>
                  Age: {v.vehicleAge}
                </div>
              )}
            </div>

            <div style={validityCell}>
              <ValidityLine
                label="Fitness"
                value={v.fitnessValidUpto}
              />

              <ValidityLine
                label="Insurance"
                value={v.insuranceValidUpto}
              />

              <ValidityLine
                label="PUCC"
                value={v.puccValidUpto}
              />
            </div>

            <div style={actionsCell}>
              <button
                style={editBtn}
                onClick={() => openEdit(v)}
              >
                Edit
              </button>

              <button
                style={deleteBtn}
                onClick={() =>
                  openDelete(v.id)
                }
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <LogisticsPagination
        pageNo={currentPage}
        setPageNo={setPageNo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={vehicles.length}
      />

      <CreateVehicleModal
        open={open}
        onClose={closeForm}
        onCreated={loadVehicles}
        showAlert={showAlert}
        initialData={editingVehicle}
      />

      <Dialog
        open={deleteOpen}
        onClose={closeDelete}
        PaperProps={{
          sx: {
            background:
              "linear-gradient(180deg,#0f172a,#111827)",
            color: "#fff",
            borderRadius: "24px",
            border:
              "1px solid rgba(255,255,255,.06)",
          },
        }}
      >
        <DialogTitle>
          Delete Vehicle
        </DialogTitle>

        <DialogContent>
          Are you sure you want to delete this vehicle?
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closeDelete}
            sx={actionSecondary}
          >
            Cancel
          </Button>

          <Button
            onClick={confirmDelete}
            sx={actionDanger}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function ValidityLine({
  label,
  value,
}) {
  return (
    <Box sx={validityLineSx}>
      <span>{label}</span>

      <b>{formatDate(value)}</b>
    </Box>
  );
}

function formatDate(value) {
  if (!value) return "-";

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] =
      text.slice(0, 10).split("-");

    return `${day}-${month}-${year}`;
  }

  return text;
}

function getStatusChipSx(status) {
  const value =
    String(status || "Active")
      .toLowerCase();

  if (
    value.includes("expired") ||
    value.includes("inactive")
  ) {
    return statusDangerChipSx;
  }

  if (
    value.includes("maintenance")
  ) {
    return statusWarningChipSx;
  }

  return statusActiveChipSx;
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
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
  borderRadius: 18,
  overflowX: "auto",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const tableHead = {
  display: "grid",
  gridTemplateColumns:
    "1.18fr 1.05fr 1.1fr 1.1fr 1fr .85fr 1.85fr 1.15fr",
  minWidth: 1520,
  padding: "16px 18px",
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 900,
  fontSize: 13,
  columnGap: 18,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns:
    "1.18fr 1.05fr 1.1fr 1.1fr 1fr .85fr 1.85fr 1.15fr",
  minWidth: 1520,
  padding: "18px 18px",
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
  columnGap: 18,
};

const emptyState = {
  minWidth: 1520,
  padding: 24,
  color: "#94a3b8",
  textAlign: "center",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
};

const mainCell = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const normalCell = {
  color: "#e5e7eb",
  fontWeight: 700,
  fontSize: 13,
};

const vehicleNoText = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  letterSpacing: ".03em",
};

const normalText = {
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const subText = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 650,
};

const validityCell = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 230,
  paddingRight: 18,
};

const validityLineSx = {
  display: "grid",
  gridTemplateColumns: "88px 120px",
  alignItems: "center",
  gap: 1.4,
  color: "#bfdbfe",
  fontSize: 12.5,
  fontWeight: 850,
  lineHeight: 1.25,

  "& span": {
    color: "#93c5fd",
    fontWeight: 900,
    fontSize: 12.5,
  },

  "& b": {
    color: "#f8fafc",
    fontWeight: 950,
    fontSize: 12.5,
    whiteSpace: "nowrap",
  },
};

const actionsCell = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  justifyContent: "flex-start",
  paddingLeft: 18,
  borderLeft: "1px solid rgba(255,255,255,.06)",
};

const editBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};

const deleteBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};

const statusActiveChipSx = {
  color: "#bbf7d0",
  background: "rgba(34,197,94,.15)",
  border:
    "1px solid rgba(34,197,94,.25)",
  fontWeight: 900,
};

const statusWarningChipSx = {
  color: "#fde68a",
  background: "rgba(245,158,11,.15)",
  border:
    "1px solid rgba(245,158,11,.25)",
  fontWeight: 900,
};

const statusDangerChipSx = {
  color: "#fecaca",
  background: "rgba(239,68,68,.15)",
  border:
    "1px solid rgba(239,68,68,.25)",
  fontWeight: 900,
};

const actionSecondary = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 700,
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  border:
    "1px solid rgba(255,255,255,.08)",

  "&:hover": {
    background:
      "rgba(255,255,255,.08)",
  },
};

const actionDanger = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 700,
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  boxShadow:
    "0 10px 24px rgba(239,68,68,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#b91c1c,#dc2626)",
  },
};

export default VehicleManagement;