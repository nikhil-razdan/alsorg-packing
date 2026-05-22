import { useState } from "react";
import API from "../services/api";
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
      const res = await API.post("/auth/login", { username, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("auth", "true");

      navigate("/", { replace: true });
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={ambientGlowOne} />
      <div style={ambientGlowTwo} />
      <div style={backgroundText}>Alsorg</div>

      <div style={leftPanel}>
        <div style={brandRow}>
          <img src="/logo/images (1).png" alt="Alsorg Logo" style={logoStyle} />
        </div>

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

          <h2 style={subtitle}>What’s new</h2>

          <p style={descriptionMuted}>
            Advanced analytics powered by historical trends help organizations
            reduce waste, forecast demand accurately, and scale operations with
            confidence.
          </p>
        </div>
      </div>

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
                opacity: loading ? 0.82 : 1,
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

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  flexWrap: "wrap",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 24%), radial-gradient(circle at bottom right, rgba(255,255,255,0.10), transparent 22%), linear-gradient(135deg, #cfe5ff 0%, #f4f8ff 45%, #d7e7ff 100%)",
  position: "relative",
  overflowX: "hidden",
  overflowY: "auto",
};

const ambientGlowOne = {
  position: "absolute",
  top: "-10%",
  left: "-8%",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(96,165,250,0.18)",
  filter: "blur(60px)",
  pointerEvents: "none",
};

const ambientGlowTwo = {
  position: "absolute",
  right: "-6%",
  bottom: "-10%",
  width: 460,
  height: 460,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.16)",
  filter: "blur(70px)",
  pointerEvents: "none",
};

const backgroundText = {
  position: "absolute",
  fontSize: 220,
  fontWeight: 900,
  color: "rgba(15,23,42,0.06)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  letterSpacing: "-6px",
  pointerEvents: "none",
  userSelect: "none",
};

const leftPanel = {
  flex: 1.15,
  padding: "64px 80px",
  color: "#0f172a",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  minWidth: 320,
};

const brandRow = {
  position: "absolute",
  top: 26,
  left: 26,
};

const contentBlock = {
  maxWidth: 560,
  marginTop: 28,
};

const logoStyle = {
  height: 54,
  display: "block",
};

const badge = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(12px)",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: 0.4,
  marginBottom: 18,
  border: "1px solid rgba(148,163,184,0.18)",
  color: "#1d4ed8",
};

const title = {
  fontSize: 44,
  fontWeight: 900,
  lineHeight: 1.08,
  marginBottom: 22,
  color: "#0f172a",
};

const titleAccent = {
  color: "#1d4ed8",
  fontWeight: 900,
};

const subtitle = {
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 12,
  color: "#0f172a",
};

const description = {
  lineHeight: 1.75,
  fontSize: 15.5,
  opacity: 0.9,
  color: "#334155",
};

const descriptionMuted = {
  ...description,
  opacity: 0.82,
};

const divider = {
  height: 1,
  width: 120,
  background: "linear-gradient(90deg, rgba(29,78,216,0.5), transparent)",
  margin: "34px 0",
};

const rightPanel = {
  flex: 0.95,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
  minWidth: 320,
  padding: 24,
};

const glassCard = {
  position: "relative",
  width: "100%",
  maxWidth: 430,
  padding: 42,
  borderRadius: 28,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.48))",
  backdropFilter: "blur(22px)",
  WebkitBackdropFilter: "blur(22px)",
  boxShadow:
    "0 30px 70px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.62)",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.45)",
};

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 100,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.16), transparent)",
  pointerEvents: "none",
};

const cardTitle = {
  color: "#0f172a",
  marginBottom: 6,
  fontSize: 26,
  fontWeight: 900,
};

const cardSubtitle = {
  color: "#64748b",
  marginBottom: 26,
  fontWeight: 600,
};

const glassInput = {
  width: "100%",
  padding: "13px 15px",
  marginBottom: 16,
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.24)",
  outline: "none",
  fontSize: 14,
  background: "rgba(255,255,255,0.96)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
  color: "#0f172a",
};

const buttonStyle = {
  width: "100%",
  marginTop: 22,
  padding: "14px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(180deg, #1d4ed8, #0f172a)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  boxShadow:
    "0 10px 25px rgba(29,78,216,0.24), inset 0 1px 0 rgba(255,255,255,0.12)",
};

const errorText = {
  color: "#dc2626",
  fontSize: 14,
  marginTop: 4,
  fontWeight: 600,
};

export default LoginPage;