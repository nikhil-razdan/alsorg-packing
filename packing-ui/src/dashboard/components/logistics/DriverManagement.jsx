import {
  useEffect,
  useState,
} from "react";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import LogisticsPagination from "./LogisticsPagination";

import {
  fetchDrivers,
  deleteDriver,
} from "../../api/logisticsApi";

import CreateDriverModal from "./modals/CreateDriverModal";
import LogisticsShiftModal from "./LogisticsShiftModal";

function DriverManagement({
  showAlert = () => { },
}) {
  const [drivers, setDrivers] =
    useState([]);

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const [open, setOpen] =
    useState(false);

  const [shiftOpen, setShiftOpen] =
    useState(false);

  const [selectedDriver, setSelectedDriver] =
    useState(null);

  const loadDrivers =
    async () => {
      try {
        const data =
          await fetchDrivers();

        setDrivers(data || []);
      } catch (e) {
        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to load drivers"
          ),
          "error"
        );
      }
    };

  useEffect(() => {
    let active = true;

    fetchDrivers()
      .then((data) => {
        if (!active) return;

        setDrivers(data || []);
      })
      .catch((e) => {
        if (!active) return;

        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to load drivers"
          ),
          "error"
        );
      });

    return () => {
      active = false;
    };
  }, [showAlert]);

  const openShiftForDriver = (driver) => {
    setSelectedDriver(driver);
    setShiftOpen(true);
  };

  const closeShiftForDriver = () => {
    setShiftOpen(false);
    setSelectedDriver(null);
  };

  const remove = async (id) => {
    try {
      await deleteDriver(id);

      await loadDrivers();

      showAlert(
        "Driver deleted successfully",
        "success"
      );

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Driver delete failed"
        ),
        "error"
      );
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(drivers.length / pageSize)
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedDrivers =
    drivers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  useEffect(() => {
    setPageNo(1);
  }, [pageSize]);

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Driver Management
          </div>

          <div style={subtitle}>
            Driver operations and
            status
          </div>
        </div>

        <button
          style={button}
          onClick={() =>
            setOpen(true)
          }
        >
          + Add Driver
        </button>
      </div>

      <div style={table}>
        <div style={head}>
          <div>Name</div>

          <div>Phone</div>

          <div>License</div>

          <div>Status</div>

          <div>Actions</div>
        </div>

        {paginatedDrivers.length === 0 && (
          <div style={emptyRow}>
            No drivers found
          </div>
        )}

        {paginatedDrivers.map((d) => (
          <div
            key={d.id}
            style={row}
          >
            <div>
              <button
                style={driverNameBtn}
                onClick={() =>
                  openShiftForDriver(d)
                }
                title="View shift history and create shift"
              >
                {d.name}
              </button>
            </div>
            <div>
              {d.phoneNumber || d.phone || "-"}
            </div>
            <div>
              {d.licenseNumber || "-"}
            </div>
            <div>
              {d.status ||
                (d.active
                  ? "ACTIVE"
                  : "INACTIVE")}
            </div>
            <div>
              <button
                style={deleteBtn}
                onClick={() =>
                  remove(d.id)
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
        totalItems={drivers.length}
      />

      <CreateDriverModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
        onCreated={loadDrivers}
        showAlert={showAlert}
      />

      {shiftOpen && selectedDriver && (
        <LogisticsShiftModal
          open={shiftOpen}
          mode="create"
          initialDriverId={
            selectedDriver.id
          }
          driverName={
            selectedDriver.name
          }
          lockDriver={true}
          showDriverHistory={true}
          onClose={closeShiftForDriver}
          onSaved={loadDrivers}
          showAlert={showAlert}
        />
      )}
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

  justifyContent:
    "space-between",

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

const head = {
  display: "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .7fr",

  padding: 16,

  background: "#111827",

  color: "#94a3b8",

  fontWeight: 700,
};

const row = {
  display: "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .7fr",

  padding: 16,

  color: "#fff",

  borderTop:
    "1px solid rgba(255,255,255,0.06)",

  alignItems: "center",
};

const deleteBtn = {
  border: "none",

  background: "#ef4444",

  color: "#fff",

  borderRadius: 8,

  padding: "6px 10px",

  cursor: "pointer",

  fontWeight: 700,
};

const driverNameBtn = {
  border: "none",
  background: "transparent",
  color: "#60a5fa",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
  padding: 0,
  textAlign: "left",
};

const emptyRow = {
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

export default DriverManagement;