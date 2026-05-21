import { useEffect, useState, useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Box,
  Button,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import LockResetIcon from "@mui/icons-material/LockReset";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import API from "../services/api";

function UsersPage() {

  const [users,setUsers] = useState([]);
  const [loading,setLoading] = useState(false);

  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [role,setRole] = useState("PACKING");

  const [search,setSearch] = useState("");

  const [editId,setEditId] = useState(null);
  const [editUsername,setEditUsername] = useState("");
  const [editRole,setEditRole] = useState("");

  const [resetOpen,setResetOpen] = useState(false);
  const [resetUser,setResetUser] = useState(null);
  const [newPassword,setNewPassword] = useState("");
  const [snackOpen,setSnackOpen] = useState(false);
  const [snackMsg,setSnackMsg] = useState("");
  const [snackType,setSnackType] = useState("success");
  const [deleteOpen,setDeleteOpen] = useState(false);
  const [deleteUserId,setDeleteUserId] = useState(null);
  const [darkMode,setDarkMode] = useState(false);

  useEffect(() => {

    const fetchUsers = async () => {
      setLoading(true);

      try {
        const res = await API.get("/users");
        setUsers(res.data.map(u => ({ ...u, id: u.id })));
      } catch (err) {
        console.error("Failed to load users", err);
      }

      setLoading(false);
    };

    fetchUsers();

  }, []);

  const createUser = async () => {
    try{
      await API.post("/users",{username,password,role});
      setUsername("");
      setPassword("");
	  const res = await API.get("/users");
	  setUsers(res.data.map(u => ({...u,id:u.id})));
    }  catch{
    setSnackMsg("User creation failed");
    setSnackType("error");
    setSnackOpen(true);
  }
  };

  const startEdit = (u)=>{
    setEditId(u.id);
    setEditUsername(u.username);
    setEditRole(u.role);
  };

  const cancelEdit = ()=>setEditId(null);

  const saveEdit = async () => {

    try{

      await API.put(`/users/${editId}`,{
        username:editUsername,
        role:editRole
      });

      const res = await API.get("/users");
      setUsers(res.data.map(u => ({...u,id:u.id})));

      setEditId(null);

    }catch(err){
      console.error("User update failed",err);
	  setSnackMsg("User update failed");
	  setSnackType("error");
	  setSnackOpen(true);
    }
  };

  const deleteUser = (id)=>{
    setDeleteUserId(id);
    setDeleteOpen(true);
  };
  
  const confirmDelete = async ()=>{

    try{

      await API.delete(`/users/${deleteUserId}`);

      const res = await API.get("/users");
      setUsers(res.data.map(u => ({...u,id:u.id})));

      setSnackMsg("User deleted successfully");
      setSnackType("success");
      setSnackOpen(true);

    }catch(err){

      console.error("Delete failed",err);

      setSnackMsg("Delete failed");
      setSnackType("error");
      setSnackOpen(true);

    }

    setDeleteOpen(false);
  };

  const openReset = (user)=>{
    setResetUser(user);
    setNewPassword("");
    setResetOpen(true);
  };

  const resetPassword = async ()=>{

    try{

      await API.put(`/users/${resetUser.id}/password`,{
        password:newPassword
      });

      setResetOpen(false);

    }	  catch(err){
	    console.error("Password reset failed:", err);
		setSnackMsg("Password reset failed");
		setSnackType("error");
		setSnackOpen(true);
	  }
  };

  const filteredRows = useMemo(()=>{
    return users.filter(u =>
      u.username.toLowerCase().includes(search.toLowerCase())
    );
  },[users,search]);

  const roleIcon = (role)=>{
    if(role==="ADMIN") return <AdminPanelSettingsIcon fontSize="small"/>;
    if(role==="DISPATCH") return <LocalShippingIcon fontSize="small"/>;
    return <InventoryIcon fontSize="small"/>;
  };

  const roleChip = (role)=>{
    if(role==="ADMIN") return adminChip;
    if(role==="DISPATCH") return dispatchChip;
    return packingChip;
  };

  const columns = [

	{
	  field:"username",
	  headerName:"Username",

	  flex: 1,              // allow natural growth
	  minWidth: 260,
	  maxWidth: 340,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      👤 <span>Username</span>
	    </Box>
	  ),

	  renderCell:(params)=>{
	    const u = params.row;

	    if(editId===u.id){
	      return (
	        <TextField
	          value={editUsername}
	          size="small"
	          onChange={(e)=>setEditUsername(e.target.value)}
			  sx={{
			    minWidth: 140,

			    "& .MuiInputBase-root": {
			      borderRadius: "14px",

			      background: darkMode
			        ? "rgba(255,255,255,0.04)"
			        : "#fff",

			      color: darkMode ? "#fff" : "#111",

			      border: darkMode
			        ? "1px solid rgba(255,215,0,0.08)"
			        : "1px solid rgba(0,0,0,0.08)",
			    },

			    "& input": {
			      color: darkMode ? "#fff" : "#111",
			    },

			    "& input::placeholder": {
			      color: darkMode
			        ? "rgba(255,255,255,0.4)"
			        : "rgba(0,0,0,0.4)",
			      opacity: 1,
			    },

			    "& .MuiSvgIcon-root": {
			      color: darkMode ? "#FFD700" : "#111",
			    },

			    "& .MuiSelect-select": {
			      color: darkMode ? "#fff" : "#111",
			    },

			    "& label": {
			      color: darkMode
			        ? "rgba(255,255,255,0.65)"
			        : "#475569",
			    },
			  }}
	        />
	      );
	    }

	    return(
	      <Box
	        sx={{
	          display:"flex",
	          alignItems:"center",
	          gap:1.2,
	          width:"100%",
	          overflow:"hidden",
	        }}
	      >
	        <Box sx={avatar}>
	          {u.username.charAt(0).toUpperCase()}
	        </Box>

	        <Box
	          sx={{
	            overflow:"hidden",
	            textOverflow:"ellipsis",
	            whiteSpace:"nowrap",
	            fontWeight:500,
	            flex:1,
	          }}
	          title={u.username}
	        >
	          {u.username}
	        </Box>
	      </Box>
	    );
	  }
	},

	{
	  field:"role",
	  headerName:"Role",
	  width:200,

	  renderHeader: () => (
	    <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
	      🛡️ <span>Role</span>
	    </Box>
	  ),

	  renderCell:(params)=>{
        const u = params.row;

        if(editId===u.id){
          return(
            <TextField
              select
              size="small"
              value={editRole}
              onChange={(e)=>setEditRole(e.target.value)}
			  sx={{
			    minWidth: 140,

			    "& .MuiInputBase-root": {
			      borderRadius: "14px",

			      background: darkMode
			        ? "rgba(255,255,255,0.04)"
			        : "#fff",

			      color: darkMode ? "#fff" : "#111",

			      border: darkMode
			        ? "1px solid rgba(255,215,0,0.08)"
			        : "1px solid rgba(0,0,0,0.08)",
			    },

			    "& input": {
			      color: darkMode ? "#fff" : "#111",
			    },

			    "& input::placeholder": {
			      color: darkMode
			        ? "rgba(255,255,255,0.4)"
			        : "rgba(0,0,0,0.4)",
			      opacity: 1,
			    },

			    "& .MuiSvgIcon-root": {
			      color: darkMode ? "#FFD700" : "#111",
			    },

			    "& .MuiSelect-select": {
			      color: darkMode ? "#fff" : "#111",
			    },

			    "& label": {
			      color: darkMode
			        ? "rgba(255,255,255,0.65)"
			        : "#475569",
			    },
			  }}
            >
              <MenuItem value="ADMIN">ADMIN</MenuItem>
              <MenuItem value="PACKING">PACKING</MenuItem>
              <MenuItem value="DISPATCH">DISPATCH</MenuItem>
            </TextField>
          );
        }

        return(
          <Chip
            icon={roleIcon(u.role)}
            label={u.role}
            size="small"
            sx={roleChip(u.role)}
          />
        );
      }
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
        const u = params.row;

        if(editId===u.id){
          return(
            <Box sx={actionContainer}>
              <Button size="small" sx={actionPrimary} onClick={saveEdit}>
                Save
              </Button>

              <Button size="small" sx={actionSecondary} onClick={cancelEdit}>
                Cancel
              </Button>
            </Box>
          );
        }

        return(
          <Box sx={actionContainer}>

            <Button
              startIcon={<EditIcon/>}
              size="small"
              sx={actionSecondary}
              onClick={()=>startEdit(u)}
            >
              Edit
            </Button>

            <Button
              startIcon={<LockResetIcon/>}
              size="small"
              sx={actionPrimary}
              onClick={()=>openReset(u)}
            >
              Reset
            </Button>

            <Button
              startIcon={<DeleteIcon/>}
              size="small"
              sx={actionDanger}
              onClick={()=>deleteUser(u.id)}
            >
              Delete
            </Button>

          </Box>
        );
      }
    }

  ];

  return(

  <div style={page(darkMode)}>

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
	  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>

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
	      👥
	    </Box>

	    <Box>
		<div
		  style={{
		    fontSize: 28,
		    fontWeight: 700,

		    color: darkMode
		      ? "#FFD700"
		      : "#ffffff",

		    letterSpacing: 0.4,

		    textShadow: darkMode
		      ? "0 0 18px rgba(255,215,0,0.25)"
		      : "0 3px 10px rgba(0,0,0,0.25)",
		  }}
		>
		  User Management
		</div>

		<div
		  style={{
		    fontSize: 13,

		    color: darkMode
		      ? "rgba(255,215,0,0.78)"
		      : "rgba(255,255,255,0.85)",
		  }}
		>
		  Manage roles, passwords and access permissions
		</div>
	    </Box>
	  </Box>

	  <Box sx={{ display:"flex", alignItems:"center", gap:1.5 }}>

	    <Button
	      onClick={() => setDarkMode(!darkMode)}
	      sx={themeBtn(darkMode)}
	    >
	      {darkMode ? "☀ Classic" : "🌙 Dark Mode"}
	    </Button>

	    <Box
	      sx={{
	        px: 2,
	        py: 0.8,
	        borderRadius: "999px",

	        background: darkMode
	          ? "rgba(255,215,0,0.12)"
	          : "rgba(255,255,255,0.25)",

	        backdropFilter: "blur(10px)",

	        color: darkMode ? "#FFD700" : "#fff",

	        fontWeight: 600,

	        border: darkMode
	          ? "1px solid rgba(255,215,0,0.2)"
	          : "1px solid rgba(255,255,255,0.3)",

	        fontSize: 13,
	      }}
	    >
	      {users.length} Users
	    </Box>

	  </Box>
	</Box>

      <Box sx={searchPanel(darkMode)}>

	  <SearchIcon
	    sx={{
	      opacity: 0.7,
	      color: darkMode ? "#FFD700" : "#475569",
	    }}
	  />

        <TextField
          variant="standard"
          placeholder="Search users..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          InputProps={{disableUnderline:true}}
		  sx={{
			flex: "1 1 180px",
			minWidth: 140,
			maxWidth: 260,

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
		      fontSize: 14,
		      fontWeight: 500,
		    },

		    "& input::placeholder": {
		      color: darkMode
		        ? "rgba(255,255,255,0.45)"
		        : "rgba(0,0,0,0.45)",
		      opacity: 1,
		    },

		    "& .MuiInputBase-root:hover": {
		      background: darkMode
		        ? "rgba(255,255,255,0.05)"
		        : "#fff",
		    },

		    "& .Mui-focused": {
		      background: darkMode
		        ? "rgba(255,255,255,0.06)"
		        : "#fff",

		      boxShadow: darkMode
		        ? "0 0 0 2px rgba(255,215,0,0.22)"
		        : "0 0 0 2px rgba(59,130,246,0.3)",
		    },
		  }}
        />

        <TextField
          size="small"
          placeholder="Username"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
		  sx={{
			flex: "1 1 160px",
			minWidth: 140,
			maxWidth: 220,

		    "& .MuiInputBase-root": {
		      borderRadius: "18px",
			  height: 40,
		      background: darkMode
		        ? "rgba(255,255,255,0.04)"
		        : "#fff",

		      color: darkMode ? "#fff" : "#111",

		      border: darkMode
		        ? "1px solid rgba(255,215,0,0.08)"
		        : "1px solid rgba(0,0,0,0.08)",
		    },

		    "& input": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& input::placeholder": {
		      color: darkMode
		        ? "rgba(255,255,255,0.4)"
		        : "rgba(0,0,0,0.4)",
		      opacity: 1,
		    },

		    "& .MuiSvgIcon-root": {
		      color: darkMode ? "#FFD700" : "#111",
		    },

		    "& .MuiSelect-select": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& label": {
		      color: darkMode
		        ? "rgba(255,255,255,0.65)"
		        : "#475569",
		    },
		  }}
        />

        <TextField
          size="small"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
		  sx={{
			flex: "1 1 160px",
			minWidth: 140,
			maxWidth: 220,

		    "& .MuiInputBase-root": {
		      borderRadius: "18px",
			  height: 40,
		      background: darkMode
		        ? "rgba(255,255,255,0.04)"
		        : "#fff",

		      color: darkMode ? "#fff" : "#111",

		      border: darkMode
		        ? "1px solid rgba(255,215,0,0.08)"
		        : "1px solid rgba(0,0,0,0.08)",
		    },

		    "& input": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& input::placeholder": {
		      color: darkMode
		        ? "rgba(255,255,255,0.4)"
		        : "rgba(0,0,0,0.4)",
		      opacity: 1,
		    },

		    "& .MuiSvgIcon-root": {
		      color: darkMode ? "#FFD700" : "#111",
		    },

		    "& .MuiSelect-select": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& label": {
		      color: darkMode
		        ? "rgba(255,255,255,0.65)"
		        : "#475569",
		    },
		  }}
        />

        <TextField
          select
          size="small"
          value={role}
          onChange={(e)=>setRole(e.target.value)}
		  sx={{
			flex: "0 1 170px",
			minWidth: 140,
			maxWidth: 180,

		    "& .MuiInputBase-root": {
		      borderRadius: "18px",
			  height: 40,
		      background: darkMode
		        ? "rgba(255,255,255,0.04)"
		        : "#fff",

		      color: darkMode ? "#fff" : "#111",

		      border: darkMode
		        ? "1px solid rgba(255,215,0,0.08)"
		        : "1px solid rgba(0,0,0,0.08)",
		    },

		    "& input": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& input::placeholder": {
		      color: darkMode
		        ? "rgba(255,255,255,0.4)"
		        : "rgba(0,0,0,0.4)",
		      opacity: 1,
		    },

		    "& .MuiSvgIcon-root": {
		      color: darkMode ? "#FFD700" : "#111",
		    },

		    "& .MuiSelect-select": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& label": {
		      color: darkMode
		        ? "rgba(255,255,255,0.65)"
		        : "#475569",
		    },
		  }}
        >
          <MenuItem value="ADMIN">ADMIN</MenuItem>
          <MenuItem value="PACKING">PACKING</MenuItem>
          <MenuItem value="DISPATCH">DISPATCH</MenuItem>
        </TextField>

		<Button
		  onClick={createUser}
		  sx={{
		    ...actionPrimary,

		    height: 40,
		    px: 3,

		    flexShrink: 0,

		    whiteSpace: "nowrap",

		    borderRadius: "18px",

		    marginLeft: "auto",
		  }}
		>
          Create User
        </Button>

      </Box>

      <div style={tableWrapper(darkMode)}>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          sx={dataGridStyles(darkMode)}
        />

      </div>

    </div>

    <Dialog open={resetOpen} onClose={()=>setResetOpen(false)}>
      <DialogTitle>Reset Password</DialogTitle>

      <DialogContent>

        <TextField
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e)=>setNewPassword(e.target.value)}
          fullWidth
		  sx={{
		    minWidth: 140,

		    "& .MuiInputBase-root": {
		      borderRadius: "14px",

		      background: darkMode
		        ? "rgba(255,255,255,0.04)"
		        : "#fff",

		      color: darkMode ? "#fff" : "#111",

		      border: darkMode
		        ? "1px solid rgba(255,215,0,0.08)"
		        : "1px solid rgba(0,0,0,0.08)",
		    },

		    "& input": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& input::placeholder": {
		      color: darkMode
		        ? "rgba(255,255,255,0.4)"
		        : "rgba(0,0,0,0.4)",
		      opacity: 1,
		    },

		    "& .MuiSvgIcon-root": {
		      color: darkMode ? "#FFD700" : "#111",
		    },

		    "& .MuiSelect-select": {
		      color: darkMode ? "#fff" : "#111",
		    },

		    "& label": {
		      color: darkMode
		        ? "rgba(255,255,255,0.65)"
		        : "#475569",
		    },
		  }}
        />

      </DialogContent>

      <DialogActions>

        <Button onClick={()=>setResetOpen(false)}>
          Cancel
        </Button>

        <Button onClick={resetPassword}>
          Reset
        </Button>

      </DialogActions>

    </Dialog>
	<Dialog open={deleteOpen} onClose={()=>setDeleteOpen(false)}>

	  <DialogTitle>
	    Delete User
	  </DialogTitle>

	  <DialogContent>
	    Are you sure you want to delete this user?
	  </DialogContent>

	  <DialogActions>

	    <Button onClick={()=>setDeleteOpen(false)}>
	      Cancel
	    </Button>

	    <Button
	      variant="contained"
	      color="error"
	      onClick={confirmDelete}
	    >
	      Delete
	    </Button>

	  </DialogActions>

	</Dialog>
	<Snackbar
	  open={snackOpen}
	  autoHideDuration={3000}
	  onClose={()=>setSnackOpen(false)}
	  anchorOrigin={{ vertical:"top", horizontal:"center" }}
	>

	  <Alert
	    severity={snackType}
	    variant="filled"
	    onClose={()=>setSnackOpen(false)}
	  >
	    {snackMsg}
	  </Alert>

	</Snackbar>
  </div>

  );
}

