import {
  useEffect,
  useMemo,
  useState,
} from "react";

const IST_OFFSET_MINUTES = 330;
const ITEMS_PER_PAGE = 3;

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
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  if (
    Array.isArray(value) &&
    value.length >= 3
  ) {
    const utcMs =
      Date.UTC(
        Number(value[0]),
        Number(value[1]) - 1,
        Number(value[2]),
        Number(value[3] || 0),
        Number(value[4] || 0),
        Number(value[5] || 0)
      ) -
      IST_OFFSET_MINUTES *
      60 *
      1000;

    const date = new Date(utcMs);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const raw =
    String(value)
      .trim()
      .replace(" ", "T");

  if (!raw) return null;

  const hasTimezone =
    /[zZ]$/.test(raw) ||
    /[+-]\d{2}:?\d{2}$/.test(
      raw
    );

  if (hasTimezone) {
    const date = new Date(raw);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
    );

  if (!match) {
    const fallback =
      new Date(raw);

    return Number.isNaN(
      fallback.getTime()
    )
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
    IST_OFFSET_MINUTES *
    60 *
    1000;

  const date = new Date(utcMs);

  return Number.isNaN(
    date.getTime()
  )
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

function normalizeText(
  value,
  fallback = ""
) {
  const text =
    String(value ?? "")
      .trim();

  return text || fallback;
}

function normalizeActionLabel(
  action = ""
) {
  const value =
    String(action || "")
      .trim();

  if (!value) return "Activity";

  const upper =
    value.toUpperCase();

  if (ACTION_LABELS[upper]) {
    return ACTION_LABELS[upper];
  }

  const lower =
    value.toLowerCase();

  if (
    lower.includes(
      "item packed"
    )
  ) {
    return "Item Packed";
  }

  if (
    lower.includes(
      "sticker reprinted"
    )
  ) {
    return "Sticker Reprinted";
  }

  if (
    lower.includes("sticker")
  ) {
    return "Sticker Activity";
  }

  if (lower === "dispatched") {
    return "Item Dispatched";
  }

  if (
    lower.includes(
      "ready_to_dispatch"
    )
  ) {
    return "Ready To Dispatch";
  }

  if (
    lower.includes(
      "warehouse approved"
    )
  ) {
    return "Warehouse Approved";
  }

  if (
    lower.includes(
      "warehouse requested"
    )
  ) {
    return "Warehouse Requested";
  }

  return value
    .replaceAll("_", " ")
    .replaceAll("→", " → ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function activityMeta(
  action = "",
  role = ""
) {
  const value =
    `${action} ${role}`
      .toLowerCase();

  if (
    value.includes(
      "item packed"
    ) ||
    value.includes("sticker") ||
    value.includes("packing")
  ) {
    return {
      icon: "✓",
      label: "Packing",
      accent: "#22c55e",
      soft:
        "rgba(34,197,94,.09)",
      border:
        "rgba(34,197,94,.18)",
    };
  }

  if (
    value.includes("dispatch") ||
    value.includes("chalaan") ||
    value.includes("challan")
  ) {
    return {
      icon: "↗",
      label: "Dispatch",
      accent: "#f97316",
      soft:
        "rgba(249,115,22,.09)",
      border:
        "rgba(249,115,22,.18)",
    };
  }

  if (
    value.includes("warehouse")
  ) {
    return {
      icon: "▣",
      label: "Warehouse",
      accent: "#38bdf8",
      soft:
        "rgba(56,189,248,.09)",
      border:
        "rgba(56,189,248,.18)",
    };
  }

  if (
    value.includes("restore")
  ) {
    return {
      icon: "↶",
      label: "Restore",
      accent: "#a78bfa",
      soft:
        "rgba(167,139,250,.09)",
      border:
        "rgba(167,139,250,.18)",
    };
  }

  if (
    value.includes("return")
  ) {
    return {
      icon: "↔",
      label: "Return",
      accent: "#14b8a6",
      soft:
        "rgba(20,184,166,.09)",
      border:
        "rgba(20,184,166,.18)",
    };
  }

  if (
    value.includes("plant") ||
    value.includes("fg") ||
    value.includes("location")
  ) {
    return {
      icon: "⌖",
      label: "Movement",
      accent: "#60a5fa",
      soft:
        "rgba(96,165,250,.09)",
      border:
        "rgba(96,165,250,.18)",
    };
  }

  return {
    icon: "•",
    label: "Inventory",
    accent: "#60a5fa",
    soft:
      "rgba(96,165,250,.08)",
    border:
      "rgba(96,165,250,.16)",
  };
}

function formatDate(value) {
  const date =
    parseServerDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  ).format(date);
}

function formatRelativeTime(
  value,
  nowMs
) {
  const date =
    parseServerDate(value);

  if (!date || !nowMs) {
    return "—";
  }

  const diffMs =
    nowMs -
    date.getTime();

  if (
    diffMs < 0 &&
    Math.abs(diffMs) <
    2 * 60000
  ) {
    return "Just now";
  }

  if (diffMs < 0) {
    return "Scheduled";
  }

  const diffMin =
    Math.floor(
      diffMs / 60000
    );

  if (diffMin < 1) {
    return "Just now";
  }

  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  const diffHours =
    Math.floor(
      diffMin / 60
    );

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays =
    Math.floor(
      diffHours / 24
    );

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths =
    Math.floor(
      diffDays / 30
    );

  return diffMonths === 1
    ? "1 month ago"
    : `${diffMonths} months ago`;
}

function initials(value = "") {
  const clean =
    String(
      value || "SYSTEM"
    ).trim();

  if (!clean) return "S";

  return clean
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .charAt(0)
        .toUpperCase()
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
      window.clearInterval(
        timer
      );
    };
  }, []);

  const normalizedLogs =
    useMemo(() => {
      return [...logs]
        .map(
          (log, index) => {
            const activityTime =
              getActivityTime(
                log
              );

            const date =
              parseServerDate(
                activityTime
              );

            return {
              ...log,
              _index: index,
              _activityTime:
                activityTime,
              _timeMs: date
                ? date.getTime()
                : 0,
              _itemName:
                getItemName(log),
              _actionLabel:
                normalizeActionLabel(
                  log.action
                ),
              _performedBy:
                normalizeText(
                  log.performedBy,
                  "SYSTEM"
                ),
              _role:
                normalizeText(
                  log.role,
                  "SYSTEM"
                ),
              _fromStatus:
                normalizeText(
                  log.fromStatus
                ),
              _toStatus:
                normalizeText(
                  log.toStatus
                ),
              _remarks:
                normalizeText(
                  log.remarks
                ),
            };
          }
        )
        .sort((a, b) => {
          if (
            b._timeMs !==
            a._timeMs
          ) {
            return (
              b._timeMs -
              a._timeMs
            );
          }

          return (
            Number(
              b.id || 0
            ) -
            Number(
              a.id || 0
            )
          );
        });
    }, [logs]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        normalizedLogs.length /
        ITEMS_PER_PAGE
      )
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
    useMemo(
      () =>
        normalizedLogs.slice(
          safePage *
          ITEMS_PER_PAGE,
          safePage *
          ITEMS_PER_PAGE +
          ITEMS_PER_PAGE
        ),
      [
        normalizedLogs,
        safePage,
      ]
    );

  return (
    <div style={wrapper}>
      <div style={feedArea}>
        {paginatedLogs.map(
          (log, index) => {
            const meta =
              activityMeta(
                log.action,
                log.role
              );

            const activityTime =
              log._activityTime;

            const hasStatusFlow =
              Boolean(
                log._fromStatus ||
                log._toStatus
              );

            return (
              <div
                key={
                  log.id ||
                  `${activityTime}-${index}`
                }
                style={activityCard}
              >
                <div
                  style={leftRail(
                    meta.accent
                  )}
                />

                <div
                  style={iconBubble(
                    meta
                  )}
                >
                  {meta.icon}
                </div>

                <div style={contentArea}>
                  <div style={actionRow}>
                    <div style={actionText}>
                      {log._actionLabel}
                    </div>

                    <span
                      style={typeChip(
                        meta
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div style={itemName}>
                    {log._itemName}
                  </div>

                  {hasStatusFlow && (
                    <div style={statusFlow}>
                      <span style={statusMini}>
                        {statusLabel(
                          log._fromStatus
                        ) || "—"}
                      </span>

                      <span style={arrow}>
                        →
                      </span>

                      <span
                        style={statusMiniActive(
                          meta
                        )}
                      >
                        {statusLabel(
                          log._toStatus
                        ) || "—"}
                      </span>
                    </div>
                  )}

                  {log._remarks && (
                    <div
                      style={remarks}
                      title={
                        log._remarks
                      }
                    >
                      {log._remarks}
                    </div>
                  )}

                  <div style={timeRow}>
                    <span
                      style={relativeTime(
                        meta
                      )}
                    >
                      {formatRelativeTime(
                        activityTime,
                        nowMs
                      )}
                    </span>

                    <span style={absoluteTime}>
                      {formatDate(
                        activityTime
                      )}
                    </span>
                  </div>
                </div>

                <div style={userArea}>
                  <div style={userAvatar}>
                    {initials(
                      log._performedBy
                    )}
                  </div>

                  <div
                    style={userName}
                    title={
                      log._performedBy
                    }
                  >
                    {log._performedBy}
                  </div>

                  <div
                    style={roleChip}
                    title={log._role}
                  >
                    {log._role}
                  </div>
                </div>
              </div>
            );
          }
        )}

        {paginatedLogs.length ===
          0 && (
            <div style={empty}>
              <div style={emptyIcon}>
                ◎
              </div>

              <div style={emptyTitle}>
                No recent activity
              </div>

              <div style={emptyText}>
                Packing, warehouse, FG movement, challan and dispatch actions will appear here.
              </div>
            </div>
          )}
      </div>

      {normalizedLogs.length >
        ITEMS_PER_PAGE && (
          <div style={pagination}>
            <div style={paginationMeta}>
              Showing{" "}
              <strong>
                {safePage *
                  ITEMS_PER_PAGE +
                  1}
                –
                {Math.min(
                  (
                    safePage + 1
                  ) *
                  ITEMS_PER_PAGE,
                  normalizedLogs.length
                )}
              </strong>{" "}
              of{" "}
              <strong>
                {normalizedLogs.length}
              </strong>
            </div>

            <div style={paginationControls}>
              <button
                type="button"
                style={pageButton(
                  safePage === 0
                )}
                disabled={
                  safePage === 0
                }
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      0,
                      current - 1
                    )
                  )
                }
              >
                ‹
              </button>

              <div style={pageIndicator}>
                {safePage + 1} /{" "}
                {totalPages}
              </div>

              <button
                type="button"
                style={pageButton(
                  safePage >=
                  totalPages - 1
                )}
                disabled={
                  safePage >=
                  totalPages - 1
                }
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      totalPages - 1,
                      current + 1
                    )
                  )
                }
              >
                ›
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

