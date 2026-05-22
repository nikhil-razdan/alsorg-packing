import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const role = localStorage.getItem("role");

  const links = [
    { path: "/", label: "Dashboard", roles: ["ADMIN", "DISPATCH", "PACKING"], icon: "📊" },
    { path: "/zoho-items", label: "Inventory Items", roles: ["ADMIN", "PACKING"], icon: "📦" },
    { path: "/warehouse", label: "Warehouse", roles: ["ADMIN", "PACKING", "DISPATCH"], icon: "🏭" },
    { path: "/dispatched-items", label: "Dispatched Items", roles: ["ADMIN", "PACKING", "DISPATCH"], icon: "🚚" },
    { path: "/users", label: "User Management", roles: ["ADMIN"], icon: "👤" },
  ];

  const visibleLinks = links.filter((link) => link.roles.includes(role));

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 12,
    padding: "10px 14px",
    marginBottom: 8,
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 14,
    color: active ? "#111827" : "#e5e7eb",
    background: active ? "#ffffff" : "transparent",
    transition: "all 0.2s ease",
    justifyContent: collapsed ? "center" : "flex-start",
  });

  return (
    <div style={{ ...sidebar, width: collapsed ? 72 : 240 }}>
      <div style={topHighlight} />

      <button onClick={() => setCollapsed((v) => !v)} style={toggleButton}>
        {collapsed ? "›" : "‹"}
      </button>

      {!collapsed && <h4 style={menuTitle}>Menu</h4>}

      {visibleLinks.map((link) => {
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

const sidebar = {
  height: "100vh",
  padding: "20px 12px",
  display: "flex",
  flexDirection: "column",
  background: "#1e293b",
  color: "#fff",
  transition: "width 0.3s ease",
};

const topHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 90,
  background: "linear-gradient(180deg, rgba(255,255,255,0.16), transparent)",
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
  background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76))",
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
  background: "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
  marginTop: 24,
};

export default Sidebar;