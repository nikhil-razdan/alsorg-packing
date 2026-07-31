import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Box,
    ScopedCssBaseline,
    ThemeProvider,
    createTheme,
} from "@mui/material";

const STORAGE_KEY =
    "matflow-color-mode";

const MatFlowThemeContext =
    createContext(null);

const validMode = (value) => {
    return value === "light" ||
        value === "dark";
};

const readInitialMode = () => {
    if (
        typeof window ===
        "undefined"
    ) {
        return "dark";
    }

    const storedMode =
        window.localStorage
            .getItem(
                STORAGE_KEY
            );

    if (
        validMode(
            storedMode
        )
    ) {
        return storedMode;
    }

    const prefersLight =
        window.matchMedia?.(
            "(prefers-color-scheme: light)"
        )?.matches;

    return prefersLight
        ? "light"
        : "dark";
};

const matFlowVariables = (
    mode
) => {
    const dark =
        mode === "dark";

    return {
        "--mf-page-bg":
            dark
                ? "#07111f"
                : "#f4f7fb",

        "--mf-page-bg-soft":
            dark
                ? "#0b1627"
                : "#edf2f8",

        "--mf-content-bg":
            dark
                ? `
					radial-gradient(
						circle at top left,
						rgba(14,165,233,.10),
						transparent 26%
					),
					radial-gradient(
						circle at bottom right,
						rgba(59,130,246,.07),
						transparent 25%
					)
				`
                : `
					radial-gradient(
						circle at top left,
						rgba(37,99,235,.08),
						transparent 28%
					),
					linear-gradient(
						180deg,
						#f8fafc,
						#eef3f9
					)
				`,

        "--mf-panel-bg":
            dark
                ? "rgba(15,23,42,.88)"
                : "rgba(255,255,255,.97)",

        "--mf-panel-bg-solid":
            dark
                ? "#0f172a"
                : "#ffffff",

        "--mf-surface-soft":
            dark
                ? "rgba(2,6,23,.36)"
                : "rgba(241,245,249,.92)",

        "--mf-surface-strong":
            dark
                ? "rgba(2,6,23,.56)"
                : "rgba(226,232,240,.92)",

        "--mf-field-bg":
            dark
                ? "rgba(255,255,255,.04)"
                : "#ffffff",

        "--mf-hover":
            dark
                ? "rgba(14,165,233,.10)"
                : "rgba(37,99,235,.07)",

        "--mf-text":
            dark
                ? "#f8fafc"
                : "#0f172a",

        "--mf-text-secondary":
            dark
                ? "rgba(248,250,252,.70)"
                : "rgba(15,23,42,.72)",

        "--mf-text-muted":
            dark
                ? "rgba(248,250,252,.48)"
                : "rgba(15,23,42,.50)",

        "--mf-border":
            dark
                ? "rgba(255,255,255,.08)"
                : "rgba(15,23,42,.11)",

        "--mf-border-strong":
            dark
                ? "rgba(255,255,255,.16)"
                : "rgba(15,23,42,.19)",

        "--mf-divider":
            dark
                ? "rgba(255,255,255,.07)"
                : "rgba(15,23,42,.10)",

        "--mf-shadow":
            dark
                ? "0 16px 36px rgba(2,6,23,.28)"
                : "0 14px 30px rgba(15,23,42,.08)",

        "--mf-hero-bg":
            dark
                ? `
					radial-gradient(
						circle at top left,
						rgba(14,165,233,.20),
						transparent 34%
					),
					linear-gradient(
						180deg,
						rgba(15,23,42,.94),
						rgba(15,23,42,.80)
					)
				`
                : `
					radial-gradient(
						circle at top left,
						rgba(37,99,235,.13),
						transparent 36%
					),
					linear-gradient(
						180deg,
						#ffffff,
						#f1f5f9
					)
				`,

        "--mf-sidebar-bg":
            dark
                ? "linear-gradient(180deg,#06111f 0%,#081629 100%)"
                : "linear-gradient(180deg,#ffffff 0%,#edf3fa 100%)",

        "--mf-sidebar-text":
            dark
                ? "#f8fafc"
                : "#0f172a",

        "--mf-sidebar-muted":
            dark
                ? "rgba(248,250,252,.58)"
                : "rgba(15,23,42,.62)",

        "--mf-sidebar-hover":
            dark
                ? "rgba(14,165,233,.09)"
                : "rgba(37,99,235,.07)",

        "--mf-sidebar-active-bg":
            dark
                ? "linear-gradient(135deg,rgba(2,132,199,.28),rgba(14,165,233,.14))"
                : "linear-gradient(135deg,rgba(37,99,235,.14),rgba(59,130,246,.07))",

        "--mf-sidebar-active-border":
            dark
                ? "rgba(14,165,233,.28)"
                : "rgba(37,99,235,.24)",

        "--mf-header-bg":
            dark
                ? "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))"
                : "linear-gradient(180deg,rgba(255,255,255,.98),rgba(245,248,252,.97))",

        "--mf-danger-text":
            dark
                ? "#fca5a5"
                : "#dc2626",

        "--mf-scroll-thumb":
            dark
                ? "rgba(148,163,184,.28)"
                : "rgba(71,85,105,.25)",
    };
};

