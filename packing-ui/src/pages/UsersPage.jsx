import { useEffect, useState, useMemo } from "react";

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
import Drawer from "@mui/material/Drawer";

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
  const [createOpen,setCreateOpen] = useState(false);

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

    try {

      await API.post("/users",{
        username,
        password,
        role
      });

      setUsername("");
      setPassword("");

      const res = await API.get("/users");

      setUsers(
        res.data.map(u => ({
          ...u,
          id:u.id
        }))
      );

      setCreateOpen(false);

      setSnackMsg(
        "User created successfully"
      );

      setSnackType("success");

      setSnackOpen(true);

    } catch {

      setSnackMsg(
        "User creation failed"
      );

      setSnackType("error");

      setSnackOpen(true);

      setCreateOpen(false);
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

    try {

      await API.put(
        `/users/${resetUser.id}/password`,
        {
          password:newPassword
        }
      );

      setResetOpen(false);

      setSnackMsg(
        "Password reset successful"
      );

      setSnackType("success");

      setSnackOpen(true);

    } catch(err) {

      console.error(
        "Password reset failed:",
        err
      );

      setSnackMsg(
        "Password reset failed"
      );

      setSnackType("error");

      setSnackOpen(true);
    }
  };

  const filteredRows = useMemo(()=>{
    return users.filter(u =>
      u.username.toLowerCase().includes(search.toLowerCase())
    );
  },[users,search]);

  const roleIcon = (role) => {
    if (role === "ADMIN") {
      return (
        <AdminPanelSettingsIcon fontSize="small" />
      );
    }

    if (role === "DISPATCH") {
      return (
        <LocalShippingIcon fontSize="small" />
      );
    }

    if (role === "WAREHOUSE") {
      return (
        <InventoryIcon fontSize="small" />
      );
    }

    return (
      <InventoryIcon fontSize="small" />
    );
  };

  const roleChip = (role) => {
    if (role === "ADMIN") return adminChip;

    if (role === "DISPATCH") {
      return dispatchChip;
    }

    if (role === "WAREHOUSE") {
      return warehouseChip;
    }

    return packingChip;
  };



  return(

  <div style={page}>
  <div style={headerRow}>
    <div>
      <div style={logo}>
        👥 User Management
      </div>

      <div style={subtitle}>
        Manage roles, permissions and
        enterprise access control
      </div>
    </div>

    <Button
      onClick={() => setCreateOpen(true)}
      sx={createBtn}
    >
      + Create User
    </Button>
  </div>
    <div style={content}>

	<Box sx={toolbar}>
	  <SearchIcon
	    sx={{
	      color: "rgba(255,255,255,.45)",
	    }}
	  />

	  <TextField
	    variant="standard"
	    placeholder="Search users..."
	    value={search}
	    onChange={(e)=>setSearch(e.target.value)}
	    InputProps={{
	      disableUnderline:true
	    }}
	    sx={searchInput}
	  />
	</Box>

      <div style={tableWrapper}>
	  <div style={tableTopBar}>
	    <div style={tableTitle}>
	      System Users
	    </div>

	    <div style={tableMeta}>
	      {users.length} Active Accounts
	    </div>
	  </div>

	  <div style={tableHeader}>
	    <div style={userColumn}>
	      Username
	    </div>

	    <div style={roleColumn}>
	      Role
	    </div>

	    <div style={actionColumn}>
	      Actions
	    </div>
	  </div>

	  <div style={tableBody}>

	    {filteredRows.map((u) => (

			<div
			  key={u.id}
			  style={tableRow}
			  onMouseEnter={(e)=>{
			    e.currentTarget.style.background =
			      "rgba(255,255,255,.025)";
			  }}
			  onMouseLeave={(e)=>{
			    e.currentTarget.style.background =
			      "transparent";
			  }}
			>

	        {/* USER COLUMN */}

	        <div style={userColumn}>

	          <div style={userInfo}>
	            <div style={avatar}>
	              {u.username
	                .charAt(0)
	                .toUpperCase()}
	            </div>

	            {editId === u.id ? (

	              <TextField
	                value={editUsername}
	                size="small"
	                onChange={(e)=>
	                  setEditUsername(
	                    e.target.value
	                  )
	                }
	                sx={inlineInput}
	              />

	            ) : (

					<span
					  style={{
					    color: "#ffffff",

					    fontWeight: 500,

					    fontSize: 15,

					    letterSpacing: 0.2,
					  }}
					>
					  {u.username}
					</span>

	            )}
	          </div>

	        </div>

	        {/* ROLE COLUMN */}

	        <div style={roleColumn}>

	          {editId === u.id ? (

	            <TextField
	              select
	              size="small"
	              value={editRole}
	              onChange={(e)=>
	                setEditRole(
	                  e.target.value
	                )
	              }
	              sx={inlineInput}
	            >
	              <MenuItem value="ADMIN">
	                ADMIN
	              </MenuItem>

	              <MenuItem value="PACKING">
	                PACKING
	              </MenuItem>

	              <MenuItem value="WAREHOUSE">
	                WAREHOUSE
	              </MenuItem>

	              <MenuItem value="DISPATCH">
	                DISPATCH
	              </MenuItem>

	              <MenuItem value="LOGISTICS">
	                LOGISTICS
	              </MenuItem>

	            </TextField>

	          ) : (

	            <Chip
	              icon={roleIcon(u.role)}
	              label={u.role}
	              size="small"
	              sx={roleChip(u.role)}
	            />

	          )}

	        </div>

	        {/* ACTIONS */}

	        <div style={actionColumn}>

	          {editId === u.id ? (

	            <Box sx={actionContainer}>

	              <Button
	                size="small"
	                sx={actionPrimary}
	                onClick={saveEdit}
	              >
	                Save
	              </Button>

	              <Button
	                size="small"
	                sx={actionSecondary}
	                onClick={cancelEdit}
	              >
	                Cancel
	              </Button>

	            </Box>

	          ) : (

	            <Box sx={actionContainer}>

	              <Button
	                startIcon={<EditIcon />}
	                size="small"
	                sx={actionSecondary}
	                onClick={()=>
	                  startEdit(u)
	                }
	              >
	                Edit
	              </Button>

	              <Button
	                startIcon={
	                  <LockResetIcon />
	                }
	                size="small"
	                sx={actionPrimary}
	                onClick={()=>
	                  openReset(u)
	                }
	              >
	                Reset
	              </Button>

	              <Button
	                startIcon={<DeleteIcon />}
	                size="small"
	                sx={actionDanger}
	                onClick={()=>
	                  deleteUser(u.id)
	                }
	              >
	                Delete
	              </Button>

	            </Box>

	          )}

	        </div>

	      </div>

	    ))}

	  </div>

      </div>

    </div>
	<Drawer
	  anchor="right"
	  open={createOpen}
	  onClose={() => setCreateOpen(false)}
	  PaperProps={{
	    sx: {
	      width: 380,

		  background:
		    "linear-gradient(180deg,#020617,#0f172a)",

	      color: "#fff" ,

	      borderTopLeftRadius: 24,
	      borderBottomLeftRadius: 24,
		  borderLeft:
		    "1px solid rgba(255,255,255,.06)",
	      p: 3,
	    },
	  }}
	>
	  <Box
	    sx={{
	      display: "flex",
	      flexDirection: "column",
	      height: "100%",
	    }}
	  >

	    <Box sx={{ mb: 3 }}>
	      <Box
	        sx={{
	          fontSize: 24,
	          fontWeight: 800,
	          mb: 0.5,
	        }}
	      >
	        Create User
	      </Box>

		  <Box
		    sx={{
		      fontSize: 13,

		      color
		        : "#6b7280",
		    }}
		  >
	        Add new system user and permissions
	      </Box>
	    </Box>

	    <Box
	      sx={{
	        display: "flex",
	        flexDirection: "column",
	        gap: 2,
	      }}
	    >

	      <TextField
	        label="Username"
	        value={username}
	        onChange={(e)=>setUsername(e.target.value)}
	        fullWidth
			sx={formFieldSx}
	      />

	      <TextField
	        label="Password"
	        type="password"
	        value={password}
	        onChange={(e)=>setPassword(e.target.value)}
	        fullWidth
			sx={formFieldSx}
	      />

		  <TextField
		    select
		    label="Role"
		    value={role}
		    onChange={(e)=>setRole(e.target.value)}
		    fullWidth
		    sx={formFieldSx}
		    slotProps={{
		      select: {
		        MenuProps: {
		          PaperProps: {
		            sx: {
		              mt: 1,
		              borderRadius: "18px",

		              background
		                : "#ffffff",

		              color: 
		                 "#fff"
		               ,

		              border
		                : "1px solid rgba(0,0,0,0.08)",

		              backdropFilter: "blur(20px)",

		              "& .MuiMenuItem-root": {
		                color:
		                   "#fff"
		                  ,
		              },

		              "& .Mui-selected": {
		                background
		                  : "rgba(59,130,246,0.12) !important",

		                color
		                  : "#2563eb",
		              },
		            },
		          },
		        },
		      },
		    }}
		  >
		  <MenuItem value="ADMIN">ADMIN</MenuItem>
		  <MenuItem value="PACKING">PACKING</MenuItem>
		  <MenuItem value="WAREHOUSE">WAREHOUSE</MenuItem>
		  <MenuItem value="DISPATCH">DISPATCH</MenuItem>
		  <MenuItem value="LOGISTICS">LOGISTICS</MenuItem>
		  </TextField>

	    </Box>

	    <Box sx={{ flex: 1 }} />

		<Box
		  sx={{
		    display: "flex",
		    gap: 1.5,

		    mt: 4,
		    pt: 2,

		    borderTop
		      : "1px solid rgba(0,0,0,0.06)",
		  }}
		>

		<Button
		  fullWidth
		  variant="outlined"
		  onClick={() => setCreateOpen(false)}
		  sx={{
		    borderRadius: "14px",

		    fontWeight: 700,

		    color
		      : "#fff"
		      ,

		    borderColor
		      : "rgba(0,0,0,0.12)",

		    background
		      : "#fff",

		    "&:hover": {
		      borderColor
		        : "#111827",

		      background
		        : "#f9fafb",
		    },
		  }}
		>
	        Cancel
	      </Button>

	      <Button
	        fullWidth
	        onClick={createUser}
	        sx={actionPrimary}
	      >
	        Create
	      </Button>

	    </Box>

	  </Box>
	</Drawer>
    <Dialog open={resetOpen} onClose={()=>setResetOpen(false)} 	
	PaperProps={{
	  sx:{
	    background:
	      "linear-gradient(180deg,#0f172a,#111827)",

	    color:"#fff",

	    borderRadius:"24px",

	    border:
	      "1px solid rgba(255,255,255,.06)",
	  }
	}}>
      <DialogTitle>Reset Password</DialogTitle>

      <DialogContent>

        <TextField
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e)=>setNewPassword(e.target.value)}
          fullWidth
		  sx={formFieldSx}
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
	<Dialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} 	
	PaperProps={{
	  sx:{
	    background:
	      "linear-gradient(180deg,#0f172a,#111827)",

	    color:"#fff",

	    borderRadius:"24px",

	    border:
	      "1px solid rgba(255,255,255,.06)",
	  }
	}}>

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

