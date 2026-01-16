import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const linkStyle = (path) => {
    const active = location.pathname === path;

    return {
      display: "flex",
      alignItems: "center",
      gap: collapsed ? "0px" : "12px",
      padding: "12px 16px",
      marginBottom: "10px",
      borderRadius: "12px",
      textDecoration: "none",
      fontWeight: 600,
      fontSize: 14,
      color: active ? "#111827" : "rgba(255,255,255,0.85)",
      background: active
        ? "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))"
        : "rgba(255,255,255,0.06)",
      boxShadow: active
        ? "0 8px 25px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)"
        : "inset 0 1px 0 rgba(255,255,255,0.08)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transition: "all 0.25s ease",
      justifyContent: collapsed ? "center" : "flex-start",
    };
  };

  return (
    <div
      style={{
        ...sidebar,
        width: collapsed ? 72 : 240,
      }}
    >
      {/* Glass highlight */}
      <div style={topHighlight} />

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={toggleButton}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {/* Title */}
      {!collapsed && <h4 style={menuTitle}>Menu</h4>}

      {/* Links */}
      <Link to="/" style={linkStyle("/")}>
        <span style={icon}>📊</span>
        {!collapsed && "Dashboard"}
      </Link>

      <Link to="/zoho-items" style={linkStyle("/zoho-items")}>
        <span style={icon}>📦</span>
        {!collapsed && "Inventory Items"}
      </Link>
	  
	  <Link to="/zoho-items" style={linkStyle("/zoho-items")}>
	          <span style={icon}>📦</span>
	          {!collapsed && "Dispatched Items"}
	        </Link>

      {/* Spacer */}
      <div style={{ flexGrow: 1 }} />

      {/* Footer divider */}
      <div style={divider} />
    </div>
  );
}

/* ===================== STYLES ===================== */

const sidebar = {
  height: "100vh",
  padding: "26px 12px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  background:
    "linear-gradient(180deg, rgba(31,41,55,0.85), rgba(17,24,39,0.85))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    "6px 0 30px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.08)",
  overflow: "hidden",
  transition: "width 0.3s ease",
};

const topHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 90,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)",
  pointerEvents: "none",
};

const toggleButton = {
  position: "absolute",
  top: 8,
  right: 3,
  width: 23,
  height: 17,
  borderRadius: "50%",
  border: "none",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))",
  boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
  cursor: "pointer",
  fontWeight: 700,
  color: "#111827",
};

const menuTitle = {
  marginBottom: 28,
  paddingLeft: 6,
  fontWeight: 700,
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const icon = {
  fontSize: 16,
  opacity: 0.9,
};

const divider = {
  height: 1,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)",
  marginTop: 24,
};

export default Sidebar;
