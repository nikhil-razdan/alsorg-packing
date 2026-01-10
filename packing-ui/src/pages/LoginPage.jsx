import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password");
        return;
      }

      localStorage.setItem("auth", "true");
      navigate("/");
    } catch {
      setError("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      {/* BACKGROUND TEXT */}
      <div style={backgroundText}>Alsorg</div>

      {/* LEFT CONTENT */}
      <div style={leftPanel}>
        <img
          src="/logo/images (1).png"
          alt="Alsorg Logo"
          style={logoStyle}
        />

        <div style={contentBlock}>
          <span style={badge}>Inventory Management Platform</span>

          <h1 style={title}>
            Inventory Management
            <br />
            <span style={titleAccent}>Made Intelligent</span>
          </h1>

          <p style={description}>
            A centralized system designed to simplify stock tracking, optimize
            decision-making, and give teams complete visibility across their
            inventory lifecycle.
          </p>

          <div style={divider} />

          <h2 style={subtitle}>What’s new </h2>

          <p style={descriptionMuted}>
            Advanced analytics powered by historical trends help organizations
            reduce waste, forecast demand accurately, and scale operations with
            confidence — even as complexity grows.
          </p>
        </div>
      </div>

      {/* RIGHT LOGIN CARD */}
      <div style={rightPanel}>
        <div style={glassCard}>
          <div style={cardHighlight} />

          <h3 style={cardTitle}>Welcome back</h3>
          <p style={cardSubtitle}>Log in to continue</p>

          <form onSubmit={submit}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={glassInput}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={glassInput}
            />

            {error && <p style={errorText}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.8 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Proceed to my Account →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
  background: "linear-gradient(135deg, #f5c542 0%, #b8860b 100%)",
  position: "relative",
  overflow: "hidden",
};

const backgroundText = {
  position: "absolute",
  fontSize: 220,
  fontWeight: 900,
  color: "rgba(255,255,255,0.12)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  letterSpacing: "-6px",
  pointerEvents: "none",
  userSelect: "none",
};

const leftPanel = {
  flex: 1,
  padding: "60px 80px",
  color: "#fff",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
};

const contentBlock = {
  maxWidth: 520,
};

const logoStyle = {
  height: 48,
  position: "absolute",
  top: 30,
  left: 80,
};

const badge = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: 20,
  background: "rgba(255,255,255,0.2)",
  backdropFilter: "blur(8px)",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: 0.4,
  marginBottom: 18,
};

const title = {
  fontSize: 42,
  fontWeight: 800,
  lineHeight: 1.15,
  marginBottom: 22,
};

const titleAccent = {
  color: "rgba(255,255,255,0.85)",
  fontWeight: 700,
};

const subtitle = {
  fontSize: 22,
  fontWeight: 600,
  marginBottom: 12,
};

const description = {
  lineHeight: 1.75,
  fontSize: 15.5,
  opacity: 0.95,
};

const descriptionMuted = {
  ...description,
  opacity: 0.85,
};

const divider = {
  height: 1,
  width: 120,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.6), transparent)",
  margin: "34px 0",
};

const rightPanel = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
};

const glassCard = {
  position: "relative",
  width: 420,
  padding: 42,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    "0 30px 70px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)",
  overflow: "hidden",
};

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 80,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.45), transparent)",
};

const cardTitle = {
  color: "#fff",
  marginBottom: 6,
  fontSize: 24,
  fontWeight: 600,
};

const cardSubtitle = {
  color: "rgba(255,255,255,0.85)",
  marginBottom: 26,
};

const glassInput = {
  width: "100%",
  padding: "13px 15px",
  marginBottom: 16,
  borderRadius: 10,
  border: "none",
  outline: "none",
  fontSize: 14,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))",
  boxShadow:
    "inset 0 1px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.6)",
};

const buttonStyle = {
  width: "100%",
  marginTop: 22,
  padding: "14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(180deg, #111, #000)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 15,
  boxShadow:
    "0 10px 25px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
};

const errorText = {
  color: "#ffe1e1",
  fontSize: 14,
  marginTop: 4,
};

export default LoginPage;