const page = {
  minHeight: "100vh",

  padding: 20,

  background:
    "linear-gradient(135deg,#020617,#0f172a)",

  backgroundAttachment: "fixed",

  overflowY: "auto",

  overflowX: "hidden",

  boxSizing: "border-box",
};

const content = {
  position: "relative",

  zIndex: 1,

  display: "flex",

  flexDirection: "column",
};

const toolbar = {
	
  display: "flex",

  alignItems: "center",

  gap: 12,

  padding: "10px 18px",

  marginBottom: 8,

  borderRadius: 18,

  background:
    "rgba(15,23,42,.72)",

  border:
    "1px solid rgba(255,255,255,.06)",

  backdropFilter: "blur(18px)",

  boxShadow:
    "0 10px 30px rgba(0,0,0,.25)",
};

const searchInput = {
  flex: 1,

  "& .MuiInputBase-root": {
    color: "#fff",

    fontSize: 14,
  },

  "& input::placeholder": {
    color: "rgba(255,255,255,.42)",
    opacity: 1,
  },
};

const headerRow = {
  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  marginBottom: 18,

  position: "relative",

  zIndex: 2,
}; 

const logo = {
  color: "#fff",

  fontSize: 34,

  fontWeight: 900,

  marginBottom: 8,

  letterSpacing: -1,
};

