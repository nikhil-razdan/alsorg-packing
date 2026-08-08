import {
  useEffect,
  useMemo,
  useState,
} from "react";

const IST_OFFSET_MINUTES = 330;
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 20];

const ACTION_LABELS = {
  "ITEM PACKED": "Item Packed",
  "STICKER REPRINTED": "Sticker Reprinted",
  "STICKER HISTORY REBUILT": "Sticker History Rebuilt",
  DISPATCHED: "Item Dispatched",
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
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

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

    const date = new Date(utcMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value)
    .trim()
    .replace(" ", "T");

  if (!raw) return null;

  const hasTimezone =
    /[zZ]$/.test(raw) ||
    /[+-]\d{2}:?\d{2}$/.test(raw);

  if (hasTimezone) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
  );

  if (!match) {
    const fallback = new Date(raw);
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

  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getActivityTime(log) {
  return (
    log?.createdAt ||
    log?.created_at ||
    log?.performedAt ||
    log?.performed_at ||
    log?.updatedAt ||
    log?.updated_at ||
    log?.timestamp ||
    log?.activityAt ||
    log?.time ||
    log?.date ||
    null
  );
}

function getItemName(log) {
  return (
    log?.itemName ||
    log?.masterItemName ||
    log?.packetItemName ||
    log?.name ||
    log?.productName ||
    log?.sku ||
    log?.stickerNumber ||
    log?.challanNumber ||
    log?.chalaanNumber ||
    log?.zohoItemId ||
    "Unknown Item"
  );
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeActionLabel(action = "") {
  const value = String(action || "").trim();

  if (!value) return "Activity";

  const upper = value.toUpperCase();

  if (ACTION_LABELS[upper]) {
    return ACTION_LABELS[upper];
  }

  const lower = value.toLowerCase();

  if (lower.includes("item packed")) return "Item Packed";
  if (lower.includes("sticker reprinted")) return "Sticker Reprinted";
  if (lower.includes("sticker")) return "Sticker Activity";
  if (lower === "dispatched") return "Item Dispatched";
  if (lower.includes("ready_to_dispatch")) return "Ready To Dispatch";
  if (lower.includes("warehouse approved")) return "Warehouse Approved";
  if (lower.includes("warehouse requested")) return "Warehouse Requested";

  return value
    .replaceAll("_", " ")
    .replaceAll("→", " → ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function activityMeta(action = "", role = "") {
  const value = `${action} ${role}`.toLowerCase();

  if (
    value.includes("item packed") ||
    value.includes("sticker") ||
    value.includes("packing")
  ) {
    return {
      icon: "✓",
      label: "Packing",
      key: "PACKING",
      accent: "#22c55e",
      soft: "rgba(34,197,94,.09)",
      border: "rgba(34,197,94,.18)",
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
      key: "DISPATCH",
      accent: "#f97316",
      soft: "rgba(249,115,22,.09)",
      border: "rgba(249,115,22,.18)",
    };
  }

  if (value.includes("warehouse")) {
    return {
      icon: "▣",
      label: "Warehouse",
      key: "WAREHOUSE",
      accent: "#38bdf8",
      soft: "rgba(56,189,248,.09)",
      border: "rgba(56,189,248,.18)",
    };
  }

  if (value.includes("restore")) {
    return {
      icon: "↶",
      label: "Restore",
      key: "RESTORE",
      accent: "#a78bfa",
      soft: "rgba(167,139,250,.09)",
      border: "rgba(167,139,250,.18)",
    };
  }

  if (value.includes("return")) {
    return {
      icon: "↔",
      label: "Return",
      key: "RETURN",
      accent: "#14b8a6",
      soft: "rgba(20,184,166,.09)",
      border: "rgba(20,184,166,.18)",
    };
  }

  if (
    value.includes("plant") ||
    value.includes("fg") ||
    value.includes("location") ||
    value.includes("move") ||
    value.includes("transfer")
  ) {
    return {
      icon: "⌖",
      label: "Movement",
      key: "MOVEMENT",
      accent: "#60a5fa",
      soft: "rgba(96,165,250,.09)",
      border: "rgba(96,165,250,.18)",
    };
  }

  return {
    icon: "•",
    label: "Inventory",
    key: "OTHER",
    accent: "#60a5fa",
    soft: "rgba(96,165,250,.08)",
    border: "rgba(96,165,250,.16)",
  };
}

function formatDate(value) {
  const date = parseServerDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function toLocalDateKey(date) {
  if (!date) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function toLocalMinutes(date) {
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || 0
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0
  );

  return hour * 60 + minute;
}

function timeInputToMinutes(value) {
  if (!value) return null;

  const [hour, minute] = String(value)
    .split(":")
    .map(Number);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function formatRelativeTime(value, nowMs) {
  const date = parseServerDate(value);

  if (!date || !nowMs) return "—";

  const diffMs = nowMs - date.getTime();

  if (diffMs < 0 && Math.abs(diffMs) < 2 * 60000) {
    return "Just now";
  }

  if (diffMs < 0) return "Scheduled";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1
    ? "1 month ago"
    : `${diffMonths} months ago`;
}

function initials(value = "") {
  const clean = String(value || "SYSTEM").trim();

  if (!clean) return "S";

  return clean
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function statusLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .trim();
}

function buildSearchText(log) {
  const values = [
    log?._actionLabel,
    log?._itemName,
    log?._performedBy,
    log?._role,
    log?._fromStatus,
    log?._toStatus,
    log?._remarks,
    log?.pdNo,
    log?.drawingNo,
    log?.packetNumber,
    log?.packetNo,
    log?.sku,
    log?.stickerNumber,
    log?.challanNumber,
    log?.chalaanNumber,
    log?.clientName,
    log?.clientAddress,
    log?.plantCode,
    log?.currentLocationCode,
    log?.warehouseCode,
    log?.vehicleNumber,
    log?.driverName,
    log?.zohoItemId,
    log?.packetItemId,
    log?.masterItemId,
  ];

  return values
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function getTraceSearchValue(log) {
  const candidates = [
    log?.stickerNumber,
    log?.challanNumber,
    log?.chalaanNumber,
    log?.packetNumber,
    log?.packetNo,
    log?.sku,
    log?.pdNo,
    log?.zohoItemId,
    log?.packetItemId,
    log?.masterItemId,
    log?._itemName,
  ];

  return (
    candidates
      .map((value) => String(value || "").trim())
      .find(Boolean) || ""
  );
}

function valueForDisplay(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function ActivityDetailModal({
  log,
  onClose,
  onInspectRecord,
}) {
  if (!log) return null;

  const meta = activityMeta(
    log.action,
    log.role
  );

  const fields = Object.entries(log)
    .filter(([key]) => !key.startsWith("_"))
    .sort(([a], [b]) => a.localeCompare(b));

  const traceSearch =
    getTraceSearchValue(log);

  return (
    <div
      style={detailOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div style={detailModal}>
        <div style={detailModalHeader}>
          <div style={detailIdentity}>
            <div style={detailIcon(meta)}>
              {meta.icon}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={detailEyebrow}>
                {meta.label.toUpperCase()} ACTIVITY
              </div>

              <div style={detailTitle}>
                {log._actionLabel}
              </div>

              <div style={detailSubtitle}>
                {log._itemName} • {formatDate(log._activityTime)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={detailCloseButton}
          >
            ×
          </button>
        </div>

        <div style={detailSummaryGrid}>
          <div style={summaryTile}>
            <span>Performed By</span>
            <strong>{log._performedBy}</strong>
          </div>

          <div style={summaryTile}>
            <span>Role</span>
            <strong>{log._role}</strong>
          </div>

          <div style={summaryTile}>
            <span>Status Flow</span>
            <strong>
              {statusLabel(log._fromStatus) || "—"} →{" "}
              {statusLabel(log._toStatus) || "—"}
            </strong>
          </div>

          <div style={summaryTile}>
            <span>Activity Time</span>
            <strong>{formatDate(log._activityTime)}</strong>
          </div>
        </div>

        <div style={detailSectionTitle}>
          Complete Event Payload
        </div>

        <div style={detailFields}>
          {fields.map(([key, value]) => (
            <div key={key} style={detailField}>
              <div style={detailFieldLabel}>
                {key
                  .replace(/([a-z])([A-Z])/g, "$1 $2")
                  .replaceAll("_", " ")}
              </div>

              <div style={detailFieldValue}>
                {valueForDisplay(value)}
              </div>
            </div>
          ))}
        </div>

        <div style={detailFooter}>
          <div style={detailHint}>
            Every field returned by the activity API is shown above.
          </div>

          {traceSearch && onInspectRecord && (
            <button
              type="button"
              onClick={() =>
                onInspectRecord({
                  search: traceSearch,
                  title: `Trace: ${log._itemName}`,
                  type: "all",
                })
              }
              style={inspectButton(meta.accent)}
            >
              Inspect linked record →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({
  logs = [],
  onInspectRecord,
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] =
    useState(DEFAULT_PAGE_SIZE);
  const [nowMs, setNowMs] =
    useState(Date.now());
  const [search, setSearch] =
    useState("");
  const [category, setCategory] =
    useState("ALL");
  const [dateFrom, setDateFrom] =
    useState("");
  const [dateTo, setDateTo] =
    useState("");
  const [timeFrom, setTimeFrom] =
    useState("");
  const [timeTo, setTimeTo] =
    useState("");
  const [filtersOpen, setFiltersOpen] =
    useState(false);
  const [selectedLog, setSelectedLog] =
    useState(null);

  useEffect(() => {
    const updateNow = () => {
      setNowMs(Date.now());
    };

    updateNow();

    const timer = window.setInterval(
      updateNow,
      60000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const normalizedLogs = useMemo(() => {
    return [...logs]
      .map((log, index) => {
        const activityTime =
          getActivityTime(log);

        const date =
          parseServerDate(activityTime);

        const normalized = {
          ...log,
          _index: index,
          _activityTime: activityTime,
          _date: date,
          _timeMs: date
            ? date.getTime()
            : 0,
          _itemName: getItemName(log),
          _actionLabel:
            normalizeActionLabel(log.action),
          _performedBy: normalizeText(
            log.performedBy ||
            log.createdBy ||
            log.updatedBy ||
            log.generatedBy ||
            log.packedBy ||
            log.dispatchedBy,
            "SYSTEM"
          ),
          _role: normalizeText(
            log.role,
            "SYSTEM"
          ),
          _fromStatus: normalizeText(
            log.fromStatus
          ),
          _toStatus: normalizeText(
            log.toStatus
          ),
          _remarks: normalizeText(
            log.remarks ||
            log.reason ||
            log.message
          ),
        };

        normalized._meta =
          activityMeta(
            normalized.action,
            normalized._role
          );

        normalized._searchText =
          buildSearchText(normalized);

        return normalized;
      })
      .sort((a, b) => {
        if (b._timeMs !== a._timeMs) {
          return b._timeMs - a._timeMs;
        }

        return (
          Number(b.id || 0) -
          Number(a.id || 0)
        );
      });
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const searchTokens = String(search || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const fromMinutes =
      timeInputToMinutes(timeFrom);

    const toMinutes =
      timeInputToMinutes(timeTo);

    return normalizedLogs.filter((log) => {
      if (
        category !== "ALL" &&
        log._meta?.key !== category
      ) {
        return false;
      }

      if (
        searchTokens.length > 0 &&
        !searchTokens.every((token) =>
          log._searchText.includes(token)
        )
      ) {
        return false;
      }

      if (
        dateFrom ||
        dateTo ||
        timeFrom ||
        timeTo
      ) {
        if (!log._date) return false;

        const dateKey =
          toLocalDateKey(log._date);

        if (
          dateFrom &&
          dateKey < dateFrom
        ) {
          return false;
        }

        if (
          dateTo &&
          dateKey > dateTo
        ) {
          return false;
        }

        const rowMinutes =
          toLocalMinutes(log._date);

        if (
          rowMinutes !== null &&
          fromMinutes !== null &&
          toMinutes !== null &&
          fromMinutes > toMinutes
        ) {
          if (
            !(
              rowMinutes >= fromMinutes ||
              rowMinutes <= toMinutes
            )
          ) {
            return false;
          }
        } else {
          if (
            fromMinutes !== null &&
            rowMinutes !== null &&
            rowMinutes < fromMinutes
          ) {
            return false;
          }

          if (
            toMinutes !== null &&
            rowMinutes !== null &&
            rowMinutes > toMinutes
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    normalizedLogs,
    search,
    category,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredLogs.length /
      pageSize
    )
  );

  const safePage = Math.min(
    page,
    totalPages - 1
  );

  useEffect(() => {
    setPage(0);
  }, [
    logs.length,
    search,
    category,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    pageSize,
  ]);

  const paginatedLogs = useMemo(
    () =>
      filteredLogs.slice(
        safePage * pageSize,
        safePage * pageSize +
        pageSize
      ),
    [
      filteredLogs,
      safePage,
      pageSize,
    ]
  );

  const clearFilters = () => {
    setSearch("");
    setCategory("ALL");
    setDateFrom("");
    setDateTo("");
    setTimeFrom("");
    setTimeTo("");
    setPage(0);
  };

  const filterActive =
    Boolean(
      search ||
      category !== "ALL" ||
      dateFrom ||
      dateTo ||
      timeFrom ||
      timeTo
    );

  return (
    <div style={wrapper}>
      <style>{`
        .packflow-activity-scroll::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }
        .packflow-activity-scroll::-webkit-scrollbar-track {
          background: rgba(15,23,42,.72);
          border-radius: 999px;
        }
        .packflow-activity-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg,#2563eb,#60a5fa);
          border-radius: 999px;
          border: 2px solid rgba(15,23,42,.9);
        }
        .packflow-activity-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg,#3b82f6,#93c5fd);
        }
      `}</style>

      <div style={filterToolbar}>
        <div style={searchWrap}>
          <span style={searchIcon}>⌕</span>
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search activity, item, PD, sticker, challan, user..."
            style={searchInput}
          />
        </div>

        <button
          type="button"
          onClick={() =>
            setFiltersOpen(
              (value) => !value
            )
          }
          style={filterButton(
            filtersOpen ||
            filterActive
          )}
        >
          {filterActive
            ? "Filters • Active"
            : "Date / Time Filters"}
        </button>

        {filterActive && (
          <button
            type="button"
            onClick={clearFilters}
            style={clearButton}
          >
            Clear
          </button>
        )}
      </div>

      {filtersOpen && (
        <div style={filterPanel}>
          <label style={filterLabel}>
            Type
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
              style={filterInput}
            >
              <option value="ALL">
                All activity
              </option>
              <option value="PACKING">
                Packing
              </option>
              <option value="DISPATCH">
                Dispatch
              </option>
              <option value="WAREHOUSE">
                Warehouse
              </option>
              <option value="MOVEMENT">
                Movement
              </option>
              <option value="RESTORE">
                Restore
              </option>
              <option value="RETURN">
                Return
              </option>
              <option value="OTHER">
                Other
              </option>
            </select>
          </label>

          <label style={filterLabel}>
            From Date
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
              style={filterInput}
            />
          </label>

          <label style={filterLabel}>
            To Date
            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
              style={filterInput}
            />
          </label>

          <label style={filterLabel}>
            From Time
            <input
              type="time"
              value={timeFrom}
              onChange={(event) =>
                setTimeFrom(
                  event.target.value
                )
              }
              style={filterInput}
            />
          </label>

          <label style={filterLabel}>
            To Time
            <input
              type="time"
              value={timeTo}
              onChange={(event) =>
                setTimeTo(
                  event.target.value
                )
              }
              style={filterInput}
            />
          </label>
        </div>
      )}

      <div style={feedMeta}>
        <span>
          <strong>
            {filteredLogs.length}
          </strong>{" "}
          matching events
        </span>

        <span>
          fetched{" "}
          <strong>{logs.length}</strong>
        </span>
      </div>

      <div
        style={feedArea}
        className="packflow-activity-scroll"
      >
        {paginatedLogs.map(
          (log, index) => {
            const meta =
              log._meta ||
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
              <button
                type="button"
                key={
                  log.id ||
                  `${activityTime}-${index}`
                }
                style={activityCard}
                onClick={() =>
                  setSelectedLog(log)
                }
                title="Open complete activity details"
              >
                <div
                  style={leftRail(
                    meta.accent
                  )}
                />

                <div
                  style={iconBubble(meta)}
                >
                  {meta.icon}
                </div>

                <div style={contentArea}>
                  <div style={actionRow}>
                    <div style={actionText}>
                      {log._actionLabel}
                    </div>

                    <span
                      style={typeChip(meta)}
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

                    <span
                      style={absoluteTime}
                    >
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

                  <div style={openHint}>
                    Details ↗
                  </div>
                </div>
              </button>
            );
          }
        )}

        {paginatedLogs.length === 0 && (
          <div style={empty}>
            <div style={emptyIcon}>
              ◎
            </div>

            <div style={emptyTitle}>
              No matching activity
            </div>

            <div style={emptyText}>
              Adjust search or date/time filters. Packing, warehouse, FG movement, challan and dispatch actions appear here.
            </div>
          </div>
        )}
      </div>

      <div style={pagination}>
        <div style={paginationMeta}>
          {filteredLogs.length > 0 ? (
            <>
              Showing{" "}
              <strong>
                {safePage *
                  pageSize +
                  1}
                –
                {Math.min(
                  (safePage + 1) *
                  pageSize,
                  filteredLogs.length
                )}
              </strong>{" "}
              of{" "}
              <strong>
                {filteredLogs.length}
              </strong>
            </>
          ) : (
            "No records"
          )}
        </div>

        <div style={paginationControls}>
          <select
            value={pageSize}
            onChange={(event) =>
              setPageSize(
                Number(
                  event.target.value
                ) ||
                DEFAULT_PAGE_SIZE
              )
            }
            style={pageSizeSelect}
            title="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value} / page
                </option>
              )
            )}
          </select>

          <button
            type="button"
            style={pageButton(
              safePage === 0
            )}
            disabled={safePage === 0}
            onClick={() =>
              setPage(0)
            }
          >
            «
          </button>

          <button
            type="button"
            style={pageButton(
              safePage === 0
            )}
            disabled={safePage === 0}
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
              setPage(
                totalPages - 1
              )
            }
          >
            »
          </button>
        </div>
      </div>

      <ActivityDetailModal
        log={selectedLog}
        onClose={() =>
          setSelectedLog(null)
        }
        onInspectRecord={
          onInspectRecord
        }
      />
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

const filterToolbar = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) auto auto",
  gap: 7,
  alignItems: "center",
  padding: 8,
  borderRadius: 12,
  background:
    "rgba(15,23,42,.48)",
  border:
    "1px solid rgba(148,163,184,.065)",
};

const searchWrap = {
  minWidth: 0,
  position: "relative",
};

const searchIcon = {
  position: "absolute",
  left: 9,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  fontSize: 13,
  pointerEvents: "none",
};

const searchInput = {
  width: "100%",
  height: 32,
  padding: "0 10px 0 28px",
  borderRadius: 9,
  outline: "none",
  border:
    "1px solid rgba(148,163,184,.08)",
  background:
    "rgba(2,6,23,.42)",
  color: "#e2e8f0",
  fontFamily: "inherit",
  fontSize: 9.5,
  fontWeight: 750,
  boxSizing: "border-box",
};

const filterButton = (active) => ({
  height: 32,
  padding: "0 10px",
  borderRadius: 9,
  border: active
    ? "1px solid rgba(96,165,250,.32)"
    : "1px solid rgba(148,163,184,.08)",
  background: active
    ? "rgba(59,130,246,.13)"
    : "rgba(255,255,255,.035)",
  color: active
    ? "#bfdbfe"
    : "#94a3b8",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const clearButton = {
  height: 32,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(239,68,68,.14)",
  background:
    "rgba(239,68,68,.07)",
  color: "#fca5a5",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 900,
  cursor: "pointer",
};

const filterPanel = {
  display: "grid",
  gridTemplateColumns:
    "repeat(5,minmax(110px,1fr))",
  gap: 7,
  marginTop: 7,
  padding: 8,
  borderRadius: 12,
  background:
    "rgba(2,6,23,.30)",
  border:
    "1px solid rgba(148,163,184,.055)",
};

const filterLabel = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#64748b",
  fontSize: 7.6,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const filterInput = {
  width: "100%",
  minWidth: 0,
  height: 30,
  padding: "0 7px",
  borderRadius: 8,
  outline: "none",
  border:
    "1px solid rgba(148,163,184,.08)",
  background: "#0f172a",
  color: "#e2e8f0",
  colorScheme: "dark",
  fontFamily: "inherit",
  fontSize: 8.5,
  fontWeight: 750,
  boxSizing: "border-box",
};

const feedMeta = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  margin: "6px 2px",
  color: "#64748b",
  fontSize: 8,
  fontWeight: 750,
};

const feedArea = {
  flex: "1 1 auto",
  minHeight: 180,
  maxHeight: 330,
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 7,
  paddingRight: 3,
  scrollbarWidth: "thin",
  scrollbarColor:
    "#3b82f6 rgba(15,23,42,.72)",
};

const activityCard = {
  position: "relative",
  width: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns:
    "30px minmax(0,1fr) 78px",
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
  color: "#fff",
  textAlign: "left",
  fontFamily: "inherit",
  cursor: "pointer",
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
  fontSize: 9.2,
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
  maxWidth: 76,
  color: "#e2e8f0",
  fontSize: 8,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const roleChip = {
  maxWidth: 76,
  padding: "1px 5px",
  borderRadius: 999,
  color: "#93a4ba",
  background:
    "rgba(148,163,184,.035)",
  border:
    "1px solid rgba(148,163,184,.055)",
  fontSize: 6.4,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const openHint = {
  color: "#60a5fa",
  fontSize: 6.7,
  fontWeight: 900,
};

const pagination = {
  flexShrink: 0,
  minHeight: 37,
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

const pageSizeSelect = {
  height: 26,
  padding: "0 5px",
  borderRadius: 8,
  border:
    "1px solid rgba(96,165,250,.10)",
  background: "#0f172a",
  color: "#93c5fd",
  colorScheme: "dark",
  fontFamily: "inherit",
  fontSize: 7.6,
  fontWeight: 850,
  outline: "none",
};

const pageButton = (disabled) => ({
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
  minWidth: 48,
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
  minHeight: 185,
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
  maxWidth: 300,
  marginTop: 4,
  color: "#93a4ba",
  fontSize: 9.4,
  fontWeight: 700,
  lineHeight: 1.45,
};

const detailOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 20000,
  padding: 18,
  display: "grid",
  placeItems: "center",
  background:
    "rgba(2,6,23,.82)",
  backdropFilter: "blur(14px)",
};

const detailModal = {
  width: "min(940px,100%)",
  maxHeight:
    "min(860px,calc(100vh - 36px))",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 24,
  background:
    "radial-gradient(circle at top right,rgba(59,130,246,.12),transparent 30%),linear-gradient(180deg,#0f172a,#08101d)",
  border:
    "1px solid rgba(96,165,250,.16)",
  boxShadow:
    "0 40px 110px rgba(0,0,0,.65)",
};

const detailModalHeader = {
  flexShrink: 0,
  padding: "18px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  borderBottom:
    "1px solid rgba(148,163,184,.08)",
};

const detailIdentity = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const detailIcon = (meta) => ({
  width: 42,
  height: 42,
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  borderRadius: 13,
  color: meta.accent,
  background: meta.soft,
  border:
    `1px solid ${meta.border}`,
  fontSize: 17,
  fontWeight: 950,
});

const detailEyebrow = {
  color: "#93c5fd",
  fontSize: 8.5,
  fontWeight: 950,
  letterSpacing: ".10em",
};

const detailTitle = {
  marginTop: 3,
  color: "#fff",
  fontSize: 20,
  fontWeight: 950,
};

const detailSubtitle = {
  marginTop: 4,
  color: "#94a3b8",
  fontSize: 10.5,
  fontWeight: 700,
};

const detailCloseButton = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border:
    "1px solid rgba(148,163,184,.10)",
  background:
    "rgba(255,255,255,.04)",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: 20,
};

const detailSummaryGrid = {
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: 8,
  padding: "12px 20px",
};

const summaryTile = {
  minWidth: 0,
  padding: 11,
  borderRadius: 13,
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(148,163,184,.065)",
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const detailSectionTitle = {
  padding: "4px 20px 8px",
  color: "#94a3b8",
  fontSize: 8.5,
  fontWeight: 950,
  letterSpacing: ".09em",
  textTransform: "uppercase",
};

const detailFields = {
  minHeight: 0,
  overflowY: "auto",
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 8,
  padding: "0 20px 16px",
  scrollbarWidth: "thin",
  scrollbarColor:
    "#3b82f6 rgba(15,23,42,.72)",
};

const detailField = {
  minWidth: 0,
  padding: 11,
  borderRadius: 12,
  background:
    "rgba(2,6,23,.34)",
  border:
    "1px solid rgba(148,163,184,.055)",
};

const detailFieldLabel = {
  color: "#64748b",
  fontSize: 8,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const detailFieldValue = {
  marginTop: 5,
  color: "#e2e8f0",
  fontSize: 10.5,
  fontWeight: 750,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
};

const detailFooter = {
  flexShrink: 0,
  padding: "12px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderTop:
    "1px solid rgba(148,163,184,.08)",
};

const detailHint = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
};

const inspectButton = (accent) => ({
  height: 34,
  padding: "0 13px",
  borderRadius: 10,
  border:
    `1px solid ${accent}42`,
  background:
    `${accent}18`,
  color: "#fff",
  fontFamily: "inherit",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
});

export default ActivityFeed;
