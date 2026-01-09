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
      headerName: "Action",
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
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
        >
          GENERATE
        </Button>
      ),
    },
    {
      field: "name",
      headerName: "Item Name",
      flex: 1,
      minWidth: 300,
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
          }}
        >
          {params.value || "-"}
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
          }))
        );
        setRowCount(data.total);
      } catch (e) {
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
    <div
      style={{
        height: "100vh",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Packed Items</h2>

      {/* 🔒 SINGLE SCROLL OWNER */}
      <div
        style={{
          height: "calc(100vh - 140px)",
          width: "100%",
        }}
      >
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
          sx={{
            backgroundColor: "#fff",
            borderRadius: 2,
            boxShadow: 1,

            /* 🔒 ABSOLUTE SCROLL FIX */
            "& .MuiDataGrid-virtualScroller": {
              overflowX: "hidden",
            },

            "& .MuiDataGrid-main": {
              overflowX: "hidden",
            },

            "& .MuiDataGrid-footerContainer": {
              minHeight: 52,
              borderTop: "1px solid #e0e0e0",
            },

            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f5f7fa",
              fontWeight: "bold",
            },
          }}
        />
      </div>

      {/* ===================== DRAWER ===================== */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <div style={{ width: 520, padding: 20 }}>
          <h3>{selectedItem?.name}</h3>
          <Divider sx={{ my: 2 }} />

          <p><b>SKU:</b><br />{selectedItem?.sku || "—"}</p>
          <p><b>Location:</b> {selectedItem?.location ?? "—"}</p>
          <p><b>Client:</b> {selectedItem?.clientName ?? "—"}</p>
          <p><b>Address:</b> {selectedItem?.clientAddress ?? "—"}</p>

          <Divider sx={{ my: 2 }} />

          <Button
            variant="outlined"
            size="small"
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
              } finally {
                setGenerating(false);
              }
            }}
          >
            Generate Sticker
          </Button>

          {pdfUrl && (
            <>
              <Divider sx={{ my: 2 }} />
              <iframe
                src={pdfUrl}
                width="100%"
                height="500"
                style={{ border: "1px solid #ccc" }}
                title="Sticker Preview"
              />
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}

export default ZohoItemsPage;