const subtitle = {
  color: "rgba(255,255,255,.62)",

  fontSize: 14,
};

const createBtn = {
  height: 46,

  paddingLeft: 20,
  paddingRight: 20,

  borderRadius: 14,

  textTransform: "none",

  fontWeight: 800,

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  border:
    "1px solid rgba(59,130,246,.35)",

  boxShadow:
    "0 12px 30px rgba(37,99,235,.32)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};


const tableWrapper = {
  width: "100%",

  paddingTop: 2,
  
  borderRadius: 24,

  overflow: "hidden",

  border:
    "1px solid rgba(255,255,255,.06)",

  background:
    "linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.82))",

  backdropFilter: "blur(18px)",
  
  boxShadow:
    "0 20px 55px rgba(0,0,0,.45)",
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

const warehouseChip = {
  fontWeight: 700,
  color: "#fff7ed",

  background:
    "linear-gradient(135deg,#ea580c,#c2410c)",

  border:
    "1px solid rgba(255,255,255,0.15)",

  boxShadow:
    "0 6px 18px rgba(234,88,12,0.25)",

  "& .MuiChip-icon": {
    color: "#fff7ed",
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
  borderRadius: 12,

  textTransform: "none",

  fontWeight: 700,

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  border:
    "1px solid rgba(59,130,246,.35)",

  boxShadow:
    "0 10px 24px rgba(37,99,235,.35)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const actionSecondary = {
  borderRadius: 12,

  textTransform: "none",

  fontWeight: 700,

  background:
    "rgba(255,255,255,.04)",

  color: "#fff",

  border:
    "1px solid rgba(255,255,255,.08)",

  "&:hover": {
    background:
      "rgba(255,255,255,.08)",
  },
};

const actionDanger = {
  borderRadius: 12,

  textTransform: "none",

  fontWeight: 700,

  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",

  color: "#fff",

  boxShadow:
    "0 10px 24px rgba(239,68,68,.28)",
};

const formFieldSx = {
  "& .MuiFormLabel-root": {
    color: "rgba(255,255,255,.62)",
  },

  "& .MuiFormLabel-root.Mui-focused": {
    color: "#60a5fa",
  },

  "& .MuiOutlinedInput-root": {
    borderRadius: "16px",

    background:
      "rgba(255,255,255,.04)",

    color: "#fff",

    transition: "all .22s ease",

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

      boxShadow:
        "0 0 0 3px rgba(59,130,246,.14)",
    },
  },

  "& .MuiInputBase-input": {
    color: "#fff",
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },
};

const tableHeader = {
  display: "flex",

  alignItems: "center",

  height: 58,

  paddingLeft: 28,
  paddingRight: 28,

  borderBottom:
    "1px solid rgba(255,255,255,.06)",

  color: "rgba(255,255,255,.55)",

  fontWeight: 700,

  fontSize: 14,
};

const tableBody = {
  display: "flex",

  flexDirection: "column",
};

const tableRow = {
  display: "flex",

  alignItems: "center",

  minHeight: 68,

  paddingLeft: 28,
  paddingRight: 28,

  borderBottom:
    "1px solid rgba(255,255,255,.05)",

  background: "transparent",

  cursor: "pointer",

  transition: "all .22s ease",
};

const userColumn = {
  flex: 1.2,

  display: "flex",

  alignItems: "center",
};

const roleColumn = {
  width: 240,

  display: "flex",

  alignItems: "center",
};

const actionColumn = {
  width: 320,

  display: "flex",

  justifyContent: "flex-start",
};

const userInfo = {
  display: "flex",

  alignItems: "center",

  gap: 14,
};

const inlineInput = {
  minWidth: 180,

  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",

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
      borderColor: "#3b82f6",
    },
  },

  "& input": {
    color: "#fff",
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },
};

const tableTopBar = {
  height: 58,

  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  padding: "0 20px",

  borderBottom:
    "1px solid rgba(255,255,255,.06)",
};

const tableTitle = {
  color: "#fff",

  fontWeight: 800,

  fontSize: 15,
};

const tableMeta = {
  color: "rgba(255,255,255,.45)",

  fontSize: 13,
};

export default UsersPage;