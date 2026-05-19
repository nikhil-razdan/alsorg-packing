import { useEffect, useState, useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Button, TextField, Box, Chip, MenuItem } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";

function WarehousePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [gatePassPopup, setGatePassPopup] = useState(null);
  const [approveGatePass, setApproveGatePass] = useState({});	
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const isDispatch = role === "DISPATCH";
  const isPacking = role === "PACKING";
  const [importMode, setImportMode] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [selectionModel, setSelectionModel] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  /* ===================== FETCH ===================== */

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE_URL}/api/warehouse/floor`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/warehouse/items`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]); //Hello

      const floorData = await res1.json();
      const warehouseData = await res2.json();

      const combined = [...floorData, ...warehouseData];
	  setRows(
	    combined.map((item) => ({
		  id: item.zohoItemId || item.sku,
		  zohoItemId: item.zohoItemId || item.sku,
	      name: item.name || item.itemName,            
	      sku: item.sku,
		  pdNo: item.pdNo,
		  drawingNo: item.drawingNo,
		  description: item.description,
		  clientName: item.clientName,

		  status: item.status,
		  location: item.location || "-",
		  factoryFloor: item.floor,
		  warehouseCode: item.warehouseCode,
		  gatePassNumber: item.gatePassNumber,
	    }))
	  );
      
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const exportCSV = () => {
    const headers = [
      "zohoItemId",
      "name",
      "sku",
      "pdNo",
      "drawingNo",
      "clientName",
	  "location",
      "status",
      "warehouseCode",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${r[h] || ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "warehouse_export.csv";
    a.click();
  };
  
  const downloadTemplate = () => {
	const csv = [
	  "name,sku,pdNo,drawingNo,description,clientName,location,warehouseCode,gatePass",
	  "Item1,SKU1,PD1,DWG1,Desc,Client,Floor-A,WH-01,GP-123",
	].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "warehouse_template.csv";
    a.click();
  };
  
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !importMode) return;

    setUploadFile(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", importMode);

    const res = await fetch(`${API_BASE_URL}/api/warehouse/import/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    setPreviewRows(data);
    setPreviewOpen(true);
  };
  
  /* ===================== ACTIONS ===================== */
  const approveWarehouse = async (id) => {
    const gp = approveGatePass[id];

    if (!gp) {
      alert("Enter Gate Pass");
      return;
    }

    const res = await fetch(
      `${API_BASE_URL}/api/warehouse/${id}/approve?gatePass=${gp}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, 
		"X-Username": localStorage.getItem("username") },
		
      }
    );

    if (!res.ok) {
      alert("Invalid Gate Pass");
      return;
    }

    fetchItems();
  };

  const rejectWarehouse = async (id) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/warehouse/${id}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
			"X-Username": localStorage.getItem("username")
          },
        }
      );

      if (!res.ok) throw new Error();

      fetchItems();
    } catch {
      alert("Reject failed");
    }
  };
  
  const requestReturn = async (id) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${id}/request-return`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Username": localStorage.getItem("username"),
          },
        }
      );

      if (!res.ok) throw new Error();

      fetchItems(); // refresh table
    } catch (err) {
      console.error(err);
      alert("Return request failed");
    }
  };
  
  const bulkReturnToDispatch = async () => {

    if (selectionModel.length === 0) {
      alert("Select items first");
      return;
    }

    const confirmBulk = window.confirm(
      `Return ${selectionModel.length} selected items to dispatch?`
    );

    if (!confirmBulk) return;

    try {

      setBulkLoading(true);

      await Promise.all(
        selectionModel.map((id) =>
          fetch(
            `${API_BASE_URL}/api/dispatched/${id}/request-return`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "X-Username": localStorage.getItem("username"),
              },
            }
          )
        )
      );

      setSelectionModel([]);
      fetchItems();

    } catch (err) {

      console.error(err);
      alert("Bulk return failed");

    } finally {

      setBulkLoading(false);

    }
  };

  const selectableStatuses = [
    "IN_WAREHOUSE"
  ];

  const readyRows = useMemo(() => {
    return rows.filter(r =>
      selectableStatuses.includes(r.status)
    );
  }, [rows]);
  /* ===================== COLUMNS ===================== */

  const columns = [
	
	{
	  field: "select",
	  headerName: "",
	  width: 60,
	  sortable: false,

	  renderHeader: () => {

	    const allSelected =
	      readyRows.length > 0 &&
	      readyRows.every(r =>
	        selectionModel.includes(r.zohoItemId)
	      );

	    return (
	      <input
	        type="checkbox"
	        checked={allSelected}
	        onChange={(e) => {

	          if (e.target.checked) {

	            setSelectionModel(
	              readyRows.map(r => r.zohoItemId)
	            );

	          } else {

	            setSelectionModel([]);

	          }

	        }}
	      />
	    );
	  },

	  renderCell: (params) => {

	    const id = params.row.zohoItemId;

	    const isSelectable =
	      selectableStatuses.includes(params.row.status);

	    return (
	      <input
	        type="checkbox"
	        disabled={!isSelectable}
	        checked={selectionModel.includes(id)}

	        onChange={(e) => {

	          if (!isSelectable) return;

	          if (e.target.checked) {

	            setSelectionModel(prev =>
	              prev.includes(id)
	                ? prev
	                : [...prev, id]
	            );

	          } else {

	            setSelectionModel(prev =>
	              prev.filter(item => item !== id)
	            );

	          }

	        }}
	      />
	    );
	  },
	},
	{
	  field: "name",
	  headerName: "Item Name",
	  flex: 1,
	  minWidth: 260,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      🔖 <span>Item Name</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      <span>{params.row.name}</span>
	    </Box>
	  ),
	},

	{
	  field: "sku",
	  headerName: "SKU",
	  width: 160,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      🏷️ <span>SKU</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        padding: "4px 10px",
	        borderRadius: "999px",
	        background: "rgba(99,102,241,0.1)",
	        color: "#4f46e5",
	        fontWeight: 600,
	        fontSize: 12,
	      }}
	    >
	      {params.value || "—"}
	    </span>
	  ),
	},
	{
	  field: "pdNo",
	  headerName: "PD No",
	  width: 140,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      🧾 <span>PD No</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        padding: "4px 10px",
	        borderRadius: "999px",
	        background: "rgba(99,102,241,0.1)",
	        color: "#4f46e5",
	        fontWeight: 600,
	        fontSize: 12,
	      }}
	    >
	      {params.value || "—"}
	    </span>
	  ),
	},
	{
	  field: "drawingNo",
	  headerName: "Dwg No.",
	  width: 160,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📐 <span>Dwg No.</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        padding: "4px 10px",
	        borderRadius: "6px",
	        background: "#111827",
	        color: "#e5e7eb",
	        fontFamily: "monospace",
	        fontSize: 12,
	        letterSpacing: "0.5px",
	      }}
	    >
	      {params.value || "N/A"}
	    </span>
	  ),
	},
	{
	  field: "description",
	  headerName: "Description",
	  width: 220,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📝 <span>Description</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        padding: "4px 10px",
	        borderRadius: "8px",
	        background: "rgba(16,185,129,0.1)",
	        color: "#059669",
	        fontSize: 12,
	        maxWidth: "180px",
	        overflow: "hidden",
	        textOverflow: "ellipsis",
	        whiteSpace: "nowrap",
	        display: "inline-block",
	      }}
	      title={params.value}
	    >
	      {params.value || "No description"}
	    </span>
	  ),
	},
	{
	  field: "clientName",
	  headerName: "Client",
	  minWidth: 180,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      👤 <span>Client</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        fontWeight: 600,
	        color: "#374151",
	      }}
	    >
	      {params.value || "—"}
	    </span>
	  ),
	},
	{
	  field: "location",
	  headerName: "Location",
	  width: 160,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📍 <span>Location</span>
	    </Box>
	  ),

	  renderCell: (params) => (
	    <span
	      style={{
	        padding: "4px 10px",
	        borderRadius: "999px",
	        background: "rgba(59,130,246,0.1)",
	        color: "#1d4ed8",
	        fontWeight: 600,
	        fontSize: 12,
	      }}
	    >
	      {params.value || "-"}
	    </span>
	  ),
	},
    {
      field: "status",
      headerName: "Movement Status",
      width: 240,
	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📋 <span>Movement Status</span>
	    </Box>
	  ),
	  renderCell: (params) => {
	    const row = params.row;
	    const location = row.location || "-";

	    // 🔐 who can view
		const canView =
		  (isPacking || role === "ADMIN") &&
		  (row.gatePassNumber || row.status !== "ON_FLOOR");

	    // 🔥 COMMON VIEW BUTTON
	    const ViewButton = () => (
	      <Button
	        size="small"
	        onClick={async () => {
	          try {
	            const res = await fetch(
	              `${API_BASE_URL}/api/gatepass/${row.zohoItemId}/pdf`,
	              {
	                method: "GET",
	                headers: {
	                  Authorization: `Bearer ${token}`,
	                },
	              }
	            );

	            if (!res.ok) throw new Error();

	            const blob = await res.blob();
	            const url = URL.createObjectURL(blob);

	            if (gatePassPopup?.previewUrl) {
	              URL.revokeObjectURL(gatePassPopup.previewUrl);
	            }

	            setGatePassPopup({
	              id: row.id,
	              gatePass: row.gatePassNumber || "GATEPASS",
	              previewUrl: url,
	            });

	          } catch (err) {
	            console.error(err);
	            alert("Failed to load gate pass");
	          }
	        }}
	        sx={{
	          fontSize: 11,
	          borderRadius: "999px",
	          px: 1.5,
	          background: "linear-gradient(180deg,#6366f1,#4338ca)",
	          color: "#fff",
	        }}
	      >
	        VIEW
	      </Button>
	    );

	    // ===============================
	    // STEP 1: ON FLOOR
	    // ===============================
		if (row.status === "ON_FLOOR") {
		  return (
		    <Chip
		      label={`${location} WIP Packed`}
		      size="small"
		      sx={statusPacked}
		    />
		  );
		}
		
		if (row.status === "READY_TO_STORE") {
		  return <Chip label="Waiting Dispatch Action" sx={pendingChip} />
		}

	    // ===============================
	    // STEP 2: REQUESTED
	    // ===============================
	    if (row.status === "WAREHOUSE_REQUESTED") {
	      return (
	        <Box sx={{ display: "flex", gap: 1 }}>
	          <Chip
	            label={`${location} WIP Packed`}
	            size="small"
	            sx={{
	              fontWeight: 700,
	              color: "#92400e",
	              background: "rgba(254,243,199,0.9)",
	            }}
	          />
	          {canView && <ViewButton />}
	        </Box>
	      );
	    }

	    // ===============================
	    // STEP 3: STORED
	    // ===============================
	    if (row.status === "IN_WAREHOUSE") {
	      return (
	        <Box sx={{ display: "flex", gap: 1 }}>
	          <Chip label="Stored in Warehouse" size="small" sx={statusStored} />
	          {canView && <ViewButton />}
	        </Box>
	      );
	    }
		if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
		  return (
		    <Box sx={{ display: "flex", gap: 1 }}>
		      <Chip
		        label="Return Requested"
		        size="small"
		        sx={{
		          fontSize: 11,
		          fontWeight: 700,
		          px: 1.6,
		          borderRadius: "999px",
		          color: "#7c2d12",
		          background: "rgba(254,226,226,0.9)",
		        }}
		      />
		      {canView && <ViewButton />}
		    </Box>
		  );
		}

	    return row.status;
	  },
    },

	{
	  field: "factoryFloor",
	  headerName: "Factory Floor",
	  width: 180,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      🏭 <span>Factory Floor</span>
	    </Box>
	  ),
    },

	{
	  field: "warehouseCode",
	  headerName: "Warehouse",
	  width: 180,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📦 <span>Warehouse</span>
	    </Box>
	  ),
    },

	{
	  field:"actions",
	  headerName:"Action",

	  flex: 1,
	  minWidth: 420,
	  maxWidth: 460,

	  sortable:false,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      ⚡ <span style={{ fontWeight: 700 }}>Action</span>
	    </Box>
	  ),

	  renderCell:(params)=>{
        const row = params.row;
		
        // WAREHOUSE REQUESTED
        if (row.status === "WAREHOUSE_REQUESTED") {
          // PACKING VIEW
          if (isPacking) {
            return (
              <Chip
                label="Awaiting Dispatch"
                size="small"
                sx={statusPacked}
              />
            );
          }

          // DISPATCH VIEW
          if (isDispatch) {
            return (
				<Box sx={{ display: "flex", gap: 1 }}>
				  <TextField
				    size="small"
				    placeholder="Gate Pass"
				    value={approveGatePass[row.id] || ""}
				    onChange={(e) =>
				      setApproveGatePass((prev) => ({
				        ...prev,
				        [row.id]: e.target.value,
				      }))
				    }
				  />

				  <Button
				    size="small"
					disabled={!approveGatePass[row.id]}
				    onClick={() => approveWarehouse(row.id)}
				    sx={actionPrimary}
				  >
				    Approve
				  </Button>

				  <Button
				    size="small"
				    onClick={() => rejectWarehouse(row.id)}
				    sx={{
				      ...actionPrimary,
				      background: "linear-gradient(180deg,#ef4444,#b91c1c)",
				    }}
				  >
				    Reject
				  </Button>
				</Box>
			  
            );
          }
		  }
        
		  // ===============================
		  // STEP 3: IN WAREHOUSE (FIXED)
		  // ===============================
		  if (row.status === "IN_WAREHOUSE") {

		    if (isDispatch) {
		      return (
		        <Button
		          size="small"
		          onClick={() => requestReturn(row.zohoItemId)}
		          sx={{
		            fontSize: 11,
		            borderRadius: "999px",
		            px: 1.5,
		            background: "linear-gradient(180deg,#f59e0b,#d97706)",
		            color: "#fff",
		          }}
		        >
		          Return to Dispatch
		        </Button>
		      );
		    }

		    return (
		      <Chip label="Stored" size="small" sx={statusStored} />
		    );
		  }
		  // ===============================
		  // RETURN REQUEST FLOW
		  // ===============================
		  if (row.status === "WAREHOUSE_RETURN_REQUESTED") {

		    if (role === "ADMIN") {
		      return (
		        <Box sx={{ display: "flex", gap: 1 }}>
		          <Button
		            size="small"
		            onClick={async () => {
		              await fetch(
		                `${API_BASE_URL}/api/dispatched/${row.zohoItemId}/approve-return`,
		                {
		                  method: "POST",
		                  headers: {
		                    Authorization: `Bearer ${token}`,
		                  },
		                }
		              );
		              fetchItems();
		            }}
		            sx={actionPrimary}
		          >
		            Approve
		          </Button>

		          <Button
		            size="small"
		            onClick={async () => {
		              await fetch(
		                `${API_BASE_URL}/api/dispatched/${row.zohoItemId}/reject-return`,
		                {
		                  method: "POST",
		                  headers: {
		                    Authorization: `Bearer ${token}`,
		                  },
		                }
		              );
		              fetchItems();
		            }}
		            sx={{
		              ...actionPrimary,
		              background: "linear-gradient(180deg,#ef4444,#b91c1c)",
		            }}
		          >
		            Reject
		          </Button>
		        </Box>
		      );
		    }

		    return (
		      <Chip label="Awaiting Admin Approval" size="small" sx={pendingChip} />
		    );
		  }
        return null;
      },
    },
  ];

  /* ===================== FILTER ===================== */

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (
        search &&
        !r.name?.toLowerCase().includes(search.toLowerCase()) &&
        !r.status?.toLowerCase().includes(search.toLowerCase())
      )
        return false;

      return true;
    });
  }, [rows, search]);

  /* ===================== UI ===================== */

  const selectedItems = rows.filter(r =>
    selectionModel?.includes(r.zohoItemId)
  );

  const allWarehouseItems =
    selectedItems.length > 0 &&
    selectedItems.every(
      item => item.status === "IN_WAREHOUSE"
    );
	
  return (
    <div style={page}>
      <div style={backgroundText}>Warehouse</div>

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
	        🏭
	      </Box>

	      {/* TEXT */}
	      <Box>
	        <div
	          style={{
	            fontSize: 28, // KEEP EXISTING SIZE
	            fontWeight: 700,
	            color: "#ffffff",
	            letterSpacing: 0.4,
	            textShadow: "0 3px 10px rgba(0,0,0,0.25)",
	          }}
	        >
	          Warehouse
	        </div>

	        <div
	          style={{
	            fontSize: 13,
	            color: "rgba(255,255,255,0.85)",
	          }}
	        >
	          Track warehouse movement and storage requests
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
	      {rows.length} Items
	    </Box>
	  </Box>

        <Box sx={searchPanel}>
          <SearchIcon sx={{ opacity: 0.6 }} />
          <TextField
            variant="standard"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ disableUnderline: true }}
            sx={{ flex: 1 }}
          />
        </Box>
		<Box sx={legend}>

		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
		    background: "rgba(209,250,229,0.9)",
		    color: "#059669",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    📦 STORED IN WAREHOUSE
		  </Box>

		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
		    background: "rgba(254,243,199,0.9)",
		    color: "#d97706",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    ⏳ REQUESTED
		  </Box>

		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
		    background: "rgba(254,226,226,0.9)",
		    color: "#dc2626",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    🔁 RETURN REQUESTED
		  </Box>

		</Box>

		{/* 🔥 ADD THIS BLOCK RIGHT HERE */}
        <div style={tableWrapper}>
		<Box sx={{ display: "flex", gap: 2, mb: 2 }}>

		  {/* EXPORT */}
		  <Button
		    variant="contained"
		    onClick={exportCSV}
		    sx={{ background: "#111827" }}
		  >
		    Export CSV
		  </Button>

		  {/* IMPORT */}
		  <TextField
		    select
		    size="small"
		    value={importMode}
		    onChange={(e) => setImportMode(e.target.value)}
		    sx={{ width: 220 }}
		  >
		    <MenuItem value="CREATE">Create Inventory</MenuItem>
		  </TextField>

		  <Button
		    component="label"
		    variant="contained"
			disabled={!importMode}
		    sx={{ background: "#16a34a" }}
		  >
		    Upload Excel
		    <input
		      type="file"
		      hidden
		      accept=".csv,.xlsx"
		      onChange={handleUpload}
		    />
		  </Button>

		</Box>
		<Button
		  variant="outlined"
		  onClick={async () => {
		    const res = await fetch(
		      `${API_BASE_URL}/api/warehouse/import/template`,
		      {
		        headers: { Authorization: `Bearer ${token}` },
		      }
		    );

		    const blob = await res.blob();
		    const url = window.URL.createObjectURL(blob);

		    const a = document.createElement("a");
		    a.href = url;
		    a.download = "warehouse_import_template.csv";
		    a.click();
		  }}
		>
		  Download Template
		</Button>
		{Array.isArray(selectionModel) &&
		 selectionModel.length > 0 &&
		 isDispatch && (

		  <div
		    style={{
		      position: "fixed",
		      bottom: 24,
		      left: "50%",
		      transform: "translateX(-50%)",

		      color: "#fff",

		      padding: "14px 22px",

		      borderRadius: 999,

		      display: "flex",
		      alignItems: "center",
		      gap: 20,

		      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",

		      zIndex: 3000,

		      background: "rgba(17,24,39,0.85)",

		      backdropFilter: "blur(18px)",

		      border: "1px solid rgba(255,255,255,0.1)",
		    }}
		  >

		    <span style={{ fontWeight: 600 }}>
		      {selectionModel.length} item
		      {selectionModel.length > 1 ? "s" : ""}
		      {" "}selected
		    </span>

		    <Button
		      disabled={!allWarehouseItems || bulkLoading}

		      onClick={bulkReturnToDispatch}

		      sx={{
		        px: 2.8,
		        borderRadius: "999px",
		        fontWeight: 600,

		        background: allWarehouseItems
		          ? "linear-gradient(180deg,#f59e0b,#d97706)"
		          : "#9ca3af",

		        color: "#fff",
		      }}
		    >
		      🔁 Bulk Return To Dispatch
		    </Button>

		    <Button
		      size="small"
		      onClick={() => setSelectionModel([])}
		      sx={{
		        color: "#9ca3af",

		        "&:hover": {
		          color: "#fff",
		        },
		      }}
		    >
		      Clear
		    </Button>

		  </div>
		)}
          <DataGrid
            rows={filteredRows}
			getRowId={(row) => row.zohoItemId}
            columns={columns}
            loading={loading}
            density="compact"
			disableColumnMenu
			disableRowSelectionOnClick
            getRowClassName={(params) => {
				if (params.row.status === "READY_TO_STORE")
				  return "row-pending";
              if (params.row.status === "IN_WAREHOUSE")
                return "row-warehouse";
              if (params.row.status === "WAREHOUSE_REQUESTED")
                return "row-pending";
              return "row-floor";
            }}
            sx={dataGridStyles}
          />
        </div>
		</div>
		
		{gatePassPopup && (
			<div
			  style={popupOverlay}
			  onClick={() => {
			    if (gatePassPopup?.previewUrl) {
			      URL.revokeObjectURL(gatePassPopup.previewUrl);
			    }
			    setGatePassPopup(null);
			  }}
			>
			<div
			  style={popupBox}
			  onClick={(e) => e.stopPropagation()}
			>
			<div style={modalGloss} />
		      <h2 style={{ marginBottom: 10 }}>Gate Pass Generated</h2>

		      <div style={gatePassNumber}>
		        {gatePassPopup.gatePass}
		      </div>
			  
			  {gatePassPopup?.previewUrl && (
			          <iframe
			            src={gatePassPopup.previewUrl}
			            style={{
			              width: "100%",
			              height: "420px",
			              border: "none",
			              borderRadius: 8,
			              marginBottom: 12,
			            }}
			          />
			        )}
					
		      <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
		        <Button
		          variant="contained"
		          sx={{ background: "#111827" }}
				  onClick={() => {
				    try {
				      if (!gatePassPopup?.previewUrl) {
				        alert("No file available");
				        return;
				      }

				      const a = document.createElement("a");
				      a.href = gatePassPopup.previewUrl;
				      a.download = `GATE_PASS_${gatePassPopup.gatePass}.pdf`;
				      a.click();

				    } catch (err) {
				      console.error(err);
				      alert("Download failed");
				    }
				  }}
		        >
		          Download Gate Pass
		        </Button>
		        <Button
				onClick={() => {
				  if (gatePassPopup?.previewUrl) {
				    URL.revokeObjectURL(gatePassPopup.previewUrl);
				  }
				  setGatePassPopup(null);
				}}
				>
		          Close
		        </Button>

		      </Box>
		    </div>
		  </div>
		)}
		{previewOpen && (
		  <div style={popupOverlay}>
		    <div style={{ ...popupBox, width: 800 }}>

		      <h2>Import Preview</h2>

		      <div style={{ maxHeight: 400, overflow: "auto" }}>
		        {previewRows.map((row, i) => (
		          <div
		            key={i}
		            style={{
		              display: "flex",
		              justifyContent: "space-between",
		              padding: 8,
		              borderBottom: "1px solid #eee",
		              background: row.valid ? "#ecfdf5" : "#fee2e2",
		            }}
		          >
				  <span>
				    {row.zohoItemId || "New Item"} | 📍 {row.location || "-"}
				  </span>
		            <span>{row.valid ? "✅ Valid" : `❌ ${row.error}`}</span>
		          </div>
		        ))}
		      </div>

		      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
		        
		        <Button
		          variant="contained"
		          onClick={async () => {
		            const formData = new FormData();
		            formData.append("file", uploadFile);
		            formData.append("mode", importMode);

					const res = await fetch(`${API_BASE_URL}/api/warehouse/import/confirm`, {
					  method: "POST",
					  headers: {
					    Authorization: `Bearer ${token}`,
					    "X-Username": localStorage.getItem("username"),
					  },
					  body: formData,
					});

					if (!res.ok) {
					  const text = await res.text();
					  alert("Import failed: " + text);
					  return;
					}

		            setPreviewOpen(false);
		            fetchItems();
		          }}
		          sx={{ background: "#16a34a" }}
		        >
		          Confirm Import
		        </Button>

		        <Button onClick={() => setPreviewOpen(false)}>
		          Cancel
		        </Button>

		      </Box>
		    </div>
		  </div>
		)}
		</div>
	);
}

/* ===================== STYLES ===================== */

const page = {
  minHeight: "100vh",
  padding: 20,
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",

  background: `
    radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 25%),
    radial-gradient(circle at bottom right, rgba(255,255,255,0.12), transparent 25%),
    linear-gradient(135deg, #f5c542 0%, #d4a017 45%, #8b5e00 100%)
  `,

  backgroundAttachment: "fixed",
};

const backgroundText = {
  position: "absolute",
  fontSize: 220,
  fontWeight: 900,

  background:
    "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",

  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",

  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",

  pointerEvents: "none",
  letterSpacing: 8,

  filter: "blur(1px)",
};

const content = { position: "relative", zIndex: 1 };

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
    transition: "all 0.2s ease",
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

  /* KEEP EXISTING ROW COLORS */

  "& .row-floor": {
    background:
      "linear-gradient(135deg, rgba(219,234,254,0.55), rgba(191,219,254,0.35))",
  },

  "& .row-warehouse": {
    background:
      "linear-gradient(135deg, rgba(209,250,229,0.55), rgba(167,243,208,0.35))",
  },

  "& .row-pending": {
    background:
      "linear-gradient(135deg, rgba(254,243,199,0.55), rgba(253,230,138,0.35))",
  },
};

const legend = {
  display: "flex",
  gap: 1.5,
  mb: 1.5,
};

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 14,

  marginBottom: 8,

  padding: "10px 18px",

  borderRadius: 24,

  background: `
    linear-gradient(
      135deg,
      rgba(255,255,255,0.55),
      rgba(255,255,255,0.28)
    )
  `,

  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",

  border: "1px solid rgba(255,255,255,0.35)",

  boxShadow: `
    0 14px 35px rgba(0,0,0,0.18),
    inset 0 1px 0 rgba(255,255,255,0.45)
  `,
};


const statusPacked = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.8,
  borderRadius: "999px",

  color: "#1e3a8a",

  backdropFilter: "blur(12px)",

  background:
    "linear-gradient(135deg, rgba(191,219,254,0.88), rgba(147,197,253,0.62))",

  border: "1px solid rgba(255,255,255,0.35)",

  boxShadow: `
    0 6px 16px rgba(59,130,246,0.25),
    inset 0 1px 0 rgba(255,255,255,0.5)
  `,
};

const statusStored = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.8,
  borderRadius: "999px",

  color: "#065f46",

  backdropFilter: "blur(12px)",

  background:
    "linear-gradient(135deg, rgba(167,243,208,0.88), rgba(110,231,183,0.62))",

  border: "1px solid rgba(255,255,255,0.35)",

  boxShadow: `
    0 6px 16px rgba(16,185,129,0.28),
    inset 0 1px 0 rgba(255,255,255,0.5)
  `,
};

const pendingChip = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.8,
  borderRadius: "999px",

  color: "#78350f",

  backdropFilter: "blur(12px)",

  background:
    "linear-gradient(135deg, rgba(254,215,170,0.88), rgba(253,186,116,0.62))",

  border: "1px solid rgba(255,255,255,0.35)",

  boxShadow: `
    0 6px 16px rgba(245,158,11,0.3),
    inset 0 1px 0 rgba(255,255,255,0.5)
  `,
};

const actionPrimary = {
  px: 2.6,
  py: 0.8,

  borderRadius: "999px",

  fontSize: 12,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(135deg,#10b981,#059669)",

  border: "1px solid rgba(255,255,255,0.2)",

  boxShadow: `
    0 10px 25px rgba(16,185,129,0.38),
    inset 0 1px 0 rgba(255,255,255,0.28)
  `,

  backdropFilter: "blur(12px)",

  transition: "all 0.25s ease",

  "&:hover": {
    transform: "translateY(-3px) scale(1.03)",

    boxShadow: `
      0 16px 35px rgba(16,185,129,0.48),
      0 0 18px rgba(16,185,129,0.35)
    `,
  },
};

const inputStyle = {
  background: "#fff",
  borderRadius: 8,
};

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const popupBox = {
  padding: 30,
  borderRadius: 28,
  textAlign: "center",
  minWidth: 350,
  position: "relative",
  overflow: "hidden",
  background: `
    linear-gradient(
      145deg,
      rgba(255,255,255,0.88),
      rgba(255,255,255,0.72)
    )
  `,

  backdropFilter: "blur(28px) saturate(180%)",
  WebkitBackdropFilter: "blur(28px) saturate(180%)",

  border: "1px solid rgba(255,255,255,0.4)",

  boxShadow: `
    0 30px 80px rgba(0,0,0,0.35),
    inset 0 1px 0 rgba(255,255,255,0.7)
  `,
};

const modalGloss = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 120,

  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,

  background: `
    linear-gradient(
      180deg,
      rgba(255,255,255,0.45),
      rgba(255,255,255,0.08),
      transparent
    )
  `,

  pointerEvents: "none",
};

const gatePassNumber = {
  fontSize: 26,
  fontWeight: 800,
  letterSpacing: 2,
  margin: "20px 0",
};

export default WarehousePage;