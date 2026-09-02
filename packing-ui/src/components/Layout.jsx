import {
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";

import Header from "./Header";
import { useAuth } from "../auth/AuthContext";
import { usePackFlowTheme } from "../theme/PackFlowThemeContext";
import {
  canOpenWarehousePageFromUser,
} from "../utils/permissions";

const NAV_COLLAPSE_KEY =
  "packflow:navigation-collapsed:v1";

const pageKeyFromPath = (pathname) => {
  const path = String(pathname || "").toLowerCase();

  if (path.includes("/dashboard")) return "dashboard";
  if (path.includes("/zoho-items")) return "inventory";
  if (path.includes("/warehouse")) return "warehouse";
  if (
    path.includes("/dispatched-items") ||
    path.includes("/dispatch")
  ) {
    return "dispatch";
  }
  if (path.includes("/logistics")) return "logistics";

  return "workspace";
};

const readInitialCollapsed = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored =
      window.sessionStorage.getItem(
        NAV_COLLAPSE_KEY
      );

    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // UI preference only. Ignore unavailable storage.
  }

  return window.innerWidth < 1120;
};

function PackFlowNavigation({
  collapsed,
  onToggle,
}) {
  const location = useLocation();
  const { isDark } = usePackFlowTheme();

  const {
    user,
    hasRole,
    hasAnyRole,
  } = useAuth();

  const isDirector =
    hasRole("PACKFLOW_DIRECTOR");

  const canOpenDashboard =
    hasAnyRole(
      "ADMIN",
      "PACKFLOW_DIRECTOR"
    );

  /*
   * UTL_PACKING receives the same Inventory page shell, but ZohoItemsPage
   * switches all packet calls to the isolated /api/utl/packets boundary.
   */
  const canOpenNormalInventory =
    hasAnyRole(
      "ADMIN",
      "PACKING",
      "UTL_PACKING"
    );

  const canOpenHardwareInventory =
    hasAnyRole(
      "ADMIN",
      "HARDWARE_PACKING"
    );

  const canOpenWarehouse =
    canOpenWarehousePageFromUser(user);

  const canOpenDispatch =
    hasAnyRole(
      "ADMIN",
      "DISPATCH",
      "UTL_DISPATCH",
      "WAREHOUSE",
      "PACKING",
      "UTL_PACKING",
      "HARDWARE_PACKING"
    );

  const canOpenLogistics =
    hasAnyRole("ADMIN", "LOGISTICS");

  const requestedInventoryView =
    String(
      new URLSearchParams(
        location.search
      ).get("view") || ""
    )
      .trim()
      .toLowerCase();

  const currentInventoryView =
    requestedInventoryView === "hardware" &&
    canOpenHardwareInventory
      ? "hardware"
      : requestedInventoryView === "normal" &&
          canOpenNormalInventory
        ? "normal"
        : canOpenNormalInventory
          ? "normal"
          : "hardware";

  const links = useMemo(
    () => [
      {
        key: "dashboard",
        path: "/packflow/dashboard",
        label: isDirector
          ? "Executive Dashboard"
          : "Dashboard",
        visible: canOpenDashboard,
        icon: (
          <DashboardOutlinedIcon fontSize="small" />
        ),
      },
      {
        key: "normal-inventory",
        path: "/packflow/zoho-items",
        view: "normal",
        label: "Inventory Items",
        visible: canOpenNormalInventory,
        icon: (
          <Inventory2OutlinedIcon fontSize="small" />
        ),
      },
      {
        key: "hardware-inventory",
        path: "/packflow/zoho-items",
        view: "hardware",
        label: "Hardware Packets",
        visible: canOpenHardwareInventory,
        icon: (
          <Inventory2OutlinedIcon fontSize="small" />
        ),
      },
      {
        key: "warehouse",
        path: "/packflow/warehouse",
        label: "Warehouse",
        visible: canOpenWarehouse,
        icon: (
          <WarehouseOutlinedIcon fontSize="small" />
        ),
      },
      {
        key: "dispatch",
        path: "/packflow/dispatched-items",
        label: "Dispatched Items",
        visible: canOpenDispatch,
        icon: (
          <LocalShippingOutlinedIcon fontSize="small" />
        ),
      },
      {
        key: "logistics",
        path: "/packflow/logistics",
        label: "Logistics",
        visible: canOpenLogistics,
        icon: (
          <AltRouteOutlinedIcon fontSize="small" />
        ),
      },
    ],
    [
      canOpenDashboard,
      canOpenDispatch,
      canOpenHardwareInventory,
      canOpenLogistics,
      canOpenNormalInventory,
      canOpenWarehouse,
      isDirector,
    ]
  );

  const visibleLinks =
    links.filter((link) => link.visible);

  const linkStyle = (active) => ({
    minWidth: 0,
    minHeight: 42,
    marginBottom: 4,
    padding: collapsed
      ? "9px 8px"
      : "9px 11px",
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed
      ? "center"
      : "flex-start",
    gap: collapsed ? 0 : 12,
    textDecoration: "none",
    overflow: "hidden",
    whiteSpace: "nowrap",
    fontSize: 12.5,
    fontWeight: active ? 900 : 780,
    color: active
      ? isDark
        ? "#dbeafe"
        : "#1d4ed8"
      : "var(--pf-sidebar-text)",
    background: active
      ? isDark
        ? "rgba(59,130,246,.17)"
        : "rgba(59,130,246,.085)"
      : "transparent",
    border: active
      ? "1px solid rgba(59,130,246,.20)"
      : "1px solid transparent",
    boxShadow: active
      ? isDark
        ? "inset 3px 0 0 #60a5fa"
        : "inset 3px 0 0 #2563eb"
      : "none",
    transition:
      "background .16s ease,border-color .16s ease,color .16s ease",
  });

  return (
    <aside
      className="packflow-sidebar packflow-integrated-navigation"
      style={navigation}
      aria-label="PackFlow navigation"
    >
      <div style={topHighlight} />

      <div
        style={{
          ...logoSection,
          justifyContent: collapsed
            ? "center"
            : "flex-start",
        }}
      >
        <div style={logoIcon}>A</div>

        {!collapsed && (
          <div style={brandTextWrap}>
            <div style={logoTitle}>ALSORG</div>
            <div style={logoSub}>PackFlow</div>
          </div>
        )}
      </div>

      <div
        style={{
          ...toggleRow,
          justifyContent: collapsed
            ? "center"
            : "space-between",
        }}
      >
        {!collapsed && (
          <div style={menuTitle}>Menu</div>
        )}

        <button
          type="button"
          onClick={onToggle}
          style={toggleButton}
          title={
            collapsed
              ? "Expand navigation"
              : "Collapse navigation"
          }
          aria-label={
            collapsed
              ? "Expand navigation"
              : "Collapse navigation"
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <Link
        to="/modules"
        title={collapsed ? "All Modules" : undefined}
        style={linkStyle(
          location.pathname === "/modules"
        )}
      >
        <span style={navIcon}>
          <AppsOutlinedIcon fontSize="small" />
        </span>
        {!collapsed && "All Modules"}
      </Link>

      <div style={smallDivider} />

      <nav style={navList}>
        {visibleLinks.map((link) => {
          const target = link.view
            ? `${link.path}?view=${link.view}`
            : link.path;

          const active = link.view
            ? location.pathname === link.path &&
              currentInventoryView === link.view
            : location.pathname === link.path ||
              location.pathname.startsWith(
                `${link.path}/`
              );

          return (
            <Link
              key={link.key}
              to={target}
              title={collapsed ? link.label : undefined}
              style={linkStyle(active)}
            >
              <span style={navIcon}>
                {link.icon}
              </span>
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ flexGrow: 1 }} />
      <div style={divider} />

      {!collapsed && (
        <div style={navigationFooter}>
          <span style={footerDot} />
          Secure workspace
        </div>
      )}
    </aside>
  );
}

function Layout() {
  const location = useLocation();
  const pageKey =
    pageKeyFromPath(location.pathname);

  const [collapsed, setCollapsed] =
    useState(readInitialCollapsed);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        NAV_COLLAPSE_KEY,
        collapsed ? "1" : "0"
      );
    } catch {
      // UI preference only.
    }
  }, [collapsed]);

  const padding =
    pageKey === "dashboard"
      ? "14px clamp(12px,1.5vw,22px) 24px"
      : pageKey === "logistics"
        ? "12px clamp(10px,1.2vw,18px) 24px"
        : "10px clamp(8px,1vw,14px) 22px";

  return (
    <div
      className={`packflow-theme-root packflow-page-${pageKey}`}
      data-packflow-page={pageKey}
      data-navigation-collapsed={
        collapsed ? "true" : "false"
      }
      style={shell(collapsed)}
    >
      <PackFlowNavigation
        collapsed={collapsed}
        onToggle={() =>
          setCollapsed((value) => !value)
        }
      />

      <div style={main}>
        <Header />

        <main
          className="packflow-workspace-scroll"
          style={{
            ...contentShell,
            padding,
          }}
        >
          <div style={contentInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const shell = (collapsed) => ({
  width: "100%",
  height: "100dvh",
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: collapsed
    ? "64px minmax(0,1fr)"
    : "210px minmax(0,1fr)",
  background: "var(--pf-bg)",
  color: "var(--pf-text-strong)",
  overflow: "hidden",
  transition:
    "grid-template-columns .22s cubic-bezier(.2,.8,.2,1)",
});

const main = {
  minWidth: 0,
  minHeight: 0,
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--pf-bg)",
};

const contentShell = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
  boxSizing: "border-box",
  background: `
    radial-gradient(circle at top left, rgba(59,130,246,.055), transparent 22%),
    radial-gradient(circle at bottom right, rgba(14,165,233,.04), transparent 24%),
    var(--pf-bg)
  `,
};