const wrapper = {
  width: "100%",
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  color: "#fff",
};

const feedArea = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const activityCard = {
  position: "relative",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns:
    "30px minmax(0,1fr) 72px",
  gap: 9,
  alignItems: "center",
  padding: "9px 10px 9px 12px",
  borderRadius: 13,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.44),rgba(15,23,42,.36))",
  border:
    "1px solid rgba(148,163,184,.07)",
  boxShadow:
    "0 7px 18px rgba(2,6,23,.12)",
  overflow: "hidden",
};

const leftRail = (accent) => ({
  position: "absolute",
  top: 9,
  bottom: 9,
  left: 0,
  width: 2,
  borderRadius:
    "0 999px 999px 0",
  background: accent,
  boxShadow:
    `0 0 10px ${accent}55`,
});

const iconBubble = (meta) => ({
  width: 28,
  height: 28,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  color: meta.accent,
  background: meta.soft,
  border:
    `1px solid ${meta.border}`,
  fontSize: 10,
  fontWeight: 950,
});

const contentArea = {
  minWidth: 0,
};

const actionRow = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const actionText = {
  minWidth: 0,
  color: "#e2e8f0",
  fontSize: 10.3,
  fontWeight: 950,
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const typeChip = (meta) => ({
  flexShrink: 0,
  minHeight: 18,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  color: meta.accent,
  background: meta.soft,
  border:
    `1px solid ${meta.border}`,
  fontSize: 8.2,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".035em",
});

const itemName = {
  marginTop: 3,
  color: "#c6d1df",
  fontSize: 9.1,
  fontWeight: 750,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusFlow = {
  marginTop: 5,
  display: "flex",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
};

const statusMini = {
  maxWidth: 106,
  padding: "2px 5px",
  borderRadius: 999,
  color: "#aebdd0",
  background:
    "rgba(148,163,184,.04)",
  border:
    "1px solid rgba(148,163,184,.07)",
  fontSize: 7.7,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusMiniActive = (meta) => ({
  ...statusMini,
  color: meta.accent,
  background: meta.soft,
  border:
    `1px solid ${meta.border}`,
});

const arrow = {
  color: "#8797ad",
  fontSize: 8,
  fontWeight: 900,
};

const remarks = {
  marginTop: 5,
  color: "#aebdd0",
  fontSize: 8.2,
  fontWeight: 650,
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const timeRow = {
  marginTop: 5,
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "wrap",
};

const relativeTime = (meta) => ({
  minHeight: 17,
  padding: "0 5px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  color: meta.accent,
  background: meta.soft,
  border:
    `1px solid ${meta.border}`,
  fontSize: 8.2,
  fontWeight: 900,
});

const absoluteTime = {
  color: "#8797ad",
  fontSize: 10,
  fontWeight: 750,
};

const userArea = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 3,
};

const userAvatar = {
  width: 24,
  height: 24,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  color: "#bfdbfe",
  background:
    "rgba(59,130,246,.09)",
  border:
    "1px solid rgba(96,165,250,.15)",
  fontSize: 10,
  fontWeight: 950,
};

const userName = {
  maxWidth: 70,
  color: "#e2e8f0",
  fontSize: 8,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const roleChip = {
  maxWidth: 70,
  padding: "1px 5px",
  borderRadius: 999,
  color: "#93a4ba",
  background:
    "rgba(148,163,184,.035)",
  border:
    "1px solid rgba(148,163,184,.055)",
  fontSize: 5.9,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pagination = {
  flexShrink: 0,
  minHeight: 35,
  marginTop: 7,
  paddingTop: 7,
  borderTop:
    "1px solid rgba(148,163,184,.055)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const paginationMeta = {
  color: "#93a4ba",
  fontSize: 8.2,
  fontWeight: 750,
};

const paginationControls = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const pageButton = (
  disabled
) => ({
  width: 26,
  height: 26,
  borderRadius: 8,
  border:
    "1px solid rgba(96,165,250,.10)",
  background:
    "rgba(59,130,246,.05)",
  color: "#93c5fd",
  cursor: disabled
    ? "not-allowed"
    : "pointer",
  opacity: disabled
    ? 0.35
    : 1,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 900,
});

const pageIndicator = {
  minWidth: 42,
  height: 26,
  padding: "0 6px",
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  color: "#aebdd0",
  background:
    "rgba(148,163,184,.035)",
  border:
    "1px solid rgba(148,163,184,.055)",
  fontSize: 8,
  fontWeight: 850,
};

const empty = {
  flex: 1,
  minHeight: 245,
  borderRadius: 14,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 18,
  background:
    "radial-gradient(circle at top,rgba(59,130,246,.07),transparent 38%),rgba(2,6,23,.19)",
  border:
    "1px dashed rgba(148,163,184,.09)",
};

const emptyIcon = {
  color: "#60a5fa",
  fontSize: 26,
};

const emptyTitle = {
  marginTop: 6,
  color: "#dbeafe",
  fontSize: 10,
  fontWeight: 900,
};

const emptyText = {
  maxWidth: 270,
  marginTop: 4,
  color: "#93a4ba",
  fontSize: 9.4,
  fontWeight: 700,
  lineHeight: 1.45,
};

export default ActivityFeed;
