import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	GlobalStyles,
	LinearProgress,
	Paper,
	ScopedCssBaseline,
	ThemeProvider,
	Tooltip,
	Typography,
	createTheme,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

const MODE_KEY = "hrflow-color-mode";
const MATFLOW_MODE_KEY = "matflow-color-mode";
const HrThemeContext = createContext(null);

const readMode = () => {
	if (typeof window === "undefined") return "dark";
	const stored = window.localStorage.getItem(MODE_KEY);
	if (stored === "dark" || stored === "light") return stored;
	const matFlowMode = window.localStorage.getItem(MATFLOW_MODE_KEY);
	if (matFlowMode === "dark" || matFlowMode === "light") return matFlowMode;
	return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
};

const variables = (mode) => {
	const dark = mode === "dark";
	return {
		"--hr-page-bg": dark ? "#07111f" : "#f6f9fe",
		"--hr-panel-bg": dark ? "#0d1b2e" : "#ffffff",
		"--hr-panel-solid": dark ? "#0d1b2e" : "#ffffff",
		"--hr-card-bg": dark ? "#0d1b2e" : "#ffffff",
		"--hr-card-bg-elevated": dark ? "#102139" : "#ffffff",
		"--hr-surface": dark ? "#111f33" : "#f8fbff",
		"--hr-surface-strong": dark ? "#14243a" : "#f1f5fb",
		"--hr-field-bg": dark ? "#0a1728" : "#ffffff",
		"--hr-hover": dark ? "#112b45" : "#edf5ff",
		"--hr-text": dark ? "#f8fafc" : "#172033",
		"--hr-text-secondary": dark ? "rgba(248,250,252,.70)" : "#55627a",
		"--hr-text-muted": dark ? "rgba(248,250,252,.48)" : "#8a96aa",
		"--hr-border": dark ? "rgba(148,163,184,.16)" : "#dbe5f1",
		"--hr-border-strong": dark ? "rgba(148,163,184,.28)" : "#c8d6e8",
		"--hr-shadow": dark
			? "0 12px 30px rgba(2,6,23,.34),0 2px 8px rgba(2,6,23,.20)"
			: "0 10px 28px rgba(15,23,42,.075),0 2px 8px rgba(15,23,42,.035)",
		"--hr-primary": dark ? "#0ea5e9" : "#3b82f6",
		"--hr-primary-hover": dark ? "#0284c7" : "#2563eb",
		"--hr-primary-soft": dark ? "rgba(14,165,233,.13)" : "#edf4ff",
		"--hr-primary-border": dark ? "rgba(14,165,233,.24)" : "#d7e6ff",
		"--hr-primary-text": dark ? "#7dd3fc" : "#2f6fed",
		"--hr-success-text": dark ? "#4ade80" : "#16834a",
		"--hr-success-soft": dark ? "rgba(34,197,94,.13)" : "#eaf8f0",
		"--hr-success-border": dark ? "rgba(34,197,94,.24)" : "#ccefd9",
		"--hr-warning-text": dark ? "#fbbf24" : "#b56a08",
		"--hr-warning-soft": dark ? "rgba(245,158,11,.13)" : "#fff7e8",
		"--hr-warning-border": dark ? "rgba(245,158,11,.24)" : "#f8dfae",
		"--hr-danger-text": dark ? "#fca5a5" : "#c33f45",
		"--hr-danger-soft": dark ? "rgba(239,68,68,.13)" : "#fff0f1",
		"--hr-danger-border": dark ? "rgba(239,68,68,.24)" : "#f6d2d5",
		"--hr-purple-text": dark ? "#c4b5fd" : "#7356c9",
		"--hr-purple-soft": dark ? "rgba(139,92,246,.13)" : "#f3efff",
		"--hr-purple-border": dark ? "rgba(139,92,246,.24)" : "#e1d8ff",
		"--hr-sidebar-bg": dark
			? "linear-gradient(180deg,#06111f,#081629)"
			: "#ffffff",
		"--hr-header-bg": dark
			? "linear-gradient(180deg,rgba(6,17,31,.98),rgba(8,22,41,.96))"
			: "rgba(255,255,255,.96)",
		"--hr-table-head": dark ? "#0a1728" : "#f3f7fc",
		"--hr-table-row": dark ? "#0d1b2e" : "#ffffff",
		"--hr-table-hover": dark ? "#112b45" : "#f2f7ff",
		"--hr-overlay": dark ? "rgba(2,6,23,.76)" : "rgba(15,23,42,.42)",
		"--hr-popover-shadow": dark
			? "0 18px 48px rgba(0,0,0,.38)"
			: "0 16px 38px rgba(15,23,42,.15)",
		"--hr-scroll-track": dark ? "rgba(255,255,255,.025)" : "rgba(15,23,42,.035)",
		"--hr-scroll-thumb": dark ? "rgba(96,165,250,.46)" : "rgba(59,130,246,.42)",
		"--hr-scroll-thumb-hover": dark ? "rgba(125,211,252,.78)" : "rgba(37,99,235,.68)",
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
				paper: dark ? "#0d1b2e" : "#ffffff",
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
			MuiCard: {
				styleOverrides: {
					root: {
						backgroundImage: "none",
						backgroundColor: dark ? "#0d1b2e" : "#ffffff",
						color: dark ? "#f8fafc" : "#172033",
					},
				},
			},
			MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
			MuiButton: { defaultProps: { disableElevation: true } },
			MuiOutlinedInput: {
				styleOverrides: {
					root: {
						backgroundColor: dark ? "#0a1728" : "#ffffff",
					},
				},
			},
			MuiBackdrop: {
				styleOverrides: {
					root: {
						backgroundColor: dark ? "rgba(2,6,23,.76)" : "rgba(15,23,42,.42)",
						backdropFilter: "blur(6px)",
					},
				},
			},
			MuiDialog: {
				styleOverrides: {
					paper: {
						backgroundImage: "none",
						backgroundColor: dark ? "#0d1b2e" : "#ffffff",
						color: dark ? "#f8fafc" : "#172033",
						border: `1px solid ${dark ? "rgba(148,163,184,.28)" : "#c8d6e8"}`,
						boxShadow: dark
							? "0 28px 80px rgba(0,0,0,.52)"
							: "0 28px 80px rgba(15,23,42,.22)",
					},
				},
			},
			MuiDrawer: {
				styleOverrides: {
					paper: {
						backgroundImage: "none",
						backgroundColor: dark ? "#0b1628" : "#ffffff",
						color: dark ? "#f8fafc" : "#172033",
						borderColor: dark ? "rgba(148,163,184,.16)" : "#dbe5f1",
					},
				},
			},
			MuiMenu: {
				styleOverrides: {
					paper: {
						backgroundImage: "none",
						backgroundColor: dark ? "#0d1b2e" : "#ffffff",
						color: dark ? "#f8fafc" : "#172033",
					},
				},
			},
			MuiPopover: {
				styleOverrides: {
					paper: {
						backgroundImage: "none",
						backgroundColor: dark ? "#0d1b2e" : "#ffffff",
						color: dark ? "#f8fafc" : "#172033",
					},
				},
			},
		},
	});
};

