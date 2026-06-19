// Layout Styles
export const BOM_shellSx = {
	height: "100vh",
	width: "100%",
	display: "flex",
	overflow: "hidden",
	background: "#0b0f17",
	color: "#e5e7eb",
	fontFamily: "Inter, system-ui, sans-serif",
};

export const BOM_mainSx = {
	flex: 1,
	minWidth: 0,
	height: "100vh",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
};

export const BOM_contentSx = {
	flex: 1,
	minHeight: 0,
	overflow: "auto",
	p: 2.8,
	background: "radial-gradient(circle at top left, rgba(79,141,247,.05), transparent 30%), #0b0f17",
};

export const BOM_sidebarSx = {
	width: 268,
	minWidth: 268,
	height: "100vh",
	background: "linear-gradient(180deg, #161a23 0%, #0f131a 100%)",
	borderRight: "1px solid rgba(255, 255, 255, 0.06)",
	display: "flex",
	flexDirection: "column",
	p: 2,
	boxSizing: "border-box",
	boxShadow: "6px 0 24px rgba(0,0,0,.4)",
	overflow: "hidden",
};

export const BOM_brandSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	mb: 4,
	px: 0.5,
};

export const BOM_brandMarkSx = {
	width: 40,
	height: 40,
	borderRadius: "10px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg, #38bdf8, #2563eb)",
	color: "#fff",
	fontWeight: 900,
	fontSize: 18,
	boxShadow: "0 8px 20px rgba(37,99,235,.3)",
	flexShrink: 0,
};

export const BOM_brandTitleSx = {
	color: "#fff",
	fontSize: 22,
	lineHeight: 1,
	fontWeight: 900,
	letterSpacing: "-0.02em",
};

export const BOM_brandSubSx = {
	color: "rgba(255,255,255,.4)",
	mt: 0.4,
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: 0.5,
};

export const BOM_navSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.5,
};

export const BOM_navItemStyle = {
	width: "100%",
	height: 44,
	border: "none",
	borderRadius: 8,
	background: "transparent",
	color: "rgba(255,255,255,.65)",
	display: "flex",
	alignItems: "center",
	gap: 12,
	padding: "0 14px",
	fontWeight: 600,
	fontSize: "14px",
	cursor: "pointer",
	textAlign: "left",
	transition: "all .2s ease",
};

export const BOM_navItemActiveStyle = {
	background: "rgba(37, 99, 235, 0.2)",
	color: "#38bdf8",
	borderLeft: "4px solid #38bdf8",
	borderRadius: "0 8px 8px 0",
	paddingLeft: "10px",
};

export const BOM_navIconStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 20,
	flexShrink: 0,
};

export const BOM_sidebarFooterSx = {
	borderTop: "1px solid rgba(255,255,255,.08)",
	pt: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

export const BOM_newCostingBtnSx = {
	height: 42,
	borderRadius: "8px",
	textTransform: "none",
	fontWeight: 700,
	background: "#2563eb",
	color: "#fff",
	boxShadow: "0 4px 14px rgba(37,99,235,.4)",
	"&:hover": { background: "#1d4ed8" },
};

export const BOM_allModulesBtnSx = {
	height: 40,
	borderRadius: "8px",
	textTransform: "none",
	fontWeight: 600,
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.08)",
	background: "rgba(255,255,255,.02)",
	"&:hover": { background: "rgba(255,255,255,.05)", color: "#fff" },
};

export const BOM_topbarSx = {
	height: 64,
	minHeight: 64,
	background: "#11151d",
	borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 3,
	zIndex: 20,
	flexShrink: 0,
};

export const BOM_topbarLeftSx = { display: "flex", alignItems: "center", gap: 2 };
export const BOM_systemTitleBlockSx = { display: "flex", flexDirection: "column" };
export const BOM_systemTitleSx = { color: "#fff", fontWeight: 800, fontSize: 18 };
export const BOM_systemSubtitleSx = { color: "rgba(255,255,255,.4)", fontSize: 11 };
export const BOM_topbarDividerSx = { width: 1, height: 24, background: "rgba(255,255,255,.1)" };

