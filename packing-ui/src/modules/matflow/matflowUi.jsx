import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
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
    "--mf-panel-bg": dark ? "rgba(15,23,42,.90)" : "#ffffff",
    "--mf-panel-solid": dark ? "#0f172a" : "#ffffff",
    "--mf-surface": dark ? "rgba(2,6,23,.36)" : "#f8fafd",
    "--mf-surface-strong": dark ? "rgba(2,6,23,.58)" : "#f3f6fb",
    "--mf-field-bg": dark ? "rgba(255,255,255,.04)" : "#ffffff",
    "--mf-hover": dark ? "rgba(14,165,233,.10)" : "#f2f7ff",
    "--mf-text": dark ? "#f8fafc" : "#172033",
    "--mf-text-secondary": dark ? "rgba(248,250,252,.70)" : "#55627a",
    "--mf-text-muted": dark ? "rgba(248,250,252,.48)" : "#8a96aa",
    "--mf-border": dark ? "rgba(255,255,255,.08)" : "#e5ebf4",
    "--mf-border-strong": dark ? "rgba(255,255,255,.16)" : "#d6e0ee",
    "--mf-shadow": dark
      ? "0 16px 36px rgba(2,6,23,.28)"
      : "0 4px 16px rgba(39,71,117,.055)",

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
    "--mf-table-head": dark ? "rgba(2,6,23,.58)" : "#f7f9fc",
    "--mf-table-row": dark ? "rgba(15,23,42,.90)" : "#ffffff",
    "--mf-table-hover": dark ? "rgba(14,165,233,.10)" : "#f7faff",

    // Scrollbar / pagination chrome
    "--mf-scroll-track": dark ? "rgba(255,255,255,.025)" : "rgba(15,23,42,.035)",
    "--mf-scroll-thumb": dark ? "rgba(96,165,250,.46)" : "rgba(59,130,246,.42)",
    "--mf-scroll-thumb-hover": dark ? "rgba(125,211,252,.78)" : "rgba(37,99,235,.68)",
    "--mf-scroll-corner": dark ? "#081424" : "#eef3f9",
    "--mf-pagination-bg": dark ? "rgba(2,6,23,.30)" : "#f8fafd",
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
            backgroundImage: "none",
            ...(dark ? {} : { borderColor: "#e5ebf4" }),
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
      MuiMenu: {
        styleOverrides: {
          paper: dark ? {} : {
            border: "1px solid #e5ebf4",
            boxShadow: "0 12px 30px rgba(39,71,117,.12)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: dark ? {} : {
            border: "1px solid #e5ebf4",
            boxShadow: "0 24px 60px rgba(39,71,117,.16)",
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
  locations: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE],
  boms: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.STORE, MATFLOW_ROLES.DIRECTOR],
  "bom-create": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING],
  "bom-edit": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING],
  "bom-review": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.DIRECTOR],
  production: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.STORE],
  "production-execution": [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION],
  store: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE],
  transfers: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PROCESSING, MATFLOW_ROLES.QC, MATFLOW_ROLES.PRODUCTION],
  returns: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PRODUCTION, MATFLOW_ROLES.QC, MATFLOW_ROLES.PROCESSING],
  purchase: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PURCHASE, MATFLOW_ROLES.DIRECTOR],
  approvals: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR],
  receiving: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE, MATFLOW_ROLES.QC],
  qc: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.QC, MATFLOW_ROLES.STORE, MATFLOW_ROLES.PURCHASE],
  processing: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PROCESSING],
  ledger: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.STORE, MATFLOW_ROLES.DIRECTOR],
  reports: [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.DIRECTOR],
});

