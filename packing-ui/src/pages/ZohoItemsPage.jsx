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
	      <Button
	        size="small"
	        disabled={isLimitReached}
	        onClick={() => {
	          setSelectedItem(params.row);
	          setAddCount(1);

	          // 🔥 RESET STATE
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
	          background: isLimitReached
	            ? "linear-gradient(180deg, #6b7280, #374151)"
	            : "linear-gradient(180deg, #2563eb, #1e3a8a)",
	          boxShadow: isLimitReached
	            ? "none"
	            : "0 4px 12px rgba(37,99,235,0.35)",
	          cursor: isLimitReached ? "not-allowed" : "pointer",

	          "&:hover": {
	            filter: isLimitReached ? "none" : "brightness(1.08)",
	            transform: isLimitReached ? "none" : "translateY(-1px)",
	          },
	        }}
	      >
	        + Add
	      </Button>
	    );
	  }
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
    <div style={page}>
      <div style={backgroundText}>Alsorg</div>

      <div style={content}>
	  <Box
	    sx={{
	      display: "flex",
	      alignItems: "center",
	      justifyContent: "space-between",
	      mb: 2,
	    }}
	  >
	    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>

	      {/* ICON BADGE */}
	      <Box
	        sx={{
	          width: 52,
	          height: 52,
	          borderRadius: 3,
	          background: "linear-gradient(135deg,#facc15,#f59e0b)",
	          display: "flex",
	          alignItems: "center",
	          justifyContent: "center",
	          boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
	          fontSize: 22,
	        }}
	      >
	        📦
	      </Box>

	      {/* TEXT */}
	      <Box>
	        <div
	          style={{
	            fontSize: 28, // KEEP INVENTORY SIZE
	            fontWeight: 700,
	            color: "#ffffff",
	            letterSpacing: 0.4,
	            textShadow: "0 3px 10px rgba(0,0,0,0.25)",
	          }}
	        >
	          Packed Items
	        </div>

	        <div
	          style={{
	            fontSize: 13,
	            color: "rgba(255,255,255,0.85)",
	          }}
	        >
	          Create, manage and generate item stickers
	        </div>
	      </Box>
	    </Box>

	    {/* ITEMS CHIP */}
	    <Box
	      sx={{
	        px: 2,
	        py: 0.8,
	        borderRadius: "999px",
	        background: "rgba(255,255,255,0.25)",
	        backdropFilter: "blur(10px)",
	        color: "#fff",
	        fontWeight: 600,
	        border: "1px solid rgba(255,255,255,0.3)",
	        fontSize: 13,
	      }}
	    >
	      {rowCount} Items
	    </Box>
	  </Box>
		<Button
		  variant="contained"
		  onClick={() => {
		    setActiveStep(0);
		    setCreateOpen(true);
		  }}
		  sx={{ mb: 2 }}
		>
		  Create Item
		</Button>
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
        <div style={drawer}>
          <div style={drawerHighlight} />
          <h3 style={drawerTitle}>{selectedItem?.itemName}</h3>

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
		    sx={{ mb: 2 }}
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
	  <Drawer
	    anchor="right"
	    open={createOpen}
	    onClose={() => setCreateOpen(false)}
	  >
	    <div style={drawer}>
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
	          sx={{ mb: 2 }}
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
	  >
	    <DialogTitle sx={{ fontWeight: 700 }}>
	      Packet Details
	    </DialogTitle>

	    <DialogContent dividers>
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
			        background: "rgba(0,0,0,0.03)",
			        border: "1px solid rgba(0,0,0,0.05)",
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
	            sx={{ mb: 1 }}
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
	            sx={{ mb: 1 }}
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
			      sx={{ width: 80 }}
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
			      sx={{ width: 80 }}
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
			      sx={{ width: 80 }}
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
	          />
			  </Box>
			  </motion.div>
	      ))}
	    </DialogContent>

	    <DialogActions>
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
	  <Dialog open={addMoreOpen} onClose={() => setAddMoreOpen(false)}>
	    <DialogTitle>Add More Packets</DialogTitle>

		<DialogContent dividers>

		  <TextField
		    label="Number of packets"
		    type="number"
		    value={addCount}
		    onChange={(e) => setAddCount(Number(e.target.value))}
		    fullWidth
		    sx={{ mb: 2 }}
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
		        sx={{ mb: 1 }}
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
		        sx={{ mb: 1 }}
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
			      sx={{ width: 80 }}
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
			      sx={{ width: 80 }}
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
			      sx={{ width: 80 }}
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
		      />
		    </Box>
		  ))}

		</DialogContent>

	    <DialogActions>
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
    </div>
  );
}

/* ===================== STYLES ===================== */

const page = {
  minHeight: "100vh",
  padding: 20,
  boxSizing: "border-box",
  background: "linear-gradient(135deg, #f5c542, #b8860b)",
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",
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
  overflowX: "auto",
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
