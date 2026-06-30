import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import {
	Box,
	Button,
	Chip,
	Typography,
} from "@mui/material";

import AppsIcon from "@mui/icons-material/Apps";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

const navItems = [
	{
		label: "Dashboard",
		path: "/bomflow/dashboard",
	},
	{
		label: "Product Master",
		path: "/bomflow/products",
	},
	{
		label: "BOM Builder",
		path: "/bomflow/bom-builder",
	},
	{
		label: "Rate Master",
		path: "/bomflow/rate-master",
	},
	{
		label: "Labour Master",
		path: "/bomflow/labour-master",
	},
	{
		label: "Costing Engine",
		path: "/bomflow/costing",
	},
	{
		label: "Reports",
		path: "/bomflow/reports",
	},
];

export default function BOMFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	const activeItem =
		navItems.find((item) =>
			location.pathname.startsWith(item.path)
		) || navItems[0];

	return (
		<div style={page}>
			<div style={backgroundText}>
				BOMFlow
			</div>

			<div style={content}>
				<div style={heroRow}>
					<div style={brandBlock}>
						<div style={brandMark}>
							B
						</div>

						<div>
							<h2 style={heroTitle}>
								BOMFlow
							</h2>

							<div style={heroSubtitle}>
								Product BOM, costing, rate master and approval workflow
							</div>
						</div>
					</div>

					<div style={heroActions}>
						<Chip
							icon={<AccountTreeOutlinedIcon />}
							label={activeItem.label}
							size="small"
							sx={activePageChipSx}
						/>

						<Button
							startIcon={<AppsIcon />}
							onClick={() => navigate("/modules")}
							sx={secondaryActionBtnSx}
						>
							All Modules
						</Button>

						<Button
							startIcon={<AddIcon />}
							onClick={() => navigate("/bomflow/products")}
							sx={primaryActionBtnSx}
						>
							New Costing
						</Button>
					</div>
				</div>

				<div style={tabsRow}>
					{navItems.map((item) => {
						const active =
							location.pathname === item.path ||
							location.pathname.startsWith(`${item.path}/`);

						return (
							<button
								key={item.path}
								type="button"
								onClick={() => navigate(item.path)}
								style={tabBtn(active)}
							>
								{item.label}
							</button>
						);
					})}
				</div>

				<div style={viewShell}>
					<Outlet />
				</div>
			</div>
		</div>
	);
}

/* ===================== PAGE LAYOUT ===================== */

const page = {
	minHeight: "100%",
	padding: 18,
	position: "relative",
	overflowX: "hidden",
	overflowY: "auto",

	background: `
		radial-gradient(
			circle at top left,
			rgba(59,130,246,0.16),
			transparent 22%
		),

		radial-gradient(
			circle at bottom right,
			rgba(14,165,233,0.12),
			transparent 24%
		),

		linear-gradient(
			135deg,
			#020617 0%,
			#0f172a 45%,
			#111827 100%
		)
	`,

	backgroundAttachment: "fixed",
};

const backgroundText = {
	position: "absolute",

	fontSize: 140,
	fontWeight: 900,

	background:
		"linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.025))",

	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",

	top: "50%",
	left: "50%",

	transform: "translate(-50%, -50%)",

	pointerEvents: "none",

	letterSpacing: 8,

	filter: "blur(1px)",

	opacity: 0.38,
};

const content = {
	position: "relative",
	zIndex: 1,

	width: "100%",

	display: "flex",
	flexDirection: "column",

	gap: 16,
};

const heroRow = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",

	gap: 16,

	flexWrap: "wrap",

	marginBottom: 4,
};

const brandBlock = {
	display: "flex",
	alignItems: "center",
	gap: 14,
};

const brandMark = {
	width: 46,
	height: 46,

	borderRadius: 16,

	display: "flex",
	alignItems: "center",
	justifyContent: "center",

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	color: "#fff",

	fontWeight: 900,
	fontSize: 18,

	boxShadow:
		"0 12px 28px rgba(37,99,235,.35)",
};

const heroTitle = {
	margin: 0,

	fontSize: 34,

	fontWeight: 900,

	color: "#fff",

	letterSpacing: 0.3,

	lineHeight: 1,
};

const heroSubtitle = {
	marginTop: 6,

	fontSize: 14,

	color: "rgba(255,255,255,.72)",

	fontWeight: 600,
};

const heroActions = {
	display: "flex",
	alignItems: "center",
	gap: 10,
	flexWrap: "wrap",
};

const tabsRow = {
	display: "flex",
	gap: 12,
	flexWrap: "wrap",
	alignItems: "center",
	marginBottom: 4,
};

const tabBtn = (active) => ({
	height: 46,

	padding: "0 18px",

	borderRadius: 999,

	border: active
		? "1px solid rgba(59,130,246,.4)"
		: "1px solid rgba(255,255,255,.06)",

	cursor: "pointer",

	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "rgba(15,23,42,.78)",

	color: "#fff",

	fontWeight: 800,

	boxShadow: active
		? "0 12px 28px rgba(37,99,235,.35)"
		: "none",

	transition: "all .25s ease",

	fontFamily: "inherit",
});

const viewShell = {
	width: "100%",
};

const activePageChipSx = {
	height: 38,

	borderRadius: "999px",

	background: "rgba(59,130,246,.14)",

	color: "#93c5fd",

	border: "1px solid rgba(59,130,246,.28)",

	fontWeight: 900,

	"& .MuiChip-icon": {
		color: "#93c5fd",
	},
};

const primaryActionBtnSx = {
	height: 46,

	px: 2.2,

	borderRadius: "14px",

	textTransform: "none",

	fontWeight: 850,

	color: "#fff",

	background:
		"linear-gradient(135deg,#2563eb,#3b82f6)",

	boxShadow:
		"0 12px 28px rgba(37,99,235,.35)",

	"&:hover": {
		background:
			"linear-gradient(135deg,#1d4ed8,#2563eb)",
	},
};

const secondaryActionBtnSx = {
	height: 46,

	px: 2.2,

	borderRadius: "14px",

	textTransform: "none",

	fontWeight: 850,

	color: "#fff",

	background: "rgba(15,23,42,.78)",

	border: "1px solid rgba(255,255,255,.08)",

	"&:hover": {
		background: "rgba(59,130,246,.14)",
		borderColor: "rgba(59,130,246,.28)",
	},
};