/* ===== ENHANCED GLASS STYLE ===== */

const page = (darkMode) => ({
  minHeight:"100vh",
  padding:20,
  position:"relative",
  overflowX:"hidden",
  overflowY:"auto",

  background: darkMode
    ? `
      radial-gradient(circle at top left, rgba(255,215,0,0.08), transparent 25%),
      radial-gradient(circle at bottom right, rgba(255,215,0,0.06), transparent 25%),
      linear-gradient(135deg,#000 0%,#111 45%,#1a1a1a 100%)
    `
    : `
      radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 25%),
      radial-gradient(circle at bottom right, rgba(255,255,255,0.12), transparent 25%),
      linear-gradient(135deg,#f5c542 0%,#d4a017 45%,#8b5e00 100%)
    `,

  backgroundAttachment:"fixed",
});

const backgroundText = (darkMode) => ({
  position:"absolute",
  fontSize:220,
  fontWeight:900,

  background: darkMode
    ? "linear-gradient(180deg, rgba(255,215,0,0.16), rgba(255,215,0,0.04))"
    : "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",

  WebkitBackgroundClip:"text",
  WebkitTextFillColor:"transparent",

  top:"50%",
  left:"50%",
  transform:"translate(-50%,-50%)",

  pointerEvents:"none",
  letterSpacing:10,

  filter:"blur(1px)",
});

