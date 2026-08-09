import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    ScopedCssBaseline,
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
        "--mf-page-bg": dark ? "#07111f" : "#f4f7fb",
        "--mf-panel-bg": dark ? "rgba(15,23,42,.90)" : "rgba(255,255,255,.98)",
        "--mf-panel-solid": dark ? "#0f172a" : "#fff",
        "--mf-surface": dark ? "rgba(2,6,23,.36)" : "rgba(241,245,249,.94)",
        "--mf-surface-strong": dark ? "rgba(2,6,23,.58)" : "rgba(226,232,240,.95)",
        "--mf-field-bg": dark ? "rgba(255,255,255,.04)" : "#fff",
        "--mf-hover": dark ? "rgba(14,165,233,.10)" : "rgba(37,99,235,.07)",
        "--mf-text": dark ? "#f8fafc" : "#0f172a",
        "--mf-text-secondary": dark ? "rgba(248,250,252,.70)" : "rgba(15,23,42,.72)",
        "--mf-text-muted": dark ? "rgba(248,250,252,.48)" : "rgba(15,23,42,.50)",
        "--mf-border": dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.11)",
        "--mf-border-strong": dark ? "rgba(255,255,255,.16)" : "rgba(15,23,42,.20)",
        "--mf-shadow": dark ? "0 16px 36px rgba(2,6,23,.28)" : "0 14px 30px rgba(15,23,42,.08)",
        "--mf-sidebar-bg": dark
            ? "linear-gradient(180deg,#06111f,#081629)"
            : "linear-gradient(180deg,#ffffff,#edf3fa)",
        "--mf-header-bg": dark
            ? "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))"
            : "linear-gradient(180deg,rgba(255,255,255,.98),rgba(245,248,252,.97))",
        "--mf-hero-bg": dark
            ? "radial-gradient(circle at top left,rgba(14,165,233,.20),transparent 34%),linear-gradient(180deg,rgba(15,23,42,.94),rgba(15,23,42,.80))"
            : "radial-gradient(circle at top left,rgba(37,99,235,.13),transparent 36%),linear-gradient(180deg,#fff,#f1f5f9)",
    };
};

const buildTheme = (mode) =>
    createTheme({
        palette: {
            mode,
            primary: { main: mode === "dark" ? "#60a5fa" : "#2563eb" },
            secondary: { main: mode === "dark" ? "#a78bfa" : "#7c3aed" },
            background: {
                default: mode === "dark" ? "#07111f" : "#f3f6fb",
                paper: mode === "dark" ? "#0f172a" : "#fff",
            },
            success: { main: "#16a34a" },
            warning: { main: "#f59e0b" },
            error: { main: "#dc2626" },
            info: { main: "#0284c7" },
        },
        typography: {
            fontFamily: "Inter, Roboto, Arial, sans-serif",
            button: { textTransform: "none", fontWeight: 800 },
        },
        shape: { borderRadius: 12 },
        components: {
            MuiCard: { styleOverrides: { root: { backgroundImage: "none" } } },
            MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
            MuiButton: { defaultProps: { disableElevation: true } },
        },
    });

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
                        "& *": { boxSizing: "border-box", scrollbarWidth: "thin" },
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
    ADMIN:
        "ADMIN",

    MANAGER:
        "MATFLOW_MANAGER",

    ENGINEERING:
        "MATFLOW_ENGINEERING",

    STORE:
        "MATFLOW_STORE",

    PURCHASE:
        "MATFLOW_PURCHASE",

    PROCESSING:
        "MATFLOW_PROCESSING",

    PRODUCTION:
        "MATFLOW_PRODUCTION",

    QC:
        "MATFLOW_QC",

    DIRECTOR:
        "MATFLOW_DIRECTOR",
});


const ALL_MATFLOW_ROLES =
    Object.freeze(
        Object.values(
            MATFLOW_ROLES
        )
    );


