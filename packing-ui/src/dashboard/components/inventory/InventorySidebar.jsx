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
      key: "warehouse",
      label: "Warehouse",
      icon: "🏭",
    },

    {
      key: "packing",
      label: "Packing",
      icon: "📦",
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
  width: 240,

  padding: 20,

  borderRadius: 28,

  background:
    "rgba(15,23,42,.78)",

  border:
    "1px solid rgba(255,255,255,.06)",

  height: "fit-content",

  position: "sticky",

  top: 16,

  backdropFilter: "blur(18px)",
};

const logo = {
  color: "#fff",

  fontSize: 20,

  fontWeight: 900,

  marginBottom: 24,

  letterSpacing: 1,
};

const nav = {
  display: "flex",

  flexDirection: "column",

  gap: 10,
};

const navBtn = (active) => ({
  height: 52,

  borderRadius: 18,

  border: active
    ? "1px solid rgba(59,130,246,.35)"
    : "1px solid transparent",

  background: active
    ? "linear-gradient(135deg,#2563eb,#3b82f6)"
    : "transparent",

  color: "#fff",

  display: "flex",

  alignItems: "center",

  gap: 12,

  padding: "0 16px",

  cursor: "pointer",

  fontWeight: 700,

  transition: "all .25s ease",
});

export default InventorySidebar;