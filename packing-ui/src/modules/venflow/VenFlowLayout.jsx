import React from "react";
import {
	Outlet,
	useLocation,
	useNavigate,
} from "react-router-dom";

import {
	Box,
	Button,
	Chip,
	Typography,
} from "@mui/material";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";

import {
	canAccessVenFlowScreen,
	getVenFlowRole,
	venFlowRoleLabel,
} from "./utils/venflowAccess";

export default function VenFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	const role = getVenFlowRole();

	const navItems = [
		{
			label: "Dashboard",
			path: "/venflow/dashboard",
			screen: "dashboard",
			icon: <DashboardOutlinedIcon fontSize="small" />,
		},
		{
			label: "Production Desk",
			path: "/venflow/production",
			screen: "production",
			icon: <PrecisionManufacturingOutlinedIcon fontSize="small" />,
		},
		{
			label: "Store Desk",
			path: "/venflow/store",
			screen: "store",
			icon: <WarehouseOutlinedIcon fontSize="small" />,
		},
		{
			label: "Purchase Desk",
			path: "/venflow/purchase",
			screen: "purchase",
			icon: <ShoppingCartCheckoutOutlinedIcon fontSize="small" />,
		},
		{
			label: "Full Tracker",
			path: "/venflow/entries",
			screen: "entries",
			icon: <FormatListBulletedOutlinedIcon fontSize="small" />,
		},
		{
			label: "New Requirement",
			path: "/venflow/create",
			screen: "create",
			icon: <AddCircleOutlineOutlinedIcon fontSize="small" />,
		},
		{
			label: "Reports",
			path: "/venflow/reports",
			screen: "reports",
			icon: <AssessmentOutlinedIcon fontSize="small" />,
		},
	].filter((item) =>
		canAccessVenFlowScreen(item.screen, role)
	);

	return (
		<Box sx={pageSx}>
			<Box sx={backgroundText}>
				VenFlow
			</Box>

			<Box sx={contentSx}>
				<Box sx={heroRowSx}>
					<Box sx={heroLeftSx}>
						<Box sx={logoBoxSx}>
							<LayersOutlinedIcon />
						</Box>

						<Box>
							<Box sx={titleRowSx}>
								<Typography sx={titleSx}>
									VenFlow
								</Typography>

								<Chip
									label={venFlowRoleLabel(role)}
									size="small"
									sx={roleChipSx}
								/>
							</Box>

							<Typography sx={subtitleSx}>
								Department-wise veneer tracker for Production,
								Store, Purchase, PO approval and Job Done closure.
							</Typography>
						</Box>
					</Box>

					<Button
						startIcon={<AppsIcon />}
						onClick={() => navigate("/modules")}
						sx={moduleBtnSx}
					>
						Module Hub
					</Button>
				</Box>

				<Box sx={tabsRowSx}>
					{navItems.map((item) => {
						const active =
							location.pathname === item.path ||
							location.pathname.startsWith(`${item.path}/`);

						return (
							<Button
								key={item.path}
								startIcon={item.icon}
								onClick={() => navigate(item.path)}
								sx={tabBtnSx(active)}
							>
								{item.label}
							</Button>
						);
					})}
				</Box>

				<Box sx={outletSx}>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}

const pageSx = {
	minHeight: "100vh",
	position: "relative",
	overflowX: "hidden",
	overflowY: "auto",
	p: { xs: 2, md: 3 },
	background: `
		radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 22%),
		radial-gradient(circle at bottom right, rgba(14,165,233,0.12), transparent 24%),
		linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)
	`,
	backgroundAttachment: "fixed",
};

const backgroundText = {
	position: "fixed",
	fontSize: { xs: 90, md: 150 },
	fontWeight: 950,
	background:
		"linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.025))",
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	letterSpacing: 8,
	pointerEvents: "none",
	userSelect: "none",
	opacity: 0.5,
	filter: "blur(.8px)",
};

const contentSx = {
	position: "relative",
	zIndex: 1,
	maxWidth: 1500,
	mx: "auto",
	display: "flex",
	flexDirection: "column",
	gap: 2,
};

const heroRowSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 2,
	flexWrap: "wrap",
};

const heroLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 2,
};

const logoBoxSx = {
	width: 54,
	height: 54,
	borderRadius: "18px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg,#2563eb,#3b82f6)",
	color: "#fff",
	boxShadow: "0 16px 34px rgba(37,99,235,.32)",
	border: "1px solid rgba(255,255,255,.10)",
};

const titleRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	flexWrap: "wrap",
};

const titleSx = {
	fontSize: { xs: 28, md: 34 },
	fontWeight: 950,
	color: "#fff",
	letterSpacing: "-0.04em",
	lineHeight: 1,
};

const roleChipSx = {
	background: "rgba(59,130,246,.16)",
	color: "#bfdbfe",
	border: "1px solid rgba(59,130,246,.28)",
	fontWeight: 900,
};

const subtitleSx = {
	mt: 0.8,
	color: "rgba(255,255,255,.66)",
	fontSize: 14,
	fontWeight: 650,
};

const moduleBtnSx = {
	height: 44,
	borderRadius: "14px",
	px: 2,
	textTransform: "none",
	fontWeight: 900,
	color: "#fff",
	background: "rgba(255,255,255,.05)",
	border: "1px solid rgba(255,255,255,.10)",
	"&:hover": {
		background: "rgba(59,130,246,.16)",
		borderColor: "rgba(59,130,246,.35)",
	},
};

const tabsRowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.2,
	flexWrap: "wrap",
	my: 1,
};

const tabBtnSx = (active) => ({
	height: 46,
	borderRadius: "14px",
	px: 2,
	textTransform: "none",
	fontWeight: 850,
	color: "#fff",
	background: active
		? "linear-gradient(135deg,#2563eb,#3b82f6)"
		: "rgba(255,255,255,.045)",
	border: active
		? "1px solid rgba(59,130,246,.44)"
		: "1px solid rgba(255,255,255,.07)",
	boxShadow: active
		? "0 12px 28px rgba(37,99,235,.34)"
		: "none",
	"&:hover": {
		background: active
			? "linear-gradient(135deg,#1d4ed8,#2563eb)"
			: "rgba(59,130,246,.12)",
		borderColor: "rgba(59,130,246,.30)",
	},
});

const outletSx = {
	mt: 1,
};