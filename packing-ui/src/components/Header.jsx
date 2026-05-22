import LogoutIcon from "@mui/icons-material/Logout";
import { Button } from "@mui/material";

function Header() {
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div style={header}>
      <div style={left}>
        <div style={brandMark}>A</div>
        <div>
          <div style={title}>Alsorg Inventory Platform</div>
          <div style={subtitle}>Discover Packing - Warehousing - Dispatching</div>
        </div>
      </div>

      <Button startIcon={<LogoutIcon />} onClick={handleLogout} sx={logoutButton}>
        Logout
      </Button>
    </div>
  );
}

const header = {
  height: 64,
  padding: "0 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#ffffff",
  borderBottom: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const left = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandMark = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  color: "#fff",
  background: "linear-gradient(135deg, #60a5fa, #2563eb)",
};

const title = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
};

const subtitle = {
  fontSize: 12,
  color: "#6b7280",
};

const logoutButton = {
  px: 2,
  py: 0.8,
  borderRadius: 8,
  textTransform: "none",
  fontWeight: 600,
  color: "#fff",
  background: "#4f46e5",
  "&:hover": {
    background: "#4338ca",
  },
};

export default Header;