import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const links = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/zoho-items", label: "Inventory Items", icon: "📦" },
    { path: "/dispatched-items", label: "Dispatched Items", icon: "🚚" },
  ];

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 12,
    padding: "12px 16px",
    marginBottom: 10,
    borderRadius: 14,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
    color: active ? "#111827" : "rgba(255,255,255,0.9)",
    background: active
      ? "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))"
      : "rgba(255,255,255,0.06)",
    boxShadow: active
      ? "inset 0 1px 0 rgba(255,255,255,0.65)"
      : "inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    transition: "background 0.25s ease, color 0.25s ease",
    justifyContent: collapsed ? "center" : "flex-start",
  });

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

      {!collapsed && <h4 style={menuTitle}>Menu</h4>}

      {/* Links */}
      {links.map((link) => {
        const active = location.pathname === link.path;
        return (
          <Link key={link.path} to={link.path} style={linkStyle(active)}>
            <span style={icon}>{link.icon}</span>
            {!collapsed && link.label}
          </Link>
        );
      })}

      <div style={{ flexGrow: 1 }} />
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
    "linear-gradient(180deg, rgba(31,41,55,0.9), rgba(17,24,39,0.9))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    "6px 0 28px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.08)",
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
    "linear-gradient(180deg, rgba(255,255,255,0.16), transparent)",
  pointerEvents: "none",
};

const toggleButton = {
  position: "absolute",
  top: 8,
  right: 4,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "none",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  cursor: "pointer",
  fontWeight: 700,
  color: "#111827",
};

const menuTitle = {
  marginBottom: 26,
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
    "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
  marginTop: 24,
};

export default Sidebar;
