import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Chip, Box, Button } from "@mui/material";

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

  /* ===================== COLUMNS ===================== */

  const columns = [
    { field: "name", headerName: "Item Name", flex: 1, minWidth: 300 },
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
            {/* ADMIN APPROVAL */}
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

            {/* ADMIN REQUEST */}
            {canAdminRequest && (
              <Button
                size="small"
                onClick={() => requestRestore(row.zohoItemId)}
                sx={actionSecondary}
              >
                Request Restore
              </Button>
            )}

            {/* PACKING USER */}
            {canUserRequest && (
              <Button
                size="small"
                onClick={() => requestRestore(row.zohoItemId)}
                sx={actionSecondary}
              >
                Request Restore
              </Button>
            )}

            {/* DISPATCH (DISABLED) */}
            {isDispatch && (
              <Button size="small" disabled sx={actionSecondary}>
                Request Restore
              </Button>
            )}

            {row.approvalStatus === "PENDING" && (
              <Chip
                label="REQUESTED"
                size="small"
                sx={pendingChip}
              />
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

  return (
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>
      <div style={content}>
        <h2 style={pageTitle}>Dispatched Items</h2>
        <div style={tableWrapper}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            density="compact"
            sx={dataGridStyles}
          />
        </div>
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

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
  marginBottom: 18,
  fontSize: 28,
  fontWeight: 700,
  color: "#fff",
};

const tableWrapper = {
  height: "calc(100vh - 140px)",
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
};

/* ===== STATUS STYLES ===== */

const statusPacked = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#1e40af",
  background:
    "linear-gradient(180deg, rgba(191,219,254,0.95), rgba(147,197,253,0.95))",
  boxShadow: "0 2px 6px rgba(59,130,246,0.35)",
};

const statusDispatched = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#065f46",
  background:
    "linear-gradient(180deg, rgba(167,243,208,0.95), rgba(110,231,183,0.95))",
  boxShadow: "0 2px 6px rgba(16,185,129,0.35)",
};

const pendingChip = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.6,
  borderRadius: "999px",
  color: "#92400e",
  background:
    "linear-gradient(180deg, rgba(254,215,170,0.95), rgba(253,186,116,0.95))",
  boxShadow: "0 2px 6px rgba(245,158,11,0.35)",
};

const statusSelect = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  fontSize: 11,
  fontWeight: 700,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(243,244,246,0.95))",
  boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
  cursor: "pointer",
};

/* ===== ACTION STYLES ===== */

const actionContainer = {
  display: "flex",
  gap: 1,
  flexWrap: "wrap",
  alignItems: "center",
};

const actionPrimary = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  textTransform: "none",
  background:
    "linear-gradient(180deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))",
  boxShadow: "0 4px 10px rgba(5,150,105,0.35)",
  transition: "all 0.25s ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 8px 18px rgba(5,150,105,0.45)",
  },
};

const actionSecondary = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "none",
  color: "#1f2937",
  background: "rgba(255,255,255,0.9)",
  border: "1px solid #d1d5db",
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  transition: "all 0.25s ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
  },
  "&.Mui-disabled": {
    opacity: 0.55,
  },
};

const actionDanger = {
  px: 2.2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  textTransform: "none",
  background:
    "linear-gradient(180deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))",
  boxShadow: "0 4px 10px rgba(185,28,28,0.35)",
  transition: "all 0.25s ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 8px 18px rgba(185,28,28,0.45)",
  },
};

export default DispatchedItemsPage;
