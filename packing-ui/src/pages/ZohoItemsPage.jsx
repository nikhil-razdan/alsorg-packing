import { useEffect, useState, useMemo  } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { fetchZohoItemsPaged } from "../api/zohoApi";
import { Drawer, Button, Divider, TextField, MenuItem, Box } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

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
  
  /* ===== SEARCH + FILTER ===== */
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("NONE");

  /* ===================== COLUMNS ===================== */
  const columns = [
    {
      field: "action",
      headerName: "",
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          disabled={generating}
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
            background:
              "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",
          }}
        >
          Generate
        </Button>
      ),
    },
    { field: "name", headerName: "Item Name", flex: 1, minWidth: 320 },
	{
	  field: "stock",
	  headerName: "Stock",
	  width: 100,
	  renderCell: (params) => (
	    <span
	      style={{
	        fontWeight: 700,
	        color: params.value === 0 ? "#ff6b6b" : "#4caf50",
	      }}
	    >
	      {params.value}
	    </span>
	  ),
	},
    { field: "sku", headerName: "SKU", minWidth: 260 },
  ];

  /* ===================== RELOAD FROM BACKEND ===================== */
  const reloadPage = async () => {
    setLoading(true);
    try {
      const data = await fetchZohoItemsPaged(
        paginationModel.page + 1,
        paginationModel.pageSize
      );
      setRows(data.items);
      setRowCount(data.total);
    } finally {
      setLoading(false);
    }
  };

  /* ===================== DATA LOAD ===================== */
  useEffect(() => {
    reloadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel]);

  /* ===== FILTERED ROWS ===== */
  const filteredRows = useMemo(() => {
    if (!search) return rows;

    return rows.filter((r) =>
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.sku?.toLowerCase().includes(search.toLowerCase())
    );
  }, [rows, search]);
  
  /* ===================== RENDER ===================== */
  return (
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
        <h2 style={pageTitle}>Packed Items</h2>
		
		<Box sx={searchPanel}>
		  <SearchIcon sx={{ opacity: 0.6 }} />

		  <TextField
		    variant="standard"
		    placeholder="Search by Item Name or SKU..."
		    value={search}
		    onChange={(e) => setSearch(e.target.value)}
		    InputProps={{ disableUnderline: true }}
		    sx={{ flex: 1, minWidth: 150 }}
		  />

		  <TextField
		    select
		    size="small"
		    value={groupBy}
		    onChange={(e) => setGroupBy(e.target.value)}
		    sx={{ flex: 1, minWidth: 150 }}
		  >
		    <MenuItem value="NONE">No Group</MenuItem>
		    <MenuItem value="SKU">Group by SKU</MenuItem>
		    <MenuItem value="NAME">Group by Name</MenuItem>
		  </TextField>
		</Box>
        <div style={tableWrapper}>
          <DataGrid
		    rows={filteredRows}
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
            getRowClassName={() => "row-packed"}
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

          <Divider sx={{ my: 2 }} />

          <Button
            disabled={generating}
            onClick={async () => {
              try {
                setGenerating(true);

                const genRes = await fetch(
                  `/api/packets/zoho/items/${selectedItem.zohoItemId}/generate-sticker`,
                  { method: "POST", credentials: "include" }
                );

                if (!genRes.ok && genRes.status !== 409) {
                  throw new Error("Sticker generation failed");
                }

                const pdfRes = await fetch(
                  `/api/stickers/zoho/${selectedItem.zohoItemId}`,
                  { credentials: "include" }
                );

                if (!pdfRes.ok) {
                  throw new Error("Failed to load sticker PDF");
                }

                const blob = await pdfRes.blob();
                setPdfUrl(URL.createObjectURL(blob));

                setRows((prev) =>
                  prev.filter((r) => r.zohoItemId !== selectedItem.zohoItemId)
                );
              } catch (e) {
                console.error(e);
                alert("Failed to generate or load sticker");
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
                style={{ borderRadius: 12, border: "1px solid #ddd" }}
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
  padding: 20,
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
  marginTop: 0,
  marginBottom: 12,
  fontSize: 28,
  fontWeight: 700,
  color: "#fff",
};

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
    filter: "brightness(0.97)",
  },

  "& .MuiDataGrid-cell": {
    fontSize: 13,
  },

  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid #e5e7eb",
  },

  "& .row-packed": {
    backgroundColor: "rgba(219,234,254,0.55)",
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
};

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 4,
  padding: "5px 18px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.35)",
  backdropFilter: "blur(16px)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  maxWidth: "100%",
};

export default ZohoItemsPage;
