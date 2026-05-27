import { useMemo, useState } from "react";

function ActivityFeed({ logs = [] }) {
  const [page, setPage] = useState(0);

  const itemsPerPage = 4;

  const totalPages = Math.ceil(logs.length / itemsPerPage);

  const safePage = page >= totalPages ? 0 : page;

  const paginatedLogs = useMemo(() => {
    return logs.slice(
      safePage * itemsPerPage,
      safePage * itemsPerPage + itemsPerPage
    );
  }, [logs, safePage]);

  const formatDate = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (isNaN(date.getTime())) return "";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={wrapper}>
      <div style={topBar}>
        <div>
          <div style={heading}>Recent Activity</div>
          <div style={subHeading}>
            Latest inventory and warehouse operations
          </div>
        </div>

        <div style={countBadge}>
          {logs.length}
        </div>
      </div>

      <div style={feedArea}>
        {paginatedLogs.map((log) => (
          <div key={log.id} style={card}>
            <div style={left}>
              <div style={action}>
                {log.action}
              </div>

              <div style={itemName}>
                {log.itemName || "Unknown Item"}
              </div>

              <div style={time}>
                {formatDate(log.createdAt)}
              </div>
            </div>

            <div style={right}>
              <div style={userChip}>
                {log.performedBy}
              </div>

              <div style={roleChip}>
                {log.role}
              </div>
            </div>
          </div>
        ))}

        {paginatedLogs.length === 0 && (
          <div style={empty}>
            No recent activity available
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={pagination}>
          <button
            style={pageBtn}
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>

          <div style={pageIndicator}>
            {safePage + 1} / {totalPages}
          </div>

          <button
            style={pageBtn}
            disabled={safePage >= totalPages - 1}
            onClick={() =>
              setPage((p) =>
                p < totalPages - 1 ? p + 1 : p
              )
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* ====================== STYLES ====================== */

const wrapper = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  color: "#fff",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const heading = {
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const subHeading = {
  fontSize: 12,
  color: "rgba(255,255,255,.58)",
  marginTop: 4,
};

const countBadge = {
  minWidth: 36,
  height: 36,

  borderRadius: 999,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  fontWeight: 800,

  fontSize: 13,

  color: "#fff",
};

const feedArea = {
  flex: 1,
  overflowY: "auto",
  paddingRight: 4,
};

const card = {
  display: "flex",

  justifyContent:
    "space-between",

  padding: "14px 16px",

  borderRadius: 18,

  marginBottom: 12,

  background:
    "rgba(255,255,255,.03)",

  border:
    "1px solid rgba(255,255,255,.06)",

  backdropFilter: "blur(10px)",
};

const left = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const action = {
  fontWeight: 700,
  fontSize: 14,
};

const itemName = {
  fontSize: 13,
  opacity: 0.85,
};

const time = {
  fontSize: 11,
  opacity: 0.6,
};

const right = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 8,
};

const userChip = {
  padding: "4px 10px",

  borderRadius: 999,

  background:
    "rgba(59,130,246,.16)",

  color: "#60a5fa",

  fontSize: 11,

  fontWeight: 700,
};

const roleChip = {
  padding: "5px 10px",

  borderRadius: 999,

  background:
    "rgba(255,255,255,.05)",

  color: "rgba(255,255,255,.72)",

  fontSize: 10,

  fontWeight: 700,
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
  border: "none",
  cursor: "pointer",
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  fontWeight: 600,
};

const pageIndicator = {
  fontSize: 12,
  opacity: 0.7,
};

const empty = {
  opacity: 0.7,
  fontSize: 13,
  paddingTop: 10,
};

export default ActivityFeed;