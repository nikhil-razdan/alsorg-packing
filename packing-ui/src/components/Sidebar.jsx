import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const location = useLocation();

  const linkStyle = (path) => ({
    padding: "8px 0",
    cursor: "pointer",
    fontWeight: location.pathname === path ? "bold" : "normal",
    color: location.pathname === path ? "#1976d2" : "#000",
    textDecoration: "none",
    display: "block",
  });

  return (
    <div
      style={{
        width: "220px",
        borderRight: "1px solid #ddd",
        padding: "16px",
        background: "#fafafa",
        height: "100%",
      }}
    >
      <h4 style={{ marginBottom: 16 }}>Menu</h4>

      <Link to="/" style={linkStyle("/")}>
        Dashboard
      </Link>

      <Link to="/zoho-items" style={linkStyle("/zoho-items")}>
        Zoho Items
      </Link>
    </div>
  );
}

export default Sidebar;
