import { useEffect, useMemo, useState } from "react";

import {
  fetchSiteEvidenceBlob,
  fetchSiteLifecycleRegister,
} from "../../api/siteLifecycleApi";

import {
  fetchUtlOriginMetadataForRows,
  getPackFlowPlantDisplayLabel,
  getPackFlowSkuDisplayValue,
} from "../../../utils/utlOriginDisplay";

const clean = (value) => String(value ?? "").trim();
const statusLabel = (value) => clean(value || "AWAITING_DELIVERY").replaceAll("_", " ");

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const raw = String(value).trim();
    const local = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    const date = local
      ? new Date(
          Number(local[1]),
          Number(local[2]) - 1,
          Number(local[3]),
          Number(local[4]),
          Number(local[5]),
          Number(local[6] || 0)
        )
      : new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return String(value);
  }
};

const siteTone = (status) => {
  const value = clean(status).toUpperCase();
  if (value === "OPENED_ON_SITE") return { fg: "#7c3aed", bg: "rgba(124,58,237,.10)", bd: "rgba(124,58,237,.22)" };
  if (value === "DELIVERED") return { fg: "#059669", bg: "rgba(5,150,105,.10)", bd: "rgba(5,150,105,.22)" };
  return { fg: "#d97706", bg: "rgba(217,119,6,.10)", bd: "rgba(217,119,6,.22)" };
};

