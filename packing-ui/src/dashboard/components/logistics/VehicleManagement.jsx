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
  showAlert = () => {},
}) {
  const [vehicles, setVehicles] =
    useState([]);

  const [open, setOpen] =
    useState(false);

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

      setVehicles(data || []);
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
    let active = true;

    fetchVehicles()
      .then((data) => {
        if (!active) return;

        setVehicles(data || []);
      })
      .catch((e) => {
        if (!active) return;

        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to load vehicles"
          ),
          "error"
        );
      });

    return () => {
      active = false;
    };
  }, [showAlert]);

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
            Vehicles, fuel and maintenance
          </div>
        </div>

        <button
          style={button}
          onClick={() =>
            setOpen(true)
          }
        >
          + Add Vehicle
        </button>
      </div>

      <div style={table}>
        <div style={tableHead}>
          <div>Vehicle</div>
          <div>Type</div>
          <div>Status</div>
          <div>Fuel</div>
          <div>Actions</div>
        </div>

        {paginatedVehicles.map((v) => (
          <div
            key={v.id}
            style={tableRow}
          >
            <div>{v.vehicleNumber}</div>

            <div>{v.vehicleType}</div>

            <div>{v.status}</div>

            <div>
              {v.fuelCapacity ??
                v.fuel ??
                "-"}
            </div>

            <div>
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
        onClose={() =>
          setOpen(false)
        }
        onCreated={loadVehicles}
        showAlert={showAlert}
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
  overflow: "hidden",
};

const tableHead = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .8fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .8fr",
  padding: 16,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
};

const deleteBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  borderRadius: 10,
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 700,
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