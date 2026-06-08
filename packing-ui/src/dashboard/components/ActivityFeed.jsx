import { useEffect, useMemo, useState } from "react";

function ActivityFeed({ logs = [] }) {
  const [page, setPage] = useState(0);
  const [nowMs, setNowMs] = useState(0);

  const itemsPerPage = 4;

  const totalPages = Math.max(
    1,
    Math.ceil(logs.length / itemsPerPage)
  );

  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    const updateNow = () => {
      setNowMs(new Date().getTime());
    };

    updateNow();

    const timer = window.setInterval(updateNow, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [logs.length]);

  const paginatedLogs = useMemo(() => {
    return logs.slice(
      safePage * itemsPerPage,
      safePage * itemsPerPage + itemsPerPage
    );
  }, [logs, safePage]);

  const parseServerDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();

    if (!raw) return null;

    const hasTimezone =
      /[zZ]$/.test(raw) ||
      /[+-]\d{2}:?\d{2}$/.test(raw);

    const normalized = hasTimezone ? raw : `${raw}Z`;

    const date = new Date(normalized);

    return isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (value) => {
    const date = parseServerDate(value);

    if (!date) return "";

    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatRelativeTime = (value) => {
    const date = parseServerDate(value);

    if (!date || !nowMs) return "";

    const diffMs = nowMs - date.getTime();

    if (diffMs < 0) return "Just now";

    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";

    if (diffMin < 60) {
      return `${diffMin} min ago`;
    }

    const diffHours = Math.floor(diffMin / 60);

    if (diffHours < 24) {
      return `${diffHours} hr ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 1) return "Yesterday";

    return `${diffDays} days ago`;
  };

  const activityMeta = (action = "") => {
    const value = action.toLowerCase();

    if (value.includes("dispatch")) {
      return {
        icon: "🚚",
        label: "Dispatch",
        accent: "#f59e0b",
        soft: "rgba(245,158,11,.14)",
        border: "rgba(245,158,11,.24)",
      };
    }

    if (value.includes("warehouse")) {
      return {
        icon: "🏬",
        label: "Warehouse",
        accent: "#60a5fa",
        soft: "rgba(96,165,250,.14)",
        border: "rgba(96,165,250,.24)",
      };
    }

    if (value.includes("sticker")) {
      return {
        icon: "🏷️",
        label: "Sticker",
        accent: "#f472b6",
        soft: "rgba(244,114,182,.14)",
        border: "rgba(244,114,182,.24)",
      };
    }

    if (value.includes("restore")) {
      return {
        icon: "↩️",
        label: "Restore",
        accent: "#a78bfa",
        soft: "rgba(167,139,250,.14)",
        border: "rgba(167,139,250,.24)",
      };
    }

    if (value.includes("return")) {
      return {
        icon: "🔁",
        label: "Return",
        accent: "#22c55e",
        soft: "rgba(34,197,94,.14)",
        border: "rgba(34,197,94,.24)",
      };
    }

    return {
      icon: "📦",
      label: "Inventory",
      accent: "#38bdf8",
      soft: "rgba(56,189,248,.14)",
      border: "rgba(56,189,248,.24)",
    };
  };

  const initials = (value = "") => {
    const clean = String(value || "SYSTEM").trim();

    if (!clean) return "S";

    return clean
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  return (
    <div style={wrapper}>
      <div style={topBar}>
        <div>
          <div style={headingRow}>
            <span style={headingIcon}>⚡</span>
            <div style={heading}>Recent Activity</div>
          </div>

          <div style={subHeading}>
            Latest inventory and warehouse operations
          </div>
        </div>

        <div style={headerRight}>
          <div style={livePill}>
            <span style={liveDot} />
            Live
          </div>

          <div style={countBadge}>
            {logs.length}
          </div>
        </div>
      </div>

      <div style={feedArea}>
        {paginatedLogs.map((log, index) => {
          const meta = activityMeta(log.action);

          return (
            <div
              key={log.id || `${log.createdAt}-${index}`}
              style={timelineItem}
            >
              <div style={timelineRail}>
                <div
                  style={{
                    ...timelineDot,
                    background: meta.accent,
                    boxShadow: `0 0 22px ${meta.accent}88`,
                  }}
                />

                {index < paginatedLogs.length - 1 && (
                  <div style={timelineLine} />
                )}
              </div>

              <div
                style={{
                  ...card,
                  border: `1px solid ${meta.border}`,
                  background:
                    `radial-gradient(circle at top left, ${meta.soft}, transparent 34%), ` +
                    "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025))",
                }}
              >
                <div
                  style={{
                    ...accentBar,
                    background: meta.accent,
                    boxShadow: `0 0 24px ${meta.accent}66`,
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

                <div style={middle}>
                  <div style={cardTopLine}>
                    <div style={action}>
                      {log.action || "Activity"}
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
                    {log.itemName || "Unknown Item"}
                  </div>

                  <div style={timeRow}>
                    <span
                      style={{
                        ...relativeTime,
                        color: meta.accent,
                        background: meta.soft,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {formatRelativeTime(log.createdAt)}
                    </span>

                    <span style={absoluteTime}>
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>

                <div style={right}>
                  <div style={userAvatar}>
                    {initials(log.performedBy)}
                  </div>

                  <div style={userBlock}>
                    <div style={userName}>
                      {log.performedBy || "SYSTEM"}
                    </div>

                    <div style={roleChip}>
                      {log.role || "SYSTEM"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {paginatedLogs.length === 0 && (
          <div style={empty}>
            <div style={emptyIcon}>🕘</div>

            <div style={emptyTitle}>
              No recent activity yet
            </div>

            <div style={emptyText}>
              Activity will appear here when packing, warehouse or dispatch actions are performed.
            </div>
          </div>
        )}
      </div>

      {logs.length > itemsPerPage && (
        <div style={pagination}>
          <button
            type="button"
            style={{
              ...pageBtn,
              opacity: safePage === 0 ? 0.45 : 1,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
            }}
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
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
                p < totalPages - 1 ? p + 1 : p
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
  gap: 14,
  marginBottom: 18,
};

const headingRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const headingIcon = {
  width: 34,
  height: 34,

  borderRadius: 14,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "linear-gradient(135deg, rgba(37,99,235,.34), rgba(14,165,233,.16))",

  border:
    "1px solid rgba(96,165,250,.25)",

  boxShadow:
    "0 12px 28px rgba(37,99,235,.22)",

  fontSize: 16,
};

const heading = {
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
  letterSpacing: "-.02em",
};

const subHeading = {
  fontSize: 12,
  color: "rgba(255,255,255,.58)",
  marginTop: 6,
};

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const livePill = {
  height: 34,

  padding: "0 11px",

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  gap: 7,

  background: "rgba(34,197,94,.10)",

  border:
    "1px solid rgba(34,197,94,.22)",

  color: "#86efac",

  fontSize: 11,
  fontWeight: 900,
};

const liveDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow: "0 0 14px rgba(34,197,94,.8)",
};

const countBadge = {
  minWidth: 38,
  height: 38,

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  boxShadow:
    "0 12px 26px rgba(37,99,235,.32)",

  fontWeight: 900,
  fontSize: 13,
  color: "#fff",
};

const feedArea = {
  flex: 1,
  overflowY: "auto",
  paddingRight: 4,
};

const timelineItem = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0,1fr)",
  gap: 10,
};

const timelineRail = {
  position: "relative",
  display: "flex",
  justifyContent: "center",
};

const timelineDot = {
  width: 11,
  height: 11,
  borderRadius: 999,
  marginTop: 24,
  zIndex: 2,
};

const timelineLine = {
  position: "absolute",
  top: 38,
  bottom: -10,
  width: 1,
  background:
    "linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.03))",
};

const card = {
  position: "relative",

  display: "grid",

  gridTemplateColumns: "44px minmax(0,1fr) auto",

  gap: 12,

  alignItems: "center",

  padding: "15px 16px 15px 18px",

  borderRadius: 22,

  marginBottom: 12,

  boxShadow:
    "0 16px 34px rgba(2,6,23,.22)",

  backdropFilter: "blur(16px)",

  overflow: "hidden",

  transition: "transform .22s ease, border .22s ease, box-shadow .22s ease",
};

const accentBar = {
  position: "absolute",
  left: 0,
  top: 14,
  bottom: 14,
  width: 4,
  borderRadius: "0 999px 999px 0",
};

const iconBubble = {
  width: 40,
  height: 40,

  borderRadius: 16,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  fontSize: 18,

  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.08)",
};

const middle = {
  minWidth: 0,
};

const cardTopLine = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const action = {
  fontWeight: 900,
  fontSize: 14,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const typeChip = {
  flex: "0 0 auto",

  padding: "4px 8px",

  borderRadius: 999,

  fontSize: 10,

  fontWeight: 900,
};

const itemName = {
  marginTop: 5,
  fontSize: 13,
  color: "rgba(255,255,255,.72)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const timeRow = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const relativeTime = {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
};

const absoluteTime = {
  fontSize: 11,
  color: "rgba(255,255,255,.48)",
  fontWeight: 700,
};

const right = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const userAvatar = {
  width: 34,
  height: 34,

  borderRadius: 999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "linear-gradient(135deg, rgba(59,130,246,.28), rgba(147,197,253,.12))",

  border:
    "1px solid rgba(147,197,253,.22)",

  color: "#dbeafe",

  fontSize: 11,

  fontWeight: 900,
};

const userBlock = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 5,
  minWidth: 0,
};

const userName = {
  maxWidth: 120,
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const roleChip = {
  padding: "4px 8px",

  borderRadius: 999,

  background:
    "rgba(255,255,255,.05)",

  border:
    "1px solid rgba(255,255,255,.06)",

  color: "rgba(255,255,255,.68)",

  fontSize: 9,

  fontWeight: 900,
};

const pagination = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  marginTop: 12,
};

const pageBtn = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,255,255,.055))",
  color: "#fff",
  fontWeight: 900,
};

const pageIndicator = {
  padding: "7px 11px",
  borderRadius: 999,
  background: "rgba(255,255,255,.045)",
  border: "1px solid rgba(255,255,255,.06)",
  fontSize: 11,
  color: "rgba(255,255,255,.66)",
  fontWeight: 900,
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

  background: "rgba(59,130,246,.14)",

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
  maxWidth: 320,
  fontSize: 12,
  lineHeight: 1.5,
  color: "rgba(255,255,255,.56)",
  fontWeight: 700,
};

export default ActivityFeed;