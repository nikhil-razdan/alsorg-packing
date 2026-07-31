export const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
	color:
		"var(--mf-text)",
};

export const heroSx = {
	p: {
		xs: "16px",
		md: "20px",
	},

	position: "relative",
	overflow: "hidden",
	borderRadius: "14px",

	color:
		"var(--mf-text)",

	background:
		"var(--mf-hero-bg)",

	border:
		"1px solid var(--mf-border)",

	boxShadow:
		"var(--mf-shadow)",

	transition:
		"background .22s ease, border-color .22s ease",
};

export const heroBadgeSx = {
	height: "26px",
	borderRadius: 999,
	background:
		"rgba(14,165,233,.12)",
	color: "#0284c7",
	border:
		"1px solid rgba(14,165,233,.25)",
	fontWeight: 900,
	fontSize: "10px",
	letterSpacing: ".08em",
};

export const heroTitleSx = {
	mt: "11px",
	color:
		"var(--mf-text)",

	fontSize: {
		xs: "24px",
		md: "31px",
	},

	fontWeight: 950,
	lineHeight: 1.08,
	letterSpacing: "-0.04em",
};

export const heroSubSx = {
	mt: "7px",
	color:
		"var(--mf-text-secondary)",
	fontSize: "12px",
	fontWeight: 650,
	lineHeight: 1.55,
	maxWidth: "900px",
};

export const panelSx = {
	p: "15px",
	borderRadius: "12px",
	color:
		"var(--mf-text)",
	background:
		"var(--mf-panel-bg)",
	border:
		"1px solid var(--mf-border)",
	boxShadow:
		"var(--mf-shadow)",
	backdropFilter: "blur(18px)",
	backgroundImage: "none",
	transition:
		"background .22s ease, border-color .22s ease",
};

export const panelTitleSx = {
	color:
		"var(--mf-text)",
	fontSize: "17px",
	fontWeight: 950,
};

export const panelSubSx = {
	mt: "3px",
	color:
		"var(--mf-text-secondary)",
	fontSize: "11px",
	fontWeight: 650,
	lineHeight: 1.45,
};

export const sectionTitleSx = {
	color:
		"var(--mf-text)",
	fontSize: "17px",
	fontWeight: 950,
};

export const sectionSubSx = {
	mt: "3px",
	color:
		"var(--mf-text-muted)",
	fontSize: "11px",
	fontWeight: 700,
};

export const mainTextSx = {
	color:
		"var(--mf-text)",
	fontSize: "12px",
	fontWeight: 850,
};

export const subTextSx = {
	mt: "2px",
	color:
		"var(--mf-text-muted)",
	fontSize: "10px",
	fontWeight: 650,
};

export const detailBoxSx = {
	p: "11px",
	borderRadius: "9px",
	background:
		"var(--mf-surface-soft)",
	border:
		"1px solid var(--mf-border)",
};

export const detailLabelSx = {
	color:
		"var(--mf-text-muted)",
	fontSize: "9.5px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

export const detailValueSx = {
	mt: "5px",
	color:
		"var(--mf-text)",
	fontSize: "12px",
	fontWeight: 850,
};

export const softSurfaceSx = {
	p: "14px",
	borderRadius: "10px",
	color:
		"var(--mf-text-secondary)",
	background:
		"var(--mf-surface-soft)",
	border:
		"1px solid var(--mf-border)",
	fontSize: "12px",
	fontWeight: 700,
};

export const errorBoxSx = {
	p: "11px 13px",
	borderRadius: "9px",
	color: "#dc2626",
	background:
		"rgba(239,68,68,.09)",
	border:
		"1px solid rgba(239,68,68,.24)",
	fontSize: "12px",
	fontWeight: 750,
};

export const fieldSx = {
	"& .MuiInputLabel-root": {
		color:
			"var(--mf-text-muted)",
		fontSize: "12px",
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#0284c7",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: "44px",
		color:
			"var(--mf-text)",
		background:
			"var(--mf-field-bg)",
		borderRadius: "9px",
		fontSize: "12px",
		fontWeight: 700,

		"& fieldset": {
			borderColor:
				"var(--mf-border)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(14,165,233,.38)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#0284c7",
		},
	},

	"& .MuiInputBase-input": {
		color:
			"var(--mf-text)",
	},

	"& .MuiInputBase-input.Mui-disabled": {
		WebkitTextFillColor:
			"var(--mf-text-muted)",
	},

	"& .MuiFormHelperText-root": {
		color:
			"var(--mf-text-muted)",
	},

	"& .MuiSvgIcon-root": {
		color:
			"var(--mf-text-muted)",
	},
};

export const primaryBtnSx = {
	minHeight: "38px",
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 900,
	color: "#ffffff",

	background:
		"linear-gradient(135deg,#0284c7,#0ea5e9)",

	boxShadow:
		"0 10px 22px rgba(14,165,233,.20)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#0369a1,#0284c7)",
	},

	"&.Mui-disabled": {
		color:
			"rgba(255,255,255,.62)",
		background:
			"rgba(2,132,199,.42)",
	},
};

