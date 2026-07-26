export const pageSx = {
	width: "100%",
	display: "flex",
	flexDirection: "column",
	gap: "14px",
};

export const heroSx = {
	p: {
		xs: "16px",
		md: "20px",
	},
	borderRadius: "14px",
	background:
		"radial-gradient(circle at top left, rgba(14,165,233,.20), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.92), rgba(15,23,42,.78))",
	border: "1px solid rgba(255,255,255,.08)",
	boxShadow: "0 18px 36px rgba(2,6,23,.30)",
};

export const heroBadgeSx = {
	height: "26px",
	borderRadius: 999,
	background: "rgba(14,165,233,.14)",
	color: "#7dd3fc",
	border: "1px solid rgba(14,165,233,.26)",
	fontWeight: 900,
	fontSize: "10px",
	letterSpacing: ".08em",
};

export const heroTitleSx = {
	mt: "11px",
	color: "#fff",
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
	color: "rgba(255,255,255,.64)",
	fontSize: "12px",
	fontWeight: 650,
	lineHeight: 1.55,
	maxWidth: "900px",
};

export const panelSx = {
	p: "15px",
	borderRadius: "12px",
	background: "rgba(15,23,42,.82)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.24)",
	backdropFilter: "blur(18px)",
};

export const panelTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
};

export const panelSubSx = {
	mt: "3px",
	color: "rgba(255,255,255,.54)",
	fontSize: "11px",
	fontWeight: 650,
	lineHeight: 1.45,
};

export const errorBoxSx = {
	p: "11px 13px",
	borderRadius: "9px",
	color: "#fca5a5",
	background: "rgba(239,68,68,.12)",
	border: "1px solid rgba(239,68,68,.24)",
	fontSize: "12px",
	fontWeight: 750,
};

export const fieldSx = {
	"& .MuiInputLabel-root": {
		color: "rgba(255,255,255,.58)",
		fontSize: "12px",
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#7dd3fc",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: "44px",
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "9px",
		fontSize: "12px",
		fontWeight: 700,

		"& fieldset": {
			borderColor:
				"rgba(255,255,255,.09)",
		},

		"&:hover fieldset": {
			borderColor:
				"rgba(14,165,233,.36)",
		},

		"&.Mui-focused fieldset": {
			borderColor: "#0ea5e9",
		},
	},

	"& .MuiInputBase-input": {
		color: "#fff",
	},

	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
};

export const primaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 900,
	color: "#fff",
	background:
		"linear-gradient(135deg,#0284c7,#0ea5e9)",
	boxShadow:
		"0 10px 22px rgba(14,165,233,.24)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#0369a1,#0284c7)",
	},
};

export const secondaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.09)",

	"&:hover": {
		background: "rgba(14,165,233,.12)",
		borderColor: "rgba(14,165,233,.32)",
	},
};

export const tableShellSx = {
	overflowX: "auto",
	borderRadius: "10px",
	border: "1px solid rgba(255,255,255,.07)",
};

export const tableHeaderSx = {
	minWidth: "980px",
	display: "grid",
	background: "rgba(2,6,23,.42)",
	color: "rgba(255,255,255,.54)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

export const tableRowSx = {
	minWidth: "980px",
	display: "grid",
	alignItems: "center",
	borderTop: "1px solid rgba(255,255,255,.06)",
	background: "rgba(255,255,255,.025)",

	"&:hover": {
		background: "rgba(14,165,233,.07)",
	},
};

export const tableCellSx = {
	p: "11px 12px",
	color: "rgba(255,255,255,.70)",
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
};

export const emptySx = {
	minHeight: "180px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	p: "20px",
	color: "rgba(255,255,255,.52)",
};