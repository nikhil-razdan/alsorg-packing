import { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { fetchZohoItemsPaged } from "../api/zohoApi";
import { Drawer, Button, Divider } from "@mui/material";

function ZohoItemsPage() {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [generating, setGenerating] = useState(false);

  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 50,
  });

  /* ===================== COLUMNS ===================== */
  const columns = [
    {
      field: "action",
      headerName: "",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const isPacked = params.row.packed;

        return (
          <Button
            size="small"
            disabled={isPacked || generating}
            onClick={async () => {
              try {
                setGenerating(true);

                const res = await fetch(
                  `/api/packets/zoho/items/${params.row.zohoItemId}`,
                  { credentials: "include" }
                );

                if (!res.ok) throw new Error("Failed to load item details");

                const fullItem = await res.json();
                setSelectedItem(fullItem);
                setPdfUrl(null);
                setDrawerOpen(true);
              } catch (e) {
                alert(e.message);
              } finally {
                setGenerating(false);
              }
            }}
            sx={{
              px: 2,
              py: 0.6,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: "999px",
              textTransform: "none",
              color: "rgba(255,255,255,0.9)",
              background: isPacked
                ? "rgba(156,163,175,0.9)"
                : "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: isPacked
                ? "none"
                : "0 8px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.08)",
              "&:hover": {
                background: isPacked
                  ? "rgba(156,163,175,0.9)"
                  : "linear-gradient(180deg, rgba(17,24,39,0.95), rgba(2,6,23,0.95))",
                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
              },
              "&:disabled": {
                background: "rgba(156,163,175,0.85)",
                color: "#f3f4f6",
              },
            }}
          >
            {isPacked ? "Packed" : "Generate"}
          </Button>
        );
      },
    },
    {
      field: "name",
      headerName: "Item Name",
      flex: 1,
      minWidth: 320,
    },
    {
      field: "sku",
      headerName: "SKU",
      minWidth: 260,
      renderCell: (params) => (
        <span
          title={params.value}
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
            width: "100%",
            color: "#374151",
            fontSize: 13,
          }}
        >
          {params.value || "—"}
        </span>
      ),
    },
  ];

  /* ===================== DATA ===================== */
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchZohoItemsPaged(
          paginationModel.page + 1,
          paginationModel.pageSize
        );

        if (!active) return;

        setRows(
          data.items.map((item) => ({
            id: item.zohoItemId,
            ...item,
            packed: false, // UI-only
          }))
        );
        setRowCount(data.total);
      } catch {
        setRows([]);
        setRowCount(0);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => (active = false);
  }, [paginationModel]);

  /* ===================== RENDER ===================== */
  return (
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
        <h2 style={pageTitle}>Packed Items</h2>

        <div style={tableWrapper}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pagination
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[50, 100, 200]}
            disableRowSelectionOnClick
            density="compact"
            getRowId={(row) => row.zohoItemId}
            sx={dataGridStyles}
          />
        </div>
      </div>

      {/* ===================== DRAWER ===================== */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <div style={drawer}>
          <div style={drawerHighlight} />

          <h3 style={drawerTitle}>{selectedItem?.name}</h3>

          <Divider sx={{ my: 2 }} />

          <p><b>SKU:</b><br />{selectedItem?.sku || "—"}</p>
          <p><b>Location:</b> {selectedItem?.location ?? "—"}</p>
          <p><b>Client:</b> {selectedItem?.clientName ?? "—"}</p>
          <p><b>Address:</b> {selectedItem?.clientAddress ?? "—"}</p>

          <Divider sx={{ my: 2 }} />

          <Button
            disabled={generating}
            onClick={async () => {
              try {
                setGenerating(true);

                await fetch(
                  `/api/packets/zoho/items/${selectedItem.zohoItemId}/generate-sticker`,
                  { method: "POST", credentials: "include" }
                );

                const pdfRes = await fetch(
                  `/api/stickers/zoho/${selectedItem.zohoItemId}`,
                  { credentials: "include" }
                );

                const blob = await pdfRes.blob();
                setPdfUrl(URL.createObjectURL(blob));

                setRows((prev) =>
                  prev.map((r) =>
                    r.zohoItemId === selectedItem.zohoItemId
                      ? { ...r, packed: true }
                      : r
                  )
                );
              } finally {
                setGenerating(false);
              }
            }}
            sx={drawerButton}
          >
            Generate Sticker
          </Button>

          {pdfUrl && (
            <>
              <Divider sx={{ my: 2 }} />
              <iframe
                src={pdfUrl}
                width="100%"
                height="480"
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "#fff",
                }}
                title="Sticker Preview"
              />
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}

/* ===================== STYLES ===================== */

const page = {
  height: "100vh",
  padding: 28,
  boxSizing: "border-box",
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

const content = {
  position: "relative",
  zIndex: 1,
};

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
  borderRadius: 12,
  border: "none",
  "& .MuiDataGrid-columnHeaders": {
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 600,
  },
  "& .MuiDataGrid-row": {
    borderBottom: "1px solid #f1f5f9",
  },
  "& .MuiDataGrid-row:hover": {
    backgroundColor: "#f8fafc",
  },
  "& .MuiDataGrid-cell": {
    fontSize: 13,
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid #e5e7eb",
  },
};

/* ---------- Drawer ---------- */

const drawer = {
  width: 520,
  height: "100%",
  padding: 30,
  boxSizing: "border-box",
  position: "relative",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    "-20px 0 50px rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.4)",
  color: "#1f2937",
};

const drawerHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 80,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.5), transparent)",
  pointerEvents: "none",
};

const drawerTitle = {
  marginBottom: 4,
  fontSize: 22,
  fontWeight: 700,
};

const drawerButton = {
  mt: 1,
  px: 3,
  fontWeight: 600,
  borderRadius: "999px",
  textTransform: "none",
  color: "rgba(255,255,255,0.9)",
  background:
    "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow:
    "0 8px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.08)",
  "&:hover": {
    background:
      "linear-gradient(180deg, rgba(17,24,39,0.95), rgba(2,6,23,0.95))",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  "&:disabled": {
    background: "rgba(156,163,175,0.85)",
    color: "#f3f4f6",
  },
};

export default ZohoItemsPage;
