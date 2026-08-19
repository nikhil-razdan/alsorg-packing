import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  canOpenWarehousePageFromUser,
} from "../utils/permissions";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";

import { useAuth } from "../auth/AuthContext";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const {
    user,
    hasRole,
    hasAnyRole,
  } = useAuth();

  const canOpenNormalInventory =
    hasAnyRole("ADMIN", "PACKING");

  const canOpenHardwareInventory =
    hasAnyRole("ADMIN", "HARDWARE_PACKING");

  const canOpenWarehouse =
    canOpenWarehousePageFromUser(user);

  const canOpenDispatch =
    hasAnyRole(
      "ADMIN",
      "DISPATCH",
      "WAREHOUSE",
      "PACKING"
    );

  const requestedInventoryView =
    new URLSearchParams(location.search).get("view");

  const currentInventoryView =
    requestedInventoryView ||
    (canOpenNormalInventory ? "normal" : "hardware");

  const links = [
    {
      path: "/packflow/dashboard",
      label: "Dashboard",
      roles: [
        "ADMIN",
        "DISPATCH",
        "PACKING",
        "WAREHOUSE",
        "LOGISTICS",
      ],
      icon: <DashboardOutlinedIcon fontSize="small" />,
    },
    {
      path: "/packflow/zoho-items",
      view: "normal",
      label: "Inventory Items",
      roles: [],
      customAccess: canOpenNormalInventory,
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
    {
      path: "/packflow/zoho-items",
      view: "hardware",
      label: "Hardware Inventory",
      roles: [],
      customAccess: canOpenHardwareInventory,
      icon: <Inventory2OutlinedIcon fontSize="small" />,
    },
    {
      path: "/packflow/warehouse",
      label: "Warehouse",
      roles: [],
      customAccess: canOpenWarehouse,
      icon: <WarehouseOutlinedIcon fontSize="small" />,
    },
    {
      path: "/packflow/dispatched-items",
      label: "Dispatched Items",
      roles: [],
      customAccess: canOpenDispatch,
      icon: <LocalShippingOutlinedIcon fontSize="small" />,
    },
    {
      path: "/packflow/logistics",
      label: "Logistics",
      roles: ["ADMIN", "LOGISTICS"],
      icon: <AltRouteOutlinedIcon fontSize="small" />,
    },
  ];

  const visibleLinks = links.filter((link) => {
    if (typeof link.customAccess === "boolean") {
      return link.customAccess;
    }

    return link.roles.some((allowedRole) => hasRole(allowedRole));
  });

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 13,
    padding: "10px 12px",
    marginBottom: 5,
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
    color: active ? "#ffffff" : "var(--pf-sidebar-text)",
    background: active
      ? "linear-gradient(135deg,#2563eb,#3b82f6)"
      : "transparent",
    border: active
      ? "1px solid rgba(59,130,246,.34)"
      : "1px solid transparent",
    boxShadow: active
      ? "0 7px 18px rgba(37,99,235,.20)"
      : "none",
    transition: "background .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease",
    justifyContent: collapsed ? "center" : "flex-start",
  });

  return (
    <aside
      className="packflow-sidebar"
      style={{
        ...sidebar,
        width: collapsed ? 64 : 210,
      }}
    >
      <div style={topHighlight} />

      <div style={logoSection}>
        <div style={logoIcon}>A</div>

        {!collapsed && (
          <div>
            <div style={logoTitle}>ALSORG</div>
            <div style={logoSub}>PackFlow</div>
          </div>
        )}
      </div>

      <div
        style={{
          ...toggleRow,
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && <div style={menuTitle}>Menu</div>}

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          style={toggleButton}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <Link
        to="/modules"
        style={linkStyle(location.pathname === "/modules")}
      >
        <span style={icon}>
          <AppsOutlinedIcon fontSize="small" />
        </span>
        {!collapsed && "All Modules"}
      </Link>

      <div style={smallDivider} />

      {visibleLinks.map((link) => {
        const target = link.view
          ? `${link.path}?view=${link.view}`
          : link.path;

        const active = link.view
          ? location.pathname === link.path &&
            currentInventoryView === link.view
          : location.pathname === link.path ||
            location.pathname.startsWith(`${link.path}/`);

        const key = link.view
          ? `${link.path}-${link.view}`
          : link.path;

        return (
          <Link key={key} to={target} style={linkStyle(active)}>
            <span style={icon}>{link.icon}</span>
            {!collapsed && link.label}
          </Link>
        );
      })}

      <div style={{ flexGrow: 1 }} />
      <div style={divider} />
    </aside>
  );
}

const sidebar = {
  height: "100vh",
  flexShrink: 0,
  padding: "18px 11px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  background: "var(--pf-sidebar-bg)",
  color: "var(--pf-sidebar-text)",
  borderRight: "1px solid var(--pf-sidebar-border)",
  boxShadow: "var(--pf-sidebar-shadow)",
  overflow: "hidden",
  transition: "width .22s ease,background-color .18s ease,border-color .18s ease",
  zIndex: 40,
};

const topHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 86,
  background: "var(--pf-sidebar-highlight)",
  pointerEvents: "none",
};

const toggleButton = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--pf-sidebar-border)",
  background: "var(--pf-sidebar-control)",
  color: "var(--pf-text-muted)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const menuTitle = {
  margin: 0,
  paddingLeft: 5,
  fontWeight: 850,
  fontSize: 10,
  color: "var(--pf-sidebar-muted)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
};

const toggleRow = {
  display: "flex",
  alignItems: "center",
  marginBottom: 15,
  minHeight: 28,
};

const icon = {
  width: 20,
  minWidth: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: .96,
  color: "inherit",
};

const divider = {
  height: 1,
  background: "var(--pf-sidebar-divider)",
  marginTop: 20,
};

const smallDivider = {
  height: 1,
  background: "var(--pf-sidebar-divider)",
  margin: "9px 0 11px",
};

const logoSection = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  paddingLeft: 3,
  position: "relative",
  zIndex: 1,
};

const logoIcon = {
  width: 36,
  height: 36,
  borderRadius: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 950,
  fontSize: 16,
  boxShadow: "0 8px 18px rgba(37,99,235,.24)",
};

const logoTitle = {
  color: "var(--pf-text-strong)",
  fontWeight: 950,
  fontSize: 14,
  letterSpacing: .9,
};

const logoSub = {
  color: "var(--pf-sidebar-muted)",
  fontSize: 10.5,
  fontWeight: 650,
  marginTop: 2,
};

export default Sidebar;
