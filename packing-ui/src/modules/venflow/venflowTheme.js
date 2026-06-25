export const darkMenuProps = {
	PaperProps: {
		sx: {
			mt: 1,
			borderRadius: "18px",
			background: "linear-gradient(180deg,#0f172a,#111827)",
			color: "#fff",
			border: "1px solid rgba(255,255,255,.08)",
			boxShadow: "0 24px 60px rgba(2,6,23,.55)",
			"& .MuiMenuItem-root": {
				color: "#fff",
				fontWeight: 700,
			},
			"& .Mui-selected": {
				background: "rgba(59,130,246,.18) !important",
				color: "#fff",
			},
		},
	},
};

export const fieldSx = {
	"& .MuiInputLabel-root": {
		color: "rgba(255,255,255,.56)",
		fontWeight: 750,
	},
	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},
	"& .MuiOutlinedInput-root": {
		borderRadius: "16px",
		background: "rgba(15,23,42,.72)",
		color: "#fff",
		fontWeight: 750,
		"& fieldset": {
			borderColor: "rgba(255,255,255,.08)",
		},
		"&:hover fieldset": {
			borderColor: "rgba(59,130,246,.35)",
		},
		"&.Mui-focused fieldset": {
			borderColor: "rgba(59,130,246,.72)",
			boxShadow: "0 0 0 3px rgba(37,99,235,.12)",
		},
		"&.Mui-disabled": {
			color: "rgba(255,255,255,.38)",
			background: "rgba(255,255,255,.035)",
		},
		"&.Mui-disabled fieldset": {
			borderColor: "rgba(255,255,255,.06)",
		},
	},
	"& .MuiInputBase-input.Mui-disabled": {
		WebkitTextFillColor: "rgba(255,255,255,.42)",
	},
	"& .MuiSvgIcon-root": {
		color: "#94a3b8",
	},
	"& input[type='date']::-webkit-calendar-picker-indicator": {
		filter: "invert(1)",
		opacity: 0.75,
	},
};

export const pageHeaderSx = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: { xs: "flex-start", md: "center" },
	gap: 2,
	mb: 2.5,
	flexDirection: { xs: "column", md: "row" },
};

export const pageTitleSx = {
	fontSize: { xs: 26, md: 32 },
	fontWeight: 950,
	color: "#fff",
	letterSpacing: "-0.04em",
};

export const pageSubSx = {
	mt: 0.7,
	color: "rgba(255,255,255,.62)",
	fontWeight: 650,
	lineHeight: 1.7,
	maxWidth: 900,
};

export const primaryBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 14px 30px rgba(37,99,235,.28)",
	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
	"&:disabled": {
		color: "rgba(255,255,255,.45)",
		background: "rgba(255,255,255,.08)",
		boxShadow: "none",
	},
};

export const secondaryBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	color: "#cbd5e1",
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.08)",
	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.32)",
	},
};

export const outlineBtnSx = {
	borderRadius: "14px",
	textTransform: "none",
	fontWeight: 900,
	color: "#93c5fd",
	borderColor: "rgba(59,130,246,.32)",
	background: "rgba(59,130,246,.08)",
	"&:hover": {
		borderColor: "rgba(59,130,246,.55)",
		background: "rgba(59,130,246,.16)",
	},
};

export const panelSx = {
	borderRadius: 4,
	background:
		"linear-gradient(180deg, rgba(15,23,42,.86), rgba(15,23,42,.72))",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 18px 45px rgba(2,6,23,.32)",
	backdropFilter: "blur(18px)",
	color: "#fff",
};

export const cardSx = {
	...panelSx,
	overflow: "hidden",
};

export const sectionTitleSx = {
	fontSize: 17,
	fontWeight: 950,
	color: "#fff",
};

export const infoLabelSx = {
	fontSize: 12,
	color: "rgba(255,255,255,.52)",
	fontWeight: 850,
	textTransform: "uppercase",
	letterSpacing: ".04em",
};

export const infoValueSx = {
	fontSize: 15,
	color: "#fff",
	fontWeight: 850,
};

export const dividerSx = {
	borderColor: "rgba(255,255,255,.08)",
};

export const loadingBoxSx = {
	p: 5,
	textAlign: "center",
	color: "#93c5fd",
};

export const errorAlertSx = {
	mb: 2,
	borderRadius: "16px",
	background: "rgba(239,68,68,.12)",
	color: "#fecaca",
	border: "1px solid rgba(239,68,68,.22)",
	"& .MuiAlert-icon": {
		color: "#f87171",
	},
};

export const tableCardSx = {
	...panelSx,
	overflow: "hidden",
};

export const tableHeadCellSx = {
	color: "#93c5fd",
	fontWeight: 950,
	fontSize: 12,
	textTransform: "uppercase",
	letterSpacing: ".05em",
	borderBottom: "1px solid rgba(255,255,255,.08)",
	background: "rgba(15,23,42,.78)",
	whiteSpace: "nowrap",
};

export const tableCellSx = {
	color: "rgba(255,255,255,.78)",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	fontWeight: 650,
	whiteSpace: "nowrap",
};

export const tableRowSx = {
	"&:hover": {
		background: "rgba(59,130,246,.08)",
	},
};