const content={position:"relative", zIndex:1};

const pageTitle={
  marginTop:0,
  marginBottom:12,
  fontSize:28,
  fontWeight:700,
  color:"#fff",
  letterSpacing:1
};

const tableWrapper = (darkMode) => ({
  height:"calc(100vh - 170px)",
  borderRadius:18,

  background: darkMode
    ? "linear-gradient(180deg, rgba(20,20,20,0.95), rgba(10,10,10,0.92))"
    : "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18))",

  backdropFilter:"blur(16px)",
  WebkitBackdropFilter:"blur(16px)",

  boxShadow: darkMode
    ? "0 22px 55px rgba(0,0,0,0.65)"
    : "0 22px 55px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",

  border: darkMode
    ? "1px solid rgba(255,215,0,0.15)"
    : "none",

  padding:12,
  overflowX:"auto",
});

const dataGridStyles = (darkMode) => ({

  background: darkMode ? "#0f0f0f" : "#fff",

  color: darkMode ? "#fff" : "#111",

  borderRadius:12,

  border:"none",

  "& .MuiDataGrid-columnHeaders": {
    background: darkMode
      ? "linear-gradient(180deg,#111,#0b0b0b) !important"
      : "#f8fafc !important",

    borderBottom: darkMode
      ? "1px solid rgba(255,215,0,0.12)"
      : "1px solid #e2e8f0",

    minHeight:"52px !important",
    maxHeight:"52px !important",
  },
  
  "& .MuiDataGrid-filler": {
      backgroundColor: darkMode
        ? "#111111 !important"
        : "#f8fafc !important",

      borderBottom: darkMode
        ? "1px solid rgba(255,215,0,0.08)"
        : "1px solid #e2e8f0",
    },

    "& .MuiDataGrid-scrollbarFiller": {
      backgroundColor: darkMode
        ? "#111111 !important"
        : "#f8fafc !important",
    },

  "& .MuiDataGrid-columnHeader": {
    background: darkMode
      ? "linear-gradient(180deg,#111,#0b0b0b) !important"
      : "#f8fafc !important",

    color: darkMode
      ? "#FFD700 !important"
      : "#475569",

    fontWeight:700,
    fontSize:13,
    letterSpacing:"0.4px",

    textTransform:"uppercase",

    borderRight: darkMode
      ? "1px solid rgba(255,255,255,0.05)"
      : "1px solid #e5e7eb",
  },

  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight:800,

    color: darkMode
      ? "#FFD700 !important"
      : "#475569 !important",
  },

  "& .MuiDataGrid-sortIcon": {
    color: darkMode
      ? "#FFD700 !important"
      : "#475569",
  },

  "& .MuiSvgIcon-root": {
    color: darkMode
      ? "#FFD700"
      : "#475569",
  },

  "& .MuiDataGrid-row": {
    borderBottom: darkMode
      ? "1px solid rgba(255,255,255,0.05)"
      : "1px solid #f1f5f9",

    transition:"all 0.2s ease",
  },

  "& .MuiDataGrid-row:hover": {
    background: darkMode
      ? "rgba(255,215,0,0.05)"
      : "#f9fafb",
  },

  "& .MuiDataGrid-cell": {
    fontSize:13,
    display:"flex",
    alignItems:"center",

    color: darkMode ? "#f5f5f5" : "#111",
  },

  "& .MuiDataGrid-footerContainer": {
    borderTop: darkMode
      ? "1px solid rgba(255,215,0,0.12)"
      : "1px solid #e5e7eb",

    color: darkMode ? "#fff" : "#111",
  },
});

