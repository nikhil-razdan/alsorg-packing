import { useEffect, useState, useMemo, useRef } from "react";
import { Chip, Box, Button, IconButton, TextField, MenuItem, Tooltip } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import DescriptionOutlinedIcon
	from "@mui/icons-material/DescriptionOutlined";
import {
	fetchDrivers,
	fetchVehicles,
	createDispatchChallan,
} from "../dashboard/api/logisticsApi";

const page = {
	minHeight: "100vh",

	background:
		"linear-gradient(135deg,#020617,#0f172a)",
};

const dispatchGrid =
	"70px 350px 280px 140px 180px 250px 100px 220px 120px 180px 240px 540px";

const dispatchMinWidth = 2670;

const tableHeader = {
	position: "sticky",
	top: 0,
	zIndex: 20,

	display: "grid",
	gridTemplateColumns: dispatchGrid,
	minWidth: dispatchMinWidth,

	alignItems: "center",

	padding: "14px 16px",

	background: "#111827",

	color: "#94a3b8",

	fontWeight: 700,
	fontSize: 13,
};

const tableCellWrap = {
	minWidth: 0,
	overflow: "hidden",
	display: "flex",
	alignItems: "center",
	minHeight: 36,
	paddingRight: 12,
};

const tableBody = {
	display: "flex",
	flexDirection: "column",
};

const tableRow = {
	display: "grid",
	gridTemplateColumns: dispatchGrid,
	minWidth: dispatchMinWidth,

	alignItems: "center",

	padding: "14px 16px",

	color: "#fff",

	borderTop: "1px solid rgba(255,255,255,.06)",

	minHeight: 58,

	fontSize: 13,
};

const selectHeaderCellSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

const selectCheckboxStyle = {
	width: 16,
	height: 16,
	cursor: "pointer",
	accentColor: "#3b82f6",
};

const nativeFgSelectSx = {
	width: "100%",
	height: 44,
	px: 1.5,
	borderRadius: "12px",
	outline: "none",
	color: "#fff",
	fontWeight: 900,
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.10)",

	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.14)",
	},

	"& option": {
		color: "#111827",
		background: "#fff",
		fontWeight: 800,
	},
};

const dispatchTripNativeSelectSx = {
	width: "100%",
	height: 46,
	px: 1.5,
	borderRadius: "14px",
	outline: "none",
	color: "#fff",
	fontWeight: 800,
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.10)",

	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.14)",
	},

	"& option": {
		color: "#111827",
		background: "#fff",
		fontWeight: 800,
	},
};

const dispatchTripFieldLabelSx = {
	color: "#94a3b8",
	fontSize: 12,
	fontWeight: 900,
	mb: 0.8,
};

const selectCheckboxDisabledStyle = {
	...selectCheckboxStyle,
	opacity: 0.35,
	cursor: "not-allowed",
};

const tableActionButton = {
	minWidth: 130,
	height: 34,
	borderRadius: 12,
	fontWeight: 800,
	fontSize: 11,
	textTransform: "none",
	whiteSpace: "nowrap",
};

const simpleCellText = {
	color: "#ffffff",
	fontWeight: 800,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const qrDispatchButtonSx = {
	height: 38,
	px: 2,
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12,

	color: "#fff",

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 10px 24px rgba(37,99,235,.28)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const modalSelectMenuProps = {
	disablePortal: true,
	PaperProps: {
		sx: {
			mt: 1,
			borderRadius: "14px",
			background:
				"linear-gradient(180deg,#0f172a,#111827)",
			color: "#fff",
			border:
				"1px solid rgba(255,255,255,.06)",
			zIndex: 8000,

			"& .MuiMenuItem-root": {
				fontSize: 14,
				fontWeight: 700,
				color: "#fff",
			},

			"& .MuiMenuItem-root:hover": {
				background: "rgba(59,130,246,.10)",
			},

			"& .Mui-selected": {
				background:
					"rgba(59,130,246,.18) !important",
				color: "#60a5fa",
				fontWeight: 900,
			},
		},
	},
};

const scannerModeButtonSx = {
	flex: 1,
	height: 38,
	borderRadius: "8px",
	textTransform: "none",
	fontWeight: 900,
	color: "#94a3b8",
	background: "transparent",

	"&:hover": {
		color: "#fff",
		background: "rgba(255,255,255,.05)",
	},
};

const scannerModeActiveSx = {
	color: "#fff",
	background:
		"linear-gradient(135deg,rgba(37,99,235,.9),rgba(59,130,246,.75))",
	boxShadow:
		"0 10px 24px rgba(37,99,235,.28)",
};

const scannerInputSx = {
	"& .MuiOutlinedInput-root": {
		borderRadius: "10px",
		background: "rgba(255,255,255,.04)",
		color: "#fff",
		fontSize: 14,
		fontWeight: 800,

		"& fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.65)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#60a5fa",
			boxShadow: "0 0 0 3px rgba(59,130,246,.16)",
		},
	},

	"& textarea": {
		color: "#fff",
		fontWeight: 800,
	},

	"& textarea::placeholder": {
		color: "rgba(255,255,255,.42)",
		opacity: 1,
	},
};

const scannerCartCardSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,

	p: 1.4,
	mb: 1,

	borderRadius: "10px",

	background:
		"rgba(255,255,255,.035)",

	border:
		"1px solid rgba(255,255,255,.07)",

	"&:hover": {
		background:
			"rgba(255,255,255,.055)",
		borderColor:
			"rgba(59,130,246,.22)",
	},
};

const scannerGenerateButtonSx = {
	height: 36,
	px: 2,
	borderRadius: "8px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12,

	color: "#fff",

	background:
		"linear-gradient(135deg,#059669,#10b981)",

	boxShadow:
		"0 10px 24px rgba(16,185,129,.25)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#047857,#059669)",
	},

	"&.Mui-disabled": {
		background:
			"rgba(255,255,255,.08)",
		color:
			"rgba(255,255,255,.35)",
	},
};

const simpleMutedText = {
	color: "#f1f5f9",
	fontWeight: 750,
	fontSize: 13,
	lineHeight: 1.25,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const simpleMonoText = {
	color: "#ffffff",
	fontWeight: 800,
	fontSize: 13,
	lineHeight: 1.25,
	fontFamily: "monospace",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const itemNameCell = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	minWidth: 0,
};

const itemNameText = {
	...simpleCellText,
	maxWidth: 245,
};

const tableIconButton = {
	width: 32,
	height: 32,
	borderRadius: "12px",
	flexShrink: 0,
	transition: "all .2s ease",
	border: "1px solid rgba(255,255,255,.08)",
	backdropFilter: "blur(12px)",

	"& svg": {
		fontSize: 17,
	},

	"&:hover": {
		transform: "translateY(-1px)",
	},
};

const stickerHistoryButton = {
	...tableIconButton,

	color: "#93c5fd",

	background:
		"linear-gradient(135deg,rgba(37,99,235,.20),rgba(59,130,246,.08))",

	boxShadow:
		"0 8px 18px rgba(37,99,235,.16)",

	"&:hover": {
		...tableIconButton["&:hover"],
		color: "#fff",
		background:
			"linear-gradient(135deg,#2563eb,#3b82f6)",
		boxShadow:
			"0 10px 24px rgba(37,99,235,.35)",
	},
};

const auditLogButton = {
	...tableIconButton,

	color: "#fdba74",

	background:
		"linear-gradient(135deg,rgba(249,115,22,.20),rgba(251,146,60,.08))",

	boxShadow:
		"0 8px 18px rgba(249,115,22,.15)",

	"&:hover": {
		...tableIconButton["&:hover"],
		color: "#fff",
		background:
			"linear-gradient(135deg,#ea580c,#f97316)",
		boxShadow:
			"0 10px 24px rgba(249,115,22,.30)",
	},
};

const enhancedOverlaySx = {
	position: "fixed",
	inset: 0,

	background: `
    radial-gradient(circle at 20% 10%, rgba(59,130,246,.18), transparent 28%),
    radial-gradient(circle at 80% 90%, rgba(16,185,129,.12), transparent 30%),
    rgba(2,6,23,.72)
  `,

	backdropFilter: "blur(14px)",
	WebkitBackdropFilter: "blur(14px)",

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	zIndex: 5000,
};

const enhancedModalSx = {
	p: 0,

	position: "relative",

	overflow: "hidden",

	borderRadius: 14,

	color: "#fff",

	background: `
    radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 28%),
    linear-gradient(180deg,#0f172a,#111827)
  `,

	border:
		"1px solid rgba(148,163,184,.14)",

	boxShadow:
		"0 40px 110px rgba(0,0,0,.68)",

	"&::before": {
		content: '""',
		position: "absolute",
		inset: 0,
		pointerEvents: "none",
		background:
			"linear-gradient(135deg,rgba(255,255,255,.08),transparent 28%,rgba(255,255,255,.03))",
	},

	"& > *": {
		position: "relative",
		zIndex: 1,
	},
};

const modalHeaderSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	px: 3,
	py: 2.4,

	borderBottom:
		"1px solid rgba(255,255,255,.06)",
};

const packedYellowChip = {
	fontWeight: 800,
	color: "#facc15",
	background: "rgba(250,204,21,.14)",
	border: "1px solid rgba(250,204,21,.24)",
};

const packedGreenChip = {
	fontWeight: 800,
	color: "#4ade80",
	background: "rgba(34,197,94,.14)",
	border: "1px solid rgba(34,197,94,.24)",
};

const modalTitleWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.6,
};

const modalIconBubble = (color = "#3b82f6") => ({
	width: 44,
	height: 44,

	borderRadius: "10px",

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	fontSize: 22,

	background:
		color === "#10b981"
			? "linear-gradient(135deg,rgba(16,185,129,.24),rgba(16,185,129,.08))"
			: color === "#f97316"
				? "linear-gradient(135deg,rgba(249,115,22,.24),rgba(249,115,22,.08))"
				: "linear-gradient(135deg,rgba(59,130,246,.24),rgba(59,130,246,.08))",

	border:
		"1px solid rgba(255,255,255,.08)",

	boxShadow:
		"0 12px 28px rgba(0,0,0,.25)",
});

const modalTitleSx = {
	color: "#fff",
	fontSize: 22,
	fontWeight: 900,
	lineHeight: 1.1,
};

const modalSubtitleSx = {
	color: "rgba(255,255,255,.55)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.4,
};

const modalCloseButtonSx = {
	width: 36,
	height: 36,

	borderRadius: "8px",

	color: "#94a3b8",

	background:
		"rgba(255,255,255,.04)",

	border:
		"1px solid rgba(255,255,255,.06)",

	"&:hover": {
		color: "#fff",
		background:
			"rgba(239,68,68,.16)",
		borderColor:
			"rgba(239,68,68,.28)",
	},
};

const modalContentSx = {
	p: 3,
};

const modalScrollBodySx = {
	maxHeight: "58vh",
	overflowY: "auto",
	pr: 0.8,

	"&::-webkit-scrollbar": {
		width: 8,
	},

	"&::-webkit-scrollbar-track": {
		background: "rgba(255,255,255,.03)",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			"linear-gradient(180deg,#2563eb,#60a5fa)",
		borderRadius: 999,
	},
};

const modalFooterSx = {
	display: "flex",
	justifyContent: "flex-end",
	gap: 1.2,

	px: 3,
	py: 2,

	borderTop:
		"1px solid rgba(255,255,255,.06)",
};

const modalSecondaryButtonSx = {
	height: 36,

	px: 2.2,

	borderRadius: "8px",

	textTransform: "none",

	fontWeight: 800,

	color: "#cbd5e1",

	background:
		"rgba(255,255,255,.04)",

	border:
		"1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background:
			"rgba(255,255,255,.08)",
		color: "#fff",
	},
};

const modalEmptyStateSx = {
	p: 3,

	borderRadius: "10px",

	textAlign: "center",

	color: "#94a3b8",

	background:
		"rgba(255,255,255,.03)",

	border:
		"1px dashed rgba(255,255,255,.12)",

	fontWeight: 700,
};

const historyCardSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	gap: 2,

	p: 1.6,
	mb: 1.2,

	borderRadius: "10px",

	background:
		"rgba(255,255,255,.035)",

	border:
		"1px solid rgba(255,255,255,.07)",

	transition: "all .2s ease",

	"&:hover": {
		transform: "translateY(-1px)",
		background:
			"rgba(255,255,255,.055)",
		borderColor:
			"rgba(59,130,246,.22)",
	},
};

const latestHistoryCardSx = {
	...historyCardSx,

	background:
		"linear-gradient(135deg,rgba(16,185,129,.13),rgba(255,255,255,.035))",

	border:
		"1px solid rgba(16,185,129,.22)",
};

const historyNumberSx = {
	color: "#fff",
	fontSize: 14,
	fontWeight: 900,
};

const historyMetaSx = {
	color: "rgba(255,255,255,.56)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.4,
};

const modalMiniButtonSx = {
	width: 34,
	height: 34,

	borderRadius: "8px",

	color: "#cbd5e1",

	background:
		"rgba(255,255,255,.04)",

	border:
		"1px solid rgba(255,255,255,.08)",

	"&:hover": {
		color: "#fff",
		background:
			"linear-gradient(135deg,#2563eb,#3b82f6)",
		boxShadow:
			"0 10px 22px rgba(37,99,235,.28)",
	},
};

const auditFilterBarSx = {
	display: "flex",
	gap: 1.2,
	flexWrap: "wrap",

	p: 1.2,
	mb: 2,

	borderRadius: "10px",

	background:
		"rgba(255,255,255,.035)",

	border:
		"1px solid rgba(255,255,255,.07)",
};

const modalFilterFieldSx = {
	minWidth: 170,

	"& .MuiOutlinedInput-root": {
		height: 38,
		borderRadius: "8px",
		background: "rgba(255,255,255,.04)",
		color: "#fff",

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& .MuiSelect-select": {
		color: "#fff",
		fontSize: 12,
		fontWeight: 700,
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

const auditGroupTitleSx = {
	color: "#93c5fd",
	fontSize: 12,
	fontWeight: 900,
	letterSpacing: ".4px",
	textTransform: "uppercase",
	mb: 1,
	mt: 1.5,
};

const auditLogCardSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	gap: 2,

	p: 1.5,
	mb: 1,

	borderRadius: "10px",

	background:
		"rgba(255,255,255,.035)",

	border:
		"1px solid rgba(255,255,255,.07)",

	transition: "all .2s ease",

	"&:hover": {
		background:
			"rgba(255,255,255,.055)",
		borderColor:
			"rgba(59,130,246,.22)",
	},
};

const auditActionChipBaseSx = {
	height: 26,

	borderRadius: "999px",

	fontSize: 11,
	fontWeight: 900,

	border:
		"1px solid rgba(255,255,255,.08)",
};

const getAuditActionTone = (action = "") => {
	const a = action.toLowerCase();

	if (a.includes("approved")) {
		return {
			bg: "rgba(16,185,129,.15)",
			color: "#6ee7b7",
			border: "1px solid rgba(16,185,129,.25)",
		};
	}

	if (a.includes("rejected")) {
		return {
			bg: "rgba(239,68,68,.15)",
			color: "#fca5a5",
			border: "1px solid rgba(239,68,68,.25)",
		};
	}

	if (a.includes("requested")) {
		return {
			bg: "rgba(245,158,11,.15)",
			color: "#fcd34d",
			border: "1px solid rgba(245,158,11,.25)",
		};
	}

	if (a.includes("dispatched")) {
		return {
			bg: "rgba(59,130,246,.15)",
			color: "#93c5fd",
			border: "1px solid rgba(59,130,246,.25)",
		};
	}

	if (a.includes("packed")) {
		return {
			bg: "rgba(99,102,241,.15)",
			color: "#c4b5fd",
			border: "1px solid rgba(99,102,241,.25)",
		};
	}

	if (a.includes("sticker")) {
		return {
			bg: "rgba(14,165,233,.15)",
			color: "#7dd3fc",
			border: "1px solid rgba(14,165,233,.25)",
		};
	}

	return {
		bg: "rgba(148,163,184,.14)",
		color: "#cbd5e1",
		border: "1px solid rgba(148,163,184,.20)",
	};
};

const auditTimeSx = {
	color: "rgba(255,255,255,.55)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.7,
};

const statusChoiceCardSx = (color = "#3b82f6") => ({
	p: 2,

	borderRadius: "12px",

	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	cursor: "pointer",

	background:
		color === "#10b981"
			? "linear-gradient(135deg,rgba(16,185,129,.14),rgba(255,255,255,.035))"
			: color === "#f59e0b"
				? "linear-gradient(135deg,rgba(245,158,11,.14),rgba(255,255,255,.035))"
				: "linear-gradient(135deg,rgba(59,130,246,.14),rgba(255,255,255,.035))",

	border:
		color === "#10b981"
			? "1px solid rgba(16,185,129,.22)"
			: color === "#f59e0b"
				? "1px solid rgba(245,158,11,.22)"
				: "1px solid rgba(59,130,246,.22)",

	transition: "all .22s ease",

	"&:hover": {
		transform: "translateY(-3px)",
		boxShadow:
			"0 20px 42px rgba(0,0,0,.35)",
	},
});

const statusChoiceLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.6,
};

