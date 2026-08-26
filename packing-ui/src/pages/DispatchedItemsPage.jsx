import {
	lazy,
	Suspense,
	useEffect,
	useState,
	useMemo,
	useRef,
	useDeferredValue,
} from "react";

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
	CircularProgress,
	Popover,
	Drawer,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import { API_BASE_URL } from "../config";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import usePackFlowDataRefresh
	from "../dashboard/hooks/usePackFlowDataRefresh";
import {
	publishPackFlowDataChanged,
} from "../utils/packFlowDataEvents";
import {
	fetchDrivers,
	fetchVehicles,
	createDriver,
	createVehicle,
	createDispatchChallan,
	createCustomChallan,
	fetchCustomChallans,
	fetchCustomChallanDetails,
	updateCustomChallan,
	downloadCustomChallan,
} from "../dashboard/api/logisticsApi";
import { useAuth } from "../auth/AuthContext";

/*
 * Loaded asynchronously to prevent this page from participating in a
 * static import cycle through the inventory modal dependency graph.
 */
const MasterItemsModal = lazy(() =>
	import(
		"../dashboard/components/inventory/MasterItemsModal"
	)
);

const page = {
	minHeight: "100vh",
	colorScheme: "var(--pf-color-scheme)",
	background:
		"linear-gradient(180deg,var(--pf-bg) 0%,color-mix(in srgb,var(--pf-bg) 88%,#3b82f6 12%) 100%)",

	/*
	 * Local semantic colors stay readable in both PackFlow themes.
	 * color-mix blends the accent toward the active theme foreground.
	 */
	"--dispatch-blue-text":
		"color-mix(in srgb,#2563eb 74%,var(--pf-text-strong))",
	"--dispatch-green-text":
		"color-mix(in srgb,#059669 74%,var(--pf-text-strong))",
	"--dispatch-amber-text":
		"color-mix(in srgb,#d97706 76%,var(--pf-text-strong))",
	"--dispatch-red-text":
		"color-mix(in srgb,#dc2626 76%,var(--pf-text-strong))",
	"--dispatch-purple-text":
		"color-mix(in srgb,#7c3aed 74%,var(--pf-text-strong))",
	"--dispatch-cyan-text":
		"color-mix(in srgb,#0891b2 74%,var(--pf-text-strong))",
};

const dispatchGrid =
	"56px 280px 220px 100px 120px 240px 170px 85px 130px 165px 180px 360px";

const dispatchMinWidth = 2206;

/*
 * Frontend-only resizable Dispatch table columns.
 *
 * Existing columns[] renderers remain the source of truth for values,
 * permissions and actions. This configuration controls visual width only.
 */
const DISPATCH_COLUMN_LAYOUT = [
	{ key: "select", label: "", width: 56, min: 52, max: 78 },
	{ key: "item", label: "Item Name", width: 280, min: 230, max: 520 },
	{ key: "sku", label: "SKU", width: 220, min: 170, max: 420 },
	{ key: "pdNo", label: "PD No", width: 100, min: 88, max: 220 },
	{ key: "drawingNo", label: "DWG No", width: 120, min: 96, max: 260 },
	{ key: "description", label: "Description", width: 240, min: 190, max: 520 },
	{ key: "client", label: "Client", width: 170, min: 140, max: 360 },
	{ key: "plant", label: "Plant", width: 85, min: 78, max: 180 },
	{ key: "location", label: "Location", width: 130, min: 110, max: 280 },
	{ key: "dateTime", label: "Date / Time", width: 165, min: 150, max: 320 },
	{ key: "status", label: "Status", width: 180, min: 160, max: 340 },
	{ key: "actions", label: "Actions", width: 360, min: 320, max: 620 },
];

const tableHeader = {
	position: "sticky",
	top: 0,
	zIndex: 30,
	display: "grid",
	gridTemplateColumns: dispatchGrid,
	minWidth: dispatchMinWidth,
	alignItems: "stretch",
	padding: 0,
	background:
		"linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
	color: "var(--pf-text)",
	fontWeight: 950,
	fontSize: 10.5,
	letterSpacing: ".065em",
	textTransform: "uppercase",
	borderBottom: "1px solid var(--pf-border)",
	boxShadow:
		"0 8px 18px rgba(var(--pf-surface-deep-rgb),.07)",
};

const dispatchHeaderCellSx = {
	minWidth: 0,
	minHeight: 48,
	display: "flex",
	alignItems: "center",
	px: 1.35,
	py: 1,
	borderRight: "1px solid var(--pf-border-soft)",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const tableCellWrap = {
	minWidth: 0,
	overflow: "hidden",
	display: "flex",
	alignItems: "center",
	minHeight: 72,
	padding: "10px 12px",
	borderRight: "1px solid var(--pf-border-soft)",
};

const tableBody = {
	display: "flex",
	flexDirection: "column",
};

const tableRow = {
	display: "grid",
	gridTemplateColumns: dispatchGrid,
	minWidth: dispatchMinWidth,
	alignItems: "stretch",
	padding: 0,
	color: "var(--pf-text-strong)",
	borderBottom: "1px solid var(--pf-border-soft)",
	minHeight: 72,
	fontSize: 13,
	background: "var(--pf-surface)",
	transition:
		"background .15s ease, border-color .15s ease, box-shadow .15s ease",
};

const dispatchTableRowSx = (
	hardwareRow = false
) => ({
	...tableRow,
	...(hardwareRow
		? {
			borderLeft: "3px solid #8b5cf6",
			background:
				"linear-gradient(90deg,rgba(139,92,246,.055),var(--pf-surface) 24%)",
		}
		: {}),
	"&:nth-of-type(even)": {
		background: hardwareRow
			? "linear-gradient(90deg,rgba(139,92,246,.065),var(--pf-surface-alt) 24%)"
			: "var(--pf-surface-alt)",
	},
	"&:hover": {
		background: hardwareRow
			? "linear-gradient(90deg,rgba(139,92,246,.095),rgba(59,130,246,.045))"
			: "rgba(59,130,246,.052)",
		borderBottomColor: "rgba(59,130,246,.18)",
		boxShadow: "inset 0 0 0 1px rgba(59,130,246,.055)",
	},
	"&:focus-within": {
		background: "rgba(59,130,246,.065)",
	},
});

const dispatchSelectCellSx = (
	hardwareRow = false,
	header = false
) => ({
	minWidth: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	position: "sticky",
	left: 0,
	zIndex: header ? 44 : 10,
	minHeight: header ? 48 : 72,
	background: header
		? "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))"
		: hardwareRow
			? "linear-gradient(90deg,rgba(139,92,246,.07),var(--pf-surface))"
			: "var(--pf-surface)",
	borderRight: "1px solid var(--pf-border)",
	boxShadow: "6px 0 16px rgba(var(--pf-surface-deep-rgb),.055)",
});

/*
 * Keep the item identity visible while horizontally scrolling the register.
 * The offset follows the user-resizable checkbox column.
 */
const dispatchIdentityCellSx = (
	hardwareRow = false,
	leftOffset = 56,
	header = false
) => ({
	...tableCellWrap,
	position: "sticky",
	left: `${Math.round(Number(leftOffset) || 56)}px`,
	zIndex: header ? 43 : 9,
	background: header
		? "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))"
		: hardwareRow
			? "linear-gradient(90deg,rgba(139,92,246,.055),var(--pf-surface) 38%)"
			: "var(--pf-surface)",
	borderRight: "1px solid var(--pf-border)",
	boxShadow: "8px 0 18px rgba(var(--pf-surface-deep-rgb),.055)",
});

const dispatchActionCellSx = (
	hardwareRow = false,
	header = false
) => ({
	minWidth: 0,
	display: "flex",
	alignItems: "center",
	position: "sticky",
	right: 0,
	zIndex: header ? 44 : 10,
	minHeight: header ? 48 : 72,
	px: header ? 1.35 : 1,
	py: header ? 1 : 0.8,
	background: header
		? "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))"
		: hardwareRow
			? "linear-gradient(90deg,var(--pf-surface),rgba(139,92,246,.045))"
			: "var(--pf-surface)",
	borderLeft: "1px solid var(--pf-border)",
	boxShadow: "-8px 0 18px rgba(var(--pf-surface-deep-rgb),.06)",
});

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
	borderRadius: "10px",
	outline: "none",
	color: "var(--pf-text-strong)",
	fontWeight: 900,
	background: "var(--pf-surface-alt)",
	border: "1px solid rgba(var(--pf-fg-rgb),.09)",
	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.12)",
	},
	"& option": {
		color: "var(--pf-text-strong)",
		background: "var(--pf-surface)",
		fontWeight: 800,
	},
};

const dispatchTripNativeSelectSx = {
	width: "100%",
	height: 46,
	px: 1.5,
	borderRadius: "10px",
	outline: "none",
	color: "var(--pf-text-strong)",
	fontWeight: 800,
	background: "var(--pf-surface-alt)",
	border: "1px solid rgba(var(--pf-fg-rgb),.09)",
	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.12)",
	},
	"& option": {
		color: "var(--pf-text-strong)",
		background: "var(--pf-surface)",
		fontWeight: 800,
	},
};

const dispatchTripFieldLabelSx = {
	color: "var(--pf-text-muted)",
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
	minWidth: 96,
	height: 32,
	borderRadius: 9,
	fontWeight: 850,
	fontSize: 10.5,
	textTransform: "none",
	whiteSpace: "nowrap",
	px: 1.25,
};

/*
 * Normal dispatch challan preview action shown directly on each
 * dispatch-table row once that item belongs to a generated challan.
 * The existing shared PDF preview modal already includes Download PDF,
 * so this adds row-level access without changing the working challan flow.
 */
const rowChallanPdfButtonSx = {
	...tableActionButton,
	minWidth: 112,
	color: "var(--dispatch-blue-text)",
	background: "rgba(59,130,246,.075)",
	border: "1px solid rgba(59,130,246,.22)",
	boxShadow: "0 5px 14px rgba(37,99,235,.07)",

	"& .MuiButton-startIcon": {
		marginRight: "5px",
	},

	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
		borderColor: "rgba(147,197,253,.42)",
		boxShadow: "0 8px 18px rgba(37,99,235,.24)",
	},
};

const simpleCellText = {
	color: "var(--pf-text-strong)",
	fontWeight: 850,
	fontSize: 12.5,
	lineHeight: 1.3,
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

const dispatchImportButtonSx = {
	height: 38,
	px: 2,
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12,
	color: "#ecfeff",
	background:
		"linear-gradient(135deg,rgba(8,145,178,.92),rgba(14,116,144,.9))",
	border: "1px solid rgba(34,211,238,.30)",
	boxShadow: "0 10px 24px rgba(8,145,178,.22)",
	"&:hover": {
		background:
			"linear-gradient(135deg,#0891b2,#0e7490)",
	},
};

const modalSelectMenuProps = {
	disablePortal: true,
	PaperProps: {
		sx: {
			mt: 1,
			borderRadius: "14px",
			background:
				"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
			color: "var(--pf-text-strong)",
			border:
				"1px solid rgba(var(--pf-fg-rgb),.06)",
			zIndex: 8000,

			"& .MuiMenuItem-root": {
				fontSize: 14,
				fontWeight: 700,
				color: "var(--pf-text-strong)",
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
	color: "var(--pf-text-muted)",
	background: "transparent",

	"&:hover": {
		color: "#fff",
		background: "rgba(var(--pf-fg-rgb),.05)",
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
		background: "rgba(var(--pf-fg-rgb),.04)",
		color: "var(--pf-text-strong)",
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
		color: "var(--pf-text-strong)",
		fontWeight: 800,
	},

	"& textarea::placeholder": {
		color: "rgba(var(--pf-fg-rgb),.42)",
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
		"rgba(var(--pf-fg-rgb),.035)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",

	"&:hover": {
		background:
			"rgba(var(--pf-fg-rgb),.055)",
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
			"rgba(var(--pf-fg-rgb),.08)",
		color:
			"rgba(var(--pf-fg-rgb),.35)",
	},
};

const simpleMutedText = {
	color: "var(--pf-text)",
	fontWeight: 750,
	fontSize: 12.25,
	lineHeight: 1.3,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	display: "block",
};

const simpleMonoText = {
	color: "var(--pf-text-strong)",
	fontWeight: 800,
	fontSize: 12.1,
	lineHeight: 1.3,
	fontFamily: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
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
	maxWidth: "100%",
	flex: 1,
	minWidth: 0,
	fontWeight: 900,
	fontSize: 12.5,
};

const tableIconButton = {
	width: 30,
	height: 30,
	borderRadius: "9px",
	flexShrink: 0,
	transition: "all .16s ease",
	border: "1px solid var(--pf-border)",
	background: "var(--pf-surface-raised)",

	"& svg": {
		fontSize: 16,
	},

	"&:hover": {
		transform: "translateY(-1px)",
	},
};

const stickerHistoryButton = {
	...tableIconButton,
	color: "var(--dispatch-blue-text)",
	background: "rgba(59,130,246,.075)",
	boxShadow: "0 4px 12px rgba(37,99,235,.07)",

	"&:hover": {
		...tableIconButton["&:hover"],
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
		boxShadow: "0 7px 18px rgba(37,99,235,.28)",
	},
};

const auditLogButton = {
	...tableIconButton,
	color: "var(--dispatch-amber-text)",
	background: "rgba(249,115,22,.075)",
	boxShadow: "0 4px 12px rgba(249,115,22,.07)",

	"&:hover": {
		...tableIconButton["&:hover"],
		color: "#fff",
		background: "linear-gradient(135deg,#ea580c,#f97316)",
		boxShadow: "0 7px 18px rgba(249,115,22,.24)",
	},
};

const enhancedOverlaySx = {
	position: "fixed",
	inset: 0,
	p: { xs: "10px", sm: "16px" },
	boxSizing: "border-box",

	background: `
    radial-gradient(circle at 20% 10%, rgba(59,130,246,.18), transparent 28%),
    radial-gradient(circle at 80% 90%, rgba(16,185,129,.12), transparent 30%),
    rgba(var(--pf-surface-deep-rgb),.72)
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

	// MUI numeric borderRadius values are theme multipliers (12 => ~96px).
	// Use an explicit pixel radius so modal corners never clip actions.
	borderRadius: "12px",
	maxWidth: "calc(100vw - 20px)",
	boxSizing: "border-box",

	color: "var(--pf-text-strong)",

	background: `
    radial-gradient(circle at top left, rgba(59,130,246,.08), transparent 30%),
    var(--pf-surface)
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
			"linear-gradient(135deg,rgba(var(--pf-fg-rgb),.08),transparent 28%,rgba(var(--pf-fg-rgb),.03))",
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
		"1px solid rgba(var(--pf-fg-rgb),.06)",
};

const packedYellowChip = {
	fontWeight: 800,
	color: "var(--dispatch-amber-text)",
	background: "rgba(245,158,11,.10)",
	border: "1px solid rgba(250,204,21,.24)",
};

const packedGreenChip = {
	fontWeight: 800,
	color: "var(--dispatch-green-text)",
	background: "rgba(34,197,94,.10)",
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
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	boxShadow:
		"0 12px 28px rgba(0,0,0,.25)",
});

const modalTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 22,
	fontWeight: 900,
	lineHeight: 1.1,
};

const modalSubtitleSx = {
	color: "rgba(var(--pf-fg-rgb),.55)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.4,
};

const modalCloseButtonSx = {
	width: 36,
	height: 36,

	borderRadius: "8px",

	color: "var(--pf-text-muted)",

	background:
		"rgba(var(--pf-fg-rgb),.04)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",

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
		background: "rgba(var(--pf-fg-rgb),.03)",
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
	alignItems: "center",
	flexWrap: "wrap",
	gap: 1.2,

	px: 3,
	py: 2,

	borderTop:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
};

const modalSecondaryButtonSx = {
	height: 36,

	px: 2.2,

	borderRadius: "8px",

	textTransform: "none",

	fontWeight: 800,

	color: "var(--pf-text-soft)",

	background:
		"rgba(var(--pf-fg-rgb),.04)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	"&:hover": {
		background:
			"rgba(var(--pf-fg-rgb),.08)",
		color: "var(--pf-text-strong)",
	},
};

const modalEmptyStateSx = {
	p: 3,

	borderRadius: "10px",

	textAlign: "center",

	color: "var(--pf-text-muted)",

	background:
		"rgba(var(--pf-fg-rgb),.03)",

	border:
		"1px dashed rgba(var(--pf-fg-rgb),.12)",

	fontWeight: 700,
};

const customChallanAccent = "#7c3aed";

const customChallanSectionCardSx = (open) => ({
	borderRadius: "14px",
	background: open
		? "linear-gradient(180deg,color-mix(in srgb,var(--pf-surface) 97%,#8b5cf6 3%),var(--pf-surface))"
		: "var(--pf-surface)",
	border: open
		? "1px solid rgba(124,58,237,.18)"
		: "1px solid var(--pf-border-soft)",
	borderLeft: `3px solid ${customChallanAccent}`,
	boxShadow: open
		? "0 10px 26px rgba(var(--pf-shadow-rgb),.07)"
		: "0 5px 16px rgba(var(--pf-shadow-rgb),.04)",
	overflow: "hidden",
	transition:
		"background .18s ease,border-color .18s ease,box-shadow .18s ease",
});

const customChallanHeaderSx = {
	minHeight: 60,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	px: 1.8,
	py: 1.1,
	background:
		"linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
	borderBottom: "1px solid var(--pf-border-soft)",
};

const customChallanLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.3,
	minWidth: 0,
};

const customChallanIconBtnSx = {
	color: "var(--dispatch-purple-text)",
	background: "rgba(124,58,237,.08)",
	border: "1px solid rgba(124,58,237,.16)",
	width: 34,
	height: 34,
	borderRadius: "10px",
	transition: "all .16s ease",

	"&:hover": {
		background: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
		borderColor: "#7c3aed",
		color: "#fff",
		boxShadow: "0 7px 16px rgba(109,40,217,.20)",
	},
};

const customChallanTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 18,
	fontWeight: 950,
	lineHeight: 1.1,
	letterSpacing: "-0.02em",
};

const customChallanSubSx = {
	mt: 0.35,
	color: "var(--pf-text-muted)",
	fontSize: 11,
	fontWeight: 700,
	lineHeight: 1.4,
};

const customChallanRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	flexShrink: 0,
	flexWrap: "wrap",
	justifyContent: "flex-end",
};

const customChallanCountChipSx = {
	height: 23,
	borderRadius: 999,
	background: "rgba(124,58,237,.10)",
	color: "var(--dispatch-purple-text)",
	border: "1px solid rgba(124,58,237,.20)",
	fontWeight: 950,
	fontSize: 10,
};

const customChallanBodySx = {
	background: "var(--pf-surface)",
	p: 1.4,
};

const customChallanSearchPanelSx = {
	mb: 1.35,
	p: 1.35,
	borderRadius: "14px",
	background:
		"linear-gradient(135deg,color-mix(in srgb,var(--pf-surface-raised) 96%,#8b5cf6 4%),var(--pf-surface))",
	border: "1px solid rgba(124,58,237,.16)",
	boxShadow: "0 8px 20px rgba(var(--pf-shadow-rgb),.055)",
};

const customChallanSearchTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.2,
	flexWrap: "wrap",
	mb: 1,
};

const customChallanSearchTitleWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	minWidth: 0,
};

const customChallanSearchIconSx = {
	width: 38,
	height: 38,
	borderRadius: "11px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: 0,
	color: "var(--dispatch-purple-text)",
	background: "rgba(124,58,237,.09)",
	border: "1px solid rgba(124,58,237,.18)",
	boxShadow: "0 7px 16px rgba(109,40,217,.09)",
};

const customChallanSearchTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 12.5,
	fontWeight: 950,
	letterSpacing: ".01em",
};

const customChallanSearchSubSx = {
	mt: 0.25,
	color: "var(--pf-text-muted)",
	fontSize: 9.8,
	fontWeight: 700,
	lineHeight: 1.4,
};

const customChallanSearchFieldSx = {
	"& .MuiOutlinedInput-root": {
		minHeight: 44,
		borderRadius: "11px",
		color: "var(--pf-text-strong)",
		background: "var(--pf-input)",

		"& fieldset": {
			borderColor: "var(--pf-border)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(124,58,237,.34)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#7c3aed",
			boxShadow: "0 0 0 3px rgba(124,58,237,.10)",
		},
	},

	"& input": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
		fontWeight: 800,
	},

	"& input::placeholder": {
		color: "var(--pf-text-muted)",
		opacity: 1,
	},
};

const customChallanSearchMetaRowSx = {
	mt: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	flexWrap: "wrap",
};

const customChallanSearchCoverageSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.65,
	flexWrap: "wrap",
};

const customChallanSearchHintChipSx = {
	height: 22,
	borderRadius: 999,
	color: "var(--pf-text)",
	fontSize: 9,
	fontWeight: 850,
	background: "var(--pf-surface-alt)",
	border: "1px solid var(--pf-border-soft)",
};

const customChallanSearchResultChipSx = {
	height: 24,
	borderRadius: 999,
	color: "var(--dispatch-purple-text)",
	fontSize: 9.5,
	fontWeight: 950,
	background: "rgba(124,58,237,.10)",
	border: "1px solid rgba(124,58,237,.20)",
};


const premiumScrollbarSx = (accent = "#60a5fa") => ({
	scrollbarWidth: "thin",
	scrollbarColor: `${accent} color-mix(in srgb,var(--pf-surface-alt) 90%,transparent)`,

	"&::-webkit-scrollbar": {
		width: 10,
		height: 10,
	},

	"&::-webkit-scrollbar-track": {
		background: "var(--pf-surface-alt)",
		borderRadius: 999,
		border: "1px solid var(--pf-border-soft)",
	},

	"&::-webkit-scrollbar-thumb": {
		background:
			`linear-gradient(180deg,${accent},color-mix(in srgb,${accent} 72%,#ffffff))`,
		borderRadius: 999,
		border: "2px solid var(--pf-surface-alt)",
		boxShadow: `0 0 12px color-mix(in srgb,${accent} 22%,transparent)`,
	},

	"&::-webkit-scrollbar-thumb:hover": {
		background:
			`linear-gradient(180deg,${accent},color-mix(in srgb,${accent} 84%,#ffffff))`,
	},
});

const customChallanListSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.8,

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

	...premiumScrollbarSx("#8b5cf6"),
};

const customChallanPagerWrapSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.2,
	flexWrap: "wrap",

	mb: 1.2,
	p: 1,

	borderRadius: "13px",

	background:
		"linear-gradient(135deg,color-mix(in srgb,var(--pf-surface-alt) 96%,#8b5cf6 4%),var(--pf-surface-alt))",

	border: "1px solid rgba(124,58,237,.14)",

	boxShadow: "0 5px 16px rgba(var(--pf-shadow-rgb),.045)",
};

const dispatchPageSizeNativeSelectSx = {
	width: 86,
	height: 36,

	px: 1,
	borderRadius: "10px",

	outline: "none",

	color: "var(--pf-text-strong)",
	fontSize: 12,
	fontWeight: 900,

	background: "var(--pf-input)",

	border: "1px solid var(--pf-border)",

	boxShadow: "0 4px 12px rgba(var(--pf-shadow-rgb),.04)",

	cursor: "pointer",
	colorScheme: "var(--pf-color-scheme)",

	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.10)",
	},

	"& option": {
		color: "var(--pf-text-strong)",
		background: "var(--pf-surface)",
		fontWeight: 800,
	},
};

const customChallanRowSx = {
	display: "grid",
	gridTemplateColumns: "220px 180px minmax(280px,1fr) 110px 250px",
	alignItems: "center",
	gap: 1.5,
	p: 1.35,
	borderRadius: "11px",
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border-soft)",
	boxShadow: "0 3px 10px rgba(var(--pf-shadow-rgb),.035)",
	transition:
		"background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease",

	"&:hover": {
		background:
			"color-mix(in srgb,var(--pf-surface) 97%,#8b5cf6 3%)",
		borderColor: "rgba(124,58,237,.22)",
		boxShadow: "0 7px 18px rgba(var(--pf-shadow-rgb),.07)",
		transform: "translateY(-1px)",
	},
};

const customChallanModalShellSx = {
	...enhancedModalSx,
	width: "min(1120px, 96vw)",
	height: "min(92vh, 920px)",
	maxHeight: "92vh",
	display: "flex",
	flexDirection: "column",
	borderRadius: "14px",
	background: `
		radial-gradient(circle at 8% 0%, rgba(124,58,237,.08), transparent 30%),
		radial-gradient(circle at 92% 8%, rgba(59,130,246,.06), transparent 30%),
		var(--pf-surface)
	`,
	border: "1px solid rgba(124,58,237,.16)",
	boxShadow: "0 30px 80px rgba(var(--pf-shadow-rgb),.18)",
};

const customChallanHeroHeaderSx = {
	px: 3,
	py: 2.25,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	flexShrink: 0,
	background:
		"linear-gradient(135deg,color-mix(in srgb,var(--pf-surface-raised) 95%,#8b5cf6 5%),var(--pf-surface-alt))",
	borderBottom: "1px solid var(--pf-border-soft)",
};

const customChallanModalBodySx = {
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	p: 3,
	background: "var(--pf-surface)",
	...premiumScrollbarSx("#8b5cf6"),
};

const customFormSectionSx = {
	p: 2.2,
	mb: 2,
	borderRadius: "13px",
	background: "var(--pf-surface-alt)",
	border: "1px solid var(--pf-border-soft)",
	boxShadow: "0 5px 16px rgba(var(--pf-shadow-rgb),.04)",
};

const customFormSectionTitleSx = {
	color: "var(--pf-text-strong)",
	fontWeight: 950,
	fontSize: 14,
	letterSpacing: ".01em",
};

const customFormSectionSubSx = {
	mt: 0.35,
	mb: 2,
	color: "var(--pf-text-muted)",
	fontWeight: 650,
	fontSize: 11,
	lineHeight: 1.45,
};

const customChallanItemCardSx = {
	p: 2,
	borderRadius: "12px",
	background:
		"linear-gradient(135deg,color-mix(in srgb,var(--pf-surface) 97%,#8b5cf6 3%),var(--pf-surface))",
	border: "1px solid rgba(124,58,237,.14)",
	boxShadow: "0 4px 14px rgba(var(--pf-shadow-rgb),.04)",
};

const customItemNumberChipSx = {
	height: 24,
	borderRadius: 999,
	color: "var(--dispatch-purple-text)",
	background: "rgba(124,58,237,.10)",
	border: "1px solid rgba(124,58,237,.20)",
	fontWeight: 900,
	fontSize: 10,
};

const customChallanStickyFooterSx = {
	...modalFooterSx,
	flexShrink: 0,
	alignItems: "center",
	background: "color-mix(in srgb,var(--pf-surface) 97%,transparent)",
	backdropFilter: "blur(18px)",
	borderTop: "1px solid var(--pf-border-soft)",
	boxShadow: "0 -8px 22px rgba(var(--pf-shadow-rgb),.045)",
};

const customChallanEditButtonSx = {
	height: 34,
	px: 1.7,
	minWidth: 108,
	borderRadius: "9px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 900,
	color: "#fff",
	background: "linear-gradient(135deg,#d97706,#f59e0b)",
	border: "1px solid rgba(217,119,6,.30)",
	boxShadow: "0 6px 14px rgba(217,119,6,.16)",

	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#b45309,#d97706)",
		boxShadow: "0 8px 18px rgba(217,119,6,.23)",
	},

	"&.Mui-disabled": {
		color: "var(--pf-text-dim)",
		background: "var(--pf-surface-alt)",
		borderColor: "var(--pf-border-soft)",
		boxShadow: "none",
	},
};

const customChallanViewPdfButtonSx = {
	height: 34,
	px: 1.7,
	minWidth: 100,
	borderRadius: "9px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 900,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	border: "1px solid rgba(37,99,235,.30)",
	boxShadow: "0 6px 14px rgba(37,99,235,.16)",

	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		boxShadow: "0 8px 18px rgba(37,99,235,.24)",
	},
};

const customChallanCreateButtonSx = {
	height: 34,
	px: 1.6,
	borderRadius: "9px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 900,
	color: "#fff",
	background: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
	border: "1px solid rgba(109,40,217,.30)",
	boxShadow: "0 6px 14px rgba(109,40,217,.16)",

	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#5b21b6,#7c3aed)",
		boxShadow: "0 8px 18px rgba(109,40,217,.24)",
	},
};

const customChallanSearchClearButtonSx = {
	minWidth: 0,
	px: 1.15,
	height: 28,
	borderRadius: "8px",
	textTransform: "none",
	color: "var(--dispatch-purple-text)",
	fontSize: 10,
	fontWeight: 900,
	background: "rgba(124,58,237,.08)",
	border: "1px solid rgba(124,58,237,.16)",
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
		borderColor: "#7c3aed",
	},
};

const customChallanRemoveItemButtonSx = {
	minWidth: 0,
	height: 30,
	px: 1.3,
	borderRadius: "8px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 10.5,
	color: "#fff",
	background: "linear-gradient(135deg,#dc2626,#ef4444)",
	border: "1px solid rgba(220,38,38,.28)",
	boxShadow: "0 5px 12px rgba(220,38,38,.14)",
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#b91c1c,#dc2626)",
		boxShadow: "0 7px 16px rgba(220,38,38,.22)",
	},
};

/* =========================================================
 * ADMIN-ONLY CUSTOM CHALLAN INTELLIGENCE / REPORTING
 * ========================================================= */
const customAdminCommandCenterSx = {
	mb: 1.4,
	p: 1.4,
	borderRadius: "14px",
	background:
		"linear-gradient(135deg,color-mix(in srgb,var(--pf-surface-raised) 96%,#8b5cf6 4%),var(--pf-surface))",
	border: "1px solid rgba(124,58,237,.16)",
	boxShadow: "0 8px 20px rgba(var(--pf-shadow-rgb),.055)",
};

const customAdminCommandTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.2,
	flexWrap: "wrap",
};

const customAdminCommandTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 13,
	fontWeight: 950,
	letterSpacing: ".02em",
};

const customAdminCommandSubSx = {
	mt: 0.25,
	color: "var(--pf-text-muted)",
	fontSize: 10.5,
	fontWeight: 700,
	lineHeight: 1.4,
};

const customAdminActionButtonSx = (accent = "#8b5cf6", active = false) => ({
	height: 35,
	px: 1.5,
	borderRadius: "9px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 950,
	color: "#fff",
	background: active
		? `linear-gradient(135deg,color-mix(in srgb,${accent} 88%,#0f172a),${accent})`
		: `linear-gradient(135deg,${accent},color-mix(in srgb,${accent} 78%,#0f172a))`,
	border: `1px solid color-mix(in srgb,${accent} 74%,var(--pf-border))`,
	boxShadow: active
		? `0 8px 18px color-mix(in srgb,${accent} 24%,transparent)`
		: `0 5px 12px color-mix(in srgb,${accent} 14%,transparent)`,
	transition: "transform .15s ease,box-shadow .15s ease,filter .15s ease",

	"&:hover": {
		transform: "translateY(-1px)",
		filter: "brightness(.96)",
		boxShadow:
			`0 9px 20px color-mix(in srgb,${accent} 25%,transparent)`,
	},

	"&.Mui-disabled": {
		opacity: 0.48,
		color: "var(--pf-text-dim)",
		background: "var(--pf-surface-alt)",
		borderColor: "var(--pf-border-soft)",
		boxShadow: "none",
	},
});

const customAdminFilterGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(3,minmax(170px,1fr))",
	},
	gap: 1,
	mt: 1.3,
};

const customAdminFilterFieldSx = {
	"& .MuiOutlinedInput-root": {
		minHeight: 42,
		borderRadius: "10px",
		color: "var(--pf-text-strong)",
		background: "var(--pf-input)",

		"& fieldset": {
			borderColor: "var(--pf-border)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(124,58,237,.30)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#7c3aed",
			boxShadow: "0 0 0 3px rgba(124,58,237,.09)",
		},
	},

	"& .MuiInputLabel-root": {
		color: "var(--pf-text-muted)",
		fontSize: 11.5,
		fontWeight: 800,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "var(--dispatch-purple-text)",
	},

	"& input, & .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontSize: 11.5,
		fontWeight: 800,
	},

	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
	},

	"& input": {
		colorScheme: "var(--pf-color-scheme)",
	},
	"& input::-webkit-calendar-picker-indicator": {
		opacity: 0.78,
	},
};

const customAdminKpiGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
	gap: 1,
	mt: 1.25,
};

const customAdminKpiCardSx = (accent = "#8b5cf6") => ({
	p: 1.3,
	borderRadius: "12px",
	background:
		`linear-gradient(135deg,color-mix(in srgb,var(--pf-surface) 97%,${accent} 3%),var(--pf-surface))`,
	border: "1px solid var(--pf-border-soft)",
	borderTop: `3px solid ${accent}`,
	boxShadow: "0 4px 12px rgba(var(--pf-shadow-rgb),.035)",
	minWidth: 0,
});

const customAdminKpiLabelSx = {
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 950,
	letterSpacing: ".08em",
	textTransform: "uppercase",
};

const customAdminKpiValueSx = {
	mt: 0.45,
	color: "var(--pf-text-strong)",
	fontSize: 23,
	fontWeight: 950,
	lineHeight: 1,
};

const customAdminKpiMetaSx = {
	mt: 0.55,
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 700,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const customAdminInsightPanelSx = {
	mt: 1.25,
	p: 1.4,
	borderRadius: "13px",
	background: "var(--pf-surface-alt)",
	border: "1px solid var(--pf-border-soft)",
	boxShadow: "0 4px 14px rgba(var(--pf-shadow-rgb),.035)",
};

const customAdminInsightGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		md: "repeat(2,minmax(0,1fr))",
		xl: "repeat(3,minmax(0,1fr))",
	},
	gap: 1.2,
};

const customAdminInsightCardSx = {
	p: 1.3,
	borderRadius: "11px",
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border-soft)",
	minWidth: 0,
};

const customAdminInsightTitleSx = {
	color: "var(--dispatch-purple-text)",
	fontSize: 10.5,
	fontWeight: 950,
	letterSpacing: ".06em",
	textTransform: "uppercase",
	mb: 1,
};

const customAdminBarTrackSx = {
	height: 7,
	borderRadius: 999,
	background: "rgba(var(--pf-fg-rgb),.08)",
	overflow: "hidden",
};

const customAdminBarFillSx = (percent, accent = "#8b5cf6") => ({
	height: "100%",
	width: `${Math.max(0, Math.min(100, Number(percent) || 0))}%`,
	borderRadius: 999,
	background:
		`linear-gradient(90deg,${accent},color-mix(in srgb,${accent} 68%,#ffffff))`,
});

const customAdminActivityListSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.85,
	maxHeight: 330,
	overflowY: "auto",
	pr: 0.6,
	...premiumScrollbarSx("#8b5cf6"),
};

const customAdminActivityRowSx = {
	display: "grid",
	gridTemplateColumns: "42px minmax(0,1fr) auto",
	alignItems: "center",
	gap: 1.1,
	p: 1.05,
	borderRadius: "11px",
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border-soft)",
};

const customAdminActivityIconSx = {
	width: 38,
	height: 38,
	borderRadius: "10px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 18,
	color: "var(--dispatch-purple-text)",
	background: "rgba(124,58,237,.09)",
	border: "1px solid rgba(124,58,237,.18)",
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
		"rgba(var(--pf-fg-rgb),.035)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",

	transition: "all .2s ease",

	"&:hover": {
		transform: "translateY(-1px)",
		background:
			"rgba(var(--pf-fg-rgb),.055)",
		borderColor:
			"rgba(59,130,246,.22)",
	},
};

const latestHistoryCardSx = {
	...historyCardSx,

	background:
		"linear-gradient(135deg,rgba(16,185,129,.13),rgba(var(--pf-fg-rgb),.035))",

	border:
		"1px solid rgba(16,185,129,.22)",
};

const historyNumberSx = {
	color: "var(--pf-text-strong)",
	fontSize: 14,
	fontWeight: 900,
};

const historyMetaSx = {
	color: "rgba(var(--pf-fg-rgb),.56)",
	fontSize: 12,
	fontWeight: 600,
	mt: 0.4,
};

const modalMiniButtonSx = {
	width: 34,
	height: 34,

	borderRadius: "8px",

	color: "var(--pf-text-soft)",

	background:
		"rgba(var(--pf-fg-rgb),.04)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

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
		"rgba(var(--pf-fg-rgb),.035)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const modalFilterFieldSx = {
	minWidth: 170,

	"& .MuiOutlinedInput-root": {
		height: 38,
		borderRadius: "8px",
		background: "rgba(var(--pf-fg-rgb),.04)",
		color: "var(--pf-text-strong)",

		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},

	"& .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
		fontWeight: 700,
	},

	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
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
		"rgba(var(--pf-fg-rgb),.035)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",

	transition: "all .2s ease",

	"&:hover": {
		background:
			"rgba(var(--pf-fg-rgb),.055)",
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
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const auditTimeSx = {
	color: "rgba(var(--pf-fg-rgb),.55)",
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
			? "linear-gradient(135deg,rgba(16,185,129,.14),rgba(var(--pf-fg-rgb),.035))"
			: color === "#f59e0b"
				? "linear-gradient(135deg,rgba(245,158,11,.14),rgba(var(--pf-fg-rgb),.035))"
				: "linear-gradient(135deg,rgba(59,130,246,.14),rgba(var(--pf-fg-rgb),.035))",

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
		"1px solid rgba(var(--pf-fg-rgb),.08)",
});

const statusChoiceTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 15,
	fontWeight: 900,
};

const statusChoiceSubtitleSx = {
	color: "rgba(var(--pf-fg-rgb),.58)",
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
		"rgba(var(--pf-fg-rgb),.07)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
};

const readyStatusChip = {
	fontWeight: 700,

	color: "var(--dispatch-blue-text)",

	background:
		"rgba(59,130,246,.10)",

	border:
		"1px solid rgba(59,130,246,.18)",
};

const queuedStatusChip = {
	fontWeight: 700,

	color: "var(--dispatch-amber-text)",

	background:
		"rgba(245,158,11,.10)",

	border:
		"1px solid rgba(245,158,11,.22)",
};

const dispatchedStatusChip = {
	fontWeight: 700,

	color: "var(--dispatch-green-text)",

	background:
		"rgba(34,197,94,.10)",

	border:
		"1px solid rgba(34,197,94,.18)",
};

const pendingStatusChip = {
	fontWeight: 700,

	color: "var(--dispatch-amber-text)",

	background:
		"rgba(251,191,36,.10)",

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
	padding: "clamp(16px,1.6vw,24px)",
	display: "flex",
	flexDirection: "column",
	gap: 14,
	width: "100%",
	boxSizing: "border-box",
};

const headerRow = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 16,
	flexWrap: "wrap",
	padding: "14px 16px",
	borderRadius: 16,
	background:
		"linear-gradient(135deg,var(--pf-surface-raised),color-mix(in srgb,var(--pf-surface) 94%,#3b82f6 6%))",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 8px 22px rgba(var(--pf-surface-deep-rgb),.055)",
};

const logo = {
	color: "var(--pf-text-strong)",
	fontSize: 28,
	fontWeight: 950,
	letterSpacing: "-.025em",
	lineHeight: 1.05,
	marginBottom: 5,
};

const subtitle = {
	color: "var(--pf-text-muted)",
	fontSize: 12.5,
	fontWeight: 650,
	lineHeight: 1.45,
};

const tableWrapper = {
	position: "relative",
	overflowX: "auto",
	overflowY: "visible",
	borderRadius: "14px",
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 10px 26px rgba(var(--pf-surface-deep-rgb),.065)",
	scrollbarWidth: "thin",
	scrollbarColor: "rgba(59,130,246,.58) var(--pf-surface-alt)",
	WebkitOverflowScrolling: "touch",
	overscrollBehaviorX: "contain",
	scrollbarGutter: "stable",
	"&::-webkit-scrollbar": { height: 10 },
	"&::-webkit-scrollbar-track": {
		background: "var(--pf-surface-alt)",
		borderRadius: 999,
	},
	"&::-webkit-scrollbar-thumb": {
		background: "linear-gradient(90deg,rgba(37,99,235,.64),rgba(96,165,250,.88))",
		borderRadius: 999,
		border: "2px solid var(--pf-surface-alt)",
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

	border: "1px solid rgba(var(--pf-fg-rgb),0.35)",

	boxShadow: `
    0 6px 16px rgba(245,158,11,0.3),
    inset 0 1px 0 rgba(var(--pf-fg-rgb),0.5)
  `,
};

const dispatchExportButtonSx = {
	height: 40,
	px: 2,
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 13,
	color: "#fff",
	background:
		"linear-gradient(135deg,#059669,#10b981)",
	border: "1px solid rgba(5,150,105,.32)",
	boxShadow: "0 8px 18px rgba(5,150,105,.20)",
	"&:hover": {
		background:
			"linear-gradient(135deg,#047857,#059669)",
	},
	"&.Mui-disabled": {
		color: "var(--pf-text-dim)",
		background: "var(--pf-surface-alt)",
		borderColor: "rgba(var(--pf-fg-rgb),.07)",
	},
};

const dispatchTripModalShellSx = (
	step
) => ({
	...enhancedModalSx,

	width:
		step === "REVIEW"
			? "min(1480px, 97vw)"
			: 620,

	height:
		step === "REVIEW"
			? "min(92vh, 900px)"
			: "auto",

	maxHeight: "92vh",

	display: "flex",
	flexDirection: "column",

	transition:
		"width 180ms ease, height 180ms ease",
});

const dispatchTripModalContentSx = {
	...modalContentSx,

	flex: 1,
	minHeight: 0,

	display: "flex",
	flexDirection: "column",

	overflow: "hidden",
};

const dispatchTripDetailsScrollSx = {
	minHeight: 0,
	maxHeight: "64vh",

	overflowY: "auto",
	overflowX: "hidden",

	pr: 0.7,

	...premiumScrollbarSx(
		"#60a5fa"
	),
};

const dispatchTripReviewGridSx = {
	flex: 1,
	minHeight: 0,

	display: "grid",

	gridTemplateColumns: {
		xs: "minmax(0,1fr)",
		md:
			"minmax(360px,.78fr) minmax(520px,1.22fr)",
	},

	gap: 2,

	overflow: {
		xs: "auto",
		md: "hidden",
	},

	...premiumScrollbarSx(
		"#60a5fa"
	),
};

const dispatchTripReviewLeftSx = {
	minWidth: 0,
	minHeight: 0,

	overflowY: {
		xs: "visible",
		md: "auto",
	},

	overflowX: "hidden",

	pr: {
		xs: 0,
		md: 1,
	},

	...premiumScrollbarSx(
		"#10b981"
	),
};

const dispatchTripReviewRightSx = {
	minWidth: 0,

	minHeight: {
		xs: 540,
		md: 0,
	},

	display: "flex",
	flexDirection: "column",
};

const dispatchTripReviewPdfCardSx = {
	flex: 1,
	minHeight: 0,

	display: "flex",
	flexDirection: "column",

	borderRadius: "18px",
	overflow: "hidden",

	background:
		"rgba(var(--pf-surface-deep-rgb),.42)",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.08)",

	boxShadow:
		"0 22px 50px rgba(var(--pf-surface-deep-rgb),.32)",
};

const dispatchTripReviewPdfHeaderSx = {
	minHeight: 64,
	flexShrink: 0,

	px: 2,

	display: "flex",
	alignItems: "center",
	justifyContent:
		"space-between",

	gap: 2,

	background:
		"rgba(var(--pf-fg-rgb),.035)",

	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const dispatchTripReviewPdfViewportSx = {
	flex: 1,
	minHeight: 0,

	p: 1,

	background:
		"#334155",
};

const dispatchTripReviewPdfStateSx = {
	flex: 1,
	minHeight: 280,

	p: 3,

	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",

	gap: 1.2,

	textAlign: "center",
};

const exportFormatButtonSx = (active, accent = "#60a5fa") => ({
	flex: 1,
	height: 42,
	borderRadius: "13px",
	textTransform: "none",
	fontWeight: 950,
	color: active ? "#fff" : "var(--pf-text-soft)",
	background: active
		? `linear-gradient(135deg,${accent},rgba(37,99,235,.86))`
		: "rgba(var(--pf-fg-rgb),.04)",
	border: active
		? `1px solid ${accent}66`
		: "1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow: active
		? `0 12px 26px ${accent}22`
		: "none",

	"&:hover": {
		background: active
			? `linear-gradient(135deg,${accent},rgba(37,99,235,.92))`
			: "rgba(var(--pf-fg-rgb),.075)",
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
		background: "rgba(var(--pf-surface-rgb),.96)",
		borderBottom: "1px solid rgba(var(--pf-fg-rgb),.08)",
		whiteSpace: "nowrap",
	},

	"& td": {
		padding: "10px 12px",
		color: "var(--pf-text)",
		fontSize: 12,
		fontWeight: 750,
		borderBottom: "1px solid rgba(var(--pf-fg-rgb),.06)",
		whiteSpace: "nowrap",
		maxWidth: 260,
		overflow: "hidden",
		textOverflow: "ellipsis",
	},

	"& tr:hover td": {
		background: "rgba(var(--pf-fg-rgb),.035)",
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
	padding: "10px 16px",
	background: "var(--pf-surface)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.09)",
	borderRadius: 12,
	boxShadow:
		"0 16px 38px rgba(var(--pf-surface-deep-rgb),.20)",
	color: "var(--pf-text-strong)",
	zIndex: 3000,
};

const actionContainer = {
	display: "flex",
	alignItems: "center",
	gap: 0.6,
	flexWrap: "wrap",
	minWidth: 0,
	width: "100%",

	/* Keep every original action while avoiding the oversized action column. */
	"& .MuiButton-root": {
		minHeight: 30,
		minWidth: 0,
		borderRadius: "9px",
		fontSize: 10,
		lineHeight: 1.05,
		whiteSpace: "nowrap",
		px: 1.15,
	},

	"& .MuiChip-root": {
		flexShrink: 0,
	},
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
	"& .MuiInputLabel-root": {
		color: "var(--pf-text-muted)",
		fontWeight: 750,
	},
	"& .MuiInputLabel-root.Mui-focused": {
		color: "var(--dispatch-blue-text)",
	},
	"& .MuiOutlinedInput-root": {
		borderRadius: "10px",
		background: "var(--pf-input)",
		color: "var(--pf-text-strong)",
		"& fieldset": {
			borderColor: "var(--pf-border)",
		},
		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.36)",
		},
		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow: "0 0 0 3px rgba(59,130,246,.08)",
		},
	},
	"& input, & textarea": {
		color: "var(--pf-text-strong)",
		fontWeight: 750,
	},
	"& input::placeholder, & textarea::placeholder": {
		color: "var(--pf-text-muted)",
		opacity: 1,
	},
};

const dateTimeFieldSx = {
	...formFieldSx,

	"& input": {
		colorScheme: "var(--pf-color-scheme)",
	},
	"& input::-webkit-calendar-picker-indicator": {
		opacity: 0.8,
		cursor: "pointer",
	},
};

const darkModalBox = {
	borderRadius: "12px",
	maxWidth: "calc(100vw - 24px)",
	boxSizing: "border-box",

	position: "relative",

	overflow: "hidden",

	background:
		"var(--pf-surface)",

	color: "var(--pf-text-strong)",

	border:
		"1px solid var(--pf-border)",

	boxShadow:
		"0 35px 90px rgba(0,0,0,.55)",
};

const actionSecondary = {
	borderRadius: 9,

	textTransform: "none",

	fontWeight: 800,

	background:
		"var(--pf-surface-alt)",

	color: "var(--pf-text-strong)",

	border:
		"1px solid var(--pf-border)",

	"&:hover": {
		background:
			"rgba(59,130,246,.09)",
		borderColor: "rgba(59,130,246,.24)",
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
	display: "grid",
	gridTemplateColumns:
		"minmax(300px,1fr) 210px 160px 190px 150px",
	alignItems: "center",
	maxWidth: "100%",
	width: "100%",
	boxSizing: "border-box",
	overflow: "visible",
	columnGap: 9,
	rowGap: 9,
	minHeight: 62,
	padding: "9px 12px",
	borderRadius: 14,
	background: "var(--pf-surface-raised)",
	border: "1px solid var(--pf-border)",
	boxShadow: "0 7px 18px rgba(var(--pf-surface-deep-rgb),.045)",

	/*
	 * At normal desktop widths all controls stay on one compact row.
	 * At narrower/zoomed widths the search gets its own row and the
	 * four filters form a deliberate grid instead of one control
	 * wrapping by itself and stretching the whole panel vertically.
	 */
	"@media (max-width: 1280px)": {
		gridTemplateColumns: "repeat(4,minmax(0,1fr))",
	},

	"@media (max-width: 760px)": {
		gridTemplateColumns: "repeat(2,minmax(0,1fr))",
	},

	"@media (max-width: 480px)": {
		gridTemplateColumns: "minmax(0,1fr)",
	},
};

const dispatchSearchInputWrapSx = {
	minWidth: 0,
	width: "100%",
	height: 44,
	display: "flex",
	alignItems: "center",
	gap: 1,
	px: 1.1,
	borderRadius: "10px",
	background: "var(--pf-input)",
	border: "1px solid var(--pf-border-soft)",
	boxSizing: "border-box",

	"&:focus-within": {
		borderColor: "rgba(59,130,246,.34)",
		boxShadow: "0 0 0 3px rgba(59,130,246,.07)",
	},

	"@media (max-width: 1280px)": {
		gridColumn: "1 / -1",
	},
};

const searchActivitySlotSx = {
	height: 30,
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	flex: "0 0 auto",
};

const searchActivityPillSx = {
	height: 30,
	px: 1.25,
	borderRadius: "999px",
	display: "inline-flex",
	alignItems: "center",
	gap: 0.8,
	color: "var(--dispatch-blue-text)",
	fontSize: 10.5,
	fontWeight: 950,
	letterSpacing: ".02em",
	whiteSpace: "nowrap",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(59,130,246,.20)",
	boxShadow: "0 5px 14px rgba(37,99,235,.08)",
};

const activeSearchPanelSx = {
	borderColor: "rgba(59,130,246,.28)",
	boxShadow:
		"0 0 0 3px rgba(59,130,246,.045)",
	background:
		"linear-gradient(135deg,rgba(37,99,235,.055),rgba(var(--pf-fg-rgb),.02))",
};

const dateFilterButtonSx = (
	active
) => ({
	width: "100%",
	minWidth: 0,
	height: 44,
	px: 1.5,
	borderRadius: "10px",
	textTransform: "none",
	justifyContent: "flex-start",
	color: "var(--pf-text-strong)",
	background: active
		? "rgba(59,130,246,.11)"
		: "var(--pf-surface-alt)",
	border: active
		? "1px solid rgba(59,130,246,.32)"
		: "1px solid rgba(var(--pf-fg-rgb),.08)",
	boxShadow: active
		? "0 8px 18px rgba(37,99,235,.10)"
		: "none",
	"& .MuiButton-startIcon": {
		color: active ? "#2563eb" : "var(--pf-text-muted)",
	},
	"&:hover": {
		background: active
			? "rgba(59,130,246,.15)"
			: "rgba(59,130,246,.055)",
		borderColor: "rgba(59,130,246,.28)",
	},
});

const dateFilterPopoverPaperSx = {
	mt: 1.2,
	width: "min(560px, calc(100vw - 28px))",
	maxHeight: "min(760px, calc(100vh - 28px))",
	borderRadius: "14px",
	overflowX: "hidden",
	overflowY: "auto",
	overscrollBehavior: "contain",
	scrollbarGutter: "stable",
	...premiumScrollbarSx("#60a5fa"),
	color: "var(--pf-text-strong)",
	background:
		"radial-gradient(circle at top left,rgba(59,130,246,.07),transparent 34%),var(--pf-surface)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.09)",
	boxShadow:
		"0 24px 64px rgba(var(--pf-surface-deep-rgb),.24)",
};

const dateFilterPanelSx = {
	p: 2,
};

const dateFilterHeaderSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1.5,
	mb: 1.8,
};

const dateFilterIconSx = {
	width: 42,
	height: 42,
	borderRadius: "14px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: "#bfdbfe",
	background:
		"linear-gradient(135deg,rgba(37,99,235,.34),rgba(59,130,246,.14))",
	border:
		"1px solid rgba(96,165,250,.26)",
	boxShadow:
		"0 12px 24px rgba(37,99,235,.18)",
};

const dateFilterTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 16,
	fontWeight: 950,
};

const dateFilterSubtitleSx = {
	mt: 0.35,
	color: "var(--pf-text-muted)",
	fontSize: 10.5,
	fontWeight: 650,
};

const dateFilterCountChipSx = {
	height: 24,
	color: "#6ee7b7",
	fontSize: 10,
	fontWeight: 950,
	background:
		"rgba(16,185,129,.13)",
	border:
		"1px solid rgba(16,185,129,.24)",
};

const dateModeSectionSx = {
	mb: 1.5,
};

const dateModeSectionLabelSx = {
	mb: 0.8,
	color: "var(--pf-text-muted)",
	fontSize: 10,
	fontWeight: 950,
	letterSpacing: ".10em",
	textTransform: "uppercase",
};

const dateModeGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(2,minmax(0,1fr))",
	gap: 0.9,

	"@media (max-width: 560px)": {
		gridTemplateColumns:
			"minmax(0,1fr)",
	},
};

const dateModeCardSx = (
	active
) => ({
	minWidth: 0,
	minHeight: 72,
	p: 1.15,
	borderRadius: "10px",
	textTransform: "none",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 1,
	textAlign: "left",
	color: "var(--pf-text-strong)",
	background: active
		? "rgba(59,130,246,.10)"
		: "var(--pf-surface-alt)",
	border: active
		? "1px solid rgba(59,130,246,.32)"
		: "1px solid rgba(var(--pf-fg-rgb),.07)",
	boxShadow: active
		? "0 8px 18px rgba(37,99,235,.08)"
		: "none",
	transition:
		"background .16s ease, border-color .16s ease, transform .16s ease",
	"&:hover": {
		transform: "translateY(-1px)",
		background: active
			? "rgba(59,130,246,.14)"
			: "rgba(59,130,246,.05)",
		borderColor: "rgba(59,130,246,.24)",
	},
});

const dateModeCardTextSx = {
	minWidth: 0,
	flex: 1,
};

const dateModeCardTitleSx = {
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 950,
	lineHeight: 1.25,
};

const dateModeCardDescriptionSx = {
	mt: 0.35,
	color: "var(--pf-text-muted)",
	fontSize: 9.5,
	fontWeight: 650,
	lineHeight: 1.35,
};

const dateModeCheckSx = (
	active
) => ({
	width: 20,
	height: 20,
	flexShrink: 0,
	borderRadius: "999px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: active
		? "#fff"
		: "transparent",
	fontSize: 11,
	fontWeight: 950,
	background: active
		? "linear-gradient(135deg,#2563eb,#60a5fa)"
		: "rgba(var(--pf-fg-rgb),.035)",
	border: active
		? "1px solid rgba(147,197,253,.48)"
		: "1px solid rgba(var(--pf-fg-rgb),.10)",
});

const datePresetRowSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(4,minmax(0,1fr))",
	gap: 0.8,
	mb: 1.4,

	"@media (max-width: 520px)": {
		gridTemplateColumns:
			"repeat(2,minmax(0,1fr))",
	},
};

const datePresetButtonSx = {
	minWidth: 0,
	height: 34,
	borderRadius: "9px",
	textTransform: "none",
	color: "#1d4ed8",
	fontSize: 10.5,
	fontWeight: 900,
	background: "rgba(59,130,246,.07)",
	border: "1px solid rgba(59,130,246,.16)",
	"&:hover": {
		color: "#fff",
		background: "#2563eb",
		borderColor: "#2563eb",
	},
};

const dateFilterGridSx = {
	display: "grid",
	gridTemplateColumns:
		"repeat(2,minmax(0,1fr))",
	gap: 1.2,
	mb: 1.2,

	"@media (max-width: 520px)": {
		gridTemplateColumns:
			"minmax(0,1fr)",
	},
};

const dateFilterFieldSx = {
	"& .MuiInputLabel-root": {
		color: "var(--pf-text-muted)",
		fontSize: 12,
		fontWeight: 800,
	},
	"& .MuiInputLabel-root.Mui-focused": { color: "#2563eb" },
	"& .MuiOutlinedInput-root": {
		minHeight: 46,
		borderRadius: "10px",
		color: "var(--pf-text-strong)",
		background: "var(--pf-surface-alt)",
		"& fieldset": {
			borderColor: "rgba(var(--pf-fg-rgb),.09)",
		},
		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.32)",
		},
		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow: "0 0 0 3px rgba(59,130,246,.10)",
		},
	},
	"& input": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
		fontWeight: 850,
		colorScheme: "var(--pf-color-scheme)",
	},
	"& .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontSize: 12,
		fontWeight: 850,
	},
	"& .MuiSvgIcon-root": { color: "var(--pf-text-muted)" },
};

const dateFilterHintSx = {
	display: "flex",
	alignItems: "flex-start",
	gap: 1,
	p: 1.2,
	borderRadius: "13px",
	background:
		"rgba(16,185,129,.075)",
	border:
		"1px solid rgba(16,185,129,.16)",
};

const dateFilterFooterSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	mt: 1.5,
	pt: 1.4,
	borderTop:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const dateFilterClearButtonSx = {
	height: 36,
	borderRadius: "11px",
	textTransform: "none",
	color: "#fca5a5",
	fontWeight: 900,
	background:
		"rgba(239,68,68,.08)",
	border:
		"1px solid rgba(239,68,68,.17)",

	"&:hover": {
		background:
			"rgba(239,68,68,.15)",
	},

	"&.Mui-disabled": {
		opacity: 0.35,
		color: "var(--pf-text-muted)",
	},
};

const dateFilterDoneButtonSx = {
	height: 36,
	px: 2.4,
	borderRadius: "11px",
	textTransform: "none",
	color: "#fff",
	fontWeight: 950,
	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow:
		"0 10px 22px rgba(37,99,235,.25)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const wrap = {
	background: "var(--pf-surface)",
	borderRadius: 16,
	padding: 12,
	border: "1px solid var(--pf-border)",
	boxShadow: "0 10px 24px rgba(var(--pf-surface-deep-rgb),.055)",
};

const dispatchResizableHeaderCellSx = {
	...dispatchHeaderCellSx,
	position: "relative",
	overflow: "visible",
	pr: 2.1,

	"&:hover .dispatch-column-resize-handle": {
		opacity: 1,
	},
};

const dispatchColumnResizeHandleSx = {
	position: "absolute",
	top: 0,
	right: -4,
	width: 9,
	height: "100%",
	zIndex: 60,
	cursor: "col-resize",
	touchAction: "none",
	opacity: 0,
	transition: "opacity .14s ease, background .14s ease",
	background:
		"linear-gradient(90deg,transparent,rgba(96,165,250,.58),transparent)",

	"&::after": {
		content: '""',
		position: "absolute",
		top: "20%",
		bottom: "20%",
		left: "4px",
		width: "1px",
		borderRadius: 999,
		background: "#60a5fa",
		boxShadow: "0 0 10px rgba(96,165,250,.72)",
	},

	"&:hover": {
		opacity: 1,
		background:
			"linear-gradient(90deg,transparent,rgba(96,165,250,.92),transparent)",
	},
};

const dispatchItemDrawerPaperSx = {
	width: "min(760px, 96vw)",
	maxWidth: "96vw",
	color: "var(--pf-text-strong)",
	background:
		"radial-gradient(circle at top right,rgba(59,130,246,.07),transparent 34%),var(--pf-surface)",
	borderLeft: "1px solid var(--pf-border)",
	boxShadow: "-28px 0 80px rgba(var(--pf-surface-deep-rgb),.58)",
};

const dispatchItemDrawerHeaderSx = {
	position: "sticky",
	top: 0,
	zIndex: 4,
	px: 2.5,
	py: 2,
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 2,
	background:
		"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
};

const dispatchItemDrawerBodySx = {
	p: 2.25,
	overflowY: "auto",
	...premiumScrollbarSx("#60a5fa"),
};

const dispatchItemDrawerHeroSx = {
	mb: 1.5,
	p: 1.55,
	borderRadius: "10px",
	background:
		"linear-gradient(135deg,rgba(37,99,235,.08),var(--pf-surface-alt))",
	border: "1px solid rgba(59,130,246,.16)",
	boxShadow: "0 8px 18px rgba(var(--pf-surface-deep-rgb),.08)",
};

const dispatchItemDrawerSectionSx = {
	mb: 1.4,
	p: 1.45,
	borderRadius: "10px",
	background: "var(--pf-surface-alt)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.065)",
};

const dispatchItemDrawerSectionTitleSx = {
	mb: 1,
	color: "#93c5fd",
	fontSize: 10,
	fontWeight: 950,
	letterSpacing: ".11em",
	textTransform: "uppercase",
};

const dispatchItemDrawerGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "1fr",
		sm: "repeat(2,minmax(0,1fr))",
	},
	gap: 0.85,
};

const dispatchItemDrawerFieldSx = {
	minWidth: 0,
	p: 1.05,
	borderRadius: "9px",
	background: "var(--pf-surface)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.06)",
};

const dispatchItemDrawerFieldLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 950,
	letterSpacing: ".07em",
	textTransform: "uppercase",
};

const dispatchItemDrawerFieldValueSx = {
	mt: 0.4,
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 850,
	lineHeight: 1.42,
	wordBreak: "break-word",
};

const dispatchItemDrawerActionPanelSx = {
	p: 1.35,
	borderRadius: "15px",
	background:
		"linear-gradient(135deg,rgba(16,185,129,.08),rgba(var(--pf-fg-rgb),.025))",
	border: "1px solid rgba(16,185,129,.14)",

	"& .MuiButton-root": {
		minHeight: 34,
	},
};

const dispatchDrawerQuickActionSx = {
	height: 34,
	px: 1.35,
	borderRadius: "9px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 900,
	color: "#1d4ed8",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(59,130,246,.18)",
	"&:hover": {
		color: "#fff",
		background: "#2563eb",
		borderColor: "#2563eb",
	},
};

const pdfPreviewOverlaySx = {
	position: "fixed",
	inset: 0,
	zIndex: 2147483000,

	background: `
		radial-gradient(circle at 20% 10%, rgba(59,130,246,.16), transparent 30%),
		radial-gradient(circle at 80% 90%, rgba(16,185,129,.10), transparent 32%),
		rgba(var(--pf-surface-deep-rgb),.82)
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
	borderRadius: "12px",
	overflow: "hidden",
	background: "var(--pf-surface)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.10)",
	boxShadow:
		"0 32px 90px rgba(var(--pf-surface-deep-rgb),.38)",
	color: "var(--pf-text-strong)",
};

const pdfPreviewHeaderSx = {
	height: 64,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2.5,
	borderBottom:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	background: "var(--pf-surface-alt)",
};

const pdfPreviewBodySx = {
	flex: 1,
	p: 1.5,
	minHeight: 0,
	background: "var(--pf-bg)",
};

const pdfPreviewFooterSx = {
	height: 60,
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 1.2,
	px: 2.5,
	borderTop:
		"1px solid rgba(var(--pf-fg-rgb),.08)",
	background: "var(--pf-surface-alt)",
};

const popupOverlay = {
	position: "fixed",
	inset: 0,
	background: "rgba(var(--pf-surface-rgb),0.55)",
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
	p: 1.4,
	mb: 2,
	borderRadius: "14px",
	background:
		"radial-gradient(circle at top left,rgba(59,130,246,.07),transparent 36%),var(--pf-surface)",
	border:
		"1px solid rgba(var(--pf-fg-rgb),.07)",
	boxShadow:
		"0 10px 24px rgba(var(--pf-surface-deep-rgb),.08)",
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
	borderRadius: "10px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 13,
	color: "#1d4ed8",
	background: "rgba(59,130,246,.08)",
	border: "1px solid rgba(59,130,246,.20)",
	boxShadow: "0 7px 16px rgba(37,99,235,.08)",
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
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
		`radial-gradient(circle at top right, ${accent}22, transparent 46%), rgba(var(--pf-fg-rgb),.035)`,
	border: `1px solid ${accent}33`,
});

const challanHistoryStatLabelSx = {
	color: "rgba(var(--pf-fg-rgb),.54)",
	fontSize: 10,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const challanHistoryStatValueSx = {
	mt: 0.6,
	color: "var(--pf-text-strong)",
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
		"linear-gradient(180deg,rgba(var(--pf-surface-rgb),.96),rgba(var(--pf-surface-rgb),.80))",

	border:
		"1px solid rgba(var(--pf-fg-rgb),.075)",

	backdropFilter: "blur(18px)",
	WebkitBackdropFilter: "blur(18px)",

	boxShadow:
		"0 12px 28px rgba(var(--pf-surface-deep-rgb),.28)",
};

const challanHistoryPagerSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	flexWrap: "wrap",
	p: 0.75,
	borderRadius: "11px",
	maxWidth: "100%",
	background: "var(--pf-surface)",
	border: "1px solid var(--pf-border-soft)",
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
	color: "var(--pf-text-muted)",
	fontSize: 10.5,
	fontWeight: 850,
	whiteSpace: "nowrap",
};

const challanHistoryPagePillSx = {
	height: 32,
	px: 1.4,
	display: "flex",
	alignItems: "center",
	borderRadius: "9px",
	color: "var(--dispatch-blue-text)",
	fontSize: 10.5,
	fontWeight: 950,
	background: "rgba(37,99,235,.08)",
	border: "1px solid rgba(37,99,235,.16)",
};

const challanHistoryNativePageSizeSelectSx = {
	width: 78,
	height: 32,
	px: 1,
	borderRadius: "9px",
	outline: "none",
	color: "var(--pf-text-strong)",
	fontSize: 10.5,
	fontWeight: 950,
	background: "var(--pf-input)",
	border: "1px solid var(--pf-border)",
	cursor: "pointer",
	colorScheme: "var(--pf-color-scheme)",
	"&:focus": {
		borderColor: "#3b82f6",
		boxShadow: "0 0 0 3px rgba(59,130,246,.10)",
	},
	"& option": {
		color: "var(--pf-text-strong)",
		background: "var(--pf-surface)",
		fontWeight: 800,
	},
};

const challanHistoryPageButtonSx = {
	minWidth: 34,
	height: 32,
	px: 1.15,
	borderRadius: "9px",
	textTransform: "none",
	color: "var(--dispatch-blue-text)",
	fontSize: 10.5,
	fontWeight: 950,
	background: "var(--pf-surface-alt)",
	border: "1px solid var(--pf-border)",
	boxShadow: "none",

	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#2563eb,#3b82f6)",
		borderColor: "#2563eb",
	},

	"&.Mui-disabled": {
		opacity: 0.62,
		color: "var(--pf-text-dim)",
		background: "var(--pf-surface-alt)",
		borderColor: "var(--pf-border-soft)",
	},
};

const challanHistoryPageSizeFieldSx = {
	width: 86,
	"& .MuiOutlinedInput-root": {
		height: 32,
		borderRadius: "9px",
		background: "var(--pf-input)",
		color: "var(--pf-text-strong)",
		fontSize: 11,
		fontWeight: 900,
		"& fieldset": {
			borderColor: "var(--pf-border)",
		},
		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.28)",
		},
		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
		},
	},
	"& .MuiSelect-select": {
		color: "var(--pf-text-strong)",
		fontWeight: 950,
		fontSize: 11,
	},
	"& .MuiSvgIcon-root": {
		color: "var(--pf-text-muted)",
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
		"radial-gradient(circle at top left, rgba(96,165,250,.13), transparent 38%), rgba(var(--pf-fg-rgb),.035)",
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
	color: "var(--pf-text-strong)",
	fontSize: 15,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const masterChallanMetaSx = {
	mt: 0.4,
	color: "rgba(var(--pf-fg-rgb),.55)",
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
	color: "var(--pf-text-strong)",
	fontSize: 22,
	fontWeight: 950,
	lineHeight: 1,
};

const masterChallanCountLabelSx = {
	mt: 0.4,
	color: "var(--dispatch-blue-text)",
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
	background: "rgba(var(--pf-surface-rgb),.62)",
	border: "1px solid rgba(var(--pf-fg-rgb),.07)",
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
		"radial-gradient(circle at top right, rgba(139,92,246,.15), transparent 42%), rgba(var(--pf-fg-rgb),.035)",
	border: "1px solid rgba(139,92,246,.24)",
};

const challanHistoryNoSx = {
	color: "var(--pf-text-strong)",
	fontFamily: "monospace",
	fontSize: 14,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const challanHistoryMetaSx = {
	mt: 0.4,
	color: "rgba(var(--pf-fg-rgb),.58)",
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
	color: "var(--pf-text-strong)",
	fontSize: 16,
	fontWeight: 950,
	letterSpacing: "-.02em",
};

const dispatchControlSubSx = {
	mt: 0.25,
	color: "rgba(var(--pf-fg-rgb),.54)",
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
	borderRadius: "10px",
	textTransform: "none",
	fontSize: 12,
	fontWeight: 950,
	color: accent,
	background: `${accent}10`,
	border: `1px solid ${accent}2F`,
	boxShadow: "none",
	"&:hover": {
		background: `${accent}18`,
		borderColor: `${accent}48`,
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
		`radial-gradient(circle at top right, ${accent}22, transparent 46%), rgba(var(--pf-fg-rgb),.035)`,
	border: `1px solid ${accent}33`,
});

const historyMiniLabelSx = {
	color: "rgba(var(--pf-fg-rgb),.54)",
	fontSize: 10,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const historyMiniValueSx = {
	mt: 0.6,
	color: "var(--pf-text-strong)",
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
		`linear-gradient(90deg, ${accent}10, rgba(var(--pf-fg-rgb),.030))`,
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
	color: "var(--pf-text-strong)",
	fontSize: 13,
	fontWeight: 950,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const historyDocMetaSx = {
	mt: 0.4,
	color: "rgba(var(--pf-fg-rgb),.58)",
	fontSize: 11,
	fontWeight: 750,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const historyDocDateSx = {
	mt: 0.35,
	color: "rgba(var(--pf-fg-rgb),.42)",
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


/* =========================================================
 * NORMAL DISPATCH CHALLAN — DEEP VIEW / ANALYTICS
 *
 * Additive only. Custom Challan UI/logic remains untouched.
 * ========================================================= */
const normalChallanAnalyticsPanelSx = {
	mb: 1.5,
	p: 1.35,
	borderRadius: "18px",
	background:
		"radial-gradient(circle at top left,rgba(37,99,235,.16),transparent 36%),linear-gradient(135deg,rgba(var(--pf-surface-rgb),.90),rgba(var(--pf-surface-raised-rgb),.58))",
	border: "1px solid rgba(96,165,250,.20)",
	boxShadow: "0 14px 32px rgba(var(--pf-surface-deep-rgb),.22)",
};

const normalChallanAnalyticsTitleSx = {
	color: "var(--dispatch-blue-text)",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".11em",
	textTransform: "uppercase",
	mb: 1,
};

const normalChallanAnalyticsGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))",
	gap: 0.9,
};

const normalChallanMetricCardSx = (accent = "#60a5fa") => ({
	p: 1.15,
	borderRadius: "14px",
	background: `radial-gradient(circle at top right,${accent}20,transparent 50%),rgba(var(--pf-fg-rgb),.025)`,
	border: `1px solid ${accent}2e`,
	minWidth: 0,
});

const normalChallanMetricLabelSx = {
	color: "rgba(var(--pf-fg-rgb),.48)",
	fontSize: 8.8,
	fontWeight: 950,
	letterSpacing: ".07em",
	textTransform: "uppercase",
};

const normalChallanMetricValueSx = {
	mt: 0.45,
	color: "var(--pf-text-strong)",
	fontSize: 21,
	fontWeight: 950,
	lineHeight: 1,
};

const normalChallanMetricMetaSx = {
	mt: 0.45,
	color: "rgba(var(--pf-fg-rgb),.42)",
	fontSize: 8.8,
	fontWeight: 700,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const normalChallanViewModalSx = {
	...enhancedModalSx,
	width: "min(1460px,97vw)",
	height: "min(92vh,920px)",
	maxHeight: "92vh",
	display: "flex",
	flexDirection: "column",
	borderRadius: "12px",
	background:
		"radial-gradient(circle at 8% 0%,rgba(37,99,235,.12),transparent 28%),radial-gradient(circle at 92% 8%,rgba(16,185,129,.08),transparent 28%),linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface))",
	border: "1px solid rgba(96,165,250,.20)",
	boxShadow: "0 44px 130px rgba(0,0,0,.74)",
};

const normalChallanViewBodySx = {
	flex: 1,
	minHeight: 0,
	p: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1.4,
	overflow: "hidden",
};

const normalChallanSummaryGridSx = {
	display: "grid",
	gridTemplateColumns: {
		xs: "repeat(2,minmax(0,1fr))",
		md: "repeat(4,minmax(0,1fr))",
		xl: "repeat(8,minmax(0,1fr))",
	},
	gap: 0.9,
};

const normalChallanInfoCardSx = {
	p: 1.15,
	borderRadius: "14px",
	background: "rgba(var(--pf-fg-rgb),.028)",
	border: "1px solid rgba(var(--pf-fg-rgb),.07)",
	minWidth: 0,
};

const normalChallanInfoLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 8.5,
	fontWeight: 950,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const normalChallanInfoValueSx = {
	mt: 0.45,
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const normalChallanInspectorGridSx = {
	flex: 1,
	minHeight: 0,
	display: "grid",
	gridTemplateColumns: {
		xs: "minmax(0,1fr)",
		lg: "minmax(620px,1.42fr) minmax(360px,.78fr)",
	},
	gap: 1.4,
	overflow: {
		xs: "auto",
		lg: "hidden",
	},
	...premiumScrollbarSx("#60a5fa"),
};

const normalChallanItemsPanelSx = {
	minWidth: 0,
	minHeight: 0,
	display: "flex",
	flexDirection: "column",
	borderRadius: "18px",
	background: "rgba(var(--pf-surface-deep-rgb),.34)",
	border: "1px solid rgba(96,165,250,.14)",
	overflow: "hidden",
};

const normalChallanItemsToolbarSx = {
	p: 1.2,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 1,
	flexWrap: "wrap",
	background: "rgba(var(--pf-fg-rgb),.025)",
	borderBottom: "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const normalChallanItemListSx = {
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	overflowX: "hidden",
	p: 1,
	...premiumScrollbarSx("#60a5fa"),
};

const normalChallanItemRowSx = (selected = false) => ({
	display: "grid",
	gridTemplateColumns: "44px minmax(180px,1.4fr) minmax(110px,.75fr) minmax(110px,.75fr) minmax(105px,.65fr) auto",
	alignItems: "center",
	gap: 1,
	p: 1,
	mb: 0.75,
	borderRadius: "13px",
	cursor: "pointer",
	background: selected
		? "linear-gradient(135deg,rgba(37,99,235,.18),rgba(59,130,246,.07))"
		: "rgba(var(--pf-fg-rgb),.025)",
	border: selected
		? "1px solid rgba(96,165,250,.34)"
		: "1px solid rgba(var(--pf-fg-rgb),.06)",
	transition: "all .16s ease",
	"&:hover": {
		background: selected
			? "linear-gradient(135deg,rgba(37,99,235,.24),rgba(59,130,246,.10))"
			: "rgba(var(--pf-fg-rgb),.05)",
		borderColor: "rgba(96,165,250,.24)",
	},
});

const normalChallanItemIndexSx = {
	width: 34,
	height: 34,
	borderRadius: "11px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: "var(--dispatch-blue-text)",
	fontSize: 10,
	fontWeight: 950,
	background: "rgba(37,99,235,.12)",
	border: "1px solid rgba(96,165,250,.18)",
};

const normalChallanItemPrimarySx = {
	color: "var(--pf-text-strong)",
	fontSize: 11.5,
	fontWeight: 900,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const normalChallanItemSecondarySx = {
	mt: 0.28,
	color: "rgba(var(--pf-fg-rgb),.46)",
	fontSize: 9.5,
	fontWeight: 700,
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const normalChallanDetailPanelSx = {
	minWidth: 0,
	minHeight: 0,
	display: "flex",
	flexDirection: "column",
	borderRadius: "18px",
	background:
		"radial-gradient(circle at top right,rgba(16,185,129,.10),transparent 36%),rgba(var(--pf-surface-deep-rgb),.36)",
	border: "1px solid rgba(16,185,129,.15)",
	overflow: "hidden",
};

const normalChallanDetailScrollSx = {
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	p: 1.4,
	...premiumScrollbarSx("#10b981"),
};

const normalChallanDetailSectionSx = {
	p: 1.25,
	mb: 1,
	borderRadius: "14px",
	background: "rgba(var(--pf-fg-rgb),.026)",
	border: "1px solid rgba(var(--pf-fg-rgb),.06)",
};

const normalChallanDetailSectionTitleSx = {
	mb: 0.9,
	color: "#6ee7b7",
	fontSize: 9.5,
	fontWeight: 950,
	letterSpacing: ".10em",
	textTransform: "uppercase",
};

const normalChallanDetailFieldGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(2,minmax(0,1fr))",
	gap: 0.9,
};

const normalChallanDetailFieldSx = {
	minWidth: 0,
};

const normalChallanDetailFieldLabelSx = {
	color: "var(--pf-text-dim)",
	fontSize: 8.4,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".06em",
};

const normalChallanDetailFieldValueSx = {
	mt: 0.3,
	color: "var(--pf-text)",
	fontSize: 10.5,
	fontWeight: 800,
	wordBreak: "break-word",
};

const normalChallanViewButtonSx = {
	height: 36,
	px: 1.6,
	borderRadius: "10px",
	textTransform: "none",
	fontSize: 10.5,
	fontWeight: 950,
	color: "#bfdbfe",
	background: "linear-gradient(135deg,rgba(37,99,235,.18),rgba(59,130,246,.08))",
	border: "1px solid rgba(96,165,250,.26)",
	"&:hover": {
		color: "#fff",
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
		boxShadow: "0 10px 22px rgba(37,99,235,.22)",
	},
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

const normalizeDispatchItemType = (
	value
) => {
	const clean =
		String(value || "NORMAL")
			.trim()
			.toUpperCase();

	return clean === "HARDWARE"
		? "HARDWARE"
		: "NORMAL";
};

const resolveDispatchItemType = (
	rowOrValue
) => {
	if (
		rowOrValue &&
		typeof rowOrValue === "object"
	) {
		const explicitType =
			rowOrValue.itemType ||
			rowOrValue.packetItemType ||
			rowOrValue.type ||
			"";

		if (
			normalizeDispatchItemType(
				explicitType
			) === "HARDWARE"
		) {
			return "HARDWARE";
		}

		if (
			rowOrValue.hardwarePacket ===
			true
		) {
			return "HARDWARE";
		}

		const sku =
			String(
				rowOrValue.sku || ""
			)
				.trim()
				.toUpperCase();

		/*
		 * Compatibility for hardware rows created before
		 * itemType was stored correctly.
		 */
		if (
			sku.includes("/HW/PKT-") ||
			sku.includes("/HW/")
		) {
			return "HARDWARE";
		}

		return "NORMAL";
	}

	return normalizeDispatchItemType(
		rowOrValue
	);
};

const isHardwareDispatchRow = (
	row
) => {
	return (
		resolveDispatchItemType(
			row
		) === "HARDWARE"
	);
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

	const matches =
		text.match(/"([^"]+)"|'([^']+)'|[^\s,]+/g) || [];

	return matches
		.map((token) =>
			token
				.replace(/^["']|["']$/g, "")
				.trim()
		)
		.map((token) => {

			if (token.includes(":")) {
				return token.split(":").slice(1).join(":").trim();
			}

			return token;
		})
		.filter(Boolean);
};

const rowSmartHaystack = (
	row
) => {
	const itemType =
		resolveDispatchItemType(
			row
		);

	const plantCode =
		normalizeDispatchPlantCode(
			row?.plantCode
		);

	const plantConfig =
		PLANT_LOCATION_MAP[
		plantCode
		] || null;

	const typeSearchTerms =
		itemType === "HARDWARE"
			? [
				"hardware",
				"hardware packet",
				"hardware material",
				"hardware packing",
				"hw packet",
			]
			: [
				"normal",
				"normal packet",
				"production packet",
			];

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
		row.chalaanNumber,
		row.dispatchChallanNumber,

		row.driverName,
		row.vehicleNumber,
		row.vehicleName,

		plantCode,
		plantConfig?.label,
		plantConfig?.searchTerms,

		row.status,
		getSmartStatusText(
			row.status
		),

		itemType,
		...typeSearchTerms,
	];

	const joinedText =
		parts
			.filter(Boolean)
			.join(" ");

	const normalText =
		normalizeSmartSearch(
			joinedText
		);

	const compactText =
		normalizeCompactSearch(
			joinedText
		);

	return {
		normalText,
		compactText,
	};
};

const attachDispatchSearchIndex = (
	row
) => {
	const {
		normalText,
		compactText,
	} = rowSmartHaystack(
		row
	);

	return {
		...row,

		/*
		 * Internal frontend-only properties.
		 * These prevent expensive search-index rebuilding
		 * after every keyboard input.
		 */
		__dispatchSearchNormal:
			normalText,

		__dispatchSearchCompact:
			compactText,
	};
};

const prepareDispatchSearchTokens = (
	searchValue
) => {
	return tokenizeSmartSearch(
		searchValue
	)
		.map((token) => {
			return {
				normal:
					normalizeSmartSearch(
						token
					),

				compact:
					normalizeCompactSearch(
						token
					),
			};
		})
		.filter(
			(token) =>
				token.normal ||
				token.compact
		);
};

const indexedDispatchRowMatches = (
	row,
	preparedTokens
) => {
	if (
		!Array.isArray(
			preparedTokens
		) ||
		preparedTokens.length === 0
	) {
		return true;
	}

	/*
	 * Existing rows from before this update still receive
	 * a safe fallback index.
	 */
	const normalText =
		row?.__dispatchSearchNormal ??
		rowSmartHaystack(row)
			.normalText;

	const compactText =
		row?.__dispatchSearchCompact ??
		rowSmartHaystack(row)
			.compactText;

	return preparedTokens.every(
		(token) => {
			if (
				!token.normal &&
				!token.compact
			) {
				return true;
			}

			return (
				(
					token.normal &&
					normalText.includes(
						token.normal
					)
				) ||
				(
					token.compact &&
					compactText.includes(
						token.compact
					)
				)
			);
		}
	);
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
		value: "OUT_FOR_DELIVERY",
		label: "Out For Delivery",
	},
	{
		value: "DELIVERED",
		label: "Delivered",
	},
	{
		value: "WAREHOUSE_RETURN_REQUESTED",
		label: "Warehouse Return Requested",
	},
	{
		value: "RESTORED",
		label: "Restored",
	},
	{
		value: "AVAILABLE",
		label: "Available",
	},
];

const DISPATCH_STATUS_OPTION_ICONS = {
	ALL: "🌐",
	READY: "🟡",
	READY_TO_STORE: "📦",
	WAREHOUSE_REQUESTED: "🏭",
	IN_WAREHOUSE: "🏢",
	READY_TO_DISPATCH: "🚚",
	LOADED: "🟠",
	DISPATCHED: "✅",
	OUT_FOR_DELIVERY: "🛣️",
	DELIVERED: "📍",
	WAREHOUSE_RETURN_REQUESTED: "↩️",
	RESTORED: "♻️",
	AVAILABLE: "📋",
};

const getDispatchStatusOptionDisplay = (
	option
) => {
	const icon =
		DISPATCH_STATUS_OPTION_ICONS[
		option?.value
		] || "•";

	return `${icon} ${option?.label || "Status"}`;
};

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


const DISPATCH_DATE_FILTER_MODES = [
	{
		value: "ACTIVITY",
		label: "Relevant Activity",
		description:
			"Uses the most meaningful available timestamp for each row.",
	},
	{
		value: "PACKING",
		label: "Packing Date / Time",
		description:
			"Filters only by packing or sticker-generation time.",
	},
	{
		value: "DISPATCH",
		label: "Dispatch Date / Time",
		description:
			"Filters only rows having an actual dispatch timestamp.",
	},
	{
		value: "UPDATED",
		label: "Last Updated",
		description:
			"Filters by the latest row update timestamp.",
	},
];

function parseDispatchDateTime(
	value
) {
	if (!value) {
		return null;
	}

	if (
		value instanceof Date
	) {
		return Number.isNaN(
			value.getTime()
		)
			? null
			: new Date(
				value.getTime()
			);
	}

	const raw =
		String(value)
			.trim()
			.replace(" ", "T");

	if (!raw) {
		return null;
	}

	const hasTimezone =
		/[zZ]$/.test(raw) ||
		/[+-]\d{2}:?\d{2}$/.test(
			raw
		);

	if (hasTimezone) {
		const parsed =
			new Date(raw);

		return Number.isNaN(
			parsed.getTime()
		)
			? null
			: parsed;
	}

	/*
	 * Spring LocalDateTime values must be treated as local
	 * business time instead of being shifted as UTC.
	 */
	const localMatch =
		raw.match(
			/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/
		);

	if (localMatch) {
		const parsed =
			new Date(
				Number(localMatch[1]),
				Number(localMatch[2]) - 1,
				Number(localMatch[3]),
				Number(localMatch[4] || 0),
				Number(localMatch[5] || 0),
				Number(localMatch[6] || 0),
				Number(
					String(
						localMatch[7] || "0"
					).padEnd(3, "0")
				)
			);

		return Number.isNaN(
			parsed.getTime()
		)
			? null
			: parsed;
	}

	const fallback =
		new Date(raw);

	return Number.isNaN(
		fallback.getTime()
	)
		? null
		: fallback;
}

function getDispatchRowDateInfo(
	row,
	mode = "ACTIVITY"
) {
	const cleanMode =
		String(mode || "ACTIVITY")
			.trim()
			.toUpperCase();

	const candidatesByMode = {
		PACKING: [
			["packedAt", "Packed"],
			["packingDate", "Packed"],
			["packedDate", "Packed"],
			[
				"stickerGeneratedAt",
				"Sticker Generated",
			],
			["generatedAt", "Generated"],
			["createdAt", "Created"],
		],

		DISPATCH: [
			[
				"dispatchedAt",
				"Dispatched",
			],
			[
				"tripStartedAt",
				"Trip Started",
			],
		],

		UPDATED: [
			["updatedAt", "Updated"],
			["createdAt", "Created"],
		],
	};

	let candidates;

	if (cleanMode === "ACTIVITY") {
		const status =
			String(
				row?.status || ""
			)
				.trim()
				.toUpperCase();

		if (
			status === "DELIVERED"
		) {
			candidates = [
				[
					"deliveredAt",
					"Delivered",
				],
				[
					"dispatchedAt",
					"Dispatched",
				],
				[
					"tripStartedAt",
					"Trip Started",
				],
				["updatedAt", "Updated"],
				["packedAt", "Packed"],
				["createdAt", "Created"],
			];
		} else if (
			[
				"DISPATCHED",
				"OUT_FOR_DELIVERY",
				"RESTORED",
			].includes(status)
		) {
			candidates = [
				[
					"dispatchedAt",
					"Dispatched",
				],
				[
					"tripStartedAt",
					"Trip Started",
				],
				[
					"deliveredAt",
					"Delivered",
				],
				["updatedAt", "Updated"],
				["packedAt", "Packed"],
				["createdAt", "Created"],
			];
		} else {
			candidates = [
				["packedAt", "Packed"],
				[
					"packingDate",
					"Packed",
				],
				[
					"packedDate",
					"Packed",
				],
				[
					"stickerGeneratedAt",
					"Sticker Generated",
				],
				["updatedAt", "Updated"],
				["createdAt", "Created"],
				["generatedAt", "Generated"],
			];
		}
	} else {
		candidates =
			candidatesByMode[
			cleanMode
			] ||
			candidatesByMode.UPDATED;
	}

	for (
		const [
			field,
			label,
		] of candidates
	) {
		const rawValue =
			row?.[field];

		const date =
			parseDispatchDateTime(
				rawValue
			);

		if (date) {
			return {
				field,
				label,
				rawValue,
				date,
			};
		}
	}

	return {
		field: "",
		label:
			cleanMode === "DISPATCH"
				? "Not Dispatched"
				: "No Date",
		rawValue: null,
		date: null,
	};
}

function formatDispatchTableDateTime(
	value
) {
	const date =
		parseDispatchDateTime(
			value
		);

	if (!date) {
		return "—";
	}

	return new Intl.DateTimeFormat(
		"en-IN",
		{
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}
	).format(date);
}

function toDispatchDateInputValue(
	value
) {
	const date =
		value instanceof Date
			? value
			: parseDispatchDateTime(
				value
			);

	if (!date) {
		return "";
	}

	const pad = (number) =>
		String(number)
			.padStart(2, "0");

	return [
		date.getFullYear(),
		"-",
		pad(
			date.getMonth() + 1
		),
		"-",
		pad(date.getDate()),
	].join("");
}

function getDispatchDateMinutes(
	value
) {
	if (!value) {
		return null;
	}

	const [
		hour,
		minute,
	] =
		String(value)
			.split(":")
			.map(Number);

	if (
		!Number.isFinite(hour) ||
		!Number.isFinite(minute)
	) {
		return null;
	}

	return (
		hour * 60 +
		minute
	);
}

function hasDispatchDateFilter({
	dateFrom,
	dateTo,
	timeFrom,
	timeTo,
}) {
	return Boolean(
		dateFrom ||
		dateTo ||
		timeFrom ||
		timeTo
	);
}

function dispatchRowMatchesDateFilter(
	row,
	{
		mode,
		dateFrom,
		dateTo,
		timeFrom,
		timeTo,
	}
) {
	if (
		!hasDispatchDateFilter({
			dateFrom,
			dateTo,
			timeFrom,
			timeTo,
		})
	) {
		return true;
	}

	const dateInfo =
		getDispatchRowDateInfo(
			row,
			mode
		);

	if (!dateInfo.date) {
		return false;
	}

	const rowDateKey =
		toDispatchDateInputValue(
			dateInfo.date
		);

	if (
		dateFrom &&
		rowDateKey < dateFrom
	) {
		return false;
	}

	if (
		dateTo &&
		rowDateKey > dateTo
	) {
		return false;
	}

	const rowMinutes =
		dateInfo.date.getHours() *
		60 +
		dateInfo.date.getMinutes();

	const fromMinutes =
		getDispatchDateMinutes(
			timeFrom
		);

	const toMinutes =
		getDispatchDateMinutes(
			timeTo
		);

	if (
		fromMinutes !== null &&
		toMinutes !== null &&
		fromMinutes > toMinutes
	) {
		/*
		 * Overnight window, for example 10:00 PM to 06:00 AM.
		 */
		return (
			rowMinutes >=
			fromMinutes ||
			rowMinutes <=
			toMinutes
		);
	}

	if (
		fromMinutes !== null &&
		rowMinutes < fromMinutes
	) {
		return false;
	}

	if (
		toMinutes !== null &&
		rowMinutes > toMinutes
	) {
		return false;
	}

	return true;
}

function getDispatchDateFilterModeLabel(
	mode
) {
	return (
		DISPATCH_DATE_FILTER_MODES
			.find(
				(option) =>
					option.value ===
					mode
			)
			?.label ||
		"Relevant Activity"
	);
}

function getDispatchDateFilterSummary({
	mode,
	dateFrom,
	dateTo,
	timeFrom,
	timeTo,
}) {
	if (
		!hasDispatchDateFilter({
			dateFrom,
			dateTo,
			timeFrom,
			timeTo,
		})
	) {
		return "Date / Time";
	}

	const modeLabel =
		getDispatchDateFilterModeLabel(
			mode
		);

	const dateText =
		dateFrom && dateTo
			? dateFrom === dateTo
				? dateFrom
				: `${dateFrom} → ${dateTo}`
			: dateFrom
				? `From ${dateFrom}`
				: dateTo
					? `Until ${dateTo}`
					: "All Dates";

	const timeText =
		timeFrom || timeTo
			? `${timeFrom || "00:00"} – ${timeTo || "23:59"}`
			: "";

	return [
		modeLabel,
		dateText,
		timeText,
	]
		.filter(Boolean)
		.join(" • ");
}

const CUSTOM_CHALLAN_TYPE_OPTIONS = [
	{
		value: "CUSTOMER_CARE",
		label: "Customer Care",
	},
	{
		value: "HARDWARE_SITE_REQUIREMENT",
		label: "Hardware / Site Requirement",
	},
	{
		value: "ASSEMBLY_SITE_REQUIREMENT",
		label: "Assembly / Site Requirement",
	},
	{
		value: "JOB_WORK",
		label: "Job Work",
	},
	{
		value: "SITE_RETURN",
		label: "Site Return",
	},
	{
		value: "OTHER",
		label: "Other Movement",
	},
];

const isSiteReturnChallanType = (value) => {
	return String(value || "")
		.trim()
		.toUpperCase() === "SITE_RETURN";
};

const getCustomChallanTypeLabel = (value) => {
	const clean = String(value || "")
		.trim()
		.toUpperCase();

	return (
		CUSTOM_CHALLAN_TYPE_OPTIONS.find(
			(option) => option.value === clean
		)?.label || "Other Movement"
	);
};

const CUSTOM_CHALLAN_UOM_OPTIONS = [
	{
		value: "PIECES",
		label: "Pieces",
	},
	{
		value: "SET",
		label: "Set",
	},
	{
		value: "KG",
		label: "Kg",
	},
	{
		value: "GRAM",
		label: "Gram",
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
		value: "MM",
		label: "MM",
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

const normalizeDispatchPlantCode = (
	value
) => {
	const text =
		String(value || "")
			.trim()
			.toUpperCase();

	if (!text) {
		return "";
	}

	/*
	 * Supports values such as:
	 * AL-P1
	 * AL-P1 (AKG)
	 * AL-P1 AKG
	 */
	const exactPlantMatch =
		text.match(
			/\bAL-P\d+\b/
		);

	if (exactPlantMatch) {
		return exactPlantMatch[0];
	}

	return text
		.split(/\s+/)[0]
		.trim();
};

const dispatchPlantMatches = (
	row,
	selectedPlant
) => {
	const cleanSelection =
		String(
			selectedPlant ||
			"ALL"
		)
			.trim()
			.toUpperCase();

	if (
		!cleanSelection ||
		cleanSelection === "ALL"
	) {
		return true;
	}

	const rowPlant =
		normalizeDispatchPlantCode(
			row?.plantCode
		);

	if (
		cleanSelection ===
		"UNASSIGNED"
	) {
		return !rowPlant;
	}

	return (
		rowPlant ===
		cleanSelection
	);
};

const ADMIN_EDIT_API_FIELDS = {
	itemName: "ITEM_NAME",
	packetNumber: "PACKET_NUMBER",
	pdNo: "PD_NO",
	drawingNo: "DRAWING_NO",
	clientName: "CLIENT_NAME",
	clientAddress: "CLIENT_ADDRESS",
	floor: "FLOOR",
	description: "DESCRIPTION",
	weight: "WEIGHT",
	dimensions: "DIMENSIONS",
	remarks: "REMARKS",
	location: "STICKER_LOCATION",
	driver: "DRIVER",
	vehicle: "VEHICLE",
	dispatchDateTime: "DISPATCH_DATE_TIME",
};

const ADMIN_EDIT_TEXT_FIELDS = [
	{
		key: "itemName",
		label: "Item Name",
	},
	{
		key: "packetNumber",
		label: "Packet No.",
	},
	{
		key: "pdNo",
		label: "PD No.",
	},
	{
		key: "drawingNo",
		label: "Drawing No.",
	},
	{
		key: "clientName",
		label: "Client Name",
	},
	{
		key: "clientAddress",
		label: "Client Address",
		multiline: true,
	},
	{
		key: "floor",
		label: "Floor",
	},
	{
		key: "description",
		label: "Description",
		multiline: true,
	},
	{
		key: "weight",
		label: "Weight",
	},
	{
		key: "dimensions",
		label: "Dimensions",
	},
	{
		key: "remarks",
		label: "Remarks",
		multiline: true,
	},
	{
		key: "location",
		label: "Sticker Location",
	},
];


const getAdminEditPacketNumber = (row) => {
	const directValue = String(
		row?.packetNumber ||
		row?.packetNo ||
		row?.pktNo ||
		""
	).trim();

	if (directValue) {
		const directMatch =
			directValue.match(/^(?:Pkt[-\s]*)?(\d+)$/i);

		if (directMatch) {
			return directMatch[1];
		}
	}

	const sku = String(
		row?.sku || ""
	).trim();

	const skuMatch =
		sku.match(/Pkt[-\s]*(\d+)/i);

	return skuMatch
		? skuMatch[1]
		: "";
};

const createEmptyAdminEditForm = () => ({
	itemName: "",
	packetNumber: "",
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

	driverId: "",
	driverName: "",

	vehicleId: "",
	vehicleNumber: "",

	packingDate: "",
	dispatchDateTime: "",
});

const createEmptyAdminEditApplyState = () => ({
	itemName: false,
	packetNumber: false,
	pdNo: false,
	drawingNo: false,
	clientName: false,
	clientAddress: false,
	floor: false,
	description: false,
	weight: false,
	dimensions: false,
	remarks: false,
	location: false,

	driver: false,
	vehicle: false,
	packingDate: false,
	dispatchDateTime: false,
});

const CREATE_NEW_DRIVER_OPTION =
	"__CREATE_NEW_DRIVER__";

const CREATE_NEW_VEHICLE_OPTION =
	"__CREATE_NEW_VEHICLE__";

const MASTER_CREATE_TARGET = {
	DISPATCH_CHALLAN: "DISPATCH_CHALLAN",
	CUSTOM_CHALLAN: "CUSTOM_CHALLAN",
	ADMIN_BULK_EDIT: "ADMIN_BULK_EDIT",
};

const DISPATCH_BACKEND_BATCH_SIZE = 200;

/*
 * Four simultaneous requests means at most approximately
 * 800 dispatch rows are in transit at one time.
 *
 * This is significantly faster than 43 sequential requests,
 * while remaining safe for a Render instance and database pool.
 */

function formatTripDurationMinutes(value) {
	const minutes = Number(value);

	if (!Number.isFinite(minutes) || minutes < 0) {
		return "—";
	}

	const total = Math.round(minutes);
	const days = Math.floor(total / 1440);
	const hours = Math.floor((total % 1440) / 60);
	const mins = total % 60;

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	parts.push(`${mins}m`);

	return parts.join(" ");
}

const DISPATCH_FETCH_CONCURRENCY = 4;

const DISPATCH_BACKEND_MAX_PAGES = 5000;

/*
 * Dispatch register performance policy.
 *
 * Normal browsing is server-paged: only the visible 25/50 rows are loaded.
 * A small LRU page cache plus next-page prefetch keeps navigation instant.
 * Full-history downloads are reserved for explicit operations such as Export
 * or Select All Matching.
 */
const DISPATCH_SERVER_SEARCH_DEBOUNCE_MS = 220;
const DISPATCH_PAGE_CACHE_LIMIT = 18;
const DISPATCH_PAGE_CACHE_FRESH_MS = 15_000;
const DISPATCH_TOTAL_REUSE_FRESH_MS = 30_000;
const CHALLAN_HISTORY_SERVER_PAGE_SIZE = 50;

export default function DispatchedItemsPage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState(["ALL"]);
	const [groupBy, setGroupBy] = useState("NONE");
	const [fromLocation, setFromLocation] = useState("");
	const [
		driverFilter,
		setDriverFilter,
	] = useState("ALL");

	const [
		dateFilterAnchor,
		setDateFilterAnchor,
	] = useState(null);

	const [
		dateFilterMode,
		setDateFilterMode,
	] = useState("ACTIVITY");

	const [
		dateFilterFrom,
		setDateFilterFrom,
	] = useState("");

	const [
		dateFilterTo,
		setDateFilterTo,
	] = useState("");

	const [
		dateFilterTimeFrom,
		setDateFilterTimeFrom,
	] = useState("");

	const [
		dateFilterTimeTo,
		setDateFilterTimeTo,
	] = useState("");

	const authContext =
		useAuth();

	const {
		roles = [],
		hasRole,
		authLoading,
	} = authContext;

	const currentUser =
		authContext?.currentUser ??
		authContext?.user ??
		null;

	const isAdmin =
		hasRole("ADMIN");

	const isDispatch =
		hasRole("DISPATCH");

	const isPacking =
		hasRole("PACKING");

	const isWarehouse =
		hasRole("WAREHOUSE");

	const isLogistics =
		hasRole("LOGISTICS");

	const rolesKey =
		roles.join("|");

	const [historyOpen, setHistoryOpen] = useState(false);
	const [historyItem, setHistoryItem] =
		useState(null);
	const [historyRows, setHistoryRows] = useState([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [auditOpen, setAuditOpen] = useState(false);
	const [auditLoading, setAuditLoading] = useState(false);
	const [auditRows, setAuditRows] = useState([]);
	const [actionFilter, setActionFilter] = useState("ALL");
	const [roleFilter, setRoleFilter] = useState("ALL");

	const [plantFilter, setPlantFilter] =
		useState("ALL");

	const [statusChangeLoading, setStatusChangeLoading] =
		useState(false);

	const [bulkStatusLoading, setBulkStatusLoading] =
		useState(false);
	const [selectionModel, setSelectionModel] = useState([]);
	const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
	const [bulkLoading, setBulkLoading] = useState(false);
	const [bulkReturnDecisionLoading, setBulkReturnDecisionLoading] = useState("");
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
	const [challanHistoryServerPage, setChallanHistoryServerPage] = useState(0);
	const [challanHistoryServerTotal, setChallanHistoryServerTotal] = useState(0);
	const [challanHistoryHasMore, setChallanHistoryHasMore] = useState(false);
	const [challanHistoryLoadingMore, setChallanHistoryLoadingMore] = useState(false);

	/* Normal Dispatch Challan deep inspector — custom challans are untouched. */
	const [normalChallanViewOpen, setNormalChallanViewOpen] = useState(false);
	const [normalChallanViewLoading, setNormalChallanViewLoading] = useState(false);
	const [normalChallanView, setNormalChallanView] = useState(null);
	const [normalChallanItemSearch, setNormalChallanItemSearch] = useState("");
	const [normalChallanItemPageNo, setNormalChallanItemPageNo] = useState(1);
	const [normalChallanItemPageSize, setNormalChallanItemPageSize] = useState(10);
	const [normalChallanSelectedItemId, setNormalChallanSelectedItemId] = useState("");

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

	const [dispatchServerSearch, setDispatchServerSearch] =
		useState("");

	const [
		dispatchSearchNetworkPending,
		setDispatchSearchNetworkPending,
	] = useState(false);

	const [dispatchServerMeta, setDispatchServerMeta] =
		useState({
			totalElements: 0,
			totalPages: 1,
			pageNumber: 0,
			pageSize: 25,
			signature: "",
		});

	const dispatchPageCacheRef = useRef(new Map());
	const dispatchPrefetchAbortRef = useRef(null);
	const dispatchSelectedRowCacheRef = useRef(new Map());
	const dispatchSelectAllScopeRef = useRef({
		signature: "",
		ids: [],
	});
	const [dispatchSelectAllLoading, setDispatchSelectAllLoading] =
		useState(false);

	const [
		dispatchColumnWidths,
		setDispatchColumnWidths,
	] = useState(() =>
		DISPATCH_COLUMN_LAYOUT.map(
			(column) => column.width
		)
	);

	const dispatchColumnResizeRef =
		useRef(null);

	const [
		dispatchItemDrawerRow,
		setDispatchItemDrawerRow,
	] = useState(null);

	const scannerInputRef = useRef(null);
	const scanTimerRef = useRef(null);
	const dispatchFetchRequestRef = useRef(0);
	const dispatchFetchAbortRef = useRef(null);
	const dispatchServerTotalKnownAtRef = useRef(0);
	const [dispatchTripStep, setDispatchTripStep] =
		useState("DETAILS");

	const [dispatchLoadProgress, setDispatchLoadProgress] =
		useState({
			loadedRows: 0,
			totalRows: null,
			loadedPages: 0,
			totalPages: null,
		});
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

	/*
	 * Logistics masters remain lazy-loaded for Dispatch-page performance.
	 *
	 * The loading flag gives challan dropdowns a truthful loading state, while
	 * the promise ref deduplicates simultaneous Driver + Vehicle master loads
	 * when multiple challan entry points are opened quickly.
	 */
	const [
		logisticsMastersLoading,
		setLogisticsMastersLoading,
	] = useState(false);

	const logisticsMastersPromiseRef =
		useRef(null);

	const [createDriverOpen, setCreateDriverOpen] =
		useState(false);

	const [dispatchExportDriverLookup, setDispatchExportDriverLookup] =
		useState(new Map());

	const [createDriverLoading, setCreateDriverLoading] =
		useState(false);

	const [createDriverTarget, setCreateDriverTarget] =
		useState("");

	const [newDriverForm, setNewDriverForm] =
		useState({
			name: "",
		});

	const [createVehicleOpen, setCreateVehicleOpen] =
		useState(false);

	const [createVehicleLoading, setCreateVehicleLoading] =
		useState(false);

	const [createVehicleTarget, setCreateVehicleTarget] =
		useState("");

	const [newVehicleForm, setNewVehicleForm] =
		useState({
			vehicleNumber: "",
			vehicleName: "",
			vehicleType: "Other",
		});

	const [dispatchTripOpen, setDispatchTripOpen] = useState(false);
	const [dispatchTripLoading, setDispatchTripLoading] = useState(false);


	/*
	 * Verified XLSX dispatch reconciliation.
	 *
	 * This is intentionally separate from the existing Dispatch status/challan
	 * workflow. The file is parsed in the browser, then the backend performs the
	 * authoritative Item + PD + DWG matching before anything can be applied.
	 */
	const dispatchImportInputRef = useRef(null);
	const [dispatchImportOpen, setDispatchImportOpen] = useState(false);
	const [dispatchImportLoading, setDispatchImportLoading] = useState(false);
	const [dispatchImportApplying, setDispatchImportApplying] = useState(false);
	const [dispatchImportFileName, setDispatchImportFileName] = useState("");
	const [dispatchImportVerification, setDispatchImportVerification] = useState(null);
	const [dispatchImportSelection, setDispatchImportSelection] = useState([]);
	const [dispatchImportFilter, setDispatchImportFilter] = useState("ALL");
	const [dispatchImportSearch, setDispatchImportSearch] = useState("");
	const [dispatchImportVisibleCount, setDispatchImportVisibleCount] = useState(250);

	const [dispatchTripContext, setDispatchTripContext] = useState({
		mode: "",
		itemIds: [],
		scanTexts: [],
		qrCart: [],
		title: "",
	});

	const [dispatchTripForm, setDispatchTripForm] =
		useState({
			driverId: "",
			vehicleId: "",
			helperLoaderCount: "",
			dispatchTime: "",
		});

	const [customChallanSectionOpen, setCustomChallanSectionOpen] = useState(false);
	const [customChallans, setCustomChallans] = useState([]);
	const [customChallansLoading, setCustomChallansLoading] = useState(false);
	const [customChallansLoadAttempted, setCustomChallansLoadAttempted] = useState(false);

	/*
	 * Custom Challan disclosure performance.
	 *
	 * Keep a lightweight load-state cache and deduplicate overlapping list
	 * requests. The Custom Challan section can be opened/closed rapidly without
	 * creating duplicate network work or coupling the disclosure animation to
	 * the API response time. Existing explicit Refresh/create/edit/history flows
	 * still request fresh data through loadCustomChallans().
	 */
	const customChallansLoadedRef = useRef(false);
	const customChallansLoadPromiseRef = useRef(null);

	const [customChallanPageNo, setCustomChallanPageNo] = useState(1);
	const [customChallanPageSize, setCustomChallanPageSize] = useState(5);

	const [customChallanOpen, setCustomChallanOpen] = useState(false);
	const [customChallanLoading, setCustomChallanLoading] = useState(false);
	const [customChallanMode, setCustomChallanMode] = useState("CREATE");
	const [customChallanEditingNumber, setCustomChallanEditingNumber] = useState("");
	const [customChallanDetailLoading, setCustomChallanDetailLoading] = useState(false);

	const [customChallanSearch, setCustomChallanSearch] = useState("");
	const [customChallanTypeFilter, setCustomChallanTypeFilter] = useState("ALL");
	const [customChallanCreatorFilter, setCustomChallanCreatorFilter] = useState("ALL");
	const [customChallanPeriodFilter, setCustomChallanPeriodFilter] = useState("ALL");
	const [customChallanDateFrom, setCustomChallanDateFrom] = useState("");
	const [customChallanDateTo, setCustomChallanDateTo] = useState("");
	const [customChallanAnalyticsOpen, setCustomChallanAnalyticsOpen] = useState(false);
	const [customChallanActivityOpen, setCustomChallanActivityOpen] = useState(false);
	const [customChallanReportLoading, setCustomChallanReportLoading] = useState(false);

	const isEditingCustomChallan =
		customChallanMode === "EDIT" &&
		Boolean(customChallanEditingNumber);

	const [customChallanForm, setCustomChallanForm] = useState({
		challanType: "CUSTOMER_CARE",
		fromLocation: "",
		toLocation: "",
		pdNo: "",
		driverName: "",
		vehicleNumber: "",
		handedOverTo: "",
		clientName: "",
		clientAddress: "",
		purpose: "",
		movementMode: "DIRECT_DISPATCH",
		dispatchTime: "",
		items: [createEmptyCustomChallanLine()],
	});

	const [
		adminEditOpen,
		setAdminEditOpen,
	] = useState(false);

	const [
		adminEditRows,
		setAdminEditRows,
	] = useState([]);

	const [
		adminEditForm,
		setAdminEditForm,
	] = useState(
		createEmptyAdminEditForm
	);

	const [
		adminEditApply,
		setAdminEditApply,
	] = useState(
		createEmptyAdminEditApplyState
	);

	const [
		adminEditLoading,
		setAdminEditLoading,
	] = useState(false);

	const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);
	const [adminDeleteRows, setAdminDeleteRows] = useState([]);
	const [adminDeletePreview, setAdminDeletePreview] = useState(null);
	const [adminDeletePreviewLoading, setAdminDeletePreviewLoading] = useState(false);
	const [adminDeleteExecuting, setAdminDeleteExecuting] = useState(false);
	const [adminDeleteReason, setAdminDeleteReason] = useState("");
	const [adminDeleteConfirmation, setAdminDeleteConfirmation] = useState("");
	const [adminDeleteError, setAdminDeleteError] = useState("");

	const [dispatchExportOpen, setDispatchExportOpen] =
		useState(false);

	const [dispatchExportStatus, setDispatchExportStatus] =
		useState(["ALL"]);

	const [dispatchExportFormat, setDispatchExportFormat] =
		useState("EXCEL");

	const [dispatchExportLoading, setDispatchExportLoading] =
		useState(false);

	/*
	 * Full export data is loaded only while the Export modal is open.
	 * Normal Dispatch browsing intentionally keeps only one server page in memory.
	 */
	const [dispatchExportSourceRows, setDispatchExportSourceRows] =
		useState(null);

	const [dispatchExportSourceLoading, setDispatchExportSourceLoading] =
		useState(false);

	const [dispatchReviewPdfUrl, setDispatchReviewPdfUrl] =
		useState("");

	const [dispatchReviewPdfLoading, setDispatchReviewPdfLoading] =
		useState(false);

	const [dispatchReviewPdfError, setDispatchReviewPdfError] =
		useState("");

	const [dispatchReviewPdfSignature, setDispatchReviewPdfSignature] =
		useState("");

	const dispatchReviewPdfAbortRef =
		useRef(null);

	const dispatchReviewPdfUrlRef =
		useRef("");

	const getAdminEditCommonValue = (
		targetRows,
		valueGetter
	) => {
		const uniqueValues =
			Array.from(
				new Set(
					(
						Array.isArray(targetRows)
							? targetRows
							: []
					)
						.map((row) =>
							String(
								valueGetter(row) ??
								""
							).trim()
						)
				)
			);

		return uniqueValues.length === 1
			? uniqueValues[0]
			: "";
	};

	const findDriverByName = (
		driverName
	) => {
		const cleanName =
			normalizeDispatchDriverName(
				driverName
			).toLowerCase();

		if (!cleanName) {
			return null;
		}

		return (
			logisticsDrivers.find(
				(driver) =>
					normalizeDispatchDriverName(
						driver?.name
					).toLowerCase() ===
					cleanName
			) || null
		);
	};

	const findVehicleByNumber = (
		vehicleNumber
	) => {
		const cleanNumber =
			normalizeDispatchVehicleNumber(
				vehicleNumber
			);

		if (!cleanNumber) {
			return null;
		}

		return (
			logisticsVehicles.find(
				(vehicle) =>
					normalizeDispatchVehicleNumber(
						vehicle?.vehicleNumber
					) ===
					cleanNumber
			) || null
		);
	};
	/*
	 * Debounce network search while keeping the text field itself immediate.
	 * This prevents one database request for every keystroke.
	 */
	useEffect(() => {
		const timer = window.setTimeout(
			() => {
				setDispatchServerSearch(
					String(search || "").trim()
				);
			},
			DISPATCH_SERVER_SEARCH_DEBOUNCE_MS
		);

		return () => {
			window.clearTimeout(timer);
		};
	}, [search]);

	/*
	 * Visible feedback for both debounce and live server-search phases.
	 * This changes presentation only; the existing query flow is untouched.
	 */
	const dispatchSearchPending =
		Boolean(
			String(search || "").trim()
		) &&
		(
			String(search || "").trim() !==
			String(dispatchServerSearch || "").trim() ||
			dispatchSearchNetworkPending
		);

	const dispatchStatusQuery =
		useMemo(
			() =>
				normalizeStatusSelection(
					statusFilter
				).join(","),
			[statusFilter]
		);

	/*
	 * Keep the Custom Challan search responsive even when Admin has a large
	 * historical register. The typed value updates immediately while the
	 * result calculation can be deferred by React.
	 */
	const deferredCustomChallanSearch =
		useDeferredValue(
			customChallanSearch
		);


	const dateFilterOpen =
		Boolean(
			dateFilterAnchor
		);

	const dateFilterActive =
		hasDispatchDateFilter({
			dateFrom:
				dateFilterFrom,
			dateTo:
				dateFilterTo,
			timeFrom:
				dateFilterTimeFrom,
			timeTo:
				dateFilterTimeTo,
		});

	const dateFilterSummary =
		getDispatchDateFilterSummary({
			mode:
				dateFilterMode,
			dateFrom:
				dateFilterFrom,
			dateTo:
				dateFilterTo,
			timeFrom:
				dateFilterTimeFrom,
			timeTo:
				dateFilterTimeTo,
		});

	const clearDispatchDateFilter =
		() => {
			setDateFilterFrom("");
			setDateFilterTo("");
			setDateFilterTimeFrom("");
			setDateFilterTimeTo("");
			setPageNo(1);
		};

	const applyDispatchDatePreset =
		(preset) => {
			const now =
				new Date();

			const start =
				new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate()
				);

			const end =
				new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate()
				);

			if (
				preset ===
				"YESTERDAY"
			) {
				start.setDate(
					start.getDate() - 1
				);

				end.setDate(
					end.getDate() - 1
				);
			}

			if (
				preset ===
				"LAST_7_DAYS"
			) {
				start.setDate(
					start.getDate() - 6
				);
			}

			if (
				preset ===
				"THIS_MONTH"
			) {
				start.setDate(1);
			}

			setDateFilterFrom(
				toDispatchDateInputValue(
					start
				)
			);

			setDateFilterTo(
				toDispatchDateInputValue(
					end
				)
			);

			setDateFilterTimeFrom("");
			setDateFilterTimeTo("");
			setPageNo(1);
		};

	const dispatchPlantOptions =
		useMemo(() => {
			const optionMap =
				new Map();

			Object.entries(
				PLANT_LOCATION_MAP
			).forEach(
				([
					plantCode,
					config,
				]) => {
					optionMap.set(
						plantCode,
						config.label ||
						plantCode
					);
				}
			);

			let hasUnassignedRows =
				false;

			(rows || []).forEach(
				(row) => {
					const plantCode =
						normalizeDispatchPlantCode(
							row?.plantCode
						);

					if (!plantCode) {
						hasUnassignedRows =
							true;

						return;
					}

					if (
						!optionMap.has(
							plantCode
						)
					) {
						optionMap.set(
							plantCode,
							plantCode
						);
					}
				}
			);

			const options =
				Array.from(
					optionMap.entries()
				)
					.map(
						([
							value,
							label,
						]) => ({
							value,
							label,
						})
					)
					.sort(
						(a, b) =>
							a.value.localeCompare(
								b.value,
								undefined,
								{
									numeric:
										true,
								}
							)
					);

			if (hasUnassignedRows) {
				options.push({
					value:
						"UNASSIGNED",

					label:
						"Legacy / Unassigned",
				});
			}

			return options;
		}, [
			rows,
		]);

	/*
	 * Rows are already filtered, grouped/sorted and paginated by PostgreSQL.
	 * Keeping this alias preserves all existing table/action code without
	 * re-scanning the complete dispatch history in the browser.
	 */
	const filteredRows =
		useMemo(
			() =>
				Array.isArray(rows)
					? rows
					: [],
			[rows]
		);

	const dispatchMatchingRowCount =
		Number.isFinite(
			Number(
				dispatchServerMeta.totalElements
			)
		)
			? Number(
				dispatchServerMeta.totalElements
			)
			: filteredRows.length;

	const filteredSelectableRows = useMemo(() => {
		return filteredRows.filter((r) => !!r.zohoItemId);
	}, [filteredRows]);

	const filteredSelectableIds = useMemo(() => {
		return filteredSelectableRows.map((r) => r.zohoItemId);
	}, [filteredSelectableRows]);

	/*
	 * Set membership stays O(1) even after an explicit Select All Matching
	 * operation selects tens of thousands of dispatch ids.
	 */
	const selectionIdSet = useMemo(
		() => new Set(selectionModel),
		[selectionModel]
	);

	const allFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.every((id) => selectionIdSet.has(id));

	const someFilteredSelected =
		filteredSelectableIds.length > 0 &&
		filteredSelectableIds.some((id) => selectionIdSet.has(id));

	const toggleSelectAllFiltered = async (checked) => {
		if (!checked) {
			const currentSignature =
				buildDispatchServerQuerySignature({
					searchValue: search,
					statusValue: statusFilter,
				});

			const previousScope =
				dispatchSelectAllScopeRef.current;

			const idsToRemove =
				previousScope?.signature === currentSignature &&
					Array.isArray(previousScope?.ids)
					? previousScope.ids
					: filteredSelectableIds;

			const removeSet = new Set(idsToRemove);

			setSelectionModel((prev) =>
				prev.filter((id) => !removeSet.has(id))
			);

			dispatchSelectAllScopeRef.current = {
				signature: "",
				ids: [],
			};

			return;
		}

		try {
			setDispatchSelectAllLoading(true);

			/*
			 * Preserve the original "select all filtered" behaviour without
			 * keeping the whole dispatch register in browser memory all day.
			 * Full matching rows are fetched only when the user explicitly asks
			 * to select the complete filtered result.
			 */
			const matchingRows =
				await fetchAllMatchingDispatchRows({
					searchValue: search,
					statusValue: statusFilter,
				});

			const ids = [];

			matchingRows.forEach((row) => {
				const id = String(
					row?.zohoItemId || ""
				).trim();

				if (!id) {
					return;
				}

				ids.push(id);
				dispatchSelectedRowCacheRef.current.set(
					id,
					row
				);
			});

			setSelectionModel((prev) =>
				Array.from(new Set([...prev, ...ids]))
			);

			dispatchSelectAllScopeRef.current = {
				signature:
					buildDispatchServerQuerySignature({
						searchValue: search,
						statusValue: statusFilter,
					}),
				ids,
			};
		} catch (error) {
			console.error(
				"Select all matching dispatch rows failed:",
				error
			);

			alert(
				error?.message ||
				"Unable to select all matching dispatch rows"
			);
		} finally {
			setDispatchSelectAllLoading(false);
		}
	};

	const totalPages =
		Math.max(
			1,
			Number(
				dispatchServerMeta.totalPages || 1
			)
		);

	const safePageNo =
		Math.min(
			Math.max(
				1,
				pageNo
			),
			totalPages
		);

	useEffect(() => {
		if (pageNo > totalPages) {
			setPageNo(totalPages);
		}
	}, [pageNo, totalPages]);

	/*
	 * Server-side pagination means rows is exactly the current UI page.
	 */
	const paginatedRows = filteredRows;

	const dispatchGridTemplate =
		useMemo(
			() =>
				dispatchColumnWidths
					.map(
						(width) =>
							`${Math.round(width)}px`
					)
					.join(" "),
			[
				dispatchColumnWidths,
			]
		);

	const dispatchTableWidth =
		useMemo(
			() =>
				dispatchColumnWidths.reduce(
					(total, width) =>
						total +
						Number(width || 0),
					0
				),
			[
				dispatchColumnWidths,
			]
		);

	const stopDispatchColumnResize =
		() => {
			const active =
				dispatchColumnResizeRef.current;

			if (!active) {
				return;
			}

			window.removeEventListener(
				"pointermove",
				active.onMove
			);

			window.removeEventListener(
				"pointerup",
				active.onUp
			);

			window.removeEventListener(
				"pointercancel",
				active.onUp
			);

			dispatchColumnResizeRef.current =
				null;

			document.body.style.cursor =
				"";

			document.body.style.userSelect =
				"";
		};

	const beginDispatchColumnResize =
		(event, columnIndex) => {
			event.preventDefault();
			event.stopPropagation();

			stopDispatchColumnResize();

			const config =
				DISPATCH_COLUMN_LAYOUT[
				columnIndex
				];

			if (!config) {
				return;
			}

			const startX =
				event.clientX;

			const startWidth =
				dispatchColumnWidths[
				columnIndex
				] ??
				config.width;

			const onMove =
				(moveEvent) => {
					moveEvent.preventDefault();

					const nextWidth =
						Math.max(
							config.min,
							Math.min(
								config.max,
								startWidth +
								(moveEvent.clientX -
									startX)
							)
						);

					setDispatchColumnWidths(
						(previous) => {
							if (
								previous[
								columnIndex
								] ===
								nextWidth
							) {
								return previous;
							}

							const next =
								[
									...previous,
								];

							next[
								columnIndex
							] =
								nextWidth;

							return next;
						}
					);
				};

			const onUp =
				() => {
					stopDispatchColumnResize();
				};

			dispatchColumnResizeRef.current =
			{
				onMove,
				onUp,
			};

			document.body.style.cursor =
				"col-resize";

			document.body.style.userSelect =
				"none";

			window.addEventListener(
				"pointermove",
				onMove,
				{
					passive: false,
				}
			);

			window.addEventListener(
				"pointerup",
				onUp
			);

			window.addEventListener(
				"pointercancel",
				onUp
			);
		};

	const resetDispatchColumnWidth =
		(columnIndex) => {
			const config =
				DISPATCH_COLUMN_LAYOUT[
				columnIndex
				];

			if (!config) {
				return;
			}

			setDispatchColumnWidths(
				(previous) => {
					const next =
						[
							...previous,
						];

					next[
						columnIndex
					] =
						config.width;

					return next;
				}
			);
		};

	const renderDispatchResizeHandle =
		(columnIndex) => (
			<Box
				className="dispatch-column-resize-handle"
				data-dispatch-no-row-open="true"
				title="Drag to resize • Double-click to reset"
				onPointerDown={(event) =>
					beginDispatchColumnResize(
						event,
						columnIndex
					)
				}
				onDoubleClick={(event) => {
					event.preventDefault();
					event.stopPropagation();

					resetDispatchColumnWidth(
						columnIndex
					);
				}}
				sx={dispatchColumnResizeHandleSx}
			/>
		);

	const isDispatchRowInteractiveTarget =
		(target) => {
			if (
				!target ||
				typeof target.closest !==
				"function"
			) {
				return false;
			}

			return Boolean(
				target.closest(
					[
						"button",
						"a",
						"input",
						"select",
						"textarea",
						"[role='button']",
						"[role='checkbox']",
						"[role='menuitem']",
						".MuiButtonBase-root",
						".MuiChip-clickable",
						"[data-dispatch-no-row-open='true']",
					].join(",")
				)
			);
		};

	const openDispatchItemDrawer =
		(row) => {
			if (!row) {
				return;
			}

			setDispatchItemDrawerRow(
				row
			);
		};

	const handleDispatchRowClick =
		(event, row) => {
			if (
				isDispatchRowInteractiveTarget(
					event.target
				)
			) {
				return;
			}

			openDispatchItemDrawer(
				row
			);
		};

	useEffect(() => {
		return () => {
			stopDispatchColumnResize();
		};
	}, []);

	useEffect(() => {
		return () => {
			dispatchFetchAbortRef.current?.abort();
			dispatchPrefetchAbortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		setPageNo(1);
	}, [pageSize]);

	useEffect(() => {
		if (!dispatchItemDrawerRow) {
			return;
		}

		const currentId =
			String(
				dispatchItemDrawerRow
					?.zohoItemId ||
				dispatchItemDrawerRow
					?.dispatchedItemId ||
				dispatchItemDrawerRow
					?.packetItemId ||
				dispatchItemDrawerRow
					?.id ||
				""
			).trim();

		if (!currentId) {
			return;
		}

		const refreshedRow =
			(rows || []).find(
				(row) =>
					String(
						row?.zohoItemId ||
						row?.dispatchedItemId ||
						row?.packetItemId ||
						row?.id ||
						""
					).trim() ===
					currentId
			);

		if (
			refreshedRow &&
			refreshedRow !==
			dispatchItemDrawerRow
		) {
			setDispatchItemDrawerRow(
				refreshedRow
			);
		}
	}, [
		rows,
		dispatchItemDrawerRow,
	]);

	useEffect(() => {
		setPageNo(1);
	}, [
		search,
		statusFilter,
		plantFilter,
		dateFilterMode,
		dateFilterFrom,
		dateFilterTo,
		dateFilterTimeFrom,
		dateFilterTimeTo,
		groupBy,
	]);

	useEffect(() => {
		setPageNo((currentPage) =>
			Math.min(
				Math.max(
					1,
					currentPage
				),
				totalPages
			)
		);
	}, [totalPages]);

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

	const getStickerHistoryListPath = (
		row,
		packetItemId
	) => {
		const cleanItemId =
			String(packetItemId || "").trim();

		if (!cleanItemId) {
			return "";
		}

		if (isHardwareDispatchRow(row)) {
			return `/api/hardware-packets/${encodeURIComponent(
				cleanItemId
			)}/history`;
		}

		return `/api/stickers/${encodeURIComponent(
			cleanItemId
		)}/history`;
	};

	const getStickerHistoryPdfPath = (
		row,
		historyId
	) => {
		const cleanHistoryId =
			String(historyId || "").trim();

		if (!cleanHistoryId) {
			return "";
		}

		if (isHardwareDispatchRow(row)) {
			return `/api/hardware-packets/history/${encodeURIComponent(
				cleanHistoryId
			)}/download-pdf`;
		}

		return `/api/stickers/history/${encodeURIComponent(
			cleanHistoryId
		)}/download-pdf`;
	};

	const normalizeStickerHistoryRows = (
		payload
	) => {
		if (Array.isArray(payload)) {
			return payload;
		}

		if (Array.isArray(payload?.content)) {
			return payload.content;
		}

		if (Array.isArray(payload?.history)) {
			return payload.history;
		}

		if (Array.isArray(payload?.items)) {
			return payload.items;
		}

		return [];
	};

	const readResponseError = async (
		response,
		fallbackMessage
	) => {
		try {
			const text =
				await response.text();

			if (!text) {
				return fallbackMessage;
			}

			try {
				const parsed =
					JSON.parse(text);

				return (
					parsed?.message ||
					parsed?.error ||
					text
				);
			} catch {
				return text;
			}
		} catch {
			return fallbackMessage;
		}
	};


	const normalizeDispatchImportHeader = (value) => {
		return String(value ?? "")
			.trim()
			.toLowerCase()
			.replace(/[_-]+/g, " ")
			.replace(/[^a-z0-9]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	};

	const dispatchImportCellText = (cell) => {
		if (!cell) return "";

		const value = cell.value;

		if (value == null) {
			return String(cell.text || "").trim();
		}

		if (typeof value === "string" || typeof value === "number") {
			return String(value).trim();
		}

		if (value instanceof Date) {
			return String(cell.text || "").trim();
		}

		if (Array.isArray(value?.richText)) {
			return value.richText
				.map((part) => part?.text || "")
				.join("")
				.trim();
		}

		if (value?.result != null) {
			return String(value.result).trim();
		}

		if (value?.text != null) {
			return String(value.text).trim();
		}

		return String(cell.text || "").trim();
	};

	const padDispatchImportDatePart = (value) =>
		String(value).padStart(2, "0");

	const buildDispatchImportIsoDateTime = (
		year,
		month,
		day,
		hour = 0,
		minute = 0,
		second = 0
	) => {
		if (
			!Number.isFinite(Number(year)) ||
			!Number.isFinite(Number(month)) ||
			!Number.isFinite(Number(day))
		) {
			return "";
		}

		return `${String(year).padStart(4, "0")}-${padDispatchImportDatePart(
			month
		)}-${padDispatchImportDatePart(day)}T${padDispatchImportDatePart(
			hour
		)}:${padDispatchImportDatePart(minute)}:${padDispatchImportDatePart(
			second
		)}`;
	};

	const dispatchImportDateTimeFromValue = (rawValue) => {
		let value = rawValue;

		if (value && typeof value === "object" && !(value instanceof Date)) {
			if (value.result != null) {
				value = value.result;
			}
		}

		if (value instanceof Date && !Number.isNaN(value.getTime())) {
			return buildDispatchImportIsoDateTime(
				value.getFullYear(),
				value.getMonth() + 1,
				value.getDate(),
				value.getHours(),
				value.getMinutes(),
				value.getSeconds()
			);
		}

		if (typeof value === "number" && Number.isFinite(value)) {
			/* Excel 1900 date system; 1899-12-30 handles Excel's leap-year bug. */
			const epoch = Date.UTC(1899, 11, 30);
			const date = new Date(epoch + value * 86400000);

			return buildDispatchImportIsoDateTime(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);
		}

		const text = String(value ?? "").trim();

		if (!text) return "";

		const isoMatch = text.match(
			/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
		);

		if (isoMatch) {
			return buildDispatchImportIsoDateTime(
				Number(isoMatch[1]),
				Number(isoMatch[2]),
				Number(isoMatch[3]),
				Number(isoMatch[4] || 0),
				Number(isoMatch[5] || 0),
				Number(isoMatch[6] || 0)
			);
		}

		const indianDateMatch = text.match(
			/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
		);

		if (indianDateMatch) {
			return buildDispatchImportIsoDateTime(
				Number(indianDateMatch[3]),
				Number(indianDateMatch[2]),
				Number(indianDateMatch[1]),
				Number(indianDateMatch[4] || 0),
				Number(indianDateMatch[5] || 0),
				Number(indianDateMatch[6] || 0)
			);
		}

		return "";
	};

	const findDispatchImportHeaderColumn = (headerMap, aliases) => {
		for (const alias of aliases) {
			const column = headerMap.get(normalizeDispatchImportHeader(alias));

			if (column) return column;
		}

		return 0;
	};

	const parseDispatchImportWorkbook = async (file) => {
		const excelJsModule = await import("exceljs");
		const ExcelJS = excelJsModule.default ?? excelJsModule;
		const workbook = new ExcelJS.Workbook();
		const buffer = await file.arrayBuffer();

		await workbook.xlsx.load(buffer);

		const worksheet = workbook.worksheets?.[0];

		if (!worksheet) {
			throw new Error("The workbook does not contain a worksheet");
		}

		let headerRowNumber = 0;
		let headerMap = new Map();

		for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount || 10); rowNumber += 1) {
			const row = worksheet.getRow(rowNumber);
			const candidateMap = new Map();

			row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
				const key = normalizeDispatchImportHeader(dispatchImportCellText(cell));

				if (key) {
					candidateMap.set(key, columnNumber);
				}
			});

			if (
				findDispatchImportHeaderColumn(candidateMap, ["Item Name", "Item"]) &&
				findDispatchImportHeaderColumn(candidateMap, ["PD No", "PD Number", "PD"]) &&
				findDispatchImportHeaderColumn(candidateMap, ["DWG No", "Drawing No", "Drawing Number", "DWG"])
			) {
				headerRowNumber = rowNumber;
				headerMap = candidateMap;
				break;
			}
		}

		if (!headerRowNumber) {
			throw new Error(
				"Could not find Item Name, PD No and DWG No headers in the first 10 rows"
			);
		}

		const columns = {
			itemName: findDispatchImportHeaderColumn(headerMap, ["Item Name", "Item"]),
			pdNo: findDispatchImportHeaderColumn(headerMap, ["PD No", "PD Number", "PD"]),
			drawingNo: findDispatchImportHeaderColumn(headerMap, [
				"DWG No",
				"Drawing No",
				"Drawing Number",
				"DWG",
			]),
			description: findDispatchImportHeaderColumn(headerMap, ["Description", "Desc"]),
			clientName: findDispatchImportHeaderColumn(headerMap, ["Client", "Client Name"]),
			sourceStatus: findDispatchImportHeaderColumn(headerMap, ["Status"]),
			dispatchDate: findDispatchImportHeaderColumn(headerMap, [
				"Dispatch Date",
				"Dispatched Date",
				"Date",
			]),
			driverName: findDispatchImportHeaderColumn(headerMap, ["Driver Name", "Driver"]),
		};

		if (!columns.dispatchDate) {
			throw new Error("Dispatch Date column is required");
		}

		if (!columns.driverName) {
			throw new Error("Driver Name column is required");
		}

		const parsedRows = [];

		for (
			let rowNumber = headerRowNumber + 1;
			rowNumber <= worksheet.rowCount;
			rowNumber += 1
		) {
			const row = worksheet.getRow(rowNumber);
			const itemName = dispatchImportCellText(row.getCell(columns.itemName));
			const pdNo = dispatchImportCellText(row.getCell(columns.pdNo));
			const drawingNo = dispatchImportCellText(row.getCell(columns.drawingNo));

			if (!itemName && !pdNo && !drawingNo) {
				continue;
			}

			parsedRows.push({
				rowNumber,
				itemName,
				pdNo,
				drawingNo,
				description: columns.description
					? dispatchImportCellText(row.getCell(columns.description))
					: "",
				clientName: columns.clientName
					? dispatchImportCellText(row.getCell(columns.clientName))
					: "",
				sourceStatus: columns.sourceStatus
					? dispatchImportCellText(row.getCell(columns.sourceStatus))
					: "",
				dispatchDateTime: dispatchImportDateTimeFromValue(
					row.getCell(columns.dispatchDate)?.value
				),
				driverName: dispatchImportCellText(row.getCell(columns.driverName)),
			});
		}

		if (parsedRows.length === 0) {
			throw new Error("No dispatch rows were found in the workbook");
		}

		return parsedRows;
	};

	const handleDispatchImportFile = async (event) => {
		const file = event?.target?.files?.[0];

		if (!file) return;

		try {
			setDispatchImportOpen(true);
			setDispatchImportLoading(true);
			setDispatchImportApplying(false);
			setDispatchImportFileName(file.name || "Dispatch import.xlsx");
			setDispatchImportVerification(null);
			setDispatchImportSelection([]);
			setDispatchImportFilter("ALL");
			setDispatchImportSearch("");
			setDispatchImportVisibleCount(250);

			const importRows = await parseDispatchImportWorkbook(file);

			const response = await authFetch(
				`${API_BASE_URL}/api/dispatched/import/verify`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(importRows),
				}
			);

			if (!response.ok) {
				throw new Error(
					await readResponseError(
						response,
						"Dispatch XLSX verification failed"
					)
				);
			}

			const verification = await response.json();
			const verifiedRows = Array.isArray(verification?.rows)
				? verification.rows
				: [];

			setDispatchImportVerification({
				...verification,
				rows: verifiedRows,
			});

			setDispatchImportSelection(
				verifiedRows
					.filter((row) => row?.matchStatus === "MATCHED" && row?.applyEligible)
					.map((row) => row.rowNumber)
			);
		} catch (error) {
			console.error("Dispatch XLSX import verification failed:", error);
			alert(error?.message || "Could not verify the XLSX file");
			setDispatchImportVerification(null);
			setDispatchImportSelection([]);
		} finally {
			setDispatchImportLoading(false);

			if (event?.target) {
				event.target.value = "";
			}
		}
	};

	const dispatchImportRows = Array.isArray(dispatchImportVerification?.rows)
		? dispatchImportVerification.rows
		: [];

	const dispatchImportSelectedSet = useMemo(
		() => new Set(dispatchImportSelection || []),
		[dispatchImportSelection]
	);

	const dispatchImportEligibleRows = useMemo(() => {
		return dispatchImportRows.filter(
			(row) =>
				row?.matchStatus === "MATCHED" &&
				row?.applyEligible &&
				!row?.applied
		);
	}, [dispatchImportRows]);

	const filteredDispatchImportRows = useMemo(() => {
		const needle = String(dispatchImportSearch || "")
			.trim()
			.toLowerCase();

		return dispatchImportRows.filter((row) => {
			if (dispatchImportFilter !== "ALL" && row?.matchStatus !== dispatchImportFilter) {
				return false;
			}

			if (!needle) return true;

			return [
				row?.rowNumber,
				row?.itemName,
				row?.pdNo,
				row?.drawingNo,
				row?.description,
				row?.clientName,
				row?.sku,
				row?.zohoItemId,
				row?.driverName,
				row?.currentStatus,
				row?.matchReason,
			]
				.map((value) => String(value ?? "").toLowerCase())
				.some((value) => value.includes(needle));
		});
	}, [dispatchImportRows, dispatchImportFilter, dispatchImportSearch]);

	const toggleDispatchImportRow = (rowNumber) => {
		setDispatchImportSelection((previous) => {
			const selected = new Set(previous || []);

			if (selected.has(rowNumber)) {
				selected.delete(rowNumber);
			} else {
				selected.add(rowNumber);
			}

			return Array.from(selected);
		});
	};

	const selectAllDispatchImportMatches = () => {
		const eligibleRowNumbers = dispatchImportEligibleRows.map((row) => row.rowNumber);
		const allSelected =
			eligibleRowNumbers.length > 0 &&
			eligibleRowNumbers.every((rowNumber) => dispatchImportSelectedSet.has(rowNumber));

		setDispatchImportSelection(allSelected ? [] : eligibleRowNumbers);
	};

	const applyDispatchImportRows = async (targetRows) => {
		const rowsToApply = (Array.isArray(targetRows) ? targetRows : []).filter(
			(row) => row?.matchStatus === "MATCHED" && row?.applyEligible && !row?.applied
		);

		if (rowsToApply.length === 0) {
			alert("Select at least one verified matched row");
			return;
		}

		try {
			setDispatchImportApplying(true);

			const response = await authFetch(
				`${API_BASE_URL}/api/dispatched/import/apply`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify({
						rows: rowsToApply.map((row) => ({
							rowNumber: row.rowNumber,
							zohoItemId: row.zohoItemId,
							itemName: row.itemName,
							pdNo: row.pdNo,
							drawingNo: row.drawingNo,
							dispatchDateTime: row.dispatchDateTime,
							driverName: row.driverName,
						})),
					}),
				}
			);

			if (!response.ok) {
				throw new Error(
					await readResponseError(
						response,
						"Dispatch XLSX apply failed"
					)
				);
			}

			const result = await response.json();
			const appliedRows = Array.isArray(result?.rows) ? result.rows : [];
			const appliedById = new Map(
				appliedRows.map((row) => [String(row?.zohoItemId || ""), row])
			);

			setDispatchImportVerification((previous) => {
				if (!previous) return previous;

				return {
					...previous,
					rows: (previous.rows || []).map((row) => {
						const applied = appliedById.get(String(row?.zohoItemId || ""));

						if (!applied) return row;

						return {
							...row,
							applied: true,
							applyEligible: false,
							currentStatus: "DISPATCHED",
							currentDriverName: applied.driverName,
							currentDispatchDateTime: applied.dispatchDateTime,
							matchReason: applied.challanNumber
								? `Applied. Existing challan preserved: ${applied.challanNumber}`
								: "Applied. Item is DISPATCHED and remains available for challan generation later.",
						};
					}),
				};
			});

			const appliedRowNumbers = new Set(appliedRows.map((row) => row?.rowNumber));

			setDispatchImportSelection((previous) =>
				(previous || []).filter((rowNumber) => !appliedRowNumbers.has(rowNumber))
			);

			await fetchData();

			alert(
				`${Number(result?.updatedCount || appliedRows.length)} item${
					Number(result?.updatedCount || appliedRows.length) === 1 ? "" : "s"
				} updated to DISPATCHED from the verified XLSX.`
			);
		} catch (error) {
			console.error("Dispatch XLSX apply failed:", error);
			alert(error?.message || "Could not apply verified XLSX rows");
		} finally {
			setDispatchImportApplying(false);
		}
	};

	const applySelectedDispatchImportRows = async () => {
		const selectedRows = dispatchImportEligibleRows.filter((row) =>
			dispatchImportSelectedSet.has(row.rowNumber)
		);

		await applyDispatchImportRows(selectedRows);
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

	const normalizeDispatchDriverName = (value) => {
		const cleanValue =
			String(value ?? "")
				.trim()
				.replace(/\s+/g, " ");

		const placeholderValues =
			new Set([
				"",
				"-",
				"—",
				"N/A",
				"NA",
				"NONE",
				"NULL",
				"UNDEFINED",
			]);

		return placeholderValues.has(
			cleanValue.toUpperCase()
		)
			? ""
			: cleanValue;
	};

	const normalizeDispatchVehicleNumber = (
		value
	) => {
		const cleanValue =
			String(value ?? "")
				.trim()
				.replace(/\s+/g, " ")
				.toUpperCase();

		const placeholderValues =
			new Set([
				"",
				"-",
				"—",
				"N/A",
				"NA",
				"NONE",
				"NULL",
				"UNDEFINED",
			]);

		return placeholderValues.has(
			cleanValue
		)
			? ""
			: cleanValue;
	};

	const extractDispatchReportRows = (
		payload
	) => {
		if (Array.isArray(payload)) {
			return payload;
		}

		if (
			Array.isArray(
				payload?.rows
			)
		) {
			return payload.rows;
		}

		if (
			Array.isArray(
				payload?.content
			)
		) {
			return payload.content;
		}

		if (
			Array.isArray(
				payload?.items
			)
		) {
			return payload.items;
		}

		if (
			Array.isArray(
				payload?.data
			)
		) {
			return payload.data;
		}

		return [];
	};

	const formatDispatchReportLocalDateTime =
		(date) => {
			const pad = (value) =>
				String(value)
					.padStart(
						2,
						"0"
					);

			return [
				date.getFullYear(),
				"-",
				pad(
					date.getMonth() +
					1
				),
				"-",
				pad(
					date.getDate()
				),
				"T",
				pad(
					date.getHours()
				),
				":",
				pad(
					date.getMinutes()
				),
				":",
				pad(
					date.getSeconds()
				),
			].join("");
		};

	const getDispatchReportLookupRange =
		(sourceRows) => {
			const timestamps =
				(
					Array.isArray(
						sourceRows
					)
						? sourceRows
						: []
				)
					.map((row) => {
						const rawValue =
							row?.dispatchedAt ||
							row?.dispatchDate ||
							row?.createdAt ||
							null;

						if (!rawValue) {
							return null;
						}

						const parsedDate =
							new Date(
								rawValue
							);

						return Number.isNaN(
							parsedDate.getTime()
						)
							? null
							: parsedDate.getTime();
					})
					.filter(
						(value) =>
							Number.isFinite(
								value
							)
					);

			const earliestDate =
				timestamps.length >
					0
					? new Date(
						Math.min(
							...timestamps
						)
					)
					: new Date(
						2000,
						0,
						1
					);

			/*
			 * Include one day before the earliest record so
			 * timezone or midnight boundaries cannot exclude it.
			 */
			earliestDate.setDate(
				earliestDate.getDate() -
				1
			);

			earliestDate.setHours(
				0,
				0,
				0,
				0
			);

			const latestRecordDate =
				timestamps.length >
					0
					? new Date(
						Math.max(
							...timestamps
						)
					)
					: new Date();

			const upperDate =
				new Date(
					Math.max(
						Date.now(),
						latestRecordDate.getTime()
					)
				);

			upperDate.setDate(
				upperDate.getDate() +
				1
			);

			upperDate.setHours(
				23,
				59,
				59,
				999
			);

			return {
				from:
					formatDispatchReportLocalDateTime(
						earliestDate
					),

				to:
					formatDispatchReportLocalDateTime(
						upperDate
					),
			};
		};

	const normalizeDispatchLookupId = (value) => {
		return String(value ?? "")
			.trim()
			.toLowerCase();
	};

	const normalizeDispatchLookupChallan = (value) => {
		return String(value ?? "")
			.trim()
			.toUpperCase();
	};

	const buildDispatchHistoryItemFingerprint = (item) => {
		return [
			item?.sku,
			item?.pdNo,
			item?.drawingNo,
			item?.name || item?.itemName,
			item?.clientName,
		]
			.map((value) =>
				normalizeSmartSearch(value)
			)
			.join("|");
	};

	const buildDispatchAssociationFromReportRow =
		(reportRow) => {
			const rawDriver =
				reportRow?.driverName ||
				reportRow?.assignedDriverName ||
				reportRow?.driver?.name ||
				(
					typeof reportRow?.driver ===
						"string"
						? reportRow.driver
						: ""
				);

			const rawVehicle =
				reportRow?.vehicleNumber ||
				reportRow?.vehicleNo ||
				reportRow?.assignedVehicleNumber ||
				reportRow?.vehicle?.vehicleNumber ||
				(
					typeof reportRow?.vehicle ===
						"string"
						? reportRow.vehicle
						: ""
				);

			return {
				driverName:
					normalizeDispatchDriverName(
						rawDriver
					),

				vehicleNumber:
					normalizeDispatchVehicleNumber(
						rawVehicle
					),

				challanNumber:
					normalizeDispatchLookupChallan(
						reportRow?.challanNumber ||
						reportRow?.chalaanNumber ||
						reportRow?.dispatchChallanNumber
					),
			};
		};

	const mergeDispatchExportAssociation = (
		lookup,
		key,
		nextAssociation
	) => {
		const cleanKey =
			String(key || "")
				.trim();

		if (!cleanKey) {
			return;
		}

		const previousAssociation =
			lookup.get(
				cleanKey
			) || {};

		lookup.set(
			cleanKey,
			{
				driverName:
					nextAssociation
						?.driverName ||
					previousAssociation
						?.driverName ||
					"",

				vehicleNumber:
					nextAssociation
						?.vehicleNumber ||
					previousAssociation
						?.vehicleNumber ||
					"",

				challanNumber:
					nextAssociation
						?.challanNumber ||
					previousAssociation
						?.challanNumber ||
					"",
			}
		);
	};

	const buildDispatchLookupFromReport =
		(reportRows) => {
			const lookup =
				new Map();

			(
				Array.isArray(
					reportRows
				)
					? reportRows
					: []
			).forEach(
				(reportRow) => {
					const association =
						buildDispatchAssociationFromReportRow(
							reportRow
						);

					const possibleItemIds = [
						reportRow
							?.zohoItemId,

						reportRow
							?.dispatchedItemId,

						reportRow
							?.itemId,

						reportRow
							?.packetItemId,

						reportRow
							?.id,
					]
						.map(
							normalizeDispatchLookupId
						)
						.filter(Boolean);

					possibleItemIds.forEach(
						(itemId) => {
							mergeDispatchExportAssociation(
								lookup,
								`ITEM:${itemId}`,
								association
							);
						}
					);

					if (
						association
							.challanNumber
					) {
						mergeDispatchExportAssociation(
							lookup,
							`CHALLAN:${association.challanNumber}`,
							association
						);
					}
				}
			);

			return lookup;
		};

	const loadDispatchExportDriverLookup =
		async (
			sourceRows = rows
		) => {
			const {
				from,
				to,
			} =
				getDispatchReportLookupRange(
					sourceRows
				);

			/*
			 * Reuse the exact report source that already
			 * returns driverName and vehicleNumber correctly
			 * on the Dashboard Reports page.
			 */
			/*
			 * Keep dashboardApi outside this page's static module graph.
			 * This prevents a production-only temporal-dead-zone failure
			 * when a dashboard barrel or dependency imports this page back.
			 */
			const dashboardApi =
				await import(
					"../dashboard/api/dashboardApi"
				);

			const payload =
				await dashboardApi.fetchDispatchReport(
					from,
					to
				);

			const reportRows =
				extractDispatchReportRows(
					payload
				);

			const freshLookup =
				buildDispatchLookupFromReport(
					reportRows
				);

			setDispatchExportDriverLookup(
				freshLookup
			);

			/*
			 * Return the fresh Map immediately because React
			 * state updates are asynchronous.
			 */
			return freshLookup;
		};

	const getDispatchExportAssociation = (
		row,
		driverLookup =
			dispatchExportDriverLookup
	) => {
		const activeLookup =
			driverLookup instanceof Map
				? driverLookup
				: dispatchExportDriverLookup;

		const possibleRowIds = [
			row?.zohoItemId,
			row?.dispatchedItemId,
			row?.packetItemId,
			row?.itemId,
			row?.id,
		]
			.map(
				normalizeDispatchLookupId
			)
			.filter(Boolean);

		/*
		 * First preference:
		 * exact item-level report match.
		 */
		for (
			const itemId of
			possibleRowIds
		) {
			const association =
				activeLookup.get(
					`ITEM:${itemId}`
				);

			if (
				association?.driverName ||
				association?.vehicleNumber
			) {
				return association;
			}
		}

		/*
		 * Second preference:
		 * challan-level match.
		 *
		 * Every item belonging to the same challan receives
		 * the same driver and vehicle.
		 */
		const challanNumber =
			normalizeDispatchLookupChallan(
				getDispatchChallanNo(
					row
				)
			);

		if (challanNumber) {
			const association =
				activeLookup.get(
					`CHALLAN:${challanNumber}`
				);

			if (
				association?.driverName ||
				association?.vehicleNumber
			) {
				return association;
			}
		}

		return null;
	};

	const getDispatchExportDriverName = (
		row,
		driverLookup =
			dispatchExportDriverLookup
	) => {
		const association =
			getDispatchExportAssociation(
				row,
				driverLookup
			);

		if (
			association
				?.driverName
		) {
			return association
				.driverName;
		}

		/*
		 * Safe fallback for records that already contain
		 * driver metadata directly.
		 */
		return normalizeDispatchDriverName(
			row?.driverName ||
			row?.assignedDriverName ||
			row?.driver?.name ||
			(
				typeof row?.driver ===
					"string"
					? row.driver
					: ""
			)
		);
	};
	/*
 * Only the exact DISPATCHED status goes into the first Excel sheet.
 *
 * OUT_FOR_DELIVERY, DELIVERED, RESTORED, READY, IN_WAREHOUSE and
 * every other status remain in the "Other Status" sheet.
 */
	const DISPATCHED_EXCEL_STATUSES =
		new Set(["DISPATCHED"]);

	/*
	 * Excel column definitions.
	 *
	 * key:
	 *   Internal preview/export object key.
	 *
	 * header:
	 *   Visible Excel header.
	 *
	 * width:
	 *   Excel column width.
	 *
	 * getValue:
	 *   Safely resolves current and legacy API property names.
	 */
	const dispatchExportColumns = [
		{
			key: "packingDate",
			header: "Packing Date",
			width: 16,
			isDate: true,

			getValue: (row) =>
				resolveDispatchExcelDate(
					row?.packedAt ||
					row?.packingDate ||
					row?.packedDate ||
					row?.stickerGeneratedAt ||
					null
				),
		},
		{
			key: "dispatchDate",
			header: "Dispatch Date",
			width: 16,
			isDate: true,

			getValue: (row) => {
				/*
				 * Never invent a dispatch date.
				 *
				 * A value is included only when the backend has actually
				 * stored dispatchedAt.
				 */
				if (!row?.dispatchedAt) {
					return null;
				}

				return resolveDispatchExcelDate(
					row.dispatchedAt
				);
			},
		},
		{
			key: "pdNo",
			header: "PD No.",
			width: 17,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.pdNo,
					row?.pdNumber,
					row?.productionNo
				),
		},
		{
			key: "clientName",
			header: "Client Name",
			width: 28,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.clientName,
					row?.client
				),
		},
		{
			key: "drawingNo",
			header: "Dwg No.",
			width: 18,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.drawingNo,
					row?.dwgNo,
					row?.drawingNumber
				),
		},
		{
			key: "itemName",
			header: "Item Name",
			width: 30,
			getValue: (row) =>
				firstDispatchExportValue(
					row?.itemName,
					row?.name,
					row?.productName,
					row?.packetItemName,
					row?.packetItem?.itemName,
					row?.packetItem?.name
				),
		},
		{
			key: "packetNo",
			header: "Pkt No.",
			width: 20,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.packetNo,
					row?.packetNumber,
					row?.pktNo,
					row?.packetCode,
					row?.packet?.packetNo,
					row?.packet?.packetNumber,

					/*
					 * Legacy fallback:
					 * Existing Dispatch rows frequently carry the visible
					 * packet reference inside SKU.
					 */
					row?.sku
				),
		},
		{
			key: "description",
			header: "Description",
			width: 42,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.description,
					row?.name,
					row?.itemName
				),
		},
		{
			key: "plant",
			header: "Plant",
			width: 15,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.plantCode,
					row?.plant
				),
		},
		{
			key: "status",
			header: "Status",
			width: 26,

			getValue: (row) =>
				getDisplayStatus(row)?.label ||
				firstDispatchExportValue(
					row?.status
				),
		},
		{
			key: "address",
			header: "Address",
			width: 44,

			getValue: (row) =>
				firstDispatchExportValue(
					row?.clientAddress,
					row?.address,
					row?.siteAddress,
					row?.deliveryAddress
				),
		},
		{
			key: "driverName",
			header: "Driver Name",
			width: 24,

			getValue: (
				row,
				context = {}
			) =>
				getDispatchExportDriverName(
					row,
					context.driverLookup
				),
		},
	];

	/*
	 * Removes line breaks and unnecessary spaces from exported text.
	 *
	 * This prevents one description/address from making Excel rows
	 * unnecessarily large.
	 */
	const cleanDispatchExportText = (
		value
	) => {
		if (
			value === null ||
			value === undefined
		) {
			return "";
		}

		return String(value)
			.replace(/\r?\n|\r/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	};

	/*
	 * Returns the first meaningful value from a list of current and
	 * legacy API property names.
	 */
	const firstDispatchExportValue = (
		...values
	) => {
		for (const value of values) {
			const cleanValue =
				cleanDispatchExportText(value);

			if (cleanValue) {
				return cleanValue;
			}
		}

		return "";
	};

	/*
	 * Converts backend dates to genuine JavaScript Date objects.
	 *
	 * Only the date portion is retained because the requested report
	 * requires Packing Date and Dispatch Date rather than timestamps.
	 *
	 * Creating the date from year/month/day also avoids timezone shifts
	 * when Excel opens the workbook on another computer.
	 */
	const resolveDispatchExcelDate = (
		value
	) => {
		if (!value) {
			return null;
		}

		if (
			value instanceof Date &&
			!Number.isNaN(value.getTime())
		) {
			return new Date(
				value.getFullYear(),
				value.getMonth(),
				value.getDate()
			);
		}

		const text =
			String(value).trim();

		const isoDateMatch =
			text.match(
				/^(\d{4})-(\d{2})-(\d{2})/
			);

		if (isoDateMatch) {
			const year =
				Number(isoDateMatch[1]);

			const month =
				Number(isoDateMatch[2]);

			const day =
				Number(isoDateMatch[3]);

			return new Date(
				year,
				month - 1,
				day
			);
		}

		const parsedDate =
			new Date(text);

		if (
			Number.isNaN(
				parsedDate.getTime()
			)
		) {
			return null;
		}

		return new Date(
			parsedDate.getFullYear(),
			parsedDate.getMonth(),
			parsedDate.getDate()
		);
	};

	const isDispatchedExcelStatus = (
		status
	) => {
		const cleanStatus =
			String(status || "")
				.trim()
				.toUpperCase();

		return DISPATCHED_EXCEL_STATUSES.has(
			cleanStatus
		);
	};

	/*
	 * Provides stable numeric date sorting.
	 */
	const getDispatchExportDateValue = (
		value
	) => {
		if (!value) {
			return 0;
		}

		const date =
			value instanceof Date
				? value
				: new Date(value);

		return Number.isNaN(date.getTime())
			? 0
			: date.getTime();
	};

	/*
	 * Uses:
	 * - current global search
	 * - statuses selected inside the export modal
	 *
	 * Pagination continues to be ignored.
	 */
	const getDispatchExportSourceRows = (
		statusValue,
		sourceRowsOverride = null
	) => {
		const selectedStatuses =
			normalizeStatusSelection(
				statusValue
			);

		/*
		 * While the export modal is open, never silently fall back to the
		 * currently visible server page.  The export source is loaded explicitly
		 * from every matching backend page so reports remain complete.
		 */
		const baseRows = Array.isArray(sourceRowsOverride)
			? sourceRowsOverride
			: Array.isArray(dispatchExportSourceRows)
				? dispatchExportSourceRows
				: dispatchExportOpen
					? []
					: (rows || []);

		return baseRows.filter((row) => {
			if (
				!smartRowMatches(
					row,
					search
				)
			) {
				return false;
			}

			if (
				!statusMatchesSelection(
					row.status,
					selectedStatuses
				)
			) {
				return false;
			}

			if (
				!dispatchPlantMatches(
					row,
					plantFilter
				)
			) {
				return false;
			}

			if (
				!dispatchRowMatchesDateFilter(
					row,
					{
						mode:
							dateFilterMode,

						dateFrom:
							dateFilterFrom,

						dateTo:
							dateFilterTo,

						timeFrom:
							dateFilterTimeFrom,

						timeTo:
							dateFilterTimeTo,
					}
				)
			) {
				return false;
			}

			return true;
		});
	};

	/*
	 * Used by modal preview and CSV compatibility.
	 */
	const buildDispatchExportRows = (
		statusValue,
		driverLookup = dispatchExportDriverLookup,
		sourceRowsOverride = null
	) => {
		const activeDriverLookup =
			driverLookup instanceof Map
				? driverLookup
				: dispatchExportDriverLookup;

		return getDispatchExportSourceRows(
			statusValue,
			sourceRowsOverride
		).map((row) => {
			const result = {};

			dispatchExportColumns.forEach(
				(column) => {
					result[column.key] =
						column.getValue(
							row,
							{
								driverLookup:
									activeDriverLookup,
							}
						);
				}
			);

			return result;
		});
	};

	const openDispatchExportModal =
		() => {
			const selectedStatuses =
				normalizeStatusSelection(
					statusFilter
				);

			setDispatchExportStatus(
				selectedStatuses
			);

			setDispatchExportFormat(
				"EXCEL"
			);

			setDispatchExportSourceRows(
				null
			);

			setDispatchExportOpen(
				true
			);
		};

	/*
	 * Export is the one place where a complete matching register is useful.
	 * Load it only while this modal is open, never during normal page startup.
	 */
	useEffect(() => {
		if (!dispatchExportOpen) {
			return;
		}

		let cancelled = false;
		const exportAbortController = new AbortController();

		const loadFullExportSource = async () => {
			try {
				setDispatchExportSourceLoading(true);

				const fullRows =
					await fetchAllMatchingDispatchRows({
						searchValue: search,
						statusValue: dispatchExportStatus,
						plantValue: plantFilter,
						dateModeValue: dateFilterMode,
						dateFromValue: dateFilterFrom,
						dateToValue: dateFilterTo,
						timeFromValue: dateFilterTimeFrom,
						timeToValue: dateFilterTimeTo,
						groupByValue: groupBy,
						signal: exportAbortController.signal,
					});

				if (cancelled) {
					return;
				}

				setDispatchExportSourceRows(
					fullRows
				);

				await loadDispatchExportDriverLookup(
					fullRows
				);
			} catch (error) {
				if (!cancelled && error?.name !== "AbortError") {
					console.error(
						"Unable to load complete Dispatch Report source:",
						error
					);
				}
			} finally {
				if (!cancelled) {
					setDispatchExportSourceLoading(false);
				}
			}
		};

		loadFullExportSource();

		return () => {
			cancelled = true;
			exportAbortController.abort();
		};
	}, [
		dispatchExportOpen,
		dispatchExportStatus,
		search,
		plantFilter,
		dateFilterMode,
		dateFilterFrom,
		dateFilterTo,
		dateFilterTimeFrom,
		dateFilterTimeTo,
		groupBy,
	]);

	const dispatchExportPreviewRows =
		useMemo(() => {
			return buildDispatchExportRows(
				dispatchExportStatus,
				dispatchExportDriverLookup,
				dispatchExportSourceRows
			);
		}, [
			dispatchExportSourceRows,
			dispatchExportStatus,
			dispatchExportDriverLookup,
		]);

	const formatDispatchPreviewValue = (
		value
	) => {
		if (
			value instanceof Date &&
			!Number.isNaN(value.getTime())
		) {
			return value.toLocaleDateString(
				"en-GB",
				{
					day: "2-digit",
					month: "short",
					year: "numeric",
				}
			);
		}

		const cleanValue =
			cleanDispatchExportText(
				value
			);

		return cleanValue || "—";
	};

	const csvEscape = (
		value
	) => {
		let finalValue = value;

		if (
			value instanceof Date &&
			!Number.isNaN(value.getTime())
		) {
			finalValue =
				value.toLocaleDateString(
					"en-GB"
				);
		}

		const text =
			cleanDispatchExportText(
				finalValue
			);

		return `"${text.replace(
			/"/g,
			'""'
		)}"`;
	};

	const downloadDispatchBlob = ({
		blob,
		fileName,
	}) => {
		const url =
			URL.createObjectURL(blob);

		const anchor =
			document.createElement("a");

		anchor.href = url;
		anchor.download = fileName;

		document.body.appendChild(
			anchor
		);

		anchor.click();
		anchor.remove();

		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 10000);
	};

	/*
	 * Excel status formatting.
	 */
	const getDispatchExcelStatusStyle = (
		status
	) => {
		const cleanStatus =
			String(status || "")
				.trim()
				.toUpperCase();

		if (cleanStatus === "DISPATCHED") {
			return {
				fill: "FFD1FAE5",
				font: "FF047857",
			};
		}

		if (
			cleanStatus ===
			"READY_TO_DISPATCH"
		) {
			return {
				fill: "FFDBEAFE",
				font: "FF1D4ED8",
			};
		}

		if (cleanStatus === "READY") {
			return {
				fill: "FFFEF3C7",
				font: "FF92400E",
			};
		}

		if (
			cleanStatus ===
			"READY_TO_STORE" ||
			cleanStatus ===
			"WAREHOUSE_REQUESTED"
		) {
			return {
				fill: "FFFFEDD5",
				font: "FFC2410C",
			};
		}

		if (
			cleanStatus ===
			"IN_WAREHOUSE"
		) {
			return {
				fill: "FFEDE9FE",
				font: "FF6D28D9",
			};
		}

		if (
			cleanStatus ===
			"WAREHOUSE_RETURN_REQUESTED"
		) {
			return {
				fill: "FFFEE2E2",
				font: "FFB91C1C",
			};
		}

		if (
			cleanStatus === "LOADED" ||
			cleanStatus ===
			"OUT_FOR_DELIVERY"
		) {
			return {
				fill: "FFE0F2FE",
				font: "FF0369A1",
			};
		}

		if (
			cleanStatus === "DELIVERED"
		) {
			return {
				fill: "FFDCFCE7",
				font: "FF166534",
			};
		}

		if (
			cleanStatus === "RESTORED"
		) {
			return {
				fill: "FFF3E8FF",
				font: "FF7E22CE",
			};
		}

		return {
			fill: "FFF1F5F9",
			font: "FF475569",
		};
	};

	/*
	 * Creates one professionally formatted workbook sheet.
	 */
	const createDispatchExcelSheet = ({
		workbook,
		sheetName,
		title,
		subtitle,
		sourceRows,
		accentColor,
		driverLookup,
	}) => {
		const worksheet =
			workbook.addWorksheet(
				sheetName,
				{
					properties: {
						defaultRowHeight: 20,
						tabColor: {
							argb: accentColor,
						},
					},
					views: [
						{
							state: "frozen",
							ySplit: 5,
							activeCell: "A6",
							showGridLines: false,
						},
					],
				}
			);

		worksheet.pageSetup = {
			paperSize: 9,
			orientation: "landscape",
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			horizontalCentered: true,
			printTitlesRow: "1:5",

			margins: {
				left: 0.25,
				right: 0.25,
				top: 0.5,
				bottom: 0.5,
				header: 0.2,
				footer: 0.2,
			},
		};

		worksheet.headerFooter.oddFooter =
			"&LALSORG&CPage &P of &N&RDispatch Register";

		dispatchExportColumns.forEach(
			(column, index) => {
				worksheet.getColumn(
					index + 1
				).width = column.width;
			}
		);

		/*
		 * Report title.
		 */
		worksheet.mergeCells("A1:L1");

		const titleCell =
			worksheet.getCell("A1");

		titleCell.value = title;

		titleCell.font = {
			name: "Calibri",
			size: 20,
			bold: true,
			color: {
				argb: "FFFFFFFF",
			},
		};

		titleCell.alignment = {
			horizontal: "left",
			vertical: "middle",
		};

		titleCell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: {
				argb: "FF0F172A",
			},
		};

		titleCell.border = {
			bottom: {
				style: "thick",
				color: {
					argb: accentColor,
				},
			},
		};

		worksheet.getRow(1).height = 34;

		/*
		 * Subtitle.
		 */
		worksheet.mergeCells("A2:L2");

		const subtitleCell =
			worksheet.getCell("A2");

		subtitleCell.value = subtitle;

		subtitleCell.font = {
			name: "Calibri",
			size: 11,
			italic: true,
			color: {
				argb: "FF475569",
			},
		};

		subtitleCell.alignment = {
			vertical: "middle",
		};

		subtitleCell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: {
				argb: "FFF8FAFC",
			},
		};

		worksheet.getRow(2).height = 24;

		/*
		 * Summary strip.
		 */
		worksheet.mergeCells("A3:D3");
		worksheet.mergeCells("E3:H3");
		worksheet.mergeCells("I3:L3");

		const generatedAt =
			new Date().toLocaleString(
				"en-IN",
				{
					day: "2-digit",
					month: "short",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				}
			);

		worksheet.getCell("A3").value =
			`Total Records: ${sourceRows.length}`;

		worksheet.getCell("E3").value =
			`Generated: ${generatedAt}`;

		worksheet.getCell("I3").value =
			[
				search
					? `Search: ${search}`
					: "Search: None",

				dateFilterActive
					? `Date: ${dateFilterSummary}`
					: "Date: All",
			]
				.join(" | ");

		["A3", "E3", "I3"].forEach(
			(cellReference) => {
				const cell =
					worksheet.getCell(
						cellReference
					);

				cell.font = {
					name: "Calibri",
					size: 10,
					bold: true,
					color: {
						argb: "FF334155",
					},
				};

				cell.alignment = {
					vertical: "middle",
					horizontal: "left",
				};

				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: {
						argb: "FFE2E8F0",
					},
				};

				cell.border = {
					top: {
						style: "thin",
						color: {
							argb:
								"FFCBD5E1",
						},
					},
					bottom: {
						style: "thin",
						color: {
							argb:
								"FFCBD5E1",
						},
					},
				};
			}
		);

		worksheet.getRow(3).height = 22;
		worksheet.getRow(4).height = 8;

		/*
		 * Header row.
		 */
		const headerRowNumber = 5;

		const headerRow =
			worksheet.getRow(
				headerRowNumber
			);

		headerRow.values = [
			"",
			...dispatchExportColumns.map(
				(column) => column.header
			),
		];

		/*
		 * Because ExcelJS row.values can use a one-based array,
		 * explicitly set each cell to prevent an accidental blank
		 * first column.
		 */
		dispatchExportColumns.forEach(
			(column, index) => {
				headerRow.getCell(
					index + 1
				).value = column.header;
			}
		);

		headerRow.height = 28;

		headerRow.eachCell(
			{
				includeEmpty: true,
			},
			(cell) => {
				cell.font = {
					name: "Calibri",
					size: 11,
					bold: true,
					color: {
						argb: "FFFFFFFF",
					},
				};

				cell.alignment = {
					horizontal: "center",
					vertical: "middle",
					wrapText: true,
				};

				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: {
						argb: accentColor,
					},
				};

				cell.border = {
					top: {
						style: "thin",
						color: {
							argb:
								"FFFFFFFF",
						},
					},
					left: {
						style: "thin",
						color: {
							argb:
								"FFD1D5DB",
						},
					},
					bottom: {
						style: "thin",
						color: {
							argb:
								"FFD1D5DB",
						},
					},
					right: {
						style: "thin",
						color: {
							argb:
								"FFD1D5DB",
						},
					},
				};
			}
		);

		/*
		 * Data rows.
		 */
		sourceRows.forEach(
			(sourceRow, index) => {
				const rowValues =
					dispatchExportColumns.map(
						(column) =>
							column.getValue(
								sourceRow,
								{
									driverLookup,
								}
							)
					);

				const excelRow =
					worksheet.addRow(
						rowValues
					);

				excelRow.height = 31;

				const evenRow =
					index % 2 === 1;

				excelRow.eachCell(
					{
						includeEmpty: true,
					},
					(cell, columnNumber) => {
						cell.font = {
							name: "Calibri",
							size: 10,
							color: {
								argb:
									"FF1E293B",
							},
						};

						cell.fill = {
							type: "pattern",
							pattern: "solid",
							fgColor: {
								argb: evenRow
									? "FFF8FAFC"
									: "FFFFFFFF",
							},
						};

						cell.border = {
							top: {
								style: "thin",
								color: {
									argb:
										"FFE2E8F0",
								},
							},
							left: {
								style: "thin",
								color: {
									argb:
										"FFE2E8F0",
								},
							},
							bottom: {
								style: "thin",
								color: {
									argb:
										"FFE2E8F0",
								},
							},
							right: {
								style: "thin",
								color: {
									argb:
										"FFE2E8F0",
								},
							},
						};

						cell.alignment = {
							vertical: "middle",

							horizontal:
								columnNumber === 1 ||
									columnNumber === 2
									? "center"
									: "left",

							wrapText:
								[
									4,
									8,
									11,
								].includes(
									columnNumber
								),
						};
					}
				);

				/*
				 * Genuine Excel date formatting.
				 */
				excelRow.getCell(1).numFmt =
					"dd-mmm-yyyy";

				excelRow.getCell(2).numFmt =
					"dd-mmm-yyyy";

				/*
				 * Force identifiers to remain text.
				 * This prevents PD/DWG/packet values such as 01/02
				 * from being converted into dates by Excel.
				 */
				[
					3,
					5,
					7,
				].forEach(
					(columnNumber) => {
						excelRow.getCell(
							columnNumber
						).numFmt = "@";
					}
				);

				/*
				 * Status cell styling.
				 */
				const statusStyle =
					getDispatchExcelStatusStyle(
						sourceRow?.status
					);

				const statusCell =
					excelRow.getCell(10);

				statusCell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: {
						argb:
							statusStyle.fill,
					},
				};

				statusCell.font = {
					name: "Calibri",
					size: 10,
					bold: true,
					color: {
						argb:
							statusStyle.font,
					},
				};

				statusCell.alignment = {
					horizontal: "center",
					vertical: "middle",
					wrapText: true,
				};
			}
		);

		/*
		 * Keep both sheets available even when one category has no rows.
		 */
		if (sourceRows.length === 0) {
			worksheet.mergeCells("A6:L6");

			const emptyCell =
				worksheet.getCell("A6");

			emptyCell.value =
				"No records matched this sheet.";

			emptyCell.font = {
				name: "Calibri",
				size: 11,
				italic: true,
				color: {
					argb: "FF64748B",
				},
			};

			emptyCell.alignment = {
				horizontal: "center",
				vertical: "middle",
			};

			emptyCell.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: {
					argb: "FFF8FAFC",
				},
			};

			worksheet.getRow(6).height = 34;
		}

		const finalRow =
			Math.max(
				headerRowNumber,
				worksheet.rowCount
			);

		worksheet.autoFilter = {
			from: {
				row: headerRowNumber,
				column: 1,
			},
			to: {
				row: finalRow,
				column:
					dispatchExportColumns.length,
			},
		};

		worksheet.printArea =
			`A1:L${finalRow}`;

		return worksheet;
	};

	/*
	 * Generates the real XLSX workbook.
	 */
	const exportDispatchExcelWorkbook =
		async (
			driverLookup,
			sourceRowsOverride = null
		) => {
			const scopedRows =
				getDispatchExportSourceRows(
					dispatchExportStatus,
					sourceRowsOverride
				);

			if (scopedRows.length === 0) {
				throw new Error(
					"No rows found for selected export status"
				);
			}

			const dispatchedRows =
				scopedRows
					.filter((row) =>
						isDispatchedExcelStatus(
							row?.status
						)
					)
					.sort((a, b) => {
						return (
							getDispatchExportDateValue(
								b?.dispatchedAt
							) -
							getDispatchExportDateValue(
								a?.dispatchedAt
							)
						);
					});

			const otherStatusRows =
				scopedRows
					.filter(
						(row) =>
							!isDispatchedExcelStatus(
								row?.status
							)
					)
					.sort((a, b) => {
						const statusCompare =
							String(
								a?.status || ""
							).localeCompare(
								String(
									b?.status || ""
								)
							);

						if (statusCompare !== 0) {
							return statusCompare;
						}

						return (
							getDispatchExportDateValue(
								b?.packedAt
							) -
							getDispatchExportDateValue(
								a?.packedAt
							)
						);
					});

			/*
			 * ExcelJS is used only when the user exports a workbook.
			 * Dynamic loading keeps it out of the initial page module and
			 * avoids unnecessary production-bundle initialization coupling.
			 */
			const excelJsModule =
				await import(
					"exceljs"
				);

			const ExcelJS =
				excelJsModule.default ??
				excelJsModule;

			const workbook =
				new ExcelJS.Workbook();

			workbook.creator =
				"ALSORG PackFlow";

			workbook.lastModifiedBy =
				firstDispatchExportValue(
					currentUser?.username,
					currentUser?.name,
					localStorage.getItem(
						"username"
					),
					"ALSORG"
				);

			workbook.company = "ALSORG";
			workbook.title =
				"Dispatch Register";

			workbook.subject =
				"Dispatch and inventory status register";

			workbook.category =
				"Dispatch Report";

			workbook.description =
				"ALSORG Dispatch Register with dispatched and other status records on separate worksheets.";

			workbook.keywords =
				"ALSORG, Dispatch, Packing, Warehouse, Register";

			workbook.created =
				new Date();

			workbook.modified =
				new Date();

			createDispatchExcelSheet({
				workbook,
				sheetName: "Dispatched",
				title:
					"ALSORG DISPATCH REGISTER — DISPATCHED",
				subtitle:
					"Records whose current status is DISPATCHED",
				sourceRows: dispatchedRows,
				accentColor: "FF059669",
				driverLookup,
			});

			createDispatchExcelSheet({
				workbook,
				sheetName: "Other Status",
				title:
					"ALSORG DISPATCH REGISTER — OTHER STATUS",
				subtitle:
					"Packed, warehouse, ready-to-dispatch, restored and all non-dispatched records",
				sourceRows: otherStatusRows,
				accentColor: "FF2563EB",
				driverLookup,
			});

			const workbookBuffer =
				await workbook.xlsx.writeBuffer();

			const blob =
				new Blob(
					[workbookBuffer],
					{
						type:
							"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}
				);

			downloadDispatchBlob({
				blob,
				fileName:
					"Dispatch Register.xlsx",
			});
		};

	/*
	 * Main modal export action.
	 *
	 * CSV is preserved for backward compatibility.
	 * Excel generates the requested two-sheet workbook.
	 */
	const exportDispatchData =
		async () => {
			try {
				setDispatchExportLoading(
					true
				);

				/*
				 * Always fetch fresh challan history immediately
				 * before creating the file.
				 *
				 * Do not rely only on React state because setState
				 * is asynchronous.
				 */
				let scopedSourceRows =
					Array.isArray(dispatchExportSourceRows)
						? dispatchExportSourceRows
						: null;

				if (!scopedSourceRows) {
					scopedSourceRows =
						await fetchAllMatchingDispatchRows({
							searchValue: search,
							statusValue: dispatchExportStatus,
							plantValue: plantFilter,
							dateModeValue: dateFilterMode,
							dateFromValue: dateFilterFrom,
							dateToValue: dateFilterTo,
							timeFromValue: dateFilterTimeFrom,
							timeToValue: dateFilterTimeTo,
							groupByValue: groupBy,
						});
				}

				const freshDriverLookup =
					await loadDispatchExportDriverLookup(
						scopedSourceRows
					);

				const exportRows =
					buildDispatchExportRows(
						dispatchExportStatus,
						freshDriverLookup,
						scopedSourceRows
					);

				if (exportRows.length === 0) {
					throw new Error(
						"No rows found for selected export status"
					);
				}

				if (
					dispatchExportFormat ===
					"CSV"
				) {
					const headers =
						dispatchExportColumns.map(
							(column) =>
								column.header
						);

					const csv =
						"\uFEFF" +
						[
							headers
								.map(csvEscape)
								.join(","),

							...exportRows.map(
								(row) =>
									dispatchExportColumns
										.map(
											(column) =>
												csvEscape(
													row[
													column.key
													]
												)
										)
										.join(",")
							),
						].join("\n");

					const csvBlob =
						new Blob(
							[csv],
							{
								type:
									"text/csv;charset=utf-8;",
							}
						);

					downloadDispatchBlob({
						blob: csvBlob,
						fileName:
							"Dispatch Register.csv",
					});
				} else {
					await exportDispatchExcelWorkbook(
						freshDriverLookup,
						scopedSourceRows
					);
				}

				setDispatchExportOpen(
					false
				);
			} catch (error) {
				console.error(
					"Dispatch export failed:",
					error
				);

				alert(
					error?.message ||
					"Dispatch export failed"
				);
			} finally {
				setDispatchExportLoading(
					false
				);
			}
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

	const normalizeFetchedDispatchRows = (
		data
	) => {
		if (!Array.isArray(data)) {
			return [];
		}

		return data
			.filter((item) => {
				return Boolean(
					String(
						item?.zohoItemId ||
						""
					).trim()
				);
			})
			.map((item) => {
				const itemType =
					resolveDispatchItemType(
						item
					);

				const displayName =
					String(
						item?.name ||
						item?.itemName ||
						""
					).trim();

				const normalizedRow = {
					...item,

					zohoItemId:
						String(
							item.zohoItemId
						).trim(),

					name:
						displayName ||
						"Unnamed Item",

					itemName:
						String(
							item?.itemName ||
							item?.name ||
							""
						).trim(),

					stock:
						item.stock ?? 0,

					status:
						String(
							item.status || ""
						)
							.trim()
							.toUpperCase(),

					itemType,

					packetItemId:
						item?.packetItemId ||
						item?.itemId ||
						"",

					linkedPacketItemId:
						item?.linkedPacketItemId ||
						null,

					linkedMasterItemId:
						item?.linkedMasterItemId ||
						null,

					hardwarePacket:
						itemType ===
						"HARDWARE",
				};

				return attachDispatchSearchIndex(
					normalizedRow
				);
			});
	};

	const toOptionalNonNegativeInteger = (
		value
	) => {
		if (
			value === null ||
			value === undefined ||
			String(value).trim() === ""
		) {
			return null;
		}

		const parsed =
			Number(value);

		return (
			Number.isInteger(parsed) &&
			parsed >= 0
		)
			? parsed
			: null;
	};

	const toOptionalBoolean = (
		value
	) => {
		if (
			value === null ||
			value === undefined ||
			String(value).trim() === ""
		) {
			return null;
		}

		const normalized =
			String(value)
				.trim()
				.toLowerCase();

		if (normalized === "true") {
			return true;
		}

		if (normalized === "false") {
			return false;
		}

		return null;
	};

	const extractDispatchPageData = (
		payload
	) => {
		/*
		 * Current backend response:
		 *
		 * [
		 *   {...},
		 *   {...}
		 * ]
		 */
		if (Array.isArray(payload)) {
			return {
				items: payload,
				totalPages: null,
				totalElements: null,
				last: null,
			};
		}

		/*
		 * Spring Page or custom page response.
		 */
		const items =
			Array.isArray(payload?.content)
				? payload.content
				: Array.isArray(payload?.items)
					? payload.items
					: Array.isArray(payload?.data)
						? payload.data
						: null;

		if (!Array.isArray(items)) {
			throw new Error(
				"Backend returned an invalid dispatched-items page"
			);
		}

		const rawLast =
			payload?.last ??
			payload?.page?.last;

		return {
			items,

			totalPages:
				toOptionalNonNegativeInteger(
					payload?.totalPages ??
					payload?.page?.totalPages
				),

			totalElements:
				toOptionalNonNegativeInteger(
					payload?.totalElements ??
					payload?.page?.totalElements
				),

			last:
				typeof rawLast === "boolean"
					? rawLast
					: null,
		};
	};

	/*
	 * The former eager all-history loader was intentionally removed.
	 * Full-result fetching now exists only in fetchAllMatchingDispatchRows(),
	 * which is invoked explicitly by Export / Select All Matching.
	 */

	const buildDispatchServerQuerySignature = ({
		searchValue = dispatchServerSearch,
		statusValue = statusFilter,
		plantValue = plantFilter,
		dateModeValue = dateFilterMode,
		dateFromValue = dateFilterFrom,
		dateToValue = dateFilterTo,
		timeFromValue = dateFilterTimeFrom,
		timeToValue = dateFilterTimeTo,
		groupByValue = groupBy,
	} = {}) => {
		return JSON.stringify([
			String(searchValue || "").trim(),
			normalizeStatusSelection(statusValue).join(","),
			String(plantValue || "ALL").trim().toUpperCase(),
			String(dateModeValue || "ACTIVITY").trim().toUpperCase(),
			String(dateFromValue || "").trim(),
			String(dateToValue || "").trim(),
			String(timeFromValue || "").trim(),
			String(timeToValue || "").trim(),
			String(groupByValue || "NONE").trim().toUpperCase(),
		]);
	};

	const buildDispatchServerQuery = ({
		backendPage,
		size,
		searchValue = dispatchServerSearch,
		statusValue = statusFilter,
		plantValue = plantFilter,
		dateModeValue = dateFilterMode,
		dateFromValue = dateFilterFrom,
		dateToValue = dateFilterTo,
		timeFromValue = dateFilterTimeFrom,
		timeToValue = dateFilterTimeTo,
		groupByValue = groupBy,
		includeTotal = true,
		knownTotalElements = null,
	}) => {
		const statuses = normalizeStatusSelection(statusValue);

		const params = new URLSearchParams({
			page: String(Math.max(0, Number(backendPage) || 0)),
			size: String(Math.max(1, Number(size) || pageSize)),
			search: String(searchValue || "").trim(),
			statuses: statuses.join(","),
			plant: String(plantValue || "ALL").trim(),
			dateMode: String(dateModeValue || "ACTIVITY").trim(),
			dateFrom: String(dateFromValue || "").trim(),
			dateTo: String(dateToValue || "").trim(),
			timeFrom: String(timeFromValue || "").trim(),
			timeTo: String(timeToValue || "").trim(),
			groupBy: String(groupByValue || "NONE").trim(),
			includeTotal: String(includeTotal !== false),
		});

		const hasKnownTotal =
			knownTotalElements !== null &&
			knownTotalElements !== undefined &&
			String(knownTotalElements).trim() !== "";

		const cleanKnownTotal = hasKnownTotal
			? Number(knownTotalElements)
			: Number.NaN;

		if (
			includeTotal === false &&
			Number.isSafeInteger(cleanKnownTotal) &&
			cleanKnownTotal >= 0
		) {
			params.set(
				"knownTotalElements",
				String(cleanKnownTotal)
			);
		}

		return params;
	};

	const getDispatchPageCacheKey = (
		signature,
		backendPage,
		size
	) => `${signature}|${Number(size) || 0}|${Number(backendPage) || 0}`;

	const putDispatchPageCache = (
		cacheKey,
		value
	) => {
		const cache = dispatchPageCacheRef.current;

		if (cache.has(cacheKey)) {
			cache.delete(cacheKey);
		}

		cache.set(cacheKey, {
			...value,
			cachedAt: Date.now(),
		});

		while (cache.size > DISPATCH_PAGE_CACHE_LIMIT) {
			const oldestKey = cache.keys().next().value;

			if (oldestKey === undefined) {
				break;
			}

			cache.delete(oldestKey);
		}
	};

	const isDispatchPageCacheFresh = (cached) => {
		const cachedAt = Number(cached?.cachedAt || 0);

		return (
			cachedAt > 0 &&
			Date.now() - cachedAt <= DISPATCH_PAGE_CACHE_FRESH_MS
		);
	};

	const fetchDispatchServerPage =
		async ({
			backendPage,
			size,
			signal,
			searchValue = dispatchServerSearch,
			statusValue = statusFilter,
			plantValue = plantFilter,
			dateModeValue = dateFilterMode,
			dateFromValue = dateFilterFrom,
			dateToValue = dateFilterTo,
			timeFromValue = dateFilterTimeFrom,
			timeToValue = dateFilterTimeTo,
			groupByValue = groupBy,
			includeTotal = true,
			knownTotalElements = null,
		}) => {
			const query = buildDispatchServerQuery({
				backendPage,
				size,
				searchValue,
				statusValue,
				plantValue,
				dateModeValue,
				dateFromValue,
				dateToValue,
				timeFromValue,
				timeToValue,
				groupByValue,
				includeTotal,
				knownTotalElements,
			});

			const response = await authFetch(
				`${API_BASE_URL}/api/dispatched/search?${query.toString()}`,
				{
					method: "GET",
					headers: {
						Accept: "application/json",
					},
					cache: "no-store",
					signal,
				}
			);

			if (!response.ok) {
				const message = await readResponseError(
					response,
					`Failed to load dispatch page ${Number(backendPage || 0) + 1}`
				);

				throw new Error(message);
			}

			const payload = await response.json();
			const parsed = extractDispatchPageData(payload);

			const headerTotalPages =
				toOptionalNonNegativeInteger(
					response.headers.get("X-Total-Pages")
				);

			const headerTotalElements =
				toOptionalNonNegativeInteger(
					response.headers.get("X-Total-Elements")
				);

			const headerPageNumber =
				toOptionalNonNegativeInteger(
					response.headers.get("X-Page-Number")
				);

			const headerPageSize =
				toOptionalNonNegativeInteger(
					response.headers.get("X-Page-Size")
				);

			const headerHasNext =
				toOptionalBoolean(
					response.headers.get("X-Has-Next")
				);

			const headerCountReused =
				toOptionalBoolean(
					response.headers.get("X-Dispatch-Count-Reused")
				);

			const cleanRows = normalizeFetchedDispatchRows(
				parsed.items
			);

			return {
				page:
					headerPageNumber ??
					Math.max(0, Number(backendPage) || 0),
				pageSize:
					headerPageSize ??
					Math.max(1, Number(size) || pageSize),
				items: cleanRows,
				totalPages:
					parsed.totalPages ??
					headerTotalPages ??
					(cleanRows.length < Number(size) ? 1 : null),
				totalElements:
					parsed.totalElements ??
					headerTotalElements,
				last:
					parsed.last !== null
						? parsed.last
						: headerHasNext !== null
							? !headerHasNext
							: cleanRows.length < Number(size),
				countReused: headerCountReused === true,
			};
		};

	const prefetchDispatchServerPage = ({
		backendPage,
		size,
		signature,
		searchValue = dispatchServerSearch,
		statusValue = statusFilter,
		plantValue = plantFilter,
		dateModeValue = dateFilterMode,
		dateFromValue = dateFilterFrom,
		dateToValue = dateFilterTo,
		timeFromValue = dateFilterTimeFrom,
		timeToValue = dateFilterTimeTo,
		groupByValue = groupBy,
		knownTotalElements = null,
	}) => {
		if (backendPage < 0) {
			return;
		}

		const cacheKey = getDispatchPageCacheKey(
			signature,
			backendPage,
			size
		);

		if (dispatchPageCacheRef.current.has(cacheKey)) {
			return;
		}

		dispatchPrefetchAbortRef.current?.abort();

		const controller = new AbortController();
		dispatchPrefetchAbortRef.current = controller;

		window.setTimeout(async () => {
			try {
				const result = await fetchDispatchServerPage({
					backendPage,
					size,
					signal: controller.signal,
					searchValue,
					statusValue,
					plantValue,
					dateModeValue,
					dateFromValue,
					dateToValue,
					timeFromValue,
					timeToValue,
					groupByValue,
					includeTotal: false,
					knownTotalElements,
				});

				putDispatchPageCache(
					cacheKey,
					result
				);
			} catch (error) {
				if (error?.name !== "AbortError") {
					console.debug(
						"Dispatch next-page prefetch skipped:",
						error
					);
				}
			} finally {
				if (
					dispatchPrefetchAbortRef.current === controller
				) {
					dispatchPrefetchAbortRef.current = null;
				}
			}
		}, 0);
	};

	/*
	 * Explicit full-result loader.
	 *
	 * This is intentionally NOT used by normal page rendering.  It exists for
	 * operations whose original semantics genuinely require all matching rows,
	 * such as Export and Select All Matching.
	 */
	const fetchAllMatchingDispatchRows =
		async ({
			searchValue = search,
			statusValue = statusFilter,
			plantValue = plantFilter,
			dateModeValue = dateFilterMode,
			dateFromValue = dateFilterFrom,
			dateToValue = dateFilterTo,
			timeFromValue = dateFilterTimeFrom,
			timeToValue = dateFilterTimeTo,
			groupByValue = groupBy,
			onProgress,
			signal: externalSignal = null,
		} = {}) => {
			const controller = externalSignal
				? null
				: new AbortController();

			const signal = externalSignal || controller.signal;

			const firstPage = await fetchDispatchServerPage({
				backendPage: 0,
				size: DISPATCH_BACKEND_BATCH_SIZE,
				signal,
				searchValue,
				statusValue,
				plantValue,
				dateModeValue,
				dateFromValue,
				dateToValue,
				timeFromValue,
				timeToValue,
				groupByValue,
				includeTotal: true,
			});

			const pageMap = new Map([[0, firstPage.items]]);
			const totalPages = Math.min(
				DISPATCH_BACKEND_MAX_PAGES,
				Math.max(
					1,
					Number(firstPage.totalPages || 1)
				)
			);

			onProgress?.({
				loadedPages: 1,
				totalPages,
				loadedRows: firstPage.items.length,
				totalRows: firstPage.totalElements,
			});

			if (totalPages > 1) {
				const remainingPages = Array.from(
					{ length: totalPages - 1 },
					(_, index) => index + 1
				);

				let nextIndex = 0;
				let loadedRows = firstPage.items.length;

				const worker = async () => {
					while (nextIndex < remainingPages.length) {
						const index = nextIndex++;
						const backendPage = remainingPages[index];

						const result = await fetchDispatchServerPage({
							backendPage,
							size: DISPATCH_BACKEND_BATCH_SIZE,
							signal,
							searchValue,
							statusValue,
							plantValue,
							dateModeValue,
							dateFromValue,
							dateToValue,
							timeFromValue,
							timeToValue,
							groupByValue,
							includeTotal: false,
							knownTotalElements: firstPage.totalElements,
						});

						pageMap.set(backendPage, result.items);
						loadedRows += result.items.length;

						onProgress?.({
							loadedPages: pageMap.size,
							totalPages,
							loadedRows,
							totalRows:
								firstPage.totalElements ?? loadedRows,
						});
					}
				};

				const workerCount = Math.min(
					DISPATCH_FETCH_CONCURRENCY,
					remainingPages.length
				);

				await Promise.all(
					Array.from(
						{ length: workerCount },
						() => worker()
					)
				);
			}

			const rowsById = new Map();

			Array.from(pageMap.entries())
				.sort(([pageA], [pageB]) => pageA - pageB)
				.forEach(([, pageRows]) => {
					pageRows.forEach((row) => {
						const id = String(
							row?.zohoItemId || ""
						).trim();

						if (id) {
							rowsById.set(id, row);
						}
					});
				});

			return Array.from(rowsById.values());
		};

	const fetchData =
		async ({ preferCache = false } = {}) => {
			const requestId =
				++dispatchFetchRequestRef.current;

			const backendPage = Math.max(
				0,
				Number(pageNo || 1) - 1
			);

			const signature =
				buildDispatchServerQuerySignature();

			const cacheKey = getDispatchPageCacheKey(
				signature,
				backendPage,
				pageSize
			);

			const cached =
				dispatchPageCacheRef.current.get(cacheKey);

			const existingRowsSnapshot =
				Array.isArray(rows)
					? rows
					: [];

			const sameSignature =
				dispatchServerMeta.signature === signature;

			const rawKnownTotal = Number(
				dispatchServerMeta.totalElements
			);

			const knownTotalFresh =
				sameSignature &&
				Number.isSafeInteger(rawKnownTotal) &&
				rawKnownTotal >= 0 &&
				dispatchServerTotalKnownAtRef.current > 0 &&
				Date.now() - dispatchServerTotalKnownAtRef.current <=
					DISPATCH_TOTAL_REUSE_FRESH_MS;

			const knownTotalElements = knownTotalFresh
				? rawKnownTotal
				: null;

			dispatchFetchAbortRef.current?.abort();
			dispatchPrefetchAbortRef.current?.abort();

			setDispatchSearchNetworkPending(
				Boolean(
					String(
						dispatchServerSearch || ""
					).trim()
				)
			);

			/*
			 * A prefetched page that is still fresh is already an authoritative
			 * server response for the same filter signature. Use it directly
			 * instead of immediately issuing the exact same SQL query again.
			 */
			if (
				preferCache &&
				cached &&
				isDispatchPageCacheFresh(cached)
			) {
				const cachedTotalPages = Math.max(
					1,
					Number(cached.totalPages || 1)
				);

				const cachedTotalRows =
					cached.totalElements ?? cached.items.length;

				setRows(cached.items);
				setDispatchServerMeta({
					totalElements: cachedTotalRows,
					totalPages: cachedTotalPages,
					pageNumber: cached.page ?? backendPage,
					pageSize: cached.pageSize ?? pageSize,
					signature,
				});

				setDispatchLoadProgress({
					loadedRows: cached.items.length,
					totalRows: cachedTotalRows,
					loadedPages: 1,
					totalPages: cachedTotalPages,
				});

				setLoading(false);
				setDispatchSearchNetworkPending(false);

				if (backendPage + 1 < cachedTotalPages) {
					prefetchDispatchServerPage({
						backendPage: backendPage + 1,
						size: pageSize,
						signature,
						knownTotalElements:
							cached.totalElements ?? knownTotalElements,
					});
				}

				return cached.items;
			}

			const abortController = new AbortController();
			dispatchFetchAbortRef.current = abortController;

			/*
			 * A stale cache may still paint immediately while the server refreshes.
			 * Explicit refreshes/mutations pass preferCache=false and therefore do
			 * not rely on stale cached data for the authoritative count.
			 */
			if (preferCache && cached) {
				setRows(cached.items);
				setDispatchServerMeta({
					totalElements:
						cached.totalElements ?? cached.items.length,
					totalPages:
						Math.max(1, Number(cached.totalPages || 1)),
					pageNumber: cached.page ?? backendPage,
					pageSize: cached.pageSize ?? pageSize,
					signature,
				});

				setDispatchLoadProgress({
					loadedRows: cached.items.length,
					totalRows:
						cached.totalElements ?? cached.items.length,
					loadedPages: 1,
					totalPages:
						Math.max(1, Number(cached.totalPages || 1)),
				});

				setLoading(false);
			} else {
				setLoading(true);
			}

			try {
				/*
				 * Page navigation can reuse a very recent total for the exact same
				 * filter signature. That removes Spring Data's repeated COUNT(*)
				 * while preserving a fresh count on first load and explicit refresh.
				 */
				const reuseKnownTotal =
					preferCache && knownTotalElements !== null;

				const result = await fetchDispatchServerPage({
					backendPage,
					size: pageSize,
					signal: abortController.signal,
					includeTotal: !reuseKnownTotal,
					knownTotalElements:
						reuseKnownTotal ? knownTotalElements : null,
				});

				if (
					requestId !== dispatchFetchRequestRef.current
				) {
					return result.items;
				}

				putDispatchPageCache(
					cacheKey,
					result
				);

				result.items.forEach((row) => {
					const id = String(
						row?.zohoItemId || ""
					).trim();

					if (
						id &&
						selectionIdSet.has(id)
					) {
						dispatchSelectedRowCacheRef.current.set(
							id,
							row
						);
					}
				});

				const totalResultPages = Math.max(
					1,
					Number(result.totalPages || 1)
				);

				const totalResultRows =
					result.totalElements ?? result.items.length;

				if (!result.countReused) {
					dispatchServerTotalKnownAtRef.current = Date.now();
				}

				setRows(result.items);
				setDispatchServerMeta({
					totalElements: totalResultRows,
					totalPages: totalResultPages,
					pageNumber: result.page ?? backendPage,
					pageSize: result.pageSize ?? pageSize,
					signature,
				});

				setDispatchLoadProgress({
					loadedRows: result.items.length,
					totalRows: totalResultRows,
					loadedPages: 1,
					totalPages: totalResultPages,
				});

				/*
				 * Prefetch only the next visible page. The prefetched request also
				 * reuses the known total, so it does one content query rather than a
				 * content query plus another full count query.
				 */
				if (backendPage + 1 < totalResultPages) {
					prefetchDispatchServerPage({
						backendPage: backendPage + 1,
						size: pageSize,
						signature,
						knownTotalElements: totalResultRows,
					});
				}

				console.info(
					`Loaded dispatch page ${backendPage + 1}/${totalResultPages}: ${result.items.length} rows of ${totalResultRows}${result.countReused ? " (count reused)" : ""}`
				);

				return result.items;
			} catch (error) {
				if (error?.name === "AbortError") {
					return cached?.items || existingRowsSnapshot;
				}

				console.error(
					"Dispatch server-page fetch failed:",
					error
				);

				/*
				 * Preserve already rendered data if a refresh request temporarily
				 * fails. This avoids a blank page during transient network errors.
				 */
				if (!cached && existingRowsSnapshot.length === 0) {
					setRows([]);
				}

				return cached?.items || existingRowsSnapshot;
			} finally {
				if (
					requestId === dispatchFetchRequestRef.current
				) {
					setLoading(false);
					setDispatchSearchNetworkPending(false);
				}

				if (
					dispatchFetchAbortRef.current === abortController
				) {
					dispatchFetchAbortRef.current = null;
				}
			}
		};

	usePackFlowDataRefresh(
		"dispatch",
		async () => {
			await fetchData();

			/*
			 * Refresh the currently open challan history too,
			 * because rollback can remove logistics-trip and
			 * challan relationships.
			 */
			if (challanHistoryOpen) {
				try {
					const normalRows =
						await fetchChallanHistoryRows();

					setChallanHistoryRows(
						normalRows
					);

					if (
						isDispatch ||
						isAdmin
					) {
						await loadCustomChallans();
					}
				} catch (error) {
					console.error(
						"Challan history refresh failed:",
						error
					);
				}
			}
		}
	);

	const getPlantCodeFromRow = (
		row
	) => {
		return normalizeDispatchPlantCode(
			row?.plantCode
		);
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
						color: "var(--pf-text-muted)",
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

	const normalizeDriversList = (value) => {
		if (!Array.isArray(value)) {
			return [];
		}

		const unique = new Map();

		value.forEach((driver) => {
			if (!driver) {
				return;
			}

			const id =
				String(driver.id || "").trim();

			const name =
				String(driver.name || "").trim();

			if (!id || !name) {
				return;
			}

			unique.set(id, {
				...driver,
				id,
				name,
			});
		});

		return Array.from(unique.values())
			.sort((a, b) =>
				a.name.localeCompare(
					b.name,
					undefined,
					{
						sensitivity: "base",
					}
				)
			);
	};

	const normalizeVehiclesList = (value) => {
		if (!Array.isArray(value)) {
			return [];
		}

		const unique = new Map();

		value.forEach((vehicle) => {
			if (!vehicle) {
				return;
			}

			const id =
				String(vehicle.id || "").trim();

			const vehicleNumber =
				String(
					vehicle.vehicleNumber || ""
				).trim();

			if (!id || !vehicleNumber) {
				return;
			}

			unique.set(id, {
				...vehicle,
				id,
				vehicleNumber,
			});
		});

		return Array.from(unique.values())
			.sort((a, b) =>
				a.vehicleNumber.localeCompare(
					b.vehicleNumber,
					undefined,
					{
						sensitivity: "base",
					}
				)
			);
	};

	const fetchLogisticsMasters = async () => {
		/*
		 * Do not start duplicate master requests. Normal Challan, QR Challan,
		 * Custom Challan and Admin Edit all share the same Driver/Vehicle lists.
		 */
		if (logisticsMastersPromiseRef.current) {
			return logisticsMastersPromiseRef.current;
		}

		setLogisticsMastersLoading(true);

		const request = (async () => {
			const results =
				await Promise.allSettled([
					fetchDrivers(),
					fetchVehicles(),
				]);

			const [
				driverResult,
				vehicleResult,
			] = results;

			/*
			 * Resolve each master independently.
			 *
			 * Previously Promise.all() meant one failed Vehicle request also
			 * erased successfully fetched Drivers (and vice versa), leaving both
			 * dropdowns blank. Preserve the last known good list for whichever
			 * request failed.
			 */
			let cleanDrivers =
				logisticsDrivers;

			let cleanVehicles =
				logisticsVehicles;

			if (
				driverResult.status ===
				"fulfilled"
			) {
				cleanDrivers =
					normalizeDriversList(
						driverResult.value
					);

				setLogisticsDrivers(
					cleanDrivers
				);
			} else {
				console.error(
					"Failed to load driver master",
					driverResult.reason
				);
			}

			if (
				vehicleResult.status ===
				"fulfilled"
			) {
				cleanVehicles =
					normalizeVehiclesList(
						vehicleResult.value
					);

				setLogisticsVehicles(
					cleanVehicles
				);
			} else {
				console.error(
					"Failed to load vehicle master",
					vehicleResult.reason
				);
			}

			return {
				drivers: cleanDrivers,
				vehicles: cleanVehicles,
			};
		})();

		logisticsMastersPromiseRef.current =
			request;

		try {
			return await request;
		} finally {
			if (
				logisticsMastersPromiseRef.current ===
				request
			) {
				logisticsMastersPromiseRef.current =
					null;
			}

			setLogisticsMastersLoading(false);
		}
	};

	const openCreateDriverModal = (target) => {
		setCreateDriverTarget(target);

		setNewDriverForm({
			name: "",
		});

		setCreateDriverOpen(true);
	};

	const closeCreateDriverModal = () => {
		if (createDriverLoading) {
			return;
		}

		setCreateDriverOpen(false);
		setCreateDriverTarget("");

		setNewDriverForm({
			name: "",
		});
	};

	const openCreateVehicleModal = (target) => {
		setCreateVehicleTarget(target);

		setNewVehicleForm({
			vehicleNumber: "",
			vehicleName: "",
			vehicleType: "Other",
		});

		setCreateVehicleOpen(true);
	};

	const closeCreateVehicleModal = () => {
		if (createVehicleLoading) {
			return;
		}

		setCreateVehicleOpen(false);
		setCreateVehicleTarget("");

		setNewVehicleForm({
			vehicleNumber: "",
			vehicleName: "",
			vehicleType: "Other",
		});
	};

	const submitCreateDriver = async () => {
		const cleanName =
			String(newDriverForm.name || "")
				.trim()
				.replace(/\s+/g, " ");

		if (!cleanName) {
			alert("Driver name is required");
			return;
		}

		try {
			setCreateDriverLoading(true);

			const createdDriver =
				await createDriver({
					name: cleanName,
				});

			/*
			 * Refresh from the backend so the dropdown contains
			 * the authoritative saved record.
			 */
			const refreshedDrivers =
				await fetchDrivers();

			const cleanDrivers =
				normalizeDriversList(
					refreshedDrivers
				);

			setLogisticsDrivers(cleanDrivers);

			const selectedDriver =
				cleanDrivers.find(
					(driver) =>
						String(driver.id) ===
						String(createdDriver?.id)
				) ||
				cleanDrivers.find(
					(driver) =>
						driver.name.toLowerCase() ===
						cleanName.toLowerCase()
				);

			if (!selectedDriver) {
				throw new Error(
					"Driver was created but could not be selected"
				);
			}

			if (
				createDriverTarget ===
				MASTER_CREATE_TARGET.DISPATCH_CHALLAN
			) {
				setDispatchTripForm((previous) => ({
					...previous,
					driverId: selectedDriver.id,
				}));
			}

			if (
				createDriverTarget ===
				MASTER_CREATE_TARGET.CUSTOM_CHALLAN
			) {
				setCustomChallanForm((previous) => ({
					...previous,
					driverName: selectedDriver.name,
				}));
			}

			if (
				createDriverTarget ===
				MASTER_CREATE_TARGET.ADMIN_BULK_EDIT
			) {
				setAdminEditForm(
					(previous) => ({
						...previous,

						driverId:
							selectedDriver.id,

						driverName:
							selectedDriver.name,
					})
				);

				setAdminEditApply(
					(previous) => ({
						...previous,
						driver: true,
					})
				);
			}

			setCreateDriverOpen(false);
			setCreateDriverTarget("");

			setNewDriverForm({
				name: "",
			});
		} catch (error) {
			console.error(
				"Driver creation failed",
				error
			);

			alert(
				error.message ||
				"Driver creation failed"
			);
		} finally {
			setCreateDriverLoading(false);
		}
	};

	const submitCreateVehicle = async () => {
		const cleanVehicleNumber =
			String(
				newVehicleForm.vehicleNumber || ""
			)
				.trim()
				.toUpperCase()
				.replace(/\s+/g, "");

		const cleanVehicleName =
			String(
				newVehicleForm.vehicleName || ""
			)
				.trim()
				.replace(/\s+/g, " ");

		const cleanVehicleType =
			String(
				newVehicleForm.vehicleType ||
				"Other"
			)
				.trim()
				.replace(/\s+/g, " ");

		if (!cleanVehicleNumber) {
			alert("Vehicle number is required");
			return;
		}

		if (!cleanVehicleType) {
			alert("Vehicle type is required");
			return;
		}

		try {
			setCreateVehicleLoading(true);

			const createdVehicle =
				await createVehicle({
					vehicleNumber: cleanVehicleNumber,
					vehicleName:
						cleanVehicleName || null,
					vehicleType: cleanVehicleType,
					status: "Active",
					active: true,
				});

			const refreshedVehicles =
				await fetchVehicles();

			const cleanVehicles =
				normalizeVehiclesList(
					refreshedVehicles
				);

			setLogisticsVehicles(cleanVehicles);

			const selectedVehicle =
				cleanVehicles.find(
					(vehicle) =>
						String(vehicle.id) ===
						String(createdVehicle?.id)
				) ||
				cleanVehicles.find(
					(vehicle) =>
						vehicle.vehicleNumber
							.toUpperCase() ===
						cleanVehicleNumber
				);

			if (!selectedVehicle) {
				throw new Error(
					"Vehicle was created but could not be selected"
				);
			}

			if (
				createVehicleTarget ===
				MASTER_CREATE_TARGET.DISPATCH_CHALLAN
			) {
				setDispatchTripForm((previous) => ({
					...previous,
					vehicleId: selectedVehicle.id,
				}));
			}

			if (
				createVehicleTarget ===
				MASTER_CREATE_TARGET.CUSTOM_CHALLAN
			) {
				setCustomChallanForm((previous) => ({
					...previous,
					vehicleNumber:
						selectedVehicle.vehicleNumber,
				}));
			}

			if (
				createVehicleTarget ===
				MASTER_CREATE_TARGET.ADMIN_BULK_EDIT
			) {
				setAdminEditForm(
					(previous) => ({
						...previous,

						vehicleId:
							selectedVehicle.id,

						vehicleNumber:
							selectedVehicle.vehicleNumber,
					})
				);

				setAdminEditApply(
					(previous) => ({
						...previous,
						vehicle: true,
					})
				);
			}

			setCreateVehicleOpen(false);
			setCreateVehicleTarget("");

			setNewVehicleForm({
				vehicleNumber: "",
				vehicleName: "",
				vehicleType: "Other",
			});
		} catch (error) {
			console.error(
				"Vehicle creation failed",
				error
			);

			alert(
				error.message ||
				"Vehicle creation failed"
			);
		} finally {
			setCreateVehicleLoading(false);
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
		setScanMessage("Select or create a driver and a vehicle to generate challan");

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

	/*
	 * Keep selected rows available across server-paginated pages.
	 * The old implementation removed every selection that was not present in
	 * the currently loaded browser array, which is no longer correct once the
	 * register stops downloading all historical pages at startup.
	 */
	useEffect(() => {
		const selectedIds = new Set(
			(selectionModel || []).map((id) => String(id || "").trim())
		);

		(rows || []).forEach((row) => {
			const id = String(row?.zohoItemId || "").trim();

			if (id && selectedIds.has(id)) {
				dispatchSelectedRowCacheRef.current.set(id, row);
			}
		});
	}, [rows, selectionModel]);

	const patchDispatchRows = (
		itemIds,
		patchValue
	) => {
		const cleanIds =
			new Set(
				(Array.isArray(itemIds)
					? itemIds
					: [itemIds]
				)
					.map((id) =>
						String(id || "")
							.trim()
					)
					.filter(Boolean)
			);

		setRows((previousRows) =>
			previousRows.map((row) => {
				if (
					!cleanIds.has(
						String(
							row?.zohoItemId ||
							""
						).trim()
					)
				) {
					return row;
				}

				const nextRow =
					typeof patchValue ===
						"function"
						? patchValue(row)
						: {
							...row,
							...patchValue,
						};

				/*
				 * Status, location and driver data are part of
				 * the searchable text, so rebuild only this row's index.
				 */
				return attachDispatchSearchIndex(
					nextRow
				);
			})
		);
	};

	const updateBulkDispatchStatus =
		async (status) => {
			const cleanStatus =
				String(status || "")
					.trim()
					.toUpperCase();

			const cleanIds =
				Array.from(
					new Set(
						(selectionModel || [])
							.map((id) =>
								String(
									id || ""
								).trim()
							)
							.filter(Boolean)
					)
				);

			if (
				cleanIds.length === 0
			) {
				throw new Error(
					"No items selected"
				);
			}

			if (
				![
					"READY_TO_STORE",
					"READY_TO_DISPATCH",
				].includes(
					cleanStatus
				)
			) {
				throw new Error(
					`Invalid bulk status: ${cleanStatus}`
				);
			}

			const response =
				await authFetch(
					`${API_BASE_URL}/api/dispatched/bulk/status?status=${encodeURIComponent(
						cleanStatus
					)}`,
					{
						method:
							"POST",

						headers: {
							"Content-Type":
								"application/json",
						},

						body:
							JSON.stringify(
								cleanIds
							),
					}
				);

			if (!response.ok) {
				const message =
					await readResponseError(
						response,
						"Bulk status update failed"
					);

				throw new Error(
					message
				);
			}

			patchDispatchRows(
				cleanIds,
				(row) => ({
					...row,

					status:
						cleanStatus,

					updatedAt:
						new Date()
							.toISOString(),
				})
			);

			return cleanIds;
		};


	const updateStatus = async (
		zohoItemId,
		status
	) => {
		const cleanItemId =
			String(
				zohoItemId || ""
			).trim();

		const cleanStatus =
			String(status || "")
				.trim()
				.toUpperCase();

		const allowedStatuses =
			new Set([
				"READY_TO_STORE",
				"READY_TO_DISPATCH",
			]);

		if (!cleanItemId) {
			throw new Error(
				"Item ID missing"
			);
		}

		if (
			!allowedStatuses.has(
				cleanStatus
			)
		) {
			throw new Error(
				`Invalid status: ${cleanStatus}`
			);
		}

		const response =
			await authFetch(
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
					cleanItemId
				)}/dispatch?status=${encodeURIComponent(
					cleanStatus
				)}`,
				{
					method: "POST",
				}
			);

		if (!response.ok) {
			const message =
				await readResponseError(
					response,
					"Status update failed"
				);

			throw new Error(
				message
			);
		}

		const existingRow =
			rows.find(
				(row) =>
					String(
						row?.zohoItemId ||
						""
					).trim() ===
					cleanItemId
			);

		const updatedRow =
			attachDispatchSearchIndex({
				...(existingRow || {
					zohoItemId:
						cleanItemId,
				}),

				status:
					cleanStatus,

				updatedAt:
					new Date()
						.toISOString(),
			});

		/*
		 * Update only one browser row.
		 * Do not download the complete register again.
		 */
		patchDispatchRows(
			[cleanItemId],
			(row) => ({
				...row,

				status:
					cleanStatus,

				updatedAt:
					new Date()
						.toISOString(),
			})
		);

		return updatedRow;
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
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
					id
				)}/approve-return`,
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
				`${API_BASE_URL}/api/dispatched/${encodeURIComponent(
					id
				)}/reject-return`,
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

	const openStickerHistory = async (
		row
	) => {
		const dispatchedItemId =
			String(
				row?.zohoItemId || ""
			).trim();

		if (!dispatchedItemId) {
			alert(
				"Dispatched Item ID missing"
			);

			return;
		}

		try {
			setHistoryOpen(true);
			setHistoryLoading(true);
			setHistoryRows([]);

			/*
			 * Save the complete row.
			 * The modal later needs itemType to choose
			 * NORMAL or HARDWARE PDF endpoints.
			 */
			setHistoryItem(row);

			/*
			 * This endpoint repairs old dispatch records,
			 * links packetItemId and rebuilds missing
			 * sticker history when necessary.
			 */
			const ensureRes =
				await authFetch(
					`${API_BASE_URL}/api/stickers/dispatched/${encodeURIComponent(
						dispatchedItemId
					)}/ensure-history`,
					{
						method: "POST",
						cache: "no-store",
					}
				);

			if (!ensureRes.ok) {
				const message =
					await readResponseError(
						ensureRes,
						"Sticker history rebuild failed"
					);

				throw new Error(message);
			}

			const ensureData =
				await ensureRes.json();

			const packetItemId =
				String(
					ensureData?.packetItemId ||
					row?.packetItemId ||
					row?.itemId ||
					row?.id ||
					""
				).trim();

			if (!packetItemId) {
				throw new Error(
					"Packet Item ID missing after history rebuild"
				);
			}

			/*
			 * Prefer backend itemType because old dispatch
			 * rows may not have itemType stored correctly.
			 */
			const resolvedItemType =
				resolveDispatchItemType({
					...row,

					itemType:
						ensureData?.itemType ||
						row?.itemType,

					packetItemType:
						ensureData?.packetItemType ||
						row?.packetItemType,

					hardwarePacket:
						ensureData?.hardwarePacket ??
						row?.hardwarePacket,
				});

			const resolvedHistoryItem = {
				...row,

				packetItemId,

				itemType:
					resolvedItemType,

				hardwarePacket:
					resolvedItemType ===
					"HARDWARE",

				stickerNumber:
					ensureData?.stickerNumber ||
					row?.stickerNumber ||
					"",
			};

			setHistoryItem(
				resolvedHistoryItem
			);

			const historyPath =
				getStickerHistoryListPath(
					resolvedHistoryItem,
					packetItemId
				);

			if (!historyPath) {
				throw new Error(
					"Sticker history endpoint could not be resolved"
				);
			}

			const historyRes =
				await authFetch(
					`${API_BASE_URL}${historyPath}`,
					{
						method: "GET",
						cache: "no-store",
					}
				);

			if (!historyRes.ok) {
				const message =
					await readResponseError(
						historyRes,
						"History fetch failed"
					);

				throw new Error(message);
			}

			const historyData =
				await historyRes.json();

			setHistoryRows(
				normalizeStickerHistoryRows(
					historyData
				)
			);

			/*
			 * Keep the corrected packetItemId and
			 * item type in the Dispatch table state.
			 */
			setRows((previousRows) =>
				previousRows.map((item) =>
					item.zohoItemId ===
						dispatchedItemId
						? {
							...item,

							packetItemId,

							itemType:
								resolvedItemType,

							hardwarePacket:
								resolvedItemType ===
								"HARDWARE",

							stickerNumber:
								ensureData?.stickerNumber ||
								item?.stickerNumber ||
								"",
						}
						: item
				)
			);
		} catch (error) {
			console.error(
				"Sticker history failed:",
				error
			);

			setHistoryRows([]);

			alert(
				error?.message ||
				"Failed to load sticker history"
			);
		} finally {
			setHistoryLoading(false);
		}
	};

	const fetchStickerHistoryPdfBlob =
		async (historyRow) => {
			const historyId =
				historyRow?.id ||
				historyRow?.historyId;

			if (!historyId) {
				throw new Error(
					"Sticker history ID missing"
				);
			}

			if (!historyItem) {
				throw new Error(
					"Selected packet information missing"
				);
			}

			const pdfPath =
				getStickerHistoryPdfPath(
					historyItem,
					historyId
				);

			if (!pdfPath) {
				throw new Error(
					"Sticker PDF endpoint could not be resolved"
				);
			}

			const response =
				await authFetch(
					`${API_BASE_URL}${pdfPath}`,
					{
						method: "GET",
						cache: "no-store",

						headers: {
							Accept:
								"application/pdf",
						},
					}
				);

			if (!response.ok) {
				const message =
					await readResponseError(
						response,
						"Sticker PDF fetch failed"
					);

				throw new Error(message);
			}

			const contentType =
				String(
					response.headers.get(
						"content-type"
					) || ""
				).toLowerCase();

			if (
				contentType &&
				!contentType.includes(
					"application/pdf"
				)
			) {
				throw new Error(
					"Backend did not return a PDF"
				);
			}

			const blob =
				await response.blob();

			if (!blob || blob.size === 0) {
				throw new Error(
					"Empty sticker PDF received"
				);
			}

			return blob;
		};

	const previewStickerHistoryPdf =
		async (historyRow) => {
			/*
			 * Open before await so the browser does not
			 * treat it as an unsolicited popup.
			 */
			const previewWindow =
				window.open(
					"",
					"_blank",
					"noopener,noreferrer"
				);

			if (!previewWindow) {
				alert(
					"Popup blocked. Please allow popups for this site."
				);

				return;
			}

			try {
				previewWindow.document.write(`
        <html>
          <head>
            <title>Loading Sticker PDF</title>
          </head>

          <body style="
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background:var(--pf-surface);
            color:#ffffff;
            font-family:Arial,sans-serif;
          ">
            Loading sticker PDF...
          </body>
        </html>
      `);

				const blob =
					await fetchStickerHistoryPdfBlob(
						historyRow
					);

				const blobUrl =
					URL.createObjectURL(blob);

				previewWindow.location.replace(
					blobUrl
				);

				setTimeout(() => {
					URL.revokeObjectURL(
						blobUrl
					);
				}, 60000);
			} catch (error) {
				console.error(
					"Sticker preview failed:",
					error
				);

				previewWindow.close();

				alert(
					error?.message ||
					"Preview failed"
				);
			}
		};

	const downloadStickerHistoryPdf =
		async (historyRow) => {
			try {
				const blob =
					await fetchStickerHistoryPdfBlob(
						historyRow
					);

				const url =
					URL.createObjectURL(blob);

				const stickerNumber =
					String(
						historyRow?.stickerNumber ||
						"STICKER"
					)
						.trim()
						.replace(
							/[^\w.-]+/g,
							"_"
						);

				const anchor =
					document.createElement("a");

				anchor.href = url;
				anchor.download =
					`STICKER_${stickerNumber}.pdf`;

				document.body.appendChild(
					anchor
				);

				anchor.click();
				anchor.remove();

				setTimeout(() => {
					URL.revokeObjectURL(url);
				}, 10000);
			} catch (error) {
				console.error(
					"Sticker download failed:",
					error
				);

				alert(
					error?.message ||
					"Download failed"
				);
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



	/* ===================== ADMIN PERMANENT DISPATCH DELETE ===================== */

	const resetAdminDispatchDeleteState = () => {
		setAdminDeleteRows([]);
		setAdminDeletePreview(null);
		setAdminDeletePreviewLoading(false);
		setAdminDeleteExecuting(false);
		setAdminDeleteReason("");
		setAdminDeleteConfirmation("");
		setAdminDeleteError("");
	};

	const closeAdminDispatchDelete = () => {
		if (adminDeletePreviewLoading || adminDeleteExecuting) return;
		setAdminDeleteOpen(false);
		resetAdminDispatchDeleteState();
	};

	const openAdminDispatchDelete = async (targetRows) => {
		if (!isAdmin) {
			alert("Only Admin can permanently delete Dispatch items");
			return;
		}

		const byId = new Map();

		(Array.isArray(targetRows) ? targetRows : []).forEach((row) => {
			const id = String(row?.zohoItemId || row?.id || "").trim();
			if (id) byId.set(id, row);
		});

		const cleanRows = Array.from(byId.values());
		const itemIds = Array.from(byId.keys());

		if (itemIds.length === 0) {
			alert("No valid Dispatch items selected");
			return;
		}

		if (itemIds.length > 500) {
			alert("A maximum of 500 Dispatch items can be deleted at once");
			return;
		}

		setAdminDeleteRows(cleanRows);
		setAdminDeletePreview(null);
		setAdminDeleteReason("");
		setAdminDeleteConfirmation("");
		setAdminDeleteError("");
		setAdminDeleteOpen(true);
		setAdminDeletePreviewLoading(true);

		try {
			const bulk = itemIds.length > 1;

			const response = await authFetch(
				bulk
					? `${API_BASE_URL}/api/admin/deletions/dispatch-items/bulk/preview`
					: `${API_BASE_URL}/api/admin/deletions/dispatch-items/${encodeURIComponent(itemIds[0])}/preview`,
				bulk
					? {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify(itemIds),
					}
					: {
						method: "GET",
						headers: { Accept: "application/json" },
					}
			);

			if (!response.ok) {
				throw new Error(
					await readResponseError(
						response,
						"Unable to calculate deletion impact"
					)
				);
			}

			setAdminDeletePreview(await response.json());
		} catch (error) {
			console.error("Dispatch deletion preview failed:", error);
			setAdminDeleteError(
				error?.message || "Unable to calculate deletion impact"
			);
		} finally {
			setAdminDeletePreviewLoading(false);
		}
	};

	const executeAdminDispatchDelete = async () => {
		if (!isAdmin) {
			alert("Only Admin can permanently delete Dispatch items");
			return;
		}

		const itemIds = Array.from(
			new Set(
				(adminDeleteRows || [])
					.map((row) =>
						String(row?.zohoItemId || row?.id || "").trim()
					)
					.filter(Boolean)
			)
		);

		if (itemIds.length === 0 || !adminDeletePreview) {
			setAdminDeleteError("Deletion preview is required before execution");
			return;
		}

		const reason = String(adminDeleteReason || "").trim();
		const confirmation = String(adminDeleteConfirmation || "").trim();
		const required = String(
			adminDeletePreview?.requiredConfirmation || ""
		).trim();

		if (reason.length < 5) {
			setAdminDeleteError(
				"Deletion reason must contain at least 5 characters"
			);
			return;
		}

		if (reason.length > 1000) {
			setAdminDeleteError(
				"Deletion reason cannot exceed 1000 characters"
			);
			return;
		}

		if (
			!required ||
			confirmation.toLowerCase() !== required.toLowerCase()
		) {
			setAdminDeleteError(`Type exactly: ${required}`);
			return;
		}

		const bulk = itemIds.length > 1;

		setAdminDeleteExecuting(true);
		setAdminDeleteError("");

		try {
			const response = await authFetch(
				bulk
					? `${API_BASE_URL}/api/admin/deletions/dispatch-items/bulk/execute`
					: `${API_BASE_URL}/api/admin/deletions/dispatch-items/${encodeURIComponent(itemIds[0])}/execute`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(
						bulk
							? {
								itemIds,
								confirmationText: confirmation,
								reason,
							}
							: {
								confirmationText: confirmation,
								reason,
							}
					),
				}
			);

			if (!response.ok) {
				throw new Error(
					await readResponseError(
						response,
						"Permanent Dispatch deletion failed"
					)
				);
			}

			const result = await response.json();

			itemIds.forEach((id) => {
				dispatchSelectedRowCacheRef.current.delete(id);
			});

			setSelectionModel([]);
			dispatchPageCacheRef.current.clear();

			setAdminDeleteOpen(false);
			resetAdminDispatchDeleteState();

			const selectedSet = new Set(itemIds);
			const visibleRemaining = (rows || []).filter(
				(row) =>
					!selectedSet.has(
						String(row?.zohoItemId || "").trim()
					)
			);

			if (pageNo > 1 && visibleRemaining.length === 0) {
				setPageNo((previous) => Math.max(1, previous - 1));
			} else {
				await fetchData({ preferCache: false });
			}

			publishPackFlowDataChanged({
				action: bulk
					? "DISPATCH_BULK_DELETION"
					: "DISPATCH_ITEM_DELETION",
				targetType: bulk
					? "DISPATCH_BULK"
					: "DISPATCH_ITEM",
				result,
				scopes: [
					"inventory",
					"warehouse",
					"dispatch",
					"dashboard",
				],
			});

			alert(
				result?.message ||
					"Dispatch item(s) permanently deleted"
			);
		} catch (error) {
			console.error("Permanent Dispatch deletion failed:", error);
			setAdminDeleteError(
				error?.message || "Permanent Dispatch deletion failed"
			);
		} finally {
			setAdminDeleteExecuting(false);
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
							disabled={
								dispatchSelectAllLoading ||
								filteredSelectableIds.length === 0
							}
							title={
								dispatchSelectAllLoading
									? "Selecting all matching rows..."
									: "Select all filtered rows"
							}
							style={
								dispatchSelectAllLoading ||
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
							checked={isSelectable && selectionIdSet.has(id)}
							style={
								isSelectable
									? selectCheckboxStyle
									: selectCheckboxDisabledStyle
							}
							onChange={(e) => {
								if (!isSelectable) return;

								if (e.target.checked) {
									dispatchSelectedRowCacheRef.current.set(
										id,
										params.row
									);

									setSelectionModel((prev) =>
										prev.includes(id) ? prev : [...prev, id]
									);
								} else {
									dispatchSelectedRowCacheRef.current.delete(id);

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
						{isHardwareDispatchRow(row) && (
							<Chip
								size="small"
								label="🔩 HARDWARE"
								sx={{
									height: 21,
									mr: 0.8,
									flexShrink: 0,
									color: "var(--dispatch-purple-text)",
									fontSize: 9,
									fontWeight: 950,
									background:
										"rgba(139,92,246,.18)",
									border:
										"1px solid rgba(167,139,250,.28)",
								}}
							/>
						)}
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
			width: 300,

			renderHeader: () => (
				<span>Description</span>
			),

			renderCell: (params) => {
				const hardwareRow =
					isHardwareDispatchRow(
						params.row
					);

				return (
					<Box
						sx={{
							minWidth: 0,
							display: "flex",
							flexDirection: "column",
							gap: 0.5,
						}}
					>
						{hardwareRow && (
							<Box
								sx={{
									color: "var(--dispatch-purple-text)",
									fontSize: 9,
									fontWeight: 950,
									letterSpacing: ".08em",
									textTransform:
										"uppercase",
								}}
							>
								Hardware Contents
							</Box>
						)}

						<Box
							component="span"
							title={
								params.value ||
								""
							}
							sx={{
								color: "var(--pf-text-muted)",
								fontSize: 12,
								fontWeight: 650,
								lineHeight: 1.45,

								whiteSpace:
									hardwareRow
										? "pre-wrap"
										: "normal",

								overflow: "hidden",
								textOverflow:
									"ellipsis",

								display:
									hardwareRow
										? "-webkit-box"
										: "block",

								WebkitBoxOrient:
									"vertical",

								WebkitLineClamp:
									hardwareRow
										? 4
										: 2,
							}}
						>
							{params.value ||
								"No description"}
						</Box>
					</Box>
				);
			},
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
			field: "dateTime",
			headerName: "Date / Time",
			width: 210,

			renderHeader: () => (
				<span>Date / Time</span>
			),

			renderCell: (params) => {
				const dateInfo =
					getDispatchRowDateInfo(
						params.row,
						dateFilterMode
					);

				return (
					<Box
						sx={{
							minWidth: 0,
							display: "flex",
							flexDirection: "column",
							alignItems: "flex-start",
							gap: 0.55,
						}}
					>
						<Box
							component="span"
							title={
								dateInfo.date
									? formatDispatchTableDateTime(
										dateInfo.date
									)
									: dateInfo.label
							}
							sx={{
								color:
									dateInfo.date
										? "var(--pf-text-strong)"
										: "var(--pf-text-dim)",
								fontSize: 12,
								fontWeight: 850,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								maxWidth: "100%",
							}}
						>
							{dateInfo.date
								? formatDispatchTableDateTime(
									dateInfo.date
								)
								: "—"}
						</Box>

						<Chip
							size="small"
							label={dateInfo.label}
							sx={{
								height: 20,
								maxWidth: "100%",
								color:
									dateInfo.date
										? "var(--dispatch-blue-text)"
										: "var(--pf-text-muted)",
								fontSize: 9,
								fontWeight: 950,
								background:
									dateInfo.date
										? "rgba(59,130,246,.13)"
										: "rgba(148,163,184,.08)",
								border:
									dateInfo.date
										? "1px solid rgba(96,165,250,.22)"
										: "1px solid rgba(148,163,184,.12)",

								"& .MuiChip-label": {
									px: 0.9,
									overflow: "hidden",
									textOverflow: "ellipsis",
								},
							}}
						/>
					</Box>
				);
			},
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
									color: "var(--pf-text-muted)",
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

				/*
				 * A normal dispatch challan is created only after dispatch, so rows
				 * that do not yet have a challan number keep their existing actions
				 * unchanged. Rows with a challan receive one direct PDF-preview action.
				 */
				const rowChallanNumber =
					String(
						getDispatchChallanNo(row) ||
						""
					).trim();

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
						{rowChallanNumber && (
							<Tooltip
								title={`Preview Challan PDF - ${rowChallanNumber}`}
								arrow
							>
								<Button
									size="small"
									startIcon={
										<DescriptionOutlinedIcon fontSize="small" />
									}
									onClick={() =>
										previewExistingChallanPdf(
											rowChallanNumber
										)
									}
									sx={rowChallanPdfButtonSx}
								>
									View Challan PDF
								</Button>
							</Tooltip>
						)}

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
								onClick={() => {
									const canGenerateLaterImportedChallan =
										row.status === "DISPATCHED" &&
										!String(getDispatchChallanNo(row) || "").trim();

									if (
										row.status !== "READY_TO_DISPATCH" &&
										!canGenerateLaterImportedChallan
									) {
										alert(
											`Item not ready for challan. Current status: ${row.status || "Unknown"}`
										);

										return;
									}

									/*
									 * The challan backend must still perform the final
									 * authoritative status validation.
									 */
									openDispatchTripModal({
										mode:
											"UI_SINGLE",

										itemIds: [
											row.zohoItemId,
										],

										title:
											row.name ||
											row.itemName ||
											"Single Chalaan",
									});
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
								onClick={() =>
									openAdminDispatchEdit(
										[row]
									)
								}
								sx={{
									...actionWarning,
									...tableActionButton,
								}}
							>
								Edit Details
							</Button>
						)}
						{isAdmin && (
							<Button
								size="small"
								onClick={() =>
									openAdminDispatchDelete([row])
								}
								sx={{
									...actionDanger,
									...tableActionButton,
									background:
										"linear-gradient(180deg,#dc2626,#b91c1c)",
									color: "#fff",
								}}
							>
								Delete
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

	const getDispatchDrawerPacketNumber =
		(row) => {
			const direct =
				String(
					row?.packetNumber ||
					row?.packetNo ||
					row?.pktNo ||
					row?.packetCode ||
					""
				).trim();

			if (direct) {
				return direct;
			}

			const parsed =
				getAdminEditPacketNumber(
					row
				);

			return parsed
				? `Pkt-${parsed}`
				: "—";
		};

	const buildDispatchItemDrawerSections =
		(row) => {
			if (!row) {
				return [];
			}

			const dateValue =
				(value) =>
					formatDispatchTableDateTime(
						value
					);

			const textValue =
				(...values) => {
					for (
						const value of values
					) {
						if (
							value !== null &&
							value !== undefined &&
							String(value).trim() !==
							""
						) {
							return String(
								value
							);
						}
					}

					return "—";
				};

			return [
				{
					title: "Item & Packet",
					fields: [
						{ label: "Item Name", value: textValue(row?.name, row?.itemName) },
						{ label: "Packet No.", value: getDispatchDrawerPacketNumber(row) },
						{ label: "SKU", value: textValue(row?.sku) },
						{ label: "Type", value: resolveDispatchItemType(row) },
						{ label: "PD No.", value: textValue(row?.pdNo) },
						{ label: "Drawing No.", value: textValue(row?.drawingNo) },
						{ label: "Floor", value: textValue(row?.floor) },
						{ label: "Quantity", value: textValue(row?.quantity, row?.qty) },
					],
				},
				{
					title: "Client",
					fields: [
						{ label: "Client Name", value: textValue(row?.clientName) },
						{ label: "Client Address", value: textValue(row?.clientAddress, row?.address), full: true },
					],
				},
				{
					title: "Plant & Location",
					fields: [
						{ label: "Plant", value: textValue(row?.plantCode) },
						{ label: "Current Location", value: textValue(row?.currentLocationCode, row?.location) },
						{ label: "Packed Area", value: textValue(row?.packedAreaCode) },
						{ label: "FG Area", value: textValue(row?.fgAreaCode) },
						{ label: "FG Zone", value: textValue(row?.fgZoneCode, row?.fgZone) },
						{ label: "Warehouse", value: textValue(row?.warehouseCode) },
						{ label: "Gate Pass", value: textValue(row?.gatePassNumber, row?.gatePass) },
					],
				},
				{
					title: "Dispatch",
					fields: [
						{ label: "Status", value: getDisplayStatus(row)?.label || textValue(row?.status) },
						{ label: "Approval Status", value: textValue(row?.approvalStatus) },
						{ label: "Challan No.", value: textValue(getDispatchChallanNo(row)) },
						{ label: "Driver", value: textValue(row?.driverName, row?.assignedDriverName) },
						{ label: "Vehicle", value: textValue(row?.vehicleNumber, row?.vehicleNo) },
						{ label: "Helpers / Loaders", value: textValue(row?.helperLoaderCount, row?.helpersCount) },
						{ label: "Packing Date / Time", value: dateValue(row?.packedAt || row?.packingDate || row?.packedDate) },
						{ label: "Dispatch Date / Time", value: dateValue(row?.dispatchedAt || row?.dispatchDate) },
						{ label: "Trip Started", value: dateValue(row?.tripStartedAt) },
						{ label: "Trip Ended", value: dateValue(row?.tripEndedAt) },
						{ label: "Delivered", value: dateValue(row?.deliveredAt) },
					],
				},
				{
					title: "Packet Details",
					fields: [
						{ label: "Description", value: textValue(row?.description), full: true },
						{ label: "Dimensions", value: textValue(row?.dimensions) },
						{ label: "Weight", value: textValue(row?.weight) },
						{ label: "Remarks", value: textValue(row?.remarks), full: true },
					],
				},
				{
					title: "System References",
					fields: [
						{ label: "Dispatch Item ID", value: textValue(row?.zohoItemId, row?.dispatchedItemId, row?.id) },
						{ label: "Packet Item ID", value: textValue(row?.packetItemId) },
						{ label: "Created", value: dateValue(row?.createdAt) },
						{ label: "Updated", value: dateValue(row?.updatedAt) },
					],
				},
			];
		};


	/*
	 * Plant configuration is small and required by the table/actions.  Keep it
	 * independent from the large dispatch register request.
	 *
	 * Driver/vehicle masters and Custom Challan history are deliberately NOT
	 * loaded here anymore.  They are fetched lazily when their modal/section is
	 * actually opened so they cannot compete with first paint.
	 */
	useEffect(() => {
		if (
			authLoading ||
			roles.length === 0
		) {
			return;
		}

		fetchPlantConfigs();
	}, [
		authLoading,
		rolesKey,
	]);

	/*
	 * Server-paged Dispatch register.
	 *
	 * Only the requested UI page is fetched. Search is debounced separately,
	 * while status/plant/date/group/page changes update immediately.
	 */
	useEffect(() => {
		if (
			authLoading ||
			roles.length === 0
		) {
			return;
		}

		fetchData({
			preferCache: true,
		});
	}, [
		authLoading,
		rolesKey,
		pageNo,
		pageSize,
		dispatchServerSearch,
		dispatchStatusQuery,
		plantFilter,
		dateFilterMode,
		dateFilterFrom,
		dateFilterTo,
		dateFilterTimeFrom,
		dateFilterTimeTo,
		groupBy,
	]);

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

	const loadDispatchReviewPdf =
		async (
			requestOverride = null
		) => {
			const request =
				requestOverride ||
				buildDispatchChallanRequest();

			validateDispatchChallanRequest(
				request
			);

			/*
			 * Cancel an earlier preview request when the
			 * user opens or refreshes another preview.
			 */
			dispatchReviewPdfAbortRef.current?.abort();

			const abortController =
				new AbortController();

			dispatchReviewPdfAbortRef.current =
				abortController;

			try {
				setDispatchReviewPdfLoading(
					true
				);

				setDispatchReviewPdfError(
					""
				);

				const response =
					await authFetch(
						`${API_BASE_URL}/api/chalaan/dispatch/preview`,
						{
							method: "POST",

							headers: {
								"Content-Type":
									"application/json",

								Accept:
									"application/pdf",
							},

							body:
								JSON.stringify(
									request
								),

							signal:
								abortController.signal,
						}
					);

				if (!response.ok) {
					const message =
						await readResponseError(
							response,
							"Unable to generate challan preview"
						);

					throw new Error(
						message
					);
				}

				const contentType =
					String(
						response.headers.get(
							"content-type"
						) || ""
					).toLowerCase();

				if (
					contentType &&
					!contentType.includes(
						"application/pdf"
					) &&
					!contentType.includes(
						"application/octet-stream"
					)
				) {
					throw new Error(
						"Preview endpoint did not return a PDF"
					);
				}

				const blob =
					await response.blob();

				if (
					!blob ||
					blob.size === 0
				) {
					throw new Error(
						"Empty challan preview PDF received"
					);
				}

				const objectUrl =
					URL.createObjectURL(
						blob
					);

				revokeDispatchReviewPdfUrl();

				dispatchReviewPdfUrlRef.current =
					objectUrl;

				setDispatchReviewPdfUrl(
					objectUrl
				);

				setDispatchReviewPdfSignature(
					buildDispatchReviewSignature(
						request
					)
				);

				return objectUrl;

			} catch (error) {
				if (
					error?.name ===
					"AbortError"
				) {
					return null;
				}

				console.error(
					"Challan preview failed:",
					error
				);

				setDispatchReviewPdfError(
					error?.message ||
					"Unable to generate challan preview"
				);

				throw error;

			} finally {
				if (
					dispatchReviewPdfAbortRef.current ===
					abortController
				) {
					dispatchReviewPdfAbortRef.current =
						null;

					setDispatchReviewPdfLoading(
						false
					);
				}
			}
		};

	const getAuditActionTone = (
		action = ""
	) => {
		const cleanAction =
			String(action || "")
				.trim()
				.toLowerCase();

		if (
			cleanAction.includes(
				"approved"
			)
		) {
			return {
				bg:
					"rgba(16,185,129,.14)",
				color: "#6ee7b7",
				border:
					"1px solid rgba(16,185,129,.24)",
			};
		}

		if (
			cleanAction.includes(
				"rejected"
			)
		) {
			return {
				bg:
					"rgba(239,68,68,.14)",
				color: "#fca5a5",
				border:
					"1px solid rgba(239,68,68,.24)",
			};
		}

		if (
			cleanAction.includes(
				"requested"
			)
		) {
			return {
				bg:
					"rgba(245,158,11,.14)",
				color: "#fcd34d",
				border:
					"1px solid rgba(245,158,11,.24)",
			};
		}

		if (
			cleanAction.includes(
				"dispatched"
			)
		) {
			return {
				bg:
					"rgba(59,130,246,.14)",
				color: "#93c5fd",
				border:
					"1px solid rgba(59,130,246,.24)",
			};
		}

		if (
			cleanAction.includes("packed") ||
			cleanAction.includes("sticker")
		) {
			return {
				bg:
					"rgba(139,92,246,.14)",
				color: "#c4b5fd",
				border:
					"1px solid rgba(139,92,246,.24)",
			};
		}

		return {
			bg:
				"rgba(148,163,184,.12)",
			color: "var(--pf-text-soft)",
			border:
				"1px solid rgba(148,163,184,.20)",
		};
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

	const getRoleChipStyle = (
		roleValue
	) => {
		const normalizedRole =
			String(roleValue || "")
				.replace(/^ROLE_/i, "")
				.trim()
				.toUpperCase();

		if (
			normalizedRole === "ADMIN"
		) {
			return {
				bg: "var(--pf-surface-alt)",
				color: "#fff",
			};
		}

		if (
			normalizedRole ===
			"DISPATCH"
		) {
			return {
				bg: "#065f46",
				color: "#ecfdf5",
			};
		}

		if (
			normalizedRole ===
			"PACKING" ||
			normalizedRole === "USER"
		) {
			return {
				bg: "#1e40af",
				color: "#eff6ff",
			};
		}

		if (
			normalizedRole ===
			"HARDWARE_PACKING"
		) {
			return {
				bg:
					"rgba(109,40,217,.70)",
				color: "#ede9fe",
			};
		}

		return {
			bg: "#374151",
			color: "#f9fafb",
		};
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

		/*
		 * Verified XLSX rows are allowed to be marked DISPATCHED before a
		 * challan exists. Only those unchallaned dispatched rows get the
		 * later-challan action; already challaned rows stay locked.
		 */
		if (
			row.status === "DISPATCHED" &&
			!String(
				row?.challanNumber ||
				row?.chalaanNumber ||
				row?.dispatchChallanNumber ||
				row?.chalaanNo ||
				""
			).trim()
		) {
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
		const currentPageById = new Map(
			(rows || [])
				.map((row) => [
					String(getRowId(row) || "").trim(),
					row,
				])
				.filter(([id]) => Boolean(id))
		);

		return (selectionModel || [])
			.map((id) => {
				const cleanId = String(id || "").trim();

				return (
					currentPageById.get(cleanId) ||
					dispatchSelectedRowCacheRef.current.get(cleanId) ||
					null
				);
			})
			.filter(Boolean);
	}, [rows, selectionModel]);

	const selectedReturnRequestItems = useMemo(() => {
		return selectedItems.filter(
			(row) => getRowStatus(row) === "WAREHOUSE_RETURN_REQUESTED"
		);
	}, [selectedItems]);

	const allSelectedReturnRequests =
		selectedItems.length > 0 &&
		selectedReturnRequestItems.length === selectedItems.length;

	const bulkResolveReturnRequests = async (decision) => {
		if (!isAdmin) {
			alert("Only Admin can approve or reject warehouse return requests");
			return;
		}

		if (!allSelectedReturnRequests) {
			alert("Select only Warehouse Return Requested items");
			return;
		}

		const normalizedDecision =
			String(decision || "").trim().toUpperCase();

		const action =
			normalizedDecision === "APPROVE" ? "approve" : "reject";

		const itemIds = selectedReturnRequestItems
			.map((row) => String(getRowId(row) || "").trim())
			.filter(Boolean);

		if (itemIds.length === 0) {
			alert("Select return requests first");
			return;
		}

		const confirmed = window.confirm(
			`${action === "approve" ? "Approve" : "Reject"} ${itemIds.length} selected Return to Dispatch request(s)?`
		);

		if (!confirmed) return;

		try {
			setBulkReturnDecisionLoading(action);

			const response = await authFetch(
				`${API_BASE_URL}/api/warehouse/admin/returns/bulk/${action}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(itemIds),
				}
			);

			if (!response.ok) {
				const message = await readResponseError(
					response,
					`Bulk return ${action} failed`
				);

				throw new Error(message);
			}

			setSelectionModel([]);
			await fetchData();
		} catch (error) {
			console.error(`Bulk return ${action} failed:`, error);
			alert(error?.message || `Bulk return ${action} failed`);
		} finally {
			setBulkReturnDecisionLoading("");
		}
	};

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

	const toAdminDateValue = (value) => {
		if (!value) {
			return "";
		}

		if (
			value instanceof Date &&
			!Number.isNaN(value.getTime())
		) {
			const localDate = new Date(value);

			localDate.setMinutes(
				localDate.getMinutes() -
				localDate.getTimezoneOffset()
			);

			return localDate
				.toISOString()
				.slice(0, 10);
		}

		/*
		 * Backend packedAt is a LocalDateTime. Its yyyy-MM-dd prefix is already
		 * the India-business date, so do not round-trip it through UTC.
		 */
		const text = String(value)
			.trim();

		const match = text.match(
			/^(\d{4}-\d{2}-\d{2})/
		);

		return match ? match[1] : "";
	};

	const toAdminDateTimeLocalValue = (value) => {
		if (!value) {
			return "";
		}

		if (
			value instanceof Date &&
			!Number.isNaN(value.getTime())
		) {
			const localDate = new Date(value);

			localDate.setMinutes(
				localDate.getMinutes() -
				localDate.getTimezoneOffset()
			);

			return localDate
				.toISOString()
				.slice(0, 16);
		}

		/*
		 * Backend LocalDateTime is already business-local time.
		 * Do not convert it through UTC/toISOString().
		 */
		const text = String(value)
			.trim()
			.replace(" ", "T");

		const match = text.match(
			/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/
		);

		return match ? match[1] : "";
	};

	const openAdminDispatchEdit = async (
		targetRows
	) => {
		if (!isAdmin) {
			alert(
				"Only Admin can edit dispatch details"
			);

			return;
		}

		let adminDrivers = logisticsDrivers;
		let adminVehicles = logisticsVehicles;

		if (
			adminDrivers.length === 0 ||
			adminVehicles.length === 0
		) {
			const masters = await fetchLogisticsMasters();
			adminDrivers = masters.drivers;
			adminVehicles = masters.vehicles;
		}

		const cleanRows =
			(
				Array.isArray(targetRows)
					? targetRows
					: [targetRows]
			)
				.filter(
					(row) =>
						Boolean(
							String(
								row?.zohoItemId ||
								""
							).trim()
						)
				);

		if (cleanRows.length === 0) {
			alert(
				"No valid items selected"
			);

			return;
		}

		const singleRow =
			cleanRows.length === 1;

		const driverName =
			getAdminEditCommonValue(
				cleanRows,
				(row) =>
					row?.driverName ||
					row?.assignedDriverName ||
					row?.driver?.name ||
					(
						typeof row?.driver ===
							"string"
							? row.driver
							: ""
					)
			);

		const vehicleNumber =
			getAdminEditCommonValue(
				cleanRows,
				(row) =>
					row?.vehicleNumber ||
					row?.vehicleNo ||
					row?.assignedVehicleNumber ||
					row?.vehicle?.vehicleNumber ||
					(
						typeof row?.vehicle ===
							"string"
							? row.vehicle
							: ""
					)
			);

		const packingDate =
			getAdminEditCommonValue(
				cleanRows,
				(row) =>
					toAdminDateValue(
						row?.packedAt ||
						row?.packingDate ||
						row?.packedDate
					)
			);

		const dispatchDateTime =
			getAdminEditCommonValue(
				cleanRows,
				(row) =>
					toAdminDateTimeLocalValue(
						row?.dispatchedAt ||
						row?.tripStartedAt
					)
			);

		const matchedDriver =
			adminDrivers.find(
				(driver) =>
					normalizeDispatchDriverName(
						driver?.name
					).toLowerCase() ===
					normalizeDispatchDriverName(
						driverName
					).toLowerCase()
			) || null;

		const matchedVehicle =
			adminVehicles.find(
				(vehicle) =>
					normalizeDispatchVehicleNumber(
						vehicle?.vehicleNumber
					) ===
					normalizeDispatchVehicleNumber(
						vehicleNumber
					)
			) || null;

		setAdminEditRows(
			cleanRows
		);

		setAdminEditForm({
			itemName:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.itemName ||
						row?.name
				),

			packetNumber:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						getAdminEditPacketNumber(
							row
						)
				),

			pdNo:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.pdNo
				),

			drawingNo:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.drawingNo
				),

			clientName:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.clientName
				),

			clientAddress:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.clientAddress
				),

			floor:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.floor
				),

			description:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.description
				),

			weight:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.weight
				),

			dimensions:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.dimensions
				),

			remarks:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.remarks
				),

			location:
				getAdminEditCommonValue(
					cleanRows,
					(row) =>
						row?.currentLocationCode ||
						row?.location
				),

			driverId:
				matchedDriver?.id ||
				"",

			driverName:
				driverName,

			vehicleId:
				matchedVehicle?.id ||
				"",

			vehicleNumber:
				vehicleNumber,

			packingDate,
			dispatchDateTime,
		});

		/*
		 * Single edit behaves like the previous Edit Sticker modal.
		 *
		 * In bulk mode no field is selected initially. This prevents
		 * mixed or blank values from unintentionally overwriting all
		 * selected items.
		 */
		setAdminEditApply(
			singleRow
				? {
					itemName: true,
					packetNumber: false,
					pdNo: true,
					drawingNo: true,
					clientName: true,
					clientAddress: true,
					floor: true,
					description: true,
					weight: true,
					dimensions: true,
					remarks: true,
					location: true,

					driver: false,
					vehicle: false,
					packingDate: false,

					/*
					 * Enable automatically only when the single row
					 * already has a real dispatch timestamp.
					 */
					dispatchDateTime:
						Boolean(dispatchDateTime),
				}
				: createEmptyAdminEditApplyState()
		);

		setAdminEditOpen(
			true
		);
	};

	const closeAdminDispatchEdit =
		() => {
			if (adminEditLoading) {
				return;
			}

			setAdminEditOpen(
				false
			);

			setAdminEditRows(
				[]
			);

			setAdminEditForm(
				createEmptyAdminEditForm()
			);

			setAdminEditApply(
				createEmptyAdminEditApplyState()
			);
		};

	const saveAdminDispatchEdit =
		async () => {
			if (!isAdmin) {
				alert(
					"Only Admin can edit dispatch details"
				);

				return;
			}

			const itemIds =
				Array.from(
					new Set(
						adminEditRows
							.map((row) =>
								String(
									row?.zohoItemId ||
									""
								).trim()
							)
							.filter(Boolean)
					)
				);

			if (itemIds.length === 0) {
				alert(
					"No valid items selected"
				);

				return;
			}

			const fields =
				Object.entries(
					adminEditApply
				)
					.filter(
						([
							,
							enabled,
						]) =>
							Boolean(enabled)
					)
					.map(
						([
							key,
						]) =>
							ADMIN_EDIT_API_FIELDS[
							key
							]
					)
					.filter(Boolean);

			const packingDateSelected =
				Boolean(
					adminEditApply.packingDate
				);

			if (
				fields.length === 0 &&
				!packingDateSelected
			) {
				alert(
					"Select at least one field to apply"
				);

				return;
			}

			const cleanPackingDate =
				String(
					adminEditForm.packingDate ||
					""
				).trim();

			if (
				packingDateSelected &&
				!cleanPackingDate
			) {
				alert(
					"Packing date is required"
				);

				return;
			}

			const cleanDispatchDateTime =
				String(
					adminEditForm.dispatchDateTime ||
					""
				).trim();

			if (
				adminEditApply.dispatchDateTime &&
				!cleanDispatchDateTime
			) {
				alert(
					"Dispatch date and time is required"
				);

				return;
			}


			const cleanPacketNumber =
				String(
					adminEditForm.packetNumber ||
					""
				).trim();

			if (
				adminEditApply.packetNumber &&
				!/^(?:Pkt[-\s]*)?\d+$/i.test(
					cleanPacketNumber
				)
			) {
				alert(
					"Packet No. must be a positive number, for example 1 or Pkt-1"
				);

				return;
			}

			if (
				adminEditApply.packetNumber &&
				itemIds.length !== 1
			) {
				alert(
					"Packet No. can be changed for one item at a time"
				);

				return;
			}

			const payload = {
				itemIds,
				fields,

				itemName:
					String(
						adminEditForm.itemName ||
						""
					).trim(),

				packetNumber:
					adminEditApply.packetNumber
						? cleanPacketNumber
						: null,

				pdNo:
					String(
						adminEditForm.pdNo ||
						""
					).trim(),

				drawingNo:
					String(
						adminEditForm.drawingNo ||
						""
					).trim(),

				clientName:
					String(
						adminEditForm.clientName ||
						""
					).trim(),

				clientAddress:
					String(
						adminEditForm.clientAddress ||
						""
					).trim(),

				floor:
					String(
						adminEditForm.floor ||
						""
					).trim(),

				description:
					String(
						adminEditForm.description ||
						""
					).trim(),

				weight:
					String(
						adminEditForm.weight ||
						""
					).trim(),

				dimensions:
					String(
						adminEditForm.dimensions ||
						""
					).trim(),

				remarks:
					String(
						adminEditForm.remarks ||
						""
					).trim(),

				stickerLocation:
					String(
						adminEditForm.location ||
						""
					).trim(),

				driverId:
					String(
						adminEditForm.driverId ||
						""
					).trim() ||
					null,

				driverName:
					normalizeDispatchDriverName(
						adminEditForm.driverName
					),

				vehicleId:
					String(
						adminEditForm.vehicleId ||
						""
					).trim() ||
					null,

				vehicleNumber:
					normalizeDispatchVehicleNumber(
						adminEditForm.vehicleNumber
					),

				dispatchDateTime:
					adminEditApply.dispatchDateTime
						? cleanDispatchDateTime
						: null,
			};

			try {
				setAdminEditLoading(
					true
				);

				let shouldReloadDispatchRows = false;

				if (fields.length > 0) {
					const response =
						await authFetch(
							`${API_BASE_URL}/api/dispatched/admin/bulk-edit`,
							{
								method: "PUT",

								headers: {
									"Content-Type":
										"application/json",

									Accept:
										"application/json",
								},

								body:
									JSON.stringify(
										payload
									),
							}
						);

					if (!response.ok) {
						const message =
							await readResponseError(
								response,
								"Admin dispatch edit failed"
							);

						throw new Error(
							message
						);
					}

					const result =
						await response
							.json()
							.catch(
								() => ({})
							);

					const updatedRows =
						Array.isArray(
							result?.updatedRows
						)
							? result.updatedRows
							: [];

					/*
					 * The backend should return every affected row,
					 * including other items belonging to an edited challan.
					 */
					if (
						updatedRows.length >
						0
					) {
						const normalizedUpdates =
							normalizeFetchedDispatchRows(
								updatedRows
							);

						const updateMap =
							new Map(
								normalizedUpdates.map(
									(row) => [
										String(
											row.zohoItemId
										),
										row,
									]
								)
							);

						setRows(
							(previousRows) =>
								previousRows.map(
									(row) => {
										const update =
											updateMap.get(
												String(
													row?.zohoItemId ||
													""
												)
											);

										if (!update) {
											return row;
										}

										return attachDispatchSearchIndex({
											...row,
											...update,
										});
									}
								)
						);
					} else {
						shouldReloadDispatchRows = true;
					}
				}


				/*
				 * Packet No. is canonically stored on PacketItem and reflected
				 * into Dispatch through SKU. Reload once so the table receives
				 * the authoritative synchronized packet identity.
				 */
				if (adminEditApply.packetNumber) {
					shouldReloadDispatchRows = true;
				}

				if (packingDateSelected) {
					for (const row of adminEditRows) {
						const dispatchItemId =
							String(
								row?.zohoItemId ||
								""
							).trim();

						if (!dispatchItemId) {
							throw new Error(
								`Dispatch Item ID missing for ${row?.name || row?.sku || "selected item"}`
							);
						}

						const packingDateResponse =
							await authFetch(
								`${API_BASE_URL}/api/packets/dispatched/${encodeURIComponent(
									dispatchItemId
								)}/admin-packing-date`,
								{
									method: "PUT",
									headers: {
										"Content-Type":
											"application/json",
										Accept:
											"application/json",
									},
									body: JSON.stringify({
										packingDate:
											cleanPackingDate,
									}),
								}
							);

						if (!packingDateResponse.ok) {
							const message =
								await readResponseError(
									packingDateResponse,
									"Packing date update failed"
								);

							throw new Error(
								message
							);
						}
					}

					/*
					 * Reload once after all date updates so packedAt, export data and
					 * current table state exactly match the backend-preserved time.
					 */
					shouldReloadDispatchRows = true;
				}

				if (shouldReloadDispatchRows) {
					await fetchData();
				}

				setSelectionModel(
					[]
				);

				closeAdminDispatchEdit();

			} catch (error) {
				console.error(
					"Admin dispatch edit failed:",
					error
				);

				alert(
					error?.message ||
					"Admin dispatch edit failed"
				);
			} finally {
				setAdminEditLoading(
					false
				);
			}
		};

	const revokeDispatchReviewPdfUrl =
		() => {
			const activeUrl =
				dispatchReviewPdfUrlRef.current;

			if (activeUrl) {
				URL.revokeObjectURL(
					activeUrl
				);
			}

			dispatchReviewPdfUrlRef.current =
				"";

			setDispatchReviewPdfUrl(
				""
			);
		};

	const clearDispatchReviewPdf =
		() => {
			dispatchReviewPdfAbortRef.current?.abort();

			dispatchReviewPdfAbortRef.current =
				null;

			revokeDispatchReviewPdfUrl();

			setDispatchReviewPdfLoading(
				false
			);

			setDispatchReviewPdfError(
				""
			);

			setDispatchReviewPdfSignature(
				""
			);
		};

	const openDispatchTripModal = ({
		mode,
		itemIds = [],
		scanTexts = [],
		qrCart = [],
		title = "",
	}) => {
		clearDispatchReviewPdf();

		/*
		 * Refresh Driver + Vehicle masters whenever a normal challan form opens.
		 *
		 * This stays lazy (nothing is fetched on Dispatch page startup), but it
		 * also picks up masters added from Driver/Fleet Management after this page
		 * was first rendered. The shared loader deduplicates overlapping calls.
		 */
		void fetchLogisticsMasters();

		const cleanItemIds =
			Array.from(
				new Set(
					(Array.isArray(itemIds)
						? itemIds
						: []
					)
						.map((id) =>
							String(
								id || ""
							).trim()
						)
						.filter(Boolean)
				)
			);

		setDispatchTripContext({
			mode,
			itemIds:
				cleanItemIds,

			scanTexts:
				Array.isArray(
					scanTexts
				)
					? scanTexts
					: [],

			qrCart:
				Array.isArray(
					qrCart
				)
					? qrCart
					: [],

			title,
		});

		const modalRows = cleanItemIds
			.map((itemId) => {
				return (
					(rows || []).find(
						(row) => String(row?.zohoItemId || "").trim() === itemId
					) ||
					dispatchSelectedRowCacheRef.current.get(itemId) ||
					null
				);
			})
			.filter(Boolean);

		const allRowsAreLaterChallanRows =
			modalRows.length > 0 &&
			modalRows.length === cleanItemIds.length &&
			modalRows.every(
				(row) =>
					row?.status === "DISPATCHED" &&
					!String(getDispatchChallanNo(row) || "").trim()
			);

		let defaultDriverId = "";
		let defaultDispatchTime = getNowDateTimeLocal();

		if (allRowsAreLaterChallanRows) {
			const driverIds = Array.from(
				new Set(
					modalRows
						.map((row) => String(row?.driverId || "").trim())
						.filter(Boolean)
				)
			);

			if (driverIds.length === 1) {
				defaultDriverId = driverIds[0];
			}

			const dispatchTimes = Array.from(
				new Set(
					modalRows
						.map((row) =>
							toAdminDateTimeLocalValue(
								row?.dispatchedAt || row?.tripStartedAt
							)
						)
						.filter(Boolean)
				)
			);

			if (dispatchTimes.length === 1) {
				defaultDispatchTime = dispatchTimes[0];
			}
		}

		setDispatchTripForm({
			driverId: defaultDriverId,
			vehicleId: "",
			helperLoaderCount: "",
			dispatchTime: defaultDispatchTime,
		});

		setDispatchTripStep(
			"DETAILS"
		);

		setDispatchTripOpen(
			true
		);
	};

	const closeDispatchTripModal =
		() => {
			if (dispatchTripLoading) {
				return;
			}

			clearDispatchReviewPdf();

			setDispatchTripOpen(
				false
			);

			setDispatchTripStep(
				"DETAILS"
			);
		};

	const submitDispatchTrip =
		async () => {
			/*
			 * Clicking the submit handler from the Details step
			 * must only open the Review step.
			 */
			if (
				dispatchTripStep !==
				"REVIEW"
			) {
				await openDispatchTripReview();
				return;
			}

			try {
				/*
				 * Build one authoritative request.
				 *
				 * This exact request is compared against the
				 * request used to generate the review PDF.
				 */
				const finalRequest =
					buildDispatchChallanRequest();

				validateDispatchChallanRequest(
					finalRequest
				);

				const finalSignature =
					buildDispatchReviewSignature(
						finalRequest
					);

				if (
					!dispatchReviewPdfUrl ||
					!dispatchReviewPdfSignature
				) {
					throw new Error(
						"Please generate and review the challan PDF before final confirmation"
					);
				}

				if (
					finalSignature !==
					dispatchReviewPdfSignature
				) {
					clearDispatchReviewPdf();

					setDispatchTripStep(
						"DETAILS"
					);

					throw new Error(
						"Challan values changed after the PDF preview. Please review the updated challan again."
					);
				}

				setDispatchTripLoading(
					true
				);

				/*
				 * finalRequest already contains the cleaned,
				 * unique and validated item IDs.
				 */
				const finalItemIds =
					finalRequest.itemIds;

				/*
				 * QR bulk safety validation.
				 *
				 * Preferably, QR items should be moved to FG
				 * before generating the review PDF so that the
				 * preview and final PDF contain the same location.
				 *
				 * This block remains as the final backend safety check.
				 */
				if (
					dispatchTripContext.mode ===
					"QR_BULK"
				) {
					const qrCart =
						Array.isArray(
							dispatchTripContext.qrCart
						)
							? dispatchTripContext.qrCart
							: [];

					const missingZoneItem =
						qrCart.find((item) => {
							return (
								item?.moveToFgRequired &&
								isScanFgZoneRequired(
									item
								) &&
								!String(
									item?.fgZoneCode ||
									""
								).trim()
							);
						});

					if (missingZoneItem) {
						throw new Error(
							`Select FG zone for ${missingZoneItem.itemName ||
							"selected item"
							}`
						);
					}

					await moveQrCartItemsToFgIfNeeded(
						qrCart
					);
				}

				/*
				 * This is the only request that performs the
				 * real dispatch and creates the final challan.
				 */
				const result =
					await createDispatchChallan({
						...finalRequest,

						/*
						 * Existing final endpoint option.
						 * It instructs the backend to return the
						 * completed PDF after saving the challan.
						 */
						preview:
							true,
					});

				const blob =
					result?.blob;

				if (
					!blob ||
					blob.size === 0
				) {
					throw new Error(
						"No final challan PDF generated"
					);
				}

				const finalPdfUrl =
					URL.createObjectURL(
						blob
					);

				/*
				 * Remove the temporary pre-confirmation PDF.
				 */
				clearDispatchReviewPdf();

				showChalaanPreview(
					finalPdfUrl,
					result?.challanNo ||
					finalItemIds[0] ||
					"CHALAAN"
				);

				setDispatchTripOpen(
					false
				);

				setDispatchTripStep(
					"DETAILS"
				);

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

				/*
				 * Final creation changes status, challan number,
				 * driver, vehicle, dispatch time and trip fields.
				 * A complete refresh is appropriate here.
				 */
				await fetchData();

			} catch (error) {
				console.error(
					"Dispatch challan creation failed:",
					error
				);

				alert(
					error?.message ||
					"Challan generation failed"
				);
			} finally {
				setDispatchTripLoading(
					false
				);
			}
		};

	const toCustomChallanDateTimeInput = (
		value
	) => {
		const raw =
			String(
				value || ""
			).trim();

		if (!raw) {
			return "";
		}

		const match =
			raw.match(
				/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
			);

		if (!match) {
			return "";
		}

		return (
			`${match[1]}-${match[2]}-${match[3]}` +
			`T${match[4]}:${match[5]}`
		);
	};

	const resetCustomChallanForm = () => {
		setCustomChallanForm({
			challanType: "CUSTOMER_CARE",
			fromLocation: "",
			toLocation: "",
			pdNo: "",
			driverName: "",
			vehicleNumber: "",
			handedOverTo: "",
			clientName: "",
			clientAddress: "",
			purpose: "",
			movementMode: "DIRECT_DISPATCH",
			dispatchTime: getNowDateTimeLocal(),
			items: [createEmptyCustomChallanLine()],
		});
	};

	const openCustomChallanModal = () => {
		setCustomChallanMode("CREATE");
		setCustomChallanEditingNumber("");
		resetCustomChallanForm();
		setCustomChallanOpen(true);

		/*
		 * Custom Challan uses the same Logistics Driver/Vehicle masters as the
		 * normal Dispatch Challan. Keep the page fast by loading them only when
		 * this form is actually opened.
		 */
		void fetchLogisticsMasters();
	};

	const closeCustomChallanModal = () => {
		if (
			customChallanLoading ||
			customChallanDetailLoading
		) {
			return;
		}

		setCustomChallanOpen(false);
		setCustomChallanMode("CREATE");
		setCustomChallanEditingNumber("");
		resetCustomChallanForm();
	};

	const openEditCustomChallanModal = async (
		challan
	) => {
		if (!isAdmin) {
			alert("Only Admin can edit custom challans");
			return;
		}

		const challanNumber =
			String(
				challan?.challanNumber || ""
			).trim();

		if (!challanNumber) {
			alert("Custom challan number missing");
			return;
		}

		try {
			setCustomChallanDetailLoading(true);

			/*
			 * Load the selected challan and refresh Driver/Vehicle masters together.
			 * A master-load failure never blocks the existing challan detail itself.
			 */
			const [
				detailResult,
			] =
				await Promise.all([
					fetchCustomChallanDetails(
						challanNumber
					),
					fetchLogisticsMasters(),
				]);

			const detail =
				detailResult;

			setCustomChallanMode("EDIT");
			setCustomChallanEditingNumber(
				challanNumber
			);

			setCustomChallanForm({
				challanType:
					String(
						detail?.challanType ||
						"OTHER"
					)
						.trim()
						.toUpperCase(),

				fromLocation:
					String(
						detail?.fromLocation || ""
					),

				toLocation:
					String(
						detail?.toLocation || ""
					),

				pdNo:
					String(
						detail?.pdNo || ""
					),

				driverName:
					String(
						detail?.driverName || ""
					),

				vehicleNumber:
					String(
						detail?.vehicleNumber || ""
					),

				handedOverTo:
					String(
						detail?.handedOverTo || ""
					),

				clientName:
					String(
						detail?.clientName || ""
					),

				clientAddress:
					String(
						detail?.clientAddress || ""
					),

				purpose:
					String(
						detail?.purpose || ""
					),

				movementMode:
					String(
						detail?.movementMode ||
						"DIRECT_DISPATCH"
					),

				dispatchTime:
					toCustomChallanDateTimeInput(
						detail?.dispatchTime
					),

				items:
					Array.isArray(
						detail?.items
					) &&
						detail.items.length > 0
						? detail.items.map(
							(item) => ({
								description:
									String(
										item?.description ||
										""
									),

								drawingNo:
									String(
										item?.drawingNo ||
										""
									),

								quantity:
									String(
										item?.quantity ?? 1
									),

								uom:
									String(
										item?.uom ||
										"PIECES"
									)
										.trim()
										.toUpperCase(),

								returnable:
									Boolean(
										item?.returnable
									),

								remarks:
									String(
										item?.remarks ||
										""
									),
							}))
						: [
							createEmptyCustomChallanLine(),
						],
			});

			/* Avoid stacking the edit modal over the history modal. */
			setChallanHistoryOpen(false);
			setCustomChallanOpen(true);

		} catch (error) {
			console.error(
				"Custom challan load failed",
				error
			);

			alert(
				error?.message ||
				"Failed to load custom challan"
			);

		} finally {
			setCustomChallanDetailLoading(false);
		}
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
		const editingCustomChallan =
			customChallanMode === "EDIT" &&
			Boolean(customChallanEditingNumber);

		if (editingCustomChallan) {
			if (!isAdmin) {
				alert("Only Admin can edit a custom challan");
				return;
			}
		} else if (!isDispatch) {
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

		const challanType =
			String(customChallanForm.challanType || "OTHER")
				.trim()
				.toUpperCase();

		const handedOverTo =
			String(customChallanForm.handedOverTo || "").trim();

		const movementMode =
			String(
				customChallanForm.movementMode ||
				"DIRECT_DISPATCH"
			).trim() || "DIRECT_DISPATCH";

		if (
			isSiteReturnChallanType(challanType) &&
			!handedOverTo
		) {
			alert("Handed Over To is required for Site Return challan");
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

		const allowedUomValues =
			CUSTOM_CHALLAN_UOM_OPTIONS.map(
				(option) => option.value
			);

		const cleanedItems =
			(customChallanForm.items || [])
				.map((item) => {
					const quantity =
						Number(item.quantity || 1);

					const uom =
						String(item.uom || "PIECES")
							.trim()
							.toUpperCase();

					return {
						description:
							String(item.description || "").trim(),

						drawingNo:
							String(item.drawingNo || "").trim(),

						quantity:
							Number.isFinite(quantity) && quantity > 0
								? quantity
								: 1,

						uom:
							allowedUomValues.includes(uom)
								? uom
								: "PIECES",

						returnable:
							Boolean(item.returnable),

						remarks:
							String(item.remarks || "").trim(),
					};
				})
				.filter((item) => item.description);

		if (cleanedItems.length === 0) {
			alert("Add at least one item description");
			return;
		}

		const payload = {
			...customChallanForm,
			challanType,
			fromLocation,
			toLocation,
			pdNo: String(customChallanForm.pdNo || "").trim(),
			driverName,
			vehicleNumber,
			handedOverTo: isSiteReturnChallanType(challanType)
				? handedOverTo
				: "",
			clientName: String(customChallanForm.clientName || "").trim(),
			clientAddress: String(customChallanForm.clientAddress || "").trim(),
			purpose: String(customChallanForm.purpose || "").trim(),
			movementMode,
			dispatchTime: selectedDispatchTime,
			items: cleanedItems,
		};

		try {
			setCustomChallanLoading(true);

			const result =
				editingCustomChallan
					? await updateCustomChallan(
						customChallanEditingNumber,
						payload
					)
					: await createCustomChallan(
						payload
					);

			const blob = result?.blob;

			if (!blob || blob.size === 0) {
				throw new Error(
					"No custom challan PDF generated"
				);
			}

			const url =
				URL.createObjectURL(blob);

			showChalaanPreview(
				url,
				result.challanNo ||
				customChallanEditingNumber ||
				"CUSTOM_CHALLAN"
			);

			setCustomChallanOpen(false);
			setCustomChallanMode("CREATE");
			setCustomChallanEditingNumber("");
			resetCustomChallanForm();

			await loadCustomChallans();

		} catch (err) {
			console.error(err);
			alert(
				err.message ||
				(editingCustomChallan
					? "Custom challan update failed"
					: "Custom challan generation failed")
			);
		} finally {
			setCustomChallanLoading(false);
		}
	};

	async function loadCustomChallans({ force = true } = {}) {
		/*
		 * The section opener uses force:false so a previously loaded (including
		 * legitimately empty) register is not fetched again on every reopen.
		 * Existing callers use the default force:true and therefore keep their
		 * original refresh semantics.
		 */
		if (!force && customChallansLoadedRef.current) {
			return customChallans;
		}

		/*
		 * Rapid clicks / overlapping refresh sources used to be able to start the
		 * same potentially large Custom Challan request more than once. Reuse the
		 * active promise instead; this changes no returned data or permissions.
		 */
		if (customChallansLoadPromiseRef.current) {
			return customChallansLoadPromiseRef.current;
		}

		const request = (async () => {
			try {
				setCustomChallansLoadAttempted(false);
				setCustomChallansLoading(true);

				const data = await fetchCustomChallans();
				const nextRows = Array.isArray(data)
					? data
					: [];

				customChallansLoadedRef.current = true;
				setCustomChallans(nextRows);

				return nextRows;
			} catch (err) {
				console.error(err);
				setCustomChallans([]);

				/* A failed request must remain retryable on the next open/refresh. */
				customChallansLoadedRef.current = false;
				return [];
			} finally {
				setCustomChallansLoadAttempted(true);
				setCustomChallansLoading(false);
			}
		})();

		customChallansLoadPromiseRef.current = request;

		try {
			return await request;
		} finally {
			if (customChallansLoadPromiseRef.current === request) {
				customChallansLoadPromiseRef.current = null;
			}
		}
	}

	/*
	 * Disclosure toggling is deliberately synchronous and contains no await.
	 * Fetching starts after the open state has committed, so the click itself is
	 * never held up by network work. Functional state also prevents stale rapid
	 * click behaviour.
	 */
	const toggleCustomChallanSection = () => {
		setCustomChallanSectionOpen((previous) => !previous);
	};

	useEffect(() => {
		if (!customChallanSectionOpen) {
			return undefined;
		}

		setCustomChallanPageNo(1);

		if (
			customChallansLoadedRef.current ||
			customChallansLoadPromiseRef.current
		) {
			return undefined;
		}

		/*
		 * Give the browser one paint for the disclosure state before beginning the
		 * fetch. This removes the visible click -> fetch -> open coupling.
		 */
		const frameId = window.requestAnimationFrame(() => {
			void loadCustomChallans({ force: false });
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [customChallanSectionOpen]);

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

	async function fetchChallanHistoryRows({
		page = 0,
		size = CHALLAN_HISTORY_SERVER_PAGE_SIZE,
	} = {}) {
		const params = new URLSearchParams({
			page: String(Math.max(0, Number(page) || 0)),
			size: String(
				Math.min(
					100,
					Math.max(1, Number(size) || CHALLAN_HISTORY_SERVER_PAGE_SIZE)
				)
			),
		});

		const res =
			await authFetch(
				`${API_BASE_URL}/api/dispatched/challans/search?${params.toString()}`,
				{
					method: "GET",
					headers: {
						Accept: "application/json",
					},
					cache: "no-store",
				}
			);

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || "Failed to load challan history");
		}

		const data = await res.json();

		const rows = Array.isArray(data)
			? data
			: [];

		const totalElements = Number(
			res.headers.get("X-Total-Elements")
		);
		const totalPages = Number(
			res.headers.get("X-Total-Pages")
		);
		const pageNumber = Number(
			res.headers.get("X-Page-Number")
		);
		const hasNextHeader = String(
			res.headers.get("X-Has-Next") || ""
		).toLowerCase();

		return {
			rows,
			totalElements:
				Number.isFinite(totalElements) && totalElements >= 0
					? totalElements
					: rows.length,
			totalPages:
				Number.isFinite(totalPages) && totalPages >= 0
					? totalPages
					: 1,
			pageNumber:
				Number.isFinite(pageNumber) && pageNumber >= 0
					? pageNumber
					: Math.max(0, Number(page) || 0),
			hasNext:
				hasNextHeader === "true" ||
				(
					Number.isFinite(totalPages) &&
					Number.isFinite(pageNumber) &&
					pageNumber + 1 < totalPages
				),
		};
	}

	async function fetchChallanHistoryByNumber(challanNumber) {
		const cleanNumber = String(challanNumber || "").trim();

		if (!cleanNumber) {
			throw new Error("Challan number missing");
		}

		const res = await authFetch(
			`${API_BASE_URL}/api/dispatched/challans/${encodeURIComponent(cleanNumber)}`,
			{
				method: "GET",
				headers: {
					Accept: "application/json",
				},
				cache: "no-store",
			}
		);

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || `Unable to load challan ${cleanNumber}`);
		}

		return await res.json();
	}

	const openChallanHistory = async () => {
		try {
			setChallanHistoryOpen(true);
			setChallanHistoryLoading(true);
			setChallanHistorySearch("");
			setChallanHistoryPageNo(1);
			setCustomChallanHistoryPageNo(1);
			setChallanHistoryServerPage(0);
			setChallanHistoryServerTotal(0);
			setChallanHistoryHasMore(false);

			const [normalResult] =
				await Promise.all([
					fetchChallanHistoryRows({
						page: 0,
						size: CHALLAN_HISTORY_SERVER_PAGE_SIZE,
					}),
					loadCustomChallans(),
				]);

			setChallanHistoryRows(normalResult.rows);
			setChallanHistoryServerPage(normalResult.pageNumber);
			setChallanHistoryServerTotal(normalResult.totalElements);
			setChallanHistoryHasMore(normalResult.hasNext);
		} catch (err) {
			console.error(err);
			alert(err.message || "Failed to load challan history");
			setChallanHistoryRows([]);
			setChallanHistoryServerTotal(0);
			setChallanHistoryHasMore(false);
		} finally {
			setChallanHistoryLoading(false);
		}
	};

	const loadOlderChallanHistory = async () => {
		if (challanHistoryLoadingMore || !challanHistoryHasMore) {
			return;
		}

		try {
			setChallanHistoryLoadingMore(true);

			const result = await fetchChallanHistoryRows({
				page: challanHistoryServerPage + 1,
				size: CHALLAN_HISTORY_SERVER_PAGE_SIZE,
			});

			setChallanHistoryRows((current) => {
				const merged = new Map();

				(current || []).forEach((row) => {
					const key = getChallanNumber(row);
					if (key) merged.set(key, row);
				});

				(result.rows || []).forEach((row) => {
					const key = getChallanNumber(row);
					if (key) merged.set(key, row);
				});

				return Array.from(merged.values());
			});

			setChallanHistoryServerPage(result.pageNumber);
			setChallanHistoryServerTotal(result.totalElements);
			setChallanHistoryHasMore(result.hasNext);
		} catch (err) {
			console.error(err);
			alert(err?.message || "Unable to load older challan history");
		} finally {
			setChallanHistoryLoadingMore(false);
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


	const closeNormalChallanView = () => {
		setNormalChallanViewOpen(false);
		setNormalChallanViewLoading(false);
		setNormalChallanView(null);
		setNormalChallanItemSearch("");
		setNormalChallanItemPageNo(1);
		setNormalChallanSelectedItemId("");
	};

	const openNormalChallanView = (challan) => {
		if (!challan) {
			alert("Challan details unavailable");
			return;
		}

		/*
		 * Master-item history cards intentionally contain only the rows belonging
		 * to that master grouping. For the inspector, always prefer the original
		 * complete challan returned by /api/dispatched/challans so "View Details"
		 * shows every row on the challan, not only the current master-item subset.
		 */
		const challanNumber = getChallanNumber(challan);
		const completeChallan =
			(challanHistoryRows || []).find(
				(row) => getChallanNumber(row) === challanNumber
			) || challan;

		const items = Array.isArray(completeChallan.items)
			? completeChallan.items
			: [];

		setNormalChallanView(completeChallan);
		setNormalChallanItemSearch("");
		setNormalChallanItemPageNo(1);
		setNormalChallanSelectedItemId(
			String(items?.[0]?.zohoItemId || "")
		);
		setNormalChallanViewOpen(true);
	};

	const openNormalChallanViewByNumber = async (challanNumber) => {
		const cleanNumber = String(challanNumber || "").trim();

		if (!cleanNumber) {
			alert("Challan number missing");
			return;
		}

		try {
			setNormalChallanViewLoading(true);

			let sourceRows = Array.isArray(challanHistoryRows)
				? challanHistoryRows
				: [];

			let challan = sourceRows.find(
				(row) => getChallanNumber(row) === cleanNumber
			);

			if (!challan) {
				challan = await fetchChallanHistoryByNumber(
					cleanNumber
				);

				setChallanHistoryRows((current) => {
					const rows = Array.isArray(current)
						? current
						: [];

					if (
						rows.some(
							(row) => getChallanNumber(row) === cleanNumber
						)
					) {
						return rows;
					}

					return [challan, ...rows];
				});
			}

			if (!challan) {
				throw new Error(
					`Challan ${cleanNumber} was not found in dispatch history`
				);
			}

			openNormalChallanView(challan);
		} catch (err) {
			console.error(err);
			alert(err?.message || "Unable to load challan details");
		} finally {
			setNormalChallanViewLoading(false);
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
						driverId: challan.driverId || null,
						driverName: challan.driverName || "—",
						vehicleId: challan.vehicleId || null,
						vehicleNumber: challan.vehicleNumber || "—",
						helperLoaderCount: challan.helperLoaderCount ?? null,
						dispatchedAt: challan.dispatchedAt,
						dispatchedBy: challan.dispatchedBy || "—",
						tripStartedAt: challan.tripStartedAt || null,
						tripEndedAt: challan.tripEndedAt || null,
						tripDurationMinutes: challan.tripDurationMinutes ?? null,
						tripStatus: challan.tripStatus || "—",
						totalItems: Number(challan.totalItems || 0),
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
								.flatMap((c) => [
									c.challanNumber,
									c.driverName,
									c.vehicleNumber,
									c.dispatchedBy,
									c.tripStatus,
									...(c.items || []).flatMap((item) => [
										item.zohoItemId,
										item.name,
										item.sku,
										item.pdNo,
										item.drawingNo,
										item.description,
										item.remarks,
										item.plantCode,
										item.currentLocationCode,
									]),
								])
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


	const normalChallanAnalytics = useMemo(() => {
		const source = Array.isArray(challanHistoryRows)
			? challanHistoryRows
			: [];

		const allItems = source.flatMap((challan) =>
			Array.isArray(challan?.items) ? challan.items : []
		);

		const now = new Date();
		const todayKey = `${now.getFullYear()}-${String(
			now.getMonth() + 1
		).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

		const todayChallans = source.filter((challan) => {
			const date = parseDispatchDateTime(challan?.dispatchedAt);
			if (!date) return false;
			const key = `${date.getFullYear()}-${String(
				date.getMonth() + 1
			).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
			return key === todayKey;
		}).length;

		const running = source.filter(
			(challan) =>
				String(challan?.tripStatus || "")
					.trim()
					.toUpperCase() === "RUNNING"
		).length;

		const ended = source.filter(
			(challan) =>
				String(challan?.tripStatus || "")
					.trim()
					.toUpperCase() === "ENDED"
		).length;

		const uniqueClients = new Set(
			allItems
				.map((item) => String(item?.clientName || "").trim().toLowerCase())
				.filter(Boolean)
		).size;

		const uniqueVehicles = new Set(
			source
				.map((challan) => String(challan?.vehicleNumber || "").trim().toLowerCase())
				.filter(Boolean)
		).size;

		const helperTotal = source.reduce(
			(sum, challan) => sum + Number(challan?.helperLoaderCount || 0),
			0
		);

		return {
			challans: source.length,
			items: allItems.length,
			today: todayChallans,
			running,
			ended,
			averageItems:
				source.length > 0
					? (allItems.length / source.length).toFixed(1)
					: "0.0",
			uniqueClients,
			uniqueVehicles,
			helperTotal,
		};
	}, [challanHistoryRows]);

	const normalChallanCurrentRowLookup = useMemo(() => {
		const lookup = new Map();

		(rows || []).forEach((row) => {
			const id = String(row?.zohoItemId || "").trim();
			if (id) {
				lookup.set(id, row);
			}
		});

		return lookup;
	}, [rows]);

	const normalChallanViewItems = useMemo(() => {
		const items = Array.isArray(normalChallanView?.items)
			? normalChallanView.items
			: [];

		return items.map((item) => {
			const itemId = String(item?.zohoItemId || "").trim();
			const sourceRow = itemId
				? normalChallanCurrentRowLookup.get(itemId)
				: null;

			/*
			 * Keep challan-response fields authoritative while enriching the row
			 * with packet/sticker/packing/location fields already loaded by this page.
			 */
			return {
				...(sourceRow || {}),
				...item,
				challanNumber:
					getChallanNumber(normalChallanView) ||
					getChallanNumber(sourceRow),
			};
		});
	}, [
		normalChallanView,
		normalChallanCurrentRowLookup,
	]);

	const normalChallanFilteredItems = useMemo(() => {
		const tokens = prepareDispatchSearchTokens(normalChallanItemSearch);

		if (tokens.length === 0) {
			return normalChallanViewItems;
		}

		return normalChallanViewItems.filter((item) => {
			const joined = [
				item.zohoItemId,
				item.name,
				item.itemName,
				item.sku,
				item.stickerNumber,
				item.packetNo,
				item.packetNumber,
				item.pdNo,
				item.drawingNo,
				item.clientName,
				item.clientAddress,
				item.description,
				item.remarks,
				item.itemArea,
				item.area,
				item.plantCode,
				item.currentLocationCode,
				item.location,
				item.fgAreaCode,
				item.fgZoneCode,
				item.warehouseCode,
				item.status,
				item.packedBy,
				item.dispatchedBy,
			].filter(Boolean).join(" ");

			const normal = normalizeSmartSearch(joined);
			const compact = normalizeCompactSearch(joined);

			return tokens.every((token) =>
				(token.normal && normal.includes(token.normal)) ||
				(token.compact && compact.includes(token.compact))
			);
		});
	}, [normalChallanViewItems, normalChallanItemSearch]);

	const normalChallanItemTotalPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(
				normalChallanFilteredItems.length / normalChallanItemPageSize
			)
		);
	}, [normalChallanFilteredItems.length, normalChallanItemPageSize]);

	const paginatedNormalChallanItems = useMemo(() => {
		const start =
			(normalChallanItemPageNo - 1) * normalChallanItemPageSize;

		return normalChallanFilteredItems.slice(
			start,
			start + normalChallanItemPageSize
		);
	}, [
		normalChallanFilteredItems,
		normalChallanItemPageNo,
		normalChallanItemPageSize,
	]);

	const selectedNormalChallanItem = useMemo(() => {
		if (normalChallanViewItems.length === 0) {
			return null;
		}

		const selected = normalChallanViewItems.find(
			(item) =>
				String(item?.zohoItemId || "") ===
				String(normalChallanSelectedItemId || "")
		);

		return selected || normalChallanViewItems[0];
	}, [normalChallanViewItems, normalChallanSelectedItemId]);

	const normalChallanViewStats = useMemo(() => {
		const items = normalChallanViewItems;
		const uniqueClients = new Set(
			items
				.map((item) => String(item?.clientName || "").trim().toLowerCase())
				.filter(Boolean)
		).size;
		const uniquePds = new Set(
			items
				.map((item) => String(item?.pdNo || "").trim().toLowerCase())
				.filter(Boolean)
		).size;
		const uniqueDrawings = new Set(
			items
				.map((item) => String(item?.drawingNo || "").trim().toLowerCase())
				.filter(Boolean)
		).size;
		const uniquePlants = new Set(
			items
				.map((item) => String(item?.plantCode || "").trim().toLowerCase())
				.filter(Boolean)
		).size;
		const totalQuantity = items.reduce(
			(sum, item) => sum + Number(item?.quantity || 0),
			0
		);

		return {
			items: items.length,
			totalQuantity,
			uniqueClients,
			uniquePds,
			uniqueDrawings,
			uniquePlants,
		};
	}, [normalChallanViewItems]);

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
							getCustomChallanTypeLabel(challan.challanType),
							challan.fromLocation,
							challan.toLocation,
							challan.clientName,
							challan.driverName,
							challan.vehicleNumber,
							challan.handedOverTo,
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

	const parseCustomChallanDateTime = (value) => {
		if (!value) {
			return null;
		}

		const parsed =
			parseDispatchDateTime(value);

		return parsed &&
			!Number.isNaN(parsed.getTime())
			? parsed
			: null;
	};

	const getCustomChallanDateKey = (value) => {
		const date =
			value instanceof Date
				? value
				: parseCustomChallanDateTime(value);

		if (!date) {
			return "";
		}

		const pad = (number) =>
			String(number).padStart(2, "0");

		return `${date.getFullYear()}-${pad(
			date.getMonth() + 1
		)}-${pad(date.getDate())}`;
	};

	const customChallanCreatorOptions = useMemo(() => {
		return Array.from(
			new Set(
				(customChallans || [])
					.map((challan) =>
						String(challan?.generatedBy || "").trim()
					)
					.filter(Boolean)
			)
		).sort((a, b) =>
			a.localeCompare(b, undefined, {
				sensitivity: "base",
			})
		);
	}, [customChallans]);

	const customChallanFilteredRows = useMemo(() => {
		/*
		 * Universal Custom Challan search.
		 *
		 * Search is intentionally shared by Dispatch and Admin. Admin-only
		 * analytics filters (type / creator / period) are applied afterwards.
		 *
		 * Multiple words use AND matching. Punctuation-insensitive compact
		 * matching also allows values such as:
		 *   CC-CH-20260808-AB12CD
		 *   ccch20260808ab12cd
		 * to find the same challan.
		 */
		const searchTokens =
			tokenizeSmartSearch(
				deferredCustomChallanSearch
			)
				.map((token) => ({
					normal:
						normalizeSmartSearch(token),
					compact:
						normalizeCompactSearch(token),
				}))
				.filter(
					(token) =>
						token.normal ||
						token.compact
				);

		const typeFilter =
			String(customChallanTypeFilter || "ALL")
				.trim()
				.toUpperCase();

		const creatorFilter =
			String(customChallanCreatorFilter || "ALL").trim();

		const periodFilter =
			String(customChallanPeriodFilter || "ALL")
				.trim()
				.toUpperCase();

		const now = new Date();
		const todayStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate()
		);

		const sevenDayStart = new Date(todayStart);
		sevenDayStart.setDate(sevenDayStart.getDate() - 6);

		const thirtyDayStart = new Date(todayStart);
		thirtyDayStart.setDate(thirtyDayStart.getDate() - 29);

		const monthStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			1
		);

		const nextDayStart = new Date(todayStart);
		nextDayStart.setDate(nextDayStart.getDate() + 1);

		return (customChallans || [])
			.filter((challan) => {
				/*
				 * Search every meaningful summary field that can exist today,
				 * plus safe aliases used by current/legacy responses.
				 *
				 * The array/item fallbacks also make this automatically search
				 * item descriptions if a future/list API returns embedded lines.
				 */
				if (searchTokens.length > 0) {
					const itemSearchValues =
						Array.isArray(challan?.items)
							? challan.items.flatMap((item) => [
								item?.description,
								item?.drawingNo,
								item?.pdNo,
								item?.remarks,
								item?.uom,
								item?.quantity,
							])
							: [];

					const searchValues = [
						challan?.challanNumber,
						challan?.chalaanNumber,
						challan?.challanNo,
						challan?.challanType,
						challan?.challanTypeLabel,
						getCustomChallanTypeLabel(challan?.challanType),

						challan?.pdNo,
						challan?.pdNumber,
						challan?.drawingNo,

						challan?.clientName,
						challan?.client,
						challan?.clientAddress,
						challan?.address,
						challan?.siteAddress,

						challan?.site,
						challan?.siteName,
						challan?.area,
						challan?.areaName,
						challan?.location,

						challan?.fromLocation,
						challan?.toLocation,
						challan?.sourceLocation,
						challan?.destinationLocation,

						challan?.purpose,
						challan?.remarks,
						challan?.movementMode,

						challan?.driverName,
						challan?.vehicleNumber,
						challan?.vehicleNo,
						challan?.handedOverTo,

						challan?.generatedBy,
						challan?.createdBy,
						challan?.generatedAt,
						challan?.createdAt,

						challan?.totalItems,
						...itemSearchValues,
					];

					const joinedText =
						searchValues
							.filter(
								(value) =>
									value !== null &&
									value !== undefined &&
									String(value).trim() !== ""
							)
							.join(" ");

					const normalHaystack =
						normalizeSmartSearch(
							joinedText
						);

					const compactHaystack =
						normalizeCompactSearch(
							joinedText
						);

					const matchesSearch =
						searchTokens.every(
							(token) =>
								(
									token.normal &&
									normalHaystack.includes(
										token.normal
									)
								) ||
								(
									token.compact &&
									compactHaystack.includes(
										token.compact
									)
								)
						);

					if (!matchesSearch) {
						return false;
					}
				}

				/*
				 * Dispatch users stop here: the search panel works for the records
				 * returned to them, without exposing Admin reporting filters.
				 */
				if (!isAdmin) {
					return true;
				}

				if (
					typeFilter !== "ALL" &&
					String(challan?.challanType || "")
						.trim()
						.toUpperCase() !== typeFilter
				) {
					return false;
				}

				if (
					creatorFilter !== "ALL" &&
					String(challan?.generatedBy || "").trim() !== creatorFilter
				) {
					return false;
				}

				if (periodFilter === "ALL") {
					return true;
				}

				const generatedAt =
					parseCustomChallanDateTime(challan?.generatedAt);

				if (!generatedAt) {
					return false;
				}

				if (periodFilter === "TODAY") {
					return generatedAt >= todayStart && generatedAt < nextDayStart;
				}

				if (periodFilter === "LAST_7_DAYS") {
					return generatedAt >= sevenDayStart;
				}

				if (periodFilter === "LAST_30_DAYS") {
					return generatedAt >= thirtyDayStart;
				}

				if (periodFilter === "THIS_MONTH") {
					return generatedAt >= monthStart;
				}

				if (periodFilter === "CUSTOM") {
					const dateKey = getCustomChallanDateKey(generatedAt);

					if (customChallanDateFrom && dateKey < customChallanDateFrom) {
						return false;
					}

					if (customChallanDateTo && dateKey > customChallanDateTo) {
						return false;
					}

					return true;
				}

				return true;
			})
			.sort((a, b) => {
				const aDate =
					parseCustomChallanDateTime(a?.generatedAt)?.getTime() || 0;
				const bDate =
					parseCustomChallanDateTime(b?.generatedAt)?.getTime() || 0;

				return bDate - aDate;
			});
	}, [
		customChallans,
		isAdmin,
		deferredCustomChallanSearch,
		customChallanTypeFilter,
		customChallanCreatorFilter,
		customChallanPeriodFilter,
		customChallanDateFrom,
		customChallanDateTo,
	]);


	const customChallanAdminStats = useMemo(() => {
		const sourceRows =
			Array.isArray(customChallanFilteredRows)
				? customChallanFilteredRows
				: [];

		const now = new Date();
		const todayKey = getCustomChallanDateKey(now);
		const monthKey = `${now.getFullYear()}-${String(
			now.getMonth() + 1
		).padStart(2, "0")}`;

		let totalItems = 0;
		let todayCount = 0;
		let monthCount = 0;
		let logisticsCompleteCount = 0;

		const creators = new Set();
		const clients = new Set();
		const typeMap = new Map();
		const creatorMap = new Map();
		const routeMap = new Map();

		sourceRows.forEach((challan) => {
			const itemCount =
				Number(challan?.totalItems || 0);

			totalItems += Number.isFinite(itemCount)
				? itemCount
				: 0;

			const dateKey =
				getCustomChallanDateKey(challan?.generatedAt);

			if (dateKey === todayKey) {
				todayCount += 1;
			}

			if (dateKey.startsWith(monthKey)) {
				monthCount += 1;
			}

			const creator =
				String(challan?.generatedBy || "Unassigned").trim() || "Unassigned";
			const client =
				String(challan?.clientName || "").trim();

			creators.add(creator);
			if (client) {
				clients.add(client);
			}

			if (
				String(challan?.driverName || "").trim() &&
				String(challan?.vehicleNumber || "").trim()
			) {
				logisticsCompleteCount += 1;
			}

			const typeKey =
				String(challan?.challanType || "OTHER")
					.trim()
					.toUpperCase() || "OTHER";

			const typeEntry = typeMap.get(typeKey) || {
				type: typeKey,
				label:
					challan?.challanTypeLabel ||
					getCustomChallanTypeLabel(typeKey),
				challans: 0,
				items: 0,
			};

			typeEntry.challans += 1;
			typeEntry.items += Number.isFinite(itemCount)
				? itemCount
				: 0;
			typeMap.set(typeKey, typeEntry);

			const creatorEntry = creatorMap.get(creator) || {
				name: creator,
				challans: 0,
				items: 0,
				lastAt: "",
			};

			creatorEntry.challans += 1;
			creatorEntry.items += Number.isFinite(itemCount)
				? itemCount
				: 0;

			const creatorLastTime =
				parseCustomChallanDateTime(creatorEntry.lastAt)?.getTime() || 0;
			const currentTime =
				parseCustomChallanDateTime(challan?.generatedAt)?.getTime() || 0;

			if (currentTime >= creatorLastTime) {
				creatorEntry.lastAt = challan?.generatedAt || "";
			}

			creatorMap.set(creator, creatorEntry);

			const routeLabel = `${String(
				challan?.fromLocation || "—"
			).trim() || "—"} → ${String(
				challan?.toLocation || "—"
			).trim() || "—"}`;

			const routeEntry = routeMap.get(routeLabel) || {
				route: routeLabel,
				challans: 0,
				items: 0,
				lastAt: "",
			};

			routeEntry.challans += 1;
			routeEntry.items += Number.isFinite(itemCount)
				? itemCount
				: 0;

			const routeLastTime =
				parseCustomChallanDateTime(routeEntry.lastAt)?.getTime() || 0;

			if (currentTime >= routeLastTime) {
				routeEntry.lastAt = challan?.generatedAt || "";
			}

			routeMap.set(routeLabel, routeEntry);
		});

		const typeBreakdown = Array.from(typeMap.values()).sort(
			(a, b) => b.challans - a.challans || b.items - a.items
		);

		const creatorBreakdown = Array.from(creatorMap.values()).sort(
			(a, b) => b.challans - a.challans || b.items - a.items
		);

		const routeBreakdown = Array.from(routeMap.values()).sort(
			(a, b) => b.challans - a.challans || b.items - a.items
		);

		const dailyTrend = Array.from({ length: 7 }, (_, index) => {
			const date = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate()
			);

			date.setDate(date.getDate() - (6 - index));

			const key = getCustomChallanDateKey(date);
			const rowsForDay = sourceRows.filter(
				(challan) =>
					getCustomChallanDateKey(challan?.generatedAt) === key
			);

			return {
				key,
				label: date.toLocaleDateString("en-IN", {
					day: "2-digit",
					month: "short",
				}),
				challans: rowsForDay.length,
				items: rowsForDay.reduce(
					(sum, challan) => sum + Number(challan?.totalItems || 0),
					0
				),
			};
		});

		const logisticsCompleteness = sourceRows.length
			? Math.round((logisticsCompleteCount / sourceRows.length) * 100)
			: 0;

		return {
			totalChallans: sourceRows.length,
			totalItems,
			todayCount,
			monthCount,
			uniqueCreators: creators.size,
			uniqueClients: clients.size,
			logisticsCompleteCount,
			logisticsCompleteness,
			averageItems: sourceRows.length
				? totalItems / sourceRows.length
				: 0,
			typeBreakdown,
			creatorBreakdown,
			routeBreakdown,
			dailyTrend,
			activity: sourceRows.slice(0, 15),
			topType: typeBreakdown[0] || null,
			topCreator: creatorBreakdown[0] || null,
			topRoute: routeBreakdown[0] || null,
		};
	}, [customChallanFilteredRows]);

	const customChallanFilterLabel = useMemo(() => {
		const parts = [];

		if (customChallanTypeFilter !== "ALL") {
			parts.push(
				getCustomChallanTypeLabel(customChallanTypeFilter)
			);
		}

		if (customChallanCreatorFilter !== "ALL") {
			parts.push(`By ${customChallanCreatorFilter}`);
		}

		const periodLabels = {
			TODAY: "Today",
			LAST_7_DAYS: "Last 7 Days",
			LAST_30_DAYS: "Last 30 Days",
			THIS_MONTH: "This Month",
			CUSTOM: customChallanDateFrom || customChallanDateTo
				? `${customChallanDateFrom || "Start"} → ${customChallanDateTo || "Today"}`
				: "Custom Date Range",
		};

		if (customChallanPeriodFilter !== "ALL") {
			parts.push(
				periodLabels[customChallanPeriodFilter] || customChallanPeriodFilter
			);
		}

		if (customChallanSearch.trim()) {
			parts.push(`Search: ${customChallanSearch.trim()}`);
		}

		return parts.length
			? parts.join(" • ")
			: "All custom challans";
	}, [
		customChallanTypeFilter,
		customChallanCreatorFilter,
		customChallanPeriodFilter,
		customChallanDateFrom,
		customChallanDateTo,
		customChallanSearch,
	]);

	const clearCustomChallanAdminFilters = () => {
		setCustomChallanSearch("");
		setCustomChallanTypeFilter("ALL");
		setCustomChallanCreatorFilter("ALL");
		setCustomChallanPeriodFilter("ALL");
		setCustomChallanDateFrom("");
		setCustomChallanDateTo("");
		setCustomChallanPageNo(1);
	};

	const fetchCustomChallanReportDetails = async (sourceRows) => {
		const detailMap = new Map();
		let nextIndex = 0;
		const concurrency = Math.min(4, sourceRows.length);

		const worker = async () => {
			while (nextIndex < sourceRows.length) {
				const currentIndex = nextIndex;
				nextIndex += 1;

				const challan = sourceRows[currentIndex];
				const challanNumber = String(
					challan?.challanNumber || ""
				).trim();

				if (!challanNumber) {
					continue;
				}

				try {
					const detail =
						await fetchCustomChallanDetails(challanNumber);

					detailMap.set(challanNumber, detail || null);
				} catch (error) {
					console.warn(
						`Unable to load item details for ${challanNumber}:`,
						error
					);

					detailMap.set(challanNumber, null);
				}
			}
		};

		if (concurrency > 0) {
			await Promise.all(
				Array.from({ length: concurrency }, () => worker())
			);
		}

		return detailMap;
	};

	const exportCustomChallanAdminReport = async () => {
		if (!isAdmin) {
			alert("Only Admin can export Custom Challan analytics");
			return;
		}

		const sourceRows =
			Array.isArray(customChallanFilteredRows)
				? customChallanFilteredRows
				: [];

		if (sourceRows.length === 0) {
			alert("No custom challans match the current report filters");
			return;
		}

		try {
			setCustomChallanReportLoading(true);

			const [excelJsModule, detailMap] = await Promise.all([
				import("exceljs"),
				fetchCustomChallanReportDetails(sourceRows),
			]);

			const ExcelJS = excelJsModule.default ?? excelJsModule;
			const workbook = new ExcelJS.Workbook();

			workbook.creator = "ALSORG PackFlow";
			workbook.company = "ALSORG";
			workbook.title = "Custom Challan Management Report";
			workbook.subject = "Admin analytics, custom challan register and activity report";
			workbook.category = "Custom Challan Reporting";
			workbook.created = new Date();
			workbook.modified = new Date();

			const styleHeaderRow = (row, accent = "FF7C3AED") => {
				row.height = 26;
				row.eachCell({ includeEmpty: true }, (cell) => {
					cell.font = {
						name: "Calibri",
						size: 10,
						bold: true,
						color: { argb: "FFFFFFFF" },
					};
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: accent },
					};
					cell.alignment = {
						horizontal: "center",
						vertical: "middle",
						wrapText: true,
					};
					cell.border = {
						top: { style: "thin", color: { argb: "FFD8B4FE" } },
						left: { style: "thin", color: { argb: "FFD8B4FE" } },
						bottom: { style: "thin", color: { argb: "FFD8B4FE" } },
						right: { style: "thin", color: { argb: "FFD8B4FE" } },
					};
				});
			};

			const styleDataRow = (row, index) => {
				row.height = 25;
				row.eachCell({ includeEmpty: true }, (cell) => {
					cell.font = {
						name: "Calibri",
						size: 10,
						color: { argb: "FF1E293B" },
					};
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: {
							argb: index % 2 ? "FFF8FAFC" : "FFFFFFFF",
						},
					};
					cell.alignment = {
						vertical: "middle",
						wrapText: true,
					};
					cell.border = {
						top: { style: "thin", color: { argb: "FFE2E8F0" } },
						left: { style: "thin", color: { argb: "FFE2E8F0" } },
						bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
						right: { style: "thin", color: { argb: "FFE2E8F0" } },
					};
				});
			};

			const setReportTitle = (worksheet, title, subtitle, lastColumn) => {
				worksheet.mergeCells(`A1:${lastColumn}1`);
				worksheet.mergeCells(`A2:${lastColumn}2`);

				const titleCell = worksheet.getCell("A1");
				titleCell.value = title;
				titleCell.font = {
					name: "Calibri",
					size: 18,
					bold: true,
					color: { argb: "FFFFFFFF" },
				};
				titleCell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FF0F172A" },
				};
				titleCell.alignment = { vertical: "middle" };
				worksheet.getRow(1).height = 32;

				const subtitleCell = worksheet.getCell("A2");
				subtitleCell.value = subtitle;
				subtitleCell.font = {
					name: "Calibri",
					size: 10,
					italic: true,
					color: { argb: "FF475569" },
				};
				subtitleCell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF8FAFC" },
				};
				worksheet.getRow(2).height = 23;
			};

			const summary = workbook.addWorksheet("Executive Summary", {
				views: [{ showGridLines: false }],
			});

			setReportTitle(
				summary,
				"ALSORG CUSTOM CHALLAN — EXECUTIVE SUMMARY",
				`Filters: ${customChallanFilterLabel} | Generated: ${new Date().toLocaleString("en-IN")}`,
				"H"
			);

			[18, 18, 18, 18, 18, 18, 18, 18].forEach((width, index) => {
				summary.getColumn(index + 1).width = width;
			});

			const summaryMetrics = [
				["Total Challans", customChallanAdminStats.totalChallans],
				["Total Items", customChallanAdminStats.totalItems],
				["Created Today", customChallanAdminStats.todayCount],
				["This Month", customChallanAdminStats.monthCount],
				["Unique Creators", customChallanAdminStats.uniqueCreators],
				["Unique Clients", customChallanAdminStats.uniqueClients],
				["Avg Items / Challan", Number(customChallanAdminStats.averageItems.toFixed(2))],
				["Driver+Vehicle Complete %", customChallanAdminStats.logisticsCompleteness],
			];

			const metricHeader = summary.getRow(4);
			metricHeader.values = summaryMetrics.map(([label]) => label);
			styleHeaderRow(metricHeader, "FF7C3AED");

			const metricValues = summary.getRow(5);
			metricValues.values = summaryMetrics.map(([, value]) => value);
			metricValues.height = 30;
			metricValues.eachCell((cell) => {
				cell.font = {
					name: "Calibri",
					size: 14,
					bold: true,
					color: { argb: "FF312E81" },
				};
				cell.alignment = { horizontal: "center", vertical: "middle" };
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF5F3FF" },
				};
			});

			summary.getCell("A7").value = "Challan Type Analysis";
			summary.getCell("A7").font = { bold: true, size: 12, color: { argb: "FF5B21B6" } };
			const typeHeader = summary.getRow(8);
			typeHeader.values = ["Type", "Challans", "Items", "Share %"];
			styleHeaderRow(typeHeader, "FF8B5CF6");

			customChallanAdminStats.typeBreakdown.forEach((entry, index) => {
				const row = summary.addRow([
					entry.label,
					entry.challans,
					entry.items,
					customChallanAdminStats.totalChallans
						? entry.challans / customChallanAdminStats.totalChallans
						: 0,
				]);
				styleDataRow(row, index);
				row.getCell(4).numFmt = "0.0%";
			});

			const register = workbook.addWorksheet("Challan Register", {
				views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
			});

			const registerColumns = [
				["Challan No.", 24],
				["Date / Time", 20],
				["Type", 27],
				["From", 22],
				["To / Site", 24],
				["PD No.", 18],
				["Client", 28],
				["Purpose", 34],
				["Driver", 22],
				["Vehicle", 18],
				["Handed Over To", 22],
				["Generated By", 22],
				["Items", 10],
			];

			setReportTitle(
				register,
				"ALSORG CUSTOM CHALLAN REGISTER",
				`Scope: ${customChallanFilterLabel}`,
				"M"
			);

			registerColumns.forEach(([, width], index) => {
				register.getColumn(index + 1).width = width;
			});

			const registerHeader = register.getRow(4);
			registerHeader.values = registerColumns.map(([label]) => label);
			styleHeaderRow(registerHeader, "FF7C3AED");

			sourceRows.forEach((challan, index) => {
				const row = register.addRow([
					challan?.challanNumber || "",
					formatLocalDateTimeDisplay(challan?.generatedAt),
					challan?.challanTypeLabel || getCustomChallanTypeLabel(challan?.challanType),
					challan?.fromLocation || "",
					challan?.toLocation || "",
					challan?.pdNo || "",
					challan?.clientName || "",
					challan?.purpose || "",
					challan?.driverName || "",
					challan?.vehicleNumber || "",
					challan?.handedOverTo || "",
					challan?.generatedBy || "",
					Number(challan?.totalItems || 0),
				]);
				styleDataRow(row, index);
			});

			register.autoFilter = {
				from: { row: 4, column: 1 },
				to: { row: Math.max(4, register.rowCount), column: registerColumns.length },
			};

			const itemSheet = workbook.addWorksheet("Item Details", {
				views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
			});

			const itemColumns = [
				["Challan No.", 24],
				["Date / Time", 20],
				["Type", 26],
				["PD No.", 18],
				["Client", 26],
				["Description", 42],
				["Line PD / Reference", 22],
				["Quantity", 12],
				["UOM", 12],
				["Returnable", 13],
				["Remarks", 34],
			];

			setReportTitle(
				itemSheet,
				"ALSORG CUSTOM CHALLAN — ITEM DETAILS",
				"Line-level data loaded from each Admin-accessible custom challan record",
				"K"
			);

			itemColumns.forEach(([, width], index) => {
				itemSheet.getColumn(index + 1).width = width;
			});

			const itemHeader = itemSheet.getRow(4);
			itemHeader.values = itemColumns.map(([label]) => label);
			styleHeaderRow(itemHeader, "FF6D28D9");

			let itemRowIndex = 0;
			sourceRows.forEach((challan) => {
				const detail = detailMap.get(challan?.challanNumber);
				const items = Array.isArray(detail?.items) ? detail.items : [];

				items.forEach((item) => {
					const row = itemSheet.addRow([
						challan?.challanNumber || "",
						formatLocalDateTimeDisplay(challan?.generatedAt),
						challan?.challanTypeLabel || getCustomChallanTypeLabel(challan?.challanType),
						challan?.pdNo || "",
						challan?.clientName || "",
						item?.description || "",
						item?.drawingNo || "",
						Number(item?.quantity || 0),
						item?.uom || "",
						item?.returnable ? "Yes" : "No",
						item?.remarks || "",
					]);

					styleDataRow(row, itemRowIndex);
					itemRowIndex += 1;
				});
			});

			itemSheet.autoFilter = {
				from: { row: 4, column: 1 },
				to: { row: Math.max(4, itemSheet.rowCount), column: itemColumns.length },
			};

			const activitySheet = workbook.addWorksheet("User Activity", {
				views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
			});

			setReportTitle(
				activitySheet,
				"ALSORG CUSTOM CHALLAN — CREATION ACTIVITY",
				"Generation activity derived from generatedBy and generatedAt fields",
				"D"
			);

			[30, 16, 16, 22].forEach((width, index) => {
				activitySheet.getColumn(index + 1).width = width;
			});

			const activityHeader = activitySheet.getRow(4);
			activityHeader.values = ["Generated By", "Challans", "Items", "Last Activity"];
			styleHeaderRow(activityHeader, "FF2563EB");

			customChallanAdminStats.creatorBreakdown.forEach((entry, index) => {
				const row = activitySheet.addRow([
					entry.name,
					entry.challans,
					entry.items,
					formatLocalDateTimeDisplay(entry.lastAt),
				]);
				styleDataRow(row, index);
			});

			const routeSheet = workbook.addWorksheet("Route Analysis", {
				views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
			});

			setReportTitle(
				routeSheet,
				"ALSORG CUSTOM CHALLAN — ROUTE ANALYSIS",
				"From-to movement frequency and material-line volume",
				"D"
			);

			[48, 16, 16, 22].forEach((width, index) => {
				routeSheet.getColumn(index + 1).width = width;
			});

			const routeHeader = routeSheet.getRow(4);
			routeHeader.values = ["Movement Route", "Challans", "Items", "Last Activity"];
			styleHeaderRow(routeHeader, "FF059669");

			customChallanAdminStats.routeBreakdown.forEach((entry, index) => {
				const row = routeSheet.addRow([
					entry.route,
					entry.challans,
					entry.items,
					formatLocalDateTimeDisplay(entry.lastAt),
				]);
				styleDataRow(row, index);
			});

			[summary, register, itemSheet, activitySheet, routeSheet].forEach((sheet) => {
				sheet.pageSetup = {
					paperSize: 9,
					orientation: "landscape",
					fitToPage: true,
					fitToWidth: 1,
					fitToHeight: 0,
					margins: {
						left: 0.25,
						right: 0.25,
						top: 0.5,
						bottom: 0.5,
						header: 0.2,
						footer: 0.2,
					},
				};

				sheet.headerFooter.oddFooter =
					"&LALSORG PackFlow&CPage &P of &N&RCustom Challan Report";
			});

			const buffer = await workbook.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});

			const dateStamp = getCustomChallanDateKey(new Date()).replaceAll("-", "");

			downloadDispatchBlob({
				blob,
				fileName: `ALSORG_Custom_Challan_Admin_Report_${dateStamp}.xlsx`,
			});
		} catch (error) {
			console.error("Custom challan admin report failed:", error);
			alert(error?.message || "Custom challan report export failed");
		} finally {
			setCustomChallanReportLoading(false);
		}
	};

	const customChallanTotalPages = useMemo(() => {
		return Math.max(
			1,
			Math.ceil(
				customChallanFilteredRows.length / customChallanPageSize
			)
		);
	}, [customChallanFilteredRows.length, customChallanPageSize]);

	const paginatedCustomChallans = useMemo(() => {
		const start =
			(customChallanPageNo - 1) * customChallanPageSize;

		return customChallanFilteredRows.slice(
			start,
			start + customChallanPageSize
		);
	}, [
		customChallanFilteredRows,
		customChallanPageNo,
		customChallanPageSize,
	]);

	const selectedDispatchDriver =
		useMemo(() => {
			const selectedId =
				String(
					dispatchTripForm.driverId ||
					""
				).trim();

			if (!selectedId) {
				return null;
			}

			return (
				logisticsDrivers.find(
					(driver) =>
						String(
							driver?.id || ""
						).trim() ===
						selectedId
				) || null
			);
		}, [
			dispatchTripForm.driverId,
			logisticsDrivers,
		]);

	const selectedDispatchVehicle =
		useMemo(() => {
			const selectedId =
				String(
					dispatchTripForm.vehicleId ||
					""
				).trim();

			if (!selectedId) {
				return null;
			}

			return (
				logisticsVehicles.find(
					(vehicle) =>
						String(
							vehicle?.id || ""
						).trim() ===
						selectedId
				) || null
			);
		}, [
			dispatchTripForm.vehicleId,
			logisticsVehicles,
		]);

	const normalizeDispatchHelperLoaderCount =
		(value) => {
			const cleanValue =
				String(value ?? "")
					.trim();

			if (!cleanValue) {
				return null;
			}

			const parsedValue =
				Number(cleanValue);

			if (
				!Number.isInteger(
					parsedValue
				) ||
				parsedValue < 0 ||
				parsedValue > 999
			) {
				throw new Error(
					"Helpers / loaders must be a whole number between 0 and 999"
				);
			}

			/*
			 * Zero and blank both mean that no helper count
			 * was specified.
			 */
			return parsedValue === 0
				? null
				: parsedValue;
		};

	const buildDispatchChallanRequest =
		() => {
			const itemIds =
				Array.from(
					new Set(
						(
							Array.isArray(
								dispatchTripContext.itemIds
							)
								? dispatchTripContext.itemIds
								: []
						)
							.map((id) =>
								String(
									id || ""
								).trim()
							)
							.filter(Boolean)
					)
				);

			return {
				itemIds,

				driverId:
					String(
						dispatchTripForm.driverId ||
						""
					).trim() ||
					null,

				vehicleId:
					String(
						dispatchTripForm.vehicleId ||
						""
					).trim() ||
					null,

				helperLoaderCount:
					normalizeDispatchHelperLoaderCount(
						dispatchTripForm
							.helperLoaderCount
					),

				dispatchTime:
					String(
						dispatchTripForm.dispatchTime ||
						""
					).trim(),
			};
		};

	const buildDispatchReviewSignature =
		(request) => {
			return JSON.stringify({
				itemIds:
					request?.itemIds ||
					[],

				driverId:
					request?.driverId ||
					"",

				vehicleId:
					request?.vehicleId ||
					"",

				helperLoaderCount:
					request?.helperLoaderCount ??
					null,

				dispatchTime:
					request?.dispatchTime ||
					"",
			});
		};

	const validateDispatchChallanRequest =
		(request) => {
			if (!request?.dispatchTime) {
				throw new Error(
					"Please select challan date and time"
				);
			}

			if (
				!Array.isArray(
					request?.itemIds
				) ||
				request.itemIds.length === 0
			) {
				throw new Error(
					"No items selected for challan"
				);
			}

			if (
				dispatchTripContext.mode ===
				"QR_BULK"
			) {
				const qrCart =
					Array.isArray(
						dispatchTripContext.qrCart
					)
						? dispatchTripContext.qrCart
						: [];

				const missingZoneItem =
					qrCart.find((item) => {
						return (
							item?.moveToFgRequired &&
							isScanFgZoneRequired(
								item
							) &&
							!String(
								item?.fgZoneCode ||
								""
							).trim()
						);
					});

				if (missingZoneItem) {
					throw new Error(
						`Select FG zone for ${missingZoneItem.itemName ||
						"selected item"
						}`
					);
				}
			}
		};

	const dispatchTripPreviewItems =
		useMemo(() => {
			const itemIds =
				Array.isArray(
					dispatchTripContext.itemIds
				)
					? dispatchTripContext.itemIds
					: [];

			const qrItems =
				Array.isArray(
					dispatchTripContext.qrCart
				)
					? dispatchTripContext.qrCart
					: [];

			const rowLookup =
				new Map(
					(rows || [])
						.filter(
							(row) =>
								row?.zohoItemId
						)
						.map((row) => [
							String(
								row.zohoItemId
							).trim(),
							row,
						])
				);

			const qrLookup =
				new Map(
					qrItems
						.filter(
							(item) =>
								item?.zohoItemId
						)
						.map((item) => [
							String(
								item.zohoItemId
							).trim(),
							item,
						])
				);

			return itemIds.map(
				(itemId, index) => {
					const cleanId =
						String(
							itemId || ""
						).trim();

					const row =
						rowLookup.get(
							cleanId
						) ||
						qrLookup.get(
							cleanId
						) ||
						{};

					return {
						...row,

						zohoItemId:
							cleanId,

						previewSerial:
							index + 1,

						itemName:
							row?.name ||
							row?.itemName ||
							row?.productName ||
							"Unnamed Item",

						sku:
							row?.sku ||
							"—",

						pdNo:
							row?.pdNo ||
							"—",

						drawingNo:
							row?.drawingNo ||
							"—",

						clientName:
							row?.clientName ||
							"—",

						clientAddress:
							row?.clientAddress ||
							"—",

						plantCode:
							row?.plantCode ||
							"—",

						location:
							row?.currentLocationCode ||
							row?.location ||
							"—",

						status:
							row?.status ||
							"—",
					};
				}
			);
		}, [
			rows,
			dispatchTripContext.itemIds,
			dispatchTripContext.qrCart,
		]);

	const openDispatchTripReview =
		async () => {
			try {
				const request =
					buildDispatchChallanRequest();

				validateDispatchChallanRequest(
					request
				);

				setDispatchTripStep(
					"REVIEW"
				);

				if (
					dispatchTripContext.mode ===
					"QR_BULK"
				) {
					const qrCart =
						Array.isArray(
							dispatchTripContext.qrCart
						)
							? dispatchTripContext.qrCart
							: [];

					const pendingFgItems =
						qrCart.filter(
							(item) =>
								item?.moveToFgRequired
						);

					if (
						pendingFgItems.length >
						0
					) {
						await moveQrCartItemsToFgIfNeeded(
							pendingFgItems
						);

						const movedIds =
							new Set(
								pendingFgItems.map(
									(item) =>
										String(
											item?.zohoItemId ||
											""
										).trim()
								)
							);

						/*
						 * Prevent duplicate FG movements when the
						 * user returns to Details and reviews again.
						 */
						setDispatchTripContext(
							(previous) => ({
								...previous,

								qrCart:
									previous.qrCart.map(
										(item) =>
											movedIds.has(
												String(
													item?.zohoItemId ||
													""
												).trim()
											)
												? {
													...item,
													moveToFgRequired:
														false,
												}
												: item
									),
							})
						);
					}
				}

				await loadDispatchReviewPdf(
					request
				);

			} catch (error) {
				console.error(
					"Unable to open challan review:",
					error
				);

				setDispatchTripStep(
					"DETAILS"
				);

				alert(
					error?.message ||
					"Unable to prepare challan review"
				);
			}
		};

	useEffect(() => {
		return () => {
			dispatchReviewPdfAbortRef.current?.abort();

			const activeUrl =
				dispatchReviewPdfUrlRef.current;

			if (activeUrl) {
				URL.revokeObjectURL(
					activeUrl
				);
			}
		};
	}, []);

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

	const renderDispatchImportDrawer = () => {
		const appliedCount = dispatchImportRows.filter((row) => row?.applied).length;
		const selectedCount = dispatchImportEligibleRows.filter((row) =>
			dispatchImportSelectedSet.has(row.rowNumber)
		).length;
		const visibleRows = filteredDispatchImportRows.slice(0, dispatchImportVisibleCount);
		const hasMoreRows = filteredDispatchImportRows.length > visibleRows.length;

		const summaryCards = [
			{
				label: "Excel Rows",
				value: Number(dispatchImportVerification?.totalRows || dispatchImportRows.length || 0),
				color: "var(--pf-text)",
			},
			{
				label: "Matched",
				value: Number(dispatchImportVerification?.matchedCount || 0),
				color: "#6ee7b7",
			},
			{
				label: "Unmatched",
				value: Number(dispatchImportVerification?.unmatchedCount || 0),
				color: "#fca5a5",
			},
			{
				label: "Invalid",
				value: Number(dispatchImportVerification?.invalidCount || 0),
				color: "#fcd34d",
			},
			{
				label: "Duplicate Allocations",
				value: Number(dispatchImportVerification?.duplicateAllocationCount || 0),
				color: "#c4b5fd",
			},
			{
				label: "Applied",
				value: appliedCount,
				color: "#67e8f9",
			},
		];

		return (
			<Drawer
				anchor="right"
				open={dispatchImportOpen}
				onClose={() => {
					if (!dispatchImportLoading && !dispatchImportApplying) {
						setDispatchImportOpen(false);
					}
				}}
				PaperProps={{
					sx: {
						width: { xs: "100vw", md: "min(1180px,96vw)" },
						maxWidth: "100vw",
						background:
							"var(--pf-surface)",
						color: "var(--pf-text-strong)",
						borderLeft: "1px solid var(--pf-border)",
						boxShadow: "-26px 0 70px rgba(var(--pf-surface-deep-rgb),.52)",
					},
				}}
			>
				<Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
					<Box
						sx={{
							position: "sticky",
							top: 0,
							zIndex: 10,
							px: { xs: 2, md: 3 },
							py: 2.2,
							background: "rgba(7,17,31,.97)",
							backdropFilter: "blur(18px)",
							borderBottom: "1px solid rgba(148,163,184,.13)",
						}}
					>
						<Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Box sx={{ fontSize: 22, fontWeight: 950, letterSpacing: "-.02em" }}>
									Verified Dispatch XLSX Import
								</Box>
								<Box sx={{ color: "var(--pf-text-muted)", fontSize: 12.5, mt: 0.5 }}>
									Match authority: Item Name + PD No + DWG No. Description and Client only
									disambiguate repeated packet rows.
								</Box>
								{dispatchImportFileName && (
									<Box sx={{ color: "#67e8f9", fontSize: 12, fontWeight: 850, mt: 0.8 }}>
										📎 {dispatchImportFileName}
									</Box>
								)}
							</Box>

							<Button
								disabled={dispatchImportLoading || dispatchImportApplying}
								onClick={() => dispatchImportInputRef.current?.click()}
								sx={{
									textTransform: "none",
									fontWeight: 900,
									color: "#cffafe",
									border: "1px solid rgba(34,211,238,.25)",
									borderRadius: "10px",
								}}
							>
								Choose Another XLSX
							</Button>

							<IconButton
								disabled={dispatchImportLoading || dispatchImportApplying}
								onClick={() => setDispatchImportOpen(false)}
								sx={{ color: "var(--pf-text-muted)" }}
							>
								✕
							</IconButton>
						</Box>
					</Box>

					<Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
						{dispatchImportLoading ? (
							<Box
								sx={{
									minHeight: 420,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexDirection: "column",
									gap: 2,
								}}
							>
								<CircularProgress size={34} />
								<Box sx={{ fontWeight: 900 }}>Reading XLSX and verifying Dispatch records…</Box>
								<Box sx={{ color: "var(--pf-text-muted)", fontSize: 12 }}>
									Nothing is updated until you confirm matched rows below.
								</Box>
							</Box>
						) : !dispatchImportVerification ? (
							<Box
								sx={{
									minHeight: 360,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexDirection: "column",
									gap: 1.5,
									color: "var(--pf-text-muted)",
								}}
							>
								<Box sx={{ fontSize: 38 }}>📊</Box>
								<Box sx={{ color: "var(--pf-text-strong)", fontWeight: 900 }}>Select an XLSX to verify</Box>
								<Box sx={{ fontSize: 12.5 }}>
									Expected columns include Item Name, PD No, DWG No, Dispatch Date and Driver Name.
								</Box>
							</Box>
						) : (
							<>
								<Box
									sx={{
										display: "grid",
										gridTemplateColumns: {
											xs: "repeat(2,minmax(0,1fr))",
											md: "repeat(6,minmax(0,1fr))",
										},
										gap: 1.2,
										mb: 2,
									}}
								>
									{summaryCards.map((card) => (
										<Box
											key={card.label}
											sx={{
												p: 1.5,
												borderRadius: "12px",
												background: "rgba(var(--pf-fg-rgb),.035)",
												border: "1px solid rgba(148,163,184,.10)",
											}}
										>
											<Box sx={{ color: "var(--pf-text-muted)", fontSize: 10.5, fontWeight: 850 }}>
												{card.label}
											</Box>
											<Box sx={{ color: card.color, fontSize: 23, fontWeight: 950, mt: 0.25 }}>
												{card.value}
											</Box>
										</Box>
									))}
								</Box>

								<Box
									sx={{
										display: "flex",
										gap: 1,
										alignItems: "center",
										flexWrap: "wrap",
										mb: 1.4,
									}}
								>
									{[
										["ALL", "All"],
										["MATCHED", "Matched"],
										["UNMATCHED", "Unmatched"],
										["INVALID", "Invalid"],
									].map(([value, label]) => (
										<Button
											key={value}
											onClick={() => {
												setDispatchImportFilter(value);
												setDispatchImportVisibleCount(250);
											}}
											sx={{
												height: 34,
												px: 1.5,
												borderRadius: "9px",
												textTransform: "none",
												fontWeight: 900,
												fontSize: 11,
												color: dispatchImportFilter === value ? "#fff" : "var(--pf-text-muted)",
												background:
													dispatchImportFilter === value
														? "rgba(37,99,235,.34)"
														: "rgba(var(--pf-fg-rgb),.03)",
												border: "1px solid rgba(148,163,184,.12)",
											}}
										>
											{label}
										</Button>
									))}

									<TextField
										size="small"
										placeholder="Search verification rows…"
										value={dispatchImportSearch}
										onChange={(event) => {
											setDispatchImportSearch(event.target.value);
											setDispatchImportVisibleCount(250);
										}}
										sx={{
											minWidth: { xs: "100%", md: 280 },
											ml: { md: "auto" },
											"& .MuiOutlinedInput-root": {
												color: "#fff",
												background: "rgba(var(--pf-fg-rgb),.035)",
												borderRadius: "10px",
												"& fieldset": { borderColor: "rgba(148,163,184,.15)" },
											},
										}}
									/>
								</Box>

								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.2,
										mb: 1.2,
										p: 1.2,
										borderRadius: "11px",
										background: "rgba(var(--pf-surface-rgb),.72)",
										border: "1px solid rgba(148,163,184,.10)",
									}}
								>
									<Checkbox
										checked={
											dispatchImportEligibleRows.length > 0 &&
											dispatchImportEligibleRows.every((row) =>
												dispatchImportSelectedSet.has(row.rowNumber)
											)
										}
										indeterminate={
											selectedCount > 0 && selectedCount < dispatchImportEligibleRows.length
										}
										onChange={selectAllDispatchImportMatches}
										sx={{ color: "var(--pf-text-dim)", "&.Mui-checked": { color: "#22d3ee" } }}
									/>
									<Box sx={{ flex: 1, color: "var(--pf-text-soft)", fontSize: 12.5, fontWeight: 800 }}>
										{selectedCount} verified row{selectedCount === 1 ? "" : "s"} selected. Applying
										changes only Status → DISPATCHED, Dispatch Date, Driver, dispatch timestamps,
										stock, and linked PacketItem status.
									</Box>
									<Button
										disabled={dispatchImportApplying || selectedCount === 0}
										onClick={applySelectedDispatchImportRows}
										sx={{
											height: 38,
											px: 2.2,
											borderRadius: "10px",
											textTransform: "none",
											fontWeight: 950,
											color: "#fff",
											background: "linear-gradient(135deg,#0891b2,#0e7490)",
											"&.Mui-disabled": {
												background: "rgba(var(--pf-fg-rgb),.07)",
												color: "rgba(var(--pf-fg-rgb),.32)",
											},
										}}
									>
										{dispatchImportApplying ? "Applying…" : `Dispatch Selected (${selectedCount})`}
									</Button>
								</Box>

								<Box
									sx={{
										overflow: "auto",
										maxHeight: "calc(100vh - 350px)",
										borderRadius: "12px",
										border: "1px solid rgba(148,163,184,.11)",
										background: "rgba(var(--pf-surface-deep-rgb),.36)",
									}}
								>
									<Box
										sx={{
											display: "grid",
											gridTemplateColumns:
												"54px 86px minmax(250px,1.25fr) minmax(270px,1.15fr) minmax(190px,.85fr) minmax(180px,.8fr) minmax(260px,1fr)",
											minWidth: 1230,
											position: "sticky",
											top: 0,
											zIndex: 3,
											background: "var(--pf-surface)",
											borderBottom: "1px solid rgba(148,163,184,.14)",
											color: "var(--pf-text-muted)",
											fontSize: 10.5,
											fontWeight: 950,
											textTransform: "uppercase",
											letterSpacing: ".05em",
										}}
									>
										{["", "Excel Row", "Excel Identity", "Matched Dispatch Record", "Dispatch Data", "Status Change", "Verification / Action"].map(
											(label) => (
												<Box key={label || "select"} sx={{ p: 1.2, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)" }}>
													{label}
												</Box>
											)
										)}
									</Box>

									{visibleRows.map((row) => {
										const matched = row?.matchStatus === "MATCHED";
										const eligible = matched && row?.applyEligible && !row?.applied;
										const selected = dispatchImportSelectedSet.has(row.rowNumber);
										const matchColor = row?.applied
											? "#22d3ee"
											: matched
												? "#34d399"
												: row?.matchStatus === "INVALID"
													? "#fbbf24"
													: "#f87171";

										return (
											<Box
												key={`${row?.rowNumber}-${row?.zohoItemId || row?.matchStatus || "row"}`}
												sx={{
													display: "grid",
													gridTemplateColumns:
														"54px 86px minmax(250px,1.25fr) minmax(270px,1.15fr) minmax(190px,.85fr) minmax(180px,.8fr) minmax(260px,1fr)",
													minWidth: 1230,
													alignItems: "stretch",
													borderBottom: "1px solid rgba(148,163,184,.075)",
													background: row?.applied
														? "rgba(8,145,178,.07)"
														: "rgba(var(--pf-surface-rgb),.34)",
												}}
											>
												<Box sx={{ p: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
													<Checkbox
														disabled={!eligible || dispatchImportApplying}
														checked={eligible && selected}
														onChange={() => toggleDispatchImportRow(row.rowNumber)}
														sx={{ color: "#475569", "&.Mui-checked": { color: "#22d3ee" } }}
													/>
												</Box>

												<Box sx={{ p: 1.15, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)" }}>
													<Box sx={{ fontWeight: 950 }}>#{row?.rowNumber || "—"}</Box>
													<Chip
														size="small"
														label={row?.applied ? "APPLIED" : row?.matchStatus || "UNKNOWN"}
														sx={{
															mt: 0.7,
															height: 22,
															fontSize: 9.5,
															fontWeight: 950,
															color: matchColor,
															background: `${matchColor}18`,
															border: `1px solid ${matchColor}40`,
														}}
													/>
												</Box>

												<Box sx={{ p: 1.15, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)", minWidth: 0 }}>
													<Box sx={{ fontWeight: 900, fontSize: 12.5, lineHeight: 1.35 }}>{row?.itemName || "—"}</Box>
													<Box sx={{ color: "#93c5fd", fontSize: 11.5, mt: 0.55 }}>
														PD: {row?.pdNo || "—"} · DWG: {row?.drawingNo || "—"}
													</Box>
													<Box sx={{ color: "var(--pf-text-dim)", fontSize: 10.5, mt: 0.45 }}>
														{row?.description || "No description"}
													</Box>
												</Box>

												<Box sx={{ p: 1.15, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)", minWidth: 0 }}>
													{matched ? (
														<>
															<Box sx={{ fontWeight: 900, fontSize: 12.5 }}>{row?.matchedItemName || row?.itemName || "—"}</Box>
															<Box sx={{ color: "#c4b5fd", fontSize: 11, mt: 0.5, fontFamily: "monospace" }}>
																{row?.sku || "No SKU"}
															</Box>
															<Box sx={{ color: "var(--pf-text-dim)", fontSize: 9.5, mt: 0.4, wordBreak: "break-all" }}>
																ID: {row?.zohoItemId || "—"}
															</Box>
															{Number(row?.candidateCount || 0) > 1 && (
																<Box sx={{ color: "#fcd34d", fontSize: 10, mt: 0.5, fontWeight: 850 }}>
																	{row.candidateCount} primary matches · unique ID allocated
																</Box>
															)}
														</>
													) : (
														<Box sx={{ color: "var(--pf-text-dim)", fontSize: 11.5 }}>No database item allocated</Box>
													)}
												</Box>

												<Box sx={{ p: 1.15, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)" }}>
													<Box sx={{ color: "var(--pf-text)", fontSize: 11.5, fontWeight: 850 }}>
														{String(row?.dispatchDateTime || "—").replace("T", " ")}
													</Box>
													<Box sx={{ color: "#67e8f9", fontSize: 11.5, mt: 0.5 }}>
														Driver: {row?.driverName || "—"}
													</Box>
													{row?.sourceStatus && (
														<Box sx={{ color: "var(--pf-text-dim)", fontSize: 10, mt: 0.4 }}>
															XLSX status: {row.sourceStatus}
														</Box>
													)}
												</Box>

												<Box sx={{ p: 1.15, borderRight: "1px solid rgba(var(--pf-fg-rgb),.04)" }}>
													<Box sx={{ color: "var(--pf-text-muted)", fontSize: 10.5 }}>Current</Box>
													<Box sx={{ color: "#fcd34d", fontSize: 11.5, fontWeight: 900, mt: 0.25 }}>
														{row?.currentStatus || "—"}
													</Box>
													<Box sx={{ color: "var(--pf-text-dim)", fontSize: 10, my: 0.4 }}>↓</Box>
													<Box sx={{ color: "#34d399", fontSize: 11.5, fontWeight: 950 }}>DISPATCHED</Box>
												</Box>

												<Box sx={{ p: 1.15, minWidth: 0 }}>
													<Box sx={{ color: matched ? "var(--pf-text-soft)" : matchColor, fontSize: 10.8, lineHeight: 1.4 }}>
														{row?.matchReason || "—"}
													</Box>
													{eligible && (
														<Button
															disabled={dispatchImportApplying}
															onClick={() => applyDispatchImportRows([row])}
															sx={{
																mt: 0.9,
																height: 30,
																px: 1.4,
																borderRadius: "8px",
																textTransform: "none",
																fontWeight: 900,
																fontSize: 10.5,
																color: "#ecfeff",
																background: "rgba(8,145,178,.22)",
																border: "1px solid rgba(34,211,238,.22)",
															}}
														>
															Dispatch This Row
														</Button>
													)}
												</Box>
											</Box>
										);
									})}

									{visibleRows.length === 0 && (
										<Box sx={{ p: 4, color: "var(--pf-text-dim)", textAlign: "center" }}>
											No verification rows match the current filter.
										</Box>
									)}
								</Box>

								<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.2 }}>
									<Box sx={{ color: "var(--pf-text-dim)", fontSize: 11 }}>
										Showing {visibleRows.length} of {filteredDispatchImportRows.length} filtered rows.
									</Box>

									{hasMoreRows && (
										<Button
											onClick={() => setDispatchImportVisibleCount((count) => count + 250)}
											sx={{ color: "#93c5fd", textTransform: "none", fontWeight: 900 }}
										>
											Show 250 More
										</Button>
									)}
								</Box>
							</>
						)}
					</Box>
				</Box>
			</Drawer>
		);
	};

	return (
		<div className="packflow-theme-page packflow-dispatch-page" style={page}>
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
									width: 46,
									height: 46,
									borderRadius: "13px",
									fontSize: 23,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "var(--dispatch-blue-text)",
									background: "rgba(59,130,246,.09)",
									border: "1px solid rgba(59,130,246,.18)",
									boxShadow: "0 6px 16px rgba(37,99,235,.08)",
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
							gap: 1,
							flexWrap: "wrap",
							justifyContent: "flex-end",
						}}
					>
						<Box
							sx={{
								display: "inline-flex",
								alignItems: "center",
								gap: 0.7,
								height: 38,
								px: 1.3,
								borderRadius: "10px",
								color: "var(--pf-text-muted)",
								fontSize: 11.5,
								fontWeight: 800,
								background: "var(--pf-surface-alt)",
								border: "1px solid var(--pf-border-soft)",
							}}
						>
							Total Items
							<Box
								component="span"
								sx={{
									color: "var(--dispatch-blue-text)",
									fontSize: 13,
									fontWeight: 950,
								}}
							>
								{dispatchMatchingRowCount}
							</Box>
						</Box>

						{(isDispatch || isAdmin) && (
							<>
								<input
									ref={dispatchImportInputRef}
									type="file"
									accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
									onChange={handleDispatchImportFile}
									style={{ display: "none" }}
								/>

								<Button
									disabled={dispatchImportLoading || dispatchImportApplying}
									onClick={() => dispatchImportInputRef.current?.click()}
									sx={dispatchImportButtonSx}
								>
									⬆ Import Dispatch XLSX
								</Button>
							</>
						)}

						<Button
							disabled={loading}
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

				{renderDispatchImportDrawer()}

				<Box
					sx={{
						...searchPanel,
						...(dispatchSearchPending
							? activeSearchPanelSx
							: {}),
					}}
				>
					<Box sx={dispatchSearchInputWrapSx}>
						<SearchIcon
							sx={{
								color:
									dispatchSearchPending
										? "var(--dispatch-blue-text)"
										: "var(--pf-text-muted)",
								transition:
									"color .16s ease",
							}}
						/>
	
						<TextField
							variant="standard"
							placeholder="Search item, SKU, client, PD, DWG, plant, location, status..."
							value={search}
							onChange={(e) => {
								setSearch(
									e.target.value
								);
								setPageNo(1);
							}}
							InputProps={{ disableUnderline: true }}
							sx={{
								flex: "1 1 auto",
								minWidth: 0,
								width: "100%",
	
								"& .MuiInputBase-root": {
									color: "var(--pf-text-strong)",
									fontSize: 12.5,
									fontWeight: 750,
								},
	
								"& input::placeholder": {
									color: "rgba(var(--pf-fg-rgb),.42)",
									opacity: 1,
								},
							}}
						/>
	
						{dispatchSearchPending ? (
							<Box
								sx={searchActivitySlotSx}
								aria-live="polite"
								aria-atomic="true"
								title={`Searching for "${String(search || "").trim()}"`}
							>
								<Box sx={searchActivityPillSx}>
									<CircularProgress
										size={13}
										thickness={5}
										sx={{
											color: "var(--dispatch-blue-text)",
										}}
									/>
									Searching…
								</Box>
							</Box>
						) : null}
	
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
									color: "var(--pf-text-soft)",
									background: "rgba(var(--pf-fg-rgb),.05)",
									border: "1px solid rgba(var(--pf-fg-rgb),.08)",
	
									"&:hover": {
										background: "rgba(var(--pf-fg-rgb),.10)",
										color: "#fff",
									},
								}}
							>
								Clear
							</Button>
	
						) : null}
					</Box>

					<Button
						startIcon={
							<CalendarMonthOutlinedIcon />
						}
						onClick={(event) =>
							setDateFilterAnchor(
								event.currentTarget
							)
						}
						sx={dateFilterButtonSx(
							dateFilterActive
						)}
					>
						<Box
							sx={{
								minWidth: 0,
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-start",
								lineHeight: 1.1,
							}}
						>
							<Box
								sx={{
									color: "var(--pf-text-strong)",
									fontSize: 11,
									fontWeight: 950,
									whiteSpace: "nowrap",
								}}
							>
								{dateFilterActive
									? "Date Filter Active"
									: "Date / Time"}
							</Box>

							<Box
								sx={{
									maxWidth: 220,
									mt: 0.35,
									color:
										dateFilterActive
											? "#bfdbfe"
											: "var(--pf-text-muted)",
									fontSize: 9.5,
									fontWeight: 750,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
								title={
									dateFilterSummary
								}
							>
								{dateFilterSummary}
							</Box>
						</Box>
					</Button>

					<Popover
						disableScrollLock
						marginThreshold={12}
						open={dateFilterOpen}
						anchorEl={
							dateFilterAnchor
						}
						onClose={() =>
							setDateFilterAnchor(
								null
							)
						}
						anchorOrigin={{
							vertical:
								"bottom",
							horizontal:
								"right",
						}}
						transformOrigin={{
							vertical:
								"top",
							horizontal:
								"right",
						}}
						PaperProps={{
							sx:
								dateFilterPopoverPaperSx,
						}}
					>
						<Box sx={dateFilterPanelSx}>
							<Box
								sx={
									dateFilterHeaderSx
								}
							>
								<Box
									sx={{
										display:
											"flex",
										alignItems:
											"center",
										gap: 1.2,
									}}
								>
									<Box
										sx={
											dateFilterIconSx
										}
									>
										<CalendarMonthOutlinedIcon />
									</Box>

									<Box>
										<Box
											sx={
												dateFilterTitleSx
											}
										>
											Date & Time Filter
										</Box>

										<Box
											sx={
												dateFilterSubtitleSx
											}
										>
											Choose a date basis, range and optional time window
										</Box>
									</Box>
								</Box>

								<Chip
									size="small"
									label={`${dispatchMatchingRowCount} matching`}
									sx={
										dateFilterCountChipSx
									}
								/>
							</Box>

							<Box sx={dateModeSectionSx}>
								<Box sx={dateModeSectionLabelSx}>
									Date Basis
								</Box>

								<Box sx={dateModeGridSx}>
									{DISPATCH_DATE_FILTER_MODES.map(
										(option) => {
											const activeMode =
												dateFilterMode ===
												option.value;

											return (
												<Button
													key={option.value}
													type="button"
													disableRipple
													onClick={() => {
														setDateFilterMode(
															option.value
														);
														setPageNo(1);
													}}
													sx={dateModeCardSx(
														activeMode
													)}
												>
													<Box sx={dateModeCardTextSx}>
														<Box sx={dateModeCardTitleSx}>
															{option.label}
														</Box>

														<Box sx={dateModeCardDescriptionSx}>
															{option.description}
														</Box>
													</Box>

													<Box sx={dateModeCheckSx(activeMode)}>
														{activeMode ? "✓" : ""}
													</Box>
												</Button>
											);
										}
									)}
								</Box>
							</Box>

							<Box sx={datePresetRowSx}>
								<Button
									onClick={() =>
										applyDispatchDatePreset(
											"TODAY"
										)
									}
									sx={
										datePresetButtonSx
									}
								>
									Today
								</Button>

								<Button
									onClick={() =>
										applyDispatchDatePreset(
											"YESTERDAY"
										)
									}
									sx={
										datePresetButtonSx
									}
								>
									Yesterday
								</Button>

								<Button
									onClick={() =>
										applyDispatchDatePreset(
											"LAST_7_DAYS"
										)
									}
									sx={
										datePresetButtonSx
									}
								>
									Last 7 Days
								</Button>

								<Button
									onClick={() =>
										applyDispatchDatePreset(
											"THIS_MONTH"
										)
									}
									sx={
										datePresetButtonSx
									}
								>
									This Month
								</Button>
							</Box>

							<Box sx={dateFilterGridSx}>
								<TextField
									label="From Date"
									type="date"
									value={
										dateFilterFrom
									}
									onChange={(event) => {
										setDateFilterFrom(
											event
												.target
												.value
										);

										setPageNo(1);
									}}
									InputLabelProps={{
										shrink: true,
									}}
									sx={
										dateFilterFieldSx
									}
								/>

								<TextField
									label="To Date"
									type="date"
									value={
										dateFilterTo
									}
									onChange={(event) => {
										setDateFilterTo(
											event
												.target
												.value
										);

										setPageNo(1);
									}}
									InputLabelProps={{
										shrink: true,
									}}
									sx={
										dateFilterFieldSx
									}
								/>
							</Box>

							<Box sx={dateFilterGridSx}>
								<TextField
									label="From Time"
									type="time"
									value={
										dateFilterTimeFrom
									}
									onChange={(event) => {
										setDateFilterTimeFrom(
											event
												.target
												.value
										);

										setPageNo(1);
									}}
									InputLabelProps={{
										shrink: true,
									}}
									InputProps={{
										startAdornment: (
											<AccessTimeOutlinedIcon
												sx={{
													mr: 0.8,
													color:
														"#60a5fa",
													fontSize:
														18,
												}}
											/>
										),
									}}
									sx={
										dateFilterFieldSx
									}
								/>

								<TextField
									label="To Time"
									type="time"
									value={
										dateFilterTimeTo
									}
									onChange={(event) => {
										setDateFilterTimeTo(
											event
												.target
												.value
										);

										setPageNo(1);
									}}
									InputLabelProps={{
										shrink: true,
									}}
									InputProps={{
										startAdornment: (
											<AccessTimeOutlinedIcon
												sx={{
													mr: 0.8,
													color:
														"#60a5fa",
													fontSize:
														18,
												}}
											/>
										),
									}}
									sx={
										dateFilterFieldSx
									}
								/>
							</Box>

							<Box sx={dateFilterHintSx}>
								<EventAvailableOutlinedIcon
									sx={{
										fontSize: 18,
										color: "var(--dispatch-green-text)",
										flexShrink: 0,
									}}
								/>

								<Box>
									<Box
										sx={{
											color: "#047857",
											fontSize: 11,
											fontWeight: 900,
										}}
									>
										{dateFilterActive
											? dateFilterSummary
											: "No date restriction applied"}
									</Box>

									<Box
										sx={{
											mt: 0.3,
											color: "var(--pf-text-muted)",
											fontSize: 10,
											fontWeight: 650,
										}}
									>
										The same date filter is also applied to the exported report.
									</Box>
								</Box>
							</Box>

							<Box sx={dateFilterFooterSx}>
								<Button
									startIcon={
										<RestartAltOutlinedIcon />
									}
									disabled={
										!dateFilterActive
									}
									onClick={
										clearDispatchDateFilter
									}
									sx={
										dateFilterClearButtonSx
									}
								>
									Clear
								</Button>

								<Button
									onClick={() =>
										setDateFilterAnchor(
											null
										)
									}
									sx={
										dateFilterDoneButtonSx
									}
								>
									Done
								</Button>
							</Box>
						</Box>
					</Popover>

					<TextField
						select
						size="small"
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter((prev) =>
								normalizeStatusSelection(
									e.target.value,
									prev
								)
							);

							setPageNo(1);
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
												"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",
											color: "var(--pf-text-strong)",
											border:
												"1px solid rgba(var(--pf-fg-rgb),.06)",
											backdropFilter: "blur(20px)",

											"& .MuiMenuItem-root": {
												fontSize: 14,
												fontWeight: 700,
												color: "var(--pf-text-strong)",
											},

											"& .MuiMenuItem-root:hover": {
												background: "rgba(59,130,246,.08)",
											},

											"& .Mui-selected": {
												background:
													"rgba(59,130,246,.16) !important",
												color: "var(--dispatch-blue-text)",
												fontWeight: 900,
											},
										},
									},
								},
							},
						}}
						sx={{
							width: "100%",
							minWidth: 0,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,
								borderRadius: "10px",
								background: "var(--pf-surface-alt)",
								color: "var(--pf-text-strong)",

								"& fieldset": {
									borderColor: "rgba(var(--pf-fg-rgb),.08)",
								},

								"&:hover fieldset": {
									borderColor: "rgba(59,130,246,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor: "#3b82f6",
								},
							},

							"& .MuiSelect-select": {
								color: "var(--pf-text-strong)",
								fontWeight: 800,
							},

							"& .MuiSvgIcon-root": {
								color: "var(--pf-text-muted)",
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
											color: "rgba(var(--pf-fg-rgb),.45)",
											"&.Mui-checked": {
												color: "#60a5fa",
											},
										}}
									/>

									<ListItemText
										primary={
											getDispatchStatusOptionDisplay(
												option
											)
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
						value={plantFilter}
						onChange={(event) => {
							setPlantFilter(
								event.target.value
							);

							setPageNo(1);
						}}
						sx={{
							width: "100%",
							minWidth: 0,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,
								borderRadius: "14px",

								background:
									"var(--pf-surface-alt)",

								color: "var(--pf-text-strong)",

								"& fieldset": {
									borderColor:
										"rgba(var(--pf-fg-rgb),.08)",
								},

								"&:hover fieldset": {
									borderColor:
										"rgba(16,185,129,.45)",
								},

								"&.Mui-focused fieldset": {
									borderColor:
										"#10b981",
								},
							},

							"& .MuiSelect-select": {
								color: "var(--pf-text-strong)",
								fontWeight: 800,
							},

							"& .MuiSvgIcon-root": {
								color: "var(--pf-text-muted)",
							},
						}}
					>
						<MenuItem value="ALL">
							🌐 All Plants
						</MenuItem>

						{dispatchPlantOptions.map(
							(option) => (
								<MenuItem
									key={
										option.value
									}
									value={
										option.value
									}
								>
									🏭 {option.label}
								</MenuItem>
							)
						)}
					</TextField>

					<TextField
						select
						size="small"
						value={groupBy}
						onChange={(e) => {
							setGroupBy(
								e.target.value
							);

							setPageNo(1);
						}}
						sx={{
							width: "100%",
							minWidth: 0,

							...formFieldSx,

							"& .MuiOutlinedInput-root": {
								height: 44,

								borderRadius: "14px",

								background:
									"var(--pf-surface-alt)",

								color: "var(--pf-text-strong)",

								"& fieldset": {
									borderColor:
										"rgba(var(--pf-fg-rgb),.08)",
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
								color: "var(--pf-text-strong)",
								fontWeight: 700,
							},

							"& .MuiSvgIcon-root": {
								color: "var(--pf-text-muted)",
							},
						}}
					>
						<MenuItem value="NONE">
							No Group
						</MenuItem>

						<MenuItem value="PLANT">
							Group by Plant
						</MenuItem>

						<MenuItem value="STATUS">
							Group by Status
						</MenuItem>

						<MenuItem value="CLIENT">
							Group by Client
						</MenuItem>
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
										Customer care, hardware/site, assembly, job work and site return challans generated manually
									</Box>
								</Box>
							</Box>

							<Box sx={customChallanRightSx}>
								{customChallans.length > 0 && (
									<Box
										sx={{
											color: "var(--pf-text-muted)",
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
										<span style={{ color: "var(--dispatch-purple-text)", fontWeight: 900 }}>
											{customChallans[0]?.challanNumber}
										</span>
									</Box>
								)}

								{isDispatch && (
									<Button
										onClick={
											openCustomChallanModal
										}
										sx={customChallanCreateButtonSx}
									>
										+ Create
									</Button>
								)}

								<Button
									disabled={customChallansLoading}
									onClick={() => {
										void loadCustomChallans({ force: true });
									}}
									sx={{
										...modalSecondaryButtonSx,
										height: 34,
									}}
								>
									{customChallansLoading ? "Refreshing…" : "Refresh"}
								</Button>
							</Box>
						</Box>

						{/*
						 * Do not animate the height of this large/complex section. MUI Collapse
						 * with timeout="auto" measures and reflows the full body on every frame,
						 * which was the visible opening/closing lag. Keep the subtree mounted after
						 * it has data and switch visibility atomically instead.
						 */}
						<Box
							role="region"
							aria-label="Custom challan records"
							aria-hidden={!customChallanSectionOpen}
							sx={{
								display: customChallanSectionOpen ? "block" : "none",
								contain: "layout paint",
							}}
						>
							<Box sx={customChallanBodySx}>
								{(customChallansLoading || !customChallansLoadAttempted) && (
									<Box sx={modalEmptyStateSx}>
										Loading custom challans…
									</Box>
								)}

								{customChallansLoadAttempted && !customChallansLoading && customChallans.length === 0 && (
									<Box sx={modalEmptyStateSx}>
										No custom challans generated yet.
									</Box>
								)}

								{customChallansLoadAttempted && !customChallansLoading && customChallans.length > 0 && (
									<>
										<Box sx={customChallanSearchPanelSx}>
											<Box sx={customChallanSearchTopSx}>
												<Box sx={customChallanSearchTitleWrapSx}>
													<Box sx={customChallanSearchIconSx}>
														<SearchIcon sx={{ fontSize: 20 }} />
													</Box>

													<Box sx={{ minWidth: 0 }}>
														<Box sx={customChallanSearchTitleSx}>
															Smart Custom Challan Search
														</Box>

														<Box sx={customChallanSearchSubSx}>
															Search challan number, client, site / area, PD, route, driver, vehicle, purpose, type, creator and other saved challan details.
														</Box>
													</Box>
												</Box>

												<Chip
													size="small"
													label={`${customChallanFilteredRows.length} / ${customChallans.length} matching`}
													sx={customChallanSearchResultChipSx}
												/>
											</Box>

											<TextField
												fullWidth
												size="small"
												value={customChallanSearch}
												onChange={(event) => {
													setCustomChallanSearch(event.target.value);
													setCustomChallanPageNo(1);
												}}
												placeholder="Search: client, challan no., site, area, PD, from/to location, driver, vehicle, purpose, type, user…"
												InputProps={{
													startAdornment: (
														<SearchIcon
															sx={{
																color: "#a78bfa",
																mr: 1,
															}}
														/>
													),
													endAdornment: customChallanSearch ? (
														<Button
															onClick={() => {
																setCustomChallanSearch("");
																setCustomChallanPageNo(1);
															}}
															sx={customChallanSearchClearButtonSx}
														>
															Clear
														</Button>
													) : null,
												}}
												sx={customChallanSearchFieldSx}
											/>

											<Box sx={customChallanSearchMetaRowSx}>
												<Box sx={customChallanSearchCoverageSx}>
													{[
														"Challan No.",
														"Client",
														"Site / Area",
														"PD",
														"Route",
														"Driver / Vehicle",
														"Purpose",
													].map((label) => (
														<Chip
															key={label}
															size="small"
															label={label}
															sx={customChallanSearchHintChipSx}
														/>
													))}
												</Box>

												<Box
													sx={{
														color: "var(--pf-text-muted)",
														fontSize: 9.5,
														fontWeight: 750,
														whiteSpace: "nowrap",
													}}
												>
													Tip: multiple words narrow results automatically
												</Box>
											</Box>
										</Box>

										{isAdmin && (
											<Box sx={customAdminCommandCenterSx}>
												<Box sx={customAdminCommandTopSx}>
													<Box>
														<Box sx={customAdminCommandTitleSx}>
															🧠 Admin Custom Challan Intelligence
														</Box>
														<Box sx={customAdminCommandSubSx}>
															Operational reporting, generation activity, data quality and full Excel reporting
														</Box>
													</Box>

													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															gap: 0.8,
															flexWrap: "wrap",
														}}
													>
														<Button
															onClick={() =>
																setCustomChallanAnalyticsOpen((value) => !value)
															}
															sx={customAdminActionButtonSx(
																"#8b5cf6",
																customChallanAnalyticsOpen
															)}
														>
															📊 Analytics
														</Button>

														<Button
															onClick={() =>
																setCustomChallanActivityOpen((value) => !value)
															}
															sx={customAdminActionButtonSx(
																"#2563eb",
																customChallanActivityOpen
															)}
														>
															🕘 Activity
														</Button>

														<Button
															disabled={customChallanReportLoading}
															onClick={exportCustomChallanAdminReport}
															sx={customAdminActionButtonSx("#059669")}
														>
															{customChallanReportLoading
																? "Preparing Report…"
																: "📥 Full Excel Report"}
														</Button>

														<Button
															onClick={clearCustomChallanAdminFilters}
															sx={customAdminActionButtonSx("#64748b")}
														>
															↺ Reset
														</Button>
													</Box>
												</Box>

												<Box sx={customAdminFilterGridSx}>
													<TextField
														select
														size="small"
														label="Challan Type"
														value={customChallanTypeFilter}
														onChange={(event) => {
															setCustomChallanTypeFilter(event.target.value);
															setCustomChallanPageNo(1);
														}}
														SelectProps={{ MenuProps: modalSelectMenuProps }}
														sx={customAdminFilterFieldSx}
													>
														<MenuItem value="ALL">All Types</MenuItem>
														{CUSTOM_CHALLAN_TYPE_OPTIONS.map((option) => (
															<MenuItem key={option.value} value={option.value}>
																{option.label}
															</MenuItem>
														))}
													</TextField>

													<TextField
														select
														size="small"
														label="Generated By"
														value={customChallanCreatorFilter}
														onChange={(event) => {
															setCustomChallanCreatorFilter(event.target.value);
															setCustomChallanPageNo(1);
														}}
														SelectProps={{ MenuProps: modalSelectMenuProps }}
														sx={customAdminFilterFieldSx}
													>
														<MenuItem value="ALL">All Users</MenuItem>
														{customChallanCreatorOptions.map((creator) => (
															<MenuItem key={creator} value={creator}>
																{creator}
															</MenuItem>
														))}
													</TextField>

													<TextField
														select
														size="small"
														label="Activity Period"
														value={customChallanPeriodFilter}
														onChange={(event) => {
															setCustomChallanPeriodFilter(event.target.value);
															setCustomChallanPageNo(1);
														}}
														SelectProps={{ MenuProps: modalSelectMenuProps }}
														sx={customAdminFilterFieldSx}
													>
														<MenuItem value="ALL">All Time</MenuItem>
														<MenuItem value="TODAY">Today</MenuItem>
														<MenuItem value="LAST_7_DAYS">Last 7 Days</MenuItem>
														<MenuItem value="LAST_30_DAYS">Last 30 Days</MenuItem>
														<MenuItem value="THIS_MONTH">This Month</MenuItem>
														<MenuItem value="CUSTOM">Custom Range</MenuItem>
													</TextField>
												</Box>

												{customChallanPeriodFilter === "CUSTOM" && (
													<Box
														sx={{
															display: "grid",
															gridTemplateColumns: {
																xs: "1fr",
																md: "repeat(2,minmax(180px,260px))",
															},
															gap: 1,
															mt: 1,
														}}
													>
														<TextField
															type="date"
															size="small"
															label="From Date"
															InputLabelProps={{ shrink: true }}
															value={customChallanDateFrom}
															onChange={(event) => {
																setCustomChallanDateFrom(event.target.value);
																setCustomChallanPageNo(1);
															}}
															sx={customAdminFilterFieldSx}
														/>
														<TextField
															type="date"
															size="small"
															label="To Date"
															InputLabelProps={{ shrink: true }}
															value={customChallanDateTo}
															onChange={(event) => {
																setCustomChallanDateTo(event.target.value);
																setCustomChallanPageNo(1);
															}}
															sx={customAdminFilterFieldSx}
														/>
													</Box>
												)}

												<Box sx={customAdminKpiGridSx}>
													<Box sx={customAdminKpiCardSx("#8b5cf6")}>
														<Box sx={customAdminKpiLabelSx}>Challans in Scope</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.totalChallans}</Box>
														<Box sx={customAdminKpiMetaSx}>{customChallanFilterLabel}</Box>
													</Box>
													<Box sx={customAdminKpiCardSx("#06b6d4")}>
														<Box sx={customAdminKpiLabelSx}>Material Lines / Items</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.totalItems}</Box>
														<Box sx={customAdminKpiMetaSx}>Avg {customChallanAdminStats.averageItems.toFixed(1)} per challan</Box>
													</Box>
													<Box sx={customAdminKpiCardSx("#10b981")}>
														<Box sx={customAdminKpiLabelSx}>Created Today</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.todayCount}</Box>
														<Box sx={customAdminKpiMetaSx}>Current local business day</Box>
													</Box>
													<Box sx={customAdminKpiCardSx("#f59e0b")}>
														<Box sx={customAdminKpiLabelSx}>This Month</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.monthCount}</Box>
														<Box sx={customAdminKpiMetaSx}>{customChallanAdminStats.uniqueClients} unique client(s)</Box>
													</Box>
													<Box sx={customAdminKpiCardSx("#3b82f6")}>
														<Box sx={customAdminKpiLabelSx}>Active Creators</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.uniqueCreators}</Box>
														<Box sx={customAdminKpiMetaSx}>Top: {customChallanAdminStats.topCreator?.name || "—"}</Box>
													</Box>
													<Box sx={customAdminKpiCardSx("#22c55e")}>
														<Box sx={customAdminKpiLabelSx}>Logistics Data Complete</Box>
														<Box sx={customAdminKpiValueSx}>{customChallanAdminStats.logisticsCompleteness}%</Box>
														<Box sx={customAdminKpiMetaSx}>Driver + vehicle captured together</Box>
													</Box>
												</Box>

												<Collapse in={customChallanAnalyticsOpen} timeout="auto" unmountOnExit>
													<Box sx={customAdminInsightPanelSx}>
														<Box sx={customAdminCommandTitleSx}>Detailed Analytics</Box>
														<Box sx={customAdminCommandSubSx}>Type mix, creator performance, routes and recent 7-day movement volume</Box>
														<Box sx={{ ...customAdminInsightGridSx, mt: 1.2 }}>
															<Box sx={customAdminInsightCardSx}>
																<Box sx={customAdminInsightTitleSx}>Challan Type Mix</Box>
																{customChallanAdminStats.typeBreakdown.length === 0 ? (
																	<Box sx={customAdminCommandSubSx}>No type data in current scope.</Box>
																) : (
																	customChallanAdminStats.typeBreakdown.slice(0, 6).map((entry) => {
																		const percent = customChallanAdminStats.totalChallans
																			? (entry.challans / customChallanAdminStats.totalChallans) * 100
																			: 0;
																		return (
																			<Box key={entry.type} sx={{ mb: 1 }}>
																				<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.45 }}>
																					<Box sx={{ color: "var(--pf-text)", fontSize: 10.5, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.label}</Box>
																					<Box sx={{ color: "var(--dispatch-purple-text)", fontSize: 10.5, fontWeight: 950, whiteSpace: "nowrap" }}>{entry.challans} • {percent.toFixed(0)}%</Box>
																				</Box>
																				<Box sx={customAdminBarTrackSx}><Box sx={customAdminBarFillSx(percent, "#8b5cf6")} /></Box>
																			</Box>
																		);
																	})
																)}
															</Box>

															<Box sx={customAdminInsightCardSx}>
																<Box sx={customAdminInsightTitleSx}>Top Creators</Box>
																{customChallanAdminStats.creatorBreakdown.slice(0, 6).map((entry, index) => (
																	<Box key={entry.name} sx={{ display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", alignItems: "center", gap: 0.8, py: 0.65, borderBottom: index < Math.min(5, customChallanAdminStats.creatorBreakdown.length - 1) ? "1px solid rgba(var(--pf-fg-rgb),.05)" : "none" }}>
																		<Box sx={{ color: "#a78bfa", fontWeight: 950, fontSize: 10.5 }}>#{index + 1}</Box>
																		<Box sx={{ minWidth: 0 }}>
																			<Box sx={{ color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</Box>
																			<Box sx={{ color: "var(--pf-text-muted)", fontSize: 9.5, fontWeight: 700 }}>{entry.items} item(s)</Box>
																		</Box>
																		<Chip size="small" label={`${entry.challans} challan${entry.challans === 1 ? "" : "s"}`} sx={{ height: 22, color: "var(--dispatch-blue-text)", fontSize: 9.5, fontWeight: 900, background: "rgba(59,130,246,.10)", border: "1px solid rgba(96,165,250,.18)" }} />
																	</Box>
																))}
															</Box>

															<Box sx={customAdminInsightCardSx}>
																<Box sx={customAdminInsightTitleSx}>Top Routes</Box>
																{customChallanAdminStats.routeBreakdown.slice(0, 6).map((entry, index) => (
																	<Box key={entry.route} sx={{ py: 0.7, borderBottom: index < Math.min(5, customChallanAdminStats.routeBreakdown.length - 1) ? "1px solid rgba(var(--pf-fg-rgb),.05)" : "none" }}>
																		<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
																			<Box sx={{ color: "var(--pf-text-strong)", fontSize: 10.2, fontWeight: 850, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={entry.route}>{entry.route}</Box>
																			<Box sx={{ color: "var(--dispatch-green-text)", fontSize: 10, fontWeight: 950, whiteSpace: "nowrap" }}>{entry.challans}</Box>
																		</Box>
																		<Box sx={{ mt: 0.25, color: "var(--pf-text-muted)", fontSize: 9.3, fontWeight: 700 }}>{entry.items} item(s) • Last {formatLocalDateTimeDisplay(entry.lastAt)}</Box>
																	</Box>
																))}
															</Box>

															<Box sx={{ ...customAdminInsightCardSx, gridColumn: { xs: "auto", xl: "1 / -1" } }}>
																<Box sx={customAdminInsightTitleSx}>7-Day Creation Trend</Box>
																<Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(56px,1fr))", gap: 0.8, overflowX: "auto", pb: 0.4 }}>
																	{customChallanAdminStats.dailyTrend.map((day) => {
																		const maxDaily = Math.max(1, ...customChallanAdminStats.dailyTrend.map((item) => item.challans));
																		const height = Math.max(10, (day.challans / maxDaily) * 72);
																		return (
																			<Box key={day.key} sx={{ minWidth: 56, textAlign: "center" }}>
																				<Box sx={{ height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
																					<Box sx={{ width: 24, height, minHeight: 10, borderRadius: "7px 7px 3px 3px", background: "linear-gradient(180deg,#a78bfa,#6d28d9)", boxShadow: "0 8px 20px rgba(139,92,246,.18)" }} />
																				</Box>
																				<Box sx={{ mt: 0.45, color: "var(--pf-text-strong)", fontSize: 10.5, fontWeight: 950 }}>{day.challans}</Box>
																				<Box sx={{ color: "var(--pf-text-muted)", fontSize: 9, fontWeight: 700 }}>{day.label}</Box>
																			</Box>
																		);
																	})}
																</Box>
															</Box>
														</Box>
													</Box>
												</Collapse>

												<Collapse in={customChallanActivityOpen} timeout="auto" unmountOnExit>
													<Box sx={customAdminInsightPanelSx}>
														<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.2 }}>
															<Box>
																<Box sx={customAdminCommandTitleSx}>Recent Generation Activity</Box>
																<Box sx={customAdminCommandSubSx}>Creation activity comes from generatedBy / generatedAt. Historical edit events need a backend audit log and are not invented here.</Box>
															</Box>
															<Chip size="small" label={`${customChallanAdminStats.activity.length} recent`} sx={customChallanCountChipSx} />
														</Box>
														<Box sx={customAdminActivityListSx}>
															{customChallanAdminStats.activity.length === 0 ? (
																<Box sx={modalEmptyStateSx}>No activity matches the current filters.</Box>
															) : (
																customChallanAdminStats.activity.map((challan) => (
																	<Box key={`activity-${challan.challanNumber}`} sx={customAdminActivityRowSx}>
																		<Box sx={customAdminActivityIconSx}>🧾</Box>
																		<Box sx={{ minWidth: 0 }}>
																			<Box sx={{ display: "flex", alignItems: "center", gap: 0.7, flexWrap: "wrap" }}>
																				<Box sx={{ color: "var(--pf-text-strong)", fontFamily: "monospace", fontSize: 11.5, fontWeight: 950 }}>{challan.challanNumber}</Box>
																				<Chip size="small" label={challan.challanTypeLabel || getCustomChallanTypeLabel(challan.challanType)} sx={{ height: 20, color: "var(--dispatch-purple-text)", fontSize: 8.8, fontWeight: 900, background: "rgba(139,92,246,.11)", border: "1px solid rgba(167,139,250,.18)" }} />
																			</Box>
																			<Box sx={{ mt: 0.3, color: "rgba(var(--pf-fg-rgb),.54)", fontSize: 10, fontWeight: 750, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
																				{challan.generatedBy || "Unknown user"} • {challan.fromLocation || "—"} → {challan.toLocation || "—"} • {challan.totalItems || 0} item(s)
																			</Box>
																		</Box>
																		<Box sx={{ color: "var(--pf-text-muted)", fontSize: 9.7, fontWeight: 800, whiteSpace: "nowrap" }}>
																			{formatLocalDateTimeDisplay(challan.generatedAt)}
																		</Box>
																	</Box>
																))
															)}
														</Box>
													</Box>
												</Collapse>
											</Box>
										)}

										{customChallanFilteredRows.length === 0 && (
											<Box sx={{ ...modalEmptyStateSx, mb: 1.2 }}>
												{customChallanSearch.trim()
													? `No custom challan found for "${customChallanSearch.trim()}". Try client name, challan no., site / area, PD, location, driver or vehicle.`
													: isAdmin
														? "No custom challans match the current Admin reporting filters."
														: "No custom challans match the current search."}
											</Box>
										)}

										<Box sx={customChallanPagerWrapSx}>
											<Box
												sx={{
													color: "var(--dispatch-purple-text)",
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
												totalRows={customChallanFilteredRows.length}
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
																color: "var(--pf-text-strong)",
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
																color: "var(--pf-text-muted)",
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
														label={
															challan.challanTypeLabel ||
															getCustomChallanTypeLabel(challan.challanType)
														}
														sx={{
															width: "fit-content",
															color: "var(--dispatch-purple-text)",
															fontWeight: 900,
															background: "rgba(139,92,246,.14)",
															border: "1px solid rgba(139,92,246,.24)",
														}}
													/>

													<Box sx={{ minWidth: 0 }}>
														<Box
															sx={{
																color: "var(--pf-text-strong)",
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
																color: "rgba(var(--pf-fg-rgb),.55)",
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
															{isAdmin && (
																<> • By: {challan.generatedBy || "—"}</>
															)}
															{isSiteReturnChallanType(challan.challanType) && (
																<>
																	{" "}• Handed Over To: {challan.handedOverTo || "—"}
																</>
															)}
														</Box>
													</Box>

													<Box
														sx={{
															color: "var(--pf-text-soft)",
															fontSize: 12,
															fontWeight: 800,
														}}
													>
														{challan.totalItems || 0} item
														{Number(challan.totalItems || 0) === 1 ? "" : "s"}
													</Box>

													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															justifyContent: "flex-end",
															gap: 1,
														}}
													>
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
															sx={customChallanViewPdfButtonSx}
														>
															View PDF
														</Button>

														{isAdmin && (
															<Button
																size="small"
																disabled={customChallanDetailLoading}
																onClick={() =>
																	openEditCustomChallanModal(challan)
																}
																sx={customChallanEditButtonSx}
															>
																Edit Details
															</Button>
														)}
													</Box>
												</Box>
											))}
										</Box>
									</>
								)}
							</Box>
						</Box>
					</Box>
				)}

				<div style={wrap}>


					<Box sx={tableWrapper}>
						<Box
							sx={{
								width: `${dispatchTableWidth}px`,
								minWidth: "100%",
							}}
						>

							<Box
								sx={{
									...tableHeader,
									gridTemplateColumns:
										dispatchGridTemplate,
									minWidth:
										dispatchTableWidth,
								}}
							>
								<Box
									sx={{
										...dispatchSelectCellSx(
											false,
											true
										),
										"&:hover .dispatch-column-resize-handle":
										{
											opacity: 1,
										},
									}}
								>
									{columns[0].renderHeader()}
									{renderDispatchResizeHandle(0)}
								</Box>

								{DISPATCH_COLUMN_LAYOUT
									.slice(1, 11)
									.map((column, index) => {
										const columnIndex =
											index + 1;

										return (
											<Box
												key={column.key}
												sx={
													columnIndex === 1
														? {
															...dispatchResizableHeaderCellSx,
															position: "sticky",
															left: `${Math.round(Number(dispatchColumnWidths[0]) || 56)}px`,
															zIndex: 43,
															background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
															boxShadow: "8px 0 18px rgba(var(--pf-surface-deep-rgb),.055)",
														}
														: dispatchResizableHeaderCellSx
												}
											>
												<Box
													component="span"
													sx={{
														minWidth: 0,
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{column.label}
												</Box>

												{renderDispatchResizeHandle(
													columnIndex
												)}
											</Box>
										);
									})}

								<Box
									sx={{
										...dispatchActionCellSx(
											false,
											true
										),
										pr: 2.1,
										"&:hover .dispatch-column-resize-handle":
										{
											opacity: 1,
										},
									}}
								>
									Actions
									{renderDispatchResizeHandle(11)}
								</Box>
							</Box>

							<Box sx={tableBody}>

								{paginatedRows.map((row) => (

									<Box
										key={
											row.zohoItemId ||
											row.dispatchedItemId ||
											row.packetItemId ||
											row.id
										}
										onClick={(event) =>
											handleDispatchRowClick(
												event,
												row
											)
										}
										sx={{
											...dispatchTableRowSx(
												isHardwareDispatchRow(row)
											),
											gridTemplateColumns:
												dispatchGridTemplate,
											minWidth:
												dispatchTableWidth,
											cursor: "pointer",
										}}
									>

										<Box
											sx={dispatchSelectCellSx(
												isHardwareDispatchRow(row)
											)}
										>
											{columns[0].renderCell({ row })}
										</Box>

										<Box
											sx={dispatchIdentityCellSx(
												isHardwareDispatchRow(row),
												dispatchColumnWidths[0]
											)}
										>
											{columns[1].renderCell({ row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[2].renderCell({ value: row.sku, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[3].renderCell({ value: row.pdNo, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[4].renderCell({ value: row.drawingNo, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[5].renderCell({ value: row.description, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[6].renderCell({ value: row.clientName, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[7].renderCell({ value: row.plantCode, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[8].renderCell({ value: row.currentLocationCode, row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[9].renderCell({ row })}
										</Box>

										<Box sx={tableCellWrap}>
											{columns[10].renderCell({ row })}
										</Box>

										<Box
											sx={dispatchActionCellSx(
												isHardwareDispatchRow(row)
											)}
										>
											{columns[11].renderCell({ row })}
										</Box>
									</Box>

								))}

							</Box>
						</Box>
					</Box>
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							mt: 1.5,
							pt: 1.5,
							px: 0.25,
							gap: 2,
							flexWrap: "wrap",
							borderTop:
								"1px solid rgba(148,163,184,.08)",
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
									color: "var(--pf-text-muted)",
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
									color: "var(--pf-text-muted)",
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
								disabled={safePageNo === 1}
								onClick={() =>
									setPageNo((currentPage) =>
										Math.max(
											1,
											currentPage - 1
										)
									)
								}
								sx={{
									minWidth: 100,
									height: 30,
									borderRadius: "12px",
									background:
										"linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface))",
									color: "var(--pf-text-strong)",
									border:
										"1px solid rgba(var(--pf-fg-rgb),.08)",

									fontSize: 10,
									fontWeight: 500,

									"&:disabled": {
										opacity: 0.45,
										color: "var(--pf-text-muted)",
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
										"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",

									color: "var(--pf-text-soft)",

									border:
										"1px solid rgba(var(--pf-fg-rgb),.06)",

									fontSize: 10,
									fontWeight: 500,
								}}
							>
								Page

								<Box
									component="span"
									sx={{
										mx: 1,
										color: "var(--dispatch-blue-text)",
									}}
								>
									{safePageNo}
								</Box>

								of {totalPages}
							</Box>

							<Button
								disabled={
									safePageNo ===
									totalPages
								}
								onClick={() =>
									setPageNo((currentPage) =>
										Math.min(
											totalPages,
											currentPage + 1
										)
									)
								}
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
										color: "var(--pf-text-soft)",
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
					(isDispatch || isAdmin) && (
						<div style={bulkBar}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 1.2,
									color: "var(--pf-text-soft)",
									fontWeight: 800,
									fontSize: 13,
									flexWrap: "wrap",
								}}
							>
								<span>☑️</span>

								<span>
									{selectionModel.length} item
									{selectionModel.length > 1
										? "s"
										: ""}{" "}
									selected
								</span>

								{/*
				 * ADMIN receives an Admin Bulk Edit chip.
				 *
				 * DISPATCH receives the existing action chip.
				 *
				 * A user who has both permissions can still see
				 * the normal dispatch action chip and the Admin
				 * Edit Selected button.
				 */}
								{allSelectedReturnRequests ? (
									<Chip
										size="small"
										label="Return Requests"
										sx={{
											height: 26,
											fontWeight: 900,
											fontSize: 11,
											color: "#fde68a",
											background: "rgba(245,158,11,.15)",
											border: "1px solid rgba(245,158,11,.28)",
										}}
									/>
								) : isAdmin && !isDispatch ? (
									<Chip
										size="small"
										label="Admin Bulk Edit"
										sx={{
											height: 26,
											fontWeight: 900,
											fontSize: 11,
											color: "#fcd34d",
											background:
												"rgba(245,158,11,.15)",
											border:
												"1px solid rgba(245,158,11,.25)",
										}}
									/>
								) : (
									<Chip
										size="small"
										label={getBulkActionLabel(
											selectedBulkAction
										)}
										sx={{
											height: 26,
											fontWeight: 900,
											fontSize: 11,

											color:
												selectedBulkAction ===
													"MOVE_TO_FG"
													? "#fbbf24"
													: selectedBulkAction ===
														"CHANGE_STATUS"
														? "#93c5fd"
														: selectedBulkAction ===
															"GATE_PASS"
															? "#6ee7b7"
															: selectedBulkAction ===
																"CHALAAN"
																? "#93c5fd"
																: "#fca5a5",

											background:
												selectedBulkAction ===
													"MOVE_TO_FG"
													? "rgba(245,158,11,.15)"
													: selectedBulkAction ===
														"CHANGE_STATUS"
														? "rgba(59,130,246,.15)"
														: selectedBulkAction ===
															"GATE_PASS"
															? "rgba(16,185,129,.15)"
															: selectedBulkAction ===
																"CHALAAN"
																? "rgba(59,130,246,.15)"
																: "rgba(239,68,68,.15)",

											border:
												selectedBulkAction ===
													"MIXED"
													? "1px solid rgba(239,68,68,.25)"
													: "1px solid rgba(var(--pf-fg-rgb),.08)",
										}}
									/>
								)}
							</Box>

							{/*
			 * ADMIN-SPECIFIC ACTION
			 *
			 * This stays outside the isDispatch wrapper so an
			 * ADMIN-only user can edit the selected rows.
			 */}
							{isAdmin && allSelectedReturnRequests && (
								<>
									<Button
										size="small"
										disabled={Boolean(bulkReturnDecisionLoading)}
										onClick={() => bulkResolveReturnRequests("APPROVE")}
										sx={{
											px: 2.4,
											height: 38,
											borderRadius: "12px",
											fontWeight: 900,
											textTransform: "none",
											background: "linear-gradient(180deg,#10b981,#059669)",
											color: "#fff",
										}}
									>
										{bulkReturnDecisionLoading === "approve"
											? "Approving..."
											: "Approve Selected Returns"}
									</Button>

									<Button
										size="small"
										disabled={Boolean(bulkReturnDecisionLoading)}
										onClick={() => bulkResolveReturnRequests("REJECT")}
										sx={{
											px: 2.4,
											height: 38,
											borderRadius: "12px",
											fontWeight: 900,
											textTransform: "none",
											background: "linear-gradient(180deg,#ef4444,#dc2626)",
											color: "#fff",
										}}
									>
										{bulkReturnDecisionLoading === "reject"
											? "Rejecting..."
											: "Reject Selected Returns"}
									</Button>
								</>
							)}

							{isAdmin && (
								<Button
									size="small"
									onClick={() => {
										openAdminDispatchEdit(
											selectedItems
										);
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
									Edit Selected
								</Button>
							)}

							{isAdmin && (
								<Button
									size="small"
									disabled={selectedItems.length === 0}
									onClick={() =>
										openAdminDispatchDelete(selectedItems)
									}
									sx={{
										px: 2.4,
										height: 38,
										borderRadius: "12px",
										fontWeight: 900,
										textTransform: "none",
										background:
											"linear-gradient(180deg,#dc2626,#b91c1c)",
										color: "#fff",
										boxShadow:
											"0 10px 24px rgba(220,38,38,.24)",
									}}
								>
									Delete Selected
								</Button>
							)}

							{/*
			 * DISPATCH-SPECIFIC ACTIONS
			 *
			 * ADMIN-only users must not see Move to FG,
			 * Change Status, Challan or Gate Pass buttons.
			 */}
							{isDispatch && (
								<>
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
											onClick={() =>
												setBulkStatusModal(
													true
												)
											}
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

													itemIds:
														selectionModel,

													title:
														"Bulk Chalaan",
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
											onClick={
												openBulkGatePassModal
											}
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

									{selectedBulkAction ===
										"MIXED" && (
											<Button
												size="small"
												disabled
												sx={{
													px: 2.4,
													height: 38,
													borderRadius:
														"12px",
													fontWeight: 900,
													textTransform:
														"none",
													background:
														"var(--pf-text-dim)",
													color: "#fff",
												}}
											>
												Select same action
												items
											</Button>
										)}
								</>
							)}
							<Button
								size="small"
								onClick={() =>
									setSelectionModel([])
								}
								sx={{
									px: 2,
									height: 38,
									borderRadius: "12px",
									fontWeight: 800,
									textTransform: "none",

									background:
										"var(--pf-surface-alt)",

									color: "var(--pf-text-strong)",

									"&:hover": {
										background:
											"rgba(var(--pf-fg-rgb),.14)",
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
											Create a professional Dispatch Register with separate Dispatched and Other Status sheets
										</Box>
									</Box>
								</Box>

								<IconButton
									disabled={dispatchExportLoading}
									sx={modalCloseButtonSx}
									onClick={() =>
										setDispatchExportOpen(false)
									}
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
													borderRadius: "10px",
													background: "var(--pf-surface-alt)",
													color: "var(--pf-text-strong)",

													"& fieldset": {
														borderColor: "rgba(var(--pf-fg-rgb),.10)",
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
													color: "var(--pf-text-strong)",
													fontWeight: 900,
													fontSize: 13,
												},

												"& .MuiSvgIcon-root": {
													color: "var(--pf-text-muted)",
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
																color: "rgba(var(--pf-fg-rgb),.45)",
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
										label="Excel Sheets"
										value={
											dispatchExportFormat === "EXCEL"
												? 2
												: 1
										}
										accent="#22c55e"
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
										color: "rgba(var(--pf-fg-rgb),.55)",
										fontSize: 12,
										fontWeight: 750,
									}}
								>
									The Excel workbook contains two sheets: Dispatched and Other Status.
									The global search and selected export statuses are applied. Pagination is ignored.
								</Box>

								<Box
									sx={{
										maxHeight: 280,
										overflow: "auto",
										borderRadius: "16px",
										border: "1px solid rgba(var(--pf-fg-rgb),.08)",
										background: "rgba(var(--pf-surface-deep-rgb),.25)",
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
													<th key={column.key}>
														{column.header}
													</th>
												))}
											</tr>
										</thead>

										<tbody>
											{dispatchExportPreviewRows
												.slice(0, 20)
												.map((row, index) => (
													<tr key={index}>
														{dispatchExportColumns.map(
															(column) => {
																const displayValue =
																	formatDispatchPreviewValue(
																		row[column.key]
																	);

																return (
																	<td
																		key={column.key}
																		title={
																			displayValue
																		}
																	>
																		{displayValue}
																	</td>
																);
															}
														)}
													</tr>
												))}
										</tbody>
									</Box>

									{dispatchExportSourceLoading && (
										<Box sx={modalEmptyStateSx}>
											Loading the complete matching Dispatch register for export…
										</Box>
									)}

									{!dispatchExportSourceLoading &&
										dispatchExportPreviewRows.length === 0 && (
											<Box sx={modalEmptyStateSx}>
												No rows found for selected status.
											</Box>
										)}
								</Box>

								{dispatchExportPreviewRows.length > 20 && (
									<Box
										sx={{
											mt: 1,
											color: "rgba(var(--pf-fg-rgb),.48)",
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
									disabled={dispatchExportLoading}
									onClick={() =>
										setDispatchExportOpen(false)
									}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={
										dispatchExportLoading ||
										dispatchExportSourceLoading ||
										dispatchExportPreviewRows.length === 0
									}
									onClick={exportDispatchData}
									sx={{
										...premiumButton,

										background:
											dispatchExportFormat === "EXCEL"
												? "linear-gradient(135deg,#059669,#10b981)"
												: "linear-gradient(135deg,#2563eb,#3b82f6)",

										"&.Mui-disabled": {
											color:
												"rgba(var(--pf-fg-rgb),.45)",
											background:
												"rgba(var(--pf-fg-rgb),.08)",
										},
									}}
								>
									{dispatchExportSourceLoading
										? "Loading Full Register..."
										: dispatchExportLoading
											? "Preparing Report..."
											: `Export ${dispatchExportFormat}`}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{createDriverOpen && (
					<Box
						sx={{
							...enhancedOverlaySx,
							zIndex: 6300,
						}}
						onClick={closeCreateDriverModal}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 500,
							}}
							onClick={(event) =>
								event.stopPropagation()
							}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box
										sx={modalIconBubble(
											"#3b82f6"
										)}
									>
										👤
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Create Driver
										</Box>

										<Box sx={modalSubtitleSx}>
											The new driver will be
											automatically selected
										</Box>
									</Box>
								</Box>

								<IconButton
									disabled={createDriverLoading}
									sx={modalCloseButtonSx}
									onClick={
										closeCreateDriverModal
									}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<TextField
									autoFocus
									fullWidth
									label="Driver Name"
									placeholder="Enter driver name"
									value={newDriverForm.name}
									onChange={(event) =>
										setNewDriverForm(
											(previous) => ({
												...previous,
												name:
													event.target
														.value,
											})
										)
									}
									onKeyDown={(event) => {
										if (
											event.key ===
											"Enter"
										) {
											event.preventDefault();

											submitCreateDriver();
										}
									}}
									disabled={
										createDriverLoading
									}
									sx={formFieldSx}
								/>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={createDriverLoading}
									onClick={
										closeCreateDriverModal
									}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={createDriverLoading}
									onClick={submitCreateDriver}
									sx={premiumButton}
								>
									{createDriverLoading
										? "Creating..."
										: "Create & Select"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{createVehicleOpen && (
					<Box
						sx={{
							...enhancedOverlaySx,
							zIndex: 6300,
						}}
						onClick={closeCreateVehicleModal}
					>
						<Box
							sx={{
								...enhancedModalSx,
								width: 580,
							}}
							onClick={(event) =>
								event.stopPropagation()
							}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box
										sx={modalIconBubble(
											"#10b981"
										)}
									>
										🚚
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Create Vehicle
										</Box>

										<Box sx={modalSubtitleSx}>
											The new vehicle will be
											automatically selected
										</Box>
									</Box>
								</Box>

								<IconButton
									disabled={
										createVehicleLoading
									}
									sx={modalCloseButtonSx}
									onClick={
										closeCreateVehicleModal
									}
								>
									×
								</IconButton>
							</Box>

							<Box sx={modalContentSx}>
								<Box
									sx={{
										display: "grid",
										gridTemplateColumns:
											"1fr 1fr",
										gap: 2,
									}}
								>
									<TextField
										autoFocus
										fullWidth
										label="Vehicle Number"
										placeholder="HR26EW0956"
										value={
											newVehicleForm
												.vehicleNumber
										}
										onChange={(event) =>
											setNewVehicleForm(
												(previous) => ({
													...previous,
													vehicleNumber:
														event
															.target
															.value,
												})
											)
										}
										disabled={
											createVehicleLoading
										}
										sx={formFieldSx}
									/>

									<TextField
										fullWidth
										label="Vehicle Type"
										placeholder="Canter / Eeco / Pickup"
										value={
											newVehicleForm
												.vehicleType
										}
										onChange={(event) =>
											setNewVehicleForm(
												(previous) => ({
													...previous,
													vehicleType:
														event
															.target
															.value,
												})
											)
										}
										disabled={
											createVehicleLoading
										}
										sx={formFieldSx}
									/>

									<TextField
										fullWidth
										label="Vehicle Name"
										placeholder="Optional"
										value={
											newVehicleForm
												.vehicleName
										}
										onChange={(event) =>
											setNewVehicleForm(
												(previous) => ({
													...previous,
													vehicleName:
														event
															.target
															.value,
												})
											)
										}
										disabled={
											createVehicleLoading
										}
										sx={{
											...formFieldSx,
											gridColumn: "1 / -1",
										}}
									/>
								</Box>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={createVehicleLoading}
									onClick={
										closeCreateVehicleModal
									}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={createVehicleLoading}
									onClick={submitCreateVehicle}
									sx={{
										...premiumButton,
										background:
											"linear-gradient(135deg,#059669,#10b981)",
									}}
								>
									{createVehicleLoading
										? "Creating..."
										: "Create & Select"}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{customChallanOpen && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 5700 }}
						onClick={closeCustomChallanModal}
					>
						<Box
							sx={customChallanModalShellSx}
							onClick={(e) => e.stopPropagation()}
						>
							<Box sx={customChallanHeroHeaderSx}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.7,
										minWidth: 0,
									}}
								>
									<Box
										sx={{
											...modalIconBubble("#8b5cf6"),
											width: 50,
											height: 50,
											borderRadius: "15px",
											fontSize: 25,
										}}
									>
										🧾
									</Box>

									<Box sx={{ minWidth: 0 }}>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1,
												flexWrap: "wrap",
											}}
										>
											<Box sx={modalTitleSx}>
												{isEditingCustomChallan
													? "Edit Custom Challan"
													: "Create Custom Challan"}
											</Box>

											<Chip
												size="small"
												label={
													isEditingCustomChallan
														? "ADMIN EDIT MODE"
														: "NEW MOVEMENT"
												}
												sx={{
													height: 23,
													color: isEditingCustomChallan
														? "var(--dispatch-amber-text)"
														: "var(--dispatch-purple-text)",
													background: isEditingCustomChallan
														? "rgba(245,158,11,.13)"
														: "rgba(139,92,246,.14)",
													border: isEditingCustomChallan
														? "1px solid rgba(245,158,11,.25)"
														: "1px solid rgba(139,92,246,.25)",
													fontWeight: 900,
													fontSize: 9,
												}}
											/>
										</Box>

										<Box sx={modalSubtitleSx}>
											{isEditingCustomChallan
												? "Correct movement, party, transport and item details. Saved changes immediately become the source for the regenerated PDF."
												: "Create a controlled external movement document for Customer Care, Site Requirement, Job Work or Site Return."}
										</Box>

										{isEditingCustomChallan && (
											<Box
												sx={{
													mt: 0.8,
													color: "var(--dispatch-purple-text)",
													fontFamily: "monospace",
													fontWeight: 900,
													fontSize: 11,
												}}
											>
												{customChallanEditingNumber}
											</Box>
										)}
									</Box>
								</Box>

								<IconButton
									sx={modalCloseButtonSx}
									disabled={
										customChallanLoading ||
										customChallanDetailLoading
									}
									onClick={closeCustomChallanModal}
								>
									×
								</IconButton>
							</Box>

							<Box sx={customChallanModalBodySx}>
								<Box sx={customFormSectionSx}>
									<Box sx={customFormSectionTitleSx}>
										01 · Movement & Timing
									</Box>
									<Box sx={customFormSectionSubSx}>
										Define the challan category, movement path and exact business date/time.
									</Box>

									<Box
										sx={{
											display: "grid",
											gridTemplateColumns: {
												xs: "1fr",
												md: "1fr 1fr",
											},
											gap: 2,
										}}
									>
										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Challan Type
											</Box>
											<Box
												component="select"
												value={customChallanForm.challanType}
												onChange={(e) => {
													const nextType = e.target.value;
													setCustomChallanForm((prev) => ({
														...prev,
														challanType: nextType,
														handedOverTo: isSiteReturnChallanType(nextType)
															? prev.handedOverTo
															: "",
													}));
												}}
												sx={dispatchTripNativeSelectSx}
											>
												{CUSTOM_CHALLAN_TYPE_OPTIONS.map((option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</Box>
										</Box>

										<TextField
											label="Movement Mode"
											placeholder="DIRECT_DISPATCH"
											value={customChallanForm.movementMode}
											onChange={(e) =>
												updateCustomChallanField("movementMode", e.target.value)
											}
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
									</Box>
								</Box>

								<Box sx={customFormSectionSx}>
									<Box sx={customFormSectionTitleSx}>
										02 · Party & Logistics
									</Box>
									<Box sx={customFormSectionSubSx}>
										Project reference, client information and optional transport / handover details.
									</Box>

									<Box
										sx={{
											display: "grid",
											gridTemplateColumns: {
												xs: "1fr",
												md: "1fr 1fr",
											},
											gap: 2,
										}}
									>
										<TextField
											label="PD No."
											value={customChallanForm.pdNo}
											onChange={(e) =>
												updateCustomChallanField("pdNo", e.target.value)
											}
											sx={formFieldSx}
										/>

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
											multiline
											minRows={2}
											value={customChallanForm.clientAddress}
											onChange={(e) =>
												updateCustomChallanField("clientAddress", e.target.value)
											}
											sx={formFieldSx}
										/>

										<TextField
											label="Purpose / Requirement"
											multiline
											minRows={2}
											placeholder="Customer care replacement, site hardware requirement, job work, etc."
											value={customChallanForm.purpose}
											onChange={(e) =>
												updateCustomChallanField("purpose", e.target.value)
											}
											sx={formFieldSx}
										/>

										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Driver Name
												<Box component="span" sx={{ ml: 0.7, color: "var(--pf-text-dim)", fontSize: 11, fontWeight: 750 }}>
													(Optional)
												</Box>
											</Box>
											<Box
												component="select"
												value={customChallanForm.driverName || ""}
												onChange={(event) => {
													const selectedValue = String(event.target.value || "");
													if (selectedValue === CREATE_NEW_DRIVER_OPTION) {
														openCreateDriverModal(MASTER_CREATE_TARGET.CUSTOM_CHALLAN);
														return;
													}
													updateCustomChallanField("driverName", selectedValue);
												}}
												sx={dispatchTripNativeSelectSx}
											>
												<option value="">No Driver / Leave Blank</option>
												<option value={CREATE_NEW_DRIVER_OPTION}>＋ Create New Driver</option>
												{logisticsMastersLoading &&
													logisticsDrivers.length === 0 && (
														<option value="" disabled>
															Loading registered drivers...
														</option>
													)}
												{!logisticsMastersLoading &&
													logisticsDrivers.length === 0 && (
														<option value="" disabled>
															No registered drivers found
														</option>
													)}
												{customChallanForm.driverName &&
													!logisticsDrivers.some(
														(driver) =>
															String(driver?.name || "").trim() ===
															String(customChallanForm.driverName || "").trim()
													) && (
														<option value={customChallanForm.driverName}>
															{customChallanForm.driverName} (Current)
														</option>
													)}
												{logisticsDrivers.map((driver) => {
													const driverId = String(driver?.id || "").trim();
													const driverName = String(driver?.name || "").trim();
													if (!driverName) return null;
													return (
														<option key={driverId || driverName} value={driverName}>
															{driverName}
														</option>
													);
												})}
											</Box>
										</Box>

										<Box>
											<Box sx={dispatchTripFieldLabelSx}>
												Vehicle Number
												<Box component="span" sx={{ ml: 0.7, color: "var(--pf-text-dim)", fontSize: 11, fontWeight: 750 }}>
													(Optional)
												</Box>
											</Box>
											<Box
												component="select"
												value={customChallanForm.vehicleNumber || ""}
												onChange={(event) => {
													const selectedValue = String(event.target.value || "");
													if (selectedValue === CREATE_NEW_VEHICLE_OPTION) {
														openCreateVehicleModal(MASTER_CREATE_TARGET.CUSTOM_CHALLAN);
														return;
													}
													updateCustomChallanField("vehicleNumber", selectedValue);
												}}
												sx={dispatchTripNativeSelectSx}
											>
												<option value="">No Vehicle / Leave Blank</option>
												<option value={CREATE_NEW_VEHICLE_OPTION}>＋ Create New Vehicle</option>
												{logisticsMastersLoading &&
													logisticsVehicles.length === 0 && (
														<option value="" disabled>
															Loading registered vehicles...
														</option>
													)}
												{!logisticsMastersLoading &&
													logisticsVehicles.length === 0 && (
														<option value="" disabled>
															No registered vehicles found
														</option>
													)}
												{customChallanForm.vehicleNumber &&
													!logisticsVehicles.some(
														(vehicle) =>
															String(vehicle?.vehicleNumber || "").trim() ===
															String(customChallanForm.vehicleNumber || "").trim()
													) && (
														<option value={customChallanForm.vehicleNumber}>
															{customChallanForm.vehicleNumber} (Current)
														</option>
													)}
												{logisticsVehicles.map((vehicle) => {
													const vehicleId = String(vehicle?.id || "").trim();
													const vehicleNumber = String(vehicle?.vehicleNumber || "").trim();
													const vehicleName = String(vehicle?.vehicleName || "").trim();
													if (!vehicleNumber) return null;
													return (
														<option key={vehicleId || vehicleNumber} value={vehicleNumber}>
															{vehicleNumber}{vehicleName ? ` - ${vehicleName}` : ""}
														</option>
													);
												})}
											</Box>
										</Box>

										{isSiteReturnChallanType(customChallanForm.challanType) && (
											<TextField
												label="Handed Over To"
												placeholder="Person name / site representative"
												value={customChallanForm.handedOverTo}
												onChange={(e) =>
													updateCustomChallanField("handedOverTo", e.target.value)
												}
												required
												sx={formFieldSx}
											/>
										)}
									</Box>
								</Box>

								<Box sx={customFormSectionSx}>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 2,
											mb: 2,
										}}
									>
										<Box>
											<Box sx={customFormSectionTitleSx}>
												03 · Challan Items
											</Box>
											<Box sx={{ ...customFormSectionSubSx, mb: 0 }}>
												Add, remove or correct every material / requirement line.
											</Box>
										</Box>

										<Button
											onClick={addCustomChallanItem}
											sx={{
												...premiumButton,
												minWidth: 120,
												background: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
											}}
										>
											+ Add Item
										</Button>
									</Box>

									<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
										{customChallanForm.items.map((item, index) => (
											<Box key={`custom-item-${index}`} sx={customChallanItemCardSx}>
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														mb: 1.6,
													}}
												>
													<Chip
														size="small"
														label={`ITEM ${String(index + 1).padStart(2, "0")}`}
														sx={customItemNumberChipSx}
													/>

													{customChallanForm.items.length > 1 && (
														<Button
															onClick={() => removeCustomChallanItem(index)}
															sx={customChallanRemoveItemButtonSx}
														>
															Remove
														</Button>
													)}
												</Box>

												<Box
													sx={{
														display: "grid",
														gridTemplateColumns: {
															xs: "1fr",
															md: "minmax(260px,2fr) minmax(160px,1fr) 100px 120px 170px",
														},
														gap: 1.4,
														mb: 1.4,
													}}
												>
													<TextField
														label="Description"
														value={item.description}
														onChange={(e) =>
															updateCustomChallanItem(index, "description", e.target.value)
														}
														sx={formFieldSx}
													/>

													<TextField
														label="Line PD No. / Reference"
														value={item.drawingNo}
														onChange={(e) =>
															updateCustomChallanItem(index, "drawingNo", e.target.value)
														}
														sx={formFieldSx}
													/>

													<TextField
														label="Qty"
														type="number"
														inputProps={{ min: 0.0001, step: "any" }}
														value={item.quantity}
														onChange={(e) =>
															updateCustomChallanItem(index, "quantity", e.target.value)
														}
														sx={formFieldSx}
													/>

													<Box>
														<Box sx={dispatchTripFieldLabelSx}>UOM</Box>
														<Box
															component="select"
															value={item.uom || "PIECES"}
															onChange={(e) =>
																updateCustomChallanItem(index, "uom", e.target.value)
															}
															sx={{ ...dispatchTripNativeSelectSx, height: 56 }}
														>
															{CUSTOM_CHALLAN_UOM_OPTIONS.map((option) => (
																<option key={option.value} value={option.value}>
																	{option.label}
																</option>
															))}
														</Box>
													</Box>

													<Box>
														<Box sx={dispatchTripFieldLabelSx}>Nature</Box>
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
															sx={{ ...dispatchTripNativeSelectSx, height: 56 }}
														>
															<option value="NON_RETURNABLE">Non Returnable</option>
															<option value="RETURNABLE">Returnable</option>
														</Box>
													</Box>
												</Box>

												<TextField
													fullWidth
													label="Remarks"
													value={item.remarks}
													onChange={(e) =>
														updateCustomChallanItem(index, "remarks", e.target.value)
													}
													sx={formFieldSx}
												/>
											</Box>
										))}
									</Box>
								</Box>
							</Box>

							<Box sx={customChallanStickyFooterSx}>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Box sx={{ color: "var(--pf-text-strong)", fontSize: 12, fontWeight: 900 }}>
										{customChallanForm.items.length} Item
										{customChallanForm.items.length === 1 ? "" : "s"}
									</Box>
									<Box
										sx={{
											mt: 0.25,
											color: "var(--pf-text-muted)",
											fontSize: 10.5,
											fontWeight: 650,
										}}
									>
										{isEditingCustomChallan
											? "Saving updates the existing record and all future PDF previews/downloads."
											: "Review the movement details before generating the challan."}
									</Box>
								</Box>

								<Button
									disabled={
										customChallanLoading ||
										customChallanDetailLoading
									}
									onClick={closeCustomChallanModal}
									sx={modalSecondaryButtonSx}
								>
									Cancel
								</Button>

								<Button
									disabled={
										customChallanLoading ||
										customChallanDetailLoading
									}
									onClick={submitCustomChallan}
									sx={{
										...premiumButton,
										minWidth: 210,
										background: isEditingCustomChallan
											? "linear-gradient(135deg,#d97706,#f59e0b)"
											: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
									}}
								>
									{customChallanLoading
										? isEditingCustomChallan
											? "Saving Changes..."
											: "Generating..."
										: isEditingCustomChallan
											? "Save Changes & Refresh PDF"
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
										background: "rgba(var(--pf-fg-rgb),.035)",
										border: "1px solid rgba(var(--pf-fg-rgb),.07)",
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
											"linear-gradient(135deg,rgba(59,130,246,.10),rgba(var(--pf-fg-rgb),.035))",
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
											color: "rgba(var(--pf-fg-rgb),.58)",
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
											color: scanLoading ? "#fcd34d" : "var(--pf-text-muted)",
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
																	color: "rgba(var(--pf-fg-rgb),.55)",
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
																		cache: "no-store",
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
																		cache: "no-store",
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
																		color: "var(--pf-text)",
																		fontWeight: 800,
																		background: "rgba(var(--pf-fg-rgb),.05)",
																		border: "1px solid rgba(var(--pf-fg-rgb),.08)",
																	}}
																/>

																<Chip
																	label={log.role || "—"}
																	size="small"
																	sx={{
																		background: roleStyle.bg,
																		color: roleStyle.color,
																		fontWeight: 800,
																		border: "1px solid rgba(var(--pf-fg-rgb),.08)",
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
			  radial-gradient(circle at top left, rgba(var(--pf-fg-rgb),0.08), transparent 20%),
			  rgba(var(--pf-surface-rgb),0.55)
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
									"linear-gradient(180deg,var(--pf-surface),var(--pf-surface-alt))",

								color: "#fff",

								borderLeft:
									"1px solid rgba(var(--pf-fg-rgb),.06)",

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
													"rgba(var(--pf-fg-rgb),.03)",

												border:
													"1px solid rgba(var(--pf-fg-rgb),.06)",
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
															.filter(r => selectionIdSet.has(r.zohoItemId))
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
											? "rgba(var(--pf-fg-rgb),.08)"
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
									background: "rgba(var(--pf-fg-rgb),.035)",
									border: "1px solid rgba(var(--pf-fg-rgb),.07)",
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
										color: "var(--pf-text-muted)",
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
											? "rgba(var(--pf-fg-rgb),.08)"
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
										background: "rgba(var(--pf-fg-rgb),.035)",
										border: "1px solid rgba(var(--pf-fg-rgb),.07)",
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
											color: "var(--pf-text-muted)",
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
											{statusChangeLoading
												? "Updating item status…"
												: "Choose the next movement for this item"}
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
											if (statusChangeLoading) {
												return;
											}

											const row =
												statusModal;

											try {
												if (!row?.zohoItemId) {
													throw new Error(
														"Item ID missing"
													);
												}

												setStatusChangeLoading(
													true
												);

												const updatedRow =
													await updateStatus(
														row.zohoItemId,
														"READY_TO_STORE"
													);

												setStatusModal(
													null
												);

												/*
												 * Open the gate-pass modal immediately using
												 * the locally updated authoritative status.
												 */
												openSingleGatePassModal(
													updatedRow
												);
											} catch (error) {
												console.error(
													error
												);

												alert(
													error?.message ||
													"Failed to prepare item for warehouse"
												);
											} finally {
												setStatusChangeLoading(
													false
												);
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
											if (statusChangeLoading) {
												return;
											}

											const row =
												statusModal;

											try {
												if (!row?.zohoItemId) {
													throw new Error(
														"Item ID missing"
													);
												}

												setStatusChangeLoading(
													true
												);

												await updateStatus(
													row.zohoItemId,
													"READY_TO_DISPATCH"
												);

												setStatusModal(
													null
												);
											} catch (error) {
												console.error(
													error
												);

												alert(
													error?.message ||
													"Failed to prepare item for dispatch"
												);
											} finally {
												setStatusChangeLoading(
													false
												);
											}
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
										background: "rgba(var(--pf-fg-rgb),.035)",
										border: "1px solid rgba(var(--pf-fg-rgb),.07)",
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
											color: "var(--pf-text-muted)",
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
											if (bulkStatusLoading) {
												return;
											}

											try {
												setBulkStatusLoading(
													true
												);

												await updateBulkDispatchStatus(
													"READY_TO_STORE"
												);

												setSelectionModel(
													[]
												);

												setBulkStatusModal(
													false
												);
											} catch (error) {
												console.error(
													error
												);

												alert(
													error?.message ||
													"Bulk store failed"
												);
											} finally {
												setBulkStatusLoading(
													false
												);
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
											if (bulkStatusLoading) {
												return;
											}

											try {
												setBulkStatusLoading(
													true
												);

												await updateBulkDispatchStatus(
													"READY_TO_DISPATCH"
												);

												setSelectionModel(
													[]
												);

												setBulkStatusModal(
													false
												);
											} catch (error) {
												console.error(
													error
												);

												alert(
													error?.message ||
													"Bulk dispatch failed"
												);
											} finally {
												setBulkStatusLoading(
													false
												);
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
				<Drawer
					anchor="right"
					open={adminDeleteOpen}
					onClose={closeAdminDispatchDelete}
					PaperProps={{
						sx: {
							width: { xs: "100%", sm: 560 },
							maxWidth: "100vw",
							background:
								"linear-gradient(180deg,var(--pf-surface-deep),var(--pf-surface),var(--pf-surface-alt))",
							color: "#fff",
							borderLeft:
								"1px solid rgba(248,113,113,.20)",
						},
					}}
				>
					<Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
						<Box
							sx={{
								px: 3,
								py: 2.3,
								borderBottom:
									"1px solid rgba(248,113,113,.16)",
								background: "rgba(var(--pf-surface-deep-rgb),.96)",
							}}
						>
							<Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
								<Box>
									<Box
										sx={{
											color: "#fca5a5",
											fontSize: 10.5,
											fontWeight: 950,
											letterSpacing: ".11em",
											textTransform: "uppercase",
										}}
									>
										Admin • Permanent Delete
									</Box>
									<Box sx={{ mt: 0.5, fontSize: 22, fontWeight: 950 }}>
										{adminDeleteRows.length > 1
											? `Delete ${adminDeleteRows.length} Dispatch Items`
											: "Delete Dispatch Item"}
									</Box>
									<Box sx={{ mt: 0.7, color: "var(--pf-text-muted)", fontSize: 12.5, lineHeight: 1.5 }}>
										Live PackFlow records and statistics are purged. Only the
										separate Admin Delete History audit snapshot remains.
									</Box>
								</Box>

								<IconButton
									disabled={adminDeletePreviewLoading || adminDeleteExecuting}
									onClick={closeAdminDispatchDelete}
									sx={{ color: "var(--pf-text-soft)" }}
								>
									<Box component="span" sx={{ fontSize: 24, lineHeight: 1 }}>
										×
									</Box>
								</IconButton>
							</Box>
						</Box>

						<Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
							{adminDeletePreviewLoading && (
								<Box
									sx={{
										minHeight: 220,
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										justifyContent: "center",
										gap: 1.2,
									}}
								>
									<CircularProgress size={28} />
									<Box sx={{ color: "var(--pf-text-soft)", fontSize: 13, fontWeight: 850 }}>
										Calculating linked records...
									</Box>
								</Box>
							)}

							{adminDeleteError && (
								<Box
									sx={{
										mb: 2,
										p: 1.5,
										borderRadius: "12px",
										color: "#fecaca",
										background: "rgba(127,29,29,.30)",
										border: "1px solid rgba(248,113,113,.24)",
										fontSize: 12.5,
										fontWeight: 750,
									}}
								>
									{adminDeleteError}
								</Box>
							)}

							{!adminDeletePreviewLoading && adminDeletePreview && (
								<>
									<Box
										sx={{
											p: 1.8,
											borderRadius: "15px",
											background: "rgba(var(--pf-surface-rgb),.72)",
											border: "1px solid rgba(var(--pf-fg-rgb),.08)",
										}}
									>
										<Box sx={{ color: "var(--pf-text-dim)", fontSize: 10, fontWeight: 900 }}>
											TARGET
										</Box>
										<Box sx={{ mt: 0.4, fontSize: 15, fontWeight: 950 }}>
											{adminDeletePreview?.displayName ||
												`${adminDeleteRows.length} Dispatch item(s)`}
										</Box>

										{adminDeletePreview?.warning && (
											<Box
												sx={{
													mt: 1.4,
													p: 1.3,
													borderRadius: "11px",
													color: "#fde68a",
													background: "rgba(120,53,15,.22)",
													border: "1px solid rgba(245,158,11,.20)",
													fontSize: 12,
													lineHeight: 1.5,
												}}
											>
												{adminDeletePreview.warning}
											</Box>
										)}
									</Box>

									<Box sx={{ mt: 2.2, color: "var(--pf-text-soft)", fontSize: 12, fontWeight: 950 }}>
										Records that will be removed
									</Box>

									<Box
										sx={{
											mt: 1,
											display: "grid",
											gridTemplateColumns: "repeat(2,minmax(0,1fr))",
											gap: 1,
										}}
									>
										{Object.entries(adminDeletePreview?.affectedRows || {}).map(
											([key, value]) => (
												<Box
													key={key}
													sx={{
														p: 1.2,
														borderRadius: "11px",
														background: "rgba(var(--pf-fg-rgb),.035)",
														border: "1px solid rgba(var(--pf-fg-rgb),.06)",
													}}
												>
													<Box sx={{ color: "var(--pf-text-dim)", fontSize: 9.5, fontWeight: 900 }}>
														{String(key)
															.replace(/([a-z])([A-Z])/g, "$1 $2")
															.replace(/_/g, " ")}
													</Box>
													<Box sx={{ mt: 0.2, fontSize: 19, fontWeight: 950 }}>
														{Number(value || 0)}
													</Box>
												</Box>
											)
										)}
									</Box>

									<Box sx={{ mt: 2.3, color: "var(--pf-text-soft)", fontSize: 12, fontWeight: 950 }}>
										Deletion reason
									</Box>
									<TextField
										fullWidth
										multiline
										minRows={3}
										value={adminDeleteReason}
										disabled={adminDeleteExecuting}
										onChange={(event) => setAdminDeleteReason(event.target.value)}
										placeholder="Required. Minimum 5 characters."
										inputProps={{ maxLength: 1000 }}
										sx={{
											mt: 0.8,
											"& .MuiOutlinedInput-root": {
												color: "#fff",
												borderRadius: "13px",
												background: "rgba(var(--pf-fg-rgb),.04)",
											},
										}}
									/>

									<Box sx={{ mt: 2.2, color: "var(--pf-text-soft)", fontSize: 12, fontWeight: 950 }}>
										Type exact confirmation
									</Box>
									<Box
										sx={{
											mt: 0.8,
											p: 1.2,
											borderRadius: "11px",
											color: "#fecaca",
											fontFamily: "monospace",
											fontSize: 12,
											fontWeight: 850,
											background: "rgba(127,29,29,.22)",
											border: "1px dashed rgba(248,113,113,.30)",
											wordBreak: "break-word",
										}}
									>
										{adminDeletePreview?.requiredConfirmation}
									</Box>
									<TextField
										fullWidth
										value={adminDeleteConfirmation}
										disabled={adminDeleteExecuting}
										onChange={(event) =>
											setAdminDeleteConfirmation(event.target.value)
										}
										placeholder="Type confirmation text"
										sx={{
											mt: 1,
											"& .MuiOutlinedInput-root": {
												color: "#fff",
												borderRadius: "13px",
												background: "rgba(var(--pf-fg-rgb),.04)",
											},
										}}
									/>
								</>
							)}
						</Box>

						<Box
							sx={{
								display: "flex",
								gap: 1.2,
								px: 3,
								py: 2,
								borderTop: "1px solid rgba(var(--pf-fg-rgb),.07)",
								background: "rgba(var(--pf-surface-deep-rgb),.96)",
							}}
						>
							<Button
								fullWidth
								disabled={adminDeletePreviewLoading || adminDeleteExecuting}
								onClick={closeAdminDispatchDelete}
								sx={{
									height: 44,
									borderRadius: "12px",
									textTransform: "none",
									fontWeight: 900,
									color: "var(--pf-text-soft)",
									background: "rgba(var(--pf-fg-rgb),.06)",
								}}
							>
								Cancel
							</Button>

							<Button
								fullWidth
								disabled={
									!adminDeletePreview ||
									adminDeletePreviewLoading ||
									adminDeleteExecuting ||
									String(adminDeleteReason || "").trim().length < 5 ||
									String(adminDeleteConfirmation || "").trim().toLowerCase() !==
										String(
											adminDeletePreview?.requiredConfirmation || ""
										).trim().toLowerCase()
								}
								onClick={executeAdminDispatchDelete}
								sx={{
									height: 44,
									borderRadius: "12px",
									textTransform: "none",
									fontWeight: 950,
									color: "#fff",
									background: "linear-gradient(180deg,#dc2626,#991b1b)",
									"&.Mui-disabled": {
										color: "rgba(var(--pf-fg-rgb),.30)",
										background: "rgba(var(--pf-fg-rgb),.06)",
									},
								}}
							>
								{adminDeleteExecuting
									? "Deleting Permanently..."
									: adminDeleteRows.length > 1
										? `Delete ${adminDeleteRows.length} Permanently`
										: "Delete Permanently"}
							</Button>
						</Box>
					</Box>
				</Drawer>

				{adminEditOpen && (
					<Box
						sx={{
							...enhancedOverlaySx,
							zIndex: 6400,
						}}
						onClick={
							closeAdminDispatchEdit
						}
					>
						<Box
							sx={{
								...enhancedModalSx,

								width:
									"min(900px,94vw)",

								maxHeight:
									"92vh",

								display:
									"flex",

								flexDirection:
									"column",
							}}
							onClick={(event) =>
								event.stopPropagation()
							}
						>
							<Box sx={modalHeaderSx}>
								<Box sx={modalTitleWrapSx}>
									<Box
										sx={modalIconBubble(
											"#f59e0b"
										)}
									>
										✏️
									</Box>

									<Box>
										<Box sx={modalTitleSx}>
											Admin Edit Details
										</Box>

										<Box sx={modalSubtitleSx}>
											Editing{" "}
											{adminEditRows.length}{" "}
											selected item
											{adminEditRows.length ===
												1
												? ""
												: "s"}
										</Box>
									</Box>
								</Box>

								<IconButton
									disabled={
										adminEditLoading
									}
									sx={modalCloseButtonSx}
									onClick={
										closeAdminDispatchEdit
									}
								>
									×
								</IconButton>
							</Box>

							<Box
								sx={{
									...modalContentSx,

									flex: 1,
									minHeight: 0,
									overflowY: "auto",

									...premiumScrollbarSx(
										"#f59e0b"
									),
								}}
							>
								<Box
									sx={{
										mb: 2,
										p: 1.4,
										borderRadius: "12px",

										color: "#fcd34d",
										fontSize: 12,
										fontWeight: 800,

										background:
											"rgba(245,158,11,.10)",

										border:
											"1px solid rgba(245,158,11,.20)",
									}}
								>
									Only checked fields will be
									applied. Packing date updates the
									item sticker/history PDFs. Driver, vehicle and
									dispatch date/time changes are
									challan-level changes, so every
									item in each affected challan
									will be updated together.
									Dispatch date/time cannot be blank.
								</Box>

								<Box
									sx={{
										display: "grid",
										gridTemplateColumns:
											"repeat(2,minmax(0,1fr))",
										gap: 1.5,
									}}
								>
									{ADMIN_EDIT_TEXT_FIELDS.map(
										(field) => {
											const enabled =
												Boolean(
													adminEditApply[
													field.key
													]
												);

											return (
												<Box
													key={
														field.key
													}
													sx={{
														p: 1.2,
														borderRadius:
															"14px",

														background:
															enabled
																? "rgba(245,158,11,.08)"
																: "rgba(var(--pf-fg-rgb),.025)",

														border:
															enabled
																? "1px solid rgba(245,158,11,.24)"
																: "1px solid rgba(var(--pf-fg-rgb),.07)",

														gridColumn:
															field.multiline
																? "1 / -1"
																: "auto",
													}}
												>
													<Box
														sx={{
															display:
																"flex",

															alignItems:
																"center",

															gap: 1,
															mb: 1,
														}}
													>
														<Checkbox
															size="small"
															checked={
																enabled
															}
															onChange={(
																event
															) =>
																setAdminEditApply(
																	(previous) => ({
																		...previous,

																		[field.key]:
																			event
																				.target
																				.checked,
																	})
																)
															}
															sx={{
																p: 0.3,

																color:
																	"rgba(var(--pf-fg-rgb),.42)",

																"&.Mui-checked":
																{
																	color:
																		"#f59e0b",
																},
															}}
														/>

														<Box
															sx={{
																color:
																	enabled
																		? "#fcd34d"
																		: "var(--pf-text-muted)",

																fontSize: 11,
																fontWeight: 950,
																textTransform:
																	"uppercase",
																letterSpacing:
																	".06em",
															}}
														>
															Apply{" "}
															{field.label}
														</Box>
													</Box>

													<TextField
														fullWidth
														disabled={
															!enabled ||
															adminEditLoading
														}
														label={
															field.label
														}
														multiline={
															Boolean(
																field.multiline
															)
														}
														minRows={
															field.multiline
																? 2
																: undefined
														}
														value={
															adminEditForm[
															field.key
															] || ""
														}
														onChange={(
															event
														) =>
															setAdminEditForm(
																(previous) => ({
																	...previous,

																	[field.key]:
																		event
																			.target
																			.value,
																})
															)
														}
														sx={
															formFieldSx
														}
													/>
												</Box>
											);
										}
									)}
								</Box>

								{/* PACKING DATE */}
								<Box
									sx={{
										mt: 2,
										p: 1.4,
										borderRadius: "14px",

										background:
											adminEditApply.packingDate
												? "rgba(168,85,247,.09)"
												: "rgba(var(--pf-fg-rgb),.025)",

										border:
											adminEditApply.packingDate
												? "1px solid rgba(168,85,247,.28)"
												: "1px solid rgba(var(--pf-fg-rgb),.07)",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											mb: 1.2,
										}}
									>
										<Checkbox
											size="small"
											checked={
												adminEditApply.packingDate
											}
											onChange={(event) =>
												setAdminEditApply(
													(previous) => ({
														...previous,
														packingDate:
															event.target.checked,
													})
												)
											}
											sx={{
												p: 0.3,

												"&.Mui-checked": {
													color: "#c084fc",
												},
											}}
										/>

										<Box
											sx={{
												color: "#d8b4fe",
												fontSize: 12,
												fontWeight: 950,
											}}
										>
											Apply Packing Date
										</Box>
									</Box>

									<TextField
										fullWidth
										disabled={
											!adminEditApply.packingDate ||
											adminEditLoading
										}
										type="date"
										label="Packing Date"
										InputLabelProps={{
											shrink: true,
										}}
										value={
											adminEditForm.packingDate ||
											""
										}
										onChange={(event) =>
											setAdminEditForm(
												(previous) => ({
													...previous,
													packingDate:
														event.target.value,
												})
											)
										}
										sx={dateTimeFieldSx}
									/>

									<Box
										sx={{
											mt: 1,
											color: "rgba(var(--pf-fg-rgb),.52)",
											fontSize: 11,
											fontWeight: 750,
										}}
									>
										Updates the dispatch register packing date and rebuilds every
										stored sticker-history PDF for the selected item(s).
									</Box>
								</Box>

								{/* DISPATCH DATE / TIME */}
								<Box
									sx={{
										mt: 2,
										p: 1.4,
										borderRadius: "14px",

										background:
											adminEditApply.dispatchDateTime
												? "rgba(16,185,129,.08)"
												: "rgba(var(--pf-fg-rgb),.025)",

										border:
											adminEditApply.dispatchDateTime
												? "1px solid rgba(16,185,129,.24)"
												: "1px solid rgba(var(--pf-fg-rgb),.07)",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											mb: 1.2,
										}}
									>
										<Checkbox
											size="small"
											checked={
												adminEditApply.dispatchDateTime
											}
											onChange={(event) =>
												setAdminEditApply(
													(previous) => ({
														...previous,
														dispatchDateTime:
															event.target.checked,
													})
												)
											}
											sx={{
												p: 0.3,

												"&.Mui-checked": {
													color: "#34d399",
												},
											}}
										/>

										<Box
											sx={{
												color: "#6ee7b7",
												fontSize: 12,
												fontWeight: 950,
											}}
										>
											Apply Dispatch Date / Time
										</Box>
									</Box>

									<TextField
										fullWidth
										disabled={
											!adminEditApply.dispatchDateTime ||
											adminEditLoading
										}
										type="datetime-local"
										label="Dispatch Date / Time"
										InputLabelProps={{
											shrink: true,
										}}
										value={
											adminEditForm.dispatchDateTime ||
											""
										}
										onChange={(event) =>
											setAdminEditForm(
												(previous) => ({
													...previous,

													dispatchDateTime:
														event.target.value,
												})
											)
										}
										sx={dateTimeFieldSx}
									/>

									<Box
										sx={{
											mt: 1,
											color: "rgba(var(--pf-fg-rgb),.52)",
											fontSize: 11,
											fontWeight: 750,
										}}
									>
										Changing one item updates dispatchedAt and
										tripStartedAt for every item in the same challan.
									</Box>
								</Box>

								{/* DRIVER */}
								<Box
									sx={{
										mt: 2,
										p: 1.4,
										borderRadius: "14px",

										background:
											adminEditApply.driver
												? "rgba(59,130,246,.08)"
												: "rgba(var(--pf-fg-rgb),.025)",

										border:
											adminEditApply.driver
												? "1px solid rgba(59,130,246,.24)"
												: "1px solid rgba(var(--pf-fg-rgb),.07)",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											mb: 1.2,
										}}
									>
										<Checkbox
											size="small"
											checked={
												adminEditApply.driver
											}
											onChange={(event) =>
												setAdminEditApply(
													(previous) => ({
														...previous,
														driver:
															event.target
																.checked,
													})
												)
											}
											sx={{
												p: 0.3,

												"&.Mui-checked": {
													color:
														"#60a5fa",
												},
											}}
										/>

										<Box
											sx={{
												color: "#93c5fd",
												fontSize: 12,
												fontWeight: 950,
											}}
										>
											Apply Driver
										</Box>
									</Box>

									<Box
										sx={{
											display: "grid",
											gridTemplateColumns:
												"1fr 1fr",
											gap: 1.4,
										}}
									>
										<Box
											component="select"
											disabled={
												!adminEditApply.driver ||
												adminEditLoading
											}
											value={
												adminEditForm.driverId ||
												""
											}
											onChange={(event) => {
												const value =
													String(
														event.target
															.value ||
														""
													);

												if (
													value ===
													CREATE_NEW_DRIVER_OPTION
												) {
													openCreateDriverModal(
														MASTER_CREATE_TARGET
															.ADMIN_BULK_EDIT
													);

													return;
												}

												const driver =
													logisticsDrivers.find(
														(item) =>
															String(
																item?.id ||
																""
															) ===
															value
													);

												setAdminEditForm(
													(previous) => ({
														...previous,

														driverId:
															value,

														driverName:
															driver?.name ||
															previous.driverName,
													})
												);
											}}
											sx={dispatchTripNativeSelectSx}
										>
											<option value="">
												Manual / No Linked Driver
											</option>

											<option
												value={
													CREATE_NEW_DRIVER_OPTION
												}
											>
												＋ Create New Driver
											</option>

											{logisticsDrivers.map(
												(driver) => (
													<option
														key={
															driver.id
														}
														value={
															driver.id
														}
													>
														{
															driver.name
														}
													</option>
												)
											)}
										</Box>

										<TextField
											fullWidth
											disabled={
												!adminEditApply.driver ||
												adminEditLoading
											}
											label="Driver Name"
											placeholder="Enter legacy driver name"
											value={
												adminEditForm.driverName
											}
											onChange={(event) =>
												setAdminEditForm(
													(previous) => ({
														...previous,

														/*
														 * Manual text means the row is
														 * not necessarily linked to a
														 * driver master.
														 */
														driverId: "",

														driverName:
															event.target
																.value,
													})
												)
											}
											sx={formFieldSx}
										/>
									</Box>
								</Box>

								{/* VEHICLE */}
								<Box
									sx={{
										mt: 1.5,
										p: 1.4,
										borderRadius: "14px",

										background:
											adminEditApply.vehicle
												? "rgba(16,185,129,.08)"
												: "rgba(var(--pf-fg-rgb),.025)",

										border:
											adminEditApply.vehicle
												? "1px solid rgba(16,185,129,.24)"
												: "1px solid rgba(var(--pf-fg-rgb),.07)",
									}}
								>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1,
											mb: 1.2,
										}}
									>
										<Checkbox
											size="small"
											checked={
												adminEditApply.vehicle
											}
											onChange={(event) =>
												setAdminEditApply(
													(previous) => ({
														...previous,
														vehicle:
															event.target
																.checked,
													})
												)
											}
											sx={{
												p: 0.3,

												"&.Mui-checked": {
													color:
														"#10b981",
												},
											}}
										/>

										<Box
											sx={{
												color: "#6ee7b7",
												fontSize: 12,
												fontWeight: 950,
											}}
										>
											Apply Vehicle
										</Box>
									</Box>

									<Box
										sx={{
											display: "grid",
											gridTemplateColumns:
												"1fr 1fr",
											gap: 1.4,
										}}
									>
										<Box
											component="select"
											disabled={
												!adminEditApply.vehicle ||
												adminEditLoading
											}
											value={
												adminEditForm.vehicleId ||
												""
											}
											onChange={(event) => {
												const value =
													String(
														event.target
															.value ||
														""
													);

												if (
													value ===
													CREATE_NEW_VEHICLE_OPTION
												) {
													openCreateVehicleModal(
														MASTER_CREATE_TARGET
															.ADMIN_BULK_EDIT
													);

													return;
												}

												const vehicle =
													logisticsVehicles.find(
														(item) =>
															String(
																item?.id ||
																""
															) ===
															value
													);

												setAdminEditForm(
													(previous) => ({
														...previous,

														vehicleId:
															value,

														vehicleNumber:
															vehicle?.vehicleNumber ||
															previous.vehicleNumber,
													})
												);
											}}
											sx={dispatchTripNativeSelectSx}
										>
											<option value="">
												Manual / No Linked Vehicle
											</option>

											<option
												value={
													CREATE_NEW_VEHICLE_OPTION
												}
											>
												＋ Create New Vehicle
											</option>

											{logisticsVehicles.map(
												(vehicle) => (
													<option
														key={
															vehicle.id
														}
														value={
															vehicle.id
														}
													>
														{
															vehicle.vehicleNumber
														}
														{vehicle.vehicleName
															? ` - ${vehicle.vehicleName}`
															: ""}
													</option>
												)
											)}
										</Box>

										<TextField
											fullWidth
											disabled={
												!adminEditApply.vehicle ||
												adminEditLoading
											}
											label="Vehicle Number"
											placeholder="Enter legacy vehicle number"
											value={
												adminEditForm.vehicleNumber
											}
											onChange={(event) =>
												setAdminEditForm(
													(previous) => ({
														...previous,

														vehicleId: "",

														vehicleNumber:
															event.target
																.value,
													})
												)
											}
											sx={formFieldSx}
										/>
									</Box>
								</Box>
							</Box>

							<Box sx={modalFooterSx}>
								<Button
									disabled={
										adminEditLoading
									}
									onClick={
										closeAdminDispatchEdit
									}
									sx={
										modalSecondaryButtonSx
									}
								>
									Cancel
								</Button>

								<Button
									disabled={
										adminEditLoading ||
										!Object.values(
											adminEditApply
										).some(Boolean)
									}
									onClick={
										saveAdminDispatchEdit
									}
									sx={{
										...premiumButton,

										background:
											"linear-gradient(135deg,#d97706,#f59e0b)",

										"&.Mui-disabled": {
											color:
												"rgba(var(--pf-fg-rgb),.40)",

											background:
												"rgba(var(--pf-fg-rgb),.08)",
										},
									}}
								>
									{adminEditLoading
										? "Saving Changes..."
										: `Apply to ${adminEditRows.length} Item${adminEditRows.length === 1
											? ""
											: "s"
										}`}
								</Button>
							</Box>
						</Box>
					</Box>
				)}
				{dispatchTripOpen && (
					<Box
						sx={{
							...enhancedOverlaySx,
							zIndex: 5600,
						}}
						onClick={
							closeDispatchTripModal
						}
					>
						<Box
							sx={dispatchTripModalShellSx(
								dispatchTripStep
							)}
							onClick={(event) =>
								event.stopPropagation()
							}
						>
							<Box
								sx={{
									...modalHeaderSx,
									flexShrink: 0,
								}}
							>
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
									onClick={
										closeDispatchTripModal
									}
								>
									×
								</IconButton>
							</Box>

							<Box
								sx={
									dispatchTripModalContentSx
								}
							>
								{/* STEP INDICATOR */}
								<Box
									sx={{
										flexShrink: 0,
										display: "grid",
										gridTemplateColumns:
											"1fr 1fr",
										gap: 1,
										mb: 2,
										p: 0.8,
										borderRadius: "14px",
										background:
											"rgba(var(--pf-fg-rgb),.035)",
										border:
											"1px solid rgba(var(--pf-fg-rgb),.07)",
									}}
								>
									<Box
										sx={{
											height: 38,
											display: "flex",
											alignItems: "center",
											justifyContent:
												"center",
											gap: 0.8,
											borderRadius: "10px",
											color:
												dispatchTripStep ===
													"DETAILS"
													? "#fff"
													: "var(--pf-text-muted)",
											fontSize: 12,
											fontWeight: 900,
											background:
												dispatchTripStep ===
													"DETAILS"
													? "rgba(59,130,246,.20)"
													: "transparent",
											border:
												dispatchTripStep ===
													"DETAILS"
													? "1px solid rgba(96,165,250,.30)"
													: "1px solid transparent",
										}}
									>
										<span>1</span>
										Details
									</Box>

									<Box
										sx={{
											height: 38,
											display: "flex",
											alignItems: "center",
											justifyContent:
												"center",
											gap: 0.8,
											borderRadius: "10px",
											color:
												dispatchTripStep ===
													"REVIEW"
													? "#fff"
													: "var(--pf-text-muted)",
											fontSize: 12,
											fontWeight: 900,
											background:
												dispatchTripStep ===
													"REVIEW"
													? "rgba(16,185,129,.18)"
													: "transparent",
											border:
												dispatchTripStep ===
													"REVIEW"
													? "1px solid rgba(52,211,153,.30)"
													: "1px solid transparent",
										}}
									>
										<span>2</span>
										Review & Confirm
									</Box>
								</Box>

								{dispatchTripStep ===
									"DETAILS" && (
										<Box
											sx={
												dispatchTripDetailsScrollSx
											}
										>
											<Box
												sx={{
													p: 1.6,
													mb: 2,
													borderRadius:
														"12px",
													background:
														"rgba(var(--pf-fg-rgb),.035)",
													border:
														"1px solid rgba(var(--pf-fg-rgb),.07)",
												}}
											>
												<Box
													sx={{
														color: "#fff",
														fontWeight: 900,
													}}
												>
													Items:{" "}
													{
														dispatchTripPreviewItems.length
													}
												</Box>

												<Box
													sx={{
														color: "var(--pf-text-muted)",
														fontSize: 12,
														fontWeight: 700,
														mt: 0.5,
													}}
												>
													Mode:{" "}
													{dispatchTripContext.mode ||
														"—"}
												</Box>
											</Box>

											<Box sx={{ mb: 2 }}>
												<Box
													sx={
														dispatchTripFieldLabelSx
													}
												>
													Challan Date & Time
												</Box>

												<TextField
													fullWidth
													type="datetime-local"
													value={
														dispatchTripForm.dispatchTime
													}
													onChange={(event) =>
														setDispatchTripForm(
															(previous) => ({
																...previous,
																dispatchTime:
																	event
																		.target
																		.value,
															})
														)
													}
													sx={dateTimeFieldSx}
												/>
											</Box>

											<Box sx={{ mb: 2 }}>
												<Box
													sx={
														dispatchTripFieldLabelSx
													}
												>
													Driver{" "}
													<Box
														component="span"
														sx={{
															ml: 0.7,
															color: "var(--pf-text-dim)",
															fontSize: 11,
															fontWeight: 750,
														}}
													>
														(Optional)
													</Box>
												</Box>

												<Box
													component="select"
													value={
														dispatchTripForm.driverId ||
														""
													}
													onChange={(event) => {
														const selectedValue =
															String(
																event.target
																	.value ||
																""
															);

														if (
															selectedValue ===
															CREATE_NEW_DRIVER_OPTION
														) {
															openCreateDriverModal(
																MASTER_CREATE_TARGET
																	.DISPATCH_CHALLAN
															);

															return;
														}

														setDispatchTripForm(
															(previous) => ({
																...previous,
																driverId:
																	selectedValue,
															})
														);
													}}
													sx={
														dispatchTripNativeSelectSx
													}
												>
													<option value="">
														No Driver / Leave Blank
													</option>

													<option
														value={
															CREATE_NEW_DRIVER_OPTION
														}
													>
														＋ Create New Driver
													</option>

													{logisticsMastersLoading &&
														logisticsDrivers.length === 0 && (
															<option value="" disabled>
																Loading registered drivers...
															</option>
														)}

													{!logisticsMastersLoading &&
														logisticsDrivers.length === 0 && (
															<option value="" disabled>
																No registered drivers found
															</option>
														)}

													{logisticsDrivers.map(
														(driver) => {
															const driverId =
																String(
																	driver?.id ||
																	""
																).trim();

															const driverName =
																String(
																	driver?.name ||
																	""
																).trim();

															if (
																!driverId ||
																!driverName
															) {
																return null;
															}

															return (
																<option
																	key={
																		driverId
																	}
																	value={
																		driverId
																	}
																>
																	{
																		driverName
																	}
																</option>
															);
														}
													)}
												</Box>
											</Box>

											<Box sx={{ mb: 2 }}>
												<Box
													sx={
														dispatchTripFieldLabelSx
													}
												>
													Vehicle{" "}
													<Box
														component="span"
														sx={{
															ml: 0.7,
															color: "var(--pf-text-dim)",
															fontSize: 11,
															fontWeight: 750,
														}}
													>
														(Optional)
													</Box>
												</Box>

												<Box
													component="select"
													value={
														dispatchTripForm.vehicleId ||
														""
													}
													onChange={(event) => {
														const selectedValue =
															String(
																event.target
																	.value ||
																""
															);

														if (
															selectedValue ===
															CREATE_NEW_VEHICLE_OPTION
														) {
															openCreateVehicleModal(
																MASTER_CREATE_TARGET
																	.DISPATCH_CHALLAN
															);

															return;
														}

														setDispatchTripForm(
															(previous) => ({
																...previous,
																vehicleId:
																	selectedValue,
															})
														);
													}}
													sx={
														dispatchTripNativeSelectSx
													}
												>
													<option value="">
														No Vehicle / Leave Blank
													</option>

													<option
														value={
															CREATE_NEW_VEHICLE_OPTION
														}
													>
														＋ Create New Vehicle
													</option>

													{logisticsMastersLoading &&
														logisticsVehicles.length === 0 && (
															<option value="" disabled>
																Loading registered vehicles...
															</option>
														)}

													{!logisticsMastersLoading &&
														logisticsVehicles.length === 0 && (
															<option value="" disabled>
																No registered vehicles found
															</option>
														)}

													{logisticsVehicles.map(
														(vehicle) => {
															const vehicleId =
																String(
																	vehicle?.id ||
																	""
																).trim();

															const vehicleNumber =
																String(
																	vehicle
																		?.vehicleNumber ||
																	""
																).trim();

															const vehicleName =
																String(
																	vehicle
																		?.vehicleName ||
																	""
																).trim();

															if (
																!vehicleId ||
																!vehicleNumber
															) {
																return null;
															}

															return (
																<option
																	key={
																		vehicleId
																	}
																	value={
																		vehicleId
																	}
																>
																	{
																		vehicleNumber
																	}
																	{vehicleName
																		? ` - ${vehicleName}`
																		: ""}
																</option>
															);
														}
													)}
												</Box>
											</Box>

											<Box sx={{ mb: 2 }}>
												<Box
													sx={
														dispatchTripFieldLabelSx
													}
												>
													Helpers / Loaders{" "}
													<Box
														component="span"
														sx={{
															ml: 0.7,
															color: "var(--pf-text-dim)",
															fontSize: 11,
															fontWeight: 750,
														}}
													>
														(Optional)
													</Box>
												</Box>

												<TextField
													fullWidth
													type="number"
													value={
														dispatchTripForm
															.helperLoaderCount
													}
													onChange={(event) => {
														const value =
															event.target.value;

														if (
															value === "" ||
															/^\d{0,3}$/.test(
																value
															)
														) {
															setDispatchTripForm(
																(previous) => ({
																	...previous,
																	helperLoaderCount:
																		value,
																})
															);
														}
													}}
													inputProps={{
														min: 0,
														max: 999,
														step: 1,
														inputMode: "numeric",
													}}
													placeholder="Enter total helpers / loaders"
													sx={formFieldSx}
												/>
											</Box>
										</Box>
									)}

								{dispatchTripStep ===
									"REVIEW" && (
										<Box
											sx={
												dispatchTripReviewGridSx
											}
										>
											{/* ================= LEFT SIDE ================= */}

											<Box
												sx={
													dispatchTripReviewLeftSx
												}
											>
												<Box
													sx={{
														p: 1.8,
														mb: 2,
														borderRadius:
															"16px",
														background:
															"linear-gradient(135deg,rgba(16,185,129,.12),rgba(59,130,246,.08))",
														border:
															"1px solid rgba(52,211,153,.20)",
													}}
												>
													<Box
														sx={{
															color:
																"#6ee7b7",
															fontSize: 12,
															fontWeight: 950,
															letterSpacing:
																".10em",
															textTransform:
																"uppercase",
															mb: 1.4,
														}}
													>
														Challan Summary
													</Box>

													<Box
														sx={{
															display:
																"grid",
															gridTemplateColumns:
																"1fr 1fr",
															gap: 1.4,
														}}
													>
														<DispatchReviewValue
															label="Date & Time"
															value={formatLocalDateTimeDisplay(
																dispatchTripForm
																	.dispatchTime
															)}
														/>

														<DispatchReviewValue
															label="Total Items"
															value={
																dispatchTripPreviewItems.length
															}
														/>

														<DispatchReviewValue
															label="Helpers / Loaders"
															value={
																dispatchTripForm
																	.helperLoaderCount ||
																"Not specified"
															}
														/>

														<DispatchReviewValue
															label="Driver"
															value={
																selectedDispatchDriver
																	?.name ||
																"No Driver"
															}
														/>

														<DispatchReviewValue
															label="Vehicle"
															value={
																selectedDispatchVehicle
																	?.vehicleNumber ||
																"No Vehicle"
															}
														/>

														<DispatchReviewValue
															label="Vehicle Name"
															value={
																selectedDispatchVehicle
																	?.vehicleName ||
																"—"
															}
														/>

														<DispatchReviewValue
															label="Dispatch Mode"
															value={
																dispatchTripContext.mode ||
																"—"
															}
														/>
													</Box>
												</Box>

												<Box
													sx={{
														mb: 1,
														color: "#fff",
														fontSize: 14,
														fontWeight: 950,
													}}
												>
													Items Included
												</Box>

												<Box>
													{dispatchTripPreviewItems.map(
														(item) => (
															<Box
																key={
																	item.zohoItemId
																}
																sx={{
																	p: 1.5,
																	mb: 1,
																	borderRadius:
																		"14px",
																	background:
																		"rgba(var(--pf-fg-rgb),.035)",
																	border:
																		"1px solid rgba(var(--pf-fg-rgb),.07)",
																}}
															>
																<Box
																	sx={{
																		display:
																			"flex",
																		justifyContent:
																			"space-between",
																		alignItems:
																			"flex-start",
																		gap: 2,
																	}}
																>
																	<Box
																		sx={{
																			minWidth:
																				0,
																		}}
																	>
																		<Box
																			sx={{
																				color:
																					"#fff",
																				fontSize:
																					13,
																				fontWeight:
																					900,
																				whiteSpace:
																					"nowrap",
																				overflow:
																					"hidden",
																				textOverflow:
																					"ellipsis",
																			}}
																			title={
																				item.itemName
																			}
																		>
																			{
																				item.previewSerial
																			}
																			.{" "}
																			{
																				item.itemName
																			}
																		</Box>

																		<Box
																			sx={{
																				color:
																					"var(--pf-text-muted)",
																				fontSize:
																					11,
																				fontWeight:
																					700,
																				mt: 0.6,
																			}}
																		>
																			SKU:{" "}
																			{item.sku}
																		</Box>
																	</Box>

																	<Chip
																		size="small"
																		label={
																			item.status
																		}
																		sx={{
																			color:
																				"#93c5fd",
																			fontWeight:
																				900,
																			background:
																				"rgba(59,130,246,.12)",
																			border:
																				"1px solid rgba(59,130,246,.20)",
																		}}
																	/>
																</Box>

																<Box
																	sx={{
																		display:
																			"grid",

																		gridTemplateColumns:
																			"repeat(2,minmax(0,1fr))",

																		gap: 1,
																		mt: 1.2,
																	}}
																>
																	<DispatchReviewValue
																		label="PD No."
																		value={
																			item.pdNo
																		}
																		compact
																	/>

																	<DispatchReviewValue
																		label="Drawing"
																		value={
																			item.drawingNo
																		}
																		compact
																	/>

																	<DispatchReviewValue
																		label="Plant"
																		value={
																			item.plantCode
																		}
																		compact
																	/>

																	<DispatchReviewValue
																		label="Location"
																		value={
																			item.location
																		}
																		compact
																	/>

																	<DispatchReviewValue
																		label="Client"
																		value={
																			item.clientName
																		}
																		compact
																	/>

																	<DispatchReviewValue
																		label="Item ID"
																		value={
																			item.zohoItemId
																		}
																		compact
																	/>
																</Box>
															</Box>
														)
													)}
												</Box>

												<Box
													sx={{
														mt: 1.5,
														p: 1.4,
														borderRadius:
															"12px",
														color: "#fcd34d",
														fontSize: 12,
														fontWeight: 800,
														background:
															"rgba(245,158,11,.10)",
														border:
															"1px solid rgba(245,158,11,.20)",
													}}
												>
													After confirmation, the
													selected items will be
													dispatched and the challan
													will be created. Review all
													values carefully before
													continuing.
												</Box>
											</Box>

											{/* ================= RIGHT-SIDE PDF ================= */}

											<Box
												sx={
													dispatchTripReviewRightSx
												}
											>
												<Box
													sx={
														dispatchTripReviewPdfCardSx
													}
												>
													<Box
														sx={
															dispatchTripReviewPdfHeaderSx
														}
													>
														<Box
															sx={{
																minWidth:
																	0,
															}}
														>
															<Box
																sx={{
																	color:
																		"#fff",
																	fontSize:
																		14,
																	fontWeight:
																		950,
																}}
															>
																📄 Challan PDF
																Preview
															</Box>

															<Box
																sx={{
																	color:
																		"var(--pf-text-muted)",
																	fontSize:
																		11,
																	fontWeight:
																		700,
																	mt: 0.35,
																}}
															>
																Read-only preview.
																No item is dispatched
																at this stage.
															</Box>
														</Box>

														<Box
															sx={{
																display:
																	"flex",
																alignItems:
																	"center",
																gap: 1,
																flexShrink:
																	0,
															}}
														>
															<Button
																size="small"
																disabled={
																	dispatchReviewPdfLoading
																}
																onClick={() => {
																	loadDispatchReviewPdf()
																		.catch(
																			() => {
																				/*
																				 * Error is shown
																				 * in this panel.
																				 */
																			}
																		);
																}}
																sx={{
																	...modalSecondaryButtonSx,
																	height: 34,
																	px: 1.5,
																}}
															>
																{dispatchReviewPdfLoading
																	? "Preparing..."
																	: "Refresh"}
															</Button>

															<Button
																size="small"
																disabled={
																	!dispatchReviewPdfUrl ||
																	dispatchReviewPdfLoading
																}
																onClick={() => {
																	window.open(
																		dispatchReviewPdfUrl,
																		"_blank",
																		"noopener,noreferrer"
																	);
																}}
																sx={{
																	...modalSecondaryButtonSx,
																	height: 34,
																	px: 1.5,
																}}
															>
																Open PDF
															</Button>
														</Box>
													</Box>

													{dispatchReviewPdfLoading && (
														<Box
															sx={{
																...dispatchTripReviewPdfStateSx,
																color:
																	"#fcd34d",
																background:
																	"rgba(var(--pf-surface-rgb),.65)",
																fontWeight:
																	900,
															}}
														>
															<Box
																sx={{
																	fontSize:
																		32,
																}}
															>
																📄
															</Box>

															Preparing challan PDF
															preview…
														</Box>
													)}

													{!dispatchReviewPdfLoading &&
														dispatchReviewPdfError && (
															<Box
																sx={{
																	...dispatchTripReviewPdfStateSx,
																	color:
																		"#fca5a5",
																}}
															>
																<Box
																	sx={{
																		fontSize:
																			30,
																	}}
																>
																	⚠️
																</Box>

																<Box
																	sx={{
																		fontWeight:
																			900,
																	}}
																>
																	PDF preview could
																	not be generated
																</Box>

																<Box
																	sx={{
																		color:
																			"var(--pf-text-muted)",
																		fontSize:
																			12,
																		fontWeight:
																			700,
																		maxWidth:
																			500,
																	}}
																>
																	{
																		dispatchReviewPdfError
																	}
																</Box>

																<Button
																	onClick={() => {
																		loadDispatchReviewPdf()
																			.catch(
																				() => { }
																			);
																	}}
																	sx={
																		modalSecondaryButtonSx
																	}
																>
																	Try Again
																</Button>
															</Box>
														)}

													{!dispatchReviewPdfLoading &&
														!dispatchReviewPdfError &&
														dispatchReviewPdfUrl && (
															<Box
																sx={
																	dispatchTripReviewPdfViewportSx
																}
															>
																<iframe
																	title="Dispatch Challan Review PDF"
																	src={
																		dispatchReviewPdfUrl
																	}
																	style={{
																		width:
																			"100%",
																		height:
																			"100%",
																		border:
																			"none",
																		borderRadius:
																			12,
																		background:
																			"#ffffff",
																	}}
																/>
															</Box>
														)}

													{!dispatchReviewPdfLoading &&
														!dispatchReviewPdfError &&
														!dispatchReviewPdfUrl && (
															<Box
																sx={{
																	...dispatchTripReviewPdfStateSx,
																	color:
																		"var(--pf-text-muted)",
																	fontWeight:
																		800,
																}}
															>
																No PDF preview loaded.
															</Box>
														)}
												</Box>
											</Box>
										</Box>
									)}
							</Box>

							<Box
								sx={{
									...modalFooterSx,

									flexShrink: 0,

									position: "relative",
									zIndex: 5,

									background:
										"rgba(var(--pf-surface-rgb),.98)",

									boxShadow:
										"0 -16px 34px rgba(var(--pf-surface-deep-rgb),.32)",
								}}
							>
								{dispatchTripStep ===
									"DETAILS" && (
										<>
											<Button
												disabled={
													dispatchTripLoading
												}
												onClick={() => {
													closeDispatchTripModal();

													setDispatchTripStep(
														"DETAILS"
													);
												}}
												sx={
													modalSecondaryButtonSx
												}
											>
												Cancel
											</Button>

											<Button
												disabled={
													dispatchTripLoading ||
													!dispatchTripForm.dispatchTime ||
													dispatchTripPreviewItems.length ===
													0
												}
												onClick={
													openDispatchTripReview
												}
												sx={{
													...premiumButton,
													background:
														"linear-gradient(135deg,#2563eb,#3b82f6)",
												}}
											>
												Review Challan
											</Button>
										</>
									)}

								{dispatchTripStep ===
									"REVIEW" && (
										<>
											<Button
												disabled={
													dispatchTripLoading
												}
												onClick={() => {
													clearDispatchReviewPdf();

													setDispatchTripStep(
														"DETAILS"
													);
												}}
												sx={modalSecondaryButtonSx}
											>
												← Edit Details
											</Button>

											<Button
												disabled={
													dispatchTripLoading ||
													dispatchReviewPdfLoading ||
													!dispatchReviewPdfUrl ||
													Boolean(
														dispatchReviewPdfError
													)
												}
												onClick={
													submitDispatchTrip
												}
												sx={{
													...premiumButton,

													background:
														"linear-gradient(135deg,#059669,#10b981)",

													"&.Mui-disabled": {
														color:
															"rgba(var(--pf-fg-rgb),.45)",

														background:
															"rgba(var(--pf-fg-rgb),.08)",
													},
												}}
											>
												{dispatchTripLoading
													? "Creating Final Challan..."
													: dispatchReviewPdfLoading
														? "Preparing PDF Preview..."
														: "Confirm & Create Final Challan"}
											</Button>
										</>
									)}
							</Box>
						</Box>
					</Box>
				)}

				{normalChallanViewOpen && normalChallanView && (
					<Box
						sx={{ ...enhancedOverlaySx, zIndex: 6100 }}
						onClick={closeNormalChallanView}
					>
						<Box
							sx={normalChallanViewModalSx}
							onClick={(event) => event.stopPropagation()}
						>
							<Box
								sx={{
									...modalHeaderSx,
									flexShrink: 0,
									background:
										"linear-gradient(135deg,rgba(37,99,235,.14),rgba(16,185,129,.05))",
								}}
							>
								<Box sx={modalTitleWrapSx}>
									<Box sx={modalIconBubble("#10b981")}>🚚</Box>
									<Box sx={{ minWidth: 0 }}>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1,
												flexWrap: "wrap",
											}}
										>
											<Box sx={modalTitleSx}>
												Dispatch Challan Inspector
											</Box>
											<Chip
												size="small"
												label={normalChallanView.tripStatus || "—"}
												sx={tripStatusChipSx(normalChallanView.tripStatus)}
											/>
										</Box>
										<Box sx={modalSubtitleSx}>
											{getChallanNumber(normalChallanView)} • Exact challan, logistics, trip and item-row traceability
										</Box>
									</Box>
								</Box>

								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 0.8,
										flexWrap: "wrap",
									}}
								>
									<Button
										onClick={() =>
											previewExistingChallanPdf(
												getChallanNumber(normalChallanView)
											)
										}
										sx={normalChallanViewButtonSx}
									>
										Preview PDF
									</Button>
									<Button
										onClick={() =>
											downloadExistingChallanPdf(
												getChallanNumber(normalChallanView)
											)
										}
										sx={modalSecondaryButtonSx}
									>
										Download PDF
									</Button>
									<IconButton
										onClick={closeNormalChallanView}
										sx={modalCloseButtonSx}
									>
										×
									</IconButton>
								</Box>
							</Box>

							<Box sx={normalChallanViewBodySx}>
								<Box sx={normalChallanSummaryGridSx}>
									<NormalChallanInfo
										label="Items"
										value={normalChallanViewStats.items}
									/>
									<NormalChallanInfo
										label="Total Qty"
										value={normalChallanViewStats.totalQuantity}
									/>
									<NormalChallanInfo
										label="Clients"
										value={normalChallanViewStats.uniqueClients}
									/>
									<NormalChallanInfo
										label="PD Nos."
										value={normalChallanViewStats.uniquePds}
									/>
									<NormalChallanInfo
										label="Drawings"
										value={normalChallanViewStats.uniqueDrawings}
									/>
									<NormalChallanInfo
										label="Plants"
										value={normalChallanViewStats.uniquePlants}
									/>
									<NormalChallanInfo
										label="Helpers / Loaders"
										value={normalChallanView.helperLoaderCount ?? "—"}
									/>
									<NormalChallanInfo
										label="Trip Duration"
										value={formatTripDurationMinutes(
											normalChallanView.tripDurationMinutes
										)}
									/>
								</Box>

								<Box
									sx={{
										display: "grid",
										gridTemplateColumns: {
											xs: "1fr",
											md: "repeat(2,minmax(0,1fr))",
											xl: "repeat(4,minmax(0,1fr))",
										},
										gap: 0.9,
									}}
								>
									<NormalChallanInfo
										label="Driver"
										value={normalChallanView.driverName || "—"}
									/>
									<NormalChallanInfo
										label="Vehicle"
										value={normalChallanView.vehicleNumber || "—"}
									/>
									<NormalChallanInfo
										label="Dispatched By"
										value={normalChallanView.dispatchedBy || "—"}
									/>
									<NormalChallanInfo
										label="Dispatched At"
										value={formatLocalDateTimeDisplay(
											normalChallanView.dispatchedAt
										)}
									/>
									<NormalChallanInfo
										label="Trip Started"
										value={formatLocalDateTimeDisplay(
											normalChallanView.tripStartedAt
										)}
									/>
									<NormalChallanInfo
										label="Trip Ended"
										value={formatLocalDateTimeDisplay(
											normalChallanView.tripEndedAt
										)}
									/>
									<NormalChallanInfo
										label="Challan No."
										value={getChallanNumber(normalChallanView) || "—"}
									/>
									<NormalChallanInfo
										label="Trip Status"
										value={normalChallanView.tripStatus || "—"}
									/>
								</Box>

								<Box sx={normalChallanInspectorGridSx}>
									<Box sx={normalChallanItemsPanelSx}>
										<Box sx={normalChallanItemsToolbarSx}>
											<Box>
												<Box
													sx={{
														color: "#fff",
														fontSize: 12.5,
														fontWeight: 950,
													}}
												>
													Challan Item Rows
												</Box>
												<Box
													sx={{
														mt: 0.25,
														color: "var(--pf-text-dim)",
														fontSize: 9.5,
														fontWeight: 750,
													}}
												>
													Search exact item, SKU, sticker, packet, PD, drawing, client, plant or location
												</Box>
											</Box>

											<TextField
												size="small"
												placeholder="Search item rows…"
												value={normalChallanItemSearch}
												onChange={(event) => {
													setNormalChallanItemSearch(event.target.value);
													setNormalChallanItemPageNo(1);
												}}
												InputProps={{
													startAdornment: (
														<SearchIcon
															sx={{ color: "#60a5fa", mr: 0.8 }}
														/>
													),
												}}
												sx={{
													...customChallanSearchFieldSx,
													width: "min(360px,100%)",
												}}
											/>
										</Box>

										<Box sx={normalChallanItemListSx}>
											{paginatedNormalChallanItems.length === 0 && (
												<Box sx={modalEmptyStateSx}>
													No challan item rows match this search.
												</Box>
											)}

											{paginatedNormalChallanItems.map((item, index) => {
												const itemId = String(item?.zohoItemId || "");
												const selected =
													itemId === String(normalChallanSelectedItemId || "") ||
													(!normalChallanSelectedItemId && index === 0);

												return (
													<Box
														key={itemId || `${item?.sku || "item"}-${index}`}
														sx={normalChallanItemRowSx(selected)}
														onClick={() => setNormalChallanSelectedItemId(itemId)}
													>
														<Box sx={normalChallanItemIndexSx}>
															{(normalChallanItemPageNo - 1) * normalChallanItemPageSize + index + 1}
														</Box>

														<Box sx={{ minWidth: 0 }}>
															<Box sx={normalChallanItemPrimarySx}>
																{item?.name || item?.itemName || "Unnamed Item"}
															</Box>
															<Box sx={normalChallanItemSecondarySx}>
																SKU: {item?.sku || "—"} • Sticker: {item?.stickerNumber || "—"}
															</Box>
														</Box>

														<Box sx={{ minWidth: 0 }}>
															<Box sx={normalChallanItemPrimarySx}>{item?.pdNo || "—"}</Box>
															<Box sx={normalChallanItemSecondarySx}>PD No.</Box>
														</Box>

														<Box sx={{ minWidth: 0 }}>
															<Box sx={normalChallanItemPrimarySx}>{item?.drawingNo || "—"}</Box>
															<Box sx={normalChallanItemSecondarySx}>Drawing</Box>
														</Box>

														<Box sx={{ minWidth: 0 }}>
															<Box sx={normalChallanItemPrimarySx}>{item?.plantCode || "—"}</Box>
															<Box sx={normalChallanItemSecondarySx}>{item?.status || "—"}</Box>
														</Box>

														<Button
															size="small"
															onClick={(event) => {
																event.stopPropagation();
																setNormalChallanSelectedItemId(itemId);
															}}
															sx={normalChallanViewButtonSx}
														>
															View Item
														</Button>
													</Box>
												);
											})}
										</Box>

										<Box
											sx={{
												p: 1,
												borderTop: "1px solid rgba(var(--pf-fg-rgb),.06)",
												background: "rgba(var(--pf-fg-rgb),.02)",
											}}
										>
											<ChallanHistoryPager
												pageNo={normalChallanItemPageNo}
												totalPages={normalChallanItemTotalPages}
												pageSize={normalChallanItemPageSize}
												totalRows={normalChallanFilteredItems.length}
												label="items"
												pageSizeOptions={[5, 10, 20, 50]}
												onPageChange={setNormalChallanItemPageNo}
												onPageSizeChange={setNormalChallanItemPageSize}
											/>
										</Box>
									</Box>

									<Box sx={normalChallanDetailPanelSx}>
										<Box
											sx={{
												p: 1.3,
												borderBottom: "1px solid rgba(var(--pf-fg-rgb),.06)",
												background: "rgba(16,185,129,.045)",
											}}
										>
											<Box sx={{ color: "var(--pf-text-strong)", fontSize: 12.5, fontWeight: 950 }}>
												Selected Item / Row
											</Box>
											<Box sx={{ mt: 0.25, color: "var(--pf-text-dim)", fontSize: 9.5, fontWeight: 750 }}>
												Pinpoint record-level information available in the current dispatch register
											</Box>
										</Box>

										<Box sx={normalChallanDetailScrollSx}>
											{!selectedNormalChallanItem ? (
												<Box sx={modalEmptyStateSx}>Select an item row to inspect it.</Box>
											) : (
												<>
													<Box sx={normalChallanDetailSectionSx}>
														<Box sx={normalChallanDetailSectionTitleSx}>Identity</Box>
														<Box sx={normalChallanDetailFieldGridSx}>
															<NormalChallanDetailField label="Item" value={selectedNormalChallanItem.name || selectedNormalChallanItem.itemName} />
															<NormalChallanDetailField label="Zoho Item ID" value={selectedNormalChallanItem.zohoItemId} />
															<NormalChallanDetailField label="SKU / Code" value={selectedNormalChallanItem.sku} />
															<NormalChallanDetailField label="Sticker No." value={selectedNormalChallanItem.stickerNumber} />
															<NormalChallanDetailField label="Packet No." value={selectedNormalChallanItem.packetNo || selectedNormalChallanItem.packetNumber} />
															<NormalChallanDetailField label="Item Area" value={selectedNormalChallanItem.itemArea || selectedNormalChallanItem.area} />
															<NormalChallanDetailField label="PD No." value={selectedNormalChallanItem.pdNo} />
															<NormalChallanDetailField label="Drawing No." value={selectedNormalChallanItem.drawingNo} />
														</Box>
													</Box>

													<Box sx={normalChallanDetailSectionSx}>
														<Box sx={normalChallanDetailSectionTitleSx}>Client & Material</Box>
														<Box sx={normalChallanDetailFieldGridSx}>
															<NormalChallanDetailField label="Client" value={selectedNormalChallanItem.clientName} />
															<NormalChallanDetailField label="Quantity" value={selectedNormalChallanItem.quantity} />
															<NormalChallanDetailField label="Description" value={selectedNormalChallanItem.description} full />
															<NormalChallanDetailField label="Address" value={selectedNormalChallanItem.clientAddress} full />
															<NormalChallanDetailField label="Remarks" value={selectedNormalChallanItem.remarks} full />
														</Box>
													</Box>

													<Box sx={normalChallanDetailSectionSx}>
														<Box sx={normalChallanDetailSectionTitleSx}>Location & Status</Box>
														<Box sx={normalChallanDetailFieldGridSx}>
															<NormalChallanDetailField label="Plant" value={selectedNormalChallanItem.plantCode} />
															<NormalChallanDetailField label="Status" value={selectedNormalChallanItem.status} />
															<NormalChallanDetailField label="Current Location" value={selectedNormalChallanItem.currentLocationCode || selectedNormalChallanItem.location} />
															<NormalChallanDetailField label="FG Area / Zone" value={selectedNormalChallanItem.fgAreaCode || selectedNormalChallanItem.fgZoneCode} />
															<NormalChallanDetailField label="Warehouse" value={selectedNormalChallanItem.warehouseCode} />
															<NormalChallanDetailField label="Challan" value={getChallanNumber(normalChallanView)} />
														</Box>
													</Box>

													<Box sx={normalChallanDetailSectionSx}>
														<Box sx={normalChallanDetailSectionTitleSx}>Responsibility & Time</Box>
														<Box sx={normalChallanDetailFieldGridSx}>
															<NormalChallanDetailField label="Packed By" value={selectedNormalChallanItem.packedBy || selectedNormalChallanItem.generatedBy} />
															<NormalChallanDetailField label="Packed At" value={formatLocalDateTimeDisplay(selectedNormalChallanItem.packedAt || selectedNormalChallanItem.packingDate || selectedNormalChallanItem.createdAt)} />
															<NormalChallanDetailField label="Dispatched By" value={selectedNormalChallanItem.dispatchedBy || normalChallanView.dispatchedBy} />
															<NormalChallanDetailField label="Dispatched At" value={formatLocalDateTimeDisplay(selectedNormalChallanItem.dispatchedAt || normalChallanView.dispatchedAt)} />
															<NormalChallanDetailField label="Created By" value={selectedNormalChallanItem.createdBy} />
															<NormalChallanDetailField label="Created At" value={formatLocalDateTimeDisplay(selectedNormalChallanItem.createdAt)} />
														</Box>
													</Box>
												</>
											)}
										</Box>
									</Box>
								</Box>
							</Box>

							<Box
								sx={{
									...modalFooterSx,
									flexShrink: 0,
									alignItems: "center",
									background: "rgba(var(--pf-surface-deep-rgb),.96)",
								}}
							>
								<Box
									sx={{
										mr: "auto",
										color: "var(--pf-text-dim)",
										fontSize: 10,
										fontWeight: 800,
									}}
								>
									Showing {normalChallanFilteredItems.length} of {normalChallanViewItems.length} item rows
								</Box>
								<Button
									onClick={() =>
										previewExistingChallanPdf(
											getChallanNumber(normalChallanView)
										)
									}
									sx={normalChallanViewButtonSx}
								>
									Preview Challan PDF
								</Button>
								<Button
									onClick={() =>
										downloadExistingChallanPdf(
											getChallanNumber(normalChallanView)
										)
									}
									sx={modalSecondaryButtonSx}
								>
									Download PDF
								</Button>
								<Button onClick={closeNormalChallanView} sx={modalSecondaryButtonSx}>
									Close
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
										value={
											challanHistoryServerTotal > challanHistoryRows.length
												? `${challanHistoryRows.length}/${challanHistoryServerTotal}`
												: challanHistoryRows.length
										}
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

								<Box sx={normalChallanAnalyticsPanelSx}>
									<Box sx={normalChallanAnalyticsTitleSx}>
										Normal Dispatch Intelligence
									</Box>

									<Box sx={normalChallanAnalyticsGridSx}>
										<NormalChallanMetric
											label="Challans"
											value={normalChallanAnalytics.challans}
											meta="Normal dispatch documents"
											accent="#60a5fa"
										/>
										<NormalChallanMetric
											label="Items"
											value={normalChallanAnalytics.items}
											meta="Rows across challans"
											accent="#22c55e"
										/>
										<NormalChallanMetric
											label="Today"
											value={normalChallanAnalytics.today}
											meta="Generated today"
											accent="#38bdf8"
										/>
										<NormalChallanMetric
											label="Running Trips"
											value={normalChallanAnalytics.running}
											meta="Trip not ended"
											accent="#f59e0b"
										/>
										<NormalChallanMetric
											label="Ended Trips"
											value={normalChallanAnalytics.ended}
											meta="Trip closure recorded"
											accent="#10b981"
										/>
										<NormalChallanMetric
											label="Avg Items"
											value={normalChallanAnalytics.averageItems}
											meta="Per challan"
											accent="#818cf8"
										/>
										<NormalChallanMetric
											label="Clients"
											value={normalChallanAnalytics.uniqueClients}
											meta="Unique client names"
											accent="#a78bfa"
										/>
										<NormalChallanMetric
											label="Vehicles"
											value={normalChallanAnalytics.uniqueVehicles}
											meta={`${normalChallanAnalytics.helperTotal} helper/loaders logged`}
											accent="#f97316"
										/>
									</Box>
								</Box>

								{loading && (
									<Box
										sx={{
											color: "#fcd34d",
											fontSize: 12,
											fontWeight: 800,
										}}
									>
										Refreshing the current Dispatch page…
									</Box>
								)}

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

																<Box sx={challanHistoryMetaSx}>
																	Helpers / Loaders: {challan.helperLoaderCount ?? "—"} • Trip: {formatTripDurationMinutes(challan.tripDurationMinutes)}
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

																<Button
																	size="small"
																	onClick={() => openNormalChallanView(challan)}
																	sx={normalChallanViewButtonSx}
																>
																	View Details
																</Button>
															</Box>
														</Box>
													))}
												</Box>
											</Box>
										))}

										{challanHistoryHasMore && (
											<Box
												sx={{
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													gap: 1.2,
													py: 1.5,
												}}
											>
												<Button
													onClick={loadOlderChallanHistory}
													disabled={challanHistoryLoadingMore}
													sx={modalSecondaryButtonSx}
												>
													{challanHistoryLoadingMore
														? "Loading older challans…"
														: `Load older challans (${challanHistoryRows.length}/${challanHistoryServerTotal})`}
												</Button>
											</Box>
										)}

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
																getCustomChallanTypeLabel(challan.challanType)}{" "}
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
														{isSiteReturnChallanType(challan.challanType) && (
															<Box sx={challanHistoryMetaSx}>
																Handed Over To: {challan.handedOverTo || "—"}
															</Box>
														)}
														<Box sx={challanHistoryMetaSx}>
															By: {challan.generatedBy || "—"} •{" "}
															{formatLocalDateTimeDisplay(challan.generatedAt)}
														</Box>
													</Box>

													<Box sx={challanHistoryActionsSx}>
														{isAdmin && (
															<Button
																size="small"
																disabled={customChallanDetailLoading}
																onClick={() =>
																	openEditCustomChallanModal(challan)
																}
																sx={customChallanEditButtonSx}
															>
																Edit Details
															</Button>
														)}

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
												color: "rgba(var(--pf-fg-rgb),.55)",
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
													<Box sx={historyActionBtnsSx}>
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

														<Button
															size="small"
															onClick={() =>
																downloadNormalChallanByNumber(
																	doc.challanNumber
																)
															}
															sx={modalSecondaryButtonSx}
														>
															Download
														</Button>

														<Button
															size="small"
															disabled={normalChallanViewLoading}
															onClick={() =>
																openNormalChallanViewByNumber(
																	doc.challanNumber
																)
															}
															sx={normalChallanViewButtonSx}
														>
															Details
														</Button>
													</Box>
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
				<Drawer
					anchor="right"
					open={Boolean(dispatchItemDrawerRow)}
					onClose={() => setDispatchItemDrawerRow(null)}
					PaperProps={{
						sx: dispatchItemDrawerPaperSx,
					}}
					ModalProps={{
						keepMounted: true,
					}}
				>
					{dispatchItemDrawerRow && (
						<>
							<Box sx={dispatchItemDrawerHeaderSx}>
								<Box sx={{ minWidth: 0, flex: 1 }}>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 0.8,
											flexWrap: "wrap",
										}}
									>
										<Box
											component="span"
											sx={{
												color: "#93c5fd",
												fontSize: 10,
												fontWeight: 950,
												letterSpacing: ".11em",
												textTransform: "uppercase",
											}}
										>
											Dispatch Item Details
										</Box>

										{isHardwareDispatchRow(
											dispatchItemDrawerRow
										) && (
												<Chip
													size="small"
													label="🔩 HARDWARE"
													sx={{
														height: 21,
														color: "#ddd6fe",
														fontSize: 9,
														fontWeight: 950,
														background: "rgba(139,92,246,.18)",
														border: "1px solid rgba(167,139,250,.28)",
													}}
												/>
											)}
									</Box>

									<Box
										sx={{
											mt: 0.55,
											color: "#fff",
											fontSize: 20,
											fontWeight: 950,
											lineHeight: 1.15,
											wordBreak: "break-word",
										}}
									>
										{dispatchItemDrawerRow?.name ||
											dispatchItemDrawerRow?.itemName ||
											"Dispatch Item"}
									</Box>

									<Box
										sx={{
											mt: 0.65,
											display: "flex",
											alignItems: "center",
											gap: 0.8,
											flexWrap: "wrap",
										}}
									>
										<Chip
											size="small"
											label={
												getDisplayStatus(
													dispatchItemDrawerRow
												)?.label || "—"
											}
											sx={
												getDisplayStatus(
													dispatchItemDrawerRow
												)?.sx || pendingStatusChip
											}
										/>

										<Box
											component="span"
											sx={{
												color: "var(--pf-text-muted)",
												fontSize: 11,
												fontWeight: 800,
											}}
										>
											{getDispatchDrawerPacketNumber(
												dispatchItemDrawerRow
											)}
											{" • "}
											{dispatchItemDrawerRow?.pdNo || "PD —"}
										</Box>
									</Box>
								</Box>

								<IconButton
									aria-label="Close item details"
									onClick={() => setDispatchItemDrawerRow(null)}
									sx={modalCloseButtonSx}
								>
									<Box
										component="span"
										sx={{ fontSize: 22, lineHeight: 1 }}
									>
										×
									</Box>
								</IconButton>
							</Box>

							<Box sx={dispatchItemDrawerBodySx}>
								<Box sx={dispatchItemDrawerHeroSx}>
									<Box sx={dispatchItemDrawerSectionTitleSx}>
										Quick History
									</Box>

									<Box
										sx={{
											display: "flex",
											gap: 0.8,
											flexWrap: "wrap",
										}}
									>
										<Button
											onClick={() =>
												openStickerHistory(
													dispatchItemDrawerRow
												)
											}
											sx={dispatchDrawerQuickActionSx}
										>
											Sticker History
										</Button>

										<Button
											disabled={!dispatchItemDrawerRow?.zohoItemId}
											onClick={() => {
												if (dispatchItemDrawerRow?.zohoItemId) {
													openAuditLogs(
														dispatchItemDrawerRow.zohoItemId
													);
												}
											}}
											sx={dispatchDrawerQuickActionSx}
										>
											Activity Logs
										</Button>
									</Box>
								</Box>

								{buildDispatchItemDrawerSections(
									dispatchItemDrawerRow
								).map((section) => (
									<Box
										key={section.title}
										sx={dispatchItemDrawerSectionSx}
									>
										<Box sx={dispatchItemDrawerSectionTitleSx}>
											{section.title}
										</Box>

										<Box sx={dispatchItemDrawerGridSx}>
											{section.fields.map((field) => (
												<Box
													key={field.label}
													sx={{
														...dispatchItemDrawerFieldSx,
														gridColumn: field.full
															? "1 / -1"
															: "auto",
													}}
												>
													<Box sx={dispatchItemDrawerFieldLabelSx}>
														{field.label}
													</Box>
													<Box
														sx={dispatchItemDrawerFieldValueSx}
														title={String(field.value || "")}
													>
														{field.value || "—"}
													</Box>
												</Box>
											))}
										</Box>
									</Box>
								))}

								<Box sx={dispatchItemDrawerSectionSx}>
									<Box sx={dispatchItemDrawerSectionTitleSx}>
										Available Actions
									</Box>

									<Box sx={dispatchItemDrawerActionPanelSx}>
										{columns[11].renderCell({
											row: dispatchItemDrawerRow,
										})}
									</Box>
								</Box>
							</Box>
						</>
					)}
				</Drawer>

				<Suspense fallback={null}>
					<MasterItemsModal
						open={masterItemsModalOpen}
						onClose={() =>
							setMasterItemsModalOpen(
								false
							)
						}
					/>
				</Suspense>
			</div>
		</div>
	);
}


function NormalChallanMetric({
	label,
	value,
	meta,
	accent,
}) {
	return (
		<Box sx={normalChallanMetricCardSx(accent)}>
			<Box sx={normalChallanMetricLabelSx}>{label}</Box>
			<Box sx={normalChallanMetricValueSx}>{value ?? "—"}</Box>
			<Box sx={normalChallanMetricMetaSx}>{meta || "—"}</Box>
		</Box>
	);
}

function NormalChallanInfo({ label, value }) {
	return (
		<Box sx={normalChallanInfoCardSx}>
			<Box sx={normalChallanInfoLabelSx}>{label}</Box>
			<Box sx={normalChallanInfoValueSx}>{value ?? "—"}</Box>
		</Box>
	);
}

function NormalChallanDetailField({
	label,
	value,
	full = false,
}) {
	const cleanValue =
		value === null ||
			value === undefined ||
			String(value).trim() === ""
			? "—"
			: String(value);

	return (
		<Box
			sx={{
				...normalChallanDetailFieldSx,
				gridColumn: full ? "1 / -1" : "auto",
			}}
		>
			<Box sx={normalChallanDetailFieldLabelSx}>{label}</Box>
			<Box sx={normalChallanDetailFieldValueSx}>{cleanValue}</Box>
		</Box>
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

function DispatchReviewValue({
	label,
	value,
	compact = false,
}) {
	const displayValue =
		value === null ||
			value === undefined ||
			String(value).trim() === ""
			? "—"
			: String(value);

	return (
		<Box
			sx={{
				minWidth: 0,
				p: compact
					? 1
					: 1.2,
				borderRadius:
					compact
						? "10px"
						: "12px",
				background:
					"rgba(var(--pf-surface-deep-rgb),.26)",
				border:
					"1px solid rgba(var(--pf-fg-rgb),.06)",
			}}
		>
			<Box
				sx={{
					color: "var(--pf-text-dim)",
					fontSize:
						compact
							? 9
							: 10,
					fontWeight: 900,
					letterSpacing:
						".08em",
					textTransform:
						"uppercase",
					mb: 0.45,
				}}
			>
				{label}
			</Box>

			<Box
				sx={{
					color: "var(--pf-text-strong)",
					fontSize:
						compact
							? 11
							: 12,
					fontWeight: 850,
					whiteSpace:
						"nowrap",
					overflow:
						"hidden",
					textOverflow:
						"ellipsis",
				}}
				title={displayValue}
			>
				{displayValue}
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
