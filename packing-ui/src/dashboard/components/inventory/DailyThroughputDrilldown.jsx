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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

function DailyCard({ title, value, detail, accent, onClick, loading }) {
  return (
    <button type="button" onClick={onClick} style={card(accent)}>
      <div style={cardTop}>
        <span style={cardLabel}>{title}</span>
        <span style={cardAction}>Inspect →</span>
      </div>
      <div style={cardValue}>{loading ? "…" : value}</div>
      <div style={cardDetail}>{detail}</div>
    </button>
  );
}

export default function DailyThroughputDrilldown() {
  const [type, setType] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [traceRows, setTraceRows] = useState([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState("");

  const [totals, setTotals] = useState({ packing: null, dispatch: null });
  const [cachedRows, setCachedRows] = useState({ packing: [], dispatch: [] });

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      fetchDailyThroughputUsers("packing"),
      fetchDailyThroughputUsers("dispatch"),
    ]).then(([packingResult, dispatchResult]) => {
      if (!active) return;

      const packingRows = packingResult.status === "fulfilled" && Array.isArray(packingResult.value)
        ? packingResult.value
        : [];
      const dispatchRows = dispatchResult.status === "fulfilled" && Array.isArray(dispatchResult.value)
        ? dispatchResult.value
        : [];

      setCachedRows({ packing: packingRows, dispatch: dispatchRows });
      setTotals({
        packing: packingRows.reduce((sum, row) => sum + actorCount(row), 0),
        dispatch: dispatchRows.reduce((sum, row) => sum + actorCount(row), 0),
      });
    });

    return () => { active = false; };
  }, []);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => actorCount(b) - actorCount(a) || actorName(a).localeCompare(actorName(b))
      ),
    [rows]
  );

  const openType = async (nextType) => {
    setType(nextType);
    setRows([]);
    setSelectedUser("");
    setTraceRows([]);
    setTraceError("");
    setError("");
    const alreadyLoaded = totals[nextType] !== null;
    if (alreadyLoaded) {
      setRows(cachedRows[nextType] || []);
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
        limit: 300,
        offset: 0,
      });

      const candidates = [
        data,
        data?.rows,
        data?.content,
        data?.data,
        data?.items,
      ];
      const found = candidates.find(Array.isArray) || [];
      const usernameKey = username.trim().toLowerCase();
      const exactRows = found.filter((record) => {
        const actors = type === "packing"
          ? [record?.packedBy, record?.generatedBy, record?.createdBy, record?.username, record?.actor]
          : [record?.dispatchedBy, record?.generatedBy, record?.createdBy, record?.username, record?.actor];

        return actors.some((value) => String(value || "").trim().toLowerCase() === usernameKey);
      });

      setTraceRows(exactRows);
    } catch (requestError) {
      setTraceError(requestError?.message || "Unable to load the exact records for this user.");
    } finally {
      setTraceLoading(false);
    }
  };

  const close = () => {
    setType("");
    setRows([]);
    setSelectedUser("");
    setTraceRows([]);
    setError("");
    setTraceError("");
  };

  return (
    <>
      <div style={grid}>
        <DailyCard
          title="Packing Today"
          value={totals.packing ?? "View"}
          detail="User-wise packet/sticker execution • click to inspect"
          accent="#2563eb"
          onClick={() => openType("packing")}
          loading={loading && type === "packing"}
        />
        <DailyCard
          title="Dispatch Items Today"
          value={totals.dispatch ?? "View"}
          detail="User-wise dispatched item output • click to inspect"
          accent="#0f766e"
          onClick={() => openType("dispatch")}
          loading={loading && type === "dispatch"}
        />
      </div>

      {type && (
        <div style={overlay} onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <div style={eyebrow}>ADMIN • DAILY THROUGHPUT</div>
                <div style={modalTitle}>
                  {type === "packing" ? "Packing Today" : "Dispatch Items Today"}
                </div>
                <div style={modalSubtitle}>
                  Click a person to inspect the exact records contributing to today’s output.
                </div>
              </div>
              <button type="button" onClick={close} style={closeButton}>×</button>
            </div>

            {error && <div style={errorBox}>{error}</div>}

            <div style={modalBody}>
              <div style={userColumn}>
                <div style={columnTitle}>User contribution</div>
                {loading && <div style={empty}>Loading users…</div>}
                {!loading && !error && sortedRows.length === 0 && (
                  <div style={empty}>No user throughput recorded today.</div>
                )}
                {!loading && sortedRows.map((row) => {
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
                      <div key={row?.id || row?.packetItemId || `${selectedUser}-${index}`} style={traceCard}>
                        <div style={traceHead}>
                          <strong>{row?.itemName || row?.name || row?.description || "Operational record"}</strong>
                          <span>{row?.status || row?.action || row?.eventType || "—"}</span>
                        </div>
                        <div style={traceMeta}>
                          <span>Packet <b>{row?.packetNumber || row?.packetNo || "—"}</b></span>
                          <span>SKU <b>{row?.sku || row?.codeSku || "—"}</b></span>
                          <span>PD <b>{row?.pdNo || "—"}</b></span>
                          <span>DWG <b>{row?.drawingNo || row?.dwgNo || "—"}</b></span>
                          <span>Client <b>{row?.clientName || row?.client || "—"}</b></span>
                          <span>Plant <b>{row?.plantCode || row?.plant || "—"}</b></span>
                          <span>Sticker <b>{row?.stickerNumber || "—"}</b></span>
                          <span>Challan <b>{row?.challanNumber || row?.chalaanNumber || "—"}</b></span>
                        </div>
                        <div style={traceFooter}>
                          <span>{row?.packedBy || row?.dispatchedBy || row?.generatedBy || row?.createdBy || selectedUser}</span>
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

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 };
const card = (accent) => ({ minHeight: 110, padding: 14, textAlign: "left", borderRadius: 12, border: `1px solid ${accent}28`, background: `linear-gradient(135deg,${accent}0D,var(--pf-surface))`, color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit" });
const cardTop = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const cardLabel = { fontSize: 10, fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase" };
const cardAction = { fontSize: 9, fontWeight: 900, color: "#2563eb" };
const cardValue = { marginTop: 12, fontSize: 28, fontWeight: 950, lineHeight: 1 };
const cardDetail = { marginTop: 8, fontSize: 9.5, color: "var(--pf-text-muted)", fontWeight: 700, lineHeight: 1.45 };
const overlay = { position: "fixed", inset: 0, zIndex: 1800, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(2,6,23,.68)", backdropFilter: "blur(6px)" };
const modal = { width: "min(1180px,96vw)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "var(--pf-surface)", color: "var(--pf-text-strong)", border: "1px solid var(--pf-border)", boxShadow: "0 30px 80px rgba(2,6,23,.38)" };
const modalHeader = { padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", borderBottom: "1px solid var(--pf-border-soft)" };
const eyebrow = { color: "#2563eb", fontSize: 8, fontWeight: 950, letterSpacing: ".13em" };
const modalTitle = { marginTop: 5, fontSize: 22, fontWeight: 950 };
const modalSubtitle = { marginTop: 5, color: "var(--pf-text-muted)", fontSize: 11, fontWeight: 650 };
const closeButton = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontSize: 22 };
const modalBody = { minHeight: 0, flex: 1, display: "grid", gridTemplateColumns: "minmax(250px,330px) minmax(0,1fr)", gap: 0, overflow: "hidden" };
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
