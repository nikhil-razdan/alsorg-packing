import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Chip, Box, Button, IconButton } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";

/**
 * Dispatched Items Page
 * FINAL RULESET IMPLEMENTED
 */

function DispatchedItemsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const role = localStorage.getItem("role");
  const isAdmin = role === "ADMIN";
  const isDispatch = role === "DISPATCH";
  const isPacking = role === "USER";
  const [historyOpen, setHistoryOpen] = useState(false);
  const [, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");



  /* ===================== ACTIONS ===================== */

  const requestRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `/api/dispatched/${zohoItemId}/request-restore`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error();

      setRows(prev =>
        prev.map(r =>
          r.zohoItemId === zohoItemId
            ? { ...r, approvalStatus: "PENDING" }
            : r
        )
      );
    } catch {
      alert("Failed to request restore");
    }
  };

  const approveRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `/api/dispatched/${zohoItemId}/approve-restore`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error();
      setRows(prev => prev.filter(r => r.zohoItemId !== zohoItemId));
    } catch {
      alert("Approval failed");
    }
  };

  const rejectRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `/api/dispatched/${zohoItemId}/reject-restore`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error();

      setRows(prev =>
        prev.map(r =>
          r.zohoItemId === zohoItemId
            ? { ...r, approvalStatus: "REJECTED" }
            : r
        )
      );
    } catch {
      alert("Reject failed");
    }
  };

  const updateStatus = async (zohoItemId, status) => {
    try {
      const res = await fetch(
        `/api/dispatched/${zohoItemId}/dispatch?status=${status}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error();

      setRows(prev =>
        prev.map(r =>
          r.zohoItemId === zohoItemId ? { ...r, status } : r
        )
      );
    } catch {
      alert("Status update failed");
    }
  };

  /* ===================== DOWNLOAD ===================== */

  const openStickerHistory = async (zohoItemId) => {
    try {
      setHistoryOpen(true);
      setHistoryLoading(true);
      setHistoryRows([]);
      setHistoryItem(zohoItemId);

      const res = await fetch(
        `/api/stickers/${zohoItemId}/history`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("History fetch failed");

      const data = await res.json();
      setHistoryRows(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load sticker history");
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const openAuditLogs = async (zohoItemId) => {
    try {
      setAuditOpen(true);
      setAuditLoading(true);
      setAuditRows([]);

      const res = await fetch(
        `/api/audit/${zohoItemId}`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Audit fetch failed");

      const data = await res.json();
      setAuditRows(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load activity logs");
    } finally {
      setAuditLoading(false);
    }
  };


  /* ===================== COLUMNS ===================== */

  const columns = [
    {
      field: "name",
      headerName: "Item Name",
      flex: 1,
      minWidth: 300,
      renderCell: (params) => {
        const row = params.row;

        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              onClick={() => openStickerHistory(row.zohoItemId)}
              size="small"
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#f9fafb",
                border: "1px solid #d1d5db",
                color: "#374151",
                "&:hover": {
                  backgroundColor: "#eef2ff",
                  borderColor: "#6366f1",
                  color: "#4338ca",
                },
              }}
            >
              <DownloadOutlinedIcon fontSize="small" />
            </IconButton>
			<IconButton
			  onClick={() => openAuditLogs(row.zohoItemId)}
			  size="small"
			  sx={{
			    width: 32,
			    height: 32,
			    borderRadius: "8px",
			    backgroundColor: "#f9fafb",
			    border: "1px solid #d1d5db",
			    color: "#374151",
			  }}
			>
			  📜
			</IconButton>
            <span>{row.name}</span>
          </Box>
        );
      },
    },
    { field: "clientName", headerName: "Client", minWidth: 180 },
    {
      field: "packedAt",
      headerName: "Packed On",
      width: 160,
      valueGetter: p =>
        p.value ? new Date(p.value).toLocaleDateString() : "—",
    },
    {
      field: "status",
      headerName: "Status",
      width: 220,
      renderCell: (params) => {
        const row = params.row;

        if (isDispatch) {
          return (
            <select
              value={row.status}
              onChange={e =>
                updateStatus(row.zohoItemId, e.target.value)
              }
              style={statusSelect}
            >
              <option value="PACKED">PACKED</option>
              <option value="DISPATCHED">DISPATCHED</option>
            </select>
          );
        }

        return (
          <Chip
            label={row.status}
            size="small"
            sx={
              row.status === "DISPATCHED"
                ? statusDispatched
                : statusPacked
            }
          />
        );
      },
    },
    {
      field: "action",
      headerName: "",
      width: 380,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;

        const canAdminRequest =
          isAdmin && row.approvalStatus !== "PENDING";

        const canUserRequest =
          isPacking &&
          row.status === "PACKED" &&
          row.approvalStatus !== "PENDING";

        return (
          <Box sx={actionContainer}>
            {isAdmin && row.approvalStatus === "PENDING" && (
              <>
                <Button
                  size="small"
                  onClick={() => approveRestore(row.zohoItemId)}
                  sx={actionPrimary}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  onClick={() => rejectRestore(row.zohoItemId)}
                  sx={actionDanger}
                >
                  Reject
                </Button>
              </>
            )}

            {canAdminRequest && (
              <Button
                size="small"
                onClick={() => requestRestore(row.zohoItemId)}
                sx={actionSecondary}
              >
                Request Restore
              </Button>
            )}

            {canUserRequest && (
              <Button
                size="small"
                onClick={() => requestRestore(row.zohoItemId)}
                sx={actionSecondary}
              >
                Request Restore
              </Button>
            )}

            {isDispatch && (
              <Button size="small" disabled sx={actionSecondary}>
                Request Restore
              </Button>
            )}

            {row.approvalStatus === "PENDING" && (
              <Chip label="REQUESTED" size="small" sx={pendingChip} />
            )}
          </Box>
        );
      },
    },
  ];

  useEffect(() => {
    setLoading(true);
    fetch("/api/dispatched", { credentials: "include" })
      .then(res => res.json())
      .then(data =>
        setRows(data.map(d => ({ id: d.zohoItemId, ...d })))
      )
      .finally(() => setLoading(false));
  }, []);

  const getActionStyle = (action = "") => {
    const a = action.toLowerCase();

    if (a.includes("approved"))
      return { bg: "rgba(209,250,229,0.9)", color: "#065f46" };

    if (a.includes("rejected"))
      return { bg: "rgba(254,226,226,0.9)", color: "#7f1d1d" };

    if (a.includes("requested"))
      return { bg: "rgba(254,243,199,0.9)", color: "#92400e" };

    if (a.includes("dispatched"))
      return { bg: "rgba(209,250,229,0.6)", color: "#065f46" };

    if (a.includes("packed"))
      return { bg: "rgba(219,234,254,0.6)", color: "#1e40af" };

    if (a.includes("sticker"))
      return { bg: "rgba(224,231,255,0.9)", color: "#3730a3" };

    return { bg: "rgba(243,244,246,0.9)", color: "#374151" };
  };

  const getRoleChipStyle = (role) => {
    if (role === "ADMIN")
      return { bg: "#111827", color: "#fff" };

    if (role === "DISPATCH")
      return { bg: "#065f46", color: "#ecfdf5" };

    if (role === "USER")
      return { bg: "#1e40af", color: "#eff6ff" };

    return { bg: "#374151", color: "#f9fafb" };
  };
  
  const getDateGroupLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };


  return (
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>
      <div style={content}>
        <h2 style={pageTitle}>Dispatched Items</h2>

        <Box sx={legend}>
          <Chip label="PACKED" size="small" sx={statusPacked} />
          <Chip label="DISPATCHED" size="small" sx={statusDispatched} />
          <Chip label="REQUESTED" size="small" sx={pendingChip} />
        </Box>

        <div style={tableWrapper}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            density="compact"
            getRowClassName={(params) => {
              if (params.row.approvalStatus === "PENDING") return "row-pending";
              if (params.row.status === "DISPATCHED") return "row-dispatched";
              return "row-packed";
            }}
            sx={dataGridStyles}
          />
        </div>
      </div>
	  {historyOpen && (
	    <div
	      style={{
	        position: "fixed",
	        inset: 0,
	        background: "rgba(0,0,0,0.45)",
	        display: "flex",
	        alignItems: "center",
	        justifyContent: "center",
	        zIndex: 2000,
	      }}
	      onClick={() => setHistoryOpen(false)}
	    >
	      <div
	        style={{
	          width: 560,
	          maxHeight: "80vh",
	          background: "#fff",
	          borderRadius: 14,
	          padding: 18,
	          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
	          overflow: "auto",
	        }}
	        onClick={(e) => e.stopPropagation()}
	      >
	        <h3 style={{ marginBottom: 12 }}>
	          Sticker History
	        </h3>

	        {historyLoading && <p>Loading…</p>}

	        {!historyLoading && historyRows.length === 0 && (
	          <p>No sticker history found.</p>
	        )}

	        {!historyLoading && historyRows.map((h, idx) => (
	          <Box
	            key={h.id}
	            sx={{
	              display: "flex",
	              alignItems: "center",
	              justifyContent: "space-between",
	              mb: 1,
	              p: 1.2,
	              borderRadius: 8,
	              background:
	                idx === 0
	                  ? "rgba(209,250,229,0.6)"
	                  : "rgba(243,244,246,0.8)",
	            }}
	          >
	            <Box>
	              <div style={{ fontWeight: 600 }}>
	                {h.stickerNumber}
	              </div>
	              <div style={{ fontSize: 12, opacity: 0.75 }}>
	                {new Date(h.generatedAt).toLocaleString()}
	                {" • "}
	                {h.reason}
	              </div>
	            </Box>

	            <IconButton
	              onClick={() =>
	                window.open(
	                  `/api/stickers/history/${h.id}/download`,
	                  "_blank"
	                )
	              }
	              size="small"
	            >
	              <DownloadOutlinedIcon />
	            </IconButton>
	          </Box>
	        ))}

	        <Box sx={{ textAlign: "right", mt: 2 }}>
	          <Button onClick={() => setHistoryOpen(false)}>
	            Close
	          </Button>
	        </Box>
	      </div>
	    </div>
	  )}
	  {auditOpen && (
	    <div
	      style={{
	        position: "fixed",
	        inset: 0,
	        background: "rgba(0,0,0,0.45)",
	        display: "flex",
	        alignItems: "center",
	        justifyContent: "center",
	        zIndex: 2100,
	      }}
	      onClick={() => setAuditOpen(false)}
	    >
	      <div
	        style={{
	          width: 600,
	          maxHeight: "80vh",
	          background: "#fff",
	          borderRadius: 14,
	          padding: 18,
	          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
	          overflow: "auto",
	        }}
	        onClick={(e) => e.stopPropagation()}
	      >
	        <h3 style={{ marginBottom: 12 }}>
	          Activity Log
	        </h3>
			<Box
			  sx={{
			    display: "flex",
			    gap: 1.5,
			    mb: 2,
			    flexWrap: "wrap",
			  }}
			>
			  {/* ACTION FILTER */}
			  <select
			    value={actionFilter}
			    onChange={(e) => setActionFilter(e.target.value)}
			    style={{
			      padding: "6px 10px",
			      borderRadius: 8,
			      border: "1px solid #d1d5db",
			      fontSize: 12,
			      fontWeight: 600,
			    }}
			  >
			    <option value="ALL">All Actions</option>
			    <option value="REQUEST">Requests</option>
			    <option value="APPROVE">Approvals</option>
			    <option value="REJECT">Rejections</option>
			    <option value="DISPATCH">Dispatch</option>
			    <option value="PACK">Pack</option>
			    <option value="STICKER">Sticker</option>
			  </select>

			  {/* ROLE FILTER */}
			  <select
			    value={roleFilter}
			    onChange={(e) => setRoleFilter(e.target.value)}
			    style={{
			      padding: "6px 10px",
			      borderRadius: 8,
			      border: "1px solid #d1d5db",
			      fontSize: 12,
			      fontWeight: 600,
			    }}
			  >
			    <option value="ALL">All Roles</option>
			    <option value="ADMIN">Admin</option>
			    <option value="DISPATCH">Dispatch</option>
			    <option value="USER">Packing</option>
			  </select>
			</Box>

	        {auditLoading && <p>Loading…</p>}

	        {!auditLoading && auditRows.length === 0 && (
	          <p>No activity recorded.</p>
	        )}

			{!auditLoading &&
				Object.entries(
				  auditRows
				    .filter((log) => {
				      if (actionFilter !== "ALL") {
				        if (!log.action?.toUpperCase().includes(actionFilter)) return false;
				      }
				      if (roleFilter !== "ALL" && log.role !== roleFilter) return false;
				      return true;
				    })
				    .reduce((groups, log) => {
				      const label = getDateGroupLabel(log.performedAt);
				      if (!groups[label]) groups[label] = [];
				      groups[label].push(log);
				      return groups;
				    }, {})
				).map(([group, logs]) => (
				  <Box key={group} sx={{ mb: 2 }}>
				    {/* DATE HEADER */}
				    <div
				      style={{
				        fontWeight: 700,
				        fontSize: 13,
				        marginBottom: 6,
				        opacity: 0.7,
				      }}
				    >
				      {group}
				    </div>

				    {logs.map((log) => {
				      const actionStyle = getActionStyle(log.action);
				      const roleStyle = getRoleChipStyle(log.role);

				      return (
				        <Box
				          key={log.id}
				          sx={{
				            mb: 1.2,
				            p: 1.4,
				            borderRadius: 10,
				            background: actionStyle.bg,
				            display: "flex",
				            justifyContent: "space-between",
				            alignItems: "center",
				          }}
				        >
				          <Box>
				            <div style={{ fontWeight: 700, color: actionStyle.color }}>
				              {log.action}
				            </div>
				            <div style={{ fontSize: 12, opacity: 0.75 }}>
				              {new Date(log.performedAt).toLocaleString()}
				            </div>
				          </Box>

				          <Box sx={{ display: "flex", gap: 1 }}>
				            <Chip label={log.performedBy} size="small" />
				            <Chip
				              label={log.role}
				              size="small"
				              sx={{
				                background: roleStyle.bg,
				                color: roleStyle.color,
				              }}
				            />
				          </Box>
				        </Box>
				      );
				    })}
				  </Box>
				))}

	        <Box sx={{ textAlign: "right", mt: 2 }}>
	          <Button onClick={() => setAuditOpen(false)}>
	            Close
	          </Button>
	        </Box>
	      </div>
	    </div>
	  )}
    </div>
  );
}

/* ===================== STYLES ===================== */
/* (UNCHANGED — EXACTLY AS YOU PROVIDED) */

const page = {
  height: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #f5c542, #b8860b)",
  position: "relative",
  overflow: "hidden",
};

const backgroundText = {
  position: "absolute",
  fontSize: 180,
  fontWeight: 900,
  color: "rgba(255,255,255,0.12)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
};

const content = { position: "relative", zIndex: 1 };

const pageTitle = {
  marginBottom: 12,
  fontSize: 28,
  fontWeight: 700,
  color: "#fff",
};

const legend = {
  display: "flex",
  gap: 1.5,
  mb: 1.5,
};

/* ===== TABLE ===== */

const tableWrapper = {
  height: "calc(100vh - 170px)",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18))",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow:
    "0 22px 55px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
  padding: 12,
};

const dataGridStyles = {
  background: "#fff",
  borderRadius: 4,
  border: "none",

  "& .row-packed": {
    backgroundColor: "rgba(219,234,254,0.55)",
  },
  "& .row-dispatched": {
    backgroundColor: "rgba(209,250,229,0.55)",
  },
  "& .row-pending": {
    backgroundColor: "rgba(254,243,199,0.6)",
  },
  "& .MuiDataGrid-row:hover": {
    filter: "brightness(0.97)",
  },
};

/* ===== STATUS ===== */

const statusPacked = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#1e40af",
  background:
    "linear-gradient(180deg, rgba(191,219,254,0.95), rgba(147,197,253,0.95))",
};

const statusDispatched = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#065f46",
  background:
    "linear-gradient(180deg, rgba(167,243,208,0.95), rgba(110,231,183,0.95))",
};

const pendingChip = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#92400e",
  background:
    "linear-gradient(180deg, rgba(254,215,170,0.95), rgba(253,186,116,0.95))",
};

const statusSelect = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  fontSize: 11,
  fontWeight: 700,
};

/* ===== ACTIONS ===== */

const actionContainer = {
  display: "flex",
  gap: 1,
  flexWrap: "wrap",
};

const actionPrimary = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  background:
    "linear-gradient(180deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))",
};

const actionSecondary = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  background: "#fff",
  border: "1px solid #d1d5db",
};

const actionDanger = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  background:
    "linear-gradient(180deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))",
};

export default DispatchedItemsPage;
