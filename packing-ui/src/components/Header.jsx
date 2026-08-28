import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import CloseIcon from "@mui/icons-material/Close";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

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

import { useAuth } from "../auth/AuthContext";
import { usePackFlowTheme } from "../theme/PackFlowThemeContext";

import {
  fetchVehicles,
} from "../dashboard/api/logisticsApi";

import {
  buildVehicleComplianceNotifications,
} from "../dashboard/components/logistics/vehicleComplianceUtils";

const cleanRole = (value) =>
  String(value || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .toUpperCase();

const resolvePackFlowHomePath = (
  user,
  hasRole
) => {
  if (
    hasRole("ADMIN") ||
    hasRole("PACKFLOW_DIRECTOR")
  ) {
    return "/packflow/dashboard";
  }

  const routeForRole = (role) => {
    switch (cleanRole(role)) {
      case "PACKING":
        return "/packflow/zoho-items?view=normal";
      case "HARDWARE_PACKING":
        return "/packflow/zoho-items?view=hardware";
      case "WAREHOUSE":
        return "/packflow/warehouse";
      case "DISPATCH":
        return "/packflow/dispatched-items";
      case "LOGISTICS":
        return "/packflow/logistics";
      default:
        return null;
    }
  };

  const primary = routeForRole(user?.role);
  if (primary) return primary;

  for (const role of [
    "PACKING",
    "HARDWARE_PACKING",
    "WAREHOUSE",
    "DISPATCH",
    "LOGISTICS",
  ]) {
    if (hasRole(role)) {
      return routeForRole(role);
    }
  }

  return "/modules";
};

function Header() {
  const navigate = useNavigate();

  const {
    mode,
    setMode,
    toggleTheme,
  } = usePackFlowTheme();

  const {
    user,
    role,
    roles = [],
    modules = [],
    hasRole,
    hasAnyRole,
    logout,
  } = useAuth();

  const isDirector =
    hasRole("PACKFLOW_DIRECTOR");

  const canOpenDashboard =
    hasAnyRole(
      "ADMIN",
      "PACKFLOW_DIRECTOR"
    );

  const packFlowHomePath =
    resolvePackFlowHomePath(
      user,
      hasRole
    );

  const canOpenBOMFlow =
    modules.includes("BOMFLOW");

  const canOpenMatFlow =
    modules.includes("MATFLOW");

  const username =
    user?.username || "User";

  const [appsAnchor, setAppsAnchor] =
    useState(null);

  const [notifAnchor, setNotifAnchor] =
    useState(null);

  const [healthAnchor, setHealthAnchor] =
    useState(null);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false);

  /*
   * PACKFLOW_DIRECTOR intentionally does not load person/vehicle-level
   * operational APIs. Aggregate executive analytics are loaded only by the
   * dashboard itself. This also aligns with the backend Director API boundary.
   */
  const canViewFleetCompliance =
    hasAnyRole(
      "ADMIN",
      "LOGISTICS",
      "DISPATCH"
    );

  useEffect(() => {
    if (
      !canViewFleetCompliance ||
      !user?.id
    ) {
      setNotifications([]);
      return undefined;
    }

    setNotifications([]);

    let active = true;

    async function loadFleetNotifications() {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      try {
        setNotificationsLoading(true);

        const vehicles =
          await fetchVehicles();

        if (!active) return;

        const alerts =
          buildVehicleComplianceNotifications(
            Array.isArray(vehicles)
              ? vehicles
              : []
          );

        setNotifications((previous) => {
          const previousReadState =
            new Map(
              previous.map((item) => [
                item.id,
                item.read,
              ])
            );

          return alerts.map((alert) => ({
            ...alert,
            read:
              previousReadState.get(
                alert.id
              ) ?? false,
          }));
        });
      } catch (error) {
        console.error(
          "Fleet compliance notifications failed",
          error
        );
      } finally {
        if (active) {
          setNotificationsLoading(false);
        }
      }
    }

    void loadFleetNotifications();

    const intervalId =
      window.setInterval(
        loadFleetNotifications,
        5 * 60 * 1000
      );

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadFleetNotifications();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    canViewFleetCompliance,
    user?.id,
  ]);

  const moduleLinks = useMemo(
    () => [
      {
        key: "dashboard",
        label: isDirector
          ? "Executive Dashboard"
          : "Dashboard",
        path: "/packflow/dashboard",
        icon: <DashboardIcon />,
        visible: canOpenDashboard,
      },
      {
        key: "inventory",
        label: "Inventory Items",
        path:
          "/packflow/zoho-items?view=normal",
        icon: <InventoryIcon />,
        visible: hasAnyRole(
          "ADMIN",
          "PACKING"
        ),
      },
      {
        key: "hardware",
        label: "Hardware Packets",
        path:
          "/packflow/zoho-items?view=hardware",
        icon: <InventoryIcon />,
        visible: hasAnyRole(
          "ADMIN",
          "HARDWARE_PACKING"
        ),
      },
      {
        key: "warehouse",
        label: "Warehouse",
        path: "/packflow/warehouse",
        icon: <WarehouseIcon />,
        visible:
          hasAnyRole(
            "ADMIN",
            "WAREHOUSE",
            "DISPATCH"
          ) ||
          user?.warehouseAccess === true,
      },
      {
        key: "dispatch",
        label: "Dispatched Items",
        path:
          "/packflow/dispatched-items",
        icon: <LocalShippingIcon />,
        visible: hasAnyRole(
          "ADMIN",
          "DISPATCH",
          "WAREHOUSE",
          "PACKING"
        ),
      },
      {
        key: "logistics",
        label: "Logistics",
        path: "/packflow/logistics",
        icon: <LocalShippingIcon />,
        visible: hasAnyRole(
          "ADMIN",
          "LOGISTICS"
        ),
      },
    ],
    [
      canOpenDashboard,
      hasAnyRole,
      isDirector,
      user?.warehouseAccess,
    ]
  );

  const visibleModules =
    moduleLinks.filter(
      (module) => module.visible
    );

  const unreadCount =
    notifications.filter(
      (item) => !item.read
    ).length;

  const criticalNotificationCount =
    notifications.filter(
      (item) =>
        item.severity === "error"
    ).length;

  const warningNotificationCount =
    notifications.filter(
      (item) =>
        item.severity === "warning"
    ).length;

  const healthLabel =
    canViewFleetCompliance
      ? criticalNotificationCount > 0
        ? "● FLEET ACTION NEEDED"
        : warningNotificationCount > 0
          ? "● FLEET ATTENTION"
          : "● FLEET DOCS CLEAR"
      : isDirector
        ? "● EXECUTIVE ACCESS"
        : "● SESSION ACTIVE";

  const healthSeverity =
    canViewFleetCompliance &&
    criticalNotificationCount > 0
      ? "error"
      : canViewFleetCompliance &&
          warningNotificationCount > 0
        ? "warning"
        : "ok";

  const handleLogout = async () => {
    await logout();
    navigate("/login", {
      replace: true,
    });
  };

  const openModule = (path) => {
    navigate(path);
    setAppsAnchor(null);
  };

  const markAllAsRead = () => {
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        read: true,
      }))
    );
  };

  return (
    <>
      <header style={header}>
        <div style={left}>
          <div style={brandWrap}>
            <div style={brandMark}>
              A
            </div>

            <div>
              <div style={title}>
                PackFlow
              </div>

              <div style={subtitle}>
                Alsorg Operations Suite
              </div>
            </div>
          </div>
        </div>

        <div style={right}>
          <button
            type="button"
            style={statusBadge(
              healthSeverity
            )}
            onClick={(event) =>
              setHealthAnchor(
                event.currentTarget
              )
            }
          >
            {healthLabel}
          </button>

          <Tooltip title="Open modules">
            <IconButton
              sx={iconBtnSx}
              onClick={(event) =>
                setAppsAnchor(
                  event.currentTarget
                )
              }
            >
              <AppsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton
              sx={iconBtnSx}
              onClick={(event) =>
                setNotifAnchor(
                  event.currentTarget
                )
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

          <Tooltip
            title={
              mode === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            <IconButton
              sx={iconBtnSx}
              onClick={toggleTheme}
              aria-label={
                mode === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {mode === "dark" ? (
                <LightModeOutlinedIcon />
              ) : (
                <DarkModeOutlinedIcon />
              )}
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
      </header>

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
          Platform Modules
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={moduleGrid}>
          <button
            type="button"
            style={moduleCard}
            onClick={() =>
              openModule("/modules")
            }
          >
            <span style={moduleIcon}>
              <AppsIcon />
            </span>
            <span>All Modules</span>
          </button>

          {canOpenBOMFlow && (
            <button
              type="button"
              style={moduleCard}
              onClick={() =>
                openModule(
                  "/bomflow/dashboard"
                )
              }
            >
              <span style={moduleIcon}>
                <AccountTreeOutlinedIcon />
              </span>
              <span>BOMFlow</span>
            </button>
          )}

          {canOpenMatFlow && (
            <button
              type="button"
              style={moduleCard}
              onClick={() =>
                openModule(
                  "/matflow/dashboard"
                )
              }
            >
              <span style={moduleIcon}>
                <LayersOutlinedIcon />
              </span>
              <span>MatFlow</span>
            </button>
          )}

          {hasRole("ADMIN") && (
            <button
              type="button"
              style={moduleCard}
              onClick={() =>
                openModule("/users")
              }
            >
              <span style={moduleIcon}>
                <PersonIcon />
              </span>
              <span>
                User Management
              </span>
            </button>
          )}
        </Box>

        {visibleModules.length > 0 && (
          <>
            <Divider sx={dividerSx} />

            <Box sx={popoverTitle}>
              PackFlow Quick Links
            </Box>

            <Divider sx={dividerSx} />

            <Box sx={moduleGrid}>
              {visibleModules.map(
                (item) => (
                  <button
                    type="button"
                    key={item.key}
                    style={moduleCard}
                    onClick={() =>
                      openModule(
                        item.path
                      )
                    }
                  >
                    <span
                      style={moduleIcon}
                    >
                      {item.icon}
                    </span>
                    <span>
                      {item.label}
                    </span>
                  </button>
                )
              )}
            </Box>
          </>
        )}
      </Popover>

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
          <Box>
            <Box sx={popoverTitle}>
              Notifications
            </Box>
            <Box
              sx={notificationHeaderSub}
            >
              {canViewFleetCompliance
                ? "Fleet document compliance alerts"
                : "No operational notifications for this role"}
            </Box>
          </Box>

          {canViewFleetCompliance && (
            <Button
              size="small"
              onClick={markAllAsRead}
              sx={smallAction}
            >
              Mark read
            </Button>
          )}
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={notificationList}>
          {notificationsLoading &&
            notifications.length === 0 && (
              <Box sx={emptyState}>
                Checking fleet compliance...
              </Box>
            )}

          {!notificationsLoading &&
            notifications.length === 0 && (
              <Box
                sx={
                  canViewFleetCompliance
                    ? healthyNotificationState
                    : emptyState
                }
              >
                {canViewFleetCompliance
                  ? "✓ No PUCC, Insurance or Fitness expiry alerts."
                  : "This role does not load driver or vehicle-level operational notifications."}
              </Box>
            )}

          {notifications.map((item) => (
            <Box
              key={item.id}
              sx={{
                ...notificationItem,
                ...(item.severity ===
                "error"
                  ? notificationItemError
                  : notificationItemWarning),
                opacity: item.read
                  ? 0.56
                  : 1,
              }}
            >
              <Box
                sx={
                  notificationDotBySeverity(
                    item.severity
                  )
                }
              >
                {!item.read ? "●" : ""}
              </Box>

              <Box>
                <Box
                  sx={notificationTitle}
                >
                  {item.title}
                </Box>

                <Box
                  sx={notificationMsg}
                >
                  {item.message}
                </Box>

                <Box
                  sx={notificationType}
                >
                  {item.type}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>

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
          Access & Compliance
        </Box>

        <Divider sx={dividerSx} />

        <Box sx={healthRow}>
          <HealthAndSafetyIcon fontSize="small" />
          Signed in as {username}
        </Box>

        <Box sx={healthRow}>
          <HealthAndSafetyIcon fontSize="small" />
          PackFlow role access active
        </Box>

        {canViewFleetCompliance ? (
          <>
            <Box sx={healthDivider} />
            <Box
              sx={fleetHealthRow(
                healthSeverity
              )}
            >
              Fleet document alerts: {criticalNotificationCount} critical • {warningNotificationCount} warning
            </Box>
          </>
        ) : (
          <>
            <Box sx={healthDivider} />
            <Box sx={healthRoleNote}>
              Vehicle-level compliance data is not loaded for this role.
            </Box>
          </>
        )}
      </Popover>

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

          <Box sx={{ minWidth: 0 }}>
            <Box sx={profileName}>
              {username}
            </Box>
            <Box sx={profileRole}>
              {roles.length > 0
                ? roles.join(" • ")
                : role || "User"}
            </Box>
          </Box>
        </Box>

        <Box sx={settingsSection}>
          <Box sx={sectionLabel}>
            Appearance
          </Box>

          <Box sx={themeChoiceRow}>
            <button
              type="button"
              onClick={() =>
                setMode("dark")
              }
              style={themeChoiceButton(
                mode === "dark"
              )}
            >
              <DarkModeOutlinedIcon fontSize="small" />
              Dark
            </button>

            <button
              type="button"
              onClick={() =>
                setMode("light")
              }
              style={themeChoiceButton(
                mode === "light"
              )}
            >
              <LightModeOutlinedIcon fontSize="small" />
              Light
            </button>
          </Box>

          <Box sx={themeHelpText}>
            PackFlow remembers this UI preference in this browser and applies it to every PackFlow page using the shared theme tokens.
          </Box>
        </Box>

        <Box sx={settingsSection}>
          <Box sx={sectionLabel}>
            Quick Actions
          </Box>

          <button
            type="button"
            style={settingsAction}
            onClick={() =>
              navigate("/modules")
            }
          >
            All Modules
          </button>

          <button
            type="button"
            style={settingsAction}
            onClick={() =>
              navigate(
                packFlowHomePath
              )
            }
          >
            {canOpenDashboard
              ? isDirector
                ? "Go to Executive Dashboard"
                : "Go to PackFlow Dashboard"
              : "Go to PackFlow Home"}
          </button>

          {hasRole("ADMIN") && (
            <button
              type="button"
              style={settingsAction}
              onClick={() =>
                navigate("/users")
              }
            >
              Manage Users
            </button>
          )}

          {canOpenBOMFlow && (
            <button
              type="button"
              style={settingsAction}
              onClick={() =>
                navigate(
                  "/bomflow/dashboard"
                )
              }
            >
              Open BOMFlow
            </button>
          )}

          {canOpenMatFlow && (
            <button
              type="button"
              style={settingsAction}
              onClick={() =>
                navigate(
                  "/matflow/dashboard"
                )
              }
            >
              Open MatFlow
            </button>
          )}

          <button
            type="button"
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

const header = {
  height: 66,
  minHeight: 66,
  padding: "0 22px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexShrink: 0,
  background:
    "linear-gradient(180deg,var(--pf-header-start) 0%,var(--pf-header-end) 100%)",
  borderBottom:
    "1px solid rgba(var(--pf-fg-rgb),.07)",
  boxShadow:
    "0 6px 18px rgba(var(--pf-surface-deep-rgb),.08)",
  position: "relative",
  zIndex: 50,
};

const left = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
};

const brandWrap = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandMark = {
  width: 42,
  minWidth: 42,
  height: 42,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
  fontSize: 18,
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  boxShadow:
    "0 7px 18px rgba(37,99,235,.24)",
};

const title = {
  fontSize: 17,
  fontWeight: 950,
  letterSpacing: .5,
  color: "var(--pf-text-strong)",
};

const subtitle = {
  marginTop: 2,
  fontSize: 10.5,
  color: "var(--pf-text-muted)",
  letterSpacing: .25,
  fontWeight: 650,
};

const right = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
};

const statusBadge = (severity) => ({
  height: 34,
  padding: "0 13px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  background:
    severity === "error"
      ? "rgba(239,68,68,.09)"
      : severity === "warning"
        ? "rgba(245,158,11,.10)"
        : "rgba(34,197,94,.09)",
  color:
    severity === "error"
      ? "#dc2626"
      : severity === "warning"
        ? "#b45309"
        : "#15803d",
  border:
    severity === "error"
      ? "1px solid rgba(239,68,68,.22)"
      : severity === "warning"
        ? "1px solid rgba(245,158,11,.22)"
        : "1px solid rgba(34,197,94,.20)",
  fontWeight: 900,
  fontSize: 10.5,
  letterSpacing: .7,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const iconBtnSx = {
  width: 38,
  height: 38,
  borderRadius: "10px",
  color: "var(--pf-text)",
  background: "var(--pf-surface-alt)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.07)",
  transition:
    "background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease",
  "&:hover": {
    color: "#2563eb",
    background:
      "rgba(59,130,246,.08)",
    borderColor:
      "rgba(59,130,246,.24)",
    transform: "translateY(-1px)",
  },
};

const logoutButton = {
  height: 38,
  px: 1.8,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 850,
  fontSize: 12,
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  boxShadow:
    "0 7px 18px rgba(37,99,235,.22)",
  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const popoverPaper = {
  mt: 1,
  borderRadius: "14px",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  boxShadow:
    "0 20px 54px rgba(var(--pf-surface-deep-rgb),.24)",
  p: 1.5,
};

const popoverTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: "var(--pf-text-strong)",
};

const popoverHeader = {
  width: 360,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const dividerSx = {
  borderColor:
    "rgba(var(--pf-fg-rgb),.08)",
  my: 1.5,
};

const moduleGrid = {
  width: 360,
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 1.2,
};

const moduleCard = {
  minHeight: 68,
  borderRadius: 11,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.07)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 7,
  padding: "10px 12px",
  fontWeight: 800,
  fontFamily: "inherit",
  textAlign: "left",
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

const notificationList = {
  width: 390,
  maxWidth: "calc(100vw - 40px)",
  maxHeight: 460,
  overflowY: "auto",
};

const notificationItem = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  gap: 1,
  p: 1.25,
  borderRadius: "11px",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.06)",
  background: "var(--pf-surface-alt)",
  mb: 1,
};

const notificationDotBySeverity =
  (severity) => ({
    color:
      severity === "error"
        ? "#f87171"
        : "#fbbf24",
    fontSize: 12,
    pt: .3,
  });

const notificationItemError = {
  background: "rgba(239,68,68,.065)",
  border:
    "1px solid rgba(239,68,68,.14)",
};

const notificationItemWarning = {
  background: "rgba(245,158,11,.055)",
  border:
    "1px solid rgba(245,158,11,.13)",
};

const notificationHeaderSub = {
  mt: .35,
  color: "var(--pf-text-dim)",
  fontSize: 10,
  fontWeight: 750,
};

const notificationTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "var(--pf-text-strong)",
};

const notificationMsg = {
  mt: .5,
  fontSize: 12,
  color: "var(--pf-text-muted)",
  lineHeight: 1.45,
};

const notificationType = {
  display: "inline-flex",
  mt: 1,
  px: 1,
  py: .3,
  borderRadius: "999px",
  fontSize: 10,
  fontWeight: 900,
  color: "#60a5fa",
  background:
    "rgba(59,130,246,.12)",
};

const emptyState = {
  color: "var(--pf-text-muted)",
  fontSize: 13,
  py: 3,
  px: 2,
  textAlign: "center",
};

const healthyNotificationState = {
  color: "#15803d",
  fontSize: 12,
  py: 2.5,
  px: 2,
  textAlign: "center",
  fontWeight: 800,
  background: "rgba(34,197,94,.06)",
  borderRadius: "11px",
  border:
    "1px solid rgba(34,197,94,.14)",
};

const healthRow = {
  minWidth: 260,
  py: 1,
  display: "flex",
  alignItems: "center",
  gap: 1,
  color: "var(--pf-text)",
  fontWeight: 700,
  fontSize: 13,
  "& svg": {
    color: "#4ade80",
  },
};

const healthDivider = {
  height: "1px",
  background:
    "rgba(var(--pf-fg-rgb),.08)",
  my: 1,
};

const healthRoleNote = {
  minWidth: 260,
  py: 1,
  color: "var(--pf-text-muted)",
  fontSize: 11.5,
  fontWeight: 750,
  lineHeight: 1.5,
};

const fleetHealthRow =
  (severity) => ({
    minWidth: 260,
    py: 1,
    color:
      severity === "error"
        ? "#f87171"
        : severity === "warning"
          ? "#fbbf24"
          : "#4ade80",
    fontSize: 12,
    fontWeight: 850,
  });

const settingsDrawer = {
  width: 370,
  maxWidth: "92vw",
  background: "var(--pf-surface)",
  color: "var(--pf-text-strong)",
  p: 2.5,
  borderLeft:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
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
  mt: .5,
  fontSize: 13,
  color: "var(--pf-text-muted)",
};

const drawerCloseBtn = {
  color: "var(--pf-text-strong)",
  background:
    "rgba(var(--pf-fg-rgb),.04)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
};

const profileCard = {
  p: 1.6,
  display: "flex",
  alignItems: "center",
  gap: 2,
  borderRadius: "12px",
  background: "var(--pf-surface-alt)",
  border:
    "1px solid rgba(var(--pf-fg-rgb),.07)",
};

const profileAvatar = {
  width: 42,
  minWidth: 42,
  height: 42,
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 900,
};

const profileName = {
  fontWeight: 900,
  fontSize: 15,
};

const profileRole = {
  mt: .4,
  color: "var(--pf-text-muted)",
  fontSize: 12,
  overflowWrap: "anywhere",
};

const settingsSection = {
  mt: 3,
};

const sectionLabel = {
  mb: 1.5,
  color: "var(--pf-text-muted)",
  textTransform: "uppercase",
  letterSpacing: ".12em",
  fontSize: 11,
  fontWeight: 900,
};

const settingsAction = {
  width: "100%",
  height: 42,
  marginBottom: 9,
  padding: "0 13px",
  borderRadius: 10,
  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",
  background: "var(--pf-surface-alt)",
  color: "var(--pf-text-strong)",
  cursor: "pointer",
  fontWeight: 800,
  fontFamily: "inherit",
  textAlign: "left",
};

const settingsActionDanger = {
  ...settingsAction,
  background:
    "rgba(239,68,68,.14)",
  color: "#f87171",
  border:
    "1px solid rgba(239,68,68,.22)",
};

const themeChoiceRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1,
  mt: 1,
};

const themeChoiceButton =
  (active) => ({
    height: 42,
    borderRadius: 10,
    border: active
      ? "1px solid rgba(59,130,246,.34)"
      : "1px solid rgba(var(--pf-fg-rgb),.08)",
    background: active
      ? "rgba(59,130,246,.12)"
      : "var(--pf-surface-alt)",
    color: active
      ? "color-mix(in srgb,#2563eb 82%,var(--pf-text-strong))"
      : "var(--pf-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  });

const themeHelpText = {
  mt: 1,
  color: "var(--pf-text-dim)",
  fontSize: 10.5,
  fontWeight: 700,
  lineHeight: 1.5,
};

export default Header;
