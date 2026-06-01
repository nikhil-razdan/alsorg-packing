import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import {
  fetchShifts,
} from "../../api/logisticsApi";

import LogisticsPagination from "./LogisticsPagination";

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
    loadHistory();
  }, []);

  const historyRows = useMemo(() => {
    return shifts.filter((s) =>
      s.status !== "WORKING"
    );
  }, [shifts]);

  const paginatedRows = useMemo(() => {
    return historyRows.slice(
      (pageNo - 1) * pageSize,
      pageNo * pageSize
    );
  }, [historyRows, pageNo, pageSize]);

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

      <div style={table}>
        <div style={head}>
          <div>Driver</div>
          <div>Vehicle</div>
          <div>Trips</div>
          <div>Route</div>
          <div>Status</div>
          <div>Date</div>
        </div>

        {loading && (
          <div style={emptyRow}>
            Loading shift history...
          </div>
        )}

        {!loading &&
          paginatedRows.length === 0 && (
            <div style={emptyRow}>
              No completed shift history found
            </div>
          )}

        {!loading &&
          paginatedRows.map((s) => (
            <div
              key={s.id}
              style={row}
            >
              <div>
                {s.driver?.name || "-"}
              </div>

              <div>
                {s.vehicle?.vehicleNumber || "-"}
              </div>

              <div>
                {s.totalTrips ?? "-"}
              </div>

              <div>
                {s.routeCategory || "-"}
              </div>

              <div>
                <span style={status(s.status)}>
                  {s.status || "-"}
                </span>
              </div>

              <div>
                {formatDate(
                  s.updatedAt ||
                    s.createdAt ||
                    s.date
                )}
              </div>
            </div>
          ))}
      </div>

      <LogisticsPagination
        pageNo={pageNo}
        setPageNo={setPageNo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={historyRows.length}
      />
    </div>
  );
}

const formatDate = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "-";
  }
};

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
    "1.2fr 1fr .7fr 1fr .8fr 1fr",

  padding: 16,

  background: "#111827",

  color: "#94a3b8",

  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1fr .7fr 1fr .8fr 1fr",

  padding: 16,

  color: "#fff",

  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

const emptyRow = {
  padding: 28,

  color: "#94a3b8",

  textAlign: "center",

  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

const status = (value) => ({
  display: "inline-flex",

  padding: "6px 10px",

  borderRadius: 999,

  fontSize: 12,

  fontWeight: 700,

  background:
    value === "COMPLETED"
      ? "rgba(34,197,94,0.15)"
      : value === "CANCELLED"
      ? "rgba(239,68,68,0.15)"
      : "rgba(148,163,184,0.15)",

  color:
    value === "COMPLETED"
      ? "#4ade80"
      : value === "CANCELLED"
      ? "#f87171"
      : "#cbd5e1",
});

export default ShiftHistory;