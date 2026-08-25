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
  const divider = isDark
    ? "rgba(255,255,255,.08)"
    : "rgba(15,23,42,.10)";

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
      divider,
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: [
        "Inter",
        "Roboto",
        "Helvetica",
        "Arial",
        "sans-serif",
      ].join(","),
      button: {
        textTransform: "none",
        fontWeight: 800,
      },
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
            borderColor: divider,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            minHeight: 34,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 9,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark
              ? "rgba(2,6,23,.38)"
              : "rgba(255,255,255,.96)",
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
              opacity: .76,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            backgroundColor: backgroundPaper,
            color: textPrimary,
            border: `1px solid ${divider}`,
            boxShadow: isDark
              ? "0 30px 80px rgba(0,0,0,.55)"
              : "0 28px 72px rgba(15,23,42,.18)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            backgroundColor: backgroundPaper,
            color: textPrimary,
            borderColor: divider,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 11,
            backgroundColor: backgroundPaper,
            color: textPrimary,
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 11,
            backgroundColor: backgroundPaper,
            color: textPrimary,
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            backgroundColor: isDark ? "#111827" : "#0f172a",
            color: "#ffffff",
          },
        },
      },
    },
  });
};

export default createPackFlowTheme("dark");
