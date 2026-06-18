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

const bomSections = [
	"Metal",
	"Wood",
	"Hardware",
	"Stone",
	"Glass",
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

	const isBOMBuilder = location.pathname.startsWith("/bomflow/bom-builder");

	const showDraftActions =
		location.pathname.startsWith("/bomflow/products") ||
		location.pathname.startsWith("/bomflow/bom-builder") ||
		location.pathname.startsWith("/bomflow/costing");

	return (
		<Box sx={shellSx}>
			<Box sx={sidebarSx}>
				<Box sx={brandSx}>
					<Box sx={brandMarkSx}>B</Box>

					<Box sx={{ minWidth: 0 }}>
						<Typography sx={brandTitleSx}>Alsorg</Typography>
						<Typography sx={brandSubSx}>BOMFlow</Typography>
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
						<Box sx={systemTitleBlockSx}>
							<Typography sx={systemTitleSx}>
								BOMFlow
							</Typography>

							<Typography sx={systemSubtitleSx}>
								Alsorg Operations Suite
							</Typography>
						</Box>

						<Box sx={topbarDividerSx} />

						<Chip
							label={activeLabel}
							size="small"
							sx={breadcrumbChipSx}
						/>
					</Box>

					<Box sx={topbarMiddleSx}>
						{isBOMBuilder && (
							<Box sx={sectionTabsSx}>
								{bomSections.map((item, index) => {
									const active = index === 0;

									return (
										<Chip
											key={item}
											label={item}
											size="small"
											sx={active ? activeSectionChipSx : sectionChipSx}
										/>
									);
								})}
							</Box>
						)}
					</Box>

					<Box sx={topbarRightSx}>
						<Box sx={iconGroupSx}>
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
						</Box>

						{showDraftActions && (
							<>
								<Box sx={topbarActionDividerSx} />

								<Box sx={actionGroupSx}>
									<Button sx={saveBtnSx}>
										Save Draft
									</Button>

									<Button sx={approveBtnSx}>
										Approve BOM
									</Button>
								</Box>
							</>
						)}

						<Box sx={userPillSx}>
							<Box sx={avatarSx}>
								{username.charAt(0).toUpperCase()}
							</Box>

							<Box sx={userTextSx}>
								<Typography sx={userNameSx}>
									{username}
								</Typography>

								<Typography sx={userRoleSx}>
									Active User
								</Typography>
							</Box>
						</Box>

						<Tooltip title="Logout">
							<IconButton onClick={logout} sx={logoutIconBtnSx}>
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

/* ===================== SHELL ===================== */

const shellSx = {
	height: "100vh",
	width: "100%",
	display: "flex",
	overflow: "hidden",
	background: "#0b0f17",
	color: "#e5e7eb",
	fontFamily: "Inter, system-ui, sans-serif",
};

/* ===================== SIDEBAR ===================== */

const sidebarSx = {
	width: 268,
	minWidth: 268,
	height: "100vh",
	background:
		"linear-gradient(180deg, #1b202a 0%, #151922 100%)",
	borderRight: "1px solid rgba(148,163,184,.18)",
	display: "flex",
	flexDirection: "column",
	p: 2,
	boxSizing: "border-box",
	boxShadow: "10px 0 34px rgba(0,0,0,.26)",
	overflow: "hidden",
};

const brandSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.4,
	mb: 4,
	px: 0.5,
};

const brandMarkSx = {
	width: 44,
	height: 44,
	borderRadius: "10px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg, #a8c3ff, #7ea8ff)",
	color: "#111827",
	fontWeight: 950,
	fontSize: 18,
	boxShadow: "0 14px 30px rgba(79,141,247,.32)",
	flexShrink: 0,
};

const brandTitleSx = {
	color: "#eef4ff",
	fontSize: 28,
	lineHeight: 1,
	fontWeight: 950,
	letterSpacing: "-0.045em",
};

const brandSubSx = {
	color: "rgba(255,255,255,.58)",
	mt: 0.45,
	fontSize: 13,
	fontWeight: 750,
	letterSpacing: 0.2,
};

const navSx = {
	display: "flex",
	flexDirection: "column",
	gap: 0.8,
};

const navItemStyle = {
	width: "100%",
	height: 48,
	border: "1px solid transparent",
	borderRadius: 12,
	background: "transparent",
	color: "rgba(255,255,255,.68)",
	display: "flex",
	alignItems: "center",
	gap: 14,
	padding: "0 14px",
	fontWeight: 850,
	cursor: "pointer",
	textAlign: "left",
	transition: "all .2s ease",
};

const navItemActiveStyle = {
	background: "linear-gradient(135deg, #4f8df7, #6ea5ff)",
	color: "#0f172a",
	border: "1px solid rgba(168,195,255,.38)",
	boxShadow: "0 16px 34px rgba(79,141,247,.28)",
};

const navIconStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 22,
	flexShrink: 0,
};

