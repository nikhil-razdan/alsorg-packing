import { useEffect, useMemo, useState } from "react";

import {
  fetchDailyThroughputUsers,
  fetchDashboardTrace,
} from "../../api/dashboardApi";

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const actorName = (row) =>
  String(
    row?.username ||
      row?.actor ||
      row?.performedBy ||
      row?.user ||
      row?.name ||
      "Unknown User"
  ).trim();

const actorCount = (row) =>
  n(
    row?.count ??
      row?.value ??
      row?.total ??
      row?.items ??
      row?.itemCount ??
      row?.workCount
  );

const toLocalParam = (date) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const todayWindow = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: toLocalParam(start), to: toLocalParam(end) };
};

const traceTimestamp = (row) =>
  row?.packedAt ||
  row?.dispatchedAt ||
  row?.generatedAt ||
  row?.createdAt ||
  row?.updatedAt ||
  row?.timestamp ||
  null;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

function DailyMetricCard({ packing, dispatch, loading, onClick }) {
  const total = n(packing) + n(dispatch);

  return (
    <button type="button" onClick={onClick} style={metricCard}>
      <div style={metricAccent} />
      <div style={metricTop}>
        <div style={metricLabel}>Daily User Throughput</div>
        <div style={metricSignal}>TODAY</div>
      </div>
      <div style={metricValue}>{loading ? "…" : total}</div>
      <div style={metricDetail}>
        {loading
          ? "Loading user-wise packing and dispatch output"
          : `${n(packing)} packing • ${n(dispatch)} dispatched items • inspect by user`}
      </div>
      <div style={inspectHint}>Inspect users & records →</div>
    </button>
  );
}