const normalizeMatFlowRole = (
    role
) => {
    return String(
        role ?? ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /^ROLE_/,
            ""
        );
};


export const getMatFlowRole = (
    role
) => {
    return normalizeMatFlowRole(
        role
    );
};


export const hasMatFlowRole = (
    role
) => {
    return ALL_MATFLOW_ROLES.includes(
        getMatFlowRole(
            role
        )
    );
};


/*
 * =========================================================
 * MATFLOW SCREEN ACCESS
 * =========================================================
 *
 * IMPORTANT:
 *
 * These are frontend visibility rules.
 *
 * Backend MatFlowAccessService remains the final
 * authorization authority.
 */
const MATFLOW_SCREEN_ROLES =
    Object.freeze({

        /*
         * -------------------------------------------------
         * SHARED READ WORKSPACES
         * -------------------------------------------------
         */

        dashboard:
            ALL_MATFLOW_ROLES,

        tracking:
            ALL_MATFLOW_ROLES,


        /*
         * -------------------------------------------------
         * MASTER DATA
         * -------------------------------------------------
         */

        projects: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        materials: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.QC,
        ],

        locations: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
        ],


        /*
         * -------------------------------------------------
         * OPERATIONAL BOM
         * -------------------------------------------------
         */

        boms: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        "bom-create": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
        ],

        "bom-edit": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.ENGINEERING,
        ],

        /*
         * Direct Production review.
         *
         * NO HOD approval stage.
         */
        "bom-review": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
        ],


        /*
         * -------------------------------------------------
         * PRODUCTION REQUISITION
         * -------------------------------------------------
         */

        production: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.STORE,
        ],

        "production-execution": [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PRODUCTION,
        ],


        /*
         * -------------------------------------------------
         * STORE
         * -------------------------------------------------
         */

        store: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
        ],


        /*
         * -------------------------------------------------
         * MOVEMENT
         * -------------------------------------------------
         */

        transfers: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PROCESSING,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.PRODUCTION,
        ],

        returns: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PRODUCTION,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.PROCESSING,
        ],


        /*
         * -------------------------------------------------
         * PROCUREMENT
         * -------------------------------------------------
         */

        purchase: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        approvals: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.DIRECTOR,
        ],

        receiving: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.PURCHASE,
            MATFLOW_ROLES.QC,
        ],


        /*
         * -------------------------------------------------
         * QC / PROCESSING
         * -------------------------------------------------
         */

        qc: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.QC,
            MATFLOW_ROLES.STORE,
        ],

        processing: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.PROCESSING,
        ],


        /*
         * -------------------------------------------------
         * REPORTING
         * -------------------------------------------------
         */

        ledger: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.STORE,
            MATFLOW_ROLES.DIRECTOR,
        ],

        reports: [
            MATFLOW_ROLES.ADMIN,
            MATFLOW_ROLES.MANAGER,
            MATFLOW_ROLES.DIRECTOR,
        ],
    });


export const canAccessMatFlowScreen = (
    screen,
    role
) => {
    const cleanRole =
        getMatFlowRole(
            role
        );

    /*
     * ADMIN always has complete MatFlow access.
     */
    if (
        cleanRole ===
        MATFLOW_ROLES.ADMIN
    ) {
        return true;
    }

    /*
     * Prevent a PackFlow/BOMFlow role from accidentally
     * receiving MatFlow screen access.
     */
    if (
        !hasMatFlowRole(
            cleanRole
        )
    ) {
        return false;
    }

    const allowedRoles =
        MATFLOW_SCREEN_ROLES[
        screen
        ];

    if (
        !Array.isArray(
            allowedRoles
        )
    ) {
        return false;
    }

    return allowedRoles.includes(
        cleanRole
    );
};


