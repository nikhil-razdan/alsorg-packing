import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  MenuItem,
  Pagination,
  ScopedCssBaseline,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";
import { matflowApi } from "./api/matflowApi";

const MODE_KEY = "matflow-color-mode";
const ThemeContext = createContext(null);

const readMode = () => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(MODE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches
    ? "light"
    : "dark";
};

const variables = (mode) => {
  const dark = mode === "dark";
  return {
    // Base shell
    "--mf-page-bg": dark ? "#07111f" : "#f6f9fe",
    "--mf-panel-bg": dark ? "#0d1b2e" : "#ffffff",
    "--mf-panel-solid": dark ? "#0d1b2e" : "#ffffff",
    "--mf-surface": dark ? "#111f33" : "#f8fbff",
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

    // Opaque card chrome. Never use transparent Card/Paper surfaces in MatFlow.
    "--mf-card-bg": dark ? "#0d1b2e" : "#ffffff",
    "--mf-card-bg-elevated": dark ? "#102139" : "#ffffff",
    "--mf-card-border": dark ? "rgba(148,163,184,.18)" : "#d7e2ef",
    "--mf-card-border-hover": dark ? "rgba(96,165,250,.34)" : "#bfd1e6",
    "--mf-card-shadow": dark
      ? "0 12px 28px rgba(2,6,23,.32),0 2px 7px rgba(2,6,23,.18)"
      : "0 10px 26px rgba(15,23,42,.075),0 2px 7px rgba(15,23,42,.035)",

    // PackFlow-inspired light accent system
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

    // Portal / modal chrome.
    // These variables are also promoted to :root by MatFlowThemeProvider so
    // MUI Dialog/Menu/Popover/Drawer portals inherit the same MatFlow theme.
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

    // Scrollbar / pagination chrome
    "--mf-scroll-track": dark ? "rgba(255,255,255,.025)" : "rgba(15,23,42,.035)",
    "--mf-scroll-thumb": dark ? "rgba(96,165,250,.46)" : "rgba(59,130,246,.42)",
    "--mf-scroll-thumb-hover": dark ? "rgba(125,211,252,.78)" : "rgba(37,99,235,.68)",
    "--mf-scroll-corner": dark ? "#081424" : "#eef3f9",
    "--mf-pagination-bg": dark ? "#0a1728" : "#f7faff",
  };
};

