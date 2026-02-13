import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { Button } from "@mui/material";

function Header() {
  const navigate = useNavigate();

  return (
    <div style={header}>
      <div style={topHighlight} />
      <div style={bottomGlow} />

      <h2 style={title}>Alsorg Inventory Platform</h2>

      <Button
        startIcon={<LogoutIcon />}
        onClick={() => {
          localStorage.removeItem("auth");
          navigate("/login");
        }}
        sx={logoutButton}
      >
        Logout
      </Button>
    </div>
  );
}

/* ===================== STYLES ===================== */

const header = {
  position: "relative",
  padding: "15px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background:
    "linear-gradient(135deg, rgba(246,200,55,0.95), rgba(184,134,11,0.95))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderBottom: "1px solid rgba(255,255,255,0.3)",
  boxShadow:
    "0 14px 38px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)",
  overflow: "hidden",
  zIndex: 10,
};

const topHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 65,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.18), transparent)",
  pointerEvents: "none",
};

const bottomGlow = {
  position: "absolute",
  bottom: 0,
  left: "18%",
  right: "18%",
  height: 2,
  background:
    "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
  filter: "blur(1px)",
  opacity: 0.85,
};

const title = {
  margin: 0,
  fontSize: 23,
  fontWeight: 800,
  color: "#ffffff",
  letterSpacing: "0.6px",
  textShadow:
    "0 2px 4px rgba(0,0,0,0.35), 0 0 12px rgba(255,255,255,0.25)",
};

/* 🔥 MATCHES ZohoItemsPage BUTTON THEME */
const logoutButton = {
  px: 3,
  py: 0.9,
  fontSize: 13,
  fontWeight: 800,
  borderRadius: "999px",
  textTransform: "none",
  color: "rgba(255,255,255,0.9)",
  background:
    "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow:
    "0 8px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.08)",
  transition: "all 0.25s ease",

  "&:hover": {
    background:
      "linear-gradient(180deg, rgba(17,24,39,0.95), rgba(2,6,23,0.95))",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
    transform: "translateY(-1px)",
  },

  "&:active": {
    transform: "translateY(0)",
    boxShadow:
      "0 6px 18px rgba(0,0,0,0.4), inset 0 2px 6px rgba(0,0,0,0.4)",
  },
};

export default Header;