export function HrFlowThemeProvider({ children }) {
	const [mode, setMode] = useState(readMode);
	const theme = useMemo(() => buildTheme(mode), [mode]);
	const cssVars = useMemo(() => variables(mode), [mode]);

	useEffect(() => {
		window.localStorage.setItem(MODE_KEY, mode);
	}, [mode]);

	const value = useMemo(() => ({
		mode,
		isDark: mode === "dark",
		toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark")),
		setMode,
	}), [mode]);

	return (
		<HrThemeContext.Provider value={value}>
			<ThemeProvider theme={theme}>
				<GlobalStyles
					styles={{
						":root": cssVars,
						body: { backgroundColor: "var(--hr-page-bg)" },
						".MuiDialog-root .MuiDialog-paper, .MuiDrawer-root .MuiDrawer-paper, .MuiPopover-root .MuiPaper-root, .MuiMenu-root .MuiPaper-root": {
							color: "var(--hr-text) !important",
							backgroundColor: "var(--hr-panel-solid) !important",
							backgroundImage: "none !important",
							borderColor: "var(--hr-border-strong) !important",
							opacity: "1 !important",
						},
						".MuiBackdrop-root": { backgroundColor: "var(--hr-overlay) !important" },
					}}
				/>
				<ScopedCssBaseline
					sx={{
						...cssVars,
						minHeight: "100vh",
						background: "var(--hr-page-bg)",
						color: "var(--hr-text)",
						"& *": {
							boxSizing: "border-box",
							scrollbarWidth: "thin",
							scrollbarColor: "var(--hr-scroll-thumb) var(--hr-scroll-track)",
						},
						"& *::-webkit-scrollbar": { width: 10, height: 10 },
						"& *::-webkit-scrollbar-track": { background: "var(--hr-scroll-track)" },
						"& *::-webkit-scrollbar-thumb": {
							border: "2px solid transparent",
							borderRadius: 999,
							background: "var(--hr-scroll-thumb)",
							backgroundClip: "padding-box",
						},
						"& *::-webkit-scrollbar-thumb:hover": {
							background: "var(--hr-scroll-thumb-hover)",
							backgroundClip: "padding-box",
						},
					}}
				>
					{children}
				</ScopedCssBaseline>
			</ThemeProvider>
		</HrThemeContext.Provider>
	);
}

