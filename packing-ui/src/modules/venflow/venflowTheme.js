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
		color: "rgba(255,255,255,.58)",
		fontSize: "12px",
		fontWeight: 750,
	},

	"& .MuiInputLabel-root.Mui-focused": {
		color: "#60a5fa",
	},

	"& .MuiOutlinedInput-root": {
		minHeight: "48px",
		color: "#fff",
		background: "rgba(255,255,255,.04)",
		borderRadius: "9px",
		fontSize: "13px",
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

		"&.Mui-disabled": {
			color: "rgba(255,255,255,.38)",
			background: "rgba(255,255,255,.035)",
		},

		"&.Mui-disabled fieldset": {
			borderColor: "rgba(255,255,255,.06)",
		},
	},

	"& .MuiInputBase-input": {
		color: "#fff",
		fontWeight: 650,
	},

	"& .MuiInputBase-input.Mui-disabled": {
		WebkitTextFillColor: "rgba(255,255,255,.42)",
	},

	"& .MuiInputBase-input::placeholder": {
		color: "rgba(255,255,255,.34)",
		opacity: 1,
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
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "16px",
	flexWrap: "wrap",
	mb: "14px",
};

export const pageTitleSx = {
	color: "#fff",
	fontSize: {
		xs: "24px",
		md: "32px",
	},
	fontWeight: 950,
	lineHeight: 1.05,
	letterSpacing: "-0.04em",
};

export const pageSubSx = {
	mt: "8px",
	color: "rgba(255,255,255,.68)",
	fontSize: "13px",
	fontWeight: 650,
	lineHeight: 1.5,
	maxWidth: "820px",
};

export const primaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	boxShadow: "0 10px 22px rgba(37,99,235,.30)",

	"&:hover": {
		background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
	},

	"&:disabled": {
		color: "rgba(255,255,255,.42)",
		background: "rgba(255,255,255,.08)",
		boxShadow: "none",
	},
};

export const secondaryBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: "rgba(255,255,255,.04)",
	border: "1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.30)",
	},
};

export const outlineBtnSx = {
	height: "38px",
	borderRadius: "9px",
	px: "14px",
	textTransform: "none",
	fontWeight: 850,
	color: "#93c5fd",
	borderColor: "rgba(59,130,246,.32)",
	background: "rgba(59,130,246,.08)",

	"&:hover": {
		borderColor: "rgba(59,130,246,.55)",
		background: "rgba(59,130,246,.16)",
	},

	"&:disabled": {
		color: "rgba(255,255,255,.35)",
		borderColor: "rgba(255,255,255,.08)",
		background: "rgba(255,255,255,.04)",
	},
};

export const panelSx = {
	borderRadius: "10px",
	background: "rgba(15,23,42,.78)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
	backdropFilter: "blur(18px)",
	color: "#fff",
};

export const cardSx = {
	...panelSx,
	overflow: "hidden",
};

export const sectionTitleSx = {
	color: "#fff",
	fontSize: "17px",
	fontWeight: 950,
	letterSpacing: "-0.02em",
};

export const infoLabelSx = {
	color: "rgba(255,255,255,.54)",
	fontSize: "10px",
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".07em",
};

export const infoValueSx = {
	mt: "3px",
	color: "#fff",
	fontSize: "13px",
	fontWeight: 850,
};

export const dividerSx = {
	borderColor: "rgba(255,255,255,.08)",
};

export const loadingBoxSx = {
	p: 5,
	textAlign: "center",
	color: "#93c5fd",

	"& .MuiCircularProgress-root": {
		color: "#60a5fa",
	},
};

export const errorAlertSx = {
	mb: 2,
	borderRadius: "10px",
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
	borderRadius: "10px",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "0 14px 28px rgba(2,6,23,.26)",
};

export const tableHeadCellSx = {
	color: "rgba(255,255,255,.54)",
	fontWeight: 900,
	fontSize: "10px",
	textTransform: "uppercase",
	letterSpacing: ".06em",
	borderBottom: "1px solid rgba(255,255,255,.08)",
	background: "rgba(2,6,23,.34)",
	whiteSpace: "nowrap",
	py: "10px",
};

export const tableCellSx = {
	color: "rgba(255,255,255,.72)",
	borderBottom: "1px solid rgba(255,255,255,.06)",
	fontWeight: 650,
	fontSize: "12px",
	whiteSpace: "nowrap",
	py: "8px",
};

export const tableRowSx = {
	background: "rgba(255,255,255,.025)",

	"&:hover": {
		background: "rgba(59,130,246,.08)",
	},
};

export const premiumScrollbarSx = {
	scrollbarWidth: "thin",
	scrollbarColor:
		"rgba(96,165,250,.72) rgba(15,23,42,.72)",

	"&::-webkit-scrollbar": {
		width: 11,
		height: 11,
	},

	"&::-webkit-scrollbar-track": {
		background:
			"linear-gradient(180deg, rgba(15,23,42,.82), rgba(2,6,23,.84))",
		borderRadius: 999,
		border: "1px solid rgba(255,255,255,.06)",
		boxShadow: "inset 0 0 8px rgba(2,6,23,.65)",
	},

	"&::-webkit-scrollbar-thumb": {
		borderRadius: 999,
		background:
			"linear-gradient(135deg, rgba(96,165,250,.92), rgba(37,99,235,.88))",
		border: "2px solid rgba(15,23,42,.92)",
		boxShadow:
			"0 0 14px rgba(59,130,246,.32), inset 0 1px 0 rgba(255,255,255,.22)",
	},

	"&::-webkit-scrollbar-thumb:hover": {
		background:
			"linear-gradient(135deg, rgba(147,197,253,1), rgba(59,130,246,.98))",
		boxShadow:
			"0 0 18px rgba(96,165,250,.48), inset 0 1px 0 rgba(255,255,255,.30)",
	},

	"&::-webkit-scrollbar-corner": {
		background: "transparent",
	},
};

export const tableContainerSx = {
	width: "100%",
	maxWidth: "100%",
	overflow: "auto",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.34), rgba(2,6,23,.22))",
	borderRadius: "0 0 10px 10px",
	...premiumScrollbarSx,

	"&::-webkit-scrollbar-track": {
		marginInline: "14px",
		background:
			"linear-gradient(90deg, rgba(15,23,42,.82), rgba(30,41,59,.74), rgba(15,23,42,.82))",
		borderRadius: 999,
		border: "1px solid rgba(255,255,255,.08)",
	},

	"&::-webkit-scrollbar-thumb": {
		borderRadius: 999,
		background:
			"linear-gradient(90deg, rgba(56,189,248,.95), rgba(59,130,246,.96), rgba(37,99,235,.96))",
		border: "2px solid rgba(15,23,42,.96)",
		boxShadow:
			"0 0 16px rgba(59,130,246,.38), inset 0 1px 0 rgba(255,255,255,.24)",
	},
};