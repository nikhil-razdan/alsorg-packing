function InventorySidebar({
  section,
  setSection,
}) {
const items = [
  {
    key: "summary",
    label: "Overview",
    icon: "📊",
  },

  {
    key: "traceability",
    label: "Traceability",
    icon: "🧭",
  },

  {
    key: "reports",
    label: "Reports",
    icon: "📑",
  },

  {
    key: "analytics",
    label: "Analytics",
    icon: "📈",
  },

  {
    key: "alerts",
    label: "Alerts",
    icon: "🚨",
  },
];

  return (
    <div style={sidebar}>
      <div style={logo}>
        INVENTORY
      </div>

      <div style={nav}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() =>
              setSection(item.key)
            }
            style={navBtn(
              section === item.key
            )}
          >
            <span>{item.icon}</span>

            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const sidebar = {
  width: 220,
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  background: "linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
  border: "1px solid var(--pf-border)",
  height: "fit-content",
  position: "sticky",
  top: 16,
  boxShadow: "0 8px 22px rgba(var(--pf-shadow-rgb),.06)",
  color: "var(--pf-text-strong)",
};

const logo = {
  color: "var(--pf-text-strong)",
  fontSize: 16,
  fontWeight: 950,
  marginBottom: 16,
  letterSpacing: ".08em",
};

const nav = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const navBtn = (active) => ({
  minHeight: 44,
  borderRadius: 11,
  border: active
    ? "1px solid rgba(37,99,235,.28)"
    : "1px solid transparent",
  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "transparent",
  color: active ? "#fff" : "var(--pf-text)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 800,
  transition: "all .18s ease",
});

export default InventorySidebar;
