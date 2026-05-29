import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const role = localStorage.getItem("role");

  const links = [
    {
      path: "/",
      label: "Dashboard",
      roles: [
        "ADMIN",
        "DISPATCH",
        "PACKING",
        "WAREHOUSE",
        "LOGISTICS",
      ],
      icon: "📊",
    },

    {
      path: "/zoho-items",
      label: "Inventory Items",
      roles: ["ADMIN", "PACKING"],
      icon: "📦",
    },

    {
      path: "/warehouse",
      label: "Warehouse",
      roles: [
        "ADMIN",
        "PACKING",
        "DISPATCH",
        "WAREHOUSE",
      ],
      icon: "🏭",
    },

    {
      path: "/dispatched-items",
      label: "Dispatched Items",
      roles: [
        "ADMIN",
        "PACKING",
        "DISPATCH",
        "WAREHOUSE",
      ],
      icon: "🚚",
    },

    {
      path: "/logistics",
      label: "Logistics ERP",
      roles: [
        "ADMIN",
        "LOGISTICS",
      ],
      icon: "🚛",
    },

    {
      path: "/users",
      label: "User Management",
      roles: ["ADMIN"],
      icon: "👤",
    },
  ];

  const visibleLinks = links.filter(link =>
      link.roles.includes(role)
    );
	

	const linkStyle = (active) => ({
	  display: "flex",

	  alignItems: "center",

	  gap: collapsed ? 0 : 14,

	  padding: "11px 14px",

	  marginBottom: 6,

	  borderRadius: 14,

	  textDecoration: "none",

	  fontWeight: 700,

	  fontSize: 14,

	  color: active
	    ? "#fff"
	    : "rgba(255,255,255,.72)",

	  background: active
	    ? "linear-gradient(135deg,#1d4ed8,#2563eb)"
	    : "transparent",

	  border: active
	    ? "1px solid rgba(59,130,246,.35)"
	    : "1px solid transparent",

	  boxShadow: active
	    ? "0 6px 18px rgba(37,99,235,.18)"
	    : "none",

	  transition: "all .22s ease",

	  justifyContent:
	    collapsed
	      ? "center"
	      : "flex-start",
	});

  return (
    <div
      style={{
        ...sidebar,
        width: collapsed ? 64 : 210,
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
	  
	  <div style={logoSection}>
	    <div style={logoIcon}>
	      ALSORG
	    </div>

	    
	  </div>

      {!collapsed && <h4 style={menuTitle}>Menu</h4>}

      {/* Links */}
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

/* ===================== STYLES ===================== */

const sidebar = {
  width: 220,

  height: "100vh",

  padding: "22px 14px",

  boxSizing: "border-box",

  display: "flex",

  flexDirection: "column",

  position: "relative",

  background:
    "linear-gradient(180deg,#071120 0%,#0a162b 100%)",

  borderRight:
    "1px solid rgba(255,255,255,.06)",

  boxShadow:
    "8px 0 30px rgba(2,6,23,.45)",

  overflow: "hidden",

  transition: "width .25s ease",
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

  top: 16,

  right: 10,

  width: 24,

  height: 24,

  borderRadius: 8,

  border:
    "1px solid rgba(255,255,255,.08)",

  background:
    "rgba(255,255,255,.04)",

  color: "#94a3b8",

  cursor: "pointer",

  fontWeight: 700,

  transition: "all .2s ease",
};

const menuTitle = {
  marginBottom: 26,
  paddingLeft: 6,
  fontWeight: 700,
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: "0.12em",
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

const logoSection = {
  display: "flex",

  alignItems: "center",

  gap: 14,

  marginBottom: 32,

  paddingLeft: 4,
};

const logoIcon = {
  width: 36,

  height: 36,

  borderRadius: 14,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 900,

  fontSize: 16,

  boxShadow:
    "0 10px 24px rgba(37,99,235,.35)",
};

const logoTitle = {
  color: "#fff",

  fontWeight: 900,

  fontSize: 15,

  letterSpacing: 1,
};

const logoSub = {
  color: "rgba(255,255,255,.45)",

  fontSize: 11,

  marginTop: 2,
};

export default Sidebar;