const avatar={
  width:30,
  height:30,
  borderRadius:"50%",
  background:"linear-gradient(135deg,#6366f1,#4f46e5)",
  color:"#fff",
  fontWeight:700,
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  boxShadow:"0 4px 10px rgba(0,0,0,0.3)"
};

const adminChip = {
  fontWeight: 700,
  color: "#fff",

  background:
    "linear-gradient(135deg,#111827,#374151)",

  border: "1px solid rgba(255,255,255,0.15)",

  boxShadow:
    "0 6px 18px rgba(0,0,0,0.25)",

  "& .MuiChip-icon": {
    color: "#fff",
  },
};

const dispatchChip = {
  fontWeight: 700,
  color: "#ecfdf5",

  background:
    "linear-gradient(135deg,#059669,#047857)",

  border: "1px solid rgba(255,255,255,0.15)",

  boxShadow:
    "0 6px 18px rgba(16,185,129,0.25)",

  "& .MuiChip-icon": {
    color: "#ecfdf5",
  },
};

const packingChip = {
  fontWeight: 700,
  color: "#eff6ff",

  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",

  border: "1px solid rgba(255,255,255,0.15)",

  boxShadow:
    "0 6px 18px rgba(37,99,235,0.25)",

  "& .MuiChip-icon": {
    color: "#eff6ff",
  },
};