export const secondaryBtnSx = {
	minHeight: "38px",
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color:
		"var(--mf-text)",
	background:
		"var(--mf-surface-soft)",
	border:
		"1px solid var(--mf-border)",

	"&:hover": {
		background:
			"var(--mf-hover)",
		borderColor:
			"rgba(14,165,233,.34)",
	},
};

export const tableShellSx = {
	width: "100%",
	overflowX: "auto",
	borderRadius: "10px",
	border:
		"1px solid var(--mf-border)",
	background:
		"var(--mf-panel-bg-solid)",
};

export const tableHeaderSx = {
	minWidth: "980px",
	display: "grid",
	alignItems: "center",
	background:
		"var(--mf-surface-strong)",
	color:
		"var(--mf-text-muted)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

export const tableRowSx = {
	minWidth: "980px",
	display: "grid",
	alignItems: "center",

	borderTop:
		"1px solid var(--mf-border)",

	background:
		"var(--mf-panel-bg)",

	color:
		"var(--mf-text-secondary)",

	"&:hover": {
		background:
			"var(--mf-hover)",
	},
};

export const tableCellSx = {
	p: "11px 12px",
	color:
		"var(--mf-text-secondary)",
	fontSize: "12px",
	fontWeight: 700,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

export const loadingSx = {
	minHeight: "260px",
	display: "grid",
	placeItems: "center",
	color:
		"var(--mf-text)",
};

export const emptySx = {
	minHeight: "170px",
	display: "grid",
	placeItems: "center",
	textAlign: "center",
	p: "20px",
	color:
		"var(--mf-text-muted)",
	fontSize: "12px",
	fontWeight: 750,
};

export const pageTextSx = {
	color:
		"var(--mf-text-secondary)",
	fontSize: "11px",
	fontWeight: 750,
};

export const switchLabelSx = {
	color:
		"var(--mf-text-secondary)",

	"& .MuiFormControlLabel-label": {
		fontSize: "12px",
		fontWeight: 700,
	},
};

/*
 * Dialogs are rendered in a portal outside the scoped MatFlow
 * CSS-variable container. Theme palette values are therefore used
 * instead of var(--mf-...) here.
 */
export const dialogPaperSx = {
	borderRadius: "14px",
	color: "text.primary",
	backgroundColor:
		"background.paper",
	backgroundImage: "none",
	border: "1px solid",
	borderColor: "divider",
	boxShadow: 24,
};

export const dialogTitleSx = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "12px",
	color: "text.primary",
	fontWeight: 950,
	borderBottom: "1px solid",
	borderColor: "divider",
};

export const dialogHeadingSx = {
	color: "text.primary",
	fontSize: "19px",
	fontWeight: 950,
};

export const dialogSubSx = {
	mt: "4px",
	color: "text.secondary",
	fontSize: "11px",
	fontWeight: 650,
};

export const dialogContentSx = {
	pt: "18px !important",
	color: "text.primary",
};

export const dialogMessageSx = {
	color: "text.secondary",
	fontSize: "12px",
	lineHeight: 1.55,
};

export const dialogActionsSx = {
	p: "14px 24px 20px",
	borderTop: "1px solid",
	borderColor: "divider",
};

export const closeButtonSx = {
	color: "text.secondary",
};