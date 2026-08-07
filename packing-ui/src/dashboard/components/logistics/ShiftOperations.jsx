import {
  useEffect,
  useState,
} from "react";

import "./logisticsScrollbars.css";

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

const statusOptions = [
  "WORKING",
  "OFF",
  "ON_LEAVE",
  "COMPLETED",
  "CANCELLED",
];

const getShiftSearchText = (shift) => {
  return [
    shift.driver?.name,
    shift.vehicle?.vehicleNumber,
    formatShiftDate(shift),
    formatShiftTimeRange(shift),
    shift.totalTrips,
    shift.routeCategory,
    normalizeStatus(shift.status),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

function ShiftOperations({
  showAlert = () => { },
  openCreateToken = 0,
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

  const [selectedIds, setSelectedIds] =
    useState([]);

  const [bulkStatus, setBulkStatus] =
    useState("");

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    if (!openCreateToken) {
      return;
    }

    setEditingShift(null);
    setCreateOpen(true);
  }, [openCreateToken]);

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

  const searchTerm =
    search.trim().toLowerCase();

  const filteredActiveShifts =
    searchTerm.length === 0
      ? activeShifts
      : activeShifts.filter((s) =>
        getShiftSearchText(s).includes(
          searchTerm
        )
      );

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredActiveShifts.length / pageSize
    )
  );

  const currentPage = Math.min(
    pageNo,
    totalPages
  );

  const paginatedShifts =
    filteredActiveShifts.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  const visibleIds = paginatedShifts.map(
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

      await load();

      showAlert(
        bulkStatus === "COMPLETED"
          ? "Selected shifts completed and moved to history"
          : bulkStatus === "CANCELLED"
            ? "Selected shifts cancelled and moved to history"
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

  return (
    <div className="logistics-scroll-scope" style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Legacy Operations
          </div>

          <div style={subtitle}>
            Existing shift records and non-challan trips
          </div>
        </div>

        <button
          style={button}
          onClick={() =>
            setCreateOpen(true)
          }
        >
          + Add Manual Operation
        </button>
      </div>

      <div style={manualNotice}>
        <div style={manualNoticeTitle}>
          Use this only when there is no item dispatch challan
        </div>

        <div style={manualNoticeText}>
          Examples: material pickup, empty vehicle return,
          internal vehicle movement, site visit, maintenance run
          or another trip that does not carry dispatched packet items.
          Existing historical shift records remain unchanged.
        </div>
      </div>

      <div style={bulkBar}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageNo(1);
            setSelectedIds([]);
          }}
          placeholder="Search driver, vehicle, date, route, status..."
          style={searchInput}
        />
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

      <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={table}>
        <div style={head}>
          <div>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              title="Select all visible shifts"
            />
          </div>

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
              {search
                ? "No shifts matched your search"
                : "No shifts found"}
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
        totalItems={filteredActiveShifts.length}
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
  overflowX: "auto",
  overflowY: "hidden",
  overscrollBehaviorX: "contain",
  borderRadius: 18,
  border:
    "1px solid rgba(255,255,255,.05)",
};

const head = {
  minWidth: 1080,
  display: "grid",
  gridTemplateColumns:
    ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const row = {
  minWidth: 1080,
  display: "grid",
  gridTemplateColumns:
    ".35fr 1.05fr 1fr 1.1fr .55fr .85fr 1fr 1fr",
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

const searchInput = {
  height: 38,
  minWidth: 280,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
  fontWeight: 700,
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

const manualNotice = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 15,
  background:
    "linear-gradient(135deg,rgba(139,92,246,.12),rgba(15,23,42,.42))",
  border:
    "1px solid rgba(139,92,246,.20)",
};

const manualNoticeTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
};

const manualNoticeText = {
  color: "#94a3b8",
  marginTop: 5,
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.5,
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

export default ShiftOperations;