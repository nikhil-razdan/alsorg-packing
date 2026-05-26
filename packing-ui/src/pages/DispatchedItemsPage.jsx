import { useEffect, useState, useMemo  } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Chip, Box, Button, IconButton, TextField} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";


/* ===================== STYLES ===================== */
/* (UNCHANGED — EXACTLY AS YOU PROVIDED) */

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


const statusCard = {
  p: 2,
  borderRadius: 3,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  transition: "all 0.25s ease",
  border: "1px solid #e5e7eb",

  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
  }
};

const premiumButton = {
  px: 2.6,
  py: 1,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "none",

  background: "rgba(255,255,255,0.15)",
  color: "#fff",

  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.25)",

  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",

  "&:hover": {
    transform: "translateY(-3px) scale(1.04)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    background: "rgba(255,255,255,0.25)",
  },

  "&:active": {
    transform: "scale(0.96)",
  },
};

const backgroundText = (darkMode) => ({
  position: "absolute",
  fontSize: 220,
  fontWeight: 900,

  background: darkMode
    ? "linear-gradient(180deg, rgba(255,215,0,0.16), rgba(255,215,0,0.04))"
    : "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",

  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",

  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",

  pointerEvents: "none",
  letterSpacing: 8,

  filter: "blur(1px)",
});

const content = { position: "relative", zIndex: 1 };

const pageTitle = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 28,
  fontWeight: 700,
  color: "#fff",
};

const legend = {
  display: "flex",
  gap: 1.5,
  mb: 1,
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
/* ===== TABLE ===== */

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
/* ===== STATUS ===== */

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

const statusDispatched = {
  fontSize: 11,
  fontWeight: 700,
  px: 1.8,
  borderRadius: "999px",
  color: "#064e3b",
  backdropFilter: "blur(8px)",
  background:
    "linear-gradient(135deg, rgba(167,243,208,0.8), rgba(110,231,183,0.8))",
  boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
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

const bulkBar = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",

  display: "flex",
  alignItems: "center",
  gap: 20,

  padding: "14px 22px",

  background: "#1e293b", // 🔥 solid slate (dashboard match)
  color: "#fff",

  borderRadius: 16,

  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",

  zIndex: 3000,
};
/* ===== ACTIONS ===== */

const actionContainer = {
  display: "flex",
  gap: 1,
  flexWrap: "wrap",
};

const actionPrimary = {
  borderRadius: 999,
  fontWeight: 600,
  background: "#4f46e5",
  color: "#fff",
  "&:hover": { background: "#4338ca" }
};

const actionSecondary = {
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#0f172a",
};

const actionDanger = {
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
};

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 4,
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

const popupOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 5000,
};

const popupBox = {
  width: 500,
  borderRadius: 20,
  padding: 20,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
};

