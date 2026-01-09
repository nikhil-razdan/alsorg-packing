import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "16px", borderBottom: "1px solid #ddd", background: "#fff", display: "flex", justifyContent: "space-between" }}>
      <h2>Alsorg Inventory Platform</h2>

      <button
        onClick={() => {
          localStorage.removeItem("auth");
          navigate("/login");
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Header;
