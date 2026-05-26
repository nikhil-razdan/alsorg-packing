import { useEffect, useState} from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Drawer,
  Button,
  Divider,
  TextField,
  MenuItem,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import { Stepper, Step, StepLabel } from "@mui/material";
import { motion } from "framer-motion";
import { FormControlLabel, Switch } from "@mui/material";

function ZohoItemsPage() {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [addMoreOpen, setAddMoreOpen] = useState(false);
  const [addCount, setAddCount] = useState(1);
  

  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [detailsPopup, setDetailsPopup] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [customPacketNo, setCustomPacketNo] = useState("");
  const [customCreateOpen, setCustomCreateOpen] = useState(false);
  const [customAddOpen, setCustomAddOpen] = useState(false);
  const [weights, setWeights] = useState([]);
  const [dimensionsList, setDimensionsList] = useState([]);
  const [remarksList, setRemarksList] = useState([]);
  
  /* ===== SEARCH + FILTER ===== */
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("NONE");
  const [createOpen, setCreateOpen] = useState(false);
  const [descriptions, setDescriptions] = useState([]);
  const [form, setForm] = useState({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    dimensions: "",
    weight: "",
    remarks: "",
    numberOfPackets: 1,
	showCompanyHeader: true,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [editForm, setEditForm] = useState({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    description: "",
    weight: "",
    dimensions: "",
    remarks: "",
    location: "",
    packetNumber: "",
  });

  /* ===================== COLUMNS ===================== */
  const columns = [
	{
	  field: "action",
	  headerName: "Generate",
	  width: 150,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      ⚙️ <span style={{ fontWeight: 700 }}>Generate</span>
	    </Box>
	  ),

	  sortable: false,

	  renderCell: (params) => (
        <Button
          size="small"
          disabled={generating || !!params.row.stickerNumber}
          onClick={async () => {
            try {
              setGenerating(true);
              setSelectedItem(params.row);
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
	{
	  field: "addMore",
	  headerName: "Add Packets",
	  width: 170,
	  sortable: false,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      ➕ <span style={{ fontWeight: 700 }}>Add Packets</span>
	    </Box>
	  ),

	  renderCell: (params) => {
	    const masterId = params.row.masterItemId;

	    // 🔥 SAFELY EXTRACT CURRENT PACKET NUMBER
	    const current = getPacketNumber(params.row.sku) || 0;

	    // 🔥 SAFELY GET MAX
	    const max = maxPacketMap?.[masterId] || 0;

	    // 🔥 FIX: allow >= (sometimes mismatch happens)
	    const isLast = current >= max;

	    

	    const currentCount = rows.filter(
	      (r) => r.masterItemId === masterId
	    ).length;

		// 🔥 REMOVE HARD LIMIT LOGIC
		const isLimitReached = false;

	    // 🧠 DEBUG (remove later)
	    // console.log({ current, max, total, currentCount });

	    // ❌ NOT LAST → NO BUTTON
	    if (!isLast) return null;

		return (
		  <Box sx={{ display: "flex", gap: 1 }}>
		    {/* NORMAL ADD */}
		    <Button
		      size="small"
		      disabled={isLimitReached}
		      onClick={() => {
		        setSelectedItem(params.row);
		        setAddCount(1);

		        setDescriptions([]);
		        setWeights([]);
		        setDimensionsList([]);
		        setRemarksList([]);

		        setAddMoreOpen(true);
		      }}
		      sx={{
		        px: 2,
		        py: 0.6,
		        fontSize: 12,
		        fontWeight: 600,
		        borderRadius: "999px",
		        textTransform: "none",
		        color: "#fff",
		        background: "linear-gradient(180deg, #2563eb, #1e3a8a)",
		      }}
		    >
		      + Add
		    </Button>

		    {/* 🔥 NEW CUSTOM BUTTON */}
		    <Button
		      size="small"
		      onClick={() => {
		        setSelectedItem(params.row);
		        setCustomPacketNo("");
		        setCustomAddOpen(true);
		      }}
		      sx={{
		        px: 2,
		        py: 0.6,
		        fontSize: 12,
		        fontWeight: 600,
		        borderRadius: "999px",
		        textTransform: "none",
		        color: "#fff",
		        background: "linear-gradient(180deg, #059669, #065f46)",
		      }}
		    >
		      + Custom
		    </Button>
		  </Box>
		);
	  }
	},
	{
	  field: "edit",
	  headerName: "Edit",
	  width: 120,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      ✏️ <span style={{ fontWeight: 700 }}>Edit</span>
	    </Box>
	  ),

	  sortable: false,

	  renderCell: (params) => (
	    <Button
	      size="small"
	      onClick={() => {
	        setEditItem(params.row);

	        setEditForm({
	          itemName: params.row.itemName || "",
	          pdNo: params.row.pdNo || "",
	          drawingNo: params.row.drawingNo || "",
	          clientName: params.row.clientName || "",
	          clientAddress: params.row.clientAddress || "",
	          floor: params.row.floor || "",
	          description: params.row.description || "",
	          weight: params.row.weight || "",
	          dimensions: params.row.dimensions || "",
	          remarks: params.row.remarks || "",
	          location: params.row.location || "",
	          packetNumber: params.row.packetNumber || "",
	          stickerNumber: params.row.stickerNumber,
	        });

	        setEditOpen(true);
	      }}
	      sx={{
	        px: 2,
	        py: 0.6,
	        fontSize: 12,
	        fontWeight: 600,
	        borderRadius: "999px",
	        textTransform: "none",
	        color: "#fff",
	        background:
	          "linear-gradient(180deg, #f59e0b, #b45309)",
	      }}
	    >
	      Edit
	    </Button>
	  ),
	},
	{
	  field: "delete",
	  headerName: "Delete",
	  width: 120,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      🗑️ <span style={{ fontWeight: 700 }}>Delete</span>
	    </Box>
	  ),

	  sortable: false,

	  renderCell: (params) => {
	    const isDeletable =
	      params.row.status === "CREATED" && !params.row.stickerNumber;

	    return (
	      <Button
	        size="small"
	        disabled= {false}
	        onClick={async () => {
	          if (!window.confirm("Delete this item?")) return;

	          try {
	            await fetch(
	              `${API_BASE_URL}/api/packets/items/${params.row.itemId}`,
	              {
	                method: "DELETE",
	                headers: {
	                  Authorization: `Bearer ${localStorage.getItem("token")}`,
	                },
	              }
	            );

	            fetchItems(); // refresh
	          } catch (e) {
	            alert("Delete failed");
	          }
	        }}
			sx={{
			  px: 2,
			  py: 0.6,
			  fontSize: 12,
			  fontWeight: 600,
			  borderRadius: "999px",
			  textTransform: "none",
			  color: "#fff",
			  opacity: isDeletable ? 1 : 0.85, 
			  background: isDeletable
			    ? "linear-gradient(180deg, #dc2626, #7f1d1d)"  
			    : "linear-gradient(180deg, #4b5563, #1f2937)", 
			  boxShadow: isDeletable
			    ? "0 4px 12px rgba(220,38,38,0.4)"
			    : "0 2px 6px rgba(0,0,0,0.25)", 
				"&:hover": {
				  filter: "brightness(1.1)",
				  transform: "translateY(-1px)",
				}
			}}
	      >
	        Delete
	      </Button>
	    );
	  },
	},
	{
	  field: "itemName",
	  headerName: "Item Name",
	  flex: 1,
	  minWidth: 320,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      📦 <span style={{ fontWeight: 700 }}>Item Name</span>
	    </Box>
	  ),
	},

	{
	  field: "sku",
	  headerName: "SKU",
	  minWidth: 260,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      🔖 <span style={{ fontWeight: 700 }}>SKU</span>
	    </Box>
	  ),
	},

	{
	  field: "pdNo",
	  headerName: "PD No",
	  width: 140,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      🧾 <span style={{ fontWeight: 700 }}>PD No</span>
	    </Box>
	  ),
	},

	{
	  field: "drawingNo",
	  headerName: "Drawing No",
	  width: 160,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      📐 <span style={{ fontWeight: 700 }}>Drawing No</span>
	    </Box>
	  ),
	},

	{
	  field: "clientName",
	  headerName: "Client",
	  width: 180,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      🏢 <span style={{ fontWeight: 700 }}>Client</span>
	    </Box>
	  ),
	},

	{
	  field: "clientAddress",
	  headerName: "Address",
	  width: 220,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      📍 <span style={{ fontWeight: 700 }}>Address</span>
	    </Box>
	  ),
	},

	{
	  field: "description",
	  headerName: "Description",
	  width: 200,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      📝 <span style={{ fontWeight: 700 }}>Description</span>
	    </Box>
	  ),
	},
  ];

  const fetchItems = async () => {
    setLoading(true);
    try {
		const res = await fetch(`${API_BASE_URL}/api/packets/items`, {
		  headers: {
		    Authorization: `Bearer ${localStorage.getItem("token")}`,
		  },
		});

		if (!res.ok) {
		  const text = await res.text();
		  console.error("API ERROR:", text);
		  throw new Error("Failed to fetch items");
		}

		const data = await res.json();

		if (!Array.isArray(data)) {
		  console.error("Invalid API:", data);
		  setRows([]);
		  return;
		}

		setRows(data);
      setRowCount(data.length);
    } finally {
      setLoading(false);
    }
  };
  
  const getPacketNumber = (sku) => {
    const match = sku?.match(/Pkt-(\d+)/);
    return match ? Number(match[1]) : 0;
  };
  
  // 🔥 FIND LAST PACKET PER MASTER ITEM
  const maxPacketMap = {};

  rows.forEach((r) => {
    const key = r.masterItemId || r.itemName;
    const pktNo = getPacketNumber(r.sku);

    if (!maxPacketMap[key] || pktNo > maxPacketMap[key]) {
      maxPacketMap[key] = pktNo;
    }
  });
  
  const validateStep1 = () => {
    let err = {};

    if (!form.itemName) err.itemName = "Required";
    if (!form.numberOfPackets || form.numberOfPackets <= 0)
      err.numberOfPackets = "Invalid";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validatePackets = () => {
    let valid = true;
    let err = {};

    weights.forEach((w, i) => {
      if (!w) {
        err[`weight-${i}`] = "Required";
        valid = false;
      }
    });

    setErrors(err);
    return valid;
  };
  
  useEffect(() => {
    fetchItems();
  }, []);
  
  useEffect(() => {
    const count = Number(form.numberOfPackets || 0);

    const adjust = (arrSetter) => {
      arrSetter(prev => {
        const copy = [...prev];
        while (copy.length < count) copy.push("");
        return copy.slice(0, count);
      });
    };

    adjust(setDescriptions);
    adjust(setWeights);
    adjust(setDimensionsList);
    adjust(setRemarksList);

  }, [form.numberOfPackets]);
  /* ===================== RENDER ===================== */
  return (
    <div style={page()}>
      <div style={backgroundText(darkMode)}>Alsorg</div>

      <div style={content}>
	  <Box
	    sx={{
	      display: "flex",
	      alignItems: "center",
	      justifyContent: "space-between",
	      mb: 2,
	    }}
	  >
	    <Box>
	      <h2
	        style={{
	          margin: 0,
	          fontSize: 28,
	          fontWeight: 800,
	          color: darkMode ? "#FFD700" : "#0f172a",
	        }}
	      >
	        Inventory Items
	      </h2>

	      <div
	        style={{
	          fontSize: 13,
	          color: darkMode
	            ? "rgba(255,215,0,0.75)"
	            : "#64748b",
	          marginTop: 4,
	        }}
	      >
	        Manage packed inventory and stickers
	      </div>
	    </Box>

	    <Box sx={{ display: "flex", gap: 1.5 }}>
	      <Button onClick={() => setDarkMode(!darkMode)} sx={themeBtn(darkMode)}>
	        {darkMode ? "☀ Classic" : "🌙 Dark"}
	      </Button>

	      <Box
	        sx={{
	          px: 2,
	          py: 0.6,
	          borderRadius: "999px",
	          background: darkMode ? "#111" : "#e0f2fe",
	          color: darkMode ? "#FFD700" : "#0369a1",
	          fontWeight: 700,
	          fontSize: 12,
	        }}
	      >
	        {rowCount} Items
	      </Box>
	    </Box>
	  </Box>
	  <Box sx={{ display: "flex", gap: 1.5, mb: 1 }}>
	    <Button
	      variant="contained"
	      onClick={() => {
	        setActiveStep(0);
	        setCreateOpen(true);
	      }}
	      sx={{
	        px: 2.6,
	        py: 1,
	        borderRadius: "999px",
	        fontWeight: 600,
	        background: "#4f46e5",
	        color: "#fff",
	        "&:hover": { background: "#4338ca" }
	      }}
	    >
	      Create Item
	    </Button>

	    <Button
	      variant="outlined"
	      onClick={() => {
	        setCustomPacketNo("");
	        setCustomCreateOpen(true);
	      }}
	      sx={{
	        borderRadius: "999px",
	        fontWeight: 600
	      }}
	    >
	      + Custom Packet
	    </Button>
	  </Box>
		<Box sx={searchPanel}>
		<SearchIcon
		  sx={{
		    opacity: 0.75,
		    color: darkMode
		      ? "#FFD700"
		      : "rgba(0,0,0,0.55)",
		  }}
		/>

		  <TextField
		    variant="standard"
		    placeholder="Search by Item Name or SKU..."
		    value={search}
		    onChange={(e) => setSearch(e.target.value)}
		    InputProps={{ disableUnderline: true }}
			sx={{
			  flex: 1,

			  "& .MuiInputBase-root": {
			    height: 40,
			    borderRadius: "18px",
			    padding: "0 8px",
			    background: "rgba(255,255,255,0.55)",
			    border: "1px solid rgba(255,255,255,0.35)",
			    transition: "all 0.25s ease",
			  },

			  "& input": {
			    fontSize: 14,
			    fontWeight: 500,
			    color: "#111",
			  },

			  "& input::placeholder": {
			    color: "rgba(0,0,0,0.45)",
			  },

			  "& .MuiInputBase-root:hover": {
			    background: "#fff",
			  },

			  "& .Mui-focused": {
			    background: "#fff",
			    boxShadow: "0 0 0 2px rgba(59,130,246,0.3)",
			  },
			}}
		  />
		  <TextField
		    select
		    size="small"
		    value={groupBy}
		    onChange={(e) => setGroupBy(e.target.value)}
			sx={{
			  flex: 1,
			  minWidth: 150,

			  "& .MuiInputBase-root": {
			    height: 40,

			    borderRadius: "18px",

			    padding: "0 10px",

			    background: darkMode
			      ? "rgba(255,255,255,0.03)"
			      : "rgba(255,255,255,0.55)",

			    color: darkMode ? "#fff" : "#111",

			    border: darkMode
			      ? "1px solid rgba(255,215,0,0.08)"
			      : "1px solid rgba(255,255,255,0.35)",

			    transition: "all 0.25s ease",
			  },

			  "& input": {
			    color: darkMode ? "#fff" : "#111",
			    fontWeight: 500,
			  },

			  "& input::placeholder": {
			    color: darkMode
			      ? "rgba(255,255,255,0.45)"
			      : "rgba(0,0,0,0.45)",
			    opacity: 1,
			  },

			  "& .MuiSvgIcon-root": {
			    color: darkMode ? "#FFD700" : "#111",
			  },

			  "& .MuiSelect-select": {
			    color: darkMode ? "#fff" : "#111",
			    display: "flex",
			    alignItems: "center",
			  },
			}}
			slotProps={{
			  select: {
			    MenuProps: {
			      PaperProps: {
			        sx: {
			          mt: 1,
			          borderRadius: "18px",

			          background: darkMode
			            ? "rgba(15,15,15,0.96)"
			            : "rgba(255,255,255,0.96)",

			          color: darkMode ? "#fff" : "#111",

			          border: darkMode
			            ? "1px solid rgba(255,215,0,0.12)"
			            : "1px solid rgba(0,0,0,0.06)",

			          backdropFilter: "blur(18px)",

			          "& .MuiMenuItem-root": {
			            color: darkMode ? "#fff" : "#111",
			          },

			          "& .Mui-selected": {
			            background: darkMode
			              ? "rgba(255,215,0,0.14) !important"
			              : "rgba(59,130,246,0.12) !important",

			            color: darkMode ? "#FFD700" : "#2563eb",
			          },
			        },
			      },
			    },
			  },
			}}
		  >
		    <MenuItem value="NONE">No Group</MenuItem>
		    <MenuItem value="SKU">Group by SKU</MenuItem>
		    <MenuItem value="NAME">Group by Name</MenuItem>
		  </TextField>
		</Box>
		
        <div style={tableWrapper}>
          <DataGrid
		    rows={rows}
			rowCount={rowCount}
            columns={columns}
            loading={loading}
            density="compact"
            getRowId={(row) => row.itemId}
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
        <div style={drawer(darkMode)}>
          <div style={drawerHighlight} />
          <h3 style={drawerTitle(darkMode)}>{selectedItem?.itemName}</h3>

          <Divider sx={{ my: 2 }} />

          <p><b>SKU:</b><br />{selectedItem?.sku || "—"}</p>
          <p><b>Location:</b> {selectedItem?.location ?? "—"}</p>

          <Divider sx={{ my: 2 }} />
		  <FormControlLabel
		    control={
		      <Switch
		        checked={form.showCompanyHeader}
		        onChange={(e) =>
		          setForm((prev) => ({
		            ...prev,
		            showCompanyHeader: e.target.checked,
		          }))
		        }
		      />
		    }
		    label="Show Company Header"
		    sx={{
		      mb: 1,
		      "& .MuiFormControlLabel-label": {
		        fontWeight: 500,
		        fontSize: 13,
		      },
		    }}
		  />
		  <TextField
		    label="Packing Floor"
		    fullWidth
		    value={form.factoryFloor || ""}
		    onChange={(e) =>
		      setForm((prev) => ({
		        ...prev,
		        factoryFloor: e.target.value,
		      }))
		    }
		    sx={formFieldSx(darkMode)}
		  />
		  <Button
		    disabled={generating}
			onClick={async () => {
			  try {
			    setGenerating(true);			    
			//	if (!form.factoryFloor) {
			//	  alert("Factory Floor is required");
			//	  setGenerating(false);
			//	  return;
			//	}
			    const genRes = await fetch(
			      `${API_BASE_URL}/api/packets/items/${selectedItem.itemId}/generate-sticker?factoryFloor=${encodeURIComponent(form.factoryFloor)}&showCompanyHeader=${form.showCompanyHeader}`,
			      {
			        method: "POST",
			        headers: {
			          Authorization: `Bearer ${localStorage.getItem("token")}`,
			        },
			      }
			    );

				const contentType = genRes.headers.get("content-type");

				if (!contentType?.includes("pdf")) {
				  const text = await genRes.text();
				  console.error("NOT PDF:", text);
				  throw new Error("Invalid response");
				}

			    // 🔥 STEP 3: SHOW PDF
			    const blob = await genRes.blob();
			    const url = URL.createObjectURL(blob);
			    setPdfUrl(url);

			  } catch (e) {
			    console.error(e);
			    alert("Failed to generate sticker");
			  } finally {
			    setGenerating(false);
			  }
			}}
		    sx={drawerButton(darkMode)}
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
	  <Drawer
	    anchor="right"
	    open={createOpen}
	    onClose={() => setCreateOpen(false)}
	  >
	    <div style={drawer(darkMode)}>
		<Stepper activeStep={activeStep} sx={{ mb: 3 }}>
		    <Step><StepLabel>Item Info</StepLabel></Step>
		    <Step><StepLabel>Packet Details</StepLabel></Step>
		    <Step><StepLabel>Done</StepLabel></Step>
		  </Stepper>
	      <h3>Create Item</h3>

	      {		  [
		    "itemName",
		    "pdNo",
		    "drawingNo",
		    "clientName",
		    "clientAddress",
		    "floor",
		    "numberOfPackets",
		  ].map((field) => (
	        <TextField
	          key={field}
	          label={field}
	          fullWidth
	          type={field === "numberOfPackets" ? "number" : "text"}
	          value={form[field]}
			  onChange={(e) =>
			    setForm((prev) => ({
			      ...prev,
			      [field]:
			        field === "numberOfPackets"
			          ? Number(e.target.value)
			          : e.target.value,
			    }))
			  }
			  error={!!errors[field]}                // ✅ ADD
			  helperText={errors[field]}  
	          sx={formFieldSx(darkMode)}
	        />
	      ))}
		  <Button
		    variant="contained"
		    onClick={() => {
		      if (!validateStep1()) return;
		      setActiveStep(1);
		      setDetailsPopup(true);
		    }}
		  >
		    Continue →
		  </Button>
	    </div>
	  </Drawer>
	  <Dialog
	    open={detailsPopup}
	    onClose={() => setDetailsPopup(false)}
	    fullWidth
	    maxWidth="sm"
	    PaperProps={{
	      sx: {
	        borderRadius: "24px",

	        background: darkMode
	          ? "linear-gradient(180deg,#111,#0b0b0b)"
	          : "#ffffff",

	        color: darkMode ? "#fff" : "#111",

	        border: darkMode
	          ? "1px solid rgba(255,215,0,0.12)"
	          : "none",

	        boxShadow: darkMode
	          ? "0 30px 80px rgba(0,0,0,0.8)"
	          : "0 20px 50px rgba(0,0,0,0.2)",
	      },
	    }}
	  >
	    <DialogTitle sx={{ fontWeight: 700 }}>
	      Packet Details
	    </DialogTitle>

		<DialogContent
		  dividers
		  sx={{
		    borderColor: darkMode
		      ? "rgba(255,215,0,0.08)"
		      : "rgba(0,0,0,0.08)",
		  }}
		>
	      {descriptions.map((_, i) => (
			<motion.div
			    key={i}
			    initial={{ opacity: 0, y: 20 }}
			    animate={{ opacity: 1, y: 0 }}
			    transition={{ delay: i * 0.05 }}
			  >
			    <Box
			      sx={{
			        mb: 2,
			        p: 2,
			        borderRadius: 3,
					background: darkMode
					  ? "rgba(255,255,255,0.03)"
					  : "rgba(0,0,0,0.03)",

					border: darkMode
					  ? "1px solid rgba(255,215,0,0.08)"
					  : "1px solid rgba(0,0,0,0.05)",
			      }}
	        >
	          <b style={{ display: "block", marginBottom: 8 }}>
	            Packet {i + 1}
	          </b>

	          <TextField
	            label="Description"
	            fullWidth
	            value={descriptions[i]}
	            onChange={(e) => {
	              const copy = [...descriptions];
	              copy[i] = e.target.value;
	              setDescriptions(copy);
	            }}
				sx={{
				  ...formFieldSx(darkMode),
				  mb: 1,
				}}
	          />

	          <TextField
	            label="Weight"
	            fullWidth
	            value={weights[i]}
	            onChange={(e) => {
	              const copy = [...weights];
	              copy[i] = e.target.value;
	              setWeights(copy);
	            }}
				error={!!errors[`weight-${i}`]}          
				helperText={errors[`weight-${i}`]}
				sx={{
				  ...formFieldSx(darkMode),
				  mb: 1,
				}}
	          />

			  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
			    <TextField
			      label="L"
			      type="number"
			      value={dimensionsList[i]?.l || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], l: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>x</span>

			    <TextField
			      label="B"
			      type="number"
			      value={dimensionsList[i]?.b || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], b: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>x</span>

			    <TextField
			      label="H"
			      type="number"
			      value={dimensionsList[i]?.h || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], h: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>inches</span>
			  </Box>

	          <TextField
	            label="Remarks"
	            fullWidth
	            value={remarksList[i]}
	            onChange={(e) => {
	              const copy = [...remarksList];
	              copy[i] = e.target.value;
	              setRemarksList(copy);
	            }}
				sx={formFieldSx(darkMode)}
	          />
			  </Box>
			  </motion.div>
	      ))}
	    </DialogContent>

	    <DialogActions 		
		sx={{
		  borderTop: darkMode
		    ? "1px solid rgba(255,215,0,0.08)"
		    : "1px solid rgba(0,0,0,0.06)",

		  background: darkMode
		    ? "#0b0b0b"
		    : "#fff",
		}}>
	      <Button onClick={() => setDetailsPopup(false)}>
	        Cancel
	      </Button>

		  <Button
		    variant="contained"
		    onClick={async () => {
		      if (!validatePackets()) return;

		      await fetch(`${API_BASE_URL}/api/packets/create`, {
		        method: "POST",
		        headers: {
		          "Content-Type": "application/json",
		          Authorization: `Bearer ${localStorage.getItem("token")}`,
		        },
		        body: JSON.stringify({
		          ...form,
		          descriptions,
		          weights,
				  dimensionsList: dimensionsList.map((d) =>
				    d?.l && d?.b && d?.h
				      ? `${d.l} L x ${d.b} B x ${d.h} H inches`
				      : ""
				  ),
		          remarksList,
		        }),
		      });

			  setActiveStep(2);
			  setDetailsPopup(false);
			  fetchItems();

			  setTimeout(() => {
			    setCreateOpen(false);
			    setActiveStep(0);
			  }, 800);
		    }}
		  >
		    Create Packets
		  </Button>
	    </DialogActions>
	  </Dialog>
	  <Dialog
	    open={customCreateOpen}
	    onClose={() => setCustomCreateOpen(false)}
	    fullWidth
	    maxWidth="sm"
	  >
	    <DialogTitle>Create Custom Packet</DialogTitle>

	    <DialogContent>

	      {/* 🔥 STEP 1: ITEM DETAILS */}
	      {[
	        "itemName",
	        "pdNo",
	        "drawingNo",
	        "clientName",
	        "clientAddress",
	        "floor",
	      ].map((field) => (
	        <TextField
	          key={field}
	          label={field}
	          fullWidth
	          value={form[field]}
	          onChange={(e) =>
	            setForm((prev) => ({
	              ...prev,
	              [field]: e.target.value,
	            }))
	          }
	          sx={formFieldSx(darkMode)}
	        />
	      ))}

	      {/* 🔥 CUSTOM PACKET NUMBER */}
	      <TextField
	        label="Custom Packet Number"
	        type="number"
	        fullWidth
	        value={customPacketNo}
	        onChange={(e) => setCustomPacketNo(e.target.value)}
	        sx={formFieldSx(darkMode)}
	      />

	      {/* 🔥 PACKET DETAILS (SINGLE ONLY) */}
	      <TextField
	        label="Description"
	        fullWidth
	        value={descriptions[0] || ""}
	        onChange={(e) => setDescriptions([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	      <TextField
	        label="Weight"
	        fullWidth
	        value={weights[0] || ""}
	        onChange={(e) => setWeights([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	      {/* DIMENSIONS */}
	      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
	        {["l", "b", "h"].map((key, idx) => (
	          <TextField
	            key={key}
	            label={key.toUpperCase()}
	            type="number"
	            value={dimensionsList[0]?.[key] || ""}
	            onChange={(e) => {
	              const copy = [...dimensionsList];
	              copy[0] = { ...copy[0], [key]: e.target.value };
	              setDimensionsList(copy);
	            }}
	            sx={{ width: 90 }}
	          />
	        ))}
	      </Box>

	      <TextField
	        label="Remarks"
	        fullWidth
	        value={remarksList[0] || ""}
	        onChange={(e) => setRemarksList([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	    </DialogContent>

	    <DialogActions>
	      <Button onClick={() => setCustomCreateOpen(false)}>Cancel</Button>

	      <Button
	        variant="contained"
	        disabled={!customPacketNo}
	        onClick={async () => {
	          try {
	            await fetch(`${API_BASE_URL}/api/packets/create-custom`, {
	              method: "POST",
	              headers: {
	                "Content-Type": "application/json",
	                Authorization: `Bearer ${localStorage.getItem("token")}`,
	              },
	              body: JSON.stringify({
	                ...form,
	                customPacketNumber: Number(customPacketNo),
	                descriptions,
	                weights,
	                dimensionsList: dimensionsList.map((d) =>
	                  d?.l && d?.b && d?.h
	                    ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                    : ""
	                ),
	                remarksList,
	              }),
	            });

	            setCustomCreateOpen(false);
	            fetchItems();

	          } catch (e) {
	            alert("Failed to create custom packet");
	          }
	        }}
	      >
	        Create
	      </Button>
	    </DialogActions>
	  </Dialog>
	  <Dialog
	    open={addMoreOpen}
	    onClose={() => setAddMoreOpen(false)}
	    PaperProps={{
	      sx: {
	        borderRadius: "24px",

	        background: darkMode
	          ? "linear-gradient(180deg,#111,#0b0b0b)"
	          : "#ffffff",

	        color: darkMode ? "#fff" : "#111",

	        border: darkMode
	          ? "1px solid rgba(255,215,0,0.12)"
	          : "none",

	        boxShadow: darkMode
	          ? "0 30px 80px rgba(0,0,0,0.8)"
	          : "0 20px 50px rgba(0,0,0,0.2)",
	      },
	    }}
	  >
	    <DialogTitle>Add More Packets</DialogTitle>

		<DialogContent
		  dividers
		  sx={{
		    borderColor: darkMode
		      ? "rgba(255,215,0,0.08)"
		      : "rgba(0,0,0,0.08)",
		  }}
		>

		  <TextField
		    label="Number of packets"
		    type="number"
		    value={addCount}
		    onChange={(e) => setAddCount(Number(e.target.value))}
		    fullWidth
			sx={{
			  ...formFieldSx(darkMode),
			  mb: 1,
			}}
		  />

		  {[...Array(addCount)].map((_, i) => (
		    <Box key={i} sx={{ mb: 2 }}>
		      <b>Packet {i + 1}</b>

		      <TextField
		        label="Description"
		        fullWidth
		        value={descriptions[i] || ""}
		        onChange={(e) => {
		          const copy = [...descriptions];
		          copy[i] = e.target.value;
		          setDescriptions(copy);
		        }}
				sx={{
				  ...formFieldSx(darkMode),
				  mb: 1,
				}}
		      />

		      <TextField
		        label="Weight"
		        fullWidth
		        value={weights[i] || ""}
		        onChange={(e) => {
		          const copy = [...weights];
		          copy[i] = e.target.value;
		          setWeights(copy);
		        }}
				sx={{
				  ...formFieldSx(darkMode),
				  mb: 1,
				}}
		      />

			  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
			    <TextField
			      label="L"
			      type="number"
			      value={dimensionsList[i]?.l || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], l: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>x</span>

			    <TextField
			      label="B"
			      type="number"
			      value={dimensionsList[i]?.b || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], b: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>x</span>

			    <TextField
			      label="H"
			      type="number"
			      value={dimensionsList[i]?.h || ""}
			      onChange={(e) => {
			        const copy = [...dimensionsList];
			        copy[i] = { ...copy[i], h: e.target.value };
			        setDimensionsList(copy);
			      }}
				  sx={{
				    ...formFieldSx(darkMode),
				    width: 80,
				    mb: 0,
				  }}
			    />

			    <span>inches</span>
			  </Box>

		      <TextField
		        label="Remarks"
		        fullWidth
		        value={remarksList[i] || ""}
		        onChange={(e) => {
		          const copy = [...remarksList];
		          copy[i] = e.target.value;
		          setRemarksList(copy);
		        }}
				sx={formFieldSx(darkMode)}
		      />
		    </Box>
		  ))}

		</DialogContent>

	    <DialogActions 		
		sx={{
		  borderTop: darkMode
		    ? "1px solid rgba(255,215,0,0.08)"
		    : "1px solid rgba(0,0,0,0.06)",

		  background: darkMode
		    ? "#0b0b0b"
		    : "#fff",
		}}>
	      <Button onClick={() => setAddMoreOpen(false)}>Cancel</Button>

		  <Button
		    variant="contained"
		    disabled={!addCount || addCount <= 0}
	        onClick={async () => {
	          await fetch(
	            `${API_BASE_URL}/api/packets/add-more/${selectedItem.masterItemId}`,
	            {
	              method: "POST",
	              headers: {
	                "Content-Type": "application/json",
	                Authorization: `Bearer ${localStorage.getItem("token")}`,
	              },
				  body: JSON.stringify({
				    numberOfPackets: addCount,
				    descriptions,
				    weights,
					dimensionsList: dimensionsList.map((d) =>
					  d?.l && d?.b && d?.h
					    ? `${d.l} L x ${d.b} B x ${d.h} H inches`
					    : ""
					),
				    remarksList,
				  }),
	            }
	          );

	          setAddMoreOpen(false);
	          fetchItems();
	        }}
	      >
	        Add
	      </Button>
	    </DialogActions>
	  </Dialog>
	  <Dialog
	    open={customAddOpen}
	    onClose={() => setCustomAddOpen(false)}
	    fullWidth
	    maxWidth="sm"
	  >
	    <DialogTitle>Add Custom Packet</DialogTitle>

	    <DialogContent>

	      <TextField
	        label="Custom Packet Number"
	        type="number"
	        fullWidth
	        value={customPacketNo}
	        onChange={(e) => setCustomPacketNo(e.target.value)}
	        sx={formFieldSx(darkMode)}
	      />

	      <TextField
	        label="Description"
	        fullWidth
	        value={descriptions[0] || ""}
	        onChange={(e) => setDescriptions([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	      <TextField
	        label="Weight"
	        fullWidth
	        value={weights[0] || ""}
	        onChange={(e) => setWeights([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
	        {["l", "b", "h"].map((key) => (
	          <TextField
	            key={key}
	            label={key.toUpperCase()}
	            type="number"
	            value={dimensionsList[0]?.[key] || ""}
	            onChange={(e) => {
	              const copy = [...dimensionsList];
	              copy[0] = { ...copy[0], [key]: e.target.value };
	              setDimensionsList(copy);
	            }}
	            sx={{ width: 90 }}
	          />
	        ))}
	      </Box>

	      <TextField
	        label="Remarks"
	        fullWidth
	        value={remarksList[0] || ""}
	        onChange={(e) => setRemarksList([e.target.value])}
	        sx={formFieldSx(darkMode)}
	      />

	    </DialogContent>

	    <DialogActions>
	      <Button onClick={() => setCustomAddOpen(false)}>Cancel</Button>

	      <Button
	        variant="contained"
	        disabled={!customPacketNo}
	        onClick={async () => {
	          try {
	            await fetch(
	              `${API_BASE_URL}/api/packets/add-custom/${selectedItem.masterItemId}`,
	              {
	                method: "POST",
	                headers: {
	                  "Content-Type": "application/json",
	                  Authorization: `Bearer ${localStorage.getItem("token")}`,
	                },
	                body: JSON.stringify({
	                  customPacketNumber: Number(customPacketNo),
	                  descriptions,
	                  weights,
	                  dimensionsList: dimensionsList.map((d) =>
	                    d?.l && d?.b && d?.h
	                      ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                      : ""
	                  ),
	                  remarksList,
	                }),
	              }
	            );

	            setCustomAddOpen(false);
	            fetchItems();

	          } catch (e) {
	            alert("Failed to add custom packet");
	          }
	        }}
	      >
	        Add
	      </Button>
	    </DialogActions>
	  </Dialog>
	  <Dialog
	    open={editOpen}
	    onClose={() => setEditOpen(false)}
	    fullWidth
	    maxWidth="sm"
	  >
	    <DialogTitle>Edit Packet Item</DialogTitle>

	    <DialogContent>

	      {[
	        "itemName",
	        "pdNo",
	        "drawingNo",
	        "clientName",
	        "clientAddress",
	        "floor",
	        "description",
	        "weight",
	        "dimensions",
	        "remarks",
	        "location",
	        "packetNumber",
	      ].map((field) => {

	        const locked =
	          editForm.stickerNumber &&
	          [
	            "itemName",
	            "pdNo",
	            "drawingNo",
	            "packetNumber",
	            "clientName",
	          ].includes(field);

	        return (
	          <TextField
	            key={field}
	            label={field}
	            fullWidth
	            disabled={locked}
	            value={editForm[field] || ""}
	            onChange={(e) =>
	              setEditForm((prev) => ({
	                ...prev,
	                [field]: e.target.value,
	              }))
	            }
	            sx={{ mb: 2 }}
	          />
	        );
	      })}

	    </DialogContent>

	    <DialogActions>

	      <Button onClick={() => setEditOpen(false)}>
	        Cancel
	      </Button>

	      <Button
	        variant="contained"
	        onClick={async () => {

	          try {

	            const res = await fetch(
	              `${API_BASE_URL}/api/packets/items/${editItem.itemId}`,
	              {
	                method: "PUT",
	                headers: {
	                  "Content-Type": "application/json",
	                  Authorization:
	                    `Bearer ${localStorage.getItem("token")}`,
	                },
	                body: JSON.stringify(editForm),
	              }
	            );

	            if (!res.ok) {
	              throw new Error();
	            }

	            setEditOpen(false);

	            fetchItems();

	          } catch (e) {

	            alert("Update failed");
	          }
	        }}
	      >
	        Save
	      </Button>

	    </DialogActions>
	  </Dialog>
    </div>
  );
}

/* ===================== STYLES ===================== */

const page = () => ({
  minHeight: "100vh",
  padding: 18,
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",

  background: `
    radial-gradient(circle at top left, rgba(96,165,250,0.18), transparent 25%),
    radial-gradient(circle at bottom right, rgba(56,189,248,0.14), transparent 25%),
    linear-gradient(180deg, #eaf3ff 0%, #f6f9ff 100%)
  `,
});

const backgroundText = (darkMode) => ({
  position: "absolute",
  fontSize: 180,
  fontWeight: 900,

  background: darkMode
    ? "linear-gradient(180deg, rgba(255,215,0,0.12), rgba(255,215,0,0.03))"
    : "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",

  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",

  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",

  pointerEvents: "none",
});

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
  height: "calc(100vh - 220px)",
  borderRadius: 24,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
};

const dataGridStyles = {
  border: "none",
  fontSize: 13,

  "& .MuiDataGrid-columnHeaders": {
    background: "#f1f5f9",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 700,
  },

  "& .MuiDataGrid-cell": {
    borderBottom: "1px solid #f1f5f9",
  },

  "& .MuiDataGrid-row:hover": {
    background: "#f8fafc",
  },

  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid #e5e7eb",
  },
};

/* ---------- Drawer ---------- */

const drawer = (darkMode) => ({
  width: 520,
  height: "100%",
  padding: 30,
  boxSizing: "border-box",
  position: "relative",

  background: darkMode
    ? "linear-gradient(180deg, rgba(12,12,12,0.98), rgba(18,18,18,0.95))"
    : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))",

  color: darkMode ? "#fff" : "#1f2937",

  backdropFilter: "blur(18px)",

  borderLeft: darkMode
    ? "1px solid rgba(255,215,0,0.12)"
    : "none",

  boxShadow: darkMode
    ? "-20px 0 50px rgba(0,0,0,0.75)"
    : "-20px 0 50px rgba(0,0,0,0.35)",
});

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

const drawerTitle = (darkMode) => ({
  marginBottom: 4,
  fontSize: 22,
  fontWeight: 700,
  color: darkMode ? "#FFD700" : "#111",
});

const drawerButton = (darkMode) => ({
  mt: 1,
  px: 3,
  fontWeight: 700,
  borderRadius: "999px",

  textTransform: "none",

  background: darkMode
    ? "linear-gradient(180deg,#facc15,#d97706)"
    : "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",

  color: darkMode ? "#111" : "#fff",

  boxShadow: darkMode
    ? "0 10px 30px rgba(255,215,0,0.25)"
    : undefined,
});

const formFieldSx = (darkMode) => ({
  mb: 2,

  /* ================= LABEL ================= */

  "& .MuiFormLabel-root": {
    color: darkMode
      ? "rgba(255,215,0,0.72)"
      : "#374151",

    fontWeight: 500,

    transition: "all 0.2s ease",
  },

  "& .MuiFormLabel-root.Mui-focused": {
    color: darkMode
      ? "#FFD700"
      : "#111827",
  },

  "& .MuiFormLabel-root.Mui-error": {
    color: "#ef4444",
  },

  /* ================= INPUT ROOT ================= */

  "& .MuiOutlinedInput-root": {
    borderRadius: "16px",

    background: darkMode
      ? "rgba(255,255,255,0.04)"
      : "rgba(255,255,255,0.92)",

    color: darkMode ? "#ffffff" : "#111827",

    transition: "all 0.25s ease",

    /* BORDER */
    "& fieldset": {
      borderColor: darkMode
        ? "rgba(255,215,0,0.14)"
        : "rgba(0,0,0,0.12)",
    },

    "&:hover fieldset": {
      borderColor: darkMode
        ? "rgba(255,215,0,0.38)"
        : "#111827",
    },

    "&.Mui-focused fieldset": {
      borderColor: darkMode
        ? "#FFD700"
        : "#111827",

      boxShadow: darkMode
        ? "0 0 0 3px rgba(255,215,0,0.16)"
        : "0 0 0 3px rgba(17,24,39,0.08)",
    },

    "&.Mui-error fieldset": {
      borderColor: "#ef4444",
    },
  },

  /* ================= INPUT TEXT ================= */

  "& .MuiInputBase-input": {
    color: darkMode ? "#ffffff" : "#111827",

    fontWeight: 500,

    WebkitTextFillColor: darkMode
      ? "#ffffff"
      : "#111827",
  },

  /* ================= PLACEHOLDER ================= */

  "& .MuiInputBase-input::placeholder": {
    color: darkMode
      ? "rgba(255,255,255,0.42)"
      : "rgba(0,0,0,0.42)",

    opacity: 1,
  },

  /* ================= MULTILINE ================= */

  "& textarea": {
    color: darkMode ? "#ffffff" : "#111827",

    WebkitTextFillColor: darkMode
      ? "#ffffff"
      : "#111827",
  },

  /* ================= HELPER TEXT ================= */

  "& .MuiFormHelperText-root": {
    color: darkMode
      ? "rgba(255,255,255,0.65)"
      : "#6b7280",

    marginLeft: "4px",
  },

  "& .MuiFormHelperText-root.Mui-error": {
    color: "#ef4444",
  },

  /* ================= ICONS ================= */

  "& .MuiSvgIcon-root": {
    color: darkMode
      ? "#FFD700"
      : "#374151",
  },

  /* ================= AUTOFILL FIX ================= */

  "& input:-webkit-autofill": {
    WebkitBoxShadow: darkMode
      ? "0 0 0 100px rgba(22,22,22,1) inset"
      : "0 0 0 100px #ffffff inset",

    WebkitTextFillColor: darkMode
      ? "#ffffff"
      : "#111827",

    borderRadius: "16px",

    transition: "background-color 9999s ease-in-out 0s",
  },
});

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 8,
  padding: "5px 18px",
  borderRadius: 16,

  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.72),
      rgba(255,255,255,0.42)
    )
  `,

  backdropFilter: "blur(30px)",
  border: "1px solid rgba(255,255,255,0.4)",

  boxShadow: `
    0 14px 35px rgba(0,0,0,0.18),
    inset 0 1px 0 rgba(255,255,255,0.45)
  `,
};

const themeBtn = (darkMode) => ({
  px: 2.6,
  py: 1,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 700,

  background: darkMode
    ? "linear-gradient(135deg,#111,#222)"
    : "#111",

  color: darkMode ? "#FFD700" : "#fff",

  border: darkMode
    ? "1px solid rgba(255,215,0,0.25)"
    : "1px solid rgba(255,255,255,0.25)",

  boxShadow: darkMode
    ? "0 0 18px rgba(255,215,0,0.15)"
    : "0 10px 25px rgba(0,0,0,0.25)",

  "&:hover": {
    transform: "translateY(-3px) scale(1.04)",
  },
});

export default ZohoItemsPage;
