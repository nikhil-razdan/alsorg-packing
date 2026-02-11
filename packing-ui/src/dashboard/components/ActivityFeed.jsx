import { useState, useMemo } from "react";

function ActivityFeed({ logs = [] }) {
  const [page, setPage] = useState(0);
  const itemsPerPage = 3;

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
    const safe = value.length > 23 ? value.substring(0, 23) : value;
    const date = new Date(safe);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  };

  return (
    <div style={wrapper}>
      <h3 style={title}>Recent Activity</h3>

      <div style={content}>
        {paginatedLogs.map((log) => (
          <div key={log.id} style={item}>
            <div>
              <div style={action}>{log.action}</div>
              <div style={desc}>{log.itemName || "Unknown Item"}</div>
              <div style={time}>{formatDate(log.createdAt)}</div>
            </div>

            <div style={chips}>
              <span style={user}>{log.performedBy}</span>
              <span style={role}>{log.role}</span>
            </div>
          </div>
        ))}

        {paginatedLogs.length === 0 && (
          <div style={{ opacity: 0.6, fontSize: 13 }}>
            No recent activity
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={pagination}>
          <button
            style={pageBtn}
            disabled={safePage === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Prev
          </button>

          <button
            style={pageBtn}
            disabled={safePage >= totalPages - 1}
            onClick={() =>
              setPage((prev) =>
                prev < totalPages - 1 ? prev + 1 : prev
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

/* ===================== STYLES ===================== */

const wrapper = {
  display: "flex",
  flexDirection: "column",
  height: "100%", // ✅ fills panel
  color: "#fff",
};

const title = {
  marginBottom: 14,
  fontSize: 18,
  fontWeight: 700,
};

const content = {
  flex: 1,
  overflow: "hidden",
};

const item = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
};

const action = {
  fontWeight: 700,
  fontSize: 15,
};

const desc = {
  fontSize: 13,
  opacity: 0.85,
};

const time = {
  fontSize: 12,
  opacity: 0.7,
};

const chips = {
  display: "flex",
  gap: 8,
};

const user = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#fff",
  color: "#111",
  fontSize: 11,
  fontWeight: 600,
};

const role = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.35)",
  fontSize: 11,
};

const pagination = {
  marginTop: 12,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const pageBtn = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  background: "rgba(255,255,255,0.25)",
  color: "#fff",
};

export default ActivityFeed;