export const useHrFlowTheme = () => {
	const context = useContext(HrThemeContext);
	if (!context) throw new Error("useHrFlowTheme must be used inside HrFlowThemeProvider");
	return context;
};

export const hrColors = {
	ink: "var(--hr-text)",
	muted: "var(--hr-text-muted)",
	line: "var(--hr-border)",
	soft: "var(--hr-surface)",
	blue: "var(--hr-primary-text)",
	blueSolid: "var(--hr-primary)",
	blueSoft: "var(--hr-primary-soft)",
	green: "var(--hr-success-text)",
	greenSoft: "var(--hr-success-soft)",
	amber: "var(--hr-warning-text)",
	amberSoft: "var(--hr-warning-soft)",
	red: "var(--hr-danger-text)",
	redSoft: "var(--hr-danger-soft)",
	violet: "var(--hr-purple-text)",
	violetSoft: "var(--hr-purple-soft)",
};

export const panelSx = {
	borderRadius: 2.25,
	border: "1px solid var(--hr-border)",
	boxShadow: "var(--hr-shadow)",
	background: "var(--hr-card-bg)",
	backgroundImage: "none",
};

export const fieldSx = {
	"& .MuiOutlinedInput-root": {
		borderRadius: 1.8,
		background: "var(--hr-field-bg)",
	},
};

export const primaryButtonSx = {
	borderRadius: 1.7,
	textTransform: "none",
	fontWeight: 850,
	boxShadow: "none",
	color: "#fff",
	background: "var(--hr-primary)",
	"&:hover": { background: "var(--hr-primary-hover)", boxShadow: "none" },
};

export const secondaryButtonSx = {
	borderRadius: 1.7,
	textTransform: "none",
	fontWeight: 800,
	color: "var(--hr-text)",
	borderColor: "var(--hr-border-strong)",
	background: "var(--hr-card-bg)",
	"&:hover": { borderColor: "var(--hr-primary-border)", background: "var(--hr-hover)" },
};

