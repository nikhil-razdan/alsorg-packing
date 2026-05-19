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
	          sx={{ width:"100%" }}
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
	          color: "#ffffff",
	          letterSpacing: 0.4,
	          textShadow: "0 3px 10px rgba(0,0,0,0.25)",
	        }}
	      >
	        User Management
	      </div>

	      <div
	        style={{
	          fontSize: 13,
	          color: "rgba(255,255,255,0.85)",
	        }}
	      >
	        Manage roles, passwords and access permissions
	      </div>
	    </Box>
	  </Box>

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
	    {users.length} Users
	  </Box>
	</Box>

      <Box sx={searchPanel}>

        <SearchIcon sx={{opacity:0.7}}/>

        <TextField
          variant="standard"
          placeholder="Search users..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          InputProps={{disableUnderline:true}}
          sx={{flex:1}}
        />

        <TextField
          size="small"
          placeholder="Username"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
        />

        <TextField
          size="small"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <TextField
          select
          size="small"
          value={role}
          onChange={(e)=>setRole(e.target.value)}
        >
          <MenuItem value="ADMIN">ADMIN</MenuItem>
          <MenuItem value="PACKING">PACKING</MenuItem>
          <MenuItem value="DISPATCH">DISPATCH</MenuItem>
        </TextField>

        <Button sx={actionPrimary} onClick={createUser}>
          Create User
        </Button>

      </Box>

      <div style={tableWrapper}>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          sx={dataGridStyles}
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

const page={
  minHeight:"100vh",
  padding:20,
  background:"linear-gradient(135deg,#f5c542,#b8860b)",
  position:"relative"
};

const backgroundText={
  position:"absolute",
  fontSize:180,
  fontWeight:900,
  color:"rgba(255,255,255,0.10)",
  top:"50%",
  left:"50%",
  transform:"translate(-50%,-50%)",
  letterSpacing:10
};

const content={position:"relative", zIndex:1};

const pageTitle={
  marginTop:0,
  marginBottom:12,
  fontSize:28,
  fontWeight:700,
  color:"#fff",
  letterSpacing:1
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
    display: "flex",
    alignItems: "center",
  },

  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid #e5e7eb",
  },
};

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

const searchPanel={
  display:"flex",
  alignItems:"center",
  gap:16,
  marginBottom:4,
  padding:"5px 18px",
  borderRadius:16,
  background:"rgba(255,255,255,0.35)",
  backdropFilter:"blur(18px)",
  border:"1px solid rgba(255,255,255,0.25)",
  boxShadow:"0 10px 25px rgba(0,0,0,0.22)"
};

export default UsersPage;