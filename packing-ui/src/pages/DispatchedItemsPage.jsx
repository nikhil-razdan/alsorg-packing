import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Chip, Box, Button } from "@mui/material";

/**
 * Dispatched Items Page
 * Phase 3 + 3.5
 * - Dispatch from PACKED → DISPATCHED
 * - Restore workflow
 * - Admin approve / reject
 * - Download sticker (history)
 */

function DispatchedItemsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const role = localStorage.getItem("role");
  const isAdmin = role === "ADMIN";
  const isDispatch = role === "DISPATCH";

  /* ===================== ACTION HANDLERS ===================== */

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
      setProcessingId(zohoItemId);

      const res = await fetch(
        `/api/dispatched/${zohoItemId}/approve-restore`,
        { method: "POST", credentials: "include" }
      );

      if (!res.ok) throw new Error();

      // item moves back to inventory → remove from this page
      setRows(prev => prev.filter(r => r.zohoItemId !== zohoItemId));
    } catch {
      alert("Approval failed");
    } finally {
      setProcessingId(null);
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

  const dispatchItem = async (zohoItemId) => {
    try {
      const res = await fetch(
        `/api/dispatched/${zohoItemId}/dispatch`,
        { method: "POST", credentials: "include" }
      );

      if (!res.ok) throw new Error();

      setRows(prev =>
        prev.map(r =>
          r.zohoItemId === zohoItemId
            ? { ...r, status: "DISPATCHED" }
            : r
        )
      );
    } catch {
      alert("Dispatch failed");
    }
  };

  /* ===================== COLUMNS ===================== */

  const columns = [
    {
      field: "name",
      headerName: "Item Name",
      flex: 1,
      minWidth: 300,
    },
    {
      field: "clientName",
      headerName: "Client",
      minWidth: 180,
    },
    {
      field: "packedAt",
      headerName: "Packed On",
      width: 160,
      valueGetter: (params) =>
        params.value
          ? new Date(params.value).toLocaleDateString()
          : "—",
    },
    {
      field: "status",
      headerName: "Status",
      width: 200,
      renderCell: (params) => {
        const row = params.row;

        // DISPATCH dropdown
        if (isDispatch && row.status === "PACKED") {
          return (
            <select
              defaultValue="PACKED"
              onChange={() => dispatchItem(row.zohoItemId)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 12,
                fontWeight: 600,
              }}
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
            sx={{
              fontWeight: 600,
              background:
                row.status === "DISPATCHED"
                  ? "rgba(59,130,246,0.15)"
                  : "rgba(16,185,129,0.15)",
              color:
                row.status === "DISPATCHED"
                  ? "#1e40af"
                  : "#065f46",
            }}
          />
        );
      },
    },
    {
      field: "action",
      headerName: "",
      width: 320,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;

        return (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {/* ADMIN APPROVAL */}
            {isAdmin && row.approvalStatus === "PENDING" && (
              <>
                <Button
                  size="small"
                  disabled={processingId === row.zohoItemId}
                  onClick={() => approveRestore(row.zohoItemId)}
                  sx={actionPrimary}
                >
                  Approve
                </Button>

                <Button
                  size="small"
                  disabled={processingId === row.zohoItemId}
                  onClick={() => rejectRestore(row.zohoItemId)}
                  sx={actionDanger}
                >
                  Reject
                </Button>
              </>
            )}

            {/* DOWNLOAD STICKER */}
            {row.stickerNumber && (
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  window.open(
                    `/api/stickers/zoho/${row.zohoItemId}/download`,
                    "_blank"
                  )
                }
              >
                Download Sticker
              </Button>
            )}

            {/* USER RESTORE */}
            {!isAdmin && row.approvalStatus !== "PENDING" && (
              <Button
                size="small"
                onClick={() => requestRestore(row.zohoItemId)}
                sx={actionSecondary}
              >
                Request Restore
              </Button>
            )}

            {/* REQUESTED TAG */}
            {row.approvalStatus === "PENDING" && !isAdmin && (
              <Chip
                label="REQUESTED"
                size="small"
                sx={{
                  fontWeight: 600,
                  background: "rgba(245,158,11,0.15)",
                  color: "#92400e",
                }}
              />
            )}
          </Box>
        );
      },
    },
  ];

  /* ===================== DATA ===================== */

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dispatched", {
          credentials: "include",
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        if (!active) return;

        setRows(
          data.map(item => ({
            id: item.zohoItemId,
            ...item,
          }))
        );
      } catch {
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => (active = false);
  }, []);

  /* ===================== RENDER ===================== */

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
            getRowId={(row) => row.id}
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

/* ---------- Buttons ---------- */

const actionPrimary = {
  px: 2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  background:
    "linear-gradient(180deg, rgba(16,185,129,0.9), rgba(5,150,105,0.9))",
};

const actionSecondary = {
  px: 2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1f2937",
  border: "1px solid #d1d5db",
};

const actionDanger = {
  px: 2,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  color: "#fff",
  background:
    "linear-gradient(180deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9))",
};

export default DispatchedItemsPage;
