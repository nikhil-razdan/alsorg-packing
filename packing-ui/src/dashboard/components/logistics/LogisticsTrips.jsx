import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchLogisticsTrips,
  endLogisticsTrip,
} from "../../api/logisticsApi";

function getNowDateTimeLocal() {
  const d = new Date();

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  return d.toISOString().slice(0, 16);
}

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

function LogisticsTrips({
  showAlert = () => {},
}) {
  const [loading, setLoading] =
    useState(false);

  const [trips, setTrips] =
    useState([]);

  const [endModal, setEndModal] =
    useState(null);

  const [endForm, setEndForm] =
    useState({
      tripEnd: getNowDateTimeLocal(),
      remarks: "",
    });

  const load = async () => {
    try {
      setLoading(true);

      const data =
        await fetchLogisticsTrips();

      setTrips(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      showAlert(
        e.message || "Failed to load trips",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeTrips = useMemo(() => {
    return trips.filter(
      (t) =>
        normalizeStatus(t.status) ===
        "OUT_FOR_DELIVERY"
    );
  }, [trips]);

  const completedTrips = useMemo(() => {
    return trips.filter(
      (t) =>
        normalizeStatus(t.status) ===
        "DELIVERED"
    );
  }, [trips]);

  const submitEndTrip = async () => {
    if (!endModal) return;

    try {
      await endLogisticsTrip(
        endModal.id,
        {
          tripEnd: endForm.tripEnd,
          remarks: endForm.remarks,
        }
      );

      showAlert(
        "Trip ended and items marked delivered",
        "success"
      );

      setEndModal(null);
      await load();
    } catch (e) {
      console.error(e);

      showAlert(
        e.message || "Failed to end trip",
        "error"
      );
    }
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Trips / Delivery
          </div>

          <div style={subtitle}>
            Active out-for-delivery trips and completed delivery history
          </div>
        </div>
      </div>

      <SectionTitle text="Active Trips" />

      <div style={table}>
        <div style={head}>
          <div>Challan</div>
          <div>Driver</div>
          <div>Vehicle</div>
          <div>Start Time</div>
          <div>Items</div>
          <div>Status</div>
          <div>Action</div>
        </div>

        {loading && (
          <div style={emptyRow}>
            Loading trips...
          </div>
        )}

        {!loading && activeTrips.length === 0 && (
          <div style={emptyRow}>
            No active trips
          </div>
        )}

        {activeTrips.map((trip) => (
          <div
            key={trip.id}
            style={row}
          >
            <div>{trip.challanNumber || "—"}</div>
            <div>{trip.driver?.name || "—"}</div>
            <div>{trip.vehicle?.vehicleNumber || "—"}</div>
            <div>
              {trip.tripStart
                ? new Date(trip.tripStart).toLocaleString()
                : "—"}
            </div>
            <div>{trip.totalItems || 0}</div>
            <div>
              <span style={activeChip}>
                OUT FOR DELIVERY
              </span>
            </div>
            <div>
              <button
                style={endBtn}
                onClick={() => {
                  setEndModal(trip);
                  setEndForm({
                    tripEnd: getNowDateTimeLocal(),
                    remarks: "",
                  });
                }}
              >
                End Trip
              </button>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle text="Completed Trips" />

      <div style={table}>
        <div style={headCompleted}>
          <div>Challan</div>
          <div>Driver</div>
          <div>Vehicle</div>
          <div>Start</div>
          <div>End</div>
          <div>Items</div>
          <div>Status</div>
        </div>

        {completedTrips.length === 0 && (
          <div style={emptyRow}>
            No completed trips
          </div>
        )}

        {completedTrips.map((trip) => (
          <div
            key={trip.id}
            style={rowCompleted}
          >
            <div>{trip.challanNumber || "—"}</div>
            <div>{trip.driver?.name || "—"}</div>
            <div>{trip.vehicle?.vehicleNumber || "—"}</div>
            <div>
              {trip.tripStart
                ? new Date(trip.tripStart).toLocaleString()
                : "—"}
            </div>
            <div>
              {trip.tripEnd
                ? new Date(trip.tripEnd).toLocaleString()
                : "—"}
            </div>
            <div>{trip.totalItems || 0}</div>
            <div>
              <span style={doneChip}>
                DELIVERED
              </span>
            </div>
          </div>
        ))}
      </div>

      {endModal && (
        <div
          style={overlay}
          onClick={() => setEndModal(null)}
        >
          <div
            style={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalTitle}>
              End Trip
            </div>

            <div style={modalSub}>
              Challan: {endModal.challanNumber}
            </div>

            <label style={field}>
              Trip End Time
              <input
                type="datetime-local"
                value={endForm.tripEnd}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    tripEnd: e.target.value,
                  }))
                }
                style={input}
              />
            </label>

            <label style={field}>
              Remarks
              <textarea
                rows={3}
                value={endForm.remarks}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
                style={textarea}
              />
            </label>

            <div style={footer}>
              <button
                style={cancelBtn}
                onClick={() => setEndModal(null)}
              >
                Cancel
              </button>

              <button
                style={saveBtn}
                onClick={submitEndTrip}
              >
                End Trip & Mark Delivered
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ text }) {
  return (
    <div style={sectionTitle}>
      {text}
    </div>
  );
}

const wrap = {
  background: "linear-gradient(180deg,#0f172a,#111827)",
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

const sectionTitle = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  marginTop: 22,
  marginBottom: 12,
};

const table = {
  borderRadius: 18,
  overflow: "hidden",
  marginBottom: 20,
};

const head = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.4fr .6fr 1fr .8fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.4fr .6fr 1fr .8fr",
  padding: 16,
  color: "#fff",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
};

const headCompleted = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.2fr 1.2fr .6fr 1fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const rowCompleted = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.2fr 1.2fr .6fr 1fr",
  padding: 16,
  color: "#fff",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
};

const activeChip = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(59,130,246,.16)",
  color: "#93c5fd",
  fontWeight: 900,
  fontSize: 11,
};

const doneChip = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(16,185,129,.16)",
  color: "#6ee7b7",
  fontWeight: 900,
  fontSize: 11,
};

const endBtn = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  background: "linear-gradient(135deg,#10b981,#059669)",
};

const emptyRow = {
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,.72)",
  backdropFilter: "blur(10px)",
  zIndex: 6000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modal = {
  width: 520,
  padding: 24,
  borderRadius: 24,
  background: "linear-gradient(180deg,#0f172a,#111827)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.08)",
};

const modalTitle = {
  fontSize: 22,
  fontWeight: 900,
};

const modalSub = {
  color: "#94a3b8",
  marginTop: 6,
  marginBottom: 18,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 14,
  color: "#cbd5e1",
  fontWeight: 800,
  fontSize: 13,
};

const input = {
  height: 42,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.05)",
  color: "#fff",
  padding: "0 12px",
};

const textarea = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.05)",
  color: "#fff",
  padding: 12,
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 20,
};

const cancelBtn = {
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.05)",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const saveBtn = {
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

export default LogisticsTrips;