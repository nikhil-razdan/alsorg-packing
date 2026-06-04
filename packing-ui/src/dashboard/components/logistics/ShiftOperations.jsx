import {
  useEffect,
  useState,
} from "react";

import LogisticsShiftModal from "./LogisticsShiftModal";
import LogisticsPagination from "./LogisticsPagination";

import {
  formatShiftDate,
  formatShiftTimeRange,
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  fetchShifts,
  deleteShift,
  updateShiftStatus,
} from "../../api/logisticsApi";

const normalizeStatus = (status) =>
  String(status || "WORKING")
    .trim()
    .toUpperCase();

function ShiftOperations({
  showAlert = () => {},
}) {
  const [createOpen, setCreateOpen] =
    useState(false);

  const [editingShift, setEditingShift] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [shifts, setShifts] =
    useState([]);

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const load = async () => {
    try {
      setLoading(true);

      const data = await fetchShifts();

      setShifts(data || []);

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Failed to load shifts"
        ),
        "error"
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    setLoading(true);

    fetchShifts()
      .then((data) => {
        if (!active) return;

        setShifts(data || []);
      })
      .catch((e) => {
        if (!active) return;

        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to load shifts"
          ),
          "error"
        );
      })
      .finally(() => {
        if (!active) return;

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showAlert]);
  
  const remove = async (id) => {
    try {
      await deleteShift(id);

      await load();

      showAlert(
        "Shift deleted successfully",
        "success"
      );

    } catch (e) {
      console.error(e);

      showAlert(
        getBackendMessage(
          e,
          "Shift delete failed"
        ),
        "error"
      );
    }
  };

  const quickStatusChange =
    async (shift, nextStatus) => {
      try {
        const currentStatus =
          normalizeStatus(shift.status);

        if (currentStatus === nextStatus) {
          return;
        }

        await updateShiftStatus(
          shift.id,
          nextStatus
        );

        await load();

        showAlert(
          nextStatus === "COMPLETED"
            ? "Shift completed and moved to history"
            : nextStatus === "CANCELLED"
            ? "Shift cancelled and moved to history"
            : "Shift status updated successfully",
          "success"
        );

      } catch (e) {
        console.error(e);

        showAlert(
          getBackendMessage(
            e,
            "Failed to update shift status"
          ),
          "error"
        );
      }
    };

	const activeShifts = shifts.filter((s) => {
	  const status = normalizeStatus(s.status);

	  return ![
	    "COMPLETED",
	    "CANCELLED",
	  ].includes(status);
	});

	const totalPages = Math.max(
	  1,
	  Math.ceil(activeShifts.length / pageSize)
	);

	const currentPage = Math.min(
	  pageNo,
	  totalPages
	);

	const paginatedShifts =
	  activeShifts.slice(
	    (currentPage - 1) * pageSize,
	    currentPage * pageSize
	  );

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Shift Operations
          </div>

          <div style={subtitle}>
            Real-time logistics shifts
          </div>
        </div>

        <button
          style={button}
          onClick={() =>
            setCreateOpen(true)
          }
        >
          + Create Shift
        </button>
      </div>

      <div style={table}>
	  <div style={head}>
	    <div>Driver</div>
	    <div>Vehicle</div>
	    <div>Date</div>
	    <div>Trips</div>
	    <div>Route</div>
	    <div>Status</div>
	    <div>Actions</div>
	  </div>

        {loading && (
          <div style={emptyRow}>
            Loading shifts...
          </div>
        )}

        {!loading &&
          paginatedShifts.length === 0 && (
            <div style={emptyRow}>
              No shifts found
            </div>
          )}

        {!loading &&
          paginatedShifts.map((s) => (
			<div
			  key={s.id}
			  style={{
			    ...row,
			    ...(isShiftOverSixPm(s)
			      ? lateShiftRow
			      : {}),
			  }}
			>
              <div>
                {s.driver?.name || "-"}
              </div>

			  <div>
			    {s.vehicle?.vehicleNumber ||
			      "-"}
			  </div>

			  <div>
			    <div style={dateText}>
			      {formatShiftDate(s)}
			    </div>

			    <div
			      style={{
			        ...timeText,
			        ...(isShiftOverSixPm(s)
			          ? lateTimeText
			          : {}),
			      }}
			    >
			      {formatShiftTimeRange(s)}
			    </div>

			    {isShiftOverSixPm(s) && (
			      <div style={lateBadge}>
			        Over Shift
			      </div>
			    )}
			  </div>

			  <div>
			    {s.totalTrips ?? "-"}
			  </div>

              <div>
                {s.routeCategory || "-"}
              </div>

			  <div>
			  <select
			    value={normalizeStatus(s.status)}
			    onChange={(e) =>
			      quickStatusChange(
			        s,
			        e.target.value
			      )
			    }
			    style={statusSelect(
			      normalizeStatus(s.status)
			    )}
			  >
			    <option value="WORKING">
			      WORKING
			    </option>

			    <option value="OFF">
			      OFF
			    </option>

			    <option value="ON_LEAVE">
			      ON_LEAVE
			    </option>

			    <option value="COMPLETED">
			      COMPLETED
			    </option>

			    <option value="CANCELLED">
			      CANCELLED
			    </option>
			  </select>
			    </div>

              <div style={actions}>
                <button
                  onClick={() =>
                    setEditingShift(s)
                  }
                  style={editBtn}
                >
                  Edit
                </button>

                <button
                  onClick={() =>
                    remove(s.id)
                  }
                  style={deleteBtn}
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
	    totalItems={activeShifts.length}
	  />

      {createOpen && (
        <LogisticsShiftModal
          open={createOpen}
          mode="create"
          onClose={() =>
            setCreateOpen(false)
          }
          onSaved={load}
          showAlert={showAlert}
        />
      )}

      {editingShift && (
        <LogisticsShiftModal
          open={Boolean(editingShift)}
          mode="edit"
          shift={editingShift}
          onClose={() =>
            setEditingShift(null)
          }
          onSaved={load}
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
  overflow: "hidden",
  borderRadius: 18,
};

const head = {
  display: "grid",
  gridTemplateColumns:
    "1.05fr 1fr 1.1fr .55fr .85fr 1fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns:
    "1.05fr 1fr 1.1fr .55fr .85fr 1fr 1fr",
  padding: 16,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
};

const emptyRow = {
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

const actions = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const dateText = {
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const timeText = {
  color: "#94a3b8",
  fontSize: 11,
  marginTop: 4,
};

const editBtn = {
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 700,
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

const lateShiftRow = {
  background:
    "linear-gradient(90deg,rgba(245,158,11,.12),rgba(15,23,42,0))",
  borderLeft:
    "3px solid #f59e0b",
};

const lateTimeText = {
  color: "#fbbf24",
  fontWeight: 800,
};

const lateBadge = {
  display: "inline-flex",
  marginTop: 6,
  padding: "4px 8px",
  borderRadius: 999,
  background:
    "rgba(245,158,11,.16)",
  color: "#fbbf24",
  border:
    "1px solid rgba(245,158,11,.28)",
  fontSize: 10,
  fontWeight: 900,
};

const statusSelect = (value) => ({
  height: 32,
  borderRadius: 999,
  border:
    "1px solid rgba(255,255,255,.08)",
  padding: "0 10px",

  color:
    value === "WORKING"
      ? "#4ade80"
      : value === "COMPLETED"
      ? "#60a5fa"
      : value === "CANCELLED"
      ? "#f87171"
      : value === "OFF"
      ? "#fbbf24"
      : value === "ON_LEAVE"
      ? "#fbbf24"
      : "#cbd5e1",

  background:
    value === "WORKING"
      ? "rgba(34,197,94,0.15)"
      : value === "COMPLETED"
      ? "rgba(59,130,246,0.15)"
      : value === "CANCELLED"
      ? "rgba(239,68,68,0.15)"
      : value === "OFF"
      ? "rgba(251,191,36,0.15)"
      : value === "ON_LEAVE"
      ? "rgba(251,191,36,0.15)"
      : "rgba(148,163,184,0.15)",

  fontSize: 12,
  fontWeight: 800,
  outline: "none",
});

export default ShiftOperations;