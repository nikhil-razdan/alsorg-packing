import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import CloseIcon from "@mui/icons-material/Close";

import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Popover,
  Tooltip,
} from "@mui/material";

const parseJwt = (token) => {
  try {
    if (!token) return null;

    const base64Url = token.split(".")[1];

    if (!base64Url) return null;

    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`;
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const cleanRole = (value) => {
  return String(value || "GUEST")
    .replace("ROLE_", "")
    .trim()
    .toUpperCase();
};

const getStoredUsername = () => {
  const token = localStorage.getItem("token");
  const payload = parseJwt(token);

  const possibleUsername =
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    localStorage.getItem("fullName") ||
    localStorage.getItem("email") ||
    localStorage.getItem("userName") ||
    payload?.username ||
    payload?.name ||
    payload?.fullName ||
    payload?.email ||
    payload?.sub;

  if (!possibleUsername) {
    return "User";
  }

  return String(possibleUsername).trim() || "User";
};

function Header() {
  const navigate = useNavigate();

  const role = cleanRole(
    localStorage.getItem("role")
  );

  const username = getStoredUsername();

  const [appsAnchor, setAppsAnchor] =
    useState(null);

  const [notifAnchor, setNotifAnchor] =
    useState(null);

  const [healthAnchor, setHealthAnchor] =
    useState(null);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([
      {
        id: 1,
        title: "Warehouse pending review",
        message:
          "Some warehouse items may need status verification.",
        type: "WAREHOUSE",
        read: false,
      },
      {
        id: 2,
        title: "Dispatch queue active",
        message:
          "Dispatch module has active movement records.",
        type: "DISPATCH",
        read: false,
      },
      {
        id: 3,
        title: "Logistics module online",
        message:
          "Fleet and driver controls are available.",
        type: "LOGISTICS",
        read: true,
      },
    ]);

  const moduleLinks = useMemo(
    () => [
      {
        label: "Dashboard",
        path: "/",
        icon: <DashboardIcon />,
        roles: [
          "ADMIN",
          "DISPATCH",
          "PACKING",
          "WAREHOUSE",
          "LOGISTICS",
        ],
      },
      {
        label: "Inventory Items",
        path: "/zoho-items",
        icon: <InventoryIcon />,
        roles: ["ADMIN", "PACKING"],
      },
      {
        label: "Warehouse",
        path: "/warehouse",
        icon: <WarehouseIcon />,
        roles: [
          "ADMIN",
          "DISPATCH",
          "WAREHOUSE",
        ],
      },
      {
        label: "Dispatched Items",
        path: "/dispatched-items",
        icon: <LocalShippingIcon />,
        roles: [
          "ADMIN",
          "DISPATCH",
          "WAREHOUSE",
        ],
      },
      {
        label: "Logistics",
        path: "/logistics",
        icon: <LocalShippingIcon />,
        roles: ["ADMIN", "LOGISTICS"],
      },
      {
        label: "User Management",
        path: "/users",
        icon: <PersonIcon />,
        roles: ["ADMIN"],
      },
    ],
    []
  );

  const visibleModules =
    moduleLinks.filter((m) =>
      m.roles.includes(role)
    );

  const unreadCount =
    notifications.filter((n) => !n.read)
      .length;

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const openModule = (path) => {
    navigate(path);
    setAppsAnchor(null);
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
      }))
    );
  };

  return (
    <>
      <div style={header}>
        <div style={left}>
          <div style={brandWrap}>
            <div style={brandMark}>
              A
            </div>

            <div>
              <div style={title}>
                AES
              </div>

              <div style={subtitle}>
                Inventory • Warehousing • Logistics
              </div>
            </div>
          </div>
        </div>

        <div style={right}>
          <button
            style={statusBadge}
            onClick={(e) =>
              setHealthAnchor(e.currentTarget)
            }
          >
            ● SYSTEM HEALTHY
          </button>

          <Tooltip title="Open modules">
            <IconButton
              sx={iconBtnSx}
              onClick={(e) =>
                setAppsAnchor(e.currentTarget)
              }
            >
              <AppsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton
              sx={iconBtnSx}
              onClick={(e) =>
                setNotifAnchor(e.currentTarget)
              }
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                overlap="circular"
              >
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              sx={iconBtnSx}
              onClick={() =>
                setSettingsOpen(true)
              }
            >
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>

          <Button
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={logoutButton}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* APPS POPOVER */}
      <Popover
        open={Boolean(appsAnchor)}
        anchorEl={appsAnchor}
        onClose={() =>
          setAppsAnchor(null)
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: popoverPaper,
        }}
      >
        <Box sx={popoverTitle}>
          Quick Modules
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={moduleGrid}>
          {visibleModules.map((item) => (
            <button
              key={item.path}
              style={moduleCard}
              onClick={() =>
                openModule(item.path)
              }
            >
              <span style={moduleIcon}>
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </Box>
      </Popover>

      {/* NOTIFICATION POPOVER */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() =>
          setNotifAnchor(null)
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: popoverPaper,
        }}
      >
        <Box sx={popoverHeader}>
          <Box sx={popoverTitle}>
            Notifications
          </Box>

          <Button
            size="small"
            onClick={markAllAsRead}
            sx={smallAction}
          >
            Mark read
          </Button>
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={{ width: 360 }}>
          {notifications.length === 0 && (
            <Box sx={emptyState}>
              No notifications
            </Box>
          )}

          {notifications.map((n) => (
            <Box
              key={n.id}
              sx={{
                ...notificationItem,
                opacity: n.read ? 0.58 : 1,
              }}
            >
              <Box sx={notificationDot}>
                {!n.read ? "●" : ""}
              </Box>

              <Box>
                <Box sx={notificationTitle}>
                  {n.title}
                </Box>

                <Box sx={notificationMsg}>
                  {n.message}
                </Box>

                <Box sx={notificationType}>
                  {n.type}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>

      {/* SYSTEM HEALTH POPOVER */}
      <Popover
        open={Boolean(healthAnchor)}
        anchorEl={healthAnchor}
        onClose={() =>
          setHealthAnchor(null)
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: popoverPaper,
        }}
      >
        <Box sx={popoverTitle}>
          System Health
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={healthRow}>
          <HealthAndSafetyIcon
            fontSize="small"
          />
          API Connected
        </Box>

        <Box sx={healthRow}>
          <HealthAndSafetyIcon
            fontSize="small"
          />
          Auth Token Active
        </Box>

        <Box sx={healthRow}>
          <HealthAndSafetyIcon
            fontSize="small"
          />
          Local Storage Ready
        </Box>
      </Popover>

      {/* SETTINGS DRAWER */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() =>
          setSettingsOpen(false)
        }
        PaperProps={{
          sx: settingsDrawer,
        }}
      >
        <Box sx={settingsHeader}>
          <Box>
            <Box sx={settingsTitle}>
              Settings
            </Box>

            <Box sx={settingsSub}>
              User and application controls
            </Box>
          </Box>

          <IconButton
            onClick={() =>
              setSettingsOpen(false)
            }
            sx={drawerCloseBtn}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={profileCard}>
          <Box sx={profileAvatar}>
            {username
              .charAt(0)
              .toUpperCase()}
          </Box>

          <Box>
		  <Box sx={profileName}>
		    {username}
		  </Box>

		  <Box sx={profileRole}>
		    {role === "GUEST" ? "Guest User" : role}
		  </Box>
          </Box>
        </Box>

        <Box sx={settingsSection}>
          <Box sx={sectionLabel}>
            Quick Actions
          </Box>

          <button
            style={settingsAction}
            onClick={() => navigate("/")}
          >
            Go to Dashboard
          </button>

          {role === "ADMIN" && (
            <button
              style={settingsAction}
              onClick={() =>
                navigate("/users")
              }
            >
              Manage Users
            </button>
          )}

          <button
            style={settingsActionDanger}
            onClick={handleLogout}
          >
            Logout
          </button>
        </Box>
      </Drawer>
    </>
  );
}

/* ===================== STYLES ===================== */

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
  cursor: "pointer",
};

const iconBtnSx = {
  width: 42,
  height: 42,
  borderRadius: "14px",
  color: "rgba(255,255,255,.82)",
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.06)",

  "&:hover": {
    background:
      "rgba(59,130,246,.16)",
    borderColor:
      "rgba(59,130,246,.35)",
    transform: "translateY(-1px)",
  },
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

const popoverPaper = {
  mt: 1.5,
  borderRadius: "22px",
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  color: "#fff",
  border:
    "1px solid rgba(255,255,255,.08)",
  boxShadow:
    "0 24px 70px rgba(0,0,0,.45)",
  p: 2,
};

const popoverTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
};

const popoverHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: 360,
};

const dividerSx = {
  borderColor:
    "rgba(255,255,255,.08)",
  my: 1.5,
};

const moduleGrid = {
  width: 360,
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0,1fr))",
  gap: 1.2,
};

const moduleCard = {
  minHeight: 74,
  borderRadius: 16,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 8,
  padding: "12px 14px",
  fontWeight: 800,
};

const moduleIcon = {
  color: "#60a5fa",
  display: "flex",
};

const smallAction = {
  color: "#60a5fa",
  textTransform: "none",
  fontWeight: 800,
};

const notificationItem = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  gap: 1,
  p: 1.4,
  borderRadius: "16px",
  border:
    "1px solid rgba(255,255,255,.06)",
  background:
    "rgba(255,255,255,.035)",
  mb: 1,
};

const notificationDot = {
  color: "#60a5fa",
  fontSize: 12,
  pt: 0.3,
};

const notificationTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#fff",
};

const notificationMsg = {
  fontSize: 12,
  color: "#94a3b8",
  mt: 0.5,
  lineHeight: 1.45,
};

const notificationType = {
  display: "inline-flex",
  mt: 1,
  px: 1,
  py: 0.3,
  borderRadius: "999px",
  fontSize: 10,
  fontWeight: 900,
  color: "#60a5fa",
  background:
    "rgba(59,130,246,.12)",
};

const emptyState = {
  color: "#94a3b8",
  fontSize: 13,
  py: 3,
  textAlign: "center",
};

const healthRow = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  color: "#cbd5e1",
  fontWeight: 700,
  fontSize: 13,
  py: 1,
  minWidth: 260,

  "& svg": {
    color: "#4ade80",
  },
};

const settingsDrawer = {
  width: 390,
  background:
    "linear-gradient(180deg,#020617,#0f172a)",
  color: "#fff",
  p: 3,
  borderLeft:
    "1px solid rgba(255,255,255,.08)",
};

const settingsHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const settingsTitle = {
  fontSize: 24,
  fontWeight: 900,
};

const settingsSub = {
  fontSize: 13,
  color: "#94a3b8",
  mt: 0.5,
};

const drawerCloseBtn = {
  color: "#fff",
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.08)",
};

const profileCard = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  p: 2,
  borderRadius: "18px",
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.08)",
};

const profileAvatar = {
  width: 44,
  height: 44,
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  fontWeight: 900,
};

const profileName = {
  fontWeight: 900,
  fontSize: 15,
};

const profileRole = {
  color: "#94a3b8",
  fontSize: 12,
  mt: 0.4,
};

const settingsSection = {
  mt: 3,
};

const sectionLabel = {
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontSize: 11,
  fontWeight: 900,
  mb: 1.5,
};

const settingsAction = {
  width: "100%",
  height: 44,
  borderRadius: 14,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  textAlign: "left",
  padding: "0 14px",
  marginBottom: 10,
};

const settingsActionDanger = {
  ...settingsAction,
  background:
    "rgba(239,68,68,.14)",
  color: "#f87171",
  border:
    "1px solid rgba(239,68,68,.22)",
};

export default Header;