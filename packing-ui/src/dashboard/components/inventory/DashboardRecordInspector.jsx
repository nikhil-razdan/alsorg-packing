import { useEffect, useMemo, useState } from "react";
import {
  fetchDashboardTrace,
  fetchMasterItems,
} from "../../api/dashboardApi";

const PAGE_SIZE = 20;

const clean = (value) => String(value ?? "").trim();
const normalizeStatus = (value) => clean(value).toUpperCase();

const extractRows = (payload) => {
  const candidates = [
    payload,
    payload?.rows,
    payload?.content,
    payload?.data,
    payload?.items,
    payload?.results,
  ];
  return candidates.find(Array.isArray) || [];
};

const statusFromRow = (row) =>
  normalizeStatus(
    row?.status ||
      row?.movementStatus ||
      row?.dispatchStatus ||
      row?.packingStatus ||
      row?.toStatus ||
      row?.currentStatus
  );

const timestampFromRow = (row) =>
  row?.dispatchedAt ||
  row?.packedAt ||
  row?.generatedAt ||
  row?.tripStartedAt ||
  row?.createdAt ||
  row?.updatedAt ||
  null;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value) || "—";
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

const recordTitle = (row) =>
  clean(
    row?.itemName ||
      row?.name ||
      row?.masterItemName ||
      row?.description ||
      row?.challanNumber ||
      row?.chalaanNumber ||
      row?.stickerNumber ||
      row?.sku
  ) || "PackFlow record";

const searchableText = (row) => {
  try {
    return JSON.stringify(row || {}).toLowerCase();
  } catch {
    return String(row || "").toLowerCase();
  }
};