const statusChoiceIconSx = (color = "#3b82f6") => ({
	width: 46,
	height: 46,

	borderRadius: "10px",

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	fontSize: 24,

	background:
		color === "#10b981"
			? "rgba(16,185,129,.18)"
			: color === "#f59e0b"
				? "rgba(245,158,11,.18)"
				: "rgba(59,130,246,.18)",

	border:
		"1px solid rgba(255,255,255,.08)",
});

const statusChoiceTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 900,
};

const statusChoiceSubtitleSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.4,
};

const statusChoiceArrowSx = {
	width: 34,
	height: 34,

	borderRadius: "8px",

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	color: "#fff",

	background:
		"rgba(255,255,255,.07)",

	border:
		"1px solid rgba(255,255,255,.08)",
};

const readyStatusChip = {
	fontWeight: 700,

	color: "#60a5fa",

	background:
		"rgba(59,130,246,.12)",

	border:
		"1px solid rgba(59,130,246,.18)",
};

const queuedStatusChip = {
	fontWeight: 700,

	color: "#fcd34d",

	background:
		"rgba(245,158,11,.13)",

	border:
		"1px solid rgba(245,158,11,.22)",
};

const dispatchedStatusChip = {
	fontWeight: 700,

	color: "#4ade80",

	background:
		"rgba(34,197,94,.12)",

	border:
		"1px solid rgba(34,197,94,.18)",
};

const pendingStatusChip = {
	fontWeight: 700,

	color: "#fbbf24",

	background:
		"rgba(251,191,36,.12)",

	border:
		"1px solid rgba(251,191,36,.18)",
};

const premiumButton = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	px: 2.2,

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	color: "#fff",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 10px 24px rgba(37,99,235,.35)",

	transition: "all .22s ease",

	"&:hover": {
		transform: "translateY(-1px)",
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const content = {
	padding: 24,

	display: "flex",

	flexDirection: "column",

	gap: 24,
};

const headerRow = {
	display: "flex",

	justifyContent: "space-between",

	alignItems: "center",
};

const logo = {
	color: "#fff",

	fontSize: 32,

	fontWeight: 900,

	marginBottom: 8,

};

const subtitle = {
	color: "rgba(255,255,255,.62)",

	fontSize: 14,
};

const tableWrapper = {
	overflowX: "auto",
	overflowY: "visible",

	scrollbarWidth: "thin",
	scrollbarColor: "#3b82f6 #0f172a",

	WebkitOverflowScrolling: "touch",

	"&::-webkit-scrollbar": {
		height: 14,
	},

	"&::-webkit-scrollbar-track": {
		background: "linear-gradient(180deg,#0f172a,#111827)",
		borderRadius: 999,
	},

	"&::-webkit-scrollbar-thumb": {
		background: "linear-gradient(90deg,#2563eb,#60a5fa)",
		borderRadius: 999,
		border: "2px solid #0f172a",
		boxShadow: "0 0 16px rgba(59,130,246,.55)",
	},
};

const pendingChip = {
	fontSize: 11,
	fontWeight: 700,
	px: 1.8,
	borderRadius: "999px",

	color: "#78350f",

	backdropFilter: "blur(12px)",

	background:
		"linear-gradient(135deg, rgba(254,215,170,0.88), rgba(253,186,116,0.62))",

	border: "1px solid rgba(255,255,255,0.35)",

	boxShadow: `
    0 6px 16px rgba(245,158,11,0.3),
    inset 0 1px 0 rgba(255,255,255,0.5)
  `,
};

const bulkBar = {
	position: "fixed",

	bottom: 24,

	left: "50%",

	transform: "translateX(-50%)",

	display: "flex",

	alignItems: "center",

	gap: 14,

	padding: "12px 18px",

	background:
		"rgba(15,23,42,.94)",

	border:
		"1px solid rgba(255,255,255,.08)",

	borderRadius: 18,

	backdropFilter: "blur(24px)",

	boxShadow:
		"0 20px 50px rgba(0,0,0,.45)",

	color: "#fff",

	zIndex: 3000,
};
/* ===== ACTIONS ===== */

const actionContainer = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "nowrap",
	minWidth: 0,
};

const actionPrimary = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	color: "#fff",

	border:
		"1px solid rgba(59,130,246,.35)",

	boxShadow:
		"0 10px 24px rgba(37,99,235,.35)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const actionWarning = {
	borderRadius: 12,
	textTransform: "none",
	fontWeight: 800,

	background:
		"linear-gradient(135deg,#d97706,#f59e0b)",

	color: "#fff",

	border:
		"1px solid rgba(245,158,11,.35)",

	boxShadow:
		"0 10px 24px rgba(245,158,11,.28)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#b45309,#d97706)",
	},
};

const moveToFgButtonSx = {
	...tableActionButton,

	background:
		"linear-gradient(180deg,#f59e0b,#d97706)",

	color: "#fff",

	border:
		"1px solid rgba(245,158,11,.35)",

	boxShadow:
		"0 10px 24px rgba(245,158,11,.28)",

	"&:hover": {
		background:
			"linear-gradient(180deg,#fbbf24,#f59e0b)",
	},
};

const formFieldSx = {
	"& .MuiOutlinedInput-root": {
		borderRadius: "16px",

		background:
			"rgba(255,255,255,.04)",

		color: "#fff",

		"& fieldset": {
			borderColor:
				"rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(59,130,246,.45)",
		},

		"&.Mui-focused fieldset": {
			borderColor:
				"#3b82f6",
		},
	},

	"& input": {
		color: "#fff",
	},
};

const darkModalBox = {
	borderRadius: 28,

	position: "relative",

	overflow: "hidden",

	background:
		"linear-gradient(180deg,#0f172a,#111827)",

	color: "#fff",

	border:
		"1px solid rgba(255,255,255,.06)",

	boxShadow:
		"0 35px 90px rgba(0,0,0,.55)",
};

const actionSecondary = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"rgba(255,255,255,.04)",

	color: "#fff",

	border:
		"1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background:
			"rgba(255,255,255,.08)",
	},
};

const actionDanger = {
	borderRadius: 12,

	textTransform: "none",

	fontWeight: 700,

	background:
		"linear-gradient(135deg,#dc2626,#ef4444)",

	color: "#fff",

	boxShadow:
		"0 10px 24px rgba(239,68,68,.28)",
};

const searchPanel = {
	display: "flex",

	alignItems: "center",

	gap: 12,

	height: 52,

	padding: "0 18px",

	borderRadius: 16,

	background: "rgba(255,255,255,0.03)",

	border:
		"1px solid rgba(255,255,255,.06)",
};

const wrap = {
	background:
		"linear-gradient(180deg,#0f172a,#111827)",

	borderRadius: 24,

	padding: 24,

	border:
		"1px solid rgba(255,255,255,.06)",
};

const popupOverlay = {
	position: "fixed",
	inset: 0,
	background: "rgba(15,23,42,0.55)",
	backdropFilter: "blur(8px)",
	WebkitBackdropFilter: "blur(8px)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	zIndex: 5000,
};

const popupBox = {
	width: 500,

	padding: 24,

	...darkModalBox,
};

