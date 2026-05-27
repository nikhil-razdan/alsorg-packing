import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AppsIcon from "@mui/icons-material/Apps";

import {
  Button,
  IconButton,
} from "@mui/material";

function Header() {
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div style={header}>
      <div style={left}>
        <div style={brandWrap}>
          <div style={brandMark}>
            A
          </div>

          <div>
            <div style={title}>
              ALSORG ERP SUITE
            </div>

            <div style={subtitle}>
              Inventory • Warehousing • Logistics
            </div>
          </div>
        </div>
      </div>

      <div style={right}>
        <div style={statusBadge}>
          ● SYSTEM HEALTHY
        </div>

        <IconButton style={iconBtn}>
          <AppsIcon />
        </IconButton>

        <IconButton style={iconBtn}>
          <NotificationsNoneIcon />
        </IconButton>

        <IconButton style={iconBtn}>
          <SettingsOutlinedIcon />
        </IconButton>

        <Button
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={logoutButton}
        >
          Logout
        </Button>
      </div>
    </div>
  );
}

const header = {
  height: 76,

  padding: "0 28px",

  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  background:
    "linear-gradient(180deg,#081225 0%,#0b1730 100%)",

  borderBottom:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "0 10px 30px rgba(2,6,23,.35)",

  position: "sticky",

  top: 0,

  zIndex: 50,
};

const left = {
  display: "flex",
  alignItems: "center",
};

const brandWrap = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const brandMark = {
  width: 48,
  height: 48,

  borderRadius: 16,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  fontWeight: 900,

  fontSize: 20,

  color: "#fff",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  boxShadow:
    "0 10px 25px rgba(37,99,235,.35)",
};

const title = {
  fontSize: 18,

  fontWeight: 900,

  letterSpacing: 1,

  color: "#fff",
};

const subtitle = {
  fontSize: 12,

  marginTop: 4,

  color: "rgba(255,255,255,.55)",

  letterSpacing: 0.4,
};

const right = {
  display: "flex",

  alignItems: "center",

  gap: 12,
};

const statusBadge = {
  height: 38,

  padding: "0 16px",

  borderRadius: 999,

  display: "flex",

  alignItems: "center",

  background:
    "rgba(34,197,94,.12)",

  color: "#4ade80",

  border:
    "1px solid rgba(34,197,94,.22)",

  fontWeight: 800,

  fontSize: 12,

  letterSpacing: 1,
};

const iconBtn = {
  width: 42,
  height: 42,

  borderRadius: 14,

  color: "rgba(255,255,255,.82)",

  background:
    "rgba(255,255,255,.04)",

  border:
    "1px solid rgba(255,255,255,.06)",
};

const logoutButton = {
  px: 2.2,

  py: 1,

  borderRadius: "14px",

  textTransform: "none",

  fontWeight: 700,

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  boxShadow:
    "0 10px 25px rgba(37,99,235,.35)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

export default Header;