export default function DailyThroughputDrilldown({ asMetricCard = false }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("packing");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [traceRows, setTraceRows] = useState([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState("");

  const [totals, setTotals] = useState({ packing: 0, dispatch: 0 });
  const [cachedRows, setCachedRows] = useState({ packing: [], dispatch: [] });

  useEffect(() => {
    let active = true;
    setInitialLoading(true);

    Promise.allSettled([
      fetchDailyThroughputUsers("packing"),
      fetchDailyThroughputUsers("dispatch"),
    ]).then(([packingResult, dispatchResult]) => {
      if (!active) return;

      const packingRows =
        packingResult.status === "fulfilled" && Array.isArray(packingResult.value)
          ? packingResult.value
          : [];
      const dispatchRows =
        dispatchResult.status === "fulfilled" && Array.isArray(dispatchResult.value)
          ? dispatchResult.value
          : [];

      setCachedRows({ packing: packingRows, dispatch: dispatchRows });
      setTotals({
        packing: packingRows.reduce((sum, row) => sum + actorCount(row), 0),
        dispatch: dispatchRows.reduce((sum, row) => sum + actorCount(row), 0),
      });
      setInitialLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => actorCount(b) - actorCount(a) || actorName(a).localeCompare(actorName(b))
      ),
    [rows]
  );

  const chooseType = async (nextType) => {
    setType(nextType);
    setSelectedUser("");
    setTraceRows([]);
    setTraceError("");
    setError("");

    const cached = cachedRows[nextType] || [];
    setRows(cached);

    if (cached.length > 0 || totals[nextType] === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchDailyThroughputUsers(nextType);
      const nextRows = Array.isArray(data) ? data : [];
      const total = nextRows.reduce((sum, row) => sum + actorCount(row), 0);
      setRows(nextRows);
      setCachedRows((current) => ({ ...current, [nextType]: nextRows }));
      setTotals((current) => ({ ...current, [nextType]: total }));
    } catch (requestError) {
      setError(requestError?.message || "Unable to load daily user throughput.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = async () => {
    setOpen(true);
    await chooseType("packing");
  };

  const inspectUser = async (row) => {
    const username = actorName(row);
    if (!username || username === "Unknown User") return;

    setSelectedUser(username);
    setTraceRows([]);
    setTraceError("");
    setTraceLoading(true);

    try {
      const range = todayWindow();
      const data = await fetchDashboardTrace({
        type: type || "all",
        from: range.from,
        to: range.to,
        search: username,
        limit: 500,
        offset: 0,
      });

      const candidates = [data, data?.rows, data?.content, data?.data, data?.items];
      const found = candidates.find(Array.isArray) || [];
      const usernameKey = username.trim().toLowerCase();
      const exactRows = found.filter((record) => {
        const actors =
          type === "packing"
            ? [record?.packedBy, record?.generatedBy, record?.createdBy, record?.username, record?.actor]
            : [record?.dispatchedBy, record?.generatedBy, record?.createdBy, record?.username, record?.actor];

        return actors.some(
          (value) => String(value || "").trim().toLowerCase() === usernameKey
        );
      });

      setTraceRows(exactRows);
    } catch (requestError) {
      setTraceError(requestError?.message || "Unable to load exact records for this user.");
    } finally {
      setTraceLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setRows([]);
    setSelectedUser("");
    setTraceRows([]);
    setError("");
    setTraceError("");
  };

  return (
    <>
      {asMetricCard ? (
        <DailyMetricCard
          packing={totals.packing}
          dispatch={totals.dispatch}
          loading={initialLoading}
          onClick={openModal}
        />
      ) : (
        <div style={legacyGrid}>
          <DailyMetricCard
            packing={totals.packing}
            dispatch={totals.dispatch}
            loading={initialLoading}
            onClick={openModal}
          />
        </div>
      )}

      {open && (
        <div
          style={overlay}
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div style={modal} role="dialog" aria-modal="true" aria-label="Daily user throughput">
            <div style={modalHeader}>
              <div>
                <div style={eyebrow}>ADMIN • DAILY USER THROUGHPUT</div>
                <div style={modalTitle}>Today’s accountable output</div>
                <div style={modalSubtitle}>
                  Choose Packing or Dispatch, then click a user to inspect the exact records behind the count.
                </div>
              </div>
              <button type="button" onClick={close} style={closeButton} aria-label="Close">×</button>
            </div>

            <div style={typeSwitch}>
              <button
                type="button"
                style={typeButton(type === "packing", "#2563eb")}
                onClick={() => chooseType("packing")}
              >
                Packing Today <strong>{n(totals.packing)}</strong>
              </button>
              <button
                type="button"
                style={typeButton(type === "dispatch", "#0f766e")}
                onClick={() => chooseType("dispatch")}
              >
                Dispatch Items Today <strong>{n(totals.dispatch)}</strong>
              </button>
            </div>

            {error && <div style={errorBox}>{error}</div>}

            <div style={modalBody}>
              <div style={userColumn}>
                <div style={columnTitle}>User contribution</div>
                {loading && <div style={empty}>Loading users…</div>}
                {!loading && !error && sortedRows.length === 0 && (
                  <div style={empty}>No user throughput recorded today.</div>
                )}
                {!loading &&
                  sortedRows.map((row) => {
                    const username = actorName(row);
                    const active = selectedUser === username;
                    return (
                      <button
                        key={`${username}-${actorCount(row)}`}
                        type="button"
                        onClick={() => inspectUser(row)}
                        style={userRow(active)}
                      >
                        <div>
                          <div style={userName}>{username}</div>
                          <div style={userHint}>Inspect exact records</div>
                        </div>
                        <strong style={userCount}>{actorCount(row)}</strong>
                      </button>
                    );
                  })}
              </div>

              <div style={traceColumn}>
                <div style={columnTitle}>
                  {selectedUser ? `${selectedUser} • record detail` : "Record detail"}
                </div>
                {!selectedUser && <div style={empty}>Select a user from the left.</div>}
                {traceLoading && <div style={empty}>Loading exact records…</div>}
                {traceError && <div style={errorBox}>{traceError}</div>}
                {!traceLoading && selectedUser && !traceError && traceRows.length === 0 && (
                  <div style={empty}>No matching trace rows were returned for this user today.</div>
                )}
                {!traceLoading && traceRows.length > 0 && (
                  <div style={traceList}>
                    {traceRows.map((row, index) => (
                      <div
                        key={row?.id || row?.packetItemId || `${selectedUser}-${index}`}
                        style={traceCard}
                      >
                        <div style={traceHead}>
                          <strong>
                            {row?.itemName || row?.name || row?.description || "Operational record"}
                          </strong>
                          <span>{row?.status || row?.action || row?.eventType || "—"}</span>
                        </div>
                        <div style={traceMeta}>
                          <span>Packet <b>{row?.packetNumber || row?.packetNo || "—"}</b></span>
                          <span>SKU <b>{row?.sku || row?.codeSku || "—"}</b></span>
                          <span>PD <b>{row?.pdNo || "—"}</b></span>
                          <span>DWG <b>{row?.drawingNo || row?.dwgNo || "—"}</b></span>
                          <span>Description <b>{row?.description || row?.itemDescription || "—"}</b></span>
                          <span>Client <b>{row?.clientName || row?.client || "—"}</b></span>
                          <span>Plant <b>{row?.plantCode || row?.plant || "—"}</b></span>
                          <span>Sticker <b>{row?.stickerNumber || "—"}</b></span>
                          <span>Challan <b>{row?.challanNumber || row?.chalaanNumber || "—"}</b></span>
                        </div>
                        <div style={traceFooter}>
                          <span>
                            {row?.packedBy || row?.dispatchedBy || row?.generatedBy || row?.createdBy || selectedUser}
                          </span>
                          <span>{formatDateTime(traceTimestamp(row))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const legacyGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
};

const metricCard = {
  position: "relative",
  width: "100%",
  minWidth: 0,
  minHeight: 118,
  padding: 14,
  overflow: "hidden",
  borderRadius: 12,
  border: "1px solid var(--pf-border)",
  background: "var(--pf-surface)",
  boxShadow: "0 6px 20px rgba(var(--pf-shadow-rgb),.05)",
  color: "var(--pf-text-strong)",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

const metricAccent = {
  position: "absolute",
  inset: "0 auto 0 0",
  width: 3,
  background: "#06b6d4",
};
const metricTop = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const metricLabel = { color: "var(--pf-text-muted)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" };
const metricSignal = { padding: "3px 6px", borderRadius: 6, color: "#0891b2", background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.18)", fontSize: 7.5, fontWeight: 950, letterSpacing: ".05em" };
const metricValue = { marginTop: 10, fontSize: 28, lineHeight: 1, fontWeight: 950, letterSpacing: "-.04em" };
const metricDetail = { marginTop: 8, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700, lineHeight: 1.45 };
const inspectHint = { marginTop: 7, color: "#0891b2", fontSize: 8.5, fontWeight: 900 };

const overlay = { position: "fixed", inset: 0, zIndex: 18000, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(2,6,23,.72)", backdropFilter: "blur(8px)" };
const modal = { width: "min(1180px,96vw)", height: "min(86vh,820px)", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "var(--pf-surface)", color: "var(--pf-text-strong)", border: "1px solid var(--pf-border)", boxShadow: "0 30px 80px rgba(2,6,23,.42)" };
const modalHeader = { padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", borderBottom: "1px solid var(--pf-border-soft)" };
const eyebrow = { color: "#2563eb", fontSize: 8, fontWeight: 950, letterSpacing: ".13em" };
const modalTitle = { marginTop: 5, fontSize: 22, fontWeight: 950 };
const modalSubtitle = { maxWidth: 760, marginTop: 5, color: "var(--pf-text-muted)", fontSize: 11, fontWeight: 650, lineHeight: 1.45 };
const closeButton = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontSize: 22 };
const typeSwitch = { flexShrink: 0, display: "flex", gap: 7, padding: "10px 14px", borderBottom: "1px solid var(--pf-border-soft)", background: "var(--pf-surface-alt)", flexWrap: "wrap" };
const typeButton = (active, accent) => ({ minHeight: 36, padding: "0 12px", borderRadius: 9, border: active ? `1px solid ${accent}55` : "1px solid var(--pf-border-soft)", background: active ? `${accent}12` : "var(--pf-surface)", color: active ? accent : "var(--pf-text)", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 850, display: "flex", alignItems: "center", gap: 8 });
const modalBody = { minHeight: 0, flex: 1, display: "grid", gridTemplateColumns: "minmax(250px,330px) minmax(0,1fr)", overflow: "hidden" };
const userColumn = { minHeight: 0, overflow: "auto", padding: 14, borderRight: "1px solid var(--pf-border-soft)" };
const traceColumn = { minHeight: 0, overflow: "auto", padding: 14 };
const columnTitle = { marginBottom: 10, color: "var(--pf-text-muted)", fontSize: 9, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" };
const userRow = (active) => ({ width: "100%", minHeight: 58, marginBottom: 7, padding: "10px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left", borderRadius: 10, border: active ? "1px solid rgba(37,99,235,.35)" : "1px solid var(--pf-border-soft)", background: active ? "rgba(37,99,235,.08)" : "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit" });
const userName = { fontSize: 12, fontWeight: 900 };
const userHint = { marginTop: 3, color: "var(--pf-text-muted)", fontSize: 9 };
const userCount = { minWidth: 34, textAlign: "right", fontSize: 19, fontWeight: 950, color: "#2563eb" };
const traceList = { display: "grid", gap: 8 };
const traceCard = { padding: 12, borderRadius: 11, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const traceHead = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11 };
const traceMeta = { marginTop: 9, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: "7px 12px", color: "var(--pf-text-muted)", fontSize: 9.5 };
const traceFooter = { marginTop: 10, paddingTop: 8, display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--pf-border-soft)", color: "var(--pf-text-dim)", fontSize: 9 };
const empty = { padding: 24, textAlign: "center", color: "var(--pf-text-muted)", fontSize: 11, fontWeight: 700 };
const errorBox = { margin: 12, padding: 10, borderRadius: 9, color: "#b91c1c", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.18)", fontSize: 10, fontWeight: 800 };
