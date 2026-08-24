import { createContext, useContext, useEffect, useMemo, useState } from "react";

const MODE_KEY = "machflow-color-mode";
const MATFLOW_MODE_KEY = "matflow-color-mode";
const MachFlowThemeContext = createContext(null);

const readMode = () => {
  if (typeof window === "undefined") return "dark";
  const own = window.localStorage.getItem(MODE_KEY);
  if (own === "dark" || own === "light") return own;
  const matFlowMode = window.localStorage.getItem(MATFLOW_MODE_KEY);
  if (matFlowMode === "dark" || matFlowMode === "light") return matFlowMode;
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
};

const variables = (mode) => {
  const dark = mode === "dark";
  return {
    "--mf-page-bg": dark ? "#07111f" : "#f6f9fe",
    "--mf-panel-bg": dark ? "#0d1b2e" : "#ffffff",
    "--mf-panel-solid": dark ? "#0d1b2e" : "#ffffff",
    "--mf-surface": dark ? "#111f33" : "#f8fbff",
    "--mf-soft-surface": dark ? "#111f33" : "#f8fbff",
    "--mf-surface-strong": dark ? "#14243a" : "#f1f5fb",
    "--mf-field-bg": dark ? "#0a1728" : "#ffffff",
    "--mf-hover": dark ? "#112b45" : "#edf5ff",
    "--mf-text": dark ? "#f8fafc" : "#172033",
    "--mf-text-secondary": dark ? "rgba(248,250,252,.70)" : "#55627a",
    "--mf-text-muted": dark ? "rgba(248,250,252,.48)" : "#8a96aa",
    "--mf-border": dark ? "rgba(148,163,184,.16)" : "#dbe5f1",
    "--mf-border-strong": dark ? "rgba(148,163,184,.28)" : "#c8d6e8",
    "--mf-shadow": dark
      ? "0 12px 30px rgba(2,6,23,.34),0 2px 8px rgba(2,6,23,.20)"
      : "0 10px 28px rgba(15,23,42,.075),0 2px 8px rgba(15,23,42,.035)",

    "--mf-card-bg": dark ? "#0d1b2e" : "#ffffff",
    "--mf-card-bg-elevated": dark ? "#102139" : "#ffffff",
    "--mf-card-border": dark ? "rgba(148,163,184,.18)" : "#d7e2ef",
    "--mf-card-border-hover": dark ? "rgba(96,165,250,.34)" : "#bfd1e6",
    "--mf-card-shadow": dark
      ? "0 12px 28px rgba(2,6,23,.32),0 2px 7px rgba(2,6,23,.18)"
      : "0 10px 26px rgba(15,23,42,.075),0 2px 7px rgba(15,23,42,.035)",

    "--mf-primary": dark ? "#0ea5e9" : "#3b82f6",
    "--mf-primary-hover": dark ? "#0284c7" : "#2563eb",
    "--mf-primary-soft": dark ? "rgba(14,165,233,.13)" : "#edf4ff",
    "--mf-primary-border": dark ? "rgba(14,165,233,.24)" : "#d7e6ff",
    "--mf-primary-text": dark ? "#7dd3fc" : "#2f6fed",
    "--mf-success-text": dark ? "#4ade80" : "#16834a",
    "--mf-success-soft": dark ? "rgba(34,197,94,.13)" : "#eaf8f0",
    "--mf-success-border": dark ? "rgba(34,197,94,.24)" : "#ccefd9",
    "--mf-warning-text": dark ? "#fbbf24" : "#b56a08",
    "--mf-warning-soft": dark ? "rgba(245,158,11,.13)" : "#fff7e8",
    "--mf-warning-border": dark ? "rgba(245,158,11,.24)" : "#f8dfae",
    "--mf-danger-text": dark ? "#fca5a5" : "#c33f45",
    "--mf-danger-soft": dark ? "rgba(239,68,68,.13)" : "#fff0f1",
    "--mf-danger-border": dark ? "rgba(239,68,68,.24)" : "#f6d2d5",
    "--mf-purple-text": dark ? "#c4b5fd" : "#7356c9",
    "--mf-purple-soft": dark ? "rgba(139,92,246,.13)" : "#f3efff",
    "--mf-purple-border": dark ? "rgba(139,92,246,.24)" : "#e1d8ff",

    "--mf-sidebar-bg": dark
      ? "linear-gradient(180deg,#06111f,#081629)"
      : "#ffffff",
    "--mf-header-bg": dark
      ? "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))"
      : "rgba(255,255,255,.96)",
    "--mf-hero-bg": dark
      ? "radial-gradient(circle at top left,rgba(14,165,233,.20),transparent 34%),linear-gradient(180deg,rgba(15,23,42,.94),rgba(15,23,42,.80))"
      : "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
    "--mf-table-head": dark ? "#0a1728" : "#f3f7fc",
    "--mf-table-row": dark ? "#0d1b2e" : "#ffffff",
    "--mf-table-hover": dark ? "#112b45" : "#f2f7ff",

    "--mf-overlay": dark ? "rgba(2,6,23,.76)" : "rgba(15,23,42,.42)",
    "--mf-modal-title-bg": dark
      ? "linear-gradient(180deg,rgba(30,41,59,.98),rgba(15,23,42,.98))"
      : "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
    "--mf-modal-shadow": dark
      ? "0 28px 80px rgba(0,0,0,.52),0 8px 26px rgba(2,6,23,.32)"
      : "0 28px 80px rgba(15,23,42,.22),0 8px 24px rgba(39,71,117,.10)",
    "--mf-popover-shadow": dark
      ? "0 18px 48px rgba(0,0,0,.38)"
      : "0 16px 38px rgba(15,23,42,.15)",

    "--mf-scroll-track": dark ? "rgba(255,255,255,.025)" : "rgba(15,23,42,.035)",
    "--mf-scroll-thumb": dark ? "rgba(96,165,250,.46)" : "rgba(59,130,246,.42)",
    "--mf-scroll-thumb-hover": dark ? "rgba(125,211,252,.78)" : "rgba(37,99,235,.68)",
    "--mf-scroll-corner": dark ? "#081424" : "#eef3f9",
    "--mf-pagination-bg": dark ? "#0a1728" : "#f7faff",
  };
};

export function MachFlowThemeProvider({ children }) {
  const [mode, setMode] = useState(readMode);
  const cssVars = useMemo(() => variables(mode), [mode]);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = cssVars["--mf-page-bg"];
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [cssVars]);

  const value = useMemo(() => ({
    mode,
    isDark: mode === "dark",
    toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark")),
    setMode,
  }), [mode]);

  return (
    <MachFlowThemeContext.Provider value={value}>
      <div className="mf-theme-root" style={cssVars} data-machflow-mode={mode}>
        {children}
      </div>
    </MachFlowThemeContext.Provider>
  );
}

export function useMachFlowTheme() {
  const value = useContext(MachFlowThemeContext);
  if (!value) {
    throw new Error("useMachFlowTheme must be used inside MachFlowThemeProvider");
  }
  return value;
}