const themeBtn = (darkMode) => ({
  px: 2.6,
  py: 1,
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "none",

  background: darkMode
    ? "linear-gradient(135deg,#111,#222)"
    : "#111",

  color: darkMode ? "#FFD700" : "#fff",

  backdropFilter: "blur(12px)",

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
/**
 * Dispatched Items Page
 * FINAL RULESET IMPLEMENTED
 */

function DispatchedItemsPage() {
  const [rows, setRows] = useState([]);
  const [animatingId, setAnimatingId] = useState(null);
  const [loading, setLoading] = useState(false);
  /* ===== SEARCH + FILTER ===== */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupBy, setGroupBy] = useState("NONE");
  const [fromLocation, setFromLocation] = useState("");
  const role = localStorage.getItem("role");
  const isAdmin = role === "ADMIN";
  const isDispatch = role === "DISPATCH";
  const [historyOpen, setHistoryOpen] = useState(false);
  const [, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [selectionModel, setSelectionModel] = useState([]);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [gatePassModal, setGatePassModal] = useState(null);
  const [warehouseCode, setWarehouseCode] = useState("");
  const [gatePassPreview, setGatePassPreview] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [chalaanPreview, setChalaanPreview] = useState(null);
  const [chalaanModal, setChalaanModal] = useState(null);
  const [bulkGatePassOpen, setBulkGatePassOpen] = useState(false);
  const [bulkGatePassPreview, setBulkGatePassPreview] = useState(null);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  
  useEffect(() => {
    console.log("ROWS IDS:", rows.map(r => r.zohoItemId));
    console.log("SELECTED IDS:", selectionModel);
  }, [selectionModel, rows]);
  
  const getAuthHeaders = () => {
     const token = localStorage.getItem("token");

     if (!token) {
       console.error("❌ No token found");
      return{};
     }
     return {
       Authorization: `Bearer ${token}`,
     };
   };
   
  const fetchData = async () => {
     try {
       setLoading(true);
	   console.log("TOKEN:", localStorage.getItem("token"));
	   console.log("ROLE:", localStorage.getItem("role"));
       const res = await fetch(`${API_BASE_URL}/api/dispatched`, {
         method: "GET",
         headers: getAuthHeaders(),
       });

       if (!res.ok) throw new Error("Failed to fetch dispatched items");

       const data = await res.json();
	   console.log("📦 API DATA:", data);
	   console.log("📦 FIRST ITEM:", data?.[0]);

       if (!Array.isArray(data)) {
         console.error("Invalid API response:", data);
         setRows([]);
         return;
       }
	   console.log("STOCK VALUES:", data.map(d => d.stock));

	   const cleaned = data
	         .filter(d => d?.zohoItemId)
	         .map(d => ({
	           ...d,
	           stock: d.stock ?? 0,
	           status: (d.status || "").trim()
	         }));

	       setRows(cleaned);

	       return cleaned;
     } catch (err) {
       console.error(err);
       setRows([]);
	   return;
     } finally {
       setLoading(false);
     }
   };
  /* ===================== ACTIONS ===================== */

  const requestRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/request-restore`,
        { method: "POST",
			headers: getAuthHeaders()
  });
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
  
  const updateStatus = async (zohoItemId, status) => {
    try {
      console.log("🚀 API CALL:", zohoItemId, status);
      let res = null;

      if (status === "READY_TO_STORE" || status === "READY_TO_DISPATCH") {
        res = await fetch(
          `${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/dispatch?status=${status}`,
          {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "X-Username": localStorage.getItem("username"),
            },
          }
        );
      } else {
        console.warn("⛔ Invalid status:", status);
        return;
      }

      if (!res) {
        alert("No API call made");
        return;
      }

	  console.log("🚀 API RESPONSE STATUS:", res.status);
      if (!res.ok) {
        const text = await res.text();
        console.error("❌ BACKEND ERROR:", text);
        alert(text || "Status update failed");
        return;
      }

      console.log("✅ SUCCESS");

      await fetchData();

    } catch (err) {
      console.error("❌ ERROR:", err);
      alert("Status update failed");
    }
  };

  const approveRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/approve-restore`,
        { method: "POST",
			headers: getAuthHeaders()
  });
      if (!res.ok) throw new Error();
      await fetchData();
    } catch {
      alert("Approval failed");
    }
  };

  const rejectRestore = async (zohoItemId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/reject-restore`,
        { method: "POST",
			headers: getAuthHeaders()
  });
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
  
  const approveReturn = async (id) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${id}/approve-return`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) throw new Error();

      await fetchData();
    } catch {
      alert("Approval failed");
    }
  };

  const rejectReturn = async (id) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dispatched/${id}/reject-return`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) throw new Error();

      await fetchData();
    } catch {
      alert("Reject failed");
    }
  };


  /* ===================== DOWNLOAD ===================== */

  const openStickerHistory = async (itemId) => {
    try {
      setHistoryOpen(true);
      setHistoryLoading(true);
      setHistoryRows([]);
      setHistoryItem(itemId);

      const res = await fetch(
        `${API_BASE_URL}/api/stickers/${encodeURIComponent(itemId)}/history`,
        { method: "GET",
			headers: getAuthHeaders()
		 });

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
        `${API_BASE_URL}/api/audit/${encodeURIComponent(zohoItemId)}`,
        { method: "GET",
			headers: getAuthHeaders()
      });

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

  const selectableStatuses = [
    "READY",
    "READY_TO_STORE",
    "READY_TO_DISPATCH",
    "WAREHOUSE_RETURN_REQUESTED" // optional if needed
  ];

  const readyRows = useMemo(() => {
    return rows.filter(r => selectableStatuses.includes(r.status));
  }, [rows]);
  
  const columns = [
	{
	  field: "select",
	  headerName: "",
	  width: 60,
	  sortable: false,

	  renderHeader: () => {
	    const allSelected =
	      readyRows.length > 0 &&
	      readyRows.every(r => selectionModel.includes(r.zohoItemId));

	    return (
	      <input
	        type="checkbox"
	        checked={allSelected}
	        onChange={(e) => {
	          if (e.target.checked) {
	            setSelectionModel(readyRows.map(r => r.zohoItemId));
	          } else {
	            setSelectionModel([]);
	          }
	        }}
	      />
	    );
	  }, 

	  renderCell: (params) => {
	    const id = params.row.zohoItemId;
		const isReady = selectableStatuses.includes(params.row.status);
		
	    return (
	      <input
	        type="checkbox"
	        disabled={!isReady}
	        checked={selectionModel.includes(id)}
	        onChange={(e) => {
	          if (!isReady) return;

	          if (e.target.checked) {
				setSelectionModel(prev =>
				  prev.includes(id) ? prev : [...prev, id]
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
	  minWidth: 300,

	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      🔖 <span>Item Name</span>
	    </Box>
	  ),

	  renderCell: (params) => {

	    const row = params.row;

	    return (
	      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

	        {/* ⬇ STICKER HISTORY */}
	        <IconButton
	          size="small"
	          sx={{
	            width: 34,
	            height: 34,
	            borderRadius: "10px",
	            background: "rgba(59,130,246,0.1)",
	            color: "#2563eb",

	            "&:hover": {
	              background: "#2563eb",
	              color: "#fff",
	            },
	          }}

	          onClick={() => {

	            if (!row.packetItemId) {
	              alert("Packet Item ID missing");
	              return;
	            }

	            openStickerHistory(row.packetItemId);
	          }}
	        >
	          <DownloadOutlinedIcon fontSize="small" />
	        </IconButton>

	        {/* 📄 AUDIT LOGS */}
	        <IconButton
	          size="small"

	          onClick={() => {

	            if (!row.zohoItemId) {
	              alert("Zoho Item ID missing");
	              return;
	            }

	            openAuditLogs(row.zohoItemId);
	          }}

	          sx={{
	            width: 34,
	            height: 34,
	            borderRadius: "10px",
	            background: "rgba(249,115,22,0.1)",
	            color: "#ea580c",

	            "&:hover": {
	              background: "#ea580c",
	              color: "#fff",
	            },
	          }}
	        >
	          📄
	        </IconButton>

	        <span>{row.name}</span>

	      </Box>
	    );
	  },
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
	  field: "stock",
	  headerName: "Stock",
	  width: 100,
	  renderHeader: () => (
	    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
	      📦 <span>Stock</span>
	    </Box>
	  ),
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
		{
		  field: "clientName",
		  headerName: "Client",
		  minWidth: 180,
		  renderHeader: () => (
		    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
		      👤 <span>Client</span>
		    </Box>
		  ), },
		  {
		    field: "status",
		    headerName: "Status",
		    width: 220,
		    renderHeader: () => (
		      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
		        📋 <span>Status</span>
		      </Box>
		    ),
	  renderCell: (params) => {
	    const row = params.row;

		const canEdit =
		  isDispatch &&
		  ["READY", "READY_TO_STORE"].includes(row.status);

		if (!canEdit) {
		  const getStatusStyle = (status) => {
		    if (status === "READY") {
		      return {
		        color: "#2563eb",
		        background: "rgba(219,234,254,0.8)",
		      };
		    }
		    if (status === "DISPATCHED") {
		      return {
		        color: "#059669",
		        background: "rgba(209,250,229,0.8)",
		      };
		    }
		    return {
		      color: "#92400e",
		      background: "rgba(254,243,199,0.9)",
		    };
		  };

		  const style = getStatusStyle(row.status);

		  return (
		    <Box
		      sx={{
		        px: 1.8,
		        py: 0.4,
		        borderRadius: "999px",
		        fontSize: 11,
		        fontWeight: 700,
		        display: "inline-flex",
		        alignItems: "center",
		        gap: 0.6,
		        ...style,
		      }}
		    >
		      ● {row.status}
		    </Box>
		  );
		}

	    return (
	      <Button
	        size="small"
	        onClick={() => setStatusModal(row)}   // 🔥 open modal
			sx={{
			  borderRadius: "999px",
			  fontWeight: 600,
			  color: "#fff",
			  background:
			    "linear-gradient(135deg,#111827,#374151)",
			  boxShadow: "0 6px 18px rgba(0,0,0,0.4)",

			  "&:hover": {
			    transform: "translateY(-2px)",
			    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
			  }
			}}
	      >
	        Change Status
	      </Button>
	    );
	  },
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

		const canGenerateChalaan =
		  isDispatch && row.status === "READY_TO_DISPATCH";
		  
		  const canRequestRestore =
		    row.status === "DISPATCHED" &&
		    row.approvalStatus !== "PENDING";
			
			const canGenerateGatePass =
			  isDispatch && row.status === "READY_TO_STORE";

        return (
          <Box sx={actionContainer}>
		  {row.status === "READY_TO_DISPATCH" && isDispatch && (
		    <Button
		      size="small"
			  onClick={async () => {
			    try {
			      const freshRows = await fetchData();

			      const latestItem = freshRows?.find(
			        r => r.zohoItemId === row.zohoItemId
			      );

			      if (!latestItem || latestItem.status !== "READY_TO_DISPATCH") {
			        alert(`Item not ready. Current status: ${latestItem?.status}`);
			        return;
			      }

			      const res = await fetch(
			        `${API_BASE_URL}/api/chalaan/${row.zohoItemId}/download?preview=true`,
			        {
			          method: "GET",
			          headers: getAuthHeaders(),
			        }
			      );

			      const contentType = res.headers.get("content-type");

				  if (!res.ok) {
				    const text = await res.text();
				    console.error("❌ Chalaan failed:", text);
				    alert(text || "Failed to generate chalaan");
				    return;
				  }

			      const blob = await res.blob();
			      const url = URL.createObjectURL(blob);

			      // 🔥 THIS IS THE MAIN CHANGE
			      setChalaanPreview({
			        url,
			        id: row.zohoItemId
			      });

			    } catch (err) {
			      console.error(err);
			      alert("Failed to preview chalaan");
			    }
			  }}
			  sx={{
			    px: 2.2,
			    borderRadius: "999px",
			    fontSize: 12,
			    fontWeight: 600,
			    color: "#fff",
			    background:
			      "linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
			    transition: "all 0.25s ease",
			    "&:hover": {
			      transform: "translateY(-2px) scale(1.03)",
			      boxShadow: "0 10px 25px rgba(37,99,235,0.5)"
			    }
			  }}
		    >
		      Generate Chalaan
		    </Button>
		  )}
		  {canGenerateGatePass && (
		    <Button
		      size="small"
		      onClick={() => {
		        setGatePassModal(row);      // 🔥 open modal
		        setWarehouseCode("");       // reset input
		        setGatePassPreview(null);   // reset preview
		      }}
			  sx={{
			    ...premiumButton,
			    background: "linear-gradient(180deg,#10b981,#059669)",
			    color: "#fff"
			  }}
		    >
		      Generate Gate Pass
		    </Button>
		  )}
		  
            {isAdmin && row.approvalStatus === "PENDING" && (
              <>
                <Button
                  size="small"
                  onClick={() => approveRestore(row.zohoItemId)}
				  sx={{
				    ...premiumButton,
				    background: "linear-gradient(180deg,#10b981,#059669)",
				    color: "#fff"
				  }}
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

             {canRequestRestore && (
			  <Button
			    size="small"
			    onClick={() => requestRestore(row.zohoItemId)}
			    sx={actionSecondary}
			  >
			    Request Restore
			  </Button>
			)}

            {row.approvalStatus === "PENDING" && (
              <Chip label="REQUESTED" size="small" sx={pendingChip} />
            )}
			{isAdmin && row.status === "WAREHOUSE_RETURN_REQUESTED" && (
			  <>
			    <Button
			      size="small"
			      onClick={() => approveReturn(row.zohoItemId)}
			      sx={{
			        ...premiumButton,
			        background: "linear-gradient(180deg,#10b981,#059669)",
			        color: "#fff"
			      }}
			    >
			      Approve Return
			    </Button>

			    <Button
			      size="small"
			      onClick={() => rejectReturn(row.zohoItemId)}
			      sx={actionDanger}
			    >
			      Reject
			    </Button>
			  </>
			)}
			
          </Box>
        );
      },
    },
  ];
  

  useEffect(() => {
    fetchData();
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

  /* ===== FILTERED ROWS ===== */
  const filteredRows = useMemo(() => {
	if (!Array.isArray(rows)) return [];
    return rows.filter((r) => {
      const name = r.name || "";
      const client = r.clientName || "";

      if (
        search &&
        !name.toLowerCase().includes(search.toLowerCase()) &&
        !client.toLowerCase().includes(search.toLowerCase())
      )
        return false;

      if (statusFilter !== "ALL" && r.status !== statusFilter)
        return false;

      return true;
    });
  }, [rows, search, statusFilter]);
  console.log("🔥 selectionModel:", selectionModel);
  
  const selectedItems = rows.filter(r =>
    selectionModel?.includes(r.zohoItemId)
  );
  
  const selectedStatusSet = new Set(selectedItems.map(i => i.status));

  const isSingleStatus = selectedStatusSet.size === 1;

  const selectedStatus = isSingleStatus
    ? [...selectedStatusSet][0]
    : null;

  const allReadyToDispatch = selectedItems.length > 0 && selectedItems.every(
    item => item.status === "READY_TO_DISPATCH"
  );
  
  const allReadyToStore = selectedItems.length > 0 && selectedItems.every(
    item => item.status === "READY_TO_STORE"
  );
  
  const allReady = selectedItems.length > 0 && selectedItems.every(
    item => item.status === "READY"
  );
  
  return (
    <div style={page()}>
      <div style={backgroundText(false)}>Alsorg</div>
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
		  <Box style={{
		    display: "flex",
		    alignItems: "center",
		    justifyContent: "space-between",
		    marginBottom: 10
		  }}>
		    <div>
		      <h2 style={{
		        margin: 0,
		        fontSize: 28,
		        fontWeight: 800,
		        color: "#0f172a"
		      }}>
		        Dispatched Items
		      </h2>

		      <div style={{
		        fontSize: 13,
		        color: "#64748b",
		        marginTop: 4
		      }}>
		        Track, manage and dispatch inventory
		      </div>
		    </div>

		    <Chip
		      label={`${rows.length} Items`}
		      sx={{
		        background: "#e0f2fe",
		        color: "#0369a1",
		        fontWeight: 700
		      }}
		    />
		  </Box>
	    </Box>
	  </Box>
		
	  <Box sx={searchPanel}>
	    <SearchIcon
		sx={{
		    opacity: 0.75,
		    color: "rgba(0,0,0,0.55)",
		  }}
	    />

		<TextField
		  variant="standard"
		  placeholder="Search by Item or Client..."
		  value={search}
		  onChange={(e) => setSearch(e.target.value)}
		  InputProps={{ disableUnderline: true }}
		  sx={{
		    flex: 1,  // 🔥 IMPORTANT (fix width)

		    "& .MuiInputBase-root": {
		      height: 40,                // ✅ MATCH warehouse
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
		      opacity: 1,
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
	      value={statusFilter}
	      onChange={(e) => setStatusFilter(e.target.value)}
	      slotProps={{
	        select: {
	          MenuProps: {
	            PaperProps: {
	              sx: {
	                mt: 1,
	                borderRadius: "18px",
	                overflow: "hidden",

	                // ❌ removed blur (not in dashboard)
	                background: "#ffffff",
	                color: "#111",

	                border: "1px solid rgba(0,0,0,0.06)",
	                boxShadow: "0 20px 45px rgba(0,0,0,0.18)",

	                "& .MuiMenuItem-root": {
	                  fontSize: 14,
	                  fontWeight: 500,
	                  color: "#111",
	                  transition: "all 0.2s ease",
	                },

	                "& .MuiMenuItem-root:hover": {
	                  background: "rgba(59,130,246,0.08)",
	                },

	                "& .Mui-selected": {
	                  background: "rgba(59,130,246,0.12) !important",
	                  color: "#2563eb",
	                  fontWeight: 700,
	                },
	              },
	            },
	          },
	        }
	      }}
	      sx={{
	        "& .MuiInputBase-root": {
	          height: 40,
	          borderRadius: 10,
	          background: "#fff",
	          border: "1px solid #e2e8f0",
	        },
	        "& input": {
	          fontSize: 14,
	          color: "#0f172a",
	        }
	      }}
	    >
		    <MenuItem value="ALL">All Status</MenuItem>
			<MenuItem value="READY">🟡 Ready (Decision Pending)</MenuItem>
			<MenuItem value="READY_TO_STORE">📦 Ready To Store</MenuItem>
			<MenuItem value="WAREHOUSE_REQUESTED">🏭 Warehouse Requested</MenuItem>
			<MenuItem value="READY_TO_DISPATCH">🚚 Ready To Dispatch</MenuItem>
		  </TextField>

		  <TextField
		    select
		    size="small"
		    value={groupBy}
		    onChange={(e) => setGroupBy(e.target.value)}
			sx={{
			  "& .MuiInputBase-root": {
			    height: 40,
			    borderRadius: 10,
			    background: "#fff",
			    border: "1px solid #e2e8f0",
			  },
			  "& input": {
			    fontSize: 14,
			    color: "#0f172a",
			  }
			}}
		  >
		    <MenuItem value="NONE">No Group</MenuItem>
		    <MenuItem value="STATUS">Group by Status</MenuItem>
		    <MenuItem value="CLIENT">Group by Client</MenuItem>
		  </TextField>
		</Box>
		<Box sx={legend}>
		  
		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
			background: "#e0f2fe",
		    color: "#2563eb",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    🏠 IN WAREHOUSE
		  </Box>

		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
			background: "#dcfce7",
		    color: "#059669",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    🚚 DISPATCHED
		  </Box>

		  <Box sx={{
		    px: 2,
		    py: 0.6,
		    borderRadius: "999px",
			background: "#fef3c7",
		    color: "#d97706",
		    fontWeight: 600,
		    fontSize: 12
		  }}>
		    ⏳ REQUESTED
		  </Box>

		</Box>

        <div style={tableWrapper}> 
		<DataGrid
		  selectionModel={selectionModel}
		  onSelectionModelChange={(newSelection) => setSelectionModel(newSelection)}
		  rows={Array.isArray(filteredRows) ? filteredRows : []}
		  columns={columns}
		  loading={loading}
		  density="compact"
		  sx={dataGridStyles}
		  onRowClick={(params) => {
		    setAnimatingId(params.id);
		    setTimeout(() => setAnimatingId(null), 200);
		  }}
		  getRowId={(row) => row.zohoItemId}
		  disableRowSelectionOnClick
		  disableColumnMenu
		/>
        </div>
      </div>
	  {Array.isArray(selectionModel) && selectionModel.length > 0 && isDispatch && (
		<div
		  style={bulkBar}
		>
		  {/* TEXT */}
		  <span style={{ fontWeight: 600 }}>
		    {selectionModel.length} item{selectionModel.length > 1 ? "s" : ""} selected
		  </span>

		  {/* 🔵 BULK CHALAAN */}
		  <Button
		    size="small"
		    disabled={!allReadyToDispatch}
		    onClick={() => setBulkDrawerOpen(true)}
		    sx={{
			  px: 2.4,
			  borderRadius: 10,
			  fontWeight: 600,
		      background: allReadyToDispatch
		        ? "linear-gradient(180deg,#3b82f6,#2563eb)"
		        : "#9ca3af",
		      color: "#fff",
		    }}
		  >
		    Generate Bulk Chalaan
		  </Button>

		  {allReady && (
		    <Button
		      size="small"
		      onClick={() => setBulkStatusModal(true)}
		      sx={{
				px: 2.4,
				  borderRadius: 10,
				  fontWeight: 600,
		        background: "linear-gradient(180deg,#f59e0b,#d97706)",
		        color: "#fff",
		      }}
		    >
		      Change Status
		    </Button>
		  )}

		  {/* 🟢 BULK GATE PASS BUTTON (if added earlier) */}
		  <Button
		    size="small"
		    disabled={!allReadyToStore}
		    onClick={() => setBulkGatePassOpen(true)}
		    sx={{
				px: 2.4,
				  borderRadius: 10,
				  fontWeight: 600,
		      background: allReadyToStore
		        ? "linear-gradient(180deg,#10b981,#059669)"
		        : "#9ca3af",
		      color: "#fff",
		    }}
		  >
		    Generate Bulk Gate Pass
		  </Button>

		  {/* CLEAR */}
		  <Button
		    size="small"
		    onClick={() => setSelectionModel([])}
			sx={{
			  px: 2,
			  borderRadius: 10,
			  background: "rgba(255,255,255,0.1)",
			  color: "#fff",
			  "&:hover": {
			    background: "rgba(255,255,255,0.2)",
			  },
			}}
		  >
		    Clear
		  </Button>
		</div>
	  )}
	  {historyOpen && (
	    <div
	      style={{
	        position: "fixed",
	        inset: 0,
			background: `
			  radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 20%),
			  rgba(15,23,42,0.55)
			`,
			backdropFilter: "blur(8px)",
			WebkitBackdropFilter: "blur(8px)",
	        display: "flex",
	        alignItems: "center",
	        justifyContent: "center",
	        zIndex: 2000,
	      }}
	      onClick={() => setHistoryOpen(false)}
	    >
	      <Box
		  style={{
		    width: 560,
		    maxHeight: "80vh",
		    padding: 22,
		    borderRadius: 28,

		    position: "relative",
		    overflow: "auto",

		    background: `
		      linear-gradient(
		        145deg,
		        rgba(255,255,255,0.92),
		        rgba(255,255,255,0.74)
		      )
		    `,

		    backdropFilter: "blur(30px) saturate(180%)",
		    WebkitBackdropFilter: "blur(30px) saturate(180%)",

		    border: "1px solid rgba(255,255,255,0.35)",

		    boxShadow: `
		      0 35px 90px rgba(0,0,0,0.38),
		      inset 0 1px 0 rgba(255,255,255,0.7)
		    `,
		  }}
	        onClick={(e) => e.stopPropagation()}
	      >
		  <div style={modalGloss} />
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

				<Box sx={{ display: "flex", gap: 1 }}>
				{/* 👁 VIEW */}
				<IconButton
				  onClick={async () => {
				    try {
				      const res = await fetch(
				        `${API_BASE_URL}/api/stickers/history/${h.id}/download-pdf`,
				        {
				          method: "GET",
				          headers: getAuthHeaders(),
				        }
				      );

				      if (!res.ok) {
				        const text = await res.text();

				        console.error("❌ Sticker preview failed:", text);

				        alert(text || "Preview failed");

				        return;
				      }

				      const blob = await res.blob();

				      // 🔥 IMPORTANT
				      if (blob.size === 0) {
				        alert("Empty PDF received");
				        return;
				      }

				      const blobUrl = URL.createObjectURL(blob);

				      // 🔥 OPEN SECURELY
				      const newTab = window.open();

				      if (!newTab) {
				        alert("Popup blocked");
				        return;
				      }

				      newTab.location.href = blobUrl;

				      // 🔥 DO NOT revoke immediately
				      setTimeout(() => {
				        URL.revokeObjectURL(blobUrl);
				      }, 10000);

				    } catch (err) {
				      console.error(err);
				      alert("Preview failed");
				    }
				  }}
				  size="small"
				>
				  👁
				</IconButton>

				  {/* ⬇ DOWNLOAD */}
				  <IconButton
				    onClick={async () => {
				      try {
				        const res = await fetch(
				          `${API_BASE_URL}/api/stickers/history/${h.id}/download-pdf`,
				          {
				            method: "GET",
				            headers: getAuthHeaders(),
				          }
				        );

				        if (!res.ok) throw new Error();

				        const blob = await res.blob();
				        const url = window.URL.createObjectURL(blob);

				        const a = document.createElement("a");
				        a.href = url;
				        a.download = `STICKER_${h.stickerNumber}.pdf`;
				        a.click();

						setTimeout(() => {
						  window.URL.revokeObjectURL(url);
						}, 10000);

				      } catch (err) {
				        console.error(err);
				        alert("Download failed");
				      }
				    }}
				    size="small"
				  >
				    ⬇
				  </IconButton>
				</Box>
	          </Box>
	        ))}

	        <Box sx={{ textAlign: "right", mt: 2 }}>
	          <Button onClick={() => setHistoryOpen(false)}>
	            Close
	          </Button>
	        </Box>
	      </Box>
	    </div>
	  )}
	  {auditOpen && (
	    <div
	      style={{
	        position: "fixed",
	        inset: 0,
			background: `
			  radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 20%),
			  rgba(15,23,42,0.55)
			`,
			backdropFilter: "blur(8px)",
			WebkitBackdropFilter: "blur(8px)",
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
		    padding: 22,
		    borderRadius: 28,

		    position: "relative",
		    overflow: "auto",

		    background: `
		      linear-gradient(
		        145deg,
		        rgba(255,255,255,0.92),
		        rgba(255,255,255,0.74)
		      )
		    `,

		    backdropFilter: "blur(30px) saturate(180%)",
		    WebkitBackdropFilter: "blur(30px) saturate(180%)",

		    border: "1px solid rgba(255,255,255,0.35)",

		    boxShadow: `
		      0 35px 90px rgba(0,0,0,0.38),
		      inset 0 1px 0 rgba(255,255,255,0.7)
		    `,
		  }}
	        onClick={(e) => e.stopPropagation()}
	      >
		  <div style={modalGloss} />
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
				  (auditRows || [])
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
	  {bulkDrawerOpen && (
	    <div
	      style={{
	        position: "fixed",
	        inset: 0,
			background: `
			  radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 20%),
			  rgba(15,23,42,0.55)
			`,
			backdropFilter: "blur(8px)",
			WebkitBackdropFilter: "blur(8px)",
	        zIndex: 4000,
	        display: "flex",
	        justifyContent: "flex-end",
	      }}
	      onClick={() => setBulkDrawerOpen(false)}
	    >
	      <div
	        style={{
	          width: 420,
	          height: "100%",
	          background: "#fff",
	          padding: 20,
	          boxShadow: "-10px 0 40px rgba(0,0,0,0.3)",
	          display: "flex",
	          flexDirection: "column",
	        }}
	        onClick={(e) => e.stopPropagation()}
	      >
	        <h3 style={{ marginBottom: 12 }}>
	          Bulk Chalaan
	        </h3>

	        <div style={{ flex: 1, overflow: "auto" }}>
	          {(rows || []).filter((r) => selectionModel?.includes(r.zohoItemId))
	            .map((item) => (
	              <Box
	                key={item.zohoItemId}
	                sx={{
	                  p: 1.5,
	                  mb: 1,
	                  borderRadius: 10,
	                  background: "rgba(243,244,246,0.9)",
	                }}
	              >
	                <div style={{ fontWeight: 600 }}>{item.name}</div>
	                <div style={{ fontSize: 12, opacity: 0.7 }}>
	                  {item.clientName}
	                </div>
	              </Box>
	            ))}
	        </div>

	        <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
	          <Button
	            fullWidth
	            disabled={bulkLoading}
	            onClick={async () => {
	              try {
	                setBulkLoading(true);

	                const res = await fetch(
	                  `${API_BASE_URL}/api/chalaan/bulk`,
	                  {
	                    method: "POST",
	                    headers: {
	                      "Content-Type": "application/json",
	                      Authorization: `Bearer ${localStorage.getItem("token")}`,
	                    },
						body: JSON.stringify(
						  rows
						    .filter(r => selectionModel.includes(r.zohoItemId))
						    .map(r => r.zohoItemId)
						),
	                  }
	                );

	                if (!res.ok) throw new Error();

	                const blob = await res.blob();
	                const url = window.URL.createObjectURL(blob);

	                const a = document.createElement("a");
	                a.href = url;
	                a.download = `CHALAAN_BULK.pdf`;
	                document.body.appendChild(a);
	                a.click();
	                a.remove();

	                window.URL.revokeObjectURL(url);
					
					await fetchData();
					
	                setSelectionModel([]);
	                setBulkDrawerOpen(false);

	              } catch (err) {
	                console.error(err);
	                alert("Bulk chalaan failed");
	              } finally {
	                setBulkLoading(false);
	              }
	            }}
	            sx={{
	              borderRadius: 999,
	              background: "linear-gradient(180deg,#2563eb,#1d4ed8)",
	              color: "#fff",
	            }}
	          >
	            {bulkLoading ? "Generating..." : "Confirm & Generate"}
	          </Button>

	          <Button
	            fullWidth
	            onClick={() => setBulkDrawerOpen(false)}
	          >
	            Cancel
	          </Button>
	        </Box>
	      </div>
	    </div>
	  )}
	  {bulkGatePassOpen && (
	    <div style={popupOverlay} onClick={() => setBulkGatePassOpen(false)}>
	      <div style={popupBox} onClick={(e) => e.stopPropagation()}>
		  <div style={modalGloss} />
	        <h2>Bulk Gate Pass</h2>

	        {/* Warehouse Code */}
	        <TextField
	          fullWidth
	          placeholder="Warehouse Code (WH-01)"
	          value={warehouseCode}
	          onChange={(e) => setWarehouseCode(e.target.value)}
	          sx={{ mb: 2 }}
	        />

	        {/* From Location */}
	        <TextField
	          fullWidth
	          placeholder="From Location"
	          value={fromLocation}
	          onChange={(e) => setFromLocation(e.target.value)}
	          sx={{ mb: 2 }}
	        />

	        {/* PDF PREVIEW */}
	        {bulkGatePassPreview && (
	          <iframe
	            src={bulkGatePassPreview}
	            style={{
	              width: "100%",
	              height: 400,
	              border: "none",
	              borderRadius: 8,
	              marginBottom: 12
	            }}
	          />
	        )}

	        <Box sx={{ display: "flex", gap: 2 }}>

	          {/* GENERATE BUTTON */}
	          <Button
	            variant="contained"
	            disabled={!warehouseCode}
	            onClick={async () => {
	              try {

	                // 🔥 STEP 1: CALL BULK STORE API
	                const res = await fetch(
	                  `${API_BASE_URL}/api/dispatched/bulk/store?warehouseCode=${encodeURIComponent(warehouseCode)}&fromLocation=${encodeURIComponent(fromLocation)}`,
	                  {
	                    method: "POST",
	                    headers: {
	                      "Content-Type": "application/json",
	                      Authorization: `Bearer ${localStorage.getItem("token")}`,
	                    },
	                    body: JSON.stringify(selectionModel),
	                  }
	                );

	                if (!res.ok) {
	                  const text = await res.text();
	                  alert(text || "Bulk gate pass failed");
	                  return;
	                }

	                const data = await res.json();
	                const gatePass = data.gatePass;

	                // 🔥 STEP 2: FETCH BULK PDF
	                const pdfRes = await fetch(
	                  `${API_BASE_URL}/api/gatepass/bulk/${gatePass}/pdf`,
	                  {
	                    headers: {
	                      Authorization: `Bearer ${localStorage.getItem("token")}`,
	                    },
	                  }
	                );

	                const blob = await pdfRes.blob();
	                const url = URL.createObjectURL(blob);

	                setBulkGatePassPreview(url);

	                // 🔥 STEP 3: REFRESH DATA
	                await fetchData();

	              } catch (err) {
	                console.error(err);
	                alert("Bulk Gate Pass failed");
	              }
	            }}
	          >
	            Generate
	          </Button>

	          {/* CLOSE */}
	          <Button
	            onClick={() => {
	              if (bulkGatePassPreview) URL.revokeObjectURL(bulkGatePassPreview);
	              setBulkGatePassOpen(false);
	            }}
	          >
	            Close
	          </Button>

	        </Box>
	      </div>
	    </div>
	  )}
	  {gatePassModal && (
	    <div
	      style={popupOverlay}
	      onClick={() => {
	        if (gatePassPreview) URL.revokeObjectURL(gatePassPreview);
	        setGatePassModal(null);
	      }}
	    >
	      <div
	        style={popupBox}

	        onClick={(e) => e.stopPropagation()}
	      >
		  <div style={modalGloss} />
	        <h2 style={{ marginBottom: 10 }}>Generate Gate Pass</h2>

	        {/* INPUT */}
	        <TextField
	          fullWidth
	          placeholder="Enter Warehouse Code (WH-01)"
	          value={warehouseCode}
	          onChange={(e) => setWarehouseCode(e.target.value)}
			  sx={{
			    "& .MuiInputBase-root": {
			      height: 40,
			      borderRadius: 10,
			      background: "#fff",
			      border: "1px solid #e2e8f0",
			    },
			    "& input": {
			      fontSize: 14,
			      color: "#0f172a",
			    }
			  }}
	        />

	        {/* PREVIEW */}
	        {gatePassPreview && (
	          <iframe
	            src={gatePassPreview}
	            style={{
	              width: "100%",
	              height: "420px",
	              border: "none",
	              borderRadius: 8,
	              marginBottom: 12,
	            }}
	          />
	        )}

	        {/* ACTIONS */}
	        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
			<TextField
						    fullWidth
						    placeholder="From Location (Floor / Packing)"
						    value={fromLocation}
						    onChange={(e) => setFromLocation(e.target.value)}
						  />
	          <Button
			  
	            variant="contained"
	            disabled={!warehouseCode}
	            onClick={async () => {
	              try {
	                // 🔥 STEP 1: GENERATE
	                const res = await fetch(
	                  `${API_BASE_URL}/api/dispatched/${gatePassModal.zohoItemId}/store?warehouseCode=${encodeURIComponent(warehouseCode)}&fromLocation=${encodeURIComponent(fromLocation)}`,
	                  {
	                    method: "POST",
	                    headers: {
	                      Authorization: `Bearer ${localStorage.getItem("token")}`,
	                      "X-Username": localStorage.getItem("username"),
	                    },
	                  }
	                );

					if (!res.ok) {
					  const text = await res.text();
					  alert(text || "Gate pass failed");
					  return;
					}

	                const data = await res.json();

	                // 🔥 STEP 2: FETCH PDF
	                const resPdf = await fetch(
	                  `${API_BASE_URL}/api/gatepass/${gatePassModal.zohoItemId}/pdf`,
	                  {
	                    headers: {
	                      Authorization: `Bearer ${localStorage.getItem("token")}`,
	                    },
	                  }
	                );

					const blob = await resPdf.blob();

					console.log("📄 PDF SIZE:", blob.size); // 🔥 ADD THIS

					
					const url = URL.createObjectURL(blob);

					setGatePassPreview(url);
					console.log("📄 Preview URL:", url);

	                // 🔥 STEP 3: REFRESH DATA
	                await fetchData();

	              } catch (err) {
	                console.error(err);
	                alert("Failed to generate gate pass");
	              }
	            }}
	          >
	            Generate				
	          </Button>

	          <Button
	            onClick={() => {
	              if (gatePassPreview) URL.revokeObjectURL(gatePassPreview);
	              setGatePassModal(null);
	            }}
	          >
	            Close
	          </Button>
	        </Box>
	      </div>
	    </div>
	  )}
	  {statusModal && (
	    <div style={popupOverlay} onClick={() => setStatusModal(null)}>
	      <div 		
		  style={{
		    width: 520,
		    padding: 28,
		    borderRadius: 28,

		    position: "relative",
		    overflow: "hidden",

		    background: `
		      linear-gradient(
		        145deg,
		        rgba(255,255,255,0.9),
		        rgba(255,255,255,0.72)
		      )
		    `,

		    backdropFilter: "blur(30px) saturate(180%)",
		    WebkitBackdropFilter: "blur(30px) saturate(180%)",

		    border: "1px solid rgba(255,255,255,0.35)",

		    boxShadow: `
		      0 35px 90px rgba(0,0,0,0.38),
		      inset 0 1px 0 rgba(255,255,255,0.7)
		    `,

		    transform: "scale(1)",
		    transition: "all 0.25s ease",
		  }} onClick={(e) => e.stopPropagation()}>
		  <div style={modalGloss} />

	        <h2>Select Action</h2>

			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

			  {/* STORE */}
			  <Box
			    sx={{
			      ...statusCard,
			      background: "linear-gradient(180deg,#ecfdf5,#d1fae5)"
			    }}
				onClick={async () => {
				  try {
				    const row = statusModal;

				    await updateStatus(row.zohoItemId, "READY_TO_STORE");

				    const fresh = await fetchData();
				    const updated = fresh.find(r => r.zohoItemId === row.zohoItemId);

				    if (!updated || updated.status !== "READY_TO_STORE") {
				      alert("Item not ready for warehouse");
				      return;
				    }

				    setStatusModal(null);
				    setGatePassModal(updated);

				  } catch (err) {
				    console.error(err);
				    alert("Failed to prepare item for warehouse");
				  }
				}}
			  >
			    <Box>
			      <div style={{ fontWeight: 700 }}>📦 Move to Warehouse</div>
			      <div style={{ fontSize: 12, opacity: 0.7 }}>
			        Generate Gate Pass
			      </div>
			    </Box>
			    ➜
			  </Box>

			  {/* DISPATCH */}
			  <Box
			    sx={{
			      ...statusCard,
			      background: "linear-gradient(180deg,#eff6ff,#dbeafe)"
			    }}
			    onClick={async () => {
			      setStatusModal(null);
			      await updateStatus(statusModal.zohoItemId, "READY_TO_DISPATCH");
			    }}
			  >
			    <Box>
			      <div style={{ fontWeight: 700 }}>🚚 Dispatch Item</div>
			      <div style={{ fontSize: 12, opacity: 0.7 }}>
			        Generate Chalaan
			      </div>
			    </Box>
			    ➜
			  </Box>

			</Box>

	      </div>
	    </div>
	  )}
	  {bulkStatusModal && (
	    <div style={popupOverlay} onClick={() => setBulkStatusModal(false)}>
	      <div
		  style={{
		    width: 520,
		    padding: 28,
		    borderRadius: 28,

		    position: "relative",
		    overflow: "hidden",

		    background: `
		      linear-gradient(
		        145deg,
		        rgba(255,255,255,0.9),
		        rgba(255,255,255,0.72)
		      )
		    `,

		    backdropFilter: "blur(30px) saturate(180%)",
		    WebkitBackdropFilter: "blur(30px) saturate(180%)",

		    border: "1px solid rgba(255,255,255,0.35)",

		    boxShadow: `
		      0 35px 90px rgba(0,0,0,0.38),
		      inset 0 1px 0 rgba(255,255,255,0.7)
		    `,

		    transform: "scale(1)",
		    transition: "all 0.25s ease",
		  }}
	        onClick={(e) => e.stopPropagation()}
	      >
		  <div style={modalGloss} />
	        <h2>Bulk Status Change</h2>

	        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

	          {/* 📦 MOVE TO WAREHOUSE */}
	          <Box
	            sx={{
	              ...statusCard,
	              background: "linear-gradient(180deg,#ecfdf5,#d1fae5)"
	            }}
	            onClick={async () => {
	              try {
	                for (const id of selectionModel) {
	                  await updateStatus(id, "READY_TO_STORE");
	                }

	                await fetchData();
	                setSelectionModel([]);
	                setBulkStatusModal(false);

	              } catch (err) {
	                console.error(err);
	                alert("Bulk store failed");
	              }
	            }}
	          >
	            <Box>
	              <div style={{ fontWeight: 700 }}>📦 Move to Warehouse</div>
	              <div style={{ fontSize: 12, opacity: 0.7 }}>
	                Mark all as READY_TO_STORE
	              </div>
	            </Box>
	            ➜
	          </Box>

	          {/* 🚚 DISPATCH */}
	          <Box
	            sx={{
	              ...statusCard,
	              background: "linear-gradient(180deg,#eff6ff,#dbeafe)"
	            }}
	            onClick={async () => {
	              try {
	                for (const id of selectionModel) {
	                  await updateStatus(id, "READY_TO_DISPATCH");
	                }

	                await fetchData();
	                setSelectionModel([]);
	                setBulkStatusModal(false);

	              } catch (err) {
	                console.error(err);
	                alert("Bulk dispatch failed");
	              }
	            }}
	          >
	            <Box>
	              <div style={{ fontWeight: 700 }}>🚚 Dispatch Items</div>
	              <div style={{ fontSize: 12, opacity: 0.7 }}>
	                Mark all as READY_TO_DISPATCH
	              </div>
	            </Box>
	            ➜
	          </Box>

	        </Box>
	      </div>
	    </div>
	  )}
	  {chalaanPreview && (
	    <div
	      style={popupOverlay}
	      onClick={() => {
	        URL.revokeObjectURL(chalaanPreview.url);
	        setChalaanPreview(null);
	      }}
	    >
	      <div
		  style={{
		    width: 800,
		    padding: 24,
		    borderRadius: 28,

		    position: "relative",
		    overflow: "hidden",

		    background: `
		      linear-gradient(
		        145deg,
		        rgba(255,255,255,0.92),
		        rgba(255,255,255,0.74)
		      )
		    `,

		    backdropFilter: "blur(30px) saturate(180%)",
		    WebkitBackdropFilter: "blur(30px) saturate(180%)",

		    border: "1px solid rgba(255,255,255,0.35)",

		    boxShadow: `
		      0 35px 90px rgba(0,0,0,0.38),
		      inset 0 1px 0 rgba(255,255,255,0.7)
		    `,
		  }}
	        onClick={(e) => e.stopPropagation()}
	      >
		  <div style={modalGloss} />
	        <h2 style={{ marginBottom: 10 }}>Chalaan Preview</h2>

	        <iframe
	          src={chalaanPreview.url}
	          style={{
	            width: "100%",
	            height: "500px",
	            border: "none",
	            borderRadius: 8,
	            marginBottom: 12,
	          }}
	        />

	        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>

	          {/* DOWNLOAD BUTTON */}
	          <Button
	            variant="contained"
	            onClick={() => {
	              const a = document.createElement("a");
	              a.href = chalaanPreview.url;
	              a.download = `CHALAAN_${chalaanPreview.id}.pdf`;
	              document.body.appendChild(a);
	              a.click();
	              a.remove();
	            }}
	          >
	            Download
	          </Button>

	          {/* CLOSE */}
	          <Button
	            onClick={() => {
	              URL.revokeObjectURL(chalaanPreview.url);
	              setChalaanPreview(null);
	            }}
	          >
	            Close
	          </Button>

	        </Box>
	      </div>
	    </div>
	  )}
    </div>
  );
}

export default DispatchedItemsPage;