export const matFlowRoleLabel = (
    role
) => {
    const cleanRole =
        getMatFlowRole(
            role
        );

    switch (
    cleanRole
    ) {
        case MATFLOW_ROLES.ADMIN:
            return "Administrator";

        case MATFLOW_ROLES.MANAGER:
            return "MatFlow Manager";

        case MATFLOW_ROLES.ENGINEERING:
            return "Engineering";

        case MATFLOW_ROLES.STORE:
            return "Stores";

        case MATFLOW_ROLES.PURCHASE:
            return "Purchase";

        case MATFLOW_ROLES.PROCESSING:
            return "Processing";

        case MATFLOW_ROLES.PRODUCTION:
            return "Production";

        case MATFLOW_ROLES.QC:
            return "Quality Control";

        case MATFLOW_ROLES.DIRECTOR:
            return "Director";

        default:
            return "MatFlow User";
    }
};


export const defaultMatFlowPathForRole = (
    role
) => {
    const cleanRole =
        getMatFlowRole(
            role
        );

    switch (
    cleanRole
    ) {
        case MATFLOW_ROLES.ADMIN:
        case MATFLOW_ROLES.MANAGER:
            return "/matflow/dashboard";

        case MATFLOW_ROLES.ENGINEERING:
            return "/matflow/boms";

        case MATFLOW_ROLES.STORE:
            return "/matflow/store";

        case MATFLOW_ROLES.PURCHASE:
            return "/matflow/purchase";

        case MATFLOW_ROLES.PROCESSING:
            return "/matflow/processing";

        case MATFLOW_ROLES.PRODUCTION:
            return "/matflow/production";

        case MATFLOW_ROLES.QC:
            return "/matflow/qc";

        case MATFLOW_ROLES.DIRECTOR:
            return "/matflow/approvals";

        default:
            return "/modules";
    }
};

const MatFlowContext = createContext(null);
const MATFLOW_PLANT_KEY = "matflowSelectedPlant";
const ALL_PLANTS = "ALL";
const normalizePlants = (values) => Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean))).sort();

export function useMatFlow() {
    const context = useContext(MatFlowContext);
    if (!context) throw new Error("useMatFlow must be used inside MatFlowProvider");
    return context;
}

export function MatFlowProvider({ children }) {
    const { user, role, plantCode, plantCodes } = useAuth();
    const availablePlants = useMemo(() => normalizePlants([
        ...(Array.isArray(plantCodes) ? plantCodes : []),
        ...(Array.isArray(user?.plantCodes) ? user.plantCodes : []),
        plantCode,
        user?.plantCode,
    ]), [plantCode, plantCodes, user?.plantCode, user?.plantCodes]);

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
        const accepted = normalized === ALL_PLANTS || availablePlants.includes(normalized) ? normalized : ALL_PLANTS;
        setPlantState(accepted);
        try { window.localStorage.setItem(MATFLOW_PLANT_KEY, accepted); } catch { /* ignore */ }
    }, [availablePlants]);

    const contextValue = useMemo(() => ({
        availablePlants,
        selectedPlantCode,
        selectedPlantParam: selectedPlantCode === ALL_PLANTS ? undefined : selectedPlantCode,
        allPlantsSelected: selectedPlantCode === ALL_PLANTS,
        setSelectedPlantCode,
        role: getMatFlowRole(role || user?.role),
    }), [availablePlants, selectedPlantCode, setSelectedPlantCode, role, user?.role]);

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
    "ISSUED", "ISSUED_TO_PRODUCTION", "PRODUCTION_COMPLETED", "COMPLETED", "CLOSED", "PLACED",
]);
const danger = new Set(["REJECTED", "CANCELLED", "FAILED"]);
const purple = new Set(["SUPERSEDED", "IN_TRANSIT", "IN_PROCESSING", "PRODUCTION_STARTED"]);