function DispatchedItemsPage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	/* ===== SEARCH + FILTER ===== */
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [groupBy, setGroupBy] = useState("NONE");
	const [fromLocation, setFromLocation] = useState("");
	const role = localStorage.getItem("role");
	const isAdmin = role === "ADMIN";
	const isDispatch = role === "DISPATCH";
	const [historyOpen, setHistoryOpen] = useState(false);
	const [, setHistoryItem] = useState(null);
	const [historyRows, setHistoryRows] = useState([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [auditOpen, setAuditOpen] = useState(false);
	const [auditLoading, setAuditLoading] = useState(false);
	const [auditRows, setAuditRows] = useState([]);
	const [actionFilter, setActionFilter] = useState("ALL");
	const [roleFilter, setRoleFilter] = useState("ALL");
	const [selectionModel, setSelectionModel] = useState([]);
	const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
	const [bulkLoading, setBulkLoading] = useState(false);
	const [gatePassModal, setGatePassModal] = useState(null);
	const [warehouseCode, setWarehouseCode] = useState("");
	const [gatePassPreview, setGatePassPreview] = useState(null);
	const [moveFgModal, setMoveFgModal] = useState(null);
	const [selectedFgZone, setSelectedFgZone] = useState("");
	const [moveFgLoading, setMoveFgLoading] = useState(false);


	const [bulkMoveFgOpen, setBulkMoveFgOpen] = useState(false);
	const [bulkSelectedFgZone, setBulkSelectedFgZone] = useState("");
	const [bulkMoveFgLoading, setBulkMoveFgLoading] = useState(false);
	const [statusModal, setStatusModal] = useState(null);
	const [chalaanPreview, setChalaanPreview] = useState(null);
	const [bulkGatePassOpen, setBulkGatePassOpen] = useState(false);
	const [bulkGatePassPreview, setBulkGatePassPreview] = useState(null);
	const [bulkStatusModal, setBulkStatusModal] = useState(false);
	const [pageNo, setPageNo] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const scannerInputRef = useRef(null);
	const scanTimerRef = useRef(null);
	const [fgZone, setFgZone] = useState("");
	const [qrDispatchOpen, setQrDispatchOpen] = useState(false);
	const [scanMode, setScanMode] = useState("SINGLE");
	const [scannerText, setScannerText] = useState("");
	const [scanLoading, setScanLoading] = useState(false);
	const [scanMessage, setScanMessage] = useState("");
	const [scanCart, setScanCart] = useState([]);
	const [pendingQrFgItem, setPendingQrFgItem] = useState(null);
	const [pendingQrFgZone, setPendingQrFgZone] = useState("");
	const [qrMoveFgLoading, setQrMoveFgLoading] = useState(false);
	const [plantConfigs, setPlantConfigs] = useState([]);
	const [logisticsDrivers, setLogisticsDrivers] = useState([]);
	const [logisticsVehicles, setLogisticsVehicles] = useState([]);

	const [dispatchTripOpen, setDispatchTripOpen] = useState(false);
	const [dispatchTripLoading, setDispatchTripLoading] = useState(false);

	const [dispatchTripContext, setDispatchTripContext] = useState({
		mode: "",
		itemIds: [],
		scanTexts: [],
		qrCart: [],
		title: "",
	});

	const [dispatchTripForm, setDispatchTripForm] = useState({
		driverId: "",
		vehicleId: "",
		tripStart: "",
	});
	const [adminStickerEditOpen, setAdminStickerEditOpen] = useState(false);
	const [adminStickerEditRow, setAdminStickerEditRow] = useState(null);
	const [adminStickerEditForm, setAdminStickerEditForm] = useState({
		itemName: "",
		pdNo: "",
		drawingNo: "",
		clientName: "",
		clientAddress: "",
		floor: "",
		description: "",
		weight: "",
		dimensions: "",
		remarks: "",
		location: "",
	});

	const filteredRows = useMemo(() => {
		if (!Array.isArray(rows)) return [];

		const q = search.trim().toLowerCase();

		return rows.filter((r) => {
			const name = r.name || "";
			const sku = r.sku || "";
			const client = r.clientName || "";
			const pdNo = r.pdNo || "";
			const drawingNo = r.drawingNo || "";
			const description = r.description || "";

			if (
				q &&
				!name.toLowerCase().includes(q) &&
				!sku.toLowerCase().includes(q) &&
				!client.toLowerCase().includes(q) &&
				!pdNo.toLowerCase().includes(q) &&
				!drawingNo.toLowerCase().includes(q) &&
				!description.toLowerCase().includes(q)
			) {
				return false;
			}

			if (statusFilter !== "ALL" && r.status !== statusFilter) {
				return false;
			}

			return true;
		});
	}, [rows, search, statusFilter]);

	const filteredSelectableRows = useMemo(() => {
		return filteredRows.filter((r) => !!r.zohoItemId);
	}, [filteredRows]);

	const filteredSelectableIds = useMemo(() => {
		return filteredSelectableRows.map((r) => r.zohoItemId);
	}, [filteredSelectableRows]);

	const allFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.every((id) => selectionModel.includes(id));

	const someFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.some((id) => selectionModel.includes(id));

	const toggleSelectAllFiltered = (checked) => {
		if (checked) {
			setSelectionModel((prev) =>
				Array.from(new Set([...prev, ...filteredSelectableIds]))
			);
		} else {
			setSelectionModel((prev) =>
				prev.filter((id) => !filteredSelectableIds.includes(id))
			);
		}
	};

	const paginatedRows = useMemo(() => {
		const start = (pageNo - 1) * pageSize;

		return filteredRows.slice(
			start,
			start + pageSize
		);
	}, [filteredRows, pageNo, pageSize]);

	const totalPages = Math.max(
		1,
		Math.ceil(filteredRows.length / pageSize)
	);

	useEffect(() => {
		console.log("ROWS IDS:", rows.map(r => r.zohoItemId));
		console.log("SELECTED IDS:", selectionModel);
	}, [selectionModel, rows]);

	useEffect(() => {
		setPageNo(1);
	}, [pageSize]);

	useEffect(() => {
		setPageNo(1);
	}, [search, statusFilter, groupBy]);

	useEffect(() => {
		const maxPage =
			Math.max(
				1,
				Math.ceil(filteredRows.length / pageSize)
			);

		if (pageNo > maxPage) {
			setPageNo(maxPage);
		}
	}, [filteredRows.length, pageSize, pageNo]);

	useEffect(() => {
		if (!qrDispatchOpen) return;

		setTimeout(() => {
			scannerInputRef.current?.focus();
		}, 150);
	}, [qrDispatchOpen, scanMode, scanCart.length]);

	const getAuthHeaders = () => {
		const token = localStorage.getItem("token");

		if (!token) {
			console.error("❌ No token found");
			return {};
		}
		return {
			Authorization: `Bearer ${token}`,
		};
	};

	const getCurrentLocation = (row) => {
		return row?.currentLocationCode || row?.location || "";
	};

	const isLegacyLocationMissing = (row) => {
		return (
			!row?.plantCode ||
			!row?.currentLocationCode ||
			!row?.fgAreaCode
		);
	};

	const isPkdLocation = (row) => {
		const loc = getCurrentLocation(row);
		return loc?.startsWith("PKD");
	};

	const isFgLocation = (row) => {
		const loc = getCurrentLocation(row);
		const fg = row?.fgAreaCode;

		if (!loc || !fg) return false;

		return loc.startsWith(fg);
	};

	const canMoveToFg = (row) => {
		return (
			isDispatch &&
			row?.status === "READY" &&
			!isLegacyLocationMissing(row) &&
			isPkdLocation(row)
		);
	};

	const canChangeReadyStatus = (row) => {
		return (
			isDispatch &&
			row?.status === "READY" &&
			(
				isLegacyLocationMissing(row) || isFgLocation(row)
			)
		);
	};

	const getDisplayStatus = (row) => {
		if (row.status === "READY") {
			if (isLegacyLocationMissing(row)) {
				return {
					label: "Packed",
					sx: packedYellowChip,
				};
			}

			if (isPkdLocation(row)) {
				return {
					label: `Packed - ${getCurrentLocation(row)}`,
					sx: packedYellowChip,
				};
			}

			if (isFgLocation(row)) {
				return {
					label: `Packed - ${getCurrentLocation(row)}`,
					sx: packedGreenChip,
				};
			}

			return {
				label: "Packed",
				sx: packedYellowChip,
			};
		}

		if (row.status === "READY_TO_STORE") {
			return {
				label: "Ready To Store",
				sx: pendingStatusChip,
			};
		}

		if (row.status === "READY_TO_DISPATCH") {
			return {
				label: "Ready To Dispatch",
				sx: readyStatusChip,
			};
		}

		if (row.status === "WAREHOUSE_REQUESTED") {
			return {
				label: "Warehouse Requested",
				sx: pendingStatusChip,
			};
		}

		if (row.status === "IN_WAREHOUSE") {
			return {
				label: "In Warehouse",
				sx: dispatchedStatusChip,
			};
		}

		if (row.status === "DISPATCHED") {
			return {
				label: "Dispatched",
				sx: dispatchedStatusChip,
			};
		}

		if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
			return {
				label: "Warehouse Return Requested",
				sx: pendingStatusChip,
			};
		}

		return {
			label: row.status || "—",
			sx: pendingStatusChip,
		};
	};

	const getNowDateTimeLocal = () => {
		const d = new Date();

		d.setMinutes(
			d.getMinutes() - d.getTimezoneOffset()
		);

		return d.toISOString().slice(0, 16);
	};

	const fetchData = async () => {
		try {
			setLoading(true);
			console.log("TOKEN:", localStorage.getItem("token"));
			console.log("ROLE:", localStorage.getItem("role"));
			const res = await fetch(`${API_BASE_URL}/api/dispatched`, {
				method: "GET",
				headers: getAuthHeaders(),
			});

			if (!res.ok) throw new Error("Failed to fetch dispatched items");

			const data = await res.json();
			console.log("📦 API DATA:", data);
			console.log("📦 FIRST ITEM:", data?.[0]);

			if (!Array.isArray(data)) {
				console.error("Invalid API response:", data);
				setRows([]);
				return;
			}
			console.log("STOCK VALUES:", data.map(d => d.stock));

			const cleaned = data
				.filter(d => d?.zohoItemId)
				.map(d => ({
					...d,
					stock: d.stock ?? 0,
					status: (d.status || "").trim()
				}));

			setRows(cleaned);

			return cleaned;
		} catch (err) {
			console.error(err);
			setRows([]);
			return;
		} finally {
			setLoading(false);
		}
	};

	const PLANT_LOCATION_MAP = {
		"AL-P1": {
			label: "AL-P1 (AKG)",
			packedAreaCode: "PKD-1",
			fgAreaCode: "FG-1",
			fgZones: ["A", "B", "C"],
		},
		"AL-P2": {
			label: "AL-P2 (Sofa)",
			packedAreaCode: "PKD-2",
			fgAreaCode: "FG-2",
			fgZones: [],
		},
		"AL-P3": {
			label: "AL-P3 (K&W)",
			packedAreaCode: "PKD-3",
			fgAreaCode: "FG-3",
			fgZones: [],
		},
		"AL-P4": {
			label: "AL-P4 (Basement)",
			packedAreaCode: "PKD-4",
			fgAreaCode: "FG-4",
			fgZones: [],
		},
	};

	const getPlantCodeFromRow = (row) => {
		return (row?.plantCode || "").trim().split(" ")[0];
	};

	const getPlantConfigFromRow = (row) => {
		const plantCode = getPlantCodeFromRow(row);
		return PLANT_LOCATION_MAP[plantCode] || null;
	};

	const getFgAreaFromRow = (row) => {
		const config = getPlantConfigFromRow(row);

		return (
			row?.fgAreaCode ||
			config?.fgAreaCode ||
			""
		);
	};

	const getFgZonesForRow = (row) => {
		if (!row) return [];

		if (Array.isArray(row.fgZones)) {
			return row.fgZones
				.map((z) =>
					typeof z === "string"
						? z
						: z?.zoneCode || z?.code || z?.name || ""
				)
				.filter(Boolean)
				.map(String);
		}

		const config = getPlantConfigFromRow(row);

		if (config?.fgZones?.length) {
			return config.fgZones;
		}

		const fgArea = getFgAreaFromRow(row);

		if (fgArea === "FG-1") {
			return ["A", "B", "C"];
		}

		return [];
	};

	const getFgZonesForPlantCode = (plantCode) => {
		const config = PLANT_LOCATION_MAP[plantCode];

		return config?.fgZones || [];
	};

	const getFgZoneLabel = (row, zone) => {
		const fgArea = getFgAreaFromRow(row) || "FG";

		return `${fgArea} - Zone ${zone}`;
	};

	const isInFgLocation = (row) => {
		const currentLocation =
			row?.currentLocationCode ||
			row?.location ||
			"";

		const fgArea = getFgAreaFromRow(row);

		if (!currentLocation || !fgArea) return false;

		return (
			currentLocation === fgArea ||
			currentLocation.startsWith(`${fgArea}-`) ||
			currentLocation.startsWith(`${fgArea} `)
		);
	};

	const openMoveToFgModal = (row) => {
		setMoveFgModal(row);

		// Important: keep blank. User must actively choose A/B/C.
		// This stops the dropdown from snapping back to A.
		setSelectedFgZone("");
	};

	const openBulkMoveToFgModal = () => {
		setBulkSelectedFgZone("");
		setBulkMoveFgOpen(true);
	};

	const renderNativeFgZoneSelect = ({
		row,
		value,
		onChange,
	}) => {
		const zones = getFgZonesForRow(row);

		if (!zones.length) {
			return (
				<Box
					sx={{
						mb: 2,
						p: 1.5,
						borderRadius: "12px",
						color: "#6ee7b7",
						fontWeight: 900,
						fontSize: 13,
						background: "rgba(16,185,129,.10)",
						border: "1px solid rgba(16,185,129,.18)",
					}}
				>
					No zone required. This item will move to {getFgAreaFromRow(row)}.
				</Box>
			);
		}

		return (
			<Box sx={{ mb: 2 }}>
				<Box
					sx={{
						color: "#94a3b8",
						fontSize: 12,
						fontWeight: 800,
						mb: 0.8,
					}}
				>
					Select FG Zone
				</Box>

				<Box
					component="select"
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
					}}
					sx={nativeFgSelectSx}
				>
					<option value="">
						Select Zone
					</option>

					{zones.map((zone) => (
						<option
							key={zone}
							value={zone}
						>
							{getFgZoneLabel(row, zone)}
						</option>
					))}
				</Box>
			</Box>
		);
	};

	const fetchPlantConfigs = async () => {
		try {
			const res = await fetch(`${API_BASE_URL}/api/plants/my`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			if (!res.ok) {
				throw new Error(await res.text());
			}

			const data = await res.json();

			setPlantConfigs(Array.isArray(data) ? data : []);
		} catch (e) {
			console.error("Failed to fetch plant configs", e);
			setPlantConfigs([]);
		}
	};

	const fetchLogisticsMasters = async () => {
		try {
			const [drivers, vehicles] = await Promise.all([
				fetchDrivers(),
				fetchVehicles(),
			]);

			setLogisticsDrivers(Array.isArray(drivers) ? drivers : []);
			setLogisticsVehicles(Array.isArray(vehicles) ? vehicles : []);
		} catch (e) {
			console.error("Failed to load logistics masters", e);
			alert("Failed to load drivers/vehicles");
		}
	};

	const resolveScan = async (rawScan) => {
		const res = await fetch(`${API_BASE_URL}/api/scanner/resolve`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...getAuthHeaders(),
			},
			body: JSON.stringify({
				scanText: rawScan,
			}),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || "Unable to resolve QR scan");
		}

		return await res.json();
	};

	const getScanFgZones = (item) => {
		return Array.isArray(item?.fgZones)
			? item.fgZones.filter(Boolean)
			: [];
	};

	const isScanFgZoneRequired = (item) => {
		return Boolean(item?.fgZoneRequired) || getScanFgZones(item).length > 0;
	};

	const moveScannedItemToFg = async (item, fgZoneCode = "") => {
		if (!item?.zohoItemId) {
			throw new Error("Scanned item id missing");
		}

		const zones = getScanFgZones(item);
		const finalZone = fgZoneCode?.trim();

		if (zones.length > 0 && !finalZone) {
			throw new Error("Please select FG zone");
		}

		const query = finalZone
			? `?fgZoneCode=${encodeURIComponent(finalZone)}`
			: "";

		const res = await fetch(
			`${API_BASE_URL}/api/dispatched/${encodeURIComponent(item.zohoItemId)}/move-to-fg${query}`,
			{
				method: "POST",
				headers: getAuthHeaders(),
			}
		);

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || "Move to FG failed");
		}
	};

	const handleSingleQrScan = async (rawScan) => {
		try {
			setScanLoading(true);
			setScanMessage("Reading scanned QR...");

			const item = await resolveScan(rawScan);

			if (item.moveToFgRequired) {
				setPendingQrFgItem({
					...item,
					rawScan,
				});

				setPendingQrFgZone("");
				setScannerText("");

				setScanMessage(
					item.message || "Move item to FG before QR dispatch"
				);

				return;
			}

			if (!item.dispatchAllowed) {
				setScanMessage(item.message || "Item cannot be dispatched");
				alert(item.message || "Item cannot be dispatched");
				return;
			}

			await dispatchSingleByScan(rawScan);
		} catch (err) {
			console.error(err);
			setScanMessage(err.message || "QR scan failed");
			alert(err.message || "QR scan failed");
		} finally {
			setScanLoading(false);
		}
	};

	const confirmSingleQrMoveToFgAndDispatch = async () => {
		if (!pendingQrFgItem) return;

		try {
			setQrMoveFgLoading(true);
			setScanMessage("Moving scanned item to FG...");

			await moveScannedItemToFg(
				pendingQrFgItem,
				pendingQrFgZone
			);

			setScanMessage("Item moved to FG. Generating challan...");

			const rawScan = pendingQrFgItem.rawScan;

			setPendingQrFgItem(null);
			setPendingQrFgZone("");

			await dispatchSingleByScan(rawScan);
		} catch (err) {
			console.error(err);
			setScanMessage(err.message || "Move to FG failed");
			alert(err.message || "Move to FG failed");
		} finally {
			setQrMoveFgLoading(false);
		}
	};

	const updateScanCartFgZone = (zohoItemId, fgZoneCode) => {
		setScanCart((prev) =>
			prev.map((item) =>
				item.zohoItemId === zohoItemId
					? {
						...item,
						fgZoneCode,
					}
					: item
			)
		);
	};

	const moveQrCartItemsToFgIfNeeded = async (items) => {
		for (const item of items) {
			if (!item.moveToFgRequired) continue;

			await moveScannedItemToFg(
				item,
				item.fgZoneCode || ""
			);
		}
	};

	const dispatchSingleByScan = async (rawScan) => {
		setScannerText("");
		setScanMessage("Select driver and vehicle to create trip");

		openDispatchTripModal({
			mode: "QR_SINGLE",
			scanTexts: [rawScan],
			title: "QR Single Dispatch",
		});
	};

	const addBulkScanToCart = async (rawScan) => {
		try {
			setScanLoading(true);
			setScanMessage("Reading scanned QR...");

			const item = await resolveScan(rawScan);

			if (!item.dispatchAllowed && !item.moveToFgRequired) {
				setScanMessage(item.message || "Item cannot be dispatched");
				alert(item.message || "Item cannot be dispatched");
				return;
			}

			const alreadyAdded = scanCart.some(
				(x) => x.zohoItemId === item.zohoItemId
			);

			if (alreadyAdded) {
				setScanMessage("Item already scanned");
				setScannerText("");
				return;
			}

			setScanCart((prev) => [
				...prev,
				{
					...item,
					rawScan,
					fgZoneCode: "",
				},
			]);

			setScannerText("");
			setScanMessage(
				item.moveToFgRequired
					? `Added: ${item.itemName}. Move to FG required.`
					: `Added: ${item.itemName}`
			);
		} catch (err) {
			console.error(err);
			setScanMessage(err.message || "Failed to add scanned item");
			alert(err.message || "Failed to add scanned item");
		} finally {
			setScanLoading(false);

			setTimeout(() => {
				scannerInputRef.current?.focus();
			}, 100);
		}
	};

	const processScannedText = async (rawValue) => {
		const rawScan = rawValue?.trim();

		if (!rawScan || scanLoading) return;

		if (scanMode === "SINGLE") {
			await handleSingleQrScan(rawScan);
		} else {
			await addBulkScanToCart(rawScan);
		}
	};

	const handleScannerChange = (e) => {
		const value = e.target.value;

		setScannerText(value);

		if (scanTimerRef.current) {
			clearTimeout(scanTimerRef.current);
		}

		scanTimerRef.current = setTimeout(() => {
			processScannedText(value);
		}, 350);
	};

	const handleScannerKeyDown = async (e) => {
		if (e.key !== "Enter" && e.key !== "Tab") return;

		e.preventDefault();

		if (scanTimerRef.current) {
			clearTimeout(scanTimerRef.current);
		}

		await processScannedText(scannerText);
	};

	const generateBulkChalaanFromScans = async () => {
		if (scanCart.length === 0) {
			alert("Scan items first");
			return;
		}

		const missingZoneItem = scanCart.find((item) => {
			return (
				item.moveToFgRequired &&
				isScanFgZoneRequired(item) &&
				!item.fgZoneCode
			);
		});

		if (missingZoneItem) {
			alert(`Select FG zone for ${missingZoneItem.itemName}`);
			return;
		}

		openDispatchTripModal({
			mode: "QR_BULK",
			scanTexts: scanCart.map((x) => x.rawScan),
			qrCart: scanCart,
			title: "QR Bulk Dispatch",
		});
	};
	/* ===================== ACTIONS ===================== */

	const moveToFg = async () => {
		if (!moveFgModal) return;

		if (moveFgModal.plantCode === "AL-P1" && !fgZone) {
			alert("Select FG-1 zone A, B or C");
			return;
		}

		try {
			setMoveFgLoading(true);

			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
					moveFgModal.zohoItemId
				)}/move-to-fg?fgZoneCode=${encodeURIComponent(fgZone || "")}`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				alert(text || "Move to FG failed");
				return;
			}

			setMoveFgModal(null);
			setFgZone("");

			await fetchData();
		} catch (e) {
			console.error(e);
			alert("Move to FG failed");
		} finally {
			setMoveFgLoading(false);
		}
	};

	const requestRestore = async (zohoItemId) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/request-restore`,
				{
					method: "POST",
					headers: getAuthHeaders()
				});
			if (!res.ok) throw new Error();

			setRows(prev =>
				prev.map(r =>
					r.zohoItemId === zohoItemId
						? { ...r, approvalStatus: "PENDING" }
						: r
				)
			);
		} catch {
			alert("Failed to request restore");
		}
	};

	const updateStatus = async (zohoItemId, status) => {
		try {
			console.log("🚀 API CALL:", zohoItemId, status);
			let res = null;

			if (status === "READY_TO_STORE" || status === "READY_TO_DISPATCH") {
				res = await fetch(
					`${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/dispatch?status=${status}`,
					{
						method: "POST",
						headers: {
							...getAuthHeaders(),
							"X-Username": localStorage.getItem("username"),
						},
					}
				);
			} else {
				console.warn("⛔ Invalid status:", status);
				return;
			}

			if (!res) {
				alert("No API call made");
				return;
			}

			console.log("🚀 API RESPONSE STATUS:", res.status);
			if (!res.ok) {
				const text = await res.text();
				console.error("❌ BACKEND ERROR:", text);
				alert(text || "Status update failed");
				return;
			}

			console.log("✅ SUCCESS");

			await fetchData();

		} catch (err) {
			console.error("❌ ERROR:", err);
			alert("Status update failed");
		}
	};

	const approveRestore = async (zohoItemId) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/approve-restore`,
				{
					method: "POST",
					headers: getAuthHeaders()
				});
			if (!res.ok) throw new Error();
			await fetchData();
		} catch {
			alert("Approval failed");
		}
	};

	const rejectRestore = async (zohoItemId) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(zohoItemId)}/reject-restore`,
				{
					method: "POST",
					headers: getAuthHeaders()
				});
			if (!res.ok) throw new Error();

			setRows(prev =>
				prev.map(r =>
					r.zohoItemId === zohoItemId
						? { ...r, approvalStatus: "REJECTED" }
						: r
				)
			);
		} catch {
			alert("Reject failed");
		}
	};

	const approveReturn = async (id) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${id}/approve-return`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			if (!res.ok) throw new Error();

			await fetchData();
		} catch {
			alert("Approval failed");
		}
	};

	const rejectReturn = async (id) => {
		try {
			const res = await fetch(
				`${API_BASE_URL}/api/dispatched/${id}/reject-return`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			if (!res.ok) throw new Error();

			await fetchData();
		} catch {
			alert("Reject failed");
		}
	};


	/* ===================== DOWNLOAD ===================== */

	const openStickerHistory = async (itemId) => {
		try {
			setHistoryOpen(true);
			setHistoryLoading(true);
			setHistoryRows([]);
			setHistoryItem(itemId);

			const res = await fetch(
				`${API_BASE_URL}/api/stickers/${encodeURIComponent(itemId)}/history`,
				{
					method: "GET",
					headers: getAuthHeaders()
				});

			if (!res.ok) throw new Error("History fetch failed");

			const data = await res.json();
			setHistoryRows(data);
		} catch (err) {
			console.error(err);
			alert("Failed to load sticker history");
		} finally {
			setHistoryLoading(false);
		}
	};

	const openAuditLogs = async (zohoItemId) => {
		try {
			setAuditOpen(true);
			setAuditLoading(true);
			setAuditRows([]);

			const res = await fetch(
				`${API_BASE_URL}/api/audit/${encodeURIComponent(zohoItemId)}`,
				{
					method: "GET",
					headers: getAuthHeaders()
				});

			if (!res.ok) throw new Error("Audit fetch failed");

			const data = await res.json();
			setAuditRows(data);
		} catch (err) {
			console.error(err);
			alert("Failed to load activity logs");
		} finally {
			setAuditLoading(false);
		}
	};


	/* ===================== COLUMNS ===================== */

	const selectableStatuses = [
		"READY",
		"READY_TO_STORE",
		"READY_TO_DISPATCH",
		"WAREHOUSE_RETURN_REQUESTED" // optional if needed
	];

	const columns = [
		{
			field: "select",
			headerName: "",
			width: 70,
			sortable: false,

			renderHeader: () => {
				return (
					<Box sx={selectHeaderCellSx}>
						<input
							type="checkbox"
							ref={(el) => {
								if (el) {
									el.indeterminate = someFilteredSelected && !allFilteredSelected;
								}
							}}
							checked={allFilteredSelected}
							disabled={filteredSelectableIds.length === 0}
							title="Select all filtered rows"
							style={
								filteredSelectableIds.length === 0
									? selectCheckboxDisabledStyle
									: selectCheckboxStyle
							}
							onChange={(e) => {
								toggleSelectAllFiltered(e.target.checked);
							}}
						/>
					</Box>
				);
			},

			renderCell: (params) => {
				const id = params.row.zohoItemId;
				const isSelectable = !!id;

				return (
					<Box sx={selectHeaderCellSx}>
						<input
							type="checkbox"
							disabled={!isSelectable}
							checked={isSelectable && selectionModel.includes(id)}
							style={
								isSelectable
									? selectCheckboxStyle
									: selectCheckboxDisabledStyle
							}
							onChange={(e) => {
								if (!isSelectable) return;

								if (e.target.checked) {
									setSelectionModel((prev) =>
										prev.includes(id) ? prev : [...prev, id]
									);
								} else {
									setSelectionModel((prev) =>
										prev.filter((item) => item !== id)
									);
								}
							}}
						/>
					</Box>
				);
			},
		},
		{
			field: "name",
			headerName: "Item Name",
			flex: 1,
			minWidth: 300,

			renderHeader: () => (
				<span>Item Name</span>
			),

			renderCell: (params) => {
				const row = params.row;

				return (
					<Box sx={itemNameCell}>
						<Tooltip title="Sticker History" arrow>
							<IconButton
								size="small"
								sx={stickerHistoryButton}
								onClick={() => {
									if (!row.packetItemId) {
										alert("Packet Item ID missing");
										return;
									}

									openStickerHistory(row.packetItemId);
								}}
							>
								<DownloadOutlinedIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Tooltip title="Activity / Audit Logs" arrow>
							<IconButton
								size="small"
								sx={auditLogButton}
								onClick={() => {
									if (!row.zohoItemId) {
										alert("Zoho Item ID missing");
										return;
									}

									openAuditLogs(row.zohoItemId);
								}}
							>
								<DescriptionOutlinedIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<span style={itemNameText} title={row.name}>
							{row.name || "—"}
						</span>
					</Box>
				);
			},
		},
		{
			field: "sku",
			headerName: "SKU",
			width: 280,

			renderHeader: () => (
				<span>SKU</span>
			),

			renderCell: (params) => (
				<span style={simpleMonoText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "pdNo",
			headerName: "PD No",
			width: 140,

			renderHeader: () => (
				<span>PD No</span>
			),

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "drawingNo",
			headerName: "Dwg No.",
			width: 160,

			renderHeader: () => (
				<span>DWG No</span>
			),

			renderCell: (params) => (
				<span style={simpleMonoText} title={params.value}>
					{params.value || "N/A"}
				</span>
			),
		},
		{
			field: "description",
			headerName: "Description",
			width: 220,

			renderHeader: () => (
				<span>Description</span>
			),

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "No description"}
				</span>
			),
		},
		{
			field: "stock",
			headerName: "Stock",
			width: 100,
			renderHeader: () => (
				<span>Stock</span>
			),
			renderCell: (params) => (
				<span
					style={{
						fontWeight: 700,
						color: params.value === 0 ? "#ff6b6b" : "#4caf50",
					}}
				>
					{params.value}
				</span>
			),
		},
		{
			field: "clientName",
			headerName: "Client",
			minWidth: 180,

			renderHeader: () => (
				<span>Client</span>
			),

			renderCell: (params) => (
				<span style={simpleCellText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "plantCode",
			headerName: "Plant",
			width: 120,

			renderHeader: () => <span>Plant</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={params.value}>
					{params.value || "—"}
				</span>
			),
		},
		{
			field: "currentLocationCode",
			headerName: "Location",
			width: 170,

			renderHeader: () => <span>Location</span>,

			renderCell: (params) => (
				<span style={simpleMutedText} title={getCurrentLocation(params.row)}>
					{getCurrentLocation(params.row) || "—"}
				</span>
			),
		},
		{
			field: "status",
			headerName: "Status",
			width: 280,

			renderHeader: () => (
				<span>Status</span>
			),

			renderCell: (params) => {
				const row = params.row;

				const inFg = isInFgLocation(row);

				let label = row.status || "—";
				let sx = pendingStatusChip;

				if (row.status === "QUEUED") {
					label = "QUEUED";
					sx = queuedStatusChip;
				}

				if (row.status === "READY") {
					if (inFg) {
						label = "PACKED - FG";
						sx = dispatchedStatusChip;
					} else {
						label = "PACKED - PKD";
						sx = pendingStatusChip;
					}
				}

				if (row.status === "READY_TO_STORE") {
					label = "READY TO STORE";
					sx = readyStatusChip;
				}

				if (row.status === "WAREHOUSE_REQUESTED") {
					label = "WAREHOUSE REQUESTED";
					sx = pendingStatusChip;
				}

				if (row.status === "IN_WAREHOUSE") {
					label = "IN WAREHOUSE";
					sx = dispatchedStatusChip;
				}

				if (row.status === "READY_TO_DISPATCH") {
					label = "READY TO DISPATCH";
					sx = readyStatusChip;
				}

				if (row.status === "DISPATCHED") {
					label = "DISPATCHED";
					sx = dispatchedStatusChip;
				}

				if (row.status === "OUT_FOR_DELIVERY") {
					label = "DISPATCHED - OUT FOR DELIVERY";
					sx = readyStatusChip;
				}

				if (row.status === "DELIVERED") {
					label = "DELIVERED";
					sx = dispatchedStatusChip;
				}

				if (row.status === "WAREHOUSE_RETURN_REQUESTED") {
					label = "RETURN REQUESTED";
					sx = pendingStatusChip;
				}

				return (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
						<Chip
							size="small"
							label={label}
							sx={sx}
						/>

						{(row.driverName || row.vehicleNumber) && (
							<Box
								sx={{
									color: "#94a3b8",
									fontSize: 11,
									fontWeight: 700,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
								title={`${row.driverName || "—"} • ${row.vehicleNumber || "—"}`}
							>
								{row.driverName || "—"} • {row.vehicleNumber || "—"}
							</Box>
						)}
					</Box>
				);
			},
		},
		{
			field: "actions",
			headerName: "Action",

			flex: 1,
			minWidth: 420,
			maxWidth: 500,

			sortable: false,

			renderHeader: () => (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					⚡ <span style={{ fontWeight: 700 }}>Action</span>
				</Box>
			),

			renderCell: (params) => {
				const row = params.row;

				const rowAction = getDispatchRowAction(row);

				const showMoveToFg =
					rowAction === "MOVE_TO_FG";

				const showChangeStatus =
					rowAction === "CHANGE_STATUS";

				const showGenerateGatePass =
					rowAction === "GATE_PASS";

				const showGenerateChalaan =
					rowAction === "CHALAAN";

				const canRequestRestore =
					["DISPATCHED", "DELIVERED"].includes(row.status) &&
					row.approvalStatus !== "PENDING";


				return (
					<Box sx={actionContainer}>
						{showMoveToFg && (
							<Button
								size="small"
								disabled={!isDispatch}
								onClick={() => openMoveToFgModal(row)}
								sx={moveToFgButtonSx}
							>
								Move to FG
							</Button>
						)}

						{showChangeStatus && (
							<Button
								size="small"
								onClick={() => setStatusModal(row)}
								sx={{
									...actionPrimary,
									...tableActionButton,
								}}
							>
								Change Status
							</Button>
						)}
						{showGenerateChalaan && (
							<Button
								size="small"
								onClick={async () => {
									try {
										const freshRows = await fetchData();

										const latestItem = freshRows?.find(
											r => r.zohoItemId === row.zohoItemId
										);

										if (!latestItem || latestItem.status !== "READY_TO_DISPATCH") {
											alert(`Item not ready. Current status: ${latestItem?.status}`);
											return;
										}

										openDispatchTripModal({
											mode: "UI_SINGLE",
											itemIds: [row.zohoItemId],
											title: row.name || row.itemName || "Single Chalaan",
										});
									} catch (err) {
										console.error(err);
										alert("Failed to prepare logistics dispatch");
									}
								}}
								sx={{
									...actionSecondary,
									...tableActionButton,
								}}
							>
								Generate Chalaan
							</Button>
						)}
						{showGenerateGatePass && (
							<Button
								size="small"
								onClick={() => {
									setGatePassModal(row);      // 🔥 open modal
									setWarehouseCode("");       // reset input
									setGatePassPreview(null);   // reset preview
								}}
								sx={{
									...premiumButton,
									background:
										"linear-gradient(135deg,#059669,#10b981)",
									color: "#fff"
								}}
							>
								Generate Gate Pass
							</Button>
						)}

						{isAdmin && row.approvalStatus === "PENDING" && (
							<>
								<Button
									size="small"
									onClick={() => approveRestore(row.zohoItemId)}
									sx={{
										...premiumButton,
										background:
											"linear-gradient(135deg,#059669,#10b981)",
										color: "#fff"
									}}
								>
									Approve
								</Button>
								<Button
									size="small"
									onClick={() => rejectRestore(row.zohoItemId)}
									sx={{
										...actionDanger,
										...tableActionButton,
									}}
								>
									Reject
								</Button>
							</>
						)}
						{isAdmin && (
							<Button
								size="small"
								onClick={() => openAdminStickerEdit(row)}
								sx={{
									...actionWarning,
									...tableActionButton,
								}}
							>
								Edit Sticker
							</Button>
						)}
						{canRequestRestore && (
							<Button
								size="small"
								onClick={() => requestRestore(row.zohoItemId)}
								sx={{
									...actionSecondary,
									...tableActionButton,
								}}
							>
								Request Restore
							</Button>
						)}

						{row.approvalStatus === "PENDING" && (
							<Chip label="REQUESTED" size="small" sx={pendingChip} />
						)}
						{isAdmin && row.status === "WAREHOUSE_RETURN_REQUESTED" && (
							<>
								<Button
									size="small"
									onClick={() => approveReturn(row.zohoItemId)}
									sx={{
										...premiumButton,
										background: "linear-gradient(180deg,#10b981,#059669)",
										color: "#fff"
									}}
								>
									Approve Return
								</Button>

								<Button
									size="small"
									onClick={() => rejectReturn(row.zohoItemId)}
									sx={{
										...actionDanger,
										...tableActionButton,
									}}
								>
									Reject
								</Button>
							</>
						)}

					</Box>
				);
			},
		},
	];


	useEffect(() => {
		fetchData();
		fetchPlantConfigs();
		fetchLogisticsMasters();
	}, []);


	const getActionStyle = (action = "") => {
		const a = action.toLowerCase();

		if (a.includes("approved"))
			return { bg: "rgba(209,250,229,0.9)", color: "#065f46" };

		if (a.includes("rejected"))
			return { bg: "rgba(254,226,226,0.9)", color: "#7f1d1d" };

		if (a.includes("requested"))
			return { bg: "rgba(254,243,199,0.9)", color: "#92400e" };

		if (a.includes("dispatched"))
			return { bg: "rgba(209,250,229,0.6)", color: "#065f46" };

		if (a.includes("packed"))
			return { bg: "rgba(219,234,254,0.6)", color: "#1e40af" };

		if (a.includes("sticker"))
			return { bg: "rgba(224,231,255,0.9)", color: "#3730a3" };

		return { bg: "rgba(243,244,246,0.9)", color: "#374151" };
	};

	const fallbackPlantConfigs = {
		"AL-P1": {
			plantCode: "AL-P1",
			packedAreaCode: "PKD-1",
			fgAreaCode: "FG-1",
			fgZones: ["A", "B", "C"],
		},
		"AL-P2": {
			plantCode: "AL-P2",
			packedAreaCode: "PKD-2",
			fgAreaCode: "FG-2",
			fgZones: [],
		},
		"AL-P3": {
			plantCode: "AL-P3",
			packedAreaCode: "PKD-3",
			fgAreaCode: "FG-3",
			fgZones: [],
		},
		"AL-P4": {
			plantCode: "AL-P4",
			packedAreaCode: "PKD-4",
			fgAreaCode: "FG-4",
			fgZones: [],
		},
	};

	const getPlantConfigForRow = (row) => {
		if (!row?.plantCode) return null;

		return (
			plantConfigs.find((p) => p.plantCode === row.plantCode) ||
			fallbackPlantConfigs[row.plantCode] ||
			null
		);
	};

	const getFgAreaForRow = (row) => {
		return (
			row?.fgAreaCode ||
			getPlantConfigForRow(row)?.fgAreaCode ||
			""
		);
	};

	const getRoleChipStyle = (role) => {
		if (role === "ADMIN")
			return { bg: "#111827", color: "#fff" };

		if (role === "DISPATCH")
			return { bg: "#065f46", color: "#ecfdf5" };

		if (role === "USER")
			return { bg: "#1e40af", color: "#eff6ff" };

		return { bg: "#374151", color: "#f9fafb" };
	};

	const getDateGroupLabel = (dateStr) => {
		const d = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date();

		yesterday.setDate(today.getDate() - 1);

		const sameDay = (a, b) =>
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate();

		if (sameDay(d, today)) return "Today";
		if (sameDay(d, yesterday)) return "Yesterday";

		return d.toLocaleDateString(undefined, {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	};

	/* ===== FILTERED ROWS ===== */
	console.log("🔥 selectionModel:", selectionModel);

	const getRowId = (row) => row?.zohoItemId || "";

	const getRowStatus = (row) => (row?.status || "").trim();

	const getRowCurrentLocation = (row) =>
		row?.currentLocationCode || row?.location || "";

	const isRowPlantAssigned = (row) =>
		!!row?.plantCode && !!row?.fgAreaCode;

	const isRowInFg = (row) => {
		const location = getRowCurrentLocation(row);
		const fgArea = row?.fgAreaCode || "";

		if (!location || !fgArea) return false;

		return location.startsWith(fgArea);
	};

	/*
	  IMPORTANT:
	  This decides what button the row should show.
	  Bulk bar will use this same function.
	*/
	const getDispatchRowAction = (row) => {
		if (!isDispatch || !row) {
			return "NONE";
		}

		if (canMoveToFg(row)) {
			return "MOVE_TO_FG";
		}

		if (canChangeReadyStatus(row)) {
			return "CHANGE_STATUS";
		}

		if (row.status === "READY_TO_STORE") {
			return "GATE_PASS";
		}

		if (row.status === "READY_TO_DISPATCH") {
			return "CHALAAN";
		}

		return "NONE";
	};

	const getBulkActionLabel = (action) => {
		if (action === "MOVE_TO_FG") return "Move to FG";
		if (action === "CHANGE_STATUS") return "Change Status";
		if (action === "GATE_PASS") return "Generate Gate Pass";
		if (action === "CHALAAN") return "Generate Chalaan";
		return "Mixed Selection";
	};

	const selectedItems = useMemo(() => {
		return rows.filter((row) =>
			selectionModel?.includes(getRowId(row))
		);
	}, [rows, selectionModel]);

	const selectedActionList = useMemo(() => {
		return selectedItems.map((row) => getDispatchRowAction(row));
	}, [selectedItems, isDispatch]);

	const selectedActionSet = useMemo(() => {
		return new Set(selectedActionList);
	}, [selectedActionList]);

	const isSingleBulkAction =
		selectedItems.length > 0 &&
		selectedActionSet.size === 1 &&
		!selectedActionSet.has("NONE");

	const selectedBulkAction = isSingleBulkAction
		? [...selectedActionSet][0]
		: "MIXED";

	const canBulkMoveToFg =
		selectedBulkAction === "MOVE_TO_FG";

	const canBulkChangeStatus =
		selectedBulkAction === "CHANGE_STATUS";

	const canBulkGenerateGatePass =
		selectedBulkAction === "GATE_PASS";

	const canBulkGenerateChalaan =
		selectedBulkAction === "CHALAAN";

	const allReadyToDispatch = canBulkGenerateChalaan;
	const allReadyToStore = canBulkGenerateGatePass;
	const allReady = canBulkChangeStatus;

	const allReadyInFg =
		allReady &&
		selectedItems.every((item) => isInFgLocation(item));

	const readyItemsNotInFg = selectedItems.filter(
		(item) => getDispatchRowAction(item) === "MOVE_TO_FG"
	);

	const selectedPlantCodes = Array.from(
		new Set(
			selectedItems
				.map((item) => getPlantCodeFromRow(item))
				.filter(Boolean)
		)
	);

	const isSinglePlantSelection =
		selectedPlantCodes.length === 1;

	const bulkMoveFgPlantCode =
		isSinglePlantSelection
			? selectedPlantCodes[0]
			: "";

	const getDispatchPacketItemId = (row) => {
		return row?.packetItemId || row?.itemId || row?.id || row?.zohoItemId || "";
	};

	const openAdminStickerEdit = (row) => {
		setAdminStickerEditRow(row);

		setAdminStickerEditForm({
			itemName: row.name || row.itemName || "",
			pdNo: row.pdNo || "",
			drawingNo: row.drawingNo || "",
			clientName: row.clientName || "",
			clientAddress: row.clientAddress || "",
			floor: row.floor || "",
			description: row.description || "",
			weight: row.weight || "",
			dimensions: row.dimensions || "",
			remarks: row.remarks || "",
			location: row.currentLocationCode || row.location || "",
		});

		setAdminStickerEditOpen(true);
	};

	const saveAdminStickerEdit = async () => {
		const itemId = getDispatchPacketItemId(adminStickerEditRow);

		if (!itemId) {
			alert("Packet item id missing");
			return;
		}

		try {
			const res = await fetch(
				`${API_BASE_URL}/api/packets/items/${encodeURIComponent(itemId)}/admin-sticker-details`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						...getAuthHeaders(),
					},
					body: JSON.stringify(adminStickerEditForm),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				alert(text || "Sticker edit failed");
				return;
			}

			setAdminStickerEditOpen(false);
			setAdminStickerEditRow(null);

			await fetchData();
		} catch (e) {
			console.error(e);
			alert("Sticker edit failed");
		}
	};

	const openDispatchTripModal = ({
		mode,
		itemIds = [],
		scanTexts = [],
		qrCart = [],
		title = "",
	}) => {
		setDispatchTripContext({
			mode,
			itemIds,
			scanTexts,
			qrCart,
			title,
		});

		setDispatchTripForm({
			driverId: "",
			vehicleId: "",
			tripStart: getNowDateTimeLocal(),
		});

		setDispatchTripOpen(true);
	};

	const submitDispatchTrip = async () => {
		if (!dispatchTripForm.driverId) {
			alert("Please select driver");
			return;
		}

		if (!dispatchTripForm.vehicleId) {
			alert("Please select vehicle");
			return;
		}

		if (!dispatchTripForm.tripStart) {
			alert("Please select dispatch time");
			return;
		}

		try {
			setDispatchTripLoading(true);

			const payloadBase = {
				driverId: dispatchTripForm.driverId,
				vehicleId: dispatchTripForm.vehicleId,
				tripStart: dispatchTripForm.tripStart,
			};

			let blob;
			let previewId = "CHALAAN";

			if (
				dispatchTripContext.mode === "UI_SINGLE" ||
				dispatchTripContext.mode === "UI_BULK"
			) {
				const result = await createDispatchChallan({
					itemIds: dispatchTripContext.itemIds,
					...payloadBase,
				});

				blob = result.blob;
				previewId =
					result.challanNo ||
					dispatchTripContext.itemIds?.[0] ||
					"CHALAAN";
			}

			if (dispatchTripContext.mode === "QR_SINGLE") {
				const res = await fetch(
					`${API_BASE_URL}/api/scanner/dispatch-single?preview=true`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...getAuthHeaders(),
						},
						body: JSON.stringify({
							scanText: dispatchTripContext.scanTexts[0],
							...payloadBase,
						}),
					}
				);

				if (!res.ok) {
					const text = await res.text();
					throw new Error(text || "QR dispatch failed");
				}

				blob = await res.blob();
				previewId = "QR_SINGLE";
			}

			if (dispatchTripContext.mode === "QR_BULK") {
				const missingZoneItem = dispatchTripContext.qrCart.find((item) => {
					return (
						item.moveToFgRequired &&
						isScanFgZoneRequired(item) &&
						!item.fgZoneCode
					);
				});

				if (missingZoneItem) {
					alert(`Select FG zone for ${missingZoneItem.itemName}`);
					return;
				}

				await moveQrCartItemsToFgIfNeeded(dispatchTripContext.qrCart);

				const res = await fetch(
					`${API_BASE_URL}/api/scanner/dispatch-bulk?preview=true`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...getAuthHeaders(),
						},
						body: JSON.stringify({
							scanTexts: dispatchTripContext.scanTexts,
							...payloadBase,
						}),
					}
				);

				if (!res.ok) {
					const text = await res.text();
					throw new Error(text || "Bulk QR dispatch failed");
				}

				blob = await res.blob();
				previewId = "QR_BULK";
			}

			if (!blob) {
				throw new Error("No challan PDF generated");
			}

			const url = URL.createObjectURL(blob);

			setChalaanPreview({
				url,
				id: previewId,
			});

			setDispatchTripOpen(false);

			setDispatchTripContext({
				mode: "",
				itemIds: [],
				scanTexts: [],
				qrCart: [],
				title: "",
			});

			setScanCart([]);
			setScannerText("");
			setQrDispatchOpen(false);
			setSelectionModel([]);

			await fetchData();
		} catch (e) {
			console.error(e);
			alert(e.message || "Dispatch trip failed");
		} finally {
			setDispatchTripLoading(false);
		}
	};

	return (
		<div style={page}>
			<div style={content}>
				<div style={headerRow}>
					<div>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							<Box
								sx={{
									fontSize: 34,
									display: "flex",
									alignItems: "center",
									color: "#60a5fa",
								}}
							>
								🚚
							</Box>

							<div>
								<div style={logo}>
									Dispatched Items
								</div>

								<div style={subtitle}>
									Track, manage and dispatch inventory operations
								</div>
							</div>
						</Box>
					</div>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 2,
						}}
					>
						<Box
							sx={{
								color: "#94a3b8",
								fontSize: 14,
								fontWeight: 600,
							}}
						>
							Total Items:{" "}
							<span
								style={{
									color: "#60a5fa",
									fontWeight: 800,
								}}
							>
								{filteredRows.length}
							</span>
						</Box>

						{isDispatch && (
							<Button
								onClick={() => {
									setQrDispatchOpen(true);
									setScanMode("SINGLE");
									setScannerText("");
									setScanMessage("");
									setScanCart([]);
									setPendingQrFgItem(null);
									setPendingQrFgZone("");
								}}
								sx={qrDispatchButtonSx}
							>
								📷 QR Dispatch
							</Button>
						)}
					</Box>

				</div>


				<Box sx={searchPanel}>
					<SearchIcon
						sx={{
							color: "rgba(255,255,255,.45)",
						}}
					/>

					<TextField
						variant="standard"
						placeholder="Search by Item or Client..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						InputProps={{ disableUnderline: true }}
						sx={{
							flex: 1,

							"& .MuiInputBase-root": {
								color: "#fff",
								fontSize: 14,
							},

							"& input::placeholder": {
								color: "rgba(255,255,255,.42)",
								opacity: 1,
							},
						}}
					/>

					<TextField
						select
						size="small"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						slotProps={{
							select: {
								MenuProps: {
									PaperProps: {
										sx: {
											mt: 1,

											borderRadius: "18px",

											background:
												"linear-gradient(180deg,#0f172a,#111827)",

											color: "#fff",

											border:
												"1px solid rgba(255,255,255,.06)",

											backdropFilter: "blur(20px)",

											"& .MuiMenuItem-root": {
												fontSize: 14,
												fontWeight: 500,
												color: "#fff",
											},

											"& .MuiMenuItem-root:hover": {
												background:
													"rgba(59,130,246,.08)",
											},

											"& .Mui-selected": {
												background:
													"rgba(59,130,246,.16) !important",

												color: "#60a5fa",

												fontWeight: 700,
											},
										},
									},
								},
							}
						}}
						sx={{
							minWidth: 180,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,

								borderRadius: "14px",

								background:
									"rgba(255,255,255,.04)",

								color: "#fff",

								"& fieldset": {
									borderColor:
										"rgba(255,255,255,.08)",
								},

								"&:hover fieldset": {
									borderColor:
										"rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "#fff",
								fontWeight: 500,
							},

							"& .MuiSvgIcon-root": {
								color: "#94a3b8",
							},
						}}
					>
						<MenuItem value="ALL">All Status</MenuItem>
						<MenuItem value="READY">🟡 Packed</MenuItem>
						<MenuItem value="READY_TO_STORE">📦 Ready To Store</MenuItem>
						<MenuItem value="WAREHOUSE_REQUESTED">🏭 Warehouse Requested</MenuItem>
						<MenuItem value="IN_WAREHOUSE">🏢 In Warehouse</MenuItem>
						<MenuItem value="READY_TO_DISPATCH">🚚 Ready To Dispatch</MenuItem>
						<MenuItem value="QUEUED">⏳ Queued</MenuItem>
						<MenuItem value="DISPATCHED">✅ Dispatched</MenuItem>
						<MenuItem value="OUT_FOR_DELIVERY">🚚 Out For Delivery</MenuItem>
						<MenuItem value="DELIVERED">✅ Delivered</MenuItem>
						<MenuItem value="WAREHOUSE_RETURN_REQUESTED">↩️ Warehouse Return Requested</MenuItem>
					</TextField>

					<TextField
						select
						size="small"
						value={groupBy}
						onChange={(e) => setGroupBy(e.target.value)}
						sx={{
							minWidth: 180,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,

								borderRadius: "14px",

								background:
									"rgba(255,255,255,.04)",

								color: "#fff",

								"& fieldset": {
									borderColor:
										"rgba(255,255,255,.08)",
								},

								"&:hover fieldset": {
									borderColor:
										"rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "#fff",
								fontWeight: 500,
							},

							"& .MuiSvgIcon-root": {
								color: "#94a3b8",
							},
						}}
					>
						<MenuItem value="NONE">No Group</MenuItem>
						<MenuItem value="STATUS">Group by Status</MenuItem>
						<MenuItem value="CLIENT">Group by Client</MenuItem>
					</TextField>
				</Box>

				<div style={wrap}>


					<Box sx={tableWrapper}>
						<div
							style={{
								width: "max-content",
								minWidth: "100%",
							}}
						>

							<div style={tableHeader}>
								<div>{columns[0].renderHeader()}</div>
								<div>Item Name</div>
								<div>SKU</div>
								<div>PD No</div>
								<div>DWG No</div>
								<div>Description</div>
								<div>Stock</div>
								<div>Client</div>
								<div>Plant</div>
								<div>Location</div>
								<div>Status</div>
								<div>Actions</div>
							</div>

							<div style={tableBody}>

								{paginatedRows.map((row) => (

									<div
										key={row.zohoItemId}
										style={tableRow}
									>

										<div>
											{columns[0].renderCell({ row })}
										</div>

										<div style={tableCellWrap}>
											{columns[1].renderCell({ row })}
										</div>

										<div style={tableCellWrap}>
											{columns[2].renderCell({ value: row.sku, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[3].renderCell({ value: row.pdNo, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[4].renderCell({ value: row.drawingNo, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[5].renderCell({ value: row.description, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[6].renderCell({ value: row.stock, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[7].renderCell({ value: row.clientName, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[8].renderCell({ value: row.plantCode, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[9].renderCell({ value: row.currentLocationCode, row })}
										</div>

										<div style={tableCellWrap}>
											{columns[10].renderCell({ row })}
										</div>

										<div style={tableCellWrap}>
											{columns[11].renderCell({ row })}
										</div>
									</div>

								))}

							</div>
						</div>
					</Box>
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							mt: 4,
							gap: 2,
							flexWrap: "wrap",
						}}
					>

						{/* LEFT SIDE */}
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							<Box
								sx={{
									color: "#94a3b8",
									fontWeight: 600,
									fontSize: 14,
								}}
							>
								Show
							</Box>

							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 1.5,
								}}
							>
								<TextField
									select
									size="small"
									value={pageSize}
									onChange={(e) =>
										setPageSize(Number(e.target.value))
									}
									sx={{
										width: 110,

										"& .MuiOutlinedInput-root": {
											height: 36,
											borderRadius: "12px",

											background:
												"rgba(255,255,255,.04)",

											color: "#fff",

											"& fieldset": {
												borderColor:
													"rgba(255,255,255,.08)",
											},

											"&:hover fieldset": {
												borderColor:
													"rgba(59,130,246,.35)",
											},
										},

										"& .MuiSvgIcon-root": {
											color: "#94a3b8",
										},
									}}
								>
									<MenuItem value={25}>
										25
									</MenuItem>

									<MenuItem value={50}>
										50
									</MenuItem>
								</TextField>
							</Box>

							<Box
								sx={{
									color: "#94a3b8",
									fontSize: 14,
								}}
							>
								items per page
							</Box>
						</Box>

						{/* CENTER PAGINATION */}
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 3,
							}}
						>
							<Button
								disabled={pageNo === 1}
								onClick={() => setPageNo(p => p - 1)}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background:
										"linear-gradient(180deg,#1e293b,#0f172a)",
									color: "#fff",
									border:
										"1px solid rgba(255,255,255,.08)",

									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "#94a3b8",
									},
								}}
							>
								◀ Previous
							</Button>

							<Box
								sx={{
									px: 2.5,
									height: 30,

									display: "flex",
									alignItems: "center",

									borderRadius: "12px",

									background:
										"linear-gradient(180deg,#0f172a,#111827)",

									color: "#cbd5e1",

									border:
										"1px solid rgba(255,255,255,.06)",

									fontSize: 10,
									fontWeight: 500,
								}}
							>
								Page

								<Box
									component="span"
									sx={{
										mx: 1,
										color: "#60a5fa",
									}}
								>
									{pageNo}
								</Box>

								of {totalPages}
							</Box>

							<Button
								disabled={pageNo === totalPages}
								onClick={() => setPageNo(p => p + 1)}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",

									background:
										"linear-gradient(180deg,#2563eb,#1d4ed8)",

									color: "#fff",

									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "#cbd5e1",
									},
								}}
							>
								Next ▶
							</Button>
						</Box>
					</Box>
				</div>
				{Array.isArray(selectionModel) &&
					selectionModel.length > 0 &&
					isDispatch && (

						<div style={bulkBar}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 1.2,
									color: "#cbd5e1",
									fontWeight: 800,
									fontSize: 13,
								}}
							>
								<span>☑️</span>

								<span>
									{selectionModel.length} item
									{selectionModel.length > 1 ? "s" : ""} selected
								</span>

								<Chip
									size="small"
									label={getBulkActionLabel(selectedBulkAction)}
									sx={{
										height: 26,
										fontWeight: 900,
										fontSize: 11,

										color:
											selectedBulkAction === "MOVE_TO_FG"
												? "#fbbf24"
												: selectedBulkAction === "CHANGE_STATUS"
													? "#93c5fd"
													: selectedBulkAction === "GATE_PASS"
														? "#6ee7b7"
														: selectedBulkAction === "CHALAAN"
															? "#93c5fd"
															: "#fca5a5",

										background:
											selectedBulkAction === "MOVE_TO_FG"
												? "rgba(245,158,11,.15)"
												: selectedBulkAction === "CHANGE_STATUS"
													? "rgba(59,130,246,.15)"
													: selectedBulkAction === "GATE_PASS"
														? "rgba(16,185,129,.15)"
														: selectedBulkAction === "CHALAAN"
															? "rgba(59,130,246,.15)"
															: "rgba(239,68,68,.15)",

										border:
											selectedBulkAction === "MIXED"
												? "1px solid rgba(239,68,68,.25)"
												: "1px solid rgba(255,255,255,.08)",
									}}
								/>
							</Box>

							{canBulkMoveToFg && (
								<Button
									size="small"
									onClick={() => {
										/*
										  Use your existing bulk Move to FG modal opener here.
										  If you followed my previous fix, this should be:
										  setBulkMoveToFgOpen(true)
										*/
										setBulkMoveFgOpen(true);
									}}
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",

										background:
											"linear-gradient(180deg,#f59e0b,#d97706)",

										color: "#fff",

										border:
											"1px solid rgba(245,158,11,.35)",

										boxShadow:
											"0 10px 24px rgba(245,158,11,.28)",

										"&:hover": {
											background:
												"linear-gradient(180deg,#fbbf24,#f59e0b)",
										},
									}}
								>
									Move to FG
								</Button>
							)}

							{canBulkChangeStatus && (
								<Button
									size="small"
									onClick={() => setBulkStatusModal(true)}
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",

										background:
											"linear-gradient(180deg,#3b82f6,#2563eb)",

										color: "#fff",

										border:
											"1px solid rgba(59,130,246,.35)",

										boxShadow:
											"0 10px 24px rgba(37,99,235,.28)",

										"&:hover": {
											background:
												"linear-gradient(180deg,#60a5fa,#2563eb)",
										},
									}}
								>
									Change Status
								</Button>
							)}

							{canBulkGenerateChalaan && (
								<Button
									size="small"
									onClick={() => {
										openDispatchTripModal({
											mode: "UI_BULK",
											itemIds: selectionModel,
											title: "Bulk Chalaan",
										});
									}}
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",

										background:
											"linear-gradient(180deg,#3b82f6,#2563eb)",

										color: "#fff",

										border:
											"1px solid rgba(59,130,246,.35)",

										boxShadow:
											"0 10px 24px rgba(37,99,235,.28)",

										"&:hover": {
											background:
												"linear-gradient(180deg,#60a5fa,#2563eb)",
										},
									}}
								>
									Generate Bulk Chalaan
								</Button>
							)}

							{canBulkGenerateGatePass && (
								<Button
									size="small"
									onClick={() => setBulkGatePassOpen(true)}
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",

										background:
											"linear-gradient(180deg,#10b981,#059669)",

										color: "#fff",

										border:
											"1px solid rgba(16,185,129,.35)",

										boxShadow:
											"0 10px 24px rgba(16,185,129,.28)",

										"&:hover": {
											background:
												"linear-gradient(180deg,#34d399,#059669)",
										},
									}}
								>
									Generate Bulk Gate Pass
								</Button>
							)}

							{selectedBulkAction === "MIXED" && (
								<Button
									size="small"
									disabled
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",
										background: "#64748b",
										color: "#fff",
									}}
								>
									Select same action items
								</Button>
							)}

							<Button
								size="small"
								onClick={() => setSelectionModel([])}
								sx={{
									px: 2,
									height: 38,
									borderRadius: "12px",
									fontWeight: 800,
									textTransform: "none",

									background:
										"rgba(255,255,255,.08)",

									color: "#fff",

									"&:hover": {
										background:
											"rgba(255,255,255,.14)",
									},
								}}
							>
								Clear
							</Button>
						</div>
					)}
				{qrDispatchOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5200 }}
						onClick={() => setQrDispatchOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 720,
								maxHeight: "88vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#3b82f6")}>
										📷
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											QR Auto Dispatch
										</Box>

										<Box sx={modalSubtitleSx}>
											Scan sticker QR to generate challan automatically
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setQrDispatchOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										display: "flex",
										gap: 1,
										mb: 2,
										p: 1,
										borderRadius: "10px",
										background: "rgba(255,255,255,.035)",
										border: "1px solid rgba(255,255,255,.07)",
									}}
								>
									<Button
										onClick={() => {
											setScanMode("SINGLE");
											setScanCart([]);
											setScannerText("");
											setScanMessage("");
											setPendingQrFgItem(null);
											setPendingQrFgZone("");
										}}
										sx={{
											...scannerModeButtonSx,
											...(scanMode === "SINGLE" ? scannerModeActiveSx : {}),
										}}
									>
										Single Item
									</Button>

									<Button
										onClick={() => {
											setScanMode("BULK");
											setScannerText("");
											setScanMessage("");
											setPendingQrFgItem(null);
											setPendingQrFgZone("");
										}}
										sx={{
											...scannerModeButtonSx,
											...(scanMode === "BULK" ? scannerModeActiveSx : {}),
										}}
									>
										Bulk Items
									</Button>
								</Box>

								<Box
									sx={{
										p: 2,
										borderRadius: "12px",
										background:
											"linear-gradient(135deg,rgba(59,130,246,.10),rgba(255,255,255,.035))",
										border: "1px solid rgba(59,130,246,.18)",
										mb: 2,
									}}
								>
									<Box
										sx={{
											color: "#fff",
											fontWeight: 900,
											mb: 0.8,
										}}
									>
										{scanMode === "SINGLE"
											? "Scan one sticker to auto-generate challan"
											: "Scan multiple stickers, then generate one bulk challan"}
									</Box>

									<Box
										sx={{
											color: "rgba(255,255,255,.58)",
											fontSize: 12,
											fontWeight: 600,
										}}
									>
										Keep the cursor inside the scan box. USB QR scanners work like keyboard input.
									</Box>
								</Box>

								<TextField
									inputRef={scannerInputRef}
									fullWidth
									multiline
									minRows={2}
									maxRows={4}
									placeholder="Scan QR here..."
									value={scannerText}
									onChange={handleScannerChange}
									onKeyDown={handleScannerKeyDown}
									disabled={scanLoading}
									sx={scannerInputSx}
								/>
								{scanMode === "SINGLE" && pendingQrFgItem && (
									<Box
										sx={{
											mt: 2,
											p: 2,
											borderRadius: "14px",
											background: "rgba(245,158,11,.12)",
											border: "1px solid rgba(245,158,11,.25)",
										}}
									>
										<Box
											sx={{
												color: "#fff",
												fontWeight: 900,
												mb: 0.5,
											}}
										>
											Move to FG Required
										</Box>

										<Box
											sx={{
												color: "#fcd34d",
												fontSize: 12,
												fontWeight: 700,
												mb: 1.5,
											}}
										>
											{pendingQrFgItem.itemName || "—"} is currently at{" "}
											{pendingQrFgItem.currentLocationCode || "PKD"}.
											Move it to FG before QR dispatch.
										</Box>

										{getScanFgZones(pendingQrFgItem).length > 0 && (
											<Box
												component="select"
												value={pendingQrFgZone}
												onChange={(e) => setPendingQrFgZone(e.target.value)}
												sx={nativeFgSelectSx}
											>
												<option value="">
													Select FG Zone
												</option>

												{getScanFgZones(pendingQrFgItem).map((zone) => (
													<option key={zone} value={zone}>
														{pendingQrFgItem.fgAreaCode || "FG"} - Zone {zone}
													</option>
												))}
											</Box>
										)}

										{getScanFgZones(pendingQrFgItem).length === 0 && (
											<Box
												sx={{
													color: "#6ee7b7",
													fontSize: 12,
													fontWeight: 800,
													mb: 1.5,
												}}
											>
												No FG zone required for this plant.
											</Box>
										)}

										<Box
											sx={{
												display: "flex",
												justifyContent: "flex-end",
												gap: 1,
												mt: 1.5,
											}}
										>
											<Button
												disabled={qrMoveFgLoading}
												onClick={() => {
													setPendingQrFgItem(null);
													setPendingQrFgZone("");
													setScanMessage("");
												}}
												sx={modalSecondaryButtonSx}
											>
												Cancel
											</Button>

											<Button
												disabled={qrMoveFgLoading}
												onClick={confirmSingleQrMoveToFgAndDispatch}
												sx={moveToFgButtonSx}
											>
												{qrMoveFgLoading
													? "Moving..."
													: "Move to FG & Generate Challan"}
											</Button>
										</Box>
									</Box>
								)}
								<Box
									sx={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										mt: 1.5,
										gap: 2,
									}}
								>
									<Box
										sx={{
											color: scanLoading ? "#fcd34d" : "#94a3b8",
											fontSize: 12,
											fontWeight: 700,
										}}
									>
										{scanLoading
											? "Processing scan..."
											: scanMessage || "Ready to scan"}
									</Box>

									<Button
										disabled={!scannerText || scanLoading}
										onClick={() => processScannedText(scannerText)}
										sx={modalSecondaryButtonSx}
									>
										Process
									</Button>
								</Box>

								{scanMode === "BULK" && (
									<Box sx={{ mt: 2 }}>
										<Box
											sx={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												mb: 1,
											}}
										>
											<Box
												sx={{
													color: "#fff",
													fontWeight: 900,
												}}
											>
												Scanned Items: {scanCart.length}
											</Box>

											<Button
												disabled={
													scanCart.length === 0 ||
													scanLoading ||
													scanCart.some((item) => {
														return (
															item.moveToFgRequired &&
															isScanFgZoneRequired(item) &&
															!item.fgZoneCode
														);
													})
												}
												onClick={generateBulkChalaanFromScans}
												sx={scannerGenerateButtonSx}
											>
												Generate Bulk Challan
											</Button>
										</Box>

										{scanCart.length === 0 && (
											<Box sx={modalEmptyStateSx}>
												No items scanned yet.
											</Box>
										)}

										{scanCart.length > 0 && (
											<Box sx={{ ...modalScrollBodySx, maxHeight: "32vh" }}>
												{scanCart.map((item, index) => (
													<Box
														key={item.zohoItemId}
														sx={scannerCartCardSx}
													>
														<Box sx={{ minWidth: 0 }}>
															<Box
																sx={{
																	color: "#fff",
																	fontWeight: 900,
																	fontSize: 13,
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																}}
															>
																{index + 1}. {item.itemName}
															</Box>

															<Box
																sx={{
																	color: "rgba(255,255,255,.55)",
																	fontSize: 12,
																	fontWeight: 600,
																	mt: 0.4,
																}}
															>
																{item.pdNo || "—"} • {item.clientName || "—"} • {item.status}
															</Box>
															{item.moveToFgRequired && (
																<Box
																	sx={{
																		mt: 1,
																		p: 1,
																		borderRadius: "10px",
																		background: "rgba(245,158,11,.10)",
																		border: "1px solid rgba(245,158,11,.18)",
																	}}
																>
																	<Box
																		sx={{
																			color: "#fcd34d",
																			fontSize: 11,
																			fontWeight: 900,
																			mb: 0.8,
																		}}
																	>
																		Move to FG required
																	</Box>

																	{getScanFgZones(item).length > 0 ? (
																		<Box
																			component="select"
																			value={item.fgZoneCode || ""}
																			onChange={(e) =>
																				updateScanCartFgZone(
																					item.zohoItemId,
																					e.target.value
																				)
																			}
																			sx={nativeFgSelectSx}
																		>
																			<option value="">
																				Select FG Zone
																			</option>

																			{getScanFgZones(item).map((zone) => (
																				<option key={zone} value={zone}>
																					{item.fgAreaCode || "FG"} - Zone {zone}
																				</option>
																			))}
																		</Box>
																	) : (
																		<Box
																			sx={{
																				color: "#6ee7b7",
																				fontSize: 11,
																				fontWeight: 800,
																			}}
																		>
																			No zone required. It will move to {item.fgAreaCode || "FG"}.
																		</Box>
																	)}
																</Box>
															)}
														</Box>

														<Button
															size="small"
															onClick={() =>
																setScanCart((prev) =>
																	prev.filter((x) => x.zohoItemId !== item.zohoItemId)
																)
															}
															sx={{
																minWidth: 70,
																height: 30,
																borderRadius: "8px",
																color: "#fca5a5",
																fontWeight: 800,
																textTransform: "none",
																background: "rgba(239,68,68,.10)",
																border: "1px solid rgba(239,68,68,.18)",
															}}
														>
															Remove
														</Button>
													</Box>
												))}
											</Box>
										)}
									</Box>
								)}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => {
										setQrDispatchOpen(false);
										setScannerText("");
										setScanMessage("");
									}}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{historyOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 2000 }}
						onClick={() => setHistoryOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 580,
								maxHeight: "84vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#3b82f6")}>
										🏷️
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Sticker History
										</Box>

										<Box sx={modalSubtitleSx}>
											View and download previously generated stickers
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setHistoryOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								{historyLoading && (
									<Box sx={modalEmptyStateSx}>
										Loading sticker history…
									</Box>
								)}

								{!historyLoading && historyRows.length === 0 && (
									<Box sx={modalEmptyStateSx}>
										No sticker history found.
									</Box>
								)}

								{!historyLoading && historyRows.length > 0 && (
									<Box sx={modalScrollBodySx}>
										{historyRows.map((h, idx) => (
											<Box
												key={h.id}
												sx={idx === 0 ? latestHistoryCardSx : historyCardSx}
											>
												<Box sx={{ minWidth: 0 }}>
													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															gap: 1,
															mb: 0.4,
														}}
													>
														<Box sx={historyNumberSx}>
															{h.stickerNumber}
														</Box>

														{idx === 0 && (
															<Chip
																label="Latest"
																size="small"
																sx={{
																	height: 22,
																	fontSize: 10,
																	fontWeight: 900,
																	color: "#6ee7b7",
																	background: "rgba(16,185,129,.14)",
																	border: "1px solid rgba(16,185,129,.22)",
																}}
															/>
														)}
													</Box>

													<Box sx={historyMetaSx}>
														{new Date(h.generatedAt).toLocaleString()}
														{" • "}
														{h.reason || "Generated"}
													</Box>
												</Box>

												<Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
													<IconButton
														size="small"
														sx={modalMiniButtonSx}
														onClick={async () => {
															try {
																const res = await fetch(
																	`${API_BASE_URL}/api/stickers/history/${h.id}/download-pdf`,
																	{
																		method: "GET",
																		headers: getAuthHeaders(),
																	}
																);

																if (!res.ok) {
																	const text = await res.text();
																	console.error("❌ Sticker preview failed:", text);
																	alert(text || "Preview failed");
																	return;
																}

																const blob = await res.blob();

																if (blob.size === 0) {
																	alert("Empty PDF received");
																	return;
																}

																const blobUrl = URL.createObjectURL(blob);
																const newTab = window.open();

																if (!newTab) {
																	alert("Popup blocked");
																	return;
																}

																newTab.location.href = blobUrl;

																setTimeout(() => {
																	URL.revokeObjectURL(blobUrl);
																}, 10000);
															} catch (err) {
																console.error(err);
																alert("Preview failed");
															}
														}}
													>
														👁
													</IconButton>

													<IconButton
														size="small"
														sx={modalMiniButtonSx}
														onClick={async () => {
															try {
																const res = await fetch(
																	`${API_BASE_URL}/api/stickers/history/${h.id}/download-pdf`,
																	{
																		method: "GET",
																		headers: getAuthHeaders(),
																	}
																);

																if (!res.ok) throw new Error();

																const blob = await res.blob();
																const url = window.URL.createObjectURL(blob);

																const a = document.createElement("a");
																a.href = url;
																a.download = `STICKER_${h.stickerNumber}.pdf`;
																a.click();

																setTimeout(() => {
																	window.URL.revokeObjectURL(url);
																}, 10000);
															} catch (err) {
																console.error(err);
																alert("Download failed");
															}
														}}
													>
														⬇
													</IconButton>
												</Box>
											</Box>
										))}
									</Box>
								)}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => setHistoryOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{auditOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 2100 }}
						onClick={() => setAuditOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 680,
								maxHeight: "86vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#f97316")}>
										📄
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Activity Log
										</Box>

										<Box sx={modalSubtitleSx}>
											Track approvals, requests, dispatch and sticker actions
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setAuditOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box sx={auditFilterBarSx}>
									<TextField
										select
										size="small"
										value={actionFilter}
										onChange={(e) => setActionFilter(e.target.value)}
										sx={modalFilterFieldSx}
									>
										<MenuItem value="ALL">All Actions</MenuItem>
										<MenuItem value="REQUEST">Requests</MenuItem>
										<MenuItem value="APPROVE">Approvals</MenuItem>
										<MenuItem value="REJECT">Rejections</MenuItem>
										<MenuItem value="DISPATCH">Dispatch</MenuItem>
										<MenuItem value="PACK">Pack</MenuItem>
										<MenuItem value="STICKER">Sticker</MenuItem>
									</TextField>

									<TextField
										select
										size="small"
										value={roleFilter}
										onChange={(e) => setRoleFilter(e.target.value)}
										sx={modalFilterFieldSx}
									>
										<MenuItem value="ALL">All Roles</MenuItem>
										<MenuItem value="ADMIN">Admin</MenuItem>
										<MenuItem value="DISPATCH">Dispatch</MenuItem>
										<MenuItem value="USER">Packing</MenuItem>
									</TextField>
								</Box>

								{auditLoading && (
									<Box sx={modalEmptyStateSx}>
										Loading activity logs…
									</Box>
								)}

								{!auditLoading && auditRows.length === 0 && (
									<Box sx={modalEmptyStateSx}>
										No activity recorded.
									</Box>
								)}

								{!auditLoading && auditRows.length > 0 && (
									<Box sx={modalScrollBodySx}>
										{Object.entries(
											(auditRows || [])
												.filter((log) => {
													if (actionFilter !== "ALL") {
														if (!log.action?.toUpperCase().includes(actionFilter)) return false;
													}

													if (roleFilter !== "ALL" && log.role !== roleFilter) return false;

													return true;
												})
												.reduce((groups, log) => {
													const label = getDateGroupLabel(log.performedAt);

													if (!groups[label]) groups[label] = [];

													groups[label].push(log);

													return groups;
												}, {})
										).map(([group, logs]) => (
											<Box key={group}>
												<Box sx={auditGroupTitleSx}>
													{group}
												</Box>

												{logs.map((log) => {
													const tone = getAuditActionTone(log.action);
													const roleStyle = getRoleChipStyle(log.role);

													return (
														<Box
															key={log.id}
															sx={auditLogCardSx}
														>
															<Box sx={{ minWidth: 0 }}>
																<Chip
																	label={log.action || "Activity"}
																	size="small"
																	sx={{
																		...auditActionChipBaseSx,
																		color: tone.color,
																		background: tone.bg,
																		border: tone.border,
																	}}
																/>

																<Box sx={auditTimeSx}>
																	{new Date(log.performedAt).toLocaleString()}
																</Box>
															</Box>

															<Box
																sx={{
																	display: "flex",
																	gap: 1,
																	alignItems: "center",
																	flexShrink: 0,
																}}
															>
																<Chip
																	label={log.performedBy || "System"}
																	size="small"
																	sx={{
																		color: "#e5e7eb",
																		fontWeight: 800,
																		background: "rgba(255,255,255,.05)",
																		border: "1px solid rgba(255,255,255,.08)",
																	}}
																/>

																<Chip
																	label={log.role || "—"}
																	size="small"
																	sx={{
																		background: roleStyle.bg,
																		color: roleStyle.color,
																		fontWeight: 800,
																		border: "1px solid rgba(255,255,255,.08)",
																	}}
																/>
															</Box>
														</Box>
													);
												})}
											</Box>
										))}
									</Box>
								)}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => setAuditOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{bulkDrawerOpen && (
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: `
			  radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 20%),
			  rgba(15,23,42,0.55)
			`,
							backdropFilter: "blur(8px)",
							WebkitBackdropFilter: "blur(8px)",
							zIndex: 4000,
							display: "flex",
							justifyContent: "flex-end",
						}}
						onClick={() => setBulkDrawerOpen(false)}
					>
						<div
							style={{
								width: 420,
								height: "100%",

								padding: 24,

								background:
									"linear-gradient(180deg,#0f172a,#111827)",

								color: "#fff",

								borderLeft:
									"1px solid rgba(255,255,255,.06)",

								boxShadow:
									"-10px 0 40px rgba(0,0,0,.55)",

								display: "flex",
								flexDirection: "column",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<h3 style={{ marginBottom: 12 }}>
								Bulk Chalaan
							</h3>

							<div style={{ flex: 1, overflow: "auto" }}>
								{(rows || []).filter((r) => selectionModel?.includes(r.zohoItemId))
									.map((item) => (
										<Box
											key={item.zohoItemId}
											sx={{
												p: 1.5,
												mb: 1,
												borderRadius: 10,
												background:
													"rgba(255,255,255,.03)",

												border:
													"1px solid rgba(255,255,255,.06)",
											}}
										>
											<div style={{ fontWeight: 600 }}>{item.name}</div>
											<div style={{ fontSize: 12, opacity: 0.7 }}>
												{item.clientName}
											</div>
										</Box>
									))}
							</div>

							<Box sx={{ mt: 2, display: "flex", gap: 1 }}>
								<Button
									fullWidth
									disabled={bulkLoading}
									onClick={async () => {
										try {
											setBulkLoading(true);

											const res = await fetch(
												`${API_BASE_URL}/api/chalaan/bulk`,
												{
													method: "POST",
													headers: {
														"Content-Type": "application/json",
														Authorization: `Bearer ${localStorage.getItem("token")}`,
													},
													body: JSON.stringify(
														rows
															.filter(r => selectionModel.includes(r.zohoItemId))
															.map(r => r.zohoItemId)
													),
												}
											);

											if (!res.ok) throw new Error();

											const blob = await res.blob();
											const url = window.URL.createObjectURL(blob);

											const a = document.createElement("a");
											a.href = url;
											a.download = `CHALAAN_BULK.pdf`;
											document.body.appendChild(a);
											a.click();
											a.remove();

											window.URL.revokeObjectURL(url);

											await fetchData();

											setSelectionModel([]);
											setBulkDrawerOpen(false);

										} catch (err) {
											console.error(err);
											alert("Bulk chalaan failed");
										} finally {
											setBulkLoading(false);
										}
									}}
									sx={{
										borderRadius: 999,
										background: "linear-gradient(180deg,#2563eb,#1d4ed8)",
										color: "#fff",
									}}
								>
									{bulkLoading ? "Generating..." : "Confirm & Generate"}
								</Button>

								<Button
									fullWidth
									onClick={() => setBulkDrawerOpen(false)}
								>
									Cancel
								</Button>
							</Box>
						</div>
					</div>
				)}
				{bulkGatePassOpen && (
					<div style={popupOverlay} onClick={() => setBulkGatePassOpen(false)}>
						<div style={popupBox} onClick={(e) => e.stopPropagation()}>
							<h2>Bulk Gate Pass</h2>

							{/* Warehouse Code */}
							<TextField
								fullWidth
								placeholder="Warehouse Code (WH-01)"
								value={warehouseCode}
								onChange={(e) => setWarehouseCode(e.target.value)}
								sx={{
									...formFieldSx,
									mb: 2,
								}}
							/>

							{/* From Location */}
							<TextField
								fullWidth
								placeholder="From Location"
								value={fromLocation}
								onChange={(e) => setFromLocation(e.target.value)}
								sx={{
									...formFieldSx,
									mb: 2,
								}}
							/>

							{/* PDF PREVIEW */}
							{bulkGatePassPreview && (
								<iframe
									src={bulkGatePassPreview}
									style={{
										width: "100%",
										height: 400,
										border: "none",
										borderRadius: 8,
										marginBottom: 12
									}}
								/>
							)}

							<Box sx={{ display: "flex", gap: 2 }}>

								{/* GENERATE BUTTON */}
								<Button
									variant="contained"
									disabled={!warehouseCode}
									onClick={async () => {
										try {

											// 🔥 STEP 1: CALL BULK STORE API
											const res = await fetch(
												`${API_BASE_URL}/api/dispatched/bulk/store?warehouseCode=${encodeURIComponent(warehouseCode)}&fromLocation=${encodeURIComponent(fromLocation)}`,
												{
													method: "POST",
													headers: {
														"Content-Type": "application/json",
														Authorization: `Bearer ${localStorage.getItem("token")}`,
													},
													body: JSON.stringify(selectionModel),
												}
											);

											if (!res.ok) {
												const text = await res.text();
												alert(text || "Bulk gate pass failed");
												return;
											}

											const data = await res.json();
											const gatePass = data.gatePass;

											// 🔥 STEP 2: FETCH BULK PDF
											const pdfRes = await fetch(
												`${API_BASE_URL}/api/gatepass/bulk/${gatePass}/pdf`,
												{
													headers: {
														Authorization: `Bearer ${localStorage.getItem("token")}`,
													},
												}
											);

											const blob = await pdfRes.blob();
											const url = URL.createObjectURL(blob);

											setBulkGatePassPreview(url);

											// 🔥 STEP 3: REFRESH DATA
											await fetchData();

										} catch (err) {
											console.error(err);
											alert("Bulk Gate Pass failed");
										}
									}}
								>
									Generate
								</Button>

								{/* CLOSE */}
								<Button
									onClick={() => {
										if (bulkGatePassPreview) URL.revokeObjectURL(bulkGatePassPreview);
										setBulkGatePassOpen(false);
									}}
								>
									Close
								</Button>

							</Box>
						</div>
					</div>
				)}
				{gatePassModal && (
					<div
						style={popupOverlay}
						onClick={() => {
							if (gatePassPreview) URL.revokeObjectURL(gatePassPreview);
							setGatePassModal(null);
						}}
					>
						<div
							style={popupBox}

							onClick={(e) => e.stopPropagation()}
						>
							<h2 style={{ marginBottom: 10 }}>Generate Gate Pass</h2>

							{/* INPUT */}
							<TextField
								fullWidth
								placeholder="Enter Warehouse Code (WH-01)"
								value={warehouseCode}
								onChange={(e) => setWarehouseCode(e.target.value)}
								sx={formFieldSx}
							/>

							{/* PREVIEW */}
							{gatePassPreview && (
								<iframe
									src={gatePassPreview}
									style={{
										width: "100%",
										height: "420px",
										border: "none",
										borderRadius: 8,
										marginBottom: 12,
									}}
								/>
							)}

							{/* ACTIONS */}
							<Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
								<TextField
									fullWidth
									placeholder="From Location (Floor / Packing)"
									value={fromLocation}
									onChange={(e) => setFromLocation(e.target.value)}
									sx={formFieldSx}
								/>
								<Button

									variant="contained"
									disabled={!warehouseCode}
									onClick={async () => {
										try {
											// 🔥 STEP 1: GENERATE
											const res = await fetch(
												`${API_BASE_URL}/api/dispatched/${gatePassModal.zohoItemId}/store?warehouseCode=${encodeURIComponent(warehouseCode)}&fromLocation=${encodeURIComponent(fromLocation)}`,
												{
													method: "POST",
													headers: {
														Authorization: `Bearer ${localStorage.getItem("token")}`,
														"X-Username": localStorage.getItem("username"),
													},
												}
											);

											if (!res.ok) {
												const text = await res.text();
												alert(text || "Gate pass failed");
												return;
											}

											const data = await res.json();

											// 🔥 STEP 2: FETCH PDF
											const resPdf = await fetch(
												`${API_BASE_URL}/api/gatepass/${gatePassModal.zohoItemId}/pdf`,
												{
													headers: {
														Authorization: `Bearer ${localStorage.getItem("token")}`,
													},
												}
											);

											const blob = await resPdf.blob();

											console.log("📄 PDF SIZE:", blob.size); // 🔥 ADD THIS


											const url = URL.createObjectURL(blob);

											setGatePassPreview(url);
											console.log("📄 Preview URL:", url);

											// 🔥 STEP 3: REFRESH DATA
											await fetchData();

										} catch (err) {
											console.error(err);
											alert("Failed to generate gate pass");
										}
									}}
								>
									Generate
								</Button>

								<Button
									onClick={() => {
										if (gatePassPreview) URL.revokeObjectURL(gatePassPreview);
										setGatePassModal(null);
									}}
								>
									Close
								</Button>
							</Box>
						</div>
					</div>
				)}
				{moveFgModal && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5300 }}
						onClick={() => {
							if (!moveFgLoading) {
								setMoveFgModal(null);
								setSelectedFgZone("");
							}
						}}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 560,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#f59e0b")}>
										📍
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Move To Finished Goods
										</Box>

										<Box sx={modalSubtitleSx}>
											Move packed item from PKD area to FG area
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => {
										setMoveFgModal(null);
										setSelectedFgZone("");
									}}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										p: 1.6,
										mb: 2,
										borderRadius: "12px",
										background: "rgba(255,255,255,.035)",
										border: "1px solid rgba(255,255,255,.07)",
									}}
								>
									<Box
										sx={{
											color: "#fff",
											fontWeight: 900,
											mb: 0.5,
										}}
									>
										{moveFgModal.name || moveFgModal.itemName || "—"}
									</Box>

									<Box
										sx={{
											color: "#94a3b8",
											fontSize: 12,
											fontWeight: 700,
										}}
									>
										Plant: {moveFgModal.plantCode || "—"} | Current Location:{" "}
										{moveFgModal.currentLocationCode || moveFgModal.location || "—"}
									</Box>
								</Box>

								{renderNativeFgZoneSelect({
									row: moveFgModal,
									value: selectedFgZone,
									onChange: setSelectedFgZone,
								})}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={moveFgLoading}
									onClick={() => {
										setMoveFgModal(null);
										setSelectedFgZone("");
									}}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={moveFgLoading}
									sx={premiumButton}
									onClick={async () => {
										try {
											const zones = getFgZonesForRow(moveFgModal);
											const finalZone = selectedFgZone?.trim();

											if (zones.length > 0 && !finalZone) {
												alert("Please select FG zone");
												return;
											}

											setMoveFgLoading(true);

											const query = finalZone
												? `?fgZoneCode=${encodeURIComponent(finalZone)}`
												: "";

											const res = await fetch(
												`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
													moveFgModal.zohoItemId
												)}/move-to-fg${query}`,
												{
													method: "POST",
													headers: getAuthHeaders(),
												}
											);

											if (!res.ok) {
												const text = await res.text();
												alert(text || "Move to FG failed");
												return;
											}

											setMoveFgModal(null);
											setSelectedFgZone("");

											await fetchData();
										} catch (err) {
											console.error(err);
											alert("Move to FG failed");
										} finally {
											setMoveFgLoading(false);
										}
									}}
								>
									{moveFgLoading ? "Moving..." : "Confirm Move"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{statusModal && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5000 }}
						onClick={() => setStatusModal(null)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 560,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#3b82f6")}>
										⚡
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Select Action
										</Box>

										<Box sx={modalSubtitleSx}>
											Choose the next movement for this item
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setStatusModal(null)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box sx={{ display: "flex", flexDirection: "column", gap: 1.6 }}>
									<Box
										sx={statusChoiceCardSx("#10b981")}
										onClick={async () => {
											try {
												const row = statusModal;

												await updateStatus(row.zohoItemId, "READY_TO_STORE");

												const fresh = await fetchData();

												const updated = fresh.find(
													r => r.zohoItemId === row.zohoItemId
												);

												if (!updated || updated.status !== "READY_TO_STORE") {
													alert("Item not ready for warehouse");
													return;
												}

												setStatusModal(null);
												setGatePassModal(updated);
											} catch (err) {
												console.error(err);
												alert("Failed to prepare item for warehouse");
											}
										}}
									>
										<Box sx={statusChoiceLeftSx}>
											<Box sx={statusChoiceIconSx("#10b981")}>
												📦
											</Box>

											<Box>
												<Box sx={statusChoiceTitleSx}>
													Move to Warehouse
												</Box>

												<Box sx={statusChoiceSubtitleSx}>
													Mark item as ready to store and generate gate pass
												</Box>
											</Box>
										</Box>

										<Box sx={statusChoiceArrowSx}>
											➜
										</Box>
									</Box>

									<Box
										sx={statusChoiceCardSx("#3b82f6")}
										onClick={async () => {
											setStatusModal(null);
											await updateStatus(statusModal.zohoItemId, "READY_TO_DISPATCH");
										}}
									>
										<Box sx={statusChoiceLeftSx}>
											<Box sx={statusChoiceIconSx("#3b82f6")}>
												🚚
											</Box>

											<Box>
												<Box sx={statusChoiceTitleSx}>
													Dispatch Item
												</Box>

												<Box sx={statusChoiceSubtitleSx}>
													Mark item as ready to dispatch and generate chalaan
												</Box>
											</Box>
										</Box>

										<Box sx={statusChoiceArrowSx}>
											➜
										</Box>
									</Box>
								</Box>
							</Box>
						</Box>
					</Box>
				)}
				{bulkMoveFgOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5300 }}
						onClick={() => {
							if (!bulkMoveFgLoading) {
								setBulkMoveFgOpen(false);
								setBulkSelectedFgZone("");
							}
						}}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 600,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#f59e0b")}>
										📍
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Bulk Move To FG
										</Box>

										<Box sx={modalSubtitleSx}>
											Move selected packed items to Finished Goods area
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => {
										setBulkMoveFgOpen(false);
										setBulkSelectedFgZone("");
									}}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										p: 1.6,
										mb: 2,
										borderRadius: "12px",
										background: "rgba(255,255,255,.035)",
										border: "1px solid rgba(255,255,255,.07)",
									}}
								>
									<Box
										sx={{
											color: "#fff",
											fontWeight: 900,
											mb: 0.5,
										}}
									>
										{readyItemsNotInFg.length} selected item
										{readyItemsNotInFg.length > 1 ? "s" : ""} will be moved to FG
									</Box>

									<Box
										sx={{
											color: "#94a3b8",
											fontSize: 12,
											fontWeight: 700,
										}}
									>
										Plant: {bulkMoveFgPlantCode || "—"}
									</Box>
								</Box>

								{renderNativeFgZoneSelect({
									row: readyItemsNotInFg[0],
									value: bulkSelectedFgZone,
									onChange: setBulkSelectedFgZone,
								})}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={bulkMoveFgLoading}
									onClick={() => {
										setBulkMoveFgOpen(false);
										setBulkSelectedFgZone("");
									}}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={bulkMoveFgLoading}
									sx={premiumButton}
									onClick={async () => {
										try {
											if (!readyItemsNotInFg.length) {
												alert("No packed PKD items selected");
												return;
											}

											const zones = getFgZonesForRow(readyItemsNotInFg[0]);
											const finalZone = bulkSelectedFgZone?.trim();

											if (zones.length > 0 && !finalZone) {
												alert("Please select FG zone");
												return;
											}

											setBulkMoveFgLoading(true);

											const query = finalZone
												? `?fgZoneCode=${encodeURIComponent(finalZone)}`
												: "";

											for (const item of readyItemsNotInFg) {
												const res = await fetch(
													`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
														item.zohoItemId
													)}/move-to-fg${query}`,
													{
														method: "POST",
														headers: getAuthHeaders(),
													}
												);

												if (!res.ok) {
													const text = await res.text();
													throw new Error(
														text || `Move to FG failed for ${item.sku || item.zohoItemId}`
													);
												}
											}

											setBulkMoveFgOpen(false);
											setBulkSelectedFgZone("");
											setSelectionModel([]);

											await fetchData();
										} catch (err) {
											console.error(err);
											alert(err.message || "Bulk move to FG failed");
										} finally {
											setBulkMoveFgLoading(false);
										}
									}}
								>
									{bulkMoveFgLoading ? "Moving..." : "Confirm Bulk Move"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{bulkStatusModal && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5000 }}
						onClick={() => setBulkStatusModal(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 580,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#f59e0b")}>
										☑️
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Bulk Status Change
										</Box>

										<Box sx={modalSubtitleSx}>
											Apply movement action to {selectionModel.length} selected item
											{selectionModel.length > 1 ? "s" : ""}
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setBulkStatusModal(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box sx={{ display: "flex", flexDirection: "column", gap: 1.6 }}>
									<Box
										sx={statusChoiceCardSx("#10b981")}
										onClick={async () => {
											try {
												for (const id of selectionModel) {
													await updateStatus(id, "READY_TO_STORE");
												}

												await fetchData();

												setSelectionModel([]);
												setBulkStatusModal(false);
											} catch (err) {
												console.error(err);
												alert("Bulk store failed");
											}
										}}
									>
										<Box sx={statusChoiceLeftSx}>
											<Box sx={statusChoiceIconSx("#10b981")}>
												📦
											</Box>

											<Box>
												<Box sx={statusChoiceTitleSx}>
													Move to Warehouse
												</Box>

												<Box sx={statusChoiceSubtitleSx}>
													Mark selected items as READY_TO_STORE
												</Box>
											</Box>
										</Box>

										<Box sx={statusChoiceArrowSx}>
											➜
										</Box>
									</Box>

									<Box
										sx={statusChoiceCardSx("#3b82f6")}
										onClick={async () => {
											try {
												for (const id of selectionModel) {
													await updateStatus(id, "READY_TO_DISPATCH");
												}

												await fetchData();

												setSelectionModel([]);
												setBulkStatusModal(false);
											} catch (err) {
												console.error(err);
												alert("Bulk dispatch failed");
											}
										}}
									>
										<Box sx={statusChoiceLeftSx}>
											<Box sx={statusChoiceIconSx("#3b82f6")}>
												🚚
											</Box>

											<Box>
												<Box sx={statusChoiceTitleSx}>
													Dispatch Items
												</Box>

												<Box sx={statusChoiceSubtitleSx}>
													Mark selected items as READY_TO_DISPATCH
												</Box>
											</Box>
										</Box>

										<Box sx={statusChoiceArrowSx}>
											➜
										</Box>
									</Box>
								</Box>
							</Box>
						</Box>
					</Box>
				)}
				{adminStickerEditOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5400 }}
						onClick={() => setAdminStickerEditOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 620,
								maxHeight: "88vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#f59e0b")}>
										✏️
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Edit Sticker Details
										</Box>

										<Box sx={modalSubtitleSx}>
											Admin-only sticker detail correction
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setAdminStickerEditOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box sx={modalScrollBodySx}>
									{[
										"itemName",
										"pdNo",
										"drawingNo",
										"clientName",
										"clientAddress",
										"floor",
										"description",
										"weight",
										"dimensions",
										"remarks",
										"location",
									].map((field) => (
										<TextField
											key={field}
											label={field}
											fullWidth
											value={adminStickerEditForm[field] || ""}
											onChange={(e) =>
												setAdminStickerEditForm((prev) => ({
													...prev,
													[field]: e.target.value,
												}))
											}
											sx={{
												...formFieldSx,
												mb: 2,
											}}
										/>
									))}
								</Box>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => setAdminStickerEditOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									onClick={saveAdminStickerEdit}
									sx={premiumButton}
								>
									Save
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{dispatchTripOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5600 }}
						onClick={() => {
							if (!dispatchTripLoading) {
								setDispatchTripOpen(false);
							}
						}}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 620,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#10b981")}>
										🚚
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Create Dispatch Trip
										</Box>

										<Box sx={modalSubtitleSx}>
											{dispatchTripContext.title || "Select driver, vehicle and dispatch time"}
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									disabled={dispatchTripLoading}
									onClick={() => setDispatchTripOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										p: 1.6,
										mb: 2,
										borderRadius: "12px",
										background: "rgba(255,255,255,.035)",
										border: "1px solid rgba(255,255,255,.07)",
									}}
								>
									<Box sx={{ color: "#fff", fontWeight: 900 }}>
										Items:{" "}
										{dispatchTripContext.mode === "QR_SINGLE"
											? 1
											: dispatchTripContext.mode === "QR_BULK"
												? dispatchTripContext.scanTexts.length
												: dispatchTripContext.itemIds.length}
									</Box>

									<Box
										sx={{
											color: "#94a3b8",
											fontSize: 12,
											fontWeight: 700,
											mt: 0.5,
										}}
									>
										Mode: {dispatchTripContext.mode || "—"}
									</Box>
								</Box>

								<Box sx={{ mb: 2 }}>
									<Box sx={dispatchTripFieldLabelSx}>
										Driver
									</Box>

									<Box
										component="select"
										value={dispatchTripForm.driverId}
										onChange={(e) =>
											setDispatchTripForm((prev) => ({
												...prev,
												driverId: e.target.value,
											}))
										}
										sx={dispatchTripNativeSelectSx}
									>
										<option value="">
											Select Driver
										</option>

										{logisticsDrivers.map((d) => (
											<option
												key={d.id}
												value={d.id}
											>
												{d.name}
											</option>
										))}
									</Box>
								</Box>

								<Box sx={{ mb: 2 }}>
									<Box sx={dispatchTripFieldLabelSx}>
										Vehicle
									</Box>

									<Box
										component="select"
										value={dispatchTripForm.vehicleId}
										onChange={(e) =>
											setDispatchTripForm((prev) => ({
												...prev,
												vehicleId: e.target.value,
											}))
										}
										sx={dispatchTripNativeSelectSx}
									>
										<option value="">
											Select Vehicle
										</option>

										{logisticsVehicles.map((v) => (
											<option
												key={v.id}
												value={v.id}
											>
												{v.vehicleNumber}
											</option>
										))}
									</Box>
								</Box>

								<TextField
									fullWidth
									label="Dispatch / Trip Start Time"
									type="datetime-local"
									value={dispatchTripForm.tripStart}
									onChange={(e) =>
										setDispatchTripForm((prev) => ({
											...prev,
											tripStart: e.target.value,
										}))
									}
									InputLabelProps={{
										shrink: true,
									}}
									sx={{
										...formFieldSx,
										mb: 2,
									}}
								/>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={dispatchTripLoading}
									onClick={() => setDispatchTripOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={dispatchTripLoading}
									onClick={submitDispatchTrip}
									sx={premiumButton}
								>
									{dispatchTripLoading
										? "Creating Trip..."
										: "Create Trip & Generate Challan"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{chalaanPreview && (
					<div
						style={popupOverlay}
						onClick={() => {
							URL.revokeObjectURL(chalaanPreview.url);
							setChalaanPreview(null);
						}}
					>
						<div
							style={{
								width: 800,

								padding: 24,

								...darkModalBox,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<h2 style={{ marginBottom: 10 }}>Chalaan Preview</h2>

							<iframe
								src={chalaanPreview.url}
								style={{
									width: "100%",
									height: "500px",
									border: "none",
									borderRadius: 8,
									marginBottom: 12,
								}}
							/>

							<Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>

								{/* DOWNLOAD BUTTON */}
								<Button
									variant="contained"
									onClick={() => {
										const a = document.createElement("a");
										a.href = chalaanPreview.url;
										a.download = `CHALAAN_${chalaanPreview.id}.pdf`;
										document.body.appendChild(a);
										a.click();
										a.remove();
									}}
								>
									Download
								</Button>

								{/* CLOSE */}
								<Button
									onClick={() => {
										URL.revokeObjectURL(chalaanPreview.url);
										setChalaanPreview(null);
									}}
								>
									Close
								</Button>

							</Box>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default DispatchedItemsPage;