const sidebarFooterSx = {
	borderTop: "1px solid rgba(255,255,255,.10)",
	pt: 2,
	display: "flex",
	flexDirection: "column",
	gap: 1,
};

const newCostingBtnSx = {
	height: 48,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 900,
	background: "linear-gradient(135deg, #a8c3ff, #8fb5ff)",
	color: "#0f172a",
	boxShadow: "0 14px 30px rgba(79,141,247,.30)",
	"&:hover": {
		background: "linear-gradient(135deg, #bdd1ff, #9bbcff)",
	},
};

const allModulesBtnSx = {
	height: 42,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 850,
	color: "#dbeafe",
	border: "1px solid rgba(255,255,255,.10)",
	background: "rgba(255,255,255,.04)",
	"&:hover": {
		background: "rgba(79,141,247,.12)",
		borderColor: "rgba(168,195,255,.22)",
	},
};

/* ===================== MAIN ===================== */

const mainSx = {
	flex: 1,
	minWidth: 0,
	height: "100vh",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
};

/* ===================== TOPBAR ===================== */

const topbarSx = {
	height: 72,
	minHeight: 72,
	background:
		"linear-gradient(180deg, rgba(18,23,34,.98) 0%, rgba(15,20,29,.98) 100%)",
	borderBottom: "1px solid rgba(148,163,184,.18)",
	display: "flex",
	alignItems: "center",
	gap: 2,
	px: 2.4,
	position: "relative",
	zIndex: 20,
	boxShadow: "0 10px 34px rgba(0,0,0,.28)",
	flexShrink: 0,
};

const topbarLeftSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.6,
	minWidth: 285,
	maxWidth: 380,
	flex: "0 0 auto",
};

const systemTitleBlockSx = {
	display: "flex",
	flexDirection: "column",
	justifyContent: "center",
	minWidth: 116,
};

const systemTitleSx = {
	color: "#eaf1ff",
	fontWeight: 950,
	fontSize: 22,
	lineHeight: 1,
	letterSpacing: "-0.04em",
	textShadow: "0 8px 22px rgba(79,141,247,.22)",
};

const systemSubtitleSx = {
	color: "rgba(255,255,255,.48)",
	fontSize: 11,
	fontWeight: 750,
	mt: 0.55,
	letterSpacing: 0.35,
	whiteSpace: "nowrap",
};

const topbarDividerSx = {
	width: 1,
	height: 38,
	background:
		"linear-gradient(180deg, transparent, rgba(255,255,255,.18), transparent)",
	flexShrink: 0,
};

const breadcrumbChipSx = {
	height: 30,
	maxWidth: 150,
	borderRadius: "999px",
	background: "rgba(79,141,247,.11)",
	color: "#bcd2ff",
	border: "1px solid rgba(168,195,255,.20)",
	fontSize: 11,
	fontWeight: 950,
	letterSpacing: ".08em",
	textTransform: "uppercase",
	"& .MuiChip-label": {
		px: 1.2,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
};

const topbarMiddleSx = {
	flex: "1 1 auto",
	minWidth: 0,
	display: "flex",
	justifyContent: "center",
	alignItems: "center",
};

const sectionTabsSx = {
	height: 42,
	display: "flex",
	alignItems: "center",
	gap: 0.6,
	px: 0.8,
	borderRadius: "999px",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.07)",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
	maxWidth: "100%",
	overflow: "hidden",
};

const sectionChipSx = {
	height: 30,
	borderRadius: "999px",
	background: "transparent",
	color: "rgba(255,255,255,.62)",
	fontSize: 12,
	fontWeight: 850,
	transition: "all .2s ease",
	"& .MuiChip-label": {
		px: 1.2,
	},
	"&:hover": {
		background: "rgba(255,255,255,.06)",
		color: "#fff",
	},
};

