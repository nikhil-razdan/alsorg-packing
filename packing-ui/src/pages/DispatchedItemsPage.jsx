import { useEffect, useState, useMemo, useRef } from "react";
import {
	Chip,
	Box,
	Button,
	IconButton,
	TextField,
	MenuItem,
	Tooltip,
	Collapse,
	Checkbox,
	ListItemText,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import MasterItemsModal from "../dashboard/components/inventory/MasterItemsModal";

import {
	fetchDrivers,
	fetchVehicles,
	createDispatchChallan,
	createCustomChallan,
	fetchCustomChallans,
	downloadCustomChallan,
} from "../dashboard/api/logisticsApi";

import { useAuth } from "../auth/AuthContext";

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

const customChallanAccent = "#8b5cf6";

const customChallanSectionCardSx = (open) => ({
	borderRadius: "14px",
	background: open
		? `linear-gradient(180deg, ${customChallanAccent}12, rgba(15,23,42,.82))`
		: "rgba(15,23,42,.82)",
	border: open
		? `1px solid ${customChallanAccent}44`
		: "1px solid rgba(255,255,255,.07)",
	borderLeft: `3px solid ${customChallanAccent}`,
	boxShadow: open
		? `0 14px 32px ${customChallanAccent}16`
		: "0 14px 28px rgba(2,6,23,.24)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
	transition: "all .25s ease",
});

const customChallanHeaderSx = {
	minHeight: 62,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	px: 1.8,
	py: 1.2,
	background: "rgba(2,6,23,.24)",
	borderBottom: "1px solid rgba(255,255,255,.07)",
};

const customChallanLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.3,
	minWidth: 0,
};

const customChallanIconBtnSx = {
	color: "#94a3b8",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.06)",
	width: 32,
	height: 32,
	borderRadius: "9px",

	"&:hover": {
		background: "rgba(139,92,246,.16)",
		color: "#fff",
	},
};

const customChallanTitleSx = {
	color: "#fff",
	fontSize: 18,
	fontWeight: 950,
	lineHeight: 1.1,
	letterSpacing: "-0.02em",
};

const customChallanSubSx = {
	mt: 0.3,
	color: "rgba(255,255,255,.52)",
	fontSize: 11,
	fontWeight: 650,
};

const customChallanRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexShrink: 0,
};

const customChallanCountChipSx = {
	height: 22,
	borderRadius: 999,
	background: "rgba(139,92,246,.15)",
	color: "#c4b5fd",
	border: "1px solid rgba(139,92,246,.28)",
	fontWeight: 900,
	fontSize: 10.5,
};

const customChallanBodySx = {
	background: "rgba(2,6,23,.18)",
	p: 1.4,
};


const premiumScrollbarSx = (accent = "#60a5fa") => ({
	scrollbarWidth: "thin",
	scrollbarColor: `${accent} rgba(15,23,42,.78)`,

	"&::-webkit-scrollbar": {
		width: 10,
		height: 10,
	},

	"&::-webkit-scrollbar-track": {
		background:
			"linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.88))",
		borderRadius: 999,
		border: "1px solid rgba(255,255,255,.05)",
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			`linear-gradient(180deg,${accent},rgba(147,197,253,.88))`,
		borderRadius: 999,
		border: "2px solid rgba(15,23,42,.95)",
		boxShadow: `0 0 18px ${accent}55`,
	},

	"&::-webkit-scrollbar-thumb:hover": {
		background:
			`linear-gradient(180deg,${accent},#bfdbfe)`,
	},
});

const customChallanListSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1,

	height: 360,
	maxHeight: 360,
	minHeight: 220,

	overflowY: "auto",
	overflowX: "hidden",

	pr: 1,
	mr: -0.35,

	scrollBehavior: "smooth",
	overscrollBehavior: "contain",
	scrollbarGutter: "stable both-edges",

	...premiumScrollbarSx("#a78bfa"),
};

const customChallanPagerWrapSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.2,
	flexWrap: "wrap",

	mb: 1.2,
	p: 1,

	borderRadius: "16px",

	background:
		"linear-gradient(135deg,rgba(139,92,246,.10),rgba(255,255,255,.025))",

	border:
		"1px solid rgba(139,92,246,.20)",

	boxShadow:
		"0 12px 28px rgba(2,6,23,.20)",
};

const dispatchPageSizeNativeSelectSx = {
	width: 86,
	height: 36,

	px: 1,
	borderRadius: "12px",

	outline: "none",

	color: "#fff",
	fontSize: 12,
	fontWeight: 900,

	background:
		"linear-gradient(180deg,rgba(15,23,42,.96),rgba(30,41,59,.88))",

	border:
		"1px solid rgba(96,165,250,.25)",

	boxShadow:
		"0 8px 18px rgba(2,6,23,.18)",

	cursor: "pointer",

	"&:focus": {
		borderColor: "#60a5fa",
		boxShadow: "0 0 0 3px rgba(96,165,250,.16)",
	},

	"& option": {
		color: "#111827",
		background: "#fff",
		fontWeight: 800,
	},
};

const customChallanRowSx = {
	display: "grid",
	gridTemplateColumns: "220px 180px minmax(260px,1fr) 110px 110px",
	alignItems: "center",
	gap: 1.5,
	p: 1.4,
	borderRadius: "12px",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.07)",

	"&:hover": {
		background: "rgba(255,255,255,.055)",
		borderColor: "rgba(139,92,246,.26)",
	},
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

const dispatchExportButtonSx = {
	height: 40,
	px: 2,
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 13,
	color: "#fff",
	background:
		"linear-gradient(135deg,rgba(16,185,129,.26),rgba(5,150,105,.20))",
	border: "1px solid rgba(16,185,129,.30)",
	boxShadow: "0 12px 26px rgba(16,185,129,.16)",

	"&:hover": {
		background:
			"linear-gradient(135deg,rgba(16,185,129,.34),rgba(5,150,105,.28))",
	},
};

const exportFormatButtonSx = (active, accent = "#60a5fa") => ({
	flex: 1,
	height: 42,
	borderRadius: "13px",
	textTransform: "none",
	fontWeight: 950,
	color: active ? "#fff" : "#cbd5e1",
	background: active
		? `linear-gradient(135deg,${accent},rgba(37,99,235,.86))`
		: "rgba(255,255,255,.04)",
	border: active
		? `1px solid ${accent}66`
		: "1px solid rgba(255,255,255,.08)",
	boxShadow: active
		? `0 12px 26px ${accent}22`
		: "none",

	"&:hover": {
		background: active
			? `linear-gradient(135deg,${accent},rgba(37,99,235,.92))`
			: "rgba(255,255,255,.075)",
	},
});

const dispatchExportPreviewTableSx = {
	width: "100%",
	borderCollapse: "collapse",

	"& th": {
		position: "sticky",
		top: 0,
		zIndex: 2,
		textAlign: "left",
		padding: "10px 12px",
		color: "#93c5fd",
		fontSize: 11,
		fontWeight: 950,
		textTransform: "uppercase",
		letterSpacing: ".08em",
		background: "rgba(15,23,42,.96)",
		borderBottom: "1px solid rgba(255,255,255,.08)",
		whiteSpace: "nowrap",
	},

	"& td": {
		padding: "10px 12px",
		color: "#e5e7eb",
		fontSize: 12,
		fontWeight: 750,
		borderBottom: "1px solid rgba(255,255,255,.06)",
		whiteSpace: "nowrap",
		maxWidth: 260,
		overflow: "hidden",
		textOverflow: "ellipsis",
	},

	"& tr:hover td": {
		background: "rgba(255,255,255,.035)",
	},
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


const dateTimeFieldSx = {
	...formFieldSx,

	"& input::-webkit-calendar-picker-indicator": {
		filter: "invert(1)",
		opacity: 0.85,
		cursor: "pointer",
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

const pdfPreviewOverlaySx = {
	position: "fixed",
	inset: 0,
	zIndex: 2147483000,

	background: `
		radial-gradient(circle at 20% 10%, rgba(59,130,246,.16), transparent 30%),
		radial-gradient(circle at 80% 90%, rgba(16,185,129,.10), transparent 32%),
		rgba(2,6,23,.82)
	`,

	backdropFilter: "blur(16px)",
	WebkitBackdropFilter: "blur(16px)",

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	p: 2,
};

const pdfPreviewModalSx = {
	width: "min(1120px, 94vw)",
	height: "min(86vh, 820px)",

	display: "flex",
	flexDirection: "column",

	borderRadius: "22px",

	overflow: "hidden",

	background:
		"linear-gradient(180deg,#0f172a,#111827)",

	border:
		"1px solid rgba(255,255,255,.10)",

	boxShadow:
		"0 45px 120px rgba(0,0,0,.72)",

	color: "#fff",
};

const pdfPreviewHeaderSx = {
	height: 68,

	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	px: 2.5,

	borderBottom:
		"1px solid rgba(255,255,255,.08)",

	background:
		"rgba(15,23,42,.92)",
};

const pdfPreviewBodySx = {
	flex: 1,
	p: 1.5,
	minHeight: 0,
	background: "rgba(2,6,23,.45)",
};

const pdfPreviewFooterSx = {
	height: 64,

	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1.2,

	px: 2.5,

	borderTop:
		"1px solid rgba(255,255,255,.08)",

	background:
		"rgba(15,23,42,.92)",
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

const dispatchControlDockSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	flexWrap: "wrap",
	p: 1.6,
	mb: 2,
	borderRadius: "22px",
	background:
		"radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 36%), rgba(15,23,42,.72)",
	border: "1px solid rgba(255,255,255,.075)",
	boxShadow: "0 18px 42px rgba(2,6,23,.28)",
	backdropFilter: "blur(18px)",
};

const dispatchControlLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	minWidth: 0,
};

const challanHistoryButtonSx = {
	height: 40,
	px: 2,
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 13,
	color: "#fff",
	background:
		"linear-gradient(135deg,rgba(96,165,250,.22),rgba(59,130,246,.18))",
	border: "1px solid rgba(96,165,250,.28)",
	boxShadow: "0 12px 26px rgba(59,130,246,.18)",

	"&:hover": {
		background:
			"linear-gradient(135deg,rgba(96,165,250,.30),rgba(59,130,246,.24))",
	},
};

const challanHistoryStatsGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
	gap: 1.2,
	mb: 2,
};

const challanHistoryStatSx = (accent) => ({
	p: 1.4,
	borderRadius: "16px",
	background:
		`radial-gradient(circle at top right, ${accent}22, transparent 46%), rgba(255,255,255,.035)`,
	border: `1px solid ${accent}33`,
});

const challanHistoryStatLabelSx = {
	color: "rgba(255,255,255,.54)",
	fontSize: 10,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const challanHistoryStatValueSx = {
	mt: 0.6,
	color: "#fff",
	fontSize: 24,
	fontWeight: 950,
	lineHeight: 1,
};

const challanHistoryScrollSx = {
	flex: 1,
	minHeight: 0,

	overflowY: "scroll",
	overflowX: "hidden",

	pr: 1.2,
	mr: -0.4,

	scrollBehavior: "smooth",
	overscrollBehavior: "contain",
	scrollbarGutter: "stable both-edges",

	...premiumScrollbarSx("#60a5fa"),
};

const challanHistorySectionHeaderSx = {
	position: "sticky",
	top: 0,
	zIndex: 5,

	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	flexWrap: "wrap",

	py: 1,
	px: 1.1,
	mb: 1.1,
	mt: 1,

	borderRadius: "16px",

	background:
		"linear-gradient(180deg,rgba(15,23,42,.96),rgba(15,23,42,.80))",

	border:
		"1px solid rgba(255,255,255,.075)",

	backdropFilter: "blur(18px)",
	WebkitBackdropFilter: "blur(18px)",

	boxShadow:
		"0 12px 28px rgba(2,6,23,.28)",
};

const challanHistoryPagerSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	flexWrap: "wrap",

	p: 0.8,
	borderRadius: "15px",

	maxWidth: "100%",

	background:
		"linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.025))",

	border:
		"1px solid rgba(255,255,255,.075)",
};

const challanHistoryPagerLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const challanHistoryPagerRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.6,
	flexWrap: "wrap",
};

const challanHistoryRangeSx = {
	color: "rgba(255,255,255,.58)",
	fontSize: 11,
	fontWeight: 850,
	whiteSpace: "nowrap",
};

const challanHistoryPagePillSx = {
	height: 32,
	px: 1.4,

	display: "flex",
	alignItems: "center",

	borderRadius: "999px",

	color: "#fff",
	fontSize: 11,
	fontWeight: 950,

	background:
		"linear-gradient(135deg,rgba(96,165,250,.18),rgba(255,255,255,.04))",

	border:
		"1px solid rgba(96,165,250,.25)",
};

const challanHistoryNativePageSizeSelectSx = {
	width: 78,
	height: 32,

	px: 1,
	borderRadius: "11px",

	outline: "none",

	color: "#fff",
	fontSize: 11,
	fontWeight: 950,

	background:
		"linear-gradient(180deg,rgba(15,23,42,.96),rgba(30,41,59,.88))",

	border:
		"1px solid rgba(96,165,250,.25)",

	boxShadow:
		"0 8px 18px rgba(2,6,23,.18)",

	cursor: "pointer",

	"&:focus": {
		borderColor: "#60a5fa",
		boxShadow: "0 0 0 3px rgba(96,165,250,.16)",
	},

	"& option": {
		color: "#111827",
		background: "#fff",
		fontWeight: 800,
	},
};

const challanHistoryPageButtonSx = {
	minWidth: 34,
	height: 32,
	px: 1.15,

	borderRadius: "11px",

	textTransform: "none",

	color: "#dbeafe",
	fontSize: 11,
	fontWeight: 950,

	background:
		"linear-gradient(180deg,rgba(30,41,59,.92),rgba(15,23,42,.92))",

	border:
		"1px solid rgba(255,255,255,.08)",

	boxShadow:
		"0 8px 18px rgba(2,6,23,.22)",

	"&:hover": {
		color: "#fff",
		background:
			"linear-gradient(180deg,rgba(37,99,235,.90),rgba(29,78,216,.90))",
		borderColor:
			"rgba(96,165,250,.32)",
	},

	"&.Mui-disabled": {
		opacity: 0.38,
		color: "rgba(203,213,225,.55)",
		background:
			"rgba(255,255,255,.035)",
	},
};