export function MatFlowStatusChip({ status }) {
    const value = normalize(status) || "UNKNOWN";
    let tone = {
        color: "#7dd3fc",
        background: "rgba(14,165,233,.13)",
        border: "1px solid rgba(14,165,233,.24)",
    };
    if (success.has(value)) {
        tone = { color: "#4ade80", background: "rgba(34,197,94,.13)", border: "1px solid rgba(34,197,94,.24)" };
    } else if (danger.has(value)) {
        tone = { color: "#fca5a5", background: "rgba(239,68,68,.13)", border: "1px solid rgba(239,68,68,.24)" };
    } else if (purple.has(value)) {
        tone = { color: "#c4b5fd", background: "rgba(139,92,246,.13)", border: "1px solid rgba(139,92,246,.24)" };
    } else if (
        value === "DRAFT" || value === "SUBMITTED" || value === "SUBMITTED_TO_STORE" ||
        value === "STORE_REVIEW_IN_PROGRESS" || value === "SHORTAGE_PENDING" ||
        value === "QC_PENDING" || value.startsWith("PARTIALLY_") || value.startsWith("PENDING_")
    ) {
        tone = { color: "#fbbf24", background: "rgba(245,158,11,.13)", border: "1px solid rgba(245,158,11,.24)" };
    }

    return (
        <Chip
            label={readable(value) || "Unknown"}
            size="small"
            sx={{ height: 24, borderRadius: 999, fontSize: 10, fontWeight: 900, ...tone }}
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
export function SummaryCard({ label, value, helper }) {
    return (
        <Card sx={panelSx}>
            <Typography sx={detailLabelSx}>{label}</Typography>
            <Box sx={{ mt: .75, fontSize: 19, fontWeight: 950, color: "var(--mf-text)" }}>{value ?? "-"}</Box>
            {helper && <Typography sx={subTextSx}>{helper}</Typography>}
        </Card>
    );
}

export const pageSx = { width: "100%", display: "flex", flexDirection: "column", gap: "14px", color: "var(--mf-text)" };
export const heroSx = { p: { xs: "16px", md: "20px" }, borderRadius: "14px", background: "var(--mf-hero-bg)", border: "1px solid var(--mf-border)", boxShadow: "var(--mf-shadow)" };
export const heroBadgeSx = { height: 26, borderRadius: 999, background: "rgba(14,165,233,.12)", color: "#38bdf8", border: "1px solid rgba(14,165,233,.25)", fontWeight: 900, fontSize: 10, letterSpacing: ".08em" };
export const heroTitleSx = { mt: 1.15, color: "var(--mf-text)", fontSize: { xs: 24, md: 31 }, fontWeight: 950, lineHeight: 1.08, letterSpacing: "-.04em" };
export const heroSubSx = { mt: .75, color: "var(--mf-text-secondary)", fontSize: 12, fontWeight: 650, lineHeight: 1.55, maxWidth: 900 };
export const panelSx = { p: 1.9, borderRadius: "12px", color: "var(--mf-text)", background: "var(--mf-panel-bg)", border: "1px solid var(--mf-border)", boxShadow: "var(--mf-shadow)", backgroundImage: "none" };
export const panelTitleSx = { color: "var(--mf-text)", fontSize: 17, fontWeight: 950 };
export const sectionTitleSx = panelTitleSx;
export const sectionSubSx = { mt: .35, color: "var(--mf-text-muted)", fontSize: 11, fontWeight: 700 };
export const mainTextSx = { color: "var(--mf-text)", fontSize: 12, fontWeight: 850 };
export const subTextSx = { mt: .25, color: "var(--mf-text-muted)", fontSize: 10, fontWeight: 650 };
export const detailBoxSx = { p: 1.35, borderRadius: "9px", background: "var(--mf-surface)", border: "1px solid var(--mf-border)" };
export const detailLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".07em" };
export const detailValueSx = { mt: .6, color: "var(--mf-text)", fontSize: 12, fontWeight: 850, wordBreak: "break-word" };
export const errorBoxSx = { p: "11px 13px", borderRadius: "9px", color: "#fca5a5", background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.24)", fontSize: 12, fontWeight: 750 };
export const fieldSx = {
    "& .MuiInputLabel-root": { color: "var(--mf-text-muted)", fontSize: 12, fontWeight: 750 },
    "& .MuiOutlinedInput-root": {
        minHeight: 44, color: "var(--mf-text)", background: "var(--mf-field-bg)", borderRadius: "9px", fontSize: 12, fontWeight: 700,
        "& fieldset": { borderColor: "var(--mf-border)" },
        "&:hover fieldset": { borderColor: "var(--mf-border-strong)" },
    },
};
export const primaryBtnSx = { minHeight: 38, borderRadius: "9px", textTransform: "none", fontWeight: 900, color: "#fff", background: "linear-gradient(135deg,#0284c7,#0ea5e9)", "&:hover": { background: "linear-gradient(135deg,#0369a1,#0284c7)" } };
export const secondaryBtnSx = { minHeight: 38, borderRadius: "9px", textTransform: "none", fontWeight: 850, color: "var(--mf-text)", background: "var(--mf-surface)", border: "1px solid var(--mf-border)", "&:hover": { background: "var(--mf-hover)", borderColor: "var(--mf-border-strong)" } };
export const tableShellSx = { width: "100%", overflowX: "auto", borderRadius: "10px", border: "1px solid var(--mf-border)", background: "var(--mf-panel-solid)" };
export const tableHeaderSx = { minWidth: 980, display: "grid", alignItems: "center", background: "var(--mf-surface-strong)", color: "var(--mf-text-muted)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".07em" };
export const tableRowSx = { minWidth: 980, display: "grid", alignItems: "center", borderTop: "1px solid var(--mf-border)", background: "var(--mf-panel-bg)", color: "var(--mf-text-secondary)", "&:hover": { background: "var(--mf-hover)" } };
export const tableCellSx = { p: "11px 12px", color: "var(--mf-text-secondary)", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
export const emptySx = { minHeight: 160, display: "grid", placeItems: "center", textAlign: "center", p: 2.5, color: "var(--mf-text-muted)", fontSize: 12, fontWeight: 750 };
export const dialogPaperSx = { borderRadius: "14px", backgroundImage: "none" };
export const dialogTitleSx = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, fontWeight: 950, borderBottom: "1px solid", borderColor: "divider" };
export const dialogContentSx = { pt: "18px !important" };
export const dialogActionsSx = { p: "14px 24px 20px", borderTop: "1px solid", borderColor: "divider" };

export const MATFLOW_MATERIAL_CATEGORIES = Object.freeze([
    ["METAL", "Metal", "#60a5fa"], ["WOOD", "Wood", "#8b5cf6"], ["HARDWARE", "Hardware", "#f59e0b"],
    ["STONE", "Stone", "#14b8a6"], ["GLASS", "Glass / Mirror", "#38bdf8"], ["UPHOLSTERY", "Upholstery", "#ec4899"],
    ["PAINT", "Paint / Polish", "#f472b6"], ["LAMINATE", "Laminate", "#a78bfa"], ["VENEER", "Veneer", "#c084fc"],
    ["ADHESIVE", "Adhesive", "#fb923c"], ["ELECTRICAL", "Electrical", "#facc15"], ["PACKAGING", "Packaging", "#22c55e"],
    ["CONSUMABLE", "Consumable", "#2dd4bf"], ["MISCELLANEOUS", "Miscellaneous", "#94a3b8"],
].map(([value, label, color], order) => ({ value, label, color, order })));
const categoryMap = new Map(MATFLOW_MATERIAL_CATEGORIES.map((item) => [item.value, item]));
export const normalizeMatFlowCategory = (value) => normalize(value) || "MISCELLANEOUS";
export const getMatFlowCategoryMeta = (value) => {
    const key = normalizeMatFlowCategory(value);
    return categoryMap.get(key) || { value: key, label: readable(key), color: "#94a3b8", order: 999 };
};

export function ActionButton({ children, secondary = false, ...props }) {
    return <Button sx={secondary ? secondaryBtnSx : primaryBtnSx} {...props}>{children}</Button>;
}