function FullRecordModal({ row, onClose }) {
  if (!row) return null;

  return (
    <div style={detailOverlay} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div style={detailModal}>
        <div style={detailHeader}>
          <div>
            <div style={eyebrow}>ADMIN • COMPLETE RECORD</div>
            <div style={detailTitle}>{recordTitle(row)}</div>
          </div>
          <button type="button" style={closeButton} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={payloadGrid}>
          {Object.entries(row)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <div key={key} style={payloadField}>
                <div style={payloadLabel}>{key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}</div>
                <div style={payloadValue}>
                  {value === null || value === undefined || value === ""
                    ? "—"
                    : typeof value === "object"
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardRecordInspector({ config, onClose }) {
  const open = Boolean(config?.open);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setRows([]);
    setError("");
    setSearch("");
    setPage(0);
    setSelectedRow(null);
    setLoading(true);

    const load = async () => {
      try {
        const payload = config?.source === "master"
          ? await fetchMasterItems({
              search: config?.search || "",
              packingStatus: config?.packingStatus || "ALL",
              page: 0,
              size: Number(config?.limit || 500),
            })
          : await fetchDashboardTrace({
              type: config?.type || "all",
              from: config?.from,
              to: config?.to,
              search: config?.search || "",
              limit: Number(config?.limit || 500),
              offset: 0,
            });

        if (!active) return;
        setRows(extractRows(payload));
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.message || "Unable to load records for this metric.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    open,
    config?.key,
    config?.source,
    config?.type,
    config?.search,
    config?.from,
    config?.to,
    config?.packingStatus,
    config?.limit,
  ]);

  const filteredRows = useMemo(() => {
    const statuses = Array.isArray(config?.statuses)
      ? config.statuses.map(normalizeStatus).filter(Boolean)
      : [];
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (statuses.length > 0 && !statuses.includes(statusFromRow(row))) {
        return false;
      }
      if (q && !searchableText(row).includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, search, config?.statuses]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, config?.key]);

  if (!open) return null;

  const accent = config?.accent || "#2563eb";

  return (
    <>
      <div style={overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
        <div style={modal} role="dialog" aria-modal="true" aria-label={config?.title || "Metric record inspector"}>
          <div style={header}>
            <div>
              <div style={{ ...eyebrow, color: accent }}>ADMIN • RECORD INSPECTOR</div>
              <div style={title}>{config?.title || "Metric Records"}</div>
              <div style={subtitle}>
                {config?.subtitle || "Exact PackFlow records returned by the existing ADMIN trace/report endpoints."}
              </div>
            </div>
            <button type="button" style={closeButton} onClick={onClose} aria-label="Close">×</button>
          </div>

          <div style={toolbar}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, packet, PD, SKU, sticker, challan, user, client, plant..."
              style={searchInput}
            />
            <div style={countBadge(accent)}>
              {loading ? "Loading…" : `${filteredRows.length} matching records`}
            </div>
          </div>

          {error && <div style={errorBox}>{error}</div>}

          <div style={body}>
            {loading && <div style={empty}>Loading exact records…</div>}
            {!loading && !error && visibleRows.length === 0 && (
              <div style={empty}>
                No matching records were returned for this metric. The summary count can come from aggregate tables that are not exposed by the trace endpoint for every category.
              </div>
            )}

            {!loading && visibleRows.length > 0 && (
              <div style={recordList}>
                {visibleRows.map((row, index) => (
                  <button
                    type="button"
                    key={row?.id || row?.packetItemId || row?.masterItemId || `${safePage}-${index}`}
                    style={recordCard(accent)}
                    onClick={() => setSelectedRow(row)}
                  >
                    <div style={recordHead}>
                      <strong style={recordName}>{recordTitle(row)}</strong>
                      <span style={statusChip(accent)}>{statusFromRow(row) || clean(row?.type) || "RECORD"}</span>
                    </div>
                    <div style={recordMeta}>
                      <span>Packet <b>{clean(row?.packetNumber || row?.packetNo) || "—"}</b></span>
                      <span>SKU <b>{clean(row?.sku || row?.codeSku) || "—"}</b></span>
                      <span>PD <b>{clean(row?.pdNo) || "—"}</b></span>
                      <span>DWG <b>{clean(row?.drawingNo || row?.dwgNo) || "—"}</b></span>
                      <span>Client <b>{clean(row?.clientName || row?.client) || "—"}</b></span>
                      <span>Plant <b>{clean(row?.plantCode || row?.plant) || "—"}</b></span>
                      <span>Sticker <b>{clean(row?.stickerNumber) || "—"}</b></span>
                      <span>Challan <b>{clean(row?.challanNumber || row?.chalaanNumber) || "—"}</b></span>
                    </div>
                    <div style={recordFooter}>
                      <span>
                        {clean(row?.packedBy || row?.dispatchedBy || row?.generatedBy || row?.createdBy || row?.updatedBy) || "—"}
                      </span>
                      <span>{formatDateTime(timestampFromRow(row))}</span>
                      <strong style={{ color: accent }}>Full record →</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={footer}>
            <div style={footerMeta}>
              Page {safePage + 1} of {totalPages} • {filteredRows.length} filtered / {rows.length} fetched
            </div>
            <div style={pager}>
              <button type="button" style={pageButton(safePage === 0)} disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>‹</button>
              <button type="button" style={pageButton(safePage >= totalPages - 1)} disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>›</button>
            </div>
          </div>
        </div>
      </div>

      <FullRecordModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </>
  );
}

const overlay = { position: "fixed", inset: 0, zIndex: 17000, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", background: "rgba(2,6,23,.72)", backdropFilter: "blur(8px)" };
const modal = { width: "min(1180px,calc(100vw - 36px))", height: "min(88vh,860px)", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))", border: "1px solid var(--pf-border)", boxShadow: "0 32px 90px rgba(2,6,23,.42)", color: "var(--pf-text-strong)" };
const header = { flexShrink: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", borderBottom: "1px solid var(--pf-border-soft)" };
const eyebrow = { fontSize: 8, fontWeight: 950, letterSpacing: ".13em" };
const title = { marginTop: 5, fontSize: 22, fontWeight: 950, letterSpacing: "-.025em" };
const subtitle = { maxWidth: 760, marginTop: 5, color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 650, lineHeight: 1.5 };
const closeButton = { width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit", fontSize: 22 };
const toolbar = { flexShrink: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", borderBottom: "1px solid var(--pf-border-soft)", background: "var(--pf-surface-alt)" };
const searchInput = { flex: "1 1 420px", minWidth: 220, height: 36, padding: "0 11px", borderRadius: 9, border: "1px solid var(--pf-border)", outline: "none", background: "var(--pf-input)", color: "var(--pf-text-strong)", fontFamily: "inherit", fontSize: 10, fontWeight: 700 };
const countBadge = (accent) => ({ minHeight: 34, padding: "0 10px", display: "flex", alignItems: "center", borderRadius: 9, color: accent, background: `${accent}0D`, border: `1px solid ${accent}22`, fontSize: 9, fontWeight: 900 });
const body = { minHeight: 0, flex: 1, overflow: "auto", padding: 14 };
const recordList = { display: "grid", gap: 8 };
const recordCard = (accent) => ({ width: "100%", minWidth: 0, padding: 12, borderRadius: 11, border: "1px solid var(--pf-border-soft)", borderLeft: `3px solid ${accent}`, background: "var(--pf-surface)", color: "var(--pf-text-strong)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" });
const recordHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const recordName = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5 };
const statusChip = (accent) => ({ flexShrink: 0, padding: "3px 7px", borderRadius: 999, color: accent, background: `${accent}0D`, border: `1px solid ${accent}22`, fontSize: 7.5, fontWeight: 950 });
const recordMeta = { marginTop: 9, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "6px 10px", color: "var(--pf-text-muted)", fontSize: 9.2 };
const recordFooter = { marginTop: 9, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--pf-border-soft)", color: "var(--pf-text-dim)", fontSize: 8.8 };
const empty = { minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", padding: 30, color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 700, lineHeight: 1.6 };
const errorBox = { margin: "10px 14px 0", padding: 10, borderRadius: 9, color: "#b91c1c", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.18)", fontSize: 10, fontWeight: 800 };
const footer = { flexShrink: 0, minHeight: 48, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--pf-border-soft)", background: "var(--pf-surface-alt)" };
const footerMeta = { color: "var(--pf-text-muted)", fontSize: 8.8, fontWeight: 750 };
const pager = { display: "flex", gap: 5 };
const pageButton = (disabled) => ({ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--pf-border)", background: "var(--pf-surface)", color: "#2563eb", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .35 : 1, fontSize: 17, fontWeight: 900 });

const detailOverlay = { position: "fixed", inset: 0, zIndex: 18000, padding: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,6,23,.82)", backdropFilter: "blur(10px)" };
const detailModal = { width: "min(1040px,calc(100vw - 44px))", height: "min(84vh,800px)", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 16, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 34px 100px rgba(0,0,0,.5)", color: "var(--pf-text-strong)" };
const detailHeader = { flexShrink: 0, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--pf-border-soft)" };
const detailTitle = { marginTop: 4, fontSize: 18, fontWeight: 950 };
const payloadGrid = { minHeight: 0, overflow: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", alignContent: "start", gap: 8 };
const payloadField = { minWidth: 0, padding: 10, borderRadius: 9, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const payloadLabel = { color: "var(--pf-text-muted)", fontSize: 7.8, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".05em" };
const payloadValue = { marginTop: 5, color: "var(--pf-text-strong)", fontSize: 9.5, fontWeight: 700, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