const actionContainer = {
  display:"flex",
  gap:1,
  alignItems:"center",
  width:"100%",
  flexWrap:"nowrap",
};

const actionPrimary = {
  px: 2.4,
  py: 0.7,
  minWidth: "unset",
  borderRadius: "999px",

  fontSize: 11,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(135deg,#10b981,#059669)",

  border: "1px solid rgba(255,255,255,0.15)",

  boxShadow:
    "0 10px 24px rgba(16,185,129,0.32)",

  transition: "all 0.22s ease",

  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow:
      "0 14px 30px rgba(16,185,129,0.4)",
  },
};

const actionSecondary = {
  px: 2.2,
  py: 0.7,
  minWidth: "unset",
  borderRadius: "999px",

  fontSize: 11,
  fontWeight: 600,

  background: "#fff",

  border: "1px solid #d1d5db",

  transition: "all 0.22s ease",

  "&:hover": {
    transform: "translateY(-1px)",
    background: "#f9fafb",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
};

const actionDanger = {
  px: 2.2,
  py: 0.7,
  minWidth: "unset",
  borderRadius: "999px",

  fontSize: 11,
  fontWeight: 700,

  color: "#fff",

  background:
    "linear-gradient(135deg,#ef4444,#b91c1c)",

  boxShadow:
    "0 10px 24px rgba(239,68,68,0.28)",

  transition: "all 0.22s ease",

  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow:
      "0 14px 30px rgba(239,68,68,0.38)",
  },
};

