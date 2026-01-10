import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { Button } from "@mui/material";

function Header() {
  const navigate = useNavigate();

  return (
    <div style={header}>
      {/* Glass reflection */}
      <div style={topHighlight} />

      {/* Subtle bottom glow */}
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
  padding: "20px 34px",
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

/* Top glass shine */
const topHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 80,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.18), transparent)",
  pointerEvents: "none",
};

/* Elegant bottom separator */
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

/* Title – clean, authoritative */
const title = {
  margin: 0,
  fontSize: 23,
  fontWeight: 800,
  color: "#ffffff",
  letterSpacing: "0.6px",
  textShadow:
    "0 2px 4px rgba(0,0,0,0.35), 0 0 12px rgba(255,255,255,0.25)",
};

/* Logout Button – premium glass */
const logoutButton = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  px: 3.2,
  py: 1.15,
  borderRadius: "16px",
  textTransform: "none",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.4px",
  color: "rgba(255,255,255,0.95)",
  background:
    "linear-gradient(180deg, rgba(31,41,55,0.92), rgba(17,24,39,0.92))",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow:
    "0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",

  "&:hover": {
    transform: "translateY(-2px)",
    background:
      "linear-gradient(180deg, rgba(17,24,39,0.98), rgba(2,6,23,0.98))",
    boxShadow:
      "0 18px 42px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.28)",
  },

  "&:active": {
    transform: "translateY(0)",
    boxShadow:
      "0 8px 18px rgba(0,0,0,0.5), inset 0 2px 6px rgba(0,0,0,0.45)",
  },

  "&:focus-visible": {
    outline: "none",
    boxShadow:
      "0 0 0 3px rgba(246,200,55,0.5), 0 12px 30px rgba(0,0,0,0.5)",
  },
};

export default Header;