const challanHistoryPageSizeFieldSx = {
	width: 86,

	"& .MuiOutlinedInput-root": {
		height: 32,
		borderRadius: "11px",
		background: "rgba(255,255,255,.04)",
		color: "#fff",
		fontSize: 11,
		fontWeight: 900,

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(96,165,250,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#60a5fa",
			boxShadow: "0 0 0 3px rgba(96,165,250,.13)",
		},
	},

	"& .MuiSelect-select": {
		color: "#fff",
		fontWeight: 950,
		fontSize: 11,
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

const challanHistorySectionTitleSx = {
	mt: 1.2,
	mb: 1,
	color: "#93c5fd",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".14em",
	textTransform: "uppercase",
};

const masterChallanCardSx = {
	mb: 1.4,
	p: 1.4,
	borderRadius: "18px",
	background:
		"radial-gradient(circle at top left, rgba(96,165,250,.13), transparent 38%), rgba(255,255,255,.035)",
	border: "1px solid rgba(96,165,250,.18)",
};

const masterChallanHeaderSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0,1fr) auto",
	gap: 1.4,
	alignItems: "flex-start",
	mb: 1.2,
};

const masterChallanTitleSx = {
	color: "#fff",
	fontSize: 15,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const masterChallanMetaSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.55)",
	fontSize: 11,
	fontWeight: 750,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const masterChallanCountSx = {
	minWidth: 74,
	p: 1,
	borderRadius: "14px",
	textAlign: "center",
	background: "rgba(96,165,250,.12)",
	border: "1px solid rgba(96,165,250,.22)",
};

const masterChallanCountValueSx = {
	color: "#fff",
	fontSize: 22,
	fontWeight: 950,
	lineHeight: 1,
};

const masterChallanCountLabelSx = {
	mt: 0.4,
	color: "#bfdbfe",
	fontSize: 10,
	fontWeight: 900,
};

const challanRowsWrapSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const challanHistoryRowSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0,1fr) auto",
	alignItems: "center",
	gap: 1.4,
	p: 1.2,
	borderRadius: "15px",
	background: "rgba(15,23,42,.62)",
	border: "1px solid rgba(255,255,255,.07)",
};

const customChallanHistoryCardSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0,1fr) auto",
	alignItems: "center",
	gap: 1.4,
	p: 1.4,
	mb: 1.1,
	borderRadius: "16px",
	background:
		"radial-gradient(circle at top right, rgba(139,92,246,.15), transparent 42%), rgba(255,255,255,.035)",
	border: "1px solid rgba(139,92,246,.24)",
};

const challanHistoryNoSx = {
	color: "#fff",
	fontFamily: "monospace",
	fontSize: 14,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const challanHistoryMetaSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.58)",
	fontSize: 11,
	fontWeight: 750,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const challanHistoryActionsSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1,
	flexWrap: "wrap",
};

const tripStatusChipSx = (status) => {
	const running =
		String(status || "")
			.toUpperCase() === "RUNNING";

	return {
		color: running ? "#fcd34d" : "#6ee7b7",
		fontWeight: 900,
		background: running
			? "rgba(245,158,11,.13)"
			: "rgba(16,185,129,.13)",
		border: running
			? "1px solid rgba(245,158,11,.24)"
			: "1px solid rgba(16,185,129,.24)",
	};
};

const dispatchControlIconSx = {
	width: 42,
	height: 42,
	borderRadius: "16px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background: "rgba(59,130,246,.14)",
	border: "1px solid rgba(96,165,250,.24)",
	fontSize: 20,
};

const dispatchControlTitleSx = {
	color: "#fff",
	fontSize: 16,
	fontWeight: 950,
	letterSpacing: "-.02em",
};

const dispatchControlSubSx = {
	mt: 0.25,
	color: "rgba(255,255,255,.54)",
	fontSize: 11,
	fontWeight: 700,
};

const dispatchControlActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexWrap: "wrap",
};

const dispatchDockBtnSx = (accent) => ({
	height: 36,
	px: 1.7,
	borderRadius: "13px",
	textTransform: "none",
	fontSize: 12,
	fontWeight: 950,
	color: "#fff",
	background:
		`linear-gradient(180deg, ${accent}24, rgba(255,255,255,.045))`,
	border: `1px solid ${accent}44`,
	boxShadow: `0 10px 24px ${accent}18`,

	"&:hover": {
		background:
			`linear-gradient(180deg, ${accent}34, rgba(255,255,255,.070))`,
	},
});

const historyStatsGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
	gap: 1.2,
	mb: 2,
};

const historyMiniStatSx = (accent) => ({
	p: 1.4,
	borderRadius: "16px",
	background:
		`radial-gradient(circle at top right, ${accent}22, transparent 46%), rgba(255,255,255,.035)`,
	border: `1px solid ${accent}33`,
});

const historyMiniLabelSx = {
	color: "rgba(255,255,255,.54)",
	fontSize: 10,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const historyMiniValueSx = {
	mt: 0.6,
	color: "#fff",
	fontSize: 24,
	fontWeight: 950,
	lineHeight: 1,
};

const premiumHistoryListSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1.1,
	maxHeight: "56vh",
	overflowY: "auto",
	pr: 0.5,
};

const premiumHistoryRowSx = (accent) => ({
	display: "grid",
	gridTemplateColumns: "44px minmax(0,1fr) auto auto",
	alignItems: "center",
	gap: 1.3,
	p: 1.4,
	borderRadius: "16px",
	background:
		`linear-gradient(90deg, ${accent}10, rgba(255,255,255,.030))`,
	border: `1px solid ${accent}26`,
});

const historyDocIconSx = (accent) => ({
	width: 38,
	height: 38,
	borderRadius: "14px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background: `${accent}18`,
	border: `1px solid ${accent}33`,
	fontSize: 18,
});

