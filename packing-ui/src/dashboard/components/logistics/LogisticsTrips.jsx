import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchLogisticsTrips,
  fetchLogisticsTripItems,
  endLogisticsTrip,
  downloadTripChallan
} from "../../api/logisticsApi.jsx";

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
  showAlert = () => { },
}) {
  const [loading, setLoading] =
    useState(false);

  const [trips, setTrips] =
    useState([]);

  const [itemsModalTrip, setItemsModalTrip] =
    useState(null);

  const [tripItems, setTripItems] =
    useState([]);

  const [tripItemsLoading, setTripItemsLoading] =
    useState(false);

  const [endModal, setEndModal] =
    useState(null);

  const [endForm, setEndForm] =
    useState({
      tripEnd: getNowDateTimeLocal(),
      remarks: "",
      receiverName: "",
      receiverPhone: "",
      podUrl: "",
      deliveryRemarks: "",
      deliveryLatitude: "",
      deliveryLongitude: "",
      deliveryLocationAccuracy: "",
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

  const openTripItems = async (trip) => {
    try {
      setItemsModalTrip(trip);
      setTripItems([]);
      setTripItemsLoading(true);

      const data =
        await fetchLogisticsTripItems(trip.id);

      setTripItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);

      showAlert(
        e.message || "Failed to load trip items",
        "error"
      );
    } finally {
      setTripItemsLoading(false);
    }
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      showAlert(
        "Location capture is not supported on this device",
        "error"
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEndForm((prev) => ({
          ...prev,
          deliveryLatitude: position.coords.latitude,
          deliveryLongitude: position.coords.longitude,
          deliveryLocationAccuracy: position.coords.accuracy,
        }));

        showAlert(
          "Location captured successfully",
          "success"
        );
      },
      (error) => {
        console.error(error);

        showAlert(
          "Unable to capture location. Please allow location permission.",
          "error"
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const submitEndTrip = async () => {
    if (!endModal) return;

    try {
      await endLogisticsTrip(
        endModal.id,
        {
          tripEnd: endForm.tripEnd,
          remarks: endForm.remarks,
          receiverName: endForm.receiverName,
          receiverPhone: endForm.receiverPhone,
          podUrl: endForm.podUrl,
          deliveryRemarks: endForm.deliveryRemarks,
          deliveryLatitude: endForm.deliveryLatitude
            ? Number(endForm.deliveryLatitude)
            : null,
          deliveryLongitude: endForm.deliveryLongitude
            ? Number(endForm.deliveryLongitude)
            : null,
          deliveryLocationAccuracy: endForm.deliveryLocationAccuracy
            ? Number(endForm.deliveryLocationAccuracy)
            : null,
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
            <div style={actionGroup}>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  downloadTripChallan(
                    trip.id,
                    localStorage.getItem("token")
                  )
                }
              >
                Download Challan
              </Button>
              <button
                style={viewBtn}
                onClick={() => openTripItems(trip)}
              >
                View Items
              </button>

              <button
                style={endBtn}
                onClick={() => {
                  setEndModal(trip);
                  setEndForm({
                    tripEnd: getNowDateTimeLocal(),
                    remarks: "",
                    receiverName: "",
                    receiverPhone: "",
                    podUrl: "",
                    deliveryRemarks: "",
                    deliveryLatitude: "",
                    deliveryLongitude: "",
                    deliveryLocationAccuracy: "",
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
          <div>Action</div>
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

              {(trip.receiverName || trip.podUrl) && (
                <div style={podMiniText}>
                  {trip.receiverName || "POD"}{" "}
                  {trip.podUrl ? "• POD Attached" : ""}
                </div>
              )}
            </div>
            <div>
            <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  downloadTripChallan(
                    trip.id,
                    localStorage.getItem("token")
                  )
                }
              >
                Download Challan
              </Button>
              <button
                style={viewBtn}
                onClick={() => openTripItems(trip)}
              >
                View Items
              </button>

            </div>
          </div>
        ))}
      </div>
      {itemsModalTrip && (
        <div
          style={overlay}
          onClick={() => {
            setItemsModalTrip(null);
            setTripItems([]);
          }}
        >
          <div
            style={{
              ...modal,
              width: 860,
              maxHeight: "86vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalTitle}>
              Trip Items
            </div>

            <div style={modalSub}>
              Challan: {itemsModalTrip.challanNumber || "—"} | Driver:{" "}
              {itemsModalTrip.driver?.name || "—"} | Vehicle:{" "}
              {itemsModalTrip.vehicle?.vehicleNumber || "—"}
            </div>
            {itemsModalTrip.status === "DELIVERED" && (
              <div style={podSummaryBox}>
                <div>
                  <strong>Receiver:</strong>{" "}
                  {itemsModalTrip.receiverName || "—"}
                </div>

                <div>
                  <strong>Phone:</strong>{" "}
                  {itemsModalTrip.receiverPhone || "—"}
                </div>

                <div>
                  <strong>POD:</strong>{" "}
                  {itemsModalTrip.podUrl ? (
                    <a
                      href={itemsModalTrip.podUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={podLink}
                    >
                      Open POD
                    </a>
                  ) : (
                    "—"
                  )}
                </div>

                <div>
                  <strong>Location:</strong>{" "}
                  {itemsModalTrip.deliveryLatitude && itemsModalTrip.deliveryLongitude
                    ? `${itemsModalTrip.deliveryLatitude}, ${itemsModalTrip.deliveryLongitude}`
                    : "—"}
                </div>

                <div>
                  <strong>Delivery Remarks:</strong>{" "}
                  {itemsModalTrip.deliveryRemarks || "—"}
                </div>
              </div>
            )}
            <div style={tripItemsTable}>
              <div style={tripItemsHead}>
                <div>Item</div>
                <div>SKU</div>
                <div>PD No</div>
                <div>DWG No</div>
                <div>Client</div>
                <div>Description</div>
              </div>

              {tripItemsLoading && (
                <div style={emptyRow}>
                  Loading trip items...
                </div>
              )}

              {!tripItemsLoading && tripItems.length === 0 && (
                <div style={emptyRow}>
                  No items found for this trip.
                </div>
              )}

              {!tripItemsLoading &&
                tripItems.map((item) => (
                  <div
                    key={item.id}
                    style={tripItemsRow}
                  >
                    <div title={item.itemName}>
                      {item.itemName || "—"}
                    </div>

                    <div title={item.sku}>
                      {item.sku || "—"}
                    </div>

                    <div title={item.pdNo}>
                      {item.pdNo || "—"}
                    </div>

                    <div title={item.drawingNo}>
                      {item.drawingNo || "—"}
                    </div>

                    <div title={item.clientName}>
                      {item.clientName || "—"}
                    </div>

                    <div title={item.description}>
                      {item.description || "—"}
                    </div>
                  </div>
                ))}
            </div>

            <div style={footer}>
              <button
                style={cancelBtn}
                onClick={() => {
                  setItemsModalTrip(null);
                  setTripItems([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
              Receiver Name
              <input
                value={endForm.receiverName}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    receiverName: e.target.value,
                  }))
                }
                placeholder="Person who received the material"
                style={input}
              />
            </label>

            <label style={field}>
              Receiver Phone
              <input
                value={endForm.receiverPhone}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    receiverPhone: e.target.value,
                  }))
                }
                placeholder="Receiver phone number"
                style={input}
              />
            </label>

            <label style={field}>
              POD Photo URL
              <input
                value={endForm.podUrl}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    podUrl: e.target.value,
                  }))
                }
                placeholder="Paste POD image/file URL"
                style={input}
              />
            </label>

            <label style={field}>
              Delivery Remarks
              <textarea
                rows={3}
                value={endForm.deliveryRemarks}
                onChange={(e) =>
                  setEndForm((prev) => ({
                    ...prev,
                    deliveryRemarks: e.target.value,
                  }))
                }
                placeholder="Damage, shortage, receiver comments, unloading details..."
                style={textarea}
              />
            </label>

            <div style={locationBox}>
              <div>
                <div style={locationTitle}>
                  Delivery Location
                </div>

                <div style={locationSub}>
                  {endForm.deliveryLatitude && endForm.deliveryLongitude
                    ? `${endForm.deliveryLatitude}, ${endForm.deliveryLongitude} | Accuracy: ${Math.round(
                      Number(endForm.deliveryLocationAccuracy || 0)
                    )}m`
                    : "No location captured yet"}
                </div>
              </div>

              <button
                type="button"
                style={locationBtn}
                onClick={captureCurrentLocation}
              >
                Capture Location
              </button>
            </div>

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
  gridTemplateColumns: "1fr 1fr 1fr 1.2fr 1.2fr .6fr 1fr .8fr",
  padding: 16,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
};

const rowCompleted = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1.2fr 1.2fr .6fr 1fr .8fr",
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

const actionGroup = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const viewBtn = {
  border: "1px solid rgba(96,165,250,.25)",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#93c5fd",
  fontWeight: 800,
  cursor: "pointer",
  background: "rgba(59,130,246,.12)",
};

const tripItemsTable = {
  borderRadius: 16,
  overflow: "auto",
  maxHeight: "56vh",
  border: "1px solid rgba(255,255,255,.06)",
};

const tripItemsHead = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1.2fr .7fr .8fr 1fr 1.4fr",
  padding: 14,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 900,
  fontSize: 12,
  minWidth: 980,
};

const tripItemsRow = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1.2fr .7fr .8fr 1fr 1.4fr",
  padding: 14,
  color: "#fff",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  alignItems: "center",
  fontSize: 13,
  minWidth: 980,
};

const locationBox = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 14,
  borderRadius: 14,
  background: "rgba(59,130,246,.10)",
  border: "1px solid rgba(59,130,246,.18)",
  marginBottom: 14,
};

const locationTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
};

const podMiniText = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 700,
  marginTop: 6,
};

const locationSub = {
  color: "#94a3b8",
  fontSize: 12,
  marginTop: 4,
  fontWeight: 700,
};

const locationBtn = {
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  whiteSpace: "nowrap",
};

const podSummaryBox = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  background: "rgba(16,185,129,.10)",
  border: "1px solid rgba(16,185,129,.18)",
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
};

const podLink = {
  color: "#60a5fa",
  fontWeight: 900,
  textDecoration: "none",
};

export default LogisticsTrips;