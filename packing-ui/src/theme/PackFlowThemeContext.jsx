import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
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
const BODY_CLASS = "packflow-theme-body";
const PackFlowThemeContext = createContext(null);

/*
 * Build the two MUI theme objects once. Re-running createTheme on every
 * light/dark toggle adds avoidable work on PackFlow's largest registers.
 */
const PACKFLOW_MUI_THEMES = Object.freeze({
  dark: createPackFlowTheme("dark"),
  light: createPackFlowTheme("light"),
});

const useIsomorphicLayoutEffect =
  typeof window === "undefined"
    ? useEffect
    : useLayoutEffect;

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

  const setMode = useCallback((nextMode) => {
    setModeState(normalizeMode(nextMode));
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((current) =>
      current === "dark" ? "light" : "dark"
    );
  }, []);

  /*
   * Apply the CSS-variable mode before the browser paints the committed React
   * update. The old passive useEffect allowed a visible frame where the MUI
   * theme and PackFlow CSS variables could be out of sync.
   *
   * Deliberately return no cleanup here: effect cleanup on every mode change
   * used to temporarily remove data-packflow-theme before setting the next
   * mode, creating an unnecessary intermediate style state.
   */
  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    root.dataset.packflowTheme = mode;
    root.style.colorScheme = mode;

    if (body) {
      body.classList.add(BODY_CLASS);
      body.dataset.packflowTheme = mode;
    }
  }, [mode]);

  /* Persist after paint; localStorage does not need to block the visual swap. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Theme persistence is optional.
    }
  }, [mode]);

  /* Only remove global PackFlow markers when this provider actually unmounts. */
  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const body = document.body;

    return () => {
      delete root.dataset.packflowTheme;
      root.style.removeProperty("color-scheme");

      if (body) {
        body.classList.remove(BODY_CLASS);
        delete body.dataset.packflowTheme;
      }
    };
  }, []);

  const muiTheme = PACKFLOW_MUI_THEMES[mode];

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      isLight: mode === "light",
      setMode,
      toggleTheme,
    }),
    [mode, setMode, toggleTheme]
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