const createMatFlowTheme = (
    mode
) => {
    const dark =
        mode === "dark";

    return createTheme({
        palette: {
            mode,

            primary: {
                main:
                    dark
                        ? "#60a5fa"
                        : "#2563eb",
            },

            secondary: {
                main:
                    dark
                        ? "#a78bfa"
                        : "#7c3aed",
            },

            background: {
                default:
                    dark
                        ? "#07111f"
                        : "#f3f6fb",

                paper:
                    dark
                        ? "#0f172a"
                        : "#ffffff",
            },

            text: {
                primary:
                    dark
                        ? "#f8fafc"
                        : "#0f172a",

                secondary:
                    dark
                        ? "#94a3b8"
                        : "#475569",
            },

            divider:
                dark
                    ? "rgba(255,255,255,.085)"
                    : "rgba(15,23,42,.11)",

            success: {
                main: "#16a34a",
            },

            warning: {
                main: "#f59e0b",
            },

            error: {
                main: "#dc2626",
            },

            info: {
                main: "#0284c7",
            },
        },

        shape: {
            borderRadius: 12,
        },

        typography: {
            fontFamily: [
                "Inter",
                "Roboto",
                "Arial",
                "sans-serif",
            ].join(","),

            button: {
                textTransform:
                    "none",
                fontWeight: 800,
            },
        },

        components: {
            MuiButton: {
                defaultProps: {
                    disableElevation:
                        true,
                },

                styleOverrides: {
                    root: {
                        borderRadius:
                            10,
                    },
                },
            },

            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundImage:
                            "none",
                    },
                },
            },

            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage:
                            "none",
                    },
                },
            },

            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        background:
                            "var(--mf-field-bg)",

                        "& fieldset": {
                            borderColor:
                                "var(--mf-border)",
                        },

                        "&:hover fieldset": {
                            borderColor:
                                "var(--mf-border-strong)",
                        },
                    },
                },
            },

            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        color:
                            "var(--mf-text-muted)",
                    },
                },
            },

            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontSize:
                            "12px",

                        "&:hover": {
                            background:
                                "var(--mf-hover)",
                        },
                    },
                },
            },

            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        fontSize:
                            "10px",
                        fontWeight:
                            700,
                    },
                },
            },
        },
    });
};

export function MatFlowThemeProvider({
    children,
}) {
    const [mode, setModeState] =
        useState(
            readInitialMode
        );

    const theme =
        useMemo(
            () =>
                createMatFlowTheme(
                    mode
                ),
            [mode]
        );

    const variables =
        useMemo(
            () =>
                matFlowVariables(
                    mode
                ),
            [mode]
        );

    useEffect(() => {
        window.localStorage
            .setItem(
                STORAGE_KEY,
                mode
            );
    }, [mode]);

    const setMode = (
        nextMode
    ) => {
        if (
            validMode(
                nextMode
            )
        ) {
            setModeState(
                nextMode
            );
        }
    };

    const toggleMode = () => {
        setModeState(
            (current) =>
                current === "dark"
                    ? "light"
                    : "dark"
        );
    };

    const value =
        useMemo(
            () => ({
                mode,
                isDark:
                    mode ===
                    "dark",
                setMode,
                toggleMode,
            }),
            [mode]
        );

    return (
        <MatFlowThemeContext.Provider
            value={value}
        >
            <ThemeProvider
                theme={theme}
            >
                <ScopedCssBaseline
                    sx={{
                        ...variables,

                        minHeight:
                            "100vh",

                        background:
                            "var(--mf-page-bg)",

                        color:
                            "var(--mf-text)",

                        transition:
                            [
                                "background-color .22s ease",
                                "color .22s ease",
                            ].join(
                                ","
                            ),

                        "& *": {
                            scrollbarWidth:
                                "thin",

                            scrollbarColor:
                                [
                                    "var(--mf-scroll-thumb)",
                                    "transparent",
                                ].join(
                                    " "
                                ),
                        },

                        "& *::-webkit-scrollbar": {
                            width:
                                "8px",
                            height:
                                "8px",
                        },

                        "& *::-webkit-scrollbar-thumb": {
                            background:
                                "var(--mf-scroll-thumb)",
                            borderRadius:
                                999,
                        },
                    }}
                >
                    {children}
                </ScopedCssBaseline>
            </ThemeProvider>
        </MatFlowThemeContext.Provider>
    );
}

export function useMatFlowTheme() {
    const context =
        useContext(
            MatFlowThemeContext
        );

    if (!context) {
        throw new Error(
            "useMatFlowTheme must be used inside MatFlowThemeProvider."
        );
    }

    return context;
}