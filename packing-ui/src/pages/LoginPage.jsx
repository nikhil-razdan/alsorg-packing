import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  PackFlowThemeBoundary,
  usePackFlowTheme,
} from "../theme/PackFlowThemeContext";

function LoginPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loadMe } = useAuth();
  const { mode, toggleTheme } = usePackFlowTheme();

  const submit = async (e) => {
	e.preventDefault();
	setError(null);
	setLoading(true);

	try {
		await API.post("/auth/login", {
			username: username.trim(),
			password,
		});

		const session =
			await loadMe();

		if (!session) {
			throw new Error(
				"Login succeeded but the authenticated session could not be established."
			);
		}

		navigate("/modules", { replace: true });
	} catch (err) {
		const status = err?.response?.status;

		if (status === 429) {
			const retryAfter = Number(
				err?.response?.headers?.["retry-after"] || 0
			);

			const minutes =
				Number.isFinite(retryAfter) && retryAfter > 0
					? Math.max(1, Math.ceil(retryAfter / 60))
					: null;

			setError(
				minutes
					? `Too many login attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
					: "Too many login attempts. Try again later."
			);
		} else {
			setError(
				err?.response?.data?.message ||
				"Invalid username or password"
			);
		}
	} finally {
		setLoading(false);
	}
};

  return (
    <div style={pageStyle} className="packflow-theme-root">
      <button
        type="button"
        aria-label="Toggle appearance"
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggleTheme}
        style={appearanceToggle}
      >
        <span style={appearanceToggleIcon}>
          {mode === "dark" ? "☀" : "☾"}
        </span>
        {mode === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
      <div style={ambientGlowOne} />
      <div style={ambientGlowTwo} />
      <div style={backgroundText}>Alsorg</div>

      <div style={leftPanel}>
        <div style={brandRow}>
          <img src="/logo/images (1).png" alt="Alsorg Logo" style={logoStyle} />
        </div>

        <div style={contentBlock}>
          <span style={badge}>FlowSuite</span>

          <h1 style={title}>
            Operations Management
            <br />
            <span style={titleAccent}>Made Intelligent</span>
          </h1>

          <p style={description}>
            A centralized platform for PackFlow and BOMFlow, helping teams manage
            inventory, packing, dispatch, product BOM, costing and approval workflows
            from one secure login.
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
          <div style={topBar}>
            <div style={statusDot} />

            <span style={topBarText}>
              GLOBAL ACCESS PORTAL
            </span>
          </div>
          <h3 style={cardTitle}>Welcome back</h3>
          <p style={cardSubtitle}>Log in to continue</p>

          <form onSubmit={submit}>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={180}
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }

              onFocus={(e) => {
                e.target.style.border =
                  "1px solid rgba(59,130,246,.55)";
              }}

              onBlur={(e) => {
                e.target.style.border =
                  "1px solid rgba(var(--pf-fg-rgb),.08)";
              }}

              style={glassInput}
            />

            <input
              type="password"
              name="password"
              autoComplete="current-password"
              maxLength={512}
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }

              onFocus={(e) => {
                e.target.style.border =
                  "1px solid rgba(59,130,246,.55)";
              }}

              onBlur={(e) => {
                e.target.style.border =
                  "1px solid rgba(var(--pf-fg-rgb),.08)";
              }}

              style={glassInput}
            />

            {error && (
              <p
                style={errorText}
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.82 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Continue to Modules →"}
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

  position: "relative",

  overflow: "hidden",

  fontFamily:
    "Inter, system-ui, sans-serif",

  background: `
    radial-gradient(
      circle at top left,
      rgba(59,130,246,0.14),
      transparent 22%
    ),

    radial-gradient(
      circle at bottom right,
      rgba(14,165,233,0.10),
      transparent 24%
    ),

    linear-gradient(
      135deg,
      var(--pf-bg) 0%,
      var(--pf-surface) 45%,
      var(--pf-surface-alt) 100%
    )
  `,
};

const ambientGlowOne = {
  position: "absolute",

  top: -120,
  left: -120,

  width: 420,
  height: 420,

  borderRadius: "50%",

  background:
    "rgba(37,99,235,.18)",

  filter: "blur(100px)",

  pointerEvents: "none",
};

const ambientGlowTwo = {
  position: "absolute",

  right: -120,
  bottom: -120,

  width: 460,
  height: 460,

  borderRadius: "50%",

  background:
    "rgba(14,165,233,.14)",

  filter: "blur(110px)",

  pointerEvents: "none",
};

const backgroundText = {
  position: "absolute",

  fontSize: 240,

  fontWeight: 900,

  background:
    "linear-gradient(180deg, rgba(var(--pf-fg-rgb),0.06), rgba(var(--pf-fg-rgb),0.015))",

  WebkitBackgroundClip: "text",

  WebkitTextFillColor: "transparent",

  top: "50%",
  left: "50%",

  transform:
    "translate(-50%, -50%)",

  letterSpacing: 8,

  pointerEvents: "none",

  userSelect: "none",
};

const leftPanel = {
  flex: 1.1,

  padding: "72px 90px",

  color: "var(--pf-text-strong)",

  zIndex: 1,

  display: "flex",

  alignItems: "center",

  minWidth: 340,
};

const brandRow = {
  position: "absolute",

  top: 32,
  left: 36,
};

const contentBlock = {
  maxWidth: 560,
  marginTop: 28,
};

const logoStyle = {
  height: 56,

  display: "block",

  filter:
    "drop-shadow(0 10px 20px rgba(37,99,235,.25))",
};

const badge = {
  display: "inline-flex",

  alignItems: "center",

  height: 38,

  padding: "0 18px",

  borderRadius: 999,

  background:
    "rgba(37,99,235,.14)",

  border:
    "1px solid rgba(59,130,246,.22)",

  color: "#60a5fa",

  fontSize: 12,

  fontWeight: 800,

  letterSpacing: 1.2,

  marginBottom: 26,
};

const title = {
  fontSize: 58,

  fontWeight: 900,

  lineHeight: 1.02,

  marginBottom: 26,

  color: "var(--pf-text-strong)",

  letterSpacing: -2,
};

const titleAccent = {
  background:
    "linear-gradient(135deg,#60a5fa,#93c5fd)",

  WebkitBackgroundClip: "text",

  WebkitTextFillColor: "transparent",
};

const subtitle = {
  fontSize: 22,

  fontWeight: 800,

  marginBottom: 14,

  color: "var(--pf-text-strong)",
};

const description = {
  lineHeight: 1.9,

  fontSize: 16,

  color: "rgba(var(--pf-fg-rgb),.72)",

  maxWidth: 580,
};

const descriptionMuted = {
  ...description,

  color: "rgba(var(--pf-fg-rgb),.58)",
};

const divider = {
  height: 1,

  width: 180,

  background:
    "linear-gradient(90deg, rgba(59,130,246,.55), transparent)",

  margin: "40px 0",
};

const rightPanel = {
  flex: 0.9,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  zIndex: 1,

  minWidth: 340,

  padding: 32,
};

const glassCard = {
  position: "relative",

  width: "100%",

  maxWidth: 460,

  padding: 42,

  borderRadius: 30,

  background:
    "linear-gradient(180deg, rgba(var(--pf-surface-rgb),.92), rgba(var(--pf-surface-rgb),.84))",

  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",

  boxShadow:
    "0 30px 80px rgba(2,6,23,.55)",

  backdropFilter: "blur(18px)",

  overflow: "hidden",
};

const cardHighlight = {
  position: "absolute",

  top: 0,
  left: 0,
  right: 0,

  height: 120,

  background:
    "linear-gradient(180deg, rgba(59,130,246,.18), transparent)",

  pointerEvents: "none",
};

const cardTitle = {
  color: "var(--pf-text-strong)",

  marginBottom: 8,

  fontSize: 30,

  fontWeight: 900,
};

const cardSubtitle = {
  color: "rgba(var(--pf-fg-rgb),.55)",

  marginBottom: 30,

  fontWeight: 600,
};

const glassInput = {
  width: "100%",

  padding: "15px 18px",

  marginBottom: 18,

  borderRadius: 16,

  boxShadow:
    "inset 0 1px 1px rgba(var(--pf-fg-rgb),.04)",

  border:
    "1px solid rgba(var(--pf-fg-rgb),.08)",

  outline: "none",

  fontSize: 14,

  background:
    "rgba(var(--pf-fg-rgb),.04)",

  color: "var(--pf-text-strong)",

  transition: "all .2s ease",

  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",

  marginTop: 24,

  padding: "16px",

  borderRadius: 16,

  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 800,

  fontSize: 15,

  letterSpacing: 0.3,

  boxShadow:
    "0 18px 40px rgba(37,99,235,.35)",

  transition: "all .25s ease",
};

const errorText = {
  color: "#f87171",

  fontSize: 13,

  marginTop: 2,

  marginBottom: 8,

  fontWeight: 700,
};

const topBar = {
  display: "flex",

  alignItems: "center",

  gap: 10,

  marginBottom: 28,
};

const statusDot = {
  width: 10,
  height: 10,

  borderRadius: "50%",

  background: "#22c55e",

  boxShadow:
    "0 0 14px rgba(34,197,94,.85)",
};

const topBarText = {
  color: "rgba(var(--pf-fg-rgb),.55)",

  fontSize: 11,

  fontWeight: 800,

  letterSpacing: 1.5,
};

const appearanceToggle = {
  position: "absolute",
  top: 28,
  right: 30,
  zIndex: 5,
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--pf-border)",
  background: "rgba(var(--pf-surface-rgb),.78)",
  color: "var(--pf-text-strong)",
  boxShadow: "var(--pf-card-shadow)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 850,
};

const appearanceToggleIcon = {
  color: "#60a5fa",
  fontSize: 16,
  lineHeight: 1,
};

export default function LoginPage() {
  return (
    <PackFlowThemeBoundary>
      <LoginPageContent />
    </PackFlowThemeBoundary>
  );
}