export function ThemeToggleButton({ compact = true }) {
	const { isDark, toggleMode } = useHrFlowTheme();
	return (
		<Tooltip title={isDark ? "Light mode" : "Dark mode"}>
			<Button
				onClick={toggleMode}
				sx={{ ...secondaryButtonSx, minWidth: compact ? 38 : undefined, px: compact ? .8 : 1.3 }}
			>
				{isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
				{compact ? null : <Box component="span" sx={{ ml: .7 }}>{isDark ? "Light" : "Dark"}</Box>}
			</Button>
		</Tooltip>
	);
}

export function HrBrand({ compact = false }) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
			<Box
				sx={{
					width: compact ? 38 : 46,
					height: compact ? 38 : 46,
					borderRadius: 1.6,
					display: "grid",
					placeItems: "center",
					fontWeight: 950,
					color: "#fff",
					background: "linear-gradient(135deg,var(--hr-primary-hover),var(--hr-primary))",
				}}
			>
				A
			</Box>
			<Box>
				<Typography sx={{ fontWeight: 950, color: hrColors.ink, lineHeight: 1.1 }}>
					HRFlow
				</Typography>
				<Typography sx={{ fontSize: 11.5, color: hrColors.muted, mt: .25 }}>
					ALSORG • FlowSuite
				</Typography>
			</Box>
		</Box>
	);
}

export function LoadingBlock({ label = "Loading HRFlow…", minHeight = 220 }) {
	return (
		<Box sx={{ minHeight, display: "grid", placeItems: "center" }}>
			<Box sx={{ textAlign: "center" }}>
				<CircularProgress size={30} />
				<Typography sx={{ mt: 1.5, color: hrColors.muted, fontSize: 13 }}>{label}</Typography>
			</Box>
		</Box>
	);
}

export function EmptyState({ title = "Nothing here yet", description = "No records match the current view." }) {
	return (
		<Box sx={{ py: 7, px: 2, textAlign: "center" }}>
			<Typography sx={{ fontWeight: 900, color: hrColors.ink }}>{title}</Typography>
			<Typography sx={{ mt: .8, color: hrColors.muted, fontSize: 13.5 }}>{description}</Typography>
		</Box>
	);
}

export function PageTitle({ eyebrow, title, subtitle, actions }) {
	return (
		<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap", mb: 2.5 }}>
			<Box sx={{ minWidth: 0, maxWidth: 820 }}>
				{eyebrow ? <Typography sx={{ color: hrColors.blue, fontSize: 11, fontWeight: 950, letterSpacing: 1.2, mb: .6 }}>{eyebrow}</Typography> : null}
				<Typography sx={{ color: hrColors.ink, fontSize: { xs: 25, md: 31 }, fontWeight: 950, letterSpacing: "-.035em" }}>{title}</Typography>
				{subtitle ? <Typography sx={{ color: hrColors.muted, mt: .7, lineHeight: 1.65, fontSize: 13.5 }}>{subtitle}</Typography> : null}
			</Box>
			{actions ? <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box> : null}
		</Box>
	);
}

export function MetricCard({ label, value, helper, tone = "blue", onClick }) {
	const palette = {
		blue: [hrColors.blue, hrColors.blueSoft],
		green: [hrColors.green, hrColors.greenSoft],
		amber: [hrColors.amber, hrColors.amberSoft],
		red: [hrColors.red, hrColors.redSoft],
		violet: [hrColors.violet, hrColors.violetSoft],
	};
	const [accent, soft] = palette[tone] || palette.blue;
	return (
		<Paper
			onClick={onClick}
			sx={{
				...panelSx,
				p: 2.1,
				cursor: onClick ? "pointer" : "default",
				transition: "transform .18s ease, box-shadow .18s ease",
				"&:hover": onClick ? { transform: "translateY(-2px)", boxShadow: "var(--hr-shadow)" } : {},
			}}
		>
			<Box sx={{ width: 34, height: 4, borderRadius: 99, background: accent, mb: 1.6 }} />
			<Typography sx={{ color: hrColors.muted, fontSize: 12, fontWeight: 800 }}>{label}</Typography>
			<Typography sx={{ color: hrColors.ink, fontSize: 28, fontWeight: 950, mt: .25 }}>{value}</Typography>
			{helper ? <Typography sx={{ color: accent, background: soft, display: "inline-block", px: .8, py: .3, borderRadius: 1, fontSize: 11.5, fontWeight: 800, mt: 1 }}>{helper}</Typography> : null}
		</Paper>
	);
}