const searchPanel = (darkMode) => ({
  display: "flex",
  alignItems: "center",
  gap: 16,
  rowGap: 12,
  marginBottom: 4,

  padding: "5px 18px",

  borderRadius: 16,

  width: "100%",
  maxWidth: "100%",

  flexWrap: "wrap",
  minWidth: 0,

  background: darkMode
    ? `
      linear-gradient(
        145deg,
        rgba(12,12,12,0.96),
        rgba(18,18,18,0.92)
      )
    `
    : `
      linear-gradient(
        145deg,
        rgba(255,255,255,0.72),
        rgba(255,255,255,0.42)
      )
    `,

  backdropFilter: "blur(30px)",
  WebkitBackdropFilter: "blur(30px)",

  border: darkMode
    ? "1px solid rgba(255,215,0,0.12)"
    : "1px solid rgba(255,255,255,0.4)",

  boxShadow: darkMode
    ? `
      0 10px 40px rgba(0,0,0,0.65),
      inset 0 1px 0 rgba(255,215,0,0.05)
    `
    : `
      0 14px 35px rgba(0,0,0,0.18),
      inset 0 1px 0 rgba(255,255,255,0.45)
    `,
});

const themeBtn = (darkMode) => ({
  px:2.6,
  py:1,

  borderRadius:"999px",

  fontSize:12,
  fontWeight:700,

  background: darkMode
    ? "linear-gradient(135deg,#111,#222)"
    : "#111",

  color: darkMode
    ? "#FFD700"
    : "#fff",

  border: darkMode
    ? "1px solid rgba(255,215,0,0.25)"
    : "1px solid rgba(255,255,255,0.25)",

  boxShadow: darkMode
    ? "0 0 18px rgba(255,215,0,0.15)"
    : "0 10px 25px rgba(0,0,0,0.25)",

  "&:hover": {
    transform:"translateY(-3px) scale(1.04)",
  },
});

export default UsersPage;