const buildTheme = (mode) => {
  const dark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? "#60a5fa" : "#3b82f6" },
      secondary: { main: dark ? "#a78bfa" : "#8b5cf6" },
      background: {
        default: dark ? "#07111f" : "#f6f9fe",
        paper: dark ? "#0f172a" : "#ffffff",
      },
      text: {
        primary: dark ? "#f8fafc" : "#172033",
        secondary: dark ? "rgba(248,250,252,.70)" : "#667085",
      },
      divider: dark ? "rgba(255,255,255,.08)" : "#e5ebf4",
      success: { main: "#16a34a" },
      warning: { main: "#f59e0b" },
      error: { main: "#dc2626" },
      info: { main: "#3b82f6" },
    },
    typography: {
      fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
      button: { textTransform: "none", fontWeight: 800 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: dark ? "#07111f" : "#f6f9fe" },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            color: dark ? "#f8fafc" : "#172033",
            backgroundColor: dark ? "#0d1b2e" : "#ffffff",
            backgroundImage: "none",
            border: `1px solid ${dark ? "rgba(148,163,184,.18)" : "#d7e2ef"}`,
            boxShadow: dark
              ? "0 12px 28px rgba(2,6,23,.32),0 2px 7px rgba(2,6,23,.18)"
              : "0 10px 26px rgba(15,23,42,.075),0 2px 7px rgba(15,23,42,.035)",
            opacity: 1,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: dark ? {} : {
            backgroundColor: "#ffffff",
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#cbd8ea" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6" },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: dark ? {} : { color: "#7b879b" },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? "rgba(2,6,23,.76)" : "rgba(15,23,42,.42)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          paper: {
            color: dark ? "#f8fafc" : "#172033",
            backgroundColor: dark ? "#0f172a" : "#ffffff",
            backgroundImage: "none",
            border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "#dbe5f2"}`,
            borderRadius: 12,
            boxShadow: dark
              ? "0 18px 48px rgba(0,0,0,.38)"
              : "0 16px 38px rgba(15,23,42,.15)",
          },
          list: {
            padding: 6,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 36,
            borderRadius: 8,
            marginBlock: 2,
            fontSize: 13,
            "&.Mui-selected": {
              backgroundColor: dark ? "rgba(14,165,233,.16)" : "#edf4ff",
            },
            "&.Mui-selected:hover": {
              backgroundColor: dark ? "rgba(14,165,233,.22)" : "#e2eeff",
            },
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            color: dark ? "#f8fafc" : "#172033",
            backgroundColor: dark ? "#0f172a" : "#ffffff",
            backgroundImage: "none",
            border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "#dbe5f2"}`,
            boxShadow: dark
              ? "0 18px 48px rgba(0,0,0,.38)"
              : "0 16px 38px rgba(15,23,42,.15)",
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          scroll: "paper",
        },
        styleOverrides: {
          paper: {
            borderRadius: 20,
            overflow: "hidden",
            color: dark ? "#f8fafc" : "#172033",
            backgroundColor: dark ? "#0f172a" : "#ffffff",
            backgroundImage: "none",
            border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "#d6e0ee"}`,
            boxShadow: dark
              ? "0 28px 80px rgba(0,0,0,.52),0 8px 26px rgba(2,6,23,.32)"
              : "0 28px 80px rgba(15,23,42,.22),0 8px 24px rgba(39,71,117,.10)",
            opacity: 1,
          },
          paperScrollPaper: {
            maxHeight: "calc(100dvh - 40px)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          root: {
            zIndex: 1300,
          },
          paper: {
            color: dark ? "#f8fafc" : "#172033",
            backgroundColor: dark ? "#0b1628" : "#ffffff",
            backgroundImage: "none",
            borderColor: dark ? "rgba(255,255,255,.10)" : "#dbe5f2",
            boxShadow: dark
              ? "18px 0 48px rgba(0,0,0,.34)"
              : "18px 0 48px rgba(15,23,42,.12)",
            opacity: 1,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            color: dark ? "#f8fafc" : "#172033",
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            color: dark ? "#f8fafc" : "#172033",
          },
        },
      },
    },
  });
};

export function MatFlowThemeProvider({ children }) {
  const [mode, setMode] = useState(readMode);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const cssVars = useMemo(() => variables(mode), [mode]);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark")),
      setMode,
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <GlobalStyles
          styles={{
            ":root": cssVars,
            body: {
              backgroundColor: "var(--mf-page-bg)",
            },
            ".MuiCard-root": {
              opacity: "1 !important",
              backgroundImage: "none",
            },
            ".MuiDialog-root .MuiDialog-paper": {
              color: "var(--mf-text) !important",
              backgroundColor: "var(--mf-panel-solid) !important",
              backgroundImage: "none !important",
              borderColor: "var(--mf-border-strong) !important",
              opacity: "1 !important",
            },
            ".MuiDrawer-root .MuiDrawer-paper": {
              color: "var(--mf-text) !important",
              backgroundColor: "var(--mf-panel-solid) !important",
              backgroundImage: "none !important",
              borderColor: "var(--mf-border-strong) !important",
              opacity: "1 !important",
            },
            ".MuiPopover-root .MuiPaper-root, .MuiMenu-root .MuiPaper-root": {
              color: "var(--mf-text) !important",
              backgroundColor: "var(--mf-panel-solid) !important",
              backgroundImage: "none !important",
              borderColor: "var(--mf-border-strong) !important",
              opacity: "1 !important",
            },
            ".MuiBackdrop-root": {
              backgroundColor: "var(--mf-overlay) !important",
            },
          }}
        />
        <ScopedCssBaseline
          sx={{
            ...cssVars,
            minHeight: "100vh",
            background: "var(--mf-page-bg)",
            color: "var(--mf-text)",
            "& *": {
              boxSizing: "border-box",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--mf-scroll-thumb) var(--mf-scroll-track)",
            },
            "& *::-webkit-scrollbar": {
              width: 10,
              height: 10,
            },
            "& *::-webkit-scrollbar-track": {
              background: "var(--mf-scroll-track)",
              borderRadius: 999,
            },
            "& *::-webkit-scrollbar-thumb": {
              minHeight: 42,
              border: "2px solid transparent",
              borderRadius: 999,
              background: "var(--mf-scroll-thumb)",
              backgroundClip: "padding-box",
              transition: "background .16s ease",
            },
            "& *::-webkit-scrollbar-thumb:hover": {
              background: "var(--mf-scroll-thumb-hover)",
              backgroundClip: "padding-box",
            },
            "& *::-webkit-scrollbar-corner": {
              background: "var(--mf-scroll-corner)",
            },
            "& .mf-sidebar-scroll": {
              scrollbarWidth: "thin",
              scrollbarColor: "var(--mf-scroll-thumb) transparent",
              scrollbarGutter: "stable",
            },
            "& .mf-sidebar-scroll::-webkit-scrollbar": {
              width: 8,
            },
            "& .mf-sidebar-scroll::-webkit-scrollbar-track": {
              background: "transparent",
              marginBlock: 6,
            },
            "& .mf-sidebar-scroll::-webkit-scrollbar-thumb": {
              border: "2px solid transparent",
              background: "var(--mf-scroll-thumb)",
              backgroundClip: "padding-box",
            },
            "& .mf-sidebar-scroll::-webkit-scrollbar-thumb:hover": {
              background: "var(--mf-scroll-thumb-hover)",
              backgroundClip: "padding-box",
            },
          }}
        >
          {children}
        </ScopedCssBaseline>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export const useMatFlowTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useMatFlowTheme must be inside MatFlowThemeProvider");
  return context;
};

export const MATFLOW_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  MANAGER: "MATFLOW_MANAGER",
  ENGINEERING: "MATFLOW_ENGINEERING",
  STORE: "MATFLOW_STORE",
  PURCHASE: "MATFLOW_PURCHASE",
  PROCESSING: "MATFLOW_PROCESSING",
  PRODUCTION: "MATFLOW_PRODUCTION",
  QC: "MATFLOW_QC",
  DIRECTOR: "MATFLOW_DIRECTOR",
});

const ALL_MATFLOW_ROLES = Object.freeze(Object.values(MATFLOW_ROLES));
const normalizeRole = (role) => String(role ?? "")
  .trim()
  .toUpperCase()
  .replace(/^ROLE_/, "");

export const getMatFlowRoles = (roleOrRoles, extraRoles = []) => {
  const values = [
    ...(Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]),
    ...(Array.isArray(extraRoles) ? extraRoles : [extraRoles]),
  ];
  return Array.from(new Set(values.map(normalizeRole).filter((role) => ALL_MATFLOW_ROLES.includes(role))));
};

const ROLE_PRIORITY = [
  MATFLOW_ROLES.ADMIN,
  MATFLOW_ROLES.MANAGER,
  MATFLOW_ROLES.DIRECTOR,
  MATFLOW_ROLES.PRODUCTION,
  MATFLOW_ROLES.ENGINEERING,
  MATFLOW_ROLES.STORE,
  MATFLOW_ROLES.PURCHASE,
  MATFLOW_ROLES.QC,
  MATFLOW_ROLES.PROCESSING,
];

export const getMatFlowRole = (roleOrRoles, extraRoles = []) => {
  const roles = getMatFlowRoles(roleOrRoles, extraRoles);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || "";
};

const MATFLOW_SCREEN_ROLES = Object.freeze({
  dashboard: ALL_MATFLOW_ROLES,
  tracking: ALL_MATFLOW_ROLES,
  projects: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.STORE, MATFLOW_ROLES.DIRECTOR],
  materials: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE, MATFLOW_ROLES.QC],
  "processing-units": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING],
  boms: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.STORE, MATFLOW_ROLES.DIRECTOR],
  "bom-create": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING],
  "bom-edit": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING],
  production: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION],
  "production-execution": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION],
  store: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE],
  returns: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PRODUCTION],
  purchase: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PURCHASE],
  receiving: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE],
  qc: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.QC],
  processing: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PROCESSING],
  "material-register": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.DIRECTOR],
  ledger: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.DIRECTOR],
  reports: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR],
});

export const canAccessMatFlowScreen = (screen, roleOrRoles) => {
  const roles = getMatFlowRoles(roleOrRoles);
  if (roles.includes(MATFLOW_ROLES.ADMIN)) return true;
  const allowed = MATFLOW_SCREEN_ROLES[screen];
  return Array.isArray(allowed) && roles.some((role) => allowed.includes(role));
};

/**
 * Plant-aware UI gate for the four-plant workflow. The backend remains the
 * authority; this prevents a remote-plant user from being offered desks that
 * physically exist only at AL-P1 Main Store.
 */
export const canAccessMatFlowScreenForContext = (screen, roleOrRoles, plantCodes = []) => {
  const roles = getMatFlowRoles(roleOrRoles);
  if (!canAccessMatFlowScreen(screen, roles)) return false;
  if (roles.includes(MATFLOW_ROLES.ADMIN) || roles.includes(MATFLOW_ROLES.MANAGER)) return true;

  const plants = Array.from(new Set((Array.isArray(plantCodes) ? plantCodes : [plantCodes])
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean)));

  // Purchase, GRN and QC are centralized at AL-P1 Main Store in API v6.
  if (["purchase", "receiving", "qc"].includes(screen)) {
    return plants.includes("AL-P1");
  }
  return true;
};

export const matFlowRoleLabel = (roleOrRoles) => {
  const role = getMatFlowRole(roleOrRoles);
  return ({
    [MATFLOW_ROLES.ADMIN]: "Administrator",
    [MATFLOW_ROLES.MANAGER]: "MatFlow Manager",
    [MATFLOW_ROLES.ENGINEERING]: "Engineering",
    [MATFLOW_ROLES.STORE]: "Stores",
    [MATFLOW_ROLES.PURCHASE]: "Purchase",
    [MATFLOW_ROLES.PROCESSING]: "Processing",
    [MATFLOW_ROLES.PRODUCTION]: "Production",
    [MATFLOW_ROLES.QC]: "Quality Control",
    [MATFLOW_ROLES.DIRECTOR]: "Director",
  }[role] || "MatFlow User");
};

export const defaultMatFlowPathForRole = (roleOrRoles) => {
  const roles = getMatFlowRoles(roleOrRoles);
  // API v6 uses one Universal Dashboard as the common MatFlow landing page.
  return roles.length ? "/matflow/dashboard" : "/modules";
};

const MatFlowContext = createContext(null);
const MATFLOW_PLANT_KEY = "matflowSelectedPlant";
const ALL_PLANTS = "ALL";
const normalizePlants = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean))).sort();

export function useMatFlow() {
  const context = useContext(MatFlowContext);
  if (!context) throw new Error("useMatFlow must be used inside MatFlowProvider");
  return context;
}

export function MatFlowProvider({ children }) {
  const { user, role, roles, plantCode, plantCodes } = useAuth();

  const effectiveRoles = useMemo(() => getMatFlowRoles([
    ...(Array.isArray(roles) ? roles : []),
    ...(Array.isArray(user?.roles) ? user.roles : []),
    role,
    user?.role,
  ]), [roles, role, user?.roles, user?.role]);

  /*
   * The effective plant arrays returned by /auth/me are authoritative.
   * The legacy single plantCode is used only when no array is available.
   * This prevents a stale primary plant from being offered in MatFlow and
   * then rejected by the backend's strict CurrentUserService plant check.
   */
  const authPlants = useMemo(() => {
    const effective = normalizePlants([
      ...(Array.isArray(plantCodes) ? plantCodes : []),
      ...(Array.isArray(user?.plantCodes) ? user.plantCodes : []),
    ]);
    if (effective.length) return effective;
    return normalizePlants([plantCode, user?.plantCode]);
  }, [plantCode, plantCodes, user?.plantCode, user?.plantCodes]);

  const [serverPlants, setServerPlants] = useState([]);
  useEffect(() => {
    let active = true;
    if (!user) { setServerPlants([]); return () => { active = false; }; }
    matflowApi.metadata()
      .then((response) => {
        if (!active) return;
        setServerPlants(normalizePlants(response?.data?.allowedPlants));
      })
      .catch(() => { if (active) setServerPlants([]); });
    return () => { active = false; };
  }, [user]);

  // /matflow/meta is generated by the same backend access service that enforces writes.
  const availablePlants = serverPlants.length ? serverPlants : authPlants;
  const canViewAllPlants = effectiveRoles.some((item) => [
    MATFLOW_ROLES.ADMIN,
    MATFLOW_ROLES.MANAGER,
    MATFLOW_ROLES.DIRECTOR,
  ].includes(item));

  const [selectedPlantCode, setPlantState] = useState(() => {
    let stored = ALL_PLANTS;
    try { stored = window.localStorage.getItem(MATFLOW_PLANT_KEY) || ALL_PLANTS; }
    catch { /* ignore */ }
    stored = String(stored || ALL_PLANTS).trim().toUpperCase();
    if (canViewAllPlants) return stored;
    return authPlants.includes(stored) ? stored : (authPlants[0] || ALL_PLANTS);
  });

  useEffect(() => {
    const validPlant = selectedPlantCode !== ALL_PLANTS && availablePlants.includes(selectedPlantCode);
    const next = canViewAllPlants
      ? (selectedPlantCode === ALL_PLANTS || validPlant ? selectedPlantCode : ALL_PLANTS)
      : (validPlant ? selectedPlantCode : (availablePlants[0] || ALL_PLANTS));

    if (next !== selectedPlantCode) {
      setPlantState(next);
      try { window.localStorage.setItem(MATFLOW_PLANT_KEY, next); } catch { /* ignore */ }
    }
  }, [availablePlants, canViewAllPlants, selectedPlantCode]);

  const setSelectedPlantCode = useCallback((value) => {
    const normalized = String(value || ALL_PLANTS).trim().toUpperCase();
    const accepted = canViewAllPlants && normalized === ALL_PLANTS
      ? ALL_PLANTS
      : availablePlants.includes(normalized)
        ? normalized
        : canViewAllPlants
          ? ALL_PLANTS
          : (availablePlants[0] || ALL_PLANTS);
    setPlantState(accepted);
    try { window.localStorage.setItem(MATFLOW_PLANT_KEY, accepted); } catch { /* ignore */ }
  }, [availablePlants, canViewAllPlants]);

  const hasRole = useCallback((...allowed) => {
    const requested = allowed.flat().map(normalizeRole);
    return effectiveRoles.some((item) => requested.includes(item));
  }, [effectiveRoles]);

  const contextValue = useMemo(() => ({
    availablePlants,
    selectedPlantCode,
    selectedPlantParam: selectedPlantCode === ALL_PLANTS ? undefined : selectedPlantCode,
    allPlantsSelected: selectedPlantCode === ALL_PLANTS,
    canViewAllPlants,
    setSelectedPlantCode,
    roles: effectiveRoles,
    role: getMatFlowRole(effectiveRoles),
    hasRole,
  }), [availablePlants, selectedPlantCode, canViewAllPlants, setSelectedPlantCode, effectiveRoles, hasRole]);

  return <MatFlowContext.Provider value={contextValue}>{children}</MatFlowContext.Provider>;
}

export const clean = (value) => String(value ?? "").trim();
export const normalize = (value) =>
  clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
export const numeric = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
export const formatQty = (value) =>
  numeric(value).toLocaleString("en-IN", { maximumFractionDigits: 3 });
export const formatDate = (value, includeTime = true) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return includeTime
    ? date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString("en-IN", { dateStyle: "medium" });
};
export const readable = (value) =>
  normalize(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");


const MATFLOW_KANBAN_PROJECT_FAMILIES = Object.freeze([
  { name: "Sky", base: "#38bdf8", variants: ["#7dd3fc", "#0ea5e9", "#0284c7", "#60a5fa"] },
  { name: "Indigo", base: "#818cf8", variants: ["#a5b4fc", "#6366f1", "#4f46e5", "#93c5fd"] },
  { name: "Violet", base: "#a78bfa", variants: ["#c4b5fd", "#8b5cf6", "#7c3aed", "#d8b4fe"] },
  { name: "Cyan", base: "#22d3ee", variants: ["#67e8f9", "#06b6d4", "#0891b2", "#2dd4bf"] },
  { name: "Rose", base: "#fb7185", variants: ["#fda4af", "#f43f5e", "#e11d48", "#f9a8d4"] },
  { name: "Fuchsia", base: "#e879f9", variants: ["#f0abfc", "#d946ef", "#c026d3", "#f5d0fe"] },
  { name: "Teal", base: "#2dd4bf", variants: ["#5eead4", "#14b8a6", "#0f766e", "#22d3ee"] },
  { name: "Amber", base: "#f59e0b", variants: ["#fbbf24", "#d97706", "#fb923c", "#facc15"] },
]);

const MATFLOW_KANBAN_MATERIAL_FAMILIES = Object.freeze({
  METAL: { name: "Metal", base: "#60a5fa", variants: ["#93c5fd", "#38bdf8", "#3b82f6", "#818cf8"] },
  WOOD: { name: "Wood / Veneer", base: "#d97706", variants: ["#f59e0b", "#b45309", "#fb923c", "#fbbf24"] },
  STONE: { name: "Stone / Tile", base: "#94a3b8", variants: ["#cbd5e1", "#64748b", "#a8a29e", "#78716c"] },
  HARDWARE: { name: "Hardware", base: "#06b6d4", variants: ["#22d3ee", "#0891b2", "#14b8a6", "#67e8f9"] },
  GLASS: { name: "Glass / Mirror", base: "#67e8f9", variants: ["#a5f3fc", "#22d3ee", "#7dd3fc", "#38bdf8"] },
  FABRIC: { name: "Fabric / Upholstery", base: "#c084fc", variants: ["#d8b4fe", "#a855f7", "#e879f9", "#f0abfc"] },
  CHEMICAL: { name: "Paint / Chemical / Polish", base: "#fb7185", variants: ["#fda4af", "#f97316", "#f43f5e", "#fdba74"] },
  PACKAGING: { name: "Packaging", base: "#fb923c", variants: ["#fdba74", "#f97316", "#f59e0b", "#fbbf24"] },
  ELECTRICAL: { name: "Electrical / Lighting", base: "#eab308", variants: ["#facc15", "#f59e0b", "#fde047", "#ca8a04"] },
  RAW: { name: "Raw Material", base: "#34d399", variants: ["#6ee7b7", "#10b981", "#2dd4bf", "#22c55e"] },
  OTHER: { name: "Other", base: "#64748b", variants: ["#94a3b8", "#475569", "#64748b", "#a1a1aa"] },
});

const matFlowStableHash = (value) => {
  const text = clean(value).toUpperCase() || "MATFLOW";
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const matFlowHexToRgba = (hex, alpha) => {
  const raw = clean(hex).replace("#", "");
  const normalized = raw.length === 3
    ? raw.split("").map((part) => `${part}${part}`).join("")
    : raw.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return `rgba(96,165,250,${alpha})`;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
};

const materialFamilyKey = (category) => {
  const value = normalize(category);
  if (value.includes("METAL") || value.includes("STEEL") || value.includes("ALUMIN")) return "METAL";
  if (value.includes("WOOD") || value.includes("VENEER") || value.includes("PLY") || value.includes("MDF")) return "WOOD";
  if (value.includes("STONE") || value.includes("TILE") || value.includes("MARBLE") || value.includes("GRANITE")) return "STONE";
  if (value.includes("HARDWARE") || value.includes("FITTING") || value.includes("FASTENER")) return "HARDWARE";
  if (value.includes("GLASS") || value.includes("MIRROR")) return "GLASS";
  if (value.includes("FABRIC") || value.includes("UPHOLST") || value.includes("LEATHER") || value.includes("FOAM")) return "FABRIC";
  if (value.includes("PAINT") || value.includes("POLISH") || value.includes("CHEMICAL") || value.includes("ADHESIVE") || value.includes("COATING")) return "CHEMICAL";
  if (value.includes("PACK") || value.includes("CARTON") || value.includes("FOAM") || value.includes("WRAP")) return "PACKAGING";
  if (value.includes("ELECTR") || value.includes("LIGHT") || value.includes("LED")) return "ELECTRICAL";
  if (value.includes("RAW")) return "RAW";
  return "OTHER";
};

/**
 * Deterministic visual identity for entity-wise Kanban cards.
 * Workflow status colours remain owned by MatFlowStatusChip; these accents only
 * identify which Project/Product/Material a card belongs to.
 */
export const getMatFlowKanbanIdentity = ({
  kind = "PROJECT",
  projectKey = "",
  productKey = "",
  materialCategory = "",
  materialKey = "",
} = {}) => {
  const entityKind = normalize(kind) || "PROJECT";
  let accent;
  let familyAccent;
  let familyName;

  if (entityKind === "MATERIAL") {
    const materialFamily = MATFLOW_KANBAN_MATERIAL_FAMILIES[materialFamilyKey(materialCategory)]
      || MATFLOW_KANBAN_MATERIAL_FAMILIES.OTHER;
    const variantIndex = matFlowStableHash(materialKey || materialCategory) % materialFamily.variants.length;
    familyAccent = materialFamily.base;
    accent = materialFamily.variants[variantIndex];
    familyName = materialFamily.name;
  } else {
    const projectSeed = projectKey || "MATFLOW PROJECT";
    const familyIndex = matFlowStableHash(projectSeed) % MATFLOW_KANBAN_PROJECT_FAMILIES.length;
    const projectFamily = MATFLOW_KANBAN_PROJECT_FAMILIES[familyIndex];
    familyAccent = projectFamily.base;
    const productVariantIndex = matFlowStableHash(productKey || projectSeed) % projectFamily.variants.length;
    accent = entityKind === "PRODUCT" ? projectFamily.variants[productVariantIndex] : projectFamily.base;
    familyName = projectFamily.name;
  }

  return {
    kind: entityKind,
    accent,
    familyAccent,
    familyName,
    border: matFlowHexToRgba(accent, .54),
    borderSoft: matFlowHexToRgba(accent, .24),
    soft: matFlowHexToRgba(accent, .075),
    softStrong: matFlowHexToRgba(accent, .14),
    glow: matFlowHexToRgba(accent, .16),
    familySoft: matFlowHexToRgba(familyAccent, .11),
  };
};

export const matFlowKanbanCardSx = (identity = {}) => ({
  position: "relative",
  overflow: "hidden",
  borderColor: identity.border || "var(--mf-card-border)",
  borderLeft: `4px solid ${identity.accent || "var(--mf-primary)"}`,
  background: `linear-gradient(135deg,${identity.softStrong || "rgba(59,130,246,.10)"} 0%,${identity.soft || "rgba(59,130,246,.04)"} 34%,transparent 68%),var(--mf-card-bg)`,
  boxShadow: "none",
  transition: "border-color .16s ease,box-shadow .16s ease,transform .16s ease",
  "&::after": {
    content: '\"\"',
    position: "absolute",
    top: 0,
    left: 0,
    width: "46%",
    height: 2,
    pointerEvents: "none",
    background: `linear-gradient(90deg,${identity.familyAccent || identity.accent || "var(--mf-primary)"},${identity.accent || "var(--mf-primary)"},transparent)`,
    opacity: .9,
  },
  "&:hover": {
    borderColor: identity.accent || "var(--mf-card-border-hover)",
    boxShadow: `0 12px 26px ${identity.glow || "rgba(59,130,246,.12)"}`,
    transform: "translateY(-1px)",
  },
});

export function MatFlowIdentityBadge({ label, identity, accent = "" }) {
  const resolvedAccent = accent || identity?.accent || "var(--mf-primary)";
  const soft = accent ? matFlowHexToRgba(accent, .10) : (identity?.softStrong || "var(--mf-primary-soft)");
  const border = accent ? matFlowHexToRgba(accent, .32) : (identity?.borderSoft || "var(--mf-primary-border)");
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: .45,
        minHeight: 22,
        maxWidth: "100%",
        px: .65,
        py: .15,
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: soft,
        color: "var(--mf-text-secondary)",
        fontSize: 9.5,
        lineHeight: 1.15,
        fontWeight: 950,
        letterSpacing: ".055em",
        textTransform: "uppercase",
      }}
    >
      <Box
        component="span"
        sx={{
          width: 7,
          height: 7,
          flex: "0 0 7px",
          borderRadius: 999,
          background: resolvedAccent,
          boxShadow: `0 0 0 3px ${accent ? matFlowHexToRgba(accent, .10) : (identity?.soft || "var(--mf-primary-soft)")}`,
        }}
      />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label || readable(identity?.kind || "ENTITY")}
      </Box>
    </Box>
  );
}

const success = new Set([
  "ACTIVE", "APPROVED", "AVAILABLE", "READY", "RECEIVED", "ACCEPTED",
  "RESERVED", "READY_TO_ISSUE", "ISSUED", "ISSUED_TO_PRODUCTION",
  "CONSUMED", "PRODUCTION_COMPLETED", "COMPLETED", "CLOSED", "PLACED",
]);
const danger = new Set([
  "REJECTED", "RETURNED", "CANCELLED", "FAILED", "SHORTAGE_IDENTIFIED",
]);
const purple = new Set([
  "SUPERSEDED", "IN_TRANSIT", "IN_PROCESSING", "PROCESSING_REQUIRED",
  "ORDERED", "PRODUCTION_STARTED",
]);

export function MatFlowStatusChip({ status }) {
  const { isDark } = useMatFlowTheme();
  const value = normalize(status) || "UNKNOWN";
  let tone = {
    color: "var(--mf-primary-text)",
    background: "var(--mf-primary-soft)",
    border: "1px solid var(--mf-primary-border)",
  };
  if (success.has(value)) {
    tone = { color: "var(--mf-success-text)", background: "var(--mf-success-soft)", border: "1px solid var(--mf-success-border)" };
  } else if (danger.has(value)) {
    tone = { color: "var(--mf-danger-text)", background: "var(--mf-danger-soft)", border: "1px solid var(--mf-danger-border)" };
  } else if (purple.has(value)) {
    tone = { color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", border: "1px solid var(--mf-purple-border)" };
  } else if (
    value === "DRAFT" || value === "SUBMITTED" || value === "SUBMITTED_TO_STORE" ||
    value === "STORE_REVIEW_IN_PROGRESS" || value === "SHORTAGE_PENDING" ||
    value === "QC_PENDING" || value.startsWith("PARTIALLY_") || value.startsWith("PENDING_")
  ) {
    tone = { color: "var(--mf-warning-text)", background: "var(--mf-warning-soft)", border: "1px solid var(--mf-warning-border)" };
  }

  return (
    <Chip
      label={readable(value) || "Unknown"}
      size="small"
      sx={{
        height: isDark ? 24 : 23,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: ".01em",
        ...tone,
      }}
    />
  );
}

export function PageHero({ badge, title, subtitle, actions }) {
  return (
    <Box sx={heroSx}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          {badge && <Chip label={badge} sx={heroBadgeSx} />}
          <Typography sx={heroTitleSx}>{title}</Typography>
          {subtitle && <Typography sx={heroSubSx}>{subtitle}</Typography>}
        </Box>
        {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>{actions}</Box>}
      </Box>
    </Box>
  );
}

export function LoadingBlock({ minHeight = 260 }) {
  return <Box sx={{ minHeight, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
}
export function ErrorBox({ children }) {
  return children ? <Box sx={errorBoxSx}>{children}</Box> : null;
}
export function EmptyState({ children = "No records found." }) {
  return <Box sx={emptySx}>{children}</Box>;
}
export function Detail({ label, value }) {
  return (
    <Box sx={detailBoxSx}>
      <Typography sx={detailLabelSx}>{label}</Typography>
      <Box sx={detailValueSx}>{value ?? "-"}</Box>
    </Box>
  );
}
const SUMMARY_TONES = Object.freeze({
  blue: {
    accent: "#3b82f6",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#edf5ff 100%)",
    lightBorder: "#c8dcfb",
    lightLabel: "#4f6f9c",
    darkBg: "linear-gradient(135deg,#102947 0%,#0d1b2e 72%)",
    darkBorder: "rgba(96,165,250,.38)",
    darkLabel: "#93c5fd",
    glow: "rgba(59,130,246,.22)",
  },
  sky: {
    accent: "#0ea5e9",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#eaf9ff 100%)",
    lightBorder: "#bde9f8",
    lightLabel: "#47758b",
    darkBg: "linear-gradient(135deg,#0c3042 0%,#0d1b2e 72%)",
    darkBorder: "rgba(56,189,248,.38)",
    darkLabel: "#7dd3fc",
    glow: "rgba(14,165,233,.22)",
  },
  indigo: {
    accent: "#6366f1",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#f0f1ff 100%)",
    lightBorder: "#d4d6ff",
    lightLabel: "#5e6398",
    darkBg: "linear-gradient(135deg,#20244e 0%,#0d1b2e 72%)",
    darkBorder: "rgba(129,140,248,.38)",
    darkLabel: "#a5b4fc",
    glow: "rgba(99,102,241,.22)",
  },
  purple: {
    accent: "#8b5cf6",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#f5efff 100%)",
    lightBorder: "#e0d2ff",
    lightLabel: "#725f98",
    darkBg: "linear-gradient(135deg,#2a2046 0%,#0d1b2e 72%)",
    darkBorder: "rgba(167,139,250,.38)",
    darkLabel: "#c4b5fd",
    glow: "rgba(139,92,246,.22)",
  },
  green: {
    accent: "#16a34a",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#edf9f2 100%)",
    lightBorder: "#c7ead5",
    lightLabel: "#47735b",
    darkBg: "linear-gradient(135deg,#123528 0%,#0d1b2e 72%)",
    darkBorder: "rgba(74,222,128,.34)",
    darkLabel: "#86efac",
    glow: "rgba(34,197,94,.19)",
  },
  amber: {
    accent: "#d97706",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#fff7e8 100%)",
    lightBorder: "#f1ddae",
    lightLabel: "#866b39",
    darkBg: "linear-gradient(135deg,#3a2b16 0%,#0d1b2e 72%)",
    darkBorder: "rgba(251,191,36,.34)",
    darkLabel: "#fcd34d",
    glow: "rgba(245,158,11,.18)",
  },
  orange: {
    accent: "#ea580c",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#fff1e9 100%)",
    lightBorder: "#f6d2bd",
    lightLabel: "#8c6148",
    darkBg: "linear-gradient(135deg,#3b2418 0%,#0d1b2e 72%)",
    darkBorder: "rgba(251,146,60,.36)",
    darkLabel: "#fdba74",
    glow: "rgba(249,115,22,.19)",
  },
  red: {
    accent: "#dc2626",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#fff0f1 100%)",
    lightBorder: "#f3cbd0",
    lightLabel: "#8b5960",
    darkBg: "linear-gradient(135deg,#3b1d24 0%,#0d1b2e 72%)",
    darkBorder: "rgba(248,113,113,.38)",
    darkLabel: "#fca5a5",
    glow: "rgba(239,68,68,.19)",
  },
  pink: {
    accent: "#db2777",
    lightBg: "linear-gradient(135deg,#ffffff 0%,#fff0f7 100%)",
    lightBorder: "#f4cce0",
    lightLabel: "#8c5d75",
    darkBg: "linear-gradient(135deg,#3b1d31 0%,#0d1b2e 72%)",
    darkBorder: "rgba(244,114,182,.36)",
    darkLabel: "#f9a8d4",
    glow: "rgba(236,72,153,.18)",
  },
});

const SUMMARY_TONE_ALIASES = Object.freeze({
  success: "green",
  warning: "amber",
  danger: "red",
  error: "red",
  info: "blue",
  primary: "blue",
  secondary: "purple",
});

const semanticSummaryTone = (label) => {
  const text = String(label || "").toLowerCase();

  if (/(shortage|breach|rejected|reject|overdue|delayed|delay|exception|failed|failure|without bom|blocked)/.test(text)) {
    return "red";
  }
  if (/(awaiting|pending|partial|review|approval|longest|ageing|aging|dwell|draft|hold|transit)/.test(text)) {
    return "amber";
  }
  if (/(completed|complete|approved|received|available|consumed|active|ready|healthy|on hand)/.test(text)) {
    return "green";
  }
  if (/(processing|route|bom|stage|lead time|lead|duration)/.test(text)) {
    return "purple";
  }
  if (/(reserved|reservation|product|drawing)/.test(text)) {
    return "indigo";
  }
  if (/(issued|department|live|current)/.test(text)) {
    return "sky";
  }
  if (/(requested|request|project|total|progress|records|lots|branches)/.test(text)) {
    return "blue";
  }

  return "blue";
};

const summaryToneFor = (label, requestedTone) => {
  const requested = String(requestedTone || "").toLowerCase();
  const key = SUMMARY_TONES[requested]
    ? requested
    : SUMMARY_TONE_ALIASES[requested] || semanticSummaryTone(label);
  return SUMMARY_TONES[key] || SUMMARY_TONES.blue;
};

export function SummaryCard({ label, value, helper, tone, colorful = false }) {
  const { isDark } = useMatFlowTheme();
  const meta = summaryToneFor(label, tone);

  return (
    <Card
      sx={{
        ...panelSx,
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        minHeight: colorful ? 108 : 96,
        px: colorful ? 1.75 : 1.55,
        py: colorful ? 1.55 : 1.35,
        border: `1px solid ${isDark ? meta.darkBorder : meta.lightBorder}`,
        borderTop: `3px solid ${meta.accent}`,
        background: isDark ? meta.darkBg : meta.lightBg,
        boxShadow: isDark
          ? `0 12px 28px rgba(2,6,23,.30),0 0 0 1px ${meta.glow}`
          : "0 10px 24px rgba(15,23,42,.065),0 2px 6px rgba(15,23,42,.035)",
        transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
        "&:hover": {
          transform: "translateY(-1px)",
          borderColor: meta.accent,
          boxShadow: isDark
            ? `0 16px 34px rgba(2,6,23,.38),0 0 0 1px ${meta.glow}`
            : "0 14px 30px rgba(15,23,42,.09),0 3px 8px rgba(15,23,42,.045)",
        },
        "&::after": colorful ? {
          content: '""',
          position: "absolute",
          width: 108,
          height: 108,
          borderRadius: "50%",
          right: -38,
          top: -48,
          background: isDark ? meta.glow : `${meta.accent}12`,
          zIndex: -1,
          pointerEvents: "none",
        } : undefined,
      }}
    >
      <Typography
        sx={{
          ...detailLabelSx,
          color: isDark ? meta.darkLabel : meta.lightLabel,
          fontSize: 9.5,
          letterSpacing: ".075em",
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          mt: .72,
          fontSize: colorful ? { xs: 21, md: 23 } : { xs: 18, md: 20 },
          fontWeight: 950,
          color: "var(--mf-text)",
          lineHeight: 1.12,
          letterSpacing: "-.018em",
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        {value ?? "-"}
      </Box>
      {helper && (
        <Typography
          sx={{
            ...subTextSx,
            mt: .55,
            color: "var(--mf-text-secondary)",
            lineHeight: 1.4,
          }}
        >
          {helper}
        </Typography>
      )}
    </Card>
  );
}


export function MatFlowViewToggle({ value, onChange, options = [] }) {
  const safeOptions = Array.isArray(options) ? options : [];
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: .35,
        p: .35,
        borderRadius: 2.4,
        border: "1px solid var(--mf-border)",
        background: "var(--mf-surface)",
      }}
    >
      {safeOptions.map((option) => {
        const key = String(option?.value || option?.key || "").toUpperCase();
        const active = String(value || "").toUpperCase() === key;
        return (
          <Button
            key={key}
            size="small"
            onClick={() => onChange?.(key)}
            sx={{
              ...(active ? primaryBtnSx : secondaryBtnSx),
              minHeight: 32,
              px: 1.15,
              py: .45,
              boxShadow: "none",
              borderColor: active ? "transparent" : "transparent",
            }}
          >
            {option?.label || readable(key)}
          </Button>
        );
      })}
    </Box>
  );
}

export function MatFlowKanbanBoard({
  columns = [],
  items = [],
  laneFor,
  renderCard,
  emptyText = "No work items in this lane.",
  minColumnWidth = 270,
  boardHeight = { xs: 620, md: "clamp(520px, calc(100vh - 320px), 760px)" },
  initialItemsPerLane = 18,
  loadMoreStep = 18,
  completedLaneKeys = ["COMPLETE"],
  completedLaneLimit = 12,
  boardKey = "default",
  laneSummary = null,
  focusable = true,
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeItems = Array.isArray(items) ? items : [];
  const completedKeys = new Set((Array.isArray(completedLaneKeys) ? completedLaneKeys : []).map(String));
  const [focusedLane, setFocusedLane] = useState("");
  const [laneLimits, setLaneLimits] = useState({});

  const grouped = useMemo(() => {
    const result = safeColumns.reduce((acc, column) => {
      acc[String(column?.key || "")] = [];
      return acc;
    }, {});
    safeItems.forEach((item) => {
      const lane = String(laneFor?.(item) || "");
      if (Object.prototype.hasOwnProperty.call(result, lane)) result[lane].push(item);
    });
    return result;
  }, [safeColumns, safeItems, laneFor]);

  useEffect(() => {
    setFocusedLane("");
    setLaneLimits({});
  }, [boardKey]);

  const visibleColumns = focusedLane
    ? safeColumns.filter((column) => String(column?.key || "") === focusedLane)
    : safeColumns;

  const growLane = useCallback((key, maxCount) => {
    if (completedKeys.has(key)) return;
    setLaneLimits((current) => {
      const existing = Number(current[key]) || initialItemsPerLane;
      if (existing >= maxCount) return current;
      return {
        ...current,
        [key]: Math.min(maxCount, existing + loadMoreStep),
      };
    });
  }, [completedKeys, initialItemsPerLane, loadMoreStep]);

  return (
    <Box sx={{ display: "grid", gap: .7, minWidth: 0 }}>
      {focusedLane && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: .2,
          }}
        >
          <Typography sx={{ ...subTextSx, fontSize: 10.5 }}>
            Focus mode · {safeColumns.find((column) => String(column?.key || "") === focusedLane)?.label || readable(focusedLane)}
          </Typography>
          <Button onClick={() => setFocusedLane("")} sx={{ ...secondaryBtnSx, minHeight: 30, px: 1 }}>
            Show all stages
          </Button>
        </Box>
      )}

      <Box
        className="mf-kanban-scroll"
        sx={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: focusedLane ? "minmax(0,1fr)" : `minmax(${minColumnWidth}px, 1fr)`,
          gap: 1,
          overflowX: focusedLane ? "hidden" : "auto",
          overflowY: "hidden",
          height: boardHeight,
          minHeight: 0,
          pb: .35,
          scrollSnapType: focusedLane ? "none" : "x proximity",
          scrollbarGutter: "stable",
        }}
      >
        {visibleColumns.map((column) => {
          const key = String(column?.key || "");
          const laneItems = grouped[key] || [];
          const isCompletedLane = completedKeys.has(key);
          const hardLimit = isCompletedLane
            ? Math.max(1, Number(completedLaneLimit) || 12)
            : laneItems.length;
          const requestedLimit = Number(laneLimits[key]) || Math.max(1, Number(initialItemsPerLane) || 18);
          const renderLimit = isCompletedLane
            ? Math.min(hardLimit, laneItems.length)
            : Math.min(requestedLimit, laneItems.length);
          const visibleItems = laneItems.slice(0, renderLimit);
          const remaining = Math.max(0, laneItems.length - renderLimit);
          const summary = typeof laneSummary === "function" ? laneSummary(laneItems, column) : null;

          return (
            <Card
              key={key}
              sx={{
                ...panelSx,
                m: 0,
                p: 0,
                minWidth: focusedLane ? 0 : minColumnWidth,
                minHeight: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: "var(--mf-surface)",
                boxShadow: "none",
                scrollSnapAlign: "start",
              }}
            >
              <Box
                sx={{
                  px: 1,
                  py: .85,
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: .8,
                  borderBottom: "1px solid var(--mf-border)",
                  background: "var(--mf-surface)",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: .6, flexWrap: "wrap" }}>
                    <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{column?.label || readable(key)}</Typography>
                    {focusable && !focusedLane && laneItems.length > 0 && (
                      <Button
                        onClick={() => setFocusedLane(key)}
                        sx={{
                          ...secondaryBtnSx,
                          minHeight: 23,
                          px: .7,
                          py: 0,
                          fontSize: 9.2,
                          borderRadius: 999,
                        }}
                      >
                        Focus
                      </Button>
                    )}
                  </Box>
                  {column?.subtitle && <Typography sx={{ ...subTextSx, mt: .15 }}>{column.subtitle}</Typography>}
                  {summary && <Typography sx={{ ...subTextSx, mt: .25, fontSize: 9.6 }}>{summary}</Typography>}
                </Box>
                <Box
                  sx={{
                    minWidth: 30,
                    height: 30,
                    px: .75,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--mf-primary-text)",
                    background: "var(--mf-primary-soft)",
                    border: "1px solid var(--mf-primary-border)",
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {laneItems.length}
                </Box>
              </Box>

              <Box
                className="mf-kanban-lane-scroll"
                onScroll={(event) => {
                  if (isCompletedLane || remaining <= 0) return;
                  const target = event.currentTarget;
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 140) {
                    growLane(key, laneItems.length);
                  }
                }}
                sx={{
                  flex: "1 1 auto",
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  p: .75,
                  scrollbarGutter: "stable",
                }}
              >
                <Box sx={{ display: "grid", gap: .65 }}>
                  {laneItems.length === 0 ? (
                    <Box
                      sx={{
                        minHeight: 92,
                        display: "grid",
                        placeItems: "center",
                        textAlign: "center",
                        px: 1,
                        borderRadius: 2,
                        border: "1px dashed var(--mf-border)",
                        color: "var(--mf-text-muted)",
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      {column?.emptyText || emptyText}
                    </Box>
                  ) : visibleItems.map((item, index) => (
                    <Box key={item?.id || item?.requisitionId || item?.key || `${key}:${index}`}>
                      {renderCard?.(item, column)}
                    </Box>
                  ))}
                </Box>

                {laneItems.length > 0 && (
                  <Box sx={{ display: "grid", gap: .45, mt: .7, pb: .15 }}>
                    <Typography sx={{ ...subTextSx, textAlign: "center", fontSize: 9.4 }}>
                      {isCompletedLane && laneItems.length > renderLimit
                        ? `Showing ${renderLimit} most recent of ${laneItems.length}. Full completed history remains in Trackers.`
                        : `Showing ${renderLimit} of ${laneItems.length}`}
                    </Typography>
                    {!isCompletedLane && remaining > 0 && (
                      <Button
                        onClick={() => growLane(key, laneItems.length)}
                        sx={{ ...secondaryBtnSx, minHeight: 30, fontSize: 10.2 }}
                      >
                        Show {Math.min(loadMoreStep, remaining)} more
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

export function useMatFlowPagination(items, initialPageSize = 20) {
  const source = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState(
    Math.max(1, Number(initialPageSize) || 20)
  );

  const totalItems = source.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    // New filters / refreshed datasets should always reopen on page one.
    setPage(0);
  }, [items]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageItems = useMemo(() => {
    const start = safePage * pageSize;
    return source.slice(start, start + pageSize);
  }, [source, safePage, pageSize]);

  const setPageSize = useCallback((value) => {
    const next = Math.max(1, Number(value) || 20);
    setPageSizeState(next);
    setPage(0);
  }, []);

  return {
    page: safePage,
    pageSize,
    pageItems,
    totalItems,
    totalPages,
    setPage,
    setPageSize,
  };
}

export function MatFlowPagination({
  page = 0,
  pageSize = 20,
  totalItems = 0,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  label = "Records",
  compact = false,
}) {
  const count = Math.max(
    1,
    Number(totalPages) || Math.ceil(Number(totalItems || 0) / Math.max(1, Number(pageSize) || 20))
  );
  const safePage = Math.min(Math.max(0, Number(page) || 0), count - 1);
  const start = Number(totalItems || 0) === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(Number(totalItems || 0), (safePage + 1) * pageSize);

  if (Number(totalItems || 0) <= 0) return null;

  return (
    <Box
      sx={{
        mt: 1.15,
        px: compact ? 1 : 1.2,
        py: compact ? .75 : .9,
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: compact ? "auto 1fr" : "minmax(170px,.7fr) minmax(280px,1fr) auto",
        },
        alignItems: "center",
        gap: .9,
        border: "1px solid var(--mf-border)",
        borderRadius: "10px",
        background: "var(--mf-pagination-bg)",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: "var(--mf-text)",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: ".01em",
          }}
        >
          {label}
        </Typography>
        <Typography sx={{ ...subTextSx, mt: .15 }}>
          Showing {start.toLocaleString()}–{end.toLocaleString()} of{" "}
          {Number(totalItems || 0).toLocaleString()}
        </Typography>
      </Box>

      <Pagination
        count={count}
        page={safePage + 1}
        onChange={(_, value) => onPageChange?.(value - 1)}
        showFirstButton
        showLastButton
        siblingCount={compact ? 0 : 1}
        boundaryCount={1}
        size="small"
        shape="rounded"
        sx={{
          justifySelf: { xs: "start", md: "center" },
          "& .MuiPagination-ul": { flexWrap: "nowrap" },
          "& .MuiPaginationItem-root": {
            minWidth: 31,
            height: 31,
            borderRadius: "8px",
            color: "var(--mf-text-secondary)",
            border: "1px solid transparent",
            fontSize: 11,
            fontWeight: 850,
            transition: "all .14s ease",
            "&:hover": {
              color: "var(--mf-primary-text)",
              background: "var(--mf-primary-soft)",
              borderColor: "var(--mf-primary-border)",
            },
            "&.Mui-selected": {
              color: "#fff",
              background: "var(--mf-primary)",
              borderColor: "var(--mf-primary)",
              boxShadow: "0 4px 12px rgba(59,130,246,.20)",
              "&:hover": { background: "var(--mf-primary-hover)" },
            },
          },
        }}
      />

      {!compact && (
        <TextField
          select
          size="small"
          label="Rows"
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          sx={{
            ...fieldSx,
            minWidth: 94,
            justifySelf: { xs: "start", md: "end" },
            "& .MuiOutlinedInput-root": { ...fieldSx["& .MuiOutlinedInput-root"], minHeight: 34, height: 34 },
            "& .MuiSelect-select": { py: .7, pr: "30px !important" },
          }}
        >
          {pageSizeOptions.map((size) => (
            <MenuItem key={size} value={size}>{size}</MenuItem>
          ))}
        </TextField>
      )}
    </Box>
  );
}

export const scrollAreaSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--mf-scroll-thumb) var(--mf-scroll-track)",
  scrollbarGutter: "stable",
  "&::-webkit-scrollbar": { width: 10, height: 10 },
  "&::-webkit-scrollbar-track": {
    background: "var(--mf-scroll-track)",
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb": {
    border: "2px solid transparent",
    borderRadius: 999,
    background: "var(--mf-scroll-thumb)",
    backgroundClip: "padding-box",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: "var(--mf-scroll-thumb-hover)",
    backgroundClip: "padding-box",
  },
};

export const pageSx = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  color: "var(--mf-text)",
};
export const heroSx = {
  p: { xs: "16px", md: "19px 20px" },
  borderRadius: "14px",
  background: "var(--mf-hero-bg)",
  border: "1px solid var(--mf-border)",
  boxShadow: "var(--mf-shadow)",
};
export const heroBadgeSx = {
  height: 24,
  borderRadius: 999,
  background: "var(--mf-primary-soft)",
  color: "var(--mf-primary-text)",
  border: "1px solid var(--mf-primary-border)",
  fontWeight: 900,
  fontSize: 9.5,
  letterSpacing: ".08em",
};
export const heroTitleSx = {
  mt: 1.05,
  color: "var(--mf-text)",
  fontSize: { xs: 23, md: 29 },
  fontWeight: 950,
  lineHeight: 1.08,
  letterSpacing: "-.035em",
};
export const heroSubSx = {
  mt: .65,
  color: "var(--mf-text-secondary)",
  fontSize: 11.5,
  fontWeight: 650,
  lineHeight: 1.55,
  maxWidth: 920,
};
export const panelSx = {
  p: 1.8,
  borderRadius: "13px",
  color: "var(--mf-text)",
  backgroundColor: "var(--mf-card-bg)",
  backgroundImage: "none",
  border: "1px solid var(--mf-card-border)",
  boxShadow: "var(--mf-card-shadow)",
  opacity: 1,
};
export const panelTitleSx = { color: "var(--mf-text)", fontSize: 17, fontWeight: 950 };
export const sectionTitleSx = panelTitleSx;
export const sectionSubSx = { mt: .35, color: "var(--mf-text-muted)", fontSize: 11, fontWeight: 700 };
export const mainTextSx = { color: "var(--mf-text)", fontSize: 12, fontWeight: 850 };
export const subTextSx = { mt: .25, color: "var(--mf-text-muted)", fontSize: 10, fontWeight: 650 };
export const detailBoxSx = {
  p: 1.3,
  borderRadius: "10px",
  backgroundColor: "var(--mf-surface)",
  backgroundImage: "none",
  border: "1px solid var(--mf-card-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)",
  opacity: 1,
};
export const detailLabelSx = {
  color: "var(--mf-text-muted)",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".07em",
};
export const detailValueSx = { mt: .55, color: "var(--mf-text)", fontSize: 12, fontWeight: 850, wordBreak: "break-word" };
export const errorBoxSx = {
  p: "11px 13px",
  borderRadius: "9px",
  color: "var(--mf-danger-text)",
  background: "var(--mf-danger-soft)",
  border: "1px solid var(--mf-danger-border)",
  fontSize: 12,
  fontWeight: 750,
};
export const fieldSx = {
  "& .MuiInputLabel-root": { color: "var(--mf-text-muted)", fontSize: 12, fontWeight: 750 },
  "& .MuiOutlinedInput-root": {
    minHeight: 42,
    color: "var(--mf-text)",
    background: "var(--mf-field-bg)",
    borderRadius: "9px",
    fontSize: 12,
    fontWeight: 700,
    "& fieldset": { borderColor: "var(--mf-border)" },
    "&:hover fieldset": { borderColor: "var(--mf-border-strong)" },
    "&.Mui-focused fieldset": { borderColor: "var(--mf-primary)" },
  },
};
export const primaryBtnSx = {
  minHeight: 36,
  borderRadius: "8px",
  px: 1.6,
  textTransform: "none",
  fontWeight: 900,
  color: "#fff",
  background: "var(--mf-primary)",
  boxShadow: "none",
  "&:hover": { background: "var(--mf-primary-hover)", boxShadow: "none" },
};
export const secondaryBtnSx = {
  minHeight: 36,
  borderRadius: "8px",
  px: 1.35,
  textTransform: "none",
  fontWeight: 850,
  color: "var(--mf-text)",
  background: "var(--mf-panel-solid)",
  border: "1px solid var(--mf-border)",
  boxShadow: "none",
  "&:hover": { background: "var(--mf-hover)", borderColor: "var(--mf-border-strong)", boxShadow: "none" },
};
export const dangerBtnSx = {
  minHeight: 36,
  borderRadius: "8px",
  px: 1.25,
  textTransform: "none",
  fontWeight: 900,
  color: "var(--mf-danger-text)",
  background: "var(--mf-danger-soft)",
  border: "1px solid var(--mf-danger-border)",
  boxShadow: "none",
  "&:hover": {
    background: "var(--mf-danger-soft)",
    borderColor: "var(--mf-danger-text)",
    boxShadow: "0 0 0 2px var(--mf-danger-soft)",
  },
  "&.Mui-disabled": {
    color: "var(--mf-text-muted)",
    borderColor: "var(--mf-border)",
    background: "var(--mf-surface)",
  },
};

export const dangerSolidBtnSx = {
  minHeight: 38,
  borderRadius: "8px",
  px: 1.5,
  textTransform: "none",
  fontWeight: 950,
  color: "#fff",
  background: "#dc2626",
  border: "1px solid #dc2626",
  boxShadow: "none",
  "&:hover": { background: "#b91c1c", borderColor: "#b91c1c", boxShadow: "none" },
  "&.Mui-disabled": { color: "rgba(255,255,255,.65)", background: "#7f1d1d", borderColor: "#7f1d1d" },
};
export const tableShellSx = {
  ...scrollAreaSx,
  width: "100%",
  overflowX: "auto",
  scrollbarGutter: "stable",
  borderRadius: "10px",
  border: "1px solid var(--mf-card-border)",
  backgroundColor: "var(--mf-panel-solid)",
  backgroundImage: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.02)",
  opacity: 1,
};
export const tableHeaderSx = {
  minWidth: 980,
  display: "grid",
  alignItems: "center",
  background: "var(--mf-table-head)",
  color: "var(--mf-text-muted)",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".065em",
};
export const tableRowSx = {
  minWidth: 980,
  display: "grid",
  alignItems: "center",
  borderTop: "1px solid var(--mf-border)",
  background: "var(--mf-table-row)",
  color: "var(--mf-text-secondary)",
  transition: "background .14s ease",
  "&:hover": { background: "var(--mf-table-hover)" },
};
export const tableCellSx = {
  p: "10px 11px",
  color: "var(--mf-text-secondary)",
  fontSize: 11.5,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
export const emptySx = { minHeight: 160, display: "grid", placeItems: "center", textAlign: "center", p: 2.5, color: "var(--mf-text-muted)", fontSize: 12, fontWeight: 750 };
export const dialogPaperSx = {
  position: "relative",
  overflow: "hidden",
  borderRadius: { xs: "16px", sm: "20px" },
  color: "var(--mf-text)",
  backgroundColor: "var(--mf-panel-solid)",
  backgroundImage: "none",
  border: "1px solid var(--mf-border-strong)",
  boxShadow: "var(--mf-modal-shadow)",
  opacity: 1,
  isolation: "isolate",
  maxHeight: "calc(100dvh - 40px)",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: "0 0 auto 0",
    height: 3,
    background: "linear-gradient(90deg,var(--mf-primary),#8b5cf6,var(--mf-primary))",
    zIndex: 4,
    pointerEvents: "none",
  },
};

export const dialogTitleSx = {
  minHeight: 64,
  px: { xs: 2, sm: 2.5 },
  py: 1.8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1.5,
  fontWeight: 950,
  fontSize: { xs: 16, sm: 17 },
  lineHeight: 1.25,
  color: "var(--mf-text)",
  background: "var(--mf-modal-title-bg)",
  borderBottom: "1px solid var(--mf-border)",
  "& .MuiSvgIcon-root": {
    color: "var(--mf-primary-text)",
  },
};

export const dialogContentSx = {
  px: { xs: 2, sm: 2.5 },
  pt: "22px !important",
  pb: "22px !important",
  color: "var(--mf-text)",
  backgroundColor: "var(--mf-panel-solid)",
  backgroundImage: "none",
  overflowY: "auto",
  scrollbarGutter: "stable",
};

export const dialogActionsSx = {
  minHeight: 66,
  px: { xs: 2, sm: 2.5 },
  py: 1.5,
  gap: 1,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  borderTop: "1px solid var(--mf-border)",
  background: "var(--mf-modal-title-bg)",
};

export const dialogBackdropSx = {
  backgroundColor: "var(--mf-overlay) !important",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

export const drawerPaperSx = {
  color: "var(--mf-text)",
  backgroundColor: "var(--mf-panel-solid)",
  backgroundImage: "none",
  borderColor: "var(--mf-border-strong)",
  boxShadow: "var(--mf-modal-shadow)",
  opacity: 1,
};

/**
 * Consistent MatFlow destructive-action confirmation. Hard deletion is used
 * only for lifecycle states explicitly allowed by the backend.
 */
export function MatFlowDeleteDialog({
  open,
  title = "Delete record?",
  subject,
  description,
  working = false,
  confirmLabel = "Delete permanently",
  onClose,
  onConfirm,
}) {
  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !working && onClose?.()}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={dialogTitleSx}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 950, color: "var(--mf-text)" }}>
            {title}
          </Typography>
          <Typography sx={{ mt: .25, fontSize: 10.5, fontWeight: 850, color: "var(--mf-danger-text)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Controlled permanent deletion
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={dialogContentSx}>
        {subject && (
          <Box sx={{ mb: 1.25, p: 1.25, borderRadius: "10px", background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 950, color: "var(--mf-text)" }}>
              {subject}
            </Typography>
          </Box>
        )}
        <Box sx={{ p: 1.35, borderRadius: "10px", background: "var(--mf-danger-soft)", border: "1px solid var(--mf-danger-border)" }}>
          <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, fontWeight: 750, color: "var(--mf-danger-text)" }}>
            {description || "This setup record will be permanently removed. This action cannot be undone."}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button disabled={working} onClick={() => onClose?.()} sx={secondaryBtnSx}>
          Keep record
        </Button>
        <Button disabled={working} onClick={() => onConfirm?.()} sx={dangerSolidBtnSx}>
          {working ? "Deleting..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const MATFLOW_MATERIAL_CATEGORIES = Object.freeze([
  ["RAW_MATERIAL", "Raw Material", "#64748b"],
  ["METAL", "Metal", "#60a5fa"],
  ["WOOD", "Wood", "#8b5cf6"],
  ["VENEER", "Veneer", "#c084fc"],
  ["STONE_TILE", "Stone / Tile", "#14b8a6"],
  ["HARDWARE", "Hardware", "#f59e0b"],
  ["UPHOLSTERY", "Upholstery", "#ec4899"],
  ["FABRIC_LEATHER", "Fabric / Leather", "#f472b6"],
  ["FOAM", "Foam", "#fb7185"],
  ["GLASS_MIRROR", "Glass / Mirror", "#38bdf8"],
  ["LAMINATE", "Laminate", "#a78bfa"],
  ["PAINT_POLISH", "Paint / Polish", "#f472b6"],
  ["ADHESIVE_CHEMICAL", "Adhesive / Chemical", "#fb923c"],
  ["ELECTRICAL", "Electrical", "#facc15"],
  ["PACKAGING", "Packaging", "#22c55e"],
  ["OTHER", "Other", "#94a3b8"],
].map(([value, label, color], order) => ({ value, label, color, order })));
const categoryMap = new Map(MATFLOW_MATERIAL_CATEGORIES.map((item) => [item.value, item]));
export const normalizeMatFlowCategory = (value) => normalize(value) || "OTHER";
export const getMatFlowCategoryMeta = (value) => {
  const key = normalizeMatFlowCategory(value);
  return categoryMap.get(key) || { value: key, label: readable(key), color: "#94a3b8", order: 999 };
};

export function ActionButton({ children, secondary = false, ...props }) {
  return <Button sx={secondary ? secondaryBtnSx : primaryBtnSx} {...props}>{children}</Button>;
}


/* ============================================================
 * PROFESSIONAL TRACKER TIMING HELPERS
 * ============================================================ */
export const formatDurationMinutes = (value) => {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const hourRest = hours % 24;
  return hourRest ? `${days}d ${hourRest}h` : `${days}d`;
};

export const durationMinutesBetween = (start, end = new Date()) => {
  if (!start) return 0;
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 60000));
};

export function TimingHealthChip({ health }) {
  const value = normalize(health || "NOT_STARTED");
  const danger = ["BREACHED", "COMPLETED_LATE"].includes(value);
  const warning = value === "WATCH";
  const success = ["ON_TRACK", "COMPLETED"].includes(value);
  const label = readable(value);
  return <Chip
    size="small"
    label={label}
    sx={{
      height: 24,
      fontSize: 10,
      fontWeight: 900,
      border: danger ? "1px solid var(--mf-danger-border)" : warning ? "1px solid var(--mf-warning-border)" : success ? "1px solid var(--mf-success-border)" : "1px solid var(--mf-border)",
      color: danger ? "var(--mf-danger-text)" : warning ? "var(--mf-warning-text)" : success ? "var(--mf-success-text)" : "var(--mf-text-muted)",
      background: danger ? "var(--mf-danger-soft)" : warning ? "var(--mf-warning-soft)" : success ? "var(--mf-success-soft)" : "var(--mf-surface)",
    }}
  />;
}

export function TrackerTimingStrip({ startAt, endAt, durationMinutes, targetMinutes, health, department, plant }) {
  const elapsed = durationMinutes != null ? Number(durationMinutes) : durationMinutesBetween(startAt, endAt || new Date());
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(5,minmax(0,1fr))" }, gap: .75 }}>
    <Detail label="Department" value={department || "-"} />
    <Detail label="Plant / Custody" value={plant || "-"} />
    <Detail label="Started" value={startAt ? formatDate(startAt) : "Not started"} />
    <Detail label="Elapsed" value={formatDurationMinutes(elapsed)} />
    <Detail label="Timing" value={<Box sx={{ display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}><TimingHealthChip health={health} />{Number(targetMinutes || 0) > 0 && <Typography sx={subTextSx}>Target {formatDurationMinutes(targetMinutes)}</Typography>}</Box>} />
  </Box>;
}