const activeSectionChipSx = {
	...sectionChipSx,
	color: "#0f172a",
	background: "#a8c3ff",
	boxShadow: "0 10px 24px rgba(79,141,247,.28)",
	"&:hover": {
		background: "#bdd1ff",
		color: "#0f172a",
	},
};

const topbarRightSx = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: 0.8,
	minWidth: 0,
	flex: "0 0 auto",
};

const iconGroupSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.35,

	"@media (max-width: 1450px)": {
		display: "none",
	},
};

const topIconBtnSx = {
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "rgba(255,255,255,.66)",
	background: "rgba(255,255,255,.035)",
	border: "1px solid rgba(255,255,255,.055)",
	transition: "all .2s ease",
	"&:hover": {
		background: "rgba(79,141,247,.14)",
		borderColor: "rgba(168,195,255,.25)",
		color: "#eaf1ff",
		transform: "translateY(-1px)",
	},
};

const topbarActionDividerSx = {
	width: 1,
	height: 38,
	mx: 0.2,
	background:
		"linear-gradient(180deg, transparent, rgba(255,255,255,.16), transparent)",

	"@media (max-width: 1450px)": {
		display: "none",
	},
};

const actionGroupSx = {
	display: "flex",
	alignItems: "center",
	gap: 0.8,
};

const saveBtnSx = {
	height: 40,
	minWidth: 100,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 900,
	fontSize: 12.5,
	color: "#dbeafe",
	border: "1px solid rgba(168,195,255,.32)",
	background:
		"linear-gradient(180deg, rgba(15,23,42,.95), rgba(17,24,39,.88))",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
	"&:hover": {
		background: "rgba(79,141,247,.14)",
		borderColor: "rgba(168,195,255,.48)",
	},

	"@media (max-width: 1250px)": {
		display: "none",
	},
};

const approveBtnSx = {
	height: 40,
	minWidth: 120,
	borderRadius: "12px",
	textTransform: "none",
	fontWeight: 950,
	fontSize: 12.5,
	color: "#0f172a",
	background: "linear-gradient(135deg, #a8c3ff, #8fb5ff)",
	boxShadow: "0 12px 28px rgba(79,141,247,.30)",
	"&:hover": {
		background: "linear-gradient(135deg, #bdd1ff, #9bbcff)",
		boxShadow: "0 14px 34px rgba(79,141,247,.38)",
	},

	"@media (max-width: 1250px)": {
		display: "none",
	},
};

const userPillSx = {
	height: 40,
	display: "flex",
	alignItems: "center",
	gap: 0.8,
	pl: 0.5,
	pr: 1,
	borderRadius: "999px",
	background: "rgba(255,255,255,.045)",
	border: "1px solid rgba(255,255,255,.075)",
	minWidth: 0,
};

const avatarSx = {
	width: 32,
	height: 32,
	borderRadius: "10px",
	display: "grid",
	placeItems: "center",
	background: "linear-gradient(135deg, #7c2bd6, #9333ea)",
	color: "#fff",
	fontWeight: 950,
	fontSize: 13,
	boxShadow: "0 10px 22px rgba(124,43,214,.28)",
	flexShrink: 0,
};

const userTextSx = {
	display: {
		xs: "none",
		xl: "flex",
	},
	flexDirection: "column",
	minWidth: 0,
};

const userNameSx = {
	color: "#fff",
	fontSize: 12,
	fontWeight: 900,
	lineHeight: 1.1,
	maxWidth: 92,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const userRoleSx = {
	color: "rgba(255,255,255,.45)",
	fontSize: 10,
	fontWeight: 750,
	lineHeight: 1.1,
	mt: 0.35,
};

const logoutIconBtnSx = {
	width: 38,
	height: 38,
	borderRadius: "12px",
	color: "#fca5a5",
	background: "rgba(239,68,68,.075)",
	border: "1px solid rgba(239,68,68,.14)",
	transition: "all .2s ease",
	"&:hover": {
		background: "rgba(239,68,68,.15)",
		borderColor: "rgba(239,68,68,.28)",
		color: "#fecaca",
		transform: "translateY(-1px)",
	},
};

/* ===================== CONTENT ===================== */

const contentSx = {
	flex: 1,
	minHeight: 0,
	overflow: "auto",
	p: 2.8,
	background:
		"radial-gradient(circle at top left, rgba(79,141,247,.07), transparent 26%), #0b0f17",
};