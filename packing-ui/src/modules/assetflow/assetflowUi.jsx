import { createContext, useContext, useEffect, useMemo, useState } from "react";

const MODE_KEY = "assetflow-color-mode";
const MATFLOW_MODE_KEY = "matflow-color-mode";
const AssetFlowThemeContext = createContext(null);

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
    "--af-page-bg": dark ? "#07111f" : "#f6f9fe",
    "--af-panel-bg": dark ? "#0d1b2e" : "#ffffff",
    "--af-panel-solid": dark ? "#0d1b2e" : "#ffffff",
    "--af-surface": dark ? "#111f33" : "#f8fbff",
    "--af-soft-surface": dark ? "#111f33" : "#f8fbff",
    "--af-surface-strong": dark ? "#14243a" : "#f1f5fb",
    "--af-field-bg": dark ? "#0a1728" : "#ffffff",
    "--af-hover": dark ? "#112b45" : "#edf5ff",
    "--af-text": dark ? "#f8fafc" : "#172033",
    "--af-text-secondary": dark ? "rgba(248,250,252,.70)" : "#55627a",
    "--af-text-muted": dark ? "rgba(248,250,252,.48)" : "#8a96aa",
    "--af-border": dark ? "rgba(148,163,184,.16)" : "#dbe5f1",
    "--af-border-strong": dark ? "rgba(148,163,184,.28)" : "#c8d6e8",
    "--af-shadow": dark
      ? "0 12px 30px rgba(2,6,23,.34),0 2px 8px rgba(2,6,23,.20)"
      : "0 10px 28px rgba(15,23,42,.075),0 2px 8px rgba(15,23,42,.035)",

    "--af-card-bg": dark ? "#0d1b2e" : "#ffffff",
    "--af-card-bg-elevated": dark ? "#102139" : "#ffffff",
    "--af-card-border": dark ? "rgba(148,163,184,.18)" : "#d7e2ef",
    "--af-card-border-hover": dark ? "rgba(96,165,250,.34)" : "#bfd1e6",
    "--af-card-shadow": dark
      ? "0 12px 28px rgba(2,6,23,.32),0 2px 7px rgba(2,6,23,.18)"
      : "0 10px 26px rgba(15,23,42,.075),0 2px 7px rgba(15,23,42,.035)",

    "--af-primary": dark ? "#0ea5e9" : "#3b82f6",
    "--af-primary-hover": dark ? "#0284c7" : "#2563eb",
    "--af-primary-soft": dark ? "rgba(14,165,233,.13)" : "#edf4ff",
    "--af-primary-border": dark ? "rgba(14,165,233,.24)" : "#d7e6ff",
    "--af-primary-text": dark ? "#7dd3fc" : "#2f6fed",
    "--af-success-text": dark ? "#4ade80" : "#16834a",
    "--af-success-soft": dark ? "rgba(34,197,94,.13)" : "#eaf8f0",
    "--af-success-border": dark ? "rgba(34,197,94,.24)" : "#ccefd9",
    "--af-warning-text": dark ? "#fbbf24" : "#b56a08",
    "--af-warning-soft": dark ? "rgba(245,158,11,.13)" : "#fff7e8",
    "--af-warning-border": dark ? "rgba(245,158,11,.24)" : "#f8dfae",
    "--af-danger-text": dark ? "#fca5a5" : "#c33f45",
    "--af-danger-soft": dark ? "rgba(239,68,68,.13)" : "#fff0f1",
    "--af-danger-border": dark ? "rgba(239,68,68,.24)" : "#f6d2d5",
    "--af-purple-text": dark ? "#c4b5fd" : "#7356c9",
    "--af-purple-soft": dark ? "rgba(139,92,246,.13)" : "#f3efff",
    "--af-purple-border": dark ? "rgba(139,92,246,.24)" : "#e1d8ff",

    "--af-sidebar-bg": dark
      ? "linear-gradient(180deg,#06111f,#081629)"
      : "#ffffff",
    "--af-header-bg": dark
      ? "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))"
      : "rgba(255,255,255,.96)",
    "--af-hero-bg": dark
      ? "radial-gradient(circle at top left,rgba(14,165,233,.20),transparent 34%),linear-gradient(180deg,rgba(15,23,42,.94),rgba(15,23,42,.80))"
      : "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
    "--af-table-head": dark ? "#0a1728" : "#f3f7fc",
    "--af-table-row": dark ? "#0d1b2e" : "#ffffff",
    "--af-table-hover": dark ? "#112b45" : "#f2f7ff",

    "--af-overlay": dark ? "rgba(2,6,23,.76)" : "rgba(15,23,42,.42)",
    "--af-modal-title-bg": dark
      ? "linear-gradient(180deg,rgba(30,41,59,.98),rgba(15,23,42,.98))"
      : "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
    "--af-modal-shadow": dark
      ? "0 28px 80px rgba(0,0,0,.52),0 8px 26px rgba(2,6,23,.32)"
      : "0 28px 80px rgba(15,23,42,.22),0 8px 24px rgba(39,71,117,.10)",
    "--af-popover-shadow": dark
      ? "0 18px 48px rgba(0,0,0,.38)"
      : "0 16px 38px rgba(15,23,42,.15)",

    "--af-scroll-track": dark ? "rgba(255,255,255,.025)" : "rgba(15,23,42,.035)",
    "--af-scroll-thumb": dark ? "rgba(96,165,250,.46)" : "rgba(59,130,246,.42)",
    "--af-scroll-thumb-hover": dark ? "rgba(125,211,252,.78)" : "rgba(37,99,235,.68)",
    "--af-scroll-corner": dark ? "#081424" : "#eef3f9",
    "--af-pagination-bg": dark ? "#0a1728" : "#f7faff",
  };
};

export function AssetFlowThemeProvider({ children }) {
  const [mode, setMode] = useState(readMode);
  const cssVars = useMemo(() => variables(mode), [mode]);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = cssVars["--af-page-bg"];
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
    <AssetFlowThemeContext.Provider value={value}>
      <div className="af-theme-root" style={cssVars} data-assetflow-mode={mode}>
        {children}
      </div>
    </AssetFlowThemeContext.Provider>
  );
}

export function useAssetFlowTheme() {
  const value = useContext(AssetFlowThemeContext);
  if (!value) {
    throw new Error("useAssetFlowTheme must be used inside AssetFlowThemeProvider");
  }
  return value;
}
