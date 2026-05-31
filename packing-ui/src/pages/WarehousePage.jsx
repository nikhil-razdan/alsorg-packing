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
	        color:"#374151",
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
	        sx={actionInfo}
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
			return (
			  <Chip
			    label="Waiting Dispatch Action"
			    size="small"
			    sx={pendingChip}
			  />
			)
		}

	    // ===============================
	    // STEP 2: REQUESTED
	    // ===============================
	    if (row.status === "WAREHOUSE_REQUESTED") {
	      return (
			<Box
			  sx={{
			    display: "flex",
			    alignItems: "center",
			    gap: 1,
			    flexWrap: "wrap",
			  }}
			>
	          <Chip
	            label={`${location} WIP Packed`}
	            size="small"
	            sx={pendingChip}
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
			<Box
			  sx={{
			    display: "flex",
			    alignItems: "center",
			    gap: 1,
			    flexWrap: "wrap",
			  }}
			>
	          <Chip 
			  label="Stored in Warehouse" 
			  size="small" 
			  sx={statusStored} />
	          {canView && <ViewButton />}
	        </Box>
	      );
	    }
		if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
		  return (
			<Box
			  sx={{
			    display: "flex",
			    alignItems: "center",
			    gap: 1,
			    flexWrap: "wrap",
			  }}
			>
		      <Chip
		        label="Return Requested"
		        size="small"
		        sx={returnChip}
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
	  minWidth: 520,
	  maxWidth: 600,

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
                sx={pendingChip}
              />
            );
          }

          // DISPATCH VIEW
          if (isDispatch) {
            return (
				<Box
				  sx={{
				    display: "flex",
				    alignItems: "center",
				    gap: 1.2,
				    flexWrap: "wrap",
				  }}
				>
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
					sx={{
					  width: 220,

					  ...formFieldSx,
					}}
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
				    sx={actionDanger}
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
		          sx={actionWarning}
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
				<Box
				  sx={{
				    display: "flex",
				    alignItems: "center",
				    gap: 1.2,
				    flexWrap: "wrap",
				  }}
				>
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
		            sx={actionDanger}
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

  /* ===================== FILTER ===================== */

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const searchValue = search.toLowerCase();

      if (
        search &&
        !r.name?.toLowerCase().includes(searchValue) &&
        !r.status?.toLowerCase().includes(searchValue) &&
        !r.clientName?.toLowerCase().includes(searchValue)
      ) {
        return false;
      }

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
	      mb: 3,
	    }}
	  >
	    <Box
	      sx={{
	        display: "flex",
	        alignItems: "center",
	        gap: 2,
	      }}
	    >
	      {/* ICON TILE */}
	      <Box
	        sx={{
	          width: 56,
	          height: 56,

	          borderRadius: "16px",

	          background:
	            "linear-gradient(135deg,#2563eb,#60a5fa)",

	          display: "flex",
	          alignItems: "center",
	          justifyContent: "center",

	          fontSize: 28,

	          boxShadow:
	            "0 15px 35px rgba(37,99,235,.35)",
	        }}
	      >
	        🏭
	      </Box>

	      {/* TITLE AREA */}
	      <Box>
	        <div
	          style={{
	            color: "#fff",
	            fontSize: 30,
	            fontWeight: 800,
	            lineHeight: 1.1,
	          }}
	        >
	          Warehouse
	        </div>

	        <div
	          style={{
	            color: "rgba(255,255,255,.55)",
	            fontSize: 13,
	            marginTop: 4,
	          }}
	        >
	          Track warehouse movement and storage operations
	        </div>
	      </Box>
	    </Box>

	    {/* RIGHT STATS */}
	    <Box
	      sx={{
	        px: 2.5,
	        py: 1.2,

	        borderRadius: "999px",

	        background:
	          "rgba(255,255,255,.04)",

	        border:
	          "1px solid rgba(255,255,255,.06)",

	        backdropFilter: "blur(12px)",

	        color: "#94a3b8",

	        fontSize: 13,

	        fontWeight: 600,
	      }}
	    >
	      Total Items

	      <span
	        style={{
	          color: "#60a5fa",
	          marginLeft: 8,
	          fontWeight: 800,
	        }}
	      >
	        {filteredRows.length}
	      </span>
	    </Box>
	  </Box>
	  <Box
	    sx={{
	      height: 1,

	      background:
	        "rgba(255,255,255,.06)",

	      mb: 3,
	    }}
	  />
        <Box sx={searchPanel}>
		<SearchIcon
		  sx={{
		    color: "#60a5fa",

		    fontSize: 22,
		  }}
		/>
          <TextField
            variant="standard"
            placeholder="Search by Item, Status or Client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ disableUnderline: true }}
			sx={{
			  flex: 1,

			  "& .MuiInputBase-root": {
			    color: "#fff",

			    fontSize: 14,

			    fontWeight: 500,
			  },

			  "& input": {
			    color: "#fff",
			  },

			  "& input::placeholder": {
			    color: "rgba(255,255,255,.42)",

			    opacity: 1,
			  },
			}}
          />
        </Box>
		<Box
		  sx={{
		    display: "flex",
		    justifyContent: "space-between",
		    alignItems: "center",
		    mb: 2,
		    gap: 2,
		  }}
		>
		  {/* LEFT */}
		  <Box
		    sx={{
		      display: "flex",
		      alignItems: "center",
		      gap: 2,
		      flexWrap: "wrap",
		    }}
		  >
		  <Box sx={{ display: "flex", gap: 2}}>

		  		  {/* EXPORT */}
		  		  <Button
		  		    variant="contained"
		  		    onClick={exportCSV}
					sx={{
					  height: 42,

					  px: 2.5,

					  borderRadius: "14px",

					  textTransform: "none",

					  fontWeight: 700,

					  background:
					    "linear-gradient(180deg,#1e293b,#0f172a)",

					  border:
					    "1px solid rgba(255,255,255,.06)",

					  boxShadow:
					    "0 8px 25px rgba(0,0,0,.35)",

					  "&:hover": {
					    background:
					      "linear-gradient(180deg,#334155,#1e293b)",
					  },
					}}
		  		  >
		  		    Export CSV
		  		  </Button>

		  		  {/* IMPORT */}
		  		  <TextField
		  		    select
		  		    size="small"
		  		    value={importMode}
		  		    onChange={(e) => setImportMode(e.target.value)}
		  			sx={{
		  			  width: 260,

		  			  ...formFieldSx,
		  			}}
		  		  >
		  		    <MenuItem value="CREATE">Create Inventory</MenuItem>
		  		  </TextField>

		  		  <Button
		  		    component="label"
		  		    variant="contained"
		  			disabled={!importMode}
					sx={{
					  height: 42,

					  px: 2.5,

					  borderRadius: "14px",

					  textTransform: "none",

					  fontWeight: 700,

					  background:
					    "linear-gradient(180deg,#16a34a,#15803d)",

					  boxShadow:
					    "0 8px 25px rgba(22,163,74,.28)",

					  "&:hover": {
					    background:
					      "linear-gradient(180deg,#22c55e,#16a34a)",
					  },

					  "&.Mui-disabled": {
					    background:
					      "rgba(255,255,255,.08)",

					    color:
					      "rgba(255,255,255,.35)",
					  },
					}}
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
				</Box>
				<Box sx={legend}>

				  <Chip
				    label="Stored In Warehouse"
				    sx={statusStored}
				  />

				  <Chip
				    label="Pending Request"
				    sx={pendingChip}
				  />

				  <Chip
				    label="Return Requested"
				    sx={returnChip}
				  />

				</Box>
				<Box
				  sx={{
				    display: "flex",
				    alignItems: "center",
				    gap: 2,
				  }}
				>
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
						  sx={{
						    height: 42,

						    px: 2.5,

						    borderRadius: "14px",

						    textTransform: "none",

						    fontWeight: 700,

						    color: "#cbd5e1",

						    border:
						      "1px solid rgba(255,255,255,.08)",

						    background:
						      "rgba(255,255,255,.03)",

						    "&:hover": {
						      background:
						        "rgba(255,255,255,.06)",

						      borderColor:
						        "rgba(59,130,246,.45)",
						    },
						  }}
						>
						  Download Template
						</Button>
						</Box>
						</Box>
				
		
		<div style={wrap}>
		 <div style={tableWrapper}>
		
		
		{Array.isArray(selectionModel) &&
		 selectionModel.length > 0 &&
		 isDispatch && (

		  <div
		  style={{
		    position: "fixed",

		    bottom: 24,

		    left: "50%",

		    transform: "translateX(-50%)",

		    zIndex: 4000,

		    display: "flex",

		    alignItems: "center",

		    gap: 18,

		    padding: "16px 22px",

		    borderRadius: 20,

		    background:
		      "linear-gradient(180deg,#0f172a,#111827)",

		    border:
		      "1px solid rgba(255,255,255,.06)",

		    boxShadow:
		      "0 25px 60px rgba(0,0,0,.45)",

		    color: "#fff",

		    backdropFilter: "blur(18px)",
		  }}
		  >

		  <Box
		    sx={{
		      display: "flex",
		      alignItems: "center",
		      gap: 1,

		      color: "#cbd5e1",

		      fontWeight: 700,

		      fontSize: 13,
		    }}
		  >
		    <span>📦</span>

			<Box
			  sx={{
			    display: "flex",
			    alignItems: "center",
			    gap: 1,
			  }}
			>
			  <span>☑️</span>

			  <span
			    style={{
			      fontWeight: 800,
			    }}
			  >
			    {selectionModel.length}
			    {" "}
			    Selected
			  </span>
			</Box>
			<Chip
			  size="small"
			  label={
			    allWarehouseItems
			      ? "Ready"
			      : "Mixed Selection"
			  }
			  sx={{
			    background: allWarehouseItems
			      ? "rgba(16,185,129,.15)"
			      : "rgba(239,68,68,.15)",

			    color: allWarehouseItems
			      ? "#34d399"
			      : "#f87171",

			    fontWeight: 700,
			  }}
			/>
		  </Box>
		  <Box
		      sx={{
		        width: 1,
		        height: 24,
		        background:
		          "rgba(255,255,255,.08)",
		      }}
		    />
		    <Button
		      disabled={!allWarehouseItems || bulkLoading}

		      onClick={bulkReturnToDispatch}

			  sx={{
			    minWidth: 220,

			    height: 44,

			    borderRadius: "14px",

			    fontWeight: 700,

			    textTransform: "none",

			    background: allWarehouseItems
			      ? "linear-gradient(180deg,#f59e0b,#d97706)"
			      : "#64748b",

			    color: "#fff",

			    boxShadow: allWarehouseItems
			      ? "0 10px 25px rgba(245,158,11,.35)"
			      : "none",

			    "&:hover": {
			      background: allWarehouseItems
			        ? "linear-gradient(180deg,#fbbf24,#f59e0b)"
			        : "#64748b",
			    },
			  }}
		    >
			{bulkLoading
			  ? "Processing..."
			  : "🔁 Bulk Return To Dispatch"}
		    </Button>

		    <Button
		      size="small"
		      onClick={() => setSelectionModel([])}
			  sx={{
			    minWidth: 100,

			    borderRadius: "14px",

			    color: "#94a3b8",

			    border:
			      "1px solid rgba(255,255,255,.06)",

			    "&:hover": {
			      background:
			        "rgba(255,255,255,.04)",

			      color: "#fff",
			    },
			  }}
		    >
		      Clear
		    </Button>

		  </div>
		)}
		<Box
		  sx={{
		    height: 1,

		    background:
		      "rgba(255,255,255,.06)",

		    mb: 2,
		  }}
		/>
		<Box
		  sx={{
		    borderRadius: 3,

		    overflow: "hidden",

		    border:
		      "1px solid rgba(255,255,255,.06)",

		    background:
		      "linear-gradient(180deg,#0f172a,#111827)",
		  }}
		>
          <DataGrid
		    rowHeight={56}
		    columnHeaderHeight={58}
            rows={filteredRows}
			getRowId={(row) => row.zohoItemId}
            columns={columns}
            loading={loading}
            density="compact"
			disableColumnMenu
			disableRowSelectionOnClick
			slotProps={{
			  loadingOverlay: {
			    variant: "linear-progress",
			  },
			}}
			localeText={{
			  noRowsLabel:
			    "No warehouse records found",
			}}
			getRowClassName={(params) => {
			  let base = "";

			  if (params.row.status === "READY_TO_STORE")
			    base = "row-pending";

			  else if (params.row.status === "IN_WAREHOUSE")
			    base = "row-warehouse";

			  else if (params.row.status === "WAREHOUSE_REQUESTED")
			    base = "row-pending";

			  else
			    base = "row-floor";

			  return `${base} ${
			    params.indexRelativeToCurrentPage % 2 === 0
			      ? "even-row"
			      : "odd-row"
			  }`;
			}}
            sx={dataGridStyles(false)}
          />
		  </Box>
        </div>
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
			<h2
			  style={{
			    marginBottom: 20,
			    fontSize: 24,
			    fontWeight: 800,
			    color: "#fff",
			  }}
			>
			  Gate Pass Preview
			</h2>

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
				  sx={{
				      minWidth: 140,

				      borderRadius: "14px",

				      background:
				        "linear-gradient(180deg,#1e293b,#0f172a)",

				      border:
				        "1px solid rgba(255,255,255,.08)",

				      color:"#fff",
				    }}
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
		    <div style={{ ...popupBox, width: 1000 }}>

			<h2
			  style={{
			    marginBottom: 20,
			    fontSize: 24,
			    fontWeight: 800,
			    color: "#fff",
			  }}
			>
			  Import Preview
			</h2>

		      <div style={{ maxHeight: 400, overflow: "auto" }}>
		        {previewRows.map((row, i) => (
		          <div
		            key={i}
		            style={{
		              display: "flex",
		              justifyContent: "space-between",
		              padding: 8,
		              borderBottom: "1px solid #eee",
					  background: row.valid
					    ? "rgba(16,185,129,.12)"
					    : "rgba(239,68,68,.12)",

					  color: "#fff",
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
				  sx={{
				      minWidth: 140,

				      borderRadius: "14px",

				      background:
				        "linear-gradient(180deg,#1e293b,#0f172a)",

				      border:
				        "1px solid rgba(255,255,255,.08)",

				      color:"#fff",
				    }}
		        >
		          Confirm Import
		        </Button>

				<Button
				  sx={{
				    minWidth: 120,

				    borderRadius: "14px",

				    color: "#cbd5e1",

				    border:
				      "1px solid rgba(255,255,255,.08)",
				  }}
				 onClick={() => setPreviewOpen(false)}
				 >
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

  background: `
    radial-gradient(
      circle at top right,
      rgba(59,130,246,.12),
      transparent 28%
    ),

    radial-gradient(
      circle at bottom left,
      rgba(99,102,241,.08),
      transparent 30%
    ),

    linear-gradient(
      180deg,
      #020617,
      #0f172a,
      #111827
    )
  `,

  padding: 24,

  overflow: "hidden",

  position: "relative",
};

const backgroundText = {
  position: "absolute",

  top: "50%",

  left: "50%",

  transform: "translate(-50%,-50%)",

  fontSize: "220px",

  fontWeight: 900,

  color: "rgba(255,255,255,.025)",

  letterSpacing: 12,

  userSelect: "none",

  pointerEvents: "none",

  whiteSpace: "nowrap",

  zIndex: 0,
};

const content = {
  position: "relative",

  zIndex: 2,

  display: "flex",

  flexDirection: "column",

  gap: 20,
};

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",

  borderRadius: 24,

  padding: 24,

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 25px 60px rgba(0,0,0,.45)",

  overflow: "hidden",
};

const legend = {
  display: "flex",

  alignItems: "center",

  flexWrap: "wrap",

  gap: 1.2,

  padding: "12px 16px",

  borderRadius: 20,

  background:
    "rgba(255,255,255,.03)",

  border:
    "1px solid rgba(255,255,255,.06)",

  backdropFilter: "blur(12px)",

  marginBottom: 16,
};

const tableWrapper = {
  overflowX: "auto",

  overflowY: "hidden",

  paddingTop: 12,
  
  borderRadius: 18,

  background:
    "linear-gradient(180deg,#020617,#0f172a)",

  border:
    "1px solid rgba(255,255,255,.06)",

  WebkitOverflowScrolling:"touch",
};

const dataGridStyles = (darkMode) => ({
   background: "#020617",
   color: "#fff",
   borderRadius: 18,
   border: "none",
   
   "& .even-row": {
     backdropFilter: "brightness(1)",
   },

   "& .odd-row": {
     backdropFilter: "brightness(.96)",
   },

   "& .MuiDataGrid-columnHeaders": {
     background:
       "linear-gradient(180deg,#111827,#0f172a)",

     borderBottom:
       "1px solid rgba(255,255,255,.06)",

     minHeight: "58px !important",

     maxHeight: "58px !important",
   },

   "& .MuiCheckbox-root": {
     color:"#64748b",
   },

   "& .MuiCheckbox-root.Mui-checked": {
     color:"#3b82f6",
   },
   
   "& .MuiDataGrid-row:nth-of-type(even)": {
     background:
       "rgba(255,255,255,.015)",
   },
   
   "& .MuiDataGrid-columnHeader": {
     color: "#cbd5e1",

     fontWeight: 800,

     fontSize: 12,

     letterSpacing: ".8px",

     textTransform: "uppercase",

     borderRight:
       "1px solid rgba(255,255,255,.04)",
   },

  "& .MuiDataGrid-columnHeaderTitle": {
    color: "#60a5fa",

    fontWeight: 800,

    letterSpacing: ".8px",
  },
  
  "& .MuiDataGrid-iconSeparator": {
    color:
      "rgba(255,255,255,.08)",
  },

  "& .MuiDataGrid-sortIcon": {
    color: "#60a5fa",
  },

  "& .MuiSvgIcon-root": {
    color: "#60a5fa",
  },

  "& .MuiDataGrid-cell": {
    borderBottom:
      "1px solid rgba(255,255,255,.04)",

    color: "#f8fafc",

    fontSize: 13,

    display: "flex",

    alignItems: "center",
  },

  "& .MuiDataGrid-row": {
    borderBottom:
      "1px solid rgba(255,255,255,.03)",
  },
  
  "& .MuiDataGrid-row:hover": {
    background:
      "rgba(59,130,246,.08)",

    transition:
      "all .18s ease",
  },
  
  "& .Mui-selected": {
    background:
      "rgba(59,130,246,.12) !important",
  },
  
  "& .Mui-selected:hover": {
    background:
      "rgba(59,130,246,.16) !important",
  },

  "& .MuiDataGrid-footerContainer": {
    background:
      "linear-gradient(180deg,#111827,#0f172a)",

    borderTop:
      "1px solid rgba(255,255,255,.06)",

    color:"#cbd5e1",
  },

  "& .MuiCheckbox-root": {
    color: "#60a5fa",
  },

  "& .MuiTablePagination-root": {
    color:"#cbd5e1",
  },
  
  "& .MuiIconButton-root": {
    color:"#94a3b8",
  },

  "& .row-floor": {
    background:
      "rgba(59,130,246,.05)",
  },

  "& .row-warehouse": {
    background:
      "rgba(16,185,129,.08)",
  },

  "& .row-pending": {
    background:
      "rgba(245,158,11,.08)",
  },
});

const searchPanel = {
  display: "flex",

  alignItems: "center",

  gap: 14,

  height: 60,

  padding: "0 22px",

  marginBottom: 20,

  borderRadius: 20,

  background:
    "linear-gradient(180deg,#0f172a,#111827)",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 12px 35px rgba(0,0,0,.28)",

  backdropFilter: "blur(18px)",
};

const formFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "16px",

    background:
      "rgba(255,255,255,.04)",

    color: "#fff",

    "& fieldset": {
      borderColor:
        "rgba(255,255,255,.08)",
    },

    "&:hover fieldset": {
      borderColor:
        "rgba(59,130,246,.45)",
    },

    "&.Mui-focused fieldset": {
      borderColor:
        "#3b82f6",
    },
  },

  "& input": {
    color: "#fff",
  },
};

const statusBase = {
  fontSize: 11,

  fontWeight: 800,

  height: 28,

  borderRadius: "999px",

  px: 1.8,

  letterSpacing: ".3px",

  border:
    "1px solid rgba(255,255,255,.08)",

  backdropFilter: "blur(10px)",

  boxShadow:
    "0 6px 16px rgba(0,0,0,.18)",
};

const statusPacked = {
  ...statusBase,

  color: "#93c5fd",

  background:
    "rgba(37,99,235,.15)",
};

const statusStored = {
  ...statusBase,

  color: "#6ee7b7",

  background:
    "rgba(16,185,129,.15)",
};

const pendingChip = {
  ...statusBase,

  color: "#fcd34d",

  background:
    "rgba(245,158,11,.15)",
};

const returnChip = {
  ...statusBase,

  color: "#fca5a5",

  background:
    "rgba(239,68,68,.15)",
};

const actionPrimary = {
  px: 2.4,
  py: 0.8,

  borderRadius: "12px",

  minWidth: 100,

  fontSize: 12,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(180deg,#16a34a,#15803d)",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 10px 24px rgba(22,163,74,.28)",

  textTransform: "none",

  "&:hover": {
    transform: "translateY(-1px)",

    background:
      "linear-gradient(180deg,#22c55e,#16a34a)",
  },
};

const actionDanger = {
  px: 2.4,
  py: 0.8,

  borderRadius: "12px",

  minWidth: 100,

  fontSize: 12,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(180deg,#dc2626,#b91c1c)",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 10px 24px rgba(220,38,38,.30)",

  textTransform: "none",

  "&:hover": {
    transform: "translateY(-1px)",

    background:
      "linear-gradient(180deg,#ef4444,#dc2626)",
  },
};

const actionWarning = {
  px: 2.4,
  py: 0.8,

  borderRadius: "12px",

  minWidth: 120,

  fontSize: 12,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(180deg,#f59e0b,#d97706)",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 10px 24px rgba(245,158,11,.30)",

  textTransform: "none",

  "&:hover": {
    transform: "translateY(-1px)",

    background:
      "linear-gradient(180deg,#fbbf24,#f59e0b)",
  },
};

const actionInfo = {
  px: 2.2,
  py: 0.8,

  borderRadius: "12px",

  minWidth: 90,

  fontSize: 12,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(180deg,#2563eb,#1d4ed8)",

  border:
    "1px solid rgba(255,255,255,.08)",

  boxShadow:
    "0 10px 24px rgba(37,99,235,.30)",

  textTransform: "none",

  "&:hover": {
    transform: "translateY(-1px)",

    background:
      "linear-gradient(180deg,#3b82f6,#2563eb)",
  },
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
  width: "90%",
  maxWidth: 1100,

  maxHeight: "90vh",

  overflow: "auto",

  borderRadius: 24,

  padding: 24,

  background:
    "linear-gradient(180deg,#0f172a,#111827)",

  color: "#fff",

  border:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 30px 80px rgba(0,0,0,.55)",
};

const gatePassNumber = {
  fontSize: 30,

  fontWeight: 900,

  color: "#60a5fa",

  letterSpacing: 2,

  marginBottom: 24,
};

export default WarehousePage;