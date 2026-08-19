import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CssBaseline,
  ThemeProvider,
} from "@mui/material";

import {
  createPackFlowTheme,
} from "../theme";

import "./packFlowTheme.css";

const STORAGE_KEY = "packflow:theme-mode:v1";
const PackFlowThemeContext = createContext(null);

const normalizeMode = (value) =>
  value === "light" ? "light" : "dark";

function readInitialMode() {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    return normalizeMode(
      window.localStorage.getItem(STORAGE_KEY)
    );
  } catch {
    return "dark";
  }
}

export function PackFlowThemeProvider({ children }) {
  const [mode, setModeState] = useState(readInitialMode);

  const setMode = (nextMode) => {
    setModeState(normalizeMode(nextMode));
  };

  const toggleTheme = () => {
    setModeState((current) =>
      current === "dark" ? "light" : "dark"
    );
  };

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const root = document.documentElement;
    root.dataset.packflowTheme = mode;
    root.style.colorScheme = mode;

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Theme persistence is optional; UI still works without storage.
    }

    return () => {
      if (root.dataset.packflowTheme === mode) {
        delete root.dataset.packflowTheme;
      }

      root.style.removeProperty("color-scheme");
    };
  }, [mode]);

  const muiTheme = useMemo(
    () => createPackFlowTheme(mode),
    [mode]
  );

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      isLight: mode === "light",
      setMode,
      toggleTheme,
    }),
    [mode]
  );

  return (
    <PackFlowThemeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PackFlowThemeContext.Provider>
  );
}

export function PackFlowThemeBoundary({ children }) {
  const existingContext = useContext(PackFlowThemeContext);

  if (existingContext) {
    return children;
  }

  return (
    <PackFlowThemeProvider>
      {children}
    </PackFlowThemeProvider>
  );
}

export function useOptionalPackFlowTheme() {
  return useContext(PackFlowThemeContext);
}

export function usePackFlowTheme() {
  const context = useContext(PackFlowThemeContext);

  if (!context) {
    throw new Error(
      "usePackFlowTheme must be used inside PackFlowThemeProvider"
    );
  }

  return context;
}

export default PackFlowThemeContext;
