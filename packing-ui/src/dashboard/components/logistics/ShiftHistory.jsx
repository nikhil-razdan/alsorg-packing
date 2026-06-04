import {
  useEffect,
  useState,
} from "react";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  fetchShifts,
  updateShiftStatus,
} from "../../api/logisticsApi";

import {
  formatShiftDate,
  formatShiftTimeRange,
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

import LogisticsPagination from "./LogisticsPagination";

const normalizeStatus = (status) =>
  String(status || "WORKING")
    .trim()
    .toUpperCase();
	
	const statusOptions = [
	  "WORKING",
	  "OFF",
	  "ON_LEAVE",
	  "COMPLETED",
	  "CANCELLED",
	];

function ShiftHistory({
  showAlert = () => {},
}) {
  const [loading, setLoading] =
    useState(true);

  const [shifts, setShifts] =
    useState([]);

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);
	
	const [selectedIds, setSelectedIds] =
	  useState([]);

	const [bulkStatus, setBulkStatus] =
	  useState("");

  const loadHistory = async () => {
    try {
      setLoading(true);

      const data = await fetchShifts();

      setShifts(data || []);
	  } catch (e) {
	    console.error(
	      "Failed to load shift history",
	      e
	    );

	    showAlert(
	      getBackendMessage(
	        e,
	        "Failed to load shift history"
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
            "Failed to load shift history"
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

  const historyRows = shifts.filter((s) => {
    const status = normalizeStatus(s.status);

    return [
      "COMPLETED",
      "CANCELLED",
    ].includes(status);
  });

  const totalPages = Math.max(
    1,
    Math.ceil(historyRows.length / pageSize)
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedRows =
    historyRows.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
	
	const visibleIds = paginatedRows.map(
	  (s) => s.id
	);

	const allVisibleSelected =
	  visibleIds.length > 0 &&
	  visibleIds.every((id) =>
	    selectedIds.includes(id)
	  );

	const toggleOne = (id) => {
	  setSelectedIds((prev) =>
	    prev.includes(id)
	      ? prev.filter((x) => x !== id)
	      : [...prev, id]
	  );
	};

	const toggleAllVisible = () => {
	  if (allVisibleSelected) {
	    setSelectedIds((prev) =>
	      prev.filter(
	        (id) => !visibleIds.includes(id)
	      )
	    );
	  } else {
	    setSelectedIds((prev) =>
	      Array.from(
	        new Set([
	          ...prev,
	          ...visibleIds,
	        ])
	      )
	    );
	  }
	};

	const clearSelection = () => {
	  setSelectedIds([]);
	  setBulkStatus("");
	};

	const bulkChangeStatus = async () => {
	  if (selectedIds.length === 0) {
	    showAlert(
	      "Please select at least one shift",
	      "error"
	    );
	    return;
	  }

	  if (!bulkStatus) {
	    showAlert(
	      "Please select a status",
	      "error"
	    );
	    return;
	  }

	  try {
	    await Promise.all(
	      selectedIds.map((id) =>
	        updateShiftStatus(id, bulkStatus)
	      )
	    );

	    await loadHistory();

	    showAlert(
	      [
	        "WORKING",
	        "OFF",
	        "ON_LEAVE",
	      ].includes(bulkStatus)
	        ? "Selected shifts moved back to operations"
	        : "Selected shifts updated successfully",
	      "success"
	    );

	    clearSelection();
	  } catch (e) {
	    console.error(e);

	    showAlert(
	      getBackendMessage(
	        e,
	        "Failed to update selected shifts"
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

	      await loadHistory();

	      showAlert(
	        [
	          "WORKING",
	          "OFF",
	          "ON_LEAVE",
	        ].includes(nextStatus)
	          ? "Shift moved back to operations"
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

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Shift History
          </div>

          <div style={subtitle}>
            Historical logistics operations
          </div>
        </div>
      </div>
	  <div style={bulkBar}>
	    <div style={bulkInfo}>
	      Selected:{" "}
	      <strong>{selectedIds.length}</strong>
	    </div>

	    <select
	      value={bulkStatus}
	      onChange={(e) =>
	        setBulkStatus(e.target.value)
	      }
	      style={bulkSelect}
	    >
	      <option value="">
	        Select Status
	      </option>

	      {statusOptions.map((status) => (
	        <option
	          key={status}
	          value={status}
	        >
	          {status}
	        </option>
	      ))}
	    </select>

	    <button
	      style={{
	        ...bulkBtn,
	        opacity:
	          selectedIds.length === 0 ||
	          !bulkStatus
	            ? 0.55
	            : 1,
	        cursor:
	          selectedIds.length === 0 ||
	          !bulkStatus
	            ? "not-allowed"
	            : "pointer",
	      }}
	      disabled={
	        selectedIds.length === 0 ||
	        !bulkStatus
	      }
	      onClick={bulkChangeStatus}
	    >
	      Bulk Change Status
	    </button>

	    {selectedIds.length > 0 && (
	      <button
	        style={clearBtn}
	        onClick={clearSelection}
	      >
	        Clear
	      </button>
	    )}
	  </div>
      <div style={table}>
	  <div style={head}>
	    <div>
	      <input
	        type="checkbox"
	        checked={allVisibleSelected}
	        onChange={toggleAllVisible}
	        title="Select all visible history shifts"
	      />
	    </div>

	    <div>Driver</div>
	    <div>Vehicle</div>
	    <div>Date</div>
	    <div>Trips</div>
	    <div>Route</div>
	    <div>Status</div>
	  </div>

        {loading && (
          <div style={emptyRow}>
            Loading shift history...
          </div>
        )}

        {!loading &&
          paginatedRows.length === 0 && (
            <div style={emptyRow}>
              No completed or cancelled shift history found
            </div>
          )}

        {!loading &&
          paginatedRows.map((s) => (
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
			  <input
			    type="checkbox"
			    checked={selectedIds.includes(
			      s.id
			    )}
			    onChange={() =>
			      toggleOne(s.id)
			    }
			  />
			</div>
			  <div>
			    {s.driver?.name || "-"}
			  </div>

			  <div>
			    {s.vehicle?.vehicleNumber || "-"}
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
			    {statusOptions.map((status) => (
			      <option
			        key={status}
			        value={status}
			      >
			        {status}
			      </option>
			    ))}
			  </select>
			  </div>
			</div>
          ))}
      </div>

	  <LogisticsPagination
	    pageNo={currentPage}
	    setPageNo={setPageNo}
	    pageSize={pageSize}
	    setPageSize={setPageSize}
	    totalItems={historyRows.length}
	  />
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

const table = {
  overflow: "hidden",
  borderRadius: 18,
};

const head = {
  display: "grid",
  gridTemplateColumns:
    ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns:
    ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr",
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

const bulkBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 16,
  padding: 12,
  borderRadius: 16,
  background:
    "rgba(255,255,255,0.035)",
  border:
    "1px solid rgba(255,255,255,0.06)",
};

const bulkInfo = {
  marginRight: "auto",
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 700,
};

const bulkSelect = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
  fontWeight: 700,
};

const bulkBtn = {
  height: 38,
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  padding: "0 14px",
  fontWeight: 800,
};

const clearBtn = {
  height: 38,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
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

export default ShiftHistory;