export default function SiteDeliveryRegister({
  showAlert = () => {},
  liveRefreshToken = null,
}) {
  const [rows, setRows] = useState([]);
  const [utlOriginMetadata, setUtlOriginMetadata] = useState({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("");
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState(null);
  const [evidenceUrls, setEvidenceUrls] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(0);
      setSearch(searchDraft.trim());
    }, 260);
    return () => window.clearTimeout(id);
  }, [searchDraft]);

  const load = async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const result = await fetchSiteLifecycleRegister({ page, size: pageSize, search, plant });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);

      /* Presentation-only UTL origin lookup; routing/security still uses physical plantCode. */
      void fetchUtlOriginMetadataForRows(result.rows)
        .then((metadata) => setUtlOriginMetadata(metadata || {}))
        .catch(() => setUtlOriginMetadata({}));
    } catch (error) {
      if (!background) showAlert(error?.message || "Site delivery register failed", "error");
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, plant]);

  useEffect(() => {
    if (liveRefreshToken === null || liveRefreshToken === undefined) return;
    void load({ background: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRefreshToken]);

  const plants = useMemo(
    () => Array.from(new Set(rows.map((row) => clean(row?.plantCode)).filter(Boolean))).sort(),
    [rows]
  );

  const visibleRows = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((row) => clean(row?.siteStatus).toUpperCase() === status);
  }, [rows, status]);

  const pageSummary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const value = clean(row?.siteStatus).toUpperCase() || "AWAITING_DELIVERY";
        if (value === "OPENED_ON_SITE") acc.opened += 1;
        else if (value === "DELIVERED") acc.delivered += 1;
        else acc.awaiting += 1;
        acc.photos += Number(row?.deliveryPhotoCount || 0) + Number(row?.openingPhotoCount || 0);
        return acc;
      },
      { awaiting: 0, delivered: 0, opened: 0, photos: 0 }
    );
  }, [rows]);

  const closeDetail = () => {
    evidenceUrls.forEach((url) => URL.revokeObjectURL(url));
    setEvidenceUrls([]);
    setDetail(null);
  };

  const openDetail = async (row) => {
    evidenceUrls.forEach((url) => URL.revokeObjectURL(url));
    setEvidenceUrls([]);
    setDetail(row);
    const ids = Array.isArray(row?.evidenceIds) ? row.evidenceIds : [];
    if (ids.length === 0) return;

    try {
      setEvidenceLoading(true);
      const blobs = await Promise.all(ids.map((id) => fetchSiteEvidenceBlob(id)));
      setEvidenceUrls(blobs.map((blob) => URL.createObjectURL(blob)));
    } catch (error) {
      showAlert(error?.message || "Evidence photos could not be loaded", "error");
    } finally {
      setEvidenceLoading(false);
    }
  };

  useEffect(() => () => evidenceUrls.forEach((url) => URL.revokeObjectURL(url)), [evidenceUrls]);

  return (
    <div style={wrap}>
      <div style={hero}>
        <div>
          <div style={eyebrow}>PHYSICAL SITE PROOF</div>
          <div style={title}>Delivery & On-site Opening</div>
          <div style={subtitle}>
            Packet-level QR proof chain: dispatch → driver photo/GPS delivery → site opening scan.
            Factory dispatch status remains intact while site evidence is tracked independently.
          </div>
        </div>
        <button type="button" style={refreshButton} onClick={() => load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div style={summaryGrid}>
        <Summary label="Awaiting Delivery" value={pageSummary.awaiting} detail="Visible page" accent="#d97706" />
        <Summary label="Delivered" value={pageSummary.delivered} detail="QR + photo + GPS" accent="#059669" />
        <Summary label="Opened On Site" value={pageSummary.opened} detail="Second QR verification" accent="#7c3aed" />
        <Summary label="Evidence Photos" value={pageSummary.photos} detail={`${totalElements} matching dispatched packets`} accent="#2563eb" />
      </div>

      <div style={toolbar}>
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search challan, item, packet, client, driver, vehicle…"
          style={{ ...input, flex: "1 1 360px" }}
        />
        <select value={plant} onChange={(event) => { setPlant(event.target.value); setPage(0); }} style={input}>
          <option value="">All plants</option>
          {plants.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={input}>
          <option value="ALL">All site states</option>
          <option value="AWAITING_DELIVERY">Awaiting Delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="OPENED_ON_SITE">Opened On Site</option>
        </select>
        <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} style={input}>
          {[25, 50, 100].map((value) => <option key={value} value={value}>{value} / page</option>)}
        </select>
      </div>

      <div style={tableShell}>
        <div style={tableHead}>
          <div>Site state</div><div>Packet / item</div><div>Client / plant</div><div>Challan</div>
          <div>Driver / vehicle</div><div>Site timeline</div><div>Evidence</div>
        </div>
        {loading && rows.length === 0 ? <div style={empty}>Loading site delivery proof…</div> : null}
        {!loading && visibleRows.length === 0 ? <div style={empty}>No matching site lifecycle rows.</div> : null}
        {visibleRows.map((row) => {
          const tone = siteTone(row?.siteStatus);
          return (
            <button key={row?.zohoItemId || row?.packetItemId} type="button" style={tableRow} onClick={() => openDetail(row)}>
              <div><span style={{ ...chip, color: tone.fg, background: tone.bg, borderColor: tone.bd }}>{statusLabel(row?.siteStatus)}</span></div>
              <div><strong style={strong}>{row?.itemName || "—"}</strong><div style={muted}>{row?.packetNumber || row?.stickerNumber || "—"} • PD {row?.pdNo || "—"} • SKU {getPackFlowSkuDisplayValue(row) || "—"}</div></div>
              <div><strong style={strong}>{row?.clientName || "—"}</strong><div style={muted}>{getPackFlowPlantDisplayLabel(row, utlOriginMetadata)}</div></div>
              <div><strong style={strong}>{row?.challanNumber || "—"}</strong><div style={muted}>{formatDateTime(row?.dispatchedAt)}</div></div>
              <div><strong style={strong}>{row?.driverName || "Unassigned"}</strong><div style={muted}>{row?.vehicleNumber || "No vehicle"}</div></div>
              <div><div style={muted}>Delivered: {formatDateTime(row?.deliveredAt)}</div><div style={muted}>Opened: {formatDateTime(row?.openedAt)}</div></div>
              <div><strong style={strong}>{Number(row?.deliveryPhotoCount || 0) + Number(row?.openingPhotoCount || 0)} photo(s)</strong><div style={linkHint}>Inspect proof →</div></div>
            </button>
          );
        })}
      </div>

      <div style={pagination}>
        <button type="button" style={pagerButton} disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
        <span>Page {page + 1} of {totalPages} • {totalElements} packets</span>
        <button type="button" style={pagerButton} disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      {detail ? (
        <div style={overlay} onMouseDown={(event) => event.target === event.currentTarget && closeDetail()}>
          <div style={modal}>
            <div style={modalHead}>
              <div><div style={eyebrow}>SITE PROOF INSPECTION</div><div style={modalTitle}>{detail.itemName || "Packet"}</div><div style={muted}>{detail.challanNumber || "—"} • {detail.packetNumber || detail.stickerNumber || "—"}</div></div>
              <button type="button" style={closeButton} onClick={closeDetail}>×</button>
            </div>
            <div style={detailGrid}>
              <Detail label="Site Status" value={statusLabel(detail.siteStatus)} />
              <Detail label="Delivered At" value={formatDateTime(detail.deliveredAt)} />
              <Detail label="Delivered By" value={detail.deliveredBy} />
              <Detail label="Receiver" value={[detail.receiverName, detail.receiverPhone].filter(Boolean).join(" • ")} />
              <Detail label="Delivery GPS" value={formatGps(detail.deliveryLatitude, detail.deliveryLongitude, detail.deliveryAccuracy)} />
              <Detail label="Opened At" value={formatDateTime(detail.openedAt)} />
              <Detail label="Opened By" value={detail.openedBy} />
              <Detail label="Opening GPS" value={formatGps(detail.openingLatitude, detail.openingLongitude, detail.openingAccuracy)} />
              <Detail label="Delivery Remarks" value={detail.deliveryRemarks} wide />
              <Detail label="Opening Remarks" value={detail.openingRemarks} wide />
            </div>
            <div style={photoSection}>
              <div style={sectionTitle}>Evidence photos</div>
              {evidenceLoading ? <div style={muted}>Loading protected evidence…</div> : null}
              {!evidenceLoading && evidenceUrls.length === 0 ? <div style={muted}>No stored photo evidence.</div> : null}
              <div style={photoGrid}>{evidenceUrls.map((url, index) => <img key={url} src={url} alt={`Site evidence ${index + 1}`} style={photo} />)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value, detail, accent }) {
  return <div style={summaryCard}><div style={{ ...summaryAccent, background: accent }} /><div style={summaryLabel}>{label}</div><div style={summaryValue}>{value}</div><div style={muted}>{detail}</div></div>;
}

function Detail({ label, value, wide = false }) {
  return <div style={{ ...detailCard, ...(wide ? { gridColumn: "1 / -1" } : {}) }}><div style={summaryLabel}>{label}</div><div style={detailValue}>{value || "—"}</div></div>;
}

function formatGps(lat, lon, accuracy) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return "—";
  const acc = Number(accuracy);
  return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}${Number.isFinite(acc) ? ` • ±${Math.round(acc)} m` : ""}`;
}

const wrap = { minWidth: 0 };
const hero = { padding: 18, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap", borderRadius: 15, background: "linear-gradient(135deg,var(--pf-surface),var(--pf-surface-alt))", border: "1px solid var(--pf-border)", boxShadow: "0 8px 24px rgba(var(--pf-shadow-rgb),.05)" };
const eyebrow = { color: "#2563eb", fontSize: 8.5, fontWeight: 950, letterSpacing: ".13em" };
const title = { marginTop: 5, color: "var(--pf-text-strong)", fontSize: 25, fontWeight: 950, letterSpacing: "-.035em" };
const subtitle = { maxWidth: 880, marginTop: 6, color: "var(--pf-text-muted)", fontSize: 11, fontWeight: 650, lineHeight: 1.55 };
const refreshButton = { minHeight: 38, padding: "0 14px", borderRadius: 9, border: "1px solid rgba(37,99,235,.24)", background: "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 900 };
const summaryGrid = { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 };
const summaryCard = { position: "relative", overflow: "hidden", padding: 13, borderRadius: 11, background: "var(--pf-surface)", border: "1px solid var(--pf-border)" };
const summaryAccent = { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 };
const summaryLabel = { color: "var(--pf-text-muted)", fontSize: 8.2, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".07em" };
const summaryValue = { marginTop: 6, color: "var(--pf-text-strong)", fontSize: 25, fontWeight: 950 };
const toolbar = { marginTop: 10, padding: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderRadius: 11, background: "var(--pf-surface)", border: "1px solid var(--pf-border)" };
const input = { minHeight: 38, padding: "0 11px", borderRadius: 8, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", fontFamily: "inherit", fontSize: 10.5, fontWeight: 750, outline: "none" };
const tableShell = { marginTop: 10, overflowX: "auto", borderRadius: 12, border: "1px solid var(--pf-border)", background: "var(--pf-surface)" };
const tableHead = { minWidth: 1180, display: "grid", gridTemplateColumns: "150px 240px 190px 170px 170px 220px 140px", gap: 0, padding: "10px 12px", color: "var(--pf-text-muted)", background: "var(--pf-surface-alt)", fontSize: 8.5, fontWeight: 950, letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid var(--pf-border)" };
const tableRow = { minWidth: 1180, width: "100%", display: "grid", gridTemplateColumns: "150px 240px 190px 170px 170px 220px 140px", gap: 0, padding: "12px", textAlign: "left", border: 0, borderBottom: "1px solid var(--pf-border-soft)", background: "transparent", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit" };
const chip = { display: "inline-flex", padding: "5px 7px", borderRadius: 7, border: "1px solid", fontSize: 8.5, fontWeight: 950, letterSpacing: ".04em" };
const strong = { color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 900 };
const muted = { marginTop: 3, color: "var(--pf-text-muted)", fontSize: 9.2, fontWeight: 650, lineHeight: 1.4 };
const linkHint = { marginTop: 4, color: "#2563eb", fontSize: 8.5, fontWeight: 900 };
const empty = { padding: 30, textAlign: "center", color: "var(--pf-text-muted)", fontSize: 11, fontWeight: 750 };
const pagination = { padding: "10px 2px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 750 };
const pagerButton = { minHeight: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--pf-border)", background: "var(--pf-surface)", color: "var(--pf-text-strong)", cursor: "pointer", fontFamily: "inherit", fontSize: 9.5, fontWeight: 850 };
const overlay = { position: "fixed", inset: 0, zIndex: 18000, display: "grid", placeItems: "center", padding: 20, background: "rgba(2,6,23,.72)", backdropFilter: "blur(8px)" };
const modal = { width: "min(980px,calc(100vw - 32px))", maxHeight: "88vh", overflow: "auto", borderRadius: 16, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", boxShadow: "0 30px 90px rgba(2,6,23,.45)" };
const modalHead = { padding: 18, display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--pf-border)" };
const modalTitle = { marginTop: 5, color: "var(--pf-text-strong)", fontSize: 21, fontWeight: 950 };
const closeButton = { width: 36, height: 36, borderRadius: 9, border: "1px solid var(--pf-border)", background: "var(--pf-surface-alt)", color: "var(--pf-text-strong)", cursor: "pointer", fontSize: 22 };
const detailGrid = { padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 };
const detailCard = { padding: 11, borderRadius: 9, background: "var(--pf-surface-alt)", border: "1px solid var(--pf-border-soft)" };
const detailValue = { marginTop: 5, color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 800, overflowWrap: "anywhere" };
const photoSection = { padding: "0 16px 18px" };
const sectionTitle = { marginBottom: 9, color: "var(--pf-text-strong)", fontSize: 13, fontWeight: 950 };
const photoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9 };
const photo = { width: "100%", height: 200, objectFit: "cover", borderRadius: 10, border: "1px solid var(--pf-border)" };