export function StatusChip({ value, size = "small" }) {
	const clean = String(value || "").toUpperCase();
	let color = hrColors.muted;
	let bg = "var(--hr-surface-strong)";
	if (clean.includes("JOINED") || clean.includes("COMPLETE") || clean === "ACTIVE" || clean.includes("SELECTED") || clean === "YES") {
		color = hrColors.green;
		bg = hrColors.greenSoft;
	} else if (clean.includes("REJECT") || clean.includes("CANCEL") || clean.includes("EXIT") || clean === "NO") {
		color = hrColors.red;
		bg = hrColors.redSoft;
	} else if (clean.includes("PENDING") || clean.includes("HOLD") || clean.includes("INTERVIEW") || clean.includes("OFFER")) {
		color = hrColors.amber;
		bg = hrColors.amberSoft;
	} else if (clean) {
		color = hrColors.blue;
		bg = hrColors.blueSoft;
	}
	return <Chip size={size} label={clean ? clean.replaceAll("_", " ") : "—"} sx={{ borderRadius: 1.2, fontWeight: 850, fontSize: 10.5, color, background: bg }} />;
}

export function CompletionBar({ completion }) {
	const percent = Number(completion?.percent || 0);
	return (
		<Box>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: .7 }}>
				<Typography sx={{ fontSize: 12.5, fontWeight: 850, color: hrColors.ink }}>Onboarding completion</Typography>
				<Typography sx={{ fontSize: 12.5, fontWeight: 950, color: percent === 100 ? hrColors.green : hrColors.blue }}>{percent}%</Typography>
			</Box>
			<LinearProgress variant="determinate" value={Math.max(0, Math.min(100, percent))} sx={{ height: 8, borderRadius: 99, background: "var(--hr-surface-strong)", "& .MuiLinearProgress-bar": { borderRadius: 99, background: percent === 100 ? hrColors.green : "var(--hr-primary)" } }} />
		</Box>
	);
}

export function ErrorAlert({ error, onRetry }) {
	if (!error) return null;
	return <Alert severity="error" action={onRetry ? <Button color="inherit" size="small" startIcon={<RefreshOutlinedIcon />} onClick={onRetry}>Retry</Button> : null} sx={{ mb: 2, borderRadius: 1.7 }}>{error}</Alert>;
}

export function PublicShell({ title, subtitle, children, onBack, topRight }) {
	return (
		<Box sx={{ minHeight: "100vh", background: "var(--hr-page-bg)", py: { xs: 1.5, md: 3.5 }, px: { xs: 1.25, md: 2.5 } }}>
			<Box sx={{ maxWidth: 1040, mx: "auto" }}>
				<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.2 }, mb: 2 }}>
					<Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							{onBack ? <Button onClick={onBack} startIcon={<ArrowBackOutlinedIcon />} sx={secondaryButtonSx}>Back</Button> : null}
							<HrBrand />
						</Box>
						<Box sx={{ display: "flex", gap: .8, alignItems: "center", flexWrap: "wrap" }}>
							{topRight}
							<ThemeToggleButton />
						</Box>
					</Box>
				</Paper>
				<Paper sx={{ ...panelSx, p: { xs: 2, md: 3 }, mb: 2 }}>
					<Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 950, color: hrColors.ink, letterSpacing: "-.035em" }}>{title}</Typography>
					<Typography sx={{ mt: .8, color: hrColors.muted, lineHeight: 1.7, maxWidth: 780 }}>{subtitle}</Typography>
				</Paper>
				{children}
			</Box>
		</Box>
	);
}