const contentInner = {
  width: "100%",
  minWidth: 0,
  minHeight: "100%",
};

const navigation = {
  width: "100%",
  height: "100dvh",
  minWidth: 0,
  minHeight: 0,
  padding: "16px 10px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  background: "var(--pf-sidebar-bg)",
  color: "var(--pf-sidebar-text)",
  borderRight:
    "1px solid var(--pf-sidebar-border)",
  zIndex: 40,
  contain: "layout paint",
};

const topHighlight = {
  position: "absolute",
  inset: "0 0 auto 0",
  height: 74,
  background:
    "linear-gradient(180deg,rgba(59,130,246,.045),transparent)",
  pointerEvents: "none",
};

const logoSection = {
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  paddingLeft: 2,
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
};

const logoIcon = {
  width: 34,
  minWidth: 34,
  height: 34,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 950,
  fontSize: 15,
  boxShadow:
    "0 6px 14px rgba(37,99,235,.18)",
};

const brandTextWrap = {
  minWidth: 0,
};

const logoTitle = {
  color: "var(--pf-text-strong)",
  fontWeight: 950,
  fontSize: 13.5,
  letterSpacing: .65,
};

const logoSub = {
  marginTop: 1,
  color: "var(--pf-sidebar-muted)",
  fontSize: 9.5,
  fontWeight: 700,
};

const toggleRow = {
  minHeight: 26,
  display: "flex",
  alignItems: "center",
  marginBottom: 12,
};

const toggleButton = {
  width: 26,
  minWidth: 26,
  height: 26,
  borderRadius: 8,
  border:
    "1px solid var(--pf-sidebar-border)",
  background:
    "var(--pf-sidebar-control)",
  color: "var(--pf-text-muted)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 17,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const menuTitle = {
  paddingLeft: 4,
  color: "var(--pf-sidebar-muted)",
  fontWeight: 900,
  fontSize: 9,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const navList = {
  minWidth: 0,
};

const navIcon = {
  width: 20,
  minWidth: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: .96,
  color: "inherit",
};

const smallDivider = {
  height: 1,
  flexShrink: 0,
  margin: "7px 0 9px",
  background:
    "var(--pf-sidebar-divider)",
};

const divider = {
  height: 1,
  flexShrink: 0,
  marginTop: 20,
  background:
    "var(--pf-sidebar-divider)",
};

const navigationFooter = {
  minHeight: 32,
  padding: "10px 4px 0",
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "var(--pf-sidebar-muted)",
  fontSize: 9.5,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const footerDot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 8px rgba(34,197,94,.38)",
};

export default Layout;
