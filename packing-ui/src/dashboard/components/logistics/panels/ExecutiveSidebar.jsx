function ExecutiveSidebar({
  section,
  setSection,
}) {
  const items = [
    {
      key: "summary",
      label: "Executive Summary",
    },

    {
      key: "drivers",
      label: "Driver Performance",
    },

    {
      key: "vehicles",
      label: "Vehicle Utilization",
    },

    {
      key: "operations",
      label: "Operations Intelligence",
    },

    {
      key: "alerts",
      label: "Alerts & Insights",
    },

    {
      key: "routes",
      label: "Route Analysis",
    },
  ];

  return (
    <div style={sidebar}>
      <div style={logo}>
        🚚 Logistics IQ
      </div>

      {items.map((item) => (
        <button
          key={item.key}
          onClick={() =>
            setSection(item.key)
          }
          style={{
            ...navBtn,

            background:
              section === item.key
                ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                : "transparent",

            border:
              section === item.key
                ? "1px solid rgba(59,130,246,.4)"
                : "1px solid rgba(255,255,255,.05)",
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const sidebar = {
  width: 260,
  background:
    "rgba(15,23,42,.75)",

  border:
    "1px solid rgba(255,255,255,.06)",

  borderRadius: 24,

  padding: 18,

  display: "flex",

  flexDirection: "column",

  gap: 12,
};

const logo = {
  color: "#fff",

  fontSize: 24,

  fontWeight: 900,

  marginBottom: 10,
};

const navBtn = {
  height: 58,

  borderRadius: 16,

  border: "none",

  color: "#fff",

  cursor: "pointer",

  fontWeight: 700,

  background: "transparent",

  transition: "all .25s ease",
};

export default ExecutiveSidebar;