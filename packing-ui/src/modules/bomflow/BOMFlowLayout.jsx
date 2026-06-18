import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import {
	Box,
	Button,
	Chip,
	IconButton,
	Tooltip,
	Typography,
} from "@mui/material";

import AppsIcon from "@mui/icons-material/Apps";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";

const navItems = [
	{
		label: "Dashboard",
		path: "/bomflow/dashboard",
		icon: <DashboardOutlinedIcon />,
	},
	{
		label: "Product Master",
		path: "/bomflow/products",
		icon: <Inventory2OutlinedIcon />,
	},
	{
		label: "BOM Builder",
		path: "/bomflow/bom-builder",
		icon: <RuleOutlinedIcon />,
	},
	{
		label: "Rate Master",
		path: "/bomflow/rate-master",
		icon: <PriceChangeOutlinedIcon />,
	},
	{
		label: "Labour Master",
		path: "/bomflow/labour-master",
		icon: <EngineeringOutlinedIcon />,
	},
	{
		label: "Costing Engine",
		path: "/bomflow/costing",
		icon: <CalculateOutlinedIcon />,
	},
	{
		label: "Reports",
		path: "/bomflow/reports",
		icon: <AssessmentOutlinedIcon />,
	},
];

export default function BOMFlowLayout() {
	const navigate = useNavigate();
	const location = useLocation();

	const username = localStorage.getItem("username") || "User";

	const logout = () => {
		localStorage.clear();
		navigate("/login", { replace: true });
	};

	const activeLabel =
		navItems.find((item) => location.pathname.startsWith(item.path))?.label ||
		"Dashboard";

	return (
		<Box sx={shellSx}>
			<Box sx={sidebarSx}>
				<Box sx={brandSx}>
					<Box sx={brandMarkSx}>B</Box>

					<Box>
						<Typography sx={brandTitleSx}>BOMFlow</Typography>
						<Typography sx={brandSubSx}>Industrial Costing</Typography>
					</Box>
				</Box>

				<Box sx={navSx}>
					{navItems.map((item) => {
						const active = location.pathname.startsWith(item.path);

						return (
							<button
								key={item.path}
								type="button"
								style={{
									...navItemStyle,
									...(active ? navItemActiveStyle : {}),
								}}
								onClick={() => navigate(item.path)}
							>
								<span style={navIconStyle}>{item.icon}</span>
								<span>{item.label}</span>
							</button>
						);
					})}
				</Box>

				<Box sx={{ flex: 1 }} />

				<Box sx={sidebarFooterSx}>
					<Button
						fullWidth
						startIcon={<AddIcon />}
						onClick={() => navigate("/bomflow/products")}
						sx={newCostingBtnSx}
					>
						New Costing
					</Button>

					<Button
						fullWidth
						startIcon={<AppsIcon />}
						onClick={() => navigate("/modules")}
						sx={allModulesBtnSx}
					>
						All Modules
					</Button>
				</Box>
			</Box>

			<Box sx={mainSx}>
				<Box sx={topbarSx}>
					<Box sx={topbarLeftSx}>
						<Typography sx={systemTitleSx}>BOMFlow System</Typography>

						<Box sx={topbarDividerSx} />

						<Typography sx={breadcrumbSx}>{activeLabel}</Typography>
					</Box>

					<Box sx={topbarCenterSx}>
						{["Metal", "Wood", "Hardware", "Stone", "Glass"].map((item) => (
							<Chip
								key={item}
								label={item}
								size="small"
								sx={item === "Metal" ? activeTopChipSx : topChipSx}
							/>
						))}
					</Box>

					<Box sx={topbarRightSx}>
						<Tooltip title="Notifications">
							<IconButton sx={topIconBtnSx}>
								<NotificationsNoneOutlinedIcon />
							</IconButton>
						</Tooltip>

						<Tooltip title="Settings">
							<IconButton sx={topIconBtnSx}>
								<SettingsOutlinedIcon />
							</IconButton>
						</Tooltip>

						<Tooltip title="Help">
							<IconButton sx={topIconBtnSx}>
								<HelpOutlineOutlinedIcon />
							</IconButton>
						</Tooltip>

						<Button sx={saveBtnSx}>Save Draft</Button>

						<Button sx={approveBtnSx}>Approve BOM</Button>

						<Box sx={avatarSx}>{username.charAt(0).toUpperCase()}</Box>

						<Tooltip title="Logout">
							<IconButton onClick={logout} sx={topIconBtnSx}>
								<LogoutIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Box>

				<Box sx={contentSx}>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}

const shellSx = {
	minHeight: "100vh",
	display: "flex",
	background: "#0b0f17",
	color: "#e5e7eb",
	fontFamily: "Inter, system-ui, sans-serif",
};

const sidebarSx = {
	width: 280,
	minWidth: 280,
	minHeight: "100vh",
	background: "#1a1e27",
	borderRight: "1px solid rgba(148,163,184,.20)",
	display: "flex",
	flexDirection: "column",
	p: 2,
	boxSizing: "border-box",
};

const brandSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	mb: 4,
	px: 0.8,
};

