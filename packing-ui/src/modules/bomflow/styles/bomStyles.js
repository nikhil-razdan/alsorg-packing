/* =====================================================
   BOMFLOW MODULE - SINGLE SOURCE OF TRUTH
   IMPORTANT:
===================================================== */

/* =====================================================
   MODULE PAGE LAYOUT
===================================================== */

export const BOM_modulePageSx = {
	minHeight: "100vh",
	position: "relative",
	overflowX: "hidden",
	overflowY: "auto",
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 22%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.12), transparent 24%),
		linear-gradient(135deg,#020617 0%,#0f172a 45%,#111827 100%)
	`,
	backgroundAttachment: "fixed",
	color: "#fff",
};

export const BOM_moduleContentSx = {
	position: "relative",
	zIndex: 1,
	padding: 24,
	display: "flex",
	flexDirection: "column",
	gap: 20,
};

export const BOM_moduleHeaderRowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 2,
	flexWrap: "wrap",
	mb: 1,
};

export const BOM_moduleLogoRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
};

export const BOM_moduleLogoMarkSx = {
	width: 46,
	height: 46,
	borderRadius: "16px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 18,
	boxShadow: "0 12px 28px rgba(37,99,235,.35)",
};

export const BOM_moduleLogoSx = {
	color: "#fff",
	fontSize: 32,
	fontWeight: 950,
	lineHeight: 1,
	letterSpacing: "-0.04em",
};

export const BOM_moduleSubtitleSx = {
	color: "rgba(255,255,255,0.65)",
	fontSize: 14,
	fontWeight: 650,
	mt: 0.8,
	lineHeight: 1.45,
};

export const BOM_moduleHeaderActionsSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	flexWrap: "wrap",
};

export const BOM_activePageChipSx = {
	height: 36,
	borderRadius: "999px",
	background: "rgba(59,130,246,.14)",
	color: "#93c5fd",
	border: "1px solid rgba(59,130,246,.28)",
	fontWeight: 900,
	letterSpacing: ".04em",
};

export const BOM_primaryActionBtnSx = {
	height: 44,
	px: 2.2,
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 12px 28px rgba(37,99,235,.35)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

export const BOM_secondaryActionBtnSx = {
	height: 44,
	px: 2.2,
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.28)",
	},
};

export const BOM_tabsRowSx = {
	display: "flex",
	gap: 12,
	flexWrap: "wrap",
	mt: 1,
	mb: 1,
};

export const BOM_tabButtonStyle = {
	height: 48,
	borderRadius: 14,
	border: "1px solid rgba(255,255,255,0.06)",
	color: "#fff",
	cursor: "pointer",
	paddingLeft: 18,
	paddingRight: 18,
	fontWeight: 750,
	fontSize: 14,
	transition: "all 0.25s ease",
	background: "rgba(255,255,255,0.04)",
};

export const BOM_tabButtonActiveStyle = {
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	border: "1px solid rgba(59,130,246,0.4)",
	boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
};

export const BOM_viewShellSx = {
	width: "100%",
};

/* =====================================================
   COMMON PAGE HEADERS
===================================================== */

export const BOM_pageHeadSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	mb: 3,
	flexWrap: "wrap",
};

export const BOM_pageTopSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	mb: 3,
	flexWrap: "wrap",
};

export const BOM_pageHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: 2,
	mb: 3,
	flexWrap: "wrap",
};

export const BOM_labelChipSx = {
	height: 30,
	borderRadius: 999,
	background: "rgba(59,130,246,.14)",
	color: "#60a5fa",
	border: "1px solid rgba(59,130,246,.24)",
	fontWeight: 850,
	letterSpacing: ".06em",
};

export const BOM_pageTitleSx = {
	color: "#fff",
	fontSize: 30,
	fontWeight: 900,
	lineHeight: 1.1,
	letterSpacing: "-0.03em",
};

export const BOM_pageSubSx = {
	mt: 0.7,
	color: "rgba(255,255,255,.72)",
	fontSize: 14,
	fontWeight: 600,
	lineHeight: 1.6,
};

/* =====================================================
   COMMON GLASS SURFACES
===================================================== */

export const BOM_panelSx = {
	p: 2.7,
	borderRadius: 24,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.70))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 40px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
	width: "100%",
	boxSizing: "border-box",
};

export const BOM_sidePanelSx = {
	p: 2.5,
	borderRadius: 24,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.70))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 40px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	overflow: "hidden",
	width: "100%",
	boxSizing: "border-box",
};

export const BOM_moduleCardSx = {
	p: 3,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.70))",
	border: "1px solid rgba(255,255,255,.07)",
	borderRadius: 24,
	height: "100%",
	display: "flex",
	flexDirection: "column",
	boxShadow: "0 18px 40px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	transition: "all .25s ease",

	"&:hover": {
		transform: "translateY(-3px)",
		borderColor: "rgba(59,130,246,.35)",
		boxShadow: "0 24px 60px rgba(2,6,23,.42)",
	},
};

/* =====================================================
   DASHBOARD CARDS
===================================================== */

export const BOM_activeCostingsCardSx = {
	minWidth: 180,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.92), rgba(17,24,39,.88))",
	border: "1px solid rgba(255,255,255,.08)",
	borderRadius: "18px",
	p: 2,
	boxShadow: "0 18px 45px rgba(0,0,0,.28)",
};

export const BOM_costLabelSx = {
	color: "#94a3b8",
	fontSize: 11,
	fontWeight: 800,
	letterSpacing: ".05em",
};

export const BOM_activeCostingsValueSx = {
	color: "#22c55e",
	fontSize: 28,
	fontWeight: 900,
	fontFamily: "monospace",
};

export const BOM_cardTopSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	mb: 2,
};

export const BOM_iconSx = {
	width: 52,
	height: 52,
	borderRadius: "18px",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	background: "rgba(59,130,246,.13)",
	border: "1px solid rgba(59,130,246,.20)",
};

export const BOM_miniChipSx = {
	color: "#93c5fd",
	background: "rgba(59,130,246,.12)",
	border: "1px solid rgba(59,130,246,.20)",
	fontWeight: 800,
};

export const BOM_cardTitleSx = {
	color: "#fff",
	fontSize: 20,
	fontWeight: 900,
	mb: 1,
};

export const BOM_cardSubSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: 14,
	lineHeight: 1.6,
	mb: 3,
	flex: 1,
};

export const BOM_openBtnSx = {
	height: 42,
	borderRadius: "14px",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	fontWeight: 800,
	textTransform: "none",
	boxShadow: "0 10px 25px rgba(37,99,235,.28)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

/* =====================================================
   PRODUCT MASTER PAGE
===================================================== */

export const BOM_productPageSx = {
	width: "100%",
	maxWidth: "100%",
};

export const BOM_productMasterGridSx = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.65fr) minmax(340px, .75fr)",
	gap: 20,
	alignItems: "start",
	width: "100%",

	"@media (max-width: 1180px)": {
		gridTemplateColumns: "1fr",
	},
};

export const BOM_productMainColumnSx = {
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: 18,
};

export const BOM_productSideColumnSx = {
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: 18,
};

export const BOM_twoColumnFieldGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	gap: 16,

	"@media (max-width: 760px)": {
		gridTemplateColumns: "1fr",
	},
};

export const BOM_threeColumnFieldGridSx = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: 16,

	"@media (max-width: 900px)": {
		gridTemplateColumns: "1fr",
	},
};

export const BOM_statusWrapSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	mt: 0.4,
};

export const BOM_statusTextSx = {
	color: "rgba(255,255,255,.72)",
	fontSize: 13,
	fontWeight: 800,
};

export const BOM_draftChipSx = {
	height: 28,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.10)",
	fontWeight: 800,

	"& .MuiChip-label": {
		px: 1.25,
	},
};

export const BOM_sectionHeadSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	pb: 1.8,
	mb: 2.2,
	borderBottom: "1px solid rgba(255,255,255,.08)",
};

export const BOM_sectionTitleSx = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 20,
	lineHeight: 1.2,
	letterSpacing: "-0.02em",
};

export const BOM_fieldSx = {
	mb: 0,

	"& .MuiInputLabel-root": {
		color: "rgba(255,255,255,.58)",
		fontSize: "13px",
		fontWeight: 700,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: 54,
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "16px",
		fontSize: "14px",
		fontWeight: 700,
		transition: "all .22s ease",

		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},

		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#3b82f6",
			boxShadow: "0 0 0 3px rgba(59,130,246,.12)",
		},
	},

	"& .MuiInputBase-input": {
		color: "#fff",
		fontWeight: 650,
	},

	"& .MuiInputBase-input::placeholder": {
		color: "rgba(255,255,255,.34)",
		opacity: 1,
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

export const BOM_noteSx = {
	mt: 2,
	p: 2,
	background: "rgba(2,6,23,.45)",
	borderRadius: "18px",
	display: "flex",
	gap: 1,
	alignItems: "flex-start",
	border: "1px solid rgba(255,255,255,.06)",
};

export const BOM_noteTextSx = {
	color: "rgba(255,255,255,.68)",
	fontSize: 13,
	lineHeight: 1.55,
	fontWeight: 650,
};

export const BOM_sideTitleRowSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 1.5,
	mb: 2,
};

export const BOM_sideTitleSx = {
	color: "#fff",
	fontSize: 20,
	fontWeight: 900,
	lineHeight: 1.2,
	letterSpacing: "-0.02em",
};

export const BOM_uploadBoxSx = {
	minHeight: 190,
	border: "1.5px dashed rgba(255,255,255,.12)",
	background: "rgba(2,6,23,.42)",
	borderRadius: "20px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: 2.5,
	transition: "all .25s ease",

	"&:hover": {
		borderColor: "rgba(59,130,246,.50)",
		background: "rgba(59,130,246,.08)",
	},
};

export const BOM_uploadIconSx = {
	width: 48,
	height: 48,
	borderRadius: "16px",
	background: "rgba(255,255,255,.06)",
	display: "grid",
	placeItems: "center",
	color: "#93c5fd",
	mb: 1.4,
};

export const BOM_uploadTitleSx = {
	color: "#fff",
	fontWeight: 900,
	fontSize: 13,
	lineHeight: 1.35,
};

export const BOM_uploadSubSx = {
	color: "#94a3b8",
	fontSize: 11,
	fontWeight: 700,
	mt: 0.5,
};

export const BOM_smallDarkChipSx = {
	height: 22,
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.08)",
	borderRadius: "999px",
	fontWeight: 800,
	fontSize: 10,

	"& .MuiChip-label": {
		px: 1,
	},
};

export const BOM_drawingBoxSx = {
	minHeight: 140,
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(2,6,23,.42)",
	borderRadius: "20px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: 2,
	mb: 1.5,
};

export const BOM_browseBtnSx = {
	mt: 1.2,
	height: 32,
	borderRadius: "999px",
	color: "#93c5fd",
	border: "1px solid rgba(59,130,246,.32)",
	background: "rgba(59,130,246,.10)",
	textTransform: "none",
	fontSize: 12,
	fontWeight: 900,
	px: 2,

	"&:hover": {
		background: "rgba(59,130,246,.18)",
		borderColor: "rgba(59,130,246,.55)",
	},
};

export const BOM_noFileSx = {
	color: "#94a3b8",
	fontStyle: "italic",
	fontSize: 12,
	fontWeight: 650,
};

export const BOM_versionRowSx = {
	background: "rgba(2,6,23,.38)",
	border: "1px solid rgba(255,255,255,.06)",
	p: 1.6,
	borderRadius: "16px",
	mb: 1,
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 1.5,
};

export const BOM_versionTitleSx = {
	color: "#fff",
	fontWeight: 850,
	fontSize: 13,
	mb: 0.5,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

export const BOM_versionDateSx = {
	color: "#94a3b8",
	fontSize: 11,
	fontWeight: 700,
};

export const BOM_approvedSx = {
	height: 20,
	borderRadius: "999px",
	background: "rgba(34,197,94,.12)",
	color: "#4ade80",
	border: "1px solid rgba(34,197,94,.20)",
	fontSize: 10,
	fontWeight: 850,
};

export const BOM_rejectedSx = {
	height: 20,
	borderRadius: "999px",
	background: "rgba(239,68,68,.12)",
	color: "#f87171",
	border: "1px solid rgba(239,68,68,.20)",
	fontSize: 10,
	fontWeight: 850,
};

export const BOM_draftMiniSx = {
	height: 20,
	borderRadius: "999px",
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.08)",
	fontSize: 10,
	fontWeight: 850,
};

export const BOM_newVersionBtnSx = {
	height: 40,
	borderRadius: "14px",
	border: "1px dashed rgba(255,255,255,.14)",
	color: "#93c5fd",
	background: "rgba(255,255,255,.03)",
	textTransform: "none",
	fontSize: 13,
	fontWeight: 850,

	"&:hover": {
		background: "rgba(59,130,246,.10)",
		borderColor: "rgba(59,130,246,.35)",
	},
};

/* =====================================================
   BOM BUILDER
===================================================== */

export const BOM_statusLineSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	mb: 0.8,
};

export const BOM_projectChipSx = {
	height: 24,
	borderRadius: "999px",
	background: "rgba(255,255,255,.06)",
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.08)",
	fontSize: 10,
	fontWeight: 800,
};

export const BOM_draftProjectChipSx = {
	height: 24,
	borderRadius: "999px",
	background: "rgba(59,130,246,.14)",
	color: "#93c5fd",
	border: "1px solid rgba(59,130,246,.24)",
	fontSize: 10,
	fontWeight: 800,
};

export const BOM_costCardSx = {
	background:
		"linear-gradient(180deg, rgba(15,23,42,.88), rgba(17,24,39,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	borderRadius: "20px",
	p: 2,
	minWidth: 170,
	boxShadow: "0 18px 45px rgba(0,0,0,.28)",
};

export const BOM_costValueSx = {
	color: "#22c55e",
	fontSize: 24,
	fontWeight: 900,
	fontFamily: "monospace",
	mt: 0.6,
};

export const BOM_sectionCardSx = {
	background:
		"linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.70))",
	border: "1px solid rgba(255,255,255,.07)",
	borderRadius: 24,
	overflow: "hidden",
	mb: 2,
	borderLeft: "4px solid #2563eb",
	boxShadow: "0 18px 40px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
};

export const BOM_collapsedSectionSx = {
	minHeight: 62,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.82), rgba(15,23,42,.70))",
	border: "1px solid rgba(255,255,255,.07)",
	borderRadius: 24,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	borderLeft: "4px solid #8b5cf6",
	boxShadow: "0 18px 40px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
};

export const BOM_sectionHeaderSx = {
	height: 62,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	background: "rgba(2,6,23,.22)",
	borderBottom: "1px solid rgba(255,255,255,.08)",
};

export const BOM_sectionLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

export const BOM_sectionRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 2,
};

export const BOM_sectionIconBtnSx = {
	color: "#94a3b8",

	"&:hover": {
		background: "rgba(255,255,255,.06)",
		color: "#fff",
	},
};

export const BOM_countChipSx = {
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	height: 22,
	borderRadius: "999px",
	fontWeight: 800,
};

export const BOM_sectionTotalLabelSx = {
	color: "#94a3b8",
	fontSize: 10,
	textTransform: "uppercase",
	textAlign: "right",
	fontWeight: 800,
};

export const BOM_sectionTotalValueSx = {
	color: "#fff",
	fontWeight: 900,
	fontFamily: "monospace",
	fontSize: 15,
};

export const BOM_tableSx = {
	background: "rgba(2,6,23,.20)",
	overflowX: "auto",
};

export const BOM_tableHeadSx = {
	display: "grid",
	gridTemplateColumns:
		"44px minmax(220px,2fr) minmax(130px,1.1fr) minmax(150px,1.1fr) 80px 80px 120px 120px 70px",
	color: "#94a3b8",
	fontSize: 11,
	fontWeight: 850,
	borderBottom: "1px solid rgba(255,255,255,.08)",
	background: "rgba(2,6,23,.26)",
	minWidth: 1080,

	"& > div": {
		padding: "13px 10px",
	},
};

export const BOM_tableRowSx = {
	display: "grid",
	gridTemplateColumns:
		"44px minmax(220px,2fr) minmax(130px,1.1fr) minmax(150px,1.1fr) 80px 80px 120px 120px 70px",
	alignItems: "center",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	minHeight: 48,
	background: "rgba(255,255,255,.025)",
	minWidth: 1080,

	"& > p, & > div": {
		padding: "5px 10px",
	},
};

export const BOM_missingRowSx = {
	...BOM_tableRowSx,
	background: "rgba(239,68,68,.08)",
	borderBottom: "1px solid rgba(239,68,68,.16)",
};

export const BOM_deleteCellSx = {
	color: "#94a3b8",
	display: "grid",
	placeItems: "center",
	cursor: "pointer",

	"&:hover": {
		color: "#ef4444",
	},
};

export const BOM_itemNameCellSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.5,
	minWidth: 0,
};

export const BOM_itemNameSx = {
	color: "#fff",
	fontWeight: 750,
	fontSize: 14,
};

export const BOM_missingItemSx = {
	color: "#fca5a5",
	fontWeight: 750,
	fontSize: 14,
};

export const BOM_cellTextSx = {
	color: "#cbd5e1",
	fontSize: 13,
};

export const BOM_cellStrongSx = {
	color: "#fff",
	fontWeight: 750,
	fontSize: 13,
};

export const BOM_numberCellSx = {
	color: "#fff",
	fontFamily: "monospace",
	fontSize: 13,
};

export const BOM_rateCellSx = {
	color: "#fff",
	fontFamily: "monospace",
	fontSize: 13,
};

export const BOM_missingRateSx = {
	background: "rgba(239,68,68,.14)",
	color: "#f87171",
	border: "1px solid rgba(239,68,68,.24)",
	borderRadius: "10px",
	textAlign: "center",
	fontWeight: 850,
	fontSize: 12,
	py: "4px",
};

export const BOM_tableFooterSx = {
	height: 44,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 2,
	background: "rgba(2,6,23,.26)",
};

export const BOM_addRowBtnSx = {
	color: "#60a5fa",
	textTransform: "none",
	fontSize: 13,
	fontWeight: 800,
};

export const BOM_validRateSx = {
	color: "#94a3b8",
	fontSize: 12,
	fontFamily: "monospace",
};

/* =====================================================
   PLACEHOLDER
===================================================== */

export const BOM_panelPlaceholderSx = {
	minHeight: 320,
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "center",
	p: 4,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.88), rgba(17,24,39,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	borderRadius: "24px",
	boxShadow: "0 18px 50px rgba(0,0,0,.24)",
};

export const BOM_chipPlaceholderSx = {
	mb: 2,
	height: 28,
	borderRadius: 999,
	background: "rgba(255,255,255,.06)",
	color: "#94a3b8",
	fontWeight: 800,
};

export const BOM_titlePlaceholderSx = {
	color: "#fff",
	fontWeight: 950,
	fontSize: 30,
};

export const BOM_subtitlePlaceholderSx = {
	mt: 1,
	color: "rgba(255,255,255,.65)",
	fontSize: 15,
	maxWidth: 640,
	lineHeight: 1.6,
};

export const BOM_notePlaceholderSx = {
	mt: 2.5,
	color: "#60a5fa",
	fontWeight: 800,
	fontSize: 13,
};

/* =====================================================
   OPTIONAL OLD HOME / PORTAL SUPPORT
   Kept so older BOMFlowHome.jsx does not break.
===================================================== */

export const BOM_pageSx = BOM_modulePageSx;

export const BOM_ambientGlowOne = {
	position: "absolute",
	top: -120,
	left: -120,
	width: 420,
	height: 420,
	borderRadius: "50%",
	background: "rgba(37,99,235,.12)",
	filter: "blur(100px)",
	pointerEvents: "none",
};

export const BOM_ambientGlowTwo = {
	position: "absolute",
	right: -120,
	bottom: -120,
	width: 460,
	height: 460,
	borderRadius: "50%",
	background: "rgba(14,165,233,.08)",
	filter: "blur(110px)",
	pointerEvents: "none",
};

export const BOM_backgroundText = {
	position: "absolute",
	fontSize: { xs: 88, md: 190 },
	fontWeight: 950,
	background:
		"linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))",
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	letterSpacing: 6,
	pointerEvents: "none",
	userSelect: "none",
	whiteSpace: "nowrap",
};

export const BOM_topBarSx = BOM_moduleHeaderRowSx;
export const BOM_brandWrapSx = BOM_moduleLogoRowSx;
export const BOM_brandMarkSx = BOM_moduleLogoMarkSx;
export const BOM_brandTitleSx = BOM_moduleLogoSx;
export const BOM_brandSubSx = BOM_moduleSubtitleSx;

export const BOM_allModulesBtnSx = BOM_secondaryActionBtnSx;

export const BOM_heroSx = {
	mb: 4,
	p: { xs: 3, md: 4 },
	borderRadius: "24px",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.88), rgba(17,24,39,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 18px 50px rgba(0,0,0,.24)",
	position: "relative",
	overflow: "hidden",
};

export const BOM_heroBadgeSx = BOM_labelChipSx;

export const BOM_heroTitleSx = {
	color: "#fff",
	fontWeight: 950,
	mb: 1,
};

export const BOM_heroSubtitleSx = {
	color: "rgba(255,255,255,.65)",
	fontSize: "16px",
	lineHeight: 1.6,
	maxWidth: 800,
};

export const BOM_heroChipWrapSx = {
	mt: 3,
	display: "flex",
	gap: 1,
	flexWrap: "wrap",
};

export const BOM_heroChipSx = {
	color: "#cbd5e1",
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.04)",
};

export const BOM_portalModuleCardSx = (enabled) => ({
	height: "100%",
	borderRadius: "24px",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.88), rgba(17,24,39,.84))",
	border: "1px solid rgba(255,255,255,.08)",
	opacity: enabled ? 1 : 0.65,
	transition: "all .25s ease",

	"&:hover": enabled
		? {
				transform: "translateY(-4px)",
				borderColor: "rgba(59,130,246,.35)",
		  }
		: {},
});

export const BOM_statusReadySx = {
	color: "#4ade80",
	background: "rgba(34,197,94,.12)",
	border: "1px solid rgba(34,197,94,.22)",
	fontWeight: 800,
};

export const BOM_statusPlannedSx = {
	color: "#94a3b8",
	background: "rgba(255,255,255,.06)",
	border: "1px solid rgba(255,255,255,.08)",
	fontWeight: 800,
};

export const BOM_moduleTitleSx = {
	fontWeight: 850,
	color: "#fff",
	mb: 1,
	fontSize: "18px",
};

export const BOM_portalModuleSubtitleSx = {
	color: "rgba(255,255,255,.62)",
	fontSize: "14px",
	lineHeight: 1.6,
	minHeight: 70,
	mb: 2,
};