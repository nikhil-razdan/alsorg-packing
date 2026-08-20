import React from "react";
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	LinearProgress,
	Paper,
	Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

export const hrColors = {
	ink: "#0f172a",
	muted: "#64748b",
	line: "#e2e8f0",
	soft: "#f8fafc",
	blue: "#2563eb",
	blueSoft: "#eff6ff",
	green: "#059669",
	greenSoft: "#ecfdf5",
	amber: "#d97706",
	amberSoft: "#fffbeb",
	red: "#dc2626",
	redSoft: "#fef2f2",
	violet: "#7c3aed",
};

export const panelSx = {
	borderRadius: 2.25,
	border: `1px solid ${hrColors.line}`,
	boxShadow: "0 10px 28px rgba(15,23,42,.06)",
	background: "#fff",
};

export const fieldSx = {
	"& .MuiOutlinedInput-root": {
		borderRadius: 1.8,
		background: "#fff",
	},
};

export const primaryButtonSx = {
	borderRadius: 1.7,
	textTransform: "none",
	fontWeight: 850,
	boxShadow: "none",
	background: hrColors.blue,
	"&:hover": { background: "#1d4ed8", boxShadow: "none" },
};

export const secondaryButtonSx = {
	borderRadius: 1.7,
	textTransform: "none",
	fontWeight: 800,
	color: hrColors.ink,
	borderColor: "#cbd5e1",
	background: "#fff",
	"&:hover": { borderColor: "#94a3b8", background: "#f8fafc" },
};

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
					background: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
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
				<Typography sx={{ mt: 1.5, color: hrColors.muted, fontSize: 13 }}>
					{label}
				</Typography>
			</Box>
		</Box>
	);
}

export function EmptyState({ title = "Nothing here yet", description = "No records match the current view." }) {
	return (
		<Box sx={{ py: 7, px: 2, textAlign: "center" }}>
			<Typography sx={{ fontWeight: 900, color: hrColors.ink }}>{title}</Typography>
			<Typography sx={{ mt: .8, color: hrColors.muted, fontSize: 13.5 }}>
				{description}
			</Typography>
		</Box>
	);
}

export function PageTitle({ eyebrow, title, subtitle, actions }) {
	return (
		<Box
			sx={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "flex-start",
				gap: 2,
				flexWrap: "wrap",
				mb: 2.5,
			}}
		>
			<Box sx={{ minWidth: 0, maxWidth: 820 }}>
				{eyebrow ? (
					<Typography sx={{ color: hrColors.blue, fontSize: 11, fontWeight: 950, letterSpacing: 1.2, mb: .6 }}>
						{eyebrow}
					</Typography>
				) : null}
				<Typography sx={{ color: hrColors.ink, fontSize: { xs: 25, md: 31 }, fontWeight: 950, letterSpacing: "-.035em" }}>
					{title}
				</Typography>
				{subtitle ? (
					<Typography sx={{ color: hrColors.muted, mt: .7, lineHeight: 1.65, fontSize: 13.5 }}>
						{subtitle}
					</Typography>
				) : null}
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
		violet: [hrColors.violet, "#f5f3ff"],
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
				"&:hover": onClick ? { transform: "translateY(-2px)", boxShadow: "0 14px 34px rgba(15,23,42,.10)" } : {},
			}}
		>
			<Box sx={{ width: 34, height: 4, borderRadius: 99, background: accent, mb: 1.6 }} />
			<Typography sx={{ color: hrColors.muted, fontSize: 12, fontWeight: 800 }}>{label}</Typography>
			<Typography sx={{ color: hrColors.ink, fontSize: 28, fontWeight: 950, mt: .25 }}>{value}</Typography>
			{helper ? (
				<Typography sx={{ color: accent, background: soft, display: "inline-block", px: .8, py: .3, borderRadius: 1, fontSize: 11.5, fontWeight: 800, mt: 1 }}>
					{helper}
				</Typography>
			) : null}
		</Paper>
	);
}

export function StatusChip({ value, size = "small" }) {
	const clean = String(value || "").toUpperCase();
	let color = hrColors.muted;
	let bg = "#f1f5f9";
	if (clean.includes("JOINED") || clean.includes("COMPLETE") || clean === "ACTIVE" || clean.includes("SELECTED")) {
		color = hrColors.green;
		bg = hrColors.greenSoft;
	} else if (clean.includes("REJECT") || clean.includes("CANCEL") || clean.includes("EXIT")) {
		color = hrColors.red;
		bg = hrColors.redSoft;
	} else if (clean.includes("PENDING") || clean.includes("HOLD") || clean.includes("INTERVIEW") || clean.includes("OFFER")) {
		color = hrColors.amber;
		bg = hrColors.amberSoft;
	} else if (clean) {
		color = hrColors.blue;
		bg = hrColors.blueSoft;
	}
	return (
		<Chip
			size={size}
			label={clean ? clean.replaceAll("_", " ") : "—"}
			sx={{
				borderRadius: 1.2,
				fontWeight: 850,
				fontSize: 10.5,
				color,
				background: bg,
			}}
		/>
	);
}

export function CompletionBar({ completion }) {
	const percent = Number(completion?.percent || 0);
	return (
		<Box>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: .7 }}>
				<Typography sx={{ fontSize: 12.5, fontWeight: 850, color: hrColors.ink }}>
					Onboarding completion
				</Typography>
				<Typography sx={{ fontSize: 12.5, fontWeight: 950, color: percent === 100 ? hrColors.green : hrColors.blue }}>
					{percent}%
				</Typography>
			</Box>
			<LinearProgress
				variant="determinate"
				value={Math.max(0, Math.min(100, percent))}
				sx={{
					height: 8,
					borderRadius: 99,
					background: "#e2e8f0",
					"& .MuiLinearProgress-bar": {
						borderRadius: 99,
						background: percent === 100 ? hrColors.green : hrColors.blue,
					},
				}}
			/>
		</Box>
	);
}

export function ErrorAlert({ error, onRetry }) {
	if (!error) return null;
	return (
		<Alert
			severity="error"
			action={onRetry ? (
				<Button color="inherit" size="small" startIcon={<RefreshOutlinedIcon />} onClick={onRetry}>
					Retry
				</Button>
			) : null}
			sx={{ mb: 2, borderRadius: 1.7 }}
		>
			{error}
		</Alert>
	);
}

export function PublicShell({ title, subtitle, children, onBack, topRight }) {
	return (
		<Box sx={{ minHeight: "100vh", background: "#f1f5f9", py: { xs: 1.5, md: 3.5 }, px: { xs: 1.25, md: 2.5 } }}>
			<Box sx={{ maxWidth: 1040, mx: "auto" }}>
				<Paper sx={{ ...panelSx, p: { xs: 1.7, md: 2.2 }, mb: 2 }}>
					<Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							{onBack ? (
								<Button onClick={onBack} startIcon={<ArrowBackOutlinedIcon />} sx={secondaryButtonSx}>
									Back
								</Button>
							) : null}
							<HrBrand />
						</Box>
						{topRight}
					</Box>
				</Paper>
				<Paper sx={{ ...panelSx, p: { xs: 2, md: 3 }, mb: 2 }}>
					<Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 950, color: hrColors.ink, letterSpacing: "-.035em" }}>
						{title}
					</Typography>
					<Typography sx={{ mt: .8, color: hrColors.muted, lineHeight: 1.7, maxWidth: 780 }}>
						{subtitle}
					</Typography>
				</Paper>
				{children}
			</Box>
		</Box>
	);
}