export const BOM_breadcrumbChipSx = {
	height: 24,
	borderRadius: "4px",
	background: "rgba(37, 99, 235, 0.15)",
	color: "#38bdf8",
	border: "1px solid rgba(37, 99, 235, 0.3)",
	fontSize: 11,
	fontWeight: 700,
};

export const BOM_sectionTabsSx = { display: "flex", gap: 0.5, background: "rgba(0,0,0,.2)", p: 0.5, borderRadius: "6px" };
export const BOM_sectionChipSx = {
	height: 28,
	borderRadius: "4px",
	background: "transparent",
	color: "rgba(255,255,255,.6)",
	fontWeight: 600,
	fontSize: 12,
	"&:hover": { background: "rgba(255,255,255,.05)", color: "#fff" },
};
export const BOM_activeSectionChipSx = {
	height: 28,
	borderRadius: "4px",
	background: "#2563eb",
	color: "#fff",
	fontWeight: 700,
	fontSize: 12,
	"&:hover": { background: "#1d4ed8" },
};

export const BOM_topbarRightSx = { display: "flex", alignItems: "center", gap: 1.5 };
export const BOM_iconGroupSx = { display: "flex", gap: 0.5 };
export const BOM_topIconBtnSx = { color: "rgba(255,255,255,.6)", "&:hover": { color: "#fff", background: "rgba(255,255,255,.05)" } };

export const BOM_saveBtnSx = {
	height: 36,
	borderRadius: "6px",
	textTransform: "none",
	fontWeight: 600,
	color: "#94a3b8",
	border: "1px solid rgba(255,255,255,.1)",
	px: 2,
	"&:hover": { background: "rgba(255,255,255,.05)", color: "#fff" },
};

export const BOM_approveBtnSx = {
	height: 36,
	borderRadius: "6px",
	textTransform: "none",
	fontWeight: 600,
	background: "#22c55e",
	color: "#fff",
	px: 2,
	"&:hover": { background: "#16a34a" },
};

export const BOM_userPillSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
	background: "rgba(255,255,255,.03)",
	p: "4px 12px 4px 6px",
	borderRadius: "20px",
	border: "1px solid rgba(255,255,255,.06)",
};

export const BOM_avatarSx = {
	width: 26,
	height: 26,
	borderRadius: "50%",
	background: "#6366f1",
	color: "#fff",
	display: "grid",
	placeItems: "center",
	fontWeight: 700,
	fontSize: 12,
};

export const BOM_userNameSx = { color: "#fff", fontSize: 13, fontWeight: 600 };
export const BOM_userRoleSx = { color: "rgba(255,255,255,.4)", fontSize: 10 };

