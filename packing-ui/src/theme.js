import {
    alpha,
    createTheme,
} from "@mui/material/styles";

export const createPackFlowTheme = (mode = "dark") => {
    const isDark = mode !== "light";

    const backgroundDefault = isDark ? "#020617" : "#f4f7fb";
    const backgroundPaper = isDark ? "#0f172a" : "#ffffff";
    const textPrimary = isDark ? "#f8fafc" : "#0f172a";
    const textSecondary = isDark ? "#94a3b8" : "#64748b";

    return createTheme({
        palette: {
            mode: isDark ? "dark" : "light",
            primary: {
                main: "#3b82f6",
                dark: "#2563eb",
                light: "#60a5fa",
                contrastText: "#ffffff",
            },
            secondary: { main: "#06b6d4" },
            success: { main: "#22c55e" },
            warning: { main: "#f59e0b" },
            error: { main: "#ef4444" },
            info: { main: "#38bdf8" },
            background: {
                default: backgroundDefault,
                paper: backgroundPaper,
            },
            text: {
                primary: textPrimary,
                secondary: textSecondary,
            },
            divider: isDark
                ? "rgba(255,255,255,.08)"
                : "rgba(15,23,42,.10)",
        },
        shape: { borderRadius: 14 },
        typography: {
            fontFamily: [
                "Inter",
                "Roboto",
                "Helvetica",
                "Arial",
                "sans-serif",
            ].join(","),
            button: { textTransform: "none", fontWeight: 800 },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    html: {
                        backgroundColor: backgroundDefault,
                    },
                    body: {
                        margin: 0,
                        backgroundColor: backgroundDefault,
                        color: textPrimary,
                        transition: "background-color .2s ease,color .2s ease",
                    },
                    "input,select,textarea": {
                        colorScheme: isDark ? "dark" : "light",
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                        borderColor: isDark
                            ? "rgba(255,255,255,.08)"
                            : "rgba(15,23,42,.10)",
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        backgroundColor: isDark
                            ? "rgba(2,6,23,.38)"
                            : "rgba(255,255,255,.92)",
                        "& fieldset": {
                            borderColor: isDark
                                ? "rgba(255,255,255,.10)"
                                : "rgba(15,23,42,.12)",
                        },
                        "&:hover fieldset": {
                            borderColor: alpha("#3b82f6", .45),
                        },
                    },
                },
            },
            MuiInputBase: {
                styleOverrides: {
                    input: {
                        "&::placeholder": {
                            color: textSecondary,
                            opacity: .75,
                        },
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        backgroundColor: backgroundPaper,
                        color: textPrimary,
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: backgroundPaper,
                        color: textPrimary,
                    },
                },
            },
            MuiPopover: {
                styleOverrides: {
                    paper: {
                        backgroundColor: backgroundPaper,
                        color: textPrimary,
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        backgroundColor: backgroundPaper,
                        color: textPrimary,
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: isDark ? "#111827" : "#0f172a",
                        color: "#ffffff",
                    },
                },
            },
        },
    });
};

// Backward-compatible default export for any older imports.
export default createPackFlowTheme("dark");