const historyDocTitleSx = {
	color: "#fff",
	fontSize: 13,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const historyDocMetaSx = {
	mt: 0.4,
	color: "rgba(255,255,255,.58)",
	fontSize: 11,
	fontWeight: 750,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const historyDocDateSx = {
	mt: 0.35,
	color: "rgba(255,255,255,.42)",
	fontSize: 10.5,
	fontWeight: 750,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const historySectionTitleSx = {
	mt: 1.4,
	mb: 1,
	color: "#93c5fd",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".13em",
	textTransform: "uppercase",
};

const historyActionBtnsSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1,
	flexWrap: "wrap",
};

const normalizeSmartSearch = (value) => {
	return String(value || "")
		.toLowerCase()
		.trim()
		.replace(/[_]+/g, " ")
		.replace(/[|]+/g, " ")
		.replace(/\s+/g, " ");
};

const normalizeCompactSearch = (value) => {
	return String(value || "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]/g, "");
};

const getSmartStatusText = (status) => {
	const cleanStatus = String(status || "")
		.trim()
		.toUpperCase();

	const map = {
		READY: "ready packed pkd packing",
		READY_TO_STORE: "ready to store warehouse gate pass",
		WAREHOUSE_REQUESTED: "warehouse requested gate pass pending",
		IN_WAREHOUSE: "in warehouse stored",
		READY_TO_DISPATCH: "ready to dispatch challan",
		LOADED: "loaded queued queue",
		DISPATCHED: "dispatched challan",
		OUT_FOR_DELIVERY: "out for delivery dispatched live trip",
		DELIVERED: "delivered completed",
		WAREHOUSE_RETURN_REQUESTED: "warehouse return requested return",
		RESTORED: "restored",
		AVAILABLE: "available",
	};

	return `${cleanStatus} ${cleanStatus.replaceAll("_", " ")} ${map[cleanStatus] || ""}`;
};

const tokenizeSmartSearch = (value) => {
	const text = String(value || "")
		.trim()
		.toLowerCase();

	if (!text) {
		return [];
	}

	/*
	 * Supports normal words and quoted phrases:
	 * kapil sofa fg1
	 * "kapil menon" sofa fg1
	 */
	const matches =
		text.match(/"([^"]+)"|'([^']+)'|[^\s,]+/g) || [];

	return matches
		.map((token) =>
			token
				.replace(/^["']|["']$/g, "")
				.trim()
		)
		.map((token) => {
			/*
			 * Safety/convenience:
			 * If someone still types client:kapil,
			 * we simply convert it to kapil.
			 */
			if (token.includes(":")) {
				return token.split(":").slice(1).join(":").trim();
			}

			return token;
		})
		.filter(Boolean);
};

const rowSmartHaystack = (row) => {
	const parts = [
		row.name,
		row.itemName,
		row.sku,
		row.clientName,
		row.clientAddress,
		row.pdNo,
		row.drawingNo,
		row.description,
		row.remarks,
		row.plantCode,
		row.packedAreaCode,
		row.currentLocationCode,
		row.location,
		row.fgAreaCode,
		row.fgZoneCode,
		row.warehouseCode,
		row.gatePassNumber,
		row.challanNumber,
		row.dispatchChallanNumber,
		row.driverName,
		row.vehicleNumber,
		row.vehicleName,
		row.status,
		getSmartStatusText(row.status),
	];

	const normalText =
		normalizeSmartSearch(parts.filter(Boolean).join(" "));

	const compactText =
		normalizeCompactSearch(parts.filter(Boolean).join(" "));

	return {
		normalText,
		compactText,
	};
};

const WAREHOUSE_OPTIONS = [
	"BLS-WH-1",
	"RTP-WH-2",
	"AL-P1",
	"AL-P2",
	"AL-P3",
	"AL-P4",
];

const FROM_LOCATION_OPTIONS = [
	"AL-P1-FG-1-A",
	"AL-P1-FG-1-B",
	"AL-P1-FG-1-C",
	"AL-P2-FG-2",
	"AL-P3-FG-3",
	"AL-P4-FG-4",
	"AL-P1",
	"AL-P2",
	"AL-P3",
	"AL-P4",
	"AL-P1-PKD-1",
	"AL-P2-PKD-2",
	"AL-P3-PKD-3",
	"AL-P4-PKD-4",
];

const DISPATCH_EXPORT_STATUS_OPTIONS = [
	{
		value: "ALL",
		label: "All Status",
	},
	{
		value: "READY",
		label: "Packed",
	},
	{
		value: "READY_TO_STORE",
		label: "Ready To Store",
	},
	{
		value: "WAREHOUSE_REQUESTED",
		label: "Warehouse Requested",
	},
	{
		value: "IN_WAREHOUSE",
		label: "In Warehouse",
	},
	{
		value: "READY_TO_DISPATCH",
		label: "Ready To Dispatch",
	},
	{
		value: "LOADED",
		label: "Queued",
	},
	{
		value: "DISPATCHED",
		label: "Dispatched",
	},
	{
		value: "WAREHOUSE_RETURN_REQUESTED",
		label: "Warehouse Return Requested",
	},
];



function normalizeStatusSelection(value, previousValue = ["ALL"]) {
	const rawValues = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.split(",")
			: [];

	const nextValues = rawValues
		.map((item) => String(item || "").trim().toUpperCase())
		.filter(Boolean);

	if (nextValues.length === 0) {
		return ["ALL"];
	}

	const previousValues = Array.isArray(previousValue)
		? previousValue
		: [previousValue];

	const previousHadAll =
		previousValues.includes("ALL");

	const nextHasAll =
		nextValues.includes("ALL");

	/*
	 * If user selected All after selecting specific statuses,
	 * reset everything to All.
	 */
	if (nextHasAll && !previousHadAll) {
		return ["ALL"];
	}

	const withoutAll =
		nextValues.filter((status) => status !== "ALL");

	return withoutAll.length > 0
		? Array.from(new Set(withoutAll))
		: ["ALL"];
}

function statusSelectionHasAll(value) {
	return normalizeStatusSelection(value).includes("ALL");
}

function statusMatchesSelection(rowStatus, selectedStatuses) {
	const cleanRowStatus =
		String(rowStatus || "")
			.trim()
			.toUpperCase();

	const statuses =
		normalizeStatusSelection(selectedStatuses);

	if (statuses.includes("ALL")) {
		return true;
	}

	return statuses.includes(cleanRowStatus);
}

function getStatusOptionLabel(value) {
	const option =
		DISPATCH_EXPORT_STATUS_OPTIONS.find(
			(item) => item.value === value
		);

	return option?.label || value || "Status";
}

function renderStatusSelectionLabel(value) {
	const statuses =
		normalizeStatusSelection(value);

	if (statuses.includes("ALL")) {
		return "All Status";
	}

	if (statuses.length === 1) {
		return getStatusOptionLabel(statuses[0]);
	}

	return `${statuses.length} Status Selected`;
}

function getStatusExportFileLabel(value) {
	const statuses =
		normalizeStatusSelection(value);

	if (statuses.includes("ALL")) {
		return "ALL_STATUS";
	}

	return statuses
		.map((status) => getStatusOptionLabel(status))
		.join("_");
}

const smartRowMatches = (row, search) => {
	const tokens =
		tokenizeSmartSearch(search);

	if (tokens.length === 0) {
		return true;
	}

	const {
		normalText,
		compactText,
	} = rowSmartHaystack(row);

	return tokens.every((token) => {
		const normalToken =
			normalizeSmartSearch(token);

		const compactToken =
			normalizeCompactSearch(token);

		if (!normalToken && !compactToken) {
			return true;
		}

		return (
			normalText.includes(normalToken) ||
			compactText.includes(compactToken)
		);
	});
};

const CUSTOM_CHALLAN_UOM_OPTIONS = [
	{
		value: "KG",
		label: "Kg",
	},
	{
		value: "LTR",
		label: "Ltr",
	},
	{
		value: "ML",
		label: "ML",
	},
	{
		value: "SQFT",
		label: "sqft",
	},
	{
		value: "FT",
		label: "ft",
	},
	{
		value: "PIECES",
		label: "pieces",
	},
	{
		value: "MTR",
		label: "mtr",
	},
	{
		value: "SQMTR",
		label: "sqmtr",
	},
];

const createEmptyCustomChallanLine = () => ({
	description: "",
	drawingNo: "",
	quantity: 1,
	uom: "PIECES",
	returnable: false,
	remarks: "",
});

function DispatchedItemsPage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	/* ===== SEARCH + FILTER ===== */
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState(["ALL"]);
	const [groupBy, setGroupBy] = useState("NONE");
	const [fromLocation, setFromLocation] = useState("");
	const {
		role,
	} = useAuth();

	const cleanRole = String(role || "")
		.replace("ROLE_", "")
		.trim()
		.toUpperCase();

	const isAdmin = cleanRole === "ADMIN";
	const isDispatch = cleanRole === "DISPATCH";
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
	const [gatePassGenerating, setGatePassGenerating] = useState(false);
	const [moveFgModal, setMoveFgModal] = useState(null);
	const [selectedFgZone, setSelectedFgZone] = useState("");
	const [moveFgLoading, setMoveFgLoading] = useState(false);
	const [generatedHistoryOpen, setGeneratedHistoryOpen] = useState(false);
	const [masterItemsModalOpen, setMasterItemsModalOpen] = useState(false);
	const [historySearch, setHistorySearch] = useState("");

	const [challanHistoryOpen, setChallanHistoryOpen] = useState(false);
	const [challanHistoryLoading, setChallanHistoryLoading] = useState(false);
	const [challanHistoryRows, setChallanHistoryRows] = useState([]);
	const [challanHistorySearch, setChallanHistorySearch] = useState("");

	const [challanHistoryPageNo, setChallanHistoryPageNo] = useState(1);
	const [challanHistoryPageSize, setChallanHistoryPageSize] = useState(6);

	const [customChallanHistoryPageNo, setCustomChallanHistoryPageNo] = useState(1);
	const [customChallanHistoryPageSize, setCustomChallanHistoryPageSize] = useState(8);
	const [bulkMoveFgOpen, setBulkMoveFgOpen] = useState(false);
	const [bulkSelectedFgZone, setBulkSelectedFgZone] = useState("");
	const [bulkMoveFgLoading, setBulkMoveFgLoading] = useState(false);
	const [statusModal, setStatusModal] = useState(null);
	const [chalaanPreview, setChalaanPreview] = useState(null);
	const [bulkGatePassOpen, setBulkGatePassOpen] = useState(false);
	const [bulkGatePassPreview, setBulkGatePassPreview] = useState(null);
	const [bulkGatePassGenerating, setBulkGatePassGenerating] = useState(false);
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
		dispatchTime: "",
	});

	const [customChallanSectionOpen, setCustomChallanSectionOpen] = useState(false);
	const [customChallans, setCustomChallans] = useState([]);
	const [customChallansLoading, setCustomChallansLoading] = useState(false);

	const [customChallanPageNo, setCustomChallanPageNo] = useState(1);
	const [customChallanPageSize, setCustomChallanPageSize] = useState(5);

	const [customChallanOpen, setCustomChallanOpen] = useState(false);
	const [customChallanLoading, setCustomChallanLoading] = useState(false);

	const [customChallanForm, setCustomChallanForm] = useState({
		challanType: "CUSTOMER_CARE",
		fromLocation: "",
		toLocation: "",
		pdNo: "",
		driverName: "",
		vehicleNumber: "",
		clientName: "",
		clientAddress: "",
		purpose: "",
		movementMode: "DIRECT_DISPATCH",
		dispatchTime: "",
		items: [createEmptyCustomChallanLine()],
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

	const [dispatchExportOpen, setDispatchExportOpen] = useState(false);
	const [dispatchExportStatus, setDispatchExportStatus] = useState(["ALL"]);
	const [dispatchExportFormat, setDispatchExportFormat] = useState("CSV");

	const filteredRows = useMemo(() => {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows.filter((row) => {
			if (!smartRowMatches(row, search)) {
				return false;
			}

			if (!statusMatchesSelection(row.status, statusFilter)) {
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

	const getStoredToken = () => {
		return (
			localStorage.getItem("token") ||
			localStorage.getItem("jwt") ||
			localStorage.getItem("accessToken") ||
			""
		);
	};

	const getAuthHeaders = (extraHeaders = {}) => {
		const headers = {
			...(extraHeaders || {}),
		};

		const token = getStoredToken();

		if (token && !headers.Authorization) {
			headers.Authorization = token.startsWith("Bearer ")
				? token
				: `Bearer ${token}`;
		}

		const username = localStorage.getItem("username");

		if (username && !headers["X-Username"]) {
			headers["X-Username"] = username;
		}

		return headers;
	};

	const authFetch = (url, options = {}) => {
		return fetch(url, {
			...options,
			credentials: "include",
			headers: getAuthHeaders(options.headers || {}),
		});
	};

	const normalizeGatePassDropdownLocation = (row) => {
		const rawLocation =
			row?.currentLocationCode ||
			row?.location ||
			"";

		const plantCode =
			row?.plantCode ||
			"";

		if (FROM_LOCATION_OPTIONS.includes(rawLocation)) {
			return rawLocation;
		}

		if (plantCode && rawLocation && !rawLocation.startsWith("AL-")) {
			const combined = `${plantCode}-${rawLocation}`;

			if (FROM_LOCATION_OPTIONS.includes(combined)) {
				return combined;
			}
		}

		return "";
	};

	const clearSingleGatePassPreview = () => {
		if (gatePassPreview?.url) {
			URL.revokeObjectURL(gatePassPreview.url);
		}

		setGatePassPreview(null);
	};

	const clearBulkGatePassPreview = () => {
		if (bulkGatePassPreview?.url) {
			URL.revokeObjectURL(bulkGatePassPreview.url);
		}

		setBulkGatePassPreview(null);
	};

	const openSingleGatePassModal = (row) => {
		clearSingleGatePassPreview();

		setGatePassModal(row);

		setWarehouseCode(
			WAREHOUSE_OPTIONS.includes(row?.warehouseCode)
				? row.warehouseCode
				: ""
		);

		setFromLocation(normalizeGatePassDropdownLocation(row));
	};

	const openBulkGatePassModal = () => {
		clearBulkGatePassPreview();

		setWarehouseCode("");
		setFromLocation("");
		setBulkGatePassOpen(true);
	};

	const closeSingleGatePassModal = () => {
		clearSingleGatePassPreview();

		setGatePassModal(null);
		setWarehouseCode("");
		setFromLocation("");
	};

	const closeBulkGatePassModal = () => {
		clearBulkGatePassPreview();

		setBulkGatePassOpen(false);
		setWarehouseCode("");
		setFromLocation("");
	};

	const fetchGatePassPdfByNumber = async (gatePassNumber) => {
		const pdfRes = await authFetch(
			`${API_BASE_URL}/api/gatepass/bulk/${encodeURIComponent(gatePassNumber)}/pdf`,
			{
				method: "GET",
				headers: {
					Accept: "application/pdf",
				},
			}
		);

		if (!pdfRes.ok) {
			const text = await pdfRes.text();
			throw new Error(text || "Gate pass PDF failed");
		}

		const blob = await pdfRes.blob();

		if (!blob || blob.size === 0) {
			throw new Error("Empty gate pass PDF received");
		}

		return URL.createObjectURL(blob);
	};

	const generateSingleGatePass = async () => {
		if (!gatePassModal?.zohoItemId) {
			alert("Item ID missing");
			return;
		}

		const cleanWarehouseCode = String(warehouseCode || "").trim();
		const cleanFromLocation = String(fromLocation || "").trim();

		if (!cleanWarehouseCode) {
			alert("Please select warehouse");
			return;
		}

		if (!cleanFromLocation) {
			alert("Please select from location");
			return;
		}

		if (!WAREHOUSE_OPTIONS.includes(cleanWarehouseCode)) {
			alert("Invalid warehouse selected");
			return;
		}

		if (!FROM_LOCATION_OPTIONS.includes(cleanFromLocation)) {
			alert("Invalid from location selected");
			return;
		}

		try {
			setGatePassGenerating(true);
			clearSingleGatePassPreview();

			const res = await authFetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
					gatePassModal.zohoItemId
				)}/store?warehouseCode=${encodeURIComponent(
					cleanWarehouseCode
				)}&fromLocation=${encodeURIComponent(cleanFromLocation)}`,
				{
					method: "POST",
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Gate pass generation failed");
			}

			const data = await res.json();
			const gatePassNumber = data?.gatePass;

			if (!gatePassNumber) {
				throw new Error("Gate pass number missing from backend");
			}

			const url = await fetchGatePassPdfByNumber(gatePassNumber);

			setGatePassPreview({
				url,
				gatePass: gatePassNumber,
			});

			await fetchData();
		} catch (err) {
			console.error(err);
			alert(err.message || "Gate pass generation failed");
		} finally {
			setGatePassGenerating(false);
		}
	};

	const generateBulkGatePass = async () => {
		const selectedReadyToStoreItems = selectedItems.filter(
			(item) => getDispatchRowAction(item) === "GATE_PASS"
		);

		const itemIds = selectedReadyToStoreItems
			.map((item) => item.zohoItemId)
			.filter(Boolean);

		if (itemIds.length === 0) {
			alert("Select READY_TO_STORE items only");
			return;
		}

		if (itemIds.length !== selectionModel.length) {
			alert("Only READY_TO_STORE items can be used for bulk gate pass");
			return;
		}

		const cleanWarehouseCode = String(warehouseCode || "").trim();
		const cleanFromLocation = String(fromLocation || "").trim();

		if (!cleanWarehouseCode) {
			alert("Please select warehouse");
			return;
		}

		if (!cleanFromLocation) {
			alert("Please select from location");
			return;
		}

		if (!WAREHOUSE_OPTIONS.includes(cleanWarehouseCode)) {
			alert("Invalid warehouse selected");
			return;
		}

		if (!FROM_LOCATION_OPTIONS.includes(cleanFromLocation)) {
			alert("Invalid from location selected");
			return;
		}

		try {
			setBulkGatePassGenerating(true);
			clearBulkGatePassPreview();

			const res = await authFetch(
				`${API_BASE_URL}/api/dispatched/bulk/store?warehouseCode=${encodeURIComponent(
					cleanWarehouseCode
				)}&fromLocation=${encodeURIComponent(cleanFromLocation)}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(itemIds),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Bulk gate pass generation failed");
			}

			const data = await res.json();
			const gatePassNumber = data?.gatePass;

			if (!gatePassNumber) {
				throw new Error("Gate pass number missing from backend");
			}

			const url = await fetchGatePassPdfByNumber(gatePassNumber);

			setBulkGatePassPreview({
				url,
				gatePass: gatePassNumber,
			});

			setSelectionModel([]);

			await fetchData();
		} catch (err) {
			console.error(err);
			alert(err.message || "Bulk gate pass generation failed");
		} finally {
			setBulkGatePassGenerating(false);
		}
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

		if (row.status === "LOADED") {
			return {
				label: "Queued",
				sx: queuedStatusChip,
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

	const getDispatchChallanNo = (row) =>
		row?.challanNumber ||
		row?.chalaanNumber ||
		row?.dispatchChallanNumber ||
		row?.chalaanNo ||
		"";

	const dispatchExportColumns = [
		{
			header: "Item Name",
			getValue: (row) => row.name || row.itemName || "",
		},
		{
			header: "SKU",
			getValue: (row) => row.sku || "",
		},
		{
			header: "PD No",
			getValue: (row) => row.pdNo || "",
		},
		{
			header: "DWG No",
			getValue: (row) => row.drawingNo || "",
		},
		{
			header: "Description",
			getValue: (row) => row.description || "",
		},
		{
			header: "Stock",
			getValue: (row) => row.stock ?? 0,
		},
		{
			header: "Client",
			getValue: (row) => row.clientName || "",
		},
		{
			header: "Plant",
			getValue: (row) => row.plantCode || "",
		},
		{
			header: "Location",
			getValue: (row) => getCurrentLocation(row) || "",
		},
		{
			header: "Status",
			getValue: (row) => getDisplayStatus(row).label || "",
		},
		{
			header: "Driver",
			getValue: (row) => row.driverName || "",
		},
		{
			header: "Vehicle",
			getValue: (row) => row.vehicleNumber || "",
		},
		{
			header: "Challan No",
			getValue: (row) => getDispatchChallanNo(row) || "",
		},
		{
			header: "Gate Pass No",
			getValue: (row) => row.gatePassNumber || "",
		},
	];

	const openDispatchExportModal = () => {
		setDispatchExportStatus(
			normalizeStatusSelection(statusFilter)
		);

		setDispatchExportFormat("CSV");
		setDispatchExportOpen(true);
	};

	const getDispatchExportSourceRows = (statusValue) => {
		const selectedStatuses =
			normalizeStatusSelection(statusValue);

		return (rows || []).filter((row) => {
			if (!smartRowMatches(row, search)) {
				return false;
			}

			if (!statusMatchesSelection(row.status, selectedStatuses)) {
				return false;
			}

			return true;
		});
	};

	const buildDispatchExportRows = (statusValue) => {
		return getDispatchExportSourceRows(statusValue).map((row) => {
			const exportRow = {};

			dispatchExportColumns.forEach((column) => {
				exportRow[column.header] = column.getValue(row);
			});

			return exportRow;
		});
	};

	const dispatchExportPreviewRows = useMemo(() => {
		return buildDispatchExportRows(dispatchExportStatus);
	}, [
		rows,
		search,
		dispatchExportStatus,
		dispatchExportFormat,
	]);

	const csvEscape = (value) => {
		const text =
			String(value ?? "")
				.replace(/\r?\n|\r/g, " ")
				.trim();

		return `"${text.replace(/"/g, '""')}"`;
	};

	const escapeHtml = (value) => {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	};

	const normalizeExportFileName = (value) => {
		return String(value || "DISPATCH_EXPORT")
			.trim()
			.replace(/[^\w.-]+/g, "_")
			.replace(/^_+|_+$/g, "") || "DISPATCH_EXPORT";
	};

	const downloadTextFile = ({
		content,
		fileName,
		mimeType,
	}) => {
		const blob =
			new Blob([content], {
				type: mimeType,
			});

		const url =
			URL.createObjectURL(blob);

		const a =
			document.createElement("a");

		a.href = url;
		a.download = fileName;

		document.body.appendChild(a);
		a.click();
		a.remove();

		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 10000);
	};

	const exportDispatchData = () => {
		const exportRows =
			buildDispatchExportRows(dispatchExportStatus);

		if (exportRows.length === 0) {
			alert("No rows found for selected export status");
			return;
		}

		const baseFileName = "Dispatch Register";

		const headers =
			dispatchExportColumns.map((column) => column.header);

		if (dispatchExportFormat === "CSV") {
			const csv =
				"\uFEFF" +
				[
					headers.map(csvEscape).join(","),
					...exportRows.map((row) =>
						headers
							.map((header) => csvEscape(row[header]))
							.join(",")
					),
				].join("\n");

			downloadTextFile({
				content: csv,
				fileName: `${baseFileName}.csv`,
				mimeType: "text/csv;charset=utf-8;",
			});

			setDispatchExportOpen(false);
			return;
		}

		const tableHead =
			headers
				.map((header) => `<th>${escapeHtml(header)}</th>`)
				.join("");

		const tableBody =
			exportRows
				.map((row) => {
					const cells =
						headers
							.map((header) => `<td>${escapeHtml(row[header])}</td>`)
							.join("");

					return `<tr>${cells}</tr>`;
				})
				.join("");

		const excelHtml = `
		<html>
			<head>
				<meta charset="UTF-8" />
				<style>
					body {
						font-family: Arial, sans-serif;
					}

					table {
						border-collapse: collapse;
						width: 100%;
					}

					th {
						background: #111827;
						color: #ffffff;
						font-weight: 700;
						border: 1px solid #d1d5db;
						padding: 8px;
						text-align: left;
					}

					td {
						border: 1px solid #d1d5db;
						padding: 8px;
						mso-number-format: "\\@";
					}
				</style>
			</head>

			<body>
				<table>
					<thead>
						<tr>${tableHead}</tr>
					</thead>

					<tbody>
						${tableBody}
					</tbody>
				</table>
			</body>
		</html>
	`;

		downloadTextFile({
			content: excelHtml,
			fileName: `${baseFileName}.xls`,
			mimeType: "application/vnd.ms-excel;charset=utf-8;",
		});

		setDispatchExportOpen(false);
	};

	const formatLocalDateTimeDisplay = (value) => {
		if (!value) return "—";

		const text = String(value);
		const [datePart, timePart = ""] = text.split("T");

		const [year, month, day] = datePart.split("-");

		if (!year || !month || !day) {
			return text;
		}

		return `${day}-${month}-${year} ${timePart.slice(0, 5)}`;
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

			const res = await authFetch(`${API_BASE_URL}/api/dispatched`, {
				method: "GET",
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Failed to fetch dispatched items");
			}

			const data = await res.json();

			if (!Array.isArray(data)) {
				console.error("Invalid API response:", data);
				setRows([]);
				return [];
			}

			const cleaned = data
				.filter((d) => d?.zohoItemId)
				.map((d) => ({
					...d,
					stock: d.stock ?? 0,
					status: String(d.status || "").trim().toUpperCase(),
				}));

			setRows(cleaned);

			return cleaned;
		} catch (err) {
			console.error(err);
			setRows([]);
			return [];
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
			const res = await authFetch(`${API_BASE_URL}/api/plants/my`, {
				method: "GET",
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
		const res = await authFetch(`${API_BASE_URL}/api/scanner/resolve`, {
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

		const res = await authFetch(
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

			await dispatchSingleByScan(item);
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

			const rawScan = pendingQrFgItem.rawScan;

			const updatedItem = await resolveScan(rawScan);

			if (!updatedItem.dispatchAllowed) {
				throw new Error(
					updatedItem.message ||
					"Item moved to FG but cannot be dispatched"
				);
			}

			setPendingQrFgItem(null);
			setPendingQrFgZone("");

			await dispatchSingleByScan(updatedItem);
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

	const dispatchSingleByScan = async (item) => {
		if (!item?.zohoItemId) {
			alert("Scanned item id missing");
			return;
		}

		setScannerText("");
		setScanMessage("Select driver and vehicle to generate challan");

		openDispatchTripModal({
			mode: "QR_SINGLE",
			itemIds: [item.zohoItemId],
			title: item.itemName || "QR Single Dispatch",
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
			itemIds: scanCart.map((x) => x.zohoItemId),
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

			const res = await authFetch(
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
			const res = await authFetch(
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
				res = await authFetch(
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
			const res = await authFetch(
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
			const res = await authFetch(
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
			const res = await authFetch(
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
			const res = await authFetch(
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

	const openStickerHistory = async (row) => {
		try {
			if (!row?.zohoItemId) {
				alert("Dispatched Item ID missing");
				return;
			}

			setHistoryOpen(true);
			setHistoryLoading(true);
			setHistoryRows([]);
			setHistoryItem(row.zohoItemId);

			const ensureRes = await authFetch(
				`${API_BASE_URL}/api/stickers/dispatched/${encodeURIComponent(row.zohoItemId)}/ensure-history`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			if (!ensureRes.ok) {
				const text = await ensureRes.text();
				throw new Error(text || "Sticker history rebuild failed");
			}

			const ensureData = await ensureRes.json();

			const packetItemId =
				ensureData?.packetItemId ||
				row.packetItemId ||
				row.itemId ||
				row.id;

			if (!packetItemId) {
				throw new Error("Packet Item ID missing after history rebuild");
			}

			/*
			 * Step 2:
			 * Now load normal sticker history.
			 */
			const res = await authFetch(
				`${API_BASE_URL}/api/stickers/${encodeURIComponent(packetItemId)}/history`,
				{
					method: "GET",
					headers: getAuthHeaders(),
				}
			);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "History fetch failed");
			}

			const data = await res.json();

			setHistoryRows(Array.isArray(data) ? data : []);

			/*
			 * Keep row corrected in UI memory too.
			 */
			setRows((prev) =>
				prev.map((item) =>
					item.zohoItemId === row.zohoItemId
						? {
							...item,
							packetItemId,
							stickerNumber:
								ensureData?.stickerNumber ||
								item.stickerNumber,
						}
						: item
				)
			);
		} catch (err) {
			console.error(err);
			alert(err.message || "Failed to load sticker history");
		} finally {
			setHistoryLoading(false);
		}
	};

	const openAuditLogs = async (zohoItemId) => {
		try {
			setAuditOpen(true);
			setAuditLoading(true);
			setAuditRows([]);

			const res = await authFetch(
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
									openStickerHistory(row);
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
				const display = getDisplayStatus(row);

				return (
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: 0.6,
							minWidth: 0,
						}}
					>
						<Chip
							size="small"
							label={display.label}
							sx={display.sx}
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
								onClick={() => openSingleGatePassModal(row)}
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

		if (isDispatch || isAdmin) {
			loadCustomChallans();
		}
	}, []);

	const showChalaanPreview = (url, id = "DOCUMENT") => {
		setChalaanPreview((prev) => {
			if (prev?.url) {
				URL.revokeObjectURL(prev.url);
			}

			return {
				url,
				id,
			};
		});
	};

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
		if (cleanRole === "ADMIN")
			return { bg: "#111827", color: "#fff" };

		if (cleanRole === "DISPATCH")
			return { bg: "#065f46", color: "#ecfdf5" };

		if (cleanRole === "USER")
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
			const res = await authFetch(
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
			dispatchTime: getNowDateTimeLocal(),
		});

		setDispatchTripOpen(true);
	};

	const submitDispatchTrip = async () => {

		if (!dispatchTripForm.dispatchTime) {
			alert("Please select challan date and time");
			return;
		}

		if (!dispatchTripForm.driverId) {
			alert("Please select driver");
			return;
		}

		if (!dispatchTripForm.vehicleId) {
			alert("Please select vehicle");
			return;
		}

		try {
			setDispatchTripLoading(true);

			let finalItemIds =
				Array.isArray(dispatchTripContext.itemIds)
					? dispatchTripContext.itemIds.filter(Boolean)
					: [];

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
			}

			if (finalItemIds.length === 0) {
				throw new Error("No items selected for challan");
			}

			const result = await createDispatchChallan({
				itemIds: finalItemIds,
				driverId: dispatchTripForm.driverId,
				vehicleId: dispatchTripForm.vehicleId,
				dispatchTime: dispatchTripForm.dispatchTime,
				preview: true,
			});

			const blob = result.blob;

			if (!blob) {
				throw new Error("No challan PDF generated");
			}

			const url = URL.createObjectURL(blob);

			showChalaanPreview(
				url,
				result.challanNo || finalItemIds[0] || "CHALAAN"
			);
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
			alert(e.message || "Challan generation failed");
		} finally {
			setDispatchTripLoading(false);
		}
	};

	const resetCustomChallanForm = () => {
		setCustomChallanForm({
			challanType: "CUSTOMER_CARE",
			fromLocation: "",
			toLocation: "",
			pdNo: "",
			driverName: "",
			vehicleNumber: "",
			clientName: "",
			clientAddress: "",
			purpose: "",
			movementMode: "DIRECT_DISPATCH",
			dispatchTime: getNowDateTimeLocal(),
			items: [createEmptyCustomChallanLine()],
		});
	};

	const openCustomChallanModal = () => {
		resetCustomChallanForm();
		setCustomChallanOpen(true);
	};

	const updateCustomChallanField = (key, value) => {
		setCustomChallanForm((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const updateCustomChallanItem = (index, key, value) => {
		setCustomChallanForm((prev) => ({
			...prev,
			items: prev.items.map((item, i) =>
				i === index
					? {
						...item,
						[key]: value,
					}
					: item
			),
		}));
	};

	const addCustomChallanItem = () => {
		setCustomChallanForm((prev) => ({
			...prev,
			items: [
				...prev.items,
				createEmptyCustomChallanLine(),
			],
		}));
	};

	const removeCustomChallanItem = (index) => {
		setCustomChallanForm((prev) => {
			const nextItems =
				prev.items.filter((_, i) => i !== index);

			return {
				...prev,
				items:
					nextItems.length > 0
						? nextItems
						: [createEmptyCustomChallanLine()],
			};
		});
	};

	const submitCustomChallan = async () => {
		if (!isDispatch) {
			alert("Only dispatch user can create custom challan");
			return;
		}

		const selectedDispatchTime =
			String(customChallanForm.dispatchTime || "").trim();

		if (!selectedDispatchTime) {
			alert("Please select challan date and time");
			return;
		}

		const fromLocation =
			String(customChallanForm.fromLocation || "").trim();

		const toLocation =
			String(customChallanForm.toLocation || "").trim();

		const driverName =
			String(customChallanForm.driverName || "").trim();

		const vehicleNumber =
			String(customChallanForm.vehicleNumber || "").trim();

		if (!driverName) {
			alert("Driver name is required");
			return;
		}

		if (!vehicleNumber) {
			alert("Vehicle number is required");
			return;
		}

		if (!fromLocation) {
			alert("From location is required");
			return;
		}

		if (!toLocation) {
			alert("To location / site is required");
			return;
		}

		const cleanedItems =
			(customChallanForm.items || [])
				.map((item) => {
					const quantity =
						Number(item.quantity || 1);

					const uom =
						String(item.uom || "PIECES")
							.trim()
							.toUpperCase();

					const allowedUomValues =
						CUSTOM_CHALLAN_UOM_OPTIONS.map((option) => option.value);

					return {
						description: String(item.description || "").trim(),
						drawingNo: String(item.drawingNo || "").trim(),
						quantity:
							Number.isFinite(quantity) && quantity > 0
								? quantity
								: 1,
						uom: allowedUomValues.includes(uom)
							? uom
							: "PIECES",
						returnable: Boolean(item.returnable),
						remarks: String(item.remarks || "").trim(),
					};
				})
				.filter((item) => item.description);

		if (cleanedItems.length === 0) {
			alert("Add at least one item description");
			return;
		}

		try {
			setCustomChallanLoading(true);

			const result = await createCustomChallan({
				...customChallanForm,

				fromLocation,
				toLocation,

				pdNo: String(customChallanForm.pdNo || "").trim(),
				driverName,
				vehicleNumber,
				clientName: String(customChallanForm.clientName || "").trim(),
				clientAddress: String(customChallanForm.clientAddress || "").trim(),
				purpose: String(customChallanForm.purpose || "").trim(),

				movementMode: "DIRECT_DISPATCH",

				/*
				 * Important:
				 * Do not fallback to current time here.
				 * User-selected challan date/time should be the only source.
				 */
				dispatchTime: selectedDispatchTime,

				items: cleanedItems,
			});

			const blob = result.blob;

			if (!blob) {
				throw new Error("No custom challan PDF generated");
			}

			const url =
				URL.createObjectURL(blob);

			showChalaanPreview(
				url,
				result.challanNo || "CUSTOM_CHALLAN"
			);

			setCustomChallanOpen(false);
			resetCustomChallanForm();

			await loadCustomChallans();

		} catch (err) {
			console.error(err);
			alert(err.message || "Custom challan generation failed");
		} finally {
			setCustomChallanLoading(false);
		}
	};

	const loadCustomChallans = async () => {
		try {
			setCustomChallansLoading(true);

			const data = await fetchCustomChallans();

			setCustomChallans(
				Array.isArray(data)
					? data
					: []
			);
		} catch (err) {
			console.error(err);
			setCustomChallans([]);
		} finally {
			setCustomChallansLoading(false);
		}
	};

	const toggleCustomChallanSection = async () => {
		const nextOpen = !customChallanSectionOpen;

		setCustomChallanSectionOpen(nextOpen);

		if (nextOpen) {
			setCustomChallanPageNo(1);
		}

		if (nextOpen && customChallans.length === 0) {
			await loadCustomChallans();
		}
	};

	const getRowGeneratedTime = (row) =>
		row?.dispatchedAt ||
		row?.packedAt ||
		row?.createdAt ||
		row?.updatedAt ||
		"";

	const previewProtectedPdfPath = async (
		path,
		id = "DOCUMENT"
	) => {
		try {
			const res =
				await authFetch(
					`${API_BASE_URL}${path}`,
					{
						method: "GET",
						headers: {
							Accept: "application/pdf",
						},
					}
				);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "PDF preview failed");
			}

			const blob =
				await res.blob();

			if (!blob || blob.size === 0) {
				throw new Error("Empty PDF received");
			}

			const url =
				URL.createObjectURL(blob);

			showChalaanPreview(url, id);
		} catch (err) {
			console.error(err);
			alert(err.message || "PDF preview failed");
		}
	};

	const previewNormalChallanByNumber = async (challanNumber) => {
		if (!challanNumber) {
			alert("Challan number missing");
			return;
		}

		await previewProtectedPdfPath(
			`/api/reports/dashboard/challan/preview?challanNumber=${encodeURIComponent(
				challanNumber
			)}`,
			challanNumber
		);
	};

	const downloadNormalChallanByNumber = async (challanNumber) => {
		if (!challanNumber) {
			alert("Challan number missing");
			return;
		}

		try {
			const res =
				await authFetch(
					`${API_BASE_URL}/api/reports/dashboard/challan/download?challanNumber=${encodeURIComponent(
						challanNumber
					)}`,
					{
						method: "GET",
						headers: {
							Accept: "application/pdf",
						},
					}
				);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Challan download failed");
			}

			const blob =
				await res.blob();

			const url =
				URL.createObjectURL(blob);

			const a =
				document.createElement("a");

			a.href = url;
			a.download = `CHALLAN_${challanNumber}.pdf`;

			document.body.appendChild(a);
			a.click();
			a.remove();

			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 10000);
		} catch (err) {
			console.error(err);
			alert(err.message || "Challan download failed");
		}
	};

	const openChallanHistoryModal = async () => {
		setChallanHistoryOpen(true);

		if (
			(isDispatch || isAdmin) &&
			customChallans.length === 0
		) {
			await loadCustomChallans();
		}
	};

	const generatedHistoryRows = useMemo(() => {
		const docs = [];

		(rows || []).forEach((row) => {
			if (row?.stickerNumber) {
				docs.push({
					type: "Sticker",
					icon: "🏷️",
					number: row.stickerNumber,
					title: row.name || row.itemName || "Sticker Generated",
					client: row.clientName || "—",
					status: row.status || "—",
					time: row.packedAt || row.createdAt || "",
					accent: "#a78bfa",
				});
			}

			if (row?.gatePassNumber) {
				docs.push({
					type: "Gate Pass",
					icon: "🏭",
					number: row.gatePassNumber,
					title: row.name || row.itemName || "Gate Pass Generated",
					client: row.clientName || "—",
					status: row.status || "—",
					time: row.updatedAt || row.createdAt || "",
					accent: "#10b981",
				});
			}

			const challanNo =
				getDispatchChallanNo(row);

			if (challanNo) {
				docs.push({
					type: "Dispatch Challan",
					icon: "🚚",
					number: challanNo,
					title: row.name || row.itemName || "Dispatch Challan Generated",
					client: row.clientName || "—",
					status: row.status || "—",
					time: row.dispatchedAt || row.createdAt || "",
					accent: "#60a5fa",
					challanNumber: challanNo,
				});
			}
		});

		return docs
			.filter((doc) => {
				const q =
					normalizeSmartSearch(historySearch);

				if (!q) return true;

				return normalizeSmartSearch(
					[
						doc.type,
						doc.number,
						doc.title,
						doc.client,
						doc.status,
					].join(" ")
				).includes(q);
			})
			.sort((a, b) => {
				return (
					new Date(b.time || 0).getTime() -
					new Date(a.time || 0).getTime()
				);
			})
			.slice(0, 250);
	}, [rows, historySearch]);

	const getChallanNumber = (value) =>
		String(
			value?.challanNumber ||
			value?.chalaanNumber ||
			value?.dispatchChallanNumber ||
			""
		).trim();

	const fetchChallanHistoryRows = async () => {
		const res =
			await authFetch(`${API_BASE_URL}/api/dispatched/challans`, {
				method: "GET",
			});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || "Failed to load challan history");
		}

		const data =
			await res.json();

		return Array.isArray(data)
			? data
			: [];
	};

	const openChallanHistory = async () => {
		try {
			setChallanHistoryOpen(true);
			setChallanHistoryLoading(true);
			setChallanHistorySearch("");
			setChallanHistoryPageNo(1);
			setCustomChallanHistoryPageNo(1);

			const [normalRows] =
				await Promise.all([
					fetchChallanHistoryRows(),
					loadCustomChallans(),
				]);

			setChallanHistoryRows(normalRows);
		} catch (err) {
			console.error(err);
			alert(err.message || "Failed to load challan history");
			setChallanHistoryRows([]);
		} finally {
			setChallanHistoryLoading(false);
		}
	};

	const previewExistingChallanPdf = async (challanNumber) => {
		if (!challanNumber) {
			alert("Challan number missing");
			return;
		}

		try {
			const res =
				await authFetch(
					`${API_BASE_URL}/api/chalaan/dispatched/${encodeURIComponent(
						challanNumber
					)}/download?preview=true`,
					{
						method: "GET",
						headers: {
							Accept: "application/pdf",
						},
					}
				);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Challan preview failed");
			}

			const blob =
				await res.blob();

			if (!blob || blob.size === 0) {
				throw new Error("Empty challan PDF received");
			}

			const url =
				URL.createObjectURL(blob);

			showChalaanPreview(url, challanNumber);
		} catch (err) {
			console.error(err);
			alert(err.message || "Challan preview failed");
		}
	};

	const downloadExistingChallanPdf = async (challanNumber) => {
		if (!challanNumber) {
			alert("Challan number missing");
			return;
		}

		try {
			const res =
				await authFetch(
					`${API_BASE_URL}/api/chalaan/dispatched/${encodeURIComponent(
						challanNumber
					)}/download?preview=false`,
					{
						method: "GET",
						headers: {
							Accept: "application/pdf",
						},
					}
				);

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Challan download failed");
			}

			const blob =
				await res.blob();

			const url =
				URL.createObjectURL(blob);

			const a =
				document.createElement("a");

			a.href = url;
			a.download = `CHALLAN_${challanNumber}.pdf`;

			document.body.appendChild(a);
			a.click();
			a.remove();

			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 10000);
		} catch (err) {
			console.error(err);
			alert(err.message || "Challan download failed");
		}
	};

	const getMasterHistoryKey = (item) => {
		return [
			item?.clientName || "",
			item?.clientAddress || "",
			item?.pdNo || "",
			item?.drawingNo || "",
		]
			.map((v) => String(v || "").trim().toLowerCase())
			.join("|");
	};

	const challanHistoryMasterGroups = useMemo(() => {
		const groups = new Map();

		(challanHistoryRows || []).forEach((challan) => {
			const challanNumber =
				getChallanNumber(challan);

			(challan.items || []).forEach((item) => {
				const key =
					getMasterHistoryKey(item) ||
					`${challanNumber}-${item.zohoItemId}`;

				if (!groups.has(key)) {
					groups.set(key, {
						key,
						itemName: item.name || "Master Item",
						clientName: item.clientName || "—",
						clientAddress: item.clientAddress || "—",
						pdNo: item.pdNo || "—",
						drawingNo: item.drawingNo || "—",
						challans: new Map(),
						totalItems: 0,
						lastDate: challan.dispatchedAt || item.dispatchedAt || "",
					});
				}

				const group =
					groups.get(key);

				group.totalItems += 1;

				if (!group.challans.has(challanNumber)) {
					group.challans.set(challanNumber, {
						challanNumber,
						driverName: challan.driverName || "—",
						vehicleNumber: challan.vehicleNumber || "—",
						dispatchedAt: challan.dispatchedAt,
						dispatchedBy: challan.dispatchedBy || "—",
						tripStatus: challan.tripStatus || "—",
						items: [],
					});
				}

				group.challans.get(challanNumber).items.push(item);

				const currentDate =
					challan.dispatchedAt || item.dispatchedAt || "";

				if (
					currentDate &&
					(
						!group.lastDate ||
						new Date(currentDate).getTime() >
						new Date(group.lastDate).getTime()
					)
				) {
					group.lastDate = currentDate;
				}
			});
		});

		const searchText =
			normalizeSmartSearch(challanHistorySearch);

		return Array.from(groups.values())
			.map((group) => ({
				...group,
				challans: Array.from(group.challans.values()),
			}))
			.filter((group) => {
				if (!searchText) {
					return true;
				}

				const text =
					normalizeSmartSearch(
						[
							group.itemName,
							group.clientName,
							group.clientAddress,
							group.pdNo,
							group.drawingNo,
							group.challans
								.map((c) => c.challanNumber)
								.join(" "),
						].join(" ")
					);

				return text.includes(searchText);
			})
			.sort((a, b) => {
				return (
					new Date(b.lastDate || 0).getTime() -
					new Date(a.lastDate || 0).getTime()
				);
			});
	}, [challanHistoryRows, challanHistorySearch]);

	const customChallanHistoryRows = useMemo(() => {
		const searchText =
			normalizeSmartSearch(challanHistorySearch);

		return (customChallans || [])
			.filter((challan) => {
				if (!searchText) {
					return true;
				}

				const text =
					normalizeSmartSearch(
						[
							challan.challanNumber,
							challan.challanType,
							challan.challanTypeLabel,
							challan.fromLocation,
							challan.toLocation,
							challan.clientName,
							challan.driverName,
							challan.vehicleNumber,
							challan.pdNo,
							challan.generatedBy,
						].join(" ")
					);

				return text.includes(searchText);
			});
	}, [customChallans, challanHistorySearch]);

	const challanHistoryTotalPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(
				challanHistoryMasterGroups.length / challanHistoryPageSize
			)
		);
	}, [challanHistoryMasterGroups.length, challanHistoryPageSize]);

	const paginatedChallanHistoryMasterGroups = useMemo(() => {
		const start =
			(challanHistoryPageNo - 1) * challanHistoryPageSize;

		return challanHistoryMasterGroups.slice(
			start,
			start + challanHistoryPageSize
		);
	}, [
		challanHistoryMasterGroups,
		challanHistoryPageNo,
		challanHistoryPageSize,
	]);

	const customChallanHistoryTotalPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(
				customChallanHistoryRows.length / customChallanHistoryPageSize
			)
		);
	}, [customChallanHistoryRows.length, customChallanHistoryPageSize]);

	const paginatedCustomChallanHistoryRows = useMemo(() => {
		const start =
			(customChallanHistoryPageNo - 1) * customChallanHistoryPageSize;

		return customChallanHistoryRows.slice(
			start,
			start + customChallanHistoryPageSize
		);
	}, [
		customChallanHistoryRows,
		customChallanHistoryPageNo,
		customChallanHistoryPageSize,
	]);

	const closeChalaanPreview = () => {
		if (chalaanPreview?.url) {
			URL.revokeObjectURL(chalaanPreview.url);
		}

		setChalaanPreview(null);
	};

	const customChallanTotalPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(customChallans.length / customChallanPageSize)
		);
	}, [customChallans.length, customChallanPageSize]);

	const paginatedCustomChallans = useMemo(() => {
		const start =
			(customChallanPageNo - 1) * customChallanPageSize;

		return customChallans.slice(
			start,
			start + customChallanPageSize
		);
	}, [
		customChallans,
		customChallanPageNo,
		customChallanPageSize,
	]);

	useEffect(() => {
		setCustomChallanPageNo(1);
	}, [customChallanPageSize]);

	useEffect(() => {
		if (customChallanPageNo > customChallanTotalPages) {
			setCustomChallanPageNo(customChallanTotalPages);
		}
	}, [customChallanPageNo, customChallanTotalPages]);

	useEffect(() => {
		setCustomChallanPageNo(1);
	}, [customChallans.length]);

	useEffect(() => {
		setChallanHistoryPageNo(1);
		setCustomChallanHistoryPageNo(1);
	}, [challanHistorySearch]);

	useEffect(() => {
		setChallanHistoryPageNo(1);
	}, [challanHistoryPageSize]);

	useEffect(() => {
		setCustomChallanHistoryPageNo(1);
	}, [customChallanHistoryPageSize]);

	useEffect(() => {
		if (challanHistoryPageNo > challanHistoryTotalPages) {
			setChallanHistoryPageNo(challanHistoryTotalPages);
		}
	}, [challanHistoryPageNo, challanHistoryTotalPages]);

	useEffect(() => {
		if (customChallanHistoryPageNo > customChallanHistoryTotalPages) {
			setCustomChallanHistoryPageNo(customChallanHistoryTotalPages);
		}
	}, [customChallanHistoryPageNo, customChallanHistoryTotalPages]);

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

						<Button
							onClick={openDispatchExportModal}
							sx={dispatchExportButtonSx}
						>
							⬇ Export
						</Button>

						<Button
							onClick={openChallanHistory}
							sx={challanHistoryButtonSx}
						>
							📄 Challan History
						</Button>

						{isDispatch && (
							<>
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
							</>
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
						placeholder="Search by client, item, SKU, PD, DWG, location, status..."
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

					{search ? (
						<Button
							size="small"
							onClick={() => setSearch("")}
							sx={{
								minWidth: 70,
								height: 34,
								borderRadius: "10px",
								textTransform: "none",
								fontWeight: 800,
								color: "#cbd5e1",
								background: "rgba(255,255,255,.05)",
								border: "1px solid rgba(255,255,255,.08)",

								"&:hover": {
									background: "rgba(255,255,255,.10)",
									color: "#fff",
								},
							}}
						>
							Clear
						</Button>
					) : null}

					<TextField
						select
						size="small"
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter((prev) =>
								normalizeStatusSelection(e.target.value, prev)
							);
						}}
						slotProps={{
							select: {
								multiple: true,
								renderValue: (selected) =>
									renderStatusSelectionLabel(selected),
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
												fontWeight: 700,
												color: "#fff",
											},

											"& .MuiMenuItem-root:hover": {
												background: "rgba(59,130,246,.08)",
											},

											"& .Mui-selected": {
												background:
													"rgba(59,130,246,.16) !important",
												color: "#60a5fa",
												fontWeight: 900,
											},
										},
									},
								},
							},
						}}
						sx={{
							minWidth: 230,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,
								borderRadius: "14px",
								background: "rgba(255,255,255,.04)",
								color: "#fff",

								"& fieldset": {
									borderColor: "rgba(255,255,255,.08)",
								},

								"&:hover fieldset": {
									borderColor: "rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "#fff",
								fontWeight: 800,
							},

							"& .MuiSvgIcon-root": {
								color: "#94a3b8",
							},
						}}
					>
						{DISPATCH_EXPORT_STATUS_OPTIONS.map((option) => {
							const allSelected =
								statusSelectionHasAll(statusFilter);

							const checked =
								option.value === "ALL"
									? allSelected
									: !allSelected && statusFilter.includes(option.value);

							return (
								<MenuItem
									key={option.value}
									value={option.value}
								>
									<Checkbox
										size="small"
										checked={checked}
										sx={{
											color: "rgba(255,255,255,.45)",
											"&.Mui-checked": {
												color: "#60a5fa",
											},
										}}
									/>

									<ListItemText
										primary={
											option.value === "READY"
												? "🟡 Packed"
												: option.value === "READY_TO_STORE"
													? "📦 Ready To Store"
													: option.value === "WAREHOUSE_REQUESTED"
														? "🏭 Warehouse Requested"
														: option.value === "LOADED"
															? "🟠 Queued"
															: option.value === "IN_WAREHOUSE"
																? "🏢 In Warehouse"
																: option.value === "READY_TO_DISPATCH"
																	? "🚚 Ready To Dispatch"
																	: option.value === "DISPATCHED"
																		? "✅ Dispatched"
																		: option.value === "WAREHOUSE_RETURN_REQUESTED"
																			? "↩️ Warehouse Return Requested"
																			: "All Status"
										}
										primaryTypographyProps={{
											fontSize: 13,
											fontWeight: 800,
										}}
									/>
								</MenuItem>
							);
						})}
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

				{(isDispatch || isAdmin) && (
					<Box sx={customChallanSectionCardSx(customChallanSectionOpen)}>
						<Box sx={customChallanHeaderSx}>
							<Box sx={customChallanLeftSx}>
								<IconButton
									size="small"
									onClick={toggleCustomChallanSection}
									sx={customChallanIconBtnSx}
								>
									{customChallanSectionOpen ? (
										<ExpandLessIcon />
									) : (
										<ExpandMoreIcon />
									)}
								</IconButton>

								<Box sx={{ minWidth: 0 }}>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											flexWrap: "wrap",
										}}
									>
										<Box sx={customChallanTitleSx}>
											Custom Challans
										</Box>

										<Chip
											size="small"
											label={`${customChallans.length} Created`}
											sx={customChallanCountChipSx}
										/>
									</Box>

									<Box sx={customChallanSubSx}>
										Customer care, hardware and site assembly challans generated manually
									</Box>
								</Box>
							</Box>

							<Box sx={customChallanRightSx}>
								{customChallans.length > 0 && (
									<Box
										sx={{
											color: "#94a3b8",
											fontSize: 11,
											fontWeight: 800,
											textAlign: "right",
											maxWidth: 220,
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
										title={customChallans[0]?.challanNumber}
									>
										Latest:{" "}
										<span style={{ color: "#c4b5fd" }}>
											{customChallans[0]?.challanNumber}
										</span>
									</Box>
								)}

								<Button
									onClick={openCustomChallanModal}
									sx={{
										...modalSecondaryButtonSx,
										height: 34,
										color: "#fff",
										background: "rgba(139,92,246,.14)",
										border: "1px solid rgba(139,92,246,.24)",

										"&:hover": {
											background: "rgba(139,92,246,.22)",
										},
									}}
								>
									+ Create
								</Button>

								<Button
									onClick={loadCustomChallans}
									sx={{
										...modalSecondaryButtonSx,
										height: 34,
									}}
								>
									Refresh
								</Button>
							</Box>
						</Box>

						<Collapse
							in={customChallanSectionOpen}
							timeout="auto"
							unmountOnExit
						>
							<Box sx={customChallanBodySx}>
								{customChallansLoading && (
									<Box sx={modalEmptyStateSx}>
										Loading custom challans…
									</Box>
								)}

								{!customChallansLoading && customChallans.length === 0 && (
									<Box sx={modalEmptyStateSx}>
										No custom challans generated yet.
									</Box>
								)}

								{!customChallansLoading && customChallans.length > 0 && (
									<>
										<Box sx={customChallanPagerWrapSx}>
											<Box
												sx={{
													color: "#c4b5fd",
													fontSize: 11,
													fontWeight: 950,
													letterSpacing: ".12em",
													textTransform: "uppercase",
												}}
											>
												Custom Challan Records
											</Box>

											<ChallanHistoryPager
												pageNo={customChallanPageNo}
												totalPages={customChallanTotalPages}
												pageSize={customChallanPageSize}
												totalRows={customChallans.length}
												label="challans"
												pageSizeOptions={[5, 8, 12, 20]}
												onPageChange={setCustomChallanPageNo}
												onPageSizeChange={setCustomChallanPageSize}
											/>
										</Box>

										<Box sx={customChallanListSx}>
											{paginatedCustomChallans.map((challan) => (
												<Box
													key={challan.challanNumber}
													sx={customChallanRowSx}
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
															title={challan.challanNumber}
														>
															{challan.challanNumber}
														</Box>

														<Box
															sx={{
																color: "#94a3b8",
																fontSize: 11,
																fontWeight: 700,
																mt: 0.4,
															}}
														>
															{formatLocalDateTimeDisplay(challan.generatedAt)}
														</Box>
													</Box>

													<Chip
														size="small"
														label={challan.challanTypeLabel || challan.challanType}
														sx={{
															width: "fit-content",
															color: "#c4b5fd",
															fontWeight: 900,
															background: "rgba(139,92,246,.14)",
															border: "1px solid rgba(139,92,246,.24)",
														}}
													/>

													<Box sx={{ minWidth: 0 }}>
														<Box
															sx={{
																color: "#fff",
																fontSize: 13,
																fontWeight: 800,
																whiteSpace: "nowrap",
																overflow: "hidden",
																textOverflow: "ellipsis",
															}}
															title={`${challan.fromLocation || "—"} → ${challan.toLocation || "—"}`}
														>
															{challan.fromLocation || "—"} → {challan.toLocation || "—"}
														</Box>

														<Box
															sx={{
																color: "rgba(255,255,255,.55)",
																fontSize: 11,
																fontWeight: 700,
																mt: 0.4,
																whiteSpace: "nowrap",
																overflow: "hidden",
																textOverflow: "ellipsis",
															}}
														>
															{challan.clientName || "No client"} •{" "}
															Driver: {challan.driverName || "—"} • Vehicle:{" "}
															{challan.vehicleNumber || "—"}
														</Box>
													</Box>

													<Box
														sx={{
															color: "#cbd5e1",
															fontSize: 12,
															fontWeight: 800,
														}}
													>
														{challan.totalItems || 0} item
														{Number(challan.totalItems || 0) === 1 ? "" : "s"}
													</Box>

													<Button
														size="small"
														onClick={async () => {
															try {
																const result =
																	await downloadCustomChallan(
																		challan.challanNumber
																	);

																const url =
																	URL.createObjectURL(result.blob);

																showChalaanPreview(
																	url,
																	result.challanNo || challan.challanNumber
																);
															} catch (err) {
																console.error(err);
																alert(err.message || "Download failed");
															}
														}}
														sx={{
															...modalSecondaryButtonSx,
															height: 34,
															color: "#fff",
														}}
													>
														View PDF
													</Button>
												</Box>
											))}
										</Box>
									</>
								)}
							</Box>
						</Collapse>
					</Box>
				)}

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
								<Box
									component="select"
									value={pageSize}
									onChange={(e) => {
										setPageSize(Number(e.target.value));
										setPageNo(1);
									}}
									sx={dispatchPageSizeNativeSelectSx}
								>
									<option value={25}>25</option>
									<option value={50}>50</option>
								</Box>
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
										openBulkMoveToFgModal();
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
									onClick={openBulkGatePassModal}
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
				{dispatchExportOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5500 }}
						onClick={() => setDispatchExportOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 820,
								maxHeight: "88vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#10b981")}>
										⬇
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Export Dispatch Data
										</Box>

										<Box sx={modalSubtitleSx}>
											Export dispatch table columns by selected status
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setDispatchExportOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr",
										gap: 2,
										mb: 2,
									}}
								>
									<Box>
										<Box sx={dispatchTripFieldLabelSx}>
											Export Status
										</Box>

										<TextField
											select
											fullWidth
											value={dispatchExportStatus}
											onChange={(e) => {
												setDispatchExportStatus((prev) =>
													normalizeStatusSelection(e.target.value, prev)
												);
											}}
											slotProps={{
												select: {
													multiple: true,
													renderValue: (selected) =>
														renderStatusSelectionLabel(selected),
													MenuProps: modalSelectMenuProps,
												},
											}}
											sx={{
												...formFieldSx,

												"& .MuiOutlinedInput-root": {
													height: 46,
													borderRadius: "14px",
													background: "rgba(255,255,255,.04)",
													color: "#fff",

													"& fieldset": {
														borderColor: "rgba(255,255,255,.10)",
													},

													"&:hover fieldset": {
														borderColor: "rgba(16,185,129,.40)",
													},

													"&.Mui-focused fieldset": {
														borderColor: "#10b981",
														boxShadow: "0 0 0 3px rgba(16,185,129,.14)",
													},
												},

												"& .MuiSelect-select": {
													color: "#fff",
													fontWeight: 900,
													fontSize: 13,
												},

												"& .MuiSvgIcon-root": {
													color: "#94a3b8",
												},
											}}
										>
											{DISPATCH_EXPORT_STATUS_OPTIONS.map((option) => {
												const allSelected =
													statusSelectionHasAll(dispatchExportStatus);

												const checked =
													option.value === "ALL"
														? allSelected
														: !allSelected &&
														dispatchExportStatus.includes(option.value);

												return (
													<MenuItem
														key={option.value}
														value={option.value}
													>
														<Checkbox
															size="small"
															checked={checked}
															sx={{
																color: "rgba(255,255,255,.45)",
																"&.Mui-checked": {
																	color: "#10b981",
																},
															}}
														/>

														<ListItemText
															primary={option.label}
															primaryTypographyProps={{
																fontSize: 13,
																fontWeight: 800,
															}}
														/>
													</MenuItem>
												);
											})}
										</TextField>
									</Box>

									<Box>
										<Box sx={dispatchTripFieldLabelSx}>
											Export Format
										</Box>

										<Box
											sx={{
												display: "flex",
												gap: 1,
											}}
										>
											<Button
												onClick={() => setDispatchExportFormat("CSV")}
												sx={exportFormatButtonSx(
													dispatchExportFormat === "CSV",
													"#60a5fa"
												)}
											>
												CSV
											</Button>

											<Button
												onClick={() => setDispatchExportFormat("EXCEL")}
												sx={exportFormatButtonSx(
													dispatchExportFormat === "EXCEL",
													"#10b981"
												)}
											>
												Excel
											</Button>
										</Box>
									</Box>
								</Box>

								<Box sx={historyStatsGridSx}>
									<HistoryMiniStat
										label="Rows to Export"
										value={dispatchExportPreviewRows.length}
										accent="#10b981"
									/>

									<HistoryMiniStat
										label="Columns"
										value={dispatchExportColumns.length}
										accent="#60a5fa"
									/>

									<HistoryMiniStat
										label="Status"
										value={renderStatusSelectionLabel(dispatchExportStatus)}
										accent="#a78bfa"
									/>

									<HistoryMiniStat
										label="Search"
										value={search ? "Applied" : "None"}
										accent="#f59e0b"
									/>
								</Box>

								<Box
									sx={{
										mb: 1,
										color: "rgba(255,255,255,.55)",
										fontSize: 12,
										fontWeight: 750,
									}}
								>
									Export preview uses the same dispatch table column order.
									Search filter is also applied. Pagination is ignored.
								</Box>

								<Box
									sx={{
										maxHeight: 280,
										overflow: "auto",
										borderRadius: "16px",
										border: "1px solid rgba(255,255,255,.08)",
										background: "rgba(2,6,23,.25)",
										...premiumScrollbarSx("#10b981"),
									}}
								>
									<Box
										component="table"
										sx={{
											...dispatchExportPreviewTableSx,
											minWidth: 1200,
										}}
									>
										<thead>
											<tr>
												{dispatchExportColumns.map((column) => (
													<th key={column.header}>
														{column.header}
													</th>
												))}
											</tr>
										</thead>

										<tbody>
											{dispatchExportPreviewRows.slice(0, 20).map((row, index) => (
												<tr key={index}>
													{dispatchExportColumns.map((column) => (
														<td
															key={column.header}
															title={row[column.header]}
														>
															{row[column.header] || "—"}
														</td>
													))}
												</tr>
											))}
										</tbody>
									</Box>

									{dispatchExportPreviewRows.length === 0 && (
										<Box sx={modalEmptyStateSx}>
											No rows found for selected status.
										</Box>
									)}
								</Box>

								{dispatchExportPreviewRows.length > 20 && (
									<Box
										sx={{
											mt: 1,
											color: "rgba(255,255,255,.48)",
											fontSize: 11,
											fontWeight: 750,
										}}
									>
										Showing first 20 rows in preview. Full export will include{" "}
										{dispatchExportPreviewRows.length} rows.
									</Box>
								)}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => setDispatchExportOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={dispatchExportPreviewRows.length === 0}
									onClick={exportDispatchData}
									sx={{
										...premiumButton,
										background:
											dispatchExportFormat === "EXCEL"
												? "linear-gradient(135deg,#059669,#10b981)"
												: "linear-gradient(135deg,#2563eb,#3b82f6)",
									}}
								>
									Export {dispatchExportFormat}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{customChallanOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5700 }}
						onClick={() => {
							if (!customChallanLoading) {
								setCustomChallanOpen(false);
							}
						}}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 860,
								maxHeight: "90vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#8b5cf6")}>
										🧾
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Custom Challan
										</Box>

										<Box sx={modalSubtitleSx}>
											Customer Care / Site / Assembly / Other Movement
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									disabled={customChallanLoading}
									onClick={() => setCustomChallanOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box sx={{ ...modalScrollBodySx, maxHeight: "64vh" }}>
									<Box
										sx={{
											display: "grid",
											gridTemplateColumns: "1fr 1fr",
											gap: 2,
											mb: 2,
										}}
									>
										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Challan Type
											</Box>

											<Box
												component="select"
												value={customChallanForm.challanType}
												onChange={(e) =>
													updateCustomChallanField("challanType", e.target.value)
												}
												sx={dispatchTripNativeSelectSx}
											>
												<option value="CUSTOMER_CARE">
													Customer Care
												</option>

												<option value="HARDWARE_SITE_REQUIREMENT">
													Hardware / Site Requirement
												</option>

												<option value="ASSEMBLY_SITE_REQUIREMENT">
													Assembly / Site Requirement
												</option>

												<option value="OTHER">
													Other Movement
												</option>
											</Box>
										</Box>

										<TextField
											label="Movement Mode"
											value="Direct Dispatch"
											disabled
											sx={formFieldSx}
										/>
										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Challan Date & Time
											</Box>

											<TextField
												fullWidth
												type="datetime-local"
												value={customChallanForm.dispatchTime}
												onChange={(e) =>
													updateCustomChallanField("dispatchTime", e.target.value)
												}
												sx={dateTimeFieldSx}
											/>
										</Box>
										<TextField
											label="From Location"
											placeholder="Dispatch / Customer Care / Store"
											value={customChallanForm.fromLocation}
											onChange={(e) =>
												updateCustomChallanField("fromLocation", e.target.value)
											}
											sx={formFieldSx}
										/>

										<TextField
											label="To Location / Site"
											placeholder="Site / Customer / Assembly Area"
											value={customChallanForm.toLocation}
											onChange={(e) =>
												updateCustomChallanField("toLocation", e.target.value)
											}
											sx={formFieldSx}
										/>

										<TextField
											label="PD No."
											value={customChallanForm.pdNo}
											onChange={(e) =>
												updateCustomChallanField("pdNo", e.target.value)
											}
											sx={formFieldSx}
										/>

										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Driver Name
											</Box>

											<Box
												component="select"
												value={customChallanForm.driverName}
												onChange={(e) =>
													updateCustomChallanField("driverName", e.target.value)
												}
												sx={dispatchTripNativeSelectSx}
											>
												<option value="">
													Select Driver
												</option>

												{logisticsDrivers.map((driver) => (
													<option
														key={driver.id || driver.name}
														value={driver.name}
													>
														{driver.name}
													</option>
												))}
											</Box>
										</Box>

										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Vehicle Number
											</Box>

											<Box
												component="select"
												value={customChallanForm.vehicleNumber}
												onChange={(e) =>
													updateCustomChallanField("vehicleNumber", e.target.value)
												}
												sx={dispatchTripNativeSelectSx}
											>
												<option value="">
													Select Vehicle
												</option>

												{logisticsVehicles.map((vehicle) => (
													<option
														key={vehicle.id || vehicle.vehicleNumber}
														value={vehicle.vehicleNumber}
													>
														{vehicle.vehicleNumber}
													</option>
												))}
											</Box>
										</Box>

										<TextField
											label="Client Name"
											value={customChallanForm.clientName}
											onChange={(e) =>
												updateCustomChallanField("clientName", e.target.value)
											}
											sx={formFieldSx}
										/>

										<TextField
											label="Client Address"
											value={customChallanForm.clientAddress}
											onChange={(e) =>
												updateCustomChallanField("clientAddress", e.target.value)
											}
											sx={formFieldSx}
										/>
									</Box>

									<TextField
										fullWidth
										multiline
										minRows={2}
										label="Purpose / Requirement"
										placeholder="Example: Customer care replacement, assembly hardware required at site, missing hinge/screw/accessory, etc."
										value={customChallanForm.purpose}
										onChange={(e) =>
											updateCustomChallanField("purpose", e.target.value)
										}
										sx={{
											...formFieldSx,
											mb: 2,
										}}
									/>

									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											mb: 1.5,
										}}
									>
										<Box
											sx={{
												color: "#fff",
												fontWeight: 900,
												fontSize: 15,
											}}
										>
											Challan Items
										</Box>

										<Button
											onClick={addCustomChallanItem}
											sx={{
												...modalSecondaryButtonSx,
												color: "#fff",
											}}
										>
											+ Add Item
										</Button>
									</Box>

									{customChallanForm.items.map((item, index) => (
										<Box
											key={index}
											sx={{
												p: 1.6,
												mb: 1.4,
												borderRadius: "14px",
												background: "rgba(255,255,255,.035)",
												border: "1px solid rgba(255,255,255,.07)",
											}}
										>
											<Box
												sx={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													mb: 1.2,
												}}
											>
												<Box
													sx={{
														color: "#93c5fd",
														fontWeight: 900,
														fontSize: 13,
													}}
												>
													Item #{index + 1}
												</Box>

												<Button
													size="small"
													onClick={() => removeCustomChallanItem(index)}
													sx={{
														minWidth: 76,
														height: 30,
														borderRadius: "8px",
														textTransform: "none",
														fontWeight: 800,
														color: "#fca5a5",
														background: "rgba(239,68,68,.10)",
														border: "1px solid rgba(239,68,68,.18)",
													}}
												>
													Remove
												</Button>
											</Box>

											<Box
												sx={{
													display: "grid",
													gridTemplateColumns: "2fr 1fr 90px 120px 170px",
													gap: 1.4,
													mb: 1.4,
												}}
											>
												<TextField
													label="Description"
													value={item.description}
													onChange={(e) =>
														updateCustomChallanItem(
															index,
															"description",
															e.target.value
														)
													}
													sx={formFieldSx}
												/>

												<TextField
													label="Dwg No."
													value={item.drawingNo}
													onChange={(e) =>
														updateCustomChallanItem(
															index,
															"drawingNo",
															e.target.value
														)
													}
													sx={formFieldSx}
												/>

												<TextField
													label="Qty"
													type="number"
													value={item.quantity}
													onChange={(e) =>
														updateCustomChallanItem(
															index,
															"quantity",
															e.target.value
														)
													}
													sx={formFieldSx}
												/>

												<Box>
													<Box sx={dispatchTripFieldLabelSx}>
														UOM
													</Box>

													<Box
														component="select"
														value={item.uom || "PIECES"}
														onChange={(e) =>
															updateCustomChallanItem(
																index,
																"uom",
																e.target.value
															)
														}
														sx={{
															...dispatchTripNativeSelectSx,
															height: 56,
														}}
													>
														{CUSTOM_CHALLAN_UOM_OPTIONS.map((option) => (
															<option
																key={option.value}
																value={option.value}
															>
																{option.label}
															</option>
														))}
													</Box>
												</Box>

												<Box>
													<Box sx={dispatchTripFieldLabelSx}>
														Nature
													</Box>

													<Box
														component="select"
														value={item.returnable ? "RETURNABLE" : "NON_RETURNABLE"}
														onChange={(e) =>
															updateCustomChallanItem(
																index,
																"returnable",
																e.target.value === "RETURNABLE"
															)
														}
														sx={{
															...dispatchTripNativeSelectSx,
															height: 56,
														}}
													>
														<option value="NON_RETURNABLE">
															Non Returnable
														</option>

														<option value="RETURNABLE">
															Returnable
														</option>
													</Box>
												</Box>
											</Box>

											<TextField
												fullWidth
												label="Remarks"
												value={item.remarks}
												onChange={(e) =>
													updateCustomChallanItem(
														index,
														"remarks",
														e.target.value
													)
												}
												sx={formFieldSx}
											/>
										</Box>
									))}
								</Box>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={customChallanLoading}
									onClick={() => setCustomChallanOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={customChallanLoading}
									onClick={submitCustomChallan}
									sx={{
										...premiumButton,
										background:
											"linear-gradient(135deg,#7c3aed,#8b5cf6)",
									}}
								>
									{customChallanLoading
										? "Generating..."
										: "Generate Custom Challan"}
								</Button>
							</Box>
						</Box>
					</Box>
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

							<Box
								sx={{
									...modalContentSx,
									flex: 1,
									minHeight: 0,
									display: "flex",
									flexDirection: "column",
								}}
							>
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
																const res = await authFetch(
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
																const res = await authFetch(
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

											const res = await authFetch(
												`${API_BASE_URL}/api/chalaan/bulk`,
												{
													method: "POST",
													headers: {
														"Content-Type": "application/json",
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
					<div
						style={popupOverlay}
						onClick={() => {
							if (!bulkGatePassGenerating) {
								closeBulkGatePassModal();
							}
						}}
					>
						<div style={popupBox} onClick={(e) => e.stopPropagation()}>
							<h2 style={{ marginBottom: 16 }}>Bulk Gate Pass</h2>

							<Box sx={{ mb: 2 }}>
								<Box sx={dispatchTripFieldLabelSx}>
									Select Warehouse
								</Box>

								<Box
									component="select"
									value={warehouseCode}
									onChange={(e) => setWarehouseCode(e.target.value)}
									sx={dispatchTripNativeSelectSx}
								>
									<option value="">
										Select Warehouse
									</option>

									{WAREHOUSE_OPTIONS.map((warehouse) => (
										<option key={warehouse} value={warehouse}>
											{warehouse}
										</option>
									))}
								</Box>
							</Box>

							<Box sx={{ mb: 2 }}>
								<Box sx={dispatchTripFieldLabelSx}>
									Select From Location
								</Box>

								<Box
									component="select"
									value={fromLocation}
									onChange={(e) => setFromLocation(e.target.value)}
									sx={dispatchTripNativeSelectSx}
								>
									<option value="">
										Select From Location
									</option>

									{FROM_LOCATION_OPTIONS.map((location) => (
										<option key={location} value={location}>
											{location}
										</option>
									))}
								</Box>
							</Box>

							{bulkGatePassPreview?.gatePass && (
								<Box
									sx={{
										mb: 2,
										p: 1.4,
										borderRadius: "12px",
										background: "rgba(16,185,129,.12)",
										border: "1px solid rgba(16,185,129,.24)",
										color: "#6ee7b7",
										fontWeight: 900,
									}}
								>
									Gate Pass Created: {bulkGatePassPreview.gatePass}
								</Box>
							)}

							{bulkGatePassPreview?.url && (
								<iframe
									src={bulkGatePassPreview.url}
									style={{
										width: "100%",
										height: 400,
										border: "none",
										borderRadius: 8,
										marginBottom: 12,
										background: "#fff",
									}}
								/>
							)}

							<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
								<Button
									variant="contained"
									disabled={
										bulkGatePassGenerating ||
										!warehouseCode ||
										!fromLocation ||
										Boolean(bulkGatePassPreview?.gatePass)
									}
									onClick={generateBulkGatePass}
									sx={{
										...premiumButton,
										background: bulkGatePassPreview?.gatePass
											? "rgba(255,255,255,.08)"
											: "linear-gradient(135deg,#059669,#10b981)",
									}}
								>
									{bulkGatePassGenerating
										? "Generating..."
										: bulkGatePassPreview?.gatePass
											? "Generated"
											: "Generate & Preview"}
								</Button>

								{bulkGatePassPreview?.url && (
									<Button
										onClick={() => {
											const a = document.createElement("a");
											a.href = bulkGatePassPreview.url;
											a.download = `GATE_PASS_${bulkGatePassPreview.gatePass}.pdf`;
											document.body.appendChild(a);
											a.click();
											a.remove();
										}}
										sx={modalSecondaryButtonSx}
									>
										Download
									</Button>
								)}

								<Button
									disabled={bulkGatePassGenerating}
									onClick={closeBulkGatePassModal}
									sx={modalSecondaryButtonSx}
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
							if (!gatePassGenerating) {
								closeSingleGatePassModal();
							}
						}}
					>
						<div
							style={popupBox}
							onClick={(e) => e.stopPropagation()}
						>
							<h2 style={{ marginBottom: 10 }}>
								Generate Gate Pass
							</h2>

							<Box
								sx={{
									mb: 2,
									p: 1.4,
									borderRadius: "12px",
									background: "rgba(255,255,255,.035)",
									border: "1px solid rgba(255,255,255,.07)",
								}}
							>
								<Box
									sx={{
										color: "#fff",
										fontWeight: 900,
										fontSize: 14,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
									title={gatePassModal.name || gatePassModal.itemName}
								>
									{gatePassModal.name || gatePassModal.itemName || "—"}
								</Box>

								<Box
									sx={{
										color: "#94a3b8",
										fontSize: 12,
										fontWeight: 700,
										mt: 0.5,
									}}
								>
									Status: {gatePassModal.status || "—"} • Location:{" "}
									{gatePassModal.currentLocationCode || gatePassModal.location || "—"}
								</Box>
							</Box>

							<Box sx={{ mb: 2 }}>
								<Box sx={dispatchTripFieldLabelSx}>
									Select Warehouse
								</Box>

								<Box
									component="select"
									value={warehouseCode}
									onChange={(e) => setWarehouseCode(e.target.value)}
									sx={dispatchTripNativeSelectSx}
								>
									<option value="">
										Select Warehouse
									</option>

									{WAREHOUSE_OPTIONS.map((warehouse) => (
										<option key={warehouse} value={warehouse}>
											{warehouse}
										</option>
									))}
								</Box>
							</Box>

							<Box sx={{ mb: 2 }}>
								<Box sx={dispatchTripFieldLabelSx}>
									Select From Location
								</Box>

								<Box
									component="select"
									value={fromLocation}
									onChange={(e) => setFromLocation(e.target.value)}
									sx={dispatchTripNativeSelectSx}
								>
									<option value="">
										Select From Location
									</option>

									{FROM_LOCATION_OPTIONS.map((location) => (
										<option key={location} value={location}>
											{location}
										</option>
									))}
								</Box>
							</Box>

							{gatePassPreview?.gatePass && (
								<Box
									sx={{
										mb: 2,
										p: 1.4,
										borderRadius: "12px",
										background: "rgba(16,185,129,.12)",
										border: "1px solid rgba(16,185,129,.24)",
										color: "#6ee7b7",
										fontWeight: 900,
									}}
								>
									Gate Pass Created: {gatePassPreview.gatePass}
								</Box>
							)}

							{gatePassPreview?.url && (
								<iframe
									src={gatePassPreview.url}
									style={{
										width: "100%",
										height: "420px",
										border: "none",
										borderRadius: 8,
										marginBottom: 12,
										background: "#fff",
									}}
								/>
							)}

							<Box
								sx={{
									display: "flex",
									gap: 2,
									justifyContent: "flex-end",
									flexWrap: "wrap",
								}}
							>
								<Button
									variant="contained"
									disabled={
										gatePassGenerating ||
										!warehouseCode ||
										!fromLocation ||
										Boolean(gatePassPreview?.gatePass)
									}
									onClick={generateSingleGatePass}
									sx={{
										...premiumButton,
										background: gatePassPreview?.gatePass
											? "rgba(255,255,255,.08)"
											: "linear-gradient(135deg,#059669,#10b981)",
									}}
								>
									{gatePassGenerating
										? "Generating..."
										: gatePassPreview?.gatePass
											? "Generated"
											: "Generate & Preview"}
								</Button>

								{gatePassPreview?.url && (
									<Button
										onClick={() => {
											const a = document.createElement("a");
											a.href = gatePassPreview.url;
											a.download = `GATE_PASS_${gatePassPreview.gatePass}.pdf`;
											document.body.appendChild(a);
											a.click();
											a.remove();
										}}
										sx={modalSecondaryButtonSx}
									>
										Download
									</Button>
								)}

								<Button
									disabled={gatePassGenerating}
									onClick={closeSingleGatePassModal}
									sx={modalSecondaryButtonSx}
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

											const res = await authFetch(
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
												const res = await authFetch(
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
											Generate Dispatch Challan
										</Box>

										<Box sx={modalSubtitleSx}>
											{dispatchTripContext.title || "Select driver name and vehicle number"}
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
										Challan Date & Time
									</Box>

									<TextField
										fullWidth
										type="datetime-local"
										value={dispatchTripForm.dispatchTime}
										onChange={(e) =>
											setDispatchTripForm((prev) => ({
												...prev,
												dispatchTime: e.target.value,
											}))
										}
										sx={dateTimeFieldSx}
									/>
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
										? "Generating Challan..."
										: "Generate Challan"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{challanHistoryOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5900 }}
						onClick={() => setChallanHistoryOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: "min(1180px,94vw)",
								height: "min(90vh,860px)",
								display: "flex",
								flexDirection: "column",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box
								sx={{
									...modalHeaderSx,
									flexShrink: 0,
								}}
							>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#60a5fa")}>
										📄
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Challan History
										</Box>

										<Box sx={modalSubtitleSx}>
											Master item wise challan history. Admin sees all, users see their own only.
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setChallanHistoryOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box
								sx={{
									...modalContentSx,

									flex: 1,
									minHeight: 0,

									display: "flex",
									flexDirection: "column",

									overflow: "hidden",
								}}
							>
								<TextField
									fullWidth
									value={challanHistorySearch}
									onChange={(e) =>
										setChallanHistorySearch(e.target.value)
									}
									placeholder="Search challan, master item, client, PD, drawing, driver, vehicle..."
									sx={{
										...formFieldSx,
										mb: 2,
									}}
								/>

								<Box sx={challanHistoryStatsGridSx}>
									<ChallanHistoryStat
										label="Master Groups"
										value={challanHistoryMasterGroups.length}
										accent="#60a5fa"
									/>

									<ChallanHistoryStat
										label="Dispatch Challans"
										value={challanHistoryRows.length}
										accent="#22c55e"
									/>

									<ChallanHistoryStat
										label="Custom Challans"
										value={customChallanHistoryRows.length}
										accent="#8b5cf6"
									/>

									<ChallanHistoryStat
										label="Total Items"
										value={
											challanHistoryRows.reduce(
												(sum, challan) =>
													sum + Number(challan.totalItems || 0),
												0
											) +
											customChallanHistoryRows.reduce(
												(sum, challan) =>
													sum + Number(challan.totalItems || 0),
												0
											)
										}
										accent="#f59e0b"
									/>
								</Box>

								{challanHistoryLoading && (
									<Box sx={modalEmptyStateSx}>
										Loading challan history…
									</Box>
								)}

								{!challanHistoryLoading && (
									<Box sx={challanHistoryScrollSx}>
										<Box sx={challanHistorySectionHeaderSx}>
											<Box sx={challanHistorySectionTitleSx}>
												Master Item Wise Dispatch Challans
											</Box>

											<ChallanHistoryPager
												pageNo={challanHistoryPageNo}
												totalPages={challanHistoryTotalPages}
												pageSize={challanHistoryPageSize}
												totalRows={challanHistoryMasterGroups.length}
												label="groups"
												pageSizeOptions={[4, 6, 10, 15]}
												onPageChange={setChallanHistoryPageNo}
												onPageSizeChange={setChallanHistoryPageSize}
											/>
										</Box>

										{challanHistoryMasterGroups.length === 0 && (
											<Box sx={modalEmptyStateSx}>
												No dispatch challan history found.
											</Box>
										)}

										{paginatedChallanHistoryMasterGroups.map((group) => (
											<Box
												key={group.key}
												sx={masterChallanCardSx}
											>
												<Box sx={masterChallanHeaderSx}>
													<Box sx={{ minWidth: 0 }}>
														<Box sx={masterChallanTitleSx}>
															{group.itemName}
														</Box>

														<Box sx={masterChallanMetaSx}>
															Client: {group.clientName} • PD: {group.pdNo} • DWG: {group.drawingNo}
														</Box>

														<Box sx={masterChallanMetaSx}>
															{group.clientAddress}
														</Box>
													</Box>

													<Box sx={masterChallanCountSx}>
														<Box sx={masterChallanCountValueSx}>
															{group.challans.length}
														</Box>

														<Box sx={masterChallanCountLabelSx}>
															Challan
														</Box>
													</Box>
												</Box>

												<Box sx={challanRowsWrapSx}>
													{group.challans.map((challan) => (
														<Box
															key={challan.challanNumber}
															sx={challanHistoryRowSx}
														>
															<Box sx={{ minWidth: 0 }}>
																<Box sx={challanHistoryNoSx}>
																	{challan.challanNumber}
																</Box>

																<Box sx={challanHistoryMetaSx}>
																	{challan.items.length} item
																	{challan.items.length === 1 ? "" : "s"} •{" "}
																	{formatLocalDateTimeDisplay(challan.dispatchedAt)}
																</Box>

																<Box sx={challanHistoryMetaSx}>
																	By: {challan.dispatchedBy} • Driver: {challan.driverName} • Vehicle: {challan.vehicleNumber}
																</Box>
															</Box>

															<Box sx={challanHistoryActionsSx}>
																<Chip
																	size="small"
																	label={challan.tripStatus}
																	sx={tripStatusChipSx(
																		challan.tripStatus
																	)}
																/>

																<Button
																	size="small"
																	onClick={() =>
																		previewExistingChallanPdf(
																			challan.challanNumber
																		)
																	}
																	sx={modalSecondaryButtonSx}
																>
																	Preview
																</Button>

																<Button
																	size="small"
																	onClick={() =>
																		downloadExistingChallanPdf(
																			challan.challanNumber
																		)
																	}
																	sx={modalSecondaryButtonSx}
																>
																	Download
																</Button>
															</Box>
														</Box>
													))}
												</Box>
											</Box>
										))}

										<Box
											sx={{
												...challanHistorySectionHeaderSx,
												top: 0,
												mt: 2.2,
											}}
										>
											<Box
												sx={{
													...challanHistorySectionTitleSx,
													color: "#c4b5fd",
												}}
											>
												Custom Challans
											</Box>

											<ChallanHistoryPager
												pageNo={customChallanHistoryPageNo}
												totalPages={customChallanHistoryTotalPages}
												pageSize={customChallanHistoryPageSize}
												totalRows={customChallanHistoryRows.length}
												label="challans"
												pageSizeOptions={[5, 8, 12, 20]}
												onPageChange={setCustomChallanHistoryPageNo}
												onPageSizeChange={setCustomChallanHistoryPageSize}
											/>
										</Box>

										{customChallansLoading && (
											<Box sx={modalEmptyStateSx}>
												Loading custom challans…
											</Box>
										)}

										{!customChallansLoading &&
											customChallanHistoryRows.length === 0 && (
												<Box sx={modalEmptyStateSx}>
													No custom challan history found.
												</Box>
											)}

										{!customChallansLoading &&
											paginatedCustomChallanHistoryRows.map((challan) => (
												<Box
													key={challan.challanNumber}
													sx={customChallanHistoryCardSx}
												>
													<Box sx={{ minWidth: 0 }}>
														<Box sx={challanHistoryNoSx}>
															{challan.challanNumber}
														</Box>

														<Box sx={challanHistoryMetaSx}>
															{challan.challanTypeLabel ||
																challan.challanType ||
																"Custom Challan"}{" "}
															• {challan.totalItems || 0} item
															{Number(challan.totalItems || 0) === 1
																? ""
																: "s"}
														</Box>

														<Box sx={challanHistoryMetaSx}>
															{challan.fromLocation || "—"} →{" "}
															{challan.toLocation || "—"}
														</Box>

														<Box sx={challanHistoryMetaSx}>
															Client: {challan.clientName || "—"} • Driver:{" "}
															{challan.driverName || "—"} • Vehicle:{" "}
															{challan.vehicleNumber || "—"}
														</Box>
														<Box sx={challanHistoryMetaSx}>
															By: {challan.generatedBy || "—"} •{" "}
															{formatLocalDateTimeDisplay(challan.generatedAt)}
														</Box>
													</Box>

													<Box sx={challanHistoryActionsSx}>
														<Button
															size="small"
															onClick={async () => {
																try {
																	const result =
																		await downloadCustomChallan(
																			challan.challanNumber
																		);

																	const url =
																		URL.createObjectURL(result.blob);

																	showChalaanPreview(
																		url,
																		result.challanNo || challan.challanNumber
																	);
																} catch (err) {
																	console.error(err);
																	alert(
																		err.message ||
																		"Custom challan preview failed"
																	);
																}
															}}
															sx={modalSecondaryButtonSx}
														>
															Preview
														</Button>

														<Button
															size="small"
															onClick={async () => {
																try {
																	const result =
																		await downloadCustomChallan(
																			challan.challanNumber
																		);

																	const url =
																		URL.createObjectURL(result.blob);

																	const a =
																		document.createElement("a");

																	a.href = url;
																	a.download = `CUSTOM_CHALLAN_${challan.challanNumber}.pdf`;

																	document.body.appendChild(a);
																	a.click();
																	a.remove();

																	setTimeout(() => {
																		URL.revokeObjectURL(url);
																	}, 10000);
																} catch (err) {
																	console.error(err);
																	alert(
																		err.message ||
																		"Custom challan download failed"
																	);
																}
															}}
															sx={modalSecondaryButtonSx}
														>
															Download
														</Button>
													</Box>
												</Box>
											))}
									</Box>
								)}
							</Box>

							<Box
								sx={{
									...modalFooterSx,
									flexShrink: 0,
								}}
							>
								<Button
									onClick={() => setChallanHistoryOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{chalaanPreview && (
					<Box
						sx={pdfPreviewOverlaySx}
						onClick={closeChalaanPreview}
					>
						<Box
							sx={pdfPreviewModalSx}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={pdfPreviewHeaderSx}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.4,
										minWidth: 0,
									}}
								>
									<Box
										sx={{
											width: 42,
											height: 42,
											borderRadius: "14px",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											background: "rgba(96,165,250,.16)",
											border: "1px solid rgba(96,165,250,.28)",
											fontSize: 20,
										}}
									>
										📄
									</Box>

									<Box sx={{ minWidth: 0 }}>
										<Box
											sx={{
												color: "#fff",
												fontSize: 18,
												fontWeight: 950,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											Challan Preview
										</Box>

										<Box
											sx={{
												color: "rgba(255,255,255,.55)",
												fontSize: 12,
												fontWeight: 700,
												mt: 0.3,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{chalaanPreview.id || "Generated Challan"}
										</Box>
									</Box>
								</Box>

								<IconButton
									onClick={closeChalaanPreview}
									sx={modalCloseButtonSx}
								>
									×
								</IconButton>
							</Box>

							<Box sx={pdfPreviewBodySx}>
								<iframe
									title={`Challan Preview ${chalaanPreview.id || ""}`}
									src={chalaanPreview.url}
									style={{
										width: "100%",
										height: "100%",
										border: "none",
										borderRadius: "14px",
										background: "#fff",
									}}
								/>
							</Box>

							<Box sx={pdfPreviewFooterSx}>
								<Button
									onClick={() => {
										const a = document.createElement("a");

										a.href = chalaanPreview.url;
										a.download = `CHALLAN_${chalaanPreview.id || "PREVIEW"}.pdf`;

										document.body.appendChild(a);
										a.click();
										a.remove();
									}}
									sx={premiumButton}
								>
									Download PDF
								</Button>

								<Button
									onClick={closeChalaanPreview}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}

				{generatedHistoryOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5900 }}
						onClick={() => setGeneratedHistoryOpen(false)}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 980,
								maxHeight: "88vh",
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#a78bfa")}>
										🏷️
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Generated History
										</Box>

										<Box sx={modalSubtitleSx}>
											Sticker, gate pass and dispatch document generation overview
										</Box>
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									onClick={() => setGeneratedHistoryOpen(false)}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<TextField
									fullWidth
									value={historySearch}
									onChange={(e) => setHistorySearch(e.target.value)}
									placeholder="Search generated history..."
									sx={{
										...formFieldSx,
										mb: 2,
									}}
								/>

								<Box sx={historyStatsGridSx}>
									<HistoryMiniStat
										label="Generated Docs"
										value={generatedHistoryRows.length}
										accent="#a78bfa"
									/>

									<HistoryMiniStat
										label="Stickers"
										value={
											generatedHistoryRows.filter(
												(x) => x.type === "Sticker"
											).length
										}
										accent="#f472b6"
									/>

									<HistoryMiniStat
										label="Gate Pass"
										value={
											generatedHistoryRows.filter(
												(x) => x.type === "Gate Pass"
											).length
										}
										accent="#10b981"
									/>

									<HistoryMiniStat
										label="Challans"
										value={
											generatedHistoryRows.filter(
												(x) => x.type === "Dispatch Challan"
											).length
										}
										accent="#60a5fa"
									/>
								</Box>

								{generatedHistoryRows.length === 0 && (
									<Box sx={modalEmptyStateSx}>
										No generated history found.
									</Box>
								)}

								{generatedHistoryRows.length > 0 && (
									<Box sx={premiumHistoryListSx}>
										{generatedHistoryRows.map((doc, index) => (
											<Box
												key={`${doc.type}-${doc.number}-${index}`}
												sx={premiumHistoryRowSx(doc.accent)}
											>
												<Box sx={historyDocIconSx(doc.accent)}>
													{doc.icon}
												</Box>

												<Box sx={{ minWidth: 0 }}>
													<Box sx={historyDocTitleSx}>
														{doc.title}
													</Box>

													<Box sx={historyDocMetaSx}>
														{doc.type} • {doc.number} • {doc.client}
													</Box>

													<Box sx={historyDocDateSx}>
														{formatLocalDateTimeDisplay(doc.time)}
													</Box>
												</Box>

												<Chip
													size="small"
													label={doc.status}
													sx={{
														color: doc.accent,
														background: `${doc.accent}18`,
														border: `1px solid ${doc.accent}33`,
														fontWeight: 900,
													}}
												/>

												{doc.challanNumber && (
													<Button
														size="small"
														onClick={() =>
															previewNormalChallanByNumber(
																doc.challanNumber
															)
														}
														sx={modalSecondaryButtonSx}
													>
														Preview
													</Button>
												)}
											</Box>
										))}
									</Box>
								)}
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									onClick={() => setGeneratedHistoryOpen(false)}
									sx={modalSecondaryButtonSx}
								>
									Close
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				<MasterItemsModal
					open={masterItemsModalOpen}
					onClose={() => setMasterItemsModalOpen(false)}
				/>
			</div>
		</div>
	);
}

function ChallanHistoryStat({
	label,
	value,
	accent,
}) {
	return (
		<Box sx={challanHistoryStatSx(accent)}>
			<Box sx={challanHistoryStatLabelSx}>
				{label}
			</Box>

			<Box sx={challanHistoryStatValueSx}>
				{value}
			</Box>
		</Box>
	);
}

function HistoryMiniStat({
	label,
	value,
	accent,
}) {
	return (
		<Box sx={historyMiniStatSx(accent)}>
			<Box sx={historyMiniLabelSx}>
				{label}
			</Box>

			<Box sx={historyMiniValueSx}>
				{value}
			</Box>
		</Box>
	);
}

function ChallanHistoryPager({
	pageNo,
	totalPages,
	pageSize,
	totalRows,
	label = "records",
	pageSizeOptions = [5, 10, 15],
	onPageChange,
	onPageSizeChange,
}) {
	const safeTotalPages =
		Math.max(1, Number(totalPages || 1));

	const safePageNo =
		Math.min(
			Math.max(1, Number(pageNo || 1)),
			safeTotalPages
		);

	const start =
		totalRows > 0
			? (safePageNo - 1) * pageSize + 1
			: 0;

	const end =
		Math.min(
			safePageNo * pageSize,
			totalRows
		);

	const goToPage = (nextPage) => {
		const cleanPage =
			Math.min(
				Math.max(1, nextPage),
				safeTotalPages
			);

		onPageChange(cleanPage);
	};

	return (
		<Box sx={challanHistoryPagerSx}>
			<Box sx={challanHistoryPagerLeftSx}>
				<Box sx={challanHistoryRangeSx}>
					{start}-{end} of {totalRows} {label}
				</Box>

				<Box
					component="select"
					value={pageSize}
					onChange={(e) =>
						onPageSizeChange(Number(e.target.value))
					}
					sx={challanHistoryNativePageSizeSelectSx}
				>
					{pageSizeOptions.map((size) => (
						<option
							key={size}
							value={size}
						>
							{size}
						</option>
					))}
				</Box>
			</Box>

			<Box sx={challanHistoryPagerRightSx}>
				<Button
					disabled={safePageNo === 1}
					onClick={() => goToPage(1)}
					sx={challanHistoryPageButtonSx}
				>
					First
				</Button>

				<Button
					disabled={safePageNo === 1}
					onClick={() => goToPage(safePageNo - 1)}
					sx={challanHistoryPageButtonSx}
				>
					‹
				</Button>

				<Box sx={challanHistoryPagePillSx}>
					Page {safePageNo} / {safeTotalPages}
				</Box>

				<Button
					disabled={safePageNo === safeTotalPages}
					onClick={() => goToPage(safePageNo + 1)}
					sx={challanHistoryPageButtonSx}
				>
					›
				</Button>

				<Button
					disabled={safePageNo === safeTotalPages}
					onClick={() => goToPage(safeTotalPages)}
					sx={challanHistoryPageButtonSx}
				>
					Last
				</Button>
			</Box>
		</Box>
	);
}

export default DispatchedItemsPage;