import {
  useEffect,
  useMemo,
  useState,
} from "react";

const IST_OFFSET_MINUTES = 330;

const ITEMS_PER_PAGE = 4;

const ACTION_LABELS = {
  "ITEM PACKED": "Item Packed",
  "STICKER REPRINTED": "Sticker Reprinted",
  "STICKER HISTORY REBUILT": "Sticker History Rebuilt",
  "DISPATCHED": "Item Dispatched",
  "WAREHOUSE REQUESTED": "Warehouse Requested",
  "WAREHOUSE APPROVED": "Warehouse Approved",
  "WAREHOUSE REJECTED": "Warehouse Rejected",
  "RESTORE REQUESTED": "Restore Requested",
  "RESTORE APPROVED": "Restore Approved",
  "RESTORE REJECTED": "Restore Rejected",
  "RETURN APPROVED": "Return Approved",
  "RETURN REJECTED": "Return Rejected",
  "MOVED TO FG": "Moved To FG",
  "PLANT LOCATION ASSIGNED": "Plant Location Assigned",
};

function parseServerDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value === "number") {
    const date =
      new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  /*
   * Handles Jackson array style:
   * [2026, 7, 4, 13, 22, 10]
   */
  if (Array.isArray(value) && value.length >= 3) {
    const utcMs =
      Date.UTC(
        Number(value[0]),
        Number(value[1]) - 1,
        Number(value[2]),
        Number(value[3] || 0),
        Number(value[4] || 0),
        Number(value[5] || 0)
      ) -
      IST_OFFSET_MINUTES * 60 * 1000;

    const date =
      new Date(utcMs);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const raw =
    String(value)
      .trim()
      .replace(" ", "T");

  if (!raw) {
    return null;
  }

  /*
   * If backend sends:
   * 2026-07-04T13:22:10+05:30
   * or
   * 2026-07-04T07:52:10Z
   *
   * Browser can parse it correctly.
   */
  const hasTimezone =
    /[zZ]$/.test(raw) ||
    /[+-]\d{2}:?\d{2}$/.test(raw);

  if (hasTimezone) {
    const date =
      new Date(raw);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  /*
   * Backend LocalDateTime without offset:
   * 2026-07-04T13:22:10
   *
   * This is India local time in our app.
   * Convert IST local timestamp into a real JS Date instant.
   */
  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?$/
    );

  if (!match) {
    const fallback =
      new Date(raw);

    return Number.isNaN(fallback.getTime())
      ? null
      : fallback;
  }

  const utcMs =
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    ) -
    IST_OFFSET_MINUTES * 60 * 1000;

  const date =
    new Date(utcMs);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function getActivityTime(log) {
  return (
    log?.createdAt ||
    log?.created_at ||
    log?.performedAt ||
    log?.performed_at ||
    log?.timestamp ||
    log?.time ||
    null
  );
}

function getItemName(log) {
  return (
    log?.itemName ||
    log?.masterItemName ||
    log?.name ||
    log?.productName ||
    log?.sku ||
    log?.zohoItemId ||
    "Unknown Item"
  );
}

function normalizeText(value, fallback = "") {
  const text =
    String(value ?? "")
      .trim();

  return text || fallback;
}

function normalizeActionLabel(action = "") {
  const value =
    String(action || "")
      .trim();

  if (!value) {
    return "Activity";
  }

  const upper =
    value.toUpperCase();

  if (ACTION_LABELS[upper]) {
    return ACTION_LABELS[upper];
  }

  const lower =
    value.toLowerCase();

  if (lower.includes("item packed")) {
    return "Item Packed";
  }

  if (lower.includes("sticker reprinted")) {
    return "Sticker Reprinted";
  }

  if (lower.includes("sticker")) {
    return "Sticker Activity";
  }

  if (lower === "dispatched") {
    return "Item Dispatched";
  }

  if (lower.includes("ready_to_dispatch")) {
    return "Ready To Dispatch";
  }

  if (lower.includes("warehouse approved")) {
    return "Warehouse Approved";
  }

  if (lower.includes("warehouse requested")) {
    return "Warehouse Requested";
  }

  return value
    .replaceAll("_", " ")
    .replaceAll("→", " → ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function activityMeta(action = "", role = "") {
  const value =
    `${action} ${role}`.toLowerCase();

  if (
    value.includes("item packed") ||
    value.includes("sticker") ||
    value.includes("packing")
  ) {
    return {
      icon: "📦",
      label: "Packing",
      accent: "#34d399",
      soft: "rgba(52,211,153,.13)",
      border: "rgba(52,211,153,.28)",
    };
  }

  if (
    value.includes("dispatch") ||
    value.includes("chalaan") ||
    value.includes("challan")
  ) {
    return {
      icon: "🚚",
      label: "Dispatch",
      accent: "#f59e0b",
      soft: "rgba(245,158,11,.13)",
      border: "rgba(245,158,11,.28)",
    };
  }

  if (value.includes("warehouse")) {
    return {
      icon: "🏬",
      label: "Warehouse",
      accent: "#60a5fa",
      soft: "rgba(96,165,250,.13)",
      border: "rgba(96,165,250,.28)",
    };
  }

  if (value.includes("restore")) {
    return {
      icon: "↩️",
      label: "Restore",
      accent: "#a78bfa",
      soft: "rgba(167,139,250,.13)",
      border: "rgba(167,139,250,.28)",
    };
  }

  if (value.includes("return")) {
    return {
      icon: "🔁",
      label: "Return",
      accent: "#22c55e",
      soft: "rgba(34,197,94,.13)",
      border: "rgba(34,197,94,.28)",
    };
  }

  if (
    value.includes("plant") ||
    value.includes("fg") ||
    value.includes("location")
  ) {
    return {
      icon: "📍",
      label: "Location",
      accent: "#38bdf8",
      soft: "rgba(56,189,248,.13)",
      border: "rgba(56,189,248,.28)",
    };
  }

  return {
    icon: "⚙️",
    label: "Inventory",
    accent: "#38bdf8",
    soft: "rgba(56,189,248,.13)",
    border: "rgba(56,189,248,.28)",
  };
}

function formatDate(value) {
  const date =
    parseServerDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatRelativeTime(value, nowMs) {
  const date =
    parseServerDate(value);

  if (!date || !nowMs) {
    return "—";
  }

  const diffMs =
    nowMs - date.getTime();

  /*
   * Small future difference can happen because browser/server clocks
   * may differ slightly. Treat as live.
   */
  if (diffMs < 0 && Math.abs(diffMs) < 2 * 60000) {
    return "Just now";
  }

  if (diffMs < 0) {
    return "Scheduled";
  }

  const diffMin =
    Math.floor(diffMs / 60000);

  if (diffMin < 1) {
    return "Just now";
  }

  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  const diffHours =
    Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays =
    Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths =
    Math.floor(diffDays / 30);

  if (diffMonths === 1) {
    return "1 month ago";
  }

  return `${diffMonths} months ago`;
}

function initials(value = "") {
  const clean =
    String(value || "SYSTEM")
      .trim();

  if (!clean) {
    return "S";
  }

  return clean
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function statusLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .trim();
}

function ActivityFeed({
  logs = [],
}) {
  const [page, setPage] =
    useState(0);

  const [nowMs, setNowMs] =
    useState(Date.now());

  useEffect(() => {
    const updateNow = () => {
      setNowMs(Date.now());
    };

    updateNow();

    const timer =
      window.setInterval(
        updateNow,
        60000
      );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const normalizedLogs =
    useMemo(() => {
      return [...logs]
        .map((log, index) => {
          const activityTime =
            getActivityTime(log);

          const date =
            parseServerDate(activityTime);

          return {
            ...log,
            _index: index,
            _activityTime: activityTime,
            _timeMs: date
              ? date.getTime()
              : 0,
            _itemName: getItemName(log),
            _actionLabel: normalizeActionLabel(log.action),
            _performedBy: normalizeText(log.performedBy, "SYSTEM"),
            _role: normalizeText(log.role, "SYSTEM"),
            _fromStatus: normalizeText(log.fromStatus),
            _toStatus: normalizeText(log.toStatus),
            _remarks: normalizeText(log.remarks),
          };
        })
        .sort((a, b) => {
          if (b._timeMs !== a._timeMs) {
            return b._timeMs - a._timeMs;
          }

          return Number(b.id || 0) - Number(a.id || 0);
        });
    }, [logs]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(normalizedLogs.length / ITEMS_PER_PAGE)
    );

  const safePage =
    Math.min(
      page,
      totalPages - 1
    );

  useEffect(() => {
    setPage(0);
  }, [logs.length]);

  const paginatedLogs =
    useMemo(() => {
      return normalizedLogs.slice(
        safePage * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE + ITEMS_PER_PAGE
      );
    }, [normalizedLogs, safePage]);

  return (
    <div style={wrapper}>
      <div style={topBar}>
        <div>
          <div style={headingRow}>
            <span style={headingIcon}>⚡</span>

            <div>
              <div style={heading}>
                Recent Activity
              </div>

              <div style={subHeading}>
                Live packing, warehouse, location and dispatch movement
              </div>
            </div>
          </div>
        </div>

        <div style={headerRight}>
          <div style={livePill}>
            <span style={liveDot} />
            Live
          </div>

          <div style={countBadge}>
            {normalizedLogs.length}
          </div>
        </div>
      </div>

      <div style={feedArea}>
        {paginatedLogs.map((log, index) => {
          const meta =
            activityMeta(
              log.action,
              log.role
            );

          const activityTime =
            log.createdAt ||
            log.created_at ||
            log.performedAt ||
            log.performed_at ||
            log.timestamp ||
            log.time;

          const hasStatusFlow =
            log._fromStatus ||
            log._toStatus;

          return (
            <div
              key={log.id || `${activityTime}-${index}`}
              style={{
                ...activityCard,
                border: `1px solid ${meta.border}`,
              }}
            >
              <div
                style={{
                  ...leftGlow,
                  background: meta.accent,
                  boxShadow: `0 0 28px ${meta.accent}77`,
                }}
              />

              <div
                style={{
                  ...iconBubble,
                  background: meta.soft,
                  border: `1px solid ${meta.border}`,
                }}
              >
                {meta.icon}
              </div>

              <div style={contentArea}>
                <div style={actionRow}>
                  <div style={actionText}>
                    {log._actionLabel}
                  </div>

                  <div
                    style={{
                      ...typeChip,
                      color: meta.accent,
                      background: meta.soft,
                      border: `1px solid ${meta.border}`,
                    }}
                  >
                    {meta.label}
                  </div>
                </div>

                <div style={itemName}>
                  {log._itemName}
                </div>

                {hasStatusFlow && (
                  <div style={statusFlow}>
                    <span style={statusMini}>
                      {statusLabel(log._fromStatus) || "—"}
                    </span>

                    <span style={arrow}>
                      →
                    </span>

                    <span
                      style={{
                        ...statusMini,
                        color: meta.accent,
                        border: `1px solid ${meta.border}`,
                        background: meta.soft,
                      }}
                    >
                      {statusLabel(log._toStatus) || "—"}
                    </span>
                  </div>
                )}

                {log._remarks && (
                  <div style={remarks}>
                    {log._remarks}
                  </div>
                )}

                <div style={timeRow}>
                  <span
                    style={{
                      ...relativeTime,
                      color: meta.accent,
                      background: meta.soft,
                      border: `1px solid ${meta.border}`,
                    }}
                  >
                    {formatRelativeTime(activityTime, nowMs)}
                  </span>

                  <span style={absoluteTime}>
                    {formatDate(activityTime)}
                  </span>
                </div>
              </div>

              <div style={userArea}>
                <div style={userAvatar}>
                  {initials(log._performedBy)}
                </div>

                <div style={userName}>
                  {log._performedBy}
                </div>

                <div style={roleChip}>
                  {log._role}
                </div>
              </div>
            </div>
          );
        })}

        {paginatedLogs.length === 0 && (
          <div style={empty}>
            <div style={emptyIcon}>
              🕘
            </div>

            <div style={emptyTitle}>
              No recent activity yet
            </div>

            <div style={emptyText}>
              Packing, warehouse, FG movement, challan and dispatch actions will appear here.
            </div>
          </div>
        )}
      </div>

      {normalizedLogs.length > ITEMS_PER_PAGE && (
        <div style={pagination}>
          <button
            type="button"
            style={{
              ...pageBtn,
              opacity: safePage === 0 ? 0.45 : 1,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
            }}
            disabled={safePage === 0}
            onClick={() =>
              setPage((p) =>
                Math.max(0, p - 1)
              )
            }
          >
            ← Prev
          </button>

          <div style={pageIndicator}>
            Page {safePage + 1} of {totalPages}
          </div>

          <button
            type="button"
            style={{
              ...pageBtn,
              opacity: safePage >= totalPages - 1 ? 0.45 : 1,
              cursor:
                safePage >= totalPages - 1
                  ? "not-allowed"
                  : "pointer",
            }}
            disabled={safePage >= totalPages - 1}
            onClick={() =>
              setPage((p) =>
                p < totalPages - 1
                  ? p + 1
                  : p
              )
            }
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const wrapper = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  color: "#fff",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const headingRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const headingIcon = {
  width: 32,
  height: 32,
  borderRadius: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgba(37,99,235,.30), rgba(14,165,233,.14))",
  border: "1px solid rgba(96,165,250,.22)",
  boxShadow: "0 10px 22px rgba(37,99,235,.18)",
  fontSize: 15,
};

const heading = {
  fontSize: 17,
  fontWeight: 950,
  color: "#fff",
  letterSpacing: "-.02em",
};

const subHeading = {
  fontSize: 10.5,
  color: "rgba(255,255,255,.52)",
  marginTop: 3,
  fontWeight: 650,
};

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const livePill = {
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(34,197,94,.10)",
  border: "1px solid rgba(34,197,94,.20)",
  color: "#86efac",
  fontSize: 10,
  fontWeight: 950,
};

const liveDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow:
    "0 0 14px rgba(34,197,94,.8)",
};

const countBadge = {
  minWidth: 32,
  height: 32,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow: "0 10px 22px rgba(37,99,235,.26)",
  fontWeight: 950,
  fontSize: 12,
  color: "#fff",
};

const feedArea = {
  flex: 1,
  overflowY: "auto",
  paddingRight: 4,
};

const activityCard = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "34px minmax(0,1fr) 78px",
  gap: 10,
  alignItems: "center",
  padding: "11px 12px 11px 14px",
  borderRadius: 17,
  marginBottom: 9,
  background:
    "linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.022))",
  boxShadow: "0 12px 26px rgba(2,6,23,.18)",
  backdropFilter: "blur(14px)",
  overflow: "hidden",
};

const leftGlow = {
  position: "absolute",
  left: 0,
  top: 11,
  bottom: 11,
  width: 3,
  borderRadius: "0 999px 999px 0",
};

const iconBubble = {
  width: 32,
  height: 32,
  borderRadius: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
};

const contentArea = {
  minWidth: 0,
};

const actionRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const actionText = {
  fontWeight: 950,
  fontSize: 12.5,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const typeChip = {
  flex: "0 0 auto",
  padding: "3px 7px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 950,
};

const itemName = {
  marginTop: 4,
  fontSize: 11.5,
  color: "rgba(255,255,255,.72)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontWeight: 750,
};

const statusFlow = {
  marginTop: 6,
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "wrap",
};

const remarks = {
  marginTop: 7,
  maxWidth: "100%",
  color: "rgba(255,255,255,.52)",
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const timeRow = {
  marginTop: 6,
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const relativeTime = {
  padding: "3px 7px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 950,
};

const absoluteTime = {
  fontSize: 10,
  color: "rgba(255,255,255,.46)",
  fontWeight: 750,
};

const userArea = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 4,
  minWidth: 0,
};

const userAvatar = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgba(59,130,246,.24), rgba(147,197,253,.10))",
  border: "1px solid rgba(147,197,253,.20)",
  color: "#dbeafe",
  fontSize: 10,
  fontWeight: 950,
};

const statusMini = {
  maxWidth: 120,
  padding: "3px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,.045)",
  border: "1px solid rgba(255,255,255,.07)",
  color: "rgba(255,255,255,.58)",
  fontSize: 9,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusMiniActive = (meta) => ({
  ...statusMini,
  color: meta.accent,
  background: meta.soft,
  border: `1px solid ${meta.border}`,
});

const arrow = {
  color: "rgba(255,255,255,.42)",
  fontSize: 12,
  fontWeight: 900,
};

const remarksText = {
  marginTop: 7,
  maxWidth: "100%",
  color: "rgba(255,255,255,.52)",
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const userName = {
  maxWidth: 74,
  color: "#fff",
  fontSize: 9.5,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const roleChip = {
  maxWidth: 76,
  padding: "3px 6px",
  borderRadius: 999,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.62)",
  fontSize: 8,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pagination = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 9,
  marginTop: 8,
};

const pageBtn = {
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.045))",
  color: "#fff",
  fontWeight: 950,
  fontSize: 11,
};

const pageIndicator = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  fontSize: 10,
  color: "rgba(255,255,255,.62)",
  fontWeight: 950,
};

const empty = {
  minHeight: 210,
  borderRadius: 24,
  background:
    "radial-gradient(circle at top, rgba(59,130,246,.14), transparent 38%), rgba(255,255,255,.035)",
  border:
    "1px dashed rgba(255,255,255,.14)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 22,
};

const emptyIcon = {
  width: 52,
  height: 52,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "rgba(59,130,246,.14)",
  border:
    "1px solid rgba(59,130,246,.22)",
  fontSize: 24,
  marginBottom: 14,
};

const emptyTitle = {
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
};

const emptyText = {
  marginTop: 6,
  maxWidth: 340,
  fontSize: 12,
  lineHeight: 1.5,
  color: "rgba(255,255,255,.56)",
  fontWeight: 700,
};

export default ActivityFeed;