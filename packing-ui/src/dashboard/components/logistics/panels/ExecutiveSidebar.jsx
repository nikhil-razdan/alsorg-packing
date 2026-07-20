function ExecutiveSidebar({
  section,
  setSection,
}) {
  const items = [
    {
      key: "summary",
      icon: "◉",
      label: "Unified Summary",
    },
    {
      key: "dispatch",
      icon: "📄",
      label: "Dispatch Challans",
    },
    {
      key: "drivers",
      icon: "👤",
      label: "Driver Operations",
    },
    {
      key: "vehicles",
      icon: "🚚",
      label: "Vehicle Utilization",
    },
    {
      key: "manual",
      icon: "🛣️",
      label: "Manual / Legacy",
    },
    {
      key: "resources",
      icon: "⛽",
      label: "Resource Analytics",
    },
    {
      key: "alerts",
      icon: "⚠️",
      label: "Operational Attention",
    },
    {
      key: "routes",
      icon: "📍",
      label: "Manual Routes",
    },
  ];

  return (
    <div style={sidebar}>
      <div style={logo}>
        LOGISTICS
      </div>

      {items.map((item) => {
        const active =
          section === item.key;

        return (
          <button
            type="button"
            key={item.key}
            onClick={() =>
              setSection(item.key)
            }
            style={{
              ...navBtn,

              background: active
                ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                : "rgba(255,255,255,.025)",

              border: active
                ? "1px solid rgba(96,165,250,.42)"
                : "1px solid rgba(255,255,255,.055)",

              boxShadow: active
                ? "0 12px 28px rgba(37,99,235,.22)"
                : "none",
            }}
          >
            <span style={navIcon}>
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const sidebar = {
  width: 245,
  flexShrink: 0,
  background:
    "rgba(15,23,42,.75)",
  border:
    "1px solid rgba(255,255,255,.06)",
  borderRadius: 24,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 9,
  position: "sticky",
  top: 18,
};

const logo = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  marginBottom: 2,
};

const navBtn = {
  minHeight: 48,
  borderRadius: 14,
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  background: "transparent",
  transition: "all .2s ease",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 13px",
  textAlign: "left",
};

const navIcon = {
  width: 23,
  display: "inline-flex",
  justifyContent: "center",
};

export default ExecutiveSidebar;