export const canAccessMatFlowScreen = (screen, roleOrRoles) => {
  const roles = getMatFlowRoles(roleOrRoles);
  if (roles.includes(MATFLOW_ROLES.ADMIN)) return true;
  const allowed = MATFLOW_SCREEN_ROLES[screen];
  return Array.isArray(allowed) && roles.some((role) => allowed.includes(role));
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
  if (roles.includes(MATFLOW_ROLES.ADMIN) || roles.includes(MATFLOW_ROLES.MANAGER)) return "/matflow/dashboard";
  if (roles.includes(MATFLOW_ROLES.DIRECTOR)) return "/matflow/projects";
  if (roles.includes(MATFLOW_ROLES.ENGINEERING)) return "/matflow/boms";
  if (roles.includes(MATFLOW_ROLES.PRODUCTION)) return "/matflow/production";
  if (roles.includes(MATFLOW_ROLES.STORE)) return "/matflow/store";
  if (roles.includes(MATFLOW_ROLES.PURCHASE)) return "/matflow/purchase";
  if (roles.includes(MATFLOW_ROLES.QC)) return "/matflow/qc";
  if (roles.includes(MATFLOW_ROLES.PROCESSING)) return "/matflow/processing";
  return "/modules";
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

  const [selectedPlantCode, setPlantState] = useState(() => {
    try { return window.localStorage.getItem(MATFLOW_PLANT_KEY) || ALL_PLANTS; }
    catch { return ALL_PLANTS; }
  });

  useEffect(() => {
    if (selectedPlantCode !== ALL_PLANTS && !availablePlants.includes(selectedPlantCode)) {
      setPlantState(ALL_PLANTS);
      try { window.localStorage.setItem(MATFLOW_PLANT_KEY, ALL_PLANTS); } catch { /* ignore */ }
    }
  }, [availablePlants, selectedPlantCode]);

  const setSelectedPlantCode = useCallback((value) => {
    const normalized = String(value || ALL_PLANTS).trim().toUpperCase();
    const accepted = normalized === ALL_PLANTS || availablePlants.includes(normalized)
      ? normalized : ALL_PLANTS;
    setPlantState(accepted);
    try { window.localStorage.setItem(MATFLOW_PLANT_KEY, accepted); } catch { /* ignore */ }
  }, [availablePlants]);

  const hasRole = useCallback((...allowed) => {
    const requested = allowed.flat().map(normalizeRole);
    return effectiveRoles.some((item) => requested.includes(item));
  }, [effectiveRoles]);

  const contextValue = useMemo(() => ({
    availablePlants,
    selectedPlantCode,
    selectedPlantParam: selectedPlantCode === ALL_PLANTS ? undefined : selectedPlantCode,
    allPlantsSelected: selectedPlantCode === ALL_PLANTS,
    setSelectedPlantCode,
    roles: effectiveRoles,
    role: getMatFlowRole(effectiveRoles),
    hasRole,
  }), [availablePlants, selectedPlantCode, setSelectedPlantCode, effectiveRoles, hasRole]);

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
const LIGHT_SUMMARY_TONES = Object.freeze({
  blue: { from: "#4f86f7", to: "#5f9dfb", soft: "#eef4ff", accent: "#4f86f7" },
  purple: { from: "#8a5cf6", to: "#a46ee8", soft: "#f4efff", accent: "#8b5cf6" },
  orange: { from: "#ff8a4c", to: "#ffb449", soft: "#fff4ea", accent: "#fb923c" },
  pink: { from: "#e94f8f", to: "#f36fa6", soft: "#fff0f6", accent: "#ec4899" },
  green: { from: "#28b77a", to: "#55c9b0", soft: "#ecfbf5", accent: "#10b981" },
  indigo: { from: "#6667e8", to: "#8a6ae8", soft: "#f1f0ff", accent: "#6366f1" },
  sky: { from: "#48aaf7", to: "#65c4f4", soft: "#edf8ff", accent: "#38bdf8" },
  amber: { from: "#f39a33", to: "#f7bc4a", soft: "#fff8e9", accent: "#f59e0b" },
});
const SUMMARY_TONE_KEYS = Object.keys(LIGHT_SUMMARY_TONES);
const summaryToneFor = (label, requestedTone) => {
  if (requestedTone && LIGHT_SUMMARY_TONES[requestedTone]) return LIGHT_SUMMARY_TONES[requestedTone];
  const score = Array.from(String(label || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return LIGHT_SUMMARY_TONES[SUMMARY_TONE_KEYS[score % SUMMARY_TONE_KEYS.length]];
};

export function SummaryCard({ label, value, helper, tone, colorful = false }) {
  const { isDark } = useMatFlowTheme();
  const meta = summaryToneFor(label, tone);
  const lightColorful = !isDark && colorful;

  return (
    <Card
      sx={{
        ...panelSx,
        position: "relative",
        overflow: "hidden",
        minHeight: lightColorful ? 104 : undefined,
        ...(isDark ? {} : lightColorful ? {
          color: "#fff",
          border: "1px solid rgba(255,255,255,.34)",
          background: `linear-gradient(135deg,${meta.from},${meta.to})`,
          boxShadow: "0 10px 22px rgba(50,92,160,.12)",
        } : {
          borderTop: `3px solid ${meta.accent}`,
          background: "#ffffff",
        }),
      }}
    >
      <Typography sx={{ ...detailLabelSx, color: lightColorful ? "rgba(255,255,255,.82)" : detailLabelSx.color }}>{label}</Typography>
      <Box sx={{ mt: .75, fontSize: lightColorful ? 24 : 19, fontWeight: 950, color: lightColorful ? "#fff" : "var(--mf-text)", lineHeight: 1.1 }}>{value ?? "-"}</Box>
      {helper && <Typography sx={{ ...subTextSx, color: lightColorful ? "rgba(255,255,255,.84)" : subTextSx.color }}>{helper}</Typography>}
      {lightColorful && <Box sx={{ position: "absolute", width: 92, height: 92, borderRadius: "50%", right: -34, bottom: -46, background: "rgba(255,255,255,.12)" }} />}
    </Card>
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
  borderRadius: "12px",
  color: "var(--mf-text)",
  background: "var(--mf-panel-bg)",
  border: "1px solid var(--mf-border)",
  boxShadow: "var(--mf-shadow)",
  backgroundImage: "none",
};
export const panelTitleSx = { color: "var(--mf-text)", fontSize: 17, fontWeight: 950 };
export const sectionTitleSx = panelTitleSx;
export const sectionSubSx = { mt: .35, color: "var(--mf-text-muted)", fontSize: 11, fontWeight: 700 };
export const mainTextSx = { color: "var(--mf-text)", fontSize: 12, fontWeight: 850 };
export const subTextSx = { mt: .25, color: "var(--mf-text-muted)", fontSize: 10, fontWeight: 650 };
export const detailBoxSx = {
  p: 1.3,
  borderRadius: "9px",
  background: "var(--mf-surface)",
  border: "1px solid var(--mf-border)",
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
export const tableShellSx = {
  ...scrollAreaSx,
  width: "100%",
  overflowX: "auto",
  scrollbarGutter: "stable",
  borderRadius: "10px",
  border: "1px solid var(--mf-border)",
  background: "var(--mf-panel-solid)",
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
export const dialogPaperSx = { borderRadius: "14px", background: "var(--mf-panel-solid)", backgroundImage: "none", border: "1px solid var(--mf-border)" };
export const dialogTitleSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, fontWeight: 950, color: "var(--mf-text)", borderBottom: "1px solid var(--mf-border)" };
export const dialogContentSx = { pt: "18px !important", background: "var(--mf-panel-solid)" };
export const dialogActionsSx = { p: "14px 24px 20px", borderTop: "1px solid var(--mf-border)", background: "var(--mf-panel-solid)" };

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

export function TrackerTimingStrip({ startAt, endAt, durationMinutes, targetMinutes, health, department, location }) {
  const elapsed = durationMinutes != null ? Number(durationMinutes) : durationMinutesBetween(startAt, endAt || new Date());
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(5,minmax(0,1fr))" }, gap: .75 }}>
    <Detail label="Department" value={department || "-"} />
    <Detail label="Location" value={location || "-"} />
    <Detail label="Started" value={startAt ? formatDate(startAt) : "Not started"} />
    <Detail label="Elapsed" value={formatDurationMinutes(elapsed)} />
    <Detail label="Timing" value={<Box sx={{ display: "flex", gap: .6, alignItems: "center", flexWrap: "wrap" }}><TimingHealthChip health={health} />{Number(targetMinutes || 0) > 0 && <Typography sx={subTextSx}>Target {formatDurationMinutes(targetMinutes)}</Typography>}</Box>} />
  </Box>;
}