const brandMarkSx = {
	width: 42,
	height: 42,
	borderRadius: "4px",
	display: "grid",
	placeItems: "center",
	background: "#8fb5ff",
	color: "#111827",
	fontWeight: 950,
	fontSize: 18,
};

const brandTitleSx = {
	color: "#dbeafe",
	fontSize: 30,
	lineHeight: 1,
	fontWeight: 950,
	letterSpacing: "-0.04em",
};

const brandSubSx = {
	color: "rgba(255,255,255,.72)",
	mt: 0.5,
	fontSize: 13,
	fontWeight: 700,
};

const navSx = {
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const navItemStyle = {
	width: "100%",
	height: 46,
	border: "none",
	borderRadius: 8,
	background: "transparent",
	color: "rgba(255,255,255,.72)",
	display: "flex",
	alignItems: "center",
	gap: 14,
	padding: "0 14px",
	fontWeight: 800,
	cursor: "pointer",
	textAlign: "left",
};

const navItemActiveStyle = {
	background: "#4f8df7",
	color: "#111827",
};

const navIconStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 22,
};

const sidebarFooterSx = {
	borderTop: "1px solid rgba(255,255,255,.12)",
	pt: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const newCostingBtnSx = {
	height: 48,
	borderRadius: "6px",
	textTransform: "none",
	fontWeight: 850,
	background: "#a8c3ff",
	color: "#0f172a",
	"&:hover": {
		background: "#bdd1ff",
	},
};

const allModulesBtnSx = {
	height: 42,
	borderRadius: "6px",
	textTransform: "none",
	fontWeight: 850,
	color: "#dbeafe",
	border: "1px solid rgba(255,255,255,.12)",
	background: "rgba(255,255,255,.04)",
	"&:hover": {
		background: "rgba(255,255,255,.08)",
	},
};

const mainSx = {
	flex: 1,
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
};

const topbarSx = {
	height: 64,
	background: "#11151d",
	borderBottom: "1px solid rgba(148,163,184,.22)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: 3,
	gap: 2,
};

const topbarLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 2,
	minWidth: 300,
};

const systemTitleSx = {
	color: "#dbeafe",
	fontWeight: 950,
	fontSize: 18,
	letterSpacing: "-0.03em",
};

const topbarDividerSx = {
	width: 1,
	height: 34,
	background: "rgba(255,255,255,.16)",
};

const breadcrumbSx = {
	color: "rgba(255,255,255,.78)",
	fontSize: 12,
	fontWeight: 900,
	textTransform: "uppercase",
	letterSpacing: ".08em",
};

const topbarCenterSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const topChipSx = {
	background: "transparent",
	color: "rgba(255,255,255,.70)",
	fontWeight: 850,
	borderRadius: 0,
};

const activeTopChipSx = {
	...topChipSx,
	color: "#dbeafe",
	borderBottom: "2px solid #9bbcff",
};

const topbarRightSx = {
	display: "flex",
	alignItems: "center",
	gap: 1,
};

const topIconBtnSx = {
	color: "rgba(255,255,255,.72)",
	width: 36,
	height: 36,
	"&:hover": {
		background: "rgba(255,255,255,.07)",
		color: "#fff",
	},
};

const saveBtnSx = {
	width: 90,
	height: 48,
	borderRadius: "5px",
	textTransform: "none",
	lineHeight: 1.1,
	fontWeight: 850,
	color: "#dbeafe",
	border: "1px solid #7896d8",
	background: "#10141d",
	"&:hover": {
		background: "#172033",
	},
};

const approveBtnSx = {
	width: 108,
	height: 48,
	borderRadius: "5px",
	textTransform: "none",
	lineHeight: 1.1,
	fontWeight: 850,
	color: "#172033",
	background: "#a8c3ff",
	"&:hover": {
		background: "#bdd1ff",
	},
};

const avatarSx = {
	width: 34,
	height: 34,
	borderRadius: "8px",
	display: "grid",
	placeItems: "center",
	background: "#7c2bd6",
	color: "#fff",
	fontWeight: 950,
};

const contentSx = {
	flex: 1,
	minHeight: 0,
	overflow: "auto",
	p: 3,
	background: "#0b0f17",
};