// Home Styles
export const BOM_pageSx = {
	minHeight: "100vh",
	position: "relative",
	overflow: "hidden",
	fontFamily: "Inter, system-ui, sans-serif",
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 25%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.05), transparent 25%),
		linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)
	`,
	p: { xs: 2, md: 4 },
};

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
	background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))",
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

export const BOM_topBarSx = {
	position: "relative",
	zIndex: 1,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	maxWidth: 1300,
	mx: "auto",
	mb: 5,
};

export const BOM_heroSx = {
	mb: 4,
	p: { xs: 3, md: 4 },
	borderRadius: "12px",
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.06)",
	boxShadow: "0 20px 50px rgba(0,0,0,.4)",
	position: "relative",
	overflow: "hidden",
};

export const BOM_heroBadgeSx = {
	mb: 2,
	height: 28,
	background: "rgba(37,99,235,.15)",
	border: "1px solid rgba(59,130,246,0.3)",
	color: "#38bdf8",
	fontWeight: 700,
};

export const BOM_heroTitleSx = { color: "#fff", fontWeight: 800, mb: 1 };
export const BOM_heroSubtitleSx = { color: "#94a3b8", fontSize: "16px", lineHeight: 1.6, maxWidth: 800 };
export const BOM_heroChipWrapSx = { mt: 3, display: "flex", gap: 1, flexWrap: "wrap" };
export const BOM_heroChipSx = { color: "#cbd5e1", border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" };

export const BOM_portalModuleCardSx = (enabled) => ({
	height: "100%",
	borderRadius: "12px",
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.06)",
	opacity: enabled ? 1 : 0.65,
	transition: "all .2s ease",
	"&:hover": enabled ? { transform: "translateY(-4px)", borderColor: "rgba(37,99,235,.4)" } : {},
});

export const BOM_statusReadySx = { color: "#22c55e", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)", fontWeight: 700 };
export const BOM_statusPlannedSx = { color: "#64748b", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" };
export const BOM_moduleTitleSx = { fontWeight: 700, color: "#fff", mb: 1, fontSize: "18px" };
export const BOM_moduleSubtitleSx = { color: "#94a3b8", fontSize: "14px", lineHeight: 1.6, minHeight: 70, mb: 2 };

// Module Styles
export const BOM_pageHeadSx = { display: "flex", justifycontent: "space-between", alignitems: "flex-start", gap: 2, mb: 3 };
export const BOM_labelChipSx = { height: 24, borderRadius: "4px", background: "rgba(37,99,235,.15)", color: "#38bdf8", fontWeight: 700 };
export const BOM_activeCostingsCardSx = { minWidth: 180, background: "#11151d", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px", p: 2 };
export const BOM_activeCostingsValueSx = { color: "#22c55e", fontSize: 26, fontWeight: 700, fontFamily: "monospace" };

export const BOM_moduleCardSx = {
	p: 3,
	background: "#1a1e27",
	border: "1px solid rgba(255,255,255,.06)",
	borderRadius: "8px",
	height: "100%",
	display: "flex",
	flexDirection: "column",
	transition: "border-color 0.2s ease",
	"&:hover": { borderColor: "rgba(37,99,235,.4)" },
};

export const BOM_cardTitleSx = { color: "#fff", fontSize: 18, fontWeight: 700, mb: 1 };
export const BOM_cardSubSx = { color: "#94a3b8", fontSize: 14, lineHeight: 1.5, mb: 3, flex: 1 };
export const BOM_openBtnSx = {
	height: 38,
	borderRadius: "6px",
	background: "#2563eb",
	color: "#fff",
	fontWeight: 600,
	textTransform: "none",
	"&:hover": { background: "#1d4ed8" },
};

// Product Master Styles
export const BOM_pageTopSx = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3 };
export const BOM_statusWrapSx = { display: "flex", alignItems: "center", gap: 1 };
export const BOM_statusTextSx = { color: "#94a3b8", fontSize: 13, fontWeight: 600 };
export const BOM_draftChipSx = { height: 26, borderRadius: "4px", background: "rgba(255,255,255,.05)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,.08)" };

export const BOM_panelSx = { mb: 3, p: 3, background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px" };
export const BOM_sectionHeadSx = { display: "flex", alignItems: "center", gap: 1.2, pb: 1.5, mb: 2.5, borderBottom: "1px solid rgba(255,255,255,.06)" };
export const BOM_sectionTitleSx = { color: "#fff", fontWeight: 700, fontSize: 18 };

export const BOM_fieldSx = {
	mb: 2.5,
	"& .MuiInputLabel-root": { color: "#64748b", fontSize: "14px" },
	"& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
	"& .MuiOutlinedInput-root": {
		color: "#fff",
		background: "#11151d",
		fontSize: "14px",
		"& fieldset": { borderColor: "rgba(255,255,255,.06)" },
		"&:hover fieldset": { borderColor: "rgba(255,255,255,.12)" },
		"&.Mui-focused fieldset": { borderColor: "#2563eb" },
	},
	"& .MuiSvgIcon-root": { color: "#64748b" },
};

export const BOM_noteSx = { mt: 1, p: 2, background: "#11151d", borderRadius: "6px", display: "flex", gap: 1, alignItems: "flex-start", border: "1px solid rgba(255,255,255,.04)" };
export const BOM_noteTextSx = { color: "#94a3b8", fontSize: 13, lineHeight: 1.5 };

export const BOM_sidePanelSx = { mb: 3, p: 2.5, background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px" };
export const BOM_sideTitleRowSx = { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 };
export const BOM_sideTitleSx = { color: "#fff", fontSize: 16, fontWeight: 700 };

export const BOM_uploadBoxSx = {
	height: 180,
	border: "2px dashed rgba(255,255,255,.08)",
	background: "#11151d",
	borderRadius: "6px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: 2,
	"&:hover": { borderColor: "#2563eb" },
};
export const BOM_uploadIconSx = { width: 44, height: 44, borderRadius: "8px", background: "rgba(255,255,255,.03)", display: "grid", placeItems: "center", color: "#94a3b8", mb: 1 };
export const BOM_uploadTitleSx = { color: "#fff", fontWeight: 600, fontSize: 13 };
export const BOM_uploadSubSx = { color: "#64748b", fontSize: 11, mt: 0.5 };

export const BOM_smallDarkChipSx = { background: "rgba(255,255,255,.05)", color: "#94a3b8", borderRadius: "4px", fontWeight: 600 };
export const BOM_drawingBoxSx = { height: 130, border: "1px solid rgba(255,255,255,.06)", background: "#11151d", borderRadius: "6px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", mb: 1.5 };
export const BOM_browseBtnSx = { mt: 1, height: 28, borderRadius: "4px", color: "#38bdf8", border: "1px solid rgba(56,189,248,.3)", textTransform: "none", fontSize: 12 };
export const BOM_noFileSx = { color: "#64748b", fontStyle: "italic", fontSize: 12 };

export const BOM_versionRowSx = { background: "#11151d", border: "1px solid rgba(255,255,255,.04)", p: 1.5, borderRadius: "6px", mb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" };
export const BOM_versionTitleSx = { color: "#fff", fontWeight: 600, fontSize: 13, mb: 0.5 };
export const BOM_versionDateSx = { color: "#64748b", fontSize: 11 };
export const BOM_approvedSx = { height: 18, borderRadius: "4px", background: "rgba(34,197,94,.1)", color: "#22c55e", fontSize: 10, fontWeight: 700 };
export const BOM_rejectedSx = { height: 18, borderRadius: "4px", background: "rgba(239,68,68,.1)", color: "#ef4444", fontSize: 10, fontWeight: 700 };
export const BOM_draftMiniSx = { height: 18, borderRadius: "4px", background: "rgba(255,255,255,.04)", color: "#94a3b8", fontSize: 10, fontWeight: 700 };
export const BOM_newVersionBtnSx = { height: 38, borderRadius: "6px", border: "1px dashed rgba(255,255,255,.1)", color: "#94a3b8", textTransform: "none", fontSize: 13 };

// BOMBuilder Styles
export const BOM_pageHeaderSx = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 };
export const BOM_statusLineSx = { display: "flex", alignItems: "center", gap: 1, mb: 0.5 };
export const BOM_projectChipSx = { height: 20, borderRadius: "4px", background: "#11151d", color: "#94a3b8", border: "1px solid rgba(255,255,255,.06)", fontSize: 10 };
export const BOM_draftProjectChipSx = { height: 20, borderRadius: "4px", background: "rgba(37,99,235,.1)", color: "#38bdf8", fontSize: 10 };
export const BOM_pageTitleDeskSx = { color: "#fff", fontSize: 26, fontWeight: 800 };
export const BOM_costCardSx = { background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px", p: 1.8, minWidth: 160 };
export const BOM_costLabelSx = { color: "#64748b", fontSize: 11, fontWeight: 700 };
export const BOM_costValueSx = { color: "#22c55e", fontSize: 22, fontWeight: 700, fontFamily: "monospace", mt: 0.5 };

export const BOM_sectionCardSx = { background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px", overflow: "hidden", mb: 2, borderLeft: "4px solid #2563eb" };
export const BOM_sectionHeaderSx = { height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, background: "#11151d", borderBottom: "1px solid rgba(255,255,255,.06)" };
export const BOM_sectionLeftSx = { display: "flex", alignItems: "center", gap: 1 };
export const BOM_sectionRightSx = { display: "flex", alignItems: "center", gap: 2 };
export const BOM_sectionIconBtnSx = { color: "#64748b" };
export const BOM_sectionTitleSx = { color: "#fff", fontSize: 16, fontWeight: 700 };
export const BOM_countChipSx = { background: "rgba(255,255,255,.04)", color: "#94a3b8", height: 20, borderRadius: "4px" };
export const BOM_sectionTotalLabelSx = { color: "#64748b", fontSize: 10, textTransform: "uppercase", textAlign: "right" };
export const BOM_sectionTotalValueSx = { color: "#fff", fontWeight: 700, fontFamily: "monospace", fontSize: 15 };

export const BOM_tableSx = { background: "#11151d" };
export const BOM_tableHeadSx = {
	display: "grid",
	gridTemplateColumns: "44px 2fr 1.2fr 1.2fr 0.6fr 0.6fr 1.2fr 1fr 0.6fr",
	color: "#64748b",
	fontSize: 11,
	fontWeight: 700,
	borderBottom: "1px solid rgba(255,255,255,.06)",
	background: "#141822",
	"& > div": { padding: "12px 8px" },
};
export const BOM_tableRowSx = {
	display: "grid",
	gridTemplateColumns: "44px 2fr 1.2fr 1.2fr 0.6fr 0.6fr 1.2fr 1fr 0.6fr",
	alignItems: "center",
	borderBottom: "1px solid rgba(255,255,255,.04)",
	minHeight: 44,
	background: "#1a1e27",
	"& > p, & > div": { padding: "4px 8px" },
};
export const BOM_missingRowSx = {
	...BOM_tableRowSx,
	background: "rgba(239, 68, 68, 0.05)",
	borderBottom: "1px solid rgba(239, 68, 68, 0.15)",
};

export const BOM_deleteCellSx = { color: "#64748b", display: "grid", placeItems: "center", cursor: "pointer", "&:hover": { color: "#ef4444" } };
export const BOM_itemNameCellSx = { display: "flex", alignItems: "center", gap: 0.5 };
export const BOM_itemNameSx = { color: "#fff", fontWeight: 600, fontSize: 14 };
export const BOM_missingItemSx = { color: "#fca5a5", fontWeight: 600, fontSize: 14 };
export const BOM_cellTextSx = { color: "#cbd5e1", fontSize: 13 };
export const BOM_cellStrongSx = { color: "#fff", fontWeight: 600, fontSize: 13 };
export const BOM_numberCellSx = { color: "#fff", fontFamily: "monospace", fontSize: 13 };
export const BOM_rateCellSx = { color: "#fff", fontFamily: "monospace", fontSize: 13 };
export const BOM_missingRateSx = { background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "4px", textalign: "center", fontWeight: 700, fontSize: 12, py: "2px" };
export const BOM_tableFooterSx = { height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, background: "#141822" };
export const BOM_addRowBtnSx = { color: "#38bdf8", textTransform: "none", fontSize: 13, fontWeight: 600 };
export const BOM_validRateSx = { color: "#64748b", fontSize: 12, fontFamily: "monospace" };
export const BOM_collapsedSectionSx = { height: 56, background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, borderLeft: "4px solid #8b5cf6" };

// BOMPlaceholder Styles
export const BOM_panelPlaceholderSx = { minHeight: 300, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", p: 4, background: "#1a1e27", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px" };
export const BOM_chipPlaceholderSx = { mb: 2, height: 24, background: "rgba(255,255,255,.05)", color: "#94a3b8", fontWeight: 600 };
export const BOM_titlePlaceholderSx = { color: "#fff", fontWeight: 800, fontSize: 28 };
export const BOM_subtitlePlaceholderSx = { mt: 1, color: "#94a3b8", fontSize: 15, maxWidth: 600, lineHeight: 1.6 };
export const BOM_notePlaceholderSx = { mt: 2.5, color: "#38bdf8", fontWeight: 600, fontSize: 13 };
