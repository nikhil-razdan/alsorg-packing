import {
    Button,
    Tooltip,
} from "@mui/material";

import LightModeOutlinedIcon
    from "@mui/icons-material/LightModeOutlined";

import DarkModeOutlinedIcon
    from "@mui/icons-material/DarkModeOutlined";

import {
    useMatFlowTheme,
} from "./MatFlowThemeProvider";

export default function MatFlowThemeToggle({
    compact = false,
}) {
    const {
        isDark,
        toggleMode,
    } = useMatFlowTheme();

    const targetLabel =
        isDark
            ? "Light mode"
            : "Dark mode";

    return (
        <Tooltip
            title={`Switch to ${targetLabel.toLowerCase()}`}
        >
            <Button
                type="button"
                onClick={
                    toggleMode
                }
                startIcon={
                    isDark
                        ? (
                            <LightModeOutlinedIcon />
                        )
                        : (
                            <DarkModeOutlinedIcon />
                        )
                }
                aria-label={`Switch to ${targetLabel.toLowerCase()}`}
                sx={{
                    minWidth:
                        compact
                            ? 42
                            : 126,

                    height:
                        38,

                    px:
                        compact
                            ? 1
                            : 1.5,

                    color:
                        "var(--mf-text)",

                    background:
                        "var(--mf-surface-soft)",

                    border:
                        "1px solid var(--mf-border)",

                    fontSize:
                        "11px",

                    fontWeight:
                        900,

                    "&:hover": {
                        background:
                            "var(--mf-hover)",

                        borderColor:
                            "var(--mf-border-strong)",
                    },
                }}
            >
                {compact
                    ? null
                    : targetLabel}
            </Button>
        </Tooltip>
    );
}